const Message = require("../models/Message");
const Room = require("../models/Room");
const xss = require("xss");

module.exports = async (req, res, next) => {
  try {
    const { counterpart } = req.fields;
    const companyId = req.headers["x-company-id"];

    if (!companyId) {
      return res
        .status(400)
        .json({ status: 400, error: "COMPANY_ID_REQUIRED" });
    }

    const findMessagesAndEmit = async (room) => {
      // Fetch last 50 messages
      const messages = await Message.find({ room: room._id, companyId })
        .sort({ _id: -1 })
        .limit(50)
        .populate({
          path: "author",
          select: "-email -password -friends -__v",
          populate: { path: "picture" },
        })
        .populate([{ path: "file", strictPopulate: false }]);

      // Fetch last 50 images
      const images = await Message.find({
        room: room._id,
        type: "image",
        companyId,
      })
        .sort({ _id: -1 })
        .limit(50)
        .populate({
          path: "author",
          select: "-email -password -friends -__v",
          populate: { path: "picture" },
        });

      messages.reverse();

      res.status(200).json({
        room: {
          _id: room._id,
          people: room.people,
          title: xss(room.title),
          isGroup: room.isGroup,
          lastUpdate: room.lastUpdate,
          lastAuthor: room.lastAuthor,
          lastMessage: room.lastMessage,
          messages,
          images,
        },
      });
    };

    // Find or create the room
    let room = await Room.findOne({
      people: { $all: [req.user.id, counterpart] },
      isGroup: false,
      companyId, // ensure room belongs to the company
    }).populate({
      path: "people",
      select: "-email -password -friends -__v",
      populate: { path: "picture" },
    });

    if (!room) {
      room = await new Room({
        people: [req.user.id, counterpart],
        isGroup: false,
        companyId, // associate room with company
      }).save();

      room = await Room.findOne({ _id: room._id }).populate("people");
    }

    await findMessagesAndEmit(room);
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ status: 500, error: "UNKNOWN_ERROR", details: err.message });
  }
};
