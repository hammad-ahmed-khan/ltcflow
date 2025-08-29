require("dotenv").config();
const info = require("./version.json");

module.exports = {
  appTitle: "LTC Flow",
  appVersion: info.version,
  appBuild: info.build,
  port: process.env.PORT || 4000,
  secret: process.env.AUTH_SECRET || "jwt-default-secret",
  domain: process.env.DOMAIN,
  mongo: {
    uri: process.env.MONGO_URI,
    srv: (process.env.MONGO_SRV || "").toString() === "true",
    username: process.env.MONGO_USERNAME,
    password: process.env.MONGO_PASSWORD,
    authenticationDatabase: process.env.MONGO_AUTHENTICATION_DATABASE,
    hostname: process.env.MONGO_HOSTNAME,
    port: process.env.MONGO_PORT,
    database: process.env.MONGO_DATABASE_NAME || "crumble",
  },
  dataFolder: "./data",
  rootUser: {
    username: process.env.ROOT_USER_USERNAME,
    email: process.env.ROOT_USER_EMAIL,
    password: process.env.ROOT_USER_PASSWORD,
    firstName: process.env.ROOT_USER_FIRST_NAME,
    lastName: process.env.ROOT_USER_LAST_NAME,
  },
  ipAddress: {
    ip:
      process.env.MAPPED_IP === "true"
        ? "0.0.0.0"
        : process.env.PUBLIC_IP_ADDRESS,
    announcedIp:
      process.env.MAPPED_IP === "true" ? process.env.PUBLIC_IP_ADDRESS : null,
  },

  nodemailerEnabled: true,
  nodemailer: {
    from: process.env.MAILER_FROM, // example: address@outlook.com (required)
  },

  nodemailerTransport: {
    service: process.env.MAIL_SERVICE || "",
    host: process.env.MAIL_HOST || "",
    port: parseInt(process.env.MAIL_PORT) || 587,
    secure: process.env.MAIL_SECURE === "true",
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    },
  },

  // hardcoded
  retryAfter: 10000,
  sizes: [256, 512, 1024, 2048],
  mediaCodecs: [
    {
      kind: "audio",
      mimeType: "audio/opus",
      clockRate: 48000,
      channels: 2,
    },
    {
      kind: "video",
      mimeType: "video/VP8",
      clockRate: 90000,
      parameters: { "x-google-start-bitrate": 1000 },
    },
  ],
  rtcMinPort: 10000,
  rtcMaxPort: 12000,
  mediasoupLogLevel: "warn",

  // SMS configuration
  smsEnabled: (process.env.SMS_ENABLED || "false").toString() === "true",
  sms: {
    provider: process.env.SMS_PROVIDER || "twilio", // "twilio", "aws-sns"
    defaultFrom: process.env.SMS_DEFAULT_FROM || "LTC Flow",
  },

  // Twilio configuration
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    fromNumber: process.env.TWILIO_FROM_NUMBER, // e.g., "+1234567890"
  },

  // AWS SNS configuration (if using AWS for SMS)
  aws: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION || "us-east-1",
  },

  // 🆕 NEW: OTP Configuration
  otp: {
    method: process.env.OTP_METHOD || "sms", // "email", "sms", "both"
    fallbackEnabled:
      (process.env.OTP_FALLBACK_ENABLED || "true").toString() === "true",
  },
};
