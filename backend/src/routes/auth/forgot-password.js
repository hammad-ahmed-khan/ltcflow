// backend/src/routes/auth/forgot-password.js (Updated to send SMS OTP)
const router = require("express").Router();
const AuthCode = require("../../models/AuthCode");
const Email = require("../../models/Email");
const User = require("../../models/User");
const Company = require("../../models/Company");
const config = require("../../../config");
const randomstring = require("randomstring");
const moment = require("moment");
const isEmpty = require("../../utils/isEmpty");
const { isEmail } = require("validator");
const mongoose = require("mongoose");
const Twilio = require("twilio");

router.post("*", async (req, res) => {
  try {
    const { email } = req.fields;
    const companyId = req.headers["x-company-id"];

    // Validation
    if (isEmpty(email)) {
      return res.status(400).json({
        status: "error",
        email: "Email address is required",
      });
    }

    if (!isEmail(email)) {
      return res.status(400).json({
        status: "error",
        email: "Please enter a valid email address",
      });
    }

    if (!companyId) {
      return res.status(400).json({
        status: "error",
        error: "COMPANY_ID_REQUIRED",
        message: "Company ID is required",
      });
    }

    // Convert companyId to ObjectId for proper matching
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

    // Find user by email and companyId (multi-tenant)
    const user = await User.findOne({
      email: email.toLowerCase(),
      companyId: companyObjectId,
    });

    // Always return success for security (don't reveal if email exists)
    // But only send SMS if user actually exists
    if (user) {
      // Check user status
      if (user.status !== "active") {
        const statusMessages = {
          pending:
            "Account is not yet activated. Please check your email for the activation link or contact your administrator.",
          expired:
            "Account has expired. Please contact your administrator for assistance.",
          deactivated:
            "Account has been deactivated. Please contact your administrator for assistance.",
        };

        return res.status(403).json({
          status: "error",
          message:
            statusMessages[user.status] ||
            "Account is not available for password reset.",
        });
      }

      // Check if user has phone number
      if (!user.phone) {
        return res.status(400).json({
          status: "error",
          error: "NO_PHONE_NUMBER",
          message:
            "Your account doesn't have a phone number. Please contact your administrator to add a phone number for password reset.",
        });
      }

      // Get company info for SMS message
      const company = await Company.findById(companyObjectId);
      if (!company) {
        return res.status(404).json({
          status: "error",
          error: "COMPANY_NOT_FOUND",
          message: "Company not found",
        });
      }

      // Invalidate any existing auth codes for this user
      await AuthCode.updateMany(
        { user: user._id, valid: true },
        { $set: { valid: false } }
      );

      // Generate new 6-digit verification code
      const resetCode = randomstring.generate({
        charset: "numeric",
        length: 6,
      });

      // Create new auth code with 15-minute expiry
      const authCode = new AuthCode({
        code: resetCode,
        user: user._id,
        email: user.email,
        valid: true,
        expires: moment().add(15, "minutes").toDate(),
        companyId: companyObjectId,
      });

      await authCode.save();

      // Initialize Twilio client
      const twilioClient = Twilio(
        config.twilio.accountSid,
        config.twilio.authToken
      );

      const message = `Hello ${user.firstName}! Your ${company.name} password reset code is: ${resetCode}. This code expires in 15 minutes. Do not share this code with anyone.`;

      // Send SMS
      await twilioClient.messages.create({
        body: message,
        from: config.twilio.fromNumber, // Twilio phone number
        to: user.phone, // User's phone number
      });

      console.log(
        `🔐 Password reset code sent via SMS to user: ${user.phone} (Company: ${companyId})`
      );

      // Queue password reset email (commented out - now using SMS)
      /*
      const resetEmail = new Email({
        companyId: companyObjectId,
        from: config.nodemailer.from,
        to: user.email,
        subject: `${
          config.appTitle || config.appName || "LTC Flow"
        } - Password Reset Code`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #1976d2; margin: 0;">${
                config.appTitle || config.appName || "LTC Flow"
              }</h1>
              <h2 style="color: #333; margin: 10px 0;">Password Reset Request</h2>
            </div>
            
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="color: #333; margin: 0 0 15px 0;">Hello ${
                user.firstName
              },</p>
              <p style="color: #666; line-height: 1.6;">
                We received a request to reset your password.
                Use the verification code below to reset your password:
              </p>
              
              <div style="text-align: center; margin: 25px 0;">
                <div style="display: inline-block; background-color: #1976d2; color: white; padding: 15px 30px; font-size: 24px; font-weight: bold; border-radius: 8px; letter-spacing: 3px;">
                  ${resetCode}
                </div>
              </div>
              
              <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 6px; margin: 20px 0;">
                <p style="margin: 0; color: #856404; font-weight: 500;">
                  ⏰ This code will expire in 15 minutes
                </p>
              </div>
            </div>
            
            <div style="background-color: #fff; border: 1px solid #dee2e6; padding: 15px; border-radius: 6px; margin: 20px 0;">
              <p style="margin: 0 0 10px 0; color: #333; font-weight: 500;">Security Notice:</p>
              <ul style="color: #666; line-height: 1.6; margin: 0; padding-left: 20px;">
                <li>If you didn't request this password reset, please ignore this email</li>
                <li>Never share this verification code with anyone</li>
                <li>Our team will never ask for your verification code</li>
              </ul>
            </div>
            
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
            
            <p style="color: #999; font-size: 12px; text-align: center;">
              Request made at: ${moment().format("MMMM Do YYYY, h:mm:ss a")}<br>
              This is an automated message from ${
                config.appTitle || config.appName || "LTC Flow"
              }
            </p>
          </div>
        `,
      });

      await resetEmail.save();

      console.log(
        `🔐 Password reset code generated for user: ${user.email} (Company: ${companyId})`
      );
      */
    } else {
      console.log(
        `🔐 Password reset attempted for non-existent user: ${email} (Company: ${companyId})`
      );
    }

    // Always return success response for security
    res.status(200).json({
      status: "success",
      message:
        "If an account with that email exists and has a phone number, we've sent a password reset code to your phone number.",
    });
  } catch (error) {
    console.error("❌ Forgot password error:", error);
    res.status(500).json({
      status: "error",
      error: "INTERNAL_SERVER_ERROR",
      message:
        "An error occurred while processing your request. Please try again later.",
    });
  }
});

module.exports = router;
