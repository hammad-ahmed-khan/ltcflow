// frontend/src/reducers/rtc.js
import moment from "moment";
import Actions from "../constants/Actions";

// callState is the single authoritative lifecycle value. The legacy `closed` /
// `closingState` booleans are kept in sync for now so existing effects in
// Meeting/Ringing keep working during the migration; new code should read
// `callState`.
//   idle | ringing_in | ringing_out | active | ended
const initialState = {
  producers: [],
  pausedProducers: [],
  lastLeave: null,
  roomID: null,
  consumers: [],
  consumersTimestamp: null,
  peers: {},
  increment: 0,
  callIncrement: 0,
  callData: null,
  answerIncrement: 0,
  answerData: 0,
  lastLeaveType: "leave",
  counterpart: null,
  closingState: false,
  closed: true,

  // ── Phase 2 lifecycle ──
  callState: "idle",
  endReason: null,
  roster: {}, // userId -> status ('joined'|'reconnecting'|'left'|...)
  reconnectingPeers: [], // userIds currently mid-reconnect (drives banner)
  endedIncrement: 0, // bumps each time a call ends, so effects can react
};

const reducer = (state = initialState, action) => {
  switch (action.type) {
    case Actions.RTC_CLOSE:
      return {
        ...state,
        closingState: !state.closed,
      };

    // 🔧 FIXED: Enhanced RTC_PRODUCER to handle duplicates and replacements
    case Actions.RTC_PRODUCER:
      return {
        ...state,
        producers: [...state.producers, action.data],
        closed: false,
      };

    case Actions.RTC_PRODUCERS:
      console.log(
        "🔄 RTC_PRODUCERS: Adding",
        action.producers?.length || 0,
        "producers",
      );
      return {
        ...state,
        producers: [...state.producers, ...(action.producers || [])],
        closed: false,
      };

    case Actions.RTC_RESET_PRODUCERS:
      console.log("🔄 RTC_RESET_PRODUCERS:", {
        reason: action.lastLeaveType,
        removedItem: action.producerID || action.socketID,
        before: state.producers.length,
        after: action.producers?.length || 0,
      });
      return {
        ...state,
        producers: [...(action.producers || [])],
        lastLeave: action.producerID || action.socketID,
        lastLeaveType: action.lastLeaveType || "leave",
        increment: state.increment + 1,
      };

    case Actions.RTC_ROOM_ID:
      console.log("🔄 RTC_ROOM_ID:", action.roomID);
      return {
        ...state,
        roomID: action.roomID,
        closed: false,
      };

    case Actions.RTC_CONSUMERS:
      if (
        state.consumersTimestamp &&
        moment(state.consumersTimestamp).isAfter(
          moment(action.consumers.timestamp),
        )
      ) {
        console.log("ℹ️ Ignoring old consumers update");
        return state;
      }
      console.log("🔄 RTC_CONSUMERS:", {
        consumers: action.consumers?.content?.length || 0,
        peers: Object.keys(action.peers || {}).length,
      });
      return {
        ...state,
        consumers: action.consumers.content,
        peers: action.peers || state.peers,
        consumersTimestamp: action.consumers.timestamp,
        closed: false,
      };

    case Actions.RTC_NEW_PEER:
      console.log("🔄 RTC_NEW_PEER:", action.data.socketID);
      return {
        ...state,
        peers: {
          ...state.peers,
          [action.data.socketID]: action.data,
        },
        closed: false,
      };

    case Actions.RTC_CALL:
      return {
        ...state,
        callIncrement: state.callIncrement + 1,
        callData: action.data,
        closed: false,
        closingState: false,
        callState: "ringing_in",
        endReason: null,
      };

    case Actions.RTC_ANSWER:
      return {
        ...state,
        answerIncrement: state.answerIncrement + 1,
        answerData: action.data,
        closed: false,
        closingState: false,
        callState: "active",
      };

    case Actions.RTC_SET_COUNTERPART:
      return {
        ...state,
        counterpart: action.counterpart,
        closed: false,
      };

    // ── Phase 2: lifecycle transitions ──

    // Generic transition / server snapshot. action.state is required;
    // action.roster optional (from a call:state snapshot).
    case Actions.RTC_CALL_STATE: {
      const next = { ...state };
      if (action.state) next.callState = action.state;
      if (action.roster) {
        next.roster = action.roster.reduce((acc, p) => {
          acc[p.userId] = p.status;
          return acc;
        }, {});
      }
      if (action.state && action.state !== "ended") next.closed = false;
      return next;
    }

    case Actions.RTC_CALL_ENDED:
      return {
        ...state,
        callState: "ended",
        endReason: action.reason || null,
        endedIncrement: state.endedIncrement + 1,
      };

    case Actions.RTC_PEER_JOINED:
      return {
        ...state,
        roster: { ...state.roster, [action.userId]: "joined" },
        reconnectingPeers: state.reconnectingPeers.filter(
          (id) => id !== action.userId,
        ),
      };

    case Actions.RTC_PEER_LEFT:
      return {
        ...state,
        roster: { ...state.roster, [action.userId]: "left" },
        reconnectingPeers: state.reconnectingPeers.filter(
          (id) => id !== action.userId,
        ),
      };

    case Actions.RTC_PEER_RECONNECTING:
      return {
        ...state,
        roster: { ...state.roster, [action.userId]: "reconnecting" },
        reconnectingPeers: state.reconnectingPeers.includes(action.userId)
          ? state.reconnectingPeers
          : [...state.reconnectingPeers, action.userId],
      };

    case Actions.RTC_PEER_RECONNECTED:
      return {
        ...state,
        roster: { ...state.roster, [action.userId]: "joined" },
        reconnectingPeers: state.reconnectingPeers.filter(
          (id) => id !== action.userId,
        ),
      };

    // Real reset now (was previously a no-op, which left stale call state and
    // was the root of the fragile `closed`/`closingState` behavior).
    case Actions.RTC_LEAVE:
      console.log("🔄 RTC_LEAVE: resetting call state");
      return {
        ...initialState,
        // preserve nothing call-specific; a fresh call starts clean
      };

    case Actions.RTC_PRODUCER_PAUSED:
      return {
        ...state,
        pausedProducers: state.pausedProducers.includes(action.producerID)
          ? state.pausedProducers
          : [...state.pausedProducers, action.producerID],
      };
    case Actions.RTC_PRODUCER_RESUMED:
      return {
        ...state,
        pausedProducers: state.pausedProducers.filter(
          (id) => id !== action.producerID,
        ),
      };

    default:
      return state;
  }
};

export default reducer;
