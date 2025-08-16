const User = require("../models/User");
const crypto = require("crypto");
const Config = require("../../config");

module.exports = async (req, res, next) => {
  const { userId } = req.fields;
  const companyId = req.headers["x-company-id"];

  // Check if user has permission to regenerate activation tokens
  if (!["root", "admin"].includes(req.user.level)) {
    return res.status(401).json({ error: "Unauthorized User" });
  }

  if (!userId || !companyId) {
    return res.status(400).json({ error: "User ID and Company ID required." });
  }

  try {
    // Find the user within the same company
    const user = await User.findOne({
      _id: userId,
      companyId,
      status: { $in: ["pending", "expired"] }, // Only allow regeneration for pending or expired users
    });

    if (!user) {
      return res.status(404).json({
        error: "User not found or already activated.",
      });
    }

    // Generate new activation token and expiry
    const activationToken = crypto.randomBytes(32).toString("hex");
    const tokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Update user with new token and reset status to pending
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          activationToken: activationToken,
          tokenExpiry: tokenExpiry,
          status: "pending", // Reset to pending if it was expired
        },
      },
      { new: true }
    ).select("-password -activationToken");

    // Generate new activation link
    const activationLink = `${
      Config.frontendUrl || "http://localhost:3000"
    }/activate/${activationToken}`;

    res.status(200).json({
      status: "success",
      message: "New activation link generated successfully.",
      user: updatedUser,
      activationLink: activationLink,
      tokenExpiry: tokenExpiry,
    });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ error: "Server error regenerating activation token." });
  }
};
