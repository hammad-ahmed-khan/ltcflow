const argon2 = require("argon2");
const isEmpty = require("../utils/isEmpty");
const User = require("../models/User");
const Company = require("../models/Company");
const validator = require("validator");
const xss = require("xss");
const mongoose = require("mongoose");
const outsetaApi = require("../services/outsetaApi");

module.exports = async (req, res) => {
  const { firstName, lastName, email, phone, password, currentPassword } =
    req.fields;
  const companyId = req.headers["x-company-id"];

  // Validate required headers
  if (!companyId) {
    return res.status(400).json({
      status: "error",
      error: "COMPANY_ID_REQUIRED",
      message: "Company ID is required in headers",
    });
  }

  // Convert companyId to ObjectId for proper matching
  let companyObjectId;
  try {
    companyObjectId = new mongoose.Types.ObjectId(companyId);
  } catch (err) {
    return res.status(400).json({
      status: "error",
      error: "INVALID_COMPANY_ID",
      message: "Invalid company ID format",
    });
  }

  // Validate that user belongs to the company
  if (req.user.companyId.toString() !== companyId) {
    return res.status(403).json({
      status: "error",
      error: "COMPANY_ACCESS_DENIED",
      message: "Access denied. User does not belong to the specified company.",
    });
  }

  let errors = {};
  let user;

  try {
    // Find the current user with company validation
    user = await User.findOne({
      _id: req.user.id,
      companyId: companyObjectId,
    });

    if (!user) {
      return res.status(404).json({
        status: "error",
        error: "USER_NOT_FOUND",
        message: "User not found in your company",
      });
    }

    // Get company info for demo account detection
    const company = await Company.findById(companyId);
    const isDemo = company && company.subdomain === "demo";

    // Validate input fields
    if (firstName !== undefined) {
      if (isEmpty(firstName)) {
        errors.firstName = "First name is required.";
      } else if (firstName.length < 2) {
        errors.firstName = "First name must be at least 2 characters long.";
      } else if (firstName.length > 50) {
        errors.firstName = "First name cannot exceed 50 characters.";
      }
    }

    if (lastName !== undefined) {
      if (isEmpty(lastName)) {
        errors.lastName = "Last name is required.";
      } else if (lastName.length < 2) {
        errors.lastName = "Last name must be at least 2 characters long.";
      } else if (lastName.length > 50) {
        errors.lastName = "Last name cannot exceed 50 characters.";
      }
    }

    if (email !== undefined) {
      if (isEmpty(email)) {
        errors.email = "Email is required.";
      } else if (!validator.isEmail(email)) {
        errors.email = "Invalid email format.";
      } else {
        // Check if email already exists within the same company (excluding current user)
        const emailExists = await User.findOne({
          email: email.toLowerCase(),
          companyId: companyObjectId,
          _id: { $ne: req.user.id },
        });

        if (emailExists) {
          errors.email = "Email is already in use within your company.";
        }
      }
    }

    if (phone !== undefined && !isEmpty(phone)) {
      // USA phone validation - 10 digits only
      const digitsOnly = phone.replace(/\D/g, "");
      if (digitsOnly.length !== 10) {
        errors.phone =
          "Invalid phone number. Please enter a 10-digit USA phone number (e.g., 2345678901)";
      }
    }

    // Password validation
    if (password !== undefined && !isEmpty(password)) {
      if (password.length < 6) {
        errors.password = "Password must be at least 6 characters long.";
      } else if (password.length > 128) {
        errors.password = "Password cannot exceed 128 characters.";
      }

      // For security, require current password when changing password
      if (isEmpty(currentPassword)) {
        errors.currentPassword =
          "Current password is required to change password.";
      } else {
        try {
          const isCurrentPasswordValid = await argon2.verify(
            user.password,
            currentPassword
          );
          if (!isCurrentPasswordValid) {
            errors.currentPassword = "Current password is incorrect.";
          }
        } catch (e) {
          console.error("Password verification error:", e);
          errors.currentPassword = "Error verifying current password.";
        }
      }
    }

    // Return validation errors if any
    if (Object.keys(errors).length > 0) {
      return res.status(400).json(errors);
    }

    // Build update object with only provided fields
    let updateData = {};

    if (firstName !== undefined) {
      updateData.firstName = xss(firstName.trim());
    }

    if (lastName !== undefined) {
      updateData.lastName = xss(lastName.trim());
    }

    if (email !== undefined) {
      updateData.email = xss(email.toLowerCase().trim());
    }

    if (phone !== undefined) {
      updateData.phone = isEmpty(phone) ? "" : xss(phone.trim());
    }

    // Hash new password if provided
    if (password !== undefined && !isEmpty(password)) {
      updateData.password = await argon2.hash(password);
    }

    // Update timestamp
    updateData.updatedAt = new Date();

    // Update user with company validation
    const updatedUser = await User.findOneAndUpdate(
      { _id: req.user.id, companyId: companyObjectId },
      { $set: updateData },
      { new: true, runValidators: true }
    )
      .select("-password -activationToken")
      .populate([{ path: "picture", strictPopulate: false }]); // Exclude sensitive fields from response

    if (!updatedUser) {
      return res.status(404).json({
        status: "error",
        error: "UPDATE_FAILED",
        message: "Failed to update user profile",
      });
    }

    // Sync with Outseta if user info changed (same pattern as user-edit.js)
    let outsetaResult = null;
    if (!isDemo && outsetaApi.isConfigured() && updatedUser.outsetaPersonId) {
      try {
        console.log(
          `🔄 Syncing profile changes to Outseta: ${updatedUser.email}`
        );

        // Enhanced Outseta sync with custom properties
        const personUpdateData = {
          // Standard Outseta fields
          Email: updatedUser.email,
          FirstName: updatedUser.firstName,
          LastName: updatedUser.lastName,
          Phone: updatedUser.phone || null,

          // Custom properties we've been using
          UserRole:
            updatedUser.level === "standard"
              ? "Standard User"
              : updatedUser.level === "admin"
              ? "Admin"
              : updatedUser.level === "manager"
              ? "Group Manager"
              : "User",
          ProfileUpdatedAt: new Date().toISOString(),
        };

        outsetaResult = await outsetaApi.updatePerson(
          updatedUser.outsetaPersonId,
          personUpdateData
        );

        if (outsetaResult?.success) {
          console.log(`✅ Profile updated in Outseta: ${updatedUser.email}`);
        } else {
          console.warn(`⚠️ Outseta profile sync failed:`, outsetaResult?.error);
        }
      } catch (outsetaError) {
        console.error(
          "❌ Outseta sync failed for profile update:",
          outsetaError
        );
        outsetaResult = { success: false, error: outsetaError.message };
        // Continue with local update even if Outseta fails
      }
    }

    // Log the update for audit purposes
    console.log(
      `✅ Profile updated for user: ${updatedUser.email} (Company: ${companyId})`
    );

    const responseUser = updatedUser.toObject();
    responseUser.id = responseUser._id.toString();

    // Return success response following your existing pattern
    res.status(200).json({
      status: "success",
      message: "Profile updated successfully.",
      user: responseUser,
      outseta: outsetaResult
        ? {
            synced: outsetaResult.success,
            action:
              outsetaResult.message === "No sync needed"
                ? "no_changes"
                : "updated",
            error: outsetaResult.error || null,
          }
        : {
            synced: false,
            reason: updatedUser.outsetaPersonId
              ? "not_configured"
              : "no_outseta_id",
          },
    });
  } catch (error) {
    console.error("❌ Edit profile error:", error);
    res.status(500).json({
      status: "error",
      error: "INTERNAL_SERVER_ERROR",
      message:
        "An error occurred while updating your profile. Please try again later.",
    });
  }
};
