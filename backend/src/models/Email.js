// backend/src/models/Email.js
// Update your Email model to ensure it has companyId for multi-tenancy

const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const EmailSchema = new Schema(
  {
    from: { type: String, required: true },
    to: { type: String, required: true },
    subject: { type: String, required: true },
    html: { type: String, required: true },
    text: { type: String }, // optional plain text version
    sent: { type: Boolean, default: false },
    sentAt: { type: Date },
    attempts: { type: Number, default: 0 },
    lastAttempt: { type: Date },
    error: { type: String }, // store any send errors
    messageId: { type: String }, // store email provider message ID

    // 🔹 Company reference for multi-tenancy
    companyId: {
      type: Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
  },
  {
    timestamps: true, // adds createdAt & updatedAt
  }
);

// Indexes for performance
EmailSchema.index({ sent: 1, createdAt: 1 }); // for email queue processing
EmailSchema.index({ companyId: 1, to: 1 }); // for multi-tenant queries
EmailSchema.index({ messageId: 1 }); // for tracking sent emails

module.exports = mongoose.model("emails", EmailSchema);
