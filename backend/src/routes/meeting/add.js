const User = require("../../models/User");
const Room = require("../../models/Room");
const Meeting = require("../../models/Meeting");
const xss = require("xss");
const store = require("../../store");

module.exports = async (req, res, next) => {
  let { userID, meetingID } = req.fields;

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

    // Verify meeting belongs to company
    const meeting = await Meeting.findOne({
      _id: meetingID,
      companyId,
    });

    if (!meeting) {
      return res.status(404).json({
        error: true,
        message: "Meeting not found in company",
      });
    }

    store.io.to(userID).emit("call", {
      status: 200,
      meetingID,
      roomID: null,
      caller: req.user.id,
      counterpart: user,
      added: true,
    });

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Error adding user to meeting:", err);
    res.status(500).json({
      error: true,
      message: "Error adding user to meeting",
    });
  }
};
