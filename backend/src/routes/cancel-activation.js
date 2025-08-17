// backend/src/routes/cancel-activation.js
const User = require("../models/User");
const isEmpty = require("../utils/isEmpty");

module.exports = async (req, res) => {
  try {
    const { userId } = req.fields;
    const companyId = req.headers["x-company-id"];

    // Validate required fields
    let errors = {};
    isEmpty(userId) && (errors.userId = "User ID required.");
    isEmpty(companyId) && (errors.companyId = "Company ID required.");

    if (Object.keys(errors).length > 0) {
      return res.status(400).json(errors);
    }

    // Check if requesting user has permission
    if (!req.user) {
      return res.status(401).json({
        error: "AUTHENTICATION_REQUIRED",
        message: "Authentication required.",
      });
    }

    // Only admins and root users can cancel activations
    if (!["admin", "root"].includes(req.user.level)) {
      return res.status(403).json({
        error: "INSUFFICIENT_PERMISSIONS",
        message: "Only administrators can cancel user invitations.",
      });
    }

    // Validate requesting user belongs to the same company
    if (req.user.companyId.toString() !== companyId) {
      return res.status(403).json({
        error: "INVALID_COMPANY_ACCESS",
        message: "You can only manage users within your own company.",
      });
    }

    // Find the user to cancel
    const userToCancel = await User.findOne({
      _id: userId,
      companyId: companyId,
    });

    if (!userToCancel) {
      return res.status(404).json({
        error: "USER_NOT_FOUND",
        message: "User not found in your company.",
      });
    }

    // Only allow canceling pending or expired users
    if (!["pending", "expired"].includes(userToCancel.status)) {
      return res.status(400).json({
        error: "INVALID_USER_STATUS",
        message: "Can only cancel pending or expired invitations.",
      });
    }

    // Prevent self-cancellation
    if (userToCancel._id.toString() === req.user.id.toString()) {
      return res.status(400).json({
        error: "SELF_CANCELLATION_FORBIDDEN",
        message: "You cannot cancel your own account.",
      });
    }

    // Admin users cannot cancel other admin or root users
    if (
      req.user.level === "admin" &&
      ["admin", "root"].includes(userToCancel.level)
    ) {
      return res.status(403).json({
        error: "INSUFFICIENT_PRIVILEGES",
        message:
          "Administrators cannot cancel other administrators or root users.",
      });
    }

    // Delete the user (cancels the invitation)
    await User.findByIdAndDelete(userId);

    res.status(200).json({
      status: "success",
      message: `Invitation for ${userToCancel.username} has been cancelled.`,
      cancelledUser: {
        id: userToCancel._id,
        username: userToCancel.username,
        email: userToCancel.email,
        firstName: userToCancel.firstName,
        lastName: userToCancel.lastName,
        level: userToCancel.level,
        cancelledAt: new Date(),
      },
    });
  } catch (error) {
    console.error("Cancel activation error:", error);
    res.status(500).json({
      error: "INTERNAL_SERVER_ERROR",
      message: "Server error while cancelling invitation.",
    });
  }
};
