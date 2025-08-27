// File 3: backend/src/routes/group-update-info.js
const Room = require("../models/Room");
const mongoose = require("mongoose");
const xss = require("xss");

module.exports = async (req, res) => {
  try {
    const { groupId, title, picture } = req.fields;
    const companyId = req.headers["x-company-id"];

    // Validation
    if (!companyId) {
      return res.status(400).json({
        status: 400,
        error: "COMPANY_ID_REQUIRED",
      });
    }

    if (!groupId) {
      return res.status(400).json({
        status: 400,
        error: "MISSING_PARAMETERS",
        message: "Group ID is required",
      });
    }

    // Convert ID to ObjectId
    let groupObjectId;
    try {
      groupObjectId = new mongoose.Types.ObjectId(groupId);
    } catch (err) {
      return res.status(400).json({
        status: 400,
        error: "INVALID_ID_FORMAT",
        message: "Invalid group ID format",
      });
    }

    // Find the group
    const group = await Room.findOne({
      _id: groupObjectId,
      companyId: companyId,
      isGroup: true,
    });

    if (!group) {
      return res.status(404).json({
        status: 404,
        error: "GROUP_NOT_FOUND",
        message: "Group not found or access denied",
      });
    }

    // Removing someone else - check permissions
    const isGroupMember = group.people.some(
      (member) => member._id.toString() === req.user.id
    );
    const userLevel = req.user.level;

    // Authorization logic: Root can manage globally, managers/admins need to be group members
    const canManageMembers =
      userLevel === "root" ||
      (["manager", "admin"].includes(userLevel) && isGroupMember);

    if (!canManageMembers) {
      return res.status(403).json({
        status: 403,
        error: "INSUFFICIENT_PERMISSIONS",
        message: "You do not have permission to update this group.",
      });
    }

    // Prepare update data
    const updateData = {};
    if (title && title.trim()) {
      updateData.title = xss(title.trim());
    }
    if (picture !== undefined) {
      updateData.picture = picture;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        status: 400,
        error: "NO_UPDATE_DATA",
        message: "No valid update data provided",
      });
    }

    // Update the group
    const updatedGroup = await Room.findByIdAndUpdate(
      groupObjectId,
      updateData,
      { new: true }
    ).populate("people");

    console.log(`Group "${group.title}" updated by ${req.user.username}`);

    res.status(200).json({
      status: 200,
      message: "Group updated successfully",
      group: updatedGroup,
    });
  } catch (error) {
    console.error("Error updating group:", error);
    res.status(500).json({
      status: 500,
      error: "INTERNAL_SERVER_ERROR",
      message: "Failed to update group",
    });
  }
};
