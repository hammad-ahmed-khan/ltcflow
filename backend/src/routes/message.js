// backend/src/routes/message.js
const Message = require("../models/Message");
const Room = require("../models/Room");
const store = require("../store");
const xss = require("xss");

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
        (person) => authorID.toString() === person.toString()
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
                }
              );

              // 🆕 CRITICAL: Auto-mark sender as having read the room
              console.log(
                `📖 Marking sender ${authorID} as read in room ${roomID}`
              );

              // Remove old lastRead entry for sender
              await Room.updateOne(
                { _id: roomID },
                { $pull: { lastReadByUser: { userId: authorID } } }
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
                }
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
                `📡 Emitting message to ${updatedRoom.people.length} room members`
              );

              // Emit to room members (they're all in the same company)
              let emittedCount = 0;
              updatedRoom.people.forEach((person) => {
                const myUserID = req.user.id;
                const personUserID = person._id.toString();

                if (personUserID !== myUserID) {
                  store.io.to(personUserID).emit("message-in", {
                    status: 200,
                    message,
                    room: updatedRoom,
                  });
                  emittedCount++;
                  console.log(`  📤 Emitted to user: ${personUserID}`);
                }
              });

              console.log(`✅ Message emitted to ${emittedCount} users`);

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
