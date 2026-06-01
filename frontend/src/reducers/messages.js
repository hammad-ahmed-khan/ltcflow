// frontend/src/reducers/messages.js
// Simplified: Only handles message content and typing - NO unread logic

import Actions from "../constants/Actions";

// ============================================
// INITIAL STATE - MESSAGES ONLY
// ============================================

const initialState = {
  // Message content and interactions
  messages: [],

  // Typing indicators
  typing: null,
  typingUsers: [],

  // Message status
  lastMessageId: null,
  lastMessageTimestamp: null,
};

console.log("🔄 Messages reducer initialized (content only)");

// ============================================
// REDUCER - MESSAGE CONTENT ONLY
// ============================================

const reducer = (state = initialState, action) => {
  if (!state) {
    console.warn(
      "⚠️ Messages reducer called with undefined state, using initialState"
    );
    state = initialState;
  }

  switch (action.type) {
    // ============================================
    // TYPING INDICATORS
    // ============================================

    case Actions.SET_TYPING:
      return {
        ...state,
        typing: action.typing,
      };

    case Actions.SET_TYPING_USERS:
      return {
        ...state,
        typingUsers: action.typingUsers || [],
      };

    // ============================================
    // MESSAGE CONTENT MANAGEMENT
    // ============================================

    case Actions.MESSAGES_SET: {
      console.log("💬 Setting messages:", action.messages?.length || 0);

      return {
        ...state,
        messages: action.messages || [],
        lastMessageTimestamp: Date.now(),
      };
    }

    case Actions.MESSAGES_ADD: {
      console.log("💬 Adding new message:", action.message?._id);

      const newMessage = action.message;
      if (!newMessage) return state;

      // Avoid duplicates
      const messageExists = state.messages?.some(
        (msg) => msg._id === newMessage._id
      );
      if (messageExists) {
        console.log("ℹ️ Message already exists:", newMessage._id);
        return state;
      }

      return {
        ...state,
        messages: [...(state.messages || []), newMessage],
        lastMessageId: newMessage._id,
        lastMessageTimestamp: Date.now(),
      };
    }

    case Actions.MESSAGES_UPDATE: {
      console.log("💬 Updating message:", action.messageId);

      return {
        ...state,
        messages: (state.messages || []).map((msg) =>
          msg._id === action.messageId ? { ...msg, ...action.updates } : msg
        ),
      };
    }

    case Actions.MESSAGE_DELETED: {
      console.log("🗑️ Message marked as deleted:", action.messageId);

      return {
        ...state,
        messages: (state.messages || []).map((msg) =>
          msg._id === action.messageId
            ? {
                ...msg,
                isDeleted: true,
                deletedAt: new Date(),
                content: null,
                deletedBy: action.deletedBy || null,
              }
            : msg
        ),
      };
    }

    case Actions.MESSAGES_CLEAR: {
      console.log("🧹 Clearing all messages");

      return {
        ...state,
        messages: [],
        lastMessageId: null,
        lastMessageTimestamp: null,
      };
    }

    // ============================================
    // MESSAGE STATUS UPDATES
    // ============================================

    case Actions.MESSAGE_MARK_READ: {
      console.log("👁️ Marking message as read:", action.messageId);

      return {
        ...state,
        messages: (state.messages || []).map((msg) =>
          msg._id === action.messageId
            ? { ...msg, isRead: true, readAt: new Date() }
            : msg
        ),
      };
    }

    case Actions.MESSAGE_MARK_DELIVERED: {
      console.log("📨 Marking message as delivered:", action.messageId);

      return {
        ...state,
        messages: (state.messages || []).map((msg) =>
          msg._id === action.messageId
            ? { ...msg, isDelivered: true, deliveredAt: new Date() }
            : msg
        ),
      };
    }

    // ============================================
    // CLEANUP
    // ============================================

    case Actions.RESET_MESSAGES: {
      console.log("🔄 Resetting messages state");

      return {
        ...initialState,
      };
    }

    default:
      return state;
  }
};

export default reducer;
