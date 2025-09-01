// backend/src/routes/complete-activation.js (Updated error message for SMS)
const User = require("../models/User");
const AuthCode = require("../models/AuthCode");
const bcrypt = require("bcryptjs");
const argon2 = require("argon2");
const moment = require("moment");
const isEmpty = require("../utils/isEmpty");
const mongoose = require("mongoose");
const outsetaApi = require("../services/outsetaApi");

module.exports = async (req, res) => {
  try {
    const { token, password, confirmPassword } = req.fields;
    const companyId = req.headers["x-company-id"];

    // Input validation
    const errors = {};

    if (isEmpty(token)) {
      errors.token = "Activation token is required";
    }

    if (isEmpty(password)) {
      errors.password = "Password is required";
    } else if (password.length < 6) {
      errors.password = "Password must be at least 6 characters long";
    }

    if (isEmpty(confirmPassword)) {
      errors.confirmPassword = "Please confirm your password";
    } else if (password !== confirmPassword) {
      errors.confirmPassword = "Passwords do not match";
      errors.password = "Passwords do not match";
    }

    if (!companyId) {
      errors.companyId = "Company ID is required";
    }

    // Return validation errors
    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        status: "error",
        errors,
        message: "Please correct the errors and try again",
      });
    }

    // Convert companyId to ObjectId
    let companyObjectId;
    try {
      companyObjectId = new mongoose.Types.ObjectId(companyId);
    } catch (err) {
      return res.status(400).json({
        error: "INVALID_COMPANY_ID",
        message: "Invalid company ID format",
      });
    }

    // Find all pending users in the company
    const pendingUsers = await User.find({
      companyId: companyObjectId,
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

    // ⚠️ IMPORTANT: Check if user has verified OTP
    // Look for any recent valid (used) auth codes for this user
    // Since OTP gets invalidated after successful verification, we look for recently used ones
    const recentlyUsedOTP = await AuthCode.findOne({
      user: user._id,
      email: user.email,
      valid: false, // Should be false after successful verification
      companyId: companyId,
      updatedAt: { $gt: new Date(Date.now() - 30 * 60 * 1000) }, // Within last 30 minutes
    }).sort({ updatedAt: -1 }); // Get the most recent one

    if (!recentlyUsedOTP) {
      return res.status(400).json({
        error: "OTP_VERIFICATION_REQUIRED",
        message:
          "OTP verification is required before setting password. Please verify your SMS code first.",
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

    if (outsetaApi.isConfigured() && user.outsetaPersonId) {
      try {
        console.log(
          `🔄 Syncing activation completion to Outseta: ${user.email}`
        );

        const personUpdateData = {
          ActivationStatus: "active",
          ActivationDate: new Date().toISOString(),
        };

        const updateResult = await outsetaApi.updatePerson(
          user.outsetaPersonId,
          personUpdateData
        );

        if (updateResult?.success) {
          console.log(
            `✅ Activation status synced to Outseta: ${user.email} -> active`
          );
          outsetaSync = { success: true, data: updateResult.data };
        } else {
          console.warn(
            `⚠️ Outseta activation sync failed:`,
            updateResult?.error
          );
          outsetaSync = { success: false, error: updateResult?.error };
        }
      } catch (syncError) {
        console.error(
          `❌ Failed to sync activation status to Outseta:`,
          syncError
        );
        outsetaSync = { success: false, error: syncError.message };
      }
    } else {
      console.warn(
        `Outseta not configured or no person ID for user: ${user.email}`
      );
      outsetaSync = { success: false, reason: "not_configured" };
    }

    // Clean up any remaining auth codes for this user
    await AuthCode.updateMany({ user: user._id }, { $set: { valid: false } });

    console.log(
      `✅ Account activated successfully for user: ${user.email} (Company: ${companyId})`
    );

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
