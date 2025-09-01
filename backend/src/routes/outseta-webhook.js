// backend/src/routes/outseta-webhook.js
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const Company = require("../models/Company");
const User = require("../models/User");
const Email = require("../models/Email");
const Config = require("../../config");
const outsetaApi = require("../services/outsetaApi");

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

// Main webhook handler - Fixed to prevent duplicates
const handleWebhook = async (req, res) => {
  try {
    const payload = req.body || {};

    console.log("Received webhook payload:", JSON.stringify(payload, null, 2));

    // Handle direct Account object payload
    if (payload.Uid && payload.Name && payload._objectType === "Account") {
      // Check if company already exists FIRST - this prevents duplicates
      const existing = await Company.findOne({ outsetaAccountId: payload.Uid });
      if (existing) {
        console.log(`Company already exists: ${payload.Uid}`);
        // IMMEDIATELY respond to Outseta to prevent retries
        return res.status(200).json({
          status: "success",
          message: "Company already exists",
          company: {
            name: existing.name,
            subdomain: existing.subdomain,
            id: existing._id.toString(),
          },
        });
      }

      // Parse PersonAccount if it's a string
      let personAccountArray = payload.PersonAccount;
      if (typeof personAccountArray === "string") {
        try {
          personAccountArray = JSON.parse(personAccountArray);
        } catch (e) {
          console.error("Failed to parse PersonAccount:", e);
          return res.status(400).json({
            error: "Invalid PersonAccount format",
            message: "Failed to parse PersonAccount data",
          });
        }
      }

      // Get primary person from PersonAccount array
      const primaryPersonAccount = personAccountArray?.find?.(
        (pa) => pa.IsPrimary
      );
      if (!primaryPersonAccount?.Person?.Email) {
        return res.status(400).json({
          error: "Primary person not found in payload",
        });
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

      // Generate activation token
      const activationTokenRaw = crypto.randomBytes(32).toString("hex");
      const activationTokenHashed = await bcrypt.hash(activationTokenRaw, 10);
      const tokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const activationLink = `https://${company.subdomain}.${Config.domain}/activate/${activationTokenRaw}`;
      const instanceUrl = `https://${company.subdomain}.${Config.domain}`;

      // Create admin user
      const baseUsername = `${person.FirstName || "Admin"}${
        person.LastName || "User"
      }`;
      const username =
        baseUsername
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "")
          .substring(0, 30) || "admin";

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

      // Create welcome email FIRST (most important operation)
      const welcomeEmail = new Email({
        companyId: company._id,
        from: Config.nodemailer.from,
        to: user.email,
        subject: `Welcome to ${
          Config.appTitle || Config.appName
        } — Activate & Connect Your LTC Team`,
        html: `
<!DOCTYPE html>
<html>

<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to ${Config.appTitle || Config.appName}</title>
</head>

<body style="margin:0; padding:0; background-color:#f4f4f4; font-family:Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" bgcolor="#f4f4f4" style="min-height:100vh;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table width="600"
          style="max-width:600px; background:#fff; border-radius:8px; box-shadow:0 4px 12px rgba(0,0,0,0.1);">

          <!-- Header with Logo -->
          <tr>
            <td style="background:#2f3e46; padding:40px 30px; text-align:center; border-radius:8px 8px 0 0;">
              <img src="https://ltcflow.com/wp-content/uploads/2025/08/flowlogob300.png"
                alt="LTC Flow Logo" width="180" style="display:block; margin:0 auto 20px auto;" />
              <h1 style="color:#ffffff; margin:0; font-size:28px;">${
                Config.appTitle || Config.appName
              }</h1>
              <p style="color:#ffffff; margin:8px 0 0; font-size:16px; opacity:0.9;">
                Instant Communication Built for Long-Term Care
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 30px;">
              <h2 style="color:#333333; font-size:24px; margin:0 0 20px 0;">Welcome, ${
                user.firstName
              }!</h2>
              <p style="color:#555555; font-size:16px; line-height:1.6; margin:0 0 20px;">
                Your LTC Flow platform is set up, and you're ready to transform communication in your care team.
              </p>
              <p style="color:#555555; font-size:16px; line-height:1.6; margin:0 0 30px;">
                Activate your admin account below to get started with real-time messaging, group chats, and seamless coordination—no email delays, no missed messages.
              </p>

              <!-- Activation CTA -->
              <div style="text-align:center; margin:30px 0;">
                <a href="${activationLink}"
                  style="background:#52796f; color:#ffffff; text-decoration:none; padding:15px 40px; border-radius:6px; font-size:16px; font-weight:600; display:inline-block; box-shadow:0 4px 12px rgba(82,121,111,0.3);">
                  Activate Your Administrator Account
                </a>
              </div>

              <div style="background:#fff; border-left:4px solid #ffa726; padding:15px; margin:20px 0;">
                <p style="color:#e65100; font-size:14px; font-weight:500; margin:0;">Security Notice:</p>
                <p style="color:#555555; font-size:14px; margin:5px 0 0;">
                  This link expires in 7 days. Contact support if you need a new one.
                </p>
              </div>

              <!-- Instance Info -->
              <div
                style="background:#f8f9ff; border:1px solid #e0e0e0; border-radius:6px; padding:20px; margin:30px 0;">
                <h3 style="color:#2f3e46; font-size:16px; margin:0 0 10px;">Your Workspace URL</h3>
                <p style="color:#555555; font-size:14px; margin:0 0 10px;">
                  After activation, you'll be auto-redirected here. Bookmark for quick access:
                </p>
                <a href="${instanceUrl}"
                  style="color:#2f3e46; text-decoration:none; font-size:16px; font-weight:500; display:block; text-align:center;">
                  ${instanceUrl}
                </a>
              </div>

              <!-- Next Steps -->
              <div style="margin:30px 0;">
                <h3 style="color:#333333; margin:0 0 20px 0; font-size:18px; font-weight:600;">What’s Next? Work Smarter, Together</h3>
                <table cellpadding="0" cellspacing="0" border="0" width="100%">
                  <tr>
                    <td style="padding:12px 0; border-bottom:1px solid #f0f0f0;">
                      <strong style="color:#333333;">🔑 Activate Your Account</strong><br>
                      <span style="color:#666666; font-size:14px;">Set up your admin profile to get started securely.</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:12px 0; border-bottom:1px solid #f0f0f0;">
                      <strong style="color:#333333;">👥 Invite Your Team</strong><br>
                      <span style="color:#666666; font-size:14px;">Add care givers, operational staff, and partners with appropriate roles.</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:12px 0; border-bottom:1px solid #f0f0f0;">
                      <strong style="color:#333333;">💬 Use FlowChat & Groups</strong><br>
                      <span style="color:#666666; font-size:14px;">Replace emails with secure messaging, instant work groups, and searchable chat history.</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:12px 0; border-bottom:1px solid #f0f0f0;">
                      <strong style="color:#333333;">🎥 Start FlowMeet Sessions</strong><br>
                      <span style="color:#666666; font-size:14px;">Launch instant video meetings for team coordination without extra tools.</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:12px 0;">
                      <strong style="color:#333333;">🤖 Explore FlowAssist</strong><br>
                      <span style="color:#666666; font-size:14px;">Get LTC-specific guidance on regulations, billing, and compliance.</span>
                    </td>
                  </tr>
                </table>
                <p style="color:#666666; font-size:14px; margin:15px 0 0 0;">Coming soon: FlowBridge for partners, FlowCast for broadcasts, and FlowCare for family communication.</p>
              </div>

              <!-- Support Section -->
              <div style="background-color:#f8f9fa; border-radius:6px; padding:20px; margin:30px 0;">
                <h3 style="color:#333333; margin:0 0 15px 0; font-size:16px; font-weight:600;">We’re Here to Help!</h3>
                <p style="color:#666666; font-size:14px; line-height:1.5; margin:0;">
                  Our support team is ready to assist with setup, features, or your 30-day free trial. Contact us at <a
                    href="mailto:support@ltcflow.com" style="color:#2f3e46; text-decoration:none;">support@ltcflow.com</a> or visit our <a
                    href="https://ltcflow.com/contact/" style="color:#2f3e46; text-decoration:none;">Contact Page</a>.
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8f9fa; padding:30px; text-align:center; border-radius:0 0 8px 8px;">
              <p style="color:#999999; font-size:12px; margin:0 0 10px 0;">
                You received this because you signed up for ${
                  Config.appTitle || Config.appName
                }.
              </p>
              <p style="color:#999999; font-size:12px; margin:0;">
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

Your workspace for ${company.name} has been created.

To get started, activate your administrator account:
${activationLink}

This link expires in 7 days.

After activation, you’ll be redirected to your private instance:
${instanceUrl}
(Bookmark this link for quick access later.)

Next steps:
- Invite your team and assign roles
- Create channels for projects and discussions
- Explore video conferencing, file sharing, and more

Need help? Our support team is ready to assist.

© ${new Date().getFullYear()} ${
          Config.appTitle || Config.appName
        }. All rights reserved.
  `,
      });

      await welcomeEmail.save();
      console.log(`Welcome email queued for: ${user.email}`);

      // RESPOND TO OUTSETA IMMEDIATELY - This is critical to prevent retries
      const successResponse = {
        status: "success",
        message: "Company and admin user created successfully",
        company: {
          name: company.name,
          subdomain: company.subdomain,
          id: company._id.toString(),
        },
        user: {
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          id: user._id.toString(),
        },
      };

      // Send response first
      res.status(200).json(successResponse);

      // BACKGROUND OPERATIONS - Don't await these, let them run after response
      setImmediate(async () => {
        // Sync account data to Outseta in background
        if (outsetaApi.isConfigured()) {
          try {
            console.log(
              `🔄 Background sync: Updating account in Outseta: ${payload.Uid}`
            );

            const accountUpdateData = {
              Subdomain: company.subdomain,
              InstanceUrl: instanceUrl,
              MongoCompanyId: company._id.toString(),
              SetupCompletedAt: new Date().toISOString(),
              AdminEmail: person.Email,
            };

            const updateResult = await outsetaApi.updateAccount(
              payload.Uid,
              accountUpdateData
            );
            if (updateResult?.success) {
              console.log(`✅ Background sync: Account updated in Outseta`);
            } else {
              console.warn(
                `⚠️ Background sync: Account update failed:`,
                updateResult?.error
              );
            }
          } catch (syncError) {
            console.error(
              `❌ Background sync: Account update error:`,
              syncError
            );
          }

          // Sync person data to Outseta in background
          try {
            console.log(
              `🔄 Background sync: Updating person in Outseta: ${user.email}`
            );

            const personUpdateData = {
              MongoUserId: user._id.toString(),
              MongoCompanyId: company._id.toString(),
              UserRole: "Root",
              ActivationStatus: "pending",
              InstanceUrl: instanceUrl,
              Subdomain: company.subdomain,
            };

            const personUpdateResult = await outsetaApi.updatePerson(
              user.outsetaPersonId,
              personUpdateData
            );
            if (personUpdateResult?.success) {
              console.log(`✅ Background sync: Person updated in Outseta`);
            } else {
              console.warn(
                `⚠️ Background sync: Person update failed:`,
                personUpdateResult?.error
              );
            }
          } catch (personSyncError) {
            console.error(
              `❌ Background sync: Person update error:`,
              personSyncError
            );
          }
        }
      });

      // Response already sent above
      return;
    } else {
      console.log("Unrecognized payload format");
      return res.status(400).json({
        error: "Unrecognized payload format",
        receivedObjectType: payload._objectType || "unknown",
      });
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
