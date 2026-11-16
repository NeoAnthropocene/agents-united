# Plan 033 P23, fixes after the stage review and the second-Host code review: verification, 2026-11-16

P23 is the first part of slice 4.5 (the Claude stage review): it records the findings of two independent read-only second-Host reviews — a review of the whole Claude stage and a code review of P18, P21 and P22 — and applies the fixes that follow from them, amends the waiting rule (prose only) and adds a short state line at the head of each of the thirteen Claude-stage rows in [the completion matrix](plan-033-completion-matrix.md). Committed locally as `d24de09` ("fix(factory): P23, fixes after the stage review and the second-Host code review"; 18 files changed, 133 insertions, 30 deletions) on top of `ac6914b`, on the branch of draft pull request 219 (`codex/plan-033-claude-delivery-nov10` against `dev`). Built by one Claude subagent (Sonnet) in its own worktree at `ac6914b` from two written briefs, with two stops by the worker and one fix round after the lead's review, and gated on Windows before commit `d24de09`. No decision of the maintainer was needed for this slice; every design point here is the **lead's choice** and is told to the maintainer. Nothing of P22 or P23 was observed on the real Host (**not observed**, unverified), and whether a headless `claude -p` session offers `run_in_background` and waits is **not known**. See [ADR 0067](adr/0067-claude-factory-realization-delivery.md) (section dated 2026-11-16) and [the P22 verification record](plan-033-p22-verification-2026-11-16.md).

## Scope and baseline

- Date: 2026-11-16.
- Slice: P23 (the first part of slice 4.5, the Claude stage review).
- Branch: `codex/plan-033-claude-delivery-nov10`, draft pull request 219 against `dev`.
- Baseline: `ac6914b` (the commit before this slice, which holds P22 and its records).
- Local commit: `d24de09` ("fix(factory): P23, fixes after the stage review and the second-Host code review"), not yet pushed when these records were written.
- Diff scope: 18 files changed, 133 insertions, 30 deletions.
- Decisions: no decision of the maintainer was needed for this slice; every design point here is the lead's choice and is told to the maintainer.
- Gate environment: Windows. Nothing of P22 or P23 ran on the real Host (**not observed**); Linux CI check `test` is green on `ac6914b`, and for `d24de09` it is not yet read (not pushed when these records were written).

## The two reviews

Two independent reviews were run first, both read-only, both by a second Host (Antigravity, Gemini 4 Hydrogen, effort extra) through `host-agent-router`, both from a written brief with the list of files to read; neither changed anything. Reports: `scratch/plan-033-implementation/routed-2026-11-14/`.

1. **Whole Claude stage review:** the completion matrix row by row, every finding of the observation records and whether its fix was seen again on the Host, contradictions between records and shipped texts, rules that are **prose** only, the maintainer's open decisions, and what must still be observed.
2. **Code review of the three slices that had none:** P18 (commit `5547450`), P21 (`f48f5ea`) and P22 (`718ee34`). P19 had none either and is reversed by P22.

## What the stage review found

The lead checked each point named here against the repository files:

- **Verdicts for the 13 Claude-stage rows of the completion matrix:** 1 closed, 3 closed with a limit, 9 open. The reason for most "open" verdicts: a fix or a change was never seen again on the real Host after it was made, and no full interactive journey (realize, caller checks, review, one repair) has ever run to its end.
- **Findings whose fix was never re-observed on the Host:** S1-A (headless), S1-B, S2-A, S2-B, S2-C, S3-C (answered by P21), and S4-A1 as now answered by P22. Re-observed: S1-C (agent teams off) and S4-A2 (guards, script-file form). S3-A has no fix: an `--agent` main session does not get its Skill preloaded and reads the entry itself (a decision is open whether that is accepted as a limit).
- **Three stale or contradictory sentences in shipped texts:** fixed in this slice (see the change table below).
- **Stale matrix cells:** most rows' "Current state" text stops at an earlier slice or is too long to read a state from (this slice adds a state line at the head of each Claude-stage row; see the matrix state lines section below).
- **Statements in earlier records superseded by later slices without being named:** left as they are (records describe what was true when written); the stage-close record will list them.

## What the code review found

Taken into this slice:

