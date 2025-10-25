const express = require("express"); // Ensure express is imported
const router = require("express").Router();
const passport = require("passport");
const jwt = require("express-jwt");
const Config = require("../../config");
const BillingHelper = require("../services/BillingHelper");
const UserActivationTracker = require("../services/UserActivationTracker");

router.get("/images/:id", require("./images"));
router.get("/files/:id", require("./files"));
router.get("/images/:id/:size", require("./images"));
router.get("/check-subdomain", require("./check-subdomain"));

router.post("/login", require("./login"));
router.post(
  "/typing",
  passport.authenticate("jwt", { session: false }, null),
  require("./typing")
);
router.post("/check-user", require("./checkUser"));
router.post(
  "/upload",
  passport.authenticate("jwt", { session: false }, null),
  require("./upload")
);
router.post(
  "/upload/file",
  passport.authenticate("jwt", { session: false }, null),
  require("./upload-file")
);
router.post("/register", require("./register"));
router.post(
  "/user/delete",
  passport.authenticate("jwt", { session: false }, null),
  require("./user-delete")
);
router.post(
  "/user/edit",
  passport.authenticate("jwt", { session: false }, null),
  require("./user-edit")
);
router.post(
  "/user/list",
  passport.authenticate("jwt", { session: false }, null),
  require("./user-list")
);

router.post(
  "/edit-profile",
  passport.authenticate("jwt", { session: false }, null),
  require("./edit-profile")
);

router.post(
  "/picture/change",
  passport.authenticate("jwt", { session: false }, null),
  require("./change-picture")
);
router.post(
  "/picture/remove",
  passport.authenticate("jwt", { session: false }, null),
  require("./change-picture")
);

router.post(
  "/favorite/toggle",
  passport.authenticate("jwt", { session: false }, null),
  require("./toggle-favorite")
);
router.post(
  "/favorites/list",
  passport.authenticate("jwt", { session: false }, null),
  require("./list-favorites")
);
router.post(
  "/rooms/list",
  passport.authenticate("jwt", { session: false }, null),
  require("./list-rooms")
);
router.post(
  "/room/get",
  passport.authenticate("jwt", { session: false }, null),
  require("./get-room")
);
router.post(
  "/room/create",
  passport.authenticate("jwt", { session: false }, null),
  require("./create-room")
);
router.post(
  "/room/join",
  passport.authenticate("jwt", { session: false }, null),
  require("./join-room")
);
router.post(
  "/room/remove",
  passport.authenticate("jwt", { session: false }, null),
  require("./remove-room")
);
router.post(
  "/search",
  passport.authenticate("jwt", { session: false }, null),
  require("./search")
);
router.post(
  "/message",
  passport.authenticate("jwt", { session: false }, null),
  require("./message")
);
router.post(
  "/messages/more",
  passport.authenticate("jwt", { session: false }, null),
  require("./more-messages")
);
router.post(
  "/group/create",
  passport.authenticate("jwt", { session: false }, null),
  require("./create-group")
);

router.post(
  "/rtc/create",
  passport.authenticate("jwt", { session: false }, null),
  require("./rtc/create")
);
router.post(
  "/rtc/join",
  passport.authenticate("jwt", { session: false }, null),
  require("./rtc/join")
);
router.post("/rtc/peers", require("./rtc/peers"));

router.post("/meeting/get", require("./meeting/get"));
router.post(
  "/meeting/call",
  passport.authenticate("jwt", { session: false }, null),
  require("./meeting/call")
);
router.post(
  "/meeting/add",
  passport.authenticate("jwt", { session: false }, null),
  require("./meeting/add")
);
router.post(
  "/meeting/answer",
  passport.authenticate("jwt", { session: false }, null),
  require("./meeting/answer")
);
router.post(
  "/meeting/close",
  passport.authenticate("jwt", { session: false }, null),
  require("./meeting/close")
);
router.post(
  "/meeting/list",
  passport.authenticate("jwt", { session: false }, null),
  require("./meeting/list")
);

router.post("/auth/change", require("./auth/change"));
router.post("/auth/code", require("./auth/code"));
router.post("/auth/verify", require("./auth/verify"));

