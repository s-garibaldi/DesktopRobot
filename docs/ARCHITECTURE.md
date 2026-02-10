# Desktop Robot — Macro Architecture

A concise, pitch-ready overview of how the system is structured and why.

---

## 1. High-Level Architecture

The project is a **client–server desktop application** with a strict separation between:

- **Client (frontend)**: Native desktop shell, animated persona, and local audio/UI. Runs as a Tauri app (React + Rust).
- **Server (backend)**: AI orchestration, session management, tools, and external APIs. Runs as a Next.js app.

They communicate over **HTTP + postMessage**: the client embeds the server UI in an iframe and exchanges structured messages for state (emotions, connection status, etc.). All secrets and external API calls stay on the backend.

```
┌─────────────────────────────────────────────────────────────────┐
│  CLIENT (Tauri · localhost:1420)                                 │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────────┐ │
│  │ Animated    │  │ Emotion &    │  │ RealtimeBridge           │ │
│  │ Face        │  │ Music UI    │  │ (iframe + postMessage)   │ │
│  └─────────────┘  └──────────────┘  └────────────┬────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                                    │
                                    HTTP + postMessage (origin-checked)
                                                    │
┌─────────────────────────────────────────────────────────────────┐
│  SERVER (Next.js · localhost:3000)                               │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────────┐ │
│  │ API Routes  │  │ Agent Configs │  │ Tools (memory, search,  │ │
│  │ session,    │  │ (Realtime     │  │ chord recognition, etc.) │ │
│  │ search,     │  │ agents)       │  │                         │ │
│  │ responses   │  │              │  │                         │ │
│  └──────┬──────┘  └──────┬───────┘  └────────────┬────────────┘ │
└─────────┼────────────────┼──────────────────────┼──────────────┘
          │                │                      │
          ▼                ▼                      ▼
     OpenAI Realtime   Agent runtime        Memory store,
     (sessions)        (voice + tools)      Brave Search, etc.
```

**Design rationale**: The client never holds API keys or talks to OpenAI directly. The backend is a full web app that can run standalone (e.g. in a browser) or be embedded; the same code path serves both.

---

## 2. Frontend (Client) Architecture

| Layer | Tech | Responsibility |
|-------|------|----------------|
| **Shell** | Tauri + Rust | Native window, future system/OS integration, packaging |
| **App** | React + TypeScript + Vite | Single-page app, state, routing of “face” vs “panels” |
| **Presentation** | React components | Animated face, emotion controls, guitar tabs, metronome, backing track UI |
| **Integration** | RealtimeBridge | Iframe load, health check, postMessage protocol with backend |

**Main modules**:

- **AnimatedFace / GuitarTabsFace**: Canvas-based face that reacts to `emotion` (neutral, happy, listening, speaking, thinking, metronome, guitarTabs, etc.). Emotion is driven by user controls or by messages from the backend (conversation state, user input hints).
- **RealtimeBridge**: Owns the iframe that loads the backend; checks `/api/session` for liveness; subscribes to `message` events; maps backend events (e.g. `ai_speaking_start`, `emotion_suggestion`) to emotion and connection state; can pass agent config via URL params.
- **EmotionControls, MetronomePanel, BackingTrackPanel**: User-facing controls; metronome and backing track run in the client (audio + optional ElevenLabs for generation), separate from the Realtime API.
- **Backing track**: Local parsing of voice/text commands, optional cloud generation (ElevenLabs), playback and saved loops — all in the frontend with a small backend proxy if needed for API keys.

**Design rationale**: The frontend is the “robot” experience: face, emotions, and auxiliary music tools. The backend is the “brain”: sessions, agents, and tools. Keeping them separate allows the backend to be reused (e.g. web, other clients) and keeps credentials and heavy logic off the client.

---

## 3. Backend (Server) Architecture

| Layer | Location | Responsibility |
|-------|----------|----------------|
| **API** | `app/api/*` | Session provisioning, search proxy, responses proxy, health |
| **Agents** | `app/agentConfigs/*` | Realtime agent definitions: instructions, tools, handoffs |
| **Tools** | `app/lib/*` | Implementations used by agents: memory, web search, chord recognition, etc. |
| **Bridge** | `public/bridge.js` | Runs inside the Next.js app; detects conversation state and user input; posts events to parent (frontend) for emotion and status |

**Session flow**:

1. Client calls `GET /api/session` → backend uses `OPENAI_API_KEY` to create an OpenAI Realtime session and returns session config to the client.
2. Client loads the Next.js app in an iframe; that app uses the session to run the Realtime connection (audio + events).
3. `bridge.js` in the iframe sends `postMessage` events to the parent (client) for: speech start/stop, AI speaking start/end, tool calls, and emotion suggestions from user text.

