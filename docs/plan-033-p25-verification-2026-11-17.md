# Plan 033 P25 verification: the factory's own Skills, the author-skill return script and physical root checks (2026-11-17)

P25 has three parts: (A) the factory's own Skills pass the factory's own Skill check under the in-house policy; (B) `author-skill` gets a shipped script that writes its return; (C) after review, the three return-writing scripts compare roots by physical path. Nothing of P25 has been run on a live Host session; the changes are not observed live.

Parts A and B were decided by the lead, not by the maintainer. On 2026-11-17 the maintainer left the open choices of the night to the lead, in his words "decide yourself for the questions and other things as your recommended options and only wait for very critical questions". Part A is item 10 of the handoff's list of open decisions ("fix or record"; the lead recommended to fix). Part B is the return script that P24 had left out. Both are decided by the lead under that delegation and are the maintainer's to overturn.

## Scope and baseline

- Date: 2026-11-17.
- Slice: P25, offline work with tests.
- Base: the P24 commits on the branch of draft pull request 219 (code `a4fc928`, records `6bbe03f`; Linux CI check `test` on `6bbe03f`: success, read once).
- The P25 commits follow that base; their hashes are in the commit list of the pull request.
- Implementation scope: 23 files modified and 3 new (the script and two test files).

## The two review rounds

