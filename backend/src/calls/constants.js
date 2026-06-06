// backend/src/calls/constants.js
//
// Single source of truth for the call lifecycle vocabulary.
// Kept in one place so the server, persistence layer, and (later) the client
// reference the exact same strings.

let cfg = {};
try {
  // Allow timeouts to be overridden from config without crashing if absent.
  cfg = require("../../config") || {};
} catch (e) {
  cfg = {};
}
const calls = cfg.calls || {};

// Whole-call state.
const CALL_STATE = {
  RINGING: "ringing", // created, at least one callee still being rung, nobody answered yet
  ACTIVE: "active", // at least one callee has answered
  ENDED: "ended", // terminal
};

// Per-participant outcome. "missed" / "declined" feed the Missed tab later.
const P_STATUS = {
  RINGING: "ringing", // being rung, no action yet
  JOINED: "joined", // currently in the call with live media
  RECONNECTING: "reconnecting", // sockets dropped, inside the grace window
  LEFT: "left", // cleanly left an active call
  DECLINED: "declined", // actively rejected before answering (EXCLUDED from Missed)
  MISSED: "missed", // never answered: rang out, or caller cancelled first
};

// Why the whole call ended. Describes the call, not any one participant.
const END_REASON = {
  COMPLETED: "completed", // ran its course; everyone left
  NO_ANSWER: "no_answer", // rang out, nobody ever joined
  CANCELLED: "cancelled", // caller aborted before any answer
  DECLINED: "declined", // 1:1 callee rejected before answering
  ABANDONED: "abandoned", // was active, last person sat alone past the alone-timeout
  FAILED: "failed", // media/connection failure (reserved for reconnection phase)
};

const CALL_TYPE = {
  ONE_TO_ONE: "1:1",
  GROUP: "group",
};

// Timeouts (ms). INVARIANT: ALONE_MS must exceed RECONNECT_GRACE_MS so that a
// transient mass-drop is given a chance to recover before the call is torn down.
const TIMEOUTS = {
  RING_MS: calls.ringMs || 35000, // how long an unanswered call rings
  RECONNECT_GRACE_MS: calls.reconnectGraceMs || 18000, // window to rejoin after a socket drop
  ALONE_MS: calls.aloneMs || 45000, // lone participant auto-end (> grace)
};

if (TIMEOUTS.ALONE_MS <= TIMEOUTS.RECONNECT_GRACE_MS) {
  console.warn(
    "[calls] ALONE_MS should be greater than RECONNECT_GRACE_MS; " +
      "a transient mass-disconnect may end calls that would have recovered."
  );
}

// Server -> client event names.
const EVT = {
  RING: "call:ring",
  ENDED: "call:ended",
  PEER_JOINED: "call:peer-joined",
  PEER_LEFT: "call:peer-left",
  PEER_RECONNECTING: "call:peer-reconnecting",
  PEER_RECONNECTED: "call:peer-reconnected",
  STATE: "call:state", // full snapshot, for late joiners / rejoin
};

module.exports = {
  CALL_STATE,
  P_STATUS,
  END_REASON,
  CALL_TYPE,
  TIMEOUTS,
  EVT,
};
