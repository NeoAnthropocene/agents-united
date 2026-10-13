---
name: author-skill
description: "Use when asked to create or repair one skill draft; trigger phrases: author a skill, fix this skill, make a skill draft with quality and attribution evidence. Skip installation, publication, host-library refreshes and whole-library rewrites."
metadata:
  author: agents-united
  version: "1.0.0"
  license: MIT
---

# Author Skill

## Overview & Purpose
Produce one complete skill folder and a reviewable diff for its intended job. The output is a source draft; publication and installation require their own authorization.

## Execution Triggers
Create a new skill or repair an identified skill within the supplied scope. A repair preserves unrelated user edits, so capture the existing files before changing them.

## Input/Output Requirements
Require the job, intended user/loading role, active host/surface, target format, local/upstream intent, absolute source-checkout and draft roots, sources, constraints and evidence budget. The host binding must supply the attribution rule and required support files; missing bindings block the task.
Return the complete folder, before/after diff, final inventory/hashes, provenance disposition, commands/raw results/actual exits, quality findings, unverified items and next action using [the report](assets/report.md).

## Step-by-Step Runbook
1. Read the supplied attribution rule before source adoption or draft edits. Resolve missing required inputs with one focused question; reuse inputs already supplied.
2. Check source/output roots and capture the repair baseline with [the job contract](references/job.md). Work outside managed installs and the selected validation checkout.
3. Classify original, inspired or adapted work with [provenance](references/provenance.md). Read the actual licence and pinned source; unresolved required evidence blocks reuse.
4. Define the skill's decision-changing guidance: concrete trigger, useful output, constraints, error recovery and hand-off. Use an existing skill only as prior art; do not carry its unrelated procedures into this job.
5. Write a small entry with selective references and justified scripts. Apply already-authored scoped text using Node >=24, the selected absolute skill-root path to `scripts/draft.mjs` and an absolute job JSON; see the contract. Claude path example: `node "${CLAUDE_SKILL_DIR}/scripts/draft.mjs" <absolute-job.json>`. Each realization resolves its own root. The helper emits hashes/diff; actual validators remain separate.
6. Inspect the final files and run applicable [quality checks](references/quality.md). Report missing tools and unperformed host checks; a listing or prose instruction does not prove loading or enforcement.
7. Compare the final inventory against the baseline, check the repair scope and return the report. Local intent ends here. Upstream intent prepares the existing contribution template and evidence without sending a PR.

## Code & Config Exemplars
Read [the worked example](examples/one-draft.md) for a new draft and a repair that retains a user's notes. Choose truthful metadata for the source disposition; an original skill has no upstream source field.

## Edge Cases & Error Recovery
Stop the dependent action for missing licence/pin, false adaptation metadata, missing bindings, unavailable required validators or overlapping roots. Preserve the draft and identify the precise remedy. Do not repair unrelated files to make a gate pass.
Anti-patterns: importing every host's manual into the entry; copying an upstream source field onto original work; claiming all-host compatibility from one host; replacing a failed check with the author's own success claim.

## Verification Checklist
- Entry, support files, links and metadata concern the final version and the actual intended job.
- Appropriate compact-layout, portability, licence and frozen-corpus checks passed, or the blocked check and consequence are named.
- Baseline comparison shows only authorized edits; the final report names exact hashes and raw evidence.
- Eval fixtures remain maintainer-only; no paid run or behavioral improvement is implied by preparing them.
- Hand-off includes remaining review and binding work; no automatic install, commit, push or publication occurred.
