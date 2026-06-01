const mongoose = require("mongoose");

const missedCallSchema = new mongoose.Schema(
  {
    callId: {
      type: String,
      required: true,
    },
    callerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },
    calleeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },
    callType: {
      type: String,
      enum: ["voice", "video"],
      required: true,
    },
    timestamp: {
      type: Date,
      required: true,
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    status: {
      type: String,
      enum: ["missed", "missed-offline"],
      default: "missed",
    },
    isGroup: {
      type: Boolean,
      default: false,
    },
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      default: null,
    },
    groupName: {
      type: String,
      default: null,
    },
    retrieved: {
      type: Boolean,
      default: false,
    },
    cleared: {
      type: Boolean,
      default: false,
    },
    read: {
      type: Boolean,
      default: false,
    },
    readAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// ✅ INDEXES for performance
missedCallSchema.index({ calleeId: 1, cleared: 1, timestamp: -1 });
missedCallSchema.index({ companyId: 1, calleeId: 1 });
missedCallSchema.index({ callId: 1, calleeId: 1 }, { unique: true });

module.exports = mongoose.model("MissedCall", missedCallSchema);
