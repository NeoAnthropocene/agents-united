#!/bin/bash
# SessionStart hook for Claude Code on the web: Node 24 + dependencies + build.
# Local machines are untouched (exits unless CLAUDE_CODE_REMOTE=true).
set -eo pipefail

if [ "$CLAUDE_CODE_REMOTE" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel)}"

# The cloud image ships Node 22; package.json engines and CI need 24 (see .nvmrc).
export NVM_DIR=/opt/nvm
. "$NVM_DIR/nvm.sh"
nvm install "$(cat .nvmrc)" >/dev/null
nvm use "$(cat .nvmrc)" >/dev/null

# Persist Node 24 on PATH for the rest of the session's Bash calls.
if [ -n "$CLAUDE_ENV_FILE" ]; then
  echo "export PATH=\"$(dirname "$(nvm which "$(cat .nvmrc)")"):\$PATH\"" >> "$CLAUDE_ENV_FILE"
fi

npm ci
npm run build
