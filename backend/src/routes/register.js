const User = require("../models/User");
const Company = require("../models/Company");
const Email = require("../models/Email");
const validator = require("validator");
const isEmpty = require("../utils/isEmpty");
const xss = require("xss");
const crypto = require("crypto");
const Config = require("../../config");

module.exports = async (req, res, next) => {
  let { username, email, firstName, lastName, phone, level } = req.fields;
  const companyId = req.headers["x-company-id"];

  // Validate required fields
  let errors = {};
  isEmpty(username) && (errors.username = "Username required.");
  isEmpty(email) && (errors.email = "Email required.");
  isEmpty(firstName) && (errors.firstName = "First name required.");
  isEmpty(lastName) && (errors.lastName = "Last name required.");
  isEmpty(level) && (errors.level = "User role required.");
  isEmpty(companyId) && (errors.companyId = "Company ID required.");

  if (Object.keys(errors).length > 0) {
    return res.status(400).json(errors);
  }

  // Validate email format
  if (!validator.isEmail(email)) {
    errors.email = "Invalid email.";
  }

  // Validate user level
  const validLevels = ["user", "manager", "admin"];
  if (!validLevels.includes(level)) {
    errors.level = "Invalid user role.";
  }

  // Check permissions based on current user's level
  if (req.user) {
    const currentUserLevel = req.user.level;

    // Validate user belongs to the same company
    if (req.user.companyId.toString() !== companyId) {
      return res.status(403).json({
        error: "INVALID_COMPANY_ACCESS",
        message: "You can only create users within your own company",
      });
    }

    if (currentUserLevel === "root") {
      // Root can create all levels
    } else if (currentUserLevel === "admin") {
      // Administrators cannot create other administrators
      if (level === "admin") {
        errors.level = "Administrators cannot create other administrators.";
      }
    } else {
      // Other users cannot create users
      errors.permission = "You do not have permission to create users.";
    }
  }

  if (Object.keys(errors).length > 0) {
    return res.status(400).json(errors);
  }

  email = email.toLowerCase();

  try {
    // Get company information for subdomain
    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({
        error: "COMPANY_NOT_FOUND",
        message: "Company not found",
      });
    }

    // Check for username conflicts within the same company
    const isUsername = await User.findOne({ username, companyId });
    if (isUsername) {
      errors.username = "Username taken within your company.";
    }

    // Check for email conflicts within the same company
    const isEmail = await User.findOne({ email, companyId });
    if (isEmail) {
      errors.email = "Email already in use within your company.";
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json(errors);
    }

    // Generate activation token and expiry
    const activationToken = crypto.randomBytes(32).toString("hex");
    const tokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Create user WITHOUT password (they'll set it during activation)
    const newUser = new User({
      username: xss(username),
      email: xss(email),
      firstName: xss(firstName),
      lastName: xss(lastName),
      phone: xss(phone || ""),
      level: level,
      companyId: companyId,
      status: "pending",
      activationToken: activationToken,
      tokenExpiry: tokenExpiry,
      lastOnline: Date.now(),
    });

    const savedUser = await newUser.save();

    // Generate multi-tenant activation link
    const activationLink = `https://${company.subdomain}.${Config.domain}/activate/${activationToken}`;

    // Create email entry with company context
    const emailEntry = new Email({
      companyId: companyId,
      from: Config.nodemailer.from,
      to: email,
      subject: `${
        Config.appTitle || Config.appName || "Clover"
      } - Account Activation`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #1976d2; margin: 0;">${
              Config.appTitle || Config.appName || "Clover"
            }</h1>
          </div>
          
          <h2 style="color: #333; margin-bottom: 20px;">Welcome to ${
            company.name || Config.appTitle
          }!</h2>
          
          <p style="font-size: 16px; line-height: 1.5; color: #333;">Hello ${firstName},</p>
          
          <p style="font-size: 16px; line-height: 1.5; color: #333;">
            You've been invited to join <strong>${company.name}</strong> on ${
        Config.appTitle || Config.appName
      }.
          </p>
          
          <p style="font-size: 16px; line-height: 1.5; color: #333;">
            Click the button below to activate your account and set your password:
          </p>
          
          <div style="text-align: center; margin: 40px 0;">
            <a href="${activationLink}" 
               style="background-color: #1976d2; color: white; padding: 16px 32px; 
                      text-decoration: none; border-radius: 8px; display: inline-block;
                      font-weight: bold; font-size: 16px; border: none; cursor: pointer;">
              Activate Your Account
            </a>
          </div>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 30px 0;">
            <h3 style="color: #333; margin-top: 0;">Important Information:</h3>
            <ul style="color: #666; line-height: 1.6; margin: 0; padding-left: 20px;">
              <li>This activation link will expire in <strong>7 days</strong></li>
              <li>You can only use this link <strong>once</strong></li>
              <li>After activation, access your account at: 
                <a href="https://${company.subdomain}.${
        Config.domain
      }" style="color: #1976d2;">
                  https://${company.subdomain}.${Config.domain}
                </a>
              </li>
            </ul>
          </div>
          
          <div style="margin: 30px 0; padding: 15px; background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 6px;">
            <p style="margin: 0; color: #856404; font-size: 14px;">
              <strong>Can't click the button?</strong> Copy and paste this link into your browser:
            </p>
            <p style="word-break: break-all; color: #856404; font-size: 13px; margin: 5px 0 0 0; font-family: monospace;">
              ${activationLink}
            </p>
          </div>
          
          <hr style="margin: 40px 0; border: none; border-top: 1px solid #eee;">
          
          <p style="color: #999; font-size: 12px; text-align: center;">
            If you didn't expect this invitation, you can safely ignore this email.<br>
            This email was sent by ${company.name} via ${
        Config.appTitle || Config.appName
      }.
          </p>
        </div>
      `,
    });

    await emailEntry.save();

    // Remove sensitive data from response
    const userResponse = savedUser.toObject();
    delete userResponse.activationToken;
    delete userResponse.tokenExpiry;

    res.status(200).json({
      status: "success",
      message: `User ${username} created successfully. Activation email sent.`,
      user: userResponse,
      activationLink: activationLink, // For admin to copy if needed
      companyUrl: `https://${company.subdomain}.${Config.domain}`,
      expiresIn: "7 days",
    });
  } catch (err) {
    console.error("Error creating user:", err);
    res.status(500).json({
      error: "Server error creating user.",
      message: "An error occurred while creating the user account.",
    });
  }
};
