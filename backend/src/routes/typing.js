// backend/src/routes/typing.js
const Room = require("../models/Room");
const User = require("../models/User");
const store = require("../store");

// In-memory store for typing users per room
const typingStore = new Map();

module.exports = async (req, res) => {
  try {
    const { room, isTyping } = req.fields;
    const roomID = room._id;

    console.log("📝 TYPING REQUEST:", {
      roomID,
      userId: req.user.id,
      isTyping,
      timestamp: new Date().toISOString(),
    });

    // Verify room exists and user has access
    const roomDoc = await Room.findOne({
      _id: roomID,
      people: req.user.id,
      companyId: req.user.companyId,
    });

    console.log("🔍 Room found:", roomDoc ? "YES" : "NO");

    if (!roomDoc) {
      return res
        .status(404)
        .json({ error: "Room not found or access denied." });
    }

    // Check if user is member
    const isMember =
      roomDoc.people.filter(
        (person) => req.user.id.toString() === person.toString()
      ).length > 0;
    console.log("👥 User is member:", isMember);

    if (!isMember) {
      return res.status(403).json({ error: "Access denied to this room." });
    }

    // Get full user info WITH PICTURE populated
    console.log("🔍 Looking up user ID:", req.user.id);
    const currentUser = await User.findById(req.user.id)
      .select("firstName lastName username picture")
      .populate("picture"); // 🔧 FIX: Populate the picture field

    console.log("👤 Found user in database:", {
      id: currentUser?._id,
      name: `${currentUser?.firstName} ${currentUser?.lastName}`,
      hasPicture: !!currentUser?.picture,
    });

    // 🔧 FIX: Include picture in userInfo object
    const userInfo = {
      id: req.user.id,
      _id: req.user.id,
      firstName: currentUser?.firstName || req.user.firstName || "User",
      lastName: currentUser?.lastName || req.user.lastName || "",
      username: currentUser?.username || req.user.username || "user",
      picture: currentUser?.picture || undefined, // 🔧 ADD THIS LINE
      timestamp: Date.now(),
    };

    console.log("✅ Final user info object:", {
      ...userInfo,
      hasPicture: !!userInfo.picture,
    });

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
            broadcastTypingUpdate(roomID, roomTypingUsers, roomDoc.people);
          }
        }
      }, 10000);
    } else {
      roomTypingUsers.delete(req.user.id);
      console.log("➖ Removed user from typing list");
    }

    // Broadcast update
    broadcastTypingUpdate(roomID, roomTypingUsers, roomDoc.people);

    res.status(200).json({ status: "success", message: "Typing status sent." });
  } catch (err) {
    console.error("❌ Typing route error:", err);
    res.status(500).json({ error: "Server error." });
  }
};

function broadcastTypingUpdate(roomID, roomTypingUsers, roomPeople) {
  const typingUsersArray = Array.from(roomTypingUsers.values()).slice(0, 5);

  console.log("📡 BROADCASTING TO ROOM:", roomID);
  console.log("👥 Typing users array:", typingUsersArray.length, "users");
  console.log(
    "🖼️ Users with pictures:",
    typingUsersArray.filter((u) => u.picture).length
  );

  const payload = {
    roomID,
    typingUsers: typingUsersArray,
    isTyping: typingUsersArray.length > 0,
  };

  roomPeople.forEach((person) => {
    console.log("📨 Sending to person:", person.toString());
    store.io.to(person.toString()).emit("typing", payload);
  });

  console.log("✅ Broadcast complete");
}
