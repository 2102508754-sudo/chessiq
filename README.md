# ChessIQ v3.3.0

> **A Production-Frozen, Sixth Normal Form (6NF) Longitudinal Chess Analytics & High-Throughput Distributed Engine Platform**

[![CI/CD Pipeline](https://github.com/AbhijitSaha-coder/chessiq/actions/workflows/ci.yml/badge.svg)](https://github.com/AbhijitSaha-coder/chessiq/actions/workflows/ci.yml)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16%20%7C%2017-336791?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20%20LTS-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Stockfish](https://img.shields.io/badge/Engine-Stockfish%2016.1%20NNUE-000000?logo=chess&logoColor=white)](https://stockfishchess.org/)
[![React](https://img.shields.io/badge/React-18.2-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![License](https://img.shields.io/badge/License-Proprietary-red)](#)

---

## ♟️ Executive Summary

Digital chess platforms (Chess.com, Lichess) process hundreds of millions of games monthly, but their diagnostics are **ephemeral, session-isolated, and mathematically flawed** (e.g., synthetic zero-CPL overwrites on opening plies that hide catastrophic blunders like Fool's Mate).

**ChessIQ v3.3.0** is an enterprise-grade chess intelligence platform designed for competitive players (1000–2500 Elo) and systems architects. It aggregates historical games into a longitudinal progression telemetry system that tracks player-specific weakness trends, phase-based centipawn loss (ACPL) deterioration, opening repertoire efficacy, and personalized puzzle generation.

---

## 👥 Engineering Team & Ownership

ChessIQ is being built across a structured **18-Day Master Engineering Sprint** by a specialized 3-person engineering team:

| Engineer             | Primary Responsibilities & Architectural Domain                                                                                                                                                                                                                                                                                                                                                                                                      | Role                                  |
| :------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------ |
| **Abhijit Saha**     | **Project Ideation, System Architecture & Database Architect (`@DB`)**<br>• Physical 6NF Schema Decomposition & GiST exclusion temporal constraints<br>• High-performance `sp_ingest_game_analysis_6nf` PL/pgSQL bulk procedure<br>• Lossless 3NF View Reconstruction Layer (`v_games`, `v_move_analyses`, etc.)<br>• Transactional SHA-256 Checksum Migration Engine                                                                                | **Project Lead & Database Architect** |
| **Jaidev Basandrai** | **Backend & Distributed Systems Engineer (`@BE`)**<br>• Express 4.19 Security Gateway (Helmet, CORS, signed cookies, rate limiting)<br>• PostgreSQL FIFO Queue Worker with CTE-isolated `FOR UPDATE SKIP LOCKED`<br>• Dedicated `LISTEN/NOTIFY` client with full-jitter exponential backoff<br>• Heartbeat Watchdog & uncatchable `SIGKILL` (`rowCount === 0`) circuit breaker<br>• Stockfish NNUE UCI process pool & polarity inversion mathematics | **Backend Lead**                      |
| **Bibhukesh Medhi**  | **Frontend & Telemetry Engineer (`@FE`)**<br>• Single-Domain Reverse Proxy Client (`/api`) enforcing first-party cookies<br>• React 18 Concurrent Rendering UI + `react-chessboard` interaction<br>• Live Telemetry Diagnostic Shell (Engine version, GiST extensions, latency)<br>• Interactive move navigation, ACPL progression graphs, and puzzle solver                                                                                         | **Frontend Lead**                     |

---

## 🏛️ Core Architectural Innovations

### 1. Sixth Normal Form (6NF) Relational Storage

Decomposes mutable entities into irreducible binary relations with at most one non-key attribute per table. Temporal validity intervals are enforced using native PostgreSQL `tstzrange` and GiST exclusion constraints (`btree_gist`), guaranteeing zero storage sparsity and non-overlapping state intervals.

### 2. High-Performance Bulk Ingestion (`sp_ingest_game_analysis_6nf`)

Eliminates the multi-statement round-trip penalty by providing an atomic PL/pgSQL stored procedure that ingests an entire 80-ply game in a single database round-trip ($<50\text{ ms}$) using parallel primitive arrays, `UNNEST`, and `array_agg(uuid_generate_v4())`.

### 3. Driver-Accurate Circuit Breaker (`rowCount === 0`)

Worker leases are refreshed every 3.0s using single-table updates guarded by `EXISTS` subqueries. Evaluating lease validity strictly via `result.rowCount === 0` triggers an immediate, uncatchable `SIGKILL` on the Stockfish child process to guarantee worker fencing.

### 4. Deterministic FIFO Queue with Isolated Row Locking

Jobs are claimed via CTEs that isolate `FOR UPDATE OF j, js SKIP LOCKED` exclusively to inner-joined tables and order strictly by `jca.created_at ASC`, preventing planner failures on nullable sides of outer joins.

### 5. Rigorous Engine Math & Polarity Inversion

- **Perspective Inversion:** $Eval_{\text{played, mover}} = -1 \times Eval(\text{fen\_after})$
- **Continuous Mate Mapping:** $Eval(\text{mate } M) = \pm 10000 \mp (M \times 100)$
- **Catalog-Verified Opening Exclusions:** Authoritative openings are tagged `is_book_move = TRUE` and excluded from ACPL calculations without corrupting raw early-ply blunder evaluations.

### 6. Single-Domain Cookie Topology

Enforces `app.chessiq.com` and `app.chessiq.com/api` via edge reverse proxy rewrites, delivering first-party `SameSite=Lax; Secure; HttpOnly` cookies to eliminate third-party cookie drops on Apple WebKit (Safari iOS/macOS).

---

## 📂 Monorepo Structure

```text
chess_project/
├── .github/workflows/ci.yml       # GitHub Actions CI with PostgreSQL 16 service
├── docker-compose.yml             # Tuned PostgreSQL 16 Alpine container
├── package.json                   # Root NPM Workspaces (server, client)
├── CHESS_IQ_SYSTEM_DESIGN.md      # Master System Architecture Specification
│
├── db/
│   └── migrations/
│       ├── 000_init_extensions.sql       # uuid-ossp, btree_gist, audit & diagnostic
│       ├── 001_master_6nf_schema.sql     # Irreducible 6NF relations, GiST constraints & triggers
│       ├── 002_reconstruction_views_3nf.sql # Lossless 3NF views (v_users, v_games, etc.)
│       ├── 003_sp_ingest_game_analysis_6nf.sql # PL/pgSQL high-performance bulk ingestion
│       ├── 004_stale_job_recovery_sweep.sql # Stale worker recovery sweep & claim invalidation
│       └── 005_seed_chess_openings_catalog.sql # 6NF opening catalog, prefix matching & ACPL exclusion
│
├── server/                        # Backend API Gateway & Engine Worker
│   ├── Dockerfile                 # Multi-stage container with Stockfish NNUE
│   ├── src/
│   │   ├── app.js                 # Express security gateway & /api/health
│   │   ├── index.js               # HTTP entrypoint & graceful teardown
│   │   ├── config/env.js          # Zod runtime environment validator
│   │   ├── db/
│   │   │   ├── pool.js            # pg.Pool singleton & LISTEN client
│   │   │   ├── migrate.js         # SHA-256 verified migration engine
│   │   │   └── openings.js        # Opening catalog matching & ACPL calculation service
│   │   ├── routes/games.js        # Transactional PGN upload & deduplication gateway
│   │   ├── services/pgnParser.js  # PGN parsing, FEN tracking & canonical hashing
│   │   ├── engine/
│   │   │   ├── uciProtocol.js     # UCI protocol text parser & command builders
│   │   │   ├── stockfishWorker.js # Stockfish child process manager & memory isolation
│   │   │   ├── stockfishPool.js   # Bounded concurrency worker pool & crash recovery
│   │   │   └── evalMath.js        # Polarity inversion, continuous mate & mistake tiers
│   │   ├── queue/
│   │   │   ├── jobClaim.js        # Isolated FIFO CTE claim (FOR UPDATE SKIP LOCKED)
│   │   │   ├── heartbeat.js       # Heartbeat watchdog & rowCount === 0 SIGKILL breaker
│   │   │   ├── staleRecovery.js   # Background scheduler for fn_sweep_stale_jobs
│   │   │   └── workerLoop.js      # Reactive LISTEN/NOTIFY event loop & job processor
│   │   └── utils/                 # AppError and Pino structured logger
│   └── tests/
│       ├── health.test.js         # Gateway integration test suite
│       ├── day2-schema.test.js    # 6NF DDL, GiST constraints, and 3NF views suite
│       ├── day3-ingestion.test.js # High-performance batch ingestion suite
│       ├── day4-deduplication.test.js # Canonical move deduplication & PGN ingestion suite
│       ├── day5-stockfish-pool.test.js # Stockfish worker pool & UCI parser suite
│       ├── day6-eval-math.test.js # Engine eval math & polarity inversion suite
│       ├── day7-fifo-queue.test.js # Isolated FIFO queue claim & backoff suite
│       ├── day8-heartbeat-watchdog.test.js # Watchdog heartbeat & SIGKILL breaker suite
│       ├── day9-stale-job-recovery.test.js # Stale job recovery sweep & token invalidation suite
│       ├── day10-openings.test.js # Opening catalog verification & ACPL exclusion suite
│       ├── day11-chessboard.test.js # Interactive Chessboard UI & dynamic board flipping suite
│       └── day12-14-frontend-analytics.test.js # Real-time polling, blunder tiers & radar analytics suite
│
├── client/                        # Frontend Single-Domain Client
│   ├── index.html                 # HTML5 Shell
│   ├── vite.config.js             # Local /api proxy to :5000
│   ├── vercel.json                # Single-domain production edge rewrites
│   └── src/
│       ├── App.jsx                # Live diagnostic telemetry dashboard & analysis interface
│       ├── components/
│       │   ├── InteractiveChessboard.jsx # react-chessboard dynamic flipping & arrows
│       │   ├── AnalysisProgressBar.jsx  # Real-time progress HUD & lease status
│       │   ├── TacticalBlunderTiers.jsx  # 7-tier classification badges & error navigation
│       │   └── LongitudinalRadarChart.jsx # 5-axis SVG Spider/Radar chart & phase ACPL
│       ├── hooks/
│       │   └── useAnalysisPolling.js    # Adaptive interval polling lifecycle hook
│       ├── utils/
│       │   ├── chessAudio.js            # Synthesized Web Audio engine
│       │   └── longitudinalAnalytics.js # Phase partitioning, ACPL & SVG polygon geometry
│       └── api/client.js          # First-party credentials fetch wrapper
│
└── scripts/
    ├── verify-day1.sh             # Automated Day 1 verification & seal script
    ├── verify-day2.sh             # Automated Day 2 6NF DDL & 3NF views seal script
    ├── verify-day3.sh             # Automated Day 3 PL/pgSQL & GiST constraint seal script
    ├── verify-day4.sh             # Automated Day 4 Canonical Deduplication seal script
    ├── verify-day5.sh             # Automated Day 5 Stockfish Pool seal script
    ├── verify-day6.sh             # Automated Day 6 Polarity Inversion & Eval Math seal script
    ├── verify-day7.sh             # Automated Day 7 FIFO Queue Claim CTE seal script
    ├── verify-day8.sh             # Automated Day 8 Heartbeat Watchdog & SIGKILL seal script
    ├── verify-day9.sh             # Automated Day 9 Stale Job Recovery & Scheduler seal script
    ├── verify-day10.sh            # Automated Day 10 Opening Book Catalog seal script
    ├── verify-day11.sh            # Automated Day 11 Interactive Chessboard UI seal script
    └── verify-day12-14.sh         # Automated Day 12-14 Telemetry, Blunder Tiers & Radar Seal Script
```

---

## 🚀 Quickstart & Local Bootstrap

### Prerequisites

- **Node.js**: 20 LTS (`nvm use 20`)
- **Docker**: Docker Desktop or Docker Engine
- **PostgreSQL**: 16.x or 17.x (local or via Docker Compose)

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/AbhijitSaha-coder/chessiq.git
cd chessiq
npm install
```

### 2. Configure Environment

```bash
cp server/.env.example server/.env
```

### 3. Boot PostgreSQL & Run Migrations

```bash
# Start PostgreSQL container (if using Docker)
docker compose up -d postgres

# Run SHA-256 verified migration engine
npm run migrate
```

### 4. Execute Automated Verification

```bash
# Day 1 Baseline Verification
npm run verify:day1

# Day 2 6NF Schema & 3NF Views Verification
npm run verify:day2

# Day 3 Batch Ingestion & GiST Constraints Verification
npm run verify:day3

# Day 4 Canonical Deduplication & PGN Gateway Verification
npm run verify:day4

# Day 5 Stockfish NNUE Worker Pool & Memory Isolation Verification
npm run verify:day5

# Day 6 Engine Evaluation Polarity Inversion & Continuous Mate Math Verification
npm run verify:day6

# Day 7 FIFO Queue Claim CTE & Lifecycle Verification
npm run verify:day7

# Day 8 Heartbeat Watchdog & SIGKILL Circuit Breaker Verification
npm run verify:day8

# Day 9 Stale Job Recovery Sweep & Scheduler Verification
npm run verify:day9

# Day 10 Opening Book Catalog Verification & ACPL Exclusions
npm run verify:day10

# Day 11 Interactive Chessboard UI & Dynamic Board Flipping Verification
npm run verify:day11

# Day 12–14 Real-Time Polling, Blunder Classification & Longitudinal Radar Analytics Verification
npm run verify:day12-14
```

### 5. Launch Full Stack (Server + Client)

```bash
npm run dev
```

- **Frontend Dashboard:** [http://localhost:3000](http://localhost:3000)
- **API Health Telemetry:** [http://localhost:5000/api/health](http://localhost:5000/api/health)

---

## 🗓️ 18-Day Master Development Roadmap

- [x] **Day 1: Industry-Grade Monorepo Baseline, Docker CI/CD, Migration Engine, Express Gateway & Proxy Scaffold**
- [x] **Day 2: 6NF Master Relational DDL Script & 3NF Reconstruction Views (`@DB`)**
- [x] **Day 3: High-Performance PL/pgSQL Ingestion (`sp_ingest_game_analysis_6nf`) & GiST Constraint Verification (`@DB`)**
- [x] **Day 4: Canonical Move Deduplication (`user_game_move_signatures`) & PGN Ingestion Gateway (`@BE`)**
- [x] **Day 5: Stockfish NNUE Child Process Worker Pool & Memory Isolation (`@BE`)**
- [x] **Day 6: Engine Evaluation Polarity Inversion & Continuous Mate Mapping Mathematics (`@BE`)**
- [x] **Day 7: PostgreSQL FIFO Queue Claim CTE (`SKIP LOCKED`) & Reactive `LISTEN/NOTIFY` (`@BE`)**
- [x] **Day 8: Watchdog Heartbeat & `rowCount === 0` `SIGKILL` Circuit Breaker (`@BE`)**
- [x] **Day 9: Stale Job Recovery Sweep (`fn_sweep_stale_jobs`) & Fencing Token Management (`@BE`)**
- [x] **Day 10: Opening Book Catalog Verification (`chess_openings`) & ACPL Exclusions (`@DB` / `@BE`)**
- [x] **Day 11: Interactive Chessboard UI (`react-chessboard`) & Dynamic Board Flipping (`@FE`)**
- [x] **Day 12: Real-Time Analysis Polling & Longitudinal Progress Indicators (`@FE`)**
- [x] **Day 13: Tactical Blunder Classification Tiers & Move Evaluation Navigation (`@FE`)**
- [x] **Day 14: Longitudinal Analytics Dashboard & Phase-Based CPL Radar Visualizations (`@FE`)**
- [ ] **Day 15:** Personalized Training Puzzle Generator (`v_training_puzzles`) (`@DB` / `@FE`)
- [ ] **Day 16:** Single-Domain Authentication & First-Party Cookie Integration (`@BE` / `@FE`)
- [ ] **Day 17:** End-to-End Concurrency & Fault-Injection Stress Testing (Chaos Verification)
- [ ] **Day 18:** Production Cloud Deployment (Vercel Edge + Render + Neon Serverless) & Final Seal

---

## 📄 License

ChessIQ v3.3.0 is a proprietary engineering project designed and developed by **Abhijit Saha**, **Jaidev Basandrai**, and **Bibhukesh Medhi**. All rights reserved.
