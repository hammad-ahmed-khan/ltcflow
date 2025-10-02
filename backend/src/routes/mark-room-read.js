// backend/src/routes/mark-room-read.js
const Room = require("../models/Room");

module.exports = async (req, res) => {
  try {
    const { roomId } = req.fields;
    const userId = req.user.id;
    const companyId = req.headers["x-company-id"];

    console.log(`📖 Marking room as read: ${roomId} for user: ${userId}`);

    if (!companyId || !roomId) {
      return res
        .status(400)
        .json({ error: "Company ID and Room ID required." });
    }

    // Verify room exists and user has access
    const room = await Room.findOne({
      _id: roomId,
      companyId,
      $or: [{ people: userId }, { creator: userId, isGroup: true }],
    });

    if (!room) {
      console.log(`❌ Room not found or access denied: ${roomId}`);
      return res
        .status(404)
        .json({ error: "Room not found or access denied." });
    }

    // Check if user is a member (not just creator)
    const isMember = room.people.some(
      (personId) => personId.toString() === userId.toString()
    );

    if (!isMember) {
      console.log(
        `⚠️  User ${userId} is creator but not member of ${roomId}, skipping mark as read`
      );
      return res.json({
        success: true,
        message: "Creator is not a member, no action needed",
      });
    }

    // Remove old lastRead entry for this user (if exists)
    await Room.updateOne(
      { _id: roomId },
      { $pull: { lastReadByUser: { userId: userId } } }
    );

    // Add new lastRead entry with current timestamp
    await Room.updateOne(
      { _id: roomId },
      {
        $push: {
          lastReadByUser: {
            userId: userId,
            lastReadAt: new Date(),
          },
        },
      }
    );

    console.log(`✅ Room ${roomId} marked as read for user ${userId}`);

    res.json({ success: true });
  } catch (error) {
    console.error("❌ Error marking room as read:", error);
    res.status(500).json({ error: "Failed to mark room as read" });
  }
};
