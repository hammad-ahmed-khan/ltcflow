import Actions from "../constants/Actions";
import NotificationService from "../services/NotificationService";

// ============================================
// PERSISTENT STORAGE - SERVER STATE ONLY
// ============================================

const loadPersistedUnreadState = () => {
  try {
    const persistedData = localStorage.getItem("serverUnreadState");
    if (persistedData) {
      const parsed = JSON.parse(persistedData);
      return {
        unreadRooms: Array.isArray(parsed.unreadRooms)
          ? parsed.unreadRooms
          : [],
        unreadGroups: Array.isArray(parsed.unreadGroups)
          ? parsed.unreadGroups
          : [],
        unreadMissedCalls:
          typeof parsed.unreadMissedCalls === "number"
            ? parsed.unreadMissedCalls
            : 0,
        totalUnread:
          typeof parsed.totalUnread === "number" ? parsed.totalUnread : 0,
        missedCalls: Array.isArray(parsed.missedCalls)
          ? parsed.missedCalls
          : [],
      };
    }
    return null;
  } catch (error) {
    console.error("Error loading persisted unread state:", error);
    return null;
  }
};

const saveUnreadState = (state) => {
  try {
    const dataToSave = {
      unreadRooms: Array.isArray(state.unreadRooms) ? state.unreadRooms : [],
      unreadGroups: Array.isArray(state.unreadGroups) ? state.unreadGroups : [],
      unreadMissedCalls:
        typeof state.unreadMissedCalls === "number"
          ? state.unreadMissedCalls
          : 0,
      totalUnread:
        typeof state.totalUnread === "number" ? state.totalUnread : 0,
      missedCalls: Array.isArray(state.missedCalls) ? state.missedCalls : [],
      lastUpdated: Date.now(),
    };

    localStorage.setItem("serverUnreadState", JSON.stringify(dataToSave));

    // Update favicon/notifications
    if (
      NotificationService &&
      typeof NotificationService.updateFaviconBadge === "function"
    ) {
      NotificationService.updateFaviconBadge();
    }

    console.log("💾 Saved unread state:", {
      rooms: dataToSave.unreadRooms.length,
      groups: dataToSave.unreadGroups.length,
      missedCalls: dataToSave.unreadMissedCalls,
      total: dataToSave.totalUnread,
    });
  } catch (error) {
    console.error("❌ Failed to save unread state:", error);
  }
};

// ============================================
// INITIAL STATE - SERVER-DRIVEN ONLY
// ============================================

const persistedState = loadPersistedUnreadState();
const initialState = {
  // Server-driven unread state (ONLY source of truth)
  unreadRooms: persistedState?.unreadRooms || [],
  unreadGroups: persistedState?.unreadGroups || [],
  unreadMissedCalls: persistedState?.unreadMissedCalls || 0,
  totalUnread: persistedState?.totalUnread || 0,

  // Missed calls list (for MissedCallsList component)
  missedCalls: persistedState?.missedCalls || [],
};

console.log("🔄 Unread reducer initialized (server-only):", {
  rooms: initialState.unreadRooms.length,
  groups: initialState.unreadGroups.length,
  missedCalls: initialState.unreadMissedCalls,
  total: initialState.totalUnread,
});

// ============================================
// SAFE OPERATIONS
// ============================================

const ensureArray = (value) => (Array.isArray(value) ? value : []);
const ensureNumber = (value) =>
  typeof value === "number" && !isNaN(value) ? value : 0;

// ============================================
// REDUCER - SERVER-ONLY
// ============================================

const unreadReducer = (state = initialState, action) => {
  if (!state) {
    console.warn(
      "⚠️ Unread reducer called with undefined state, using initialState"
    );
    state = initialState;
  }

  // Ensure state is always safe
  const safeState = {
    ...state,
    unreadRooms: ensureArray(state.unreadRooms),
    unreadGroups: ensureArray(state.unreadGroups),
    unreadMissedCalls: ensureNumber(state.unreadMissedCalls),
    totalUnread: ensureNumber(state.totalUnread),
    missedCalls: ensureArray(state.missedCalls),
  };

  let newState;

  switch (action.type) {
    // ============================================
    // SERVER-DRIVEN UNREAD STATE (PRIMARY)
    // ============================================

    case Actions.SYNC_UNREAD_FROM_SERVER:
      console.log("📊 SYNC_UNREAD_FROM_SERVER:", {
        rooms: action.unreadRooms?.length || 0,
        groups: action.unreadGroups?.length || 0,
        missedCalls: action.unreadMissedCalls || 0,
        total: action.totalUnread || 0,
      });

      newState = {
        ...safeState,
        unreadRooms: ensureArray(action.unreadRooms),
        unreadGroups: ensureArray(action.unreadGroups),
        unreadMissedCalls: ensureNumber(action.unreadMissedCalls),
        totalUnread: ensureNumber(action.totalUnread),
      };

      saveUnreadState(newState);
      return newState;

    // ============================================
    // MISSED CALLS BADGE MANAGEMENT
    // ============================================

    case Actions.UPDATE_MISSED_CALLS_BADGE:
      console.log(
        "📞 📊 Updating missed calls badge:",
        action.unreadMissedCalls
      );

      newState = {
        ...safeState,
        unreadMissedCalls: ensureNumber(action.unreadMissedCalls),
        totalUnread:
          safeState.unreadRooms.length +
          safeState.unreadGroups.length +
          ensureNumber(action.unreadMissedCalls),
      };

      saveUnreadState(newState);
      return newState;

    case Actions.CLEAR_MISSED_CALLS_BADGE:
      console.log("📞 Clearing missed calls badge");

      newState = {
        ...safeState,
        unreadMissedCalls: 0,
        totalUnread:
          safeState.unreadRooms.length + safeState.unreadGroups.length,
      };

      saveUnreadState(newState);
      return newState;

    // ============================================
    // GLOBAL CLEAR
    // ============================================

    case Actions.CLEAR_ALL_UNREAD: {
      console.log("🧹 Clearing all unread indicators");

      newState = {
        ...safeState,
        unreadRooms: [],
        unreadGroups: [],
        unreadMissedCalls: 0,
        totalUnread: 0,
      };

      saveUnreadState(newState);
      return newState;
    }

    default:
      return safeState;
  }
};

export default unreadReducer;
