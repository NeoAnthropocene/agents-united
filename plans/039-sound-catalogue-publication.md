# Plan 039: Sound catalogue gate close-out and publication

Status: **AWAITING SIGNAL — created on the branch; P0–P5 not started.**
Date: 2026-10-28 (Europe/Berlin).
Machine-readable state and job ledger: [039-sound-catalogue-publication.jobs.json](039-sound-catalogue-publication.jobs.json).
Continuation of [038-sound-model-catalogue.md](038-sound-model-catalogue.md), whose J0–J7 are complete.

## Execution contract

Worktree: `C:\github\agents-united`.
Branch: `codex/sound-model-catalogue`, based on `bc3d034` (the plan-038 checkpoint commit).
Repository: <https://github.com/NeoAnthropocene/agents-united.git>.

**Wait for the maintainer's signal before starting P0.** Execute jobs sequentially with one
writer, checkpointing the JSON ledger after each meaningful patch or test. A signal authorizes
P0–P3 (verification, ledger, local commit) only; **push and PR creation (P4–P5) happen only if
the signal says so in words.** PRs target `dev`, never `main`; never force-push; run
`git diff --cached` before every commit. Never weaken a validator or raise the 30 s per-test
timeout. No model install, inference, provider call, upload or credential read; zero spend.

## Inputs and current evidence

- Plan 038 J0–J7 complete: catalogue rewrite, SKILL.md caps (40 lines / 5997 chars), new eval,
  narration-rights singing section, finishing source paragraph, role/lead clauses, ADR 0057,
  audit note. Targeted suites green: layout + quality ratchet 58/58, role/contract/floor 179/179.
- `npm run typecheck` exit 0.
- First full parallel `npm test` exit 1: 4,797 passed / 28 failed / 209 skipped (5,034 total).
  Failure signature: 42 timeout messages plus one cascade assertion, confined to 13
  install/lifecycle/e2e files with 70–773 s wall times; no plan-038 content regression identified.
- A serial re-run of exactly those 13 files (`--no-file-parallelism`, unchanged 30 s per-test
  timeout) is running: `scratch/media-038/rerun.log`, verdict file `scratch/media-038/rerun.exit`.

## Jobs

| Job | Scope | Done criteria |
| --- | --- | --- |
| P0 | Collect the serial verdict | `rerun.exit` read and recorded; remaining failing files (if any) listed; no test process left running unattended |
| P1 | Adjudicate each remaining failure | If serially green, record the evidence. Otherwise isolate each still-failing file alone with the unchanged timeout, decide whether plan-038 content caused it, fix only real regressions, and document environment-caused flakes as such with evidence. No validator or timeout change |
| P2 | Full offline gate | `npm run typecheck && npm test` re-run as-is, run exit codes read; totals recorded. If parallel timeouts recur, they are reported as the same measured class, not hidden |
| P3 | Close plan 038 and commit locally | `038-...jobs.json` J8 completed with evidence; plan-038 status updated; final report written to `scratch/media-038/final-report.md`; `git diff --cached` secret scan; one commit on the branch; commit hash recorded |
| P4 | Push + PR (only on explicit signal) | `gh pr list --state all` checked first; branch pushed; PR to `dev` opened with the artifact-contribution template body; PR number/link recorded |
| P5 | CI watch and report | PR check `test` status observed and reported; no merge; verified vs unverified items stated |

## Out of scope and deferred

Model installation or inference, listening passes, provider calls, live host sessions, merging
the PR, and `plans/README.md` index rows (optional hygiene, separate request). Any follow-up
work on the install/lifecycle suites' parallel-timeout behaviour belongs to a separate plan
about the test environment, not this catalogue work.

## Verification and boundaries

Static gates prove structure and contracts, not audio quality or licence outcomes. Licence rows
are dated readings of official pages, not legal advice. Other Hosts than Claude remain
unverified. Evidence stays in `scratch/media-038/`; the report states what was verified and
what was not, plainly.
