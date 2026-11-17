# Plan 033 P18, the factory runbook states no aggregate journey budget: verification, 2026-11-16

P18 removes the aggregate journey budget from the agent factory's runbook on the Claude Host on top of baseline `089dbcb` (the P17 records commit on `codex/plan-033-claude-delivery-nov10`, draft pull request 219 against `dev`). It changes text, one report guide, eval fixtures, the proof preparation script and tests (18 modified files and 1 new test file), and changes no checker script, no job schema and nothing under `src/`. Built by one Claude subagent in its own worktree with one fix round after the lead's review, gated on Windows before local commit `5547450` ("fix(factory): P18, the runbook states no aggregate journey budget"; 19 files), with no second-Host review and nothing observed on the real Host. See [ADR 0067](adr/0067-claude-factory-realization-delivery.md) (section dated 2026-11-16).

## Scope and baseline

- Date: 2026-11-16.
- Branch: `codex/plan-033-claude-delivery-nov10`, draft pull request 219 against `dev`.
- Baseline: `089dbcb` (the P17 records commit).
- Local commit: `5547450` ("fix(factory): P18, the runbook states no aggregate journey budget"; 19 files: 18 modified, 1 new test file `tests/agent-factory-no-aggregate-budget.test.ts`).
- Scope: text, one report guide (`registry/skills/coordinate-artifact/assets/report.json`), eval fixtures, `scripts/prepare-factory-proof.mjs` and tests. Changes no checker script, no job schema and nothing under `src/`.
- Gate environment: Windows, Node 24.19.0. Nothing of P18 ran on the real Host; Linux CI has not run on `5547450` when these records are written.

## Why

- **The rule as it stood:** the runbook stated for one journey "at most 24 processes, 1800 seconds and 8MiB" of raw output for all caller and producer validation (wording varied by place). It stood in the coordinator agent body (`registry/hosts/claude/agents/orchestrator-agent-factory.md`), in `registry/skills/coordinate-artifact/references/repair.md`, in four route references (`skill-authoring.md`, `contract-authoring.md`, `bundle-authoring.md`, `host-sync.md`), in `references/job.md` and `references/handback.md`, in `assets/report.json` (`validationProcessesMaximum: 24`, `secondsMaximum: 1800`, `rawOutputBytesMaximum: 8388608`), in the Skill's evals (`evals/fixtures.json`, `evals/setup.md`, `evals/evals.json`), and in the brief that `scripts/prepare-factory-proof.mjs` prepares (`aggregateBudget`). The runbook itself said: "These are runbook budgets, not enforced OS limits."
- **Nothing counted it:** no file said who counts or what counts as a process (the entry dry run, wrapper scripts that run several checks, a worker's own helper runs and git calls were all open), and no script checked the number.
- **What the first real run showed (and the limits of that count):** in headless S1 on 2026-11-15 ([the headless stage-proof observation](../host-library/claude/observations/2026-11-15-claude-2.1.323-factory-stage-proof-headless.md)), the coordinator's final text claimed "about 20" processes; the analyst's rough count from the record was about 20 on the coordinator's side plus at least 8 on the realizer's side, likely above 24 and unproven against the 24-process limit.
- **Options paper:** `p41-process-budget-options.paper.md` in `scratch/plan-033-implementation/routed-2026-11-14/` (written by a read-only worker on another Host; its quotes were spot-checked by the lead on two places only) offered four options: (a) a ledger in the evidence folder, prose only; (b) a ledger plus a count check in a checker; (c) drop the aggregate number and keep the per-job caps that scripts enforce; (d) leave it and record the limit. The paper estimated 15 to 18 processes for a clean first pass and 27 to 33 with one authorized repair (an estimate, not a count), and recommended (c).

## Decisions

- **Maintainer (2026-11-16):** to the question "What should happen to the 24-process budget that nothing counts?", the maintainer answered: `"C: drop it"`.
- **Lead's choice (not the maintainer's word; reported to him, reversible):** the 1,800 seconds and the 8 MiB of the same sentence are removed together with the 24 processes, because nothing counts them either. The maintainer was asked about this part and had not answered when the work was done. He was told of this choice twice afterwards and did not object; that is not a decision of his.
- **Lead's choice of wording:** the core contract invariant changes from "Repair only within the accepted count, scope and aggregate budget." to "Repair only within the accepted count, scope and per-job budgets."; one shared sentence states the absence: "A journey has no aggregate process, time or output budget".
- **Not chosen:** a ledger (options a and b) — a ledger cannot be checked for completeness against the processes really started, wrapper scripts invite double counting, and 24 would have had to be raised; option (d) (leave it and record the limit) was also not chosen.

