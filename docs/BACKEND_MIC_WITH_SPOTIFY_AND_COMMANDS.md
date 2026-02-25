# Backend Microphone and Spotify / Commands

This document describes **when the backend (Realtime iframe) microphone is on or off**, and how it interacts with **Spotify**, **metronome**, **backing track**, and **voice commands**.

---

## How the backend mic is controlled

- **Frontend** (RealtimeBridge) sends a message to the **iframe** (backend):  
  `{ type: 'set_backend_mic_enabled', enabled: true | false }`
- **Backend** (iframe `App.tsx`) listens for that message and sets state `backendMicEnabledByVoice`.
- The Realtime SDK **mute** is then derived as:  
  `micShouldBeMuted = !isAudioPlaybackEnabled || !backendMicEnabledByVoice`  
  So the **mic is “on” (unmuted)** only when:
  1. Audio playback is enabled in the backend, **and**
  2. The frontend has sent `set_backend_mic_enabled: true`.

So the **frontend is the single source of truth** for “backend mic on/off” via that message. The backend never turns the mic on or off by itself based on Spotify or other features.

---

## When the frontend turns the backend mic **OFF**

| Trigger | Where | What happens |
|--------|--------|----------------|
| **Iframe load** | `handleIframeLoad` | After 1s, sends `enabled: false`. **Default at startup: mic OFF.** |
| **User says “microphone off”** or clicks Disable | `handleMicCommand(false)` | Sends `enabled: false`, clears active mode. |
| **Metronome start** (voice or backend) | `handleStartMetronome`, `startMetronomeFromBackendBpm` | Saves previous mic state, sends `enabled: false`, stops backing track. |
| **Backing track: first command** (e.g. “play blues”) | `handleBackingTrackCommand` when `mode === null` | Saves previous mic state, sends `enabled: false`. |
| **Backing track: playback actually starts** | `handleBackingTrackPlayingStart` | Saves previous mic state, sends `enabled: false`. |
| **Backing track: resume** (after pause) | BackingTrackPanel calls `onPlayingStart` → `handleBackingTrackPlayingStart` | Sends `enabled: false` again. |

---

## When the frontend turns the backend mic **ON**

| Trigger | Where | What happens |
|--------|--------|----------------|
| **User says “hey bot”** or clicks Enable | `handleMicCommand(true)` | Sends `enabled: true`, sets active mode to `backend_mic` (unless in metronome/backing_track). |
| **User clicks Enable (mic panel)** | `handleMicRequestAccess` | If connected and iframe loaded: sends `enabled: true`, sets active mode to `backend_mic`. |
| **Metronome stop** (voice “stop”/“pause” or Stop button) | `handleStopMetronome`, `handleMetronomeCommand('stop'|'pause')` | Restores saved mic state: sends `enabled: savedMicBeforeMetronomeRef.current`. |
| **Backing track stop** | `handleBackingTrackCommand('stop')`, `handleBackingTrackPlayingStop` | Restores saved mic state: sends `enabled: savedMicBeforeBackingTrackRef.current`. |
| **Backing track pause** | BackingTrackPanel calls `onPlayingStop` → `handleBackingTrackPlayingStop` | Restores saved mic state (so user can talk to AI while paused). |

---

## Spotify: mic off while playing; optional on when paused

- **When Spotify starts** (backend sends `play_spotify_track`): the frontend turns the backend mic **off** (`set_backend_mic_enabled: false`).
- **When the user says “Play”** (resume Spotify): the frontend turns the backend mic **off** again and clears `backend_mic` mode so the mic stays off until the user says “hey bot” (while paused) or “Stop”.
- **When the user says “Stop”** (Spotify): playback stops; the backend mic is **turned back on** automatically so the user can talk to the AI again.
- **When the user says “Pause”** (Spotify): playback pauses; the backend mic is **not** turned on automatically. The user can say **“hey bot”** to turn the backend mic on and talk to the AI. When they say **“Play”** again, the mic is turned off again.
- **When the user says “Skip song” or “Next”** (Spotify): skips to the next track. If the queue is empty, playback stops and the face returns to neutral (same as “Stop”).

So:

- **Backend mic is off** whenever Spotify is playing (after “play [song]” or after voice “Play” resume).
- **Backend mic stays off** after Spotify “Stop”.
- **While Spotify is paused**, the user can say “hey bot” to turn the mic on, then “Play” to resume and turn the mic off again.

---

## Active modes and mic

- **`backend_mic`**: User has turned the mic on (voice or button). Backend mic is enabled until user turns it off or another mode turns it off.
- **`metronome`**: Backend mic is forced off while metronome is running; restored when user says “stop”/“pause” or hits Stop.
- **`backing_track`**: Backend mic is forced off when a backing track is playing (or when the user gives the first backing-track command from null); restored on stop or on pause.
- **`null`**: No special mode; mic state is whatever was last set (e.g. off after iframe load, or on after “hey bot”).

---

## Summary table (by command/feature)

| Command / feature        | Backend mic before | Backend mic after      |
|--------------------------|---------------------|-------------------------|
| Iframe load              | —                   | **OFF** (default)       |
| “hey bot” / Enable | any                 | **ON**                  |
| “Microphone off” / Disable | any               | **OFF**                 |
| “Play metronome …”       | any                 | **OFF** (saved; restore on stop) |
| “Stop” / “Pause” (metronome) | OFF             | **Restored** (saved value) |
| “Backing track …” / playback start | any         | **OFF** (saved; restore on stop/pause) |
| “Play [song]” (Spotify)  | any                 | **OFF**                 |
| “Play” (Spotify resume)  | any                 | **OFF**                 |
| “Stop” (Spotify)         | OFF                 | **ON** (restored)      |
| “Pause” (Spotify)        | unchanged           | **Unchanged**           |
| “hey bot” (e.g. while Spotify paused) | any | **ON**  |
| Chord display / guitar tab | unchanged        | **Unchanged**           |

So: **Spotify turns the backend mic off when playing or resuming. When the user says “Stop”, the mic is turned back on. While paused, the user can say “hey bot” to talk to the AI, then “Play” to resume and turn the mic off again.**
