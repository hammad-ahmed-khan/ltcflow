// backend/src/routes/calls/missed-clear.js
const Meeting = require("../../models/Meeting");

// Clear All = soft-hide. We set hiddenAt on the user's own missed participant
// entries so the call history is preserved but the entries leave the Missed tab.
module.exports = async (req, res) => {
  try {
    const userId = String(req.user.id);
    const companyId = req.headers["x-company-id"];
    if (!companyId) {
      return res.status(400).json({ success: false, error: "Company ID required." });
    }
    const now = new Date();

    await Meeting.updateMany(
      {
        companyId,
        participants: {
          $elemMatch: { user: userId, status: "missed", hiddenAt: null },
        },
      },
      { $set: { "participants.$[elem].hiddenAt": now } },
      { arrayFilters: [{ "elem.user": userId, "elem.status": "missed" }] }
    );

    res.json({ success: true });
  } catch (e) {
    console.error("missed calls clear error:", e);
    res.status(500).json({ success: false, error: "Failed to clear missed calls" });
  }
};
