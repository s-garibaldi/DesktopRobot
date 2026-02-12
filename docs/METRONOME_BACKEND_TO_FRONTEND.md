# How the Backend Starts the Metronome on the Frontend

This document describes how a **backend command** (AI tool call) results in the **frontend metronome** starting.

## Architecture Overview

- **Frontend (Tauri/React)**: Main app that shows the robot face, panels, and embeds the realtime UI in an **iframe**.
- **Backend (Next.js)**: Served at `realtimeUrl` (e.g. `http://localhost:3000`). The **same app runs in the browser** when loaded inside that iframe. So the “backend” is both:
  - A server (API routes, `/api/session`, etc.)
  - A client (the page in the iframe that runs the realtime session and **tool `execute()` functions**).

Communication is **iframe → parent** via `window.postMessage`. The parent is the frontend (RealtimeBridge); the iframe is the backend’s React app.

---

## End-to-End Flow

### 1. User asks for a metronome (voice)

User says something like “play a metronome for rumba” or “metronome at 120”. The realtime session (running in the iframe) sends audio to the API; the model decides to call the `set_metronome_bpm` tool.

### 2. Backend: tool definition and execution (runs in the iframe)

**File:** `backend/src/app/agentConfigs/musicalCompanion/index.ts`

- The agent defines a tool named `set_metronome_bpm` with parameters `bpm` and optional `genre`.
- When the model calls this tool, the SDK runs its `execute()` in the **same browser context as the iframe** (not on the Node server).
- `execute()`:
  - Resolves BPM from `genre` (e.g. rumba → 104) or uses `bpm` (40–240).
  - Clamps BPM to 40–240.
  - Calls **`postClientAction('metronome_set_bpm', { bpm: clamped })`**.

So the “backend” that receives the command is the **iframe app** (backend’s React app). The tool runs there and then calls the bridge.

### 3. Bridge: send action to parent window

**File:** `backend/src/app/lib/bridge.ts`

```ts
export function postClientAction(type: string, payload?: Record<string, unknown>) {
  if (typeof window === "undefined") { /* skip in Node */ return; }
  if (!window.parent || window.parent === window) { /* skip if not in iframe */ return; }
  const message = { type, ...payload };
  window.parent.postMessage(message, origin);
}
```

- So when the tool runs **in the iframe**, `window` and `window.parent` exist.
- `postClientAction('metronome_set_bpm', { bpm: clamped })` sends:
  - `{ type: 'metronome_set_bpm', bpm: 104 }` (or whatever BPM) to the **parent** window.

### 4. Frontend: receive message and start metronome

**File:** `frontend/src/components/RealtimeBridge.tsx`

- The parent window (RealtimeBridge) registers a **`message`** listener in a `useEffect`.
- It only handles messages from `event.origin === backendOrigin` (origin of `realtimeUrl`).
- In the handler it switches on `data.type`; for **`metronome_set_bpm`**:

```ts
case 'metronome_set_bpm': {
  const bpm = data.bpm;
  if (typeof bpm === 'number' && bpm >= 40 && bpm <= 240) {
    const startFromBackend = startMetronomeFromBackendBpmRef.current;
    if (typeof startFromBackend === 'function') {
      startFromBackend(bpm);
    }
  }
  break;
}
```

- `startMetronomeFromBackendBpmRef.current` is set to the **`startMetronomeFromBackendBpm`** callback (see below).

### 5. What `startMetronomeFromBackendBpm` does

**File:** `frontend/src/components/RealtimeBridge.tsx`

- **Sets the BPM** in the metronome store: `setMetronomeBpm(bpm)` (used by the metronome UI and audio).
- **Starts the metronome**: calls `handleStartMetronome()` (which starts the tick sound and sets up the beat).
- **Sets active mode** to `'metronome'`: `setActiveModeAndRef('metronome')` so the rest of the app knows the metronome is the active “mode.”
- **Switches the face to metronome**: `handleEmotionChange('metronome', 'metronome_from_backend', true)` so the robot shows the metronome face.

So one BPM number from the backend (via postMessage) drives: store update, start of the tick, mode flag, and emotion/face.

---

## Summary Diagram

```
User: "Play metronome for rumba"
        │
        ▼
Realtime session (iframe) ──► Model calls tool set_metronome_bpm(genre: "rumba")
        │
        ▼
Tool execute() in iframe:
  - getTempoBpmForGenre("rumba") → 104
  - postClientAction('metronome_set_bpm', { bpm: 104 })
        │
        ▼
bridge.ts: window.parent.postMessage({ type: 'metronome_set_bpm', bpm: 104 })
        │
        ▼
RealtimeBridge (parent) handleMessage
  - case 'metronome_set_bpm': startMetronomeFromBackendBpmRef.current(104)
        │
        ▼
startMetronomeFromBackendBpm(104):
  - setMetronomeBpm(104)
  - handleStartMetronome()
  - setActiveModeAndRef('metronome')
  - handleEmotionChange('metronome', …)
        │
        ▼
Metronome runs; face shows metronome; user can stop with voice ("stop" / "pause").
```

---

## Important details

1. **Tool runs in the iframe, not on the Node server**  
   The backend Next.js app is both server and client. The realtime session and tool `execute()` run in the **client** (the iframe). So `postClientAction` has access to `window` and `window.parent`.

2. **Single channel: postMessage**  
   There is no separate “backend → frontend” HTTP or WebSocket for metronome. The only path is: iframe (backend app) → `postClientAction` → `postMessage` → parent (RealtimeBridge) → `startMetronomeFromBackendBpm`.

3. **BPM is the only payload**  
   The backend only sends a BPM number (40–240). The frontend does not receive genre or raw text; it only receives `metronome_set_bpm` with `bpm`.

4. **Ref for message handler**  
   `startMetronomeFromBackendBpmRef.current` is assigned the callback so the synchronous `message` handler can start the metronome without depending on React closure state.

5. **Other bridge traffic**  
   The same iframe also sends `bridge_log` events (e.g. for tool start/end, audio, emotions). The metronome is a **direct client action**: `type: 'metronome_set_bpm'` with `bpm`, not a bridge_log subtype.

---

## Files to look at

| Role | File |
|------|------|
| Tool definition and BPM resolution | `backend/src/app/agentConfigs/musicalCompanion/index.ts` (`setMetronomeBpmTool`) |
| Sending action to parent | `backend/src/app/lib/bridge.ts` (`postClientAction`) |
| Receiving and starting metronome | `frontend/src/components/RealtimeBridge.tsx` (message listener, `startMetronomeFromBackendBpm`) |
| BPM store | `frontend/src/components/metronome/metronomeStore.ts` (`setMetronomeBpm`) |
| Starting tick / mode / emotion | `frontend/src/components/RealtimeBridge.tsx` (`handleStartMetronome`, `setActiveModeAndRef`, `handleEmotionChange`) |
