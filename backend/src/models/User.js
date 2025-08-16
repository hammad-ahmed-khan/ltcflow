const mongoose = require("./mongoose");
const Schema = mongoose.Schema;

const UserSchema = new Schema(
  {
    email: String,
    firstName: String,
    level: {
      type: String,
      default: "standard",
    },
    password: String,
    phone: String,
    lastName: String,
    username: String,
    fullName: String,
    favorites: [{ type: Schema.ObjectId, ref: "rooms" }],
    tagLine: {
      type: String,
      default: "New LTC Flow User",
    },
    picture: { type: Schema.ObjectId, ref: "images" },
    lastOnline: {
      type: Date,
    },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: "Company",
      required: true, // optional: make it required if every user must belong to a company
    },
  },
  { timestamps: true }
); // automatically adds createdAt & updatedAt

module.exports = User = mongoose.model("users", UserSchema);
