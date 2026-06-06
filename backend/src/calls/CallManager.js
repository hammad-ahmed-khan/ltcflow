// backend/src/calls/CallManager.js
//
// The server-authoritative brain for call lifecycle. One singleton instance
// owns every live CallSession, all timers, all socket emission, and the
// persistence into the Meeting document. Nothing else decides when a call
// rings, becomes active, ends, or who missed it.
//
// Locked product decisions encoded here:
//   - ring-all (every callee device is rung)
//   - no host: a call lives while >= 1 participant is joined and auto-ends when
//     the room empties; the lone participant auto-ends after ALONE_MS
//   - ALONE_MS > RECONNECT_GRACE_MS, and the alone countdown is held while any
//     peer is reconnecting
//   - declines are tracked but NEVER become "missed"
//   - caller-cancel before answer => callee is "missed"

const store = require("../store");
const Meeting = require("../models/Meeting");
const Room = require("../models/Room");
const User = require("../models/User");
const Message = require("../models/Message");
const { CallSession } = require("./CallSession");
const {
  CALL_STATE,
  P_STATUS,
  END_REASON,
  CALL_TYPE,
  TIMEOUTS,
  EVT,
} = require("./constants");

class CallManager {
  constructor() {
    /** @type {Map<string, CallSession>} meetingId -> session */
    this.sessions = new Map();
    /** @type {Map<string, Set<string>>} socketId -> set of meetingIds */
    this.socketIndex = new Map();
  }

  // ======================================================================
  // IO helpers
  // ======================================================================

  _emitToUser(userId, event, payload) {
    try {
      if (store.io) store.io.to(String(userId)).emit(event, payload);
    } catch (e) {
      console.error(
        `[calls] emit ${event} -> user ${userId} failed:`,
        e.message,
      );
    }
  }

  _emitToAll(session, event, payload) {
    for (const userId of session.allUserIds()) {
      this._emitToUser(userId, event, payload);
    }
  }

  _indexSocket(socketId, meetingId) {
    if (!this.socketIndex.has(socketId))
      this.socketIndex.set(socketId, new Set());
    this.socketIndex.get(socketId).add(meetingId);
  }

  _deindexSocket(socketId, meetingId) {
    const set = this.socketIndex.get(socketId);
    if (!set) return;
    set.delete(meetingId);
    if (set.size === 0) this.socketIndex.delete(socketId);
  }

  // ======================================================================
  // Persistence (best-effort; never blocks signaling)
  // ======================================================================

  async _persist(session) {
    try {
      await Meeting.findOneAndUpdate(
        { _id: session.meetingId, companyId: session.companyId },
        {
          $set: {
            state: session.state,
            media: session.media,
            answeredAt: session.answeredAt
              ? new Date(session.answeredAt)
              : null,
            endedAt: session.endedAt ? new Date(session.endedAt) : null,
            endReason: session.endReason,
            participants: Array.from(session.participants.values()).map(
              (p) => ({
                user: p.userId,
                status: p.status,
                joinedAt: p.joinedAt ? new Date(p.joinedAt) : null,
                leftAt: p.leftAt ? new Date(p.leftAt) : null,
              }),
            ),
          },
        },
      );
    } catch (e) {
      console.error("[calls] persist error:", e.message);
    }
  }

  // ======================================================================
  // Timers
  // ======================================================================

  _armRingTimer(session) {
    this._clearRingTimer(session);
    session.ringTimer = setTimeout(() => {
      session.ringTimer = null;
      this._onRingTimeout(session);
    }, TIMEOUTS.RING_MS);
  }

  _clearRingTimer(session) {
    if (session.ringTimer) {
      clearTimeout(session.ringTimer);
      session.ringTimer = null;
    }
  }

  _armAloneTimer(session) {
    if (session.aloneTimer) return; // already counting down
    session.aloneTimer = setTimeout(() => {
      session.aloneTimer = null;
      this._onAloneTimeout(session);
    }, TIMEOUTS.ALONE_MS);
  }

  _clearAloneTimer(session) {
    if (session.aloneTimer) {
      clearTimeout(session.aloneTimer);
      session.aloneTimer = null;
    }
  }

