// frontend/src/reducers/io.js
import Actions from "../constants/Actions";

const initialState = {
  io: null,
  room: null,
  messages: [],
  rooms: [],
  id: null,
  onlineUsers: [],
  refreshMeetings: null,
};

const reducer = (state = initialState, action) => {
  switch (action.type) {
    case Actions.IO_INIT:
      return {
        ...state,
        io: action.io,
        id: action.io.id,
      };
    case Actions.SET_ROOMS:
      return {
        ...state,
        rooms: action.rooms,
      };
    case Actions.SET_ROOM:
      return {
        ...state,
        room: action.room,
      };
    case Actions.SET_MESSAGES:
      return {
        ...state,
        messages: action.messages,
      };
    case Actions.MORE_MESSAGES:
      return {
        ...state,
        messages: [...action.messages, ...state.messages],
      };

    case Actions.MESSAGE:
      // ✅ ENHANCED: Check for duplicates before adding
      const isDuplicate = state.messages.some(
        (msg) => msg._id === action.message._id
      );

      if (isDuplicate) {
        console.log(
          "⚠️ Duplicate message prevented in reducer:",
          action.message._id
        );
        return state;
      }

      return {
        ...state,
        messages: [...state.messages, action.message],
      };

    case Actions.ONLINE_USERS:
      return {
        ...state,
        onlineUsers: action.data,
      };

    case Actions.REFRESH_MEETINGS:
      return {
        ...state,
        refreshMeetings: action.timestamp,
      };

    case Actions.MESSAGE_UPDATE:
      console.log("📝 MESSAGE_UPDATE:", {
        messageId: action.message._id,
        tempId: action.message.tempId,
        currentCount: state.messages.length,
      });

      // Check if real message already exists
      const realMessageExists = state.messages.some(
        (msg) => msg._id === action.message._id
      );

      if (realMessageExists) {
        console.log("  ⚠️ Real message already exists, just updating fields");
        return {
          ...state,
          messages: state.messages.map((msg) =>
            msg._id === action.message._id ? { ...msg, ...action.message } : msg
          ),
        };
      }

      // Replace temp with real message
      const hasTemp =
        action.message.tempId &&
        state.messages.some((msg) => msg._id === action.message.tempId);

      if (hasTemp) {
        console.log(
          `  ✅ Replacing temp ${action.message.tempId} with real ${action.message._id}`
        );
        return {
          ...state,
          messages: state.messages.map((msg) =>
            msg._id === action.message.tempId ? { ...action.message } : msg
          ),
        };
      }

      // If we get here, neither temp nor real exists - this shouldn't happen
      // but add the message to be safe
      console.log("  ⚠️ Neither temp nor real exists, adding message");
      return {
        ...state,
        messages: [...state.messages, action.message],
      };

    case Actions.MESSAGE_STATUS: {
      // Read-receipt update from the server. Apply forward-only so a late
      // "delivered" event can never pull a message back from "read" (req 8).
      const RANK = { sent: 0, delivered: 1, read: 2 };
      return {
        ...state,
        messages: state.messages.map((msg) => {
          if (msg._id !== action.messageId) return msg;
          const current = RANK[msg.status] ?? 0;
          const incoming = RANK[action.status] ?? 0;
          if (incoming < current) return msg;
          return {
            ...msg,
            status: action.status,
            deliveredAt: action.deliveredAt ?? msg.deliveredAt,
            readAt: action.readAt ?? msg.readAt,
          };
        }),
      };
    }

    case Actions.REMOVE_MESSAGE:
      console.log("🗑️ Removing message from state:", action.messageId);
      return {
        ...state,
        messages: state.messages.filter(
          (message) => message._id !== action.messageId
        ),
      };

    default:
      return state;
  }
};

export default reducer;
