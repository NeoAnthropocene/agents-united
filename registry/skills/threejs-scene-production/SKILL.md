---
name: threejs-scene-production
description: Own local Three.js viewer and still work after scope acceptance.
metadata:
  author: agents-united
  version: 1.0.0
  license: MIT
---

# threejs-scene-production

## Overview & Purpose
Own local Three.js viewer and still work after scope acceptance.

## Execution Triggers
Use only for the relevant accepted stage; ordinary static work does not trigger 3D setup.

## Input/Output Requirements
Inputs: Approved request, project root, rights-reviewed GLB or original scene, runtime and output constraints.
Output: scoped deliverables, actual evidence and unresolved items.

## Step-by-Step Runbook
1. Check required inputs, rights, authorization and existing project state.
2. Check existing locks and runtime; preserve files and use local assets. Use the installed setup and render helpers for the selected project and inspect actual results. A missing helper or runtime is a prerequisite, not evidence of a viewer or render.
3. Return outputs and actual checks, or precise blockers and unverified items.

## Code & Config Exemplars
Run `node <skill-root>/scripts/setup-three.mjs --help` and `node <skill-root>/scripts/render-three.mjs --help` for the supported project-local invocation. Setup accepts an absolute project and npm CLI path. Render records actual source, parameters, runtime and frame hashes in a receipt. For an accepted Motion handoff run `node <skill-root>/scripts/shot-handoff.mjs --help`, then capture and validate against the canonical timeline and the actual receipt. A receipt is not visual or sound acceptance.

## Edge Cases & Error Recovery
Missing runtime, unsupported assets, unsafe paths, rights restrictions and existing outputs stop the dependent step. Preserve user edits.

## Verification Checklist
- Separate consultation from production approval.
- Record actual commands, exits, provenance and hashes.
- Mark viewing and approval unverified until evidenced.

## References
- [Contract reference](references/contract.md)





