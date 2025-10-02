const Room = require("../models/Room");
const User = require("../models/User");
const xss = require("xss");

module.exports = async (req, res) => {
  try {
    const { people, title, picture, includeCreator = true } = req.fields;
    const companyId = req.headers["x-company-id"];

    if (!companyId) {
      return res
        .status(400)
        .json({ status: 400, error: "COMPANY_ID_REQUIRED" });
    }

    if (!["manager", "admin", "root"].includes(req.user.level)) {
      return res.status(403).json({
        error: "INSUFFICIENT_PERMISSIONS",
        message: "Only managers and administrators can create groups",
      });
    }

    const creatorId = req.user.id;

    // Determine final group members
    let finalPeople = people || [];

    // If includeCreator is true (default), add creator to the group members
    if (includeCreator && !finalPeople.includes(creatorId)) {
      finalPeople.push(creatorId);
    }

    // If includeCreator is false, remove creator from members if they were included
    if (!includeCreator) {
      finalPeople = finalPeople.filter((userId) => userId !== creatorId);
    }

    // Create new room with creator field
    const room = await new Room({
      people: finalPeople,
      isGroup: true,
      title: xss(title),
      picture,
      companyId,
      creator: creatorId,

      // 🆕 NEW: Initialize lastReadByUser for all members
      lastReadByUser: finalPeople.map((userId) => ({
        userId: userId,
        lastReadAt: new Date(), // Everyone starts with "read" status
      })),
    }).save();

    // Populate people field
    const populatedRoom = await Room.findOne({ _id: room._id })
      .populate("people")
      .populate("creator", "firstName lastName username email");

    console.log(
      `📊 Group "${title}" created by ${req.user.username} (creator in group: ${includeCreator})`
    );

    res.status(200).json(populatedRoom);
  } catch (err) {
    console.error("Create group error:", err);
    res
      .status(500)
      .json({ status: 500, error: "UNKNOWN_ERROR", details: err.message });
  }
};
