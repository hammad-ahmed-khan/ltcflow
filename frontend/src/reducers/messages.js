// frontend/src/reducers/messages.js
// Enhanced with multi-tab synchronization and persistent storage

import Actions from "../constants/Actions";
import NotificationService from "../services/NotificationService";

// ============================================
// MULTI-TAB SYNCHRONIZATION
// ============================================

let unreadChannel = null;

// Initialize BroadcastChannel for multi-tab sync
if (typeof window !== "undefined" && "BroadcastChannel" in window) {
  try {
    unreadChannel = new BroadcastChannel("unread_messages_sync");
    console.log("✅ BroadcastChannel initialized for multi-tab sync");
  } catch (error) {
    console.warn("⚠️ BroadcastChannel not supported:", error);
  }
}

// ============================================
// PERSISTENT STORAGE
// ============================================

const loadPersistedUnreadState = () => {
  try {
    const persistedRooms = localStorage.getItem("unreadRooms");
    const persistedGroups = localStorage.getItem("unreadGroups");

    const state = {
      roomsWithNewMessages: persistedRooms ? JSON.parse(persistedRooms) : [],
      groupsWithNewMessages: persistedGroups ? JSON.parse(persistedGroups) : [],
    };

    console.log("📂 Loaded persisted unread state:", {
      rooms: state.roomsWithNewMessages.length,
      groups: state.groupsWithNewMessages.length,
    });

    return state;
  } catch (error) {
    console.error("❌ Failed to load persisted unread state:", error);
    return {
      roomsWithNewMessages: [],
      groupsWithNewMessages: [],
    };
  }
};

const saveUnreadState = (roomsWithNewMessages, groupsWithNewMessages) => {
  try {
    // Save to localStorage
    localStorage.setItem("unreadRooms", JSON.stringify(roomsWithNewMessages));
    localStorage.setItem("unreadGroups", JSON.stringify(groupsWithNewMessages));

    console.log("💾 Saved unread state:", {
      rooms: roomsWithNewMessages.length,
      groups: groupsWithNewMessages.length,
    });

    // Broadcast to other tabs
    if (unreadChannel) {
      unreadChannel.postMessage({
        type: "unread_update",
        rooms: roomsWithNewMessages,
        groups: groupsWithNewMessages,
        timestamp: Date.now(),
      });
    }

    // Update favicon and title
    if (NotificationService) {
      NotificationService.updateFaviconBadge();
    }
  } catch (error) {
    console.error("❌ Failed to save unread state:", error);
  }
};

// ============================================
// LISTEN FOR UPDATES FROM OTHER TABS
// ============================================

if (unreadChannel) {
  unreadChannel.onmessage = (event) => {
    if (event.data.type === "unread_update") {
      console.log("📡 Received unread update from another tab");

      // Import store dynamically to avoid circular dependency
      import("../store").then(({ default: store }) => {
        store.dispatch({
          type: Actions.SYNC_UNREAD_STATE,
          rooms: event.data.rooms,
          groups: event.data.groups,
        });
      });
    }
  };
}

// ============================================
// INITIAL STATE
// ============================================

const persistedState = loadPersistedUnreadState();

const initialState = {
  roomsWithNewMessages: persistedState.roomsWithNewMessages,
  groupsWithNewMessages: persistedState.groupsWithNewMessages,
  typing: null, // Legacy - keep for backward compatibility
  typingUsers: [], // Array of users currently typing
};

console.log("🔄 Messages reducer initialized with unread state:", {
  rooms: initialState.roomsWithNewMessages.length,
  groups: initialState.groupsWithNewMessages.length,
});

// ============================================
// REDUCER
// ============================================

