// backend/src/routes/message.js
const Message = require("../models/Message");
const Room = require("../models/Room");
const store = require("../store");
const xss = require("xss");

// Web Push (VAPID). Graceful fallback if the service can't load so message
// sending never breaks because of a push problem.
let PushNotificationService = null;
try {
  PushNotificationService = require("../services/PushNotificationService");
} catch (e) {
  console.warn("⚠️ PushNotificationService not available — web push disabled");
}

module.exports = (req, res, next) => {
  const { roomID, authorID, content, type, fileID } = req.fields;
  const companyId = req.headers["x-company-id"];

  console.log(`📤 New message request:`, {
    roomID,
    authorID,
    companyId,
    contentPreview: content?.substring(0, 50),
  });

  // Validate required fields
  if (!roomID || !authorID || !companyId) {
    console.log("❌ Missing required fields");
    return res.status(400).json({
      error: "Room ID, Author ID, and Company ID are required.",
    });
  }

  // Verify the room belongs to the same company before creating message
  Room.findOne({ _id: roomID, companyId })
    .then((room) => {
      if (!room) {
        console.log("❌ Room not found:", roomID);
        return res
          .status(404)
          .json({ error: "Room not found or access denied." });
      }

      // Check if user is a member of this room
      const isMember = room.people.some(
        (person) => authorID.toString() === person.toString(),
      );

      if (!isMember) {
        console.log("❌ User not a member of room:", authorID);
        return res.status(403).json({ error: "Access denied to this room." });
      }

      console.log("✅ Room verified, creating message");

      // Create message with companyId
      new Message({
        room: roomID,
        author: authorID,
        content: xss(content),
        type,
        file: fileID,
        companyId,
      })
        .save()
        .then((message) => {
          console.log("✅ Message created:", message._id);

          Message.findById(message._id)
            .populate({
              path: "author",
              select: "-email -password -friends -__v",
              populate: [
                {
                  path: "picture",
                },
              ],
            })
            .populate([{ path: "file", strictPopulate: false }])
            .then(async (message) => {
              console.log("✅ Message populated, updating room");

              // Update room with latest message info
              await Room.findOneAndUpdate(
                { _id: roomID, companyId },
                {
                  $set: {
                    lastUpdate: message.date,
                    lastMessage: message._id,
                    lastAuthor: authorID,
                  },
                },
              );

              // 🆕 CRITICAL: Auto-mark sender as having read the room
              console.log(
                `📖 Marking sender ${authorID} as read in room ${roomID}`,
              );

              // Remove old lastRead entry for sender
              await Room.updateOne(
                { _id: roomID },
                { $pull: { lastReadByUser: { userId: authorID } } },
              );

              // Add new lastRead entry with current timestamp
              await Room.updateOne(
                { _id: roomID },
                {
                  $push: {
                    lastReadByUser: {
                      userId: authorID,
                      lastReadAt: new Date(),
                    },
                  },
                },
              );

              console.log(`✅ Sender marked as read`);

              // Re-fetch room with updated info for socket emission
              const updatedRoom = await Room.findOne({ _id: roomID, companyId })
                .populate([{ path: "picture", strictPopulate: false }])
                .populate({
                  path: "people",
                  select: "-email -password -friends -__v",
                  populate: {
                    path: "picture",
                  },
                })
                .populate("lastMessage");

              if (!updatedRoom) {
                console.log("❌ Failed to fetch updated room");
                return res.status(404).json({ error: "Room update failed." });
              }

              console.log(
                `📡 Emitting message to ${updatedRoom.people.length} room members (including sender's other devices)`,
              );

              // ✅ FIXED: Emit to ALL room members including sender
              // This ensures when you send from mobile, your desktop receives it too!
              let emittedCount = 0;
              updatedRoom.people.forEach((person) => {
                const personUserID = person._id.toString();

                // REMOVED: if (personUserID !== myUserID) check
                // Now broadcasts to EVERYONE including sender's other logged-in devices
                store.io.to(personUserID).emit("message-in", {
                  status: 200,
                  message,
                  room: updatedRoom,
                });
                emittedCount++;
                console.log(`  📤 Emitted to user: ${personUserID}`);
              });

              console.log(
                `✅ Message emitted to ${emittedCount} users (including all sender's devices)`,
              );

              // 🔔 WEB PUSH — send to every recipient DEVICE (except the author),
              // regardless of whether the user has another device online.
              //
              // This is the fix for missed notifications on multiple devices:
              // previously messages were delivered only over Socket.IO, so a
              // backgrounded / locked / closed device (whose socket has dropped)
              // received nothing. A user with the desktop open therefore missed
              // items on their phone. sendToUsers() fans out to ALL of each
              // recipient's push subscriptions and prunes dead ones.
              if (PushNotificationService) {
                try {
                  const authorIdStr = authorID.toString();
                  const recipientIds = updatedRoom.people
                    .map((p) => p._id.toString())
                    .filter((id) => id !== authorIdStr);

                  if (recipientIds.length > 0) {
                    const author = message.author || {};
                    const senderName =
                      [author.firstName, author.lastName]
                        .filter(Boolean)
                        .join(" ") ||
                      author.name ||
                      "New message";

                    let bodyText;
                    if (type === "image") bodyText = "📷 Photo";
                    else if (type === "file") bodyText = "📎 File";
                    else
                      bodyText =
                        (content || "").toString().substring(0, 140) ||
                        "New message";

                    const isGroup = !!updatedRoom.isGroup;
                    const pushPayload = {
                      title: isGroup
                        ? updatedRoom.title || "New message"
                        : senderName,
                      body: isGroup ? `${senderName}: ${bodyText}` : bodyText,
                      tag: roomID,
                      roomId: roomID,
                      url: `/room/${roomID}`,
                      icon: "/flowicon192.webp",
                      badge: "/flowicon192.webp",
                      renotify: true,
                    };

                    // Fire-and-forget: never block or fail the message on push.
                    PushNotificationService.sendToUsers(
                      recipientIds,
                      pushPayload,
                    ).catch((err) =>
                      console.error("⚠️ Web push failed (non-critical):", err),
                    );
                  }
                } catch (pushErr) {
                  console.error(
                    "⚠️ Web push setup error (non-critical):",
                    pushErr,
                  );
                }
              }

              res.status(200).json({ message, room: updatedRoom });
            })
            .catch((err) => {
              console.error("❌ Error loading message:", err);
              return res
                .status(500)
                .json({ error: "Server error loading message." });
            });
        })
        .catch((err) => {
          console.error("❌ Error creating message:", err);
          return res
            .status(500)
            .json({ error: "Server error creating message." });
        });
    })
    .catch((err) => {
      console.error("❌ Error verifying room:", err);
      return res.status(500).json({ error: "Server error verifying room." });
    });
};
