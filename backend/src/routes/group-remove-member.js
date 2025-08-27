// backend/src/routes/group-remove-member.js
const Room = require("../models/Room");
const User = require("../models/User");

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

    // Find the group
    const group = await Room.findOne({
      _id: groupId,
      companyId,
      isGroup: true,
    }).populate("people");

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
      // Anyone can leave a group (except if they're the only member)
      if (group.people.length === 1) {
        return res.status(400).json({
          error: "CANNOT_LEAVE_EMPTY_GROUP",
          message: "Cannot leave group - you're the only member",
        });
      }
    } else {
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
          error: "INSUFFICIENT_PERMISSIONS",
          message: "You do not have permission to remove members.",
        });
      }
    }

    // Remove user from the group
    await Room.findByIdAndUpdate(groupId, {
      $pull: { people: userId },
    });

    // Return updated group with populated people
    const updatedGroup = await Room.findById(groupId).populate("people");

    const actionMessage = isSelfRemoval
      ? "Left group successfully"
      : `${targetUser.firstName} ${targetUser.lastName} removed from group successfully`;

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