## What stays and what scripts compare

- At most one authorized repair, default zero; at most four sequential worker turns (`registry/skills/coordinate-artifact/assets/report.json` `limits`: `automaticRepairsDefault` `0`, `authorizedRepairsMaximum` `1`, `workerTurnsMaximum` `4`).
- Each P2/P5 job's own caps (at most 6 checks, at most 600 seconds, a log cap), and the candidate and evidence input limits.
- **Per-job caps compared by existing scripts vs. not compared (read by the worker, confirmed by the lead in the files):**
  - **P2:** `registry/skills/realize-artifact/scripts/check-handback.mjs` compares the number of check receipts with `maxChecks` (line 54), each receipt's duration with its check's `timeoutSeconds` (line 65), the summed seconds with `maxSeconds` and the summed log bytes with `maxLogBytes` (line 82), and each log with `maxLogBytes` (lines 71–72). `registry/skills/realize-artifact/scripts/check-job.mjs` line 178 compares the declared number of checks and the sum of declared timeouts with the budget.
  - **P5:** `registry/skills/evaluate-artifact/scripts/check-review.mjs` compares the declared number of checks with `maxChecks` (line 245) and the summed raw log bytes with `maxLogBytes` (lines 259 to 261). It uses `maxSeconds` only as part of the timeout of its fixed `git rev-parse` identity query (line 282): **no checker compares the P5 seconds cap with a record**.

## The change (18 modified files, 1 new test file)

| Place | Before | After |
| --- | --- | --- |
| `registry/core/orchestrator-agent-factory.core.md` (invariants) | "Repair only within the accepted count, scope and aggregate budget." | "Repair only within the accepted count, scope and per-job budgets." |
| `registry/hosts/claude/agents/orchestrator-agent-factory.md` | the old invariant; "Aggregate all caller/producer validation, including pre/postflight and reruns: at most 24 processes, 1800 seconds and 8MiB full raw output; retain each smaller P2/P5 cap and the runbook's candidate/evidence limits. These are guidance budgets, not OS enforcement."; "consumed budget/repair linkage" | the new invariant; "A journey has no aggregate process, time or output budget, because nothing counts one; retain each P2/P5 per-job cap and the runbook's candidate/evidence limits."; "consumed per-job budgets/repair linkage" |
| `registry/skills/coordinate-artifact/references/repair.md` | the old invariant; the paragraph "Aggregate every caller/producer validation process ... <=24 processes, <=1800 seconds, <=8MiB complete raw output ... These are runbook budgets, not enforced OS limits. ... exhausted budget stops with precise rework ..." | the new invariant; "A journey has no aggregate process, time or output budget, because nothing counts one. Its bounds are the turn and repair limits above and each P2/P5 job's own caps (<=6 checks, <=600 seconds and its log cap): the P2 handback checker compares the check count, seconds and log bytes with the receipts, the P5 review checker compares the check count and log bytes, and no checker compares the P5 seconds cap with a record. Repository implementation gates are separate. Scope expansion, pair change, held provenance, no progress, missing evidence or an exhausted per-job budget stops with precise rework rather than resetting counters or broadening authority." |
| `registry/skills/coordinate-artifact/references/job.md` | "Require the accepted repair count (default zero, maximum one) and aggregate process/time/output budget." | "Require the accepted repair count (default zero, maximum one); a journey has no aggregate process, time or output budget." |
| `registry/skills/coordinate-artifact/references/handback.md` | "repair count/linkage and consumed aggregate limits" | "repair count/linkage and consumed per-job budgets" |
| `registry/skills/coordinate-artifact/references/skill-authoring.md`, `contract-authoring.md`, `bundle-authoring.md`, `host-sync.md` | first sentence "Every checker run ... counts toward the aggregate in `[repair](repair.md)`: at most 24 processes, 1800 seconds and 8MiB of raw output." | first sentence "A journey has no aggregate process, time or output budget; see `[repair](repair.md)`."; the rest of each line kept |
| `registry/skills/coordinate-artifact/assets/report.json` | `required`: "repair authorization/count/linkage and aggregate budget consumed"; `limits` with six keys (`validationProcessesMaximum: 24`, `secondsMaximum: 1800`, `rawOutputBytesMaximum: 8388608` plus the three repair/turn limits) | `required`: "repair authorization/count/linkage and per-job budgets consumed"; `limits` keeps `automaticRepairsDefault`, `authorizedRepairsMaximum`, `workerTurnsMaximum` |
| `registry/skills/coordinate-artifact/SKILL.md` and `registry/hosts/claude/skills/coordinate-artifact/SKILL.md` | "acceptance and aggregate budget" | "acceptance and per-job budgets" (each entry one character shorter; LF-normalised lengths 5,406 and 5,787, limit 6,000) |
| `registry/skills/coordinate-artifact/evals/fixtures.json`, `evals/setup.md`, `evals/evals.json` | three budget keys; "remaining aggregate budget"; "coordination brief/aggregate counter"; three prompts "Once the stated aggregate budget is exhausted" | keys removed; "remaining per-job budgets"; "coordination brief"; "Once a stated per-job budget is exhausted" |
| `scripts/prepare-factory-proof.mjs` | `aggregateBudget: { maxProcesses: 24, maxSeconds: 1800, maxOutputBytes: 8388608, maxSequentialWorkerTurns: 4 }` | `limits: { maxSequentialWorkerTurns: 4 }` |

