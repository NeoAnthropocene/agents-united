---
name: "Agency Multi-Channel Ad Creative Sprint"
description: "Rapid multi-variant ad copywriting, banner layout generation, and A/B test matrix construction across Meta, Google, and LinkedIn."
bundle: "digital-agency"
estimatedDuration: "45-90m"
---

# Workflow: Agency Multi-Channel Ad Creative Sprint

## Overview & Scope
Coordinates rapid ad creative authoring, visual layout composition, and copy variant generation across paid social and search channels.

## Execution Flowchart
```mermaid
graph TD
    Start([Brief Intake]) --> P1[Phase 1: Angle & Hook Formulation]
    P1 --> P2[Phase 2: Copywriting & Aspect Ratio Layouts]
    P2 --> Gate1{"Visual Quality & Token Conformance?"}
    Gate1 -->|Fail| P2
    Gate1 -->|Pass| P3[Phase 3: Creative Matrix Review & Export]
    P3 --> Done([Sprint Complete])
```

## Required Tool Inputs & Context
- Target ICP pain points & value propositions
- Aspect ratio specifications (1:1, 9:16, 16:9, 1.91:1)
- MCP Stitch / Figma integration or native image assets

## Phase 1: Context & Hooks
- Determine 3 core angles (Pain-led, Feature-led, Social Proof-led).
- Structure hook variations for each angle.

## Phase 2: Copy & Creative Generation
- Write primary text, headlines (under 40 chars), and CTA button copy.
- Generate asset layouts adhering to brand color tokens.

## Phase 3: Verification & Export
- Validate visual hierarchy, legibility on mobile, and ad network policy compliance.
- Export ready-to-launch creative matrix in markdown/JSON.

## Phase Transition Criteria & Deterministic Verification Gates
| Transition | Prerequisites | Verification Command / Gate | Success Criteria |
|---|---|---|---|
| Phase 1 -> Phase 2 | Angles formulated | `node dist/cli.js doctor` | Doctor health check succeeds with 0 errors |
| Phase 2 -> Phase 3 | Layouts generated | `npm test` | Format and dimension checks pass 100% |
| Phase 3 -> Completion | Final matrix reviewed | `npm run build` | All assets formatted and validated |

## Validation Checkpoints & Automated Rollback Protocols
- **Validation Checkpoint 1**: Ad copy conforms to advertising platform compliance guidelines.
- **Automated Rollback Protocol**: Re-generate copy variants if headline exceeds character constraints.
