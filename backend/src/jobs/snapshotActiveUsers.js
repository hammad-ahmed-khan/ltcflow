const MonthlyActiveUser = require("../models/MonthlyActiveUser");
const User = require("../models/User"); // adjust path as needed
const dayjs = require("dayjs");

/**
 * Snapshot all active users at the start of each month
 * This job should run on the 1st of every month at 00:05
 */
async function snapshotActiveUsers() {
  try {
    const currentMonth = dayjs().format("YYYY-MM");
    const startTime = new Date();

    console.log(`📊 Starting monthly snapshot for ${currentMonth}...`);

    // 🔥 FIX: Get all user fields needed for MonthlyActiveUser
    const activeUsers = await User.find({
      status: "active",
    }).select(
      "_id companyId level email firstName lastName activatedAt status createdAt"
    );

    if (activeUsers.length === 0) {
      console.log(`ℹ️ No active users found for ${currentMonth}`);
      return;
    }

    // Check for existing records first
    const existingUserIds = await MonthlyActiveUser.find({
      month: currentMonth, // 🔥 FIX: Filter by month, not companyId
      userId: { $in: activeUsers.map((user) => user._id) }, // 🔥 FIX: Filter by userId
    }).distinct("userId");

    // Filter out users that already exist
    const newUsers = activeUsers.filter(
      (user) =>
        !existingUserIds.some(
          (existingId) => existingId.toString() === user._id.toString()
        )
    );

    console.log(
      `Found ${existingUserIds.length} existing records, inserting ${newUsers.length} new records`
    );

    let result = { insertedCount: 0 }; // 🔥 FIX: Initialize result

    // Prepare bulk operations only for new users
    const bulkOps = newUsers.map((user) => ({
      insertOne: {
        document: {
          companyId: user.companyId,
          userId: user._id,
          month: currentMonth,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          level: user.level,
          userStatus: user.status,
          source: "monthly_snapshot",
          activatedAt: user.activatedAt || user.createdAt || new Date(),
          deactivatedAt: null, // 🔥 FIX: Add missing field
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
    }));

    // Only run bulk operation if there are new users to insert
    if (bulkOps.length > 0) {
      result = await MonthlyActiveUser.bulkWrite(bulkOps);
    }

    const executionTime = new Date() - startTime;

    console.log(`✅ Monthly snapshot completed for ${currentMonth}`);
    console.log(`📊 Stats:`);
    console.log(`   👥 Total active users processed: ${activeUsers.length}`);
    console.log(`   ➕ New records inserted: ${result.insertedCount || 0}`); // 🔥 FIX: Use correct property
    console.log(`   📋 Existing records found: ${existingUserIds.length}`); // 🔥 FIX: Use correct count
    console.log(`   ⏱️ Execution time: ${executionTime}ms`);

    return {
      success: true,
      month: currentMonth,
      totalUsers: activeUsers.length,
      newRecords: result.insertedCount || 0, // 🔥 FIX: Use correct property
      existingRecords: existingUserIds.length, // 🔥 FIX: Use correct count
      executionTime,
    };
  } catch (error) {
    console.error(`❌ Error in monthly snapshot:`, error);

    // You might want to send an alert here (email, Slack, etc.)
    // await sendAlertToAdmin('Monthly Snapshot Failed', error.message);

    throw error;
  }
}

/**
 * Get company breakdown for the current month
 */
async function getCompanyBreakdown(month) {
  try {
    return await MonthlyActiveUser.getAllMonthlyStats(month);
  } catch (error) {
    console.error("Error getting company breakdown:", error);
    return [];
  }
}

/**
 * Get monthly stats for a specific company
 */
async function getCompanyMonthlyStats(companyId, month = null) {
  try {
    const targetMonth = month || dayjs().format("YYYY-MM");
    const mongoose = require("mongoose"); // 🔥 FIX: Add missing require

    const stats = await MonthlyActiveUser.aggregate([
      {
        $match: {
          companyId: new mongoose.Types.ObjectId(companyId), // 🔥 FIX: Use 'new' keyword
          month: targetMonth,
        },
      },
      {
        $group: {
          _id: null,
          totalUsers: { $sum: 1 },
          userLevels: { $push: "$level" }, // 🔥 FIX: Use correct field name
          sources: { $push: "$source" },
        },
      },
      {
        $project: {
          _id: 0,
          totalUsers: 1,
          breakdown: {
            byLevel: {
              user: {
                $size: {
                  $filter: {
                    input: "$userLevels",
                    cond: { $eq: ["$$this", "user"] },
                  },
                },
              },
              manager: {
                $size: {
                  $filter: {
                    input: "$userLevels",
                    cond: { $eq: ["$$this", "manager"] },
                  },
                },
              },
              admin: {
                $size: {
                  $filter: {
                    input: "$userLevels",
                    cond: { $eq: ["$$this", "admin"] },
                  },
                },
              },
              root: {
                $size: {
                  $filter: {
                    input: "$userLevels",
                    cond: { $eq: ["$$this", "root"] },
                  },
                },
              },
            },
            bySource: {
              monthly_snapshot: {
                $size: {
                  $filter: {
                    input: "$sources",
                    cond: { $eq: ["$$this", "monthly_snapshot"] },
                  },
                },
              },
              user_activation: {
                $size: {
                  $filter: {
                    input: "$sources",
                    cond: { $eq: ["$$this", "user_activation"] },
                  },
                },
              },
            },
          },
        },
      },
    ]);

    return stats.length > 0 ? stats[0] : { totalUsers: 0, breakdown: {} };
  } catch (error) {
    console.error("Error getting company monthly stats:", error);
    throw error;
  }
}

module.exports = {
  snapshotActiveUsers,
  getCompanyBreakdown,
  getCompanyMonthlyStats,
};
