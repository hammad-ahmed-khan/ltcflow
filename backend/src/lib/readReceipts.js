// backend/src/lib/readReceipts.js
//
// Central logic for WhatsApp-style read receipts. A recipient tells the server
// it has received ("delivered") or seen ("read") one or more messages; we
// record that on each Message (per-recipient, idempotent, never regressing),
// recompute the denormalized `status`, and push a `message-status` event to
// every room member so the author's tick updates in real time on all devices.
//
// The per-recipient arrays (`deliveredTo` / `readBy`) are what make this
// group-ready: a message only becomes "delivered"/"read" once every recipient
// (room.people minus the author) has reached that state. For a 1-to-1 room
// there is exactly one recipient, so it behaves exactly like WhatsApp.

const Message = require("../models/Message");
const Room = require("../models/Room");
const store = require("../store");

const RANK = { sent: 0, delivered: 1, read: 2 };

/**
 * Apply delivered/read receipts for one user across a set of messages.
 *
 * @param {Object}   params
 * @param {String}   params.roomID
 * @param {String}   params.userId      the recipient acknowledging the messages
 * @param {String[]} params.messageIds
 * @param {"delivered"|"read"} params.kind
 * @returns {Promise<Array>} the status updates that were broadcast
 */
async function applyReceipts({ roomID, userId, messageIds, kind }) {
  if (
    !roomID ||
    !userId ||
    !Array.isArray(messageIds) ||
    messageIds.length === 0
  ) {
    return [];
  }

  const room = await Room.findById(roomID).select("people").lean();
  if (!room) return [];

  // Recipients = everyone in the room except the author of a given message.
  // We compute the count per message below (author varies), but the room-wide
  // recipient count for a message authored by someone else is people-minus-1.
  const peopleIds = (room.people || []).map((p) => p.toString());

  // Only ever touch messages in this room that this user did NOT author —
  // you never mark your own message as delivered/read to yourself.
  const messages = await Message.find({
    _id: { $in: messageIds },
    room: roomID,
    author: { $ne: userId },
  })
    .select("author")
    .lean();

  const now = new Date();
  const updates = [];

  // Which prior states a transition is allowed to advance FROM. Using this as
  // a query guard makes every status write atomic and strictly forward-only,
  // so an out-of-order "delivered" can never clobber a "read" (req 8).
  const ADVANCE_FROM = { delivered: ["sent"], read: ["sent", "delivered"] };

  for (const msg of messages) {
    // 1) Record this recipient idempotently. The `$ne` guard means a repeat
    //    acknowledgement is a no-op, and entries are only ever added.
    await Message.updateOne(
      { _id: msg._id, "deliveredTo.user": { $ne: userId } },
      { $push: { deliveredTo: { user: userId, at: now } } },
    );
    if (kind === "read") {
      await Message.updateOne(
        { _id: msg._id, "readBy.user": { $ne: userId } },
        { $push: { readBy: { user: userId, at: now } } },
      );
    }

    // 2) Re-read the fresh arrays and recompute the aggregate status.
    const fresh = await Message.findById(msg._id)
      .select("deliveredTo readBy status deliveredAt readAt author")
      .lean();
    if (!fresh) continue;

    const recipientCount = Math.max(
      1,
      peopleIds.filter((id) => id !== fresh.author.toString()).length,
    );

    let newStatus = "sent";
    if ((fresh.readBy || []).length >= recipientCount) newStatus = "read";
    else if ((fresh.deliveredTo || []).length >= recipientCount)
      newStatus = "delivered";

    if (RANK[newStatus] <= RANK[fresh.status || "sent"]) continue;

    // 3) Advance the denormalized status atomically (forward-only).
    const set = { status: newStatus };
    if (newStatus === "delivered" && !fresh.deliveredAt) set.deliveredAt = now;
    if (newStatus === "read") {
      if (!fresh.readAt) set.readAt = now;
      if (!fresh.deliveredAt) set.deliveredAt = now;
    }

    const result = await Message.updateOne(
      { _id: msg._id, status: { $in: ADVANCE_FROM[newStatus] } },
      { $set: set },
    );

    if (result.modifiedCount > 0) {
      updates.push({
        roomID: roomID.toString(),
        messageId: msg._id.toString(),
        status: newStatus,
        deliveredAt: set.deliveredAt || fresh.deliveredAt || null,
        readAt: set.readAt || fresh.readAt || null,
      });
    }
  }

  // Notify every room member's personal socket room. The author needs this to
  // move its tick; broadcasting to all members keeps every device/tab in sync
  // and is forward-compatible with per-member group indicators.
  if (updates.length && store.io) {
    peopleIds.forEach((pid) => {
      updates.forEach((u) => store.io.to(pid).emit("message-status", u));
    });
  }

  return updates;
}

module.exports = { applyReceipts };
