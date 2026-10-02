---
name: workflow-review
description: Review a large change across independent dimensions with several read-only reviewers, try to refute every finding, and return a ranked verdict. Use for a review of about eight or more changed files, or a pull request too large for one reviewer.
---

# Workflow: multi-reviewer code review

You are the lead. Run this review by calling the specialist tool `subagent_code_reviewer`; a role name alone is not a tool, and you never reach the reviewer through `team_run_task`. The reviewer is read-only (the host enforces it) and has no shell, so you gather the change set and hand it over.

## Input

The files to review, from the user or from you: scout with `git diff --name-only` (and `git diff` for the text) through `run_commands`. Optional: a size (default `small`) and a line of context on what changed and why. If no file list can be found, ask the user and stop.

## Sizes (delegation budgets)

| Size | Reviewers | Verification | Budget |
|---|---|---|---|
| `small` (default) | 2: security and correctness; design, performance and tests | one batch brief for all findings, up to 12 | 3 calls |
| `medium` | 3: security; correctness; design, performance and tests | one call per finding, up to 6 | 9 calls |
| `large` | 5: security; correctness; design; performance; tests | two calls per finding, up to 9 | 23 calls |

What a budget leaves out is reported as unverified, never dropped.

## 1. Find

Call `subagent_code_reviewer` once per dimension, all in the same turn so they run together. Each brief is self-contained: the dimension, the file list and diff, the context, and the instruction to report only real problems with file, line, a direct snippet, the risk and one remediation, to file anything uncertain as INFO, and to change nothing. The reviewer holds read, search and web tools only.

Then merge the reports yourself. Treat two findings with the same file, line and title as one, keep the higher severity, and note every dimension that raised it. Sort by severity (CRITICAL, HIGH, MEDIUM, LOW, INFO), then file and line, and give each an id (F1, F2, ...). A reviewer call that failed or returned nothing means that dimension is not covered: say so.

## 2. Verify

A finding that looks real can still be wrong, so try to refute each one before reporting it. Call `subagent_code_reviewer` again, again in the same turn, with a skeptic brief: the finding, the file, and the question "try to show this is not a real problem; answer refuted or confirmed with a reason". For `small` send all findings in one brief and ask for one verdict per id. For two votes (`large`), a tie keeps the finding marked contested.

Skip verification for INFO findings. Run the checks only the reviewer cannot, yourself, through `run_commands` (a typecheck, a test), when a finding depends on them.

## 3. Verdict

You compute the verdict from the evidence, not from a reviewer's summary:

- **Request Changes**: at least one confirmed CRITICAL or HIGH finding.
- **Comment**: no confirmed CRITICAL or HIGH, but confirmed MEDIUM, LOW or INFO findings, or a dimension or finding left unverified.
- **Approve**: nothing confirmed and nothing left unverified.

Report in the Output Contract of the orchestrator: the verdict, the confirmed findings ranked by severity with file and line, the findings you could not verify, and the ones skeptics refuted with their reason. Do not paste the reviewers' reports. This workflow never edits files, commits or pushes.
