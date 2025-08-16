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
  !search && (search = ''); // Handle empty search

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
        console.error('Search aggregation error:', err);
        return res.status(500).json({ error: 'Search failed', details: err.message });
      }

      User.populate(users, { path: "picture" }, (err, users) => {
        if (err) {
          console.error('Population error:', err);
          return res.status(500).json({ error: 'Population failed', details: err.message });
        }
        
        console.log(`Search results: Found ${users.length} users for company ${companyId}`);
        res.status(200).json({ limit, search, users });
      });
    });
};