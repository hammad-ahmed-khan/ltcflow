// backend/src/calls/initCallSocket.js
//
// Registers the call-signaling handlers on a single authenticated socket and
// delegates all logic to the CallManager singleton. Mirrors the shape of
// mediasoup.initSocket(socket) and is wired in right next to it in init.js.
//
// These handlers use Socket.IO ack callbacks (the second arg), which is why
// they live here rather than in the events/index.js array (that registration
// path passes only `data`, dropping the ack).

const callManager = require("./CallManager");

// Wrap an async handler so a thrown error still acks the client instead of
// silently hanging their request.
function handle(fn) {
  return async (data, cb) => {
    try {
      const result = await fn(data || {});
      if (typeof cb === "function") cb(result || { ok: true });
    } catch (e) {
      console.error("[calls] handler error:", e.message);
      if (typeof cb === "function") cb({ error: "Server error" });
    }
  };
}

const initCallSocket = (socket) => {
  socket.on(
    "call:initiate",
    handle((data) => callManager.initiate(socket, data))
  );
  socket.on(
    "call:accept",
    handle((data) => callManager.accept(socket, data))
  );
  socket.on(
    "call:decline",
    handle((data) => callManager.decline(socket, data))
  );
  socket.on(
    "call:cancel",
    handle((data) => callManager.cancel(socket, data))
  );
  socket.on(
    "call:leave",
    handle((data) => callManager.leave(socket, data))
  );
  socket.on(
    "call:rejoin",
    handle((data) => callManager.rejoin(socket, data))
  );

  // Lifecycle cleanup on socket loss. Registering our own disconnect handler is
  // safe: Socket.IO invokes every registered listener, so this runs alongside
  // the existing mediasoup/init.js disconnect handlers without replacing them.
  socket.on("disconnect", () => {
    try {
      callManager.handleSocketGone(socket);
    } catch (e) {
      console.error("[calls] disconnect cleanup error:", e.message);
    }
  });
};

module.exports = initCallSocket;