1. The waiting rule of P22 told the coordinator to end its turn after a launch notice. In a headless session (`claude -p`) ending the turn ends the session, so a worker started in the background could be lost. The rule also said the hand-back arrives "as a message", while the Host documentation speaks of a completion notification; it did not refuse a result with another digest; it had no way out when a worker never reports; and its prompt shape ("the complete fixed job") did not fit the sync route, which passes the job's path.
2. Step 4 of both `coordinate-artifact` entries (the evaluator) did not point to the waiting rule; only step 3 (the realizer) did.
3. Three binding files and the native `realize-artifact` entry said "wait for its hand-back ...; verify actual launch result": the order was inverted.
4. The launcher's bootstrap prompt said "a partial return" where the rule says "a partial or failed return".
5. P21: both `author-skill` entries named `evals/evals.json` only through a link in the step AFTER the one that runs `draft.mjs`; `skill-authoring.md` did not say which role the evals path gets.
6. The tests of P22 scanned only the coordinator's files for a foreground demand, not the workers' files, the bindings or the proof kit, and did not check step 4.
7. The proof kit's probe steps hold no job, so the rule's digest check had nothing to compare; the plain-session probe step did not say that the worker may run in the background.

Not taken (recorded here as known and left):

- The launcher's error texts say "foreground project" about the MAIN session started with `--bg` (true, though easy to misread).
- `assets/report.json` lists the three coordinator limits and not the per-job caps.
- `repair.md` does not mention that the sync route allows no repair.
- The worker-turn clarification of `repair.md` is not repeated in the agent body.
- The evals fixtures' sentence about "remaining per-job budgets after r1, never reset counters" (the worker read it: it is the repair-budget fixture, about one job's own caps, and does not conflict with "no aggregate budget").

## The change

The waiting rule stands verbatim once in `registry/skills/coordinate-artifact/references/dispatch.md` (line 6) and once in `registry/hosts/claude/agents/orchestrator-agent-factory.md` (line 57), and as the constant of `tests/agent-factory-background-workers.test.ts`:

> Start one worker at a time with Agent: `subagent_type`, a description and a prompt that carries the fixed job, or its path where the route says so, and the caller-held digest; no teammate name, no model override. Pass no `run_in_background`, except `false` in a headless session (`claude -p`) when the tool offers it: there, ending your turn ends the session. If the call returns the worker's finished result, go on with the checks. If it returns a launch notice instead, the worker runs in the background: say in one line which worker runs, start no other worker, do nothing that depends on its result, and end your turn; do not poll, sleep or read Host session records. Its result arrives later by itself, as a hand-back message or a completion notice: accept it only if it comes from the worker you started and repeats the digest you hold, then treat it as the actual return and go on with the checks. While you wait you may answer the human, but change nothing under the job's roots and advance no step. Refuse and report a teammate, a fork of this conversation, a result from a worker you did not start, a result with another digest, and a partial or failed return. If no result has come and the human asks, say that the worker still runs and the dependent step is not done; if the human tells you to stop waiting, report the journey as blocked at that worker and whatever it may have written as unverified. Never invent a result or a timeout.

The headless exception (`run_in_background: false` in a headless session when the tool offers it) is the **lead's choice** (a safeguard; the maintainer's "Switch to background" is about sessions he sits at). It is **prose**, and it is **not observed**: whether a headless Host offers the parameter and waits is **not known**.

