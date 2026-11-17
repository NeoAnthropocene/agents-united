# Plan 033 P8a delivery: offline verification, 2026-11-12

The maintainer approved the bounded P8a public command in [the P8 design](../plans/033-slice-4-p8-skill-design.md) and recorded the decision in [ADR 0067](adr/0067-claude-factory-realization-delivery.md) (section dated 2026-11-12). P8a delivers `agents skill-check --artifact <absolute-skill-folder> --corpus <absolute-frozen-corpus> --policy agents-united-original`. It is a read-only, deterministic gate. P8b is **not approved and not started**.

## Scope and baseline

Branch `codex/plan-033-claude-delivery-nov10`. HEAD and fresh `origin/dev` were both `f2da922b07fca03cff14cad490c96fa6d067dd30`. Node 24.19.0. There is no open PR; the latest merged PR is #216. Nothing was committed, pushed or published. No live Host, model or provider run took place.

New files:

- `src/core/skill-check.ts`, `src/core/skill-contract.ts`, `src/core/skill-layout.ts`, `src/core/skill-quality.ts`
- `registry/quality/skill-boilerplate-corpus.txt`
- `tests/skill-check.test.ts`, `tests/skill-check-cli.test.ts`, `tests/skill-check-package.test.ts`, `tests/skill-quality-corpus-package.test.ts`

Changed files:

- `src/cli.ts`: a new `skill-check` command, with lines added only.
- `src/core/types.ts`: SkillCheck types appended.
- `tests/helpers/skill-contract.ts` and `tests/helpers/skill-layout.ts`: now re-exports of the moved gates. The layout helper keeps `LAID_OUT_DIR` and `laidOutSkills`.
- `scripts/skill-quality/measure.ts`: a thin CLI adapter that re-exports the moved names.
- `.gitattributes`: one line pinning the packaged corpus to `text eol=lf`.
- `tests/agent-factory-evaluator-delivery.test.ts`: one regex made CRLF-tolerant.

## Test-first evidence

The three public tests were written first and observed red for the intended reason, as reported by the authoring subagents:

- Core test: `Cannot find module '../src/core/skill-check.js'`, exit 1.
- CLI test: 12 failed and 1 passed, exit 1. The command was absent; the existing `measure.ts report` case already passed.
- Package test: exit 1 at the first `skill-check` run, with no result JSON.

The raw outputs of these red runs were **not saved** to the log folder. They are recorded here from the subagents' reports only.

Implementation followed. The implementing subagent reported narrow results: build exit 0; `tests/skill-check.test.ts` 53 passed, 1 skipped, exit 0; `tests/skill-check-cli.test.ts` 13 of 13, exit 0; `tests/skill-check-package.test.ts` 1 of 1, exit 0; three `tsc` checks, exit 0. The extraction subagent reported that `skills:quality` report output was byte-identical before and after the extraction. These narrow results are subagent reports, not orchestrator-saved logs.

## Corpus hash correction

The approved design pinned the corpus SHA-256 as `dc1d3edba4051ef0e25ed8b9ad97d1435423a06b768f07075b5b7a4e1fb70969`. That value is the hash of the Windows CRLF checkout of `tests/fixtures/skill-boilerplate-corpus.txt` (6,338 bytes). The committed blob is LF: 6,245 bytes, SHA-256 `39840b497ae274b48be9220684c6d89ea8f886f06a687409e1c2ed887a51b705`. Both values were re-checked against the working tree for this record.

Linux CI and the npm package carry the LF blob. The implementation therefore pins the LF hash. `registry/quality/skill-boilerplate-corpus.txt` holds the LF bytes and is pinned `text eol=lf`. A CRLF copy is rejected as CORPUS_MISMATCH. The maintainer was told of this change during the session and has not objected. **Explicit confirmation is still awaited.** The design file carries a dated correction note; its later mentions of the old hash are historical.

## Gate results

Commands were run by the orchestrator with raw output saved under `logs/plan-033-p8a-2026-11-12/`.

