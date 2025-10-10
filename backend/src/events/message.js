// backend/src/events/message.js
// Complete implementation with Push Notification support

const Message = require("../models/Message");
const Room = require("../models/Room");
const User = require("../models/User");
const store = require("../store");

// 🆕 Import PushNotificationService (graceful fallback if not installed yet)
let PushNotificationService = null;
try {
  PushNotificationService = require("../services/PushNotificationService");
  console.log("✅ PushNotificationService loaded");
} catch (error) {
  console.warn(
    "⚠️ PushNotificationService not found - push notifications disabled"
  );
}

module.exports = async (socket, data) => {
  try {
    // Get user ID from JWT token
    const userId = socket.decoded_token.id;
    const { roomID, content, tempID, type } = data;

    console.log(`📨 NEW MESSAGE from user ${userId} to room ${roomID}`);

    // 1. GET USER'S COMPANY
    const currentUser = await User.findById(userId).select("companyId name");
    if (!currentUser) {
      console.error(`❌ User ${userId} not found`);
      return socket.emit("message-error", {
        status: 404,
        error: "User not found",
        tempID: tempID,
      });
    }

    const companyId = currentUser.companyId;

    // 2. VALIDATE ROOM EXISTS AND USER IS MEMBER
    const room = await Room.findOne({
      _id: roomID,
      companyId: companyId, // Must be same company
      people: { $in: [userId] }, // User must be member
    })
      .populate({
        path: "people",
        select: "_id name email picture companyId",
        populate: {
          path: "picture",
        },
      })
      .lean();

    if (!room) {
      console.error(`❌ Room ${roomID} not found or user not authorized`);
      return socket.emit("message-error", {
        status: 404,
        error: "Room not found or unauthorized",
        tempID: tempID,
      });
    }

    console.log(`✅ Room validated: ${roomID} (${room.people.length} members)`);

    // 3. CREATE MESSAGE
    const message = new Message({
      room: roomID,
      author: userId,
      content: content || "",
      companyId: companyId, // Important for multi-tenant
      date: new Date(),
      type: type || "text",
    });

    await message.save();
    console.log(`✅ Message ${message._id} created successfully`);

    // 4. POPULATE AUTHOR DETAILS
    await message.populate({
      path: "author",
      select: "name email picture",
      populate: {
        path: "picture",
      },
    });

    // 5. UPDATE ROOM'S LAST MESSAGE TIMESTAMP
    await Room.findByIdAndUpdate(roomID, {
      lastMessageDate: message.date,
    }).catch((err) =>
      console.error("⚠️ Failed to update room timestamp:", err)
    );

    // 6. PREPARE BROADCAST PAYLOAD
    const messagePayload = {
      room: {
        _id: room._id.toString(),
        isGroup: room.isGroup || false,
        name: room.name || getDirectMessageName(room, userId),
        companyId: room.companyId,
      },
      message: {
        _id: message._id.toString(),
        content: message.content,
        type: message.type || "text",
        author: {
          _id: message.author._id.toString(),
          name: message.author.name,
          email: message.author.email,
          picture: message.author.picture,
        },
        date: message.date,
        room: roomID,
        companyId: companyId,
      },
      timestamp: Date.now(),
    };

    // 7. 🔔 BROADCAST TO ALL ROOM MEMBERS (CRITICAL FOR NOTIFICATIONS)
    console.log(
      `📤 Broadcasting message to ${room.people.length} room members...`
    );

    let successCount = 0;
    let failCount = 0;
    let offlineUserIds = [];

    // Get online user IDs from store
    const onlineUserIds = Array.from(store.onlineUsers.values()).map(
      (u) => u.id
    );
    console.log(`👥 Currently online users: ${onlineUserIds.length}`);

    room.people.forEach((person) => {
      const personId = person._id.toString();

      try {
        // CRITICAL: Emit to user's personal room (they joined on socket auth)
        // This is the KEY to reliable notifications!
        store.io.to(personId).emit("message-in", messagePayload);

        // Check if user is actually online
        const isOnline = onlineUserIds.includes(personId);

        if (isOnline) {
          successCount++;
          console.log(
            `  ✓ Broadcasted to online user: ${person.name} (${personId})`
          );
        } else {
          // User is offline - queue for push notification
          if (personId !== userId) {
            // Don't notify the sender
            offlineUserIds.push(personId);
            console.log(
              `  📱 Queued push for offline user: ${person.name} (${personId})`
            );
          }
        }
      } catch (error) {
        failCount++;
        console.error(`  ✗ Failed to broadcast to ${personId}:`, error.message);
      }
    });

    console.log(
      `📊 Broadcast complete: ${successCount} online, ${failCount} failed, ${offlineUserIds.length} offline`
    );

    // 8. 🆕 SEND PUSH NOTIFICATIONS TO OFFLINE USERS
    if (offlineUserIds.length > 0 && PushNotificationService) {
      console.log(
        `📤 Sending push notifications to ${offlineUserIds.length} offline users...`
      );

      try {
        const senderName = currentUser.name;
        const roomDisplayName = room.isGroup ? room.name : senderName;

        const pushPayload = {
          title: `New message from ${roomDisplayName}`,
          body: content?.substring(0, 100) || "New message",
          tag: room._id.toString(),
          roomId: room._id.toString(),
          url: `/conversation/${room._id}`,
          icon: "/logo192.png",
          badge: "/logo192.png",
          requireInteraction: false,
          actions: [
            { action: "open", title: "Open" },
            { action: "dismiss", title: "Dismiss" },
          ],
        };

        // Send push notifications asynchronously (don't block message)
        PushNotificationService.sendToUsers(offlineUserIds, pushPayload)
          .then(() => {
            console.log(
              `✅ Push notifications sent successfully to ${offlineUserIds.length} users`
            );
          })
          .catch((pushError) => {
            // Don't fail the message if push fails
            console.error(
              "❌ Push notification error (non-critical):",
              pushError
            );
          });
      } catch (pushError) {
        // Don't fail the message if push fails
        console.error("❌ Push setup error (non-critical):", pushError);
      }
    } else if (offlineUserIds.length > 0) {
      console.log(
        "ℹ️ Push notifications not available - PushNotificationService not loaded"
      );
    } else {
      console.log("ℹ️ No offline users - no push notifications needed");
    }

    // 9. SEND ACKNOWLEDGMENT TO SENDER
    socket.emit("message-ack", {
      success: true,
      messageID: message._id.toString(),
      tempID: tempID,
      timestamp: Date.now(),
      broadcastCount: successCount,
      pushNotificationsSent: offlineUserIds.length,
    });

    console.log(`✅ Message ${message._id} fully processed and acknowledged`);
  } catch (error) {
    console.error("❌ Error in message event:", error);

    // Send error response
    socket.emit("message-error", {
      status: 500,
      error: error.message,
      tempID: data.tempID,
    });
  }
};

// Helper function to get name for direct messages
function getDirectMessageName(room, currentUserId) {
  if (room.name) return room.name;

  // For direct messages (not groups), get the other person's name
  const otherPerson = room.people.find(
    (p) => p._id.toString() !== currentUserId
  );

  return otherPerson?.name || "Unknown User";
}
