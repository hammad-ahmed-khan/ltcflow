import Actions from "../constants/Actions";

const initialState = {
  missedCalls: [],
  callHistory: [],
  activeCall: null,
};

// ============================================
// SAFE ARRAY OPERATIONS
// ============================================

const ensureArray = (value) => (Array.isArray(value) ? value : []);
const ensureNumber = (value) =>
  typeof value === "number" && !isNaN(value) ? value : 0;

const callsReducer = (state = initialState, action) => {
  switch (action.type) {
    // ============================================
    // MISSED CALLS LIST MANAGEMENT
    // ============================================

    case Actions.SET_MISSED_CALLS:
      console.log("📞 Setting missed calls list:", action.calls?.length || 0);
      return {
        ...state,
        missedCalls: ensureArray(action.calls),
      };

    case Actions.ADD_MISSED_CALL: {
      const existingCall = state.missedCalls.find(
        (call) => call._id === action.call._id
      );
      if (existingCall) {
        console.log(
          `📞 🚨 REDUX DUPLICATE PREVENTED: ${action.call._id} already exists`
        );
        return state;
      }
      console.log(`📞 ✅ REDUX ADDING NEW: ${action.call._id}`);
      return {
        ...state,
        missedCalls: [action.call, ...state.missedCalls],
      };
    }

    case Actions.REMOVE_MISSED_CALL:
      console.log("📞 Removing missed call from list:", action.callId);
      return {
        ...state,
        missedCalls: state.missedCalls.filter(
          (call) => call._id !== action.callId
        ),
      };

    case Actions.CLEAR_MISSED_CALLS:
      console.log("📞 Clearing all missed calls from list");
      return {
        ...state,
        missedCalls: [],
      };

    case Actions.CALL_ENDED:
      return {
        ...state,
        callHistory: [action.callRecord, ...state.callHistory],
        activeCall: null,
      };

    case Actions.CALL_STARTED:
      return {
        ...state,
        activeCall: action.call,
      };

    default:
      return state;
  }
};

export default callsReducer;
