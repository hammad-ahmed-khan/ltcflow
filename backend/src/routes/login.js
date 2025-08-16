// backend/src/routes/login.js
const User = require("../models/User");
const argon2 = require("argon2");
const store = require("../store");
const jwt = require("jsonwebtoken");
const validator = require("validator");
const isEmpty = require("../utils/isEmpty");

module.exports = (req, res, next) => {
  let { email, password } = req.fields;
  const companyId = req.headers["x-company-id"]; // read from header

  let errors = {};
  isEmpty(email) && (errors.email = "Username (or email) required.");
  isEmpty(password) && (errors.password = "Password required.");
  isEmpty(companyId) && (errors.companyId = "Company ID required.");
  if (Object.keys(errors).length > 0) return res.status(400).json(errors);

  email = email.toLowerCase();

  const sendResponse = (user) => {
    const payload = {
      id: user._id,
      email: user.email,
      level: user.level,
      firstName: user.firstName,
      lastName: user.lastName,
      picture: user.picture,
      username: user.username,
      companyId: user.companyId,
    };
    jwt.sign(
      payload,
      store.config.secret,
      { expiresIn: 60 * 60 * 24 * 60 }, // 60 days
      (err, token) => {
        if (err) return res.status(500).json({ token: "Error signing token." });
        res.status(200).json({ token });
      }
    );
  };

  const sendError = (message = "Wrong password.") =>
    res.status(400).json({ password: message });

  // Query includes companyId
  let query;
  if (validator.isEmail(email)) query = { email, companyId };
  else query = { username: email, companyId };

  User.findOne(query)
    .populate([
      {
        path: "picture",
        strictPopulate: false,
        match: { _id: { $exists: true } }, // Only populate if File model exists
      },
    ])
    .populate([
      {
        path: "endpoint",
        strictPopulate: false,
        match: { _id: { $exists: true } }, // Only populate if Endpoint model exists
      },
    ])
    .then((user) => {
      if (!user) return res.status(404).json({ email: "User not found." });

      // 🔹 NEW: Skip status check for root users
      if (user.level !== "root") {
        // Check user status for non-root users
        if (user.status !== "active") {
          const statusMessages = {
            pending:
              "Account not activated. Please check your email for the activation link.",
            expired:
              "Activation link has expired. Please contact your administrator for a new invitation.",
            deactivated:
              "Account has been deactivated. Please contact your administrator.",
          };

          return res.status(403).json({
            error:
              statusMessages[user.status] || "Account access is not available.",
          });
        }
      }

      // Check if user has a password (should have one after activation)
      // Root users might not have a password initially, so we handle this differently
      if (!user.password) {
        if (user.level === "root") {
          return res.status(403).json({
            error:
              "Root account password not set. Please contact system administrator.",
          });
        } else {
          return res.status(403).json({
            error:
              "Account setup incomplete. Please contact your administrator.",
          });
        }
      }

      argon2
        .verify(user.password, password)
        .then((correct) => (correct ? sendResponse(user) : sendError()))
        .catch(() => sendError());
    })
    .catch((err) => {
      console.error("Login error:", err);
      res.status(500).json({ error: "Internal server error during login." });
    });
};
