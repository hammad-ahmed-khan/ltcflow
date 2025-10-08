/* eslint-disable no-restricted-globals */
const CACHE_NAME = "ltc-flow-v2.9.3";
const RUNTIME_CACHE = "ltc-flow-runtime";

// Assets to cache immediately on install
const PRECACHE_ASSETS = [
  "/",
  "/index.html",
  "/offline.html",
  "/flowicon 192.webp",
  "/logo512.png",
];

// Install event - precache essential assets
self.addEventListener("install", (event) => {
  console.log("[SW] Installing service worker...");

  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        console.log("[SW] Precaching essential assets");
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  console.log("[SW] Activating service worker...");

  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => {
              return cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE;
            })
            .map((cacheName) => {
              console.log("[SW] Deleting old cache:", cacheName);
              return caches.delete(cacheName);
            })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch event - network first with cache fallback strategy
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip cross-origin requests
  if (url.origin !== location.origin) {
    return;
  }

  // Skip WebSocket and Socket.IO connections
  if (
    request.url.includes("socket.io") ||
    request.url.includes("ws://") ||
    request.url.includes("wss://")
  ) {
    return;
  }

  // Skip WebRTC STUN/TURN requests
  if (request.url.includes("stun:") || request.url.includes("turn:")) {
    return;
  }

  // Skip API calls - always go to network
  if (request.url.includes("/api/")) {
    event.respondWith(fetch(request));
    return;
  }

  // For navigation requests
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Clone and cache successful responses
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Offline fallback
          return caches.match("/offline.html");
        })
    );
    return;
  }

  // For all other requests - Network first, cache fallback
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Don't cache non-successful responses
        if (!response || response.status !== 200 || response.type === "error") {
          return response;
        }

        // Clone the response
        const responseClone = response.clone();

        // Cache static assets
        if (
          request.method === "GET" &&
          (request.url.includes(".js") ||
            request.url.includes(".css") ||
            request.url.includes(".png") ||
            request.url.includes(".jpg") ||
            request.url.includes(".svg") ||
            request.url.includes(".webp") ||
            request.url.includes(".woff") ||
            request.url.includes(".woff2"))
        ) {
          caches.open(RUNTIME_CACHE).then((cache) => {
            cache.put(request, responseClone);
          });
        }

        return response;
      })
      .catch(() => {
        // Try to serve from cache
        return caches.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }

          // If it's an HTML request and not in cache, show offline page
          if (request.headers.get("accept").includes("text/html")) {
            return caches.match("/offline.html");
          }

          // For other requests, return a basic error response
          return new Response("Network error", {
            status: 408,
            statusText: "Network error occurred",
          });
        });
      })
  );
});

// Handle push notifications
self.addEventListener("push", (event) => {
  console.log("[SW] Push notification received");

  let data = {};
  if (event.data) {
    data = event.data.json();
  }

  const title = data.title || "LTC Flow";
  const options = {
    body: data.body || "You have a new message",
    icon: "/icons/icon-192x192.png",
    badge: "/icons/badge-72x72.png",
    tag: data.tag || "default",
    requireInteraction: data.requireInteraction || false,
    data: {
      url: data.url || "/",
      roomId: data.roomId,
    },
    actions: data.actions || [
      { action: "open", title: "Open" },
      { action: "close", title: "Dismiss" },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Handle notification clicks
self.addEventListener("notificationclick", (event) => {
  console.log("[SW] Notification clicked:", event.action);

  event.notification.close();

  const urlToOpen = event.notification.data.url || "/";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Check if there's already a window open
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          if (client.url === urlToOpen && "focus" in client) {
            return client.focus();
          }
        }
        // If not, open a new window
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// Handle background sync
self.addEventListener("sync", (event) => {
  console.log("[SW] Background sync:", event.tag);

  if (event.tag === "sync-messages") {
    event.waitUntil(syncMessages());
  }
});

async function syncMessages() {
  try {
    // This would sync pending messages when back online
    console.log("[SW] Syncing messages...");
    // Implementation depends on your message queue structure
  } catch (error) {
    console.error("[SW] Sync failed:", error);
  }
}

// Handle message from clients
self.addEventListener("message", (event) => {
  console.log("[SW] Message received:", event.data);

  if (event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }

  if (event.data.type === "CACHE_URLS") {
    event.waitUntil(
      caches.open(RUNTIME_CACHE).then((cache) => {
        return cache.addAll(event.data.payload);
      })
    );
  }
});
