---
name: author-rule
description: "Use when asked to create or repair one rule for the registry; trigger phrases: author a rule, write a rule for a bundle, fix this rule draft, add a rule to the agent-factory bundle. Skip skills, workflows, hooks, agents, installation, publication and Antigravity delivery."
context: fork
agent: general-purpose
background: false
metadata:
  author: agents-united
  version: "1.0.0"
  license: MIT
---

# Author Rule

## Overview & Purpose
Produce one canonical rule, `registry/rules/<name>.md`, and its file name in one bundle's `rules[]`, as a reviewable diff in the contributor's branch. Passing `rule-check` means only that the deterministic checks passed; whether the rule is good, and whether Claude follows it, stay unverified.

## Execution Triggers
Create a new rule or repair a named one within the supplied scope; a repair keeps unrelated lines, so capture the file's bytes first. A rule is always-on context loaded at launch. A procedure that matters for some tasks belongs in a skill and a guarantee in a hook; say so and stop rather than writing a rule for either.

## Input/Output Requirements
The invocation text is the brief for one rule, or the absolute path of a text file holding it; write only to the rule file and the bundle manifest of the checkout it names, and save the helper job, stdout, stderr and exit code beside your report. With no brief, or a path that does not exist, stop with a blocked note naming it. This built-in general-purpose fork receives no prior conversation history; carry every required input in the task. Require the rule's purpose (the behaviour it must change, concrete enough to verify), its name (kebab-case, no `.md`), the target bundle key, local or upstream intent, the absolute source checkout (the contributor's feature branch, never `main` or `dev`), sources and constraints. The host binding must supply the attribution rule; a missing binding blocks the task. With no brief, stop with a blocked note naming what is missing.
Return the rule path and hash, the bundle diff, the raw `rule-check` JSON with its actual exit, provenance, unverified items and next action using [the report](assets/report.md).

## Step-by-Step Runbook
1. Read [the installed attribution rule](references/skill-attribution.md) before adopting a source or writing text. Resolve missing inputs with one focused question; reuse inputs already supplied.
2. Check the checkout with [the job contract](references/job.md): a branch that is not protected, the name free in `registry/rules/`, the bundle present. Capture the baseline for a repair.
3. Classify original, inspired or adapted text with [provenance](references/provenance.md). Unresolved required evidence blocks reuse.
4. Write the rule: a title, then short instructions the model can verify, one topic, no front matter and no managed marker. Follow the budget and rendering limits in [quality](references/quality.md); a rule over the Claude budget is skipped by the installer.
5. To create, apply the text with Node >=24: `node "${CLAUDE_SKILL_DIR}/scripts/draft.mjs" <absolute-job.json>`. It writes the rule and the bundle entry, refuses collisions and host entry-point names, prints hashes and runs no validator. To repair, edit the existing file in place; the helper refuses a file that exists.
6. Run the checker on the written file from the checkout and keep its raw JSON and exit: the checkout's built CLI (the `cli.js` file in its `dist` folder) run with Node: `rule-check --artifact <absolute rule path>`. Fix each finding by editing the rule file in place and run the checker again. Report an unbuilt or missing checker as blocked.
7. Compare the final inventory with the baseline and return the report. Local intent ends here. Upstream intent only prepares the pinned `.github/PULL_REQUEST_TEMPLATE/artifact-contribution.md`, base `dev`, `sent: false`, following `docs/artifact-contribution.md`; no commit, push, pull request or publication follows.

## Code & Config Exemplars
Read [the worked example](examples/one-draft.md) for a new rule and a repair that fixes a failed check. The route covers Claude and Cline delivery only: Antigravity needs front matter with a trigger and a native rule, which this route does not write.

## Edge Cases & Error Recovery
Stop the dependent action for a name collision, an entry-point name, a bundle that already lists the file, a `bundles.json` the helper cannot write back unchanged, a missing attribution binding or an unavailable checker. Preserve the draft and name the remedy. Do not edit other files to make a check pass.
Anti-patterns: a rule that restates a procedure or a hook; vague instructions such as "write good code"; front matter copied from another host; a heading naming another host's routing, which the Claude rendering drops; replacing a failed check with the author's own success claim.

## Verification Checklist
- The rule file, the bundle entry and the report concern the final text, and only those two files changed.
- `rule-check` ran on the written file: raw JSON and actual exit are in the report, and a failure is named, not summarized.
- The report keeps `quality: pending` and `live: unverified`, says Antigravity is not covered and names who reviews next.
- Provenance matches the supplied attribution rule; no source field is copied onto original text.
- Hand-off names the remaining review and binding work; no install, commit, push or publication occurred.
