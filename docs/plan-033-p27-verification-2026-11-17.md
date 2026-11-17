# Plan 033 P27 verification: the last open findings fixed offline; the maintainer's confirmation (2026-11-17)

P27 fixes offline findings D-1, E-1 and E-2 of Sittings D and E and the P26 follow-up about the other checkers' comparison of roots by path string. Part A tightens those checkers; part B fixes the authoring and review texts. Nothing of P27 has been run on a live Host session; the fixes are not re-observed.

Asked "Do you confirm the choices I made under your delegation?", the maintainer answered: "Yes, confirm all." The six choices in [the stage review](plan-033-claude-stage-review-2026-11-17.md), and the later choices under the same delegation in P26 and Sittings D and E, are confirmed. The three row closings (Approved first skill/attribution, Domain/Organization templates, Contribution route) now rest on his confirmation.

His instruction, in substance: fix the open findings and follow-ups, stop before the Codex stage and remind him; he merges the commits to `dev` and starts the remaining milestones in another Claude session with the agent-factory bundle installed. P27 fixes the open findings and follow-ups; the lead then stops before the Codex stage. The maintainer merges the branch to `dev`; the remaining stages (Codex, Antigravity, Cline) and the close of the plan start in another Claude session with the agent-factory bundle installed.

## Scope and baseline

