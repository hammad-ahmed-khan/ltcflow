const User = require('../models/User');
const argon2 = require('argon2');
const validator = require('validator');
const isEmpty = require('../utils/isEmpty');
const xss = require('xss');

module.exports = async (req, res, next) => {
  let { username, email, firstName, password, repeatPassword, phone, lastName, level } = req.fields;
  const companyId = req.headers["x-company-id"]; // Read from header

  // Validate required fields
  let errors = {};
  isEmpty(username) && (errors.username = 'Username required.');
  isEmpty(email) && (errors.email = 'Email required.');
  isEmpty(firstName) && (errors.firstName = 'First name required.');
  isEmpty(password) && (errors.password = 'Password required.');
  isEmpty(lastName) && (errors.lastName = 'Last name required.');
  isEmpty(level) && (errors.level = 'User role required.');
  isEmpty(companyId) && (errors.companyId = 'Company ID required.');
  
  if (Object.keys(errors).length > 0) {
    return res.status(400).json(errors);
  }

  // Validate password match
  if (password !== repeatPassword) {
    errors.password = 'Passwords not matching';
    errors.repeatPassword = 'Passwords not matching';
  }

  // Validate email format
  if (!validator.isEmail(email)) {
    errors.email = 'Invalid email.';
  }

  // Validate user level
  const validLevels = ['standard_user', 'group_manager', 'administrator'];
  if (!validLevels.includes(level)) {
    errors.level = 'Invalid user role.';
  }

  // Check permissions based on current user's level
  if (req.user) {
    const currentUserLevel = req.user.level;
    
    // Root users can create any level
    if (currentUserLevel === 'root') {
      // Root can create all levels including other administrators
    } else if (currentUserLevel === 'administrator') {
      // Administrators cannot create other administrators
      if (level === 'administrator') {
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

    // Hash password and create user
    const hash = await argon2.hash(password);
    
    const newUser = new User({
      username: xss(username),
      email: xss(email),
      firstName: xss(firstName),
      password: hash,
      phone: xss(phone || ''),
      lastName: xss(lastName),
      level: level, // Set user level/tier
      companyId: companyId, // Include companyId for multi-tenancy
      lastOnline: Date.now(),
    });

    const savedUser = await newUser.save();
    
    // Remove password from response
    const userResponse = savedUser.toObject();
    delete userResponse.password;
    
    res.status(200).json({
      status: 'success',
      message: `User ${username} created successfully.`,
      user: userResponse
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error creating user.' });
  }
};