#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

mkdir -p "$SCRIPT_DIR/logs"

echo "=== Phase 4 Session-scoped Agent Loop ==="
echo "Project: $PROJECT_DIR"
echo "Logs:    $SCRIPT_DIR/logs/"
echo "Model:   claude-opus-4-6"
echo "Press Ctrl+C to stop"
echo ""

SESSION_COUNT=0

cd "$PROJECT_DIR"

while true; do
    # Check if Phase 4 is complete
    if grep -q "PHASE_4_STATUS: complete" "$PROJECT_DIR/agent/agent-progress.md"; then
        echo "=== All Phase 4 sessions complete ==="
        exit 0
    fi

    SESSION_COUNT=$((SESSION_COUNT + 1))
    COMMIT=$(git rev-parse --short=6 HEAD)
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    LOGFILE="$SCRIPT_DIR/logs/session_${TIMESTAMP}_${COMMIT}.log"

    echo "--- Session #${SESSION_COUNT} start: $(date) (HEAD: $COMMIT) ---"

    claude \
        --print \
        --dangerously-skip-permissions \
        --model claude-opus-4-6 \
        --append-system-prompt "$(cat "$SCRIPT_DIR/AGENT_PROMPT.md")" \
        -p "Read agent/agent-progress.md. Find the first session with STATUS: not_started or in_progress. Work ONLY on that session's tasks. Respect the MAX_COMMITS limit. When done, follow the Exit Protocol and output SESSION_COMPLETE." \
        2>&1 | tee "$LOGFILE" || true

    echo "--- Session #${SESSION_COUNT} end: $(date) (log: $LOGFILE) ---"

    # Check for normal completion
    if grep -q "SESSION_COMPLETE" "$LOGFILE"; then
        echo "--- Session completed normally ---"
    else
        echo "--- WARNING: Session may have ended abnormally (no SESSION_COMPLETE marker) ---"
    fi

    echo ""
    sleep 2
done