- Date: 2026-11-17.
- Slice: P27, offline.
- Base: commit `f167e83` on the branch of draft pull request 219; code base `d2e2de1` (P26). Linux CI check `test` on the base: success, read once.
- The P27 commits follow; their hashes are in the commit list of the pull request.
- Implementation scope: 25 files modified and 1 new (a test file).
- The findings are in [the Sittings D and E observation](../host-library/claude/observations/2026-11-17-claude-2.1.325-factory-p26-reobserved.md); the checker follow-up is in [the P26 record](plan-033-p26-verification-2026-11-17.md#limits-and-what-is-not-known).

## The review

Independent review by a second Host (Codex, read-only; it ran no test) found no blocker. Two points to fix and two notes on tests were fixed; no second review round was run.

| Number | Severity (the reviewer's) | Point | What was done |
| --- | --- | --- | --- |
| 1 | SHOULD-FIX | Making the string part of grants exact outside Windows refused legal case spellings on case-insensitive volumes that are not Windows. | The string part stays as before P27; the physical part carries the tightening. |
| 2 | SHOULD-FIX | The refused-review wording gave no order or rule for an existing `result.refused.json`. | Move first, stop if the name exists, then save the fresh result. |
| 3 | NOTE | The turn-limit test only looked for a phrase. | The test now pins the rule the wording depends on. |
| 4 | NOTE | The read-root test had no input under the alternate root. | A pinned input was added under the alternate-spelled read root. |

The review found sound: no input refused before is now accepted; the real-path function fails closed; folding on Windows remains; the builder and the review checker agree on the managed-folder rule; the five-line sentence matches the checker; the moved sentences stay in linked references; the Bundle sentence satisfies the report's shape check.

## The change

### Part A: the other checkers compare roots physically

- `registry/skills/evaluate-artifact/scripts/check-review.mjs`, `registry/skills/realize-artifact/scripts/check-job.mjs`, `registry/skills/realize-artifact/scripts/check-handback.mjs` and `registry/skills/sync-host/scripts/check-sync.mjs` now compare roots physically as well as by string, by the return checkers' P26 rule. A refusal (overlap, "must not be the same file", a managed Host folder) holds for a string OR physical match; a grant ("inside this root", "this is the required file", coverage by a read root) needs string AND physical comparisons. Link refusals still run first on the path as given.
- The physical path is the native real path of the deepest existing ancestor plus the part that does not exist yet. The function walks up only on "not found" and refuses any other error.
- This is a tightening. The string part stays exactly as before P27: `check-review.mjs` and `check-job.mjs` (and through it `check-handback.mjs`) fold case on every platform; `check-sync.mjs` is exact except on Windows. The physical part compares exact case except on Windows. On a case-sensitive volume a folder differing only in case from a read root is no longer covered; on a case-insensitive volume two spellings of one folder resolve to the same physical path and stay accepted.
- No reason code, status word or existing message changed. Each existing message can also appear for a physical match. All four have one new message: "Cannot resolve the physical path of <path>: <code>." for a real-path error other than "not found".
- `registry/skills/evaluate-artifact/scripts/review-job.mjs` now reads the physical spelling of the root for its managed-Host-folder rule, so it does not write a job the tightened checker refuses. Builder and checker agree on every root rule; the builder is stricter in rules the checker does not have. `registry/skills/evaluate-artifact/references/job.md` gains a sentence about that rule.
- In `check-sync.mjs`, changed pins against held sources stay compared by string: a physical refusal there would change the reason code, and preflight already covers the case. Target records may come from another machine and are never read from disk; they keep their string rules.
- Strict-side edge: when only a nonexistent part of a path differs in case from its root, the grant is refused except on Windows, also on a case-insensitive volume that is not Windows.

### Part B: the three findings

D-1: the same sentence now stands once in each shared entry, `registry/skills/author-skill/SKILL.md`, `registry/skills/author-contract/SKILL.md`, `registry/skills/author-bundle/SKILL.md`, and their native entries under `registry/hosts/claude/skills/`: "With no task path, or a path that does not exist or is not a task record of this Skill, stop with a blocked note naming the path; never choose another task file." One sentence moved from native `author-contract` to `registry/skills/author-contract/references/job.md`, and two from native `author-bundle` to `registry/skills/author-bundle/references/verification.md`; no rule was dropped.

E-1, evaluator: `registry/skills/evaluate-artifact/references/evidence.md` now says: "A citation spans at most five logical lines (its end line at most four after its start line); cite a longer passage as several citations or by its most telling lines, because the caller's record check refuses the whole review otherwise." A test reads the number from the checker source and compares it with the text.

E-1, coordinator: one wording stands in `registry/skills/coordinate-artifact/references/verification.md`, step 11 of `registry/skills/coordinate-artifact/references/skill-authoring.md` and `registry/skills/coordinate-artifact/references/contract-authoring.md`, and `registry/hosts/claude/agents/orchestrator-agent-factory.md`:

"When `check-review.mjs --job --result` refuses a review result, never edit the result. You may start ONE fresh evaluator for the same review job, with the checker's reason quoted in the prompt, if the journey's one additional evaluator turn is still unused (it counts as that turn of the worker-turn limit, so no evaluator turn is then left for a repair's review); that is a new evaluator turn, not a repair of the candidate, and needs no other authorization. First move the refused result to `result.refused.json` beside it; if that name already exists, stop and report instead of overwriting; only then save the fresh evaluator's result unedited as `result.json`, and report both. A second refusal is reported, not retried."

This is a design choice of the lead: the fresh evaluator uses the additional evaluator turn already allowed by `registry/skills/coordinate-artifact/references/repair.md`; it adds no allowance and leaves no evaluator turn for a repair's review. `repair.md` is unchanged. A test pins the wording in the four places and the rule it depends on.

E-2: `registry/skills/author-bundle/assets/report.json` makes `upstream` always present and gives the local-intent sentence: "Local intent: nothing is prepared for upstream." `registry/skills/author-bundle/references/verification.md` says the same. `src/core/bundle-check.ts` is unchanged and still requires the section in every proposal; the other two authoring report guides have no such mismatch. A test uses the sentence from the guide to pass the shape check and shows that a report without the section still fails.

New `tests/agent-factory-findings-de.test.ts` has 17 tests.

## How it was made and checked

- Two Claude subagents worked in two worktrees on disjoint files (part A; part B). The lead merged them into one worktree, compared each report with its worktree and ran the nearest tests on the merged tree.
- The four checkers' test files and the builder's cover protected or managed folder short names (refused), another-case compatibility cases, legal layouts in two spellings with a pinned input under the alternate read root, coverage across spellings, four case-sensitive-volume-only cases, and source-text tests of the real-path function. Coverage across spellings is accepted where the volume ignores case; a short-name spelling stays refused because the string part never covered it.
- The worker swapped the base commit's checkers back in and ran these tests: 9 failed (every short-name refusal test and the source-text tests), 11 passed. With the new checkers all pass.
- The independent review and fixes are recorded above. The review ran no test and no build.

## Gate

Windows, Node 24, from the branch checkout, serial (`env -u CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS npm test -- --maxWorkers=1 --fileParallelism=false`), started only after the review was in, with nothing else running on the machine except a documentation worker. Raw files `logs/plan-033-p27-2026-11-17/`: `hostlib-verify` exit 0; `typecheck` exit 0; `full-test-serial` exit 0 (316 test files passed; 8,013 passed, 232 skipped; 1,992.83 s); `addon-matrix` exit 0 (317 passed; 461.38 s).

Linux CI: not read yet for P27 (it runs after the push). Four new tests run only on a case-sensitive volume: Linux CI is their first run.

## Limits and what is not known

- Not run on a live Host at the time of this record: nothing of P27. D-1, E-1 and E-2 are fixed in the texts and NOT re-observed.
- The short-name tests ran on one Windows machine; on Linux they skip.
- macOS and other case-insensitive volumes that are not Windows: reasoned from the code, never run.
- Real-path errors other than "not found" are covered by source-text tests only.
- D-1 and the coordinator's rule for a refused review are prose: nothing enforces that a fork stops on a wrong path or that the coordinator starts only one fresh evaluator.
- The review ran no test and no build. Live behaviour remains unverified.

## Matrix state lines

[The completion matrix](plan-033-completion-matrix.md) records the maintainer's confirmation in the three delegated closings and a new Claude stage quality and proof state line. P27 sentences are appended to that row, Factory evaluator, Shared definition/contract authoring helper, Domain/Organization templates, Factory orchestrator/pipeline and Host-update sync after realize. The stage remains open: Factory hooks and the merge are open.

## Open after P27

- A short re-observation on the Host is planned by the lead after this record; its result goes into its own observation record.
- The maintainer's: items 5 to 9 of the list of open decisions in [the handoff](plan-033-handoff-2026-11-15.md) (Factory hooks waits for items 6 to 8); merging draft pull request 219 and the router's draft pull request 220.
- After the merge, the remaining stages and the close of the plan start in another Claude session with the agent-factory bundle installed, by the maintainer's instruction. The Codex stage is not started.
