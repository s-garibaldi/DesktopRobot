# Where the voice command "play" triggers action

`isPlayCommand(transcript)` is true when the transcript is exactly `"play"` or starts with `"play "` (after normalize: lowercase, trim, collapse spaces).

## Frontend – voice hook (`frontend/src/hooks/useVoiceCommandMicOnOff.ts`)

All of these run only when the transcript matches "play" or "play ...".

### 1. **Interim results** (before final)

- **Spotify** (when `isSpotifyActiveRef.current`): `isPlayCommand(transcript)` → `spotify('play')` (Spotify resume).
- **Backing track** (when `onBackingTrackCommandRef.current`): `isPlayCommand(transcript)` → mic off, then `onBackingTrackCommandRef.current('play')` (resume backing track), and `onMetronomeCommandRef.current('play')` if present.

### 2. **Final results – backing track active**

- **Dedicated backing-track block** (when `isBackingTrackActiveRef.current`): `isPlayCommand(transcript)` → mic off, chime, `onBackingTrackCommandRef.current('play')`, `onMetronomeCommandRef.current('play')`. This is the “resume when paused” path.

### 3. **Final results – waiting for backing description**

- Inside `waitingForBackingDescriptionRef.current`: `isPlayCommand(transcript)` → mic off, chime, backing track play, metronome play.

### 4. **Final results – waiting for metronome BPM**

- Inside `waitingForMetronomeBpmRef.current`: same as above for backing track + metronome play.

### 5. **Final results – general (after cooldown)**

- **Spotify** (when `isSpotifyActiveRef.current`): `isPlayCommand(transcript)` → `spotify('play')`.
- **Metronome** (when not Spotify, `onMetronomeCommandRef.current`): `isPlayCommand(transcript)` → `onMetronomeCommandRef.current('play')` (metronome resume).

## Frontend – RealtimeBridge (`frontend/src/components/RealtimeBridge.tsx`)

- `handleBackingTrackCommand('play')`: turns mic off (via voice hook), sends `backing_track_voice_handled`, then calls `h.resume()` (BackingTrackPanel resume). So “play” in backing-track context only resumes the current track and does not start a new one from the backend.

## Backend – AI tools (no direct voice “play” listener)

The backend does not listen for the word “play” directly. The **AI** can interpret “play” in the user’s speech and call:

- **`play_backing_track`** – when the user says things like “yes, play it” / “play that” after a suggestion. Tool description says to call only on explicit affirmative.
- **`spotify_queue_play`** – when the user says “play the queue” or “start the queue” (or sometimes “play” when the queue has items and nothing is playing).
- **`play_spotify_track`** – when the user asks to play a specific song (e.g. “play Bohemian Rhapsody”).

So “play” by itself can be interpreted by the model as “play the queue”, “play it” (backing track), or similar, depending on context.

## Summary

| Context              | Where                         | What “play” does                                      |
|----------------------|-------------------------------|--------------------------------------------------------|
| Backing track active | Voice hook (frontend)         | Mic off, then resume current backing track (no backend) |
| Spotify face active  | Voice hook (frontend)         | Spotify resume                                        |
| Metronome (not Spotify) | Voice hook (frontend)     | Metronome resume                                      |
| Other                | Backend AI                    | May call play_backing_track, spotify_queue_play, etc.  |

If “play” is triggering the wrong action, the usual cause is **context**: the voice hook chooses action by `isBackingTrackActiveRef`, `isSpotifyActiveRef`, and `isMetronomeActiveRef`. The backend can still hear “play” and call tools unless the frontend has already turned the mic off (e.g. before backing-track resume).
