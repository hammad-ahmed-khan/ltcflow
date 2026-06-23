// backend/src/events/message-delivered.js
// A recipient reports that messages reached their device (double gray tick).
const { applyReceipts } = require("../lib/readReceipts");

module.exports = async (socket, data) => {
  try {
    const userId = socket.decoded_token.id;
    const { roomID, messageIds } = data || {};
    await applyReceipts({ roomID, userId, messageIds, kind: "delivered" });
  } catch (err) {
    console.error("message-delivered error:", err);
  }
};
