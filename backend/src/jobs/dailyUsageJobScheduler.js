const cron = require("node-cron");
const outsetaApi = require("../services/outsetaApi");
const Company = require("../models/Company");
const MonthlyActiveUser = require("../models/MonthlyActiveUser");
const dayjs = require("dayjs");

// Configuration - Base user limit (users included in the base plan)
const BASE_USER_LIMIT = parseInt(process.env.BASE_USER_LIMIT) || 20;

class DailyUsageJobScheduler {
  constructor() {
    this.job = null;
    this.isRunning = false;
  }

  start() {
    if (this.isRunning) {
      //console.log("⚠️ Daily usage job scheduler is already running");
      return;
    }

    try {
      // Schedule to run every day at midnight
      // Cron pattern: '0 0 * * *' means:
      // - 0: minute 0
      // - 0: hour 0 (midnight)
      // - *: any day
      // - *: any month
      // - *: any day of week

      this.job = cron.schedule(
        "* * * * *",
        async () => {
          //console.log("🌙 [Outseta Cron] Starting daily usage recording...");

          try {
            const result = await this.recordDailyUsage();
            //console.log(
            //  "✅ [Outseta Cron] Daily usage recording completed:",
            //  result
            //);

            // Optional: Send success notification
            // await this.sendSuccessNotification(result);
          } catch (error) {
            console.error("❌ [Outseta Cron] Error:", error.message);

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
      //console.log("✅ Daily usage job scheduled for midnight every day (UTC)");
      //console.log(`ℹ️ Base user limit set to: ${BASE_USER_LIMIT} users`);
    } catch (error) {
      console.error("❌ Error starting daily usage job scheduler:", error);
      throw error;
    }
  }

  stop() {
    if (this.job) {
      this.job.stop();
      this.isRunning = false;
      //console.log("⏹️ Daily usage job stopped");
    }
  }

  // Extract the main logic into a separate method
  async recordDailyUsage() {
    try {
      // 1️⃣ Fetch all companies that have an Outseta account ID
      const companies = await Company.find({
        outsetaAccountId: { $exists: true },
      });

      const currentMonth = dayjs().format("YYYY-MM");
      //console.log("📅 Current month:", currentMonth);
      //console.log(
      //  `ℹ️ Base user limit: ${BASE_USER_LIMIT} users (included in base plan)`
      //);

      const results = [];

      for (const company of companies) {
        // 2️⃣ Get detailed stats for current month
        const detailedStats = await MonthlyActiveUser.getDetailedMonthlyStats(
          company._id,
          currentMonth
        );

        if (
          detailedStats &&
          typeof detailedStats === "object" &&
          Object.keys(detailedStats).length !== 0
        ) {
          const activeUsersCount = detailedStats.activeRecords || 0;

          // 🆕 NEW: Calculate billable usage (active users above base limit)
          // Only count users above the BASE_USER_LIMIT as billable usage
          const billableUsage = Math.max(0, activeUsersCount - BASE_USER_LIMIT);

          //console.log(
          //  `📊 [${company.name}] Active users: ${activeUsersCount}, Base limit: ${BASE_USER_LIMIT}, Billable usage: ${billableUsage}`
          //);

          // 3️⃣ Record usage to Outseta (only billable usage above base limit)
          const result = await outsetaApi.recordUsage(
            company.outsetaAccountId,
            billableUsage,
            `Daily usage record for ${company.name} — ${activeUsersCount} total active users (${billableUsage} billable above ${BASE_USER_LIMIT} base limit)`
          );

          if (result.success) {
            //console.log(
            //  `✅ [Outseta Cron] Usage recorded for ${company.name}: ${billableUsage} billable users`
            //);
            results.push({
              company: company.name,
              activeUsers: activeUsersCount,
              baseLimit: BASE_USER_LIMIT,
              billableUsage: billableUsage,
              success: true,
            });
          } else {
            console.warn(
              `⚠️ [Outseta Cron] Failed for ${company.name}: ${result.error}`
            );
            results.push({
              company: company.name,
              activeUsers: activeUsersCount,
              baseLimit: BASE_USER_LIMIT,
              billableUsage: billableUsage,
              success: false,
              error: result.error,
            });
          }
        } else {
          //console.log(
          //  `ℹ️ [Outseta Cron] No detailed stats for ${company.name} this month`
          //);
          results.push({
            company: company.name,
            baseLimit: BASE_USER_LIMIT,
            success: false,
            error: "No detailed stats available",
          });
        }
      }

      // 📈 Calculate summary statistics
      const successfulResults = results.filter((r) => r.success);
      const totalActiveUsers = successfulResults.reduce(
        (sum, r) => sum + (r.activeUsers || 0),
        0
      );
      const totalBillableUsage = successfulResults.reduce(
        (sum, r) => sum + (r.billableUsage || 0),
        0
      );

      const summary = {
        processedCompanies: companies.length,
        results: results,
        successCount: results.filter((r) => r.success).length,
        failureCount: results.filter((r) => !r.success).length,
        totalActiveUsers: totalActiveUsers,
        totalBillableUsage: totalBillableUsage,
        baseUserLimit: BASE_USER_LIMIT,
      };

      //console.log(
      //  `📊 [Outseta Cron] Summary: ${totalActiveUsers} total active users, ${totalBillableUsage} billable users above ${BASE_USER_LIMIT} base limit`
      //);

      return summary;
    } catch (error) {
      console.error(
        "❌ [Outseta Cron] Error in recordDailyUsage:",
        error.message
      );
      throw error;
    }
  }

  // Manual trigger for testing
  async triggerNow() {
    try {
      //console.log("🔄 Manually triggering daily usage recording...");
      const result = await this.recordDailyUsage();
      //console.log("✅ Manual usage recording completed:", result);
      return result;
    } catch (error) {
      console.error("❌ Manual usage recording failed:", error);
      throw error;
    }
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      nextRun: this.job ? "Every day at midnight UTC" : "Not scheduled",
      baseUserLimit: BASE_USER_LIMIT,
    };
  }

  // Optional: Add notification methods
  async sendSuccessNotification(result) {
    // Implement your notification logic here
    // Examples: email, Slack, Discord, etc.
    //console.log("📧 Success notification would be sent here:", result);
  }

  async sendFailureAlert(error) {
    // Implement your alert logic here
    // Examples: email, Slack, PagerDuty, etc.
    //console.log("🚨 Failure alert would be sent here:", error.message);
  }
}

// Export singleton instance
module.exports = new DailyUsageJobScheduler();
