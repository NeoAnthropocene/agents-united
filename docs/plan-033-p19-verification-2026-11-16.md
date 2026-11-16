# Plan 033 P19, the factory launcher also turns fork mode off for its own session: verification, 2026-11-16

P19 extends the launcher, CLI, runbook and sitting-instruction changes of [the P17 verification record](plan-033-p17-verification-2026-11-16.md) so `agents start agent-factory --host claude` also turns fork mode off (`CLAUDE_CODE_FORK_SUBAGENT` = `0`) for the factory's own session, answering finding S4-A1 of the 2026-11-16 interactive sittings ([the interactive stage-proof observation](../host-library/claude/observations/2026-11-16-claude-2.1.325-factory-stage-proof-interactive.md)). Committed locally as `071542f` ("fix(factory): P19, the launcher also turns fork mode off for the factory session"; 12 files, none new) on top of baseline `bf168cd` (the P18 records commit on `codex/plan-033-claude-delivery-nov10`, draft pull request 219 against `dev`). Built by one Claude subagent (Sonnet) in its own worktree with one fix round after the lead's review and no second-Host review, gated on Windows before commit `071542f`. Nothing of P19 ran on the real Host: that the Host waits for a worker when fork mode is off is taken from Host documentation and not observed. See [ADR 0067](adr/0067-claude-factory-realization-delivery.md) (section dated 2026-11-16).

## Scope and baseline

- Date: 2026-11-16.
- Branch: `codex/plan-033-claude-delivery-nov10`, draft pull request 219 against `dev`.
- Baseline: `bf168cd` (the P18 records commit).
- Local commit: `071542f` ("fix(factory): P19, the launcher also turns fork mode off for the factory session"; 12 files changed, none new).
- Gate environment: Windows, Node 24.19.0. Nothing of P19 ran on the real Host; Linux CI has not run on `071542f` when these records are written (P18 commits `5547450` and `bf168cd` passed CI check `test`: success, read once; the Windows gate is not a CI result).

## The observation that caused it (finding S4-A1) and Host documentation

- **Finding S4-A1 (major), seen in two interactive sittings on 2026-11-16** (Claude Code 2.1.325, interactive terminal sessions, Windows, permission mode `auto`, workspaces prepared from `1b300a5` with P16 fixes and the P17 launcher change, not P18 or P19; [the interactive stage-proof observation](../host-library/claude/observations/2026-11-16-claude-2.1.325-factory-stage-proof-interactive.md)):
  - **S4 part A (`s4a-factory-guards`, session `51a0014c-723f-49d0-9f01-e48220864a36`, started through the launcher):** the Host started `factory-realizer` as a background agent (`Agent` call carried only `subagent_type`, `description` and `prompt`; tool result `status: async_launched`, `"The agent is working in the background"`; worker meta file `requestShape: background`, `launchedWithDefaults: true`), even though the agent file says `background: false` and the prompt asked for the foreground. The coordinator wrote: `"The realizer did not start in the foreground: the Host launched it as a background agent, and I have no result from it yet."` and `"My Agent tool has no foreground setting in this session, so I could not request it."` It stopped as its rule requires and asked whether to start `factory-evaluator` anyway; the instructions gave no answer for that, so `factory-evaluator` was never started and the evaluator half of step 3 is not tested.
  - **S3 (`s3-typed-forks`, session `17cd59b1-d41d-4dec-be8a-f3a0d54bb0f5`, started through the launcher):** the single `Agent` call for `factory-evaluator` (carrying only `description`, `subagent_type` and `prompt`) returned `status: async_launched` with meta `requestShape: background`, `launchedWithDefaults: true`. The coordinator stopped, renamed its review task `"BLOCKED: independent review (evaluator started in the background, not foreground)"`, did not start the Skill evaluator, and asked whether to accept a background review. (The evaluator returned 104 seconds after the coordinator stopped with `reviewed`, `no-blocking-findings` and two minor findings; the coordinator did not save or check that result and kept waiting.)
  - *(S4 part B, `s4b-readonly-probe`, session `d72f10b4-910c-4c64-ab76-7fe016e65ead`, a plain session not started through the launcher, also saw `probe-readonly-worker` run as a background agent.)*
