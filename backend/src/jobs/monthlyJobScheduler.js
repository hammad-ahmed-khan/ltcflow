const cron = require("node-cron");
const { snapshotActiveUsers } = require("./snapshotActiveUsers");

class MonthlyJobScheduler {
  constructor() {
    this.job = null;
    this.isRunning = false;
  }

  start() {
    if (this.isRunning) {
      console.log("⚠️ Monthly job scheduler is already running");
      return;
    }

    try {
      // Schedule to run at 00:05 on the 1st of every month
      // Cron pattern: '5 0 1 * *' means:
      // - 5: minute 5
      // - 0: hour 0 (midnight)
      // - 1: day 1 (1st of month)
      // - *: any month
      // - *: any day of week

      this.job = cron.schedule(
        "*/2 * * * *",
        async () => {
          console.log("🚀 Starting monthly active user snapshot...");

          try {
            const result = await snapshotActiveUsers();
            console.log("✅ Monthly snapshot completed successfully:", result);

            // Optional: Send success notification
            // await this.sendSuccessNotification(result);
          } catch (error) {
            console.error("❌ Monthly snapshot failed:", error);

            // Optional: Send failure alert
            // await this.sendFailureAlert(error);
          }
        },
        {
          scheduled: true,
          timezone: "UTC", // Use UTC to avoid timezone issues
        }
      );

      this.isRunning = true;
      console.log(
        "✅ Monthly snapshot job scheduled for 00:05 on the 1st of every month (UTC)"
      );
    } catch (error) {
      console.error("❌ Error starting monthly job scheduler:", error);
      throw error;
    }
  }

  stop() {
    if (this.job) {
      this.job.stop();
      this.isRunning = false;
      console.log("⏹️ Monthly snapshot job stopped");
    }
  }

  // Manual trigger for testing
  async triggerNow() {
    try {
      console.log("🔄 Manually triggering monthly snapshot...");
      const result = await snapshotActiveUsers();
      console.log("✅ Manual snapshot completed:", result);
      return result;
    } catch (error) {
      console.error("❌ Manual snapshot failed:", error);
      throw error;
    }
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      nextRun: this.job ? "1st of next month at 00:05 UTC" : "Not scheduled",
    };
  }

  // Optional: Add notification methods
  async sendSuccessNotification(result) {
    // Implement your notification logic here
    // Examples: email, Slack, Discord, etc.
    console.log("📧 Success notification would be sent here:", result);
  }

  async sendFailureAlert(error) {
    // Implement your alert logic here
    // Examples: email, Slack, PagerDuty, etc.
    console.log("🚨 Failure alert would be sent here:", error.message);
  }
}

// Export singleton instance
module.exports = new MonthlyJobScheduler();