const reducer = (state = initialState, action) => {
  let newState = state;

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
        typingUsers: action.typingUsers,
      };

    // ============================================
    // ADD UNREAD MESSAGE INDICATOR
    // ============================================

    case Actions.MESSAGES_ADD_ROOM_UNREAD: {
      const { roomID, isGroup } = action;

      if (!roomID) {
        console.warn("⚠️ MESSAGES_ADD_ROOM_UNREAD: No roomID provided");
        return state;
      }

      if (isGroup) {
        // Handle group messages
        if (state.groupsWithNewMessages.includes(roomID)) {
          console.log("ℹ️ Group already marked as unread:", roomID);
          return state;
        }

        console.log("📬 Adding unread indicator for group:", roomID);

        newState = {
          ...state,
          groupsWithNewMessages: [...state.groupsWithNewMessages, roomID],
        };
      } else {
        // Handle direct messages
        if (state.roomsWithNewMessages.includes(roomID)) {
          console.log("ℹ️ Room already marked as unread:", roomID);
          return state;
        }

        console.log("📬 Adding unread indicator for room:", roomID);

        newState = {
          ...state,
          roomsWithNewMessages: [...state.roomsWithNewMessages, roomID],
        };
      }

      // Persist to storage and sync across tabs
      saveUnreadState(
        newState.roomsWithNewMessages,
        newState.groupsWithNewMessages
      );

      return newState;
    }

    // ============================================
    // REMOVE UNREAD MESSAGE INDICATOR
    // ============================================

    case Actions.MESSAGES_REMOVE_ROOM_UNREAD: {
      const { roomID, isGroup } = action;

      if (!roomID) {
        console.warn("⚠️ MESSAGES_REMOVE_ROOM_UNREAD: No roomID provided");
        return state;
      }

      if (isGroup) {
        // Remove from groups
        console.log("✅ Removing unread indicator for group:", roomID);

        newState = {
          ...state,
          groupsWithNewMessages: state.groupsWithNewMessages.filter(
            (id) => id !== roomID
          ),
        };
      } else {
        // Remove from direct messages
        console.log("✅ Removing unread indicator for room:", roomID);

        newState = {
          ...state,
          roomsWithNewMessages: state.roomsWithNewMessages.filter(
            (id) => id !== roomID
          ),
        };
      }

      // Persist to storage and sync across tabs
      saveUnreadState(
        newState.roomsWithNewMessages,
        newState.groupsWithNewMessages
      );

      return newState;
    }

    // ============================================
    // SYNC FROM OTHER TABS
    // ============================================

    case Actions.SYNC_UNREAD_STATE: {
      console.log("📡 Syncing unread state from another tab");

      newState = {
        ...state,
        roomsWithNewMessages: action.rooms || [],
        groupsWithNewMessages: action.groups || [],
      };

      // Update favicon without saving (to avoid infinite loop)
      if (NotificationService) {
        NotificationService.updateFaviconBadge();
      }

      return newState;
    }

    // ============================================
    // CLEAR ALL UNREAD (for logout, etc.)
    // ============================================

    case Actions.CLEAR_ALL_UNREAD: {
      console.log("🧹 Clearing all unread indicators");

      newState = {
        ...state,
        roomsWithNewMessages: [],
        groupsWithNewMessages: [],
      };

      saveUnreadState([], []);

      return newState;
    }

    // ============================================
    // MESSAGE DELETED
    // ============================================

    case Actions.MESSAGE_DELETED: {
      console.log("🗑️ Message marked as deleted:", action.messageId);

      return {
        ...state,
        messages: state.messages?.map((msg) =>
          msg._id === action.messageId
            ? { ...msg, isDeleted: true, deletedAt: new Date(), content: null }
            : msg
        ),
      };
    }

    // ============================================
    // BULK OPERATIONS (for optimization)
    // ============================================

    case Actions.MESSAGES_ADD_MULTIPLE_UNREAD: {
      const { roomIDs } = action; // Array of { roomID, isGroup }

      if (!roomIDs || !Array.isArray(roomIDs)) {
        console.warn("⚠️ MESSAGES_ADD_MULTIPLE_UNREAD: Invalid roomIDs");
        return state;
      }

      const newUnreadRooms = [...state.roomsWithNewMessages];
      const newUnreadGroups = [...state.groupsWithNewMessages];

      roomIDs.forEach(({ roomID, isGroup }) => {
        if (isGroup) {
          if (!newUnreadGroups.includes(roomID)) {
            newUnreadGroups.push(roomID);
          }
        } else {
          if (!newUnreadRooms.includes(roomID)) {
            newUnreadRooms.push(roomID);
          }
        }
      });

      newState = {
        ...state,
        roomsWithNewMessages: newUnreadRooms,
        groupsWithNewMessages: newUnreadGroups,
      };

      saveUnreadState(newUnreadRooms, newUnreadGroups);

      console.log("📬 Added multiple unread indicators:", roomIDs.length);

      return newState;
    }

    // ============================================
    // DEFAULT
    // ============================================

    default:
      return state;
  }
};

// ============================================
// CLEANUP ON MODULE UNLOAD
// ============================================

if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    if (unreadChannel) {
      unreadChannel.close();
    }
  });
}

export default reducer;
