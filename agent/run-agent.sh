#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

mkdir -p "$SCRIPT_DIR/logs"

echo "=== Autonomous Agent Loop ==="
echo "Project: $PROJECT_DIR"
echo "Logs:    $SCRIPT_DIR/logs/"
echo "Model:   claude-opus-4-6"
echo "Max turns per session: 50"
echo "Press Ctrl+C to stop"
echo ""

SESSION_COUNT=0

while true; do
    SESSION_COUNT=$((SESSION_COUNT + 1))
    COMMIT=$(git -C "$PROJECT_DIR" rev-parse --short=6 HEAD)
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    LOGFILE="$SCRIPT_DIR/logs/session_${TIMESTAMP}_${COMMIT}.log"

    echo "--- Session #${SESSION_COUNT} start: $(date) (HEAD: $COMMIT) ---"

    claude \
        --print \
        --dangerously-skip-permissions \
        --model claude-opus-4-6 \
        --max-turns 50 \
        --append-system-prompt-file "$SCRIPT_DIR/AGENT_PROMPT.md" \
        --cwd "$PROJECT_DIR" \
        -p "Read agent/agent-progress.md and continue the tagged-template-unification implementation. Pick up where the last session left off." \
        2>&1 | tee "$LOGFILE" || true

    echo "--- Session #${SESSION_COUNT} end: $(date) (log: $LOGFILE) ---"
    echo ""
    sleep 2
done
