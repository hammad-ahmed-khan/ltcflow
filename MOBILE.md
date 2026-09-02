# LTC Flow — Native mobile apps (Capacitor)

The iOS and Android apps are the **same React build** that runs on the web,
wrapped in a [Capacitor](https://capacitorjs.com) native shell. There is no
second codebase: `frontend/dist` is bundled into the app and served locally,
and all REST / Socket.IO / mediasoup traffic goes to the absolute backend URL
compiled into the build.

This document covers **Step 1** of the migration — standing up the native shell
and proving login, chat, and a WebRTC call work in the container. Later steps
(native push, secure token storage, VoIP call ringing) are tracked separately.

---

## What's already wired

- `frontend/capacitor.config.ts` — app id `com.ltcflow.app`, `webDir: dist`.
- `@capacitor/core`, `/ios`, `/android`, `/app` + `@capacitor/cli` in `frontend/package.json`.
- `npm run cap:ios` / `npm run cap:android` / `npm run cap:sync` scripts.
- Socket.IO now resolves an **absolute** backend URL via `src/utils/platform.js`
  (`getBackendUrl()`), instead of the relative origin that would break inside
  the native container.
- **Backend needs no CORS change for Step 1**: `cors()` already allows all
  origins, and Socket.IO **2.5.0** accepts any origin by default (the strict
  origin gate only exists in Socket.IO v3+).

---

## Prerequisites

| Target  | You need |
|---------|----------|
| iOS     | macOS + Xcode 15+, CocoaPods (`sudo gem install cocoapods`) |
| Android | Android Studio (Giraffe+) and JDK 17 |
| Both    | Node 18/20/22 |

> iOS apps can only be built and run from macOS. Android can build from any OS
> with Android Studio installed.

---

## The backend URL (required)

The native app is served from `capacitor://localhost` (iOS) / `https://localhost`
(Android) and has no server of its own, so the build **must** embed an absolute
backend URL. Set it before building:

```bash
# frontend/.env (or your mobile build env)
VITE_BACKEND_URL=https://api.your-production-domain.com
```

If this is missing in a native build, the app logs a loud error and nothing
connects. On the web it can stay empty (same-origin).

---

## One-time setup

```bash
cd frontend
npm install

# generate the native projects (creates frontend/ios and frontend/android)
npx cap add ios
npx cap add android
```

## Build & run

```bash
# builds the web app, copies it into the native project, opens the IDE
npm run cap:ios       # -> Xcode: pick a device/simulator and Run
npm run cap:android   # -> Android Studio: Run
```

Every time the web code changes, re-sync:

```bash
npm run cap:sync
```

---

## Native permissions to add

Capacitor generates the native projects; add these so camera/mic capture is
allowed. (WebRTC capture works in WKWebView on **iOS 14.3+** and in the Android
System WebView.)

**iOS** — `frontend/ios/App/App/Info.plist`:

```xml
<key>NSCameraUsageDescription</key>
<string>LTC Flow uses your camera for video calls.</string>
<key>NSMicrophoneUsageDescription</key>
<string>LTC Flow uses your microphone for voice and video calls.</string>
```

**Android** — `frontend/android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
```

---

## Known WebRTC caveat

`getUserMedia` (camera/mic) works in the WebView. **`getDisplayMedia`
(screen sharing) is not supported** in mobile WebViews — the screen-share
control should be treated as desktop-only, or later backed by a native
ReplayKit (iOS) / MediaProjection (Android) plugin. Everything else in the
mediasoup call path runs unchanged.

---

## Step 1 verification checklist

Run the app on a real device (simulators can't use a camera) and confirm:

- [ ] App launches and loads the login screen.
- [ ] Login succeeds and the token persists across an app restart.
- [ ] Room list and messages load; sending/receiving a message works in real time.
- [ ] Read receipts (ticks) update.
- [ ] A 1:1 **call** connects: mic/camera permission prompts appear, and audio + remote video flow.

---

## What's next (from the migration plan)

2. **Harden storage & tenant selection** — move the auth token to
   `@capacitor/preferences` (WKWebView can evict `localStorage`); add a
   login-time instance/company picker; swap file downloads for
   `@capacitor/filesystem` + `@capacitor/share`.
3. **Native message push** — `@capacitor/push-notifications` device tokens +
   an APNs/FCM sender alongside the existing `web-push` path. *(This is the fix
   for the unreliable iOS web push.)*
4. **VoIP call ringing** — PushKit + CallKit (iOS) / high-priority FCM +
   ConnectionService (Android) so calls ring on a closed app.
5. **Polish & submit** — safe-area insets, splash/icons, deep links, store
   submission.