router.post(
  "/users/change-password",
  passport.authenticate("jwt", { session: false }, null),
  require("./users/change-password")
);

router.get("/company/:id", require("./company"));
router.get(
  "/company/subdomain/:subdomain",
  require("./company").getCompanyBySubdomain
);
// 🆕 NEW: Company management routes (authenticated - root users only)
router.post(
  "/company/update",
  passport.authenticate("jwt", { session: false }, null),
  require("./company-management").updateCompany
);
router.post(
  "/company/logo/remove",
  passport.authenticate("jwt", { session: false }, null),
  require("./company-management").removeCompanyLogo
);
router.post("/company/create", require("./create-company"));

// User status management
router.post(
  "/toggle-user-status",
  passport.authenticate("jwt", { session: false }, null),
  require("./toggle-user-status")
);

// Test email route (for development)
router.post("/test-email", require("./test-email"));
router.use("/info", require("./info"));

router.post("/auth/forgot-password", require("./auth/forgot-password"));
router.post("/auth/reset-password", require("./auth/reset-password"));

router.post("/debug-email", require("./debug-email"));
router.post("/email-queue-status", require("./email-queue-status"));

// User activation routes
router.get("/activate/:token", require("./activate-user"));
router.post("/activation-upload", require("./activation-upload")); // 🆕 NEW: Unauthenticated upload for activation
router.post("/verify-activation-otp", require("./verify-activation-otp")); // NEW
router.post("/resend-activation-otp", require("./resend-activation-otp")); // NEW
router.post("/complete-activation", require("./complete-activation"));
router.post("/regenerate-activation", require("./regenerate-activation"));
router.post("/cancel-activation", require("./cancel-activation"));

router.post(
  "/group/add-member",
  passport.authenticate("jwt", { session: false }, null),
  require("./group-add-member")
);

router.post(
  "/group/remove-member",
  passport.authenticate("jwt", { session: false }, null),
  require("./group-remove-member")
);

router.post(
  "/group/update-info",
  passport.authenticate("jwt", { session: false }, null),
  require("./group-update-info")
);

router.post(
  "/group/delete",
  passport.authenticate("jwt", { session: false }, null),
  require("./group-delete")
);

// Webhook route
router.post("/webhook/outseta", require("./outseta-webhook"));

router.post(
  "/message/delete",
  passport.authenticate("jwt", { session: false }, null),
  require("./delete-message")
);

router.post(
  "/unread-summary",
  passport.authenticate("jwt", { session: false }),
  require("./unread-summary")
);

router.post(
  "/mark-room-read",
  passport.authenticate("jwt", { session: false }),
  require("./mark-room-read")
);

router.post(
  "/room/media",
  passport.authenticate("jwt", { session: false }, null),
  require("./get-room-media")
);
router.get(
  "/billing/company/current",
  passport.authenticate("jwt", { session: false }),
  async (req, res) => {
    try {
      const companyId = req.user.companyId;

      console.log("=== BILLING DEBUG START ===");
      console.log("User ID:", req.user.id);
      console.log("Company ID:", companyId);

      // Get detailed monthly stats including active vs deactivated users
      const MonthlyActiveUser = require("../models/MonthlyActiveUser");
      const dayjs = require("dayjs");
      const currentMonth = dayjs().format("YYYY-MM");

      console.log("Current month:", currentMonth);

      // Get detailed stats for current month
      const detailedStats = await MonthlyActiveUser.getDetailedMonthlyStats(
        companyId,
        currentMonth
      );

      // 🔥 FIX: detailedStats is an object, not an array
      if (
        !detailedStats ||
        (typeof detailedStats === "object" &&
          Object.keys(detailedStats).length === 0)
      ) {
        console.log("No detailedStats found, returning empty structure");

        // If no data, return empty structure
        return res.json({
          success: true,
          data: {
            companyId,
            month: currentMonth,
            activeUsers: detailedStats.activeRecords,
          },
        });
      }

      console.log("=== BILLING DEBUG END ===");

      res.json({
        success: true,
        data: detailedStats, // 🔥 FIX: Use responseData instead of detailedStats[0]
      });
    } catch (error) {
      console.error("=== BILLING ERROR ===");
      console.error("Error getting current month billing:", error);
      console.error("Error stack:", error.stack);
      console.error("=== BILLING ERROR END ===");

      res.status(500).json({
        success: false,
        error: "Failed to get billing data",
        message: error.message,
      });
    }
  }
);

