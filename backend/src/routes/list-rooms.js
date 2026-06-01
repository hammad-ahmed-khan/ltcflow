// backend/src/routes/list-rooms.js
const Room = require("../models/Room");

module.exports = (req, res, next) => {
  const companyId = req.headers["x-company-id"];

  // Validate companyId
  if (!companyId) {
    return res.status(400).json({ error: "Company ID required." });
  }

  // 🆕 Determine if requesting user can see deactivated users
  const canSeeDeactivated = ["admin", "root"].includes(req.user.level);

  // Updated query to include both member rooms and creator rooms
  Room.find({
    companyId,
    $and: [
      {
        $or: [
          // Regular rooms and groups where user is a member
          { people: { $in: [req.user.id] } },
          // Groups where user is the creator (even if not a member)
          { creator: req.user.id, isGroup: true },
        ],
      },
      {
        $or: [{ lastMessage: { $ne: null } }, { isGroup: true }],
      },
    ],
  })
    .sort({ lastUpdate: -1 })
    .populate([{ path: "picture", strictPopulate: false }])
    .populate({
      path: "people",
      select: "-email -password -friends -__v",
      // 🆕 Filter out deactivated users for non-admins
      match: canSeeDeactivated ? {} : { status: { $ne: "deactivated" } },
      populate: {
        path: "picture",
      },
    })
    .populate({
      path: "creator", // Add creator population
      select: "firstName lastName username email",
    })
    .populate("lastMessage")
    .exec((err, rooms) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "Server error." });
      }

      // 🆕 For non-admins, filter out direct chats where the other person is deactivated
      let filteredRooms = rooms;
      if (!canSeeDeactivated) {
        filteredRooms = rooms.filter((room) => {
          if (room.isGroup) {
            // Groups are always shown (deactivated members already filtered by populate match)
            return true;
          } else {
            // For direct chats, check if the other person still exists after filtering
            const otherPerson = room.people.find(
              (p) => p && p._id && p._id.toString() !== req.user.id
            );
            // Hide room if other person was filtered out (deactivated)
            return !!otherPerson;
          }
        });
      }

      res.status(200).json({ rooms: filteredRooms });
    });
};
