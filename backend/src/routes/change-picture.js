// Updated backend/src/routes/change-picture.js
const User = require("../models/User");

module.exports = async (req, res, next) => {
  try {
    const { imageID } = req.fields;
    const companyId = req.headers["x-company-id"];

    if (!companyId) {
      return res
        .status(400)
        .json({ status: 400, error: "COMPANY_ID_REQUIRED" });
    }

    // Company ID check
    if (companyId != req.user.companyId) {
      return res.status(403).json({ status: 403, error: "INVALID_ACCESS" });
    }

    console.log("Change/Remove picture for user " + req.user.email);

    // Handle both setting and removing pictures
    // If imageID is undefined/null, remove the picture by setting it to null
    const updateOperation = imageID
      ? { $set: { picture: imageID } } // Set new picture
      : { $unset: { picture: "" } }; // Remove picture completely

    // Update user picture with extra safety: match companyId in the query
    const user = await User.findOneAndUpdate(
      { _id: req.user.id, companyId: req.user.companyId },
      updateOperation,
      { new: true }
    ).populate([{ path: "picture", strictPopulate: false }]);

    if (!user) {
      return res.status(404).json({ status: 404, error: "USER_NOT_FOUND" });
    }

    // Return appropriate response
    if (imageID) {
      // Picture was set/changed
      res.status(200).json(user.picture);
    } else {
      // Picture was removed
      res
        .status(200)
        .json({ status: 200, message: "Picture removed successfully" });
    }
  } catch (err) {
    res
      .status(500)
      .json({ status: 500, error: "UNKNOWN_ERROR", details: err.message });
  }
};
