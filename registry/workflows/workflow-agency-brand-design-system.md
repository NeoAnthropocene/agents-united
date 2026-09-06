---
name: "Agency Brand Design System & Component Library"
description: "Tokenized design system architecture, Figma token sync, Tailwind color palettes, and Storybook interactive component playground setup."
bundle: "digital-agency"
estimatedDuration: "60-120m"
---

# Workflow: Agency Brand Design System & Component Library

## Overview & Scope
Builds scalable, production-grade design systems with design tokens, typography ramps, UI component contracts, and Storybook interactive playgrounds.

## Execution Flowchart
```mermaid
graph TD
    Start([Brand Guidelines]) --> P1[Phase 1: Token Architecture & Ramp Extraction]
    P1 --> P2[Phase 2: Component Library & Spec Construction]
    P2 --> Gate1{"Tokens & WCAG AA Verified?"}
    Gate1 -->|Fail| P2
    Gate1 -->|Pass| P3[Phase 3: Storybook & Documentation Export]
    P3 --> Done([Design System Shipped])
```

## Required Tool Inputs & Context
- Brand guidelines, logo marks, and primary/secondary colors
- Figma MCP / Stitch MCP / local CSS token definitions
- Storybook / component playground configs

## Phase 0: Planning Council (ADR 0014)
- Grill ambiguous briefs with the user (`/grill-me` or `/grill-with-docs`), then spawn up to 2 planning sidekicks.
- Collect a Scope-of-Work Statement (≤150 words) from every relevant specialist; peer exchanges capped at 2 per pair; max 2 planning rounds.
- Synthesize the Delegation Map (task → specialist, using the spawnable `subagent_*` tools declared in the Team Manifest) and present it to the user before Phase 1.
- Transition criteria: Delegation Map approved by user. Deterministic phase gate: specialist roster resolves against the Team Manifest (`.agents/plugins/digital-agency/agents-united/teams/digital-agency.yaml`).

## Phase 1: Token Architecture
- Define semantic tokens (colors, spacing, radii, typography ramps, shadows).
- Establish light/dark mode color pairings.

## Phase 2: Component Specifications
- Build core component contracts (Button, Input, Card, Modal, Nav).
- Ensure WCAG 2.2 AA accessibility and focus states.

## Phase 3: Verification & Storybook Integration
- Spin up component sandbox via `manage_task` or static build.
- Export token documentation and Tailwind CSS preset.

## Phase Transition Criteria & Deterministic Verification Gates
| Transition | Prerequisites | Verification Command / Gate | Success Criteria |
|---|---|---|---|
| Phase 1 -> Phase 2 | Tokens declared | `node dist/cli.js doctor` | Doctor health check succeeds with 0 errors |
| Phase 2 -> Phase 3 | Components implemented | `npm run typecheck` | TypeScript component interfaces compile cleanly |
| Phase 3 -> Completion | Visual contracts verified | `npm run build` | Storybook / component assets build without errors |

## Validation Checkpoints & Automated Rollback Protocols
- **Validation Checkpoint 1**: All color contrast ratios meet or exceed 4.5:1 for normal text.
- **Automated Rollback Protocol**: Adjust hue and luminosity values if contrast checker fails.
