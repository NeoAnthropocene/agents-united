# Plan 033 P14, the Bundle route through the coordinator and the first Linux runs: verification, 2026-11-15

P14 delivers the manual-import Bundle proposal route (`author-bundle`) through the coordinator offline and uncommitted on top of `81e9810`, built test-first by one Claude subagent in its own worktree, reviewed independently by another model and fixed before integration, alongside the branch's first Linux CI runs (`aa9d8d8`, `81e9810`). Everything in P14 is offline. No live Host, model or provider run took place, and no private records were accessed. See [ADR 0067](adr/0067-claude-factory-realization-delivery.md) (sections dated 2026-11-15), [the P13 verification record](plan-033-p13-verification-2026-11-15.md), [the P12 verification record](plan-033-p12-verification-2026-11-15.md), [the P11 verification record](plan-033-p11-verification-2026-11-15.md), [the P10 slice 1 verification record](plan-033-p10-verification-2026-11-15.md) and [the P9 verification record](plan-033-p9-verification-2026-11-15.md).

## Scope and baseline

- Date: 2026-11-15.
- Branch: `codex/plan-033-claude-delivery-nov10`, pushed; draft pull request 219 against `dev` is open.
- Commits on the branch: `2fd7f2d`, `552746d`, `3c48421`, `a9dae87` (P9), `2db25b0` (P10 slice 1), `2bbeb95` (P11), `5a817ab` (P12), `2d7b385` (P13), `7912f17` (scripted-workflow decision, documents), `aa9d8d8` (two test faults that only Linux showed), `81e9810` (CI job time limit).
- This work ("P14") sits on top of `81e9810` in the working tree and is uncommitted when these records are written.
- Local gate environment: Node 24.19.0, Windows. No live Host, model or provider run. No private records.
- Earlier records of the same day exist and are added to without rewriting them. The P13 record and additions state that the Bundle route is not built and that the coordinator has no route that runs `bundle-check`; that was true for P13 and is superseded by this work.

## The first Linux runs

The first CI run of draft pull request 219, on `5a817ab`, hung in the test step and was cancelled by the orchestrating session after 30 minutes (the workflow had no job time limit); the runs on `2d7b385` and `7912f17` were cancelled for the same reason.

**Both faults were in test code**, and both were new on this branch:

1. `tests/skill-check.test.ts` never finished, because its named-pipe test (skipped on Windows) creates a FIFO inside the fixture root and the test's own `treeImage` helper read every entry with `readFileSync`, which blocks on a FIFO. The product code is not at fault (`readCorpus` refuses a non-regular file by `lstat` before opening anything).
2. Ten package test files installed the packed tarball with `npm install --offline`, which fails with `ENOTCACHED` on a clean CI machine because a lockfile install (`npm ci`) caches the dependency tarballs but not the registry metadata documents.

Fixes in `aa9d8d8` (13 files):

- `treeImage` in `tests/skill-check.test.ts` records a non-regular file by name and never opens it.
- One shared helper, `tests/helpers/packed-package.ts`, runs `npm install --offline` and retries once with `--prefer-offline` only on `ENOTCACHED`. The helper's own unit test was written after the helper (not seen failing first).

First green Linux run: `aa9d8d8` on GitHub Actions (`ubuntu-latest`, Node 24.22.2): 302 test files passed; 7,330 tests passed, 216 skipped, of 7,546; 358.63 s (under seven minutes for the whole job). The helper's retry line appears once in that log.

Job time limit: `81e9810` adds `timeout-minutes: 30` to the `test` job in `.github/workflows/ci.yml`, at the maintainer's word (**`"Yes, please add."`**).

Not done: a list of which tests are skipped on Linux and which on Windows.

## Decisions this rests on

Maintainer decisions (his words quoted):

