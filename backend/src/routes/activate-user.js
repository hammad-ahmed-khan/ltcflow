const User = require("../models/User");
const argon2 = require("argon2");
const validator = require("validator");
const isEmpty = require("../utils/isEmpty");
const xss = require("xss");

module.exports = async (req, res, next) => {
  let { token, email, password, repeatPassword } = req.fields;

  // Validate required fields
  let errors = {};
  isEmpty(token) && (errors.token = "Activation token required.");
  isEmpty(email) && (errors.email = "Email address required.");
  isEmpty(password) && (errors.password = "Password required.");
  isEmpty(repeatPassword) &&
    (errors.repeatPassword = "Please confirm your password.");

  if (Object.keys(errors).length > 0) {
    return res.status(400).json(errors);
  }

  // Validate email format
  if (!validator.isEmail(email)) {
    errors.email = "Invalid email format.";
  }

  // Validate password match
  if (password !== repeatPassword) {
    errors.password = "Passwords do not match.";
    errors.repeatPassword = "Passwords do not match.";
  }

  // Password strength validation
  if (password.length < 6) {
    errors.password = "Password must be at least 6 characters long.";
  }

  if (Object.keys(errors).length > 0) {
    return res.status(400).json(errors);
  }

  email = email.toLowerCase();

  try {
    // Find user by BOTH activation token AND email for security
    const user = await User.findOne({
      activationToken: token,
      email: email, // Must match the user's email
      status: "pending", // Only allow activation for pending users
    });

    if (!user) {
      return res.status(400).json({
        error:
          "Invalid activation token or email address. Please check your details and try again.",
      });
    }

    // Check if token has expired
    if (user.tokenExpiry && new Date() > user.tokenExpiry) {
      // Update status to expired
      await User.findByIdAndUpdate(user._id, { status: "expired" });
      return res.status(400).json({
        error:
          "Activation token has expired. Please contact your administrator for a new invitation.",
      });
    }

    // Hash the password
    const hashedPassword = await argon2.hash(password);

    // Activate the user
    const updatedUser = await User.findByIdAndUpdate(
      user._id,
      {
        $set: {
          password: hashedPassword,
          status: "active", // Set status to active
        },
        $unset: {
          activationToken: 1,
          tokenExpiry: 1,
        },
      },
      { new: true }
    ).select("-password");

    res.status(200).json({
      status: "success",
      message: "Account activated successfully! You can now log in.",
      user: {
        id: updatedUser._id,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        username: updatedUser.username,
        level: updatedUser.level,
        companyId: updatedUser.companyId,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error during activation." });
  }
};
