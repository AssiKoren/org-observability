Proposed Architecture (MVP)

Overview
- Single-node local web application with backend API + frontend UI.
- Backend provides REST API, persistence, and serves frontend static build.

Components
1) Backend (Node.js + Express)
   - Endpoints: /employees, /tasks, /events, /org
   - SQLite database (file: data/org.db)
   - Simple in-process job queue for events and summaries
   - WebSocket (socket.io) for real-time updates to frontend

2) Frontend (React + Vite)
   - Views: Kanban, Org Chart, Activity Feed, Employee Status, CEO Dashboard
   - Connects via REST + WebSocket for live updates

3) Persistence
   - SQLite with migrations (knex.js) or simple SQL files
   - Tables: employees, tasks, events, delegations, messages

4) Local deployment
   - Start with npm scripts: npm run start (dev) and npm run serve (prod)
   - Optional: docker-compose for single-command deployment

Why these choices
- SQLite: zero-config, file-backed, local-only persistence
- Node/React: quick to prototype, wide familiarity, good ecosystem
- WebSocket: real-time UI updates for activity and task changes

Security
- Local only (bind to 127.0.0.1)
- No external dependencies for MVP

Next: break work into tasks and assign to team members.
