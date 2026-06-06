// backend/src/calls/CallSession.js
//
// A pure data structure for ONE call. It holds the participant table, the
// lifecycle state, and the timer handles. It deliberately contains NO socket
// IO and NO database access — CallManager owns all side effects. Keeping this
// class side-effect-free makes the lifecycle logic easy to reason about.

const { CALL_STATE, P_STATUS, CALL_TYPE } = require("./constants");

class Participant {
  constructor(userId, status) {
    this.userId = String(userId);
    this.status = status;
    this.sockets = new Set(); // live socket ids for this user (multi-device)
    this.joinedAt = null;
    this.leftAt = null;
  }
}

class CallSession {
  /**
   * @param {Object} opts
   * @param {string} opts.meetingId
   * @param {string} opts.companyId   tenant scope
   * @param {string} opts.type        CALL_TYPE.ONE_TO_ONE | CALL_TYPE.GROUP
   * @param {string} opts.media       'audio' | 'video'
   * @param {string} opts.initiatorId user id of the caller
   * @param {string|null} opts.roomId conversation/room this call belongs to
   */
  constructor({ meetingId, companyId, type, media, initiatorId, roomId }) {
    this.meetingId = String(meetingId);
    this.companyId = String(companyId);
    this.type = type;
    this.media = media || "audio";
    this.initiatorId = String(initiatorId);
    this.roomId = roomId ? String(roomId) : null;

    this.state = CALL_STATE.RINGING;
    this.startedAt = Date.now();
    this.answeredAt = null;
    this.endedAt = null;
    this.endReason = null;

    // Explicit signal set by an intentional caller-cancel, so end-reason
    // resolution can distinguish "caller gave up" from "rang out".
    this.cancelledByCaller = false;

    this.participants = new Map(); // userId -> Participant

    // Timer handles, owned/cleared by CallManager.
    this.ringTimer = null;
    this.aloneTimer = null;
    this.graceTimers = new Map(); // userId -> timeout handle
  }

  // ---- participant helpers ---------------------------------------------

  addParticipant(userId, status) {
    const id = String(userId);
    if (!this.participants.has(id)) {
      this.participants.set(id, new Participant(id, status));
    }
    return this.participants.get(id);
  }

  get(userId) {
    return this.participants.get(String(userId));
  }

  setStatus(userId, status) {
    const p = this.get(userId);
    if (!p) return null;
    p.status = status;
    if (status === P_STATUS.JOINED && !p.joinedAt) p.joinedAt = Date.now();
    if (status === P_STATUS.LEFT) p.leftAt = Date.now();
    return p;
  }

  addSocket(userId, socketId) {
    const p = this.get(userId);
    if (p) p.sockets.add(socketId);
    return p;
  }

  removeSocket(userId, socketId) {
    const p = this.get(userId);
    if (p) p.sockets.delete(socketId);
    return p;
  }

  // ---- counts & predicates ---------------------------------------------

  counts() {
    const c = {
      ringing: 0,
      joined: 0,
      reconnecting: 0,
      left: 0,
      declined: 0,
      missed: 0,
    };
    for (const p of this.participants.values()) {
      if (c[p.status] !== undefined) c[p.status] += 1;
    }
    return c;
  }

  isGroup() {
    return this.type === CALL_TYPE.GROUP;
  }

  isEnded() {
    return this.state === CALL_STATE.ENDED;
  }

  /** Participants who never answered and could still be marked missed. */
  ringingUserIds() {
    const ids = [];
    for (const p of this.participants.values()) {
      if (p.status === P_STATUS.RINGING) ids.push(p.userId);
    }
    return ids;
  }

  /** Every user id in the call, used for broadcasting call:ended. */
  allUserIds() {
    return Array.from(this.participants.keys());
  }

  /** Serializable snapshot for the client (state sync / rejoin). */
  snapshot() {
    return {
      meetingId: this.meetingId,
      type: this.type,
      media: this.media,
      state: this.state,
      initiatorId: this.initiatorId,
      roomId: this.roomId,
      answered: !!this.answeredAt,
      participants: Array.from(this.participants.values()).map((p) => ({
        userId: p.userId,
        status: p.status,
      })),
    };
  }
}

module.exports = { CallSession, Participant };
