const User = require("../models/User");
const store = require("../store");
const jwt = require("jsonwebtoken");
const validator = require("validator");
const isEmpty = require("../utils/isEmpty");
const xss = require("xss");
const outsetaApi = require("../services/outsetaApi"); // Add this import

module.exports = async (req, res, next) => {
  try {
    // Input sanitization and validation
    let email = xss(req.fields.email || "")
      .trim()
      .toLowerCase();
    const companyId = req.headers["x-company-id"];

    // Authorization check
    if (!["root", "admin"].includes(req.user.level)) {
      return res.status(401).json({
        error: "UNAUTHORIZED_ACCESS",
        message: "Only root or admin users can perform this action",
      });
    }

    // Input validation
    const errors = {};
    if (isEmpty(email)) errors.email = "Email is required";
    if (!validator.isEmail(email)) errors.email = "Invalid email format";
    if (isEmpty(companyId)) errors.companyId = "Company ID is required";

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ errors });
    }

    // Company access validation
    if (req.user.companyId.toString() !== companyId) {
      return res.status(403).json({
        error: "FORBIDDEN_ACCESS",
        message: "You can only manage users within your own company",
      });
    }

    // Find user to delete
    const userToDelete = await User.findOne({ email, companyId });
    if (!userToDelete) {
      return res.status(404).json({
        error: "USER_NOT_FOUND",
        message: "User not found in your company",
      });
    }

    // Privilege level validation
    const privilegeLevels = { user: 1, manager: 2, admin: 3, root: 4 };
    const currentUserLevel = privilegeLevels[req.user.level];
    const targetUserLevel = privilegeLevels[userToDelete.level];

    // Prevent deleting users with higher or equal privileges
    if (currentUserLevel <= targetUserLevel && req.user.level !== "root") {
      return res.status(403).json({
        error: "INSUFFICIENT_PRIVILEGES",
        message: "Cannot delete users with higher or equal privileges",
      });
    }

    // Prevent self-deletion
    if (userToDelete._id.toString() === req.user.id.toString()) {
      return res.status(400).json({
        error: "SELF_DELETION",
        message: "You cannot delete your own account",
      });
    }

    // Store Outseta Person ID before deletion
    const outsetaPersonId = userToDelete.outsetaPersonId;

    // Actually delete the user
    const deletedUser = await User.findOneAndDelete({
      _id: userToDelete._id,
      companyId,
    });

    // 🆕 SYNC USER DELETION TO OUTSETA
    let outsetaSync = { success: false, reason: "not_configured" };

    if (outsetaApi.isConfigured() && outsetaPersonId) {
      try {
        console.log(`🔄 Deleting user from Outseta: ${deletedUser.email}`);

        const deleteResult = await outsetaApi.deletePerson(outsetaPersonId);

        if (deleteResult?.success) {
          console.log(`✅ User deleted from Outseta: ${deletedUser.email}`);
          outsetaSync = { success: true, action: "deleted" };
        } else {
          console.warn(`⚠️ Outseta user deletion failed:`, deleteResult?.error);
          outsetaSync = { success: false, error: deleteResult?.error };
        }
      } catch (syncError) {
        console.error(`❌ Failed to delete user from Outseta:`, syncError);
        outsetaSync = { success: false, error: syncError.message };
      }
    } else {
      const reason = !outsetaApi.isConfigured()
        ? "not_configured"
        : "no_outseta_id";
      console.log(`Outseta sync skipped for ${deletedUser.email}: ${reason}`);
      outsetaSync = { success: false, reason };
    }

    // Notify the deleted user if they're online
    store.io.to(deletedUser._id.toString()).emit("user-deleted", {
      id: deletedUser._id,
    });

    // Success response
    return res.status(200).json({
      status: "success",
      message: "User deleted successfully",
      data: {
        id: deletedUser._id,
        email: deletedUser.email,
        username: deletedUser.username,
        name: `${deletedUser.firstName} ${deletedUser.lastName}`,
        deletedAt: new Date(),
      },
      outseta: outsetaSync,
    });
  } catch (err) {
    console.error("User deletion error:", err);
    return res.status(500).json({
      error: "SERVER_ERROR",
      message: "An error occurred while processing your request",
    });
  }
};
