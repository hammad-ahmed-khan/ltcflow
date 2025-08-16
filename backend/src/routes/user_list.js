const User = require('../models/User');

module.exports = (req, res, next) => {
  let { search, limit, more } = req.fields;
  const companyId = req.headers["x-company-id"]; // Read from header

  // Validate companyId
  if (!companyId) {
    return res.status(400).json({ error: 'Company ID required.' });
  }

  !limit && (limit = 25);
  !search && (search = ''); // Handle empty search

  User.aggregate([
    // First match by companyId to ensure data isolation
    {
      $match: {
        companyId: companyId // Convert string to ObjectId if needed
      }
    },
    // Project fields including fullName concatenation
    {
      $project: {
        fullName: { $concat: ['$firstName', ' ', '$lastName'] },
        firstName: 1,
        lastName: 1,
        username: 1,
        email: 1,
        picture: 1,
        tagLine: 1,
        companyId: 1
      }
    },
    // Match search criteria and exclude system email
    {
      $match: {
        $and: [
          {
            $or: [
              { fullName: { $regex: `.*${search}.*`, $options: 'i' } },
              { email: { $regex: `.*${search}.*`, $options: 'i' } },
              { username: { $regex: `.*${search}.*`, $options: 'i' } },
              { firstName: { $regex: `.*${search}.*`, $options: 'i' } },
              { lastName: { $regex: `.*${search}.*`, $options: 'i' } },
            ],
          },
          {
            email: { $ne: 'TODO my email' },
          },
        ],
      }
    },
    // Sort and limit results
    {
      $sort: { _id: -1 }
    },
    {
      $limit: limit
    }
  ])
    .exec((err, users) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Server error searching users.' });
      }

      // Populate picture field
      User.populate(users, { path: 'picture' }, (err, users) => {
        if (err) {
          console.error(err);
          return res.status(500).json({ error: 'Server error populating user data.' });
        }
        res.status(200).json(users);
      });
    });
};