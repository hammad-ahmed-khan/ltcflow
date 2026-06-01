import apiClient from "../api/apiClient";

// ✅ GET missed calls from API
export const getMissedCalls = (options = {}) => {
  const { limit = 50, skip = 0 } = options;
  return apiClient.post("/api/missed-calls/list", { limit, skip });
};

// ✅ CLEAR specific missed call
export const clearMissedCall = (missedCallId) => {
  return apiClient.post("/api/missed-calls/clear", { missedCallId });
};

// ✅ CLEAR all missed calls
export const clearAllMissedCalls = () => {
  return apiClient.post("/api/missed-calls/clear-all");
};
