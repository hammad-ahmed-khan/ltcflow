// backend/src/routes/auth/reset-password.js
const router = require("express").Router();
const AuthCode = require("../../models/AuthCode");
const Email = require("../../models/Email");
const User = require("../../models/User");
const config = require("../../../config");
const moment = require("moment");
const argon2 = require("argon2");
const isEmpty = require("../../utils/isEmpty");
const { isEmail } = require("validator");
const mongoose = require("mongoose");

router.post("*", async (req, res) => {
  try {
    const { email, code, password, confirmPassword } = req.fields;
    const companyId = req.headers["x-company-id"];

    // Input validation
    const errors = {};

    if (isEmpty(email)) {
      errors.email = "Email address is required";
    } else if (!isEmail(email)) {
      errors.email = "Please enter a valid email address";
    }

    if (isEmpty(code)) {
      errors.code = "Verification code is required";
    } else if (!/^\d{6}$/.test(code)) {
      errors.code = "Verification code must be 6 digits";
    }

    if (isEmpty(password)) {
      errors.password = "New password is required";
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
        status: "error",
        error: "INVALID_COMPANY_ID",
        message: "Invalid company ID format",
      });
    }

    // Find user by email and companyId
    const user = await User.findOne({
      email: email.toLowerCase(),
      companyId: companyObjectId,
    });

    if (!user) {
      return res.status(404).json({
        status: "error",
        error: "USER_NOT_FOUND",
        message: "No account found with that email address",
      });
    }

    // Check user status
    if (user.status !== "active") {
      const statusMessages = {
        pending:
          "Account is not yet activated. Please contact your administrator.",
        expired: "Account has expired. Please contact your administrator.",
        deactivated:
          "Account has been deactivated. Please contact your administrator.",
      };

      return res.status(403).json({
        status: "error",
        message:
          statusMessages[user.status] ||
          "Account is not available for password reset.",
      });
    }

    // Find valid auth code
    const authCode = await AuthCode.findOne({
      code: code,
      user: user._id,
      email: user.email,
      valid: true,
      companyId: companyObjectId,
    });

    if (!authCode) {
      return res.status(400).json({
        status: "error",
        error: "INVALID_CODE",
        message:
          "Invalid verification code. Please check your code and try again.",
      });
    }

    // Check if code has expired
    if (moment(authCode.expires).isBefore(moment())) {
      // Invalidate expired code
      authCode.valid = false;
      await authCode.save();

      return res.status(400).json({
        status: "error",
        error: "CODE_EXPIRED",
        message:
          "Verification code has expired. Please request a new password reset.",
      });
    }

    // Hash new password
    const hashedPassword = await argon2.hash(password);

    // Update user password
    user.password = hashedPassword;
    user.updatedAt = new Date();
    await user.save();

    // Invalidate the used auth code
    authCode.valid = false;
    await authCode.save();

    // Invalidate any other auth codes for this user
    await AuthCode.updateMany(
      { user: user._id, valid: true },
      { $set: { valid: false } }
    );

    // Send password change confirmation email
    const confirmationEmail = new Email({
      companyId: companyObjectId,
      from: config.nodemailer.from,
      to: user.email,
      subject: `${
        config.appTitle || config.appName || "LTC Flow"
      } - Password Changed Successfully`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #1976d2; margin: 0;">${
              config.appTitle || config.appName || "LTC Flow"
            }</h1>
            <h2 style="color: #28a745; margin: 10px 0;">✅ Password Changed Successfully</h2>
          </div>
          
          <div style="background-color: #d4edda; border: 1px solid #c3e6cb; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="color: #155724; margin: 0 0 15px 0;">Hello ${
              user.firstName
            },</p>
            <p style="color: #155724; line-height: 1.6; margin: 0;">
              Your password has been successfully changed. You can now log in with your new password.
            </p>
          </div>
          
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <p style="margin: 0 0 10px 0; color: #333; font-weight: 500;">Security Information:</p>
            <ul style="color: #666; line-height: 1.6; margin: 0; padding-left: 20px;">
              <li><strong>Changed at:</strong> ${moment().format(
                "MMMM Do YYYY, h:mm:ss a"
              )}</li>
              <li><strong>Account:</strong> ${user.email}</li>
              <li><strong>User:</strong> ${user.firstName} ${user.lastName}</li>
            </ul>
          </div>
          
          <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <p style="margin: 0; color: #856404; font-weight: 500;">
              🔒 If you didn't make this change, please contact your administrator immediately.
            </p>
          </div>
          
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          
          <p style="color: #999; font-size: 12px; text-align: center;">
            This is an automated security notification from ${
              config.appTitle || config.appName || "LTC Flow"
            }
          </p>
        </div>
      `,
    });

    await confirmationEmail.save();

    console.log(
      `✅ Password reset successful for user: ${user.email} (Company: ${companyId})`
    );

    res.status(200).json({
      status: "success",
      message:
        "Password has been reset successfully. You can now log in with your new password.",
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
      },
    });
  } catch (error) {
    console.error("❌ Reset password error:", error);
    res.status(500).json({
      status: "error",
      error: "INTERNAL_SERVER_ERROR",
      message:
        "An error occurred while resetting your password. Please try again later.",
    });
  }
});

module.exports = router;
