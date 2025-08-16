const User = require('../models/User');
const store = require('../store');
const jwt = require('jsonwebtoken');
const validator = require('validator');
const isEmpty = require('../utils/isEmpty');
const xss = require('xss');

module.exports = (req, res, next) => {
  console.log(req.fields);
  let email = xss(req.fields.email);
  const companyId = req.headers["x-company-id"]; // Read from header

  // Check if user has root level access
  if (req.user.level !== 'root') {
    return res.status(401).json({ error: '401 Unauthorized User' });
  }

  // Validate required fields
  let errors = {};
  isEmpty(email) && (errors.email = 'Email required.');
  !validator.isEmail(email) && (errors.email = 'Invalid email.');
  isEmpty(companyId) && (errors.companyId = 'Company ID required.');
  
  if (Object.keys(errors).length > 0) {
    return res.status(400).json(errors);
  }

  email = email.toLowerCase();

  // Delete user with companyId check to ensure data isolation
  // Root users can only delete users within their own company
  User.findOneAndDelete({ email, companyId })
    .then((result) => {
      if (!result) {
        return res.status(404).json({ email: 'User not found in your company.' });
      }
      
      // Emit user-deleted event to the deleted user
      store.io.to(result._id.toString()).emit('user-deleted', { id: result._id });
      
      res.status(200).json({ 
        status: 'success', 
        message: 'User deleted successfully.',
        result 
      });
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: 'Server error deleting user.' });
    });
};