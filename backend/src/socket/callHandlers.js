// ==============================================
// ENHANCED CALL EVENT HANDLERS WITH GROUP SUPPORT
// File: /opt/clover/backend/src/socket/callHandlers-enhanced.js
// ==============================================

const User = require("../models/User");
const Room = require("../models/Room");
const Message = require("../models/Message");
const MissedCall = require("../models/MissedCall");
const store = require("../store");

// In-memory store for active calls (use Redis in production for scalability)
const activeCalls = new Map();
let callCounter = 0;
let recordCounter = 0;

const handleCallEvents = (socket, io) => {
  socket.on("call-initiated", async (data) => {
    const { callerId, calleeId, callType, meetingId, isGroup, groupId } = data;

    callCounter++;
    console.log(`📞 🔢 CALL-INITIATED #${callCounter}: ${meetingId}`);
    console.log(`📞 🔢 Socket ID: ${socket.id}`);

    console.log(`📞 🟢 CALL-INITIATED START: ${meetingId}`);
    console.log(
      `📞 From: ${callerId} → To: ${isGroup ? `Group ${groupId}` : calleeId}`
    );
    console.log(`📞 Socket ID: ${socket.id}`);
    console.log(`📞 Stack trace:`, new Error().stack.split("\n").slice(0, 5));

    // Get caller info
    const caller = await User.findById(callerId).select(
      "companyId firstName lastName"
    );
    if (!caller) {
      console.log(`📞 ❌ Caller ${callerId} not found`);
      return;
    }

    console.log(
      `📞 ✅ Caller found: ${caller.firstName} ${caller.lastName} (Company: ${caller.companyId})`
    );

    let callees = [];

    // ✅ ENHANCED: Handle group calls vs 1-to-1 calls
    if (isGroup && groupId) {
      console.log(`📞 👥 GROUP CALL: Getting members for group ${groupId}`);

      try {
        const group = await Room.findById(groupId)
          .populate("people", "_id firstName lastName")
          .select("people title");

        if (!group) {
          console.log(`📞 ❌ Group ${groupId} not found`);
          io.to(callerId).emit("call-not-answered", {
            meetingId,
            reason: "group-not-found",
            message: "Group not found",
          });
          return;
        }

        // Get all group members except caller
        callees = group.people
          .filter((member) => member._id.toString() !== callerId)
          .map((member) => member._id.toString());

        console.log(
          `📞 👥 Group "${group.title}" has ${callees.length} members to call:`,
          callees
        );

        if (callees.length === 0) {
          console.log(`📞 ❌ No members to call in group ${groupId}`);
          io.to(callerId).emit("call-not-answered", {
            meetingId,
            reason: "empty-group",
            message: "No members in group to call",
          });
          return;
        }
      } catch (error) {
        console.error(`📞 ❌ Error getting group members:`, error);
        io.to(callerId).emit("call-not-answered", {
          meetingId,
          reason: "server-error",
          message: "Error getting group members",
        });
        return;
      }
    } else {
      // ✅ 1-to-1 call (existing logic)
      callees = [calleeId];
    }

    // ✅ ENHANCED: Check online status for all callees
    const onlineCallees = [];
    const offlineCallees = [];

    for (const calleeId of callees) {
      const calleeSocketIds = store.socketsByUserID[calleeId];
      const isCalleeOnline = calleeSocketIds && calleeSocketIds.length > 0;

      if (isCalleeOnline) {
        onlineCallees.push(calleeId);
        console.log(`📞 ✅ User ${calleeId} is ONLINE`);
      } else {
        offlineCallees.push(calleeId);
        console.log(`📞 ❌ User ${calleeId} is OFFLINE`);
      }
    }

    console.log(
      `📞 📊 Call Summary - Online: ${onlineCallees.length}, Offline: ${offlineCallees.length}`
    );

    // ✅ ENHANCED: Record missed calls for offline members immediately
    for (const offlineCalleeId of offlineCallees) {
      console.log(
        `📞 ❌ Recording missed call for OFFLINE user: ${offlineCalleeId}`
      );

      const offlineMissedCall = {
        id: meetingId,
        caller: callerId,
        callee: offlineCalleeId,
        callType,
        status: "missed-offline",
        startTime: new Date(),
        isGroup: isGroup || false,
        groupId: groupId || null,
        companyId: caller.companyId,
      };

      await recordMissedCall(offlineMissedCall, io);
    }

    // ✅ If ALL members are offline, end the call
    if (onlineCallees.length === 0) {
      console.log(`📞 ❌ ALL callees are OFFLINE - ending call ${meetingId}`);

      io.to(callerId).emit("call-not-answered", {
        meetingId,
        reason: isGroup ? "all-offline" : "offline",
        message: isGroup
          ? "All group members are currently offline"
          : "User is currently offline",
        stats: {
          called: callees.length,
          online: 0,
          offline: offlineCallees.length,
        },
      });

      console.log(`📞 🟢 CALL-INITIATED END: ${meetingId} (all offline)`);
      return;
    }

    // ✅ ENHANCED: Continue with online flow for available members
    console.log(
      `📞 📞 ${onlineCallees.length} users are ONLINE - setting up call for: ${meetingId}`
    );

    const callData = {
      id: meetingId,
      caller: callerId,
      callees: callees, // ✅ All intended callees
      onlineCallees: onlineCallees, // ✅ Only online callees
      offlineCallees: offlineCallees, // ✅ Offline callees (already processed)
      answered: [], // ✅ Track who answered
      callType,
      status: "ringing",
      startTime: new Date(),
      isGroup: isGroup || false,
      groupId: groupId || null,
      companyId: caller.companyId,
      missedCallProcessed: false,
    };

    activeCalls.set(meetingId, callData);

    // ✅ ENHANCED: Emit to all online callees
    for (const onlineCalleeId of onlineCallees) {
      io.to(onlineCalleeId).emit("incoming-call", {
        meetingId,
        caller: callData.caller,
        callType,
        isGroup,
        groupId,
        companyId: caller.companyId,
        totalMembers: onlineCallees.length, // ✅ Let them know how many people are being called
      });

      console.log(
        `📞 ✅ Incoming call emitted to online user ${onlineCalleeId}`
      );
    }

    // ✅ ENHANCED: Set timeout for missed calls (longer for groups)
    const timeoutDuration = isGroup ? 30000 : 15000; // 30s for groups, 15s for 1-to-1
    console.log(`📞 ⏰ Setting timeout for ${timeoutDuration / 1000}s`);

    const missedCallTimeout = setTimeout(async () => {
      console.log(`📞 ⏰ TIMEOUT FIRED for call ${meetingId}`);
      const call = activeCalls.get(meetingId);

      //if (call && call.status === "ringing" && !call.missedCallProcessed) {
      if (call && !call.missedCallProcessed) {
        console.log(`📞 🔴 PROCESSING MISSED CALLS for timeout: ${meetingId}`);

        call.missedCallProcessed = true;
        activeCalls.set(meetingId, call);

        // ✅ ENHANCED: Create missed call records for online members who didn't answer
        const answeredMembers = call.answered || [];
        const missedMembers = call.onlineCallees.filter(
          (id) => !answeredMembers.includes(id)
        );

        console.log(
          `📞 📊 Call Results - Answered: ${answeredMembers.length}, Missed: ${missedMembers.length}`
        );

        for (const missedMemberId of missedMembers) {
          console.log(`📞 🔴 Recording missed call for ${missedMemberId}`);

          const missedCall = {
            ...call,
            callee: missedMemberId, // ✅ Individual missed call record
            status: "missed-timeout",
          };

          await recordMissedCall(missedCall, io);
        }

        // ✅ Clean up
        activeCalls.delete(meetingId);

        // ✅ ENHANCED: Notify caller about call outcome
        const totalCalled = call.onlineCallees.length;
        const totalAnswered = answeredMembers.length;

        if (totalAnswered === 0) {
          // No one answered
          io.to(callerId).emit("call-not-answered", {
            meetingId,
            reason: "timeout",
            message: isGroup
              ? `No one answered the group call (${totalCalled} members called)`
              : "Call not answered",
            stats: {
              called: totalCalled,
              answered: totalAnswered,
              missed: missedMembers.length,
              offline: call.offlineCallees.length,
            },
          });
        } else if (isGroup && totalAnswered > 0) {
          // Some people answered (group calls can proceed with partial answers)
          io.to(callerId).emit("call-partial-answer", {
            meetingId,
            answered: answeredMembers,
            missed: missedMembers,
            message: `${totalAnswered} of ${totalCalled} members answered`,
            stats: {
              called: totalCalled,
              answered: totalAnswered,
              missed: missedMembers.length,
              offline: call.offlineCallees.length,
            },
          });
        }

        // ✅ Notify all callees who didn't answer that the call ended
        for (const missedMemberId of missedMembers) {
          io.to(missedMemberId).emit("call-ended", {
            meetingId,
            reason: "missed",
            endedBy: "system",
            isGroup,
          });
        }

        console.log(`📞 ✅ Call ${meetingId} timeout cleanup completed`);
      } else {
        console.log(
          `📞 ⏰ TIMEOUT IGNORED for ${meetingId} - already processed or answered`
        );
      }
    }, timeoutDuration);

    callData.missedCallTimeout = missedCallTimeout;
    activeCalls.set(meetingId, callData);

    console.log(
      `📞 🟢 CALL-INITIATED END: ${meetingId} (${onlineCallees.length} online, timeout set)`
    );
  });

  // ✅ ENHANCED: Handle call answers (track multiple answers for groups)
  socket.on("call-answered", (data) => {
    const { meetingId, calleeId } = data;
    const call = activeCalls.get(meetingId);

    console.log(`📞 ✅ Call answered: ${meetingId} by ${calleeId}`);

    //if (call && call.status === "ringing") {
    if (call) {
      // ✅ ENHANCED: Add to answered list
      call.answered = call.answered || [];

      if (!call.answered.includes(calleeId)) {
        call.answered.push(calleeId);
        console.log(
          `📞 ✅ Added ${calleeId} to answered list. Total answered: ${call.answered.length}`
        );
      }

      // ✅ For 1-to-1 calls, clear timeout when answered
      // ✅ For group calls, keep timeout running for others
      if (!call.isGroup) {
        if (call.missedCallTimeout) {
          clearTimeout(call.missedCallTimeout);
          console.log(`📞 ✅ Cleared timeout for 1-to-1 call ${meetingId}`);
        }
        call.missedCallProcessed = true;
      }

      // ✅ Update call status and mark as processed
      call.status = "in-progress";
      call.answerTime = new Date();

      activeCalls.set(meetingId, call);

      // ✅ ENHANCED: Notify caller who answered
      /*
      io.to(call.caller).emit("call-answered", {
        meetingId,
        answeredBy: calleeId,
        totalAnswered: call.answered.length,
        totalOnlineCalled: call.onlineCallees.length,
        isGroup: call.isGroup,
      });
      */

      console.log(
        `📞 ✅ Call ${meetingId} answered by ${calleeId}. Status: ${call.status}`
      );
    } else {
      console.log(`📞 ⚠️ Call ${meetingId} not found or not in ringing state`);
    }
  });

  // When User A cancels/
  socket.on("call-cancelled", (data) => {
    const { meetingId, callerId } = data;
    const call = activeCalls.get(meetingId);

    console.log(
      `📞 ❌ Call cancellation requested: ${meetingId} by ${callerId}`
    );

    //if (call && call.status === "ringing") {
    if (call) {
      if (call.missedCallTimeout) {
        clearTimeout(call.missedCallTimeout);
      }

      // ✅ MARK as processed to prevent missed call
      call.status = "cancelled";
      call.endTime = new Date();
      call.missedCallProcessed = true;

      if (call.isGroup) {
        // ✅ UPDATE: Remove user from participant lists
        call.answered = (call.answered || []).filter((id) => id !== callerId);
        call.onlineCallees = (call.onlineCallees || []).filter(
          (id) => id !== callerId
        );

        const remainingParticipants = call.answered.length;

        if (remainingParticipants <= 1) {
          activeCalls.delete(meetingId);
        } else {
          // ✅ UPDATE: Save the modified call data (don't delete)
          activeCalls.set(meetingId, call);
        }
      } else {
        activeCalls.delete(meetingId); // ✅ OK for individual calls
      }

      // ✅ ENHANCED: Notify all callees for group calls
      const callees = call.onlineCallees || [call.callee];

      for (const calleeId of callees) {
        console.log(`📞 ✅ call-ended emitted to ${callerId}`);
        io.to(calleeId).emit("call-ended", {
          meetingId,
          reason: "cancelled",
          endedBy: callerId,
          isGroup: call.isGroup,
        });
      }

      console.log(`📞 ✅ Call ${meetingId} cancelled and cleaned up`);
    } else {
      console.log(
        `📞 ⚠️ Call ${meetingId} not found or not in ringing state for cancellation`
      );
    }
  });

  // When User B rejects the call
  socket.on("call-rejected", (data) => {
    const { meetingId, calleeId } = data;
    const call = activeCalls.get(meetingId);

    console.log(`📞 ❌ Call rejected: ${meetingId} by ${calleeId}`);

    //if (call && call.status === "ringing") {
    if (call) {
      // ✅ ENHANCED: For group calls, track rejections but keep call alive for others
      if (call.isGroup) {
        // Add to rejected list
        call.rejected = call.rejected || [];
        if (!call.rejected.includes(calleeId)) {
          call.rejected.push(calleeId);
        }

        // Remove from online callees list
        call.onlineCallees = call.onlineCallees.filter((id) => id !== calleeId);

        console.log(
          `📞 📊 Group call: ${calleeId} rejected. Remaining: ${call.onlineCallees.length}`
        );

        // If no one left to call, end the call
        if (call.onlineCallees.length === 0 && call.answered.length === 0) {
          if (call.missedCallTimeout) {
            clearTimeout(call.missedCallTimeout);
          }

          call.endTime = new Date();

          /*
          io.to(call.caller).emit("call-not-answered", {
            meetingId,
            reason: "all-rejected",
            message: "All group members rejected the call",
            rejected: call.rejected,
          });
          */
          store.io.to(calleeId).emit("close", {
            status: 200,
            meetingId,
            counterpart: call.caller,
          });

          activeCalls.delete(meetingId);

          console.log(
            `📞 ✅ Group call ${meetingId} ended - all members rejected`
          );
        } else {
          // Update call data and continue for others
          activeCalls.set(meetingId, call);

          // Notify caller about rejection but keep call alive
          /*
          io.to(call.caller).emit("call-member-rejected", {
            meetingId,
            rejectedBy: calleeId,
            remainingMembers: call.onlineCallees.length,
            answeredMembers: call.answered.length,
          });
          */
        }
      } else {
        // ✅ 1-to-1 call rejection (existing logic)
        if (call.missedCallTimeout) {
          clearTimeout(call.missedCallTimeout);
        }

        call.status = "rejected";
        call.endTime = new Date();

        io.to(call.caller).emit("call-rejected", {
          meetingId,
          rejectedBy: calleeId,
        });

        activeCalls.delete(meetingId);
        console.log(`📞 ✅ 1-to-1 call ${meetingId} rejected and cleaned up`);
      }
    } else {
      console.log(
        `📞 ⚠️ Call ${meetingId} not found or not in ringing state for rejection`
      );
    }
  });

  // When call ends normally (after being answered)
  socket.on("call-ended", async (data) => {
    const { meetingId, endedBy, duration } = data;
    const call = activeCalls.get(meetingId);

    console.log(
      `📞 ✅ Call ended: ${meetingId} by ${endedBy}, duration: ${duration}s`
    );

    if (call) {
      // Clear any timeouts
      if (call.missedCallTimeout) {
        clearTimeout(call.missedCallTimeout);
      }

      // Record call duration if call was answered and lasted > 3 seconds
      /*
      if (call.status === "in-progress" && duration > 3) {
        await recordCallDuration(call, duration, io);
      }
        */

      if (duration > 3) {
        await recordCallDuration(call, duration, io);
      }

      // ✅ ENHANCED: Notify all participants (for group calls)
      /*
      const allParticipants = [call.caller, ...(call.answered || [])];

      for (const participantId of allParticipants) {
        io.to(participantId).emit("call-ended", {
          meetingId,
          reason: "ended",
          endedBy,
          duration,
          isGroup: call.isGroup,
          participants: call.answered,
        });
      }
        */

      // Clean up
      //activeCalls.delete(meetingId);

      console.log(`📞 ✅ Call ${meetingId} ended and cleaned up`);
    } else {
      console.log(`📞 ⚠️ Call ${meetingId} not found for ending`);
    }
  });

  // Handle disconnection - clean up any active calls
  socket.on("disconnect", () => {
    const userId = socket.userId;
    if (!userId) return;

    console.log(
      `📞 🔌 Checking for active calls for disconnected user ${userId}`
    );

    // Find any active calls involving this user
    for (const [meetingId, call] of activeCalls.entries()) {
      const isInvolved =
        call.caller === userId ||
        (call.onlineCallees && call.onlineCallees.includes(userId)) ||
        (call.answered && call.answered.includes(userId));

      if (isInvolved) {
        console.log(
          `📞 🔌 Cleaning up call ${meetingId} due to disconnect of ${userId}`
        );

        // Clear timeouts
        if (call.missedCallTimeout) {
          clearTimeout(call.missedCallTimeout);
        }

        // ✅ ENHANCED: Handle group call disconnections
        if (call.isGroup) {
          // Remove from online/answered lists
          call.onlineCallees = (call.onlineCallees || []).filter(
            (id) => id !== userId
          );
          call.answered = (call.answered || []).filter((id) => id !== userId);

          // Notify remaining participants
          const remainingParticipants = [
            call.caller,
            ...(call.answered || []),
          ].filter((id) => id !== userId);

          for (const participantId of remainingParticipants) {
            io.to(participantId).emit("call-member-disconnected", {
              meetingId,
              disconnectedUser: userId,
              remainingMembers: call.onlineCallees.length,
              answeredMembers: call.answered.length,
            });
          }

          // If everyone disconnected, clean up
          if (remainingParticipants.length === 0) {
            activeCalls.delete(meetingId);
            console.log(
              `📞 🔌 Group call ${meetingId} cleaned up - all participants disconnected`
            );
          } else {
            activeCalls.set(meetingId, call);
          }
        } else {
          // ✅ 1-to-1 call disconnection (existing logic)
          const otherUserId =
            call.caller === userId ? call.onlineCallees[0] : call.caller;

          if (otherUserId) {
            io.to(otherUserId).emit("call-ended", {
              meetingId,
              reason: "disconnected",
              endedBy: userId,
            });
          }

          activeCalls.delete(meetingId);
          console.log(
            `📞 🔌 1-to-1 call ${meetingId} cleaned up due to disconnect`
          );
        }
      }
    }
  });
};

