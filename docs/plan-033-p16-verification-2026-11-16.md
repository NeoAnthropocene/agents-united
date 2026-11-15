# Plan 033 P16, fixes for the defects of the first headless proof runs: verification, 2026-11-16

P16 delivers four text and prompt fixes for the defects observed in the first headless stage-proof runs on the Claude Host ([the headless stage-proof observation](../host-library/claude/observations/2026-11-15-claude-2.1.323-factory-stage-proof-headless.md), findings S1-A, S1-B, S1-C, S2-A, S2-B, S2-C), built test-first by one Claude subagent in its own worktree, reviewed independently by another model and fixed before integration, uncommitted on top of `b6e9136`. No live Host, model or provider run took place for these fixes, none of the fixes has been re-observed live, and no private records were accessed. See [ADR 0067](adr/0067-claude-factory-realization-delivery.md) (section dated 2026-11-16) and [the P14 verification record](plan-033-p14-verification-2026-11-15.md).

## Scope and baseline

- Date: 2026-11-16 (night after the proof runs of 2026-11-15).
- Branch: `codex/plan-033-claude-delivery-nov10`, draft pull request 219 against `dev`, head `b6e9136` (the observation record of the headless runs).
- Uncommitted work ("P16") on top of `b6e9136`: 19 files, one of them new (`tests/agent-factory-proof-fixes.test.ts`). No `SKILL.md` changed; the native `coordinate-artifact` entry (`registry/hosts/claude/skills/coordinate-artifact/SKILL.md`) is still 5,788 characters.
- Source of the defects: [the headless stage-proof observation](../host-library/claude/observations/2026-11-15-claude-2.1.323-factory-stage-proof-headless.md), findings S1-A, S1-B, S1-C, S2-A, S2-B, S2-C.
- Maintainer direction: the maintainer asked the session to continue toward the goal while he is away (`"IF possible continue for our goal of this session by leaving the interactive tests for tmr."`); these fixes are plan slice `"defects from the proof runs"`.
- Local gate environment: Windows, Node 24.19.0. No live Host, model or provider run; no private records accessed.

## The four fixes

