# Plan 033 P8b stage 1 delivery: offline verification, 2026-11-13

P8b is split into two stages. The maintainer approved stage 1 on 2026-11-13. Stage 1 adds the return checker, its schemas, the caller sequence and the coordinator support files. It does not change any grant. Stage 2, the bare `Skill` grant to the coordinator, is **not approved and not started**. Everything in this record is offline. No live Host, model or provider run took place.

## Scope and baseline

Branch `codex/plan-033-claude-delivery-nov10`. HEAD and fresh `origin/dev` were both `f2da922b07fca03cff14cad490c96fa6d067dd30`. Node 24.19.0. There is no open PR; the latest merged PR is #216. Nothing was committed, pushed or published.

This record covers stage 1 together with the P8a review fixes. Both were gated by one combined run on 2026-11-13, so the gate results below cover both.

## Maintainer decisions on 2026-11-13

1. P8b route: **"Two stages (Recommended)"**. Stage 1 is now. The bare `Skill` grant is a later, separate approval. The maintainer types `/author-skill <task path>` to start a draft.
2. Stage 1 scope: **"Approve as proposed (Recommended)"**. The proposal is `scratch/plan-033-implementation/p8b-proposal-2026-11-13/proposal.md`. Its decisions D1-C (stage 1 part), D3, D4 (stage 1 part), D5 (stage 1 part), D6 and D7 were approved. The author-skill task-path edit is the one rule change to the accepted native entry.
3. P8a confirmation: **"Confirm both (Recommended)"**. The corpus is pinned to the committed LF bytes, SHA-256 `39840b497ae274b48be9220684c6d89ea8f886f06a687409e1c2ed887a51b705`, not the design's CRLF value. The six implementation choices were also confirmed. The P8a record carries the detail.
4. P8a private copy: **"Record as a limit (Recommended)"**. The gates read the live folder. The final byte readback catches lasting changes. A change made and reverted during a run is a recorded limit (review finding F3).

Not approved: P8b stage 2. That covers the bare `Skill` grant to the coordinator, a `skill` capability in the core, `author-skill` in the coordinator contract, the author-skill closure in the coordinator receipt, and a `.factory-handoff` pointer file. The native Skill argument schema is still unresolved. Open questions 1, 2 and 4 of the proposal remain open. Question 3, editing the author-skill entry, is answered yes by decision 2.

## What was delivered

New files:

- `registry/skills/coordinate-artifact/scripts/check-skill-return.mjs`: the return checker (513 lines).
- `registry/skills/coordinate-artifact/assets/skill-task.schema.json` and `assets/skill-return.schema.json`: the two record schemas.
- `registry/skills/coordinate-artifact/references/skill-authoring.md`: the reference the coordinator reads.
- `tests/agent-factory-skill-return.test.ts` (189 tests) and `tests/agent-factory-skill-package.test.ts` (8 tests).
- `tests/helpers/skill-task.ts` and `tests/helpers/skill-candidate.ts`.

Changed files:

- `src/core/claude-factory-declaration.ts`: `COORDINATOR_SUPPORT` grows from 7 to 11 paths.
- `registry/hosts/claude/agent-factory-coordinate.binding.json`: `requiredSupport` lists the 11 paths. `reviewedInputs` is untouched.
- `registry/skills/coordinate-artifact/SKILL.md` (42 lines) and `registry/hosts/claude/skills/coordinate-artifact/SKILL.md` (43 lines): the caller sequence.
- `registry/hosts/claude/agents/orchestrator-agent-factory.md`: body only. It adds a "One Skill draft" section and corrects a closing sentence. It states that the main session has no Skill tool. Frontmatter and the tools line are unchanged.
- `registry/hosts/claude/skills/author-skill/SKILL.md`: the task-path rule, and "in the invocation" changed to "in the task" in one neighbouring sentence.
- `tests/helpers/factory-coordinator.ts` and the four files `tests/agent-factory-coordinator-{delivery,launcher,lifecycle,package}.test.ts`, updated for the new support paths.

## What was deliberately not changed

No grant, core contract, tools line, worker closure, installer, projector, launcher or CLI changed. The P2 and P5 schemas and checkers are untouched. The bare `Skill` grant, the `skill` capability and the `author-skill` coordinator entry belong to stage 2 and were not added.

## Test-first evidence

The evidence below comes from the implementing agents' reports. Their raw red output was not saved to the log folder.

- Checker test file: red 188 of 188 before the script existed (`--help` failed with `Cannot find module`). The gate run shows the file at 189 passing tests. The difference is not reconciled by any log.
- Coordinator files: red 67 of 111 before the declaration changed, all on "runbook-referenced support ... is absent from its required binding declaration". After the new expectations were added, red 83 of 132. The gate run shows the four coordinator files at 132 passing tests in total (delivery 76, launcher 46, lifecycle 9, package 1).
- Package test (`tests/agent-factory-skill-package.test.ts`): **the red was not observable.** It was written after the closure had already landed, and it passed 8 of 8 on its first run. No red was recorded, and none has been claimed.
- Checker mutation check (agent report, not re-run here): four checks were disabled one at a time, the matching tests failed each time, and the script was restored byte-identical.

