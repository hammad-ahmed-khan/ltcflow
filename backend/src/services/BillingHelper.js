const MonthlyActiveUser = require("../models/MonthlyActiveUser");
const dayjs = require("dayjs");

/**
 * Billing Helper for Outseta Integration
 *
 * This service provides functions to generate billing data for your usage-based charging
 * with Outseta, focusing on monthly active users per company.
 */
class BillingHelper {
  /**
   * Get billing data for a specific company and month
   * @param {String} companyId - The company ID
   * @param {String} month - Month in YYYY-MM format (optional, defaults to current month)
   * @returns {Promise<Object>} - Billing data for the company
   */
  static async getCompanyBillingData(companyId, month = null) {
    try {
      const targetMonth = month || dayjs().format("YYYY-MM");

      const billingData = await MonthlyActiveUser.aggregate([
        {
          $match: {
            companyId: mongoose.Types.ObjectId(companyId),
            month: targetMonth,
            billable: true,
          },
        },
        {
          $group: {
            _id: null,
            totalBillableUsers: { $sum: 1 },
            userLevels: { $push: "$userLevel" },
            sources: { $push: "$source" },
            addedDates: { $push: "$addedAt" },
          },
        },
        {
          $project: {
            _id: 0,
            companyId: companyId,
            month: targetMonth,
            totalBillableUsers: 1,
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
                monthlySnapshot: {
                  $size: {
                    $filter: {
                      input: "$sources",
                      cond: { $eq: ["$$this", "monthly_snapshot"] },
                    },
                  },
                },
                userActivation: {
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

      const result =
        billingData.length > 0
          ? billingData[0]
          : {
              companyId,
              month: targetMonth,
              totalBillableUsers: 0,
              breakdown: {
                byLevel: { user: 0, manager: 0, admin: 0, root: 0 },
                bySource: { monthlySnapshot: 0, userActivation: 0 },
              },
            };

      // Add billing calculation
      result.billing = await this.calculateBilling(
        result.totalBillableUsers,
        result.breakdown
      );

      return result;
    } catch (error) {
      console.error("Error getting company billing data:", error);
      throw error;
    }
  }

  /**
   * Get billing data for all companies for a specific month
   * @param {String} month - Month in YYYY-MM format (optional, defaults to current month)
   * @returns {Promise<Array>} - Array of billing data for all companies
   */
  static async getAllCompaniesBillingData(month = null) {
    try {
      const targetMonth = month || dayjs().format("YYYY-MM");

      const billingData = await MonthlyActiveUser.aggregate([
        {
          $match: {
            month: targetMonth,
            billable: true,
          },
        },
        {
          $group: {
            _id: "$companyId",
            totalBillableUsers: { $sum: 1 },
            userLevels: { $push: "$userLevel" },
            sources: { $push: "$source" },
          },
        },
        {
          $lookup: {
            from: "companies", // adjust collection name if needed
            localField: "_id",
            foreignField: "_id",
            as: "company",
          },
        },
        {
          $unwind: {
            path: "$company",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $project: {
            companyId: "$_id",
            companyName: "$company.name",
            companyEmail: "$company.email",
            outsetaAccountId: "$company.outsetaAccountId", // if you store Outseta IDs
            month: targetMonth,
            totalBillableUsers: 1,
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
                monthlySnapshot: {
                  $size: {
                    $filter: {
                      input: "$sources",
                      cond: { $eq: ["$$this", "monthly_snapshot"] },
                    },
                  },
                },
                userActivation: {
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
        {
          $sort: { totalBillableUsers: -1 },
        },
      ]);

      // Add billing calculations for each company
      for (let company of billingData) {
        company.billing = await this.calculateBilling(
          company.totalBillableUsers,
          company.breakdown
        );
      }

      return billingData;
    } catch (error) {
      console.error("Error getting all companies billing data:", error);
      throw error;
    }
  }

  /**
   * Calculate billing amounts based on user count and tiers
   * @param {Number} totalUsers - Total billable users
   * @param {Object} breakdown - User breakdown by level
   * @returns {Promise<Object>} - Billing calculation
   */
  static async calculateBilling(totalUsers, breakdown) {
    // Define your pricing tiers here
    // Example pricing (adjust according to your business model):
    const PRICING = {
      perUser: 10.0, // $10 per user per month
      tierMultipliers: {
        user: 1.0, // base rate
        manager: 1.5, // 1.5x rate for managers
        admin: 2.0, // 2x rate for admins
        root: 2.5, // 2.5x rate for root users
      },
      minimumCharge: 50.0, // minimum monthly charge
      discounts: {
        volume: {
          50: 0.1, // 10% discount for 50+ users
          100: 0.15, // 15% discount for 100+ users
          500: 0.2, // 20% discount for 500+ users
        },
      },
    };

    try {
      let totalAmount = 0;
      const lineItems = [];

      // Calculate amount for each user tier
      if (breakdown && breakdown.byLevel) {
        Object.entries(breakdown.byLevel).forEach(([level, count]) => {
          if (count > 0) {
            const multiplier = PRICING.tierMultipliers[level] || 1.0;
            const unitPrice = PRICING.perUser * multiplier;
            const lineTotal = unitPrice * count;

            totalAmount += lineTotal;
            lineItems.push({
              description: `${
                level.charAt(0).toUpperCase() + level.slice(1)
              } Users`,
              quantity: count,
              unitPrice: unitPrice,
              total: lineTotal,
            });
          }
        });
      } else {
        // Fallback: treat all users as basic tier
        const lineTotal = PRICING.perUser * totalUsers;
        totalAmount = lineTotal;
        lineItems.push({
          description: "Active Users",
          quantity: totalUsers,
          unitPrice: PRICING.perUser,
          total: lineTotal,
        });
      }

      // Apply volume discounts
      let discountPercentage = 0;
      let discountAmount = 0;

      if (totalUsers >= 500) {
        discountPercentage = PRICING.discounts.volume[500];
      } else if (totalUsers >= 100) {
        discountPercentage = PRICING.discounts.volume[100];
      } else if (totalUsers >= 50) {
        discountPercentage = PRICING.discounts.volume[50];
      }

      if (discountPercentage > 0) {
        discountAmount = totalAmount * discountPercentage;
        totalAmount -= discountAmount;
      }

      // Apply minimum charge
      const finalAmount = Math.max(totalAmount, PRICING.minimumCharge);
      const minimumChargeApplied =
        finalAmount === PRICING.minimumCharge &&
        totalAmount < PRICING.minimumCharge;

      return {
        lineItems,
        subtotal: totalAmount + discountAmount,
        discountPercentage: Math.round(discountPercentage * 100),
        discountAmount: Number(discountAmount.toFixed(2)),
        minimumCharge: PRICING.minimumCharge,
        minimumChargeApplied,
        totalAmount: Number(finalAmount.toFixed(2)),
        currency: "USD",
      };
    } catch (error) {
      console.error("Error calculating billing:", error);
      return {
        lineItems: [],
        subtotal: 0,
        discountAmount: 0,
        totalAmount: 0,
        currency: "USD",
        error: error.message,
      };
    }
  }

  /**
   * Generate Outseta-compatible billing data
   * @param {String} companyId - The company ID
   * @param {String} month - Month in YYYY-MM format
   * @returns {Promise<Object>} - Outseta-compatible billing data
   */
  static async generateOutsetaBillingData(companyId, month = null) {
    try {
      const billingData = await this.getCompanyBillingData(companyId, month);

      // Format for Outseta API
      const outsetaData = {
        accountId: billingData.outsetaAccountId, // You'll need to store this in your Company model
        billingPeriod: {
          month: billingData.month,
          startDate: dayjs(billingData.month + "-01")
            .startOf("month")
            .toISOString(),
          endDate: dayjs(billingData.month + "-01")
            .endOf("month")
            .toISOString(),
        },
        usage: {
          activeUsers: billingData.totalBillableUsers,
          breakdown: billingData.breakdown,
        },
        billing: billingData.billing,
        metadata: {
          generatedAt: new Date().toISOString(),
          systemSource: "LTCSync",
        },
      };

      return outsetaData;
    } catch (error) {
      console.error("Error generating Outseta billing data:", error);
      throw error;
    }
  }

  /**
   * Get billing history for a company
   * @param {String} companyId - The company ID
   * @param {Number} months - Number of months to look back (default: 12)
   * @returns {Promise<Array>} - Billing history
   */
  static async getBillingHistory(companyId, months = 12) {
    try {
      const history = [];

      for (let i = 0; i < months; i++) {
        const month = dayjs().subtract(i, "month").format("YYYY-MM");
        const billingData = await this.getCompanyBillingData(companyId, month);
        history.push(billingData);
      }

      return history.reverse(); // oldest first
    } catch (error) {
      console.error("Error getting billing history:", error);
      throw error;
    }
  }

  /**
   * Export billing data to CSV format
   * @param {Array} billingData - Array of billing data
   * @returns {String} - CSV string
   */
  static exportToCSV(billingData) {
    try {
      const headers = [
        "Company ID",
        "Company Name",
        "Month",
        "Total Users",
        "User Tier Users",
        "Manager Tier Users",
        "Admin Tier Users",
        "Root Tier Users",
        "Subtotal",
        "Discount %",
        "Discount Amount",
        "Total Amount",
      ];

      const rows = billingData.map((data) => [
        data.companyId,
        data.companyName || "",
        data.month,
        data.totalBillableUsers,
        data.breakdown?.byLevel?.user || 0,
        data.breakdown?.byLevel?.manager || 0,
        data.breakdown?.byLevel?.admin || 0,
        data.breakdown?.byLevel?.root || 0,
        data.billing?.subtotal || 0,
        data.billing?.discountPercentage || 0,
        data.billing?.discountAmount || 0,
        data.billing?.totalAmount || 0,
      ]);

      const csvContent = [headers, ...rows]
        .map((row) => row.map((cell) => `"${cell}"`).join(","))
        .join("\n");

      return csvContent;
    } catch (error) {
      console.error("Error exporting to CSV:", error);
      throw error;
    }
  }
}

module.exports = BillingHelper;
