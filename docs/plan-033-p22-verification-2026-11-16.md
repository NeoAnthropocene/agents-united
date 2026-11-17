# Plan 033 P22, the coordinator runs its workers in the background and waits for each hand-back: verification, 2026-11-16

P22 reverses the launcher fork-mode switch of [the P19 verification record](plan-033-p19-verification-2026-11-16.md) for the factory and rewrites the coordinator runbook, bindings, worker texts, proof scenarios and tests so that the coordinator lets the Host start its workers (`factory-realizer`, `factory-evaluator`, `factory-sync`) in the foreground or the background, accepts either return shape, and is told by the runbook to wait for each worker's hand-back before moving on. Committed locally as `718ee34` ("feat(factory): P22, the coordinator runs its workers in the background and waits for each hand-back"; 40 files changed, 371 insertions, 167 deletions) on top of `8171fca`, on the branch of draft pull request 219 (`codex/plan-033-claude-delivery-nov10` against `dev`). Built in one slice from a read-only design paper (`scratch/plan-033-implementation/routed-2026-11-14/`) by one Claude subagent (Opus, medium effort) in its own worktree at `f48f5ea`, with one fix round after the lead's review, no independent second-Host review of the code, and gated on Windows before commit `718ee34`. Nothing of P22 was observed on the real Host: whether the coordinator ends its turn after a launch notice, waits for and continues on the hand-back, starts the second worker only after checking the first, or answers the human without advancing the journey is **not observed** (unverified), and what a headless `claude -p` session does without `run_in_background: false` is **not known**. See [ADR 0067](adr/0067-claude-factory-realization-delivery.md) (section dated 2026-11-16).

## Scope and baseline