// Get billing for specific month
router.get(
  "/billing/company/month/:month",
  passport.authenticate("jwt", { session: false }),
  async (req, res) => {
    try {
      const companyId = req.user.companyId;
      const { month } = req.params;

      // Validate month format (YYYY-MM)
      if (!/^\d{4}-\d{2}$/.test(month)) {
        return res.status(400).json({
          success: false,
          error: "Invalid month format. Use YYYY-MM",
        });
      }

      const billingData = await BillingHelper.getCompanyBillingData(
        companyId,
        month
      );

      res.json({
        success: true,
        data: billingData,
      });
    } catch (error) {
      console.error("Error getting billing data for month:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get billing data",
        message: error.message,
      });
    }
  }
);

// Get current month stats for a company (simpler version)
router.get(
  "/billing/company/stats",
  passport.authenticate("jwt", { session: false }),
  async (req, res) => {
    try {
      const companyId = req.user.companyId;

      const stats = await UserActivationTracker.getCurrentMonthStats(companyId);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      console.error("Error getting company stats:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get company stats",
        message: error.message,
      });
    }
  }
);

// Admin-only route to get all companies billing (if needed)
router.get(
  "/billing/admin/all",
  passport.authenticate("jwt", { session: false }),
  async (req, res) => {
    try {
      // Check if user is admin or root
      if (!["admin", "root"].includes(req.user.level)) {
        return res.status(403).json({
          success: false,
          error: "Unauthorized. Admin access required.",
        });
      }

      const month = req.query.month; // optional

      const allBilling = await BillingHelper.getAllCompaniesBillingData(month);

      res.json({
        success: true,
        data: allBilling,
        summary: {
          totalCompanies: allBilling.length,
          totalUsers: allBilling.reduce(
            (sum, company) => sum + company.totalBillableUsers,
            0
          ),
          totalRevenue: allBilling.reduce(
            (sum, company) => sum + (company.billing?.totalAmount || 0),
            0
          ),
        },
      });
    } catch (error) {
      console.error("Error getting all companies billing:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get billing data",
        message: error.message,
      });
    }
  }
);

// Get billing configuration for the authenticated user's company
router.get(
  "/billing/config",
  passport.authenticate("jwt", { session: false }),
  async (req, res) => {
    try {
      // Get company details if needed for custom pricing
      const Company = require("../models/Company");
      const company = await Company.findById(req.user.companyId);

      if (!company) {
        return res.status(404).json({
          success: false,
          error: "Company not found",
        });
      }

      // Billing configuration - you can customize this per company or use defaults
      const billingConfig = {
        // Plan information
        planName:
          company.planName || process.env.DEFAULT_PLAN_NAME || "Connect",

        // Billing constants (moved from frontend env)
        baseUserLimit:
          company.baseUserLimit || parseInt(process.env.BASE_USER_LIMIT) || 20,
        perUserRate:
          company.perUserRate || parseFloat(process.env.PER_USER_RATE) || 2.97,

        // Currency info
        currency: company.currency || process.env.DEFAULT_CURRENCY || "USD",
        currencySymbol: getCurrencySymbol(company.currency || "USD"),

        // Additional plan details
        planDescription:
          company.planDescription ||
          "Advanced messaging and video conferencing",

        // Company-specific overrides
        isCustomPricing: company.isCustomPricing || false,
        planTier: company.planTier || "professional",
      };

      res.json({
        success: true,
        data: billingConfig,
      });
    } catch (error) {
      console.error("Error getting billing config:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get billing configuration",
        message: error.message,
      });
    }
  }
);

// Helper function to get currency symbol
function getCurrencySymbol(currency) {
  const symbols = {
    USD: "$",
    EUR: "€",
    GBP: "£",
    CAD: "C$",
    AUD: "A$",
    JPY: "¥",
    CNY: "¥",
    INR: "₹",
  };

  return symbols[currency?.toUpperCase()] || "$";
}

module.exports = router;
