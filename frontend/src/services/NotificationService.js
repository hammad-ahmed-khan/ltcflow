// frontend/src/services/NotificationService.js
// Enhanced with Push Notification Management

import messageSound from "../assets/message.mp3";
import PWABadgeService from "./PWABadgeService";
import Config from "../config";

class NotificationService {
  constructor() {
    // Audio system
    this.audioContext = null;
    this.soundBuffer = null;
    this.playedMessageIDs = new Set();

    // Notification state
    this.notificationPermission = "default";
    this.isDocumentVisible = true;

    // 🆕 Push notification state
    this.pushSubscription = null;
    this.vapidPublicKey = null;

    // Initialize
    this.init();
  }

  async init() {
    await this.preloadSound();
    await this.requestPermission();
    this.setupVisibilityTracking();
    this.setupFaviconCanvas();
    this.setupAudioUnlock();

    // 🆕 Initialize push notifications if user is logged in
    if (this.isUserLoggedIn()) {
      await this.initializePushNotifications();
    }

    console.log("✅ NotificationService initialized");
  }

  // ============================================
  // 🆕 PUSH NOTIFICATION MANAGEMENT
  // ============================================

  /**
   * Check if user is logged in
   */
  isUserLoggedIn() {
    return !!localStorage.getItem("token");
  }