  _armGraceTimer(session, userId) {
    this._clearGraceTimer(session, userId);
    const handle = setTimeout(() => {
      session.graceTimers.delete(userId);
      this._onGraceTimeout(session, userId);
    }, TIMEOUTS.RECONNECT_GRACE_MS);
    session.graceTimers.set(userId, handle);
  }

  _clearGraceTimer(session, userId) {
    const h = session.graceTimers.get(userId);
    if (h) {
      clearTimeout(h);
      session.graceTimers.delete(userId);
    }
  }

  _clearAllTimers(session) {
    this._clearRingTimer(session);
    this._clearAloneTimer(session);
    for (const h of session.graceTimers.values()) clearTimeout(h);
    session.graceTimers.clear();
  }

  // ======================================================================
  // Public lifecycle entry points (called from initCallSocket)
  // ======================================================================

  /**
   * Caller starts a call. The Meeting doc already exists (created via the
   * existing /meeting/get flow); we look it up for tenant + roster, build the
   * participant table, ring all callees, and arm the ring timer.
   */
  async initiate(socket, { meetingId, roomId, type, media }) {
    const initiatorId = String(socket.decoded_token.id);

    let meeting;
    try {
      meeting = await Meeting.findById(meetingId);
    } catch (e) {
      return { error: "Meeting lookup failed" };
    }
    if (!meeting) return { error: "Meeting not found" };
    const companyId = String(meeting.companyId);

    // Idempotent: re-initiate returns the existing session.
    if (this.sessions.has(String(meetingId))) {
      return {
        ok: true,
        snapshot: this.sessions.get(String(meetingId)).snapshot(),
      };
    }

    // Resolve the roster from the conversation/group, tenant-scoped.
    const conversationId =
      roomId || (meeting.group ? String(meeting.group) : null);
    let room = null;
    if (conversationId) {
      try {
        room = await Room.findOne({ _id: conversationId, companyId }).populate({
          path: "picture",
          strictPopulate: false,
        });
      } catch (e) {}
    }
    const memberIds =
      room && Array.isArray(room.people) ? room.people.map(String) : [];
    const isGroup = room ? !!room.isGroup : type === CALL_TYPE.GROUP;
    const callees = memberIds.filter((id) => id && id !== initiatorId);
    if (callees.length === 0) return { error: "No callees" };

    // Caller identity for the callee's incoming-call UI.
    let callerUser = null;
    try {
      callerUser = await User.findById(initiatorId)
        .select("firstName lastName picture")
        .populate("picture");
    } catch (e) {}
    const counterpart = callerUser
      ? {
          _id: initiatorId,
          firstName: callerUser.firstName,
          lastName: callerUser.lastName,
          picture: callerUser.picture,
        }
      : { _id: initiatorId };

    // Group identity for the callee's ringing screen (WhatsApp-style: group is
    // the headline, the caller is the secondary "{Initiator} · {Group}" line).
    const group =
      isGroup && room
        ? { _id: room._id, title: room.title, picture: room.picture }
        : null;

    const session = new CallSession({
      meetingId,
      companyId,
      type: isGroup ? CALL_TYPE.GROUP : CALL_TYPE.ONE_TO_ONE,
      media,
      initiatorId,
      roomId: conversationId,
    });

    const caller = session.addParticipant(initiatorId, P_STATUS.JOINED);
    caller.joinedAt = Date.now();
    caller.sockets.add(socket.id);
    this._indexSocket(socket.id, session.meetingId);

    for (const id of callees) session.addParticipant(id, P_STATUS.RINGING);

    this.sessions.set(session.meetingId, session);
    this._armRingTimer(session);
    this._persist(session);

    // ring-all: every callee device.
    for (const id of callees) {
      this._emitToUser(id, EVT.RING, {
        meetingId: session.meetingId,
        caller: initiatorId,
        counterpart, // caller's user object, for the ringing screen
        group, // group identity for group calls (null for 1:1)
        type: session.type,
        media: session.media,
        roomId: session.roomId,
      });
    }

    return { ok: true, snapshot: session.snapshot() };
  }

