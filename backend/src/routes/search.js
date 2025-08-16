const User = require("../models/User");
const Config = require("../../config");
const mongoose = require("mongoose");

module.exports = (req, res, next) => {
  let { search, limit, more } = req.fields;
  const companyId = req.headers["x-company-id"]; // read from header

  if (!companyId) {
    return res.status(400).json({ status: 400, error: "COMPANY_ID_REQUIRED" });
  }

  !limit && (limit = 25);
  !search && (search = ""); // Handle empty search

  // Convert companyId string to ObjectId for proper matching
  let companyObjectId;
  try {
    companyObjectId = new mongoose.Types.ObjectId(companyId);
  } catch (err) {
    return res.status(400).json({ status: 400, error: "INVALID_COMPANY_ID" });
  }

  User.aggregate()
    .match({ companyId: companyObjectId }) // Match by ObjectId
    .project({
      fullName: { $concat: ["$firstName", " ", "$lastName"] },
      firstName: 1,
      lastName: 1,
      username: 1,
      email: 1,
      picture: 1,
      tagLine: 1,
      level: 1, // Include user level/role
      isActive: 1, // Include activation status
      activationToken: 1, // Include activation token (for admin operations)
      tokenExpiry: 1, // Include token expiry date
      createdAt: 1, // Include creation timestamp
      updatedAt: 1, // Include last update timestamp
      lastOnline: 1, // Include last online timestamp
      companyId: 1, // Include company ID for reference
    })
    .match({
      $and: [
        {
          $or: [
            { fullName: { $regex: `.*${search}.*`, $options: "i" } },
            { email: { $regex: `.*${search}.*`, $options: "i" } },
            { username: { $regex: `.*${search}.*`, $options: "i" } },
            { firstName: { $regex: `.*${search}.*`, $options: "i" } },
            { lastName: { $regex: `.*${search}.*`, $options: "i" } },
          ],
        },
        {
          email: { $ne: req.user.email }, // exclude self
        },
      ],
    })
    .sort({ _id: -1 })
    .limit(limit)
    .exec((err, users) => {
      if (err) {
        console.error("Search aggregation error:", err);
        return res
          .status(500)
          .json({ error: "Search failed", details: err.message });
      }

      User.populate(users, { path: "picture" }, (err, users) => {
        if (err) {
          console.error("Population error:", err);
          return res
            .status(500)
            .json({ error: "Population failed", details: err.message });
        }

        // Clean up sensitive data before sending response
        const cleanUsers = users.map((user) => ({
          ...user,
          // Remove activation token from response for security
          // (keep it in backend operations only)
          activationToken: user.activationToken ? "***hidden***" : null,
        }));

        console.log(
          `Search results: Found ${users.length} users for company ${companyId}`
        );
        res.status(200).json({
          limit,
          search,
          users: cleanUsers,
          // Add metadata for admin interface
          metadata: {
            totalFound: users.length,
            searchTerm: search,
            companyId: companyId,
            timestamp: new Date().toISOString(),
          },
        });
      });
    });
};
