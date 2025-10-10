// frontend/src/utils/pwaRegister.js

export const registerServiceWorker = () => {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("/service-worker.js")
        .then((registration) => {
          console.log("[PWA] Service Worker registered:", registration);

          // Check for updates periodically
          setInterval(() => {
            registration.update();
          }, 60 * 60 * 1000); // Check every hour

          // Handle updates
          registration.addEventListener("updatefound", () => {
            const newWorker = registration.installing;
            console.log("[PWA] New Service Worker installing...");

            newWorker.addEventListener("statechange", () => {
              if (
                newWorker.state === "installed" &&
                navigator.serviceWorker.controller
              ) {
                // New service worker available
                console.log("[PWA] New version available! Refresh to update.");

                // Show update notification to user
                if (
                  window.confirm(
                    "A new version is available. Reload to update?"
                  )
                ) {
                  newWorker.postMessage({ type: "SKIP_WAITING" });
                  window.location.reload();
                }
              }
            });
          });
        })
        .catch((error) => {
          console.error("[PWA] Service Worker registration failed:", error);
        });

      // Handle controller change
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        console.log("[PWA] Service Worker controller changed");
        window.location.reload();
      });
    });
  }
};

export const unregisterServiceWorker = () => {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.ready
      .then((registration) => {
        registration.unregister();
        console.log("[PWA] Service Worker unregistered");
      })
      .catch((error) => {
        console.error("[PWA] Service Worker unregistration failed:", error);
      });
  }
};

export const checkForUpdates = async () => {
  if ("serviceWorker" in navigator) {
    const registration = await navigator.serviceWorker.ready;
    await registration.update();
    console.log("[PWA] Checked for updates");
  }
};

// Request notification permission
export const requestNotificationPermission = async () => {
  if (!("Notification" in window)) {
    console.log("[PWA] This browser does not support notifications");
    return false;
  }

  if (Notification.permission === "granted") {
    return true;
  }

  if (Notification.permission !== "denied") {
    const permission = await Notification.requestPermission();
    return permission === "granted";
  }

  return false;
};

// Show local notification
export const showNotification = (title, options = {}) => {
  if (Notification.permission === "granted") {
    navigator.serviceWorker.ready.then((registration) => {
      registration.showNotification(title, {
        icon: "/icons/icon-192x192.png",
        badge: "/icons/badge-72x72.png",
        ...options,
      });
    });
  }
};

// Subscribe to push notifications
export const subscribeToPushNotifications = async () => {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    console.log("[PWA] Push notifications not supported");
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.ready;

    // Check if already subscribed
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      // Fetch VAPID public key from backend
      const response = await fetch(`${Config.API_URL}/push/vapid-public-key`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch VAPID public key");
      }

      const { publicKey } = await response.json();
      const convertedVapidKey = urlBase64ToUint8Array(publicKey);

      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey,
      });

      // Send subscription to backend
      await fetch(`${Config.API_URL}/push/subscribe`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ subscription }),
      });
    }

    console.log("[PWA] Push subscription active:", subscription);
    return subscription;
  } catch (error) {
    console.error("[PWA] Failed to subscribe to push notifications:", error);
    return null;
  }
};

// Unsubscribe from push notifications
export const unsubscribeFromPushNotifications = async () => {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      await subscription.unsubscribe();
      console.log("[PWA] Unsubscribed from push notifications");
    }
  } catch (error) {
    console.error("[PWA] Failed to unsubscribe:", error);
  }
};

// Helper function to convert VAPID key
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

// Check if app is installed
export const isAppInstalled = () => {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
};

// Handle install prompt
let deferredPrompt;

export const setupInstallPrompt = (onInstallPrompt) => {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    console.log("[PWA] Install prompt available");

    if (onInstallPrompt) {
      onInstallPrompt(e);
    }
  });

  window.addEventListener("appinstalled", () => {
    console.log("[PWA] App installed successfully");
    deferredPrompt = null;
  });
};

export const showInstallPrompt = async () => {
  if (!deferredPrompt) {
    console.log("[PWA] Install prompt not available");
    return false;
  }

  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  console.log(`[PWA] Install prompt outcome: ${outcome}`);

  deferredPrompt = null;
  return outcome === "accepted";
};

// Background sync
export const registerBackgroundSync = async (tag) => {
  if (
    "serviceWorker" in navigator &&
    "sync" in window.ServiceWorkerRegistration.prototype
  ) {
    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.sync.register(tag);
      console.log(`[PWA] Background sync registered: ${tag}`);
      return true;
    } catch (error) {
      console.error("[PWA] Background sync registration failed:", error);
      return false;
    }
  }
  return false;
};

// Network status
export const setupNetworkStatus = (onOnline, onOffline) => {
  window.addEventListener("online", () => {
    console.log("[PWA] Back online");
    if (onOnline) onOnline();
  });

  window.addEventListener("offline", () => {
    console.log("[PWA] Gone offline");
    if (onOffline) onOffline();
  });

  return navigator.onLine;
};
