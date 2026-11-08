---
name: 3d-design-direction
description: Translate an accepted brief into bounded 3D direction.
metadata:
  author: agents-united
  version: 1.0.0
  license: MIT
---

# 3d-design-direction

## Overview & Purpose
Translate an accepted brief into bounded 3D direction.

## Execution Triggers
Use only for the relevant accepted stage; ordinary static work does not trigger 3D setup.

## Input/Output Requirements
Inputs: Destination, references and rights, target, accessibility, budget and renderer.
Output: scoped deliverables, actual evidence and unresolved items.

## Step-by-Step Runbook
1. Check required inputs, rights, authorization and existing project state.
2. Recommend include/defer/decline; specify object, camera, material, light, fallback and signature-frame proof. For accepted work use scripts/project-3d.mjs init --project ABS --input REL to initialize only the selected project, then validate --project ABS and ledger --project ABS. Use --delivery true when checking delivery readiness. Preserve existing files and inspect the command output.
3. Return outputs and actual checks, or precise blockers and unverified items.

## Code & Config Exemplars
Run `node <skill-root>/scripts/project-3d.mjs validate --project <absolute-project-root> --delivery true` against an existing approved project; inspect its actual result.

## Edge Cases & Error Recovery
Missing runtime, unsupported assets, unsafe paths, rights restrictions and existing outputs stop the dependent step. Preserve user edits.

## Verification Checklist
- Separate consultation from production approval.
- Record actual commands, exits, provenance and hashes.
- Mark viewing and approval unverified until evidenced.

## References
- [Contract reference](references/contract.md)




