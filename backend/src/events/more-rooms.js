const Room = require("../models/Room");
const User = require("../models/User");

module.exports = async (socket, data) => {
  console.log("Received more-rooms event", JSON.stringify(data));

  let { roomID } = data;
  const userId = socket.decoded_token.id;

  try {
    // Get user's company
    const user = await User.findById(userId).select("companyId");
    if (!user) {
      return socket.emit("more-rooms", {
        status: 404,
        error: "User not found",
      });
    }

    const companyId = user.companyId;

    // Find rooms with company filtering
    Room.find({
      companyId, // Filter by company
      people: { $in: [userId] },
      lastMessage: { $ne: null },
      lastUpdate: { $lt: roomID },
    })
      .sort({ lastUpdate: -1 })
      .limit(20)
      .populate({
        path: "people",
        select: "-email -password -friends -__v",
        match: { companyId }, // Only populate people from same company
        populate: {
          path: "picture",
        },
      })
      .populate({
        path: "lastMessage",
        match: { companyId }, // Only populate messages from same company
      })
      .then((rooms) => {
        socket.emit("more-rooms", { status: 200, rooms });
      })
      .catch((err) => {
        console.error("Error fetching more rooms:", err);
        socket.emit("more-rooms", { status: 500, error: "Server error" });
      });
  } catch (error) {
    console.error("Error in more-rooms event:", error);
    socket.emit("more-rooms", { status: 500, error: "Server error" });
  }
};
