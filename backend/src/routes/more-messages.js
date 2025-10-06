// backend/src/routes/more-messages.js
const Message = require("../models/Message");

module.exports = (req, res, next) => {
  let { roomID, firstMessageID } = req.fields;
  const companyId = req.headers["x-company-id"];

  // Validate required fields
  if (!roomID || !firstMessageID || !companyId) {
    return res.status(400).json({
      error: "Room ID, First Message ID, and Company ID are required.",
    });
  }

  // Query includes companyId to ensure data isolation
  Message.find({
    room: roomID,
    _id: { $lt: firstMessageID },
    companyId,
  })
    .sort({ _id: -1 })
    .limit(20)
    .populate({
      path: "author",
      select: "-email -password -friends -__v",
      populate: {
        path: "picture",
      },
    })
    .populate([{ path: "file", strictPopulate: false }]) // ⬅️ ADD THIS LINE - Populate file data!
    .lean()
    .then((messages) => {
      messages.reverse();
      res.status(200).json({
        messages: messages.map((e) => {
          if (e.author) {
            return e;
          } else {
            return {
              ...e,
              author: {
                firstName: "Deleted",
                lastName: "User",
              },
            };
          }
        }),
      });
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: "Server error loading messages." });
    });
};
