const Room = require('../models/Room');

module.exports = (req, res, next) => {
  let { limit } = req.fields;
  const companyId = req.headers['x-company-id']; // Read from header

  // Validate companyId
  if (!companyId) {
    return res.status(400).json({ error: 'Company ID required.' });
  }

  !limit && (limit = 30);

  // Query includes companyId to ensure data isolation
  Room.find({
    people: { $in: [req.user.id] },
    companyId, // Add companyId filter
    $or: [
      {
        lastMessage: { $ne: null },
      },
      {
        isGroup: true,
      },
    ],
  })
    .sort({ lastUpdate: -1 })
    .populate([{ path: 'picture', strictPopulate: false }])
    .populate({
      path: 'people',
      select: '-email -password -friends -__v',
      populate: {
        path: 'picture',
      },
    })
    .populate('lastMessage')
    .limit(limit)
    .exec((err, rooms) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Server error.' });
      }
      res.status(200).json({ limit, rooms });
    });
};
