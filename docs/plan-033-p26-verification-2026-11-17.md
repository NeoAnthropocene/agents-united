# Plan 033 P26 verification: the open findings fixed offline (2026-11-17)

P26 fixes offline the four open points in the Claude stage review: the follow-up of P25 and findings C-1, C-2 and C-3 of Sitting C and the headless journey. Part A compares roots by physical path before anything is written; part B fixes the three small findings in the texts. Nothing of P26 has been run on a live Host session; the fixes are not re-observed.

The lead decided to fix the open findings under the maintainer's delegation of 2026-11-17: "decide yourself for the questions and other things as your recommended options and only wait for very critical questions". Fixing them was the lead's recommended option; the decision is the maintainer's to overturn.

## Scope and baseline

- Date: 2026-11-17.
- Slice: P26, offline.
- Base: commit `734b531` (the stage review record) on the branch of draft pull request 219; code base `a5948c3` (P25).
- The P26 commits follow; their hashes are in the commit list of the pull request.
- Implementation scope: 24 files modified and 2 new (a test file and a test helper).

## The review

Independent review by a second Host (Codex, read-only; it ran no test) found no blocker, two points to fix in part B and one note. All three were fixed; no second review round was run.

| Number | Severity (the reviewer's) | Point | What was done |
| --- | --- | --- | --- |
| 1 | SHOULD-FIX | The two JSON examples ended with a fence followed by prose on the same line, which rendered as code and was accepted by the test extractor. | The fences and following prose were separated. |
| 2 | SHOULD-FIX | The Bundle reference had no example of its own, the test built one independently, and the reference omitted the raw-pin limit from the task's budget. | The Bundle reference gained its own example and the budget limit; the test uses the documented example. |
| 3 | NOTE | The another-case tests also pass with the old comparison. | They were named as compatibility cases. |

The review found sound: every earlier string condition is kept; link checks precede physical resolution; the draft-parent rule compares names and opens no way around a sibling link; real-path errors reach the scripts' own refusal with one line of JSON and exit 1; no pinned refusal text changed; the documented keys match the three task schemas; the five result-path sentences agree with `check-review.mjs`.

## The change

### Part A: roots by physical path before anything is written

- The three return checkers, `registry/skills/coordinate-artifact/scripts/check-skill-return.mjs`, `registry/skills/coordinate-artifact/scripts/check-contract-return.mjs` and `registry/skills/coordinate-artifact/scripts/check-bundle-return.mjs`, compare roots physically as well as by string in preflight and in the repeated postflight checks. A refusal holds when paths overlap as strings OR physically; acceptance of "inside this root" needs both. Every earlier string comparison remains, no reason code or message changed, and link refusals still run first on the path as given.
- The physical path is the native real path of the deepest existing ancestor plus the part that does not exist yet. The function walks up only on "not found" and refuses any other error.
- `registry/skills/author-skill/scripts/draft.mjs` and `registry/skills/author-contract/scripts/draft-pair.mjs` use the same comparison for the roots they check and refuse before any write. The Skill helper's job carries only source and draft roots; no field was invented. The checker's preflight guards the other roots before the helper runs.
- The worker compared old and new scripts with a short-name spelling of a draft folder inside the source checkout: `draft.mjs` at `91d1ce4` exited 0 and wrote into the source checkout; the new script exits 1 ("Source/output roots overlap") and writes nothing.
- The draft-parent check ("the draft's parent folder holds nothing else") matches the draft by its given name or physical-path name in `check-skill-return.mjs`, `check-contract-return.mjs`, `registry/skills/author-skill/scripts/skill-return.mjs` and `registry/skills/author-contract/scripts/contract-return.mjs`. Matching is by name only: a link or a second entry beside the draft is still refused. This is the one requested loosening; the other root changes are a tightening.
- No case is known after P26 where a task passes preflight and is then refused by its return script for a root reason. Where they still differ, the checker is stricter.
- The preflight still checks the task's template, not the job file the fork actually feeds to the draft helper. A different job is caught at postflight, after the write, as before.

### Part B: the three small findings

- C-1: step 2 of `registry/skills/coordinate-artifact/references/skill-authoring.md`, `registry/skills/coordinate-artifact/references/contract-authoring.md` and `registry/skills/coordinate-artifact/references/bundle-authoring.md` now ends with: "The task's `roots` holds exactly `draft`, `producer`, `evidence`, `managed` and `protected`: copy no other key of the brief's `roots` into it (the schema refuses `workspace`)." The proof kit's briefs and the task schemas are unchanged; a brief may carry extra fields.
- C-2: `registry/skills/author-skill/references/job.md` and `registry/skills/author-contract/references/job.md` show every notes key, the shapes of `openItems`, `claimedChecks` and its `raw` pin (`null` or a pin with path, bytes and sha256), with JSON examples. `registry/skills/author-bundle/references/job.md` does the same for its notes, including the raw-pin limit from the task's budget. New `tests/agent-factory-notes-examples.test.ts` extracts each documented example and feeds it to its script, which must accept it.
- C-3: five places say the caller saves the evaluator's result "unedited as `<review root>/result.json` (beside `job.json`)" before running `check-review.mjs --job --result`: step 11 of `skill-authoring.md` and `contract-authoring.md`, `registry/skills/coordinate-artifact/references/verification.md`, `registry/hosts/claude/agents/orchestrator-agent-factory.md` and `registry/skills/evaluate-artifact/references/handback.md`.
- Two comments in `src/core/skill-check.ts` that cite moved lines of `check-skill-return.mjs` were corrected.

## How it was made and checked

- Two Claude subagents worked in two worktrees on disjoint files (part A; part B). The lead merged them into one worktree, compared each report with its worktree, read the text changes and ran the nearest tests on the merged tree.
- `tests/helpers/path-spellings.ts` finds a short-name or another-case spelling on the real volume or lets a test skip with a reason. Checker, draft-helper and return-helper tests cover protected-folder short names, another-case compatibility cases, legal non-overlapping layouts in two spellings, another spelling of the draft's own name, a stray entry or link beside it, and source-text checks of the real-path function. All ran on the lead's Windows machine, where short names were available; on Linux the short-name and another-case tests skip.
- The independent review and fixes are recorded above. The review ran no test and no build.

## Gate

Windows, Node 24, from the branch checkout, serial (`env -u CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS npm test -- --maxWorkers=1 --fileParallelism=false`), with nothing else running on the machine except a documentation worker; started only after the review was in. Raw files `logs/plan-033-p26-2026-11-17/`: `hostlib-verify` exit 0; `typecheck` exit 0; `full-test-serial` exit 0 (315 test files passed; 7,973 passed, 228 skipped; 1,835.78 s); `addon-matrix` exit 0 (317 passed; 424.76 s).

Linux CI: not read yet for P26 (it runs after the push).

## Limits and what is not known

- Not run on a live Host: nothing of P26. Findings C-1, C-2 and C-3 are fixed in the texts and not re-observed; whether a coordinator and the forks now get these steps right at the first attempt is not known.
- The short-name tests ran on one Windows machine; on Linux they skip, so Linux CI does not exercise the alias cases.
- Real-path errors other than "not found" are covered by source-text tests only; they cannot be produced portably.
- The factory's other checkers (`check-review.mjs`, `check-job.mjs`, `check-handback.mjs`, `check-sync.mjs`) were not examined for the same string comparison in this slice.
- The review ran no test and no build. Live behaviour remains unverified.

## Matrix state lines

The Claude stage quality and proof state line in [the completion matrix](plan-033-completion-matrix.md) now records the four points fixed offline and not re-observed. That row stays open; the other row states and the older cell text are unchanged. P26 sentences are appended to that row and to Shared definition/contract authoring helper, Approved first skill/attribution and Factory orchestrator/pipeline.

## Open after P26

- What awaits the maintainer is unchanged: the nine items in [the handoff's stage-review addendum](plan-033-handoff-2026-11-15.md#addendum-claude-stage-review-and-what-awaits-the-maintainer-2026-11-17). The stage is still not closed.
- The same string comparison in the factory's other checkers was not examined; see the limits above.
