const Room = require("../models/Room");
const xss = require("xss");

module.exports = async (req, res) => {
  try {
    const { people, title, picture } = req.fields;
    const companyId = req.headers["x-company-id"]; // read from header

    if (!companyId) {
      return res
        .status(400)
        .json({ status: 400, error: "COMPANY_ID_REQUIRED" });
    }

    // Create new room with companyId
    const room = await new Room({
      people,
      isGroup: true,
      title: xss(title),
      picture,
      companyId, // associate room with company
    }).save();

    // Populate people field
    const populatedRoom = await Room.findOne({ _id: room._id }).populate(
      "people"
    );

    res.status(200).json(populatedRoom);
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ status: 500, error: "UNKNOWN_ERROR", details: err.message });
  }
};
