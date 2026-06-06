// backend/src/routes/calls/missed-seen.js
const Meeting = require("../../models/Meeting");

// Marks the user's unseen missed entries as seen (clears the tab badge). The
// entries stay visible in the Missed tab until the user uses Clear All.
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
          $elemMatch: { user: userId, status: "missed", seenAt: null },
        },
      },
      { $set: { "participants.$[elem].seenAt": now } },
      { arrayFilters: [{ "elem.user": userId, "elem.status": "missed" }] }
    );

    res.json({ success: true });
  } catch (e) {
    console.error("missed calls seen error:", e);
    res.status(500).json({ success: false, error: "Failed to mark seen" });
  }
};
