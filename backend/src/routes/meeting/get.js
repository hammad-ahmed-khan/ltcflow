const Meeting = require("../../models/Meeting");
const xss = require("xss");

module.exports = (req, res, next) => {
  let { title, caller, callee, startedAsCall, callToGroup, group } = req.fields;

  // Extract companyId from header
  const companyId = req.headers["x-company-id"];

  if (!companyId) {
    return res.status(400).json({
      error: true,
      message: "Company ID is required",
    });
  }

  // Include companyId in meeting creation
  const meetingData = {
    title: xss(title),
    caller,
    callee,
    startedAsCall,
    callToGroup,
    group,
    companyId, // Required field for multi-tenancy
  };

  Meeting(meetingData)
    .save()
    .then((meeting) => {
      res.status(200).json(meeting);
    })
    .catch((error) => {
      console.error("Error creating meeting:", error);
      res.status(500).json({
        error: true,
        message: "Failed to create meeting",
      });
    });
};
