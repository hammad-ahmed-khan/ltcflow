const User = require("../models/User");
const Config = require("../../config");
const mongoose = require("mongoose");

module.exports = (req, res, next) => {
  let { search, limit, more } = req.fields;
  const companyId = req.headers["x-company-id"];

  if (!companyId) {
    return res.status(400).json({ status: 400, error: "COMPANY_ID_REQUIRED" });
  }

  !limit && (limit = 25);
  !search && (search = "");

  // Convert companyId string to ObjectId for proper matching
  let companyObjectId;
  try {
    companyObjectId = new mongoose.Types.ObjectId(companyId);
  } catch (err) {
    return res.status(400).json({ status: 400, error: "INVALID_COMPANY_ID" });
  }

  // ✅ REMOVED: No privilege-based filtering - all users visible in chat/groups/meetings
  const baseMatch = { companyId: companyObjectId };

  console.log(
    `User ${req.user.username} (${req.user.level}) searching all users in company - no privilege filtering applied`
  );

  User.aggregate()
    .match(baseMatch) // ✅ Only company isolation, no privilege filtering
    .project({
      fullName: { $concat: ["$firstName", " ", "$lastName"] },
      firstName: 1,
      lastName: 1,
      username: 1,
      email: 1,
      phone: 1, // ✅ ADD THIS LINE - Include phone field in projection
      picture: 1,
      tagLine: 1,
      level: 1,
      status: 1,
      activationToken: 1,
      tokenExpiry: 1,
      createdAt: 1,
      updatedAt: 1,
      lastOnline: 1,
      companyId: 1,
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

        const cleanUsers = users.map((user) => ({
          ...user,
          activationToken: user.activationToken ? "***hidden***" : null,
        }));

        console.log(
          `Search results: User ${req.user.username} (${req.user.level}) found ${users.length} users (all levels shown)`
        );

        res.status(200).json({
          limit,
          search,
          users: cleanUsers,
          metadata: {
            totalFound: users.length,
            searchTerm: search,
            companyId: companyId,
            requestingUserLevel: req.user.level,
            filteringApplied: "none",
            timestamp: new Date().toISOString(),
          },
        });
      });
    });
};
