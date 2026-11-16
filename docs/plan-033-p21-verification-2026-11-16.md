# Plan 033 P21, the `author-skill` route writes the evals file that `skill-check` requires: verification, 2026-11-16

P21 updates the `author-skill` authoring route and the S3 Skill fixture so that the route writes `evals/evals.json` and the S3 Skill brief uses `private-owner` with `evals/evals.json` in its allowed paths, answering finding S3-C of the 2026-11-16 interactive sittings ([the interactive stage-proof observation](../host-library/claude/observations/2026-11-16-claude-2.1.325-factory-stage-proof-interactive.md)). Committed locally as `f48f5ea` ("fix(factory): P21, the author-skill route writes the evals file that skill-check requires"; 6 files changed, 128 insertions, 8 deletions) on top of `f253e33`, on the branch of draft pull request 219 (`codex/plan-033-claude-delivery-nov10` against `dev`). Built by one Claude subagent (Sonnet) in its own worktree at `859e0fd`, with one fix round after the lead's review and no independent second-Host review, and gated on Windows before commit `f48f5ea`. Nothing of P21 ran on the real Host: whether a live `author-skill` fork writes `evals/evals.json` from the new text, whether the evals are useful, and whether the fork meets the remaining layout and contract checks are **not observed** (unverified). See [ADR 0067](adr/0067-claude-factory-realization-delivery.md) (section dated 2026-11-16).

## Scope and baseline

