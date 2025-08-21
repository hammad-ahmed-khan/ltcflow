const sendMail = require("../utils/sendMail");
const Config = require("../../config");
const validator = require("validator");

module.exports = async (req, res) => {
  try {
    const { email } = req.fields;

    if (!email || !validator.isEmail(email)) {
      return res.status(400).json({ error: "Valid email address required" });
    }

    console.log("🧪 Testing SMTP configuration...");
    console.log("📧 From:", Config.nodemailer.from);
    console.log("📧 To:", email);
    console.log("🔧 SMTP Config:", {
      service: Config.nodemailerTransport.service,
      host: Config.nodemailerTransport.host,
      port: Config.nodemailerTransport.port,
      secure: Config.nodemailerTransport.secure,
      user: Config.nodemailerTransport.auth.user,
      pass: Config.nodemailerTransport.auth.pass
        ? "***configured***"
        : "NOT SET",
    });

    // Send email immediately (bypass queue)
    const result = await sendMail({
      from: Config.nodemailer.from,
      to: email,
      subject: "🧪 Direct SMTP Test - Bypass Queue",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #28a745;">✅ SMTP Test Successful!</h1>
          <p>This email was sent <strong>directly via SMTP</strong> (bypassing the queue system).</p>
          <p><strong>Sent at:</strong> ${new Date().toLocaleString()}</p>
          <p><strong>From:</strong> ${Config.nodemailer.from}</p>
          <p><strong>SMTP Host:</strong> ${Config.nodemailerTransport.host}</p>
          <p><strong>Port:</strong> ${Config.nodemailerTransport.port}</p>
          <hr>
          <p style="color: #666; font-size: 12px;">
            If you received this email, your SMTP configuration is working correctly!
          </p>
        </div>
      `,
    });

    console.log("✅ Direct email sent successfully!");
    console.log("📬 Message ID:", result?.messageId);

    res.status(200).json({
      status: "success",
      message: "Email sent directly via SMTP (bypassing queue)",
      details: {
        messageId: result?.messageId,
        to: email,
        from: Config.nodemailer.from,
        sentAt: new Date(),
        smtpHost: Config.nodemailerTransport.host,
        smtpPort: Config.nodemailerTransport.port,
      },
    });
  } catch (error) {
    console.error("❌ SMTP sending failed:", error);

    // Detailed error logging
    if (error.code) console.error("Error Code:", error.code);
    if (error.command) console.error("SMTP Command:", error.command);
    if (error.response) console.error("SMTP Response:", error.response);

    res.status(500).json({
      status: "error",
      message: "SMTP sending failed",
      error: error.message,
      code: error.code,
      command: error.command,
      response: error.response,
    });
  }
};
