const User = require("../models/User");
const Company = require("../models/Company");
const outsetaApi = require("../services/outsetaApi");

// 🔥 NEW: Import MAU tracking
const UserActivationTracker = require("../services/UserActivationTracker");

module.exports = async (req, res, next) => {
  const { userId, newStatus } = req.fields;
  const companyId = req.headers["x-company-id"];

  // Validation
  if (!["root", "admin"].includes(req.user.level)) {
    return res.status(401).json({ error: "Unauthorized User" });
  }

  if (!userId || !newStatus || !companyId) {
    return res
      .status(400)
      .json({ error: "User ID, status, and Company ID required." });
  }

  const validStatuses = ["pending", "active", "deactivated", "expired"];
  if (!validStatuses.includes(newStatus)) {
    return res.status(400).json({ error: "Invalid status value." });
  }

  try {
    // Find user
    const user = await User.findOne({ _id: userId, companyId });
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    // Store original status for comparison
    const originalStatus = user.status;

    // Prevent self-deactivation
    if (req.user.id === userId && newStatus === "deactivated") {
      return res
        .status(400)
        .json({ error: "You cannot deactivate your own account." });
    }

    // Update user status
    const updateData = { status: newStatus };
    if (["deactivated", "expired"].includes(newStatus)) {
      //updateData.$unset = { activationToken: 1, tokenExpiry: 1 };
    }

    const updatedUser = await User.findByIdAndUpdate(userId, updateData, {
      new: true,
    }).select("-password -activationToken");

    // 🔥 NEW: Handle Monthly Active Users tracking
    let mauResult = null;
    try {
      if (originalStatus !== "active" && newStatus === "active") {
        // User is being activated (from pending/deactivated/expired to active)
        mauResult = await UserActivationTracker.logUserActivation(updatedUser);
        console.log(
          `📊 User ${updatedUser.email} reactivated and added to monthly active users`
        );
      }
    } catch (mauError) {
      console.error(
        `⚠️ MAU tracking error for user ${updatedUser.email}:`,
        mauError
      );
      // Don't fail the status change if MAU tracking fails
    }

    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({
        status: "error",
        error: "COMPANY_NOT_FOUND",
        message: "Company not found",
      });
    }

    const isDemo = company.subdomain === "demo";

    // 🔥 FIX: Initialize outsetaSync variable
    let outsetaSync = null;

    // Sync with Outseta
    if (!isDemo && outsetaApi.isConfigured() && user.outsetaPersonId) {
      try {
        console.log(
          `🔄 Syncing status change to Outseta: ${user.email} -> ${newStatus}`
        );

        const personUpdateData = {
          ActivationStatus: newStatus,
          StatusChangedAt: new Date().toISOString(),
        };

        const updateResult = await outsetaApi.updatePerson(
          user.outsetaPersonId,
          personUpdateData
        );

        if (updateResult?.success) {
          console.log(
            `✅ Status synced to Outseta: ${user.email} -> ${newStatus}`
          );
          outsetaSync = { success: true, action: "updated" };
        } else {
          console.warn(`⚠️ Outseta status sync failed:`, updateResult?.error);
          outsetaSync = { success: false, error: updateResult?.error };
        }
      } catch (syncError) {
        console.error(`❌ Failed to sync status to Outseta:`, syncError);
        outsetaSync = { success: false, error: syncError.message };
      }
    }

    // Prepare response
    const response = {
      status: "success",
      message: `User status updated to ${newStatus} successfully.`,
      user: updatedUser,
      outseta: outsetaSync,
    };

    // 🔥 NEW: Add MAU tracking info to response
    if (mauResult) {
      response.monthlyActiveUsers = {
        action: mauResult.action,
        month: mauResult.month,
        message:
          mauResult.message || `User ${mauResult.action} monthly active users`,
      };
    }

    res.status(200).json(response);
  } catch (err) {
    console.error("Toggle user status error:", err);
    res.status(500).json({ error: "Server error updating user status." });
  }
};
