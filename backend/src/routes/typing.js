const store = require("../store");
const Room = require("../models/Room");
const User = require("../models/User");

// In-memory store for typing users per room
const typingStore = new Map();

module.exports = async (req, res, next) => {
  console.log("🚀 TYPING ROUTE CALLED");
  console.log("📝 Request fields:", req.fields);
  console.log("👤 Request user:", req.user);

  const roomObj = req.fields.room;
  const companyId = req.headers["x-company-id"];
  const isTyping = req.fields.isTyping;

  // FIX: Handle null room object
  if (!roomObj || !roomObj._id) {
    console.log("❌ Invalid room object:", roomObj);
    return res.status(400).json({
      error: "Invalid room data provided",
    });
  }

  const roomID = roomObj._id;

  console.log("🏠 Room ID:", roomID);
  console.log("⌨️  Is Typing:", isTyping);

  try {
    // Find room
    const room = await Room.findOne({ _id: roomID, companyId });
    console.log("🏢 Found room:", room ? "YES" : "NO");

    if (!room) {
      return res
        .status(404)
        .json({ error: "Room not found or access denied." });
    }

    // Check if user is member
    const isMember =
      room.people.filter(
        (person) => req.user.id.toString() === person.toString()
      ).length > 0;
    console.log("👥 User is member:", isMember);

    if (!isMember) {
      return res.status(403).json({ error: "Access denied to this room." });
    }

    // Get full user info
    console.log("🔍 Looking up user ID:", req.user.id);
    const currentUser = await User.findById(req.user.id).select(
      "firstName lastName username"
    );
    console.log("👤 Found user in database:", currentUser);

    const userInfo = {
      id: req.user.id,
      _id: req.user.id,
      firstName: currentUser?.firstName || req.user.firstName || "User",
      lastName: currentUser?.lastName || req.user.lastName || "",
      username: currentUser?.username || req.user.username || "user",
      timestamp: Date.now(),
    };

    console.log("✅ Final user info object:", userInfo);

    // Initialize typing store
    if (!typingStore.has(roomID)) {
      typingStore.set(roomID, new Map());
      console.log("🆕 Created new typing store for room:", roomID);
    }

    const roomTypingUsers = typingStore.get(roomID);
    console.log(
      "📊 Current typing users in room:",
      Array.from(roomTypingUsers.keys())
    );

    if (isTyping) {
      roomTypingUsers.set(req.user.id, userInfo);
      console.log("➕ Added user to typing list");

      // Auto-cleanup timeout
      setTimeout(() => {
        if (roomTypingUsers.has(req.user.id)) {
          const userTyping = roomTypingUsers.get(req.user.id);
          if (userTyping.timestamp <= Date.now() - 9000) {
            roomTypingUsers.delete(req.user.id);
            console.log("🧹 Auto-removed user from typing list");
            broadcastTypingUpdate(roomID, roomTypingUsers, room.people);
          }
        }
      }, 10000);
    } else {
      roomTypingUsers.delete(req.user.id);
      console.log("➖ Removed user from typing list");
    }

    // Broadcast update
    broadcastTypingUpdate(roomID, roomTypingUsers, room.people);

    res.status(200).json({ status: "success", message: "Typing status sent." });
  } catch (err) {
    console.error("❌ Typing route error:", err);
    res.status(500).json({ error: "Server error." });
  }
};

function broadcastTypingUpdate(roomID, roomTypingUsers, roomPeople) {
  const typingUsersArray = Array.from(roomTypingUsers.values()).slice(0, 5);

  console.log("📡 BROADCASTING TO ROOM:", roomID);
  console.log("👥 Typing users array:", typingUsersArray);

  const payload = {
    roomID,
    typingUsers: typingUsersArray,
    isTyping: typingUsersArray.length > 0,
  };

  console.log("📦 Full payload being sent:", payload);

  roomPeople.forEach((person) => {
    console.log("📨 Sending to person:", person.toString());
    store.io.to(person.toString()).emit("typing", payload);
  });

  console.log("✅ Broadcast complete");
}
