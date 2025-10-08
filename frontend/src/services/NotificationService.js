// frontend/src/services/NotificationService.js
// Enterprise-Grade Notification Service

import messageSound from "../assets/message.mp3";
import PWABadgeService from "./PWABadgeService";

class NotificationService {
  constructor() {
    // Audio system
    this.audioContext = null;
    this.soundBuffer = null;
    this.playedMessageIDs = new Set();

    // Notification state
    this.notificationPermission = "default";
    this.isDocumentVisible = true;

    // Initialize
    this.init();
  }

  async init() {
    await this.preloadSound();
    await this.requestPermission();
    this.setupVisibilityTracking();
    this.setupFaviconCanvas();
    this.setupAudioUnlock(); // NEW: Unlock audio on user interaction

    console.log("✅ NotificationService initialized");
  }

  // NEW: Setup audio unlock on first user interaction
  setupAudioUnlock() {
    const unlockAudio = () => {
      if (this.audioContext && this.audioContext.state === "suspended") {
        this.audioContext.resume().then(() => {
          console.log("🔓 Audio context unlocked by user interaction");
        });
      }

      // Also create a silent audio element to unlock iOS
      const silentAudio = new Audio();
      silentAudio.src =
        "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";
      silentAudio.play().catch(() => {});
    };

    // Listen for first user interaction
    const events = ["click", "touchstart", "keydown"];
    events.forEach((event) => {
      document.addEventListener(event, unlockAudio, { once: true });
    });

    // Also try to unlock on window focus
    window.addEventListener("focus", unlockAudio);
  }

  // ============================================
  // AUDIO SYSTEM
  // ============================================

  async preloadSound() {
    try {
      // Create audio context (works in background)
      this.audioContext = new (window.AudioContext ||
        window.webkitAudioContext)();

      // Preload and decode audio
      const response = await fetch(messageSound);
      const arrayBuffer = await response.arrayBuffer();
      this.soundBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

      console.log("🔊 Notification sound preloaded and ready");
    } catch (error) {
      console.error("⚠️ Failed to preload sound:", error);
      // Will fallback to HTML5 Audio
    }
  }

  playSound(messageID) {
    // Prevent duplicate sounds for same message
    if (this.playedMessageIDs.has(messageID)) {
      console.log("🔇 Sound already played for message:", messageID);
      return false;
    }

    // Mark as played
    this.playedMessageIDs.add(messageID);

    // Try Web Audio API first (best performance, works in background)
    if (this.playSoundWebAudio()) {
      this.cleanupPlayedMessageID(messageID, 10000);
      return true;
    }

    // Fallback to HTML5 Audio
    if (this.playSoundHTML5()) {
      this.cleanupPlayedMessageID(messageID, 10000);
      return true;
    }

    // Last resort: DOM audio element
    if (this.playSoundElement()) {
      this.cleanupPlayedMessageID(messageID, 10000);
      return true;
    }

    console.error("❌ All audio playback methods failed");
    this.cleanupPlayedMessageID(messageID, 1000);
    return false;
  }

  playSoundWebAudio() {
    if (!this.audioContext || !this.soundBuffer) return false;

    try {
      // Resume audio context if suspended (critical for background tabs)
      if (this.audioContext.state === "suspended") {
        this.audioContext.resume().catch((err) => {
          console.warn("Failed to resume audio context:", err);
        });
      }

      // Create source and connect to destination
      const source = this.audioContext.createBufferSource();
      source.buffer = this.soundBuffer;

      // Add gain node for volume control
      const gainNode = this.audioContext.createGain();
      gainNode.gain.value = 1.0;

      source.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      // Play
      source.start(0);

      console.log(
        "🔊 Sound played via Web Audio API (state:",
        this.audioContext.state + ")"
      );
      return true;
    } catch (error) {
      console.warn("⚠️ Web Audio API failed:", error);
      return false;
    }
  }

