// frontend/src/utils/messageSender.js
import store from "../store";
import messageQueue from "./messageQueue";

export const sendMessage = (type, data, callback = null) => {
  const io = store.getState().io.io;

  if (!io) {
    console.warn("❌ No socket connection available");
    return false;
  }

  if (io.connected) {
    // Send immediately if connected
    console.log(`📤 Sending message immediately:`, type);
    if (callback) {
      io.emit(type, data, callback);
    } else {
      io.emit(type, data);
    }

    // Process any queued messages
    messageQueue.process(io);
    return true;
  } else {
    // Queue message if not connected
    console.log(`📦 Queueing message (not connected):`, type);
    messageQueue.add({ type, data, callback });
    return false;
  }
};

export const getConnectionStatus = () => {
  const io = store.getState().io.io;
  return {
    hasSocket: !!io,
    isConnected: io ? io.connected : false,
    transport: io && io.io ? io.io.engine.transport.name : "unknown",
    queueSize: messageQueue.size(),
  };
};
