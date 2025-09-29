// backend/src/routes/delete-message.js
const Message = require("../models/Message");
const Room = require("../models/Room");
const store = require("../store");

module.exports = async (req, res) => {
  try {
    const { messageId } = req.fields;
    const companyId = req.headers["x-company-id"];
    const userId = req.user.id;

    if (!companyId) {
      return res.status(400).json({
        status: 400,
        error: "COMPANY_ID_REQUIRED",
        message: "Company ID is required",
      });
    }

    if (!messageId) {
      return res.status(400).json({
        error: "MISSING_PARAMETERS",
        message: "Message ID is required",
      });
    }

    // Find the message to verify it exists and user owns it
    const message = await Message.findOne({
      _id: messageId,
      companyId,
    }).populate("author");

    if (!message) {
      return res.status(404).json({
        error: "MESSAGE_NOT_FOUND",
        message: "Message not found",
      });
    }

    // Check if message is already deleted
    if (message.isDeleted) {
      return res.status(400).json({
        error: "ALREADY_DELETED",
        message: "Message is already deleted",
      });
    }

    // Check if user owns the message or is admin/root
    const isOwner = message.author._id.toString() === userId;
    const isAdmin = ["admin", "root"].includes(req.user.level);

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        error: "INSUFFICIENT_PERMISSIONS",
        message: "You can only delete your own messages",
      });
    }

    console.log(
      `🗑️ User ${req.user.email} is soft-deleting message: ${messageId}`
    );

    // Get the room to broadcast to all participants
    const room = await Room.findOne({
      _id: message.room,
      companyId,
    });

    if (!room) {
      return res.status(404).json({
        error: "ROOM_NOT_FOUND",
        message: "Room not found",
      });
    }

    // ✨ SOFT DELETE: Mark as deleted instead of removing from database
    message.originalContent = message.content;
    message.isDeleted = true;
    message.deletedAt = new Date();
    message.deletedBy = userId;
    message.content = null; // Hide content from UI

    await message.save();

    console.log(`✅ Message soft-deleted successfully: ${messageId}`);

    // ✨ Broadcast message deletion to all room participants in real-time
    if (store.io && room.people) {
      room.people.forEach((person) => {
        const personUserId = person.toString();
        console.log(
          `📡 Broadcasting message deletion to user: ${personUserId}`
        );

        store.io.to(personUserId).emit("message-deleted", {
          messageId: messageId,
          roomId: room._id.toString(),
          deletedBy: userId,
        });
      });

      console.log(`🔔 Broadcasted deletion to ${room.people.length} users`);
    }

    res.status(200).json({
      status: 200,
      message: "Message deleted successfully",
      messageId: messageId,
    });
  } catch (error) {
    console.error("❌ Error deleting message:", error);
    res.status(500).json({
      error: "INTERNAL_SERVER_ERROR",
      message: "Failed to delete message",
    });
  }
};
