require("colors");

console.log(`${"Honeyside".yellow} © ${"2022".yellow}`);
console.log(`Welcome to ${"Clover".cyan}`);

const express = require("express");
const app = express();
const http = require("http");
const io = require("socket.io");
const store = require("./src/store");
const init = require("./src/init");
const mediasoup = require("./src/mediasoup");

// 🔥 NEW: Import job schedulers
const monthlyJobScheduler = require("./src/jobs/monthlyJobScheduler");
const dailyUsageJobScheduler = require("./src/jobs/dailyUsageJobScheduler");

Config = require("./config");
if (Config.ip) Config.mediasoup.webRtcTransport.listenIps[0].ip = Config.ip;

app.use((req, res, next) =>
  store.connected ? next() : res.status(500).send("Database not available.")
);

app.use(express.static(`${__dirname}/../frontend/dist`));
app.use("/login", express.static(`${__dirname}/../frontend/dist`));
app.use("/login/*", express.static(`${__dirname}/../frontend/dist`));
app.use("/admin", express.static(`${__dirname}/../frontend/dist`));
app.use("/room/*", express.static(`${__dirname}/../frontend/dist`));
app.use("/meeting/*", express.static(`${__dirname}/../frontend/dist`));
app.use("/activate/*", express.static(`${__dirname}/../frontend/dist`));
app.use("/onboarding", express.static(`${__dirname}/../frontend/dist`));
app.use("/onboarding/*", express.static(`${__dirname}/../frontend/dist`));

const server = http.createServer(app);
store.app = app;
store.config = Config;
store.io = io(server);
init();
mediasoup.init();

const listen = () =>
  server.listen(Config.port, () => {
    console.log(`Server listening on port ${Config.port}`.green);

    // 🔥 NEW: Start job schedulers after server starts
    try {
      monthlyJobScheduler.start();
      console.log("📅 Monthly active users job scheduler started".green);

      dailyUsageJobScheduler.start();
      console.log("📅 Daily Outseta usage job scheduler started".green);
    } catch (error) {
      console.error("❌ Failed to start job schedulers:".red, error);
    }
  });

server.on("error", (e) => {
  if (e.code === "EADDRINUSE") {
    console.log("Specified port unavailable, retrying in 10 seconds...".red);
    setTimeout(() => {
      server.close();
      server.listen(Config.port);
    }, Config.retryAfter);
  }
});

listen();

let scheduler;
let schedulerDone = false;

const schedule = require("node-schedule");
const Email = require("./src/models/Email");
const sendMail = require("./src/utils/sendMail");

// Existing email cron job
if (Config.nodemailerEnabled) {
  if (!scheduler)
    scheduler = schedule.scheduleJob("*/5 * * * * *", async () => {
      if (schedulerDone) {
        return;
      } else {
        schedulerDone = true;
      }

      // Mailer cron job
      const emails = await Email.find({ sent: false });

      for (let email of emails) {
        try {
          const html = `${email.html}`;
          await sendMail({
            from: email.from,
            to: email.to,
            subject: email.subject,
            html,
          });
          const entry = await Email.findById(email._id);
          entry.sent = true;
          entry.dateSent = Date.now();
          await entry.save();
        } catch (e) {
          console.log(e);
        }
      }

      schedulerDone = false;
    });
}

// 🔥 NEW: Graceful shutdown handlers for job schedulers
process.on("SIGTERM", () => {
  console.log("👋 SIGTERM received, shutting down gracefully...".yellow);
  try {
    monthlyJobScheduler.stop();
    dailyUsageJobScheduler.stop();
    console.log("✅ Job schedulers stopped successfully".green);
  } catch (error) {
    console.error("❌ Error stopping job schedulers:".red, error);
  }
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("👋 SIGINT received, shutting down gracefully...".yellow);
  try {
    monthlyJobScheduler.stop();
    dailyUsageJobScheduler.stop();
    console.log("✅ Job schedulers stopped successfully".green);
  } catch (error) {
    console.error("❌ Error stopping job schedulers:".red, error);
  }
  process.exit(0);
});