Round 1 was an independent, read-only review on a second Host, Codex; the reviewer ran no test. Round 2, after the fixes, was made by a read-only Claude reviewer subagent, because the router refused a further Codex run ("headroom 8% below minimum 10%" in Codex's current window).

Round 1 found one blocker, two points where the Skill script was stricter than its checker, and one note. It found sound: the write block, the mirrors of the checker, the nine-file pins, the own-skills test and the texts of part A (the native rule links remain; the moved sentence stays reachable from the entry). Round 2 found no blocker, confirmed the three round 1 findings fixed, and raised five new points. No third round was run; the lead read the changed functions.

| Round | Number | Severity (the reviewer's) | Finding | What was done |
| --- | --- | --- | --- | --- |
| 1 | 1 | BLOCKER | The root checks compared path strings, inherited from P24's `contract-return.mjs`; another spelling of a protected folder (an NTFS short name) passed. | Part C: roots compared by physical path in all three return writers. |
| 1 | 2 | SHOULD-FIX | The Skill script was stricter than its checker on case collisions. | Part C: the Skill and contract scripts collect file paths only, as their checkers do; the Bundle script and its checker both compare files and directories. |
| 1 | 3 | SHOULD-FIX | The Skill script was stricter than its checker on the helper's stderr at exit 0. | Part C: the Skill script accepts and pins a non-empty stderr, as its checker does; the contract script keeps its empty-stderr rule, as its checker requires. |
| 1 | 4 | NOTE | No fault-injection test for the writers. | Not fixed: no test hook was added to a shipped script (decided: a test hook in a shipped script is itself a risk). |
| 2 | 1 | SHOULD-FIX | A file pinned into the return kept the spelling the fork passed, while the checker tests that spelling as a string against the producer root, so a return could be written that the checker then refuses. | The Skill and contract scripts now require the checker's string rule as well as the physical rule for every file pinned into the return. |
| 2 | 2 | SHOULD-FIX | Outside the change set, the checkers' own preflight and the draft helpers `draft.mjs` and `draft-pair.mjs` still compare root strings, so a draft can be written under another spelling of a protected folder before the return script refuses. | Not fixed, follow-up: it changes the checkers and the draft helpers. |
| 2 | 3 | NOTE | The physical-path function treated any real-path error as "absent". | The function walks up only on "not found" and refuses any other error, in the three writers and in P24's `review-job.mjs`. |
| 2 | 4 | NOTE | The check that the draft's parent folder holds nothing else compares a short name with long names, in script and checker alike. | Not fixed, follow-up. |
| 2 | 5 | NOTE | Test names and missing checker runs in some tests. | Tests renamed and extended. |

## The change

### Part A: the factory's own Skills and the Skill check

- Before: `skill-check --policy agents-united-original` exited 1 for `registry/skills/coordinate-artifact` (3 findings) and for `registry/skills/evaluate-artifact` (13 findings; one of them came with P24's new script); it exited 0 for `author-skill`, `author-contract` and `author-bundle`.
- After: exit 0 with no finding for all five. The check itself (`src/core/skill-check.ts`, `src/core/skill-contract.ts`, `src/core/skill-layout.ts`) and its policies are unchanged.
- The check reads only the shared entry `registry/skills/<name>/SKILL.md` and its folder; it does not read the native entry under `registry/hosts/claude/skills/`.
- `coordinate-artifact`, shared entry, step 7: one sentence added that names the three return checkers in the `${CLAUDE_SKILL_DIR}/scripts/...` form. Its native entry is unchanged (5,723 of 5,788 LF characters; the added sentence would not fit there).
- `evaluate-artifact`, shared entry: the description now begins "Use when asked for an independent quality review of"; step 1 names the standing-rule references the binding supplies without linking to files that exist only after installation; the two scripts are named in the `${CLAUDE_SKILL_DIR}/scripts/...` form (the sentence still says that the caller, never the evaluator, runs them); a section "## Verification Checklist" with three items; the sentence "Worked examples: ..."; one line of anti-patterns. One sentence moved from the shared entry to `registry/skills/evaluate-artifact/references/evidence.md` to stay under 6,000 characters. Every added statement is taken from the Skill's existing references.
- `evaluate-artifact`, native entry: only the description and the two script paths changed. It does not carry the checklist or the anti-patterns line (they would not fit: about 6,400 characters).
- Sizes after the change (LF characters / lines): shared `coordinate-artifact` 5,525 / 43; native `coordinate-artifact` 5,723 / 44; shared `evaluate-artifact` 5,948 / 43; native `evaluate-artifact` 5,737 / 38.
- New test file `tests/agent-factory-own-skills-pass-skill-check.test.ts`: runs the check in process for the five factory Skills with the policy `agents-united-original` and the repository's corpus and expects no finding, status `passed` and exit code 0 for each. No existing pin moved.

### Part B: the author-skill return

- New shipped script `registry/skills/author-skill/scripts/skill-return.mjs` (`node:` imports only), with this command line: `--job <absolute skill-task.json> (--saved-job <file> --stdout <file> --stderr <file> --exit-code <0 or 1> or --no-helper) [--report <file>] [--notes <file>]`. The flags are the same as those of `contract-return.mjs`. Every file except the task lies under the producer root. The fork hands over only what only it knows; the script computes the task id and digest, the status, the helper pins, the inventory, the changed list and the report pin. Operations are `create` and `repair`.
- The authority is unchanged in its rules: `registry/skills/coordinate-artifact/scripts/check-skill-return.mjs`. Its list of installed `author-skill` files and its count words, the task schema's `installed` bounds (`skill-task.schema.json`), the Claude binding (`registry/hosts/claude/agent-factory.binding.json`), `scripts/factory-proof-scenarios.mjs`, test helpers and tests moved from eight to nine files.
- Texts: both entries of `author-skill` tell the fork to run the script once and never to write `skill-return.json` by hand, and that the `assets/report.md` outline is not the return; `references/job.md` holds the command line; `registry/skills/coordinate-artifact/references/skill-authoring.md` and the agent file name the script and say the caller never reruns it. `skill-check` on `author-skill` still exits 0.
- New test file `tests/agent-factory-skill-helper.test.ts`: round trips for every reachable status (draft after exit 0, blocked after exit 1, blocked without a helper run; create and repair) in which the script's output passes `check-skill-return.mjs --job --result` with exit 0; the refusals; the hard-link regression; the path cases.

### Part C: roots by physical path, after the first review

This applies to all three return writers: `skill-return.mjs`, and the two that P24 had shipped or changed, `registry/skills/author-contract/scripts/contract-return.mjs` and `registry/skills/author-bundle/scripts/bundle-return.mjs`.

- Roots are compared by physical path (the native real path of the deepest existing ancestor plus the part that does not exist yet): root against root, against protected, managed, checkout and registry paths, "under the producer root", and the identity of the return and notes files. Before, these compared path strings, so another spelling of one folder (an NTFS short name) passed the protected-root checks. The weakness was in `contract-return.mjs` as pushed with P24.
- Each script now agrees with its own checker on two points where it had been stricter: case collisions (the Skill and contract scripts collect file paths only, as their checkers do; the Bundle script and its checker both compare files and directories), and the helper's stderr on exit 0 (the Skill checker accepts and pins a non-empty stderr, so the Skill script does too; the contract checker requires an empty stderr, so the contract script keeps that).
- After the second review, the Skill and contract scripts require the checker's string rule as well as the physical rule for every file pinned into the return, and the physical-path function walks up only on "not found" and refuses any other error (in the three writers and in P24's `review-job.mjs`).
- Tests in the three helper test files: an absent-folder case on every platform, another-case spelling where the volume ignores case, the NTFS short-name alias on Windows where short names exist (it ran on the lead's machine), and three case-collision tests that run only on a case-sensitive platform.

## How it was made and checked

- Two Claude subagents in two worktrees on disjoint files (part A; part B), merged by the lead into one worktree. The lead compared each report with the worktree, read the text diffs and ran the five Skill checks and the nearest tests on the merged tree itself.
- The two review rounds and their findings are in the table above.
- No test hooks were added to the shipped scripts for fault injection (decided: a test hook in a shipped script is itself a risk).

## Gate

Windows, Node 24, from the branch checkout, serial (`env -u CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS npm test -- --maxWorkers=1 --fileParallelism=false`), with nothing else running on the machine except a read-only review.

- Two gate starts were stopped by the lead within minutes, each because a review had just come back with points that would change the code; their partial files are in `logs/plan-033-p25-2026-11-17/` and `logs/plan-033-p25-2026-11-17-full/`. They are not results.
- The gate on the final code (raw files `logs/plan-033-p25-2026-11-17-gate/`): `hostlib-verify` exit 0; `typecheck` exit 0; `full-test-serial` exit 0 (314 test files passed; 7,925 passed, 228 skipped; 1,790.98 s); `addon-matrix` exit 0 (317 passed; 428.73 s).

Linux CI: not read yet for P25 (it runs after the push). Three new case-collision tests run only on a case-sensitive platform: Linux CI is their first run.

## Limits and what is not known

- Not run on a live Host: the fork running `skill-return.mjs`; an installed evaluator or coordinator with the changed entries.
- The Skill check reads only the shared entries. The native entries, which are what is installed on the Claude Host, are not read by it; the native evaluator entry does not carry the checklist or the anti-patterns line, and the shared and native coordinator entries now differ by one sentence.
- No fault-injection test for the three writers (partial writes, a failing rename): covered by source-text tests and by reading the code only.
- The checkers themselves and the draft helpers `draft.mjs` and `draft-pair.mjs` still compare path strings (unchanged in P25). A task whose draft or producer root is another spelling of a protected folder passes its preflight; the draft helper then writes there, and only the return script refuses. The return script's refusal is the safe side for the return file; it does not keep the protected folder untouched. Follow-up slice, not done.
- The reviews ran no test and no build.

## Matrix state lines

The state lines for Approved first skill/attribution, Factory evaluator, Factory orchestrator/pipeline and Shared definition/contract authoring helper in [the completion matrix](plan-033-completion-matrix.md) now carry P25. The remaining text of those cells is historical and unchanged.

## Open after P25

- Follow-up slice from the second review (not started): physical-path comparison in the three checkers' preflight root checks and in `draft.mjs` and `draft-pair.mjs`; the draft-parent check with a short name.
- Decided by the lead under the delegation and still to do: one short sitting that re-observes the fixes of P24 and P25, and the one headless re-run; then the stage-close record.
- Not decided and open: items 5 to 9 of the handoff's list of open decisions; merging the pull request; the start of the Codex stage. The list is in [the handoff](plan-033-handoff-2026-11-15.md).
