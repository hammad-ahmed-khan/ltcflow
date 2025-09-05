// backend/src/routes/group-delete.js
const Room = require("../models/Room");
const Message = require("../models/Message");
const File = require("../models/File");
const Image = require("../models/Image");

module.exports = async (req, res) => {
  try {
    const { groupId } = req.fields;
    const companyId = req.headers["x-company-id"];

    if (!companyId) {
      return res.status(400).json({
        status: 400,
        error: "COMPANY_ID_REQUIRED",
        message: "Company ID is required",
      });
    }

    if (!groupId) {
      return res.status(400).json({
        error: "MISSING_PARAMETERS",
        message: "Group ID is required",
      });
    }

    // Check user permissions - only root and admin can delete groups
    const userLevel = req.user.level;
    if (!["root", "admin"].includes(userLevel)) {
      return res.status(403).json({
        error: "INSUFFICIENT_PERMISSIONS",
        message: "Only administrators can delete groups",
      });
    }

    // Find the group to verify it exists and belongs to the company
    const group = await Room.findOne({
      _id: groupId,
      companyId,
      isGroup: true,
    });

    if (!group) {
      return res.status(404).json({
        error: "GROUP_NOT_FOUND",
        message: "Group not found",
      });
    }

    console.log(
      `🗑️ Admin ${req.user.email} is deleting group: ${group.title} (${groupId})`
    );

    // Delete all messages in the group
    const deletedMessages = await Message.deleteMany({
      room: groupId,
      companyId,
    });
    console.log(
      `📝 Deleted ${deletedMessages.deletedCount} messages from group`
    );

    // Find and delete all files associated with messages in this group
    try {
      // Note: This is a basic cleanup. You may want to implement more sophisticated
      // file cleanup based on your storage strategy
      const filesInGroup = await File.find({
        room: groupId,
        companyId,
      });

      if (filesInGroup.length > 0) {
        await File.deleteMany({ room: groupId, companyId });
        console.log(`📎 Deleted ${filesInGroup.length} files from group`);
      }

      const imagesInGroup = await Image.find({
        room: groupId,
        companyId,
      });

      if (imagesInGroup.length > 0) {
        await Image.deleteMany({ room: groupId, companyId });
        console.log(`🖼️ Deleted ${imagesInGroup.length} images from group`);
      }
    } catch (fileCleanupError) {
      console.error("⚠️ Error cleaning up files/images:", fileCleanupError);
      // Continue with group deletion even if file cleanup fails
    }

    // Delete the group itself
    await Room.findByIdAndDelete(groupId);
    console.log(`✅ Group "${group.title}" deleted successfully`);

    res.status(200).json({
      status: "success",
      message: `Group "${group.title}" has been permanently deleted`,
      data: {
        groupId,
        groupTitle: group.title,
        deletedMessages: deletedMessages.deletedCount,
        deletedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error("💥 Delete group error:", err);
    res.status(500).json({
      status: 500,
      error: "SERVER_ERROR",
      message: "An error occurred while deleting the group",
    });
  }
};
