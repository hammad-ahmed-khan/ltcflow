const Meeting = require("../../models/Meeting");

module.exports = (req, res, next) => {
  let { limit } = req.fields;

  // Extract companyId from header
  const companyId = req.headers["x-company-id"];

  if (!companyId) {
    return res.status(400).json({
      error: true,
      message: "Company ID is required",
    });
  }

  !limit && (limit = 30);

  // Add companyId filter to query
  Meeting.find({
    companyId, // Filter by company
    $or: [
      { users: { $in: [req.user.id] } },
      { caller: req.user.id },
      { callee: req.user.id },
    ],
  })
    .sort({ lastEnter: -1 })
    .populate({
      path: "users",
      select: "-email -password -friends -__v",
      match: { companyId }, // Only populate users from same company
      populate: {
        path: "picture",
      },
    })
    .populate([
      {
        path: "caller",
        strictPopulate: false,
        match: { companyId },
      },
    ])
    .populate([
      {
        path: "callee",
        strictPopulate: false,
        match: { companyId },
      },
    ])
    .populate({
      path: "group",
      match: { companyId },
    })
    .limit(limit)
    .exec((err, meetings) => {
      if (err) {
        console.error("Error listing meetings:", err);
        return res.status(500).json({ error: true });
      }
      res.status(200).json({ limit, meetings });
    });
};
