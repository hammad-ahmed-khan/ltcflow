import Actions from "../constants/Actions";

// FIXED: Load persisted unread state from localStorage on startup
const loadPersistedUnreadState = () => {
  try {
    const persistedRooms = localStorage.getItem("unreadRooms");
    const persistedGroups = localStorage.getItem("unreadGroups");

    return {
      roomsWithNewMessages: persistedRooms ? JSON.parse(persistedRooms) : [],
      groupsWithNewMessages: persistedGroups ? JSON.parse(persistedGroups) : [],
    };
  } catch (error) {
    console.error("Failed to load persisted unread state:", error);
    return {
      roomsWithNewMessages: [],
      groupsWithNewMessages: [],
    };
  }
};

// FIXED: Save unread state to localStorage
const saveUnreadState = (roomsWithNewMessages, groupsWithNewMessages) => {
  try {
    localStorage.setItem("unreadRooms", JSON.stringify(roomsWithNewMessages));
    localStorage.setItem("unreadGroups", JSON.stringify(groupsWithNewMessages));
    console.log("💾 Saved unread state:", {
      rooms: roomsWithNewMessages.length,
      groups: groupsWithNewMessages.length,
    });
  } catch (error) {
    console.error("Failed to save unread state:", error);
  }
};

const persistedState = loadPersistedUnreadState();

const initialState = {
  roomsWithNewMessages: persistedState.roomsWithNewMessages,
  groupsWithNewMessages: persistedState.groupsWithNewMessages,
  typing: null, // Keep for backward compatibility
  typingUsers: [], // NEW: Array of typing users
};

console.log("🔄 Restored unread state on app startup:", {
  rooms: initialState.roomsWithNewMessages.length,
  groups: initialState.groupsWithNewMessages.length,
});

const reducer = (state = initialState, action) => {
  let newState = state;

  switch (action.type) {
    case Actions.SET_TYPING:
      return {
        ...state,
        typing: action.typing, // Keep for backward compatibility
      };

    // ADD new case for enhanced typing:
    case Actions.SET_TYPING_USERS:
      return {
        ...state,
        typingUsers: action.typingUsers,
      };

    case Actions.MESSAGES_ADD_ROOM_UNREAD:
      // Handle both direct messages and groups
      const { roomID, isGroup } = action;

      if (isGroup) {
        // Handle group messages
        if (state.groupsWithNewMessages.includes(roomID)) {
          return state; // Group already has unread messages
        }
        newState = {
          ...state,
          groupsWithNewMessages: [...state.groupsWithNewMessages, roomID],
        };
      } else {
        // Handle direct messages (existing logic)
        if (state.roomsWithNewMessages.includes(roomID)) {
          return state; // Room already has unread messages
        }
        newState = {
          ...state,
          roomsWithNewMessages: [...state.roomsWithNewMessages, roomID],
        };
      }

      // FIXED: Persist to localStorage after state change
      saveUnreadState(
        newState.roomsWithNewMessages,
        newState.groupsWithNewMessages
      );
      return newState;

    case Actions.MESSAGES_REMOVE_ROOM_UNREAD:
      // Handle both direct messages and groups
      const { roomID: removeRoomID, isGroup: removeIsGroup } = action;

      if (removeIsGroup) {
        // Remove from groups
        newState = {
          ...state,
          groupsWithNewMessages: state.groupsWithNewMessages.filter(
            (r) => r !== removeRoomID
          ),
        };
      } else {
        // Remove from direct messages (existing logic)
        newState = {
          ...state,
          roomsWithNewMessages: state.roomsWithNewMessages.filter(
            (r) => r !== removeRoomID
          ),
        };
      }

      // FIXED: Persist to localStorage after state change
      saveUnreadState(
        newState.roomsWithNewMessages,
        newState.groupsWithNewMessages
      );
      return newState;

    // REMOVED: No longer clear unread state on logout
    // Users should see unread messages when they log back in
    default:
      return state;
  }
};

export default reducer;
