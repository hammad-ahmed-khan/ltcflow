// routes/subdomain.js (or in your main server file, e.g., server.js/app.js)

const express = require("express");
const router = express.Router();
const Company = require("../models/Company"); // your MongoDB model for companies

// GET /api/check-subdomain?subdomain=company1
router.get("/check-subdomain", async (req, res) => {
  const { subdomain } = req.query;
  if (!subdomain)
    return res
      .status(400)
      .json({ valid: false, message: "Subdomain required" });

  try {
    const company = await Company.findOne({
      subdomain: subdomain.toLowerCase(),
    });
    if (!company) {
      return res.json({ valid: false });
    }
    return res.json({ valid: true, companyId: company._id.toString() });
  } catch (error) {
    console.error("Error checking subdomain:", error);
    res.status(500).json({ valid: false, message: "Server error" });
  }
});

module.exports = router;
