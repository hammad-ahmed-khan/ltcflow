const User = require('../models/User');

module.exports = (req, res, next) => {
  const companyId = req.headers['x-company-id']; // Read from header

  // Validate companyId
  if (!companyId) {
    return res.status(400).json({ error: 'Company ID required.' });
  }

  // Query includes companyId to ensure data isolation
  User.findOne({ _id: req.user.id, companyId })
    .populate({
      path: 'favorites',
      populate: [
        {
          path: 'people',
          select: '-email -password -friends -__v',
          populate: {
            path: 'picture',
          },
        },
        {
          path: 'lastMessage',
        },
        {
          path: 'picture',
        },
      ],
    })
    .exec((err, user) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Server error.' });
      }
      if (!user) {
        return res.status(404).json({ error: 'User not found.' });
      }
      res.status(200).json({ favorites: user.favorites });
    });
};
