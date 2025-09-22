/**
 * Simple group permissions - just two things that matter
 * @param {Object} user - The user object with id and level
 * @param {Object} group - The group object with people and creator
 * @returns {Object} Permission object with flags
 */
const checkGroupPermissions = (user, group) => {
  const userId = user.id;
  const userLevel = user.level;

  // Check relationships to the group
  const isGroupMember = group.people?.some(
    (member) => member._id.toString() === userId
  );
  const isCreator = group.creator?.toString() === userId;

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
