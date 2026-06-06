// frontend/src/actions/missedCalls.js
import axios from "../api/apiClient";

// apiClient is the shared axios instance: its interceptor attaches X-Company-Id,
// and the app's global Authorization default (set at login) carries the token —
// same as the working /api/unread-summary and /api/rooms/list calls. We do NOT
// set Authorization manually here, so these inherit exactly what those use.
export const getMissedCalls = () => axios.get("/api/calls/missed");

export const clearMissedCalls = () => axios.post("/api/calls/missed/clear", {});

export const markMissedSeen = () => axios.post("/api/calls/missed/seen", {});