  playSoundHTML5() {
    try {
      const audio = new Audio(messageSound);
      audio.volume = 1.0;
      audio.preload = "auto";

      const playPromise = audio.play();

      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            console.log("🔊 Sound played via HTML5 Audio");
          })
          .catch((err) => {
            console.warn("⚠️ HTML5 Audio failed:", err);
          });
      }

      return true;
    } catch (error) {
      console.warn("⚠️ HTML5 Audio initialization failed:", error);
      return false;
    }
  }

  playSoundElement() {
    try {
      const audio = document.createElement("audio");
      audio.style.display = "none";
      audio.src = messageSound;
      audio.autoplay = true;
      audio.volume = 1.0;

      document.body.appendChild(audio);

      audio.onended = () => audio.remove();
      audio.onerror = () => audio.remove();

      console.log("🔊 Sound played via DOM audio element");
      return true;
    } catch (error) {
      console.warn("⚠️ DOM audio element failed:", error);
      return false;
    }
  }

  cleanupPlayedMessageID(messageID, delay) {
    setTimeout(() => {
      this.playedMessageIDs.delete(messageID);

      // Prevent memory leaks - clear old IDs if set gets too large
      if (this.playedMessageIDs.size > 100) {
        this.playedMessageIDs.clear();
      }
    }, delay);
  }

  // ============================================
  // BROWSER NOTIFICATIONS
  // ============================================

  async requestPermission() {
    if (!("Notification" in window)) {
      console.warn("⚠️ Browser notifications not supported");
      return;
    }

    try {
      this.notificationPermission = await Notification.requestPermission();
      console.log("📢 Notification permission:", this.notificationPermission);
    } catch (error) {
      console.error("Failed to request notification permission:", error);
    }
  }

  showBrowserNotification(title, options = {}) {
    // Only show if app is in background AND permission granted
    if (this.isDocumentVisible) {
      console.log("👀 App is visible, skipping browser notification");
      return;
    }

    if (this.notificationPermission !== "granted") {
      console.log("🔕 Notification permission not granted");
      return;
    }

    try {
      const notification = new Notification(title, {
        icon: "/logo192.png",
        badge: "/logo192.png",
        requireInteraction: false,
        silent: false, // Play system sound
        ...options,
      });

      // Focus app when notification clicked
      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      console.log("📢 Browser notification shown");
    } catch (error) {
      console.error("Failed to show browser notification:", error);
    }
  }

  // ============================================
  // VISIBILITY TRACKING
  // ============================================

  setupVisibilityTracking() {
    // Track if user is viewing the app
    document.addEventListener("visibilitychange", () => {
      this.isDocumentVisible = !document.hidden;
      console.log(
        "👀 Document visibility changed:",
        this.isDocumentVisible ? "visible" : "hidden"
      );

      // Update favicon when visibility changes
      this.updateFaviconBadge();
    });

    // Track if window has focus
    window.addEventListener("focus", () => {
      this.isDocumentVisible = true;
      console.log("👀 Window focused");
    });

    window.addEventListener("blur", () => {
      this.isDocumentVisible = false;
      console.log("👀 Window blurred");
    });
  }

  // ============================================
  // FAVICON BADGE
  // ============================================

  setupFaviconCanvas() {
    this.faviconCanvas = document.createElement("canvas");
    this.faviconCanvas.width = 32;
    this.faviconCanvas.height = 32;
    this.faviconContext = this.faviconCanvas.getContext("2d");

    // Load original favicon
    this.originalFavicon = document.querySelector("link[rel*='icon']");
    if (!this.originalFavicon) {
      this.originalFavicon = document.createElement("link");
      this.originalFavicon.rel = "icon";
      document.head.appendChild(this.originalFavicon);
    }
  }

  updateFaviconBadge() {
    const unreadCount = this.getUnreadCount();

    if (unreadCount > 0) {
      this.setFaviconBadge(unreadCount);
      this.updateDocumentTitle(unreadCount);

      // ✅ NEW: Update PWA app icon badge
      PWABadgeService.setBadge(unreadCount);
    } else {
      this.clearFaviconBadge();
      this.updateDocumentTitle(0);

      // ✅ NEW: Clear PWA app icon badge
      PWABadgeService.clearBadge();
    }
  }

  setFaviconBadge(count) {
    if (!this.faviconContext) return;

    const ctx = this.faviconContext;

    // Clear canvas
    ctx.clearRect(0, 0, 32, 32);

    // Draw circle background
    ctx.fillStyle = "#ff4444";
    ctx.beginPath();
    ctx.arc(24, 8, 8, 0, 2 * Math.PI);
    ctx.fill();

    // Draw count text
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 14px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const text = count > 99 ? "99+" : String(count);
    ctx.fillText(text, 24, 8);

    // Update favicon
    this.originalFavicon.href = this.faviconCanvas.toDataURL();
  }

  clearFaviconBadge() {
    // Reset to default favicon
    this.originalFavicon.href = "/favicon.ico";
  }

  updateDocumentTitle(count) {
    if (count > 0) {
      document.title = `(${count}) Messages - LTC Flow`;
    } else {
      document.title = "LTC Flow - Instant Communication for LTC Teams";
    }
  }

  // ============================================
  // UNREAD COUNT
  // ============================================

  getUnreadCount() {
    try {
      const unreadRooms = JSON.parse(
        localStorage.getItem("unreadRooms") || "[]"
      );
      const unreadGroups = JSON.parse(
        localStorage.getItem("unreadGroups") || "[]"
      );
      return unreadRooms.length + unreadGroups.length;
    } catch (error) {
      console.error("Failed to get unread count:", error);
      return 0;
    }
  }

  // ============================================
  // MAIN PUBLIC METHOD
  // ============================================

  notify(message, room, currentUser) {
    const messageID =
      message._id ||
      `${message.content}-${message.date}-${message.author?._id}`;

    // Don't notify for own messages
    const currentUserId = currentUser?._id || currentUser?.id;
    const messageAuthorId = message.author?._id || message.author?.id;

    // Don't notify for own messages
    if (currentUserId && messageAuthorId && currentUserId === messageAuthorId) {
      console.log("📤 Skipping notification for own message");
      return;
    }

    console.log("🔔 Processing notification for message:", messageID);
    console.log("📊 Document visible:", this.isDocumentVisible);

    // 1. If app is VISIBLE (foreground) → play sound directly
    if (this.isDocumentVisible) {
      const soundPlayed = this.playSound(messageID);
      console.log("🔊 Foreground sound played:", soundPlayed);
    }
    // 2. If app is HIDDEN (background/minimized) → use browser notification with sound
    else {
      console.log(
        "📱 App is in background, using browser notification with sound"
      );

      const senderName = message.author?.name || "Someone";
      const roomName = room.isGroup ? room.name : senderName;
      const messagePreview =
        message.content?.substring(0, 100) || "New message";

      this.showBrowserNotification(`New message from ${roomName}`, {
        body: messagePreview,
        tag: room._id,
        requireInteraction: false,
        silent: false, // CRITICAL: Let browser play system sound
      });

      // ALSO try to play sound (some browsers allow it)
      this.playSound(messageID);
    }

    // 3. Always update favicon badge
    this.updateFaviconBadge();

    console.log("✅ Notification processing complete");
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  // Reset notification state (useful for logout)
  reset() {
    this.playedMessageIDs.clear();
    this.clearFaviconBadge();
    this.updateDocumentTitle(0);

    // ✅ NEW: Clear PWA badge on logout
    PWABadgeService.clearBadge();

    console.log("🔄 NotificationService reset");
  }

  // Test notification system
  test() {
    console.log("🧪 Testing notification system...");

    const testMessage = {
      _id: "test-" + Date.now(),
      content: "This is a test notification",
      author: { _id: "test-user", name: "Test User" },
      date: new Date(),
    };

    const testRoom = {
      _id: "test-room",
      name: "Test Room",
      isGroup: false,
    };

    this.notify(testMessage, testRoom, { _id: "different-user" });

    console.log("✅ Test notification sent");
  }
}

// Export singleton instance
const notificationService = new NotificationService();

// Make available globally for debugging
if (typeof window !== "undefined") {
  window.NotificationService = notificationService;
}

export default notificationService;
