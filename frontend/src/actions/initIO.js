import IO from "socket.io-client";
import { setGlobal } from "reactn";
import Config from "../config";
import Actions from "../constants/Actions";
import store from "../store";
import getRooms from "./getRooms";
import messageSound from "../assets/message.mp3";
import socketPromise from "../lib/socket.io-promise";
import NotificationService from "../services/NotificationService";

// Track played sounds to prevent duplicates
let playedSounds = new Set();

const initIO = (token) => (dispatch) => {
  const io = IO(`${Config.url || ""}/`);
  io.request = socketPromise(io);

  io.on("connect", () => {
    io.emit("authenticate", { token });
    console.log("IO connected");
  });

  io.on("authenticated", () => {
    console.log("IO authenticated");
    dispatch({ type: Actions.IO_INIT, io });
  });

  io.on("message-in", (data) => {
    const { room, message } = data;

    const currentRoom = store.getState().io.room;
    const currentMessages = store.getState().io.messages || [];

    // Check if message already exists to prevent duplicates
    const messageExists = currentMessages.some((existingMessage) => {
      // Check by exact ID match first
      if (existingMessage._id === message._id) {
        return true;
      }

      // Check for potential duplicates by content, author, and timing
      if (
        existingMessage.content === message.content &&
        existingMessage.author &&
        message.author &&
        existingMessage.author._id === message.author._id
      ) {
        // Check if messages are within 2 seconds of each other (accounting for potential timing differences)
        const existingDate = new Date(existingMessage.date);
        const newDate = new Date(message.date);
        const timeDiff = Math.abs(existingDate - newDate);

        if (timeDiff < 2000) {
          // 2 seconds tolerance
          return true;
        }
      }

      return false;
    });

    if (messageExists) {
      console.log(
        "Duplicate message detected, skipping:",
        message._id || "no-id"
      );
      return;
    }

    console.log(
      "Processing new message:",
      message._id,
      "for room:",
      room._id,
      "isGroup:",
      room.isGroup
    );

    // Play sound only once per unique message ID
    const messageId =
      message._id || `${message.content}-${message.date}-${message.author._id}`;

    if (!playedSounds.has(messageId)) {
      playedSounds.add(messageId);

      const audio = document.createElement("audio");
      audio.style.display = "none";
      audio.src = messageSound;
      audio.autoplay = true;
      audio.onended = () => {
        audio.remove();
        // Clean up old sound IDs after 10 seconds to prevent memory buildup
        setTimeout(() => {
          playedSounds.delete(messageId);
        }, 10000);
      };
      document.body.appendChild(audio);
      console.log("🔊 Playing notification sound for message:", messageId);
    } else {
      console.log("🔇 Sound already played for message:", messageId);
    }

    // Update rooms list FIRST to ensure sidebar reflects new message
    console.log("Updating rooms list to reflect new message...");
    getRooms()
      .then((res) => {
        console.log("✅ Rooms list updated successfully");
        store.dispatch({ type: Actions.SET_ROOMS, rooms: res.data.rooms });

        // ENHANCED: Add unread indicator for both direct messages and groups
        if (!currentRoom || currentRoom._id !== room._id) {
          console.log(
            `📬 Adding unread indicator for ${
              room.isGroup ? "group" : "room"
            }:`,
            room._id
          );
          store.dispatch({
            type: Actions.MESSAGES_ADD_ROOM_UNREAD,
            roomID: room._id,
            isGroup: room.isGroup, // NEW: Pass group information
          });
        } else {
          console.log(
            `👀 User is viewing this ${
              room.isGroup ? "group" : "room"
            }, not marking as unread:`,
            room._id
          );
        }
      })
      .catch((err) => {
        console.error("❌ Error updating rooms list:", err);
        // Still add unread indicator even if rooms update fails
        if (!currentRoom || currentRoom._id !== room._id) {
          store.dispatch({
            type: Actions.MESSAGES_ADD_ROOM_UNREAD,
            roomID: room._id,
            isGroup: room.isGroup, // NEW: Pass group information
          });
        }
      });

    // Add message to current conversation if user is viewing this room
    if (currentRoom && currentRoom._id === room._id) {
      console.log("💬 Adding message to current conversation");
      store.dispatch({ type: Actions.MESSAGE, message });
    }
  });

  io.on("newProducer", (data) => {
    console.log("newProducer", data);
    if (data.socketID !== io.id)
      store.dispatch({ type: Actions.RTC_PRODUCER, data });
  });

  io.on("leave", (data) => {
    console.log("leave", data);
    let { producers } = store.getState().rtc;
    producers = producers.filter(
      (producer) => producer.socketID !== data.socketID
    );
    console.log("producers after leave", producers);
    store.dispatch({
      type: Actions.RTC_RESET_PRODUCERS,
      producers,
      socketID: data.socketID,
    });
  });

  io.on("consumers", (data) => {
    console.log("consumers", data);
    store.dispatch({ type: Actions.RTC_CONSUMERS, consumers: data });
  });

  io.on("newPeer", (data) => {
    console.log("newPeer", data);
    store.dispatch({ type: Actions.RTC_NEW_PEER, data });
  });

  io.on("call", (data) => {
    console.log("call", data);
    store.dispatch({
      type: Actions.RTC_SET_COUNTERPART,
      counterpart: data.counterpart,
    });
    store.dispatch({ type: Actions.RTC_CALL, data });
  });

  io.on("close", (data) => {
    console.log("close", data);
    store.dispatch({ type: Actions.RTC_CLOSE, data });
  });

  io.on("answer", (data) => {
    console.log("answer", data);
    store.dispatch({ type: Actions.RTC_ANSWER, data });
  });

  // Enhanced remove handler
  io.on("remove", (data) => {
    console.log("🗑️ remove event:", {
      producerID: data.producerID,
      socketID: data.socketID,
      mySocketID: io.id,
    });

    let { producers } = store.getState().rtc;
    const beforeCount = producers.length;

    producers = producers.filter(
      (producer) => producer.producerID !== data.producerID
    );

    console.log(`🗑️ Filtered producers: ${beforeCount} → ${producers.length}`);
    console.log(
      "Remaining producer IDs:",
      producers.map((p) => p.producerID)
    );

    store.dispatch({
      type: Actions.RTC_RESET_PRODUCERS,
      producers,
      socketID: data.socketID,
      lastLeaveType: "remove",
      producerID: data.producerID,
    });
  });

  io.on("onlineUsers", (data) => {
    store.dispatch({ type: Actions.ONLINE_USERS, data });
  });

  io.on("refresh-meetings", (data) => {
    store.dispatch({
      type: Actions.REFRESH_MEETINGS,
      timestamp: data.timestamp,
    });
  });

  io.on("user-deleted", async (data) => {
    // Only log out the user if THEY were the one deleted
    const currentUser = store.getState().user || getGlobal().user;

    if (data && data.id && currentUser && currentUser.id === data.id) {
      // This user was deleted - log them out
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      localStorage.removeItem("companyId");
      localStorage.removeItem("subdomain");

      await setGlobal({
        token: null,
        user: {},
      });

      console.log("Your account has been deleted by an administrator");
    }
  });

  io.on("typing", (data) => {
    if (
      store.getState().io.room &&
      data.roomID === store.getState().io.room._id
    ) {
      // Handle enhanced typing with user aggregation
      if (data.typingUsers) {
        // New aggregated format
        dispatch({
          type: Actions.SET_TYPING_USERS,
          typingUsers: data.typingUsers,
        });
        // Keep backward compatibility
        dispatch({
          type: Actions.SET_TYPING,
          typing: data.typingUsers.length > 0,
        });
      } else {
        // Fallback to old format
        if (data.isTyping) {
          clearTimeout(window.typingTimeout);
          window.typingTimeout = setTimeout(() => {
            dispatch({ type: Actions.SET_TYPING, typing: false });
            dispatch({ type: Actions.SET_TYPING_USERS, typingUsers: [] });
          }, 10000);
        } else {
          clearTimeout(window.typingTimeout);
        }
        dispatch({ type: Actions.SET_TYPING, typing: data.isTyping });
        dispatch({
          type: Actions.SET_TYPING_USERS,
          typingUsers: data.isTyping ? [data] : [],
        });
      }
    }
  });

  io.on("disconnect", (reason) => {
    console.log("🔌 Socket disconnected:", reason);
  });

  io.on("connect_error", (error) => {
    console.error("🔥 Socket connection error:", error);
  });

  io.on("reconnect", (attemptNumber) => {
    console.log("🔄 Socket reconnected after", attemptNumber, "attempts");
  });

  io.on("message-deleted", (data) => {
    const { messageId, roomId, deletedBy } = data;

    console.log("🗑️ Message deleted event received:", {
      messageId,
      roomId,
      deletedBy,
    });

    const currentRoom = store.getState().io.room;
    const currentMessages = store.getState().io.messages || [];

    const messageToUpdate = currentMessages.find(
      (msg) => msg._id === messageId
    );

    if (!messageToUpdate) {
      console.log("⚠️ Message not found in current state");
      return;
    }

    if (currentRoom && currentRoom._id === roomId) {
      console.log("💬 Marking message as deleted");

      store.dispatch({
        type: Actions.MESSAGE_UPDATE,
        message: {
          ...messageToUpdate,
          isDeleted: true,
          deletedAt: new Date(),
          deletedBy: deletedBy,
          content: null,
        },
      });
    }

    getRooms()
      .then((res) =>
        store.dispatch({ type: Actions.SET_ROOMS, rooms: res.data.rooms })
      )
      .catch((err) => console.error("❌ Error updating rooms list:", err));
  });

  // Enhanced beforeunload with retry logic
  const handleBeforeUnload = () => {
    const currentRoomID = store.getState().rtc.roomID;
    if (currentRoomID) {
      console.log("📤 Sending leave event on page unload");
      // Try to send leave event (may not complete if browser closes quickly)
      try {
        io.emit("leave", {
          socketID: io.id,
          roomID: currentRoomID,
        });
      } catch (e) {
        console.warn("Failed to send leave event on unload:", e);
      }
    }
  };

  window.addEventListener("beforeunload", handleBeforeUnload);
  window.addEventListener("pagehide", handleBeforeUnload); // Better mobile support
};

export default initIO;
