// backend/src/models/WebhookEvent.js
const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const WebhookEventSchema = new Schema(
  {
    // Unique identifier from Outseta or generated
    eventId: {
      type: String,
      required: true,
      unique: true,
    },

    // Event details
    eventType: {
      type: String,
      required: true,
    },

    source: {
      type: String,
      default: "outseta",
    },

    // Processing status
    status: {
      type: String,
      enum: ["pending", "processed", "failed", "duplicate"],
      default: "pending",
    },

    // Store the raw payload for debugging/reprocessing
    payload: {
      type: Schema.Types.Mixed,
      required: true,
    },

    // Processing results
    result: {
      companyId: { type: Schema.Types.ObjectId, ref: "Company" },
      userId: { type: Schema.Types.ObjectId, ref: "users" },
      error: String,
      processingTime: Number, // milliseconds
    },

    // Retry tracking
    attempts: {
      type: Number,
      default: 1,
    },

    lastAttempt: {
      type: Date,
      default: Date.now,
    },

    // Request metadata
    requestHeaders: Schema.Types.Mixed,
    ipAddress: String,
  },
  {
    timestamps: true, // createdAt, updatedAt
  }
);

// Indexes for performance
WebhookEventSchema.index({ eventId: 1 });
WebhookEventSchema.index({ eventType: 1, status: 1 });
WebhookEventSchema.index({ createdAt: 1 });
WebhookEventSchema.index({ status: 1, lastAttempt: 1 });

// TTL index to auto-delete old events after 90 days
WebhookEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 });

module.exports = mongoose.model("WebhookEvent", WebhookEventSchema);
