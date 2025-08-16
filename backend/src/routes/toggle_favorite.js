const User = require('../models/User');
const Room = require('../models/Room');

module.exports = (req, res, next) => {
  let { roomID } = req.fields;
  const companyId = req.headers["x-company-id"]; // Read from header

  // Validate required fields
  if (!roomID) {
    return res.status(400).json({ error: 'Room ID required.' });
  }
  if (!companyId) {
    return res.status(400).json({ error: 'Company ID required.' });
  }

  // First verify the room exists in the user's company
  Room.findOne({ _id: roomID, companyId })
    .then((room) => {
      if (!room) {
        return res.status(404).json({ error: 'Room not found or access denied.' });
      }

      // Check if user has access to this room
      if (room.people.filter((person) => req.user.id.toString() === person.toString()).length === 0) {
        return res.status(403).json({ error: 'Access denied to this room.' });
      }

      // Find user with companyId check
      User.findOne({ _id: req.user.id, companyId })
        .then((user) => {
          if (!user) {
            return res.status(404).json({ error: 'User not found.' });
          }

          let update;
          if (user.favorites.includes(roomID)) {
            update = { $pull: { favorites: roomID } };
          } else {
            update = { $push: { favorites: roomID } };
          }

          User.findOneAndUpdate({ _id: req.user.id, companyId }, update, { new: true })
            .populate({
              path: 'favorites',
              populate: [
                {
                  path: 'people',
                  select: '-email -tagLine -password -friends -__v',
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
            .then((user) => {
              res.status(200).json({ favorites: user.favorites, roomID });
            })
            .catch((err) => {
              console.error(err);
              res.status(500).json({ error: 'Server error updating favorites.' });
            });
        })
        .catch((err) => {
          console.error(err);
          res.status(500).json({ error: 'Server error finding user.' });
        });
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: 'Server error verifying room.' });
    });
};