# Design: Mapping to Zapier Asset Management Roadmap

This document explains how **Zap Asset Graph** aligns with and supports Zapier’s Asset Management / governance roadmap for enterprise accounts.

---

## 1. Asset inventory and visibility

**Roadmap goal:** Give admins a single view of automations (Zaps) and their dependencies (Connections, apps).

**How this app maps:**

- **Asset model** — Every Zap and Connection is an **Asset** with type (`zap` | `connection`), status, owner, workspace, and optional Zapier IDs/URLs. The graph canvas is that “single view”: connections on the left, zaps on the right, edges showing “Zap uses Connection.”
- **Import path** — Today we import from exported JSON; the same model and UI are intended to be backed by **Zapier Partner API v2** (e.g. `GET /v2/zaps`, connections) when credentials exist. The app stays an inventory and visualization layer; the data source is swappable.

---

## 2. Impact and blast radius (“What breaks if we disconnect X?”)

**Roadmap goal:** Before disconnecting an app or changing permissions, answer “Which Zaps are affected?”

**How this app maps:**

- **Migration Simulator** — Dropdown of Connection-type assets; on select we call `/api/assets/:id/blast-radius` and highlight all impacted Zaps in red, with a banner: “Disconnecting {app} would impact {N} zaps across {workspaces}.” This is the main demo for “what breaks if we disconnect Google Sheets?”
- **Blast-radius API** — BFS from the chosen asset (e.g. a Connection) over the dependency graph (who depends on this asset). Returns root asset, impacted list, impact edges, count, severity, and a human-readable message. Same endpoint powers node-click impact in the sidebar.
- **Production evolution** — Today we compute on demand; at scale, Asset Management could pre-compute or cache blast-radius per Connection and expose it via API or in Zapier’s own UI.

---

## 3. Governance and health

**Roadmap goal:** Identify orphaned automations, unhealthy or paused Zaps, and structural risks (e.g. single points of failure, circular dependencies).

**How this app maps:**

- **Health report** (`GET /api/health/report`) — Implements a governance “scan”:
  - **Orphaned assets** — No owner set.
  - **Paused / disabled** — Zaps or connections not active.
  - **Circular dependencies** — DFS cycle detection on the dependency graph.
  - **Single points of failure** — Assets with 3+ dependents (many Zaps rely on one Connection).
  - **Per-workspace stats** — Counts by workspace.
  - **Health score (0–100)** — Single metric derived from the above; shown in the Health Panel with green / yellow / red bands.
- **Health Panel UI** — Big score, issue breakdown, per-workspace table, and list of SPOF assets with dependent counts. Fits into a broader “Governance dashboard” story.

---

## 4. Ownership and audit

**Roadmap goal:** Assign and transfer ownership; keep an audit trail of changes.

**How this app maps:**

- **Ownership** — Asset has optional `owner`; sidebar shows “No owner” when null and supports **Transfer ownership** (new owner + actor). `POST /api/assets/:id/transfer` updates the asset and appends an **AuditLog** entry (action, actor, details).
- **Audit log** — `AuditLog` model and `GET /api/audit` provide a filterable timeline (asset, action, actor, timestamp). Supports “who did what” for governance and compliance.

---

## 5. Summary table

| Roadmap area | This app’s implementation | Possible next steps (Zapier side) |
|--------------|---------------------------|-----------------------------------|
| Asset inventory | Graph of Zaps + Connections from export/API | Partner API v2 as source; same graph concepts in Zapier UI |
| Blast radius | Migration Simulator + BFS API | Pre-computed impact, “Disconnect app” wizard using impact data |
| Governance health | Health report + Health Panel | Native governance dashboard, alerts on orphans/SPOF/circles |
| Ownership & audit | Owner field, transfer endpoint, AuditLog | SSO/OAuth, role-based visibility, export for compliance |

---

## 6. Technical alignment

- **Data shape** — Export JSON and API responses are structured to align with **Zapier Partner API v2** (zaps with steps, links, connections). This keeps the path to “live” data straightforward.
- **Concepts** — Zaps, Connections, workspaces (folders), trigger/action apps, and dependency edges match how Zapier models automations and their dependencies, so the same ideas can be reused in Zapier’s own Asset Management roadmap (APIs, UI, and policies).
