const store = require("../../store");

module.exports = async (req, res, next) => {
  const { id } = req.fields;

  // Extract companyId from header
  const companyId = req.headers["x-company-id"];

  if (!companyId) {
    return res.status(400).json({
      error: true,
      message: "Company ID is required",
    });
  }

  let room;

  try {
    // Find room with company filtering
    room = await store.rooms.asyncFindOne({
      _id: id,
      companyId,
    });

    if (!room) {
      return res.status(404).json({
        error: true,
        message: "RTC room not found in company",
      });
    }

    if (!room.users.includes(req.user.id)) {
      await store.rooms.asyncUpdate(
        { _id: id, companyId },
        { $push: { users: req.user.id } }
      );
      room = await store.rooms.asyncFindOne({
        _id: id,
        companyId,
      });
    }
  } catch (e) {
    console.log(e);
    return res.status(500).json({
      error: true,
      message: "Error joining room",
    });
  }

  res.status(200).json(room);
};
