/**
 * Mediasoup Server Module
 * 
 * Handles WebRTC media routing via mediasoup SFU.
 * 
 * ✅ FIXES:
 * - Producer state validation before consuming
 * - Proper resume error handling
 * - getProducers handler for reconnection support
 * - Improved cleanup on disconnect
 * - Better error messages for debugging
 */

const mediasoup = require("mediasoup");
const config = require("../../config");
const store = require("../store");
const User = require("../models/User");
const Meeting = require("../models/Meeting");
const mongoose = require("mongoose");

// ============================================================================
// STATE
// ============================================================================
let worker;
let mediasoupRouter;
const producerTransports = {};
const consumerTransports = {};
const producers = {};
const consumers = {};
const consumersObjects = {};

// ============================================================================
// INITIALIZATION
// ============================================================================

const init = async () => {
  worker = await mediasoup.createWorker({
    rtcMinPort: config.rtcMinPort,
    rtcMaxPort: config.rtcMaxPort,
    logLevel: config.mediasoupLogLevel,
  });

  worker.on("died", () => {
    console.error(
      "mediasoup worker died, exiting in 2 seconds... [pid:%d]",
      worker.pid
    );
    setTimeout(() => process.exit(1), 2000);
  });

  const mediaCodecs = config.mediaCodecs;
  mediasoupRouter = await worker.createRouter({ mediaCodecs });
  console.log("mediasoup worker running".green);
  console.log(`mediasoup ip is ${config.ipAddress.ip}`.green);
};

// ============================================================================
// TRANSPORT CREATION
// ============================================================================

async function createWebRtcTransport() {
  const transport = await mediasoupRouter.createWebRtcTransport({
    listenInfos: [
      {
        protocol: "tcp",
        ip: config.ipAddress.ip,
        announcedAddress: config.ipAddress.announcedIp,
      },
      {
        protocol: "udp",
        ip: config.ipAddress.ip,
        announcedAddress: config.ipAddress.announcedIp,
      },
    ],
    initialAvailableOutgoingBitrate: 1000000,
    enableScalabilityModes: true,
  });

  try {
    await transport.setMaxIncomingBitrate(1500000);
  } catch (error) {
    // Ignore - not critical
  }

  return {
    transport,
    params: {
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
    },
  };
}

// ============================================================================
// CONSUMER CREATION
// ============================================================================

async function createConsumer(producer, rtpCapabilities, consumerTransport) {
  // ✅ FIX: Validate producer state before consuming
  if (!producer || producer.closed) {
    console.error("Cannot create consumer: producer is closed or invalid");
    return null;
  }

  if (
    !mediasoupRouter.canConsume({
      producerId: producer.id,
      rtpCapabilities,
    })
  ) {
    console.error("Router cannot consume producer:", producer.id);
    return null;
  }

  let consumer;
  try {
    consumer = await consumerTransport.consume({
      producerId: producer.id,
      rtpCapabilities,
      paused: producer.kind === "video", // Video starts paused, needs resume
    });
  } catch (error) {
    console.error("consume failed:", error);
    return null;
  }

  // Configure simulcast preferences
  if (consumer.type === "simulcast") {
    try {
      await consumer.setPreferredLayers({ spatialLayer: 2, temporalLayer: 2 });
    } catch (e) {
      // Ignore - not critical
    }
  }

  return {
    consumer,
    response: {
      producerId: producer.id,
      id: consumer.id,
      kind: consumer.kind,
      rtpParameters: consumer.rtpParameters,
      type: consumer.type,
      producerPaused: consumer.producerPaused,
    },
  };
}

// ============================================================================
// SOCKET HANDLERS
// ============================================================================

