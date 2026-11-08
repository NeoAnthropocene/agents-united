---
name: 3d-asset-review
description: Review provenance, measurable GLB constraints and reproducibility.
metadata:
  author: agents-united
  version: 1.0.0
  license: MIT
---

# 3d-asset-review

## Overview & Purpose
Review provenance, measurable GLB constraints and reproducibility.

## Execution Triggers
Use only for the relevant accepted stage; ordinary static work does not trigger 3D setup.

## Input/Output Requirements
Inputs: Asset, rights evidence, budgets and actual validator report.
Output: scoped deliverables, actual evidence and unresolved items.

## Step-by-Step Runbook
1. Check required inputs, rights, authorization and existing project state.
2. Review source and dependency rights, credits and hashes. Run the installed inspect-glb helper against the asset and budgets, inspect its report, and preserve its actual diagnostics. Unknown rights remain unverified for personal-private work and block public or commercial delivery; unsupported extensions and missing measurements remain unverified.
3. Return outputs and actual checks, or precise blockers and unverified items.

## Code & Config Exemplars
Run `node <skill-root>/scripts/inspect-glb.mjs inspect --project <absolute-project-root> --asset <relative-glb> --budgets <relative-json> --out <new-relative-report.json>`. The budgets JSON has exactly `maxBytes`, `maxTriangles`, `maxTextureDimension` and `maxTextureBytes`; the output parent must exist. The pinned validator must be present in the project-local `media/3d-runtime` setup. Inspect errors, metrics and validator result; do not substitute a zero exit for human review.

## Edge Cases & Error Recovery
Missing runtime, unsupported assets, unsafe paths, rights restrictions and existing outputs stop the dependent step. Preserve user edits.

## Verification Checklist
- Separate consultation from production approval.
- Record actual commands, exits, provenance and hashes.
- Mark viewing and approval unverified until evidenced.

## References
- [Contract reference](references/contract.md)






## Supported inspection boundary

The inspector rejects extensions, sparse or interleaved accessors, deformation and unsupported texture inputs rather than treating them as valid. Texture memory reports decoded base-level RGBA estimates, not GPU allocation or mipmap memory. Validator output and budget checks do not prove visual quality, browser performance or rights.

