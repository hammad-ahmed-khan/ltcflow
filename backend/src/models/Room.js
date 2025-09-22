const mongoose = require("./mongoose");
const Schema = mongoose.Schema;

const RoomSchema = new Schema(
  {
    people: [{ type: Schema.ObjectId, ref: "users" }],
    title: { type: String, trim: true },
    picture: { type: Schema.ObjectId, ref: "images" },
    isGroup: { type: Boolean, default: false },
    lastUpdate: { type: Date },
    lastAuthor: { type: Schema.ObjectId, ref: "users" },
    lastMessage: { type: Schema.ObjectId, ref: "messages" },

    // 🔹 New company reference
    companyId: {
      type: Schema.Types.ObjectId,
      ref: "Company",
      required: true, // ensures room is linked to a company
    },

    // 🆕 NEW: Group creator field
    creator: {
      type: Schema.Types.ObjectId,
      ref: "users",
      required: function () {
        return this.isGroup; // Only required for groups
      },
    },
  },
  { timestamps: true }
); // adds createdAt & updatedAt automatically

module.exports = mongoose.model("rooms", RoomSchema);
