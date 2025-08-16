const Message = require('../models/Message');
const Room = require('../models/Room');
const store = require('../store');
const xss = require('xss');

module.exports = (req, res, next) => {
  const { roomID, authorID, content, type, fileID } = req.fields;
  const companyId = req.headers['x-company-id']; // Read from header

  // Validate required fields
  if (!roomID || !authorID || !companyId) {
    return res.status(400).json({
      error: 'Room ID, Author ID, and Company ID are required.',
    });
  }

  // Verify the room belongs to the same company before creating message
  Room.findOne({ _id: roomID, companyId })
    .then((room) => {
      if (!room) {
        return res.status(404).json({ error: 'Room not found or access denied.' });
      }

      // Check if user is a member of this room
      if (room.people.filter((person) => authorID.toString() === person.toString()).length === 0) {
        return res.status(403).json({ error: 'Access denied to this room.' });
      }

      // Create message with companyId
      Message({
        room: roomID,
        author: authorID,
        content: xss(content),
        type,
        file: fileID,
        companyId, // Include companyId
      })
        .save()
        .then((message) => {
          Message.findById(message._id)
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
            .then((message) => {
              // Update room with companyId check
              Room.findOneAndUpdate(
                { _id: roomID, companyId },
                {
                  $set: {
                    lastUpdate: message.date,
                    lastMessage: message._id,
                    lastAuthor: authorID,
                  },
                },
              )
                .then((room) => {
                  if (!room) {
                    return res.status(404).json({ error: 'Room update failed.' });
                  }

                  // Emit to room members (they're all in the same company)
                  room.people.forEach((person) => {
                    const myUserID = req.user.id;
                    const personUserID = person.toString();

                    if (personUserID !== myUserID) {
                      store.io.to(personUserID).emit('message-in', { status: 200, message, room });
                    }
                  });
                  res.status(200).json({ message, room });
                })
                .catch((err) => {
                  console.error(err);
                  return res.status(500).json({ error: 'Server error updating room.' });
                });
            })
            .catch((err) => {
              console.error(err);
              return res.status(500).json({ error: 'Server error loading message.' });
            });
        })
        .catch((err) => {
          console.error(err);
          return res.status(500).json({ error: 'Server error creating message.' });
        });
    })
    .catch((err) => {
      console.error(err);
      return res.status(500).json({ error: 'Server error verifying room.' });
    });
};
