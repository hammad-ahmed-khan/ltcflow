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

  // Note: Peers in NeDB don't have companyId field by default
  // You may need to modify peer storage to include companyId
  const peers = await store.peers.asyncFind({});

  res.status(200).send(peers);
};
