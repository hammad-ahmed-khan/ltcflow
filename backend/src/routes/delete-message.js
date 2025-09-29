// backend/src/routes/delete-message.js
const Message = require("../models/Message");
const File = require("../models/File");
const Image = require("../models/Image");

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

    // Check if user owns the message or is admin/root
    const isOwner = message.author._id.toString() === userId;
    const isAdmin = ["admin", "root"].includes(req.user.level);

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        error: "INSUFFICIENT_PERMISSIONS",
        message: "You can only delete your own messages",
      });
    }

    console.log(`🗑️ User ${req.user.email} is deleting message: ${messageId}`);

    // Handle file cleanup for image and file messages
    try {
      if (message.type === "image" && message.content) {
        // Delete associated image record
        await Image.deleteOne({
          shieldedID: message.content,
          companyId,
        });
        console.log(`🖼️ Deleted image record: ${message.content}`);
      } else if (message.type === "file" && message.content) {
        // Delete associated file record
        await File.deleteOne({
          shieldedID: message.content,
          companyId,
        });
        console.log(`📄 Deleted file record: ${message.content}`);
      }
    } catch (fileError) {
      console.warn(
        `⚠️ Warning: Could not clean up associated files:`,
        fileError.message
      );
      // Continue with message deletion even if file cleanup fails
    }

    // Delete the message
    await Message.deleteOne({
      _id: messageId,
      companyId,
    });

    console.log(`✅ Message deleted successfully: ${messageId}`);

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
