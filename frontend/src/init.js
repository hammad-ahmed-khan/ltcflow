import { setGlobal } from "reactn";
import jwtDecode from "jwt-decode";
import apiClient from "./api/apiClient";
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

  // 🔹 RESTORED: Token validation logic with stored companyId available
  let token = localStorage.getItem("token");
  let userString = localStorage.getItem("user");
  let user = userString ? JSON.parse(userString) : null;

  if (token) {
    const decoded = jwtDecode(token, { complete: true });
    const dateNow = new Date();
    const isExpired = decoded.exp * 1000 < dateNow.getTime();

    let result;

    if (!isExpired) {
      try {
        // 🔹 NEW: Wait a moment to ensure Redux store has companyId
        // The companyId should now be available from localStorage immediately
        await new Promise((resolve) => setTimeout(resolve, 100));

        const res = await apiClient.post("/api/check-user", {
          id: decoded.payload.id,
        });
        result = res.data;
      } catch (e) {
        console.error("Error checking user:", e);
        result = null;
      }
    }

    if (!result || result.error) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      token = localStorage.getItem("token");
      userString = localStorage.getItem("user");
      user = userString ? JSON.parse(userString) : null;
    }
  }

  if (token) {
    setAuthToken(token);
    store.dispatch(initIO(token));
  }

  const state = {
    version: "2.9.2",
    entryPath: window.location.pathname,
    token,
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
    console.log("Global state init complete!", state)
  );
};

export default init;
