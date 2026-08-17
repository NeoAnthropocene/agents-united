---
name: "Paid Campaign Architecture & Launch Workflow"
description: "PPC campaign setup, ad copy testing, conversion tracking pixel verification, and launch budgeting."
bundle: "performance-paid-acquisition"
estimatedDuration: "45-90m"
---

# Workflow: Paid Campaign Architecture & Launch

## Overview & Scope
This workflow orchestrates paid acquisition campaigns across Google Search, Meta Ads, and LinkedIn, ensuring proper conversion tracking, negative keyword lists, and creative variant testing.

## Execution Flowchart
```mermaid
graph TD
    Start([Start Campaign Launch]) --> P1[Phase 1: Conversion Tracking & Pixel Audit]
    P1 --> InputCheck{"Pixels, CAPI & UTM Parameters Configured?"}
    InputCheck -->|No| Abort1[Abort & Configure Conversion Tracking]
    InputCheck -->|Yes| P2[Phase 2: Ad Copy, Creative & Keyword Assembly]
    P2 --> Gate1{"Verification Gate: Negative Lists & Creative Sizing Valid?"}
    Gate1 -->|Fail| P2Fix[Update Keyword Match Types & Asset Sizes]
    P2Fix --> P2
    Gate1 -->|Pass| P3[Phase 3: Campaign Publishing & Real-Time Monitoring]
    P3 --> Gate2{"Health Gate: CTR >= Baseline & Zero Tracking Errors?"}
    Gate2 -->|Fail| P3Tune[Adjust Initial Bid Caps / Ad Copy Variants]
    P3Tune --> P3
    Gate2 -->|Pass| Done([Campaign Live & Tracking])
```

## Phase 1: Conversion Tracking & Pixel Audit
- Verify Google Tag Manager / Meta Pixel / LinkedIn Insight Tag firing on conversion events.
- Test server-side Conversions API (CAPI) deduplication.

## Phase 2: Ad Copy, Creative & Keyword Assembly
- Group keywords into tightly themed ad sets and apply universal negative keyword lists.
- Stage 3-5 creative hook variants and responsive ad copy variations.

## Phase 3: Campaign Publishing & Real-Time Monitoring
- Publish campaigns with initial learning phase budget caps.
- Monitor search term reports for irrelevant query leakage and add negative keywords.

## Phase Transition Criteria & Deterministic Verification Gates
| Transition | Prerequisites | Verification Command / Gate | Success Criteria |
|---|---|---|---|
| Phase 1 -> Phase 2 | Tracking active | `node dist/cli.js doctor` | Conversion pixels and test events verified |
| Phase 2 -> Phase 3 | Assets assembled | `npm test` | All creative dimensions and copy lengths valid |
| Phase 3 -> Completion | Campaigns live | `node dist/cli.js doctor` | Impressions recording with verified attribution |
