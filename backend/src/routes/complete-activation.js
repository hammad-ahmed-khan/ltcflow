// backend/src/routes/complete-activation.js
const User = require("../models/User");
const argon2 = require("argon2");
const isEmpty = require("../utils/isEmpty");

module.exports = async (req, res) => {
  try {
    const { token, password, confirmPassword } = req.fields;
    const companyId = req.headers["x-company-id"];

    // Validate required fields
    let errors = {};
    isEmpty(token) && (errors.token = "Activation token required.");
    isEmpty(password) && (errors.password = "Password required.");
    isEmpty(confirmPassword) &&
      (errors.confirmPassword = "Confirm password required.");
    isEmpty(companyId) && (errors.companyId = "Company ID required.");

    if (Object.keys(errors).length > 0) {
      return res.status(400).json(errors);
    }

    // Validate password
    if (password.length < 6) {
      return res.status(400).json({
        password: "Password must be at least 6 characters long.",
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        confirmPassword: "Passwords do not match.",
      });
    }

    // Find user by token and company
    const user = await User.findOne({
      activationToken: token,
      companyId: companyId,
      status: "pending",
    });

    if (!user) {
      return res.status(400).json({
        error: "INVALID_TOKEN",
        message: "Invalid activation token or user not found.",
      });
    }

    // Check if token has expired
    if (user.tokenExpiry && new Date() > user.tokenExpiry) {
      return res.status(400).json({
        error: "TOKEN_EXPIRED",
        message:
          "Activation token has expired. Please request a new invitation.",
      });
    }

    // Hash password and activate account
    const hashedPassword = await argon2.hash(password);

    user.password = hashedPassword;
    user.status = "active";
    user.activationToken = null;
    user.tokenExpiry = null;
    user.updatedAt = new Date();

    await user.save();

    res.status(200).json({
      status: "success",
      message: "Account activated successfully! You can now log in.",
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
    console.error("Complete activation error:", error);
    res.status(500).json({
      error: "INTERNAL_SERVER_ERROR",
      message: "Server error during account activation.",
    });
  }
};
