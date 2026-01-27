# Backend Explanation: How It Works

## What the Backend Does

The `backend/` folder contains a **Next.js web application** that:

1. **Manages AI Agents**: Configures and runs OpenAI Realtime API agents
2. **Handles API Routes**: 
   - `/api/session` - Gets OpenAI session keys
   - `/api/search` - Proxies Brave Search API
   - `/api/responses` - Proxies OpenAI responses
3. **Provides Tools**: Memory storage, web search, etc.
4. **Runs the AI Chat UI**: The actual chat interface you see in the iframe

## How Frontend and Backend Connect

### The Connection Flow:

```
┌─────────────────────────────────────────┐
│  Tauri Frontend (Desktop App)          │
│  Running on: localhost:1420             │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │  RealtimeBridge Component         │ │
│  │                                    │ │
│  │  1. Checks if backend is running   │ │
│  │     (fetches http://localhost:3000)│ │
│  │                                    │ │
│  │  2. Loads backend in iframe:       │ │
│  │     <iframe src="localhost:3000">  │ │
│  │                                    │ │
│  │  3. Listens for postMessage events │ │
│  └───────────────────────────────────┘ │
└─────────────────────────────────────────┘
              │
              │ HTTP + postMessage
              ▼
┌─────────────────────────────────────────┐
│  Next.js Backend                        │
│  Running on: localhost:3000             │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │  Next.js App (App.tsx)            │ │
│  │  - AI Chat UI                     │ │
│  │  - OpenAI Realtime Session        │ │
│  │  - Agent Management               │ │
│  └───────────────────────────────────┘ │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │  bridge.js (in public/)           │ │
│  │  - Monitors user input            │ │
│  │  - Detects emotions               │ │
│  │  - Sends postMessage to parent    │ │
│  └───────────────────────────────────┘ │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │  API Routes                       │ │
│  │  - /api/session                   │ │
│  │  - /api/search                   │ │
│  │  - /api/responses                │ │
│  └───────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

## Why It Can Run Standalone

The backend **CAN** run on its own because it's a complete Next.js web application:

1. **Standalone Mode**: 
   - Open `http://localhost:3000` in a browser
   - You'll see the full AI chat interface
   - It works completely independently

2. **Embedded Mode** (with frontend):
   - Frontend loads it in an iframe
   - They communicate via `postMessage` API
   - Backend sends emotion/status updates to frontend
   - Frontend can send configuration to backend

## The Communication Mechanism

### 1. Frontend → Backend (HTTP)
```typescript
// Frontend checks if backend is running
fetch('http://localhost:3000/api/session')

// Frontend loads backend in iframe
<iframe src="http://localhost:3000?agentConfig=musicalCompanion" />
```

### 2. Backend → Frontend (postMessage)
```javascript
// Backend's bridge.js sends messages
window.parent.postMessage({
  type: 'ai_speaking_start',
  emotion: 'happy'
}, '*');
```

### 3. Frontend Listens
```typescript
// Frontend receives messages
window.addEventListener('message', (event) => {
  if (event.origin === 'http://localhost:3000') {
    // Update robot face emotion
    // Update connection status
  }
});
```

## What Happens When You Run Both

### Scenario 1: Backend Only
```bash
cd backend
npm run dev
```
- Backend runs on `http://localhost:3000`
- You can open it in a browser
- Full AI chat works
- **No robot face** (that's in the frontend)

### Scenario 2: Frontend Only (Backend Not Running)
```bash
cd frontend
npm run tauri dev
```
- Frontend starts
- Checks for backend at `localhost:3000`
- Shows error: "Realtime Service Not Available"
- Robot face works, but no AI chat

### Scenario 3: Both Running (Correct Setup)
```bash
# Terminal 1
cd backend && npm run dev

# Terminal 2  
cd frontend && npm run tauri dev
```
- Backend runs on `localhost:3000`
- Frontend loads backend in iframe
- They communicate via postMessage
- **Full functionality**: Robot face + AI chat + emotion sync

## The "External" Directory

The `external/realtime-agents/` directory is the **old location** (it was a git submodule). 

- **Old**: `external/realtime-agents/` (git submodule)
- **New**: `backend/` (copied/extracted for easier development)

You can **delete** `external/` once you verify everything works. The new `backend/` folder is what's actually being used.

## Key Points

1. ✅ **Backend is a complete Next.js app** - can run standalone
2. ✅ **Frontend embeds backend in iframe** - they ARE connected
3. ✅ **Communication is bidirectional** - postMessage API
4. ✅ **Backend makes external API calls** - OpenAI, Brave Search
5. ✅ **Frontend handles UI** - Robot face, emotion controls
6. ✅ **Backend handles AI** - Chat interface, agents, tools

## Verification

To verify they're connected:

1. Open browser DevTools in the Tauri app
2. Look for console messages:
   - "Checking realtime service at: http://localhost:3000"
   - "Realtime service is available"
   - "Received message from realtime service"
3. Check Network tab - you should see requests to `localhost:3000`

The backend **IS** connected to the frontend when both are running!
