# Credit Transfer System — UKM FTSM

AI-powered credit transfer platform for Malaysian polytechnic diploma graduates applying to UKM's Faculty of Information Science & Technology (FTSM) programmes.

Built for the GLM Hackathon using the **Z.ai GLM-4-plus** model.

---

## Quick Start

### Prerequisites

- **Node.js 24+** (uses built-in `node:sqlite` — no Python/MSVC required)
- Z.ai API key (get one at [z.ai](https://z.ai))

### 1. Install Dependencies

```bash
# Backend
cd backend && npm install

# Frontend
cd ../frontend && npm install

# Scripts (seed/demo tools)
cd ../scripts && npm install
```

### 2. Configure Environment

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env`:
```
PORT=3001
JWT_SECRET=your_secret_here
ZAI_API_KEY=your_zai_api_key_here
NODE_ENV=development
```

### 3. Seed Database & Generate Demo PDFs

```bash
cd scripts

# Generate mock PDF transcripts and syllabi for the demo student
node generateMockPdfs.js

# Seed the database (uni subjects, diploma subjects, demo accounts)
node seedDb.js
```

This creates:
- **Demo student:** `student@demo.com` / `password123`
- **Demo lecturer:** `lecturer@demo.com` / `password123`
- 45 UKM FTSM subjects across 3 programmes (IT, SE, CS)
- 30 Politeknik Metro Tasek Gelugor diploma subjects
- Sample transcript for Khew Jun Yu (30 subjects, realistic grades)

### 4. Start the Application

```bash
# Terminal 1: Backend
cd backend && npm run dev

# Terminal 2: Frontend
cd frontend && npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Demo Walkthrough

### Golden Path (Credit Transfer)

1. **Login as Demo Student** — click the "Login as Demo Student" button on the login page
2. Click **New Credit Transfer Request**
3. **Step 1:** Select target programme (e.g., *Bachelor of Computer Science*), upload `scripts/output/transcript_khew_jun_yu.pdf`
4. **Step 2:** Upload syllabus PDFs from `scripts/output/syllabi/` (drag multiple files at once)
5. **Step 3:** Review parsed data, click **🚀 Start AI Analysis**
6. **Watch the live AI reasoning stream** — 5-phase progress bar, thinking bubbles per subject, real-time verdicts
7. Once complete, review the **Transfer Strategies** panel on the right
8. Select a strategy and click **Submit Application**
9. **Login as Demo Lecturer** and go to **Application Inbox**
10. Open the application, review each subject claim with AI match analysis
11. Approve/reject items, then **Finalize Application**

### Pre-Enrolment Planning

- Use **Pre-Enrolment Planning** for a quick analysis without uploading documents

---

## System Architecture

```
frontend/          React 18 + Vite + CSS Modules (PWA)
backend/
  src/
    agent/         SSE orchestrator (5-phase analysis pipeline)
    llm/           Z.ai GLM-4-plus integration (lecturer + strategist agents)
    matching/      Deterministic title matching & grade checking
    optimizer/     Branch-and-bound credit assignment optimizer
    models/        node:sqlite data access layer
    services/      Business logic (analysis, application, report, followup)
    api/routes/    Express REST endpoints
scripts/           Seed data, demo PDF generation, inspectAnalysis.js
data/seed/         JSON seed data (uni subjects, diploma subjects, demo student)
```

### Analysis Pipeline (5 Phases)

| Phase | What Happens |
|-------|-------------|
| 0 | Ingest transcript & syllabi, map to known diploma subjects |
| 1 | Title normalisation & topic matching (≥80% → standalone, 60–79% → try combo) |
| 2 | Grade check (minimum C+ / grade ≥ 5 required) |
| 3 | LLM lecturer agent reviews each candidate pair (cached by content hash) |
| 4 | LLM strategist generates 2–3 strategies; branch-and-bound optimizer maximises credits |

---

## Debugging

```bash
# List recent analyses
node scripts/inspectAnalysis.js --list 10

# Inspect a specific analysis
node scripts/inspectAnalysis.js <analysis_id>
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 24 (ESM) |
| Database | SQLite via `node:sqlite` (built-in, no native compilation) |
| LLM | Z.ai GLM-4-plus via OpenAI-compatible SDK |
| Backend | Express 4, pino, zod, nanoid, bcryptjs, jsonwebtoken |
| PDF | pdf-parse (extraction), pdfkit (generation) |
| Frontend | React 18, Vite 5, react-router-dom v6, CSS Modules |
| PWA | vite-plugin-pwa, Workbox |
| SSE | Native EventSource + Node.js EventEmitter |

## 👥 Team — CobolD

* **Ng Ming Qian**
* **Tay Hoe Guan**
* **Gunalan A/L Moorthy**
* **Khew Jun Yu**
* **Adam Ashwin Tay**