| Command | Exit | Counts | Raw files |
| --- | --- | --- | --- |
| `npm run hostlib:verify` | 0 | Snapshots match their lockfiles and every guide citation resolves | `hostlib-verify.stdout.txt`, `hostlib-verify.exit.txt` |
| `npm run typecheck` | 0 | Build succeeded; all `tsc` checks passed | `typecheck.stdout.txt`, `typecheck.exit.txt` |
| Full suite, run 1: `npm test` (parallel, inside a Claude Code session) | 1 | 287 files: 5 failed, 282 passed. Tests: 23 failed, 5,751 passed, 211 skipped of 5,985. 297.68 s | `full-test-run1-parallel-failed.stdout.txt`, `.stderr.txt`, `.exit.txt` |
| Narrow rerun, launcher and evaluator files | not recorded | Launcher file: 46 passed. Evaluator file: 5 failed, before the regex fix | `narrow-rerun.stdout.txt` (no exit file in the folder) |
| Evaluator file rerun after the regex fix | not recorded | 30 of 30 passed | `evaluator-delivery-rerun.stdout.txt` (no exit file in the folder; the file reports no failures) |
| Full suite, run 2 (serial): `env -u CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS npm test -- --maxWorkers=1 --fileParallelism=false` | 0 | 287 of 287 files passed. Tests: 5,774 passed, 211 skipped of 5,985. 1,102.02 s | `full-test-run2-serial.stdout.txt`, `.stderr.txt`, `.exit.txt`, `.command.txt` |

The serial run 2 stderr contains Vite warnings "File URL path must be absolute" from `tests/image-generation-skill.test.ts`, and two usage lines from `sample-size.mjs` and `srm-check.mjs`. Neither affected the exit.

The serial run 2 is the accepted full-suite result for this slice. It is the same serial form used for the P7 gate.

## The failed first run and its causes

Run 1 exited 1. The failures were:

- **Session environment (16 failures).** `tests/agent-factory-coordinator-launcher.test.ts` had 15 failing tests and `tests/agent-factory-coordinator-package.test.ts` had 1. The session exported `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`, which the factory launcher correctly refuses with "Claude factory startup supports only foreground project native sessions without background, plugin or teams options." The launcher file passed with the variable unset (46 of 46). The package-test failure has the same refusal message. The run summary gave 15 failures across both files; the log shows 16 (15 + 1).
- **Timeouts under parallel load (2 failures).** Two package tests reached the 30,000 ms limit: `tests/agent-factory-bundle-template-package.test.ts` and `tests/contract-check.test.ts`. The run summary named three timeouts, including the coordinator package. The log shows only two timeouts; the coordinator package failed for the environment reason above, not a timeout.
- **Evaluator front-matter regex (5 failures).** `tests/agent-factory-evaluator-delivery.test.ts` failed five tests with `TypeError: Cannot read properties of null (reading '1')`. The cause, as recorded, was an LF-only front-matter regex meeting the CRLF working file. The one-line regex fix made the file 30 of 30 in the narrow rerun.

The first run's total failure count (23) is consistent with these groups: 16 environment, 2 timeouts, 5 evaluator.

## The working-tree event

At 15:06:40 local time, after the P7 close, an uncompleted Cline session run by the maintainer on this worktree rewrote files. The P7 frozen packet `scratch/plan-033-implementation/p7-final-review-2026-11-12/files` holds 177 files. Compared with it, this record's check found:

