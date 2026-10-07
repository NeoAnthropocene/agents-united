# AGENTS.md

Instructions for AI coding agents that read this file by convention (OpenAI Codex and others). Claude Code reads `CLAUDE.md`. This file only points at the rules that already exist, so that there is one set of rules.

## Read first, in this order

1. `CLAUDE.md`: the environment (Node 24 or later) and the pre-push gate.
2. `.claude/rules/`: the standing rules (git guardrails, test-driven development, clean code and architecture, domain modeling and ADRs, multi-agent coordination, quality and accessibility). They are written for Claude Code but bind any agent that works here.
3. `docs/session-start.md`: the gate for any session, whatever harness runs it (reading order, prior-art search, spending, and the goal statement to open with). Where it and the code disagree, the code wins.

## The rules you must not miss

- Work on a branch cut from a fresh `origin/dev`. Pull requests target `dev`, never `main`. Never force-push. Never stage a secret: run `git diff --cached` before every commit.
- Test first: a failing test, then the minimal code. Before pushing run `npm run typecheck && npm test` and read the exit code of the run itself, not of a pipe.
- Check `gh pr list --state all` before any push: a commit pushed to a branch whose pull request is already merged never reaches `dev`.
- A real host session (Claude Code, Cline, Antigravity) spends the maintainer's own account. Never start one. The maintainer types the live test in the host's TUI and gives you the session id; you read the host's own records with `npm run hostlib:session -- <id> --project <the host's project folder>` (see `docs/live-test-protocol.md`) and never trust the model's own account of what it did.
- Say what was verified and what was not. Write "unverified" plainly.

## About this file

`/AGENTS.md` is in `.gitignore` because `agents add -t codex` generates an `AGENTS.md` projection at a workspace root, and the doctor treats that file as managed. This hand-written pointer is tracked on purpose, by force (`git add -f`), at the maintainer's request for the hand-over to Codex. Decide before running `agents add ... -t codex` in this repository, because the installer and this file would collide.
