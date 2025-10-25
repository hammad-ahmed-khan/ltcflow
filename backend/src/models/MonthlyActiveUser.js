// backend/src/models/MonthlyActiveUser.js
const mongoose = require("mongoose");
const { Schema } = mongoose;

const MonthlyActiveUserSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    month: {
      type: String,
      required: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
    },
    firstName: {
      type: String,
      required: true,
    },
    lastName: {
      type: String,
      required: true,
    },
    level: {
      type: String,
      enum: ["user", "manager", "admin", "root"],
      required: true,
    },
    userStatus: {
      type: String,
      enum: ["active", "deactivated"],
      required: true,
    },
    source: {
      type: String,
      enum: ["monthly_snapshot", "user_activation"],
      required: true,
    },
    activatedAt: {
      type: Date,
      required: true,
    },
    deactivatedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// ✅ CORRECT: Multi-tenant safe indexes
MonthlyActiveUserSchema.index({ companyId: 1, month: 1 });
MonthlyActiveUserSchema.index(
  { companyId: 1, userId: 1, month: 1 },
  { unique: true }
);

// Simple count method
MonthlyActiveUserSchema.statics.getDetailedMonthlyStats = async function (
  companyId,
  month
) {
  try {
    const totalActiveUsers = await this.countDocuments({
      companyId: new mongoose.Types.ObjectId(companyId),
      month: month,
    });

    return {
      companyId: companyId,
      month: month,
      activeUsers: totalActiveUsers,
    };
  } catch (error) {
    console.error("Error in getDetailedMonthlyStats:", error);
    throw error;
  }
};

module.exports = mongoose.model("MonthlyActiveUser", MonthlyActiveUserSchema);
