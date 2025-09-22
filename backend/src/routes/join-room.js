const Message = require("../models/Message");
const Room = require("../models/Room");

module.exports = (req, res, next) => {
  let { id } = req.fields;
  const companyId = req.headers["x-company-id"];

  // Validate required fields
  if (!id) {
    return res.status(400).json({ error: "Room ID required." });
  }
  if (!companyId) {
    return res.status(400).json({ error: "Company ID required." });
  }

  const findMessagesAndEmit = (room) => {
    // Messages query includes companyId
    Message.find({ room: room._id, companyId })
      .sort({ _id: -1 })
      .limit(50)
      .populate({
        path: "author",
        select: "-email -password -friends -__v",
        populate: [
          {
            path: "picture",
          },
        ],
      })
      .populate([{ path: "file", strictPopulate: false }])
      .lean()
      .then((messages) => {
        messages.reverse();
        // Images query also includes companyId
        Message.find({ room: room._id, type: "image", companyId })
          .sort({ _id: -1 })
          .limit(50)
          .populate({
            path: "author",
            select: "-email -password -friends -__v",
            populate: {
              path: "picture",
            },
          })
          .then((images) => {
            res.status(200).json({
              room: {
                _id: room._id,
                people: room.people,
                title: room.title,
                isGroup: room.isGroup,
                lastUpdate: room.lastUpdate,
                lastAuthor: room.lastAuthor,
                lastMessage: room.lastMessage,
                picture: room.picture,
                creator: room.creator, // Include creator info
                messages: messages.map((e) => {
                  if (e.author) {
                    return e;
                  } else {
                    return {
                      ...e,
                      author: {
                        firstName: "Deleted",
                        lastName: "User",
                      },
                    };
                  }
                }),
                images,
              },
            });
          })
          .catch((err) => {
            console.error(err);
            res.status(500).json({ error: "Server error loading images." });
          });
      })
      .catch((err) => {
        console.error(err);
        res.status(500).json({ error: "Server error loading messages." });
      });
  };

  // Room query includes companyId and populates creator
  Room.findOne({ _id: id, companyId })
    .populate([{ path: "picture", strictPopulate: false }])
    .populate({
      path: "people",
      select: "-email -tagLine -password -friends -__v",
      populate: [
        {
          path: "picture",
        },
      ],
    })
    .populate({
      path: "creator", // Populate creator info
      select: "firstName lastName username email",
    })
    .exec((err, room) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "Server error." });
      }
      if (!room) {
        return res.status(404).json({ error: "Room not found." });
      }

      // Updated permission check: Allow access if user is a member OR the creator
      const isGroupMember =
        room.people.filter(
          (person) => req.user.id.toString() === person._id.toString()
        ).length > 0;
      const isCreator =
        room.creator && room.creator._id.toString() === req.user.id.toString();

      // For groups: Allow access if user is member or creator
      // For direct rooms: Only allow if user is member
      const hasAccess = room.isGroup
        ? isGroupMember || isCreator
        : isGroupMember;

      if (!hasAccess) {
        return res.status(403).json({ error: "Access denied." });
      }

      findMessagesAndEmit(room);
    });
};
