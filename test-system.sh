#!/bin/bash
#
# org-observability Complete System Test Suite
# Tests: Agents, Kanban Backend, Frontend, Inter-Agent Communication, API
#
# IMPORTANT: All test tasks must have MEANINGFUL titles!
# - DO NOT use: "E2E 12345", "TEST task", "demo task"
# - USE: "Conversation feature test", "Task lifecycle verification", etc.
#
# Usage: ./test-system.sh [--quick] [--verbose]
#   --quick   : Run only critical tests
#   --verbose : Show detailed output
#
# Exit codes: 0 = all pass, 1 = some failures, 2 = critical error

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; CYAN='\033[0;36m'; MAGENTA='\033[0;35m'; NC='\033[0m'
PASSED=0; FAILED=0; WARNINGS=0; SKIPPED=0; VERBOSE=false

while [[ $# -gt 0 ]]; do [[ "$1" == "--verbose" ]] && VERBOSE=true && shift; done

log_pass() { echo -e "${GREEN}[PASS]${NC} $1"; PASSED=$((PASSED+1)); }
log_fail() { echo -e "${RED}[FAIL]${NC} $1"; FAILED=$((FAILED+1)); }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; WARNINGS=$((WARNINGS+1)); }
log_subtest() { echo -e "  ${CYAN}▶${NC} $1"; }
log_section() { echo ""; echo -e "${MAGENTA}══════════════════════════════════════════════════════════════${NC}"; echo -e "${MAGENTA}  $1${NC}"; echo -e "${MAGENTA}══════════════════════════════════════════════════════════════${NC}"; echo ""; }

cleanup() { for task_id in $(curl -sS http://127.0.0.1:3001/api/tasks 2>/dev/null | python3 -c "import sys,json; [print(t['id']) for t in json.load(sys.stdin) if 'TEST' in t.get('title','')]" 2>/dev/null); do curl -sS -X DELETE "http://127.0.0.1:3001/api/tasks/$task_id" >/dev/null 2>&1 || true; done; }
trap cleanup EXIT

test_prerequisites() {
    log_section "SECTION 1: System Prerequisites"
    log_subtest "Node.js"; command -v node &>/dev/null && log_pass "Node.js: $(node --version)" || log_fail "Node.js not installed"
    log_subtest "npm"; command -v npm &>/dev/null && log_pass "npm: $(npm --version)" || log_fail "npm not installed"
    log_subtest "Python3"; command -v python3 &>/dev/null && log_pass "Python3 installed" || log_fail "Python3 not installed"
    log_subtest "jq"; command -v jq &>/dev/null && log_pass "jq installed" || log_warn "jq not installed on host (installed in containers)"
    log_subtest "curl"; command -v curl &>/dev/null && log_pass "curl installed" || log_fail "curl not installed"
    log_subtest "Docker"; command -v docker &>/dev/null && log_pass "Docker: $(docker --version 2>/dev/null | head -1)" || log_fail "Docker not installed"
    docker info &>/dev/null && log_pass "Docker daemon running" || log_fail "Docker daemon not running"
}

test_docker_containers() {
    log_section "SECTION 2: Docker Containers"
    for agent in agent-mira daniel lior rina eros; do
        local status=$(sudo docker inspect -f '{{.State.Status}}' "$agent" 2>/dev/null || echo "missing")
        [ "$status" = "running" ] && log_pass "$agent running" || log_fail "$agent NOT running (status: $status)"
    done
    local s=$(sudo docker inspect -f '{{.State.Status}}' searxng 2>/dev/null || echo "missing")
    [ "$s" = "running" ] && log_pass "SearxNG running" || log_warn "SearxNG NOT running"
}

test_kanban_api() {
    log_section "SECTION 3: Kanban Backend API"
    local code=$(curl -sS -o /dev/null -w "%{http_code}" http://127.0.0.1:3001/api/tasks 2>/dev/null || echo "000")
    [ "$code" = "200" ] && log_pass "Backend :3001 responding" || { log_fail "Backend NOT responding (HTTP $code)"; return 1; }
    
    local tasks=$(curl -sS http://127.0.0.1:3001/api/tasks)
    echo "$tasks" | python3 -m json.tool >/dev/null 2>&1 && log_pass "GET /api/tasks OK ($(echo "$tasks" | python3 -c 'import sys,json; print(len(json.load(sys.stdin)))') tasks)" || log_fail "Invalid JSON"
    
    local create=$(curl -sS -X POST http://127.0.0.1:3001/api/tasks -H 'Content-Type: application/json' -d '{"title":"TEST DELETE ME","description":"test","assignee":"mira","status":"Backlog","created_by":"test"}')
    if echo "$create" | python3 -c "import sys,json; json.load(sys.stdin)" 2>/dev/null; then
        TEST_ID=$(echo "$create" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("id",""))')
        log_pass "POST /api/tasks OK (ID: $TEST_ID)"
    else
        log_fail "POST failed"; TEST_ID=""
    fi
    
    if [ -n "$TEST_ID" ]; then
        local p1=$(curl -sS -X PATCH "http://127.0.0.1:3001/api/tasks/$TEST_ID" -H 'Content-Type: application/json' -d '{"status":"In Progress"}')
        echo "$p1" | python3 -c "import sys,json; t=json.load(sys.stdin); assert t.get('status')=='In Progress'" 2>/dev/null && log_pass "PATCH → In Progress" || log_fail "PATCH failed"
        
        local p2=$(curl -sS -X PATCH "http://127.0.0.1:3001/api/tasks/$TEST_ID" -H 'Content-Type: application/json' -d '{"status":"Done"}')
        echo "$p2" | python3 -c "import sys,json; t=json.load(sys.stdin); assert t.get('status')=='Done'" 2>/dev/null && log_pass "PATCH → Done" || log_fail "PATCH → Done failed"
        
        local d=$(curl -sS -o /dev/null -w "%{http_code}" -X DELETE "http://127.0.0.1:3001/api/tasks/$TEST_ID")
        [ "$d" = "200" ] && log_pass "DELETE OK" || log_fail "DELETE failed"
    fi
    
    local e=$(curl -sS -o /dev/null -w "%{http_code}" -X PATCH "http://127.0.0.1:3001/api/tasks/invalid-id" 2>/dev/null)
    [ "$e" = "404" ] && log_pass "Invalid ID → 404" || log_warn "Invalid ID → HTTP $e"
    
    local errs=$(grep -cE "Error|error|ERROR|Failed|failed" /home/assi/.openclaw/workspace/org-observability/backend.log 2>/dev/null || echo "0")
    [ "$errs" = "0" ] && log_pass "No backend errors" || log_warn "$errs errors in backend log"
}

test_agent_dirs() {
    log_section "SECTION 4: Agent Directories"
    for agent in mira daniel lior rina eros; do
        log_subtest "$agent"
        [ -d "/home/assi/.openclaw/agents/$agent/workspace/inbox" ] && log_pass "$agent inbox" || log_fail "$agent inbox MISSING"
        [ -d "/home/assi/.openclaw/agents/$agent/workspace/outbox" ] && log_pass "$agent outbox" || log_fail "$agent outbox MISSING"
    done
}

test_agent_runners() {
    log_section "SECTION 5: Agent Runners"
    for agent in agent-mira daniel lior rina eros; do
        log_subtest "$agent"
        local pid=$(sudo docker inspect -f '{{.State.Pid}}' "$agent" 2>/dev/null || echo "0")
        [ "$pid" != "0" ] && log_pass "$agent active (PID: $pid)" || log_fail "$agent not found"
        sudo docker exec "$agent" which curl &>/dev/null && log_pass "$agent has curl" || log_fail "$agent missing curl"
        sudo docker exec "$agent" which jq &>/dev/null && log_pass "$agent has jq" || log_fail "$agent missing jq"
    done
    sudo docker exec daniel echo "pong" &>/dev/null && log_pass "daniel responsive" || log_fail "daniel not responsive"
}

test_inter_agent_e2e() {
    log_section "SECTION 6: Inter-Agent E2E"
    log_subtest "Creating inbox task"
    local ts=$(date +%s)
    # Use MEANINGFUL title for test task - created by assi (NOT system)
    local resp=$(curl -sS -X POST http://127.0.0.1:3001/api/inbox/daniel -H 'Content-Type: application/json' -d "{\"title\":\"System health verification test - $ts\",\"command\":\"echo System verification test completed successfully\",\"description\":\"Automated system test to verify agent responsiveness\",\"status\":\"Backlog\",\"created_by\":\"assi\"}")
    
    if echo "$resp" | python3 -c "import sys,json; json.load(sys.stdin)" 2>/dev/null; then
        E2E_ID=$(echo "$resp" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("task",{}).get("id",""))')
        log_pass "Task created (ID: $E2E_ID)"
        sleep 2
        
        [ -f "/home/assi/.openclaw/agents/daniel/workspace/inbox/$E2E_ID.json" ] && log_pass "File in inbox" || log_fail "File NOT in inbox"
        
        log_subtest "Waiting for agent (60s)"
        local w=0 done=false
        while [ $w -lt 60 ]; do
            [ -f "/home/assi/.openclaw/agents/daniel/workspace/outbox/$E2E_ID.result.json" ] && { done=true; break; }
            sleep 5; w=$((w+5)); echo -n "."
        done
        echo ""
        [ "$done" = true ] && log_pass "Agent processed (${w}s)" || log_fail "Agent did NOT process"
        
        if [ "$done" = true ]; then
            grep -q "E2E $ts" "/home/assi/.openclaw/agents/daniel/workspace/outbox/$E2E_ID.result.json" && log_pass "Result verified" || log_warn "Result unexpected"
            local rp=$(curl -sS -X POST "http://127.0.0.1:3001/api/result/daniel" -H 'Content-Type: application/json' -d "{\"task_id\":\"$E2E_ID\",\"output\":\"ok\"}")
            echo "$rp" | grep -q "success" && log_pass "Result posted to Kanban" || log_warn "Result post issue"
        fi
    else
        log_fail "Failed to create inbox task"
    fi
}

test_frontend() {
    log_section "SECTION 7: Frontend"
    local c=$(curl -sS -o /dev/null -w "%{http_code}" http://localhost:5173/ 2>/dev/null || echo "000")
    [ "$c" = "200" ] && log_pass "Frontend :5173 OK" || log_fail "Frontend NOT responding (HTTP $c)"
    [ -f "/home/assi/.openclaw/workspace/org-observability/frontend/src/main.jsx" ] && log_pass "main.jsx exists" || log_fail "main.jsx missing"
    grep -q "socket.io-client" /home/assi/.openclaw/workspace/org-observability/frontend/src/main.jsx && log_pass "socket.io-client imported" || log_warn "socket.io-client missing"
    grep -q "axios" /home/assi/.openclaw/workspace/org-observability/frontend/src/main.jsx && log_pass "axios imported" || log_warn "axios missing"
    [ -d "/home/assi/.openclaw/workspace/org-observability/frontend/node_modules" ] && log_pass "node_modules exists" || log_fail "node_modules missing"
}

test_searxng() {
    log_section "SECTION 8: SearxNG"
    local c=$(curl -sS -o /dev/null -w "%{http_code}" http://127.0.0.1:8888/ 2>/dev/null || echo "000")
    [ "$c" = "200" ] && log_pass "SearxNG :8888 OK" || log_warn "SearxNG NOT responding (HTTP $c)"
    [ -f "/home/assi/.openclaw/workspace/searxng_client_config.json" ] && log_pass "Config exists" || log_warn "Config missing"
}

test_kanban_enhancements() {
    log_section "SECTION 9: Kanban Enhancements (org1)"
    
    # Test 1: Frontend Add Task button exists
    log_subtest "Add Task button in code"
    grep -q 'addBtn' /home/assi/.openclaw/workspace/org-observability/frontend/src/App.jsx && log_pass "Add Task button defined" || log_fail "Add Task button NOT found"
    
    # Test 2: Single description field
    log_subtest "Single description field"
    grep -q 'newTaskForm.description' /home/assi/.openclaw/workspace/org-observability/frontend/src/App.jsx && log_pass "Description field exists" || log_fail "Description field NOT found"
    
    # Test 3: org1 naming
    log_subtest "org1 naming"
    grep -q "org1" /home/assi/.openclaw/workspace/org-observability/frontend/src/App.jsx && log_pass "org1 naming in App.jsx" || log_warn "org1 NOT found in App.jsx"
    grep -q "<title>org1" /home/assi/.openclaw/workspace/org-observability/frontend/index.html && log_pass "org1 in index.html title" || log_warn "org1 NOT in index.html"
    
    # Test 4: 30% column width
    log_subtest "30% column width"
    grep -q "width: '30%'" /home/assi/.openclaw/workspace/org-observability/frontend/src/App.jsx && log_pass "30% column width configured" || log_fail "30% column width NOT found"
    
    # Test 5: Conversation endpoint exists
    log_subtest "Conversation API endpoint"
    grep -q "/conversation" /home/assi/.openclaw/workspace/org-observability/backend/index.js && log_pass "Conversation endpoint in backend" || log_fail "Conversation endpoint NOT found"
    
    # Test 6: Task with conversation
    log_subtest "Task with conversation"
    local ts=$(date +%s)
    # Use MEANINGFUL title - created by assi
    local life_resp=$(curl -sS -X POST http://localhost:3001/api/tasks -H 'Content-Type: application/json' -d "{\"title\":\"Conversation feature test - $ts\",\"description\":\"Testing the conversation endpoint functionality\",\"assignee\":\"assi\",\"status\":\"Backlog\",\"created_by\":\"assi\"}" 2>/dev/null)
    if echo "$life_resp" | python3 -c "import sys,json; json.load(sys.stdin)" 2>/dev/null; then
        local life_id=$(echo "$life_resp" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("id",""))' 2>/dev/null)
        
        # Add conversation
        curl -sS -X POST "http://localhost:3001/api/tasks/$life_id/conversation" -H 'Content-Type: application/json' -d '{"author":"test","message":"Testing conversation endpoint functionality"}' >/dev/null 2>&1
        
        # Check conversation exists
        local conv_check=$(curl -sS "http://localhost:3001/api/tasks/$life_id/conversation" 2>/dev/null)
        echo "$conv_check" | python3 -c "import sys,json; d=json.load(sys.stdin); assert 'messages' in d" 2>/dev/null && log_pass "Conversation API working" || log_warn "Conversation API issue"
        
        # Cleanup
        curl -sS -X DELETE "http://localhost:3001/api/tasks/$life_id" >/dev/null 2>&1
    else
        log_warn "Could not test conversation"
    fi
    
    # Test 7: Task lifecycle (create → move → done)
    log_subtest "Task lifecycle"
    local ts=$(date +%s)
    # Use MEANINGFUL title - created by assi
    local life_resp=$(curl -sS -X POST http://localhost:3001/api/tasks -H 'Content-Type: application/json' -d "{\"title\":\"Task lifecycle verification - $ts\",\"description\":\"Automated test for task status transitions\",\"assignee\":\"assi\",\"status\":\"Backlog\",\"created_by\":\"assi\"}" 2>/dev/null)
    if echo "$life_resp" | python3 -c "import sys,json; json.load(sys.stdin)" 2>/dev/null; then
        local life_id=$(echo "$life_resp" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("id",""))' 2>/dev/null)
        
        # Move to In Progress
        curl -sS -X PATCH "http://localhost:3001/api/tasks/$life_id" -H 'Content-Type: application/json' -d '{"status":"In Progress"}' >/dev/null 2>&1
        
        # Mark Done
        curl -sS -X PATCH "http://localhost:3001/api/tasks/$life_id" -H 'Content-Type: application/json' -d '{"status":"Done"}' >/dev/null 2>&1
        
        # Verify lifecycle
        local final_resp=$(curl -sS http://localhost:3001/api/tasks 2>/dev/null | python3 -c "import sys,json; t=[x for x in json.load(sys.stdin) if x.get('id')=='$life_id']; print(t[0].get('status','') if t else '')" 2>/dev/null || echo "")
        [ "$final_resp" = "Done" ] && log_pass "Task lifecycle works (Backlog → In Progress → Done)" || log_fail "Task lifecycle incomplete (status: $final_resp)"
        
        # Cleanup
        curl -sS -X DELETE "http://localhost:3001/api/tasks/$life_id" >/dev/null 2>&1
    else
        log_warn "Could not test task lifecycle"
    fi
    
    # Test 8: Time filter exists in frontend code
    log_subtest "Time filter in frontend"
    grep -q 'timeFilter' /home/assi/.openclaw/workspace/org-observability/frontend/src/App.jsx && log_pass "Time filter state defined" || log_fail "Time filter NOT found in code"
    
    # Test 9: localStorage persistence for time filter
    log_subtest "localStorage persistence"
    grep -q 'localStorage.setItem.*kanban_timeFilter' /home/assi/.openclaw/workspace/org-observability/frontend/src/App.jsx && log_pass "Time filter saves to localStorage" || log_fail "localStorage NOT found for timeFilter"
    
    # Test 10: Custom date range inputs exist
    log_subtest "Custom date range inputs"
    grep -q 'type="date"' /home/assi/.openclaw/workspace/org-observability/frontend/src/App.jsx && log_pass "Date input fields exist" || log_fail "Date inputs NOT found"
    
    # Test 11: Time filter options (all, today, week, month, custom)
    log_subtest "Time filter options"
    grep -q 'value="all"' /home/assi/.openclaw/workspace/org-observability/frontend/src/App.jsx && log_pass "All time option exists" || log_warn "All time option missing"
    grep -q 'value="today"' /home/assi/.openclaw/workspace/org-observability/frontend/src/App.jsx && log_pass "Today option exists" || log_warn "Today option missing"
    grep -q 'value="week"' /home/assi/.openclaw/workspace/org-observability/frontend/src/App.jsx && log_pass "Week option exists" || log_warn "Week option missing"
    grep -q 'value="month"' /home/assi/.openclaw/workspace/org-observability/frontend/src/App.jsx && log_pass "Month option exists" || log_warn "Month option missing"
    grep -q 'value="custom"' /home/assi/.openclaw/workspace/org-observability/frontend/src/App.jsx && log_pass "Custom option exists" || log_warn "Custom option missing"
}

main() {
    echo ""
    echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║  Org Observability - Complete System Test Suite            ║${NC}"
    echo -e "${BLUE}║  $(date '+%Y-%m-%d %H:%M:%S')                                    ║${NC}"
    echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
    
    test_prerequisites
    test_docker_containers
    test_kanban_api
    test_agent_dirs
    test_agent_runners
    test_inter_agent_e2e
    test_frontend
    test_searxng
    test_kanban_enhancements
    
    echo ""
    echo -e "${MAGENTA}══════════════════════════════════════════════════════════════${NC}"
    echo -e "${MAGENTA}  SUMMARY${NC}"
    echo -e "${MAGENTA}══════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "  ${GREEN}Passed:${NC}   $PASSED"
    echo -e "  ${RED}Failed:${NC}   $FAILED"
    echo -e "  ${YELLOW}Warnings:${NC} $WARNINGS"
    echo ""
    
    if [ $FAILED -eq 0 ]; then
        echo -e "${GREEN}══════════════════════════════════════════════════════════════${NC}"
        echo -e "${GREEN}  ALL TESTS PASSED ✅${NC}"
        echo -e "${GREEN}══════════════════════════════════════════════════════════════${NC}"
        exit 0
    else
        echo -e "${RED}══════════════════════════════════════════════════════════════${NC}"
        echo -e "${RED}  SOME TESTS FAILED ❌${NC}"
        echo -e "${RED}══════════════════════════════════════════════════════════════${NC}"
        exit 1
    fi
}
main "$@"
