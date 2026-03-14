# Zap Asset Graph

A **governance layer for enterprise Zapier accounts**: visualize Zaps and Connections as a graph, run blast-radius and migration simulations, and scan for governance health (orphans, single points of failure, circular dependencies).

## Project description

Zap Asset Graph helps teams answer:

- **What breaks if we disconnect an app?** — Migration Simulator shows which Zaps are impacted when a Connection (e.g. Google Sheets) is removed.
- **Who owns what?** — Track ownership, transfer it, and spot orphaned assets.
- **Where are the risks?** — Health report surfaces paused/disabled Zaps, circular dependencies, and single points of failure.

The app reads from **exported Zapier data** (e.g. `backend/data/zapier-export.json`) and is **designed to swap in the Zapier Partner API v2** when credentials are available.

---

## Architecture

| Layer | Stack | Role |
|-------|--------|------|
| **Backend API** | Node.js, Express, TypeScript, Prisma, SQLite | Serves assets, blast-radius, health report, audit log, ownership transfer. Runs on port 3001. |
| **Frontend** | React, TypeScript, Vite, Tailwind CSS v4, React Flow (@xyflow/react) | Graph canvas (nodes = assets, edges = dependencies), sidebar, Migration Simulator, Health Panel. Proxies `/api` to backend. |

- **Monorepo**: `backend/` and `frontend/` with root `package.json` scripts to run both.
- **Data flow**: Frontend calls `/api/assets`, `/api/assets/:id/blast-radius`, `/api/health/report`, etc. Backend reads from SQLite (seeded via import from the export JSON).

---

## Design decisions & tradeoffs

| Area | POC choice | Production-scale alternative | Rationale |
|------|------------|------------------------------|-----------|
| **Database** | SQLite (file) | PostgreSQL (or managed DB) | SQLite is zero-config and fine for single-instance demos; Postgres for scale, backups, and multi-instance. |
| **Blast radius** | BFS on demand per request | Pre-computed dependency graph / materialized view | On-demand BFS is simple and correct for small graphs; pre-computation or cached traversal wins at scale. |
| **Data source** | Static JSON import | Zapier Partner API v2 (OAuth) | Export file proves the model and UI; API swap is the path to live data. |
| **Auth** | None | API keys, OAuth, or SSO | POC assumes trusted network; production needs auth and scoped access. |
| **Deployment** | Single process | Backend + frontend on CDN, DB as service | Current setup runs backend (e.g. on Render) and static frontend; scale by separating and adding CDN/DB. |

---

## How I built this with AI

- **Scaffolding**: Monorepo layout, Express + Prisma + React + Vite + Tailwind + React Flow was set up with AI assistance (file structure, configs, scripts).
- **Domain modeling**: Prisma schema (Asset, Dependency, AuditLog) and import script from Zapier-style JSON were designed with AI, then adjusted for API shape and relationships.
- **API design**: REST endpoints (assets list/filters, blast-radius, health report, transfer, audit) were implemented with AI-generated route handlers and error handling.
- **Frontend**: React Flow graph, custom AssetNode, layout (connections left / zaps right), Migration Simulator dropdown, sidebar (details, blast radius, transfer form), and Health Panel were built iteratively with AI (components, state, and styling).
- **Docs and ops**: README and DESIGN.md for backend were written with AI to capture architecture, tradeoffs, and deployment.

Human review was used for data shapes, UX copy, and consistency with Zapier concepts (Zaps, Connections, workspaces).

---

## Setup

### Prerequisites

- Node.js 18+
- npm (or pnpm/yarn with workspace support)

### Install and run

```bash
# From repo root
npm install

# Generate Prisma client and run migrations
npm run db:push --workspace=backend

# Seed from export file (optional)
npm run import --workspace=backend

# Run backend and frontend together
npm run dev
```

- **Backend**: http://localhost:3001  
- **Frontend**: http://localhost:5173 (Vite); `/api` is proxied to the backend.

### Run separately

```bash
npm run dev:backend   # backend only (port 3001)
npm run dev:frontend  # frontend only (port 5173, needs backend for API)
```

### Build

```bash
npm run build              # both workspaces
npm run build:backend       # backend only
npm run build:frontend      # frontend only
```

### Backend on Render (Docker)

From the repo root:

The backend reads `PORT` from the environment (Render sets this). SQLite data is stored in the container; for persistence, mount a volume at the path used by your `DATABASE_URL` or run the import step in a one-off job.

---

## Data note

The app **currently reads from exported data** (e.g. `backend/data/zapier-export.json`). It is **designed to swap in the Zapier Partner API v2** when credentials are available, with the same graph, blast-radius, and health concepts applied to live account data.
