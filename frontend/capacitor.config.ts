import type { CapacitorConfig } from '@capacitor/cli';

// LTC Flow native shell (iOS / Android) built with Capacitor.
//
// The compiled Vite build in `dist/` is bundled into the app and served
// locally by Capacitor. ALL runtime traffic — REST, Socket.IO signaling and
// the mediasoup media path — goes to the ABSOLUTE URL baked into the build via
// `VITE_BACKEND_URL`. There is no subdomain in the native container, so that
// env var must point at the production backend (see MOBILE.md).
const config: CapacitorConfig = {
  appId: 'com.ltcflow.app',
  appName: 'LTC Flow',
  webDir: 'dist',

  server: {
    // Serve the local web layer over https on Android so secure-context APIs
    // (getUserMedia, etc.) behave the same as on the web. iOS uses
    // capacitor://localhost, which is already a secure context.
    androidScheme: 'https',
  },

  ios: {
    // Let the WKWebView present media inline (video calls) rather than
    // forcing native fullscreen playback.
    contentInset: 'always',
  },

  plugins: {
    // Native push (APNs on iOS, FCM on Android) — wired up in a later step,
    // declared here so `cap sync` provisions it.
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
