# Task Deliverables Policy

## Core Principle
**Every task output MUST be a deliverable. All work flows through the Kanban.**

### ⚠️ CRITICAL: Kanban is the Single Source of Truth
**ALL communication MUST be reflected in the Kanban board.**
- No private messages
- No side conversations
- No off-channel discussions
- Every message, update, or question → goes in the Kanban conversation

### What This Means
- No task is "complete" until there's a tangible output
- All communication happens in the Kanban
- Output = file, document, code, report, message, or artifact
- Each deliverable must be traceable back to the original Kanban task

## Work-First Policy
**Agents ONLY discuss Kanban tasks.**
- No casual conversation
- No off-topic discussions
- Stay focused on assigned tasks
- All updates go through the Kanban

## Examples

| Task Type | Deliverable |
|-----------|-------------|
| Code change | File created/modified with PR/merge |
| Research | Summary document with findings & sources |
| API integration | Working endpoint + test results |
| Documentation | Updated docs file |
| Agent task | Result file in outbox + Kanban update |

## Deliverable Checklist
For every task, the agent must produce:
- [ ] Final output (file, message, or artifact)
- [ ] Status update to appropriate channel
- [ ] Link to original task/requirement
- [ ] Time spent (for tracking)

## Implementation
Agents must include in their output:
```
=== DELIVERABLE ===
Type: [file|message|code|report|other]
Title: [clear title]
Artifact: [path or reference]
Status: [complete|pending]
=== END DELIVERABLE ===
```

## Example
```
=== DELIVERABLE ===
Type: file
Title: API Documentation Update
Artifact: /home/assi/.openclaw/workspace/org-observability/backend/API.md
Status: complete
=== END DELIVERABLE ===
```

---

*Policy: 2026-02-10*
*Enforcement: All agents including Assi*