## Gate results

Commands were run by the orchestrator from inside a Claude Code session. Raw output is in `logs/plan-033-p8b-2026-11-13/`; each command has `.command.txt`, `.stdout.txt`, `.stderr.txt` and `.exit.txt`.

| Command | Exit | Counts | Raw files |
| --- | --- | --- | --- |
| `env -u CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS npm run hostlib:verify` | 0 | Host library snapshots match their lockfiles; every guide citation resolves | `hostlib-verify.*` |
| `env -u CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS npm run typecheck` | 0 | Build succeeds (tsup ESM and DTS); the `tsc` checks print nothing on success | `typecheck.*` |
| `env -u CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS npm test -- --maxWorkers=1 --fileParallelism=false` | 0 | 290 of 290 files passed; 6,118 tests passed, 212 skipped, of 6,330; 1,255.22 s | `full-test-serial.*` |
| `AGENTS_CI_FULL=1 env -u CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS npx vitest run tests/e2e-domain-conformance.test.ts --maxWorkers=1 --fileParallelism=false` | 0 | 317 passed, none skipped; 438.88 s | `addon-matrix.*` |

The serial suite's stderr holds Vite "File URL path must be absolute" warnings from `tests/image-generation-skill.test.ts` and two usage lines from `sample-size.mjs` and `srm-check.mjs`. They do not affect the exit code.

The addon-matrix command file was first written without the `AGENTS_CI_FULL=1` prefix and was then corrected. The 317-case count shows that the full matrix ran.

The earlier parallel full-suite run of the P8a slice, which failed for environment and timing reasons, is recorded in the P8a record. No parallel full-suite run is recorded in this folder.

## Checker contract and readings pinned beyond the proposal

Checked by reading `check-skill-return.mjs` and the schema:

- Usage: `check-skill-return --job <absolute task.json> [--result <absolute return.json>]`, plus `--help`. Verified at the entry point.
- Success writes one JSON line to stdout and exits 0. Failure writes one JSON line to stderr with a machine `code` and exits 1. Verified.
- Read-only. The only subprocess is `git -C <checkout> rev-parse --verify HEAD`, a fixed call. Verified by grep: no other spawn, write, or delete call exists.
- 24 codes: `BASELINE_MISMATCH`, `BLOCKED_STATE`, `BYTES_MISMATCH`, `CHECKOUT_HEAD`, `CLOSURE_MISSING`, `DIFF_MISMATCH`, `DIGEST_MISMATCH`, `DRAFT_JOB_MISMATCH`, `EXTERNAL_ACTION`, `HELPER_RECORD`, `INVENTORY_MISMATCH`, `JOB_INVALID`, `LIMIT`, `LOADER_MECHANISM`, `PRESERVATION`, `PROVENANCE_MISMATCH`, `RESULT_INVALID`, `RESULT_PATH`, `ROOT_CONFLICT`, `RUNTIME_MISMATCH`, `SCOPE_VIOLATION`, `STALE_INPUT`, `TEMPLATE_INVALID`, `USAGE`. Verified by listing the literal codes in the script.
- `contributionTemplate` is a required top-level field of the task schema, and the schema forbids additional top-level properties. Verified.
- Revision rule: `r0` has no `previous` link and `r1` needs one. The script checks presence only. The values are recorded but not verified against anything. Verified.

Readings reported by the checker agent and not re-traced line by line here: `contributionTemplate` is pinned, or null for a local task; the baseline map is derived from the top-level `baseline[]`; helper fields are nullable when `runs` is 0; the combined `--job --result` mode skips the state-dependent preflight checks.

## Unverified

- Everything live: that a typed `/author-skill <task path>` reaches the fork with the path; that the fork reads the task, runs `draft.mjs` once, writes only inside its roots and returns the record; foreground behaviour; the tool pool and hook scope of the fork; evaluator usefulness; repair adherence; the prepared with, without and control comparisons.
- The fork has no helper to compute the canonical `taskDigest` it must echo. The runbook tells it to compute the digest, which may be awkward live.
- The checker cannot show who ran `draft.mjs` or that it ran exactly once.
- Linux and CI behaviour. The gate ran on Windows only.
- The package test's red, as stated above.
- No independent review of P8b stage 1 has been done.
- Counts of coordinator support files in `README.md`, `PROJECT.md` and other docs were not searched in this record.

## Next

1. An independent review of stage 1, if the maintainer wants one.
2. P8b stage 2 needs its own approval. Before it, the Skill call's argument shape needs primary evidence, and proposal questions 1, 2 and 4 need answers.
3. The remaining Plan 033 work stays required: the Claude stage (author-contract and author-bundle orchestration, host-update sync, hooks, the contribution route, private and adapted-source skill policies, and live proof), then Codex, Antigravity and Cline. Plan 033 is not complete.
