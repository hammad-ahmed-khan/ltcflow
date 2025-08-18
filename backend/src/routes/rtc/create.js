const store = require("../../store");

module.exports = async (req, res, next) => {
  // Extract companyId from header
  const companyId = req.headers["x-company-id"];

  if (!companyId) {
    return res.status(400).json({
      error: true,
      message: "Company ID is required",
    });
  }

  const room = await store.rooms.asyncInsert({
    users: [req.user.id],
    companyId, // Add company isolation
  });

  res.status(200).send(room);
};
