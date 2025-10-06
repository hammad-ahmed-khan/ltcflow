// backend/src/routes/get-room-media.js
const Message = require("../models/Message");
const Room = require("../models/Room");
const User = require("../models/User");

module.exports = async (req, res) => {
  try {
    const { roomId } = req.fields;
    const companyId = req.headers["x-company-id"];
    const userId = req.user.id;

    if (!roomId) {
      return res.status(400).json({ error: "Room ID required." });
    }

    if (!companyId) {
      return res.status(400).json({ error: "Company ID required." });
    }

    // Verify user has access to this room
    const room = await Room.findOne({
      _id: roomId,
      companyId,
      $or: [
        { people: { $in: [userId] } },
        { creator: userId, isGroup: true }
      ]
    });

    if (!room) {
      return res.status(403).json({ error: "Access denied." });
    }

    // Fetch ALL images (no limit)
    const images = await Message.find({
      room: roomId,
      type: "image",
      companyId,
      isDeleted: { $ne: true }
    })
      .sort({ _id: -1 })
      .select("_id content date author type")
      .populate({
        path: "author",
        select: "firstName lastName username",
        populate: {
          path: "picture",
          select: "shieldedID"
        }
      })
      .lean();

    // Fetch ALL files (no limit)
    const files = await Message.find({
      room: roomId,
      type: "file",
      companyId,
      isDeleted: { $ne: true }
    })
      .sort({ _id: -1 })
      .select("_id content date author type file fileName fileSize")
      .populate({
        path: "author",
        select: "firstName lastName username"
      })
      .populate({
        path: "file",
        select: "name size mimeType"
      })
      .lean();

    // Fetch messages with links (text messages only)
    const textMessages = await Message.find({
      room: roomId,
      type: "text",
      companyId,
      isDeleted: { $ne: true },
      content: { $regex: /(https?:\/\/[^\s]+)/i }
    })
      .sort({ _id: -1 })
      .limit(100) // Limit links to last 100 for performance
      .select("_id content date author type")
      .populate({
        path: "author",
        select: "firstName lastName username"
      })
      .lean();

    res.status(200).json({
      images,
      files,
      links: textMessages
    });

  } catch (error) {
    console.error("Error fetching room media:", error);
    res.status(500).json({ error: "Server error fetching media." });
  }
};