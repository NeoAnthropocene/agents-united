---
name: repo-doctor
description: "Use when asked whether the agents-united repository is healthy, before preparing a pull request to dev, or after a large merge; trigger phrases: repo doctor, repository health, is the repo consistent, check the repo before the PR. Reports findings with evidence and proposed fixes and changes nothing. Skip for an installed workspace (agents doctor), for one artifact (skill-check, contract-check, factory-check, bundle-check) and for fixing the findings."
metadata:
  author: agents-united
  version: "1.0.0"
  license: MIT
---

# Repo Doctor

## Overview & Purpose
Answer one question for the maintainer: is this agents-united checkout consistent? Run the fast mechanical checks, run the quick gates, read the latest slow results and judge what needs judgement. Return findings, each with evidence and a proposed fix. The doctor writes only its report; every fix goes through the normal factory route (tests first, independent review, the maintainer's word), never through this Skill.

## Execution Triggers
Run on "repo doctor", "is the repo healthy" or "check the repository before the PR"; run it by hand until the factory's automatic gate before a pull request (ADR 0080 decision 5, Plan 052 step 4) is wired. Do not run on an installed workspace: `agents doctor` checks that. Do not run to check one Skill, contract, agent or Bundle draft: the four `*-check` commands do that.

## Input/Output Requirements
Input: the absolute path of an agents-united checkout or worktree, its branch and HEAD, and whether the network may be used (`gh` for open pull requests and CI). Ask once if the path is missing; never pick a checkout yourself.
Output: the untracked, git-ignored `.repo-doctor-report.md` at the checkout root, in the outline of [the report](assets/report.md), and a short chat summary: checks run, checks skipped and why, findings with evidence and proposed fixes, and the age and commit of every slow result read.

## Step-by-Step Runbook
1. Confirm the checkout: `git -C <checkout> rev-parse --abbrev-ref HEAD` and `git -C <checkout> rev-parse --short HEAD`. Note uncommitted changes; they are part of what you check.
2. Run the fast checks: `node "${CLAUDE_SKILL_DIR}/scripts/doctor.mjs" --root <checkout> --out <checkout>/.repo-doctor-report.md` (add `--offline` without network). It prints one JSON line and exits 0 (clean), 1 (findings) or 2 (refused: not a checkout, or a report path other than a plain untracked `.repo-doctor-report.md` at the root). [The checks](references/checks.md) lists what it reads.
3. Run the quick gates that write nothing, from the checkout, and record each actual exit: `npm run hostlib:verify`, `npx tsc --noEmit` and `npx tsc --noEmit -p tsconfig.test.json`. Never run the package's `typecheck` or `build` scripts: they rebuild `dist/`. Read the build-dependent checks from CI (step 4).
4. Read, do not run, the slow results ([slow results](references/checks.md#slow-results)): the latest CI run for the branch with `gh run list --branch <branch> --limit 1 --json conclusion,headSha,createdAt`, and any full-gate log the maintainer names. Say how old each is and whether its commit is HEAD; a result for another commit proves nothing about HEAD.
5. Judge what has no script ([judgement reads](references/checks.md#judgement-reads)): terms used against `CONTEXT.md`, ADR status lines against what merged, and stale mentions of removed files in the changed files.
6. Add the gate exits, slow results and judgement findings to the report, each finding with its evidence (file and line, command and exit) and one proposed fix. Return the summary and stop.

## Code & Config Exemplars
Read [the worked example](examples/one-run.md): a run that found a README count and a broken ADR link, read a CI result for an older commit, and proposed three fixes without making any.

## Edge Cases & Error Recovery
- Exit 2 from the script: the path is not an agents-united checkout. Report it and ask for the right path.
- No `gh` or no network: run with `--offline`, list `open-pr-adr-numbers` and the CI read as skipped, and never present them as passed.
- A quick gate fails: report the command, exit and first failing lines as a finding; do not rerun it until it passes and do not fix code to make it pass.
- Anti-patterns: editing a file to clear a finding; reporting a CI result for another commit as the state of HEAD; running the hour-long full suite instead of reading its latest result; committing the report.

## Verification Checklist
- The report exists at the checkout root, is untracked and ignored, and `git status` shows no other change made by the run.
- Every check is listed as run or skipped with its reason; every gate has its actual exit.
- Every finding has evidence and one proposed fix; every slow result has its commit and age.
- No fix was applied; the hand-off names which findings the maintainer may want routed through the factory.
