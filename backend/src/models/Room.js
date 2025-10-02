// backend/src/models/Room.js
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

    companyId: {
      type: Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },

    creator: {
      type: Schema.Types.ObjectId,
      ref: "users",
      required: function () {
        return this.isGroup;
      },
    },

    // 🆕 CRITICAL: Track when each user last read this room
    lastReadByUser: [
      {
        userId: { type: Schema.Types.ObjectId, ref: "users", required: true },
        lastReadAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

// 🆕 Add index for faster queries
RoomSchema.index({ "lastReadByUser.userId": 1 });
RoomSchema.index({ companyId: 1, people: 1 });

module.exports = mongoose.model("rooms", RoomSchema);
