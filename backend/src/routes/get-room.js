// backend/src/routes/get-room.js
const Room = require("../models/Room");

module.exports = async (req, res, next) => {
  try {
    const { id } = req.fields;
    const companyId = req.headers["x-company-id"];

    if (!companyId) {
      return res
        .status(400)
        .json({ status: 400, error: "COMPANY_ID_REQUIRED" });
    }

    const room = await Room.findOne({ _id: id, companyId })
      .populate([{ path: "picture", strictPopulate: false }])
      .populate({
        path: "people",
        select: "-email -password -friends -__v",
        populate: { path: "picture" },
      })
      .populate({
        path: "creator", // Add creator population
        select: "firstName lastName username email",
      })
      .populate("lastMessage")
      .sort({ lastUpdate: -1 });

    if (!room) {
      return res.status(404).json({ status: 404, error: "ROOM_NOT_FOUND" });
    }

    res.status(200).json({ room });
  } catch (err) {
    console.error("Error fetching room:", err);
    res
      .status(500)
      .json({ status: 500, error: "UNKNOWN_ERROR", details: err.message });
  }
};
