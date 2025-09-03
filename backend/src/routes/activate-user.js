// backend/src/routes/activate-user.js (Minimally enhanced for root user support)
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
    const { token } = req.params;
    const companyId = req.headers["x-company-id"];

    // Validate required fields
    let errors = {};
    isEmpty(token) && (errors.token = "Activation token required.");
    isEmpty(companyId) && (errors.companyId = "Company ID required.");

    if (Object.keys(errors).length > 0) {
      return res.status(400).json(errors);
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
        error: "INVALID_TOKEN",
        message: "Invalid activation token or user not found.",
      });
    }

    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({
        error: "COMPANY_NOT_FOUND",
        message: "Company not found",
      });
    }

    // 🆕 Validate OTP capability based on global config
    const otpMethod = Config.otp?.method || "sms";
    const fallbackEnabled = Config.otp?.fallbackEnabled !== false;

    if (otpMethod === "sms" || otpMethod === "both") {
      if (!user.phone) {
        return res.status(400).json({
          error: "NO_PHONE_NUMBER",
          message:
            "Your account doesn't have a phone number. Please contact your administrator to add a phone number before activating your account.",
        });
      }
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

    // 🆕 Check if there's already a valid OTP for this user
    const existingOTP = await AuthCode.findOne({
      user: user._id,
      email: user.email,
      valid: true,
      companyId: companyId,
      expires: { $gt: new Date() }, // Not expired
    }).sort({ createdAt: -1 }); // Get the most recent one

    let activationOTP;
    let shouldSendOTP = false;
    let isExistingOTP = false;

    if (existingOTP) {
      // Use existing OTP - don't send a new one
      activationOTP = existingOTP.code;
      isExistingOTP = true;
      console.log(
        `🔄 Using existing valid OTP for user: ${user.email} (expires: ${moment(
          existingOTP.expires
        ).format("YYYY-MM-DD HH:mm:ss")})`
      );

      // Check if OTP was created recently (within last 2 minutes) - if so, might resend
      const otpAge = moment().diff(moment(existingOTP.createdAt), "minutes");
      if (otpAge < 2) {
        shouldSendOTP = true; // Send if OTP is very recent (might be first request)
        console.log(`🔄 Recent OTP (${otpAge} minutes old) - will send`);
      } else {
        shouldSendOTP = false; // Don't send if OTP is older than 2 minutes
        console.log(`⏳ Existing OTP is ${otpAge} minutes old - not resending`);
      }
    } else {
      // No valid OTP exists, create a new one
      shouldSendOTP = true;

      // Invalidate any existing auth codes for this user (activation purpose)
      await AuthCode.updateMany(
        { user: user._id, valid: true },
        { $set: { valid: false } }
      );

      // Generate new 6-digit OTP for activation
      activationOTP = randomstring.generate({
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
      console.log(`🆕 Generated new OTP for user: ${user.email}`);
    }

    // 🆕 OTP Sending Logic based on Config (only if shouldSendOTP is true)
    let emailSent = false;
    let smsSent = false;
    let otpMessage = "Token is valid. Verification code sent";

    if (shouldSendOTP) {
      console.log(`🔧 Sending OTP via ${otpMethod} method`);

      // Send via Email
      if (otpMethod === "email" || otpMethod === "both") {
        try {
          const otpEmail = new Email({
            companyId,
            from: Config.nodemailer.from,
            to: user.email,
            subject: `${
              Config.appTitle || Config.appName || "Clover"
            } - Account Activation Code`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="text-align: center; margin-bottom: 30px;">
                  <h1 style="color: #1976d2; margin: 0;">${
                    Config.appTitle || Config.appName || "Clover"
                  }</h1>
                  <h2 style="color: #333; margin: 10px 0;">Account Activation</h2>
                </div>
                
                <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                  <p style="color: #333; margin: 0 0 15px 0;">Hello ${
                    user.firstName
                  },</p>
                  <p style="color: #666; line-height: 1.6;">
                    Please use the verification code below to complete your account activation:
                  </p>
                  
                  <div style="text-align: center; margin: 25px 0;">
                    <div style="display: inline-block; background-color: #1976d2; color: white; padding: 15px 30px; font-size: 24px; font-weight: bold; border-radius: 8px; letter-spacing: 3px;">
                      ${activationOTP}
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
                    <li>If you didn't request this activation, please ignore this email</li>
                    <li>Never share this verification code with anyone</li>
                    <li>Our team will never ask for your verification code</li>
                  </ul>
                </div>
                
                <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
                
                <p style="color: #999; font-size: 12px; text-align: center;">
                  Request made at: ${moment().format(
                    "MMMM Do YYYY, h:mm:ss a"
                  )}<br>
                  This is an automated message from ${
                    Config.appTitle || Config.appName || "Clover"
                  }
                </p>
              </div>
            `,
          });

          await otpEmail.save();
          emailSent = true;
          console.log(
            `📧 Activation OTP sent via email to user: ${user.email} (Company: ${companyId})`
          );
        } catch (emailError) {
          console.error(
            `❌ Email OTP failed for ${user.email}:`,
            emailError.message
          );
          if (otpMethod === "email" && !fallbackEnabled) {
            throw emailError;
          }
        }
      }

      // Send via SMS
      if (
        otpMethod === "sms" ||
        otpMethod === "both" ||
        (fallbackEnabled && !emailSent && otpMethod === "email")
      ) {
        try {
          if (!user.phone) {
            throw new Error("User has no phone number configured");
          }

          // Initialize Twilio client
          const twilioClient = Twilio(
            Config.twilio.accountSid,
            Config.twilio.authToken
          );

          const message = `Hello ${user.firstName}! Your ${company.name} account activation code is: ${activationOTP}. This code expires in 15 minutes. Do not share this code with anyone.`;

          // Send SMS
          await twilioClient.messages.create({
            body: message,
            from: Config.twilio.fromNumber,
            to: user.phone,
          });

          smsSent = true;
          console.log(
            `📱 Activation OTP sent via SMS to user: ${user.phone} (Company: ${companyId})`
          );
        } catch (smsError) {
          console.error(
            `❌ SMS OTP failed for ${user.phone}:`,
            smsError.message
          );
          if (otpMethod === "sms" && !fallbackEnabled) {
            throw smsError;
          }
        }
      }

      // Try email fallback if SMS failed
      if (fallbackEnabled && !emailSent && !smsSent && otpMethod === "sms") {
        try {
          const otpEmail = new Email({
            companyId,
            from: Config.nodemailer.from,
            to: user.email,
            subject: `${
              Config.appTitle || Config.appName || "Clover"
            } - Account Activation Code`,
            html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h1 style="color: #1976d2;">${
                Config.appTitle || Config.appName || "Clover"
              }</h1>
              <h2>Account Activation</h2>
              <p>Hello ${user.firstName},</p>
              <p>Your activation code is: <strong style="font-size: 24px; color: #1976d2;">${activationOTP}</strong></p>
              <p>This code expires in 15 minutes.</p>
              </div>`,
          });
          await otpEmail.save();
          emailSent = true;
          console.log(
            `📧 Activation OTP sent via email (fallback) to user: ${user.email}`
          );
        } catch (fallbackError) {
          console.error(`❌ Email fallback failed:`, fallbackError.message);
        }
      }

      // Check if at least one method succeeded
      if (!emailSent && !smsSent) {
        throw new Error("Failed to send OTP via any available method");
      }

      // Update response message
      if (emailSent && smsSent) {
        otpMessage += " to your email and phone number.";
      } else if (emailSent) {
        otpMessage += " to your email address.";
      } else if (smsSent) {
        otpMessage += " to your phone number.";
      }

      console.log(
        `🔐 Activation OTP sent (Method: ${otpMethod}) to user: ${user.email} (Company: ${companyId})`
      );
    } else {
      // Using existing OTP - update message accordingly
      if (otpMethod === "both") {
        otpMessage += " to your email and phone number.";
      } else if (otpMethod === "email") {
        otpMessage += " to your email address.";
      } else {
        otpMessage += " to your phone number.";
      }
      console.log(
        `♻️ Using existing OTP for user: ${user.email} - no new message sent`
      );

      // Set flags based on configured method (for frontend display)
      emailSent = otpMethod === "email" || otpMethod === "both";
      smsSent = otpMethod === "sms" || otpMethod === "both";
    }

    // 🆕 MINIMAL ENHANCEMENT: Return user info for the activation form with company info
    res.status(200).json({
      status: "success",
      message: otpMessage,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        phone: user.phone,
        level: user.level, // 🆕 Include level for root user detection
      },
      // 🆕 Add company info needed by frontend
      company: {
        id: company._id,
        name: company.name,
        subdomain: company.subdomain,
      },
      nextStep: "verify_otp",
      // 🆕 Rename otpSent to otpDelivery to match frontend expectations
      otpDelivery: {
        email: emailSent,
        sms: smsSent,
        method: otpMethod,
        isExisting: isExistingOTP,
        expiresAt: existingOTP
          ? existingOTP.expires
          : moment().add(15, "minutes").toDate(),
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
