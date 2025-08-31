// backend/src/routes/outseta-webhook.js
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const Company = require("../models/Company");
const User = require("../models/User");
const Email = require("../models/Email");
const Config = require("../../config");

const generateSubdomain = (companyName, maxLength = 30) => {
  if (!companyName) return "";

  // Normalize accents: é -> e, ü -> u, etc.
  let subdomain = companyName.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // Convert to lowercase
  subdomain = subdomain.toLowerCase();

  // Replace spaces & invalid chars with hyphen
  subdomain = subdomain.replace(/[^a-z0-9]+/g, "");

  // Remove starting/ending hyphens
  subdomain = subdomain.replace(/^-+|-+$/g, "");

  // Remove consecutive hyphens
  subdomain = subdomain.replace(/-+/g, "-");

  // Truncate to maxLength
  if (subdomain.length > maxLength) {
    subdomain = subdomain.slice(0, maxLength);

    // Ensure it does not end with a hyphen
    subdomain = subdomain.replace(/-+$/g, "");
  }

  // Optional: append short random string to avoid duplicates
  //const randomSuffix = Math.random().toString(36).substring(2, 5);
  //subdomain = `${subdomain}-${randomSuffix}`;

  return subdomain;
};

const isValidOutsetaSignature = (
  signature = "",
  bodyAsString = "",
  keyHex = ""
) => {
  // Decode the webhook secret from hex to buffer
  const key = Buffer.from(keyHex, "hex");

  // Convert the body to buffer
  const payload = Buffer.from(bodyAsString, "utf8");

  // Calculate HMAC SHA256
  const calculated = crypto
    .createHmac("sha256", key)
    .update(payload)
    .digest("hex");

  // Log both signatures for debugging
  console.log("Expected signature (header):", signature);
  console.log("Calculated signature:", `sha256=${calculated}`);

  // Compare with the signature header
  return signature === `sha256=${calculated}`;
};

// Middleware for Express
const verifyOutsetaSignature = (req, res, next) => {
  try {
    const signature = req.headers["x-hub-signature-256"];
    if (!signature) {
      return res.status(400).json({ error: "Missing signature header" });
    }

    // Use the raw webhook secret directly, should already be hex
    const webhookKey = Config.outseta?.webhookSecret;

    if (!isValidOutsetaSignature(signature, req.rawBody, webhookKey)) {
      console.log("Invalid signature");
      return res.status(401).json({ error: "Invalid signature" });
    }

    console.log("Signature verified");
    next();
  } catch (error) {
    console.error("Signature verification error:", error);
    return res.status(401).json({ error: "Signature verification failed" });
  }
};

