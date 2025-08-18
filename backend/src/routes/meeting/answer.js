const Meeting = require("../../models/Meeting");
const Room = require("../../models/Room");
const xss = require("xss");
const store = require("../../store");

module.exports = async (req, res, next) => {
  let { userID, meetingID, answer } = req.fields;

  // Extract companyId from header
  const companyId = req.headers["x-company-id"];

  if (!companyId) {
    return res.status(400).json({
      error: true,
      message: "Company ID is required",
    });
  }

  try {
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

    store.io.to(userID).emit("answer", {
      status: 200,
      meetingID,
      answer,
      callee: req.user.id,
    });

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Error answering meeting:", err);
    res.status(500).json({
      error: true,
      message: "Error answering meeting",
    });
  }
};