  /** A callee answers. First answer flips the call to ACTIVE. */
  async accept(socket, { meetingId }) {
    const session = this.sessions.get(String(meetingId));
    if (!session || session.isEnded()) return { error: "Call not active" };

    const userId = socket.decoded_token.id;
    const p = session.get(userId);
    if (!p) return { error: "Not a participant" };

    // Answering on one device cancels the ring on this user's other devices.
    this._emitToUser(userId, EVT.STATE, session.snapshot());

    session.setStatus(userId, P_STATUS.JOINED);
    session.addSocket(userId, socket.id);
    this._indexSocket(socket.id, session.meetingId);
    this._clearGraceTimer(session, userId);

    if (!session.answeredAt) {
      session.answeredAt = Date.now();
      session.state = CALL_STATE.ACTIVE;
      // In 1:1 the ring is over once answered. In a group, others may still be
      // ringing, so the ring timer stays armed to mark them missed on timeout.
      if (!session.isGroup()) this._clearRingTimer(session);
    }

    this._emitToAll(session, EVT.PEER_JOINED, {
      meetingId: session.meetingId,
      userId,
    });

    this._clearAloneTimer(session); // someone is here now
    this._persist(session);
    this._evaluate(session);
    return { ok: true, snapshot: session.snapshot() };
  }

  /** A callee rejects before answering. Declines never become "missed". */
  async decline(socket, { meetingId }) {
    const session = this.sessions.get(String(meetingId));
    if (!session || session.isEnded()) return { error: "Call not active" };

    const userId = socket.decoded_token.id;
    if (!session.get(userId)) return { error: "Not a participant" };

    session.setStatus(userId, P_STATUS.DECLINED);
    this._clearGraceTimer(session, userId);
    this._emitToAll(session, EVT.PEER_LEFT, {
      meetingId: session.meetingId,
      userId,
      reason: "declined",
    });
    this._persist(session);
    this._evaluate(session);
    return { ok: true };
  }

  /** Caller aborts before anyone answered. Unanswered callees are MISSED. */
  async cancel(socket, { meetingId }) {
    const session = this.sessions.get(String(meetingId));
    if (!session || session.isEnded()) return { error: "Call not active" };

    const userId = socket.decoded_token.id;
    if (String(userId) !== session.initiatorId) {
      // Non-initiator "cancel" is just a leave.
      return this.leave(socket, { meetingId });
    }

    // If it was never answered, this is a true cancel: callees are missed.
    if (!session.answeredAt) {
      session.cancelledByCaller = true;
      for (const id of session.ringingUserIds()) {
        session.setStatus(id, P_STATUS.MISSED);
      }
      session.setStatus(userId, P_STATUS.LEFT);
      this._endCall(session, END_REASON.CANCELLED);
      return { ok: true };
    }

    // Already active: caller leaving is an ordinary leave.
    return this.leave(socket, { meetingId });
  }

  /** A joined participant leaves an active call (or a ringing callee bails). */
  async leave(socket, { meetingId }) {
    const session = this.sessions.get(String(meetingId));
    if (!session || session.isEnded()) return { error: "Call not active" };

    const userId = socket.decoded_token.id;
    const p = session.get(userId);
    if (!p) return { error: "Not a participant" };

    // A participant who never answered and bails counts as missed (mirrors a
    // phone: you didn't pick up). A joined participant cleanly leaves.
    if (p.status === P_STATUS.RINGING) {
      session.setStatus(userId, P_STATUS.MISSED);
    } else {
      session.setStatus(userId, P_STATUS.LEFT);
    }
    p.sockets.delete(socket.id);
    this._deindexSocket(socket.id, session.meetingId);
    this._clearGraceTimer(session, userId);

    this._emitToAll(session, EVT.PEER_LEFT, {
      meetingId: session.meetingId,
      userId,
    });
    this._persist(session);
    this._evaluate(session);
    return { ok: true };
  }

  /** Re-attach a returning socket to its participant within the grace window. */
  async rejoin(socket, { meetingId }) {
    const session = this.sessions.get(String(meetingId));
    if (!session || session.isEnded())
      return { error: "Call no longer active" };

    const userId = socket.decoded_token.id;
    const p = session.get(userId);
    if (!p) return { error: "Not a participant" };

    this._clearGraceTimer(session, userId);
    session.addSocket(userId, socket.id);
    this._indexSocket(socket.id, session.meetingId);

    // Only flip back to JOINED if they had been mid-reconnect.
    if (p.status === P_STATUS.RECONNECTING) {
      session.setStatus(userId, P_STATUS.JOINED);
      this._emitToAll(session, EVT.PEER_RECONNECTED, {
        meetingId: session.meetingId,
        userId,
      });
    }

    this._evaluate(session); // a reconnect may release the alone timer
    return { ok: true, snapshot: session.snapshot() };
  }

