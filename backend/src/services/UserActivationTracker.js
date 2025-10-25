const MonthlyActiveUser = require("../models/MonthlyActiveUser");
const dayjs = require("dayjs");

/**
 * Service for tracking user activations and adding them to monthly active users
 */
class UserActivationTracker {
  
  /**
   * Log a newly activated user to the current month's active users
   * @param {Object} user - The user object that was just activated
   * @returns {Promise<Object>} - Result of the operation
   */
  static async logUserActivation(user) {
    try {
      const month = dayjs().format("YYYY-MM");
      
      // Validate required fields
      if (!user._id || !user.companyId || !user.level) {
        throw new Error("User object missing required fields (_id, companyId, level)");
      }

      // Check if user is actually active
      if (user.status !== "active") {
        console.log(`⚠️ User ${user._id} is not active (status: ${user.status}), skipping monthly log`);
        return { success: false, reason: "User not active" };
      }

      const result = await MonthlyActiveUser.updateOne(
        { 
          companyId: user.companyId, 
          userId: user._id, 
          month 
        },
        { 
          $setOnInsert: { 
            addedAt: new Date(),
            source: "user_activation",
            userLevel: user.level,
            billable: true
          } 
        },
        { upsert: true }
      );

      if (result.upserted) {
        console.log(`✅ User ${user._id} added to monthly active users for ${month}`);
        
        // Optional: Get updated count for the company
        const monthlyCount = await MonthlyActiveUser.getMonthlyCount(user.companyId, month);
        
        return {
          success: true,
          action: "added",
          month,
          userId: user._id,
          companyId: user.companyId,
          monthlyCount
        };
      } else {
        console.log(`ℹ️ User ${user._id} already exists in monthly active users for ${month}`);
        
        return {
          success: true,
          action: "already_exists",
          month,
          userId: user._id,
          companyId: user.companyId
        };
      }

    } catch (error) {
      console.error("Error logging user activation:", error);
      throw error;
    }
  }

  /**
   * IMPORTANT: Users cannot be removed from monthly active users once added.
   * Even if a user is active for only 1 second, they remain billable for the entire month.
   * This method is kept for reference but will NOT remove users from billing.
   * 
   * @param {Object} user - The user object that was deactivated
   * @returns {Promise<Object>} - Result of the operation (no actual removal)
   */
  static async removeUserFromCurrentMonth(user) {
    try {
      const month = dayjs().format("YYYY-MM");
      
      // BUSINESS RULE: Once a user is active for any duration in a month,
      // they remain billable for that entire month. We do NOT remove them.
      
      console.log(`ℹ️ User ${user._id} deactivated but remains billable for ${month} (business rule: 1 sec = billable for full month)`);
      
      // Check if user exists in monthly actives
      const existingRecord = await MonthlyActiveUser.findOne({
        companyId: user.companyId,
        userId: user._id,
        month
      });

      if (existingRecord) {
        // Update the record to mark deactivation date but keep billable
        await MonthlyActiveUser.updateOne(
          {
            companyId: user.companyId,
            userId: user._id,
            month
          },
          {
            $set: {
              deactivatedAt: new Date(),
              // billable remains true - this is the key business rule
              billable: true
            }
          }
        );
        
        return {
          success: true,
          action: "marked_deactivated_but_still_billable",
          month,
          userId: user._id,
          companyId: user.companyId,
          message: "User remains billable for the full month per business rules"
        };
      } else {
        return {
          success: true,
          action: "user_not_in_monthly_actives",
          month,
          userId: user._id,
          companyId: user.companyId
        };
      }

    } catch (error) {
      console.error("Error processing user deactivation:", error);
      throw error;
    }
  }

  /**
   * Update user level in current month's record (if user level changes)
   * @param {Object} user - The user object with updated level
   * @returns {Promise<Object>} - Result of the operation
   */
  static async updateUserLevel(user) {
    try {
      const month = dayjs().format("YYYY-MM");
      
      const result = await MonthlyActiveUser.updateOne(
        {
          companyId: user.companyId,
          userId: user._id,
          month
        },
        {
          $set: {
            userLevel: user.level
          }
        }
      );

      if (result.matchedCount > 0) {
        console.log(`✅ User ${user._id} level updated to ${user.level} for ${month}`);
        
        return {
          success: true,
          action: "level_updated",
          month,
          userId: user._id,
          companyId: user.companyId,
          newLevel: user.level
        };
      } else {
        console.log(`ℹ️ User ${user._id} not found in monthly active users for ${month}`);
        
        return {
          success: false,
          action: "user_not_found",
          month,
          userId: user._id,
          companyId: user.companyId
        };
      }

    } catch (error) {
      console.error("Error updating user level in monthly actives:", error);
      throw error;
    }
  }

  /**
   * Mark super accounts (bots, support accounts) as non-billable
   * @param {Object} user - The super user object
   * @returns {Promise<Object>} - Result of the operation
   */
  static async markSuperAccountNonBillable(user) {
    try {
      const month = dayjs().format("YYYY-MM");
      
      const result = await MonthlyActiveUser.updateOne(
        {
          companyId: user.companyId,
          userId: user._id,
          month
        },
        {
          $set: {
            billable: false,
            source: "manual" // Indicate this was manually adjusted
          }
        }
      );

      if (result.matchedCount > 0) {
        console.log(`✅ User ${user._id} marked as non-billable for ${month}`);
        
        return {
          success: true,
          action: "marked_non_billable",
          month,
          userId: user._id,
          companyId: user.companyId
        };
      } else {
        console.log(`ℹ️ User ${user._id} not found in monthly active users for ${month}`);
        
        return {
          success: false,
          action: "user_not_found",
          month,
          userId: user._id,
          companyId: user.companyId
        };
      }

    } catch (error) {
      console.error("Error marking user as non-billable:", error);
      throw error;
    }
  }

  /**
   * Get current month's stats for a company
   * @param {String} companyId - The company ID
   * @returns {Promise<Object>} - Monthly stats
   */
  static async getCurrentMonthStats(companyId) {
    try {
      const month = dayjs().format("YYYY-MM");
      
      const totalCount = await MonthlyActiveUser.getMonthlyCount(companyId, month);
      const breakdown = await MonthlyActiveUser.getAllMonthlyStats(month);
      const companyData = breakdown.find(item => 
        item.companyId.toString() === companyId.toString()
      );

      return {
        month,
        companyId,
        totalActiveUsers: totalCount,
        breakdown: companyData ? companyData.userLevelBreakdown : {},
        companyName: companyData ? companyData.companyName : null
      };

    } catch (error) {
      console.error("Error getting current month stats:", error);
      throw error;
    }
  }
}

module.exports = UserActivationTracker;
