const mongoose = require("./mongoose");
const Schema = mongoose.Schema;

const MessageSchema = new Schema(
  {
    author: { type: Schema.ObjectId, ref: "users", required: true },
    content: { type: String, trim: true },
    type: { type: String, trim: true },
    file: { type: Schema.ObjectId, ref: "files" },
    room: { type: Schema.ObjectId, ref: "rooms", required: true },
    date: {
      type: Date,
      default: Date.now,
    },

    // 🔹 Company reference for multi-tenancy
    companyId: {
      type: Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },

    // NEW FIELDS FOR MESSAGE DELETION:
    isDeleted: {
      type: Boolean,
      default: false,
      index: true, // Add index for faster queries
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    originalContent: {
      type: String,
      default: null, // Store original content for admin purposes
    },
    originalType: {
      type: String,
      default: null, // Store original type for admin purposes
    },
  },
  { timestamps: true }
); // optional: track createdAt/updatedAt

// Soft delete method
MessageSchema.methods.softDelete = function (deletedBy) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = deletedBy;
  this.content = null; // Clear content for privacy
  return this.save();
};

// Query helper to exclude deleted messages by default
MessageSchema.query.notDeleted = function () {
  return this.where({ isDeleted: { $ne: true } });
};

module.exports = mongoose.model("messages", MessageSchema);
