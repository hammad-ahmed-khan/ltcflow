import { setGlobal } from "reactn";
import jwtDecode from "jwt-decode";
import setAuthToken from "./actions/setAuthToken";
import initIO from "./actions/initIO";
import store from "./store";

const init = async () => {
  document.addEventListener("gesturestart", (e) => {
    e.preventDefault();
  });

  if (localStorage.getItem("app") !== "Clover 2.x.x") {
    localStorage.clear();
    localStorage.setItem("app", "Clover 2.x.x");
  }

  // Get token and user from localStorage
  const token = localStorage.getItem("token");
  const userString = localStorage.getItem("user");
  const user = userString ? JSON.parse(userString) : null;

  console.log("🔍 init.js - Found in localStorage:", {
    hasToken: !!token,
    hasUser: !!user,
  });

  // 🔹 FIX: If token exists, set it up immediately (no validation)
  if (token) {
    setAuthToken(token); // This sets the Authorization header in axios
    store.dispatch(initIO(token)); // This initializes socket.io
    console.log("✅ Token and socket initialized");
  }

  const state = {
    version: "2.9.2",
    entryPath: window.location.pathname,
    token: token, // Keep token for immediate availability
    user: user || (token ? jwtDecode(token) : {}), // Keep user for immediate availability
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

export default init;
