# agents-united

Guidance for Claude Code sessions in this repo. `PROJECT.md` and `CONTEXT.md` hold the full architecture and domain terms.

## Environment

- Node >= 24 (`package.json` engines, `.nvmrc`). In Claude Code on the web, `.claude/settings.json` runs `scripts/cloud-session-start.sh` at session start to install Node 24, run `npm ci` and build.
- Work on `dev`; PRs target `dev`, never `main`.

## Before pushing

```bash
npm run typecheck && npm test   # what CI runs; `npm test` builds first (pretest)
```

- `AGENTS_CI_FULL=1 npx vitest run tests/e2e-domain-conformance.test.ts` runs the full addon lifecycle matrix (about 3.5 minutes). CI does not set it, so run it on demand.
- Python 3 on PATH is needed for the `tests/skill-scripts` helper suites (skipped otherwise).