const initSocket = (socket) => {
  /**
   * Get router RTP capabilities
   */
  socket.on("getRouterRtpCapabilities", (data, callback) => {
    callback(mediasoupRouter.rtpCapabilities);
  });

  /**
   * Create producer transport
   */
  socket.on("createProducerTransport", async (data, callback) => {
    try {
      const { transport, params } = await createWebRtcTransport();
      producerTransports[socket.id] = transport;
      callback(params);
    } catch (err) {
      console.error("createProducerTransport error:", err);
      callback({ error: err.message });
    }
  });

  /**
   * Create consumer transport
   */
  socket.on("createConsumerTransport", async (data, callback) => {
    try {
      const { transport, params } = await createWebRtcTransport();
      consumerTransports[socket.id] = transport;
      callback(params);
    } catch (err) {
      console.error("createConsumerTransport error:", err);
      callback({ error: err.message });
    }
  });

  /**
   * Connect producer transport
   */
  socket.on("connectProducerTransport", async (data, callback) => {
    try {
      const transport = producerTransports[socket.id];
      if (!transport) {
        console.error("connectProducerTransport: no transport for socket", socket.id);
        return callback({ error: "producer transport not found" });
      }
      await transport.connect({ dtlsParameters: data.dtlsParameters });
      callback();
    } catch (err) {
      console.error("connectProducerTransport error:", err);
      callback({ error: err.message });
    }
  });

  /**
   * Connect consumer transport
   */
  socket.on("connectConsumerTransport", async (data, callback) => {
    try {
      const transport = consumerTransports[socket.id];
      if (!transport) {
        console.error("connectConsumerTransport: no transport for socket", socket.id);
        return callback({ error: "consumer transport not found" });
      }
      await transport.connect({ dtlsParameters: data.dtlsParameters });
      callback();
    } catch (err) {
      console.error("connectConsumerTransport error:", err);
      callback({ error: err.message });
    }
  });

  /**
   * Produce media
   */
  socket.on("produce", async (data, callback) => {
    try {
      const { kind, rtpParameters, isScreen } = data;
      const pTransport = producerTransports[socket.id];
      
      if (!pTransport) {
        console.error("produce: no producer transport for socket", socket.id);
        return callback({ error: "producer transport not found" });
      }

      const producer = await pTransport.produce({
        kind,
        rtpParameters,
      });

      producer.on("transportclose", () => {
        console.log("producer's transport closed", producer.id);
        closeProducer(producer, socket.id);
      });

      producer.observer.on("close", () => {
        console.log("producer closed", producer.id);
        closeProducer(producer, socket.id);
      });

      // Store in peers database
      await store.peers.asyncInsert({
        type: "producer",
        socketID: socket.id,
        userID: socket.decoded_token.id,
        roomID: data.roomID || "general",
        producerID: producer.id,
        isScreen,
      });

      // Store producer reference
      if (!producers[socket.id]) {
        producers[socket.id] = {};
      }
      producers[socket.id][producer.id] = producer;

      // Notify peers of new producer
      socket.to(data.roomID).emit("newProducer", {
        userID: socket.decoded_token.id,
        roomID: data.roomID || "general",
        socketID: socket.id,
        producerID: producer.id,
        isScreen,
      });

      callback({ id: producer.id });
    } catch (err) {
      console.error("produce error:", err);
      callback({ error: err.message });
    }
  });

  /**
   * Consume media - ✅ FIX: Added producer state validation
   */
  socket.on("consume", async (data, callback) => {
    try {
      const { socketID, producerID, rtpCapabilities } = data;

      // ✅ FIX: Validate producer exists
      if (!producers[socketID] || !producers[socketID][producerID]) {
        console.error("consume: producer not found", socketID, producerID);
        return callback({ error: "producer not found" });
      }

      const producer = producers[socketID][producerID];

      // ✅ FIX: Validate producer state
      if (producer.closed) {
        console.error("consume: producer is closed", producerID);
        return callback({ error: "producer is closed" });
      }

      // ✅ FIX: Check if producer is paused (informational)
      if (producer.paused) {
        console.log("consume: producer is paused", producerID);
      }

      const cTransport = consumerTransports[socket.id];
      if (!cTransport) {
        console.error("consume: no consumer transport for socket", socket.id);
        return callback({ error: "consumer transport not found" });
      }

      // ✅ FIX: Validate consumer transport state
      if (cTransport.closed) {
        console.error("consume: consumer transport is closed", socket.id);
        return callback({ error: "consumer transport is closed" });
      }

      const obj = await createConsumer(producer, rtpCapabilities, cTransport);

      if (!obj) {
        return callback({ error: "createConsumer failed - check server logs" });
      }

      // Handle consumer lifecycle events
      obj.consumer.on("transportclose", () => {
        closeConsumer(socket.id, producerID);
      });

      obj.consumer.on("producerclose", () => {
        // Inform client to remove the producer tile
        try {
          socket.emit("producer-closed", { producerID });
        } catch (e) {}
        closeConsumer(socket.id, producerID);
      });

      // Store consumer reference
      if (!consumers[socket.id]) {
        consumers[socket.id] = {};
      }
      consumers[socket.id][producerID] = obj.consumer;

      callback(obj.response);
    } catch (err) {
      console.error("consume error:", err);
      callback({ error: err.message });
    }
  });

  /**
   * Resume consumer - ✅ FIX: Improved error handling
   */
  socket.on("resume", async (data, callback) => {
    try {
      const { producerID } = data;

      // ✅ FIX: Validate consumer exists
      if (!consumers[socket.id] || !consumers[socket.id][producerID]) {
        console.error("Resume failed: consumer not found", producerID, socket.id);
        return callback({ error: "consumer not found" });
      }

      const consumer = consumers[socket.id][producerID];

      // ✅ FIX: Validate consumer state
      if (consumer.closed) {
        console.error("Cannot resume closed consumer:", producerID);
        return callback({ error: "consumer is closed" });
      }

      // ✅ FIX: Check if already resumed
      if (!consumer.paused) {
        console.log("Consumer already resumed:", producerID);
        return callback(); // Success - already in desired state
      }

      await consumer.resume();
      console.log("Successfully resumed consumer:", producerID, "for socket:", socket.id);
      callback();
    } catch (error) {
      console.error("Resume failed:", error);
      callback({ error: error.message });
    }
  });

  /**
   * ✅ NEW: Get all producers in a room - for reconnection support
   */
  socket.on("getProducers", async (data, callback) => {
    try {
      const { roomID } = data;

      if (!roomID) {
        return callback({ error: "roomID required" });
      }

      const roomProducers = await store.peers.asyncFind({
        type: "producer",
        roomID: roomID,
      });

      // Filter out own producers and validate they still exist
      const validProducers = roomProducers.filter(p => {
        // Skip own producers
        if (p.socketID === socket.id) return false;
        
        // ✅ FIX: Validate producer still exists and is not closed
        if (!producers[p.socketID] || !producers[p.socketID][p.producerID]) {
          return false;
        }
        
        if (producers[p.socketID][p.producerID].closed) {
          return false;
        }
        
        return true;
      });

      callback({ producers: validProducers });
    } catch (err) {
      console.error("getProducers error:", err);
      callback({ error: err.message });
    }
  });

  /**
   * Create room
   */
  socket.on("create", async (data, callback) => {
    const room = await store.rooms.asyncInsert({ lastJoin: Date.now() });
    callback(room);
  });

  /**
   * Join room
   */
  socket.on("join", async (data, callback) => {
    try {
      const userId = socket.decoded_token.id;

      // Get user with company information
      const currentUser = await User.findOne(
        { _id: userId },
        { password: 0 }
      ).populate([{ path: "picture", strictPopulate: false }]);

      if (!currentUser) {
        return callback({ error: "User not found" });
      }

      const companyId = currentUser.companyId;

      // Notify existing peers of new participant
      socket.to(data.roomID).emit("newPeer", {
        userID: userId,
        socketID: socket.id,
        user: currentUser,
      });

      // Store peer info
      consumersObjects[data.roomID] = {
        ...(consumersObjects[data.roomID] || {}),
        [socket.id]: {
          userID: userId,
          socketID: socket.id,
          user: currentUser,
        },
      };

      await socket.join(data.roomID || "general");
      
      if (data.roomID) {
        await store.rooms.asyncUpdate(
          { _id: data.roomID },
          { $set: { lastJoin: Date.now() } }
        );
      }

      // Get existing producers in room
      const peers = await store.peers.asyncFind({
        type: "producer",
        roomID: data.roomID || "general",
      });

      // ✅ FIX: Filter out invalid producers
      const validPeers = peers.filter(p => {
        if (!producers[p.socketID] || !producers[p.socketID][p.producerID]) {
          return false;
        }
        return !producers[p.socketID][p.producerID].closed;
      });

      // Track consumers in room
      if (!store.consumerUserIDs[data.roomID]) {
        store.consumerUserIDs[data.roomID] = [];
      }
      store.consumerUserIDs[data.roomID].push(socket.id);

      socket.to(data.roomID).emit("consumers", {
        content: store.consumerUserIDs[data.roomID],
        timestamp: Date.now(),
      });

      // Update meeting record
      await Meeting.findOneAndUpdate(
        {
          _id: data.roomID,
          companyId,
        },
        {
          lastEnter: Date.now(),
          $push: { peers: socket.id },
          $addToSet: { users: mongoose.Types.ObjectId(userId) },
        }
      )
        .then((meeting) => {
          if (meeting) {
            meeting.users.forEach((user) => {
              socket
                .to(user)
                .emit("refresh-meetings", { timestamp: Date.now() });
            });
          }
        })
        .catch((err) => console.log("Meeting update error:", err));

      store.roomIDs[socket.id] = data.roomID;

      // Update online status
      store.onlineUsers.delete(socket);
      store.onlineUsers.set(socket, {
        id: userId,
        status: "busy",
      });
      store.io.emit("onlineUsers", Array.from(store.onlineUsers.values()));

      callback({
        producers: validPeers,
        consumers: {
          content: store.consumerUserIDs[data.roomID],
          timestamp: Date.now(),
        },
        peers: consumersObjects[data.roomID],
      });
    } catch (error) {
      console.error("Error in socket join:", error);
      callback({ error: "Failed to join room" });
    }
  });

  /**
   * Leave room
   */
  socket.on("leave", async (data, callback) => {
    try {
      const userId = socket.decoded_token.id;
      const currentUser = await User.findById(userId).select("companyId");
      const companyId = currentUser?.companyId;

      // Validate roomID
      if (!data?.roomID || data.roomID === "undefined" || data.roomID === "null") {
        console.warn("⚠️ Invalid roomID in leave event:", data?.roomID);
      } else {
        console.log("📞 Leaving room:", data.roomID);
      }

      await socket.leave(data.roomID || "general");
      await store.peers.asyncRemove({ socketID: socket.id }, { multi: true });

      // Notify other users
      socket.to(data.roomID || "general").emit("leave", {
        socketID: socket.id,
      });

      // Emit remove events for all producers owned by this socket
      if (producers[socket.id]) {
        Object.keys(producers[socket.id]).forEach((pid) => {
          try {
            socket
              .to(data.roomID || "general")
              .emit("remove", { producerID: pid, socketID: socket.id });
          } catch (e) {}
        });
      }

      // Close transports
      try {
        producerTransports[socket.id]?.close();
      } catch (e) {}
      delete producerTransports[socket.id];

      try {
        consumerTransports[socket.id]?.close();
      } catch (e) {}
      delete consumerTransports[socket.id];

      // Clean up producers and consumers
      if (producers[socket.id]) {
        Object.values(producers[socket.id]).forEach((producer) => {
          try {
            producer.close();
          } catch (e) {}
        });
        delete producers[socket.id];
      }

      if (consumers[socket.id]) {
        Object.values(consumers[socket.id]).forEach((consumer) => {
          try {
            consumer.close();
          } catch (e) {}
        });
        delete consumers[socket.id];
      }

      store.roomIDs[socket.id] = null;

      // Update meeting if roomID is valid
      if (data?.roomID && data.roomID !== "undefined" && data.roomID !== "null" && companyId) {
        try {
          await Meeting.findOneAndUpdate(
            { _id: data.roomID, companyId },
            { lastLeave: Date.now(), $pull: { peers: socket.id } }
          );
          console.log("✅ Meeting updated successfully for room:", data.roomID);
        } catch (err) {
          console.error("Meeting leave update error:", err);
        }
      }

      // Update consumer tracking
      if (data?.roomID && store.consumerUserIDs[data.roomID]) {
        const index = store.consumerUserIDs[data.roomID].indexOf(socket.id);
        if (index > -1) {
          store.consumerUserIDs[data.roomID].splice(index, 1);
        }

        socket.to(data.roomID).emit("consumers", {
          content: store.consumerUserIDs[data.roomID] || [],
          timestamp: Date.now(),
        });
      }

      // Update online status
      store.onlineUsers.delete(socket);
      store.onlineUsers.set(socket, {
        id: userId,
        status: "online",
      });
      store.io.emit("onlineUsers", Array.from(store.onlineUsers.values()));

      if (callback) callback();
    } catch (error) {
      console.error("Error in socket leave:", error);
      if (callback) callback({ error: "Failed to leave room" });
    }
  });

  /**
   * Remove producer
   */
  socket.on("remove", async (data, callback) => {
    try {
      await store.peers.asyncRemove(
        { producerID: data.producerID },
        { multi: true }
      );
    } catch (e) {
      console.error("Error removing peer from store:", e);
    }

    try {
      store.io
        .to(data.roomID || "general")
        .emit("remove", { producerID: data.producerID, socketID: socket.id });
    } catch (e) {}

    if (callback) callback();
  });

  /**
   * Handle disconnecting (before socket fully disconnects)
   */
  socket.on("disconnecting", () => {
    try {
      const roomID = store.roomIDs[socket.id];
      if (roomID) {
        // Emit leave so clients remove UI elements before socket leaves rooms
        socket.to(roomID).emit("leave", { socketID: socket.id });
      }
    } catch (e) {
      console.error("disconnecting handler error:", e);
    }
  });

  /**
   * Handle disconnect
   */
  socket.on("disconnect", () => {
    try {
      console.log("Socket disconnected:", socket.id);

      const roomID = store.roomIDs[socket.id];
      if (roomID) {
        // Clean consumer tracking
        if (store.consumerUserIDs[roomID]) {
          const index = store.consumerUserIDs[roomID].indexOf(socket.id);
          if (index > -1) {
            store.consumerUserIDs[roomID].splice(index, 1);
          }
        }
      }

      // Emit remove for each producer so clients remove by producerID
      if (producers[socket.id]) {
        const room = store.roomIDs[socket.id] || "general";
        Object.keys(producers[socket.id]).forEach((pid) => {
          try {
            socket
              .to(room)
              .emit("remove", { producerID: pid, socketID: socket.id });
          } catch (e) {}
        });
      }

      // Clean up all resources
      try {
        producerTransports[socket.id]?.close();
      } catch (e) {}
      delete producerTransports[socket.id];

      try {
        consumerTransports[socket.id]?.close();
      } catch (e) {}
      delete consumerTransports[socket.id];

      if (producers[socket.id]) {
        Object.values(producers[socket.id]).forEach((producer) => {
          try {
            producer.close();
          } catch (e) {}
        });
        delete producers[socket.id];
      }

      if (consumers[socket.id]) {
        Object.values(consumers[socket.id]).forEach((consumer) => {
          try {
            consumer.close();
          } catch (e) {}
        });
        delete consumers[socket.id];
      }

      delete store.roomIDs[socket.id];

      // Update online users
      try {
        store.onlineUsers.delete(socket);
      } catch (e) {}
      store.io.emit("onlineUsers", Array.from(store.onlineUsers.values()));
    } catch (err) {
      console.error("Error in disconnect cleanup:", err);
    }
  });
};