## Tests

- `tests/helpers/native-invariant-evidence.ts` (line 26): key and pattern follow the new invariant `"Repair only within the accepted count, scope and per-job budgets."`.
- `tests/factory-proof-prep.test.ts` (lines 340–341): checks the reference sentence `"a journey has no aggregate process, time or output budget"` and `b.limits` (`{ maxSequentialWorkerTurns: 4 }`).
- New `tests/agent-factory-no-aggregate-budget.test.ts` (four tests):
  1. No file under `registry/skills/coordinate-artifact/`, `registry/hosts/claude/skills/coordinate-artifact/`, `registry/hosts/claude/agents/orchestrator-agent-factory.md`, `registry/core/orchestrator-agent-factory.core.md` or `scripts/prepare-factory-proof.mjs` matches the removed figures and phrases (`24 processes`, `<=24 processes`, `validationProcessesMaximum`, `secondsMaximum`, `rawOutputBytesMaximum`, `maxProcesses`, `aggregate budget`, `aggregate limits`, `aggregate counter`, `aggregate in [repair]`).
  2. The shared sentence `"A journey has no aggregate process, time or output budget"` appears in `repair.md`, `job.md`, the four route references (`skill-authoring.md`, `contract-authoring.md`, `bundle-authoring.md`, `host-sync.md`) and `orchestrator-agent-factory.md`.
  3. The new invariant `"Repair only within the accepted count, scope and per-job budgets."` appears in `orchestrator-agent-factory.core.md`, `orchestrator-agent-factory.md` and `repair.md`.
  4. `report.json` `limits` has exactly the three kept keys (`authorizedRepairsMaximum`, `automaticRepairsDefault`, `workerTurnsMaximum`).
- No pinned hash, pinned length or manifest had to change.

## How the work was done

- **Worker:** a Claude subagent of the lead session (Sonnet), in its own worktree, from written brief `p42-no-aggregate.brief.md` in `scratch/plan-033-implementation/routed-2026-11-14/`; it committed nothing.
- **One fix round by the lead's review:** one clause of the new `repair.md` paragraph claimed that the P5 seconds cap "only limits its own reruns"; the review checker never reruns a check, so the clause was replaced by "no checker compares the P5 seconds cap with a record".
- **Lead verification of the diff:** the lead read the complete diff, confirmed the cited script lines in the files, and ran the acceptance commands itself.
- **No independent second-Host review:** not run for this slice because the change is wording, three removed JSON keys per file and one renamed object in a preparation script.
- **Brief acceptance command omitted:** the brief's last acceptance command (`skill-check` on the Skill folder) had the wrong form (the command needs `--artifact`, `--corpus` and `--policy`); it was not run. `tests/skill-check.test.ts` ran and passed.

