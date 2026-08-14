---
name: "User Testing Script & Methodology Plan"
description: "Workflow for authoring user test plans, recruiting criteria, task scenarios, post-test questionnaires, and moderation scripts."
bundle: "product-design"
estimatedDuration: "30-50m"
---

# Workflow: User Testing Script & Methodology Plan

## Overview & Scope
The Test Plan workflow structures user research studies. It defines participant recruiting criteria, task scenario prompts, moderation scripts, and post-session metrics surveys.

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
- Interactive prototype or feature candidate
- Research goals and target questions
- User persona profiles & recruiting criteria

## Phase 1: Context & Reconnaissance
- Align research objectives with product team key questions.
- Define target participant recruiting criteria (demographics, tech familiarity, usage frequency).
- Select user testing methodology (moderated vs unmoderated usability study).

## Phase 2: Execution & Orchestration
- Draft un-biased, scenario-based user task prompts (e.g. "Find a product under $50 and add it to cart").
- Author moderator script containing introduction, warm-up questions, and probing prompts.
- Prepare post-test survey questionnaire (SUS / Single Ease Question SEQ).

## Phase 3: Verification & Closure
- Conduct pilot test run with an internal colleague to test script timing and prompt clarity.
- Refine task prompts based on pilot feedback.
- Publish finalized User Test Plan artifact.

## Phase Transition Criteria & Deterministic Verification Gates
| Transition | Prerequisites | Verification Command / Gate | Success Criteria |
|---|---|---|---|
| Phase 1 -> Phase 2 | Tool inputs verified & environment ready | `node dist/cli.js doctor` | Doctor health check succeeds with 0 errors |
| Phase 2 -> Phase 3 | Execution steps complete | `node dist/cli.js doctor` | Doctor health check confirms test plan document compliance |
| Phase 3 -> Completion | Verification complete & artifacts signed off | `npm test` | Validation test confirms task script timing parameters |

## Validation Checkpoints & Automated Rollback Protocols
- **Validation Checkpoint 1**: Task scenario prompts authored using goal-oriented, non-leading phrasing.
- **Validation Checkpoint 2**: Pilot test session completes within target 45-minute time window.
- **Automated Rollback Protocol**: Revise task scenario instructions if pilot participant misinterprets prompts.
