---
name: workflow-implement
description: Implement an ordered list of slices test-first through the backend and frontend specialists, review each against its spec, fix within a cap, then run the checks yourself and review the whole change. Use for a change with three or more separable slices, after the plan is agreed.
---

# Workflow: subagent-driven implementation

You are the lead. Delegate each slice by calling a specialist tool: `subagent_backend_architect` or `subagent_frontend_architect` to implement (they edit files and run commands), and `subagent_code_reviewer` to review (read-only, no shell). A role name alone is not a tool, and you never reach them through `team_run_task`.

## Input

An ordered list of tasks you write after reading the plan: a title, a self-contained spec that can be tested, the specialist (backend by default) and the files it may touch. Optional: a size (default `small`), the typecheck and test commands (default `npm run typecheck` and `npm test`) and context. If a spec is not testable, fix it with the user first.

## Sizes (delegation budgets)

| Size | Tasks | Calls | Review and fix |
|---|---|---|---|
| `small` (default) | at most 2 | 4 | no per-task review |
| `medium` | at most 4 | 9 | one fix round |
| `large` | at most 8 | 23 | two fix rounds |

An optional review or fix runs only if the budget has room after the implementers still to come and the closing checks. Tasks beyond the size are not run, and the verdict says so.

## Per task, one after another

Tasks share one working tree and a later task builds on an earlier one, so run them in order, one after another. Never start two writers at once.

1. **Implement.** Brief the specialist with the objective, the files it owns and must not touch, the earlier tasks' results as fixed inputs, and the acceptance evidence: a failing test first, then the minimal code, with the red and green output in its report. If it reports blocked (a spec that contradicts the context), stop that task and mark it blocked; do not guess for it.
2. **Review** (when the size allows). Call `subagent_code_reviewer` with the spec and the changed files and ask it to check the code against the spec, not against the implementer's report.
3. **Fix** (within the cap). Send blocking findings back to the same specialist with the finding text. Stop early when a round leaves the same blocking issues, and leave the task open.

## Close the run

1. Run the checks yourself with `run_commands`: the typecheck, then the tests, and `git status`. The implementer's claim is not evidence.
2. Call `subagent_code_reviewer` once on the whole change.

## Verdict

You compute it:

- **Blocked**: an implementer could not proceed.
- **Incomplete**: the size left tasks unrun.
- **Needs Work**: a task is open, a check is red, or the final review has blocking findings.
- **Ready**: every task is done, the checks pass and the final review has no blocking finding.

Report the status of every task, the check output and the final review in the orchestrator's Output Contract. Never commit or push: check `git branch --show-current`, review the diff, and let the user decide.