  /**
   * A socket vanished (disconnect). For every call it belonged to, drop the
   * socket; if the user has no live sockets left, move them to RECONNECTING and
   * start the grace timer rather than ending anything immediately.
   */
  handleSocketGone(socket) {
    const meetingIds = this.socketIndex.get(socket.id);
    if (!meetingIds) return;
    const userId = socket.decoded_token && socket.decoded_token.id;

    for (const meetingId of Array.from(meetingIds)) {
      const session = this.sessions.get(meetingId);
      this._deindexSocket(socket.id, meetingId);
      if (!session || session.isEnded() || !userId) continue;

      const p = session.get(userId);
      if (!p) continue;
      p.sockets.delete(socket.id);
      if (p.sockets.size > 0) continue; // still present on another device

      if (p.status === P_STATUS.JOINED) {
        // Hold their seat; give the network a chance to recover.
        session.setStatus(userId, P_STATUS.RECONNECTING);
        this._emitToAll(session, EVT.PEER_RECONNECTING, {
          meetingId: session.meetingId,
          userId,
        });
        this._armGraceTimer(session, userId);
        // Pausing the alone countdown while anyone is reconnecting:
        this._clearAloneTimer(session);
      } else if (p.status === P_STATUS.RINGING) {
        // They were being rung and dropped without answering -> missed.
        session.setStatus(userId, P_STATUS.MISSED);
        this._emitToAll(session, EVT.PEER_LEFT, {
          meetingId: session.meetingId,
          userId,
        });
      }
      this._persist(session);
      this._evaluate(session);
    }
  }

  // ======================================================================
  // Timer callbacks
  // ======================================================================

  _onRingTimeout(session) {
    if (session.isEnded()) return;
    // Anyone still ringing rang out -> missed (per-participant, group-safe).
    const stillRinging = session.ringingUserIds();
    for (const id of stillRinging) session.setStatus(id, P_STATUS.MISSED);
    if (stillRinging.length) {
      this._emitToAll(session, EVT.STATE, session.snapshot());
    }
    this._persist(session);
    this._evaluate(session); // ends the call only if nobody ever joined
  }

  _onGraceTimeout(session, userId) {
    if (session.isEnded()) return;
    const p = session.get(userId);
    if (!p || p.status !== P_STATUS.RECONNECTING) return;
    // Grace expired without a rejoin -> they're gone.
    session.setStatus(userId, P_STATUS.LEFT);
    this._emitToAll(session, EVT.PEER_LEFT, {
      meetingId: session.meetingId,
      userId,
    });
    this._persist(session);
    this._evaluate(session);
  }

  _onAloneTimeout(session) {
    if (session.isEnded()) return;
    const c = session.counts();
    // Re-check: only end if genuinely still alone and nobody is reconnecting.
    if (c.joined <= 1 && c.reconnecting === 0 && c.ringing === 0) {
      this._endCall(session, END_REASON.ABANDONED);
    }
  }

  // ======================================================================
  // Core evaluation: decide whether the call ends / arm the alone timer
  // ======================================================================

  _evaluate(session) {
    if (session.isEnded()) return;
    const c = session.counts();
    const active = !!session.answeredAt;
    const livePresent = c.joined + c.reconnecting; // bodies still in or returning

    // --- pre-answer (still ringing) ---
    if (!active) {
      // If no callee can still answer (none ringing, none reconnecting) and
      // only the caller remains, the call is over without ever connecting.
      if (c.ringing === 0 && c.reconnecting === 0 && c.joined <= 1) {
        this._endCall(session, this._resolveUnansweredReason(session));
      }
      return;
    }

    // --- post-answer (was/active) ---
    if (session.isGroup()) {
      if (livePresent === 0 && c.ringing === 0) {
        this._endCall(session, END_REASON.COMPLETED);
        return;
      }
      // Exactly one body and nobody reconnecting/ringing => arm alone timer.
      if (c.joined === 1 && c.reconnecting === 0 && c.ringing === 0) {
        this._armAloneTimer(session);
      } else {
        this._clearAloneTimer(session);
      }
      return;
    }

    // 1:1: ends as soon as the other side is no longer present (and not
    // merely reconnecting). One joined body left => completed.
    if (c.joined <= 1 && c.reconnecting === 0) {
      this._endCall(session, END_REASON.COMPLETED);
    }
  }

