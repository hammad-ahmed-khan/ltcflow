// backend/src/routes/auth/forgot-password.js (Updated with duplicate prevention)
const router = require("express").Router();
const AuthCode = require("../../models/AuthCode");
const Email = require("../../models/Email");
const User = require("../../models/User");
const Company = require("../../models/Company");
const Config = require("../../../config");
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

    // Find company using companyObjectId
    const company = await Company.findById(companyObjectId);
    if (!company) {
      return res.status(404).json({
        status: "error",
        error: "COMPANY_NOT_FOUND",
        message: "Company not found",
      });
    }

    // Find user by email and companyId (multi-tenant)
    const user = await User.findOne({
      email: email.toLowerCase(),
      companyId: companyObjectId,
    });

    // Always return success for security (don't reveal if email exists)
    // But only send OTP if user actually exists
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

      // Validate OTP capability based on global config
      const otpMethod = Config.otp?.method || "sms";
      const fallbackEnabled = Config.otp?.fallbackEnabled !== false;
      const issues = [];

      console.log(
        `🔧 Password reset OTP method: ${otpMethod}, fallback: ${fallbackEnabled}`
      );

      if (otpMethod === "email" || otpMethod === "both") {
        if (!Config.nodemailerEnabled) {
          issues.push("Email service is not configured");
        }
      }

      if (otpMethod === "sms" || otpMethod === "both") {
        if (!Config.smsEnabled) {
          issues.push("SMS service is not configured");
        }
        if (!Config.twilio?.accountSid || !Config.twilio?.authToken) {
          issues.push("Twilio credentials are not configured");
        }
        if (!Config.twilio?.fromNumber) {
          issues.push("Twilio from number is not configured");
        }
        if (!user.phone) {
          issues.push("User has no phone number configured");
        }
      }

      // If fallback is enabled and one method is available, it's still valid
      const emailAvailable = Config.nodemailerEnabled && user.email;
      const smsAvailable =
        Config.smsEnabled && user.phone && Config.twilio?.accountSid;

      if (
        issues.length > 0 &&
        (!fallbackEnabled || (!emailAvailable && !smsAvailable))
      ) {
        return res.status(400).json({
          status: "error",
          error: "OTP_NOT_AVAILABLE",
          message: `Cannot send password reset code: ${issues.join(
            ", "
          )}. Please contact your administrator.`,
          issues: issues,
        });
      }

      // Check if there's already a valid reset code for this user
      const existingResetCode = await AuthCode.findOne({
        user: user._id,
        email: user.email,
        valid: true,
        companyId: companyObjectId,
        expires: { $gt: new Date() }, // Not expired
      }).sort({ createdAt: -1 });

      let resetCode;
      let shouldSendOTP = false;
      let isExistingCode = false;

      if (existingResetCode) {
        // Use existing reset code
        resetCode = existingResetCode.code;
        isExistingCode = true;
        console.log(
          `🔄 Using existing valid reset code for user: ${
            user.email
          } (expires: ${moment(existingResetCode.expires).format(
            "YYYY-MM-DD HH:mm:ss"
          )})`
        );

        // Check if code was created recently (within last 2 minutes)
        const codeAge = moment().diff(
          moment(existingResetCode.createdAt),
          "minutes"
        );
        if (codeAge < 2) {
          shouldSendOTP = true; // Send if code is very recent (might be first request)
          console.log(
            `🔄 Recent reset code (${codeAge} minutes old) - will send`
          );
        } else {
          shouldSendOTP = false; // Don't send if code is older than 2 minutes
          console.log(
            `⏳ Existing reset code is ${codeAge} minutes old - not resending`
          );
        }
      } else {
        // No valid reset code exists, create a new one
        shouldSendOTP = true;

        // Invalidate any existing auth codes for this user
        await AuthCode.updateMany(
          { user: user._id, valid: true },
          { $set: { valid: false } }
        );

        // Generate new 6-digit verification code
        resetCode = randomstring.generate({
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
        console.log(`🆕 Generated new reset code for user: ${user.email}`);
      }

      // OTP Sending Logic based on Config (only if shouldSendOTP is true)
      let emailSent = false;
      let smsSent = false;

      if (shouldSendOTP) {
        console.log(`🔧 Sending reset code via ${otpMethod} method`);

        // Send via Email
        if (otpMethod === "email" || otpMethod === "both") {
          try {
            const resetEmail = new Email({
              companyId: companyObjectId,
              from: Config.nodemailer.from,
              to: user.email,
              subject: `${
                Config.appTitle || Config.appName || "LTC Flow"
              } - Password Reset Code`,
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                  <div style="text-align: center; margin-bottom: 30px;">
                    <h1 style="color: #1976d2; margin: 0;">${
                      Config.appTitle || Config.appName || "LTC Flow"
                    }</h1>
                    <h2 style="color: #333; margin: 10px 0;">Password Reset Request</h2>
                  </div>
                  
                  <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <p style="color: #333; margin: 0 0 15px 0;">Hello ${
                      user.firstName
                    },</p>
                    <p style="color: #666; line-height: 1.6;">
                      We received a request to reset your password. Use the verification code below to reset your password:
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
                    Request made at: ${moment().format(
                      "MMMM Do YYYY, h:mm:ss a"
                    )}<br>
                    This is an automated message from ${
                      Config.appTitle || Config.appName || "LTC Flow"
                    }
                  </p>
                </div>
              `,
            });

            await resetEmail.save();
            emailSent = true;
            console.log(
              `📧 Password reset code sent via email to user: ${user.email} (Company: ${companyId})`
            );
          } catch (emailError) {
            console.error(
              `❌ Email password reset failed for ${user.email}:`,
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
            const message = `Hello ${user.firstName}! Your ${company.name} password reset code is: ${resetCode}. This code expires in 15 minutes. Do not share this code with anyone.`;

            // Send SMS
            await twilioClient.messages.create({
              body: message,
              from: Config.twilio.fromNumber,
              to: user.phone,
            });

            smsSent = true;
            console.log(
              `📱 Password reset code sent via SMS to user: ${user.phone} (Company: ${companyId})`
            );
          } catch (smsError) {
            console.error(
              `❌ SMS password reset failed for ${user.phone}:`,
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
            const resetEmail = new Email({
              companyId: companyObjectId,
              from: Config.nodemailer.from,
              to: user.email,
              subject: `${
                Config.appTitle || Config.appName || "LTC Flow"
              } - Password Reset Code`,
              html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h1 style="color: #1976d2;">${
                  Config.appTitle || Config.appName || "LTC Flow"
                }</h1>
                <h2>Password Reset Request</h2>
                <p>Hello ${user.firstName},</p>
                <p>Your password reset code is: <strong style="font-size: 24px; color: #1976d2;">${resetCode}</strong></p>
                <p>This code expires in 15 minutes.</p>
                </div>`,
            });
            await resetEmail.save();
            emailSent = true;
            console.log(
              `📧 Password reset code sent via email (fallback) to user: ${user.email}`
            );
          } catch (fallbackError) {
            console.error(`❌ Email fallback failed:`, fallbackError.message);
          }
        }

        // Check if at least one method succeeded
        if (!emailSent && !smsSent) {
          throw new Error(
            "Failed to send password reset code via any available method"
          );
        }

        console.log(
          `🔑 Password reset OTP sent (Method: ${otpMethod}) to user: ${user.email} (Company: ${companyId})`
        );
      } else {
        // Using existing code - set flags based on configured method (for frontend display)
        emailSent = otpMethod === "email" || otpMethod === "both";
        smsSent = otpMethod === "sms" || otpMethod === "both";
        console.log(
          `♻️ Using existing reset code for user: ${user.email} - no new message sent`
        );
      }

      // Create masked phone for security
      const maskPhone = (phone) => {
        if (!phone) return null;
        if (phone.startsWith("+")) {
          const countryCode = phone.slice(0, phone.length - 10);
          const lastFour = phone.slice(-4);
          const maskedMiddle = "*".repeat(
            phone.length - countryCode.length - 4
          );
          return `${countryCode}${maskedMiddle}${lastFour}`;
        }
        if (phone.length >= 7) {
          const first = phone.slice(0, 3);
          const last = phone.slice(-4);
          const maskedMiddle = "*".repeat(phone.length - 7);
          return `${first}${maskedMiddle}${last}`;
        }
        return phone.slice(0, 2) + "*".repeat(phone.length - 2);
      };

      const response = {
        status: "success",
        message:
          "If an account with that email exists, we've sent a password reset code.",
        user: {
          email: user.email,
          firstName: user.firstName,
          phone: user.phone,
        },
        maskedPhone: maskPhone(user.phone),
      };

      // Add OTP delivery info
      if (emailSent || smsSent) {
        response.otpSent = {
          email: emailSent,
          sms: smsSent,
          method: otpMethod,
          isExisting: isExistingCode,
          expiresAt: existingResetCode
            ? existingResetCode.expires
            : moment().add(15, "minutes").toDate(),
        };
      }

      return res.status(200).json(response);
    }

    // For non-existent users, return generic success
    res.status(200).json({
      status: "success",
      message:
        "If an account with that email exists, we've sent a password reset code.",
    });
  } catch (error) {
    console.error("❌ Forgot password error:", error);
    res.status(500).json({
      status: "error",
      error: "INTERNAL_SERVER_ERROR",
      message: error.message,
    });
  }
});

module.exports = router;
