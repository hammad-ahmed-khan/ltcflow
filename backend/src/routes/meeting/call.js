const User = require("../../models/User");
const Room = require("../../models/Room");
const xss = require("xss");
const store = require("../../store");

module.exports = async (req, res, next) => {
  let { roomID, meetingID } = req.fields;

  // Extract companyId from header
  const companyId = req.headers["x-company-id"];

  if (!companyId) {
    return res.status(400).json({
      error: true,
      message: "Company ID is required",
    });
  }

  try {
    // Find user with company filtering
    const user = await User.findOne(
      {
        _id: req.user.id,
        companyId,
      },
      {
        email: 0,
        password: 0,
        friends: 0,
        __v: 0,
      }
    ).populate([{ path: "picture", strictPopulate: false }]);

    if (!user) {
      return res.status(404).json({
        error: true,
        message: "User not found in company",
      });
    }

    // Find room with company filtering
    const room = await Room.findOne({
      _id: roomID,
      companyId,
    }).populate({
      path: "people",
      select: "-email -password -friends -__v",
      match: { companyId }, // Only populate users from same company
      populate: [
        {
          path: "picture",
        },
      ],
    });

    if (!room) {
      return res.status(404).json({
        error: true,
        message: "Room not found in company",
      });
    }

    // Emit call to room participants
    room.people.forEach((person) => {
      const myUserID = req.user.id;
      const personUserID = person._id.toString();

      if (personUserID !== myUserID) {
        store.io.to(personUserID).emit("call", {
          status: 200,
          room,
          meetingID,
          roomID,
          caller: req.user.id,
          counterpart: user,
        });
      }
    });

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Error in meeting call:", err);
    return res.status(500).json({
      error: true,
      message: "Server error during call initiation",
    });
  }
};