  /**
   * Initialize push notifications
   */
  async initializePushNotifications() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      console.log("📱 Push notifications not supported by browser");
      return;
    }

    try {
      // Wait for service worker to be ready
      const registration = await navigator.serviceWorker.ready;

      // Check existing subscription
      this.pushSubscription = await registration.pushManager.getSubscription();

      if (this.pushSubscription) {
        console.log("📱 Existing push subscription found");
        // Verify subscription is still valid on backend
        await this.verifySubscriptionWithBackend();
      } else {
        console.log("📱 No push subscription found");
      }
    } catch (error) {
      console.error("❌ Failed to initialize push notifications:", error);
    }
  }

  /**
   * Subscribe to push notifications
   */
  async subscribeToPush() {
    if (!this.isUserLoggedIn()) {
      console.log("⚠️ User not logged in, cannot subscribe to push");
      return null;
    }

    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      console.log("📱 Push notifications not supported");
      return null;
    }

    try {
      // Request notification permission first
      if (this.notificationPermission !== "granted") {
        await this.requestPermission();
        if (this.notificationPermission !== "granted") {
          console.log("🔕 Notification permission denied");
          return null;
        }
      }

      const registration = await navigator.serviceWorker.ready;

      // Check if already subscribed
      let subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        console.log("📱 Already subscribed to push notifications");
        this.pushSubscription = subscription;
        return subscription;
      }

      // Fetch VAPID public key from backend
      if (!this.vapidPublicKey) {
        const response = await fetch(`${Config.url}/push/vapid-public-key`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        });

        if (!response.ok) {
          throw new Error("Failed to fetch VAPID public key");
        }

        const data = await response.json();
        this.vapidPublicKey = data.publicKey;
      }

      // Convert VAPID key
      const convertedVapidKey = this.urlBase64ToUint8Array(this.vapidPublicKey);

      // Subscribe to push
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey,
      });

      // Send subscription to backend
      const saveResponse = await fetch(`${Config.url}/push/subscribe`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ subscription }),
      });

      if (!saveResponse.ok) {
        throw new Error("Failed to save subscription to backend");
      }

      this.pushSubscription = subscription;
      console.log("✅ Successfully subscribed to push notifications");
      return subscription;
    } catch (error) {
      console.error("❌ Failed to subscribe to push notifications:", error);
      return null;
    }
  }

  /**
   * Unsubscribe from push notifications
   */
  async unsubscribeFromPush() {
    if (!("serviceWorker" in navigator)) {
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // Remove from backend first
        await fetch(`${Config.url}/push/unsubscribe`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });

        // Unsubscribe from push manager
        await subscription.unsubscribe();
        this.pushSubscription = null;
        console.log("✅ Unsubscribed from push notifications");
        return true;
      }

      return false;
    } catch (error) {
      console.error("❌ Failed to unsubscribe:", error);
      return false;
    }
  }

  /**
   * Check if currently subscribed to push
   */
  async isPushSubscribed() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      return !!subscription;
    } catch (error) {
      console.error("Failed to check push subscription:", error);
      return false;
    }
  }

  /**
   * Verify subscription with backend
   */
  async verifySubscriptionWithBackend() {
    if (!this.pushSubscription) return;

    try {
      const response = await fetch(`${Config.url}/push/subscribe`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ subscription: this.pushSubscription }),
      });

      if (response.ok) {
        console.log("✅ Push subscription verified with backend");
      }
    } catch (error) {
      console.error("⚠️ Failed to verify subscription:", error);
    }
  }

  /**
   * Test push notification (development only)
   */
  async testPushNotification() {
    if (!this.isUserLoggedIn()) {
      console.log("⚠️ User not logged in");
      return;
    }

    try {
      const response = await fetch(`${Config.url}/push/test`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (response.ok) {
        console.log("✅ Test push notification sent");
      } else {
        console.error("❌ Failed to send test notification");
      }
    } catch (error) {
      console.error("❌ Test notification error:", error);
    }
  }

  /**
   * Helper to convert VAPID key
   */
  urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }

    return outputArray;
  }

  // ============================================
  // AUDIO SYSTEM (existing code)
  // ============================================

  setupAudioUnlock() {
    const unlockAudio = () => {
      if (this.audioContext && this.audioContext.state === "suspended") {
        this.audioContext.resume().then(() => {
          console.log("🔓 Audio context unlocked by user interaction");
        });
      }

      const silentAudio = new Audio();
      silentAudio.src =
        "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";
      silentAudio.play().catch(() => {});
    };

    const events = ["click", "touchstart", "keydown"];
    events.forEach((event) => {
      document.addEventListener(event, unlockAudio, { once: true });
    });

    window.addEventListener("focus", unlockAudio);
  }

  async preloadSound() {
    try {
      this.audioContext = new (window.AudioContext ||
        window.webkitAudioContext)();

      const response = await fetch(messageSound);
      const arrayBuffer = await response.arrayBuffer();
      this.soundBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

      console.log("🔊 Notification sound preloaded");
    } catch (error) {
      console.error("⚠️ Failed to preload sound:", error);
    }
  }

  playSound(messageID) {
    if (this.playedMessageIDs.has(messageID)) {
      console.log("🔇 Sound already played for message:", messageID);
      return false;
    }

    this.playedMessageIDs.add(messageID);

    if (this.playSoundWebAudio()) {
      this.cleanupPlayedMessageID(messageID, 10000);
      return true;
    }

    if (this.playSoundHTML5()) {
      this.cleanupPlayedMessageID(messageID, 10000);
      return true;
    }

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
      if (this.audioContext.state === "suspended") {
        this.audioContext.resume().catch((err) => {
          console.warn("Failed to resume audio context:", err);
        });
      }

      const source = this.audioContext.createBufferSource();
      source.buffer = this.soundBuffer;

      const gainNode = this.audioContext.createGain();
      gainNode.gain.value = 1.0;

      source.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      source.start(0);

      console.log("🔊 Sound played via Web Audio API");
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

      if (this.playedMessageIDs.size > 100) {
        this.playedMessageIDs.clear();
      }
    }, delay);
  }

  // ============================================
  // BROWSER NOTIFICATIONS (existing code)
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
        silent: false,
        ...options,
      });

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
  // VISIBILITY TRACKING (existing code)
  // ============================================

  setupVisibilityTracking() {
    document.addEventListener("visibilitychange", () => {
      this.isDocumentVisible = !document.hidden;
      console.log(
        "👀 Document visibility changed:",
        this.isDocumentVisible ? "visible" : "hidden"
      );

      this.updateFaviconBadge();
    });

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
  // FAVICON BADGE (existing code)
  // ============================================

  setupFaviconCanvas() {
    this.faviconCanvas = document.createElement("canvas");
    this.faviconCanvas.width = 32;
    this.faviconCanvas.height = 32;
    this.faviconContext = this.faviconCanvas.getContext("2d");

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
      PWABadgeService.setBadge(unreadCount);
    } else {
      this.clearFaviconBadge();
      this.updateDocumentTitle(0);
      PWABadgeService.clearBadge();
    }
  }

  setFaviconBadge(count) {
    if (!this.faviconContext || !this.originalFavicon) return;

    const ctx = this.faviconContext;

    ctx.clearRect(0, 0, 32, 32);

    ctx.fillStyle = "#ff4444";
    ctx.beginPath();
    ctx.arc(24, 8, 8, 0, 2 * Math.PI);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 14px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const text = count > 99 ? "99+" : String(count);
    ctx.fillText(text, 24, 8);

    // Update favicon
    try {
      this.originalFavicon.href = this.faviconCanvas.toDataURL();
    } catch (error) {
      console.warn("Failed to update favicon badge:", error);
    }
  }

  clearFaviconBadge() {
    // Reset to default favicon
    if (this.originalFavicon) {
      this.originalFavicon.href = "/favicon.ico";
    }
  }

  updateDocumentTitle(count) {
    if (count > 0) {
      document.title = `(${count}) Messages - LTC Flow`;
    } else {
      document.title = "LTC Flow - Instant Communication for LTC Teams";
    }
  }

  // ============================================
  // UNREAD COUNT (existing code)
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
  // MAIN PUBLIC METHOD (existing code)
  // ============================================

  notify(message, room, currentUser) {
    const messageID =
      message._id ||
      `${message.content}-${message.date}-${message.author?._id}`;

    const currentUserId = currentUser?._id || currentUser?.id;
    const messageAuthorId = message.author?._id || message.author?.id;

    if (currentUserId && messageAuthorId && currentUserId === messageAuthorId) {
      console.log("📤 Skipping notification for own message");
      return;
    }

    console.log("🔔 Processing notification for message:", messageID);
    console.log("📊 Document visible:", this.isDocumentVisible);

    if (this.isDocumentVisible) {
      const soundPlayed = this.playSound(messageID);
      console.log("🔊 Foreground sound played:", soundPlayed);
    } else {
      console.log("📱 App is in background, using browser notification");

      const senderName = message.author?.name || "Someone";
      const roomName = room.isGroup ? room.name : senderName;
      const messagePreview =
        message.content?.substring(0, 100) || "New message";

      this.showBrowserNotification(`New message from ${roomName}`, {
        body: messagePreview,
        tag: room._id,
        requireInteraction: false,
        silent: false,
      });

      this.playSound(messageID);
    }

    this.updateFaviconBadge();

    console.log("✅ Notification processing complete");
  }

  // ============================================
  // UTILITY METHODS (existing code)
  // ============================================

  reset() {
    this.playedMessageIDs.clear();
    this.clearFaviconBadge();
    this.updateDocumentTitle(0);
    PWABadgeService.clearBadge();

    // 🆕 Unsubscribe from push notifications on logout
    this.unsubscribeFromPush();

    console.log("🔄 NotificationService reset");
  }

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
