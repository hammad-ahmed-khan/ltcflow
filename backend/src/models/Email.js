const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const ObjectId = Schema.Types.ObjectId;

const EmailSchema = new Schema(
  {
    from: { type: String, trim: true },
    to: { type: String, trim: true },
    subject: { type: String, trim: true },
    html: String,
    sent: {
      type: Boolean,
      default: false,
    },
    dateAdded: {
      type: Date,
      default: Date.now,
    },
    dateSent: Date,

    // 🔹 Company reference for multi-tenancy
    companyId: {
      type: ObjectId,
      ref: "Company",
      required: true,
    },
  },
  { timestamps: true }
);

const Email = mongoose.model("emails", EmailSchema);

module.exports = Email;
