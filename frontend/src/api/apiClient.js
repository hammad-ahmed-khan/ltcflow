// apiClient.js
import axios from "axios";
import store from "../store";
import Config from "../config";

// Add companyId automatically
axios.interceptors.request.use((config) => {
  const state = store.getState();
  let companyId = state.company?.companyId;

  // 🔹 NEW: Fallback to localStorage if Redux store doesn't have companyId yet
  if (!companyId) {
    companyId = localStorage.getItem("companyId");
  }

  if (companyId && !config.headers?.["X-Company-Id"]) {
    config.headers = {
      ...config.headers,
      "X-Company-Id": companyId,
    };
  }

  return config;
});

axios.defaults.baseURL = Config.url || "";

export default axios;
