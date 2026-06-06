// backend/src/routes/calls/missed.js
const Meeting = require("../../models/Meeting");

module.exports = async (req, res) => {
  try {
    const userId = String(req.user.id);
    const companyId = req.headers["x-company-id"];
    if (!companyId) {
      return res.status(400).json({ success: false, error: "Company ID required." });
    }

    const meetings = await Meeting.find({
      companyId,
      participants: {
        $elemMatch: { user: userId, status: "missed", hiddenAt: null },
      },
    })
      .sort({ endedAt: -1, createdAt: -1 })
      .limit(100)
      .populate([
        {
          path: "caller",
          select: "firstName lastName picture",
          populate: { path: "picture", strictPopulate: false },
        },
        {
          path: "group",
          select: "title isGroup picture",
          populate: { path: "picture", strictPopulate: false },
        },
      ])
      .lean();

    const calls = meetings.map((m) => {
      const mine = (m.participants || []).find(
        (p) => String(p.user) === userId
      );
      const isGroup = !!(m.callToGroup || (m.group && m.group.isGroup));
      return {
        meetingId: String(m._id),
        type: isGroup ? "group" : "1:1",
        media: m.media || "audio",
        endReason: m.endReason || "no_answer",
        at: m.endedAt || m.startedAt || m.createdAt,
        seen: !!(mine && mine.seenAt),
        // For a missed call the counterpart shown is the caller.
        counterpart: m.caller
          ? {
              _id: m.caller._id,
              firstName: m.caller.firstName,
              lastName: m.caller.lastName,
              picture: m.caller.picture,
            }
          : null,
        group: m.group
          ? { _id: m.group._id, title: m.group.title, picture: m.group.picture }
          : null,
        // The conversation/group to open from the "Chat" button.
        roomId: m.group ? String(m.group._id || m.group) : null,
      };
    });

    const unseen = calls.filter((c) => !c.seen).length;

    res.json({ success: true, calls, unseen });
  } catch (e) {
    console.error("missed calls list error:", e);
    res.status(500).json({ success: false, error: "Failed to load missed calls" });
  }
};
