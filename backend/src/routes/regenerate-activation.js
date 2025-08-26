// backend/src/routes/regenerate-activation.js
const User = require("../models/User");
const Company = require("../models/Company"); // ✅ Add this import
const Email = require("../models/Email");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const Config = require("../../config");

module.exports = async (req, res, next) => {
  try {
    const { userId } = req.fields;
    const companyId = req.headers["x-company-id"];

    // Validate inputs
    if (!userId) {
      return res.status(400).json({
        status: "error",
        error: "USER_ID_REQUIRED",
      });
    }

    if (!companyId) {
      return res.status(400).json({
        status: "error",
        error: "COMPANY_ID_REQUIRED",
      });
    }

    // Find user within the company
    const user = await User.findOne({
      _id: userId,
      companyId,
    });

    if (!user) {
      return res.status(404).json({
        status: "error",
        error: "USER_NOT_FOUND",
      });
    }

    // ✅ FETCH THE COMPANY DATA (this was missing!)
    const company = await Company.findById(companyId);

    if (!company) {
      return res.status(404).json({
        status: "error",
        error: "COMPANY_NOT_FOUND",
        message: "Company not found",
      });
    }

    // Only allow resending for pending or expired users
    if (!["pending", "expired"].includes(user.status)) {
      return res.status(400).json({
        status: "error",
        error: "INVALID_USER_STATUS",
        message: "Can only resend invitations for pending or expired users",
      });
    }

    // Generate new activation token (raw for URL, hashed for DB)
    const newActivationTokenRaw = crypto.randomBytes(32).toString("hex");
    const newActivationTokenHashed = await bcrypt.hash(
      newActivationTokenRaw,
      10
    );
    const newTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

    // Update user with new hashed token info
    await User.findByIdAndUpdate(userId, {
      activationToken: newActivationTokenHashed, // Store hashed token
      tokenExpiry: newTokenExpiry,
      status: "pending", // Reset to pending if it was expired
      updatedAt: new Date(), // Track when invitation was resent
    });

    // ✅ FIXED: Generate activation link using company subdomain (same as register.js)
    const activationLink = `https://${company.subdomain}.${Config.domain}/activate/${newActivationTokenRaw}`;

    // Create email entry
    const emailEntry = new Email({
      companyId, // Add company context to email
      from: Config.nodemailer.from,
      to: user.email,
      subject: `${company.name}: Activation Reminder - ${
        Config.appTitle || Config.appName || "Clover"
      }`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #1976d2; margin: 0;">${company.name}</h1>
            <p style="color: #666; margin: 5px 0 0 0; font-size: 14px;">Powered by ${
              Config.appTitle || Config.appName || "Clover"
            }</p>
          </div>
          
          <h2 style="color: #333; margin-bottom: 20px;">Activation Reminder</h2>
          
          <p style="font-size: 16px; line-height: 1.5; color: #333;">Hello ${
            user.firstName
          },</p>
          
          <p style="font-size: 16px; line-height: 1.5; color: #333;">
            This is a reminder to complete your account setup for <strong>${
              company.name
            }</strong> on ${Config.appTitle || Config.appName || "Clover"}.
          </p>
          
          <p style="font-size: 16px; line-height: 1.5; color: #333;">
            Click the button below to activate your account and set your password:
          </p>
          
          <div style="text-align: center; margin: 40px 0;">
            <a href="${activationLink}" 
               aria-label="Activate your ${company.name} account"
               style="background-color: #1976d2; color: white; padding: 16px 32px; 
                      text-decoration: none; border-radius: 8px; display: inline-block;
                      font-weight: bold; font-size: 16px; border: none; cursor: pointer;">
              Activate Your Account
            </a>
          </div>
          
          <div style="background-color: #fff3cd; padding: 15px; border-radius: 6px; margin: 20px 0; border: 1px solid #ffeaa7;">
            <p style="margin: 0; color: #856404; font-size: 14px;">
              <strong>⚠️ This is a reminder email.</strong> Your activation link will expire in 7 days from now.
            </p>
          </div>
          
          <div style="margin: 30px 0; padding: 15px; background-color: #f8f9fa; border-radius: 6px;">
            <p style="margin: 0; color: #333; font-size: 14px;">
              <strong>Can't click the button?</strong> Copy and paste this link into your browser:
            </p>
            <p style="word-break: break-all; color: #666; font-size: 13px; margin: 5px 0 0 0; font-family: monospace;">
              ${activationLink}
            </p>
          </div>
          
          <p style="font-size: 16px; line-height: 1.5; color: #333;">
            After activation, you can access your account at: 
            <a href="https://${company.subdomain}.${
        Config.domain
      }" style="color: #1976d2;">
              https://${company.subdomain}.${Config.domain}
            </a>
          </p>
          
          <hr style="margin: 40px 0; border: none; border-top: 1px solid #eee;">
          
          <p style="color: #999; font-size: 12px; text-align: center;">
            This activation reminder was sent by ${company.name}<br>
            If you didn't request this, you can safely ignore this email.
          </p>
        </div>
      `,
    });

    await emailEntry.save();

    res.status(200).json({
      status: "success",
      message: "Invitation resent successfully",
      data: {
        userId: user._id,
        email: user.email,
        newTokenExpiry: newTokenExpiry,
        resentAt: new Date(),
        activationLink: activationLink, // Include the properly formatted link in response
        companyUrl: `https://${company.subdomain}.${Config.domain}`,
      },
    });
  } catch (error) {
    console.error("Error resending invitation:", error);
    res.status(500).json({
      status: "error",
      error: "INTERNAL_SERVER_ERROR",
      message: "Failed to resend invitation",
    });
  }
};
