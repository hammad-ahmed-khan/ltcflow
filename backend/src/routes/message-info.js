// backend/src/routes/message-info.js
//
// WhatsApp-style "Message Info": returns the per-recipient delivery/read
// breakdown for a single message. Only the message's author may view it.
const Message = require("../models/Message");
const Room = require("../models/Room");

module.exports = async (req, res) => {
  try {
    const { messageId } = req.fields;
    const companyId = req.headers["x-company-id"];
    const userId = req.user.id;

    if (!companyId || !messageId) {
      return res
        .status(400)
        .json({ error: "Company ID and message ID required." });
    }

    const message = await Message.findOne({ _id: messageId, companyId })
      .populate({
        path: "readBy.user",
        select: "firstName lastName username picture",
        populate: { path: "picture" },
      })
      .populate({
        path: "deliveredTo.user",
        select: "firstName lastName username picture",
        populate: { path: "picture" },
      })
      .lean();

    if (!message) {
      return res.status(404).json({ error: "Message not found." });
    }

    // Receipts are private to the sender (same as WhatsApp).
    if (message.author.toString() !== userId.toString()) {
      return res
        .status(403)
        .json({ error: "Only the sender can view message info." });
    }

    const room = await Room.findOne({ _id: message.room, companyId })
      .populate({
        path: "people",
        select: "firstName lastName username picture",
        populate: { path: "picture" },
      })
      .lean();

    if (!room) {
      return res.status(404).json({ error: "Room not found." });
    }

    // Read (has a read timestamp).
    const readBy = (message.readBy || [])
      .filter((r) => r.user)
      .map((r) => ({ user: r.user, at: r.at }))
      .sort((a, b) => new Date(b.at) - new Date(a.at));
    const readIds = new Set(readBy.map((r) => r.user._id.toString()));

    // Delivered but not yet read.
    const delivered = (message.deliveredTo || [])
      .filter((d) => d.user && !readIds.has(d.user._id.toString()))
      .map((d) => ({ user: d.user, at: d.at }))
      .sort((a, b) => new Date(b.at) - new Date(a.at));
    const deliveredIds = new Set(
      (message.deliveredTo || [])
        .filter((d) => d.user)
        .map((d) => d.user._id.toString()),
    );

    // Everyone else in the room who hasn't even received it yet.
    const authorId = message.author.toString();
    const pending = (room.people || [])
      .filter(
        (p) =>
          p._id.toString() !== authorId &&
          !readIds.has(p._id.toString()) &&
          !deliveredIds.has(p._id.toString()),
      )
      .map((p) => ({ user: p }));

    res.json({
      messageId: message._id.toString(),
      isGroup: !!room.isGroup,
      status: message.status || "sent",
      sentAt: message.sentAt || message.date,
      readBy,
      delivered,
      pending,
    });
  } catch (error) {
    console.error("❌ Error in message-info:", error);
    res.status(500).json({ error: "Failed to load message info." });
  }
};
