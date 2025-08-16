// apiClient.js
import axios from "axios";
import store from "../store";
import Config from "../config";

// Add companyId automatically
axios.interceptors.request.use((config) => {
  const state = store.getState();
  const companyId = state.company?.companyId;

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
