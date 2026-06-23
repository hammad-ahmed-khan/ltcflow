// backend/src/events/message-read.js
// A recipient reports that messages became visible in an open conversation
// (double blue tick). Read implies delivered, handled in applyReceipts.
const { applyReceipts } = require("../lib/readReceipts");

module.exports = async (socket, data) => {
  try {
    const userId = socket.decoded_token.id;
    const { roomID, messageIds } = data || {};
    await applyReceipts({ roomID, userId, messageIds, kind: "read" });
  } catch (err) {
    console.error("message-read error:", err);
  }
};