| Finding | What was observed | What changed | Files | How it is pinned by test |
| --- | --- | --- | --- | --- |
| S1-B (Review job and citations) | In S1, `post-check-review` exited 1 (`check-review.mjs` line 314) because the evaluator cited `sourceId: "native-check-raw"` (`path: "native.raw.txt"`), absent from the 44 `inputs[]` in `r0/p5/job.json`; the job placed check logs only in `checks[]` while the prompt told the evaluator to read them. | `verification.md` tells the coordinator to pin each saved check output the evaluator is told to read (raw log and receipt) in `inputs[]` with all eight fields of `assets/job.schema.json` (kebab-case `id`, `kind` `validator`, `path`, `bytes`, `sha256`, `sections` `[]`, `status` `clear`, `required` `true`) as a byte-identical copy in a folder of its own beside the review root (never its parent or the review root itself), that folder alone in `roots.read`, keeping originals in `checks[]`. The record shape, schema and `check-review.mjs` did not change. One identical citation sentence in `verification.md`, `evidence.md` and `factory-evaluator.md` states that a citation names only `candidate` or the id of an input the job pins as clear, and anything else goes into prose. Older sentences in `report.json` (`one declared evidence pin with status clear`, `the input basename`) and `factory-evaluator.md` (`path (candidate-relative, or the basename of a pinned input's file)`) were corrected to match `check-review.mjs`. | `registry/skills/coordinate-artifact/references/verification.md`, `registry/skills/evaluate-artifact/references/evidence.md`, `registry/hosts/claude/agents/factory-evaluator.md`, `registry/skills/evaluate-artifact/assets/report.json` | `tests/agent-factory-proof-fixes.test.ts` pins exact once-per-file wording, removes the narrower `A citation may name only an id the job pins.` across all coordinator and evaluator markdown files, and checks `report.json` and `factory-evaluator.md` (`tests/helpers/native-invariant-evidence.ts` updated). `tests/agent-factory-evaluation-record.test.ts` parses the eight fields straight out of `verification.md` to build a job and verifies `check-review.mjs --job` and `--result` pass, and pins refusal of a `roots.read` parent folder and of citing a `status: 'held'` input. |
| S2-A, S1-C stop rule (Entry dry run and CLI commands) | In S2, bare `agents start agent-factory --host claude --dry-run` resolved to the global npm shim (`0.15.0`, printing `--agent orchestrator-engineering`), exited 0 and the coordinator proceeded. In S1, inherited `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` caused `claude-launcher.ts` line 211 to refuse the dry run until cleared for one child process. | Step 1 of all four route references, `dispatch.md` and `orchestrator-agent-factory.md` state in the same words: run `node <checkout>/dist/cli.js start agent-factory --host claude --dry-run` (never bare `agents`) and save output in the evidence folder; the planned agent must be `orchestrator-agent-factory`, and anything else or a nonzero exit is recorded and the route stops and reports without a workaround; when refused because `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` is set, report the refusal and stop without clearing the variable. Every other coordinator CLI check command (`skill-check`, `contract-check`, `factory-check`, `bundle-check`) now uses the same pinned `node <checkout>/dist/cli.js <subcommand>` form. | `registry/skills/coordinate-artifact/references/skill-authoring.md`, `contract-authoring.md`, `bundle-authoring.md`, `host-sync.md`, `dispatch.md`, `verification.md`, `registry/hosts/claude/agents/orchestrator-agent-factory.md` | `tests/agent-factory-proof-fixes.test.ts` pins the three sentences once each across all six files, checks step 1 sentence order in all four routes (and no `Or start through the launcher`), scans all coordinator markdown files to refuse `agents start` and bare `agents` check commands, checks pinned `skill-check` and `factory-check` forms, and rejects retry/workaround/clear-variable sentences near `dry run`. Pinned text updated in `tests/agent-factory-bundle-return.test.ts` and `tests/agent-factory-contribution-runbook.test.ts`. |
| S1-A, S2-B (Preload fallback and `${CLAUDE_SKILL_DIR}`) | In headless `--agent` S1, no `coordinate-artifact` Skill body was injected into the main record; the coordinator read `SKILL.md` because prompt line 4 told it to, `${CLAUDE_SKILL_DIR}` was never expanded (read as literal text), and `Skill` was absent from its tool pool. In S2, neither `coordinate-artifact` nor `sync-host` appeared in main or `factory-sync` records, and the coordinator never read `SKILL.md`. | `src/core/claude-launcher.ts` (for `agent-factory` only) and the opening instructions of `orchestrator-agent-factory.md` state in the same words: the `"coordinate-artifact"` Skill entry is installed at `.claude/skills/coordinate-artifact/SKILL.md`, and if its text is not already in context, read it in full before the first action; in a Skill file, `${CLAUDE_SKILL_DIR}` means that Skill's installed folder (`.claude/skills/<skill name>`), and `scripts/`, `references/` and `assets/` paths are relative to it — use the absolute path when running a script. No `Skill` tool was added and `skills:` was unchanged. Other bundles' first messages are unchanged. | `src/core/claude-launcher.ts`, `registry/hosts/claude/agents/orchestrator-agent-factory.md` | `tests/agent-factory-proof-fixes.test.ts` pins both sentences once each and in order in `orchestrator-agent-factory.md` with `skills: [coordinate-artifact]` and no `Skill` tool. `tests/agent-factory-coordinator-launcher.test.ts` pins both sentences once each in `plan.bootstrapPrompt` and `orchestrator-agent-factory.md` and forbids `"coordinate-artifact" preload`. `tests/claude-launcher-first-message.test.ts` pins that `digital-agency` and `software-engineering` prompts contain none of the factory Skill-entry sentences. |
| S2-C (Windows paths and helper scripts) | In S2 on Windows, Git Bash POSIX paths (`/c/...`, `$PWD/...`) caused one `git show` failure (exit 128) and one `check-sync.mjs` preflight failure (exit 1, `JOB_INVALID`), and generator script `mk.mjs` stayed in the session scratchpad outside `work/sync-evidence/` (as `mk-p5.mjs` and `build.mjs` did outside `work/evidence/` in S1). | `job.md` and the five route/check references state in the same words: pass every path argument to a checker or to `git` as an absolute path in the platform's own form (on Windows a drive letter, never `/c/...` or `$PWD`), and save any helper script written to assemble a record in the evidence folder and name it in the report. | `registry/skills/coordinate-artifact/references/job.md`, `verification.md`, `host-sync.md`, `skill-authoring.md`, `contract-authoring.md`, `bundle-authoring.md` | `tests/agent-factory-proof-fixes.test.ts` pins both exact sentences occurring once each across all six files. |

## What was deliberately not changed and why

