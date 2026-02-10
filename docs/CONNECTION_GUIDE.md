# Connection Guide: Frontend ↔ Backend

## What You're Seeing

That **window in the bottom right** is the **backend application** loaded in an iframe. Here's what's happening:

### Scenario 1: Backend NOT Running ❌

When you only run the frontend:
- Frontend checks: `http://localhost:3000/api/session`
- Connection fails (backend isn't running)
- Shows placeholder: "Realtime Service Not Available"
- **Status**: 🔴 Realtime Service Disconnected

**What you see**: Error message or blank placeholder

### Scenario 2: Backend IS Running ✅

When you run BOTH frontend and backend:
- Frontend checks: `http://localhost:3000/api/session`
- Connection succeeds!
- Loads backend in iframe: `<iframe src="http://localhost:3000">`
- **Status**: 🟢 Realtime Service Connected

**What you see**: Full AI chat interface with:
- Connect/Disconnect buttons
- Transcript of conversation
- Audio controls
- Agent selection

## The Connection IS Real!

The frontend and backend **DO interact**:

1. **Frontend → Backend (HTTP)**
   - Frontend checks if backend is running
   - Frontend loads backend URL in iframe

2. **Backend → Frontend (postMessage)**
   - Backend sends emotion updates
   - Backend sends status updates (listening, speaking)
   - Frontend updates robot face based on these messages

3. **They're Connected Via:**
   - **iframe**: Backend runs inside frontend's iframe
   - **postMessage API**: JavaScript messaging between iframe and parent

## How to Make It Work

### Step 1: Start the Backend
```bash
cd backend
npm install  # If you haven't already
npm run dev
```

You should see:
```
▲ Next.js 15.x.x
- Local:        http://localhost:3000
✓ Ready in X seconds
```

### Step 2: Start the Frontend
```bash
cd frontend
npm install  # If you haven't already
npm run tauri dev
```

### Step 3: Verify Connection

In the frontend window, check:

1. **Status Indicator** (top of right panel):
   - Should show: 🟢 **Realtime Service Connected**
   - NOT: 🔴 Realtime Service Disconnected

2. **The Iframe Window** (bottom right):
   - Should show the full AI chat interface
   - Should have "Connect" button
   - Should NOT show error message

3. **Console Messages** (open DevTools):
   ```
   Checking realtime service at: http://localhost:3000
   Service response status: 200
   Realtime service is available
   Realtime iframe loaded
   ```

## Troubleshooting

### If you see "Realtime Service Not Available":

1. **Check if backend is running:**
   ```bash
   # In a new terminal
   curl http://localhost:3000/api/session
   ```
   Should return JSON, not an error

2. **Check backend terminal:**
   - Should show Next.js is running
   - Should show "Ready" message
   - Should NOT show errors

3. **Check frontend console:**
   - Look for connection errors
   - Check if CORS is blocking

4. **Try clicking "Check Service" button:**
   - In the frontend UI
   - This manually retries the connection

### If the iframe loads but nothing works:

1. **Check backend `.env` file:**
   ```bash
   cd backend
   cat .env
   ```
   Should have:
   ```
   OPENAI_API_KEY=your_key_here
   BRAVE_SEARCH_API_KEY=your_key_here
   ```

2. **Check backend console:**
   - Look for API key errors
   - Look for OpenAI connection errors

3. **Try opening backend directly:**
   - Open `http://localhost:3000` in a browser
   - Does the chat interface work there?
   - If yes, the iframe should work too

## Visual Guide

```
┌─────────────────────────────────────────┐
│  Tauri Desktop App (Frontend)          │
│                                         │
│  ┌──────────────┐  ┌─────────────────┐ │
│  │ Robot Face   │  │ Status: 🟢      │ │
│  │              │  │ Connected       │ │
│  │   😊         │  │                 │ │
│  └──────────────┘  │ ┌─────────────┐ │ │
│                    │ │             │ │ │
│  ┌──────────────┐  │ │   IFRAME    │ │ │
│  │ Controls     │  │ │  (Backend)  │ │ │
│  │              │  │ │             │ │ │
│  │ [Happy]      │  │ │  AI Chat    │ │ │
│  │ [Sad]        │  │ │  Interface  │ │ │
│  └──────────────┘  │ │             │ │ │
│                    │ │ [Connect]   │ │ │
│                    │ │ Transcript  │ │ │
│                    │ └─────────────┘ │ │
│                    └─────────────────┘ │
└─────────────────────────────────────────┘
              │
              │ iframe loads:
              │ http://localhost:3000
              ▼
┌─────────────────────────────────────────┐
│  Next.js Backend (localhost:3000)       │
│  - AI Chat UI                           │
│  - OpenAI Realtime API                  │
│  - Agent Management                     │
│  - Tools (memory, search)               │
└─────────────────────────────────────────┘
```

## Summary

- ✅ **Frontend and backend DO interact** (via iframe + postMessage)
- ✅ **That window IS the backend** (when it's running)
- ✅ **If it's not working, start the backend** (`cd backend && npm run dev`)
- ✅ **They communicate in real-time** (emotions, status, audio)

The iframe **IS** the connection mechanism!
