// frontend/public/sw.js
// Service Worker for background push notifications

const CACHE_NAME = "clover-notifications-v1";

// Install service worker
self.addEventListener("install", (event) => {
  console.log("✅ Service Worker installed");
  self.skipWaiting(); // Activate immediately
});

// Activate service worker
self.addEventListener("activate", (event) => {
  console.log("✅ Service Worker activated");
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log("🗑️ Deleting old cache:", cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// Handle push notifications
self.addEventListener("push", (event) => {
  console.log("📬 Push notification received");

  let data = {};

  if (event.data) {
    try {
      data = event.data.json();
    } catch (error) {
      console.error("Failed to parse push data:", error);
      data = {
        title: "New Message",
        body: "You have a new message",
      };
    }
  }

  const title = data.title || "New Message";
  const options = {
    body: data.body || "You have a new message",
    icon: data.icon || "/logo192.png",
    badge: data.badge || "/badge.png",
    image: data.image,
    vibrate: [200, 100, 200],
    tag: data.roomID || "default", // Group notifications by room
    requireInteraction: false,
    silent: false, // Play sound
    data: {
      url: data.url || "/",
      roomID: data.roomID,
      messageID: data.messageID,
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Handle notification click
self.addEventListener("notificationclick", (event) => {
  console.log("🖱️ Notification clicked");

  event.notification.close();

  const urlToOpen = event.notification.data?.url || "/";
  const roomID = event.notification.data?.roomID;

  // Focus or open the app
  event.waitUntil(
    clients
      .matchAll({
        type: "window",
        includeUncontrolled: true,
      })
      .then((clientList) => {
        // If app is already open, focus it
        for (let client of clientList) {
          if (client.url.includes(urlToOpen) && "focus" in client) {
            return client.focus();
          }
        }

        // Otherwise, open new window
        if (clients.openWindow) {
          const targetUrl = roomID ? `/conversation/${roomID}` : urlToOpen;
          return clients.openWindow(targetUrl);
        }
      })
  );
});

// Handle notification close
self.addEventListener("notificationclose", (event) => {
  console.log("❌ Notification closed");
  // Could track analytics here
});

// Handle background sync (for offline message queue)
self.addEventListener("sync", (event) => {
  console.log("🔄 Background sync triggered");

  if (event.tag === "sync-messages") {
    event.waitUntil(syncMessages());
  }
});

async function syncMessages() {
  try {
    // Get pending messages from IndexedDB
    const pendingMessages = await getPendingMessages();

    if (pendingMessages.length > 0) {
      console.log("📤 Syncing", pendingMessages.length, "pending messages");

      // Send to server
      for (const message of pendingMessages) {
        await fetch("/api/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(message),
        });
      }

      // Clear pending messages
      await clearPendingMessages();
    }
  } catch (error) {
    console.error("❌ Message sync failed:", error);
  }
}

// IndexedDB helpers (stub - implement as needed)
async function getPendingMessages() {
  // Implement IndexedDB retrieval
  return [];
}

async function clearPendingMessages() {
  // Implement IndexedDB clearing
}

// Handle messages from main thread
self.addEventListener("message", (event) => {
  console.log("💬 Message from main thread:", event.data);

  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

console.log("✅ Service Worker loaded successfully");
