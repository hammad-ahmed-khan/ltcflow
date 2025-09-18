const mediasoup = require("mediasoup");
config = require("../../config");
const store = require("../store");
const User = require("../models/User");
const Meeting = require("../models/Meeting");
const mongoose = require("mongoose");

let worker;
let mediasoupRouter;
let producerTransports = {};
let consumerTransports = {};
let producers = {};
let consumers = {};
let consumersObjects = {};

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
  });
  try {
    await transport.setMaxIncomingBitrate(1500000);
  } catch (error) {}
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

async function createConsumer(producer, rtpCapabilities, consumerTransport) {
  if (
    !mediasoupRouter.canConsume({
      producerId: producer.id,
      rtpCapabilities,
    })
  ) {
    console.error("can not consume");
    return null;
  }
  let consumer;
  try {
    consumer = await consumerTransport.consume({
      producerId: producer.id,
      rtpCapabilities,
      paused: producer.kind === "video",
    });
  } catch (error) {
    console.error("consume failed", error);
    return null;
  }

  if (consumer.type === "simulcast") {
    try {
      await consumer.setPreferredLayers({ spatialLayer: 2, temporalLayer: 2 });
    } catch (e) {
      // ignore
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

const initSocket = (socket) => {
  socket.on("getRouterRtpCapabilities", (data, callback) => {
    callback(mediasoupRouter.rtpCapabilities);
  });

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

  socket.on("connectProducerTransport", async (data, callback) => {
    try {
      const transport = producerTransports[socket.id];
      if (!transport) {
        console.error(
          "connectProducerTransport: no transport for socket",
          socket.id
        );
        return callback({ error: "producer transport not found" });
      }
      await transport.connect({ dtlsParameters: data.dtlsParameters });
      callback();
    } catch (err) {
      console.error("connectProducerTransport error:", err);
      callback({ error: err.message });
    }
  });

  socket.on("connectConsumerTransport", async (data, callback) => {
    try {
      const transport = consumerTransports[socket.id];
      if (!transport) {
        console.error(
          "connectConsumerTransport: no transport for socket",
          socket.id
        );
        return callback({ error: "consumer transport not found" });
      }
      await transport.connect({ dtlsParameters: data.dtlsParameters });
      callback();
    } catch (err) {
      console.error("connectConsumerTransport error:", err);
      callback({ error: err.message });
    }
  });

  socket.on("produce", async (data, callback) => {
    try {
      const { kind, rtpParameters, isScreen } = data;
      const pTransport = producerTransports[socket.id];
      if (!pTransport) {
        console.error("produce: no producer transport for socket", socket.id);
        return callback({ error: "producer transport not found" });
      }

      let producer = await pTransport.produce({
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

      await store.peers.asyncInsert({
        type: "producer",
        socketID: socket.id,
        userID: socket.decoded_token.id,
        roomID: data.roomID || "general",
        producerID: producer.id,
        isScreen,
      });

      !producers[socket.id] && (producers[socket.id] = {});
      producers[socket.id][producer.id] = producer;

      // notify peers there's a new producer
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

  socket.on("consume", async (data, callback) => {
    try {
      // Ensure requested producer exists
      if (
        !producers[data.socketID] ||
        !producers[data.socketID][data.producerID]
      ) {
        console.error(
          "consume: requested producer not found",
          data.socketID,
          data.producerID
        );
        return callback({ error: "producer not found" });
      }

      const cTransport = consumerTransports[socket.id];
      if (!cTransport) {
        console.error("consume: no consumer transport for socket", socket.id);
        return callback({ error: "consumer transport not found" });
      }

      const obj = await createConsumer(
        producers[data.socketID][data.producerID],
        data.rtpCapabilities,
        cTransport
      );

      if (!obj) {
        return callback({ error: "createConsumer failed" });
      }

      obj.consumer.on("transportclose", () => {
        closeConsumer(socket.id, data.producerID);
      });
      obj.consumer.on("producerclose", () => {
        // inform client to remove the producer tile
        try {
          socket.emit("producer-closed", { producerID: data.producerID });
        } catch (e) {}
        closeConsumer(socket.id, data.producerID);
      });

      !consumers[socket.id] && (consumers[socket.id] = {});
      consumers[socket.id][data.producerID] = obj.consumer;

      callback(obj.response);
    } catch (err) {
      console.error("consume error:", err);
      callback({ error: err.message });
    }
  });

  socket.on("resume", async (data, callback) => {
    try {
      if (!consumers[socket.id] || !consumers[socket.id][data.producerID]) {
        console.error(
          "Resume failed: consumer not found",
          data.producerID,
          socket.id
        );
        return callback({ error: "consumer not found" });
      }

      const consumer = consumers[socket.id][data.producerID];
      if (consumer.closed) {
        console.error("Cannot resume closed consumer:", data.producerID);
        return callback({ error: "consumer closed" });
      }

      await consumer.resume();
      console.log(
        "Successfully resumed consumer:",
        data.producerID,
        "for socket:",
        socket.id
      );
      callback();
    } catch (error) {
      console.error("Resume failed:", error);
      callback({ error: error.message });
    }
  });

  socket.on("create", async (data, callback) => {
    const room = await store.rooms.asyncInsert({ lastJoin: Date.now() });
    callback(room);
  });

  socket.on("join", async (data, callback) => {
    const User = require("../models/User");
    const Meeting = require("../models/Meeting");
    const mongoose = require("mongoose");

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

      socket.to(data.roomID).emit("newPeer", {
        userID: userId,
        socketID: socket.id,
        user: currentUser,
      });

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

      const peers = await store.peers.asyncFind({
        type: "producer",
        roomID: data.roomID || "general",
      });

      if (!store.consumerUserIDs[data.roomID])
        store.consumerUserIDs[data.roomID] = [];
      store.consumerUserIDs[data.roomID].push(socket.id);

      socket.to(data.roomID).emit("consumers", {
        content: store.consumerUserIDs[data.roomID],
        timestamp: Date.now(),
      });

      // Update meeting with company filtering
      await Meeting.findOneAndUpdate(
        {
          _id: data.roomID,
          companyId, // Ensure meeting belongs to user's company
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

      // Track online users by socket reference and also emit values array
      // (Keep existing behavior but guard delete/emit elsewhere)
      store.onlineUsers.delete(socket);
      store.onlineUsers.set(socket, {
        id: userId,
        status: "busy",
      });
      store.io.emit("onlineUsers", Array.from(store.onlineUsers.values()));

      callback({
        producers: peers,
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

  socket.on("leave", async (data, callback) => {
    try {
      const userId = socket.decoded_token.id;
      const currentUser = await User.findById(userId).select("companyId");
      const companyId = currentUser?.companyId;

      await socket.leave(data.roomID || "general");
      await store.peers.asyncRemove({ socketID: socket.id }, { multi: true });

      // Notify other users that this user left
      socket.to(data.roomID || "general").emit("leave", {
        socketID: socket.id,
      });

      // Also emit remove events for all producers owned by this socket so clients clear by producerID
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
        producerTransports[socket.id] && producerTransports[socket.id].close();
      } catch (e) {}
      delete producerTransports[socket.id];

      try {
        consumerTransports[socket.id] && consumerTransports[socket.id].close();
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

      // Update meeting
      await Meeting.findOneAndUpdate(
        { _id: data.roomID, companyId },
        { lastLeave: Date.now(), $pull: { peers: socket.id } }
      ).catch((err) => console.log("Meeting leave update error:", err));

      // Update consumer tracking
      if (store.consumerUserIDs[data.roomID]) {
        const index = store.consumerUserIDs[data.roomID].indexOf(socket.id);
        if (index > -1) {
          store.consumerUserIDs[data.roomID].splice(index, 1);
        }
      }

      // Emit updated consumer list to remaining users
      socket.to(data.roomID).emit("consumers", {
        content: store.consumerUserIDs[data.roomID] || [],
        timestamp: Date.now(),
      });

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

  // Notify peers before socket is fully torn down so socket.to(room) still works
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

  socket.on("disconnect", () => {
    try {
      console.log("Socket disconnected:", socket.id);

      const roomID = store.roomIDs[socket.id];
      if (roomID) {
        // Also ensure consumer tracking is cleaned
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

      // Clean up all resources (safe guards)
      try {
        producerTransports[socket.id] && producerTransports[socket.id].close();
      } catch (e) {}
      delete producerTransports[socket.id];

      try {
        consumerTransports[socket.id] && consumerTransports[socket.id].close();
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

      // Try both deletion methods for onlineUsers to be robust
      try {
        store.onlineUsers.delete(socket);
      } catch (e) {}
      try {
        store.onlineUsers.delete(socket.id);
      } catch (e) {}
      store.io.emit("onlineUsers", Array.from(store.onlineUsers.values()));
    } catch (err) {
      console.error("Error in disconnect cleanup:", err);
    }
  });
};

async function closeProducer(producer, socketID) {
  try {
    await producers[socketID][producer.id].close();
    /*
    const producerID = producer.id;
    const roomID = store.roomIDs[socketID] || "general";

    // Close all consumers that were consuming this producer
    Object.keys(consumers).forEach((consumerSocketID) => {
      if (
        consumers[consumerSocketID] &&
        consumers[consumerSocketID][producerID]
      ) {
        console.log(
          `Closing consumer for producer ${producerID} on socket ${consumerSocketID}`
        );
        try {
          consumers[consumerSocketID][producerID].close();
        } catch (e) {}
        delete consumers[consumerSocketID][producerID];

        // Notify the client that their consumer is closed
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
    if (producers[socketID] && producers[socketID][producerID]) {
      try {
        await producers[socketID][producerID].close();
      } catch (e) {}
      delete producers[socketID][producerID];

      if (Object.keys(producers[socketID]).length === 0) {
        delete producers[socketID];
      }
    }
      */
  } catch (e) {
    console.log("closeProducer error:", e);
  }
}

async function closeConsumer(socketID, producerID) {
  try {
    if (consumers[socketID] && consumers[socketID][producerID]) {
      try {
        await consumers[socketID][producerID].close();
      } catch (e) {}
    }
  } catch (e) {
    // console.log(e);
  }
}

module.exports = {
  init,
  initSocket,
};