- 46 files byte-identical;
- 127 files differing only in line endings (now CRLF);
- 4 files differing in content: `src/cli.ts` and `src/core/types.ts` (this slice's additions, with no lines removed), `tests/agent-factory-evaluator-delivery.test.ts` (the regex fix), and `docs/adr/0067-claude-factory-realization-delivery.md` (the P8a decision section, written by that Cline session).

So the P7 raw on-disk hashes no longer match for those 127 files, although their content is unchanged after line-ending normalisation. The event report says 176 files were rewritten; the comparison covers 177 packet files (46 + 127 + 4 = 177). The source of the 176 figure is not reconciled by the logs. The maintainer confirmed the Cline instances are closed.

## Implementation choices awaiting review

These go beyond the design text and need maintainer review:

- A relative `--artifact` or `--corpus` path is a usage result (exit 2).
- A candidate containing links, special files, case clashes or exceeding the limits is rejected with PATH_UNSAFE or INPUT_LIMIT (exit 1) before any gate runs. Its inventory is empty and its digest is null.
- Options are declared `[path]`, so a missing value reaches the JSON exit-2 route rather than the CLI library's prose error.
- An extra export, `skillCheckUsageResult`.
- A corpus larger than 64 KiB is CORPUS_MISMATCH with a null sha256.
- A walk bound of 1,024 entries.

## Unverified

- The case-collision path check was skipped on this case-insensitive filesystem.
- Behaviour on Linux and in CI.
- `OUTPUT_LIMIT` through the real CLI; only the core test covers it.
- The full addon lifecycle matrix was **not run** for P8a. The design does not require it, because installer resolution and ownership are untouched.
- The `corpus` subcommand of `scripts/skill-quality/measure.ts` was not compared before and after the extraction.
- No independent review packet or frozen-hash packet has been produced for P8a yet.
- Semantic usefulness of any candidate; the legal truth of licence and author declarations; native loading; any live behaviour.

Passing `skill-check` means only that the deterministic gates passed.

## Next

1. Maintainer confirmation of the corpus hash correction and of the implementation choices above.
2. An independent review packet for P8a, if wanted.
3. P8b needs its own concrete review and approval before any work: the native Skill grant, the return checker and schemas, and the consumer. The native Skill argument schema is still unresolved.

All remaining Plan 033 work stays required. The Claude stage precedes Codex, then Antigravity, then Cline. Plan 033 is not complete.

## 2026-11-13 — independent review, fixes and maintainer confirmation

**Review.** An independent reviewer who did not write the code reviewed P8a. The full report is `scratch/plan-033-implementation/p8a-independent-review-2026-11-13/REVIEW.md`. It found no blocker. It found two major findings: F1 and F2. Both are quadratic regular expressions, in `src/core/skill-portability-lint.ts` and `src/core/skill-quality.ts`. On hostile inputs of about 256 KiB, the gate took 14 to 43 seconds, and the results it gave were still correct. The review also gave seven minor findings (F3 to F9) and four notes (F10 to F13). The reviewer confirmed that the three moved gates are extracted without change from HEAD, and that the digest is character-identical to the one in `check-review.mjs`.

**Fixes.** The fixes were written test first, by a separate fixes agent (as reported by that agent).

- F1 and F2 are now linear. The new `tests/skill-hostile-input.test.ts` (75 tests) compares the old and new results on the same inputs. The hostile probes now take 0.12 to 0.64 seconds. The `skills:quality` report is byte-identical before and after.
- F4 is narrowed by the orchestrator's decision. `skill-check` reports PATH_UNSAFE only for a SKILL.md link under `examples/`, `references/`, `assets/` or `scripts/` that normalises to a path outside the folder. Links to sibling skills are not flagged. Five registry skills use such links 11 times.
- F6: a folder without `SKILL.md` is INPUT_UNAVAILABLE, exit 2, with an empty inventory and a null digest.
- F8: run-level findings are kept ahead of gate findings when the output reaches its limit, and the byte bound is checked again.
- F9: candidate YAML warnings no longer reach stderr.
- F10: the corpus must be a regular file, checked by `lstat`. Links and FIFOs are refused.
- F11: an internal error gives an unavailable JSON result and exit 2. New exports: `runSkillCheck` and `skillCheckInternalErrorResult`.
- F12: the measure is null after drift turns a gate unavailable.
- Test quality: vacuous assertions were replaced. The package test gained an execution sentinel and an empty-stderr assertion.

**Recorded limit.** F3 (a live file can change and be reverted during a run) is a recorded limit by the maintainer's decision of 2026-11-13, "Record as a limit (Recommended)".

**Open.** F5 (a gate that throws on malformed data replaces its earlier findings with one message), F7 (the checker accepts invalid UTF-8 content and Windows-reserved names that the P5 snapshot rejects) and F13 (an `--artifact` path through a junction ancestor, or with `..`, is accepted, unlike in P5) are open. None is fixed.

**Earlier unverified items closed by the review.** The reviewer closed three items that this record listed as unverified: the case-collision path check (PATH_UNSAFE, exit 1, on a case-sensitive NTFS directory, where `tests/skill-check.test.ts` passed 54 of 54); OUTPUT_LIMIT through the real built CLI (150 empty evals gave exit 2, 256 findings, 76,247 bytes); and the `measure.ts corpus` output, identical before and after the extraction. The combined 2026-11-13 gate also ran the full addon lifecycle matrix (`tests/e2e-domain-conformance.test.ts` with `AGENTS_CI_FULL=1`: exit 0, 317 passed, none skipped), which this record listed as not run.

**Still unverified after the fixes.** The F11 path through the real CLI is covered by unit tests only. The FIFO corpus case is skipped on Windows. Linux and CI behaviour is unverified. The reverted-change race of F3 is a recorded limit.

**Maintainer confirmation.** On 2026-11-13 the maintainer chose "Confirm both (Recommended)". This confirms the corpus pinned to the committed LF bytes (SHA-256 `39840b497ae274b48be9220684c6d89ea8f886f06a687409e1c2ed887a51b705`, not the design's CRLF value) and the six implementation choices listed above under "Implementation choices awaiting review". The awaiting-confirmation items of this record are therefore settled.

**Gate.** The fixes and the P8b stage 1 work were gated by one combined run on 2026-11-13. Its results and raw files are in [the P8b stage 1 record](plan-033-p8b-verification-2026-11-13.md).
