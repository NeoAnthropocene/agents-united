# Plan 033 P10 slice 1, host-update sync: offline verification, 2026-11-15

P10 slice 1 delivers the first slice of host-update sync offline in the working tree on top of local commit `a9dae87` (uncommitted): a behaviour-preserving worker lookup refactor, the deterministic read-only `check-sync.mjs` checker and schemas, the `subagent-host-update-sync` shared pair, the native `factory-sync` agent, the `sync-host` Skill and binding, and `agent-factory` bundle/installer/projector wiring. Everything in this record is offline. No live Host, model or provider run took place, and no private records were accessed. See [ADR 0067](adr/0067-claude-factory-realization-delivery.md) (sections dated 2026-11-15) and [the P9 verification record](plan-033-p9-verification-2026-11-15.md).

## Scope and baseline

- Dates: decisions 2026-11-14 and 2026-11-15; gate 2026-11-15.
- Branch: `codex/plan-033-claude-delivery-nov10`. Local commits, none pushed: `2fd7f2d` (P1 to P8b stage 1), `552746d` (merge of `origin/dev` at `a778c2f`, PR #217), `3c48421` (P8b stage 1 review fixes), `a9dae87` (P9). This work ("P10 slice 1") sits on top of `a9dae87` in the working tree and is uncommitted.
- Node 24.19.0, Windows. No live Host, model or provider run of the factory. No private records.
- The P9 records written earlier the same day (`docs/plan-033-p9-verification-2026-11-15.md`, three ADR 0067 sections dated 2026-11-15, the completion-matrix P9 paragraph, the plan entry, `docs/plan-033-handoff-2026-11-15.md`) are also uncommitted and stay unchanged.
- Separate from Plan 033: PR #218 (`host-agent-router` 1.1.1) is open against `dev` and received one more commit the same day (`cf2fe88`, catching three operator mistakes before a worker starts). It is not part of this branch.

## Decisions this rests on

### Maintainer decisions (option labels quoted, from 2026-11-14 and 2026-11-15)

- Host-update sync: **"Approve shape, wiring comes back (Recommended)"** (2026-11-14).
- Sync delivery: **"Two slices (Recommended)"** (2026-11-15).
- Sync install: **"Complete bundle only (Recommended)"** (2026-11-15).
- Worker order (2026-11-15): Cline's limits were nearly used, so work went to Antigravity first, Cline for two small jobs earlier in the day, and one Claude subagent for the router skill.

### Design details fixed by the orchestrating session without asking

Fixed inside the approved shape and awaiting the maintainer's confirmation:

1. An artifact is "affected" when it pins a changed input with a hash different from the new one (or when the input was removed); whether the pin equals the previous hash (`oldSha256`) is reported as `pinnedAtPrevious`. This answers open point 3 of the records specification so a pin at a third, older hash is affected and the result is independent of how many refreshes passed.
2. The job record carries only what the checker can verify or the plan needs (no changelog signals, `lastSeen`, verify status, artifact types, budget or constraints). For an input the lock does not track, the old hash is a caller claim.
3. The checker checks the checkout `HEAD` with the same read-only `git` call (`git -C <checkout> rev-parse --verify HEAD`) as the three existing checkers (open point 4).
4. The path form of a realizer job record is taken from that record's own `source.checkout` path (Windows or POSIX form), so records made on Windows and on POSIX systems both join.

### Still not approved

- Slice 2 of sync is approved in principle but not built (the coordinator's `Agent(...)` grant, required roles, runbook and launcher text for three workers, with its own gate).
- P8b stage 2 (a `Skill` grant for the coordinator).
- The Bundle route (`author-bundle`).
- Any live run.

## What was delivered

1. **Worker lookup (behaviour-preserving refactor):**
   - `src/core/claude-factory-declaration.ts` defines one table `FACTORY_WORKERS` and the lookups `factoryEntryBySkill`, `factoryWorkerBySkill` and `factoryWorkerByRole`.
   - `src/core/claude-factory-binding.ts` and `src/core/claude-factory-start.ts` no longer find a worker by list position or by a two-way choice; an unknown Skill or role is refused.
   - New `tests/agent-factory-worker-lookup.test.ts`.
2. **Deterministic checker:**
   - `registry/skills/sync-host/scripts/check-sync.mjs` with `registry/skills/sync-host/assets/sync-job.schema.json` and `registry/skills/sync-host/assets/sync-plan.schema.json`.
   - `tests/agent-factory-sync-check.test.ts` (reported 132 passed, 1 skipped on Windows) and `tests/helpers/sync-job.ts`.
   - Modes: `--job <absolute job>` is preflight; `--job <absolute job> --result <absolute plan>` is postflight. Prints one JSON line and exits `0` or `1`; read-only; its only subprocess is `git -C <checkout> rev-parse --verify HEAD`.
   - Failure codes: `USAGE`, `JOB_INVALID`, `ROOT_CONFLICT`, `CHECKOUT_HEAD`, `PIN_MISMATCH`, `LOCK_DELTA_MISMATCH`, `HOLD_VIOLATION`, `TARGET_INVALID`, `LIMIT`, `STALE_INPUT`, `RESULT_INVALID`, `DIGEST_MISMATCH`, `AFFECTED_MISMATCH`.
   - Preflight checks the job, the two lock pins (`library.lock` and `library.previousLock`) and every target pin, that `changedInputs` equals the difference of the two locks for lock-tracked files, that each changed file on disk has its new hash (or is absent when `newSha256` is `null`), and that no held source advanced or is listed as changed.
   - Postflight compares the plan with what the checker computes itself (everything except each `reason`) and the echoed `jobDigest` (together with `jobId` and `host`).
   - Reports `claimsNotAccepted: ["targets-complete", "untracked-old-hash", "held-candidate", "reason"]`.
3. **Worker and Skill:**
   - Shared pair: `registry/core/subagent-host-update-sync.core.md` and `registry/core/subagent-host-update-sync.contract.json` (capabilities `read`, `search`, `report`, `handback`; hook `reject-mutating-tools`).
   - Native agent: `registry/hosts/claude/agents/factory-sync.md` (the evaluator's seven-tool grant — `Glob`, `Grep`, `ListMcpResourcesTool`, `Read`, `ReadMcpResourceTool`, `ReportFindings`, `SubagentHandback` — and read-only guard).
   - Skill: `registry/skills/sync-host/` (`SKILL.md`, `references/job.md`, `references/plan.md`, `references/handback.md`, `examples/one-sync.md`, `evals/evals.json`) and native entry `registry/hosts/claude/skills/sync-host/SKILL.md`.
   - Binding: `registry/hosts/claude/agent-factory-sync.binding.json`.
4. **Wiring:**
   - `sync-host` is a fourth entry of `FACTORY_BINDINGS` and a third row of `FACTORY_WORKERS` in `src/core/claude-factory-declaration.ts`.
   - `src/core/types.ts` (`ClaudeFactoryBinding` worker Skill union adds `'sync-host'`).
   - `src/core/installer.ts` and `src/core/claude-projector.ts` (`sync-host` refused outside `agent-factory` and on the plugin lane; `evals/` left out of copies).
   - `registry/bundles.json` (`agent-factory` includes `sync-host`) and `host-library/_upstream/skills.json` (adds `sync-host`).
   - Tests: `tests/agent-factory-sync-delivery.test.ts`, `tests/agent-factory-sync-lifecycle.test.ts`, and the role and count tables in existing tests (`tests/agent-factory-lifecycle.test.ts`, `tests/claude-session-task-policy.test.ts`, `tests/cli-e2e.test.ts`, `tests/core-safety-floor.test.ts`, `tests/helpers/factory-bundle-template.ts`, `tests/helpers/native-delta.ts`, `tests/helpers/native-invariant-evidence.ts`, `tests/helpers/native-roles.ts`, `tests/native-ceiling.test.ts`, `tests/native-claude-agents.test.ts`, `tests/native-claude-own-session.test.ts`, `tests/native-install-lane.test.ts`, `tests/registry.test.ts`, plus `tests/fixtures/laid-out-skills/sync-host`).
   - Counts updated in `README.md` and `PROJECT.md` (216 Skills, 22 native Claude agent sources, a contributor main plus three workers), and `CONTEXT.md` (216 Skills, `sync-host` excluded from `full`).

## The slice boundary

Unchanged files and symbols:

- `registry/hosts/claude/agents/orchestrator-agent-factory.md` (the `Agent(factory-realizer, factory-evaluator)` grant and coordinator body are unchanged);
- `registry/hosts/claude/agent-factory-coordinate.binding.json` (`requiredRoles` stays `['factory-realizer', 'factory-evaluator']`);
- both `coordinate-artifact` entries (`registry/skills/coordinate-artifact/SKILL.md` and `registry/hosts/claude/skills/coordinate-artifact/SKILL.md`);
- `src/core/claude-launcher.ts`, `requiredRoles`, `normalizeClaudeFactoryCoordinatorTools` and `COORDINATOR_INSTALLED`.

In `src/core/claude-factory-start.ts`, `readClaudeFactoryMain` and `assertClaudeFactorySelection` check exactly the coordinator and its two existing workers (`factory-realizer` and `factory-evaluator`). As a result, `factory-sync` is installed, guarded and checked at install, update, doctor and uninstall, but the coordinator cannot start it yet.

## How the work was done and reviewed

- **Orchestration and workers:** briefed, reviewed and integrated by the orchestrating Claude Code session; written by routed workers through `host-agent-router`: Cline `glm-5.3` (lookup refactor; first checker fix round), Antigravity Gemini 4 Argon (checker; wiring), Antigravity Gemini 4 Hydrogen (records specification, independent review, review fixes, Skill text corrections). Workers did not commit. For every result the orchestrating session read the diff and ran the acceptance itself.
- **Records specification:** a read-only specification (`p10b-sync-records-spec.spec.md`) had its quoted facts checked mechanically (33 quoted lines confirmed; one wrong statement: it called the existing checkers subprocess-free).
- **Orchestrator review of the first checker:** found a link check skipped when a folder could not be read; a join by absolute path (a record made in another folder was silently "not affected"); a link walk over paths never read; lock keys colliding by case on Windows; a held path in `changedInputs` reported under the wrong code; and a type error in the test helper that the worker's report said was not there. All were fixed test-first.
- **Independent review of the checker:** another model (`review-sync-checker.report.md`) reported six findings. Four were taken and fixed test-first: a record from the other operating system refused; quadratic work in the plan computation; target bounds only in the plan schema so preflight and postflight disagreed; and one test that passed without its rule, plus missing cases. One finding was not taken because it did not reproduce: a trailing dot or space on Windows reaching the same file (`stat`, `lstat` and `open` on an absolute path return no entry on Windows 11 with Node 24.19.0).
- **Orchestrator review of wiring and Skill text corrections:** the code wiring was accepted as delivered. The Skill text had factual errors (the checker's command line, fields that do not exist, the lock file's name, the join rule of an earlier checker version, made-up kinds in the example) and the new agent did not state its core invariants, which `tests/native-invariant-coverage.test.ts` requires. These were corrected in one more round, after which `agents skill-check --policy agents-united-original` on the Skill passed and the plan examples were validated against the plan schema.
- **Smoke test against the real lock (reviewer smoke test, not part of the suite):** the checker's preflight ran against the real Claude library lock of this checkout, with the lock of commit `6eb77bd` as the previous lock and two hand-made job records: 23 changed lock entries, 1 of 2 records affected, and the held page `pages/mcp/mcp.md` accepted as held.
- **Operating problems the same day (none affecting delivered content):** two Antigravity runs ended at once because the operator had allowed command prefixes where that host matches whole lines; one run was skipped because its command line was too long for Windows. Both are now caught by the router (PR #218, `cf2fe88`).
- **Untracked working records:** `scratch/plan-033-implementation/routed-2026-11-14/` (`p10*.brief.md`, `.result.json`, `DECISIONS-2026-11-14.md`, `p10b-sync-records-spec.spec.md`, `review-sync-checker.report.md`, `router-findings/FINDINGS.md`).

## Gate results

Run by the orchestrating session on the integrated uncommitted working tree on top of `a9dae87`, on Windows (Node 24.19.0). Raw files are in `logs/plan-033-p10-2026-11-15/` (each step with `.command.txt`, `.stdout.txt`, `.stderr.txt`, `.exit.txt`; `base-head.txt` is `a9dae87`, `tree-status.txt` lists the uncommitted files); the first, failed run is kept in `logs/plan-033-p10-2026-11-15/first-run/`.

| Run | Command | Exit | Counts | Raw files |
| --- | --- | --- | --- | --- |
| First run | `hostlib-verify` | 0 | Passed | `first-run/hostlib-verify.{command,stdout,stderr,exit}.txt` |
| First run | `typecheck` | 0 | Passed | `first-run/typecheck.{command,stdout,stderr,exit}.txt` |
| First run | `addon-matrix` | 0 | 317 passed | `first-run/addon-matrix.{command,stdout,stderr,exit}.txt` |
| First run | `full-test-serial` | 1 | 296 files, 3 failed; 6,709 passed, 7 failed, 219 skipped, of 6,935 | `first-run/full-test-serial.{command,stdout,stderr,exit}.txt` |
| Second run (corrected tree) | `hostlib-verify` | 0 | Passed | `hostlib-verify.{command,stdout,stderr,exit}.txt` |
| Second run (corrected tree) | `typecheck` | 0 | Passed | `typecheck.{command,stdout,stderr,exit}.txt` |
| Second run (corrected tree) | `full-test-serial` (`env -u CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS npm test -- --maxWorkers=1 --fileParallelism=false`) | 0 | 296 files passed; 6,716 tests passed, 219 skipped, of 6,935; 1,325.36 s | `full-test-serial.{command,stdout,stderr,exit}.txt` |
| Second run (corrected tree) | `addon-matrix` (`AGENTS_CI_FULL=1 ... npx vitest run tests/e2e-domain-conformance.test.ts --maxWorkers=1 --fileParallelism=false`) | 0 | 317 passed, none skipped; 411.15 s | `addon-matrix.{command,stdout,stderr,exit}.txt` |

The seven failures in the first run had three causes, each a follow-on of adding the Skill:

1. The pinned Skill list of the bundle in `tests/agent-factory-lifecycle.test.ts` (5 tests).
2. A second statement of the Skill count in `PROJECT.md` (1 test in `tests/skill-rewrite-s6-orchestration.test.ts`).
3. The credential scan in `tests/plan-029-orchestrator-mcp-and-antigravity.test.ts`, which refuses any 64-character hexadecimal string in a `SKILL.md` and found the job digest in the Skill's plan exemplar (1 test).

Corrected: the pinned list, the counts in `PROJECT.md` and `CONTEXT.md`, and the exemplar in both `sync-host` `SKILL.md` entries, now a fragment of the constant fields pointing to `examples/one-sync.md`.

For comparison, the P9 gate on `a9dae87` ran 292 files, 6,519 passed, 218 skipped, of 6,737.

Windows only. Cases that need a case-sensitive file system or file names Windows refuses are skipped here and have not run anywhere.

## Known and left

- The list of considered job records is supplied by the caller; its completeness cannot be proved, because nothing in the repository lists realized artifacts. Open question for the maintainer: whether realized artifacts should one day carry a committed pointer to their job record.
- For an input the lock does not track (a guide, an observation) the old hash is the caller's claim.
- A realizer job record whose checkout path is neither a Windows form nor a POSIX form is refused.
- The same path form check as in the three existing checkers accepts a trailing dot or space in a path; not exploitable on the tested platform (Windows 11, Node 24.19.0), not changed.
- From P9, unchanged: the `adapted-source` author comparison is slightly stricter than specified; the trailing-whitespace trim in the frontmatter scan of the two return checkers can be slow on one very long run of spaces.

## Unverified

- Everything live: that `factory-sync` loads, reads the records and returns a correct plan; the usefulness of a plan's `reason` text. The coordinator cannot start the worker yet, so no dispatch exists to observe.
- Linux and CI behaviour of this branch (never pushed). In the checker tests, one case is skipped on Windows and several branches run only on a case-sensitive platform (exact-case matching of POSIX-form records; the refusal when an ancestor cannot be read).
- No independent review of the wiring code or of the Skill text by a second model; the checker had one.

## Next

1. Slice 2 of sync: the coordinator's `Agent(factory-realizer, factory-evaluator, factory-sync)` grant, required roles and installed list, the runbook and dispatch text, the launcher text and the startup checks for three closures, with its own gate. The native `coordinate-artifact` entry is at 6,000 of 6,000 characters, so its text must be trimmed or the scaling question decided first.
2. A decision on how the coordinator entry scales (also blocks the Bundle route).
3. P8b stage 2 waits on a maintainer-typed observation of a model-invoked skill. Factory hooks and the installed contribution runbook have no design.
4. A pull request of this branch to `dev`, with its first Linux CI run, needs the maintainer's word.
