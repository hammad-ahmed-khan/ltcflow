// frontend/src/actions/syncUnreadFromServer.js
import apiClient from "../api/apiClient";
import Actions from "../constants/Actions";

const syncUnreadFromServer = () => {
  return async (dispatch) => {
    try {
      console.log("?? [syncUnreadFromServer] Making API call to /api/unread-summary");
      
      const response = await apiClient.post("/api/unread-summary");
      
      console.log("?? [syncUnreadFromServer] API Response:", response.data);
      
      const { unreadRooms, unreadGroups, totalUnread } = response.data;

      console.log("? [syncUnreadFromServer] Server returned unread state:", {
        rooms: unreadRooms.length,
        groups: unreadGroups.length,
        total: totalUnread,
        roomIds: unreadRooms,
        groupIds: unreadGroups
      });

      // Dispatch to Redux
      dispatch({
        type: Actions.SYNC_UNREAD_FROM_SERVER,
        unreadRooms,
        unreadGroups
      });

      console.log("? [syncUnreadFromServer] Dispatched SYNC_UNREAD_FROM_SERVER action");

      // Update favicon immediately
      try {
        const NotificationService = (await import("../services/NotificationService")).default;
        NotificationService.updateFaviconBadge();
        console.log("? [syncUnreadFromServer] Updated favicon badge");
      } catch (err) {
        console.error("? [syncUnreadFromServer] Failed to update favicon:", err);
      }

      return { success: true, totalUnread };
    } catch (error) {
      console.error("? [syncUnreadFromServer] API call failed:", error);
      console.error("? [syncUnreadFromServer] Error details:", {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      return { success: false, error };
    }
  };
};

export default syncUnreadFromServer;