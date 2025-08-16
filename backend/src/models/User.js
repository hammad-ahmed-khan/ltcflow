const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const UserSchema = new Schema(
  {
    username: { type: String, required: true },
    email: { type: String, required: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    password: { type: String, required: false }, // Not required until activation
    phone: { type: String, default: "" },
    level: {
      type: String,
      enum: ["user", "manager", "admin", "root"],
      default: "user",
    },
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },

    // New status field instead of isActive
    status: {
      type: String,
      enum: ["pending", "active", "deactivated", "expired"],
      default: "pending",
    },

    activationToken: { type: String, default: null },
    tokenExpiry: { type: Date, default: null },

    // Existing fields
    picture: { type: Schema.ObjectId, ref: "images" },
    tagLine: { type: String, default: "New LTC Flow User" },
    favorites: [{ type: Schema.ObjectId, ref: "rooms" }],
    lastOnline: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for multi-tenancy
UserSchema.index({ email: 1, companyId: 1 }, { unique: true });
UserSchema.index({ username: 1, companyId: 1 }, { unique: true });
UserSchema.index({ activationToken: 1 });

module.exports = User = mongoose.model("users", UserSchema);
