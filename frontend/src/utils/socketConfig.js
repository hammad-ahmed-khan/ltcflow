// frontend/src/utils/socketConfig.js
const detectEnvironment = () => {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isPWA =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;
  const isSafari =
    /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);

  return { isIOS, isPWA, isSafari };
};

export const getSocketConfig = (token) => {
  const { isIOS, isPWA, isSafari } = detectEnvironment();

  console.log("🔍 Environment detection:", { isIOS, isPWA, isSafari });

  const baseConfig = {
    forceNew: false,
    reconnection: true,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 10000,
    reconnectionAttempts: 10,
    timeout: 20000,
    autoConnect: true,
    query: { token }, // Send token in query for immediate auth
  };

  // iOS PWA optimizations
  if (isIOS && isPWA) {
    console.log("📱 Applying iOS PWA optimizations");
    return {
      ...baseConfig,
      transports: ["polling", "websocket"], // Prioritize polling for iOS PWA
      upgrade: true,
      rememberUpgrade: false, // Don't remember WebSocket upgrade on iOS
      pingTimeout: 60000,
      pingInterval: 25000,
      reconnectionDelay: 1000, // Faster reconnection for PWA
      reconnectionAttempts: 20, // More attempts for mobile
    };
  }

  // iOS Safari (not PWA)
  if (isIOS || isSafari) {
    console.log("🍎 Applying iOS Safari optimizations");
    return {
      ...baseConfig,
      transports: ["polling", "websocket"],
      upgrade: true,
      rememberUpgrade: false,
      pingTimeout: 45000,
      pingInterval: 20000,
    };
  }

  // Standard configuration for other browsers
  return {
    ...baseConfig,
    transports: ["websocket", "polling"],
    upgrade: true,
    rememberUpgrade: true,
  };
};

export const isPWAiOS = () => {
  const { isIOS, isPWA } = detectEnvironment();
  return isIOS && isPWA;
};
