const User = require("../models/User");
const Room = require("../models/Room"); // 🆕 NEW: For group removal
const Company = require("../models/Company");
const outsetaApi = require("../services/outsetaApi");
const store = require("../store"); // 🆕 NEW: For socket operations

// 🔥 NEW: Import MAU tracking
const UserActivationTracker = require("../services/UserActivationTracker");

module.exports = async (req, res, next) => {
  const { userId, newStatus } = req.fields;
  const companyId = req.headers["x-company-id"];

  // Validation
  if (!["root", "admin"].includes(req.user.level)) {
    return res.status(401).json({ error: "Unauthorized User" });
  }

  if (!userId || !newStatus || !companyId) {
    return res
      .status(400)
      .json({ error: "User ID, status, and Company ID required." });
  }

  const validStatuses = ["pending", "active", "deactivated", "expired"];
  if (!validStatuses.includes(newStatus)) {
    return res.status(400).json({ error: "Invalid status value." });
  }

  try {
    // Find user
    const user = await User.findOne({ _id: userId, companyId });
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    // Store original status for comparison
    const originalStatus = user.status;

    // Prevent self-deactivation
    if (req.user.id === userId && newStatus === "deactivated") {
      return res
        .status(400)
        .json({ error: "You cannot deactivate your own account." });
    }

    // Update user status
    const updateData = { status: newStatus };
    if (["deactivated", "expired"].includes(newStatus)) {
      //updateData.$unset = { activationToken: 1, tokenExpiry: 1 };
    }

    const updatedUser = await User.findByIdAndUpdate(userId, updateData, {
      new: true,
    }).select("-password -activationToken");

    // 🔥 NEW: Handle Monthly Active Users tracking
    let mauResult = null;
    try {
      if (originalStatus !== "active" && newStatus === "active") {
        // User is being activated (from pending/deactivated/expired to active)
        mauResult = await UserActivationTracker.logUserActivation(updatedUser);
        console.log(
          `📊 User ${updatedUser.email} reactivated and added to monthly active users`
        );
      }
    } catch (mauError) {
      console.error(
        `⚠️ MAU tracking error for user ${updatedUser.email}:`,
        mauError
      );
      // Don't fail the status change if MAU tracking fails
    }

    // ========================================
    // 🆕 NEW: HANDLE DEACTIVATION
    // ========================================
    let deactivationResults = null;
    if (newStatus === "deactivated") {
      console.log(`🚫 Processing deactivation for user ${updatedUser.email}`);
      deactivationResults = {
        socketsDisconnected: 0,
        groupsRemoved: 0,
      };

      // 1. FORCE LOGOUT - Emit socket event to disconnect user everywhere
      if (store.socketsByUserID && store.socketsByUserID[userId]) {
        const userSockets = store.socketsByUserID[userId];
        if (userSockets && userSockets.length > 0) {
          console.log(
            `📡 Force disconnecting ${userSockets.length} sessions for user ${userId}`
          );

          // Emit deactivation event to all user's sockets
          userSockets.forEach((socket) => {
            if (socket && socket.emit) {
              socket.emit("user-deactivated", {
                id: userId,
                message:
                  "Your account has been deactivated by an administrator.",
                reason: "deactivated",
              });

              // Force disconnect the socket after short delay
              setTimeout(() => {
                if (socket.disconnect) {
                  socket.disconnect(true);
                }
              }, 1000);

              deactivationResults.socketsDisconnected++;
            }
          });
        }
      }

      // Also emit to the user's ID room (backup method)
      if (store.io) {
        store.io.to(userId).emit("user-deactivated", {
          id: userId,
          message: "Your account has been deactivated by an administrator.",
          reason: "deactivated",
        });
      }

      // 2. REMOVE FROM ALL GROUPS
      try {
        const groupsUpdated = await Room.updateMany(
          {
            companyId: companyId,
            isGroup: true,
            people: userId,
          },
          {
            $pull: { people: userId },
          }
        );
        deactivationResults.groupsRemoved = groupsUpdated.modifiedCount;
        console.log(
          `👥 Removed deactivated user from ${groupsUpdated.modifiedCount} groups`
        );

        // Notify group members about the removal
        if (store.io && groupsUpdated.modifiedCount > 0) {
          // Get the groups that were modified to notify remaining members
          const affectedGroups = await Room.find({
            companyId: companyId,
            isGroup: true,
          })
            .select("_id people title")
            .lean();

          // Emit update to remaining members
          affectedGroups.forEach((group) => {
            group.people.forEach((memberId) => {
              store.io.to(memberId.toString()).emit("group-member-removed", {
                groupId: group._id,
                removedUserId: userId,
                reason: "user_deactivated",
              });
            });
          });
        }
      } catch (groupError) {
        console.error(`⚠️ Error removing user from groups:`, groupError);
      }

      // 3. UPDATE ONLINE USERS LIST
      if (store.onlineUsers) {
        store.onlineUsers.forEach((onlineUser, socket) => {
          if (onlineUser && onlineUser.id === userId) {
            store.onlineUsers.delete(socket);
          }
        });

        // Broadcast updated online users list
        if (store.io) {
          store.io.emit("onlineUsers", Array.from(store.onlineUsers.values()));
        }
      }

      // 4. LOG DEACTIVATION IN MAU (mark as deactivated but still billable)
      try {
        if (UserActivationTracker.removeUserFromCurrentMonth) {
          await UserActivationTracker.removeUserFromCurrentMonth(updatedUser);
        }
      } catch (mauError) {
        console.error(`⚠️ MAU deactivation tracking error:`, mauError);
      }

      console.log(
        `✅ Deactivation complete for ${updatedUser.email}:`,
        deactivationResults
      );
    }

    // ========================================
    // 🆕 NEW: HANDLE REACTIVATION
    // ========================================
    if (originalStatus === "deactivated" && newStatus === "active") {
      console.log(`✅ User ${updatedUser.email} has been reactivated`);
      // MAU tracking for reactivation is already handled above
    }

    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({
        status: "error",
        error: "COMPANY_NOT_FOUND",
        message: "Company not found",
      });
    }

    const isDemo = company.subdomain === "demo";

    // 🔥 FIX: Initialize outsetaSync variable
    let outsetaSync = null;

    // Sync with Outseta
    if (!isDemo && outsetaApi.isConfigured() && user.outsetaPersonId) {
      try {
        console.log(
          `🔄 Syncing status change to Outseta: ${user.email} -> ${newStatus}`
        );

        const personUpdateData = {
          ActivationStatus: newStatus,
          StatusChangedAt: new Date().toISOString(),
        };

        const updateResult = await outsetaApi.updatePerson(
          user.outsetaPersonId,
          personUpdateData
        );

        if (updateResult?.success) {
          console.log(
            `✅ Status synced to Outseta: ${user.email} -> ${newStatus}`
          );
          outsetaSync = { success: true, action: "updated" };
        } else {
          console.warn(`⚠️ Outseta status sync failed:`, updateResult?.error);
          outsetaSync = { success: false, error: updateResult?.error };
        }
      } catch (syncError) {
        console.error(`❌ Failed to sync status to Outseta:`, syncError);
        outsetaSync = { success: false, error: syncError.message };
      }
    }

    // Prepare response
    const response = {
      status: "success",
      message: `User status updated to ${newStatus} successfully.`,
      user: updatedUser,
      outseta: outsetaSync,
    };

    // 🔥 NEW: Add MAU tracking info to response
    if (mauResult) {
      response.monthlyActiveUsers = {
        action: mauResult.action,
        month: mauResult.month,
        message:
          mauResult.message || `User ${mauResult.action} monthly active users`,
      };
    }

    // 🆕 NEW: Add deactivation results to response
    if (deactivationResults) {
      response.deactivation = {
        processed: true,
        socketsDisconnected: deactivationResults.socketsDisconnected,
        groupsRemoved: deactivationResults.groupsRemoved,
      };
    }

    res.status(200).json(response);
  } catch (err) {
    console.error("Toggle user status error:", err);
    res.status(500).json({ error: "Server error updating user status." });
  }
};
