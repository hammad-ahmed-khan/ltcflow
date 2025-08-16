const Message = require('../models/Message');
const Room = require('../models/Room');

module.exports = async (req, res, next) => {
  let { id } = req.fields;
  const companyId = req.headers["x-company-id"]; // Read from header

  // Validate required fields
  if (!id) {
    return res.status(400).json({ status: 'error', message: 'Room ID required.' });
  }
  if (!companyId) {
    return res.status(400).json({ status: 'error', message: 'Company ID required.' });
  }

  try {
    // Delete room with companyId check to ensure data isolation
    const deletedRoom = await Room.findOneAndDelete({ _id: id, companyId });
    if (!deletedRoom) {
      return res.status(404).json({ status: 'error', message: 'Room not found or access denied.' });
    }
  } catch (e) {
    console.error(e);
    return res.status(500).json({ status: 'error', message: 'Error while deleting room.' });
  }

  try {
    // Delete all messages in the room with companyId check
    await Message.deleteMany({ room: id, companyId });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ status: 'error', message: 'Error while deleting messages.' });
  }

  res.status(200).json({ status: 'success', message: 'Room deleted successfully.' });
};