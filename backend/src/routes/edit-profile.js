const argon2 = require("argon2");
const isEmpty = require("../utils/isEmpty");
const User = require("../models/User");
const validator = require("validator");
const xss = require("xss");
const mongoose = require("mongoose");

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
      // Basic phone validation - adjust regex based on your requirements
      const phoneRegex = /^[\+]?[\d\s\-\(\)]+$/;
      if (!phoneRegex.test(phone)) {
        errors.phone = "Invalid phone number format.";
      } else if (phone.length < 7 || phone.length > 20) {
        errors.phone = "Phone number must be between 7 and 20 characters.";
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
    ).select("-password -activationToken"); // Exclude sensitive fields from response

    if (!updatedUser) {
      return res.status(404).json({
        status: "error",
        error: "UPDATE_FAILED",
        message: "Failed to update user profile",
      });
    }

    // Log the update for audit purposes
    console.log(
      `✅ Profile updated for user: ${updatedUser.email} (Company: ${companyId})`
    );

    // Return success response following your existing pattern
    res.status(200).json({
      status: "success",
      message: "Profile updated successfully.",
      user: updatedUser,
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
