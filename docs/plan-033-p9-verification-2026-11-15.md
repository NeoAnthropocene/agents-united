# Plan 033 P9 delivery: offline verification, 2026-11-15

P9 delivers two maintainer-approved offline slices in local commit `a9dae87`: `agents skill-check` policies for private and adapted Skills (with three P8a review findings folded in), and the manual-import `author-contract` route through the coordinator (with independent-review fixes to both return checkers). Everything in this record is offline. No live Host, model or provider run took place, and no private records were accessed. See [ADR 0067](adr/0067-claude-factory-realization-delivery.md) (sections dated 2026-11-15) and [the P8 design](../plans/033-slice-4-p8-skill-design.md).

## Scope and baseline

- Dates: decisions 2026-11-14 and 2026-11-15; gate 2026-11-15.
- Branch: `codex/plan-033-claude-delivery-nov10`. Local commits, none pushed: `2fd7f2d` (P1 to P8b stage 1), `552746d` (merge of `origin/dev` at `a778c2f`, PR #217), `3c48421` (P8b stage 1 review fixes), `a9dae87` (this work, "P9").
- Node 24.19.0. No live Host, model or provider run for this work. No private records.
- Separate from Plan 033: PR #218 (`fix/host-agent-router-1.1.1`, host-agent-router 1.1.1) is open against `dev`; it is not part of this branch.

## How the work was done

An orchestrating Claude Code session planned, briefed, reviewed and integrated. Implementation and design drafts were written by workers on other host CLIs through the `host-agent-router` skill: Cline (`glm-5.3`) and Antigravity (Gemini 4 Argon, Gemini 4 Hydrogen). Each result was reviewed by the orchestrating session: report compared with the files the router saw change, diff read, acceptance command run by the orchestrating session itself. Workers did not commit.

Design proposals were drafted by one worker (Antigravity, Gemini 4 Argon, read-only) and then checked claim by claim by a second worker on a different model (Gemini 4 Hydrogen High). The proposals' file-level detail was found unreliable (12 wrong or unsupported statements plus 16 imprecise citations on skill policies; about 25 on the contract and bundle route; about 19 on host-update sync), while most design recommendations stood. Implementation briefs were therefore written from the code and the verification reports.

Untracked working files: `scratch/plan-033-implementation/routed-2026-11-14/` (`DECISIONS-2026-11-14.md`, `proposal-*.proposal.md`, `verify-*.report.md`, `p9c-sync-wiring.plan.md`, `review-contract-checker.report.md`, and each run's brief and result).

## Maintainer decisions

1. Skill policies: **"Approve, intake rule (Recommended)"** (`private-owner` and `adapted-source`; an adapted Skill needs a retained licence file and `NOTICE.md` whenever the licence is not purely MIT, per [docs/skill-intake.md](skill-intake.md), with the `LicenseRef-Remotion` source-available tier accepted under `adapted-source`).
2. P8a findings: **"Yes, fold them in (Recommended)"** (F5, F7, F13).
3. Contract and Bundle route: **"Contract route first (Recommended)"** — the `author-contract` route first with four new support paths and trimmed wording in the coordinator entries; the Bundle route waits for a separate decision on how the coordinator entry scales.
4. Host-update sync: **"Approve shape, wiring comes back (Recommended)"**.
5. 2026-11-15, local commit: **"Yes, commit locally (Recommended)"**.
6. 2026-11-15, sync delivery: **"Two slices (Recommended)"** — worker, runbook Skill, checker and binding with a lookup keyed by Skill first; then the coordinator's `Agent(...)` grant and launcher text widened to three workers, with its own gate.
7. 2026-11-15, sync install: **"Complete bundle only (Recommended)"**.

Still not approved: P8b stage 2 (a `Skill` tool grant for the coordinator); the Bundle route; any live run.

## What was delivered

### Slice A: `agents skill-check` policies (in `a9dae87`)

- `--policy` accepts `agents-united-original`, `private-owner`, `adapted-source`; anything else is `POLICY_UNSUPPORTED`. New finding codes: `PRIVATE_POLICY`, `ADAPTED_POLICY`. The six check ids (`metadata`, `contract`, `layout`, `portability`, `licence`, `frozen-corpus`) and the result shape are otherwise unchanged.
- `private-owner`: author non-empty and not `agents-united`; version and licence present; no `source`, `adaptedFrom` or `commit`; licence tiers permissive, weak-copyleft, share-alike (the last two need a licence file); the source-available tier refused.
- `adapted-source`: author non-empty and not `agents-united`; `source` with `https://` and a 40-character lowercase commit SHA, not this project's repository; optional `commit` equal to that SHA; a top-level licence file always; `NOTICE.md` naming the SHA and the licence whenever the licence is not exactly `MIT`; an adapted candidate with no supporting files and under the stub line limit (`STUB_MAX_LINES`) is `STUB`.
- Gates: `validateRewrittenSkill` has options `requireProjectAuthor` and `forbidSource` (default `true`); `supportingText` has `excludeTopLevelNotices` (default `false`); new pure function `lintSkillPolicyLicence`; `lintSkillLicence` unchanged.
- Folded-in P8a findings (from [the P8a record](plan-033-p8a-verification-2026-11-12.md)): F5 the contract and layout gates return findings instead of throwing on malformed front matter or evals; F7 the inventory refuses unsafe entry names as `PATH_UNSAFE` and a file that is not UTF-8 fails the run; F13 a `.` or `..` segment in `--artifact` or `--corpus` is `USAGE`, a linked ancestor of the artifact is `PATH_UNSAFE`, of the corpus `INPUT_UNAVAILABLE`.
- Files: `src/core/skill-check.ts`, `src/core/skill-contract.ts`, `src/core/skill-layout.ts`, `src/core/skill-licence-lint.ts`, `src/core/types.ts`, `src/cli.ts` (option text), `tests/skill-check.test.ts`, `tests/skill-check-cli.test.ts`, `tests/skill-check-package.test.ts`, new `tests/skill-policy-gates.test.ts`.
- Deliberate change to existing tests: the tests that forbid any file access outside the candidate folder now allow `lstat`, and only `lstat`, on ancestor folders of the artifact and the corpus, because the F13 check inspects them. One existing test's example of an unsupported policy changed from `private-owner` to another name.

### Slice B: the `author-contract` route through the coordinator (in `a9dae87`)

- New files: `registry/skills/coordinate-artifact/scripts/check-contract-return.mjs`, `registry/skills/coordinate-artifact/assets/contract-task.schema.json`, `registry/skills/coordinate-artifact/assets/contract-return.schema.json`, `registry/skills/coordinate-artifact/references/contract-authoring.md`; `tests/agent-factory-contract-return.test.ts`, `tests/helpers/contract-task.ts`.
- Changed files: `COORDINATOR_SUPPORT` in `src/core/claude-factory-declaration.ts` and `requiredSupport` in `registry/hosts/claude/agent-factory-coordinate.binding.json` (11 to 15 paths); `registry/skills/coordinate-artifact/SKILL.md` and `registry/hosts/claude/skills/coordinate-artifact/SKILL.md` (the native entry is at exactly 6,000 of 6,000 characters, so nothing more fits without trimming); `registry/hosts/claude/agents/orchestrator-agent-factory.md` (section "One contract draft", body only); `registry/hosts/claude/skills/author-contract/SKILL.md` (the task-path rule); `tests/helpers/factory-coordinator.ts` and `tests/agent-factory-coordinator-{delivery,launcher,lifecycle,package}.test.ts`; `registry/skills/coordinate-artifact/scripts/check-skill-return.mjs` and its tests (`tests/agent-factory-skill-return.test.ts`, three review fixes); `tests/agent-factory-skill-package.test.ts` (one pin).
- Route: the coordinator writes a task, runs the checker with `--job` (preflight), the maintainer types `/author-contract <absolute task path>`, the coordinator runs the checker with `--job` and `--result` (postflight), then `agents contract-check --registry <draft root> --definition <definition>`, then the evaluator's `shared-pair` review. The caller never runs `draft-pair.mjs`.

## What was deliberately not changed

No change to grants, cores, contracts, the `tools` line of any agent, the installer, projector or launcher. `lintSkillLicence` is unchanged. Neither P8b stage 2 (`Skill` grant) nor the Bundle route nor any host-update sync implementation was added.

## Independent review of the contract checker

An independent review (`review-contract-checker.report.md` in `scratch/plan-033-implementation/routed-2026-11-14/`) found no blocker and reported two major and four smaller findings. All six were fixed test-first:

1. Diff comparison made independent of order (a valid two-file update could have been refused on Linux).
2. An optional binding with missing evidence accepted while a required one is refused.
3. A blocked return with external actions refused (both `check-contract-return.mjs` and `check-skill-return.mjs`).
4. Upstream template path compared exactly.
5. Frontmatter scan made linear (both checkers).
6. Helper stderr that is not UTF-8 reported as `HELPER_RECORD` (both checkers).

## Gate results

Run by the orchestrating session on the integrated tree (`a9dae87`), on Windows. Raw files are in `logs/plan-033-p9-2026-11-15/`, each with `.command.txt`, `.stdout.txt`, `.stderr.txt` and `.exit.txt`.

| Command | Exit | Counts | Raw files |
| --- | --- | --- | --- |
| `hostlib-verify` | 0 | Host library snapshots match lockfiles and citations resolve | `hostlib-verify.{command,stdout,stderr,exit}.txt` |
| `typecheck` | 0 | Build and `tsc` checks pass | `typecheck.{command,stdout,stderr,exit}.txt` |
| `full-test-serial` (`env -u CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS npm test -- --maxWorkers=1 --fileParallelism=false`) | 0 | 292 files passed; 6,519 tests passed, 218 skipped, of 6,737; 1,346.73 s | `full-test-serial.{command,stdout,stderr,exit}.txt` |
| `addon-matrix` (`AGENTS_CI_FULL=1 ... npx vitest run tests/e2e-domain-conformance.test.ts --maxWorkers=1 --fileParallelism=false`) | 0 | 317 passed, none skipped; 420.78 s | `addon-matrix.{command,stdout,stderr,exit}.txt` |

Earlier the same weekend, on `3c48421` (raw files in `logs/plan-033-p8b-fixes-2026-11-14/`): `hostlib-verify` exit 0, `typecheck` exit 0, `full-test-serial` exit 0 (290 files, 6,183 passed, 214 skipped); the addon matrix was not run for that commit.

Windows only. Cases that need a case-sensitive file system or file names Windows refuses are skipped here and have not run anywhere.

## Known and left

- Under `adapted-source`, the author comparison with `agents-united` is trimmed and case-insensitive, slightly stricter than "not exactly".
- The trailing-whitespace trim in the new frontmatter scan can still be slow on one very long run of spaces followed by another character; only the reported case is tested.

## Unverified

- Everything live: that a typed `/author-contract <task path>` reaches the fork, that the fork reads the task and runs the helper once, evaluator usefulness, repair adherence.
- Linux and CI behaviour of this branch (it has never been pushed).
- The legal truth of a licence or authorship declaration; a pass under any policy means the deterministic gates passed only.
- No independent review of slice A's `skill-check.ts` changes has been done.

## Next

1. Host-update sync, in two slices, from the verified wiring plan `p9c-sync-wiring.plan.md`; the sync records and checker still need a verified specification.
2. A decision on how the coordinator entry scales before the Bundle route.
3. P8b stage 2 waits on a maintainer-typed observation of a model-invoked skill.
4. Factory hooks and the installed contribution runbook have no design yet.
5. This branch has never been pushed: a pull request to `dev`, with its first Linux CI run, is a step of its own and needs the maintainer's word.
