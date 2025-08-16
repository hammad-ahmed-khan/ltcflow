// routes/create-company.js
const Company = require("../models/Company");

module.exports = async (req, res) => {
  try {
    const { name, subdomain } = req.fields; // switched from req.body to req.fields

    if (!name || !subdomain) {
      return res.status(400).json({ error: "Name and subdomain are required" });
    }

    const existing = await Company.findOne({
      subdomain: subdomain.toLowerCase(),
    });

    if (existing) {
      return res
        .status(400)
        .json({ error: "Company with this subdomain already exists" });
    }

    const company = new Company({
      name,
      subdomain: subdomain.toLowerCase(),
    });
    await company.save();

    res.status(201).json({ message: "Company created successfully", company });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};
