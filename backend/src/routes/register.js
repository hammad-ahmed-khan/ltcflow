const User = require('../models/User');
const validator = require('validator');
const isEmpty = require('../utils/isEmpty');
const xss = require('xss');
const crypto = require('crypto');
const Config = require('../../config');

module.exports = async (req, res, next) => {
  let { username, email, firstName, lastName, phone, level } = req.fields;
  const companyId = req.headers["x-company-id"]; // Read from header

  // Validate required fields
  let errors = {};
  isEmpty(username) && (errors.username = 'Username required.');
  isEmpty(email) && (errors.email = 'Email required.');
  isEmpty(firstName) && (errors.firstName = 'First name required.');
  isEmpty(lastName) && (errors.lastName = 'Last name required.');
  isEmpty(level) && (errors.level = 'User role required.');
  isEmpty(companyId) && (errors.companyId = 'Company ID required.');
  
  if (Object.keys(errors).length > 0) {
    return res.status(400).json(errors);
  }

  // Validate email format
  if (!validator.isEmail(email)) {
    errors.email = 'Invalid email.';
  }

  // Validate user level
  const validLevels = ['user', 'manager', 'admin'];
  if (!validLevels.includes(level)) {
    errors.level = 'Invalid user role.';
  }

  // Check permissions based on current user's level
  if (req.user) {
    const currentUserLevel = req.user.level;
    
    if (currentUserLevel === 'root') {
      // Root can create all levels
    } else if (currentUserLevel === 'admin') {
      // Administrators cannot create other administrators
      if (level === 'admin') {
        errors.level = 'Administrators cannot create other administrators.';
      }
    } else {
      // Other users cannot create users
      errors.permission = 'You do not have permission to create users.';
    }
  }

  if (Object.keys(errors).length > 0) {
    return res.status(400).json(errors);
  }

  email = email.toLowerCase();

  try {
    // Check for username conflicts within the same company
    const isUsername = await User.findOne({ username, companyId });
    if (isUsername) {
      errors.username = 'Username taken within your company.';
    }

    // Check for email conflicts within the same company
    const isEmail = await User.findOne({ email, companyId });
    if (isEmail) {
      errors.email = 'Email already in use within your company.';
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json(errors);
    }

    // Generate activation token and expiry
    const activationToken = crypto.randomBytes(32).toString('hex');
    const tokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Create user WITHOUT password (they'll set it during activation)
    const newUser = new User({
      username: xss(username),
      email: xss(email),
      firstName: xss(firstName),
      lastName: xss(lastName),
      phone: xss(phone || ''),
      level: level,
      companyId: companyId,
      isActive: false, // User must activate first
      activationToken: activationToken,
      tokenExpiry: tokenExpiry,
      lastOnline: Date.now(),
    });

    const savedUser = await newUser.save();
    
    // Generate activation link
    const activationLink = `${Config.frontendUrl || 'http://localhost:3000'}/activate/${activationToken}`;
    
    // Remove sensitive data from response
    const userResponse = savedUser.toObject();
    delete userResponse.activationToken;
    
    res.status(200).json({
      status: 'success',
      message: `User ${username} created successfully. Activation link generated.`,
      user: userResponse,
      activationLink: activationLink, // In production, this would be sent via email
      tokenExpiry: tokenExpiry
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error creating user.' });
  }
};