import moment from "moment";
import Actions from "../constants/Actions";

const initialState = {
  producers: [],
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
        "producers"
      );
      return {
        ...state,
        producers: [...state.producers, ...(action.producers || [])],
        closed: false,
      };

    // 🔧 ENHANCED: Better logging for RTC_RESET_PRODUCERS
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
          moment(action.consumers.timestamp)
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
      };

    case Actions.RTC_ANSWER:
      return {
        ...state,
        answerIncrement: state.answerIncrement + 1,
        answerData: action.data,
        closed: false,
        closingState: false,
      };

    case Actions.RTC_SET_COUNTERPART:
      return {
        ...state,
        counterpart: action.counterpart,
        closed: false,
      };

    /*
    case Actions.RTC_LEAVE:
      console.log("🔄 RTC_LEAVE: Resetting to initial state");
      return initialState;
      */

    default:
      return state;
  }
};

export default reducer;
