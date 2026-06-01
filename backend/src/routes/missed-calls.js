const MissedCall = require("../models/MissedCall");
const User = require("../models/User");

// ✅ GET missed calls for current user
const getMissedCalls = async (req, res) => {
  try {
    const { limit = 50, skip = 0 } = req.fields || req.body || {};
    const userId = req.user.id;
    const companyId = req.headers["x-company-id"];

    if (!companyId) {
      return res.status(400).json({
        error: true,
        message: "Company ID is required",
      });
    }

    console.log(
      `📞 Getting missed calls for user ${userId} in company ${companyId}`
    );

    const missedCalls = await MissedCall.find({
      calleeId: userId,
      companyId,
      cleared: false,
    })
      .populate("callerId", "firstName lastName picture")
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip));

    console.log(
      `📞 Found ${missedCalls.length} missed calls for user ${userId}`
    );

    res.status(200).json({
      success: true,
      missedCalls,
      count: missedCalls.length,
    });
  } catch (error) {
    console.error("📞 Error getting missed calls:", error);
    res.status(500).json({
      error: true,
      message: "Error retrieving missed calls",
    });
  }
};

// ✅ CLEAR specific missed call
const clearMissedCall = async (req, res) => {
  try {
    const { missedCallId } = req.fields || req.body || {};
    const userId = req.user.id;
    const companyId = req.headers["x-company-id"];

    if (!companyId) {
      return res.status(400).json({
        error: true,
        message: "Company ID is required",
      });
    }

    console.log(`📞 Clearing missed call ${missedCallId} for user ${userId}`);

    const result = await MissedCall.findOneAndUpdate(
      {
        _id: missedCallId,
        calleeId: userId,
        companyId,
      },
      { cleared: true },
      { new: true }
    );

    if (!result) {
      return res.status(404).json({
        error: true,
        message: "Missed call not found",
      });
    }

    console.log(`📞 ✅ Missed call ${missedCallId} cleared`);

    res.status(200).json({
      success: true,
      message: "Missed call cleared",
    });
  } catch (error) {
    console.error("📞 Error clearing missed call:", error);
    res.status(500).json({
      error: true,
      message: "Error clearing missed call",
    });
  }
};

// ✅ CLEAR ALL missed calls for user
const clearAllMissedCalls = async (req, res) => {
  try {
    const userId = req.user.id;
    const companyId = req.headers["x-company-id"];

    if (!companyId) {
      return res.status(400).json({
        error: true,
        message: "Company ID is required",
      });
    }

    console.log(
      `📞 Clearing all missed calls for user ${userId} in company ${companyId}`
    );

    const result = await MissedCall.updateMany(
      {
        calleeId: userId,
        companyId,
        cleared: false,
      },
      { cleared: true }
    );

    console.log(
      `📞 ✅ Cleared ${result.modifiedCount} missed calls for user ${userId}`
    );

    res.status(200).json({
      success: true,
      message: `Cleared ${result.modifiedCount} missed calls`,
      clearedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("📞 Error clearing all missed calls:", error);
    res.status(500).json({
      error: true,
      message: "Error clearing missed calls",
    });
  }
};

const markAsRetrieved = async (req, res) => {
  try {
    const userId = req.user.id;
    const companyId = req.headers["x-company-id"];

    if (!companyId) {
      return res.status(400).json({
        error: true,
        message: "Company ID is required",
      });
    }

    console.log(
      `📞 📊 Marking missed calls as retrieved for user ${userId} in company ${companyId}`
    );

    // Mark as retrieved
    const updateResult = await MissedCall.updateMany(
      {
        calleeId: userId,
        companyId,
        cleared: false,
      },
      {
        retrieved: true,
      }
    );

    console.log(
      `📞 📊 Updated ${updateResult.modifiedCount} missed calls as retrieved`
    );

    res.status(200).json({});
  } catch (error) {
    console.error("📞 ❌ Error marking missed calls as retrieved:", error);
    res.status(500).json({
      error: true,
      message: "Error marking missed calls as retrieved",
    });
  }
};

module.exports = {
  getMissedCalls,
  clearMissedCall,
  clearAllMissedCalls,
  markAsRetrieved,
};
