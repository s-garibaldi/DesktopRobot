# Spotify Backend Architecture & Edit-Safety

## Why the AI Can "Lose" Spotify Functions

The backend AI controls Spotify via **postMessage** between the frontend (Tauri/React) and the backend (Next.js iframe). Two things must be true:

1. **Backend runs in iframe** – `postClientAction` sends to `window.parent`. If the backend is opened directly (e.g. `http://localhost:3000`), `window.parent === window` and all Spotify commands are silently dropped.
2. **Music state is synced** – `spotify_queue_get` reads from `musicState`, which is updated when the frontend sends `music_state_update`. If that never arrives (e.g. after HMR), the queue appears empty.

## Architecture

```
Frontend (Tauri/React)                    Backend (Next.js iframe)
─────────────────────                    ─────────────────────────
RealtimeBridge
  └─ iframe src=backendUrl
  └─ music_state_update ──────────────────► setMusicState()  ◄── spotify_queue_get
  └─ ◄── backend_request_music_state
  └─ ◄── music_play_track, music_next, etc. (postClientAction)
       │
       └─► RealtimeBridge handles → musicController.next(), etc.
```

## Why Spotify Edits Often Break Things

1. **Backend HMR** – When you edit backend Spotify files, Next.js hot-reloads. The iframe content changes but the frontend may not re-send `music_state_update`. The backend now has empty `musicState`, so `spotify_queue_get` returns "queue is empty" and play commands may seem broken.
2. **Frontend HMR** – Editing frontend music files can reset `iframeLoaded` or the message listener, causing a brief window where messages are dropped.
3. **Opening backend directly** – If you open `http://localhost:3000` in a tab for debugging, `postClientAction` no-ops. The AI "has" the tools but nothing happens.

## Fixes Applied

- **backend_request_music_state** – Backend requests music state on mount. Frontend responds with `music_state_update`. Ensures queue/nowPlaying are available after HMR or reconnect.
- **Bridge logging** – `postClientAction` logs once at startup whether it's in iframe (ready) or not (Spotify tools won't work).
- **Documentation** – This file.

## Safe Editing Practices

1. **After editing backend Spotify code** – Refresh the frontend or reconnect. The backend will send `backend_request_music_state` and get fresh state.
2. **After editing frontend music code** – Same: reconnect so the iframe reloads and state is re-synced.
3. **Always use the app via the frontend** – Never open the backend URL directly when testing Spotify.
4. **Check console** – Look for `[bridge] Ready:` (good) or `[bridge] Spotify/music tools will NOT work` (bad – backend not in iframe).