// ============================================================================
// CLEANUP FUNCTIONS
// ============================================================================

/**
 * Close producer and notify all consumers
 */
async function closeProducer(producer, socketID) {
  try {
    const producerID = producer.id;
    const roomID = store.roomIDs[socketID] || "general";

    // Close all consumers that were consuming this producer
    Object.keys(consumers).forEach((consumerSocketID) => {
      if (consumers[consumerSocketID]?.[producerID]) {
        console.log(
          `Closing consumer for producer ${producerID} on socket ${consumerSocketID}`
        );
        try {
          consumers[consumerSocketID][producerID].close();
        } catch (e) {}
        delete consumers[consumerSocketID][producerID];

        // Notify the client
        try {
          store.io.to(consumerSocketID).emit("producer-closed", { producerID });
        } catch (e) {}
      }
    });

    // Broadcast removal to room
    try {
      store.io.to(roomID).emit("remove", { producerID, socketID });
    } catch (e) {}

    // Close and cleanup producer
    if (producers[socketID]?.[producerID]) {
      try {
        await producers[socketID][producerID].close();
      } catch (e) {}
      delete producers[socketID][producerID];

      if (Object.keys(producers[socketID]).length === 0) {
        delete producers[socketID];
      }
    }
  } catch (e) {
    console.log("closeProducer error:", e);
  }
}

/**
 * Close consumer
 */
async function closeConsumer(socketID, producerID) {
  try {
    if (consumers[socketID]?.[producerID]) {
      try {
        await consumers[socketID][producerID].close();
      } catch (e) {}
      delete consumers[socketID][producerID];
    }
  } catch (e) {
    // Ignore
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  init,
  initSocket,
};
