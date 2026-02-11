# Phase 2: Agent Communication & Performance Optimization

## Communication Hierarchy

```
┌─────────────────────────────────────────────────────────┐
│                     ASSI (Executive)                      │
│           All communication flows through Mira            │
└─────────────────────┬───────────────────────────────────┘
                      │
        ┌─────────────┴─────────────┐
        │                           │
        ▼                           ▼
┌───────────────┐         ┌───────────────────┐
│  MIRA (EM)    │         │    EROS (Romantic)│
│  Team Leader  │         │  Direct channel    │
│  - All tools  │         │  - Romantic tools  │
│  - Reports to │         └───────────────────┘
│    Assi only  │
└───────┬───────┘
        │
        │ Team reports to Mira only
        ▼
┌─────────────────────────────────────────────────────────┐
│  Daniel (Backend)    │  Lior (Frontend)  │  Rina (DevOps)│
│  - Backend tools     │  - Front tools   │  - Infra tools │
│  - Reports to Mira   │  - Reports to M  │  - Reports to M│
└─────────────────────────────────────────────────────────┘
```

**Rules:**
1. Daniel, Lior, Rina → communicate with Mira only
2. Mira → communicates with Assi only
3. Eros → direct channel with Assi (romantic tasks)
4. No direct communication between developers and Assi

## Per-Agent Tool Access

### Mira (Engineering Manager)
**Access: ALL**
- All CLI tools (git, docker, curl, jq, etc.)
- All OpenClaw capabilities
- All agent communication channels
- SearxNG (web search)

### Daniel (Backend Developer)
**Access: Backend + Git**
- git, node/npm, python
- docker (for local testing)
- curl, jq (API testing)
- Code editors/tools
- NO: frontend tools, devops automation

### Lior (Frontend Developer)
**Access: Frontend + UI**
- node/npm, git
- vite, react tools
- curl (API testing)
- Browser/dev tools
- NO: docker management, backend infrastructure

### Rina (DevOps)
**Access: Infrastructure + Docker**
- docker, docker-compose
- systemd, cron
- curl, jq (monitoring)
- git
- NO: code editing tools

### Eros (Romantic Agent)
**Access: Romantic + Communication**
- Special romantic task tools
- Direct message capabilities
- NO: technical/devops tools

## Shared Tools
These are available to ALL agents:
- `curl` - HTTP requests
- `jq` - JSON processing
- `git` - version control
- `SearxNG` - web search (local)

## Performance Optimization

### Token Reduction Strategies

#### 1. Context Limiting
```
Per-agent context limits:
- Daniel: 8K tokens (backend tasks are simpler)
- Lior: 10K tokens (UI can be verbose)
- Rina: 8K tokens (infra tasks focused)
- Mira: 20K tokens (manager needs broader view)
- Eros: 6K tokens (romantic tasks simple)
```

#### 2. Tool Result Truncation
```javascript
// Example: Truncate long tool outputs
function truncateToolResult(result, maxTokens = 500) {
  const tokens = result.split(/\s+/);
  if (tokens.length > maxTokens) {
    return tokens.slice(0, maxTokens).join(' ') + ' [...truncated]';
  }
  return result;
}
```

#### 3. Selective Memory Access
- Each agent sees only relevant memory files
- Daniel → memory/backend/, memory/dev/
- Lior → memory/frontend/, memory/ui/
- Rina → memory/infra/, memory/devops/
- Mira → all memory (manager)

#### 4. Message Filtering
- Developers don't see system administration messages
- DevOps don't see UI design discussions
- Only relevant context per agent

### Implementation Commands

#### Update Agent Tool Policy (example for Daniel)
```bash
openclaw agents update daniel \
  --max-context-tokens 8000 \
  --allowed-tools git,node,npm,python,docker,curl,jq \
  --memory-paths memory/backend,memory/dev
```

#### Update Communication Rules
```bash
openclaw agents update daniel \
  --can-message mira \
  --can-message eros \
  --cannot-message assi
```

## Rollout Plan

### Step 1: Document Current State
- [x] TEAM.md updated
- [x] Communication hierarchy documented
- [x] Per-agent tools defined
- [x] SOUL.md files updated for all agents
- [x] Memory directories created per domain

### Step 2: Apply OpenClaw Configuration
- [ ] Update Daniel configuration (CLI or config file)
- [ ] Update Lior configuration
- [ ] Update Rina configuration
- [ ] Update Mira configuration (all access)
- [ ] Update Eros configuration

### Step 3: Performance Tuning
- [ ] Set per-agent context limits (via OpenClaw config)
- [ ] Configure memory path restrictions
- [ ] Enable message filtering
- [ ] Test communication flow

### Step 4: Verify
- [ ] Run test-system.sh
- [ ] Verify communication hierarchy
- [ ] Verify tool restrictions
- [ ] Measure token usage improvement

## Success Metrics

| Metric | Target | Current |
|--------|--------|---------|
| Avg tokens/agent/task | -30% | baseline |
| Mira as communication hub | 100% | 0% |
| Tool scope compliance | 100% | N/A |
| Agent response time | -20% | baseline |

## Restarting Agents with New Configuration

After updating SOUL.md files, restart agents to pick up changes:

```bash
# Restart all agents
sudo docker restart agent-mira daniel lior rina eros

# Verify agents are running
sudo docker ps | grep -E "agent|daniel|lior|rina|eros"
```

## Testing Communication Hierarchy

```bash
# Test 1: Daniel should not message Assi directly
# Daniel's SOUL.md says he reports to Mira only

# Test 2: Mira should aggregate team updates
# Mira consolidates before reporting to Assi

# Test 3: Verify with test-system.sh
./test-system.sh
```

## Next Actions

1. Apply OpenClaw agent configurations (if CLI supports)
2. Restart all agents with new SOUL.md files
3. Test communication flow (Daniel → Mira → Assi)
4. Measure and optimize token usage
5. Document performance improvements

---

*Phase 2 initiated: 2026-02-10*
