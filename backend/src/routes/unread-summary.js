// backend/src/routes/unread-summary.js
const Room = require("../models/Room");
const Message = require("../models/Message");

// 🆕 CUT-OFF DATE: Messages before this date will NEVER show as unread
const UNREAD_CUTOFF_DATE = new Date("2025-10-01T00:00:00Z"); // ⚠️ SET YOUR DEPLOYMENT DATE HERE

module.exports = async (req, res) => {
  try {
    const userId = req.user.id;
    const companyId = req.headers["x-company-id"];

    console.log(`\n============================================`);
    console.log(`📊 UNREAD SUMMARY REQUEST`);
    console.log(`User ID: ${userId}`);
    console.log(`Company ID: ${companyId}`);
    console.log(`📅 Cut-off Date: ${UNREAD_CUTOFF_DATE.toISOString()}`); // 🆕 LOG CUT-OFF
    console.log(`============================================\n`);

    if (!companyId) {
      console.log("❌ No company ID provided");
      return res.status(400).json({ error: "Company ID required." });
    }

    // Find all rooms where user is a member or creator
    const rooms = await Room.find({
      companyId,
      $or: [{ people: userId }, { creator: userId, isGroup: true }],
    })
      .select("_id isGroup lastReadByUser people title")
      .lean();

    console.log(`📦 Found ${rooms.length} total rooms for user`);

    const unreadRooms = [];
    const unreadGroups = [];
    let totalChecked = 0;

    for (const room of rooms) {
      totalChecked++;

      console.log(`\n--- Checking Room ${totalChecked}/${rooms.length} ---`);
      console.log(`Room ID: ${room._id}`);
      console.log(`Title: ${room.title || "Direct Message"}`);
      console.log(`Is Group: ${room.isGroup}`);

      // Check if user is a member
      const isMember = room.people.some(
        (personId) => personId.toString() === userId.toString()
      );

      console.log(`Is Member: ${isMember}`);

      if (!isMember) {
        console.log(`⏭️  Skipping - not a member`);
        continue;
      }

      // Find user's last read time
      const userLastRead = room.lastReadByUser?.find(
        (lr) => lr.userId.toString() === userId.toString()
      );

      const lastReadTime = userLastRead?.lastReadAt || new Date(0);

      // 🆕 CRITICAL: Use cut-off date as minimum baseline
      // If user never read (or read before cut-off), use cut-off date
      // This prevents old messages from showing as unread
      const effectiveReadTime =
        lastReadTime > UNREAD_CUTOFF_DATE ? lastReadTime : UNREAD_CUTOFF_DATE;

      console.log(`User Last Read: ${lastReadTime}`);
      console.log(`Effective Read Time (with cut-off): ${effectiveReadTime}`);

      // 🆕 Only count messages from others AFTER the effective read time
      const newMessageCount = await Message.countDocuments({
        room: room._id,
        author: { $ne: userId },
        createdAt: { $gt: effectiveReadTime }, // Uses cut-off if lastReadTime is older
      });

      console.log(
        `New Messages from Others (after cut-off): ${newMessageCount}`
      );

      if (newMessageCount > 0) {
        console.log(`🔔 UNREAD DETECTED!`);

        if (room.isGroup) {
          unreadGroups.push(room._id.toString());
        } else {
          unreadRooms.push(room._id.toString());
        }
      } else {
        console.log(`✅ No unread messages`);
      }
    }

    console.log(`\n============================================`);
    console.log(`📊 FINAL RESULTS:`);
    console.log(`Total Rooms Checked: ${totalChecked}`);
    console.log(`Unread Direct Chats: ${unreadRooms.length}`);
    console.log(`Unread Groups: ${unreadGroups.length}`);
    console.log(`Unread Room IDs:`, unreadRooms);
    console.log(`Unread Group IDs:`, unreadGroups);
    console.log(
      `📅 Cut-off Protected: Messages before ${UNREAD_CUTOFF_DATE.toISOString()} ignored`
    );
    console.log(`============================================\n`);

    res.json({
      success: true,
      unreadRooms,
      unreadGroups,
      totalUnread: unreadRooms.length + unreadGroups.length,
    });
  } catch (error) {
    console.error("❌ ERROR in unread-summary:", error);
    res.status(500).json({ error: "Failed to fetch unread summary" });
  }
};
