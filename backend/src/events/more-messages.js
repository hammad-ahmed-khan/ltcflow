const Message = require("../models/Message");
const Room = require("../models/Room");
const User = require("../models/User");

module.exports = async (socket, data) => {
  console.log("Received more-messages event", JSON.stringify(data));

  let { roomID, messageID } = data;
  const userId = socket.decoded_token.id;

  try {
    // Get user's company
    const user = await User.findById(userId).select("companyId");
    if (!user) {
      return socket.emit("more-messages", {
        status: 404,
        error: "User not found",
      });
    }

    const companyId = user.companyId;

    // Verify room belongs to user's company
    const room = await Room.findOne({
      _id: roomID,
      companyId,
      people: { $in: [userId] },
    });

    if (!room) {
      return socket.emit("more-messages", {
        status: 404,
        error: "Room not found",
      });
    }

    // Find messages with company filtering
    Message.find({
      room: roomID,
      companyId, // Filter by company
      _id: { $lt: messageID },
    })
      .sort({ _id: -1 })
      .limit(20)
      .populate({
        path: "author",
        select: "-email -password -friends -__v",
        match: { companyId }, // Only populate authors from same company
        populate: {
          path: "picture",
        },
      })
      .then((messages) => {
        messages.reverse();
        socket.emit("more-messages", { status: 200, messages });
      })
      .catch((err) => {
        console.error("Error fetching more messages:", err);
        socket.emit("more-messages", { status: 500, error: "Server error" });
      });
  } catch (error) {
    console.error("Error in more-messages event:", error);
    socket.emit("more-messages", { status: 500, error: "Server error" });
  }
};
