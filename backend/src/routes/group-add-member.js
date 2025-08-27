// backend/src/routes/group-add-member.js
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

    // Check permissions
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
        message:
          "Only group members with manager+ level or root users can add members",
      });
    }

    // Check if user to be added exists in the same company
    const userToAdd = await User.findOne({
      _id: userId,
      companyId,
      status: "active",
    });

    if (!userToAdd) {
      return res.status(404).json({
        error: "USER_NOT_FOUND",
        message: "User not found or inactive",
      });
    }

    // Check if user is already a member
    const isAlreadyMember = group.people.some(
      (member) => member._id.toString() === userId
    );
    if (isAlreadyMember) {
      return res.status(400).json({
        error: "USER_ALREADY_MEMBER",
        message: "User is already a member of this group",
      });
    }

    // Add user to the group
    await Room.findByIdAndUpdate(groupId, {
      $addToSet: { people: userId },
    });

    // Return updated group with populated people
    const updatedGroup = await Room.findById(groupId).populate("people");

    res.status(200).json({
      status: "success",
      message: `${userToAdd.firstName} ${userToAdd.lastName} added to group successfully`,
      group: updatedGroup,
    });
  } catch (err) {
    console.error("Add member error:", err);
    res.status(500).json({
      status: 500,
      error: "SERVER_ERROR",
      message: "An error occurred while adding the member",
    });
  }
};
