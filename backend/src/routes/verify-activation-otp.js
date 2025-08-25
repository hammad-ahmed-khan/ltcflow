// backend/src/routes/verify-activation-otp.js (New route)
const User = require("../models/User");
const AuthCode = require("../models/AuthCode");
const bcrypt = require("bcryptjs");
const moment = require("moment");
const isEmpty = require("../utils/isEmpty");

module.exports = async (req, res) => {
  try {
    const { token, otp } = req.fields;
    const companyId = req.headers["x-company-id"];

    // Validate required fields
    let errors = {};
    isEmpty(token) && (errors.token = "Activation token required.");
    isEmpty(otp) && (errors.otp = "Verification code required.");
    isEmpty(companyId) && (errors.companyId = "Company ID required.");

    // Validate OTP format
    if (otp && !/^\d{6}$/.test(otp.trim())) {
      errors.otp = "Verification code must be 6 digits.";
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        status: "error",
        errors,
        message: "Please correct the errors and try again.",
      });
    }

    // Find all pending users in the company
    const pendingUsers = await User.find({
      companyId: companyId,
      status: "pending",
      activationToken: { $ne: null },
    }).select("-password");

    // Find the user by comparing the raw token with the hashed tokens
    let user = null;
    for (const pendingUser of pendingUsers) {
      try {
        // Compare raw token with hashed token in database
        const isValidToken = await bcrypt.compare(
          token,
          pendingUser.activationToken
        );
        if (isValidToken) {
          user = pendingUser;
          break;
        }
      } catch (compareError) {
        // If bcrypt.compare fails, try direct comparison (for tokens stored as raw)
        if (token === pendingUser.activationToken) {
          user = pendingUser;
          break;
        }
      }
    }

    if (!user) {
      return res.status(400).json({
        status: "error",
        error: "INVALID_TOKEN",
        message: "Invalid activation token or user not found.",
      });
    }

    // Check if activation token has expired
    if (user.tokenExpiry && new Date() > user.tokenExpiry) {
      return res.status(400).json({
        status: "error",
        error: "TOKEN_EXPIRED",
        message:
          "Activation token has expired. Please request a new invitation.",
      });
    }

    // Find valid OTP auth code for this user
    const authCode = await AuthCode.findOne({
      code: otp.trim(),
      user: user._id,
      email: user.email,
      valid: true,
      companyId: companyId,
    });

    if (!authCode) {
      return res.status(400).json({
        status: "error",
        error: "INVALID_OTP",
        message:
          "Invalid verification code. Please check your code and try again.",
      });
    }

    // Check if OTP has expired
    if (moment(authCode.expires).isBefore(moment())) {
      // Invalidate expired code
      authCode.valid = false;
      await authCode.save();

      return res.status(400).json({
        status: "error",
        error: "OTP_EXPIRED",
        message:
          "Verification code has expired. Please request a new activation link.",
      });
    }

    // Mark OTP as used (invalidate it)
    authCode.valid = false;
    await authCode.save();

    // Invalidate any other auth codes for this user
    await AuthCode.updateMany(
      { user: user._id, valid: true },
      { $set: { valid: false } }
    );

    console.log(
      `✅ OTP verified successfully for user: ${user.email} (Company: ${companyId})`
    );

    // Return success - user can now proceed to set password
    res.status(200).json({
      status: "success",
      message: "Verification code confirmed. You can now set your password.",
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        level: user.level,
      },
      nextStep: "set_password", // Indicate that password setting is next
    });
  } catch (error) {
    console.error("OTP verification error:", error);
    res.status(500).json({
      status: "error",
      error: "INTERNAL_SERVER_ERROR",
      message: "Server error during OTP verification.",
    });
  }
};
