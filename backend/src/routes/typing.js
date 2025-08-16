const store = require('../store');
const Room = require('../models/Room');

module.exports = async (req, res, next) => {
  const roomObj = req.fields.room;
  const companyId = req.headers["x-company-id"]; // Read from header

  if (!roomObj) {
    return res.status(400).json({ error: 'Room object required.' });
  }
  if (!companyId) {
    return res.status(400).json({ error: 'Company ID required.' });
  }

  const roomID = roomObj._id;
  const isTyping = req.fields.isTyping;

  if (!roomID) {
    return res.status(400).json({ error: 'Room ID required.' });
  }

  try {
    // Find room with companyId check to ensure data isolation
    const room = await Room.findOne({ _id: roomID, companyId });
    
    if (!room) {
      return res.status(404).json({ error: 'Room not found or access denied.' });
    }

    // Check if user is a member of this room
    if (room.people.filter((person) => req.user.id.toString() === person.toString()).length === 0) {
      return res.status(403).json({ error: 'Access denied to this room.' });
    }

    // Emit typing status to other room members (all in same company)
    room.people.forEach((person) => {
      if (person.toString() !== req.user.id.toString()) {
        store.io.to(person.toString()).emit('typing', { 
          id: req.user.id, 
          roomID, 
          isTyping 
        });
      }
    });

    res.status(200).json({ status: 'success', message: 'Typing status sent.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
};