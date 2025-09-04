// backend/src/routes/company-management.js
// Company management routes for root users

const Company = require("../models/Company");
const validator = require("validator");
const xss = require("xss");

/**
 * POST /api/company/update
 * Update company information (name, email, logo)
 * Only accessible by root users
 */
const updateCompany = async (req, res) => {
  try {
    // Check if user is root
    if (req.user.level !== "root") {
      return res.status(403).json({
        status: 403,
        error: "UNAUTHORIZED",
        message: "Only root users can manage company information",
      });
    }

    const companyId = req.headers["x-company-id"];
    if (!companyId) {
      return res.status(400).json({
        status: 400,
        error: "COMPANY_ID_REQUIRED",
        message: "Company ID is required",
      });
    }

    // Ensure user belongs to the company they're trying to update
    if (req.user.companyId.toString() !== companyId) {
      return res.status(403).json({
        status: 403,
        error: "COMPANY_MISMATCH",
        message: "Cannot update different company's information",
      });
    }

    let { name, email, logo } = req.fields;

    // Sanitize inputs
    name = name ? xss(name.trim()) : "";
    email = email ? xss(email.trim().toLowerCase()) : "";

    let errors = {};

    // Validate company name
    if (!name || name.length < 2) {
      errors.name = "Company name must be at least 2 characters long";
    } else if (name.length > 100) {
      errors.name = "Company name must be less than 100 characters";
    }

    // Validate email if provided
    if (email && !validator.isEmail(email)) {
      errors.email = "Invalid email format";
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        status: 400,
        error: "VALIDATION_ERROR",
        errors,
      });
    }

    // Find and update company
    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({
        status: 404,
        error: "COMPANY_NOT_FOUND",
        message: "Company not found",
      });
    }

    // Update company fields
    const updateFields = {
      name: name,
      updatedAt: new Date(),
    };

    // Only update email if provided
    if (email) {
      updateFields.email = email;
    }

    // Only update logo if provided
    if (logo) {
      updateFields.logo = logo;
    }

    const updatedCompany = await Company.findByIdAndUpdate(
      companyId,
      updateFields,
      { new: true, runValidators: true }
    )
      .populate({
        path: "logo",
        select: "_id name size shieldedID type createdAt",
      })
      .lean();

    console.log(`✅ Company updated by root user: ${updatedCompany.name}`);

    return res.json({
      status: 200,
      success: true,
      message: "Company updated successfully",
      company: {
        _id: updatedCompany._id,
        name: updatedCompany.name,
        email: updatedCompany.email,
        logo: updatedCompany.logo ? updatedCompany.logo._id : null,
        logoInfo: updatedCompany.logo || null,
        updatedAt: updatedCompany.updatedAt,
      },
    });
  } catch (error) {
    console.error("❌ Error updating company:", error);

    // Handle duplicate key errors
    if (error.code === 11000) {
      return res.status(400).json({
        status: 400,
        error: "DUPLICATE_ERROR",
        message: "Company name or email already exists",
      });
    }

    return res.status(500).json({
      status: 500,
      error: "INTERNAL_ERROR",
      message:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Failed to update company",
    });
  }
};

/**
 * POST /api/company/logo/remove
 * Remove company logo
 * Only accessible by root users
 */
const removeCompanyLogo = async (req, res) => {
  try {
    // Check if user is root
    if (req.user.level !== "root") {
      return res.status(403).json({
        status: 403,
        error: "UNAUTHORIZED",
        message: "Only root users can manage company logo",
      });
    }

    const companyId = req.headers["x-company-id"];
    if (!companyId) {
      return res.status(400).json({
        status: 400,
        error: "COMPANY_ID_REQUIRED",
        message: "Company ID is required",
      });
    }

    // Ensure user belongs to the company they're trying to update
    if (req.user.companyId.toString() !== companyId) {
      return res.status(403).json({
        status: 403,
        error: "COMPANY_MISMATCH",
        message: "Cannot update different company's logo",
      });
    }

    // Find and update company
    const updatedCompany = await Company.findByIdAndUpdate(
      companyId,
      {
        logo: null,
        updatedAt: new Date(),
      },
      { new: true }
    );

    if (!updatedCompany) {
      return res.status(404).json({
        status: 404,
        error: "COMPANY_NOT_FOUND",
        message: "Company not found",
      });
    }

    console.log(`✅ Company logo removed by root user: ${updatedCompany.name}`);

    return res.json({
      status: 200,
      success: true,
      message: "Company logo removed successfully",
    });
  } catch (error) {
    console.error("❌ Error removing company logo:", error);

    return res.status(500).json({
      status: 500,
      error: "INTERNAL_ERROR",
      message:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Failed to remove company logo",
    });
  }
};

module.exports = {
  updateCompany,
  removeCompanyLogo,
};
