// backend/src/routes/activate-user.js (GET route for token validation)
const User = require("../models/User");
const isEmpty = require("../utils/isEmpty");

module.exports = async (req, res) => {
  try {
    const { token } = req.params;
    const companyId = req.headers["x-company-id"];

    // Validate required fields
    let errors = {};
    isEmpty(token) && (errors.token = "Activation token required.");
    isEmpty(companyId) && (errors.companyId = "Company ID required.");

    if (Object.keys(errors).length > 0) {
      return res.status(400).json(errors);
    }

    // Find user by token and company
    const user = await User.findOne({
      activationToken: token,
      companyId: companyId,
      status: "pending",
    }).select("-password -activationToken");

    if (!user) {
      return res.status(400).json({
        error: "INVALID_TOKEN",
        message: "Invalid activation token or user not found.",
      });
    }

    // Check if token has expired
    if (user.tokenExpiry && new Date() > user.tokenExpiry) {
      // Update status to expired
      await User.findByIdAndUpdate(user._id, { status: "expired" });

      return res.status(400).json({
        error: "TOKEN_EXPIRED",
        message:
          "Activation token has expired. Please request a new invitation.",
      });
    }

    // Return user info for the activation form
    res.status(200).json({
      status: "success",
      message: "Token is valid",
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        level: user.level,
      },
    });
  } catch (error) {
    console.error("Token validation error:", error);
    res.status(500).json({
      error: "INTERNAL_SERVER_ERROR",
      message: "Server error during token validation.",
    });
  }
};
