# Plan 033 P24 verification: fixes for the three findings of Sitting B (2026-11-17)

P24 fixes offline the three findings of [Sitting B](../host-library/claude/observations/2026-11-16-claude-2.1.325-factory-typed-routes-second-model.md): B-1, the entry dry run's working folder; B-2, the invalid JSON contract return; and B-3, the hand-assembled Skill review job. Asked whether to fix B-1, B-2 and B-3 before the stage close, the maintainer answered "Yes, fix them". Nothing of P24 has been run on a live Host session; the fixes are not re-observed and live behaviour is unverified.

## Scope and baseline

- Date: 2026-11-17.
- Slice: P24, offline work with tests.
- Base: `df8fca9` on the branch of draft pull request 219.
- The P24 code commit and records commit follow that base; their hashes are in the commit list of the pull request.
- Implementation scope: 29 files modified and 5 new (the two scripts and three test files).

## The three review rounds

Three independent read-only review rounds ran on a second Host, Codex; the reviewer ran no test and no build. During the slice the maintainer changed the worker supply: "Prioritize codex CLI for your subagent worker over Antigravity". A review started on Antigravity was stopped before writing a result and run on Codex instead.

## What the reviews found

Round 1 had nine findings, two blockers. Round 2 confirmed round 1 points 1, 2 and 4 to 9 fixed and raised six new points, one blocker. Round 3 found no blocker and confirmed the round 2 points fixed, with point 5 partly fixed; it raised two more points, both fixed. No fourth round was run: the lead checked the last two fixes from the worker's report and tests.