**Agent model**: Agents are defined as **scenarios** (e.g. `musicalCompanion`). Each scenario is an array of Realtime agents (e.g. one primary agent with tools). The app can be extended with more scenarios in `agentConfigs` and a small registry (`allAgentSets`, `defaultAgentSetKey`). Tools are injected into agents (e.g. `createMemoryTools`, `webSearchTool`, chord tools) so the same tool layer is reused across agents.

**Design rationale**: Backend owns all identity and external I/O. Agent configs are code (TypeScript); tools are typed and testable. The bridge script is the only place that translates backend UX events into the postMessage contract for the client.

---

## 4. Communication Protocol (Client ↔ Server)

- **Liveness**: Client does `GET ${backend}/api/session` (or health). Success → “Realtime service connected”; failure → “Realtime service unavailable.”
- **Embedding**: Client sets iframe `src` to backend root (e.g. `?agentConfig=musicalCompanion`). Backend serves the chat UI and runs Realtime + bridge.
- **Events**: Backend (bridge) → client via `window.parent.postMessage(...)`. Client validates `event.origin` (e.g. `http://localhost:3000`) and handles by `type`, e.g.:
  - `emotion_suggestion` → update face emotion (with debouncing).
  - `ai_speaking_start` / `ai_speaking_end` → speaking state.
  - `input_audio_buffer.speech_started` (or equivalent) → listening state.
  - Optional: tool call start/end for “thinking” or loading states.
- **No client → backend postMessage required for core flow**: agent config is via URL; session is fetched over HTTP. Optional future: client could post config or commands via postMessage.

**Design rationale**: A single, origin-checked postMessage channel keeps the contract clear and secure. Debouncing and a single handler in RealtimeBridge avoid duplicate or conflicting updates.

---

## 5. Domain Features (How They Fit)

| Feature | Where it lives | How it’s triggered |
|--------|----------------|--------------------|
| **Voice conversation** | Backend: Realtime session + agents | User speaks in iframe; backend runs agents and tools |
| **Emotion / face** | Frontend: AnimatedFace + RealtimeBridge | Manual (EmotionControls) or backend events (bridge → postMessage → emotion state) |
| **Memory** | Backend: `memoryStorage` + `memoryTools` | Agents call `store_memory` / `recall_memory`; optional extraction from transcripts |
| **Web search** | Backend: `webSearchTool` + `/api/search` (Brave) | Agent calls tool; backend proxies to Brave Search API |
| **Chord/scale help** | Backend: chord tool in agent; Frontend: GuitarTabsFace + chordData | Agent uses tool for theory; user can use Guitar Tabs UI for fingerings/voicings |
| **Metronome** | Frontend: MetronomePanel + metronomeStore/audio | Local only; BPM and on/off in client; optional voice command parsing |
| **Backing track** | Frontend: BackingTrackPanel + ElevenLabs (or local) | Local playback; optional cloud generation via frontend with env-configured API key |

So: **conversation and persistence** are server-side; **persona and music practice tools** are client-side, with a clear event contract between them.

---

## 6. External Integrations

- **OpenAI**: Realtime API (sessions, audio, events). Keys only in backend env.
- **Brave Search**: Used by backend for web search tool; key in backend env.
- **ElevenLabs** (optional): Used from frontend for backing-track generation; key in frontend env if needed.
- **Future**: Raspberry Pi or other deployment can run the same backend (and optionally a headless or kiosk client); see `docs/RASPBERRY_PI_DEPLOYMENT.md` if present.

---

## 7. Repo and Run Model

- **Monorepo**: Root `package.json` has workspaces `frontend` and `backend`; scripts like `dev`, `dev:frontend`, `dev:backend`, `build:frontend`, `build:backend` orchestrate from the root.
- **Run order**: Start backend (`npm run dev:backend`), then frontend (`npm run dev:frontend`). Frontend expects backend at a configurable URL (e.g. `VITE_BACKEND_URL` or default `http://localhost:3000`).
- **Build**: Backend builds as a standard Next.js app. Frontend builds as a Tauri app (native binary + bundle). Backend can be deployed to any Node host; client is distributed as a desktop app.

---

## 8. Summary for a Pitch

- **Architecture**: Deliberate client–server split: Tauri desktop client for the robot “body” and UX, Next.js backend for the AI “brain” and all external APIs.
- **Security**: No API keys or sensitive logic in the client; backend proxies and owns sessions.
- **Extensibility**: Agent scenarios and tools are modular; new agents or tools don’t require frontend changes beyond optional URL params or postMessage types.
- **UX**: Single, consistent postMessage protocol drives face and status from conversation state and user input; emotion and voice state are debounced and centralized in RealtimeBridge.
- **Deployment**: Backend is a normal web app; frontend is a native desktop app; same backend can serve browser or embedded client for future use cases.

This document reflects the **intended** macro architecture; implementation details live in the codebase and in the repo README and in this `docs/` folder: STRUCTURE.md, BACKEND_EXPLANATION.md, CONNECTION_GUIDE.md, EMOTION_SYSTEM.md.
