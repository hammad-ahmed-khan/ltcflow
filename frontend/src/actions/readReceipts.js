// frontend/src/actions/readReceipts.js
// Thin helpers to tell the server that messages were delivered to / read by
// the current user. Both are fire-and-forget; the server dedups and replies
// with `message-status` events, so over-emitting is harmless.

export const emitDelivered = (io, roomID, messageIds) => {
  if (!io || !roomID || !Array.isArray(messageIds) || messageIds.length === 0) return;
  io.emit("message-delivered", { roomID, messageIds });
};

export const emitRead = (io, roomID, messageIds) => {
  if (!io || !roomID || !Array.isArray(messageIds) || messageIds.length === 0) return;
  io.emit("message-read", { roomID, messageIds });
};