// ✅ ENHANCED: Record missed call with badge update
const recordMissedCall = async (call, io) => {
  recordCounter++;
  console.log(`📞 🔢 RECORD-MISSED-CALL #${recordCounter}: ${call.id}`);

  try {
    console.log(`📞 🔴 === RECORD MISSED CALL START ===`);

    // ✅ CHECK if record exists FIRST
    const existingRecord = await MissedCall.findOne({
      callId: call.id,
      calleeId: call.callee,
    });
    const recordExists = !!existingRecord;

    console.log(`📞 Record exists for ${call.callee}: ${recordExists}`);

    // Get caller info
    const caller = await User.findById(call.caller).select(
      "firstName lastName picture companyId"
    );
    if (!caller) {
      console.log(`📞 ❌ CRITICAL ERROR: Caller ${call.caller} not found`);
      return;
    }

    // Get group name if needed
    let groupName = null;
    if (call.isGroup && call.groupId) {
      const group = await Room.findOne({
        _id: call.groupId,
        companyId: call.companyId,
      }).select("title");
      groupName = group ? group.title : "Unknown Group";
    }

    // Create or update record
    const missedCallRecord = await MissedCall.findOneAndUpdate(
      { callId: call.id, calleeId: call.callee },
      {
        callId: call.id,
        callerId: call.caller,
        calleeId: call.callee,
        callType: call.callType,
        timestamp: call.startTime,
        companyId: call.companyId,
        status: call.status === "missed-offline" ? "missed-offline" : "missed",
        isGroup: call.isGroup || false,
        groupId: call.groupId || null,
        groupName: groupName,
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    );

    console.log(
      `📞 ✅ Database record for ${call.callee}: ${missedCallRecord._id}`
    );

    // ✅ ONLY EMIT IF THIS WAS A NEW RECORD
    if (!recordExists) {
      const missedCallData = {
        _id: missedCallRecord._id,
        callId: call.id,
        callerId: {
          _id: caller._id,
          firstName: caller.firstName,
          lastName: caller.lastName,
          picture: caller.picture,
        },
        callType: call.callType,
        timestamp: call.startTime,
        status: missedCallRecord.status,
        isGroup: call.isGroup,
        groupId: call.groupId,
        groupName,
        companyId: call.companyId,
      };

      console.log(`📞 📤 Emitting NEW missed call to ${call.callee}`);
      console.log(
        `📞 Caller name: ${missedCallData.callerId.firstName} ${missedCallData.callerId.lastName}`
      );
      io.to(call.callee).emit("call-missed", missedCallData);

      // ✅ CALCULATE AND EMIT BADGE UPDATE
      const UNREAD_CUTOFF_DATE = new Date("2025-10-01T00:00:00Z");
      const newBadgeCount = await MissedCall.countDocuments({
        calleeId: call.callee,
        companyId: call.companyId,
        cleared: false,
        retrieved: false,
        timestamp: { $gt: UNREAD_CUTOFF_DATE },
      });

      console.log(
        `📞 📊 Emitting badge update to ${call.callee}: ${newBadgeCount} missed calls`
      );

      console.log(
        `📞 ✅ Missed call event and badge update emitted successfully`
      );
    } else {
      console.log(
        `📞 🛑 Skipping emission - record already existed for ${call.callee}`
      );
    }

    // ✅ CREATE MESSAGE RECORD FOR MISSED CALL (only for 1-to-1 calls)
    if (!call.isGroup) {
      await createMissedCallMessage(call, caller, io);
      console.log(`📞 ✅ Missed call message created for 1-to-1 call`);
    } else {
      console.log(`📞 ⚠️ Skipping missed call message creation for group call`);
    }

    return missedCallRecord;
  } catch (error) {
    console.error("📞 ❌ CRITICAL ERROR in recordMissedCall:", error);
  }
};

// ✅ NEW: Helper function to create Message record for missed calls
const createMissedCallMessage = async (call, caller, io) => {
  try {
    console.log(`📞 💬 === CREATING MISSED CALL MESSAGE START ===`);
    console.log(`📞 Call ID: ${call.id}, Callee: ${call.callee}`);
    console.log(`📞 Call companyId: ${call.companyId}`);

    // Find the room ID for this missed call
    let roomId = call.groupId; // For group calls

    if (!roomId) {
      console.log(
        `📞 Looking for private room between ${call.caller} and ${call.callee} in company ${call.companyId}`
      );

      // ✅ FIND room WITH companyId filter
      const room = await Room.findOne({
        isGroup: false,
        people: { $all: [call.caller, call.callee] },
        companyId: call.companyId, // ✅ FILTER by company
      });

      if (room) {
        roomId = room._id;
        console.log(
          `📞 ✅ Found private room: ${roomId} in company ${call.companyId}`
        );
      } else {
        console.log(
          `📞 ❌ No private room found, creating new one for company ${call.companyId}...`
        );

        // ✅ CREATE room WITH companyId
        try {
          const newRoom = new Room({
            people: [call.caller, call.callee],
            isGroup: false,
            companyId: call.companyId, // ✅ INCLUDE companyId
            createdAt: new Date(),
          });
          await newRoom.save();
          roomId = newRoom._id;
          console.log(
            `📞 ✅ Created new private room: ${roomId} for company ${call.companyId}`
          );
        } catch (roomError) {
          console.error(`📞 ❌ Failed to create room:`, roomError);
          return;
        }
      }
    } else {
      console.log(`📞 Using group room ID: ${roomId}`);
    }

    if (!roomId) {
      console.warn(
        `📞 ❌ Could not find or create room for missed call message record`
      );
      return;
    }

    // ✅ CREATE missed call message WITH companyId
    console.log(
      `📞 Creating missed call message with companyId: ${call.companyId}`
    );

    const missedCallMessage = new Message({
      room: roomId,
      author: call.caller,
      companyId: call.companyId, // ✅ USE companyId from call
      content: JSON.stringify({
        callType: call.callType,
        status: call.status === "missed-offline" ? "missed-offline" : "missed",
        startTime: call.startTime,
        missedTime: new Date(),
        callee: call.callee,
        isGroup: call.isGroup || false,
        groupId: call.groupId || null,
        reason:
          call.status === "missed-offline" ? "User was offline" : "No answer",
      }),
      type: "call-missed-record", // ✅ Different type to distinguish from completed calls
      createdAt: new Date(),
    });

    await missedCallMessage.save();
    await missedCallMessage.populate("author");

    console.log(
      `📞 ✅ Missed call message created: ${missedCallMessage._id} for company ${call.companyId}`
    );

    // ✅ EMIT to room participants
    console.log(
      `📞 Emitting missed call message to room: ${roomId.toString()} (Company: ${
        call.companyId
      })`
    );

    // 1. Regular message event (adds to chat)
    io.to(roomId.toString()).emit("message", {
      message: missedCallMessage,
      roomID: roomId.toString(),
      companyId: call.companyId, // ✅ INCLUDE companyId in emission
    });

    console.log(
      `📞 ✅ Missed call message events emitted to room ${roomId} for company ${call.companyId}`
    );
    console.log(`📞 💬 === CREATING MISSED CALL MESSAGE END ===`);

    return missedCallMessage;
  } catch (error) {
    console.error("📞 ❌ ERROR in createMissedCallMessage:", error);
  }
};

// Helper function to record call duration (unchanged)
const recordCallDuration = async (call, duration, io) => {
  try {
    console.log(`📞 === RECORDING CALL DURATION START ===`);
    console.log(`📞 Duration: ${duration}s for call ${call.id}`);
    console.log(`📞 Call companyId: ${call.companyId}`);

    // Get caller info (companyId already in call object)
    const caller = await User.findById(call.caller).select(
      "firstName lastName picture companyId"
    );
    if (!caller) {
      console.log(`📞 ❌ Caller ${call.caller} not found for duration record`);
      return;
    }

    console.log(
      `📞 ✅ Caller: ${caller.firstName} ${caller.lastName} (Company: ${caller.companyId})`
    );

    // Find the room ID for this call
    let roomId = call.groupId; // For group calls

    if (!roomId) {
      console.log(
        `📞 Looking for private room between ${call.caller} and ${call.callee} in company ${call.companyId}`
      );

      // ✅ FIND room WITH companyId filter
      const room = await Room.findOne({
        isGroup: false,
        people: { $all: [call.caller, call.callee] },
        companyId: call.companyId, // ✅ FILTER by company
      });

      if (room) {
        roomId = room._id;
        console.log(
          `📞 ✅ Found private room: ${roomId} in company ${call.companyId}`
        );
      } else {
        console.log(
          `📞 ❌ No private room found, creating new one for company ${call.companyId}...`
        );

        // ✅ CREATE room WITH companyId
        try {
          const newRoom = new Room({
            people: [call.caller, call.callee],
            isGroup: false,
            companyId: call.companyId, // ✅ INCLUDE companyId
            createdAt: new Date(),
          });
          await newRoom.save();
          roomId = newRoom._id;
          console.log(
            `📞 ✅ Created new private room: ${roomId} for company ${call.companyId}`
          );
        } catch (roomError) {
          console.error(`📞 ❌ Failed to create room:`, roomError);
          return;
        }
      }
    } else {
      console.log(`📞 Using group room ID: ${roomId}`);
    }

    if (!roomId) {
      console.warn(
        `📞 ❌ Could not find or create room for call duration record`
      );
      return;
    }

    // ✅ CREATE call record message WITH companyId
    console.log(
      `📞 Creating call record message with companyId: ${call.companyId}`
    );

    const callMessage = new Message({
      room: roomId,
      author: call.caller,
      companyId: call.companyId, // ✅ USE companyId from call
      content: JSON.stringify({
        callType: call.callType,
        duration,
        status: "ended",
        startTime: call.startTime,
        endTime: new Date(),
        participants: call.answered || [],
        isGroup: call.isGroup,
      }),
      type: "call-record",
      createdAt: new Date(),
    });

    await callMessage.save();
    await callMessage.populate("author");

    console.log(
      `📞 ✅ Call record message created: ${callMessage._id} for company ${call.companyId}`
    );

    // ✅ EMIT to room participants
    console.log(
      `📞 Emitting messages to room: ${roomId.toString()} (Company: ${
        call.companyId
      })`
    );

    // 1. Regular message event (adds to chat)
    io.to(roomId.toString()).emit("message", {
      message: callMessage,
      roomID: roomId.toString(),
      companyId: call.companyId, // ✅ INCLUDE companyId in emission
    });

    // 2. Call-specific event (for special handling)
    io.to(roomId.toString()).emit("call-ended-with-record", {
      messageId: callMessage._id,
      caller: callMessage.author,
      callType: call.callType,
      duration,
      roomId,
      message: callMessage,
      companyId: call.companyId, // ✅ INCLUDE companyId
    });

    console.log(
      `📞 ✅ Both message events emitted to room ${roomId} for company ${call.companyId}`
    );
    console.log(`📞 === RECORDING CALL DURATION END ===`);
  } catch (error) {
    console.error("📞 ❌ ERROR in recordCallDuration:", error);
  }
};

// Export function and active calls for debugging
module.exports = {
  handleCallEvents,
  activeCalls,
  // Export helper functions for testing
  recordMissedCall,
  recordCallDuration,
};
