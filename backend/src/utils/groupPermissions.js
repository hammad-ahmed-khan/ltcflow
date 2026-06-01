/**
 * FIXED: Group permissions with proper creator detection
 * @param {Object} user - The user object with id and level
 * @param {Object} group - The group object with people and creator
 * @returns {Object} Permission object with flags
 */
const checkGroupPermissions = (user, group) => {
  const userId = user.id;
  const userLevel = user.level;

  // Check relationships to the group
  const isGroupMember = group.people?.some((member) => {
    // Handle both populated and non-populated member objects
    const memberId = member._id?.toString() || member.toString();
    return memberId === userId;
  });

  // FIXED: Handle both populated and non-populated creator
  const isCreator = (() => {
    if (!group.creator) return false;

    // If creator is populated (object with _id, firstName, etc.)
    if (typeof group.creator === "object" && group.creator._id) {
      return group.creator._id.toString() === userId;
    }

    // If creator is just an ObjectId
    return group.creator.toString() === userId;
  })();

  return {
    // Can manage group (add/remove members, update info, delete)
    canManageGroup:
      userLevel === "root" ||
      isCreator ||
      (["manager", "admin"].includes(userLevel) && isGroupMember),

    // Can participate in conversations (send messages, join calls)
    canJoinConversations: isGroupMember,

    // Metadata
    isGroupMember,
    isCreator,
    userLevel,
  };
};

module.exports = {
  checkGroupPermissions,
};
