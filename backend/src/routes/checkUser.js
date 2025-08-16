const User = require('../models/User');

module.exports = async (req, res, next) => {
  let { id } = req.fields;
  const companyId = req.headers['x-company-id']; // Read from header

  // Validate required fields
  if (!id) {
    return res.status(400).json({ error: 'User ID required.' });
  }
  if (!companyId) {
    return res.status(400).json({ error: 'Company ID required.' });
  }

  // Query includes companyId to ensure data isolation
  User.findOne({ _id: id, companyId })
    .populate([{ path: 'picture', strictPopulate: false }])
    .populate([{ path: 'endpoint', strictPopulate: false }])
    .then((user) => {
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      res.status(200).json(user);
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: 'Server error.' });
    });
};
