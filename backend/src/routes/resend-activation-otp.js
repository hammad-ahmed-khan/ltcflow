// backend/src/routes/resend-activation-otp.js (New route)
const User = require("../models/User");
const AuthCode = require("../models/AuthCode");
const Company = require("../models/Company");
const Email = require("../models/Email");
const bcrypt = require("bcryptjs");
const randomstring = require("randomstring");
const moment = require("moment");
const isEmpty = require("../utils/isEmpty");
const Config = require("../../config");
const Twilio = require("twilio");

module.exports = async (req, res) => {
  try {
    const { token } = req.fields;
    const companyId = req.headers["x-company-id"];

    // Validate required fields
    let errors = {};
    isEmpty(token) && (errors.token = "Activation token required.");
    isEmpty(companyId) && (errors.companyId = "Company ID required.");

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        status: "error",
        errors,
        message: "Please provide the required information.",
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

    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({
        status: "error",
        error: "COMPANY_NOT_FOUND",
        message: "Company not found",
      });
    }
    // Check if user has phone number
    if (!user.phone) {
      return res.status(400).json({
        status: "error",
        error: "NO_PHONE_NUMBER",
        message:
          "Your account doesn't have a phone number. Please contact your administrator to add a phone number before activating your account.",
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

    // Check for rate limiting - prevent too frequent OTP requests
    /*
    const recentOTP = await AuthCode.findOne({
      user: user._id,
      email: user.email,
      companyId: companyId,
      createdAt: { $gt: moment().subtract(1, "minute").toDate() }, // Within last minute
    });

    if (recentOTP) {
      return res.status(429).json({
        status: "error",
        error: "RATE_LIMITED",
        message:
          "Please wait at least 1 minute before requesting another code.",
      });
    }
      */

    // Invalidate any existing auth codes for this user
    await AuthCode.updateMany(
      { user: user._id, valid: true },
      { $set: { valid: false } }
    );

    // Generate new 6-digit OTP for activation
    const activationOTP = randomstring.generate({
      charset: "numeric",
      length: 6,
    });

    // Create new auth code with 15-minute expiry
    const authCode = new AuthCode({
      code: activationOTP,
      user: user._id,
      email: user.email,
      valid: true,
      expires: moment().add(15, "minutes").toDate(),
      companyId: companyId,
    });

    await authCode.save();

    // 🆕 OTP Resending Logic based on Config
    let emailSent = false;
    let smsSent = false;
    let resendMessage = "New verification code sent";

    // Send via Email
    if (Config.otp.method === "email" || Config.otp.method === "both") {
      try {
        const otpEmail = new Email({
          companyId,
          from: Config.nodemailer.from,
          to: user.email,
          subject: `${
            Config.appTitle || Config.appName || "Clover"
          } - New Activation Code`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #1976d2; margin: 0;">${
                  Config.appTitle || Config.appName || "Clover"
                }</h1>
                <h2 style="color: #333; margin: 10px 0;">New Activation Code</h2>
              </div>
              
              <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p style="color: #333; margin: 0 0 15px 0;">Hello ${
                  user.firstName
                },</p>
                <p style="color: #666; line-height: 1.6;">Here is your new verification code for account activation:</p>
                
                <div style="text-align: center; margin: 25px 0;">
                  <div style="display: inline-block; background-color: #1976d2; color: white; padding: 15px 30px; font-size: 24px; font-weight: bold; border-radius: 8px; letter-spacing: 3px;">
                    ${activationOTP}
                  </div>
                </div>
                
                <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 6px; margin: 20px 0;">
                  <p style="margin: 0; color: #856404; font-weight: 500;">⏰ This code will expire in 15 minutes</p>
                </div>
              </div>
            </div>
          `,
        });

        await otpEmail.save();
        emailSent = true;
        console.log(
          `🔄 New activation OTP sent via email to user: ${user.email} (Company: ${companyId})`
        );
      } catch (emailError) {
        console.error(`❌ Email OTP failed:`, emailError.message);
        if (Config.otp.method === "email" && !Config.otp.fallbackEnabled) {
          throw emailError;
        }
      }
    }

    // Send via SMS
    if (
      Config.otp.method === "sms" ||
      Config.otp.method === "both" ||
      (Config.otp.fallbackEnabled &&
        !emailSent &&
        Config.otp.method === "email")
    ) {
      try {
        if (!user.phone) {
          throw new Error("User has no phone number configured");
        }

        const twilioClient = Twilio(
          Config.twilio.accountSid,
          Config.twilio.authToken
        );
        const message = `Hello ${user.firstName}! Your ${company.name} account activation code is: ${activationOTP}. This code expires in 15 minutes. Do not share this code with anyone.`;

        await twilioClient.messages.create({
          body: message,
          from: Config.twilio.fromNumber,
          to: user.phone,
        });

        smsSent = true;
        console.log(
          `🔄 New activation OTP sent via SMS to user: ${user.phone} (Company: ${companyId})`
        );
      } catch (smsError) {
        console.error(`❌ SMS OTP failed:`, smsError.message);
        if (Config.otp.method === "sms" && !Config.otp.fallbackEnabled) {
          throw smsError;
        }
      }
    }

    // Try email fallback if SMS failed
    if (
      Config.otp.fallbackEnabled &&
      !emailSent &&
      !smsSent &&
      Config.otp.method === "sms"
    ) {
      try {
        const otpEmail = new Email({
          companyId,
          from: Config.nodemailer.from,
          to: user.email,
          subject: `${
            Config.appTitle || Config.appName || "Clover"
          } - New Activation Code`,
          html: `<div style="font-family: Arial, sans-serif;">
            <h1 style="color: #1976d2;">${
              Config.appTitle || Config.appName || "Clover"
            }</h1>
            <p>Hello ${
              user.firstName
            }, your new activation code is: <strong>${activationOTP}</strong></p>
            </div>`,
        });
        await otpEmail.save();
        emailSent = true;
        console.log(
          `📧 Resend OTP sent via email (fallback) to user: ${user.email}`
        );
      } catch (fallbackError) {
        console.error(`❌ Email fallback failed:`, fallbackError.message);
      }
    }

    // Check if at least one method succeeded
    if (!emailSent && !smsSent) {
      throw new Error("Failed to resend OTP via any available method");
    }

    // Update response message
    if (emailSent && smsSent) {
      resendMessage += " to your email and phone number.";
    } else if (emailSent) {
      resendMessage += " to your email address.";
    } else if (smsSent) {
      resendMessage += " to your phone number.";
    }

    res.status(200).json({
      status: "success",
      message: resendMessage,
      data: {
        email: user.email,
        phone: user.phone,
        codeExpiry: moment().add(15, "minutes").toDate(),
        resentAt: new Date(),
      },
    });
  } catch (error) {
    console.error("Resend OTP error:", error);
    res.status(500).json({
      status: "error",
      error: "INTERNAL_SERVER_ERROR",
      message: error.message,
    });
  }
};