- **What the Host documentation says:**
  - [sub-agents.md](../host-library/claude/pages/agent/sub-agents.md), section "Which subagents run in the background": `"With nothing configured, a subagent that Claude spawns from your main conversation starts in the background."` While `claude -p` and the Agent SDK let Claude wait (which is why the headless runs of 2026-11-15 showed foreground workers), in an interactive terminal session Claude can wait for a subagent only when fork mode is off.
  - [sub-agents.md](../host-library/claude/pages/agent/sub-agents.md), section "Let Claude wait for a subagent": turn fork mode off by setting `CLAUDE_CODE_FORK_SUBAGENT` to `0` (for example in `settings.json` `env`).
  - [sub-agents.md](../host-library/claude/pages/agent/sub-agents.md), section "Turn fork mode off": `"Fork mode is on by default from Claude Code v2.1.302, and in an interactive terminal session from v2.1.232."`
  - [settings.md](../host-library/claude/pages/settings/settings.md), section "Settings precedence": a settings-file `env` entry overrides a shell export, and `--settings` applies for that session only, above user, project and local settings and below managed settings.

## Decisions, mechanism and what stays unchanged

- **Maintainer decision (2026-11-16):** to the question `"Should the launcher also turn fork mode off, so the factory's workers run in the foreground?"` (offered beside `"Accept background"`, that is: rewrite the runbook so the coordinator waits for a background worker's notice), the maintainer answered: **`"Yes, turn it off"`**.
- **Lead's choice of mechanism and why two switches:** the same two switches as P17 in `src/core/claude-launcher.ts`. The factory plan carries `CLAUDE_CODE_FORK_SUBAGENT` as `0` beside `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` (`0`) in `plan.env`, and ONE `--settings` element now carries both: `--settings={"env":{"CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS":"0","CLAUDE_CODE_FORK_SUBAGENT":"0"}}`. The user's settings files are not touched. Two switches are used because a settings-file `env` entry overrides a shell export ([settings.md](../host-library/claude/pages/settings/settings.md), section "Settings precedence"), and a `--settings` payload applies for that session only, above user, project and local settings and below managed settings.
- **Not chosen and why:**
  - `"Accept background"` (rewriting the runbook so the coordinator waits for a background worker's notice): not chosen by the maintainer.
  - `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1` (named in [sub-agents.md](../host-library/claude/pages/agent/sub-agents.md), section "Let Claude wait for a subagent", as another way to make Claude wait): not chosen because it also turns background commands off.
- **Unchanged on purpose:**
  - The coordinator still requests `run_in_background: false` and still treats a background launch as a blocker.
  - `registry/skills/coordinate-artifact/references/dispatch.md` still says `"Current fork defaults vary; do not change user settings"`.
  - The factory dry run still lists five argv elements and exactly one `--settings` element.
  - A non-factory plan is unchanged: no fork variable, no `--settings` element, no `"Fork mode"` text (pinned by tests).

## The change

| Place | Before | After |
| --- | --- | --- |
| `src/core/claude-launcher.ts`, the settings element | exported `FACTORY_TEAMS_OFF_SETTINGS_ARG` = `--settings={"env":{"CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS":"0"}}` | exported `FACTORY_SESSION_SETTINGS_ARG` = `--settings={"env":{"CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS":"0","CLAUDE_CODE_FORK_SUBAGENT":"0"}}` (renamed; no alias) |
| the same file, the factory plan environment | `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` = `0` | both `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` and `CLAUDE_CODE_FORK_SUBAGENT` = `0`; an inherited fork variable never refuses the plan |
| the same file, `factoryLaunchShapeOk` | exact last five argv elements with the teams element; the teams name in exactly one, exact spelling with value `0` | the same with the new element; for EACH of the two names exactly one, exact spelling with value `0` |
| the same file, `launch` | deletes other-case spellings of the teams variable from the copied parent environment | deletes other-case spellings of both names; error text ends `"... and with agent teams and fork mode turned off in its settings and environment."` |
| `src/cli.ts`, dry run | no fork line | for the factory plan only, after the agent-teams line: `"Fork mode: off (turned off for this session by the launcher: environment value 0 and the --settings element below, so that workers can run in the foreground; managed settings can still turn fork mode on)"` |
| `src/cli.ts`, start note | no fork line | for the factory plan only, after the `"Teams scaffold"` line: `"Fork mode: off (turned off for this session by the launcher; managed settings can still turn fork mode on)"`; exported helpers `describeClaudeForkModeOff` and `describeClaudeForkModeNoteLine` |
| the runbook sentence in six files (`registry/hosts/claude/agents/orchestrator-agent-factory.md`; `registry/skills/coordinate-artifact/references/dispatch.md`, `host-sync.md`, `skill-authoring.md`, `contract-authoring.md`, `bundle-authoring.md`) | "The launcher turns agent teams off for the factory's own session and does not refuse a dry run because `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` is set; with direct `claude --agent` entry that switch does not apply, so a worker that starts as a teammate is refused and reported." | "The launcher turns agent teams and fork mode off for the factory's own session and does not refuse a dry run because `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` is set; with direct `claude --agent` entry those switches do not apply, so a worker that starts as a teammate or in the background is refused and reported." |
| `scripts/factory-proof-scenarios.mjs` (sitting instructions) | session id found with a Git Bash command only; Step 0 of the guards sitting prints `TEAMS=[...]`; no answer for a reported background worker; bound of the guards sitting 5 prompts (4 + 1); `"The launcher turns agent teams off for this session by itself."` | a PowerShell form is added (`"In PowerShell use this instead:"`); Step 0 prints `TEAMS=[...] FORK=[...]`, expected `TEAMS=[0] FORK=[0]`; step 3 gives one fenced answer to paste if the coordinator reports a background worker; three new paste-back items (was a worker named factory-evaluator started at all; what the evaluator answered; did the coordinator say a worker ran in the background); bound 6 prompts (5 + 1); `"The launcher turns agent teams and fork mode off for this session by itself."` |

The factory dry run still lists five argv elements and exactly one `--settings` element. A non-factory plan is unchanged: no fork variable, no `--settings` element, no `"Fork mode"` text (pinned by tests).

## Tests

- Changed test files (three): `tests/agent-factory-coordinator-launcher.test.ts`, `tests/agent-factory-proof-fixes.test.ts`, `tests/factory-proof-prep.test.ts`.
- Covered behaviour:
  - the plan env with both names and the exact settings JSON (`FACTORY_SESSION_SETTINGS_ARG`); five argv elements and one `--settings`;
  - planning with `CLAUDE_CODE_FORK_SUBAGENT` set to `1`, `0` or empty in the caller's environment (succeeds, yields `0`);
  - eight malformed plans refused in `factoryLaunchShapeOk` and before spawning (fork variable missing; value `1`; a second spelling beside it; only a lower-case spelling; the old teams-only element; a fork-only element; reversed key order in the element; two `--settings` elements);
  - the child process receives exactly one fork variable with the value `0`; non-factory plans carry nothing of this;
  - the built CLI's dry-run text; `describeClaudeForkModeOff` and `describeClaudeForkModeNoteLine` and the note line for `0`, `1`, empty and undefined;
  - the six runbook files hold the new sentence once each and the old one nowhere;
  - the generated sitting text (the PowerShell command pinned exactly, `FORK=[` in Step 0, the fenced answer, the new paste-back items, the bound of 6).
- **Fail-first evidence (by the lead):** the three changed test files were run against the unchanged code (`bf168cd`): exit `1`; 41 failed, 141 passed, of 182. **Stated limit:** part of those failures come from the renamed export (`FACTORY_SESSION_SETTINGS_ARG`) being absent in the old code, not from behaviour alone. The worker itself had not run its tests against the unchanged code.
- **Linux-only limit of one test:** the case-insensitive deletion of a differently spelled parent variable is exercised on Linux only (Windows `process.env` folds names case-insensitively and cannot hold two spellings); a comment in `tests/agent-factory-coordinator-launcher.test.ts` says so.

## How the work was done

- **Worker:** a Claude subagent of the lead session (Sonnet), in its own worktree, from the written brief `p43-fork-mode-off.brief.md` in `scratch/plan-033-implementation/routed-2026-11-14/`; it committed nothing. It left helper files in the folder above its worktree (outside the repository; harmless; noted).
- **Lead review and fix round:** the lead read the complete source, script and runbook diff. One fix round with three items: (1) a generated sentence in `scripts/factory-proof-scenarios.mjs` that still named agent teams only; (2) a test that had forbidden PowerShell fences and was loosened to a mere count, now pinning the exact command; (3) the start note's fork line, which no test reached, moved into an exported function (`describeClaudeForkModeNoteLine`) with a test.
- **No independent second-Host review:** not run for this slice; the mechanism repeats P17's, which had such a review.
- **Acceptance command that refuses:** the brief's last acceptance command (a dry run from the worker's folder) refuses because that folder is no installed workspace, as the brief allowed; the built-CLI test asserts the dry-run text instead.

## Lead's acceptance and gate

- **Acceptance by the lead (worker's worktree, before integration):**
  - `npm run typecheck`: exit `0`.
  - The brief's eight test files, serial: exit `0`; 8 files; 399 passed, none skipped; 323.32 s.
- **Gate (Windows, main checkout, the change applied uncommitted on `bf168cd`; Node 24.19.0):** raw files are in the git-ignored folder `logs/plan-033-p19-2026-11-16/` (per step: `<step>.command.txt`, `.stdout.txt`, `.stderr.txt`, `.exit.txt`; plus `base-head.txt`, `tree-status.txt`).

| Step | Command | Exit | Result | Raw files |
| --- | --- | --- | --- | --- |
| `hostlib-verify` | `npm run hostlib:verify` | 0 | "host library snapshots match their lockfiles and every guide citation resolves" | `hostlib-verify.{command,stdout,stderr,exit}.txt`, `base-head.txt`, `tree-status.txt` |
| `typecheck` | `npm run typecheck` | 0 | no errors | `typecheck.{command,stdout,stderr,exit}.txt` |
| `full-test-serial` | `env -u CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS npm test -- --maxWorkers=1 --fileParallelism=false` | 0 | 307 files passed; 7,689 tests passed, 224 skipped, of 7,913; 1,750.59 s | `full-test-serial.{command,stdout,stderr,exit}.txt` |
| `addon-matrix` | `AGENTS_CI_FULL=1 env -u CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS npx vitest run tests/e2e-domain-conformance.test.ts --maxWorkers=1 --fileParallelism=false` | 0 | 1 file; 317 tests passed; 452.24 s | `addon-matrix.{command,stdout,stderr,exit}.txt` |
| Linux CI | — | Pending | Unverified until CI runs on `071542f` (P18 commits `5547450` and `bf168cd` passed CI check `test`: success, read once; the Windows gate is not a CI result) | — |

- Compared with the P18 gate (307 files; 7,673 passed, 224 skipped, of 7,897): 16 tests more, no new file.

## Limits, unverified, known and left

- **NOT OBSERVED on the real Host (unverified):** that with `CLAUDE_CODE_FORK_SUBAGENT=0` from the launcher the Host waits for `factory-realizer` and `factory-evaluator` in an interactive session. This is taken from the documentation. A short re-sitting of the guards sitting's step 3 on a freshly prepared workspace is the planned observation; its Step 0 prints `FORK=[...]`.
- **Not known (unverified):** whether the `Agent` tool shows a foreground setting once fork mode is off (in the sittings its input had none).
- **Managed settings and direct `claude --agent` entry:** managed settings apply after the `--settings` payload and can turn fork mode on again. Direct `claude --agent` entry gets neither switch; there the coordinator's rule (a background worker is refused and reported) is the only protection, and the sittings showed that rule being followed twice.
- **Undocumented merge of `env` blocks:** the documentation does not say whether a `--settings` `env` block merges with or replaces the `env` block of the settings files (same open point as P17).
- **Typed routes:** do not depend on this switch; a Skill with `context: fork` follows its own `background` field (documentation), and S3 showed three foreground forks with fork mode still on.
- **Known and left, separate from P19:** the `.cmd` shim route of the launcher cuts a multi-line first message (pre-existing, all bundles).
- **Linux CI:** has not run on `071542f` when these records are written (and Windows does not run the POSIX case-different parent-env deletion branch).

## Open items after the sittings and P19

For the maintainer (the records list them, they do not decide them):

1. The short re-sitting of the guards sitting, step 3 (realizer and evaluator in the foreground), on a fresh workspace.
2. Finding S4-A2: the guard fails open when its script is missing. Decision on the failure mode is open.
3. The S3 fixture brief and the pinned `skill-check` policy do not fit (the lead's scenario defect); to fix before an S3 re-run.
4. The interactive main preload of `coordinate-artifact` is not shown; the fallback read works. Whether to keep relying on the fallback is open.
5. Whether the coordinator gets the `Skill` tool (P8b stage 2): S6 gives the tool's behaviour in a plain session only.
6. Whether the seconds and bytes of the dropped budget should have stayed (P18, lead's choice).

## Next

- Fix the S3 fixture brief and `skill-check` policy mismatch (open item 3) before an S3 re-run, prepare a fresh workspace from the commit that contains this work, and run the short re-sitting of S4 part A step 3 (observing `TEAMS=[0] FORK=[0]` in Step 0 and foreground waiting in step 3).
- Run Linux CI on the pushed branch, and await maintainer decisions on open items 2, 4, 5 and 6.
