const cron = require("node-cron");
const outsetaApi = require("../services/outsetaApi");
const Company = require("../models/company");
const MonthlyActiveUser = require("../models/MonthlyActiveUser");
const dayjs = require("dayjs");

// 🕛 Schedule: runs every day at midnight
cron.schedule("*/2 * * * *", async () => {
  console.log("🌙 [Outseta Cron] Starting daily usage recording...");

  try {
    // 1️⃣ Fetch all companies that have an Outseta account ID
    const companies = await Company.find({
      outsetaAccountId: { $exists: true },
    });

    const currentMonth = dayjs().format("YYYY-MM");
    console.log("📅 Current month:", currentMonth);

    for (const company of companies) {
      console.log("COMPANY:", company);

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

        // 3️⃣ Record usage to Outseta
        const result = await outsetaApi.recordUsage(
          company.outsetaAccountId,
          activeUsersCount,
          `Daily usage record for ${company.name} — ${activeUsersCount} active users`
        );

        if (result.success) {
          console.log(`✅ [Outseta Cron] Usage recorded for ${company.name}`);
        } else {
          console.warn(
            `⚠️ [Outseta Cron] Failed for ${company.name}: ${result.error}`
          );
        }
      } else {
        console.log(
          `ℹ️ [Outseta Cron] No detailed stats for ${company.name} this month`
        );
      }
    }

    console.log("✅ [Outseta Cron] Daily usage recording completed.");
  } catch (error) {
    console.error("❌ [Outseta Cron] Error:", error.message);
  }
});