| Round | Number | Severity (the reviewer's) | Finding | What was done |
| --- | --- | --- | --- | --- |
| 1 | 1 | BLOCKER | Stale or invented passes received receipts bound to the current candidate digest. | Require the digest taken before each executed check and refuse a differing digest. |
| 1 | 2 | BLOCKER | Truncating an existing hard-linked destination could destroy another file's bytes. | Use exclusively created temporary files and rename them into place in all three writers. |
| 1 | 3 | SHOULD-FIX | Builder outputs could overwrite their own sources. | Compare physical source and destination paths before writing; round 2 found an alias case. |
| 1 | 4 | SHOULD-FIX | Containment folded case on case-sensitive platforms. | Grant coverage using exact case on case-sensitive platforms; leave the checker unchanged by decision. |
| 1 | 5 | SHOULD-FIX | A missing executable of an unperformed check produced a job the checker refuses. | Use the executable's existing parent folder as its read root. |
| 1 | 6 | SHOULD-FIX | Optional evidence satisfied the builder where the checker requires evidence. | Mirror the checker's required-evidence rule. |
| 1 | 7 | SHOULD-FIX | Smaller budgets could not be expressed. | Allow an optional `budget` only to lower limits. |
| 1 | 8 | SHOULD-FIX | A blocked contract return wrote `changed: []` unchecked. | Mirror the checker's blocked-state rule. |
| 1 | 9 | NOTE | The `author-contract` job reference contradicted `--job`. | Correct the sentence in `registry/skills/author-contract/references/job.md`. |
| 2 | 1 | BLOCKER | An NTFS short-name alias let the builder overwrite its own spec. | Compare source and destination physical paths before the first write. |
| 2 | 2 | SHOULD-FIX | A partial write could be published as a valid return. | Loop until every byte is written and compare the bytes after reading back. |
| 2 | 3 | SHOULD-FIX | The reuse route requested a draft digest before a draft exists. | Pin the earlier source-registry check as `validator` evidence, not as a check. |
| 2 | 4 | SHOULD-FIX | Evidence copies named from source file names could collide. | Name copies `evidence-<id><extension>`. |
| 2 | 5 | SHOULD-FIX | Temporary files survived write failures. | Remove the temporary file on failure; round 3 called this partly fixed, with no fault-injection test. |
| 2 | 6 | NOTE | The temporary name grew with the destination name. | Fix the temporary naming in the new-file write rule. |
| 3 | 1 | SHOULD-FIX | An evidence id such as `con` produced an illegal Windows copy name. | Use the `evidence-<id><extension>` copy name; the lead checked the report and tests. |
| 3 | 2 | SHOULD-FIX | A late refusal did not say outputs were already written. | Add the disclosure; the lead checked the report and tests, with no test for this short failure window. |

## The change

### B-1: the entry step

- The entry sentence has one new wording in all six places that hold it (the four route files `skill-authoring.md`, `contract-authoring.md`, `bundle-authoring.md`, `host-sync.md` and `dispatch.md` under `registry/skills/coordinate-artifact/references/`, and `registry/hosts/claude/agents/orchestrator-agent-factory.md`): "Run the pinned checkout's built CLI, `node <checkout>/dist/cli.js start agent-factory --host claude --dry-run`, from the workspace root (the folder the session was started in, which holds the installed bundle; not a subfolder), never a bare `agents` from the path, and save its output in the evidence folder."
- `src/core/claude-launcher.ts`: both errors "Bundle '<name>' is not installed in <scope> scope." get, for project scope only, the suffix " Checked folder: <absolute folder>." The lookup does not walk to parent folders (decided: a walk could pick up another installation). The same message in `src/core/cline-launcher.ts` and `src/core/antigravity-launcher.ts` is unchanged (no test requires the three to be identical).
- New test file `tests/agent-factory-entry-dry-run-folder.test.ts`: from the workspace root the dry run exits 0 and names `orchestrator-agent-factory`; from a subfolder it exits 1 with the old sentence and the checked folder; the new sentence stands once in each of the six places.

### B-2: the contract return

- New shipped script `registry/skills/author-contract/scripts/contract-return.mjs` (`node:` imports only): `--job <absolute contract-task.json> (--saved-job <file> --stdout <file> --stderr <file> --exit-code <0|1> | --no-helper) [--report <file>] [--notes <file>]`. Every file except the task lies under the producer root. The fork hands over only what only it knows (the saved evidence of its one `draft-pair.mjs` run, or that the helper never ran; an optional report; an optional notes file with `openItems`, `unverified`, `claimedChecks`, `externalActions`). The script computes the task id and digest, the status (draft after exit 0, otherwise blocked), the helper pins, the inventory, the changed list and the report pin, and writes `contract-return.json` with `JSON.stringify`.
- The authority is unchanged in its rules: `registry/skills/coordinate-artifact/scripts/check-contract-return.mjs`. Its list of installed `author-contract` files, its messages, the task schema's `installed` bounds (`contract-task.schema.json`), the Claude binding (`src/core/claude-contract-binding.ts`, `registry/hosts/claude/agent-factory-contract.binding.json`), `scripts/factory-proof-scenarios.mjs` and the tests moved from eighteen to nineteen files.
- Texts: both entries of `author-contract` tell the fork to run the script once and never write the return by hand; `assets/report.json` is an outline, not the return. `references/job.md` holds the command line; the contract route and agent say the caller never reruns the script. The native entry `registry/hosts/claude/skills/author-contract/SKILL.md` is now 5,999 LF characters (limit 6,000); to fit, two phrases that no test pinned were dropped there ("Claude path example", "Other bindings resolve their own root.").
- New test file `tests/agent-factory-contract-helper.test.ts`: round trips for every reachable status in which the script's output passes `check-contract-return.mjs --job --result` with exit 0, the refusals, and the Windows case (paths with backslashes come out as valid JSON).

### B-3: the review job

- New shipped script `registry/skills/evaluate-artifact/scripts/review-job.mjs` (`node:` imports only): `--spec <absolute review-spec.json>` builds `<review>/job.json`, the check receipts and the copies the evaluator may cite; `--digest --spec <file>` only prints the current candidate digest and writes nothing. The spec holds only the caller's decisions; the script computes every pin (candidate inventory and digest, loading, guard, profile, tool-policy, library-lock, guide and snapshot pins for the kind, shared core and contract for an agent candidate, the template for upstream intent), de-duplicated inputs, minimal read roots and the rubric's applicability, for the three kinds `skill`, `shared-pair` and `claude-agent`.
- It never runs a check. Its only child process is `git -C <checkout> rev-parse --verify HEAD`.
- The authority is unchanged: `registry/skills/evaluate-artifact/scripts/check-review.mjs` and both schemas. The caller still runs it on the job.
- Delivery: the script is the thirteenth required support file of `evaluate-artifact` and the twenty-first installed file the coordinator's closure requires (`src/core/claude-factory-declaration.ts`, `registry/hosts/claude/agent-factory-evaluate.binding.json`, `registry/hosts/claude/agent-factory-coordinate.binding.json`, `tests/agent-factory-evaluator-delivery.test.ts`). It is not named in either `coordinate-artifact/SKILL.md`.
- Texts: both entries of `evaluate-artifact` and its `references/job.md` (the spec's keys with an example, the receipt's eight keys, what the builder verifies and what it only records); `registry/skills/coordinate-artifact/references/verification.md`; steps 9 and 10 of `skill-authoring.md` and `contract-authoring.md`; the agent file. The order the texts now give: write the spec without its checks, take the candidate digest with `--digest`, run the check, complete the spec, build the job, run `check-review.mjs --job`. For a `reuse` task of the contract route, the earlier check against the source registry is pinned as `validator` evidence, not as a check.
- New test file `tests/agent-factory-review-job-builder.test.ts`: for each kind the builder's job passes `check-review.mjs --job` with exit 0 at the first call; a case in the shape of the live session; the honesty rules and refusals.

### Added after the first review

Not one of the three findings: `registry/skills/author-bundle/scripts/bundle-return.mjs`, which shipped earlier, had the same write weakness as the new scripts (see the review above, first round, point 2) and got the same fix, with a regression test in `tests/agent-factory-bundle-helper.test.ts`. No flag, output field or check of it changed.

### The digest rule and the write rule

For every executed check, the builder requires the candidate digest the caller took with `--digest` before the check ran and refuses a different digest. Every output of `contract-return.mjs`, `review-job.mjs` and `bundle-return.mjs` is written to a new, exclusively created file in the same folder and renamed into place, looping until every byte is written, removing the temporary file on failure and comparing bytes after reading back. Sources and destinations are compared by physical path before the first write. The builder grants coverage using exact case on case-sensitive platforms; the checker still folds case, unchanged by decision. The checkers stay the authority and their rules were not loosened.

Execution of a check is not authenticated, by design: the builder verifies the digest binding, status against exit code and existence of saved output. Whether the command ran with that exit code and output remains the caller's statement, as `references/job.md` says. The checker reports `executionProof: "unverified"`, and a test asserts it.

## How the work was done

- A routed Antigravity worker wrote a read-only design paper with fifteen questions; the lead spot-checked the claims and decided the design.
- Two Claude subagents implemented disjoint files in two worktrees (entry step and contract return; review-job builder). The lead merged them, read the diffs and ran acceptance commands itself.
- The second-Host reviews and their dispositions are recorded above.

### A mistake of the lead, corrected

During the slice several focused test runs showed tests "timing out" at 5,000 ms. The cause was the lead's command form: `npm test` runs `vitest run --testTimeout=30000 --hookTimeout=30000`, while the bare `npx vitest run <files>` the lead had written into both briefs uses vitest's 5,000 ms default. Two explicit timeouts that the lead had a worker add to two existing tests were therefore unnecessary and were removed again; no test file other than the ones listed above is changed by P24.

## Tests

- `tests/agent-factory-entry-dry-run-folder.test.ts`: workspace-root success, subfolder refusal with the checked folder and the entry sentence in all six places.
- `tests/agent-factory-contract-helper.test.ts`: every reachable return status passes `check-contract-return.mjs --job --result`, refusals, and valid JSON for Windows backslash paths.
- `tests/agent-factory-review-job-builder.test.ts`: each candidate kind passes `check-review.mjs --job` on the first call, a live-session-shaped case, honesty rules and refusals.
- `tests/agent-factory-bundle-helper.test.ts`: regression coverage for the write fix added after the first review.

## Lead's acceptance and gate

Windows, Node 24, from the branch checkout, serial (`env -u CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS npm test -- --maxWorkers=1 --fileParallelism=false`), with nothing else running on the machine.

- Run 1 (raw files `logs/plan-033-p24-2026-11-17-run1/`): `hostlib-verify` exit 0; `typecheck` exit 0; `full-test-serial` EXIT 1 (312 test files; 7,865 passed, 1 failed, 225 skipped; 1,755.21 s); `addon-matrix` exit 0 (317 passed; 431.16 s). The one failure was a real defect that the workers' worktrees could not show: the builder test "refuses a review root overlapping the candidate, the source, the read folder, a managed or a protected path" expected "Review output root overlaps" and received "Review root is a managed Host path." The branch checkout lives under a folder named `.codex`, and the builder applied its managed-Host-path refusal before its overlap refusal, the other way round than the checker. Fixed: the builder now applies its refusals in the checker's order and wording (overlap first, then "Review output root is a managed Host path.", the same pair for the read folder, the HEAD check last), and three test cases with a `.codex` folder were added.
- Run 2, after that fix (raw files `logs/plan-033-p24-2026-11-17/`): `hostlib-verify` exit 0; `typecheck` exit 0; `full-test-serial` exit 0 (312 test files passed; 7,866 passed, 225 skipped; 1,760.30 s); `addon-matrix` exit 0 (317 passed; 432.16 s).

Linux CI: not read yet for P24 (it runs after the push).

## Limits and what is not known

- Not run on a live Host: the new entry sentence, the fork running `contract-return.mjs`, the coordinator running `review-job.mjs` with the digest order. Sitting B's three findings are therefore fixed offline and NOT re-observed.
- Not run on Linux before the push: one test of the builder (exact-case containment) runs only on a case-sensitive platform and is skipped on Windows; Linux CI is its first run.
- No fault-injection test: the complete-write loop and the cleanup after a failed write are covered by source-text tests and by reading the code only; the builder's late refusal "outputs were written" has no test (the window is too short to hit without fault injection).
- The three reviews ran no test and no build; their findings were checked by the workers against the code and by tests.
- Not in P24: a return-writing script for `author-skill` (its fork built the return with a throwaway script in Sitting B and that return passed); the case folding in `check-review.mjs` on case-sensitive platforms; the same "not installed" message of the Cline and Antigravity launchers.
- The native `author-contract` entry has one character of room left (5,999 of 6,000 LF characters).

## Matrix state lines

The state lines for Shared definition/contract authoring helper, Factory orchestrator/pipeline, Factory evaluator and Claude stage quality and proof in [the completion matrix](plan-033-completion-matrix.md) now distinguish P24's offline fixes from behaviour not observed on a live Host. The remaining text of those cells is historical and unchanged.

## Open after P24

On 2026-11-17 the maintainer left the open choices of the night to the lead, in his words "decide yourself for the questions and other things as your recommended options and only wait for very critical questions". Under that delegation the lead decided, each choice his to overturn:

- One short sitting re-observes the fixes and the one headless re-run is made, both after the next slice.
- The next slice (P25) gives `author-skill` a return-writing script and makes the two factory Skills `coordinate-artifact` and `evaluate-artifact` pass the factory's own Skill check with the policy `agents-united-original`.
- The five stage limits of item 3 in the list of open decisions (the P23 addendum of the handoff) are recorded as accepted, and the figures dropped in P18 (item 4) stay dropped.

Not decided by the lead and still open: items 5 to 9 of that list, merging the pull request, and the start of the Codex stage. The list is in [the handoff](plan-033-handoff-2026-11-15.md).