- Date: 2026-11-16.
- Slice: P22.
- Branch: `codex/plan-033-claude-delivery-nov10`, draft pull request 219 against `dev`.
- Baseline: `8171fca` (implementation worker's worktree branched from `f48f5ea`).
- Local commit: `718ee34` ("feat(factory): P22, the coordinator runs its workers in the background and waits for each hand-back"), not yet pushed when these records were written.
- Diff scope: 40 files changed, 371 insertions, 167 deletions (39 modified files with 169 insertions and 167 deletions, and 1 new test file `tests/agent-factory-background-workers.test.ts` with 202 lines).
- Factory structure: the coordinator agent `orchestrator-agent-factory` (runbook: the Skill `coordinate-artifact`) starts three worker subagents with the `Agent` tool, one after another: `factory-realizer`, `factory-evaluator`, `factory-sync`. Because the journey is ordered (realize, caller checks, independent review, bounded repair), the coordinator needs each worker's result before its next step.
- Gate environment: Windows. Nothing of P22 ran on the real Host (**not observed**); Linux CI check `test` was green on `8171fca` (the commit before this one), and for `718ee34` it was not yet read (not pushed when these records were written).

## The history of the day and the decision

- History of one day, 2026-11-16 (all on Claude Code 2.1.325, interactive sessions, Windows):
  1. First sittings ([the interactive stage-proof observation](../host-library/claude/observations/2026-11-16-claude-2.1.325-factory-stage-proof-interactive.md)): the Host started workers in the background and the coordinator stopped, as its runbook then said (finding S4-A1).
  2. The maintainer decided "Yes, turn it off"; P19 (commit `071542f`, [the P19 verification record](plan-033-p19-verification-2026-11-16.md)) made the launcher turn fork mode off (`CLAUDE_CODE_FORK_SUBAGENT=0` in the launch environment and the `--settings` element); a re-sitting showed both workers in the foreground ([the fork-mode re-sitting observation](../host-library/claude/observations/2026-11-16-claude-2.1.325-factory-fork-mode-resit.md)).
  3. In the guard re-sitting ([the guard missing-script re-sitting observation](../host-library/claude/observations/2026-11-16-claude-2.1.325-factory-guard-missing-script-resit.md), part B), a plain session started a probe worker (`probe-readonly-worker`) in the background; its hand-back arrived as a message and the main session reported it.
- **The maintainer's decision**, in his words:
  - First, unprompted: "Actually I liked the Background worker operation. We can keep it as our default."
  - The lead then named the cost (the launcher change of P19 is reversed; the runbook and its tests are rewritten so that the runbook tells the coordinator to wait for each worker's hand-back; a new sitting is needed) and the gain (the human can talk to the coordinator while a worker runs), recommended keeping the foreground because the order of the journey depends on waiting, and asked: "Should the factory coordinator also run its workers in the background?" with the choices "Keep foreground" and "Switch to background".
  - The maintainer answered: **"Switch to background"**.

## Host documentation used

Verified in [sub-agents.md](../host-library/claude/pages/agent/sub-agents.md):

- Line 920: "With nothing configured, a subagent that Claude spawns from your main conversation starts in the background." Lines 922 to 923: `claude -p` "can wait, on its own judgment or when you ask"; in an interactive terminal session, Claude can wait for a subagent only when fork mode is off (line 923).
- Line 955: "A background subagent's results reach Claude as a completion notification in a later turn."
- Line 916: a background subagent runs concurrently while the user continues working, and when a background subagent reaches a tool call that needs permission, Claude Code surfaces the prompt in the main session and names the subagent that is asking. Line 951: "When you answer one of those prompts with a choice that lasts beyond that one tool call, such as a grant that lasts for the rest of the session, Claude Code applies your answer to the whole session, including your main conversation."
- Line 440: a background subagent keeps every MCP tool, but only a fixed list of built-in tools (`Read`, `Grep`, `Glob`, `LSP`, `Bash`, `PowerShell`, `Edit`, `Write`, `NotebookEdit`, `WebFetch`, `WebSearch`, `TodoWrite`, `Skill`, `ToolSearch`, `EnterWorktree`, `ExitWorktree`, `Monitor`, `TaskStop`, `SendMessage`, and `Artifact`, plus `SubagentHandback` for a subagent that reports through it), and Claude Code removes every other built-in tool whether inherited or listed in the `tools` field. Of the workers' listed tools, `ListMcpResourcesTool`, `ReadMcpResourceTool` and `ReportFindings` are not in that list.
- Line 310: frontmatter `background` set to `true` keeps a subagent in the background "even when Claude asks to wait for it".
- Line 925: for a skill with `context: fork`, Claude Code follows the rules for running skills in a subagent instead, whether or not fork mode is on.

## Design: the maintainer's decision and the lead's six choices

- **The maintainer's decision:** "Switch to background", reversing P19's fork-mode switch for the factory so that the coordinator accepts Host background launches and is told by its runbook to wait for each hand-back.
- **Lead's choices (six):**
  1. **Mechanism — the Host's default:** the launcher no longer touches fork mode; the agent-teams switch of P17 stays. The coordinator passes no `run_in_background` argument. No `background: true` anywhere: the coordinator and the three workers keep `background: false` (it does not force the foreground, as the first sittings showed, and a headless session must stay able to wait).
  2. **Both return shapes accepted:** a result in the same turn (a headless session, or a Host that waits) and a launch notice followed by a later hand-back. Everything after the return is unchanged (inspect the actual return, hash, run every caller check).
  3. **One wording for the rule (the "waiting rule"), verbatim in two places:** `registry/skills/coordinate-artifact/references/dispatch.md` and the coordinator's agent body `registry/hosts/claude/agents/orchestrator-agent-factory.md` (an interactive main session does not preload the Skill, finding S3-A, so the body must carry it). Every other place uses one fixed short sentence that points to it.
  4. **Limits unchanged:** `workerTurnsMaximum`, repair counts and per-job caps stay unchanged; one clarifying sentence is added in `registry/skills/coordinate-artifact/references/repair.md`: "Worker turns count worker dispatches; the coordinator's own turns while it waits for a hand-back, and the human's messages, do not consume them."
  5. **Typed authoring forks out of scope (lead's choice, told to the maintainer):** `author-skill`, `author-contract`, `author-bundle` (Skills with `context: fork` and `background: false` that the human types as slash commands), their return checkers and step 5 of the three authoring route references keep the foreground: the coordinator does not start them, and the Host runs such forks by its own rule whether or not fork mode is on (`sub-agents.md` line 925).
  6. **One slice, one worker:** the runbook and the launcher change together so nothing ships in between. The design paper had proposed two slices.

## The waiting rule and the fixed short sentence

The waiting rule stands verbatim once in `registry/skills/coordinate-artifact/references/dispatch.md` (line 6) and once in `registry/hosts/claude/agents/orchestrator-agent-factory.md` (line 57):

> Start one worker at a time with Agent: `subagent_type`, a description and a prompt that carries the complete fixed job and the caller-held digest; no teammate name, no model override, no `run_in_background`. If the call returns the worker's finished result, go on with the checks. If it returns a launch notice instead, the worker runs in the background: say in one line which worker runs, start no other worker, do nothing that depends on its result, and end your turn; do not poll, sleep or read Host session records. Its hand-back arrives later as a message: accept it only if it comes from the worker you started and repeats the job digest you hold, then treat it as the actual return and go on with the checks. While you wait you may answer the human, but change nothing under the job's roots and advance no step. Refuse and report a teammate, a fork of this conversation, a hand-back from a worker you did not start, and a partial or failed return. If no hand-back has come and the human asks, say that the worker still runs and the dependent step is not done; never invent a result or a timeout.

Every other place uses one fixed short sentence pointing to it:

- Outside `dispatch.md` and `orchestrator-agent-factory.md` (in both `coordinate-artifact` entries, `host-sync.md`, `skill-authoring.md` and `contract-authoring.md`): "Start it as an ordinary subagent and, when it runs in the background, wait for its hand-back as the waiting rule in dispatch says." (where "dispatch" is a relative Markdown link to `references/dispatch.md` from `SKILL.md` and to `dispatch.md` from sibling references).
- Inside `orchestrator-agent-factory.md` and inside `dispatch.md` itself: "Start it as an ordinary subagent and, when it runs in the background, wait for its hand-back as the waiting rule above says."

## The change

| Place | Before | After |
| :- | :- | :- |
| `src/core/claude-launcher.ts` (settings element, `plan.env`, `factoryLaunchShapeOk`, `launch`) | `CLAUDE_CODE_FORK_SUBAGENT` set to `0` in `plan.env` and `--settings={"env":{"CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS":"0","CLAUDE_CODE_FORK_SUBAGENT":"0"}}`; other-case spellings deleted at spawn; checked by `factoryLaunchShapeOk` and named in error text. | Fork variable gone from `plan.env`, `FACTORY_SESSION_SETTINGS_ARG` (`--settings={"env":{"CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS":"0"}}`), `factoryLaunchShapeOk`, parent-env removal and error text. A parent `CLAUDE_CODE_FORK_SUBAGENT` reaches the session unchanged. |
| `src/core/claude-launcher.ts` (bootstrap prompt, lines 309 to 310) | Told the coordinator to refuse a background mechanism. | Now says: "Start one worker at a time as an ordinary subagent and, when it runs in the background, wait for its hand-back as the waiting rule in your checked native main and the coordinate-artifact references/dispatch.md says. Inspect the actual Host result and refuse a fork, a teammate or a partial return." |
| `src/cli.ts` | Exported `describeClaudeForkModeOff` and `describeClaudeForkModeNoteLine`; printed "Fork mode" line in dry run and start note; dry-run env ended with `CLAUDE_CODE_FORK_SUBAGENT=0`. | Both functions deleted; dry run and start note print no "Fork mode" line; dry-run env line no longer ends with `CLAUDE_CODE_FORK_SUBAGENT=0`. |
| `src/core/claude-factory-binding.ts` (line 100) | Error text "must select foreground background: false". | Error text "must declare background: false"; the check itself (`facts.meta.background !== false`) is unchanged. |
| `registry/skills/coordinate-artifact/references/dispatch.md` | Required foreground workers and `run_in_background: false`; refused background launches; P19 six-file entry sentence. | New title "Reviewed ordinary subagent dispatch"; waiting rule verbatim once; fixed short sentence ("the waiting rule above"); updated six-file entry sentence. |
| `registry/hosts/claude/agents/orchestrator-agent-factory.md` | Required foreground workers; held P19 entry sentence; 15,030 LF characters. | Waiting rule verbatim once; fixed short sentence in evaluator and sync paragraphs; updated six-file entry sentence; moved "This is an intermediate consumer, not a complete factory, automated quality judgment or live proof." into body (tenth obligation in the moved-rules test); 16,274 LF characters (no test limit). |
| Both `coordinate-artifact` `SKILL.md` entries (`registry/skills/coordinate-artifact/SKILL.md` and `registry/hosts/claude/skills/coordinate-artifact/SKILL.md`) | Step 3 asked for foreground; edge cases said "unexpected fork/background/teammate returns"; held "This is an intermediate consumer..." sentence; native 5,787 LF chars (limit 5,788), shared 5,406 LF chars (limit 6,000). | Step 3 uses the fixed short sentence; edge cases say "fork/teammate returns"; intermediate-consumer sentence moved to agent body; native 5,774 LF chars (pinned limit 5,788), shared 5,393 LF chars (limit 6,000). |
| Six-file entry sentence (`orchestrator-agent-factory.md`, `dispatch.md`, `host-sync.md`, `skill-authoring.md`, `contract-authoring.md`, `bundle-authoring.md`) | Named both agent teams and fork mode off and refused a worker that starts as a teammate or in the background. | Now in all six: "The launcher turns agent teams off for the factory's own session and does not refuse a dry run because `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` is set; with direct `claude --agent` entry that switch does not apply, so a worker that starts as a teammate is refused and reported." |
| Other coordinator texts (`host-sync.md`, `skill-authoring.md`, `contract-authoring.md`, `repair.md`, `evals.json`, `fixtures.json`, `setup.md`, `claude-agent-journey.md`) | Foreground dispatch wording; no waiting-turn clarification in `repair.md`. | Fixed short sentence in `host-sync.md`, `skill-authoring.md` and `contract-authoring.md`; `repair.md` adds the waiting-turn clarification; evals and worked example reworded. |
| Workers and four binding files (`factory-realizer.md`, `factory-evaluator.md`, `factory-sync.md`, worker Skills, `agent-factory-*.binding.json`) | Said "ordinary foreground"; bindings said `run_in_background: false`. | Worker bodies and Skills (`evaluate-artifact` entries and `handback.md`, native `realize-artifact` entry, `sync-host` entries and `handback.md`) say "returns once, in the foreground or the background" and name `ListMcpResourcesTool`, `ReadMcpResourceTool` and `ReportFindings` "when supplied"; bindings drop `run_in_background: false`. |
| `scripts/factory-proof-scenarios.mjs` | S4 part A Step 0 expected `TEAMS=[0] FORK=[0]`; step 3 asked for foreground, included background fallback prompt, bound 6 prompts (5 + 1); S3 step 5 did not tell coordinator to wait for evaluator. | S4 part A Step 0 expects `TEAMS=[0]` and no `FORK` value is a failure; step 3 expects realizer start, one-line notice and end of turn, hand-back report, then evaluator start ("If not" flags refusing background or starting both at once), fallback prompt gone, bound 5 prompts (4 in part A, 1 in part B); S3 keeps foreground for typed forks and step 5 tells coordinator to wait for each evaluator's result. |

## What did not change and why

- **Typed authoring forks (`author-skill`, `author-contract`, `author-bundle`):** their `context: fork` and `background: false` frontmatter, their three return checkers (`check-skill-return.mjs`, `check-contract-return.mjs`, `check-bundle-return.mjs`) and step 5 of `skill-authoring.md`, `contract-authoring.md` and `bundle-authoring.md` keep the foreground (**lead's choice**, out of scope): the coordinator does not start them, and `sub-agents.md` line 925 states that the Host runs `context: fork` Skills by its own rule whether or not fork mode is on.
- **`background: false` on coordinator and workers:** `orchestrator-agent-factory`, `factory-realizer`, `factory-evaluator` and `factory-sync` still declare `background: false`, and `src/core/claude-factory-binding.ts` still checks `facts.meta.background !== false`. `background: false` does not force the foreground (as the first sittings showed), and a headless session must stay able to wait.
- **`tools:` lines:** no `tools:` line changed in any agent file; `ListMcpResourcesTool`, `ReadMcpResourceTool` and `ReportFindings` are named "when supplied" in worker texts because background subagents do not receive them (`sub-agents.md` line 440).
- **Limits:** `workerTurnsMaximum`, repair counts and per-job caps are unchanged (`repair.md` clarifies that waiting and human turns do not consume worker turns).
- **Generated blocks, pinned hashes and versions:** no generated block, no pinned hash and no version changed.
- **P17's agent-teams switch and headless preparation prompts:** `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` = `0` stays in `plan.env` and `FACTORY_SESSION_SETTINGS_ARG`, and the headless prompts (those of S1 and S2 in `scripts/prepare-factory-proof.mjs`, and `buildS5Prompts()` in `scripts/factory-proof-scenarios.mjs`) held no "foreground" and are unchanged.

## Enforcement kind, stated honestly

- **Enforced by code or the tool pool:**
  - the agent-teams switch in launcher sessions (`src/core/claude-launcher.ts`);
  - the coordinator's `Agent` grant for exactly the three workers;
  - that the coordinator holds no tool to query or stop a background task;
  - every caller check after a return (they refuse a wrong digest, wrong bytes or a missing record, if they are run).
- **PROSE ONLY** (an instruction, not a barrier; no script or hook stands behind it):
  - one worker at a time;
  - doing nothing that depends on the result after a launch notice;
  - ending the turn;
  - matching the hand-back to the worker started and to the job digest;
  - changing nothing under the job's roots while answering the human;
  - refusing a fork or a hand-back from a worker it did not start;
  - not inventing a result or a timeout.
- **What the offline tests prove:** the offline tests prove that the texts say this, in one wording, and that the launcher no longer touches fork mode. They do not prove that a model follows the rule.

## Tests

- **New `tests/agent-factory-background-workers.test.ts` (202 lines, 27 tests; offline, no Host):**
  - the waiting rule verbatim exactly once in `dispatch.md` and in the coordinator agent body, also in the installed copies, and in neither `coordinate-artifact` entry;
  - no coordinator file with `run_in_background` outside the waiting rule, "foreground" or a refusal of a background worker, apart from the stated typed-fork exceptions;
  - step 5 of each authoring route unchanged;
  - the six-file entry sentence new everywhere and the P19 sentence nowhere;
  - the launcher plan without the fork variable and with the agent-teams switch;
  - a parent `CLAUDE_CODE_FORK_SUBAGENT` of `0` or `1` passed through unchanged;
  - no fork-mode line in the dry run (both renderer and built CLI);
  - the bootstrap prompt without background-mechanism refusal and with fork/teammate/partial refusal;
  - `background: false` on the three workers and the coordinator;
  - the typed entries' `context: fork` and `background: false`;
  - the three return checkers still refusing another `background` value.
- **Against the previous commit (`f48f5ea`):** run by the implementation worker against an untouched copy of `f48f5ea`, the 16 tests for the change fail there and the 11 tests for what stays pass.
- **Updated for the old wording or mechanism (8 files):** `tests/agent-factory-coordinator-launcher.test.ts`, `tests/agent-factory-coordinator-delivery.test.ts`, `tests/agent-factory-native-delivery.test.ts`, `tests/agent-factory-sync-delivery.test.ts`, `tests/agent-factory-sync-text.test.ts`, `tests/agent-factory-proof-fixes.test.ts`, `tests/factory-proof-prep.test.ts`, `tests/helpers/factory-evaluator.ts`.

## How the work was done

- **Design paper first:** a read-only worker (Antigravity, Gemini 4 Hydrogen, effort extra) through `host-agent-router`, from a brief with the file list; it changed nothing. It recommended the Host default, typed forks out of scope and two slices; it could not read the binding files and several sources and said so. Paper and briefs: `scratch/plan-033-implementation/routed-2026-11-14/`.
- **Implementation:** a Claude subagent (Opus, medium effort) of the lead session, in its own worktree at `f48f5ea`, from a written brief that fixed the design and the rule's wording; it never committed. It classified every hit of its search (222 hits in 33 files about the factory's workers or the coordinator's dispatch; 81 hits in 28 files about the typed forks; 664 hits in 232 files about other things) and changed only the first class.
- **Lead's review:** the whole diff read. One fix round with one point: inside `dispatch.md` the fixed short sentence linked to `dispatch.md` itself; it now says "the waiting rule above".
- **No independent second-Host review of the code:** none was run for this slice.
- **Long test runs:** the harness moved the worker's long test runs to the background after 180 seconds; the worker waited for each. The lead checked once by process list that the run was alive before telling the maintainer so.

## Lead's acceptance and gate

- **Lead's acceptance in the worker's worktree:**
  - `npm run typecheck`: exit 0; `npm run build`: exit 0.
  - Ten test files (the new file, launcher, delivery, package, native delivery, sync delivery, sync text, proof fixes, no-aggregate-budget, native agents): exit 0, 499 passed, 287.17 s.
  - `tests/factory-proof-prep.test.ts`: exit 0, 51 passed, 53.49 s.
  - The worker's name-selected run: 118 files passed, 1,583 tests passed, exit 0.
- **Gate (Windows, on the main checkout with the change applied on `8171fca`, before commit `718ee34`):** raw files in `logs/plan-033-p22-2026-11-16/` (each step has `.command.txt`, `.stdout.txt`, `.stderr.txt`, `.exit.txt`).

| Step | Command | Exit | Result |
| :- | :- | :- | :- |
| hostlib-verify | `npm run hostlib:verify` | 0 | "host library snapshots match their lockfiles and every guide citation resolves" |
| typecheck | `npm run typecheck` | 0 | no error |
| full-test-serial | `env -u CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS npm test -- --maxWorkers=1 --fileParallelism=false` | 0 | 309 test files passed; 7,782 tests passed, 224 skipped (8,006); 1737.11 s |
| addon-matrix | `AGENTS_CI_FULL=1 env -u CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS npx vitest run tests/e2e-domain-conformance.test.ts --maxWorkers=1 --fileParallelism=false` | 0 | 1 test file passed; 317 tests passed; 432.51 s |

- **Linux CI:** the check `test` was green on `8171fca` (the commit before this one); for `718ee34` it is not yet read (not pushed when these records were written).

## Limits and what is not known

1. **Not observed on the real Host:** anything of P22. In particular: that the coordinator ends its turn after a launch notice and continues correctly on the hand-back; that it starts the second worker only after the first hand-back was checked; that it answers the human in between without advancing the journey; a full realize-and-review journey with background workers.
2. **Not known:** what a headless `claude -p` session does when the coordinator no longer passes `run_in_background: false` (the documentation says it "can wait, on its own judgment or when you ask"; the headless runs of 2026-11-15 passed `false`). If such a session ended its turn after a launch notice, a headless run could stop before the hand-back. Not run; a headless re-run needs the maintainer's go-ahead.
3. **Tools:** a background worker is not supplied `ListMcpResourcesTool`, `ReadMcpResourceTool` and `ReportFindings` (documentation; the background tool list of a factory worker was not read from a record). No worker needs them for its job (pinned local files; `ReportFindings` is presentation only), and the texts now say "when supplied". Two validators (`src/core/claude-factory-binding.ts` and the factory check) still compute the workers' grant as declared, for `background: false`; the smaller background set is not modelled there.
4. **Permission prompts:** permission prompts of a background worker surface in the main session, and a lasting answer applies to the whole session (documentation). The sittings so far ran in permission mode `auto`; not observed in another mode.
5. **Direct entry, managed settings and user fork setting:** direct `claude --agent` entry, managed settings and a user's own `CLAUDE_CODE_FORK_SUBAGENT=0`: the runbook accepts either shape; none of these was run.
6. **Stopping or leaving a background run:** the human can stop a background worker or leave the session while it runs; nothing blocks that. A later run's preflight refuses leftover drafts.
7. **Earlier records superseded for the factory's workers, without editing them:** in [ADR 0067](adr/0067-claude-factory-realization-delivery.md) the statements that demand a foreground worker or `run_in_background: false` (the sections "Refresh and numbering amendment — 2026-10-28", "Proposed decision", "2026-11-11 — accepted P7 coordinator boundary"), the section "2026-11-16 — P19: the launcher also turns fork mode off for the factory session" (superseded in full; P17's agent-teams switch stays), and the standing claim of "2026-11-16 — P19 observed once: workers run in the foreground" (the observation stays true as history); likewise [the P19 verification record](plan-033-p19-verification-2026-11-16.md).

## Open items for the maintainer

1. A sitting that observes the waiting (prepared after this commit): whether the coordinator starts a worker in the background, ends its turn, continues on the hand-back, starts the second worker only then, and answers a question in between (**not observed**).
2. Go-ahead for one headless re-run, to learn whether a headless coordinator still waits now that it no longer asks for the foreground.
3. Unchanged from before: a re-sitting of the Skill route for the evals file (P21); whether postflight should refuse a draft without `evals/evals.json`; whether the legacy inline guard and the settings-level session guard should block when they cannot run; whether the supported floor should be raised to 2.1.295; whether the destructive guard should block unreadable input; whether the seconds and bytes of the dropped aggregate budget should have stayed (P18); the `Skill` tool grant for the coordinator; reliance on the fallback read (S3-A); the launcher's `.cmd` shim fault (own pull request); a full interactive realize-and-review journey (now with background workers).

## Next

A short interactive sitting that observes the waiting is prepared for the maintainer from `718ee34`; slice 4.5 (the Claude stage review) follows after it.
