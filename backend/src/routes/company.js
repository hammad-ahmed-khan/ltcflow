// backend/src/routes/company.js
// Fixed version based on your database structure

const Company = require("../models/Company");

module.exports = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        status: 400,
        error: "Company ID is required",
      });
    }

    console.log("🔍 DEBUG: Looking for company with ID:", id);

    // Find company and populate logo reference
    // Note: Using 'images' (plural) as that's what your model exports
    const company = await Company.findById(id)
      .populate({
        path: "logo",
        select: "_id name size shieldedID type createdAt",
      })
      .select("name email logo subdomain createdAt updatedAt")
      .lean();

    console.log(
      "🔍 DEBUG: Company with populated logo:",
      JSON.stringify(company, null, 2)
    );

    if (!company) {
      return res.status(404).json({
        status: 404,
        error: "Company not found",
      });
    }

    if (company.logo) {
      console.log(
        "✅ DEBUG: Logo found with shieldedID:",
        company.logo.shieldedID
      );
    } else {
      console.log("❌ DEBUG: No logo populated");
    }

    // Prepare response data
    const responseData = {
      _id: company._id,
      name: company.name,
      email: company.email,
      subdomain: company.subdomain,
      logo: company.logo ? company.logo._id : null,
      logoInfo: company.logo || null,
      createdAt: company.createdAt,
      updatedAt: company.updatedAt,
    };

    console.log("🔍 DEBUG: Final logoInfo:", responseData.logoInfo);
    console.log(
      `✅ Company data fetched: ${company.name} (${company.subdomain})`
    );

    return res.json({
      status: 200,
      success: true,
      company: responseData,
    });
  } catch (error) {
    console.error("❌ Error fetching company:", error);

    return res.status(500).json({
      status: 500,
      error: "Internal server error",
      message:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Unable to fetch company data",
    });
  }
};

// Alternative route for subdomain-based lookup
const getCompanyBySubdomain = async (req, res) => {
  try {
    const { subdomain } = req.params;

    if (!subdomain) {
      return res.status(400).json({
        status: 400,
        error: "Subdomain is required",
      });
    }

    const normalizedSubdomain = subdomain.toLowerCase().trim();

    const company = await Company.findOne({
      subdomain: normalizedSubdomain,
    })
      .populate({
        path: "logo",
        select: "_id name size shieldedID type createdAt",
      })
      .select("name email logo subdomain createdAt updatedAt")
      .lean();

    if (!company) {
      return res.status(404).json({
        status: 404,
        error: "Company not found with this subdomain",
      });
    }

    const responseData = {
      _id: company._id,
      name: company.name,
      email: company.email,
      subdomain: company.subdomain,
      logo: company.logo ? company.logo._id : null,
      logoInfo: company.logo || null,
      createdAt: company.createdAt,
      updatedAt: company.updatedAt,
    };

    console.log(
      `✅ Company data fetched by subdomain: ${company.name} (${normalizedSubdomain})`
    );

    return res.json({
      status: 200,
      success: true,
      company: responseData,
    });
  } catch (error) {
    console.error("❌ Error fetching company by subdomain:", error);

    return res.status(500).json({
      status: 500,
      error: "Internal server error",
      message:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Unable to fetch company data",
    });
  }
};

module.exports.getCompanyBySubdomain = getCompanyBySubdomain;
