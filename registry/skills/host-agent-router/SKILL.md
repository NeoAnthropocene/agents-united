---
name: host-agent-router
description: "Use when the user explicitly asks to run, delegate or fan out work on another agent CLI (Cline, Antigravity, Codex, Claude), or to pick the host and side (Windows or WSL) with the most 5-hour and weekly headroom; trigger phrases: host-agent-router, route this task, run this on another host, which host has the most limit, fan out across hosts, use my other CLIs. Skip it for work you can finish in this session, when nobody asked to use other hosts, and inside a routed worker."
metadata:
  author: agents-united
  version: 1.0.0
  license: MIT
---

# Host Agent Router

Run a task where capacity is left: pick the tier, brief the worker, let the script choose, check what came back.

## Overview & Purpose
The script tries Cline, Antigravity, Codex, Claude in that order; for one host it picks the side (Windows or WSL) with the larger of min(5-hour, weekly) remaining, a tie keeping your side; the tier sets the model and the timeout. You plan, brief and review; the worker executes under one contract on every host: the `git-guardrails` rules and a `handoff` report ([references/worker-contract.md](references/worker-contract.md)).

## Execution Triggers
Load it when the user asks to run, delegate or fan out work on another host CLI, or which host or side has the most limit. Skip it when you can finish the work here, nobody asked for other hosts, or `HOST_AGENT_ROUTER_DEPTH` is set or your instructions begin `[Routed worker`: you are the worker; never route again.

## Input/Output Requirements
Inputs: a self-contained brief (the worker sees none of this chat), the tier, the working directory, the access (`read-only` by default, `edit` only when the user wants files changed). Output: the JSON of `run`: `ok`, `ran`, `output` (the worker's reply), `attempts`, `skipped`; `failure` when not ok; for edit runs `changed` (what the router saw change on disk), `stopped`, `guard.blocked`. **Evidence to attach**: `ran` host, side, model; the headroom (Cline's is unknown); each fall-through and why; the report against `changed`; what is unverified.

## Step-by-Step Runbook
1. **Pick the tier** unless the user named one. `simple`: lookups, renames, one-file edits. `medium`: a fix or feature in a known module, tests, a diff review. `high`: architecture, ambiguous or cross-cutting work, security, hard root causes; planning and the final integration review are always `high`.
2. **Show the routing**: `node "${CLAUDE_SKILL_DIR}/scripts/router.mjs" status --tier <tier>` (Node 20+, `--help`). Tell the user what it chose and skipped.
3. **Brief** one goal and one disjoint scope per worker, from [references/delegation-brief.md](references/delegation-brief.md). For `edit`, give each run its own checkout (`git worktree add <dir> -b task/<name>`) as `--cwd`.
4. **Run**: `node "${CLAUDE_SKILL_DIR}/scripts/router.mjs" run --tier <tier> --prompt-file <brief> --cwd <dir>`; `--access edit` only for changes, `--dry-run` first when editing, `--allow-cmd "<acceptance command>"` (exact line) so the worker can run it. Timeouts follow the tier (300, 900, 1800 s); `--timeout` overrides. Elsewhere: the skill's folder.
5. **Several parts**: separate `run` calls in separate checkouts (three at most), then integrate with a `high` run.
6. **Review before accepting** (see the brief reference). `failure` `limit`, `auth`, `model`, `missing`, `timeout`, `empty` or `denied` with nothing changed: that candidate did no work, the next ran. `stopped`: files changed, then it failed; no other host started: continue from that tree or discard the checkout. `guard`, `unfinished`, or `ok: false` with no `failure`: a real failure; never re-run it elsewhere. `ok: true`: check the report against `changed`, read the diff, run the acceptance command yourself.
7. **Report** per run: the evidence above and the review result.

## Code & Config Exemplars
[examples/worked-example.md](examples/worked-example.md) is a worked example: a review, then a briefed fix in its own checkout, with a fall-through. Models, timeouts, allowed commands, the 10% floor: [assets/config.default.json](assets/config.default.json), overridden key by key in `~/.agents/host-agent-router/config.json`. Per-host commands and limits: [references/hosts.md](references/hosts.md).

Anti-patterns, each with its reason:
- Routing work you could finish here: it spends another account for nothing.
- `--access edit` for a question: only an edit run can damage the tree.
- Editing outside a throwaway checkout: Cline's guard is a token check, not a sandbox.
- Accepting "tests pass" from the report: run the acceptance command yourself.
- Re-running a failed task elsewhere: the first host may have changed files.
- Over three parallel runs, or two on one file: nothing reserves quota or locks files.
- Asking a Cline model for its quota: it answers UNKNOWN.

## Edge Cases & Error Recovery
- **Exit 2**: print `skipped`, say which host to log in or which window is spent; never force a run.
- **Same account on both sides**: figures match, the current side wins. Codex edits go to WSL.
- **Directory only inside WSL**: Windows cannot reach it; those candidates are skipped.
- **`failure: model`**: run `router.mjs models`, fix the override. A wrong Cline id is refused up front.
- **Cline refuses or hangs**: a refusal falls through if nothing changed; a hang ends at the timeout.
- **`partial` in the result**: the Cline run did not finish; it lists the tools used. Check the tree first.

## Verification Checklist
- [ ] Tier stated with its reason; `read-only` unless the user asked for edits.
- [ ] `status` or `plan` shown before the run; host, side and model reported after.
- [ ] Each edit run in its own checkout, with a brief naming scope, out of scope and acceptance command.
- [ ] Every fall-through, skip, `stopped` and `guard.blocked` named; the report checked against `changed`.
- [ ] No re-run after a real task failure; unknown headroom and the unverified said plainly.
