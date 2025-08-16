const User = require("../models/User");
const argon2 = require("argon2");
const store = require("../store");
const jwt = require("jsonwebtoken");
const validator = require("validator");
const isEmpty = require("../utils/isEmpty");

module.exports = (req, res, next) => {
  let { email, password } = req.fields; // <-- companyId from request
  const companyId = req.headers["x-company-id"]; // read from header

  let errors = {};
  isEmpty(email) && (errors.email = "Username (or email) required.");
  isEmpty(password) && (errors.password = "Password required.");
  isEmpty(companyId) && (errors.companyId = "Company ID required."); // Validate companyId
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
      companyId: user.companyId, // Include companyId in JWT
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

  const sendError = () => res.status(400).json({ password: "Wrong password." });

  // Query includes companyId
  let query;
  if (validator.isEmail(email)) query = { email, companyId };
  else query = { username: email, companyId };

  User.findOne(query)
    .populate([{ path: "picture", strictPopulate: false }])
    .populate([{ path: "endpoint", strictPopulate: false }])
    .then((user) => {
      if (!user) return res.status(404).json({ email: "User not found." });
      argon2
        .verify(user.password, password)
        .then((correct) => (correct ? sendResponse(user) : sendError()));
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: "Server error." });
    });
};