- **`"Yes, validator first"`** (2026-11-15): the Bundle route ends in the deterministic `agents bundle-check`.
- **`"A: helper script"`** (2026-11-15): a small helper in `author-bundle` writes the return record with exact hashes, as the Skill and contract routes do. Not chosen: the model computing hashes itself (option B); no return record (option C).
- **`"record none"`** (2026-11-15): no scripted workflow; recorded in `7912f17`. This work adds the test in `tests/agent-factory-coordinator-delivery.test.ts` that pins `Workflow` out of the coordinator's tools.
- **`"Create a draft PR on dev for the whole local commits that you created for this Plan 033. You will add the improvements on that PR when you proceed on the milestones."`** The orchestrating session's reading, told to him: each milestone, once gated and with its records, is committed and pushed to that branch; merging and leaving draft stay his.

Fixed by the orchestrating session without asking (inside those decisions; reported to him, not asked):

- The route has no evaluator step, because `evaluate-artifact` has no subject kind for a whole Bundle (the hand-back says an independent quality review of a whole Bundle is unavailable).
- The checker binds the output to the task and leaves the rest of the content to `agents bundle-check`.

## The Bundle route

### How it runs

1. **Entry.** Start through the launcher or run `agents start agent-factory --host claude --dry-run` before manual dispatch; direct `claude --agent` entry bypasses launcher checks.
2. **Task setup.** The coordinator fixes roots (draft, producer and evidence, disjoint from each other and from source checkout, source registry, managed and protected roots, with no managed Host folder segment), the baseline for an `update` (snapshotted in the evidence root), `inputPins[]` and `provenance.evidence[]`, `contributionTemplate` (pinned `.github/PULL_REQUEST_TEMPLATE/artifact-contribution.md` for `upstream`, `null` for `local`), `installed[]` (all 20 installed `author-bundle` files), `runtime` (`validator` at `<checkout>/dist/cli.js`, `checker` installed `check-bundle-return.mjs`, physical Node `>=24` `executable`) and `source.head`, and writes `<evidence>/bundle-task.json`.
3. **Preflight.** The coordinator runs `node "${CLAUDE_SKILL_DIR}/scripts/check-bundle-return.mjs" --job <absolute task>` and reads stdout, stderr and the actual exit. A nonzero exit blocks dispatch. (`create` and `reuse` require an absent draft root; `update` requires the live draft to equal the pinned baseline.)
4. **Maintainer invocation.** The coordinator still has no `Skill` tool and does not start the fork: the maintainer types `/author-bundle <absolute task path>`.
5. **Host return inspection.** The coordinator inspects what the Host actually returned (foreground, returned text, no background or teammate).
6. **Fork work.** The `author-bundle` fork reads the task, writes only the four proposal files (`bundles.json`, `leader-responsibility.md`, `bindings.json`, `report.json`) in `roots.draft` by ordinary editing, optionally writes `bundle-notes.json` in `roots.producer`, runs `node "${CLAUDE_SKILL_DIR}/scripts/bundle-return.mjs" --job <task path> [--notes <notes path>]` once (writing `<roots.producer>/bundle-return.json`), and replies with the paths.
7. **Caller preservation.** The coordinator never edits the four proposal files and never reruns `bundle-return.mjs`; it reads the files itself.
8. **Postflight.** The coordinator runs `node "${CLAUDE_SKILL_DIR}/scripts/check-bundle-return.mjs" --job <absolute task> --result <absolute return>`. A nonzero exit or a missing return is rework.
9. **Deterministic validation.** The coordinator runs `node <checkout>/dist/cli.js bundle-check --artifact <draft root> --registry <source.registry> --operation <operation>` (adding `--allow-unresolved` only when `validation.allowUnresolved` is true, as printed in the postflight success line's `bundleCheck`), saving the command, stdout, stderr and exit code in the evidence root. Exit `0` passed, `1` failed, `2` unavailable; a nonzero exit is rework.
10. **No evaluator step.** `evaluate-artifact` has no subject kind for a whole Bundle, so no P5 review runs; the hand-back records that independent quality review of a whole Bundle is unavailable and that named unrealized members are separate tasks.
11. **Bounded repair (`r1`).** At most one repair, and only if the accepted brief already authorized it: create a new `r1` evidence and producer directory, snapshot the current draft including preserved files, write an `r1` `update` task (`previous.reviewResultSha256: null`), obtain a fresh `/author-bundle <r1 task path>` invocation from the maintainer, and repeat steps 3 to 9.
12. **Hand-back.** Deliver the candidate with the evidence (`bundle-task.json`, `bundle-return.json`, `bundle-notes.json` when written, both checker outputs with exits, and the saved `bundle-check` output and exit) or precise rework. Local intent stops; upstream intent only prepares the pinned contribution template (`base: "dev"`, `sent: false`, no commit, push, pull request or publication), and a human continues from `references/contribution.md`.

### New files

- `registry/skills/author-bundle/scripts/bundle-return.mjs` (the helper)
- `registry/skills/coordinate-artifact/scripts/check-bundle-return.mjs` (the checker)
- `registry/skills/coordinate-artifact/assets/bundle-task.schema.json`
- `registry/skills/coordinate-artifact/assets/bundle-return.schema.json`
- `registry/skills/coordinate-artifact/references/bundle-authoring.md` (the route)
- `tests/agent-factory-bundle-return.test.ts`
- `tests/agent-factory-bundle-helper.test.ts`
- `tests/helpers/bundle-task.ts`

### The helper

`registry/skills/author-bundle/scripts/bundle-return.mjs` (`--job <absolute bundle-task.json> [--notes <absolute notes file>]`):

- Computes `taskDigest` by the checker's rule (SHA-256 of canonical JSON with keys sorted at every level and no whitespace). The code is duplicated on purpose because one Skill does not import another Skill's script; a test requires both digests to be equal.
- Applies the checker's root rules, strict UTF-8 decoding that refuses a byte-order mark, bounded no-follow reads (`O_NOFOLLOW` where available, `lstat` before open), file-name validity checks and case-collision refusal.
- Inventories the draft root without following links and within the task budget, works out the `changed` list against `baseline`, pins `report.json`, and writes exactly `<roots.producer>/bundle-return.json` (refusing any existing link or non-regular file at the return path).
- Reads `status`, `openItems`, `unverified`, `claimedChecks`, `externalActions` and `upstreamEvidence` from an optional notes file in the producer root (named `bundle-notes.json` by convention), validated against the limits of `bundle-return.schema.json` before writing.
- Never writes inside the draft root and executes nothing. Exit `0` prints one JSON line; exit `1` prints one blocked JSON line on stderr and writes nothing.

### The checker

`registry/skills/coordinate-artifact/scripts/check-bundle-return.mjs` runs preflight (`--job <abs>`) and postflight (`--job <abs> --result <abs>`), plus `--help`, on the model of `check-contract-return.mjs`:

- **Preflight and general codes:** `USAGE`, `JOB_INVALID`, `ROOT_CONFLICT`, `CLOSURE_MISSING`, `LOADER_MECHANISM`, `RUNTIME_MISMATCH`, `BASELINE_MISMATCH`, `CHECKOUT_HEAD`, `LIMIT`, `STALE_INPUT`.
- **Postflight codes:** `RESULT_PATH`, `RESULT_INVALID`, `HELPER_RECORD`, `DIGEST_MISMATCH`, `EXTERNAL_ACTION`, `BLOCKED_STATE`, `SCOPE_VIOLATION`, `PRESERVATION`, `BYTES_MISMATCH`, `INVENTORY_MISMATCH`, `DIFF_MISMATCH`.
- Recomputes inventory, `changed` list and `report.json` pin from the final bytes and does not accept the return's claims (`claimsNotAccepted`, `producerIdentity: "unauthenticated"`).
- Every success and failure line carries `quality: "pending"`, `executionProof: "unverified"`, `live: "unverified"`, `acceptedDraft: false`.

Division of checks across the route:

| Bound to the task by `check-bundle-return.mjs` | Left to `agents bundle-check` | Checked by neither |
| --- | --- | --- |
| Four proposal files are valid UTF-8 and the three JSON files (`bundles.json`, `bindings.json`, `report.json`) parse | `<...>` placeholders in `bundles.json`, `bindings.json` and `leader-responsibility.md` | `leader-responsibility.md` prose content and headings (beyond UTF-8 and no `<...>` code-span placeholder) |
| `bundles.json` holds `bundles[<task.bundle.name>]` whose `name`, `version`, `status`, `domain`, `category`, `description` and `tier` equal the task's | Other Bundle records in `bundles.json` and manifest envelope/field shapes | `report.json` content and hashes (beyond being a JSON object) |
| `bundles[<task.bundle.name>]` roster equals the task's: `agents` and `skills` with the same entries in the same order; `orchestrator` and `parentBundle` equal (absent or null where the task has null) | References to registry members (orchestrator, agents, skills, workflows, rules, parent bundle, recommended addons) | Licence truth |
| Every `fixedValues` entry appears as a whole token (not directly preceded or followed by `[A-Za-z0-9_-]`) in `bundles.json`, `leader-responsibility.md` or `bindings.json` (not in `report.json`) | The Bundle rules (`host-agent-router`, `handoff`, `git-guardrails` once each; tier rules; `bindings.json` consistency tokens) | Quality (and live loading or execution) |
| `report.json` is a JSON object (plus task, return, root, closure, runtime, baseline, scope, preservation, report pin and upstream template prefix checks) | — | — |

### Closure

- `bundle-return.mjs` is the twentieth installed file of `author-bundle` (`registry/hosts/claude/agent-factory-bundle.binding.json`, 11 `requiredSupport` paths plus `SKILL.md`, `assets/claude-binding.json` and 7 `references`; `src/core/claude-contract-binding.ts`, which pins that closure).
- Four new support paths of the coordinator's Skill (`references/bundle-authoring.md`, `scripts/check-bundle-return.mjs`, `assets/bundle-task.schema.json`, `assets/bundle-return.schema.json`), 21 in all (`COORDINATOR_SUPPORT` in `src/core/claude-factory-declaration.ts`; `requiredSupport` in `registry/hosts/claude/agent-factory-coordinate.binding.json`).
- No grant or preload change.

### Text changes

- Both `coordinate-artifact` entries (`registry/skills/coordinate-artifact/SKILL.md` and `registry/hosts/claude/skills/coordinate-artifact/SKILL.md`) name the route (`references/bundle-authoring.md`), the two schemas and the checker (`scripts/check-bundle-return.mjs`).
- The agent body `registry/hosts/claude/agents/orchestrator-agent-factory.md` has a paragraph `"One Bundle proposal"` and states that the maintainer, not the coordinator, invokes the three forks (`author-skill`, `author-contract`, `author-bundle`).
- Both `author-bundle` entries (`registry/skills/author-bundle/SKILL.md` and `registry/hosts/claude/skills/author-bundle/SKILL.md`) and `registry/skills/author-bundle/references/job.md` carry the task-path mode and helper invocation.
- `registry/skills/coordinate-artifact/references/contribution.md` (11,133 characters) names the route's evidence in its `Bundle proposal` section.
- One sentence left the native `author-bundle` entry for room (`"P5 cannot review a whole Bundle; partition supported components or report review unavailable."`); the shared entry never had it; its rule stands in `registry/skills/author-bundle/references/verification.md`, which step 5 of both entries names; a test in `tests/agent-factory-bundle-return.test.ts` pins that.

### Sizes

| Skill | Shared `SKILL.md` (chars) | Native as source (chars) | Native before P14 (chars) | Native as installed (chars) | Limit |
| --- | --- | --- | --- | --- | --- |
| `coordinate-artifact` | 5,407 | 5,788 | 5,637 | 5,993 | 6,000 (native source pinned `<= 5,788`; installed pinned `<= 6,000`) |
| `author-bundle` | 5,087 | 5,779 | 5,663 | 5,978 | 6,000 (installed pinned `<= 6,000`) |

The test in `tests/agent-factory-coordinator-delivery.test.ts` that kept the native coordinator entry at or under 5,720 characters was a reserve for this route and now pins 5,788. A new test in `tests/agent-factory-bundle-return.test.ts` keeps the installed form of both native entries (with their managed headers) at or under 6,000 characters.

## Tests

- `tests/agent-factory-bundle-return.test.ts`, `tests/agent-factory-bundle-helper.test.ts` and `tests/helpers/bundle-task.ts`:
  - End-to-end seam without any Host: a Domain `create` against a small fixture registry (preflight, the four files written as the fork would, the helper, postflight, then the built `dist/cli.js bundle-check`, every step exit `0`) and an Organization `create` as well.
  - One fault per checker code, shared tables of bad roots and bad entry names run against both scripts, and the helper's own cases.
- `tests/agent-factory-coordinator-delivery.test.ts`: refuses an install whose coordinator `tools` also list `Workflow`, and pins that the committed `tools` list contains no `Workflow`.
- Updated pins across `tests/agent-factory-coordinator-package.test.ts`, `tests/agent-factory-coordinator-lifecycle.test.ts`, `tests/agent-factory-coordinator-launcher.test.ts`, `tests/agent-factory-contribution-runbook.test.ts`, `tests/agent-factory-bundle-template-package.test.ts`, `tests/helpers/factory-coordinator.ts` and `tests/helpers/factory-bundle-template.ts`.
- Not seen failing first: many negative cases in the first round were not seen failing first, made up for by deliberate mutations of both scripts.

## Independent review

Read-only review by another model (Antigravity, Gemini 4 Hydrogen; `review-bundle-route.report.md` in `scratch/plan-033-implementation/routed-2026-11-14/`): verdict `"acceptable after the listed fixes"`; no blocker, seven major, four minor, two notes. All taken.

| Point | Reproduced or covered by temporary removal of the check | What changed |
| --- | --- | --- |
| Checker accepted relative paths and `..` segments in `report` pin and upstream `templatePath` of a return | Reproduced by a failing test | `check-bundle-return.mjs` refuses relative or alias-bearing `report.path` and `templatePath` (or mismatched casing/spelling) with `HELPER_RECORD` |
| Helper wrote through an existing link at the return path and read without a size cap | Reproduced by a failing test | `bundle-return.mjs` refuses links or non-regular files at the return path, opens with `O_NOFOLLOW`, and uses bounded reads (`readBounded`) instead of `readFileSync` / `writeFileSync` |
| Helper did not repeat the checker's root rules | Reproduced by a failing test | `bundle-return.mjs` repeats the checker's root rules (`checkRoots`: link-free, no managed Host folder, mutually disjoint, existing checkout/registry/producer, upstream template inside checkout) |
| Two scripts disagreed on a byte-order mark in `bundle-task.json` | Reproduced by a failing test | Both scripts decode with `TextDecoder('utf-8', { fatal: true, ignoreBOM: true })` and refuse a BOM |
| Two scripts disagreed on file-name validity and on names differing only in case | Reproduced by a failing test | Shared table of refused entry names (`safeName` / `relative`) and case-collision refusal run against both scripts |
| Checker ignored empty folders in the draft root | Reproduced by a failing test | `snapshot` tracks `dirs`, compares `dirs` on preflight and blocked returns, and refuses new folders on draft returns (`SCOPE_VIOLATION` / `BLOCKED_STATE` / `BASELINE_MISMATCH`) |
| Helper could write a return that does not conform to `bundle-return.schema.json` | Reproduced by a failing test | `bundle-return.mjs` validates task fields and notes (`checkTask`, `readNotes`) against the schema bounds before writing |
| `fixedValues` matched inside longer words and in `report.json` | Reproduced by a failing test | `check-bundle-return.mjs` checks whole tokens (`(?<![A-Za-z0-9_-])...(?![A-Za-z0-9_-])`) in `bundles.json`, `leader-responsibility.md` and `bindings.json` only, excluding `report.json` |
| A test that never reached the code it named | Reproduced | Test fixed to reach the intended code |
| Route text (`references/bundle-authoring.md`) did not say what the checker leaves unchecked | Reproduced by a failing test | `references/bundle-authoring.md` states what `check-bundle-return.mjs` leaves to `bundle-check` and what neither checks |
| Eleven untested error paths | Covered without a failing test first, because the code already handled them (each shown by removing the check temporarily) | Tests added for the eleven error paths across `tests/agent-factory-bundle-return.test.ts` and `tests/agent-factory-bundle-helper.test.ts` |
| Reviewer's question on the orchestrating session's own decision: task fixes the roster, only seven fields were bound, and `bundle-check` never sees the task | Reproduced by a failing test | `check-bundle-return.mjs` now binds `agents` and `skills` (same entries, same order) and `orchestrator` and `parentBundle` (equal, absent or null where the task has null) |

The reviewer also questioned a decision of the orchestrating session and was right: the task fixes the roster (`agents`, `skills`, `orchestrator`, `parentBundle`), yet only seven fields were bound in the first build and `agents bundle-check` never sees `bundle-task.json`; the roster is bound now.

## How the work was done

- Briefed, reviewed and integrated by the orchestrating Claude Code session.
- The Bundle route and its fix round: one Claude subagent (Opus 5.5), in its own worktree, test-first. The route worktree started from `5a817ab` with the P13 files and was merged with the later commits on the branch (two package test files had also changed in `aa9d8d8`).
- The Linux fixes (`aa9d8d8`): one Claude subagent (Sonnet 5.5).
- The independent review and these documentation records: Antigravity (Gemini 4 Hydrogen). Workers did not commit.
- The orchestrating session compared each report with the files changed, read the route reference and the changed entry text, and re-ran each acceptance. Claude workers run as subagents of the session, at the maintainer's word.
- Scratch records (untracked): `scratch/plan-033-implementation/routed-2026-11-14/` (`DECISIONS-2026-11-14.md`, `p15-bundle-route-spec.spec.md`, `p26-bundle-route-build.brief.md`, `review-bundle-route.report.md`, `FACTS-P14.md`).

## Gate results

Windows gate run by the orchestrating session on the merged uncommitted tree (`base-head.txt` is `81e9810`, `tree-status.txt` lists the uncommitted files), Windows, Node 24.19.0; raw files in `logs/plan-033-p14-2026-11-15/` (each step with `.command.txt`, `.stdout.txt`, `.stderr.txt`, `.exit.txt`). One run. Shown beside the first green Linux CI run (`aa9d8d8`, before P14):

| Command / Run | Exit | Counts | Raw files |
| --- | --- | --- | --- |
| `hostlib-verify` (Windows, uncommitted on `81e9810`) | 0 | Passed | `hostlib-verify.{command,stdout,stderr,exit}.txt` |
| `typecheck` (Windows, uncommitted on `81e9810`) | 0 | Passed | `typecheck.{command,stdout,stderr,exit}.txt` |
| `full-test-serial` (`env -u CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS npm test -- --maxWorkers=1 --fileParallelism=false`; Windows, uncommitted on `81e9810`) | 0 | 304 files passed; 7,556 tests passed, 224 skipped, of 7,780; 1,548.33 s | `full-test-serial.{command,stdout,stderr,exit}.txt` |
| `addon-matrix` (`AGENTS_CI_FULL=1 env -u CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS npx vitest run tests/e2e-domain-conformance.test.ts --maxWorkers=1 --fileParallelism=false`; Windows, uncommitted on `81e9810`) | 0 | 317 passed, none skipped; 437.79 s | `addon-matrix.{command,stdout,stderr,exit}.txt` |
| Linux CI (`aa9d8d8`, GitHub Actions, ubuntu, Node 24.22.2, before P14) | 0 | 302 test files passed; 7,330 tests passed, 216 skipped, of 7,546; 358.63 s (install helper retry line once) | GitHub Actions log for `aa9d8d8` (draft PR 219) |

For comparison: the P13 gate on Windows ran 301 files, 7,241 passed, 223 skipped, of 7,464. The Linux result for this P14 work is the CI run of the commit that contains it.

## Known and left

- **Installed entries over 6,000 characters (settled 2026-11-15):** the installer adds a managed header of about 200 characters to a native entry. The layout rule measures the source entry; one package test (from P6) measures the installed `author-bundle` entry, and this work adds the same for `coordinate-artifact` and `author-bundle` (`tests/agent-factory-bundle-return.test.ts`). Measured as source at `81e9810`: `author-contract` 5,895, `sync-host` 5,936, `realize-artifact` 5,809; with the header these exceed 6,000 as installed (the worker measured `author-contract` at 6,096 by a real install). Older than this work. Settled on the same night: the maintainer recalled the limit as one for the source entry and asked for its origin to be checked. It is the repository's own rule, not a Host limit: the amendment of 2026-10-05 to ADR 0040 ([docs/adr/0040-skill-rewrite-policy-and-quality-gate.md](adr/0040-skill-rewrite-policy-and-quality-gate.md): "`SKILL.md` is at most 90 lines and 6,000 characters") and [docs/skill-intake.md](skill-intake.md) ("the shared `SKILL.md` is at most 90 lines and 6000 characters ... the host limits above do not relax this stricter repository gate"); `checkSkillLayout` in `src/core/skill-layout.ts` measures the file it is given, which is the source entry. The Host's own figures are far higher and still current in its documentation (read again on 2026-11-15): `SKILL.md` under 500 lines; after compaction the first 5,000 tokens of each invoked Skill are kept, within 25,000 tokens for all; the listing cuts `description` plus `when_to_use` at 1,536 characters; Cline asks for under about 5,000 tokens. An installed entry of about 6,100 characters is about 1,500 tokens. So the three installed entries above 6,000 characters break no rule and nothing is trimmed. The two tests that measure an installed entry (`author-bundle`, from the P6 slice, and `coordinate-artifact`, from this work) are stricter than the rule and stay as they are.
- The helper names the notes file `bundle-notes.json` by convention and does not enforce the name.
- The route has no evaluator step (no subject kind for a whole Bundle).
- From earlier, unchanged: the loader's prototype lookup (`manifest.bundles[identifier]`); a worker's closure validated through the coordinator's dependency check only; the read-only guard's matcher is not a complete tool list; the sync runbook (`references/host-sync.md`) has not been executed end to end; which tests are skipped on Linux vs Windows has not been listed.

## Unverified

- Everything live: that the Host passes the typed path (`/author-bundle <absolute task path>`) to the fork as the invocation text, that the fork runs the helper once and in the foreground, which tools it holds, whether the coordinator's hook applies to it, and whether the coordinator follows the route.
- Linux for this work until its push: the POSIX-only cases (real bad file names, case-sensitive names, a named pipe in the draft root, the `O_NOFOLLOW` open) are skipped or emulated on Windows.
- No second-model review of the fix round itself; the orchestrating session read the changes and re-ran the acceptance.

## Next

1. The Claude stage proof: scenario scripts for a scratch workspace, then headless and interactive runs on the maintainer's word (including the typed observation for the `Skill` grant, hooks inside workers started with the `Agent` tool, and the guard failure mode).
2. Then the other Hosts in the plan's order (Codex needs the maintainer's yes).