- Date: 2026-11-16.
- Slice: P21.
- Branch: `codex/plan-033-claude-delivery-nov10`, draft pull request 219 against `dev`.
- Baseline: `f253e33` (worker's worktree branched from `859e0fd`).
- Local commit: `f48f5ea` ("fix(factory): P21, the author-skill route writes the evals file that skill-check requires"), not yet pushed when these records were written.
- Diff scope: 6 files changed, 128 insertions, 8 deletions:
  - 4 route texts (`registry/skills/author-skill/references/quality.md`, `registry/skills/author-skill/SKILL.md`, `registry/hosts/claude/skills/author-skill/SKILL.md`, `registry/skills/coordinate-artifact/references/skill-authoring.md`);
  - 1 proof scenario script (`scripts/factory-proof-scenarios.mjs`);
  - 1 test file (`tests/factory-proof-prep.test.ts`).
- No script of the route and no gate changed.
- Gate environment: Windows. Nothing of P21 ran on the real Host; Linux CI for `f48f5ea` was not yet read when these records were written (the check `test` was green on `f253e33`, the commit before this one).

## The observation that caused it (finding S3-C) and why a fixture fix alone could not pass

- **Finding S3-C** (interactive typed-routes sitting of 2026-11-16 on Claude Code 2.1.325, Windows, permission mode `auto`, session `17cd59b1-d41d-4dec-be8a-f3a0d54bb0f5`, step 5; [the interactive stage-proof observation](../host-library/claude/observations/2026-11-16-claude-2.1.325-factory-stage-proof-interactive.md), section "S3-C: scenario defect between fixture brief and `skill-check` policy"):
  - The `author-skill` fork (`F1`) did what the route says (`F1:L102`/`M:L260`), postflight (`check-skill-return.mjs`) exited `0`, and `skill-check --policy agents-united-original` then exited `1` (`skill-check.exit.txt` = `1`) with two findings: `metadata.author` must be `agents-united` (the fixture brief specifies author `"Proof Fixture"`), and `evals/evals.json` is missing.
- **Why a fixture fix alone could not pass:** P20's second brief part established that this was not only a fixture defect: no fixture change alone could make a compliant fork pass, because the layout gate (`checkSkillLayout` in `src/core/skill-layout.ts`) requires `evals/evals.json` under every policy, while the route's text gave no file name and no format and the fixture's allowed paths excluded the file.

## The decision

- **The maintainer's decision:** to the question "Should the authoring route write the evals file that skill-check requires?" (offered beside the alternative that evals are not required at draft time), the maintainer answered **"Yes, route writes it"**. So the gate is not loosened; the route is taught.
- **Lead's choices (not put to the maintainer unless noted):**
  - Keep `src/core/skill-layout.ts` and `src/core/skill-check.ts` unchanged (follows the maintainer's decision).
  - Keep `registry/skills/author-skill/scripts/draft.mjs`, `registry/skills/coordinate-artifact/scripts/check-skill-return.mjs` and `registry/skills/author-skill/references/job.md` unchanged, because they already accept `evals/evals.json` inside `allowedPaths`.
  - Do not add a postflight check in `check-skill-return.mjs` for a `draft` return without `evals/evals.json` (offered to the maintainer as an open item).
  - Do not bump `metadata.version` for the reference and entry text changes (the worker found no rule or test that requires a bump for a reference text change).
  - Keep the older comparison guidance (`paired with-skill/without-skill prompts and an unrelated control`) as one sentence in `quality.md` explicitly marked as not checked by the layout gate (added in fix round 1).
  - Set the S3 Skill fixture brief (`scripts/factory-proof-scenarios.mjs`) to `policy: 'private-owner'` (matching owner `"Proof Fixture"` and Step 5 of the sitting) and include `evals/evals.json` in `allowedPaths` and `roles`.

## The gate's rules as the code states them

Verified in `src/core/skill-layout.ts` (and `src/core/skill-check.ts`):

- `EVALS_MIN` is `2` and `EVALS_MAX` is `5` (`src/core/skill-layout.ts`, lines 19 to 20).
- The file `evals/evals.json` must exist; else `checkSkillLayout` records `evals/evals.json is missing` (lines 149 to 151).
- It must be valid JSON, not `null`, and `evals` must be an array (lines 155 to 165 and 168 to 172).
- `skill_name` must equal the Skill's `name` (line 167).
- The list holds `2` to `5` entries (line 173).
- Each entry is a non-null JSON object with a numeric `id`, a string `prompt` and a string `expected_output`; each of the two strings must be at least `40` characters (lines 174 to 186).
- No two checkable entries may have the same `prompt` (lines 187 to 188).
- Other keys, at the top level or inside an entry, are not read (so they are not an error); this is what the code does, and the route text does not promise it.
- `src/core/skill-check.ts` has no other evals gate; `countSupportingFiles` (lines 650 to 652) only leaves `evals/` out of the supporting-file count under `adapted-source`.

## The change

| Place | Before | After |
| :- | :- | :- |
| `registry/skills/author-skill/references/quality.md` (last paragraph / new section) | "Prepare paired with-skill/without-skill prompts and an unrelated control under `evals/`; do not install that directory. No paid execution is implied by preparation. Report fixture preparation separately from measured behavior, and do not invent a success threshold before evaluation." | New section `## Evals file` stating that the draft carries `evals/evals.json`, that `skill-check` fails every draft without it, and that it must be in the allowed paths; a JSON example with `skill_name` and two entries; the gate's rules in the gate's terms; one sentence on what a useful eval is; one sentence keeping the comparison guidance and stating the gate does not check it: "A later evaluation runs the same prompt with and without the Skill and adds an unrelated control on which the Skill should not act, so write prompts that make that comparison possible; the layout gate checks none of this."; and the three older points kept (preparing prompts implies no paid run; report fixture preparation separately from measured behavior with no invented success threshold; `evals/` is not installed with a Skill). |
| `registry/skills/author-skill/references/quality.md` (validator table row for `tests/helpers/skill-layout.ts`) | Ended with "maintainer-only eval fixtures". | Now ends: "links and the `evals/evals.json` file (see Evals file below)." |
| `registry/skills/author-skill/SKILL.md` and `registry/hosts/claude/skills/author-skill/SKILL.md` (Verification Checklist, identical line) | "Eval fixtures remain maintainer-only; no paid run or behavioral improvement is implied by preparing them." | Replaced with a checklist item stating that the draft carries `evals/evals.json` in the format of `references/quality.md` (linked on the word "quality"), and that no paid run or behavioral improvement is implied by preparing it. Both entries stay under their 6,000-character limit (4,428 and 4,960 characters, counted with LF line ends). |
| `registry/skills/coordinate-artifact/references/skill-authoring.md` (section "Task and return") | No instruction requiring `evals/evals.json` in the task template. | New sentence: "Its `draftJobTemplate.allowedPaths` and its `roles` must include `evals/evals.json` (the file `skill-check` requires under every policy; the fork writes it as `references/quality.md` of `author-skill` describes)." |
| `scripts/factory-proof-scenarios.mjs` (`skillBrief`, lines 84 and 91 to 93) | Allowed paths excluded `evals/evals.json`; `policy` was `agents-united-original` while `provenance.owner` was "Proof Fixture". | Allowed paths and `roles` are now `SKILL.md`, `examples/note.md`, `evals/evals.json`; `policy` is `private-owner` (matching owner "Proof Fixture" and Step 5 of the sitting). |
| `tests/factory-proof-prep.test.ts` (block `S3 is solvable offline`, lines 799 to 900) | No offline run of the S3 Skill route with and without `evals/evals.json`. | New helper `runSkillRoute` and two new tests exercising task assembly, preflight, installed `draft.mjs`, postflight and built CLI `skill-check` (`private-owner`, pinned corpus): with `evals/evals.json`, postflight exits `0` and `skill-check` exits `0`; without it, postflight exits `0` and `skill-check` exits `1` with `evals/evals.json is missing`. |

## What did not change and why

- `src/core/skill-layout.ts` and `src/core/skill-check.ts`: the gate is not loosened (the maintainer's decision).
- `registry/skills/author-skill/scripts/draft.mjs`, `registry/skills/coordinate-artifact/scripts/check-skill-return.mjs` and `registry/skills/author-skill/references/job.md`: they already accept `evals/evals.json` as any safe relative path inside the allowed paths and within the existing bounds; nothing forbade it. Only texts were missing.
- Pinned hashes, lengths, counts and `metadata.version`: test runs passed without an edit to any pin, and no `metadata.version` was bumped (the worker found no rule or test that requires a bump for a reference text change; lead's choice to leave it).
- Postflight refusal for missing `evals/evals.json`: no check for a `draft` return without `evals/evals.json` was added to `check-skill-return.mjs` (lead's choice): it would fit cheaply beside the existing inventory and scope checks, but it would be the first content check of that kind there; `skill-check` stays the gate. Offered to the maintainer as an open item.
- The other two typed routes (`author-contract`, `author-bundle`), the launcher, the guards and the workers' agent files.

## Enforcement kind, stated honestly

- The requirement itself is enforced by an existing deterministic gate (`skill-check`, layout part in `src/core/skill-layout.ts`).
- That the fork writes `evals/evals.json` is prose in an installed reference (`quality.md`) and in the coordinator's route text (`skill-authoring.md`); that the coordinator allows the path in the task is prose too (preflight in `check-skill-return.mjs` does not require the path). A fork or a coordinator that ignores the text ends at the same `skill-check` failure as before; nothing new blocks earlier.
- The offline test proves that the route as written can end with `skill-check` exit `0` for the fixture brief, and that `evals/evals.json` is what makes the difference; it does not prove that a model follows the text.

## Tests

- **Shown offline in `tests/factory-proof-prep.test.ts` (`S3 is solvable offline`, `runSkillRoute`, lines 799 to 900; no Host starts):**
  - Builds the Skill task from the prepared `s3-typed-forks` brief (`taskFromBrief`), runs installed preflight (`check-skill-return.mjs --job`), runs real installed `draft.mjs`, writes `skill-return.json` (with a synthetic `report.md`), runs installed postflight (`check-skill-return.mjs --job ... --result ...`), and runs the built CLI's `skill-check` with the brief's policy (`private-owner`) and pinned corpus (a copy with LF line ends if the checkout corpus carries carriage returns).
  - **With `evals/evals.json`:** postflight exits `0` (`acceptedDraft: false`), `evals/evals.json` exists on disk, and `skill-check` exits `0`.
  - **Without `evals/evals.json`:** postflight still exits `0`, `evals/` does not exist, and `skill-check` exits `1` with output containing `evals/evals.json is missing`.
- **What was not checked:** the new tests were not run against the unchanged code (the old brief's policy and paths fail the first assertions by reading; that is an inference, not a run).

## How the work was done

- **Worker:** a Claude subagent (Sonnet) of the lead session, in its own worktree at `859e0fd`, from a written brief; it never committed. Brief and reports: `scratch/plan-033-implementation/routed-2026-11-14/`.
- **Fix round 1 (lead's review of the diff), three text points:**
  1. The validator table row in `quality.md` still said `"maintainer-only eval fixtures"` (contradiction).
  2. The worker had dropped the `"paired with-skill/without-skill prompts and an unrelated control"` guidance, which the repository's own Skills follow, so it was restored as one sentence marked as not checked by the gate.
  3. `"preparing them"` had lost its plural and became `"preparing it"`.
- **Independent second-Host review:** none was run for this slice (text and fixture change; the lead read the whole diff).
- **Acceptance hook timeout:** the brief's acceptance command had a hook timeout of 30 seconds; `tests/factory-proof-prep.test.ts` needs a longer one for its setup, so the worker and the lead ran that command with `--hookTimeout=400000`. The gate (`npm test`) uses the repository's own settings.

## Lead's acceptance and gate

- **Lead's acceptance in the worker's worktree after fix round 1:**
  - `npm run typecheck`: exit `0`; `npm run build`: exit `0`.
  - Eight test files (`tests/factory-proof-prep.test.ts`, `tests/agent-factory-proof-fixes.test.ts`, `tests/agent-factory-coordinator-package.test.ts`, `tests/agent-factory-coordinator-launcher.test.ts`, `tests/skill-check.test.ts`, `tests/author-skill.test.ts`, `tests/agent-factory-skill-package.test.ts`, `tests/agent-factory-skill-return.test.ts`): exit `0`, 654 passed, 7 skipped, 322.96 s; both new S3 tests pass.
  - The worker's own broader run (tests selected by name): 175 files passed, 1,863 tests passed, exit `0`.
- **Gate (Windows, main checkout, the change applied on `f253e33`, before commit `f48f5ea`):** raw files in `logs/plan-033-p21-2026-11-16/` (each step has `.command.txt`, `.stdout.txt`, `.stderr.txt`, `.exit.txt`).

| Step | Command | Exit | Result |
| :- | :- | :- | :- |
| `hostlib-verify` | `npm run hostlib:verify` | 0 | "host library snapshots match their lockfiles and every guide citation resolves" |
| `typecheck` | `npm run typecheck` | 0 | no error |
| `full-test-serial` | `env -u CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS npm test -- --maxWorkers=1 --fileParallelism=false` | 0 | 308 test files passed; 7,760 tests passed, 224 skipped (7,984); 1820.61 s |
| `addon-matrix` | `AGENTS_CI_FULL=1 env -u CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS npx vitest run tests/e2e-domain-conformance.test.ts --maxWorkers=1 --fileParallelism=false` | 0 | 1 test file passed; 317 tests passed; 470.62 s |

- Linux CI: the check `test` was green on `f253e33` (the commit before this one); for `f48f5ea` it was not yet read when these records were written (not pushed then).

## Not observed on the real Host

1. A live `author-skill` fork writing `evals/evals.json` from the new text and passing `skill-check`: not run. The typed-routes sitting (S3) was sat before this change; a re-sitting of its Skill route would show it.
2. Whether the fork's evals are useful, not just valid: the gate checks form only (lengths, count, distinct prompts).
3. The layout gate and the contract check have other requirements a fork can still miss (a description that starts with `"Use when"`, trigger phrases and a skip clause; the seven sections with anti-patterns, evidence and a hand-off). `quality.md` already points the fork at those validators; in the live sitting the fork's only two findings were the author and the evals file. Not re-observed.

## Open items for the maintainer

1. A re-sitting of the Skill route of the typed-routes sitting (S3) to observe a live fork writing the evals file (not prepared yet).
2. Whether postflight should refuse a `draft` return that has no `evals/evals.json` (an earlier, cheaper refusal than `skill-check`; lead's choice so far: no).
3. Unchanged from before: whether the legacy inline guard and the settings-level session guard should block when they cannot run; whether the supported floor should be raised to 2.1.295; whether the destructive guard should block unreadable input; whether the seconds and bytes of the dropped aggregate budget should have stayed (P18); the `Skill` tool grant for the coordinator; reliance on the fallback read because the interactive main session does not preload `coordinate-artifact` (S3-A); the launcher's `.cmd` shim fault (own pull request); a full interactive realize-and-review journey.
4. New on 2026-11-16, decided after this slice was built: the maintainer said about a background worker seen in the guard re-sitting "Actually I liked the Background worker operation. We can keep it as our default."; the lead asked whether that is meant for the factory coordinator, where it reverses the fork-mode decision of P19 ("Yes, turn it off"), and the maintainer answered "Switch to background". That is slice P22 (see Next); nothing of it is in this commit.

## Next

P22 is in work in its own worktree on top of `f48f5ea`: the maintainer decided "Switch to background" (the factory coordinator runs its workers in the background and waits for each hand-back), which reverses the fork-mode switch of P19 for the factory; nothing of it is in this commit.
