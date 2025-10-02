// backend/src/events/message.js
// CREATE THIS NEW FILE

const Message = require("../models/Message");
const Room = require("../models/Room");
const User = require("../models/User");
const store = require("../store");

module.exports = async (socket, data) => {
  try {
    // Get user ID from JWT token
    const userId = socket.decoded_token.id;
    const { roomID, content, tempID } = data;

    console.log(`📨 NEW MESSAGE from user ${userId} to room ${roomID}`);

    // 1. GET USER'S COMPANY
    const user = await User.findById(userId).select("companyId");
    if (!user) {
      console.error(`❌ User ${userId} not found`);
      return socket.emit("message-error", {
        status: 404,
        error: "User not found",
        tempID: tempID,
      });
    }

    const companyId = user.companyId;

    // 2. VALIDATE ROOM EXISTS AND USER IS MEMBER
    const room = await Room.findOne({
      _id: roomID,
      companyId: companyId, // Must be same company
      people: { $in: [userId] }, // User must be member
    })
      .populate("people", "_id name email picture companyId")
      .lean();

    if (!room) {
      console.error(`❌ Room ${roomID} not found or user not authorized`);
      return socket.emit("message-error", {
        status: 404,
        error: "Room not found or unauthorized",
        tempID: tempID,
      });
    }

    // 3. CREATE MESSAGE
    const message = new Message({
      room: roomID,
      author: userId,
      content: content,
      companyId: companyId, // Important for multi-tenant
      date: new Date(),
      type: "text", // or detect from content
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
    }).catch((err) => console.error("Failed to update room timestamp:", err));

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

    room.people.forEach((person) => {
      const personId = person._id.toString();

      try {
        // CRITICAL: Emit to user's personal room (they joined on socket auth)
        // This is the KEY to reliable notifications!
        store.io.to(personId).emit("message-in", messagePayload);

        successCount++;
        console.log(`  ✓ Broadcasted to ${person.name} (${personId})`);
      } catch (error) {
        failCount++;
        console.error(`  ✗ Failed to broadcast to ${personId}:`, error.message);
      }
    });

    console.log(
      `📊 Broadcast complete: ${successCount} success, ${failCount} failed out of ${room.people.length} total`
    );

    // 8. SEND ACKNOWLEDGMENT TO SENDER
    socket.emit("message-ack", {
      success: true,
      messageID: message._id.toString(),
      tempID: tempID,
      timestamp: Date.now(),
      broadcastCount: successCount,
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
