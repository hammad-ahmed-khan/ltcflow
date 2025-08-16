const User = require('../models/User');
const argon2 = require('argon2');
const validator = require('validator');
const xss = require('xss');

module.exports = async (req, res, next) => {
  let username = xss(req.fields.username);
  let email = xss(req.fields.email);
  let firstName = xss(req.fields.firstName);
  let lastName = xss(req.fields.lastName);
  let { password, repeatPassword, user } = req.fields;
  const companyId = req.headers["x-company-id"]; // Read from header

  // Check if user has root level access
  if (req.user.level !== 'root') {
    return res.status(401).json({ error: '401 Unauthorized User' });
  }

  // Validate companyId
  if (!companyId) {
    return res.status(400).json({ error: 'Company ID required.' });
  }

  let errors = {};

  if (password !== repeatPassword) {
    errors.password = 'Passwords not matching';
    errors.repeatPassword = 'Passwords not matching';
  }

  !validator.isEmail(email) && (errors.email = 'Invalid email.');

  email = email.toLowerCase();

  // Check for username conflicts within the same company
  const isUsername = await User.findOne({ username, companyId });
  if (isUsername && username !== user.username) {
    errors.username = 'Username taken within your company.';
  }

  // Check for email conflicts within the same company
  const isEmail = await User.findOne({ email, companyId });
  if (isEmail && email !== user.email) {
    errors.email = 'Email already in use within your company.';
  }

  if (Object.keys(errors).length > 0) {
    return res.status(400).json(errors);
  }

  let query = { 
    username: xss(username), 
    email: xss(email), 
    firstName: xss(firstName), 
    lastName: xss(lastName) 
  };

  try {
    if (typeof password === 'string' && password.length > 0) {
      const hash = await argon2.hash(password);
      query = { ...query, password: hash };
    }

    // Update user with companyId check to ensure data isolation
    const updatedUser = await User.findOneAndUpdate(
      { email: user.email, companyId }, // Find by original email and companyId
      { $set: query }, 
      { new: true }
    ).select('-password'); // Don't return password in response

    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found in your company.' });
    }

    res.status(200).json({ 
      status: 'success', 
      message: 'User updated successfully.',
      user: updatedUser 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error updating user.' });
  }
};