// backend/src/routes/group-remove-member.js
const Room = require("../models/Room");
const User = require("../models/User");
const { checkGroupPermissions } = require("../utils/groupPermissions");

module.exports = async (req, res) => {
  try {
    const { groupId, userId } = req.fields;
    const companyId = req.headers["x-company-id"];

    if (!companyId) {
      return res.status(400).json({
        status: 400,
        error: "COMPANY_ID_REQUIRED",
        message: "Company ID is required",
      });
    }

    if (!groupId || !userId) {
      return res.status(400).json({
        error: "MISSING_PARAMETERS",
        message: "Group ID and User ID are required",
      });
    }

    // Find the group and populate creator
    const group = await Room.findOne({
      _id: groupId,
      companyId,
      isGroup: true,
    })
      .populate("people")
      .populate("creator");

    if (!group) {
      return res.status(404).json({
        error: "GROUP_NOT_FOUND",
        message: "Group not found",
      });
    }

    // Check if target user is in the group
    const targetUser = group.people.find(
      (member) => member._id.toString() === userId
    );
    if (!targetUser) {
      return res.status(400).json({
        error: "USER_NOT_IN_GROUP",
        message: "User is not a member of this group",
      });
    }

    // Special case: User removing themselves (leaving group)
    const isSelfRemoval = req.user.id === userId;

    if (isSelfRemoval) {
      // Anyone can leave a group they're a member of
      if (group.people.length === 1) {
        console.log(
          `⚠️ Last member ${req.user.username} leaving group "${group.title}" - group will be empty`
        );
      }
    } else {
      // Removing someone else - check permissions
      const permissions = checkGroupPermissions(req.user, group);

      if (!permissions.canManageGroup) {
        // Fixed: Use correct property name
        return res.status(403).json({
          error: "INSUFFICIENT_PERMISSIONS",
          message:
            "You don't have permission to remove members from this group",
        });
      }
    }

    // Remove user from the group
    await Room.findByIdAndUpdate(groupId, {
      $pull: { people: userId },
    });

    // Return updated group with populated people AND creator
    const updatedGroup = await Room.findById(groupId)
      .populate("people")
      .populate("creator", "firstName lastName username email");

    const actionMessage = isSelfRemoval
      ? `You left the group "${group.title}"`
      : `${targetUser.firstName} ${targetUser.lastName} removed from group`;

    console.log(
      `👥 ${isSelfRemoval ? "Self-removal" : "Member removal"}: ${
        targetUser.username
      } from group "${group.title}" by ${req.user.username}`
    );

    res.status(200).json({
      status: "success",
      message: actionMessage,
      group: updatedGroup,
    });
  } catch (err) {
    console.error("Remove member error:", err);
    res.status(500).json({
      status: 500,
      error: "SERVER_ERROR",
      message: "An error occurred while removing the member",
    });
  }
};
