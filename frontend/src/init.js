// frontend/src/init.js
import { setGlobal } from "reactn";
import jwtDecode from "jwt-decode";
import setAuthToken from "./actions/setAuthToken";
import initIO from "./actions/initIO";
import store from "./store";
import syncUnreadFromServer from "./actions/syncUnreadFromServer";

const init = async () => {
  document.addEventListener("gesturestart", (e) => {
    e.preventDefault();
  });

  if (localStorage.getItem("app") !== "LTC Flow 2.x.x") {
    localStorage.clear();
    localStorage.setItem("app", "LTC Flow 2.x.x");
  }

  const token = localStorage.getItem("token");
  const userString = localStorage.getItem("user");
  const user = userString ? JSON.parse(userString) : null;

  console.log("🔍 init.js - Found in localStorage:", {
    hasToken: !!token,
    hasUser: !!user,
  });

  if (token) {
    setAuthToken(token);
    store.dispatch(initIO(token));
    console.log("✅ Token and socket initialized");

    // 🆕 CRITICAL: Sync unread state from server after socket connects
    console.log("⏰ Scheduling unread sync in 3 seconds...");

    //setTimeout(async () => {
    //      console.log("📬 Starting unread sync from server...");

    try {
      const result = await store.dispatch(syncUnreadFromServer());

      if (result.success) {
        console.log(
          `✅ Unread sync SUCCESS: ${result.totalUnread} unread conversations`
        );
      } else {
        console.error("❌ Unread sync FAILED:", result.error);
      }
    } catch (error) {
      console.error("❌ Unread sync threw error:", error);
    }
    //  }, 100); // 3 seconds to ensure socket is connected
  }

  const state = {
    version: "2.9.2",
    entryPath: window.location.pathname,
    token: token,
    user: user || (token ? jwtDecode(token) : {}),
    rooms: [],
    searchResults: [],
    favorites: [],
    meetings: [],
    nav: "rooms",
    search: "",
    over: null,
    isPicker: false,
    messages: [],
    streams: [],
    inCall: false,
    video: true,
    audio: true,
    audioStream: null,
    videoStream: null,
    screenStream: null,
    callStatus: null,
    counterpart: null,
    callDirection: null,
    meeting: null,
    showPanel: true,
    panel: "standard",
    newGroupUsers: [],
  };

  setGlobal(state).then(() =>
    console.log("✅ init.js complete - token preserved:", {
      hasToken: !!state.token,
    })
  );
};

export default init; // ✅ THIS LINE IS CRITICAL - must be at the end
