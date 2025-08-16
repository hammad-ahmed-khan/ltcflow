const User = require("../models/User");

module.exports = async (req, res, next) => {
  try {
    const { imageID } = req.fields;
    const companyId = req.headers["x-company-id"]; // read from header

    if (!companyId) {
      return res
        .status(400)
        .json({ status: 400, error: "COMPANY_ID_REQUIRED" });
    }

    // Company ID check
    if (companyId != req.user.companyId) {
      return res.status(403).json({ status: 403, error: "INVALID_ACCESS" });
    }

    console.log("Change picture for user " + req.user.email);

    // Update user picture with extra safety: match companyId in the query
    const user = await User.findOneAndUpdate(
      { _id: req.user.id, companyId: req.user.companyId }, // ensures multi-tenant safety
      { $set: { picture: imageID } },
      { new: true }
    ).populate([{ path: "picture", strictPopulate: false }]);

    if (!user) {
      return res.status(404).json({ status: 404, error: "USER_NOT_FOUND" });
    }

    res.status(200).json(user.picture);
  } catch (err) {
    res
      .status(500)
      .json({ status: 500, error: "UNKNOWN_ERROR", details: err.message });
  }
};
