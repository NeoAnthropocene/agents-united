# Plan 033 P13, `agents bundle-check` and the installed contribution runbook: offline verification, 2026-11-15

P13 delivers two offline additions on top of local commit `5a817ab` (uncommitted when these records are written): the read-only command `agents bundle-check` and the installed contribution runbook with one canonical upstream-intent clause across every factory Skill. Each was built test-first by one Claude subagent in its own worktree, reviewed independently by another model, and fixed before combination. Everything in this record is offline. No live Host, model or provider run took place, and no private records were accessed. See [ADR 0067](adr/0067-claude-factory-realization-delivery.md) (sections dated 2026-11-15), [the P12 verification record](plan-033-p12-verification-2026-11-15.md), [the P11 verification record](plan-033-p11-verification-2026-11-15.md), [the P10 slice 1 verification record](plan-033-p10-verification-2026-11-15.md) and [the P9 verification record](plan-033-p9-verification-2026-11-15.md).

## Scope and baseline

- Date: 2026-11-15.
- Branch: `codex/plan-033-claude-delivery-nov10`. Local commits, none pushed: `2fd7f2d`, `552746d`, `3c48421`, `a9dae87` (P9), `2db25b0` (P10 slice 1), `2bbeb95` (P11), `5a817ab` (P12: review fixes, branch hygiene, maintainer decisions and the P12 records, committed locally on the maintainer's `"Yes, commit locally"`). The P12 records say `"uncommitted"` because they were written before `5a817ab` was committed.
- This work ("P13") sits on top of `5a817ab` in the working tree and is uncommitted when these records are written. The combined gate ran on the same file contents in a combined worktree whose base commit was `2bbeb95` with the P12 and P13 files applied; the main checkout at `5a817ab` with the P13 files was compared file by file and is identical.
- Node 24.19.0, Windows. No live Host, model or provider run of the factory. No private records.
- Earlier records of the same day exist and are added to without rewriting them. The P12 record and the P12 additions state that `agents bundle-check` and the contribution runbook are not built yet; that was true for P12 and is superseded by this work.
- Separate from Plan 033: pull request 218 (`host-agent-router` 1.1.1) was merged into `dev` by the maintainer on 2026-11-15 (`c722f2a`, after fixing a Linux test in `927bda4`); it is not part of this branch. His rule from then on: further router improvements go to a new draft pull request.

## What P13 is

Two deliveries, each built test-first by one Claude subagent in its own worktree, each reviewed by another model, each with a fix round, then combined: (1) the read-only command `agents bundle-check` (8 files: 4 new, 4 changed); (2) the installed contribution runbook with one canonical upstream-intent clause in every factory Skill (31 files: 2 new, 29 changed). Total beyond P12: 39 files.

## Part 1: `agents bundle-check`

Maintainer decision (2026-11-15): **"Yes, validator first"** (a deterministic validator before the Bundle route through the coordinator).

### Command line and exit codes

- Command: `agents bundle-check --artifact <absolute proposal folder> --registry <absolute registry folder> [--operation create|update|reuse] [--allow-unresolved]`.
- Read-only; prints one JSON result on stdout (indented with two spaces, nothing on stderr); exits `0` when `status` is `"passed"`, `1` when `"failed"`, and `2` when `"unavailable"`.
- Files: new `src/core/bundle-check.ts` (1,222 lines), the `bundle-check` command block in `src/cli.ts` after `skill-check`, and `BundleCheck*` types in `src/core/types.ts`.

### The six checks

| Check | What it verifies | Finding codes |
| --- | --- | --- |
| `inventory` | Presence, kind and bounds of the four authored files (`bundles.json`, `leader-responsibility.md`, `bindings.json`, `report.json`), links (root, ancestors, entries, trailing separators), safe entry names, case collisions, per-file and preservation-only caps (`update`/`reuse` allow up to 32 files and 2 MiB hashed and never parsed), valid UTF-8, valid JSON, and a final byte readback reporting drift | `PATH_UNSAFE`, `INPUT_LIMIT`, `INVENTORY`, `ENCODING`, `JSON_INVALID` (plus run-level `USAGE`, `INPUT_UNAVAILABLE`, `CANDIDATE_DRIFT`, `REGISTRY_DRIFT`, `OUTPUT_LIMIT`) |
| `shape` | `bundles.json` envelope (`$schema`, `version: 1`, non-empty `bundles`) and `BundleDefinition` fields, unknown keys and `<...>` placeholders; `bindings.json` non-empty JSON object and placeholders; `report.json` JSON object carrying all nine `REPORT_KEYS` (`job`, `files`, `template`, `bindings`, `checks`, `provenance`, `quality`, `openItems`, `upstream`) | `SHAPE` |
| `registry-rules` | The registry's own manifest rules (`collectBundleManifestIssues`) run on the proposal merged with the checked registry; name and alias conflicts (`create` refuses an existing key or alias; `update` and `reuse` replace matching keys) | `BUNDLE_CONFLICT`, `REGISTRY_RULE` |
| `references` | Every named orchestrator, agent, skill, workflow, rule, parent bundle and recommended addon (except `domain:` departments) exists in the registry as a regular file (`agents/<name>`, `skills/<id>/SKILL.md`, `workflows/<name>`, `rules/<name>`, literal names without single-item conveniences) or as a key or alias of the merged manifest; a link does not resolve | `REGISTRY_REF`, `SHAPE` |
| `bundle-rules` | The three shared Skills (`host-agent-router`, `handoff`, `git-guardrails`) declared exactly once each; four tier rules (`shared-skills-once`, `domain-is-not-organization`, `domain-planning-posture`, `organization-domain`); `leader-responsibility.md` present, non-empty, and holding no unreplaced `<...>` code-span placeholder | `BUNDLE_RULE` |
| `consistency` | `bindings.json` names each proposed bundle, its orchestrator, its agents and its required MCPs as whole tokens (case-sensitive, not inside longer `[A-Za-z0-9_-]` words) | `CONSISTENCY` |

Complete finding-code split:

- Unavailable codes (exit `2`): `USAGE`, `INPUT_UNAVAILABLE`, `CANDIDATE_DRIFT`, `REGISTRY_DRIFT`, `OUTPUT_LIMIT`.
- Failed codes (exit `1`): `PATH_UNSAFE`, `INPUT_LIMIT`, `INVENTORY`, `ENCODING`, `JSON_INVALID`, `SHAPE`, `BUNDLE_CONFLICT`, `REGISTRY_RULE`, `REGISTRY_REF`, `BUNDLE_RULE`, `CONSISTENCY`.

### Result constants and fields

- Every result carries `version: 1`, `kind: "deterministic"`, `quality: "pending"`, `live: "unverified"`, `delivery: "unverified"`, `provisioning: "unverified"`, `licensing: "unverified"`, and `acceptedDraft: false`.
- Result fields beyond `skill-check`'s: `registry`, `registryDigest`, `operation`, `allowUnresolved`, `bundleNames`, `preserved`, `replaces`, and `unresolved`.

### Design detail fixed by the orchestrating session

Fixed inside the maintainer's `"Yes, validator first"` decision (reported to the maintainer, not asked), where the read-only specification (`p19-bundle-check-spec.spec.md`) went further than the `author-bundle` Skill does:

- **`--operation` checks the proposal folder, not the registry entry:** `author-bundle`'s fixture `case-7` uses proposal-folder semantics, so `create` requires exactly the four files and refuses a name that is already a key or alias in the registry, whereas `update` and `reuse` allow preservation-only files (at most 32 files and 2 MiB; hashed, never parsed) and replace or add the entry (no `BUNDLE_MISSING_TARGET`).
- **Unresolved registry members fail by default with explicit opt-out:** `author-bundle`'s fixture `case-8` names a leader awaiting realization; a member missing from the checked registry fails by default with `REGISTRY_REF` and is always listed in `unresolved`, while `--allow-unresolved` lets the check pass with the `unresolved` list intact.
- **Any `BundleStatus` value accepted; `bindings.json` schema-free:** `BUNDLE_STATUSES` accepts all five `BundleStatus` values (`stable`, `experimental`, `under-construction`, `needs-audit`, `deprecated`), and `bindings.json` is kept schema-free because `author-bundle` treats it as a free-form proposal record rather than an installer configuration.
- **Checks omitted where the Skill's own fixture or text would fail them:** the headings of `leader-responsibility.md` (`case-7` keeps a one-line leader file), hashes and identity inside `report.json` (no schema; hashes may be reported unavailable; before-and-after hashes and deferred self-hash), and agent frontmatter rules of existing registry agents.
- **Invalid checked registry makes the result `unavailable`:** if the registry's own `bundles.json` is missing, unreadable, malformed or fails `collectBundleManifestIssues`, nothing can be said about the proposal against it, so `bundle-check` returns `status: "unavailable"` (exit `2`).
- **Tier rules must hold for every real bundle of that tier:** any tier rule that failed on an existing bundle of that tier in `registry/bundles.json` was not built. The candidate rule "an Organization names an orchestrator" was not built because the real organization bundle `agency-3d-production` has none; a test in `tests/bundle-check.test.ts` pins that it is the only one.

### Loader refactor and pinned equivalence

- The manifest rules of the private `RegistryResolver.validateBundles` moved into an exported `collectBundleManifestIssues(manifest, registryDir)` in `src/core/registry.ts`, which collects every problem in traversal order; `validateBundles` throws the first.
- 17 invalid manifests were run on the code before the extraction and their literal first messages are pinned in `tests/bundle-check.test.ts` (along with collecting multiple issues, continuing past a later malformed bundle, and throwing the same raw error when malformed before any issue is found).
- `src/core/skill-check.ts`: `export` added to existing helpers and constants only (`MAX_DIRECTORIES`, `MAX_ECHO_CHARS`, `MAX_ENTRIES`, `MAX_FINDINGS`, `MAX_OUTPUT_BYTES`, `byPath`, `canonical`, `errorCode`, `errorText`, `hasTraversalAlias`, `linkedAncestorOf`, `sha256`, `shortened`, `unsafeEntryName`, `validUtf8`, `withoutTrailingSeparators`).
- `src/core/bundle-host-availability.ts`: unchanged.

### Tests

- New `tests/bundle-check.test.ts`, `tests/bundle-check-cli.test.ts` (exercising the built `dist/cli.js`), and `tests/helpers/bundle-proposal.ts`. Together 248 passed and 3 skipped on Windows (two POSIX-only, one that needs a case-sensitive file system).
- One valid Domain proposal built from `author-bundle`'s example is checked against the real `registry/`, comparing the registry's bytes before and after.
- Note: the CLI usage tests were written after the code they cover.

### Independent review

Read-only review by another model (Antigravity, Gemini 4 Hydrogen High; `review-bundle-check.report.md` in the scratch records): verdict `"acceptable after the listed fixes"`; no blocker, one major, six minor, three notes. It compared the loader refactor line by line with the previous version and confirmed the first message is unchanged.

Nine points were taken and fixed test-first, each reproduced by a failing test except one half:

| Point | Reproduced or not | What changed |
| --- | --- | --- |
| Proposed `rules[]` entries were looked up with `existsSync` (follows links, ignores case) | Reproduced | `referencesGate` now looks up `rules[]` with `RegistryProbe.state(['rules', name])`, the same no-follow, case-exact lookup used for agents and skills, recording kind `'rule'` in `unresolved` |
| Registry `bundles.json` and proposal files were read after `lstat` without a size-capped, no-follow read | Reproduced | Added and used `readBounded` (`O_RDONLY`, `O_NOFOLLOW` and `O_NONBLOCK` where available, `fstat` regular-file and Windows `dev`/`ino` check, capped byte read) |
| `planningLoop.budget.maxIterations` was not validated when `planningLoop.enabled` is false | Reproduced | `bundleDefinitionProblems` now validates `maxIterations` as a positive integer whenever `loop.enabled !== true` (the manifest rule returns early when disabled) |
| `--operation ""` fell back to `create` | Not reproduced on CLI (already refused); reproduced in direct `checkBundle` | `checkBundle` now refuses an empty string `operation` as `USAGE` instead of treating it as omitted |
| The `bindings.json` consistency check matched inside longer words | Reproduced | `consistencyGate` uses whole-token matching (`mentions`, checking `[A-Za-z0-9_-]` word boundaries) |
| A placeholder in a double-backtick span was missed | Reproduced | `codeSpans` parses CommonMark matching backtick runs of any length `N` |
| An alias given as `parentBundle` or `recommendedAddons` was reported unresolved | Reproduced | `referencesGate` resolves `parentBundle` and `recommendedAddons` against `mergedNames` (own keys and aliases of the merged manifest) |
| `inventory` was reported `not-run` when both folders were rejected (`PATH_UNSAFE`) | Reproduced | `runChecks` preserves `inventory` as `failed` with its findings while setting the other five checks to `not-run` |
| Temp-folder leak in tests and missing edge cases (multi-bundle alias conflicts, wrong-typed `planningLoop`/`modes`/`personaAliases`, Windows reserved/control-char reference names, deeply nested `bindings.json`/`report.json`) | Leak fixed; missing cases added | Temp cleanup fixed and cases added; none of the added cases showed a defect |

- **Not taken:** the manifest rules resolve a name such as `toString` through the object prototype (`manifest.bundles[identifier]`). That is the loader's behaviour from before this work, and this slice does not change the loader for the real manifest; `bundle-check`'s own `references` check uses the own-key and alias set (`Object.keys(rules.merged)`) and reports such a name as unresolved. Recorded as known, for a separate fix. (A reviewer's question about a multi-bundle update moving a replaced bundle's old alias to another proposed bundle without a conflict was also left and noted.)

### Missing rule file and smoke run

- **What a caller sees for a missing rule file:** the loader's rule (`REGISTRY_RULE` from `collectBundleManifestIssues`) and the reference check (`REGISTRY_REF` from `referencesGate`) both report it; `--allow-unresolved` excuses only the second (`REGISTRY_REF`), so `REGISTRY_RULE` still fails the run.
- **Orchestrating session's smoke run of the built command:** on a proposal made from the `author-bundle` Domain example against the real `registry/`: `create` and `update` pass (exit `0`); a missing orchestrator plus a missing shared Skill fail with `REGISTRY_REF` and `BUNDLE_RULE` (exit `1`); with `--allow-unresolved` only `BUNDLE_RULE` remains and `unresolved` still lists the orchestrator; a `..` segment and a relative path are usage errors (exit `2`).
- **Coordinator route:** the coordinator has no route that runs this command yet (the Bundle route is not built).

## Part 2: the installed contribution runbook

Maintainer decision (2026-11-15): **"Reference + same wording (Recommended)"**.

### Runbook contents and delivery

- New `registry/skills/coordinate-artifact/references/contribution.md` (10,890 characters):
  - When it applies (upstream intent only; local drafts stop at the candidate).
  - Common steps (keeping draft, evidence and producer roots outside the checkout and managed Host folders until a human moves them; prior-art search including `gh pr list --state all --repo github.com/NeoAnthropocene/agents-united`; branch from fresh `origin/dev`, base `dev`, never `main`, Conventional Commits; provenance, licence and `README.md` section 5 credit rules; design records in `docs/adr/` and `CONTEXT.md`; retaining the full template, N/A reasons, Review and remaining work, and live-test ledger via `npm run hostlib:session`).
  - Four artifact sections (`Skill`, `Shared pair`, `Claude agent`, `Bundle proposal`): what to collect, where files go in the checkout, which existing commands to run after `npm run build`, and which template fields each result fills. The `Bundle proposal` section names `agents bundle-check` as the contributor's check in the checkout and states that the coordinator has no route that runs it yet.
  - `Gate before a pull request`, `What this runbook refuses`, and `What stays unverified`.
  - Every step ends with a mark: `[script: ...]` naming an existing script or command, or `[prose]`.
- Delivery: seventeenth support path of `coordinate-artifact` (`COORDINATOR_SUPPORT` in `src/core/claude-factory-declaration.ts`; `requiredSupport` in `registry/hosts/claude/agent-factory-coordinate.binding.json`). Both `coordinate-artifact` entries (`registry/skills/coordinate-artifact/SKILL.md` and `registry/hosts/claude/skills/coordinate-artifact/SKILL.md`) name it at step 6 (the hand-off). `references/handback.md`, `references/skill-authoring.md` and `references/contract-authoring.md` point to it; `references/skill-authoring.md` names all three `agents skill-check` policies. No grant, preload, worker closure or bundle inventory change. No script added.

### Canonical upstream clause

> Upstream intent only prepares the pinned `.github/PULL_REQUEST_TEMPLATE/artifact-contribution.md`, base `dev`, `sent: false`, following the checkout's `docs/artifact-contribution.md`; no commit, push, pull request or publication follows.

- Stands verbatim in 18 files:
  - Coordinator (`coordinate-artifact`): `references/handback.md`, `references/skill-authoring.md`, `references/contract-authoring.md`, `references/contribution.md`, and the agent body `registry/hosts/claude/agents/orchestrator-agent-factory.md`.
  - `author-skill`: shared `SKILL.md`, native `SKILL.md`, `references/job.md`.
  - `author-contract`: `references/verification.md` (exception: `author-contract`'s native entry has no room at 5,895 characters, so the clause stands in `references/verification.md` and both `author-contract` entries point there in step 6).
  - `author-bundle`: shared `SKILL.md`, native `SKILL.md`, `references/job.md`, `references/verification.md`.
  - `realize-artifact`: shared `SKILL.md`, native `SKILL.md`, `references/handback.md`.
  - `evaluate-artifact`: shared `SKILL.md`, native `SKILL.md`.
- Only `coordinate-artifact`'s own files name `references/contribution.md`; the other Skills name only the two checkout files.

### Room made in the coordinator entry and entry sizes

- The native `coordinate-artifact` entry went from 5,699 to 5,637 characters (shared from 5,318 to 5,256). One sentence left both entries (`"Revisions reopen/link actual work, invalidate dependent acceptance and close only after changed-byte readback and applicable checks."`); its rule is stated in `orchestrator-agent-factory.md` and in `references/dispatch.md`, and is pinned as the ninth moved obligation. The existing test keeping the native coordinator entry at or under 5,720 characters is unchanged.

| Skill | Shared `SKILL.md` (chars) | Native `SKILL.md` (chars) | Limit |
| --- | --- | --- | --- |
| `coordinate-artifact` | 5,256 | 5,637 | 6,000 (native pinned `<= 5,720`) |
| `author-skill` | 4,383 | 4,915 | 6,000 |
| `author-contract` | 5,095 | 5,895 | 6,000 |
| `author-bundle` | 4,877 | 5,663 | 6,000 |
| `realize-artifact` | 4,905 | 5,809 | 6,000 |
| `evaluate-artifact` | 5,568 | 5,590 | 6,000 |

### Tests

- New `tests/agent-factory-contribution-runbook.test.ts` (61 tests): the seventeenth support path in `COORDINATOR_SUPPORT` and `requiredSupport`; the canonical clause verbatim in every required place and the 19 old variants removed across all six Skills and the agent body; every `node <checkout>/dist/cli.js <command>` / `agents <name>-check` line in the runbook parsed and every command and `--option` checked against `src/cli.ts`; every `npm run` script checked against `package.json`; each of the 9 refusals pinned on its own; each `[script: ...]` mark checked to name an existing script or command; every repository path, npm script and `agents` command in backticks verified in the checkout.
- Pins updated in `tests/agent-factory-coordinator-delivery.test.ts`, `tests/agent-factory-coordinator-package.test.ts`, `tests/agent-factory-coordinator-lifecycle.test.ts`, `tests/agent-factory-coordinator-launcher.test.ts` and `tests/helpers/factory-coordinator.ts` (17 support paths; nine moved obligations).

### Independent review

Read-only review by another model (Antigravity, Gemini 4 Hydrogen High; `review-contribution-runbook.report.md` in the scratch records): verdict `"acceptable after the listed fixes"`; no blocker, five major, four minor, three notes. It confirmed the canonical clause verbatim in every required file, the moved revision rule fully stated in the agent body, and that no wording lets the factory commit, push, open a pull request, install or spend.

All twelve points were taken (the worker checked each against the cited file and found the reviewer right):

1. `agents skill-check` was written without `npm run build` and with a relative corpus path although the command requires absolute paths.
2. Missing `npm run build` step before `agents factory-check`.
3. Wrong section numbers of `docs/skill-intake.md` and incomplete bundle placement rules.
4. The `inspired` disposition and the content of the `README.md` section 5 credit (author or project, upstream link, and `"adapted from X by Y"` when substantially changed).
5. Tests that would not catch a misspelled option, a dropped refusal or a wrong `[script: ...]` mark.
6. Template-completeness rules (keeping the entire template, marking inapplicable items `N/A` with the reason, filling Review and remaining work, and the live-test ledger).
7. Four `[script: ...]` marks (collection steps and gate commands).
8. The prior-art list (`registry/`, `registry/hosts/` profiles, `host-library/` guides and observations, `tests/`, `docs/adr/`, open and closed pull requests).
9. The `evals/` sentence (`evals/` of a new Skill stays in its checkout folder; no install copies it).
10. `"for example"` on the managed Host folders (not a closed list).
11. A shared-pair-only pull request reconciled with what `docs/artifact-contribution.md` expects (agreed with the maintainer first, without forbidding it).
12. Note that commands are written for a POSIX shell (Git Bash on Windows).

### Restored text, known and left

- **Restored by the orchestrating session:** `"a prepared body is not a completed review"` in `registry/skills/author-skill/references/job.md`.
- **Known and left:** field descriptions in three `assets/report.json` files and two example files (`registry/skills/author-contract/examples/new-pair.md`, `registry/skills/author-skill/examples/one-draft.md`) describe upstream preparation in their own words (same meaning). `agents skill-check` on `evaluate-artifact` fails its contract and layout checks; the orchestrating session confirmed the same exit `1` on the unchanged checkout before this work, so it is not caused by the clause.

## How the work was done

- Briefed, reviewed and integrated by the orchestrating Claude Code session.
- Both builds and their fix rounds: Claude subagents (Sonnet 5.5), each in its own worktree, test-first.
- The specification (`p19-bundle-check-spec.spec.md`), the design paper (`p18-contribution-runbook-design.paper.md`) and both independent reviews (`review-bundle-check.report.md`, `review-contribution-runbook.report.md`): Antigravity (Gemini 4 Hydrogen), read-only.
- Workers did not commit. The orchestrating session compared each report with the files changed, read the diffs of shared source files, and re-ran each acceptance.
- The two builds touch no common file; they were combined with P12 in one worktree for the gate.
- One test timed out once at 5,000 ms in an acceptance run of the orchestrating session while another worker ran tests (`tests/agent-factory-coordinator-launcher.test.ts`); the acceptance command lacked the 30-second limits that `npm test` sets, and no code was changed for it.
- Working records (untracked): `scratch/plan-033-implementation/routed-2026-11-14/` (`DECISIONS-2026-11-14.md`, `p19-bundle-check-spec.spec.md`, `p20-bundle-check-build.brief.md`, `review-bundle-check.report.md`, `p18-contribution-runbook-design.paper.md`, `p22-contribution-runbook-build.brief.md`, `review-contribution-runbook.report.md`, `FACTS-P13.md`).

## Gate results

Run by the orchestrating session on the combined tree (one worktree whose base commit was `2bbeb95` with the P12 and P13 files applied; the main checkout at `5a817ab` with the P13 files was compared file by file and is identical), on Windows (Node 24.19.0). Raw files are in `logs/plan-033-p13-2026-11-15/` (each step with `.command.txt`, `.stdout.txt`, `.stderr.txt`, `.exit.txt`; `tree-status.txt` lists the files; `tree-note.txt` records the combined-worktree equivalence). One run.

| Command | Exit | Counts | Raw files |
| --- | --- | --- | --- |
| `hostlib-verify` | 0 | Passed | `hostlib-verify.{command,stdout,stderr,exit}.txt` |
| `typecheck` | 0 | Passed | `typecheck.{command,stdout,stderr,exit}.txt` |
| `full-test-serial` (`env -u CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS npm test -- --maxWorkers=1 --fileParallelism=false`) | 0 | 301 files passed; 7,241 tests passed, 223 skipped, of 7,464; 1,461.26 s | `full-test-serial.{command,stdout,stderr,exit}.txt` |
| `addon-matrix` (`AGENTS_CI_FULL=1 env -u CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS npx vitest run tests/e2e-domain-conformance.test.ts --maxWorkers=1 --fileParallelism=false`) | 0 | 317 passed, none skipped; 433.61 s | `addon-matrix.{command,stdout,stderr,exit}.txt` |

For comparison, the P12 gate ran 298 files, 6,928 passed, 220 skipped, of 7,148. Windows only.

## Decisions pending with the maintainer

- The local commit of this P13 work; the push and pull request to `dev` for a first Linux run.
- Scripted workflow (`p23-scripted-workflow-options.paper.md` recommends shipping none now per `host-library/claude/pages/orchestration/workflows.md`): not decided.
- Decided on the same evening, not built yet: the Bundle route uses a small helper script in `author-bundle` that writes the return record with exact hashes, as the Skill and contract routes do (option label `"A: helper script"`; options B — the model computing hashes itself — and C — no return record — not chosen).
- Separate from Plan 033: pull request 218 (`host-agent-router` 1.1.1) was merged into `dev` by the maintainer on 2026-11-15 (`c722f2a`); it is not part of this branch, and further router improvements go to a new draft pull request.

## Known and left

- From Part 1: the loader's prototype lookup (`manifest.bundles[identifier]`); the Organization orchestrator rule not built (`agency-3d-production`); `bundle-check` does not judge the leader file's content, `report.json`'s content or hashes, licence truth or quality.
- From Part 2: the three `assets/report.json` field descriptions and two example files (`registry/skills/author-contract/examples/new-pair.md`, `registry/skills/author-skill/examples/one-draft.md`) in their own words; the pre-existing `agents skill-check` failure on `evaluate-artifact`.
- From earlier, unchanged: a worker's closure is validated through the coordinator's dependency check only; the read-only guard's matcher is not a complete tool list; the sync runbook (`references/host-sync.md`) has not been executed end to end; a reordered `Agent(...)` grant is accepted.

## Unverified

- Everything live, including whether the coordinator follows the runbook and whether a human gets from the prepared body to a pull request with it. The runbook's checkout commands were checked as existing commands, options and scripts, not executed, except `bundle-check` in the smoke run above.
- Linux and CI behaviour of this branch (never pushed). In `bundle-check`, the `O_NOFOLLOW` branch of `readBounded` exists only on POSIX systems and has not run anywhere; on Windows a file-identity (`dev`/`ino`) comparison is used. Tests that need POSIX links or a case-sensitive file system are skipped here (3 in `tests/bundle-check.test.ts` and the POSIX trailing-slash link test in `tests/skill-check.test.ts`).
- No second-model review of the two fix rounds themselves; the orchestrating session read the changes and re-ran each acceptance.

## Next

1. The maintainer's pending decisions (commit of P13, push and pull request to `dev` for a first Linux run, scripted-workflow disposition); then the Bundle route through the coordinator (with `"A: helper script"` in `author-bundle`), ending in `agents bundle-check`.
2. The Claude stage proof (scenario scripts, then live runs on the maintainer's word, including frontmatter hooks in `Agent`-started workers, guard failure mode, and P8b stage 2 typed observation); then the other Hosts (Codex, Antigravity, Cline).

## Addendum: pushed as a draft pull request

Addendum, same evening: at the maintainer's direction the branch was pushed at `5a817ab` and draft pull request 219 against `dev` was opened; statements above that the branch is not pushed describe the state before that. The first Linux CI run of that pull request was still pending when this was written. P13 reaches the pull request with the commit that contains this record.
