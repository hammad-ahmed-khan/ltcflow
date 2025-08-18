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

  // ✅ ADD PRIVILEGE-BASED FILTERING
  const buildPrivilegeMatchStage = (userLevel) => {
    const baseMatch = { companyId: companyObjectId };

    if (userLevel === "root") {
      // Root can see all users
      return baseMatch;
    } else if (userLevel === "admin") {
      // Admins cannot see root users
      return { ...baseMatch, level: { $ne: "root" } };
    } else if (userLevel === "manager") {
      // Managers can only see standard users
      return { ...baseMatch, level: "user" };
    } else {
      // Standard users can only see other standard users
      return { ...baseMatch, level: "user" };
    }
  };

  const privilegeMatch = buildPrivilegeMatchStage(req.user.level);

  console.log(
    `User ${req.user.username} (${req.user.level}) searching with filter:`,
    privilegeMatch
  );

  User.aggregate()
    .match(privilegeMatch) // ✅ Apply privilege filtering here
    .project({
      fullName: { $concat: ["$firstName", " ", "$lastName"] },
      firstName: 1,
      lastName: 1,
      username: 1,
      email: 1,
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
          `Search results: User ${req.user.username} (${req.user.level}) found ${users.length} users`
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
            timestamp: new Date().toISOString(),
          },
        });
      });
    });
};
