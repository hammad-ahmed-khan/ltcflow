// backend/src/routes/complete-activation.js (Updated for root user company setup)
const User = require("../models/User");
const Company = require("../models/Company");
const AuthCode = require("../models/AuthCode");
const Image = require("../models/Image");
const bcrypt = require("bcryptjs");
const argon2 = require("argon2");
const moment = require("moment");
const isEmpty = require("../utils/isEmpty");
const mongoose = require("mongoose");
const outsetaApi = require("../services/outsetaApi");

module.exports = async (req, res) => {
  try {
    const { token, password, confirmPassword, companyName, companyLogo } =
      req.fields;
    const companyId = req.headers["x-company-id"];

    // Input validation
    const errors = {};

    if (isEmpty(token)) {
      errors.token = "Activation token is required";
    }

    if (isEmpty(password)) {
      errors.password = "Password is required";
    } else if (password.length < 6) {
      errors.password = "Password must be at least 6 characters long";
    }

    if (isEmpty(confirmPassword)) {
      errors.confirmPassword = "Please confirm your password";
    } else if (password !== confirmPassword) {
      errors.confirmPassword = "Passwords do not match";
      errors.password = "Passwords do not match";
    }

    if (!companyId) {
      errors.companyId = "Company ID is required";
    }

    // Return validation errors
    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        status: "error",
        errors,
        message: "Please correct the errors and try again",
      });
    }

    // Convert companyId to ObjectId
    let companyObjectId;
    try {
      companyObjectId = new mongoose.Types.ObjectId(companyId);
    } catch (err) {
      return res.status(400).json({
        error: "INVALID_COMPANY_ID",
        message: "Invalid company ID format",
      });
    }

    // Find all pending users in the company
    const pendingUsers = await User.find({
      companyId: companyObjectId,
      status: "pending",
      activationToken: { $ne: null },
    }).select("-password");

    // Find the user by comparing the raw token with the hashed tokens
    let user = null;
    for (const pendingUser of pendingUsers) {
      try {
        // Compare raw token with hashed token in database
        const isValidToken = await bcrypt.compare(
          token,
          pendingUser.activationToken
        );
        if (isValidToken) {
          user = pendingUser;
          break;
        }
      } catch (compareError) {
        // If bcrypt.compare fails, try direct comparison (for tokens stored as raw)
        if (token === pendingUser.activationToken) {
          user = pendingUser;
          break;
        }
      }
    }

    if (!user) {
      return res.status(400).json({
        error: "INVALID_TOKEN",
        message: "Invalid activation token or user not found.",
      });
    }

    // Check if activation token has expired
    if (user.tokenExpiry && new Date() > user.tokenExpiry) {
      return res.status(400).json({
        error: "TOKEN_EXPIRED",
        message:
          "Activation token has expired. Please request a new invitation.",
      });
    }

    // 🆕 Check if this is root user activation and validate company fields
    const isRootActivation = user.level === "root";

    if (isRootActivation) {
      // Validate company name for root users
      if (isEmpty(companyName)) {
        return res.status(400).json({
          status: "error",
          errors: {
            companyName: "Company name is required for root user activation",
          },
          message: "Company name is required",
        });
      }

      // Validate company logo if provided
      if (companyLogo) {
        try {
          // Verify the image exists and belongs to this company
          const logoImage = await Image.findOne({
            _id: companyLogo,
            companyId: companyObjectId,
          });

          if (!logoImage) {
            return res.status(400).json({
              status: "error",
              errors: { companyLogo: "Invalid company logo image" },
              message: "Invalid company logo",
            });
          }
        } catch (logoError) {
          return res.status(400).json({
            status: "error",
            errors: { companyLogo: "Invalid company logo format" },
            message: "Invalid company logo",
          });
        }
      }
    }

    // Start a transaction for atomic operations
    const session = await mongoose.startSession();
    //session.startTransaction();

    try {
      // 🆕 Update company information if this is root user activation
      if (isRootActivation) {
        const company = await Company.findById(companyObjectId).session(
          session
        );
        if (!company) {
          throw new Error("Company not found");
        }

        // Update company details
        const updateData = {
          name: companyName.trim(),
          updatedAt: new Date(),
        };

        // Add logo if provided
        if (companyLogo) {
          updateData.logo = companyLogo;
        }

        await Company.findByIdAndUpdate(
          companyObjectId,
          { $set: updateData },
          { new: true, session }
        );

        console.log(
          `🏢 Company updated during root activation: ${companyName} (ID: ${companyObjectId})`
        );
      }

      // Hash password and activate account
      const hashedPassword = await argon2.hash(password);

      user.password = hashedPassword;
      user.status = "active";
      user.activationToken = null;
      user.tokenExpiry = null;
      user.updatedAt = new Date();

      await user.save({ session });

      // Clean up any remaining auth codes for this user
      await AuthCode.updateMany(
        { user: user._id },
        { $set: { valid: false } },
        { session }
      );

      // Commit the transaction
      //await session.commitTransaction();

      // 🆕 Sync with Outseta if configured (outside of transaction)
      let outsetaSync = null;
      if (outsetaApi.isConfigured() && user.outsetaPersonId) {
        try {
          console.log(
            `🔄 Syncing activation completion to Outseta: ${user.email}`
          );

          const personUpdateData = {
            ActivationStatus: "active",
            ActivationDate: new Date().toISOString(),
          };

          const updateResult = await outsetaApi.updatePerson(
            user.outsetaPersonId,
            personUpdateData
          );

          if (updateResult?.success) {
            console.log(
              `✅ Activation status synced to Outseta: ${user.email} -> active`
            );
            outsetaSync = { success: true, data: updateResult.data };
          } else {
            console.warn(
              `⚠️ Outseta activation sync failed:`,
              updateResult?.error
            );
            outsetaSync = { success: false, error: updateResult?.error };
          }
        } catch (syncError) {
          console.error(
            `❌ Failed to sync activation status to Outseta:`,
            syncError
          );
          outsetaSync = { success: false, error: syncError.message };
        }
      }

      console.log(
        `✅ ${
          isRootActivation ? "Root user" : "User"
        } account activated successfully: ${user.email} (Company: ${companyId})`
      );

      // Return success response
      const response = {
        status: "success",
        message: isRootActivation
          ? "Company setup completed successfully! You can now log in."
          : "Account activated successfully! You can now log in.",
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          username: user.username,
          level: user.level,
        },
      };

      // Add company info for root users
      if (isRootActivation) {
        response.company = {
          id: companyObjectId,
          name: companyName.trim(),
          logoUpdated: !!companyLogo,
        };
      }

      // Add Outseta sync info if applicable
      if (outsetaSync) {
        response.outsetaSync = outsetaSync;
      }

      res.status(200).json(response);
    } catch (transactionError) {
      // Rollback the transaction on error
      //await session.abortTransaction();
      throw transactionError;
    } finally {
      // End the session
      session.endSession();
    }
  } catch (error) {
    console.error("Complete activation error:", error);
    res.status(500).json({
      error: "INTERNAL_SERVER_ERROR",
      message: error.message,
    });
  }
};
