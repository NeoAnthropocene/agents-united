#!/usr/bin/env bash
# usage: run-headless.sh <scratch-dir> <role> <prompt-file> <label>
# One fresh headless session (claude -p) on the user's subscription, same flags as the TUI sittings (sonnet, effort medium).
# Never --dangerously-skip-permissions. Output: runs-iter2/<label>.json (the result with cost and session id) and .err.
set -u
DIR="$1"; ROLE="$2"; PROMPT_FILE="$3"; LABEL="$4"
OUT="C:/github/scratch-pilot/h8-workspace/runs-iter2"
mkdir -p "$OUT"
unset ANTHROPIC_API_KEY
cd "$DIR" || exit 2
MSYS_NO_PATHCONV=1 claude -p "$(cat "$PROMPT_FILE")" \
  --agent "$ROLE" --model sonnet --effort medium \
  --permission-mode auto --output-format json --max-budget-usd 0.8 \
  < /dev/null > "$OUT/$LABEL.json" 2> "$OUT/$LABEL.err"
echo "exit $? label $LABEL"
node -e "
const fs=require('fs');const t=fs.readFileSync('$OUT/$LABEL.json','utf8');
try{const j=JSON.parse(t);console.log(JSON.stringify({session:j.session_id,cost:j.total_cost_usd,turns:j.num_turns,ms:j.duration_ms,is_error:j.is_error,subtype:j.subtype}))}catch(e){console.log('unparsed output, first 300 chars:',t.slice(0,300))}"
