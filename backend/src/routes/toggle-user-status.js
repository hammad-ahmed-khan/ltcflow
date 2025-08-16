const User = require("../models/User");

module.exports = async (req, res, next) => {
  const { userId, newStatus } = req.fields;
  const companyId = req.headers["x-company-id"];

  // Check if user has permission to manage users
  if (!["root", "admin"].includes(req.user.level)) {
    return res.status(401).json({ error: "Unauthorized User" });
  }

  if (!userId || !newStatus || !companyId) {
    return res
      .status(400)
      .json({ error: "User ID, status, and Company ID required." });
  }

  // Validate status
  const validStatuses = ["pending", "active", "deactivated", "expired"];
  if (!validStatuses.includes(newStatus)) {
    return res.status(400).json({ error: "Invalid status value." });
  }

  try {
    // Find the user within the same company
    const user = await User.findOne({
      _id: userId,
      companyId,
    });

    if (!user) {
      return res.status(404).json({
        error: "User not found.",
      });
    }

    // Prevent self-deactivation
    if (req.user.id === userId && newStatus === "deactivated") {
      return res.status(400).json({
        error: "You cannot deactivate your own account.",
      });
    }

    // Update user status
    const updateData = { status: newStatus };

    // If deactivating or expiring, clear any existing activation tokens
    if (["deactivated", "expired"].includes(newStatus)) {
      updateData.$unset = {
        activationToken: 1,
        tokenExpiry: 1,
      };
    }

    const updatedUser = await User.findByIdAndUpdate(userId, updateData, {
      new: true,
    }).select("-password -activationToken");

    res.status(200).json({
      status: "success",
      message: `User status updated to ${newStatus} successfully.`,
      user: updatedUser,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error updating user status." });
  }
};
