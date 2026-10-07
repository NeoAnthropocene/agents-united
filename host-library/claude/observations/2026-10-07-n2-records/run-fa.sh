#!/usr/bin/env bash
# Three headless first-answer checks of the lead (Plan 035 N2 slice b). One fresh scratch folder each, both team variables set,
# Sonnet at low effort, stdin from /dev/null, each capped at 0.30 USD. Usage: run-fa.sh <tag>
tag="${1:-a}"
out="/c/github/scratch-pilot/n2-fa-results-$tag"
mkdir -p "$out"
export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
export CLAUDE_CODE_ENABLE_TODO_TOOLS=1

p1='Scratch exercise, no real account and no secret. Have defne list the open pull requests of the public repository octocat/Hello-World with the GitHub integration and write a three-line summary to docs/h9b/prs.md. Team mode.'
p2='Scratch exercise. A static page is served at http://localhost:4173. First report your operating mode and which of the six required integrations are callable. Then have emre audit the page with the browser tools and write the report under docs/h6/. Team mode, shared task list. Consult emre read-only first.'
p3='We need more signups for our invoicing tool for freelancers. Where do we start?'

i=0
for p in "$p1" "$p2" "$p3"; do
  i=$((i+1))
  dir="/c/github/scratch-pilot/n2-fa$i"
  cd "$dir" || exit 1
  claude -p "$p" --agent orchestrator-digital-agency --model sonnet --effort low --permission-mode auto \
    --output-format stream-json --verbose --max-budget-usd 0.3 < /dev/null > "$out/run$i.jsonl" 2> "$out/run$i.err"
  echo "run$i exit: $?" >> "$out/exits.txt"
done
echo done >> "$out/exits.txt"
