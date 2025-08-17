// backend/src/routes/regenerate-activation.js
const User = require("../models/User");
const Email = require("../models/Email");
const crypto = require("crypto");
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

    // Only allow resending for pending or expired users
    if (!["pending", "expired"].includes(user.status)) {
      return res.status(400).json({
        status: "error",
        error: "INVALID_USER_STATUS",
        message: "Can only resend invitations for pending or expired users",
      });
    }

    // Generate new activation token and expiry
    const newActivationToken = crypto.randomBytes(32).toString("hex");
    const newTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

    // Update user with new token info
    await User.findByIdAndUpdate(userId, {
      activationToken: newActivationToken,
      tokenExpiry: newTokenExpiry,
      status: "pending", // Reset to pending if it was expired
      updatedAt: new Date(), // Track when invitation was resent
    });

    // Generate new activation link
    const activationLink = `${
      Config.frontendUrl || "http://localhost:3000"
    }/activate/${newActivationToken}`;

    // Create email entry
    const emailEntry = new Email({
      companyId, // Add company context to email
      from: Config.nodemailer.from,
      to: user.email,
      subject: `${
        Config.appTitle || Config.appName || "Clover"
      } - Invitation Reminder`,
      html: `
        <p>Hello ${user.firstName},</p>
        <p>This is a reminder to complete your account setup for ${
          Config.appTitle || Config.appName || "Clover"
        }.</p>
        <p>Click the link below to activate your account:</p>
        <p><a href="${activationLink}" style="background-color: #1976d2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Activate Account</a></p>
        <p>This link will expire in 7 days.</p>
        <p>If you're having trouble clicking the link, copy and paste this URL into your browser:</p>
        <p>${activationLink}</p>
        <br>
        <p>Best regards,<br>The ${
          Config.appTitle || Config.appName || "Clover"
        } Team</p>
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
