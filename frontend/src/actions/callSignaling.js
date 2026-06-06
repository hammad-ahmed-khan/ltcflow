// frontend/src/actions/callSignaling.js
//
// Thin wrappers over the promise-based socket (io.request) for the call
// lifecycle. Each returns the server ack, e.g. { ok: true } or { error }.
// Pass the socket from redux: const io = useSelector((s) => s.io.io);

const safe = async (io, type, payload) => {
  if (!io || typeof io.request !== "function") {
    console.warn(`[calls] socket not ready for ${type}`);
    return { error: "Socket not ready" };
  }
  try {
    return await io.request(type, payload);
  } catch (e) {
    console.error(`[calls] ${type} failed:`, e);
    return { error: "Request failed" };
  }
};

// Caller starts a call. Roster + caller info are resolved server-side, so the
// client only needs the meeting, the conversation it belongs to, and the media.
export const initiateCall = (io, { meetingId, roomId, type, media }) =>
  safe(io, "call:initiate", { meetingId, roomId, type, media });

export const acceptCall = (io, meetingId) =>
  safe(io, "call:accept", { meetingId });

export const declineCall = (io, meetingId) =>
  safe(io, "call:decline", { meetingId });

export const cancelCall = (io, meetingId) =>
  safe(io, "call:cancel", { meetingId });

export const leaveCall = (io, meetingId) =>
  safe(io, "call:leave", { meetingId });

export const rejoinCall = (io, meetingId) =>
  safe(io, "call:rejoin", { meetingId });
