# Desktop Robot

A desktop application featuring an animated robot face with AI voice interaction capabilities.

## Project Structure

```
DesktopRobot/
├── frontend/              # Tauri Desktop Application
│   ├── src/              # React frontend code
│   ├── src-tauri/        # Rust backend (Tauri)
│   ├── package.json      # Frontend dependencies
│   └── vite.config.ts    # Vite configuration
│
├── backend/              # Next.js AI Backend
│   ├── src/app/          # Next.js application
│   │   ├── api/          # API routes
│   │   ├── agentConfigs/ # AI agent configurations
│   │   ├── lib/          # Utility libraries (memory, search, etc.)
│   │   └── hooks/        # React hooks
│   ├── package.json      # Backend dependencies
│   └── .env              # Environment variables (API keys)
│
├── external/             # Upstream / reference repos (e.g. realtime-agents)
├── docs/                 # Project documentation (architecture, guides, deployment)
└── README.md             # This file
```

More detail: [docs/STRUCTURE.md](docs/STRUCTURE.md) and [docs/README.md](docs/README.md).

## Architecture

### Frontend (Tauri)
- **Technology**: React + TypeScript + Vite + Tauri (Rust)
- **Port**: `localhost:1420`
- **Purpose**: Desktop UI with animated robot face and emotion controls
- **Location**: `frontend/`

### Backend (Next.js)
- **Technology**: Next.js + React + TypeScript
- **Port**: `localhost:3000`
- **Purpose**: AI agent logic, OpenAI Realtime API, tools (memory, web search)
- **Location**: `backend/`

### Communication
- Frontend loads backend in an iframe (`http://localhost:3000`)
- They communicate via `postMessage` API
- Backend makes external API calls (OpenAI, Brave Search)

## Setup

### Prerequisites
- Node.js (v18+)
- Rust (for Tauri)
- npm or yarn

### Frontend Setup
```bash
cd frontend
npm install
```

### Backend Setup
```bash
cd backend
npm install
cp .env.sample .env
# Edit .env and add your API keys:
# - OPENAI_API_KEY
# - BRAVE_SEARCH_API_KEY
```

## Running the Application

### 1. Start the Backend
```bash
cd backend
npm run dev
```
The backend will run on `http://localhost:3000`

### 2. Start the Frontend
```bash
cd frontend
npm run tauri dev
```
The Tauri desktop app will launch and connect to the backend.

## Features

- **Animated Robot Face**: Visual representation with emotions (happy, sad, excited, etc.)
- **Voice AI Interaction**: Real-time voice conversations with AI agents
- **Multiple Agent Modes**:
  - 🎵 Musical Companion - Guitar, songwriting, music theory
  - 🤖 General Assistant - General purpose AI assistant
  - 🎯 Simple Handoff - Multi-agent conversations
- **Persistent Memory**: AI remembers information across sessions
- **Web Search**: AI can search the internet for current information (Brave Search API)
- **Emotion Detection**: Robot face responds to conversation context

## Configuration

### Environment Variables (Backend)
Create `backend/.env`:
```
OPENAI_API_KEY=your_openai_api_key
BRAVE_SEARCH_API_KEY=your_brave_search_api_key
```

### Agent Configuration
Edit agent settings in `backend/src/app/agentConfigs/`:
- `musicalCompanion/index.ts` - Musical companion agent
- `generalAssistant/index.ts` - General assistant agent

## Development

### Frontend Development
- Hot reload enabled via Vite
- Tauri dev mode: `npm run tauri dev`

### Backend Development
- Next.js hot reload enabled
- API routes: `backend/src/app/api/`
- Agent tools: `backend/src/app/lib/`

## Building for Production

### Frontend (Tauri)
```bash
cd frontend
npm run tauri build
```

### Backend (Next.js)
```bash
cd backend
npm run build
npm start
```

## License

See individual component licenses.
