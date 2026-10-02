---
name: workflow-test
description: Run the test suites, group any failures by test file, have a specialist repair each group by finding its root cause, and re-run everything yourself. Use when a test run is red or unfamiliar, or to check coverage across several suites.
---

# Workflow: test run, repair and verification

You are the lead. You run the commands yourself with `run_commands`; repairs go to a specialist by calling `subagent_backend_architect` or `subagent_frontend_architect` (they edit files and run commands). A role name alone is not a tool, and you never reach them through `team_run_task`.

## Input

None for a plain `npm test`. Optional: a list of suite commands (at most 5, run in order), a coverage target in percent with a coverage command (default `npm run test:coverage`), the repairing specialist (backend by default), a size (default `small`) and context.

## Sizes (delegation budgets)

| Size | Repair calls | Rounds |
|---|---|---|
| `small` (default) | one call for all failures | 1 |
| `medium` | up to 3 a round | 2 |
| `large` | up to 6 a round | 3 |

## 1. Run

Run each suite command with `run_commands` and read the result: suites, failures, and, only when a coverage target is set, the coverage figure and the files below it. A green run needs no delegation at all: report it and stop.

## 2. Repair

Group the failures by test file, biggest group first. Failures share product code, so send the groups one after another, never in parallel. Brief the specialist with the failing output, the files, and these rules:

- reproduce the failure, find the root cause ("flake" is not one), and classify it: `test-bug`, `product-bug`, `environment` or `unknown`;
- fix the root cause in the right place; never skip, disable, delete or loosen a test, and never add a sleep or a retry to get green;
- for `environment` and `unknown`, change nothing and report what is wrong.

## 3. Verify

After each round, re-run every suite yourself with `run_commands`. Skip the re-run when no repair changed a file. Stop when a round leaves the same failures: that is progress you cannot make here, so report it.

## Verdict

You compute it from your own runs:

- **Green**: every suite passes and coverage, if a target was set, meets it.
- **Red**: failures remain; list them with each root-cause classification.
- **Below Target**: the tests pass but coverage is under the target; list the files. This is new work for `workflow-implement`, not a repair, so do not repair it here.
- **Unknown**: a run could not complete, or coverage could not be measured.

Report the remaining failures, the repair rounds, the coverage and the blockers in the orchestrator's Output Contract. Never commit or push. A failure classified `environment` or `unknown` is yours to report, not to hide.
