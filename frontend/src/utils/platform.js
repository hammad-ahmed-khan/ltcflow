// frontend/src/utils/platform.js
//
// Small helpers for running the same React build both as a web PWA and inside
// the Capacitor native shell (iOS / Android).

import Config from "../config";

// True when running inside the Capacitor native container (not a browser tab).
export const isNativePlatform = () =>
  typeof window !== "undefined" &&
  !!(
    window.Capacitor &&
    typeof window.Capacitor.isNativePlatform === "function" &&
    window.Capacitor.isNativePlatform()
  );

// Resolve the backend base URL.
//
// On the web the app may talk to its own origin, so an empty value (relative
// "/") is fine. Inside the native shell the page is served from
// capacitor://localhost (iOS) or https://localhost (Android), so a relative URL
// would hit the app container instead of the server — an absolute
// VITE_BACKEND_URL is required. We surface a loud error if it's missing rather
// than failing silently against localhost.
export const getBackendUrl = () => {
  if (Config.url) return Config.url;
  if (isNativePlatform()) {
    // eslint-disable-next-line no-console
    console.error(
      "[LTC Flow] Native build is missing an absolute VITE_BACKEND_URL — " +
        "API, sockets and calls will not connect. See MOBILE.md.",
    );
  }
  return "";
};

export default { isNativePlatform, getBackendUrl };
