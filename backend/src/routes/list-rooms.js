// backend/src/routes/list-rooms.js
const Room = require("../models/Room");

module.exports = (req, res, next) => {
  const companyId = req.headers["x-company-id"];

  // Validate companyId
  if (!companyId) {
    return res.status(400).json({ error: "Company ID required." });
  }

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
      res.status(200).json({ rooms }); // Removed limit from response
    });
};