// Main webhook handler that works with formidable
const handleWebhook = async (req, res) => {
  try {
    // With formidable middleware, JSON data is in req.fields, not req.body
    const payload = req.body || {};

    console.log("Received webhook payload:", JSON.stringify(payload, null, 2));

    // Handle direct Account object payload
    if (payload.Uid && payload.Name && payload._objectType === "Account") {
      // Check if company already exists
      const existing = await Company.findOne({ outsetaAccountId: payload.Uid });
      if (existing) {
        console.log(`Company already exists: ${payload.Uid}`);
        return res.status(200).json({
          status: "success",
          message: "Company already exists",
        });
      }

      // Parse PersonAccount if it's a string (formidable sometimes stringifies nested objects)
      let personAccountArray = payload.PersonAccount;
      if (typeof personAccountArray === "string") {
        try {
          personAccountArray = JSON.parse(personAccountArray);
        } catch (e) {
          console.error("Failed to parse PersonAccount:", e);
        }
      }

      // Get primary person from PersonAccount array
      const primaryPersonAccount = personAccountArray?.find?.(
        (pa) => pa.IsPrimary
      );
      if (!primaryPersonAccount?.Person?.Email) {
        return res
          .status(400)
          .json({ error: "Primary person not found in payload" });
      }

      const person = primaryPersonAccount.Person;

      // Generate unique subdomain
      let subdomain = generateSubdomain(payload.Name);

      if (!subdomain) subdomain = "company";

      // Check for subdomain conflicts
      let counter = 1;
      let finalSubdomain = subdomain;
      while (await Company.findOne({ subdomain: finalSubdomain })) {
        finalSubdomain = `${subdomain}${counter}`;
        counter++;
        if (counter > 100) {
          finalSubdomain = `${subdomain}${Date.now()}`;
          break;
        }
      }

      // Create company
      const company = new Company({
        name: payload.Name,
        subdomain: finalSubdomain,
        outsetaAccountId: payload.Uid,
        email: person.Email,
      });

      await company.save();
      console.log(`Company created: ${company.name} (${finalSubdomain})`);

      // Create admin user
      const baseUsername = `${person.FirstName || "Admin"}${
        person.LastName || "User"
      }`;

      // Convert to lowercase, remove non-alphanumeric, and truncate to 15 chars
      const username =
        baseUsername
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "")
          .substring(0, 30) || "admin";

      // Generate activation token
      const activationTokenRaw = crypto.randomBytes(32).toString("hex");
      const activationTokenHashed = await bcrypt.hash(activationTokenRaw, 10);
      const tokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const user = new User({
        username,
        email: person.Email,
        firstName: person.FirstName || "Admin",
        lastName: person.LastName || "User",
        phone: person.PhoneMobile || person.PhoneWork || "",
        level: "root",
        companyId: company._id,
        status: "pending",
        outsetaPersonId: person.Uid,
        activationToken: activationTokenHashed,
        tokenExpiry,
      });

      await user.save();
      console.log(`Admin user created: ${user.email}`);

      // Create welcome email
      const activationLink = `https://${company.subdomain}.${Config.domain}/activate/${activationTokenRaw}`;
      const instanceUrl = `https://${company.subdomain}.${Config.domain}`;

      const welcomeEmail = new Email({
        companyId: company._id,
        from: Config.nodemailer.from,
        to: user.email,
        subject: `Welcome to ${
          Config.appTitle || Config.appName
        } - Your Team Communication Platform is Ready`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Welcome to ${Config.appTitle || Config.appName}</title>
          </head>
          <body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif;">
            <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f4f4f4; min-height: 100vh;">
              <tr>
                <td align="center" style="padding: 40px 20px;">
                  <table cellpadding="0" cellspacing="0" border="0" width="600" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                    
                    <!-- Header -->
                    <tr>
                      <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center; border-radius: 8px 8px 0 0;">
                        <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">${
                          Config.appTitle || Config.appName
                        }</h1>
                        <p style="color: #ffffff; margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Professional Team Communication Platform</p>
                      </td>
                    </tr>
                    
                    <!-- Main Content -->
                    <tr>
                      <td style="padding: 40px 30px;">
                        <h2 style="color: #333333; margin: 0 0 20px 0; font-size: 24px; font-weight: 600;">Welcome to ${
                          Config.appTitle || Config.appName
                        }, ${user.firstName}!</h2>
                        
                        <p style="color: #555555; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                          Congratulations! Your team communication platform for <strong>${
                            company.name
                          }</strong> has been successfully set up and is ready to use.
                        </p>

                        <p style="color: #555555; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                          As the administrator, you now have access to a complete suite of collaboration tools designed to enhance your team's productivity and communication.
                        </p>

                        <!-- Instance URL Section -->
                        <div style="background-color: #f8f9ff; border: 2px solid #667eea; border-radius: 8px; padding: 25px; margin: 30px 0;">
                          <h3 style="color: #667eea; margin: 0 0 15px 0; font-size: 18px; font-weight: 600;">Your Private Instance</h3>
                          <p style="color: #555555; font-size: 16px; margin: 0 0 15px 0;">Access your team's dedicated communication hub:</p>
                          <div style="background-color: #ffffff; border: 1px solid #e0e0e0; border-radius: 4px; padding: 15px; text-align: center;">
                            <a href="${instanceUrl}" style="color: #667eea; text-decoration: none; font-size: 18px; font-weight: 500; display: block;">${instanceUrl}</a>
                          </div>
                          <p style="color: #777777; font-size: 14px; margin: 15px 0 0 0;">Bookmark this link for quick access to your team workspace.</p>
                        </div>

                        <!-- Activation Section -->
                        <div style="background-color: #fff8e1; border: 2px solid #ffa726; border-radius: 8px; padding: 25px; margin: 30px 0;">
                          <h3 style="color: #e65100; margin: 0 0 15px 0; font-size: 18px; font-weight: 600;">Activate Your Administrator Account</h3>
                          <p style="color: #555555; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                            To get started, please activate your administrator account by clicking the button below. This will allow you to set your password and access all administrative features.
                          </p>
                          
                          <div style="text-align: center; margin: 25px 0;">
                            <a href="${activationLink}" 
                               style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                                      color: #ffffff; 
                                      text-decoration: none; 
                                      padding: 15px 40px; 
                                      border-radius: 6px; 
                                      font-size: 16px; 
                                      font-weight: 600; 
                                      display: inline-block;
                                      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
                                      transition: all 0.3s ease;">
                              Activate Administrator Account
                            </a>
                          </div>

                          <div style="background-color: #ffffff; border-left: 4px solid #ffa726; padding: 15px; margin: 20px 0;">
                            <p style="color: #e65100; font-size: 14px; margin: 0; font-weight: 500;">Important Security Notice:</p>
                            <p style="color: #555555; font-size: 14px; margin: 5px 0 0 0;">This activation link expires in 7 days for security purposes. If you need a new link, please contact support.</p>
                          </div>
                        </div>

                        <!-- Features Overview -->
                        <div style="margin: 30px 0;">
                          <h3 style="color: #333333; margin: 0 0 20px 0; font-size: 18px; font-weight: 600;">What You Can Do Next</h3>
                          <table cellpadding="0" cellspacing="0" border="0" width="100%">
                            <tr>
                              <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0;">
                                <strong style="color: #333333;">1. Complete Account Setup</strong><br>
                                <span style="color: #666666; font-size: 14px;">Activate your account and set up your admin profile</span>
                              </td>
                            </tr>
                            <tr>
                              <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0;">
                                <strong style="color: #333333;">2. Invite Your Team</strong><br>
                                <span style="color: #666666; font-size: 14px;">Add team members and assign appropriate roles and permissions</span>
                              </td>
                            </tr>
                            <tr>
                              <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0;">
                                <strong style="color: #333333;">3. Create Communication Channels</strong><br>
                                <span style="color: #666666; font-size: 14px;">Set up group chats, project channels, and meeting rooms</span>
                              </td>
                            </tr>
                            <tr>
                              <td style="padding: 12px 0;">
                                <strong style="color: #333333;">4. Explore Features</strong><br>
                                <span style="color: #666666; font-size: 14px;">Discover video conferencing, screen sharing, and collaboration tools</span>
                              </td>
                            </tr>
                          </table>
                        </div>

                        <!-- Support Section -->
                        <div style="background-color: #f8f9fa; border-radius: 6px; padding: 20px; margin: 30px 0;">
                          <h3 style="color: #333333; margin: 0 0 15px 0; font-size: 16px; font-weight: 600;">Need Assistance?</h3>
                          <p style="color: #666666; font-size: 14px; line-height: 1.5; margin: 0;">
                            Our support team is here to help you get the most out of ${
                              Config.appTitle || Config.appName
                            }. 
                            If you have questions about setup, user management, or any features, don't hesitate to reach out.
                          </p>
                        </div>
                      </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                      <td style="background-color: #f8f9fa; padding: 30px; text-align: center; border-radius: 0 0 8px 8px;">
                        <p style="color: #999999; font-size: 12px; margin: 0 0 10px 0;">
                          This email was sent because you registered for ${
                            Config.appTitle || Config.appName
                          }
                        </p>
                        <p style="color: #999999; font-size: 12px; margin: 0;">
                          © ${new Date().getFullYear()} ${
          Config.appTitle || Config.appName
        }. All rights reserved.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
          </html>
        `,
        text: `
Welcome to ${Config.appTitle || Config.appName}, ${user.firstName}!

Congratulations! Your team communication platform for ${
          company.name
        } has been successfully set up and is ready to use.

Your Private Instance: ${instanceUrl}

To get started, please activate your administrator account:
${activationLink}

This activation link expires in 7 days for security purposes.

What You Can Do Next:
1. Complete Account Setup - Activate your account and set up your admin profile
2. Invite Your Team - Add team members and assign appropriate roles and permissions  
3. Create Communication Channels - Set up group chats, project channels, and meeting rooms
4. Explore Features - Discover video conferencing, screen sharing, and collaboration tools

Need assistance? Our support team is here to help you get the most out of ${
          Config.appTitle || Config.appName
        }.

© ${new Date().getFullYear()} ${
          Config.appTitle || Config.appName
        }. All rights reserved.
        `,
      });

      await welcomeEmail.save();
      console.log(`Welcome email queued for: ${user.email}`);

      return res.status(200).json({
        status: "success",
        message: "Company and admin user created successfully",
        company: {
          name: company.name,
          subdomain: company.subdomain,
        },
        user: {
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
        },
      });
    } else {
      console.log("Unrecognized payload format");
      return res.status(400).json({ error: "Unrecognized payload format" });
    }
  } catch (error) {
    console.error("Webhook error:", error);
    return res.status(500).json({
      error: "Webhook processing failed",
      message: error.message,
    });
  }
};

module.exports = [verifyOutsetaSignature, handleWebhook];
