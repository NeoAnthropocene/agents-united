---
name: diagnosing-bugs
description: Evidence-based bug diagnosis and root-cause analysis workflow to isolate defect origins without blind guesswork.
metadata:
  author: "Matt Pocock (mattpocock/skills)"
  version: "1.0.0"
  source: "https://github.com/mattpocock/skills"
---

# Evidence-Driven Bug Diagnosis

## Overview & Purpose
`diagnosing-bugs` provides a step-by-step diagnostic workflow for isolating runtime failures, unexpected behaviors, and regressions by gathering empirical evidence before attempting fixes.

## Input & Output Requirements
### Inputs
| Parameter | Type | Required | Description |
|---|---|---|---|
| `error_log` | String / Path | Yes | Error log, stack trace, or bug report snippet |

### Outputs
| Artifact | Path / Format | Description |
|---|---|---|
| Diagnosis Report | Inline / Log | Isolated root cause evidence and targeted fix plan |

## Step-by-Step Execution Runbook

### Phase 1 — Evidence Gathering
1. Extract exact error messages, stack traces, line numbers, and runtime environments.
2. Read the full un-truncated source code around the reported crash site.

### Phase 2 — Reproduction & Hypothesis Testing
1. Create a minimal automated reproduction test case.
2. Formulate 2–3 candidate hypotheses and test them systematically.
3. Confirm exact conditions required to trigger the bug.

### Phase 3 — Root Cause Summary
1. Document the exact mechanism causing the failure.
2. Hand off verified root cause to implementation/fix workflow.

## Verification & Validation Checklist
- [ ] Frontmatter contains author attribution to Matt Pocock.
- [ ] Diagnosis is backed by empirical stack trace or log evidence.
