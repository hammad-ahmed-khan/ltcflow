const User = require("../models/User");
const Company = require("../models/Company");
const Email = require("../models/Email");
const validator = require("validator");
const isEmpty = require("../utils/isEmpty");
const xss = require("xss");
const crypto = require("crypto");
const Config = require("../../config");
const bcrypt = require("bcryptjs");
const outsetaApi = require("../services/outsetaApi");

let twilioClient = null;
if (Config.smsEnabled && Config.sms.provider === "twilio") {
  const twilio = require("twilio");
  twilioClient = twilio(Config.twilio.accountSid, Config.twilio.authToken);
}

module.exports = async (req, res, next) => {
  let { username, email, firstName, lastName, phone, level } = req.fields;
  const companyId = req.headers["x-company-id"];

  // Validation
  let errors = {};
  isEmpty(username) && (errors.username = "Username required.");
  isEmpty(email) && (errors.email = "Email required.");
  isEmpty(firstName) && (errors.firstName = "First name required.");
  isEmpty(lastName) && (errors.lastName = "Last name required.");
  isEmpty(level) && (errors.level = "User role required.");
  isEmpty(companyId) && (errors.companyId = "Company ID required.");

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ status: "error", errors });
  }

  // Normalize
  email = email.toLowerCase().trim();
  username = username.trim();

  // Email format
  if (!validator.isEmail(email)) {
    errors.email = "Invalid email address.";
  }

  // Valid roles
  const validLevels = ["user", "manager", "admin"];
  if (!validLevels.includes(level)) {
    errors.level = "Invalid user role.";
  }

  // Permission check
  if (req.user) {
    const currentUserLevel = req.user.level;

    // Ensure same company
    if (req.user.companyId.toString() !== companyId) {
      return res.status(403).json({
        status: "error",
        error: "INVALID_COMPANY_ACCESS",
        message: "You can only create users within your own company",
      });
    }

    if (currentUserLevel === "root") {
      // Root can create all
    } else if (currentUserLevel === "admin") {
      if (level === "admin") {
        errors.level = "Administrators cannot create other administrators.";
      }
    } else {
      errors.permission = "You do not have permission to create users.";
    }
  }

  if (Object.keys(errors).length > 0) {
    return res.status(403).json({ status: "error", errors });
  }

  try {
    // Company check
    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({
        status: "error",
        error: "COMPANY_NOT_FOUND",
        message: "Company not found",
      });
    }

    const isDemo = company.subdomain === "demo";

    // Conflict checks
    const usernameExists = await User.findOne({
      username: new RegExp(`^${username}$`, "i"),
      companyId,
    });
    if (usernameExists) {
      errors.username = "Username already taken.";
    }

    const emailExists = await User.findOne({ email, companyId });
    if (emailExists) {
      errors.email = "Email already in use.";
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ status: "error", errors });
    }

    // Activation token (store hashed in DB)
    const activationTokenRaw = crypto.randomBytes(32).toString("hex");
    const activationTokenHashed = await bcrypt.hash(activationTokenRaw, 10);
    const tokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Create user in local database first
    const newUser = new User({
      username: xss(username),
      email: xss(email),
      firstName: xss(firstName),
      lastName: xss(lastName),
      phone: xss(phone || ""),
      level,
      companyId,
      status: "pending",
      activationToken: activationTokenHashed,
      tokenExpiry,
      lastOnline: Date.now(),
    });

    const savedUser = await newUser.save();

    // Create person in Outseta
    let outsetaResult = null;
    if (!isDemo && outsetaApi.isConfigured()) {
      try {
        console.log(`🔄 Creating person in Outseta: ${savedUser.email}`);

        outsetaResult = await outsetaApi.createPersonWithAccount(
          {
            email: savedUser.email,
            firstName: savedUser.firstName,
            lastName: savedUser.lastName,
            phone: savedUser.phone,
          },
          {
            outsetaAccountId: company.outsetaAccountId,
          }
        );

        // If successful, store Outseta Person ID and sync custom properties
        if (outsetaResult?.success && outsetaResult.personId) {
          await User.findByIdAndUpdate(savedUser._id, {
            outsetaPersonId: outsetaResult.personId,
          });

          console.log(
            `✅ User created in Outseta: ${savedUser.email} [${outsetaResult.personId}]`
          );

          // 🆕 SYNC CUSTOM PROPERTIES TO OUTSETA PERSON
          try {
            console.log(
              `🔄 Syncing custom properties to Outseta person: ${savedUser.email}`
            );

            const instanceUrl = `https://${company.subdomain}.${Config.domain}`;

            const personUpdateData = {
              // These should match the System Names in your Outseta custom properties
              MongoUserId: savedUser._id.toString(), // MongoDB User ID
              MongoCompanyId: company._id.toString(), // MongoDB Company ID
              UserRole:
                level === "standard"
                  ? "Standard User"
                  : level === "admin"
                  ? "Admin"
                  : level === "manager"
                  ? "Group Manager"
                  : "User", // Role in your platform
              ActivationStatus: "pending", // Current activation status
              InstanceUrl: instanceUrl, // Direct link to their instance
              Subdomain: company.subdomain,
              CreatedVia: "admin_invitation",
              InvitedBy: req.user ? req.user.email : "system",
              InvitedAt: new Date().toISOString(),
            };

            const updateResult = await outsetaApi.updatePerson(
              outsetaResult.personId,
              personUpdateData
            );

            if (updateResult?.success) {
              console.log(
                `✅ Custom properties synced to Outseta: ${savedUser.email}`
              );
              outsetaResult.customPropertiesSynced = true;
            } else {
              console.warn(
                `⚠️ Custom properties sync failed:`,
                updateResult?.error
              );
              outsetaResult.customPropertiesSynced = false;
              outsetaResult.customPropertiesError = updateResult?.error;
            }
          } catch (customPropsError) {
            console.error(
              `❌ Failed to sync custom properties:`,
              customPropsError
            );
            outsetaResult.customPropertiesSynced = false;
            outsetaResult.customPropertiesError = customPropsError.message;
          }
        } else {
          console.warn(
            `⚠️ Outseta person creation failed:`,
            outsetaResult?.error
          );
        }
      } catch (outsetaError) {
        console.error(
          "❌ Outseta sync failed for user creation:",
          outsetaError
        );
        outsetaResult = {
          success: false,
          error: outsetaError.message,
          customPropertiesSynced: false,
        };
        // Continue with user creation even if Outseta fails
      }
    } else {
      console.log("Outseta not configured - skipping person creation");
      outsetaResult = {
        success: false,
        reason: "not_configured",
        customPropertiesSynced: false,
      };
    }

    // Activation link
    const activationLink = `https://${company.subdomain}.${Config.domain}/activate/${activationTokenRaw}`;

    // Email invitation
    // Create email entry with company context
    const emailEntry = new Email({
      companyId: companyId,
      from: Config.nodemailer.from,
      to: email,
      subject: `${company.name}: Activate Your ${
        Config.appTitle || Config.appName
      } Account`,
      html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <!-- Preview text for inbox snippet -->
      <span style="display:none; font-size:1px; color:#fff; max-height:0; max-width:0; opacity:0; overflow:hidden;">
        Activate your ${company.name} account on ${
        Config.appTitle || Config.appName
      }. This link expires in 7 days.
      </span>

      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #1976d2; margin: 0;">${company.name}</h1>
        <p style="color: #666; margin: 5px 0 0 0; font-size: 14px;">Powered by ${
          Config.appTitle || Config.appName
        }</p>
      </div>
      
      <h2 style="color: #333; margin-bottom: 20px;">Welcome to ${
        company.name
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
           aria-label="Activate your ${company.name} account"
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
        This email was sent by ${company.name} via <a href="https://${
        Config.domain
      }" style="color:#1976d2;">${Config.appTitle || Config.appName}</a>.
      </p>
    </div>
  `,
    });

    await emailEntry.save();

    // SMS invitation (optional)
    if (Config.smsEnabled && twilioClient && phone) {
      try {
        await twilioClient.messages.create({
          from: Config.twilio.fromNumber,
          to: phone,
          body: `Hello ${firstName}, you've been invited to join ${
            company.name
          } on ${
            Config.appTitle || Config.appName
          }. Activate your account here: ${activationLink}`,
        });
      } catch (smsErr) {
        console.error("SMS send failed:", smsErr.message);
      }
    }

    // Clean response
    const userResponse = savedUser.toObject();
    delete userResponse.activationToken;
    delete userResponse.tokenExpiry;

    res.status(200).json({
      status: "success",
      message: `User ${username} created successfully. Invitation sent.`,
      user: userResponse,
      companyUrl: `https://${company.subdomain}.${Config.domain}`,
      expiresIn: "7 days",
      activationLink: activationLink,
      outseta: outsetaResult
        ? {
            synced: outsetaResult.success,
            personId: outsetaResult.personId || null,
            error: outsetaResult.error || null,
          }
        : { synced: false, reason: "not_configured" },
    });
  } catch (err) {
    console.error("Error creating user:", err);
    res.status(500).json({
      status: "error",
      error: "SERVER_ERROR",
      message: "An error occurred while creating the user.",
    });
  }
};