| Place | Before | After |
| :- | :- | :- |
| Waiting rule (`registry/skills/coordinate-artifact/references/dispatch.md` line 6, `registry/hosts/claude/agents/orchestrator-agent-factory.md` line 57, `tests/agent-factory-background-workers.test.ts`) | Ended turn unconditionally after a launch notice; said hand-back arrives "as a message"; did not refuse another digest; had no stop-waiting exit; prompt shape named "the complete fixed job" only. | Amended waiting rule quoted above: adds the headless `run_in_background: false` exception (lead's choice), "a hand-back message or a completion notice", repeating and refusing another digest, the human stop-waiting exit, and "the fixed job, or its path where the route says so". |
| Both `coordinate-artifact` entries, step 6 (`registry/skills/coordinate-artifact/SKILL.md`, `registry/hosts/claude/skills/coordinate-artifact/SKILL.md`) | "account for every process/byte/time limit" (missed when P18 removed the aggregate budget). | "account for each job's caps and the turn/repair limits" |
| `registry/hosts/claude/agents/orchestrator-agent-factory.md` (line 47) | "The required coordinate-artifact preload provides the job, ..." | "The coordinate-artifact Skill, preloaded or read as above, provides the job, ..." (the Host does not preload it for an `--agent` main). |
| `registry/skills/coordinate-artifact/references/dispatch.md` (line 4) | "Inspect the reviewed surface/configuration for ordinary non-fork workers. Current fork defaults vary; do not change user settings, invent a per-call fork flag or switch to teams/workflows." | "The workers are ordinary subagents, never a fork of this conversation. The Host decides whether an Agent call returns the worker's result at once or only a launch notice (its fork-mode default varies); do not change user settings, invent a per-call flag or switch to teams/workflows." |
| Both `coordinate-artifact` entries, steps 3 and 4; `orchestrator-agent-factory.md` (line 47) | Step 3 began with "Start it as an ordinary subagent..."; step 4 began "Invoke a fresh independent evaluator..."; worked-example sentence sat in both entries (native 5,774 LF chars within 5,788; shared 5,393 within 6,000). | Step 3 pointing sentence reads "Start every worker as an ordinary subagent and, when it runs in the background, wait for its hand-back as the waiting rule in dispatch says." (where dispatch links to `references/dispatch.md`); step 4 begins "Start a fresh independent evaluator the same way, with complete job/candidate digests;"; worked-example sentence moved to the agent body as "The Skill's worked example illustrates record plumbing, not a model invocation or useful independent judgment." (eleventh moved obligation; native entry 5,723 LF chars within pinned limit 5,788, shared 5,342 within 6,000). |
| Bindings (`registry/hosts/claude/agent-factory-evaluate.binding.json`, `agent-factory-realize.binding.json`, `agent-factory-sync.binding.json`) and native `registry/hosts/claude/skills/realize-artifact/SKILL.md` | Invocation texts said "wait for its hand-back ...; verify actual launch result" (inverted order). | Invocation texts say "verify the actual launch result, then wait for the worker's result when it runs in the background" (in `realize-artifact/SKILL.md`: "Verify the actual host launch result before assuming the mechanism, then wait for the worker's result when it runs in the background"). |
| `src/core/claude-launcher.ts` (bootstrap prompt, line 309) | Ended with "refuse a fork, a teammate or a partial return". | Ends with "refuse a fork, a teammate or a partial or failed return". |
| P21 follow-up (`registry/skills/author-skill/SKILL.md`, `registry/hosts/claude/skills/author-skill/SKILL.md`, `registry/skills/coordinate-artifact/references/skill-authoring.md`) | Both `author-skill` entries named `evals/evals.json` only through a link in the step after `draft.mjs` (shared 4,428 and native 4,960 LF chars); `skill-authoring.md` did not state the evals role. | Step 5 of both `author-skill` entries says "the changes include `evals/evals.json` in the format of quality" (where quality links to `references/quality.md`) before the helper runs (shared 4,518 and native 5,050 LF chars, limit 6,000); `skill-authoring.md` says the evals path gets "the role `support`". |
| Proof kit (`scripts/factory-proof-scenarios.mjs`, `scripts/prepare-factory-proof.mjs`) | Probe steps held no job or digest token; plain-session probe did not state that the worker may run in the background; S1 and S2 headless prompts lacked a headless turn-ending warning. | Guards sitting's worker step gives a probe token as the held digest (`PROBE-1` for `factory-realizer`, `PROBE-2` for `factory-evaluator`) and expects each worker's answer to name its token; plain-session probe says the worker may run in the background and gives the one answer to type if Claude asks whether to wait; S1 and S2 headless prompts in `scripts/prepare-factory-proof.mjs` begin "This is a headless session (claude -p): ending your turn ends the session, so wait for each worker's result in the same turn." (the three S5 prompts start no worker and are unchanged). |
| Tests (`tests/agent-factory-background-workers.test.ts`, `tests/agent-factory-no-aggregate-budget.test.ts`, `tests/agent-factory-coordinator-delivery.test.ts`, `tests/factory-proof-prep.test.ts`) | P22 scan covered coordinator files only and did not check step 4. | `tests/agent-factory-background-workers.test.ts` updates the rule constant, checks steps 3 and 4 of both entries, widens the scan for `run_in_background` and a foreground demand across worker agents, worker Skills, four bindings and the proof kit (with six literal exceptions each with its reason), and checks binding order and the two reworded sentences; `tests/agent-factory-no-aggregate-budget.test.ts` checks no "process/byte/time" in either entry; `tests/agent-factory-coordinator-delivery.test.ts` checks the eleventh moved obligation; `tests/factory-proof-prep.test.ts` updated for the proof kit. |

## How the work was done

- One Claude subagent (Sonnet) of the lead session, in its own worktree at `ac6914b`, from two written briefs (the three sentences first, the code-review points second); it never committed.
- It stopped twice, correctly, instead of working around a limit:
  1. The first new sentence did not fit the native `coordinate-artifact` entry's pinned length; the lead gave a shorter wording and no pin was raised.
  2. The lead's first wording for the `dispatch.md` sentence contained the word "foreground", which a guard test of P22 forbids in the coordinator's files; the lead's wording was wrong and the guard stayed.
- One more fix round by the lead's review: the sentence moved into the agent body had lost what it refers to ("It illustrates ..."); it got its subject and another place.
- The worker's first choice of a sentence to move (the anti-patterns line) made `skill-check` report "no anti-patterns" for the shared entry; it put the line back and moved another.

## Tests

- `tests/agent-factory-background-workers.test.ts`: carries the amended `WAITING_RULE` constant, verifies steps 3 and 4 of both `coordinate-artifact` entries, runs the widened scan across the three worker agent files, the worker Skills (`realize-artifact`, `evaluate-artifact`, `sync-host` in shared and native copies), the four binding files (`coordinate`, `evaluate`, `realize`, `sync`) and `scripts/factory-proof-scenarios.mjs` for `run_in_background` and a foreground demand with six literal exceptions each with its reason, checks the launch-then-wait order in the three worker bindings and native `realize-artifact`, and checks the two reworded sentences in `dispatch.md` and `orchestrator-agent-factory.md`.
- The worker proved the widened scan by a temporary edit: with "Start the factory-realizer subagent in the foreground" put back into the proof kit, the scan fails.
- `tests/agent-factory-no-aggregate-budget.test.ts`: checks that neither `coordinate-artifact` entry contains "process/byte/time".
- `tests/agent-factory-coordinator-delivery.test.ts`: checks the eleventh moved obligation in `orchestrator-agent-factory.md`.
- `tests/factory-proof-prep.test.ts`: updated for the proof-kit changes.

## Lead's acceptance and gate

- **Lead's acceptance in the worker's worktree:**
  - `npm run typecheck`: exit 0.
  - `npm run build`: exit 0.
  - Fourteen test files (the two with new tests, coordinator delivery, package and launcher, proof fixes, native agents, bundle return, contribution runbook, sync delivery and text, native delivery, the two `author-skill` files): exit 0, 833 passed and 1 skipped in 387.18 s.
  - `tests/factory-proof-prep.test.ts`: exit 0, 52 passed in 50.64 s.
  - `skill-check` on `registry/skills/author-skill` under the policy `agents-united-original`: exit 0.
- **Gate on Windows (on the main checkout with the change applied on `ac6914b`, before commit `d24de09`):** raw files in `logs/plan-033-p23-2026-11-16/` (each step has `.command.txt`, `.stdout.txt`, `.stderr.txt`, `.exit.txt`):

| Step | Command | Exit | Result |
| :- | :- | :- | :- |
| hostlib-verify | `npm run hostlib:verify` | 0 | "host library snapshots match their lockfiles and every guide citation resolves" |
| typecheck | `npm run typecheck` | 0 | no error |
| full-test-serial | `env -u CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS npm test -- --maxWorkers=1 --fileParallelism=false` | 0 | 309 test files passed; 7,791 tests passed, 224 skipped (8,015); 1718.34 s |
| addon-matrix | `AGENTS_CI_FULL=1 env -u CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS npx vitest run tests/e2e-domain-conformance.test.ts --maxWorkers=1 --fileParallelism=false` | 0 | 1 test file passed; 317 tests passed; 434.80 s |

- **Linux CI:** the check `test` is green on `ac6914b` (the commit before this one, which holds P22 and its records); for `d24de09` it is not yet read (not pushed when these records were written).

## Limits and what is not known

1. **Not observed** on the real Host: anything of P22 and P23 (the waiting rule in either wording), and the evals route of P21. A short sitting for the P22 wording was with the maintainer when P23 was built; it was prepared from `718ee34`, so it shows the first wording, not the amended one.
2. **Not known:** whether a headless Host offers `run_in_background` and waits (the headless runs of 2026-11-15 on 2.1.323 passed `false` and got foreground returns; not re-run).
3. `skill-check --policy agents-united-original` on the coordinator's own Skill `registry/skills/coordinate-artifact` exits 1 with layout findings about `${CLAUDE_SKILL_DIR}` paths in the shared entry. It exits 1 in the same way on the commit before this slice (`ac6914b`; compared by the lead: the two reports differ only in the candidate digest), so this slice did not cause it. Not fixed here.
4. The widened test scan uses literal exceptions; a foreground demand phrased without the word "foreground" would pass it.
5. The offline test of the Skill route rewrites the corpus file to LF line ends before `skill-check`; `skill-check` accepts only the exact bytes of the reviewed corpus, and the corpus file is kept with LF line ends by the repository's attributes, so on a normal checkout the rewrite changes nothing (the worker read the code; not run with a CRLF corpus).

## Matrix state lines

The lead adopts the stage review's verdicts (1 closed, 3 closed with a limit, 9 open) and adds a short state line at the head of each of the 13 Claude-stage rows in [the completion matrix](plan-033-completion-matrix.md) (the three rows for the other Hosts are unchanged):

| Row | State line |
| :- | :- |
| Foundation/basic contract/catalog | State 2026-11-16: CLOSED. Merged earlier; later validator edits ride on draft pull request 219. |
| Approved first skill/attribution | State 2026-11-16: OPEN. Offline complete, with the evals route (P21, P23); the one headless comparison showed no quality gain; a live Skill route after P21 is not observed. |
| Claude P1 native-only delivery | State 2026-11-16: CLOSED WITH LIMIT. Windows gates and Linux CI are green on draft pull request 219 (unmerged); worker closures are checked through the coordinator only. |
| Claude P2 realizer | State 2026-11-16: OPEN. A headless run showed a foreground realizer once; a background dispatch (P22, P23), an interactive real job and a repair revision are not observed. |
| Shared definition/contract authoring helper | State 2026-11-16: CLOSED WITH LIMIT. The typed contract route was shown once for a create task; reuse, update, repair and the review after it are not observed. |
| Domain/Organization templates | State 2026-11-16: OPEN. The typed Bundle route was shown once; live Organization provisioning, reload and authorization boundaries are not observed. |
| Factory evaluator | State 2026-11-16: OPEN. Its record has not passed the caller's check in a live run (finding S1-B; the P16 fix is not re-observed); a background run is not observed. |
| Factory orchestrator/pipeline | State 2026-11-16: OPEN. Offline complete through P23; the waiting rule and a full interactive journey with one repair are not observed; headless behaviour is not known. |
| Current Claude session-helper distribution | State 2026-11-16: CLOSED WITH LIMIT. Offline and Linux CI; unmerged on draft pull request 219. |
| Host-update sync after realize | State 2026-11-16: OPEN. One headless run passed before P16 and P22; the P16 fixes and the sync worker under the waiting rule are not re-observed. |
| Factory hooks | State 2026-11-16: OPEN. Guards block when their script is missing (shown once, script-file form, P20); the legacy and session guards, the version floor and unreadable input await decisions; the inline form and older Hosts are not observed. |
| Claude stage quality and proof | State 2026-11-16: OPEN. See the rows above; a second-Host review of P18, P21 and P22 was done and answered in P23; two interactive sittings and one headless run are outstanding. |
| Contribution route | State 2026-11-16: OPEN. Texts and tests are offline complete; one headless run prepared a pull-request body; the checkout commands and interactive use are not observed. |

## The maintainer's open decisions

**Blocking a stage close:**

1. Two interactive sittings: A, a full journey with background workers and one repair; B, the typed routes after the evals change. (The lead prepares them from this slice's commit.)
2. Go-ahead for one headless re-run. (Asked on 2026-11-16; no answer yet.)
3. Accept as limits of the stage, without further work: no preload for an `--agent` main (the coordinator reads its entry itself); the three typed authoring commands stay typed by the human (no `Skill` tool grant for the coordinator); no measured quality gain of `author-skill` (the one comparison was a tie); no live proof of Organization provisioning; the contribution commands are prepared but not run by the factory. (Lead's proposal: accept all five as limits.)
4. The 1,800 seconds and 8 MiB dropped with the 24-process budget in P18. (Lead's proposal: they stay dropped.)

**Not blocking:**

5. Whether postflight should refuse a draft without `evals/evals.json`.
6. Whether the legacy inline guard and the settings-level session guard should block when they cannot run.
7. Whether the supported floor should be raised to 2.1.295.
8. Whether the destructive guard should block a call whose input it cannot read.
9. The launcher's `.cmd` shim fault (own pull request).
10. `skill-check` under the in-house policy fails on the coordinator's own Skill (limit 3 above): fix or record.

## Next

Two interactive sittings (A: a full journey with background workers and one repair; B: the typed routes after the evals change) are prepared for the maintainer from `d24de09`; the stage-close record follows after them and after his decisions.
