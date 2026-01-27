# Project Structure

## Overview

The project has been reorganized into a clear frontend/backend separation:

```
DesktopRobot/
├── frontend/          # Tauri Desktop Application
├── backend/          # Next.js AI Backend
├── README.md         # Main documentation
└── package.json      # Root-level convenience scripts
```

## Frontend (`frontend/`)

**Technology Stack:**
- React + TypeScript
- Vite (build tool)
- Tauri (desktop framework)
- Rust (Tauri backend)

**Key Directories:**
- `src/` - React components and application code
  - `components/` - UI components (AnimatedFace, RealtimeBridge, etc.)
- `src-tauri/` - Rust backend for Tauri
  - `src/main.rs` - Rust code for file I/O, system integration
  - `tauri.conf.json` - Tauri configuration

**Running:**
```bash
cd frontend
npm install
npm run tauri dev
```

## Backend (`backend/`)

**Technology Stack:**
- Next.js + React + TypeScript
- OpenAI Realtime API
- OpenAI Agents SDK

**Key Directories:**
- `src/app/api/` - API routes
  - `session/` - OpenAI session management
  - `search/` - Brave Search API proxy
  - `responses/` - OpenAI responses proxy
- `src/app/agentConfigs/` - AI agent configurations
  - `musicalCompanion/` - Music theory agent
  - `generalAssistant/` - General purpose agent
  - `simpleHandoff.ts` - Multi-agent scenarios
- `src/app/lib/` - Tools and utilities
  - `memoryStorage.ts` - Persistent memory system
  - `memoryTools.ts` - Memory tools for agents
  - `webSearchTool.ts` - Web search tool
- `src/app/hooks/` - React hooks
  - `useRealtimeSession.ts` - Session management
  - `useMemoryExtraction.ts` - Auto memory extraction

**Running:**
```bash
cd backend
npm install
cp .env.sample .env
# Edit .env with your API keys
npm run dev
```

## Communication Flow

```
┌─────────────────────┐
│  Tauri Frontend     │
│  (localhost:1420)   │
│                     │
│  ┌───────────────┐ │
│  │ RealtimeBridge│ │
│  │ (iframe)      │ │
│  └───────┬───────┘ │
└──────────┼──────────┘
           │ postMessage
           │
           ▼
┌─────────────────────┐
│  Next.js Backend    │
│  (localhost:3000)   │
│                     │
│  - AI Agents        │
│  - API Routes       │
│  - Tools            │
└─────────────────────┘
           │
           │ HTTP
           ▼
    External APIs
    (OpenAI, Brave)
```

## Environment Variables

### Backend (`.env` in `backend/`)
```
OPENAI_API_KEY=your_openai_key
BRAVE_SEARCH_API_KEY=your_brave_key
```

## Development Workflow

1. **Start Backend:**
   ```bash
   cd backend && npm run dev
   ```

2. **Start Frontend:**
   ```bash
   cd frontend && npm run tauri dev
   ```

3. **Or use root scripts:**
   ```bash
   npm run dev:backend    # Start backend only
   npm run dev:frontend   # Start frontend only
   npm run dev            # Start both (requires concurrently)
   ```

## File Organization Principles

- **Frontend**: All Tauri/desktop UI code
- **Backend**: All AI/API/server code
- **Clear separation**: No shared code between frontend/backend
- **Communication**: Via iframe + postMessage (frontend → backend)
- **API calls**: Backend makes all external API calls

## Migration Notes

- Old `src/` → `frontend/src/`
- Old `src-tauri/` → `frontend/src-tauri/`
- Old `external/realtime-agents/` → `backend/`
- All import paths remain relative, so no code changes needed