## Lead's acceptance and gate results

- **Acceptance by the lead (worker's worktree, before integration):**
  - `npm run typecheck`: exit `0`.
  - `npm run build`: exit `0`.
  - The brief's 16 test files, serial: exit `0`; 16 files; 718 passed, 5 skipped, of 723; 419.06 s.
- **Gate (Windows, main checkout, the change applied uncommitted on `089dbcb`; Node 24.19.0):** raw files are in the git-ignored folder `logs/plan-033-p18-2026-11-16/` (per step: `<step>.command.txt`, `<step>.stdout.txt`, `<step>.stderr.txt`, `<step>.exit.txt`; plus `base-head.txt` and `tree-status.txt`).

| Step | Command | Exit | Result | Raw files |
| --- | --- | --- | --- | --- |
| `hostlib-verify` | `npm run hostlib:verify` | 0 | "host library snapshots match their lockfiles and every guide citation resolves" | `hostlib-verify.{command,stdout,stderr,exit}.txt`, `base-head.txt`, `tree-status.txt` |
| `typecheck` | `npm run typecheck` | 0 | no output of errors | `typecheck.{command,stdout,stderr,exit}.txt` |
| `full-test-serial` | `env -u CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS npm test -- --maxWorkers=1 --fileParallelism=false` | 0 | 307 files passed; 7,673 tests passed, 224 skipped, of 7,897; 1,707.03 s | `full-test-serial.{command,stdout,stderr,exit}.txt` |
| `addon-matrix` | `AGENTS_CI_FULL=1 env -u CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS npx vitest run tests/e2e-domain-conformance.test.ts --maxWorkers=1 --fileParallelism=false` | 0 | 1 file; 317 tests passed; 452.52 s | `addon-matrix.{command,stdout,stderr,exit}.txt` |
| Linux CI | — | Pending | Unverified until CI runs on `5547450` (the Windows gate is not a CI result) | — |

- Compared with the P17 gate (306 files; 7,669 passed, 224 skipped, of 7,893): one file and four tests more, which is the new test file (`tests/agent-factory-no-aggregate-budget.test.ts`).
- The code is committed locally as `5547450` ("fix(factory): P18, the runbook states no aggregate journey budget"; 19 files). Linux CI has not run on it when these records are written: the Windows gate is not a CI result.

## Limits and what is not shown

- Nothing of P18 was observed on the real Host. Whether a coordinator now reports per-job budgets correctly, or stops inventing an aggregate count, is unverified.
- The workspaces of the interactive sittings of 2026-11-16 (`run-c`, prepared from `1b300a5`) carry the earlier brief with `aggregateBudget` and the earlier runbook text; those sittings therefore do not test P18.
- The process count of a journey is now bounded only indirectly: by at most four worker turns, at most one repair and at most six declared checks per job. Entry dry runs, wrapper scripts, a worker's helper runs and git calls are bounded by nothing; this is stated, not solved.
- The P5 seconds cap is declared in the job and compared with no record (existing state, now written down in `repair.md`).
- Historical records (plans, ADR sections, the observation record of 2026-11-15, the P16 and P17 records) keep the old wording: they describe what was true then.

## Open items

- The maintainer has not said whether the 1,800 seconds and 8 MiB removed as the lead's choice should have stayed (lead's choice stands until he says otherwise).
- Real-Host observation of P18 remains unverified.
- Linux CI has not run on local commit `5547450`.

## Next

- Await the maintainer's word on whether the 1,800 seconds and 8 MiB should have stayed, observe P18 on the real Host in fresh workspaces prepared after this commit (not the `1b300a5` `run-c` workspaces), and run Linux CI on the pushed branch.
- A separate slice (P19, decided by the maintainer on 2026-11-16, not part of these records) follows: the launcher also turns fork mode off for the factory session.
