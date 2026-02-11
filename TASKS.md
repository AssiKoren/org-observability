Initial Task Breakdown (MVP)

Milestone: MVP running locally with basic Kanban, Org Chart, Activity Feed (Day 1 — Day 3)

1) Project bootstrap (Assignee: Mira) - Est: 0.5d
   - Create repository scaffold
   - Initialize package.json, linting, dev scripts
   - Create SQLite data folder and basic schema files

2) Backend skeleton (Assignee: Daniel) - Est: 1d
   - Express app, REST endpoints: /employees, /tasks, /events
   - SQLite integration (knex or better-sqlite3)
   - Seed initial data with named employees (Assi, CEO=Assaf, team members)
   - WebSocket (socket.io) basic broadcast on changes

3) Frontend skeleton (Assignee: Lior) - Est: 1d
   - Vite + React app, routing, basic UI layout
   - Kanban component placeholder, Org Chart placeholder, Activity Feed placeholder
   - Connect to backend endpoints and display seeded data

4) Local deployment & startup (Assignee: Rina) - Est: 0.5d
   - Provide npm run start script and optional docker-compose
   - systemd unit to start service on boot (localhost only)

5) Task features (Assignees: Daniel + Lior) - Est: 1.5d
   - Kanban: columns Backlog/Assigned/In Progress/Blocked/Done
   - Task CRUD + assignment to named employees
   - Task state changes emit events to Activity Feed

6) Org Chart & Employee status (Assignee: Lior) - Est: 0.5d
   - Tree view of hierarchy with active/idle status
   - Employee detail panel: current task, last update, blocked state

7) Activity & Communication summaries (Assignee: Daniel) - Est: 1d
   - Store events: delegations, state changes, messages (summaries only)
   - Simple summarizer (rule-based) for message threads

8) QA, polish, and demo (All, led by Mira) - Est: 0.5d
   - End-to-end test, fix issues, UX polish
   - Prepare demo instructions for Assaf

Total MVP estimate: ~6 days (can be compressed by parallel work). Deliverable: working local web app at http://127.0.0.1:PORT with README and startup script.

Next: start implementation. I (Assi) will act as product owner and integrator. Team Leader (Mira) will report progress to me daily.
