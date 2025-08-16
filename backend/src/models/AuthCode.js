const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const ObjectId = Schema.Types.ObjectId;

const AuthCodeSchema = new Schema(
  {
    expires: {
      type: Date,
      default: Date.now,
    },
    user: {
      type: ObjectId,
      ref: "users", // make sure it matches your user model
      required: false,
    },
    code: { type: String, trim: true },
    valid: { type: Boolean, default: true },
    email: { type: String, trim: true },

    // 🔹 Company reference for multi-tenancy
    companyId: {
      type: ObjectId,
      ref: "Company",
      required: true,
    },
  },
  { timestamps: true }
); // optional: track createdAt/updatedAt

const AuthCode = mongoose.model("authcodes", AuthCodeSchema);

module.exports = AuthCode;
