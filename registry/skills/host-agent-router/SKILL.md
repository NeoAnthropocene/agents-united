---
name: host-agent-router
description: "Use when the user explicitly asks to run, delegate or fan out work on another agent CLI (Cline, Antigravity, Codex, Claude), or which host and side (Windows or WSL) has the most headroom; trigger phrases: host-agent-router, route this task, run this on another host, which host has the most limit, fan out across hosts, use my other CLIs. Skip it for work you can finish in this session, when nobody asked to use other hosts, and inside a routed worker."
metadata:
  author: agents-united
  version: 1.2.0
  license: MIT
---

# Host Agent Router

Run a task where capacity is left: pick the tier, brief the worker, check what came back.

## Overview & Purpose
The script tries Cline, Antigravity, Codex, Claude in that order and, per host, the side (Windows or WSL) with the most headroom. A tier is an ordered list of models; the first in the account's model list (the pool) runs. Every worker runs under one contract, the `git-guardrails` rules and a `handoff` report (`references/worker-contract.md`).

## Execution Triggers
Load it on the asks in the description; skip it on the skips there. Skip it too when `HOST_AGENT_ROUTER_DEPTH` is set or your instructions begin `[Routed worker`: you are the worker; never route again.

## Input/Output Requirements
Inputs: a self-contained brief (the worker sees none of this chat), the tier, the working directory, the access (`read-only` by default; pass `edit` when you delegate a change). Output: the JSON of `run`: `ok`, `ran`, `output`, `attempts`, `skipped`, `failure` when not ok; for edit runs `changed` (seen on disk), `stopped`, `guard.blocked`. **Evidence to attach**: `ran` host, side, model, effort; the headroom (Cline's: unknown); each fall-through and why; the report against `changed`; the unverified.

## Step-by-Step Runbook
1. **Pick the tier** unless the user named one. `simple`: lookups, renames, one-file edits. `medium`: a fix or feature in a known module, a diff review. `high`: architecture, ambiguous or cross-cutting work, security, hard root causes; planning and the final integration review are always `high`. `high` on Cline is for genuinely hard problems only: it uses a large share of the 5-hour quota. Keep other high-tier work off Cline: `--host H` (repeat) or `--pin-host H`. `--effort <name>` (`high`, `extra`, `max`) moves inside the tier; a model without it (an Orchestrator) keeps its own, as the plan says.
2. **Show the routing**: `node "${CLAUDE_SKILL_DIR}/scripts/router.mjs" status --tier <tier>` (Node 20+; `${CLAUDE_SKILL_DIR}` = this skill's folder). Say what it chose and skipped.
3. **Brief** one goal and one disjoint scope per worker (`references/delegation-brief.md`). An edit run is a normal use: one specific task per worker, with the guardrails, in its own worktree. Make it with `git worktree add <dir> -b task/<name>`; pass `--cwd`.
4. **Run**: `node "${CLAUDE_SKILL_DIR}/scripts/router.mjs" run --tier <tier> --prompt-file <brief> --cwd <dir>`; add `--access edit` for a change, `--dry-run` first when editing (it checks command-line length and exact lines), `--allow-cmd "<exact line>"` or `--allow-cmd-file <file>` for the worker. `--skill <name>` (up to three) puts a sibling skill in the worker's prompt, as a worktree has no installed skills. Only a skill's `SKILL.md` text is sent, never its `references/` or `scripts/`.
5. **Several parts**: separate `run` calls in separate checkouts (max three), then integrate with a `high` run.
6. **Review before accepting.** `failure` `limit`, `auth`, `model`, `missing`, `timeout`, `empty`, `denied` or `too_long` with nothing changed: that candidate did no work, the next ran. `stopped`: files changed, then it failed, no other host started; continue from that tree or discard it. `guard`, `unfinished`, or `ok: false` with no `failure`: a real failure; never re-run it elsewhere. `ok: true`: check the report against `changed`, read the diff, run the acceptance command yourself.

## Code & Config Exemplars
`examples/worked-example.md` is a worked example: a review, then a briefed fix, with a fall-through. Models, efforts, timeouts, allowed commands, 10% floor: `assets/config.default.json`, overridden key by key in `~/.agents/host-agent-router/config.json`. Host commands, limits, machines seen: `references/hosts.md`. This machine: `node "${CLAUDE_SKILL_DIR}/scripts/router.mjs" machine`.

Anti-patterns, with reasons:
- Routing work you could finish here: it spends another account.
- `--access edit` for a question: only an edit run can damage the tree.
- Editing outside a throwaway checkout: Cline's guard is a token check.
- Accepting "tests pass" from the report: run the command yourself.
- Re-running a failed task elsewhere: the first host may have changed files.
- Over three parallel runs, or two on one file: nothing reserves quota or locks files.

## Edge Cases & Error Recovery
- **Exit 2**: print `skipped`, name the host to log in or the window spent; never force it.
- **Same account on both sides**: figures match, a tie keeps your side. Codex edits prefer WSL (`editSide`).
- **Directory only inside WSL**: Windows cannot reach it; those candidates are skipped.
- **`failure: model`**: the next model of the tier on that host ran first (`attempts`). All refused: run `router.mjs models`, fix the config or set `pool`. The plan's `pools`, `skipped_models` say what the account lacks.
- **Cline refuses or hangs**: a refusal falls through if nothing changed, a hang ends at the timeout, `partial` means unfinished: check the tree.

## Verification Checklist
- [ ] Tier stated with its reason; `read-only` unless you delegate a change; `status` or `plan` shown first; `ran` reported.
- [ ] Each edit run in its own checkout, the brief naming scope, out of scope and acceptance command.
- [ ] Fall-throughs, skips, `stopped` and `guard.blocked` named; report checked against `changed`.
- [ ] No re-run after a real task failure; unknown headroom and the unverified said plainly.
