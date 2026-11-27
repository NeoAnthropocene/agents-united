---
name: author-workflow
description: "Use when asked to create or repair one native Claude workflow for an existing Skill; trigger phrases: author a workflow, write a native workflow script, fix this workflow draft, add a workflow for a skill. Skip skills, rules, hooks, agents, bundles, installation, publication, and Antigravity and Cline workflows."
metadata:
  author: agents-united
  version: "1.0.0"
  license: MIT
---

# Author Workflow

## Overview & Purpose
Produce one native Claude workflow script, `registry/hosts/claude/workflows/<name>.js`, for the portable Skill of the same name, as a reviewable diff in the contributor's branch. Passing `workflow-check` means only that the deterministic checks passed; whether the script is good, and whether Claude runs it as intended, stay unverified.

## Execution Triggers
Create a new workflow for a Skill that already exists, or repair a named one within the supplied scope; a repair keeps unrelated lines, so capture the file's bytes first. A workflow is a script the host runs on demand, installed only in place of the Skill of the same name. A missing Skill belongs to `author-skill` and a Bundle change to the Skill's own route; say so and stop.

## Input/Output Requirements
Require the workflow's purpose (the multi-agent job the script runs, concrete enough to verify), its name (kebab-case, no `.js`, the folder name of an existing Skill), local or upstream intent, the absolute source checkout (the contributor's feature branch, never `main` or `dev`), the agent roles it may request, sources and constraints. The host binding must supply the attribution rule; a missing binding blocks the task. With no brief, stop with a blocked note naming what is missing.
Return the workflow path and hash, the raw `workflow-check` JSON with its actual exit, every unresolved agent type, provenance, unverified items and next action using [the report](assets/report.md).

## Step-by-Step Runbook
1. Read the supplied attribution rule before adopting a source or writing text. Resolve missing inputs with one focused question; reuse inputs already supplied.
2. Check the checkout with [the job contract](references/job.md): a branch that is not protected. Create mode: the name is free in `registry/hosts/claude/workflows/` and the paired Skill `registry/skills/<name>/SKILL.md` exists; when it does not, stop and tell the user to author the Skill first through `author-skill`. Repair mode: the workflow exists; capture its bytes and hash as the baseline.
3. Classify original, inspired or adapted text with [provenance](references/provenance.md). Unresolved required evidence blocks reuse.
4. Write the script: `export const meta` first as a pure literal named like the file, phase titles that match the body, no module loading, no call that breaks resume, `agentType` only for native Claude roles. Follow [quality](references/quality.md).
5. Create mode: apply the text with Node >=24: `node "${CLAUDE_SKILL_DIR}/scripts/draft.mjs" <absolute-job.json>`. It writes only the script, refuses collisions and a missing paired Skill, prints hashes and runs no validator. Repair mode: do not run the helper, which refuses a file that exists; edit the script in place.
6. Run the checker on the written file from the checkout and keep its raw JSON and exit: the checkout's built CLI (the `cli.js` file in its `dist` folder) run with Node: `workflow-check --artifact <absolute workflow path>`. Fix each finding by editing the script in place and run the checker again. Report every `unresolvedAgentTypes` entry to the user as not verified. Report an unbuilt or missing checker as blocked.
7. Compare the final inventory with the baseline and return the report. Local intent ends here. Upstream intent only prepares the pinned `.github/PULL_REQUEST_TEMPLATE/artifact-contribution.md`, base `dev`, `sent: false`, following `docs/artifact-contribution.md`; no commit, push, pull request or publication follows.

## Code & Config Exemplars
Read [the worked example](examples/one-draft.md) for a new workflow and a repair that fixes a failed check. The route covers native Claude workflows only: Cline `.md` workflows and Antigravity delivery are not covered.

## Edge Cases & Error Recovery
Stop the dependent action, when creating, for a name collision or a missing paired Skill; stop in either mode for a link or junction in the checkout path or the registry folders, a missing attribution binding or an unavailable checker. Preserve the draft and name the remedy. Do not edit other files to make a check pass; the Skill's Bundle membership is not changed here.
Anti-patterns: a script that loads modules or breaks resume; an `agentType` with no native role; a `meta.name` that differs from the file name; an unresolved request reported as verified; replacing a failed check with the author's own success claim.

## Verification Checklist
- The script and the report concern the final text, and only that one file changed.
- `workflow-check` ran on the written file: raw JSON and actual exit are in the report, and a failure is named, not summarized.
- Every `unresolvedAgentTypes` entry is listed as not verified.
- The report keeps `quality: pending` and `live: unverified`, says Antigravity and Cline are not covered and names who reviews next.
- Provenance matches the supplied attribution rule.
- Hand-off names the remaining review and binding work; no install, commit, push or publication occurred.
