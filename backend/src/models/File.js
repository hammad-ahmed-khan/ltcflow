const mongoose = require("./mongoose");
const Schema = mongoose.Schema;

const MessageSchema = new Schema(
  {
    shield: String,
    name: String,
    location: String,
    author: { type: Schema.ObjectId, ref: "users" },
    size: Number,
    shieldedID: String,
    type: String,

    // 🔹 Company reference for multi-tenancy
    companyId: {
      type: Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = Image = mongoose.model("files", MessageSchema);