- **Launcher refusal on `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` (`src/core/claude-launcher.ts` line 217):** What the launcher does when the Host exports `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` (finding S1-C) is an open maintainer decision and was deliberately not changed here. Consequence: coupled with Fix 2's stop rule, a coordinator running inside a session on a machine whose user settings export that variable stops at step 1 and cannot pass its entry step until the maintainer decides.
- **`SKILL.md` files, `Skill` tool, review schema and process-budget counting:** No `SKILL.md` file was edited (the native `coordinate-artifact` entry stays 5,788 characters), no `Skill` tool grant or `skills:` change was made, `job.schema.json` and `check-review.mjs` were not widened (they already accept `validator` pins in `inputs[]`), and process-budget counting (noted in S1) was not addressed.

## Tests

- New file: `tests/agent-factory-proof-fixes.test.ts`.
- Additions in existing files: `tests/agent-factory-evaluation-record.test.ts` (builds a review job by reading the eight-field list directly out of `verification.md` and passes `check-review.mjs --job` and `--result`; pins refusal of a `roots.read` parent of the review root and refusal of citing a `status: 'held'` input), `tests/agent-factory-coordinator-launcher.test.ts`, `tests/claude-launcher-first-message.test.ts`.
- Pinned values updated in: `tests/agent-factory-bundle-return.test.ts`, `tests/agent-factory-contribution-runbook.test.ts`, `tests/helpers/native-invariant-evidence.ts`.
- **Seen failing first:** the text pins, the scans (bare `agents` commands and contradiction scan), the launcher tests, and the literal-instruction test (building a job from `verification.md`).
- **Not seen failing first** (because they pin behaviour that already existed): `check-review.mjs`'s refusals (parent `roots.read` folder, held input citation) and the unchanged first messages of other bundles (`digital-agency`, `software-engineering`).

## How the work was done

- One Claude subagent (Sonnet 5.5) in its own worktree, built test-first.
- Independent read-only review by another model (`review-proof-fixes.report.md` in `scratch/plan-033-implementation/routed-2026-11-14/`): no blocker, four major, three minor, one note.
- Fix round by the same subagent in which all points were handled: seven taken (the four major and three minor points) and the one note left with a reason (`SKILL.md` files untouched, `claude-launcher.ts` error text and `handback.md` / agent-body line 99 helper-script repetition left unchanged).
- The orchestrating session compared the reports with the files and ran the full gate on the main checkout with the 19 files applied; it did not re-run the filtered acceptance separately after the fix round (its one earlier re-run overlapped with the fix round's edits and is not counted).

## Gate results

Run by the orchestrating session on the main checkout with the 19 files applied (`base-head.txt` is `b6e9136`). One run, Windows, Node 24.19.0; raw files in `logs/plan-033-p16-2026-11-16/`.

| Command / Run | Exit | Counts | Raw files |
| --- | --- | --- | --- |
| `hostlib-verify` (Windows, uncommitted on `b6e9136`) | 0 | Passed | `logs/plan-033-p16-2026-11-16/` (`hostlib-verify`, `base-head.txt` `b6e9136`) |
| `typecheck` (Windows, uncommitted on `b6e9136`) | 0 | Passed | `logs/plan-033-p16-2026-11-16/` (`typecheck`) |
| `full-test-serial` (Windows, uncommitted on `b6e9136`) | 0 | 306 files passed; 7,636 tests passed, 224 skipped, of 7,860; 1,609.45 s | `logs/plan-033-p16-2026-11-16/` (`full-test-serial`) |
| `addon-matrix` (Windows, uncommitted on `b6e9136`) | 0 | 317 passed, none skipped; 435.44 s | `logs/plan-033-p16-2026-11-16/` (`addon-matrix`) |
| Linux CI | Pending | Unverified until the CI run of the commit that contains this work | — |

## Known and left

- The launcher still refuses a dry run when `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` is set (`src/core/claude-launcher.ts` line 217); with Fix 2's stop rule, a coordinator in such a session stops at step 1 and cannot pass its entry step on a machine whose user settings export that variable until the maintainer decides. This is deliberate and stated.
- Process-budget counting (noted in S1) is not addressed.
- The interactive sittings of 2026-11-16 run on workspaces prepared from `c35ec0b`, before these fixes.

## Unverified

- Whether a model follows the new sentences on the real Host: none of the fixes has been re-observed live.
- Linux behaviour for this work until CI runs on the commit that contains it.
- No second-model review of the fix round itself (the orchestrating session compared the reports with the files and ran the full gate, without re-running the filtered acceptance separately after the fix round).

## Next

1. The maintainer's decision on what the launcher does when the Host exports `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` (finding S1-C).
2. The interactive sittings prepared for 2026-11-16 (S3, S4, S6, on `c35ec0b`).
3. Re-observing the P16 fixes live on the Host, then the Claude stage review.