  _resolveUnansweredReason(session) {
    if (session.cancelledByCaller) return END_REASON.CANCELLED;
    const c = session.counts();
    // 1:1 explicit reject.
    if (!session.isGroup() && c.declined > 0) return END_REASON.DECLINED;
    return END_REASON.NO_ANSWER;
  }

  // ======================================================================
  // Termination
  // ======================================================================

  _endCall(session, reason) {
    if (session.isEnded()) return;
    session.state = CALL_STATE.ENDED;
    session.endedAt = Date.now();
    session.endReason = reason;
    this._clearAllTimers(session);

    this._emitToAll(session, EVT.ENDED, {
      meetingId: session.meetingId,
      reason,
    });

    this._persist(session);

    // Notify each participant who missed this call so their Missed tab + badge
    // update live.
    for (const p of session.participants.values()) {
      if (p.status === P_STATUS.MISSED) {
        this._emitToUser(p.userId, "missed-call:new", {
          meetingId: session.meetingId,
        });
      }
    }

    // Post the inline call-history bubble into the conversation (Phase 6b).
    // Fire-and-forget: the captured `session` stays valid after removal below.
    this._postCallMessage(session);

    // Drop in-memory state. Clean the socket index of any lingering refs.
    for (const p of session.participants.values()) {
      for (const sid of p.sockets) this._deindexSocket(sid, session.meetingId);
    }
    this.sessions.delete(session.meetingId);
  }

  // Posts one Message of type 'call' into the conversation when a call ends,
  // mirroring routes/message.js (create -> populate -> update room -> emit
  // message-in to every member) so the client renders it live with no extra
  // wiring. Logs all outcomes; the bubble is labeled viewer-relative client-side.
  async _postCallMessage(session) {
    if (!session.roomId) return; // no conversation to post into
    try {
      const duration =
        session.answeredAt && session.endedAt
          ? Math.max(
              0,
              Math.round((session.endedAt - session.answeredAt) / 1000),
            )
          : 0;

      const content = JSON.stringify({
        media: session.media,
        type: session.type, // '1:1' | 'group' — controls bubble labeling
        outcome: session.endReason,
        initiator: session.initiatorId,
        answeredAt: session.answeredAt || null,
        endedAt: session.endedAt || null,
        duration,
      });

      let message = await new Message({
        room: session.roomId,
        author: session.initiatorId,
        type: "call",
        content,
        companyId: session.companyId,
        containsPHI: false,
      }).save();

      message = await Message.findById(message._id).populate({
        path: "author",
        select: "-email -password -friends -__v",
        populate: [{ path: "picture" }],
      });

      await Room.findOneAndUpdate(
        { _id: session.roomId, companyId: session.companyId },
        {
          $set: {
            lastUpdate: message.date,
            lastMessage: message._id,
            lastAuthor: session.initiatorId,
          },
        },
      );

      const updatedRoom = await Room.findOne({
        _id: session.roomId,
        companyId: session.companyId,
      })
        .populate([{ path: "picture", strictPopulate: false }])
        .populate({
          path: "people",
          select: "-email -password -friends -__v",
          populate: { path: "picture" },
        })
        .populate("lastMessage");

      if (!updatedRoom) return;

      updatedRoom.people.forEach((person) => {
        store.io.to(person._id.toString()).emit("message-in", {
          status: 200,
          message,
          room: updatedRoom,
        });
      });
    } catch (e) {
      console.error("[calls] postCallMessage error:", e.message);
    }
  }

  // Helpful for tests / debugging.
  getSession(meetingId) {
    return this.sessions.get(String(meetingId));
  }
}

// Export a singleton — there is exactly one call authority per server process.
module.exports = new CallManager();
