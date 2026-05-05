# Credit Transfer System — Claude Code Context

This is the CLAUDE.md for the UKM FTSM Credit Transfer System (GLM hackathon project).

## Current Status: Phase 1 COMPLETE

### Stack
- Backend: Node.js 20+ ESM, Express 4, node:sqlite (built-in, replaces better-sqlite3 — no Python needed on Windows), pino, zod, nanoid, bcryptjs, jsonwebtoken
- Frontend: React 18 + Vite (Phase 5+)
- LLM: Z.ai GLM-4.6 via openai SDK with baseURL override (Phase 3+)

### Key decisions made in Phase 1
- Used `node:sqlite` (Node 24 built-in) instead of `better-sqlite3` because Python/MSVC is not installed on the Windows build machine. A compatibility shim in `backend/src/db/connection.js` adds `.pragma()` and `.transaction()` so all model files use the exact better-sqlite3 API pattern.
- DB path: `backend/data/credit_transfer.db` (created automatically on startup)
- All IDs are deterministic strings for seeded entities (`user-demo-student`, `prog-ukm-ftsm-it`, etc.)

### Demo credentials
- Student: student@demo.com / password123
- Lecturer: lecturer@demo.com / password123

### Structure
See the full build prompt (CLAUDE_CODE_PROMPT.md in the conversation) for the complete architecture, phases, and spec.

### Running the project
```bash
# First time setup
npm install
node scripts/generateMockPdfs.js
node scripts/seedDb.js

# Dev
npm run dev   # starts backend:3001 + frontend:5173 concurrently

# Backend only
cd backend && npm run dev

# Frontend only
cd frontend && npm run dev
```

### What's in each phase
- Phase 1 (done): Scaffolding, DB, seed, mock PDFs, Express skeleton
- Phase 2: Deterministic engine (titleMatcher, gradeChecker, optimizer) + unit tests
- Phase 3: LLM integration (Z.ai GLM-4.6), caching, SSE streaming
- Phase 4: Full REST API + auth + multer uploads + PDF reports
- Phase 5: Frontend student flow (the demo centrepiece)
- Phase 6: Frontend lecturer flow
- Phase 7: PWA + README + polish
