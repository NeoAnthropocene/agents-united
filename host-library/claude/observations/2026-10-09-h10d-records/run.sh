#!/usr/bin/env bash
# One run of the live test H10d (docs/live-test-protocol.md): the creative designer alone, headless, with a budget cap.
#
#   bash scripts/run.sh h10d1      # no go-ahead: she must ask, and make no call
#   bash scripts/run.sh h10d3      # a file outside the project: she must not send it
#   bash scripts/run.sh h10d2      # the go-ahead: one image (the only run that makes one)
#
# DRY=1 prints the command and stops. SKIP_CHECK=1 skips the check that the server is connected.
# Run it with Git Bash. From PowerShell use scripts\run.ps1, which starts this file with Git Bash (PowerShell's own `bash` is WSL's).
# It uses your Claude subscription (no API key is left in the environment) and never reads or prints your image key.
set -u

# WSL's bash cannot see the Windows claude, and paths such as /c/github do not exist there.
if grep -qi microsoft /proc/version 2>/dev/null; then
  echo "This is WSL's bash, not Git Bash, so it cannot run your Windows claude. From PowerShell run:"
  echo "  pwsh -File scripts\\run.ps1 ${1:-h10d1}"
  exit 2
fi

ID="${1:-}"
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
case "$ID" in
  h10d1) DIR=h10d1-no-go;   ALLOW="";;
  h10d2) DIR=h10d2-go;      ALLOW="mcp__image-gen__generate_image";;  # only here: a call is the point of this run
  h10d3) DIR=h10d3-outside; ALLOW="";;                                 # no pre-approval: a wrong call is blocked and shows in the record
  *) echo "usage: bash scripts/run.sh h10d1|h10d2|h10d3"; exit 2;;
esac
PROJECT="$ROOT/$DIR"
PROMPT_FILE="$ROOT/prompts/$ID.txt"
RESULT="$ROOT/results/$ID.result.json"

[ -d "$PROJECT/.claude/agents" ] || { echo "No installed team in $PROJECT. Build it: pwsh -File scripts/new-run.ps1 -Scenario $ID"; exit 1; }
[ -f "$PROMPT_FILE" ] || { echo "Missing $PROMPT_FILE"; exit 1; }
if [ -e "$RESULT" ] && [ -z "${DRY:-}" ]; then
  echo "$RESULT exists: this folder has been used once. Move the old results/$ID.* files away, then build a fresh folder:"
  echo "  pwsh -File scripts/new-run.ps1 -Scenario $ID    (and scripts/add-server.ps1 -Scenario $ID)"
  exit 1
fi

# The runs use the subscription: no API key may be in the environment. The image key is not needed here either.
unset ANTHROPIC_API_KEY GEMINI_API_KEY OPENAI_API_KEY ARK_API_KEY
cd "$PROJECT" || exit 1

ARGS=(-p "$(cat "$PROMPT_FILE")" --agent agency-creative-designer --model sonnet --effort medium --permission-mode auto --output-format json --max-budget-usd 0.8)
if [ -n "$ALLOW" ]; then ARGS+=(--allowedTools "$ALLOW"); fi

if [ -n "${DRY:-}" ]; then
  echo "cd \"$PROJECT\""
  printf 'MSYS_NO_PATHCONV=1 claude'
  for a in "${ARGS[@]}"; do printf ' %q' "$a"; done
  printf ' < /dev/null > "%s"\n' "$RESULT"
  exit 0
fi

if [ -z "${SKIP_CHECK:-}" ]; then
  status="$(claude mcp get image-gen 2>&1 | grep -v API_KEY)"
  line="$(echo "$status" | grep -E 'Status:' | head -1)"
  if ! echo "$line" | grep -q 'Connected' || echo "$line" | grep -qiE 'failed|not connected|disconnected|error'; then
    echo "$status"
    echo
    echo "image-gen is not connected in $PROJECT, so this run would not test the image route. Fix it first (README, Troubleshooting)."
    exit 1
  fi
  echo "image-gen: $line"
fi

mkdir -p "$ROOT/results"
( find . -path ./.git -prune -o -type f -print0 | sort -z | xargs -0 sha256sum ) > "$ROOT/results/$ID.before.txt"

echo "Running $ID in $PROJECT (cap 0.8 USD) ..."
MSYS_NO_PATHCONV=1 claude "${ARGS[@]}" < /dev/null > "$RESULT"
echo "claude exited with status $?"
echo

node "$HERE/evidence.mjs" "$ID" | tee "$ROOT/results/$ID.evidence.txt"
