Troubleshooting & Escalation Policy

Purpose: avoid wasted time in retry loops and escalate efficiently.

Policy:
1. Retry limit: If a task (build/retry/troubleshoot) exceeds 100 attempts without progress, stop and escalate.
2. Escalation: The developer must notify Mira (Team Leader) and request a quick brainstorm session (video or chat) to unblock. Include logs and attempted steps.
3. Brainstorm session: scheduled within the same work window (max 2 hours) to identify alternative approaches.
4. If a workaround requires changing core tooling or versions, Mira will decide with Assi's oversight.
5. Record the outcome and action in project tasks and memory.

Consultation Privilege:
- If Mira determines the team is stuck after the brainstorm, she is authorized to perform one (1) inference/query with the model `openai/gpt-5.2-pro` to consult for technical guidance or design alternatives. This is a one-time, scoped consultation per incident and must be documented (prompt, response, decision).

Implementation:
- Developers: track retry attempts and maintain a short troubleshooting log in the task comments.
- Mira: schedule and moderate brainstorms; update TASKS.md with chosen path. If she uses the GPT consultation, she records the prompt and summary in the task.

Recorded: 2026-02-09
