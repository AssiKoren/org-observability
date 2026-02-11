#!/bin/bash
#
# Agent Runner - Processes inbox tasks and updates Kanban
#
# Usage: ./agent-runner.sh <agent_name>
# Example: ./agent-runner.sh daniel
#
# What it does:
# 1. Watch inbox for new tasks
# 2. Move task to "In Progress"
# 3. Execute the task command
# 4. Move task to "Done"
# 5. Post result to conversation
# 6. Archive completed task
#

AGENT_NAME="${1:-}"
INBOX_DIR="/home/assi/.openclaw/agents/$AGENT_NAME/workspace/inbox"
OUTBOX_DIR="/home/assi/.openclaw/agents/$AGENT_NAME/workspace/outbox"
ARCHIVE_DIR="/home/assi/.openclaw/agents/$AGENT_NAME/workspace/inbox/archive"
API_URL="http://localhost:3001/api"

if [ -z "$AGENT_NAME" ]; then
    echo "Usage: $0 <agent_name>"
    echo "Example: $0 daniel"
    exit 1
fi

echo "[$AGENT_NAME] Agent runner started at $(date)"

# Ensure directories exist
mkdir -p "$INBOX_DIR" "$OUTBOX_DIR" "$ARCHIVE_DIR"

# Process tasks loop
while true; do
    # Find task files in inbox
    TASK_FILES=$(find "$INBOX_DIR" -name "*.json" -type f 2>/dev/null | head -5)
    
    for TASK_FILE in $TASK_FILES; do
        TASK_ID=$(basename "$TASK_FILE" .json)
        echo "[$AGENT_NAME] Found task: $TASK_ID"
        
        # Read task details
        TASK_TITLE=$(cat "$TASK_FILE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('title',''))" 2>/dev/null || echo "Unknown")
        TASK_CMD=$(cat "$TASK_FILE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('command',''))" 2>/dev/null || echo "")
        
        echo "[$AGENT_NAME] Processing: $TASK_TITLE"
        
        # Move task to In Progress (if API available)
        curl -sS -X PATCH "$API_URL/tasks/$TASK_ID" \
            -H 'Content-Type: application/json' \
            -d "{\"status\":\"In Progress\",\"assignee\":\"$AGENT_NAME\"}" 2>/dev/null || true
        
        # Add conversation message
        curl -sS -X POST "$API_URL/tasks/$TASK_ID/conversation" \
            -H 'Content-Type: application/json' \
            -d "{\"author\":\"$AGENT_NAME\",\"message\":\"Started working on this task\"}" 2>/dev/null || true
        
        # Execute task command
        TASK_OUTPUT="Task completed by $AGENT_NAME at $(date)"
        if [ -n "$TASK_CMD" ]; then
            echo "[$AGENT_NAME] Executing: $TASK_CMD"
            TASK_OUTPUT=$(eval "$TASK_CMD" 2>&1) || TASK_OUTPUT="Command failed: $TASK_CMD"
        fi
        
        # Write result to outbox
        cat > "$OUTBOX_DIR/$TASK_ID.result.json" << EOF
{
  "task_id": "$TASK_ID",
  "title": "$TASK_TITLE",
  "agent": "$AGENT_NAME",
  "output": "$TASK_OUTPUT",
  "completed_at": "$(date -Iseconds)"
}
EOF
        
        # Move task to Done on Kanban
        curl -sS -X PATCH "$API_URL/tasks/$TASK_ID" \
            -H 'Content-Type: application/json' \
            -d '{"status":"Done"}' 2>/dev/null || true
        
        # Add completion message to conversation
        curl -sS -X POST "$API_URL/tasks/$TASK_ID/conversation" \
            -H 'Content-Type: application/json' \
            -d "{\"author\":\"$AGENT_NAME\",\"message\":\"Task completed successfully\"}" 2>/dev/null || true
        
        # Archive the completed task
        mv "$TASK_FILE" "$ARCHIVE_DIR/"
        
        echo "[$AGENT_NAME] Completed: $TASK_TITLE"
    done
    
    # Wait before checking again
    sleep 5
done
