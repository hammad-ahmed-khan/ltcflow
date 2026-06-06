// backend/src/models/Meeting.js
const mongoose = require("./mongoose");
const Schema = mongoose.Schema;

const MeetingSchema = new Schema(
  {
    title: {
      type: String,
      required: false,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    lastEnter: {
      type: Date,
      default: Date.now,
    },
    lastLeave: {
      type: Date,
      default: Date.now,
    },
    startedAsCall: {
      type: Boolean,
      default: false,
    },
    caller: { type: Schema.ObjectId, ref: "users" },
    callee: { type: Schema.ObjectId, ref: "users" },
    callToGroup: {
      type: Boolean,
      default: false,
    },
    group: { type: Schema.ObjectId, ref: "rooms" },
    peers: {
      type: Array,
      default: [],
    },
    users: [{ type: Schema.ObjectId, ref: "users" }],

    // ───────────────────────────────────────────────────────────────
    // Call lifecycle (managed by backend/src/calls/CallManager).
    // Also the data source for the Missed tab in the missed-calls milestone.
    // ───────────────────────────────────────────────────────────────
    state: {
      type: String,
      enum: ["ringing", "active", "ended"],
      default: "ringing",
    },
    media: {
      type: String,
      enum: ["audio", "video"],
      default: "audio",
    },
    answeredAt: { type: Date, default: null },
    endedAt: { type: Date, default: null },
    endReason: {
      type: String,
      enum: [
        "completed",
        "no_answer",
        "cancelled",
        "declined",
        "abandoned",
        "failed",
        null,
      ],
      default: null,
    },
    participants: [
      {
        user: { type: Schema.ObjectId, ref: "users" },
        status: {
          type: String,
          enum: [
            "ringing",
            "joined",
            "reconnecting",
            "left",
            "declined",
            "missed",
          ],
          default: "ringing",
        },
        joinedAt: { type: Date, default: null },
        leftAt: { type: Date, default: null },
        // Reserved for the Missed tab:
        seenAt: { type: Date, default: null }, // null => unseen (drives badge)
        hiddenAt: { type: Date, default: null }, // set by "Clear All" soft-hide
      },
    ],

    // 🔹 Company reference for multi-tenancy
    companyId: {
      type: Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
  },
  { timestamps: true }
);

// Fast lookup for a user's missed calls within their tenant (used later by the
// Missed tab). Safe to add now.
MeetingSchema.index({
  companyId: 1,
  "participants.user": 1,
  "participants.status": 1,
});

module.exports = Meeting = mongoose.model("meetings", MeetingSchema);
