---
name: workflow-recommend
description: Workflow for synthesizing complex architectural and business
  trade-offs into formal executive recommendation proposals. Use when executing
  technical & strategic recommendation synthesis workflows, phase transitions,
  and verification gates.
metadata:
  author: Agents United
  version: 1.0.0
  source: https://github.com/NeoAnthropocene/agents-united
  license: MIT
  icon: 🔄
---

# Workflow: Technical & Strategic Recommendation Synthesis

## Overview & Scope
The Recommend workflow synthesizes technical, business, and operational analysis into formal executive recommendations. It presents clear option comparisons, risk trade-offs, and decisive action plans.

## Execution Flowchart
```mermaid
graph TD
    Start([Start Workflow]) --> P1[Phase 1: Context & Reconnaissance]
    P1 --> InputCheck{"Prerequisites & Tools Valid?"}
    InputCheck -->|No| Abort1[Abort & Request Inputs]
    InputCheck -->|Yes| P2[Phase 2: Execution & Orchestration]
    P2 --> Gate1{"Verification Gate: Automated Checks Pass?"}
    Gate1 -->|Fail| Rollback[Execute Automated Rollback Protocol]
    Rollback --> P2
    Gate1 -->|Pass| P3[Phase 3: Verification & Closure]
    P3 --> Gate2{"Final Acceptance Gate Passed?"}
    Gate2 -->|Fail| P3Fix[Remediate Documentation / Artifacts]
    P3Fix --> P3
    Gate2 -->|Pass| Done([Workflow Complete & Logged])
```

## Required Tool Inputs & Context
- Technical architecture plans & business evaluation reports
- Option trade-off comparison matrix
- Executive recommendation proposal template

## Phase 1: Context & Reconnaissance
- Gather findings from technical research, architecture planning, and business evaluation panels.
- Identify key decision options requiring executive alignment.
- Define evaluation metrics (Cost, Time-to-market, Scalability, Risk).

## Phase 2: Execution & Orchestration
- Construct Option Comparison Matrix scoring each alternative across evaluation metrics.
- Synthesize clear Primary Recommendation with explicit supporting rationale.
- Detail implementation plan, resource requirements, and risk mitigation strategies.

## Phase 3: Verification & Closure
- Review recommendation document for executive clarity and brevity.
- Verify all claims are backed by documented technical or business evidence.
- Publish Executive Recommendation Proposal.

## Phase Transition Criteria & Deterministic Verification Gates
| Transition | Prerequisites | Verification Command / Gate | Success Criteria |
|---|---|---|---|
| Phase 1 -> Phase 2 | Tool inputs verified & environment ready | `npx agents-united doctor` | Doctor health check succeeds with 0 errors |
| Phase 2 -> Phase 3 | Execution steps complete | `npx agents-united doctor` | Doctor health check validates recommendation proposal schema |
| Phase 3 -> Completion | Verification complete & artifacts signed off | `npm run build --if-present` | Project build passes cleanly during proposal publication |

## Validation Checkpoints & Automated Rollback Protocols
- **Validation Checkpoint 1**: Primary recommendation explicitly supported by option comparison matrix.
- **Validation Checkpoint 2**: Risk mitigation plan included for recommended path.
- **Automated Rollback Protocol**: Revise recommendation proposal if executive review identifies unaddressed trade-offs.
