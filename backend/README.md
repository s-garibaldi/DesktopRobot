# Desktop Robot - Backend

Next.js backend application providing AI agent functionality via OpenAI Realtime API.

## Structure

- `src/app/api/` - API routes (session, search, responses)
- `src/app/agentConfigs/` - AI agent configurations
- `src/app/lib/` - Tools and utilities (memory, web search)
- `src/app/hooks/` - React hooks for session management
- `package.json` - Backend dependencies

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:
```bash
cp .env.sample .env
# Edit .env and add:
# OPENAI_API_KEY=your_key
# BRAVE_SEARCH_API_KEY=your_key
```

## Running

```bash
npm run dev
```

The backend will run on `http://localhost:3000`

## API Routes

- `GET /api/session` - Get OpenAI ephemeral session key
- `POST /api/responses` - Proxy OpenAI responses API
- `POST /api/search` - Brave Search API proxy

## Agent Configurations

- `musicalCompanion` - Music theory, guitar, songwriting
- `generalAssistant` - General purpose assistant
- `simpleHandoff` - Multi-agent handoff scenarios
