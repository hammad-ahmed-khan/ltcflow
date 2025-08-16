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
  },
  { timestamps: true }
); // optional: track createdAt/updatedAt

module.exports = mongoose.model("messages", MessageSchema);
