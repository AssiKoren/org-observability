Org Observability — MVP

Purpose
- Local, self-hosted observability system for the internal AI organization.
- Browser UI with Kanban + Org Chart + Activity Feed.

Quick goals
1. Provide real-time visibility into tasks, delegation, communication summaries, and org hierarchy.
2. Simple startup: one command to start backend + frontend (docker-compose or npm script).
3. Local-only. No external cloud dependencies.

Planned tech stack (MVP):
- Backend: Node.js + Express + SQLite (simple, file-based persistence)
- Frontend: React (Vite) served by backend or dev server
- API: REST endpoints for tasks, employees, events
- Persistence: SQLite with simple migrations
- Auth: none for MVP (localhost only)

First steps / bootstrap files created by Assi:
- Project scaffold path: /home/assi/.openclaw/workspace/org-observability
- Next: create team definitions, task breakdown, and start implementation.
