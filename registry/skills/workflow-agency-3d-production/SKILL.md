---
name: workflow-agency-3d-production
description: Coordinate consultation, accepted production, review and handback.
metadata:
  author: agents-united
  version: 1.0.0
  license: MIT
---

# workflow-agency-3d-production

## Overview & Purpose
Coordinate consultation, accepted production, review and handback.

## Execution Triggers
Use only for the relevant accepted stage; ordinary static work does not trigger 3D setup.

## Input/Output Requirements
Inputs: Accepted brief, chosen route, rights and target evidence.
Output: scoped deliverables, actual evidence and unresolved items.

## Step-by-Step Runbook
1. Check required inputs, rights, authorization and existing project state.
2. Consult first; when motion is in scope proactively offer narration, sound effects and music (including silence); invoke direction, production, review and audiovisual Skills via the actual host. Keep specialist ownership and route questions through the lead when present.
3. Return outputs and actual checks, or precise blockers and unverified items.

## Code & Config Exemplars
See the [contract reference](references/contract.md) and the relevant production Skill for supported helper commands.

## Edge Cases & Error Recovery
Missing runtime, unsupported assets, unsafe paths, rights restrictions and existing outputs stop the dependent step. Preserve user edits.

## Verification Checklist
- Separate consultation from production approval.
- Record actual commands, exits, provenance and hashes.
- Mark viewing and approval unverified until evidenced.

## References
- [Contract reference](references/contract.md)






## Phase 1: Consultation

Identify the request, rights, budgets and destination. Transition only when the brief and route are accepted; otherwise return include/defer/decline without writing deliverables.

## Phase 2: Production

Use the installed project and scene Skills to preserve source and build the approved local viewer and still. Missing runtime or unsupported assets stop the dependent step.

## Phase 3: Verification and handoff

Validate the GLB and provenance, inspect actual output and report unverified viewing or rights. For Motion bind the current timeline fingerprint and scene/output hashes; changed inputs require reproof. The verification gate requires actual results, not helper availability.

Recovery: preserve original and user-edited files and report the exact blocker; do not overwrite or fabricate proof. See [the worked example](examples/worked-example.md) using the installed Skill root.
