const Message = require('../models/Message');
const Room = require('../models/Room');

module.exports = (req, res, next) => {
  let { id } = req.fields;
  const companyId = req.headers['x-company-id']; // Read from header

  // Validate required fields
  if (!id) {
    return res.status(400).json({ error: 'Room ID required.' });
  }
  if (!companyId) {
    return res.status(400).json({ error: 'Company ID required.' });
  }

  const findMessagesAndEmit = (room) => {
    // Messages query includes companyId
    Message.find({ room: room._id, companyId })
      .sort({ _id: -1 })
      .limit(50)
      .populate({
        path: 'author',
        select: '-email -password -friends -__v',
        populate: [
          {
            path: 'picture',
          },
        ],
      })
      .populate([{ path: 'file', strictPopulate: false }])
      .lean()
      .then((messages) => {
        messages.reverse();
        // Images query also includes companyId
        Message.find({ room: room._id, type: 'image', companyId })
          .sort({ _id: -1 })
          .limit(50)
          .populate({
            path: 'author',
            select: '-email -password -friends -__v',
            populate: {
              path: 'picture',
            },
          })
          .then((images) => {
            res.status(200).json({
              room: {
                _id: room._id,
                people: room.people,
                title: room.title,
                isGroup: room.isGroup,
                lastUpdate: room.lastUpdate,
                lastAuthor: room.lastAuthor,
                lastMessage: room.lastMessage,
                picture: room.picture,
                messages: messages.map((e) => {
                  if (e.author) {
                    return e;
                  } else {
                    return {
                      ...e,
                      author: {
                        firstName: 'Deleted',
                        lastName: 'User',
                      },
                    };
                  }
                }),
                images,
              },
            });
          })
          .catch((err) => {
            console.error(err);
            res.status(500).json({ error: 'Server error loading images.' });
          });
      })
      .catch((err) => {
        console.error(err);
        res.status(500).json({ error: 'Server error loading messages.' });
      });
  };

  // Room query includes companyId
  Room.findOne({ _id: id, companyId })
    .populate([{ path: 'picture', strictPopulate: false }])
    .populate({
      path: 'people',
      select: '-email -tagLine -password -friends -__v',
      populate: [
        {
          path: 'picture',
        },
      ],
    })
    .exec((err, room) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Server error.' });
      }
      if (!room) {
        return res.status(404).json({ error: 'Room not found.' });
      }

      // Check if user is a member of this room
      if (room.people.filter((person) => req.user.id.toString() === person._id.toString()).length === 0) {
        return res.status(403).json({ error: 'Access denied.' });
      }

      findMessagesAndEmit(room);
    });
};
