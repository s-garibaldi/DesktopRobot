# Why the Start Playback Button Is Required

## Summary

When the AI queues music, playback does **not** start automatically. The user must manually click the "Start playback" button. This document explains why and what options exist.

---

## Root Cause: Browser Autoplay Policy

Browsers (Chrome, Safari, WebKit) block audio/video from playing without a **user gesture** (click, tap, or keypress). This is the [Autoplay Policy](https://developer.chrome.com/blog/autoplay/).

### The Flow

1. **User asks AI** → "play Song A, Song B, Song C"
2. **AI queues** → backend sends `music_add_to_queue` to frontend
3. **Frontend adds to queue** → `musicController.addToQueueAndStartIfIdle()` runs
4. **First play attempt** → `playIndex(0)` → adapter `playUri()` is called
5. **Play fails** (or is blocked) because there was no user gesture in the call stack
6. **Manual click** → User clicks "Start playback" → that click is a user gesture → `activateElement()` + `playIndex(0)` runs → playback works

### Why Programmatic Calls Fail

When we call `handleStartPlayback()` from:
- `setTimeout` (our 250ms auto-attempt)
- An event handler for `spotify-agent-requested-playback` (which fires from a postMessage)

…the call stack does **not** originate from a user gesture. The browser treats it as "autoplay" and blocks or mutes it.

When the user clicks the button, the call stack **does** originate from the click → that counts as a user gesture → playback is allowed.

---

## Which Player Is Used?

The app can use two different Spotify playback paths:

| Condition | Player | Where it runs |
|-----------|--------|---------------|
| `isConnected && iframeLoaded` | **Backend** (`useSpotifyViaBackend`) | Backend iframe (Spotify SDK + Web API) |
| Otherwise | **Frontend** (`useSpotifyPlayer`) | Frontend (Spotify Web Playback SDK) |

### Backend Player
- Sends `spotify_play` via postMessage to the backend iframe
- Backend uses `fetch()` to call Spotify Web API + its own Spotify SDK
- `activateElement` is a no-op in the frontend; backend calls it internally
- **Even here**, the Spotify SDK in the backend iframe may need a user gesture to unlock audio. A click in the **frontend** does not create a user gesture in the **backend iframe** (different documents). So the backend may also be subject to autoplay restrictions depending on how the iframe’s audio context was initialized.

### Frontend Player
- Uses the Spotify Web Playback SDK directly in the frontend
- **Explicitly requires** `activateElement()` to be called from a user gesture (see `useSpotifyPlayer.ts`: "Call from click handler before play – required for browser autoplay")
- Without a user gesture, `activateElement()` does not actually unlock the player

---

## Options to Fix or Work Around

### 1. Tauri WebView: Autoplay Policy Flag (if supported)

Chromium/Chrome supports `--autoplay-policy=no-user-gesture-required`. The Raspberry Pi deployment doc uses this for a kiosk. Tauri’s WebView may allow similar configuration.

**Check:** Tauri 1.x / 2.x config for WebView initialization args or equivalent flags. If the WebView can be started with `no-user-gesture-required`, autoplay would be allowed.

### 2. Simulated User Gesture (not reliable)

Some approaches try to "fake" a user gesture (e.g. programmatic click). Browsers intentionally ignore these for autoplay; they do not count as real user gestures.

### 3. Voice Command

We already added "start playback" as a voice command. The user can say "start playback" or "play" instead of clicking. This still does **not** provide a user gesture for the Web Audio/Spotify SDK, so it may not unlock playback. Worth testing to confirm.

### 4. Require One-Time Click

Keep the current flow: user must click once to start playback. This is the most reliable and matches browser rules.

### 5. Click Interception / Focus Trick (experimental)

Some apps try to have the user click something else (e.g. "Connect" or "Enable mic") and then quickly start playback while the gesture might still be in the same "engagement" window. This is brittle and not guaranteed.

---

## Diagnostic: Which Path Is Failing?

To narrow this down:

1. **Check the UI**: Is the status "🟢 Realtime Service Connected" when you try? If yes → backend player. If no → frontend player.

2. **Add console logging** in `SpotifyPanel`:
   - Log `useBackend` when `spotify-agent-requested-playback` fires
   - Log the return value of `playIndex(0)` / `playUri` from the adapter

3. **Check for `autoplayBlocked`**: The frontend player sets this when Spotify’s `autoplay_failed` fires. If you see "🔊 Click to enable audio", the frontend player is used and autoplay was blocked.

4. **Check for `spotify-playback-failed`**: This fires when `addToQueueAndStartIfIdle` returns `ok: false`, indicating the first play attempt failed.

---

## Recommendation

1. **Short term**: Keep the Start playback button and the "start playback" voice command. Document clearly that one click is required due to browser policy.
2. **Medium term**: Investigate whether Tauri’s WebView can be configured with `--autoplay-policy=no-user-gesture-required` or equivalent.
3. **Fallback**: If the app is ever run in a kiosk or dedicated Chromium window (e.g. Raspberry Pi), use that flag so playback can start without a click.
