---
name: workflow-agency-cro-funnel-teardown
description: "Lead playbook for a funnel teardown: Ava and Kaan find where and for whom people leave, Emre walks the flow and measures it, fixes are separated from experiments, and Deniz and Jamileh build the changes before a test brief is written."
metadata:
  author: agents-united
  version: 3.0.0
  license: MIT
  icon: 🔄
---

# Workflow: Agency CRO Funnel Teardown

## Overview & Purpose
A teardown takes one funnel apart step by step with numbers: where visitors leave, who they are, why, and the cheapest change that keeps them. It ends with a short list of fixes to ship now and a few experiments to run, not with a redesign. Chris runs it with Ava (the numbers and the experiment queue), Kaan (the audit and the copy), Emre (walking the flow and the measurements), Jamileh and Deniz (changes), and Defne (consent and claims).

## Execution Triggers
Load it when conversion is the stated problem, a page underperforms, or the client asks for a CRO audit. Do not load it when traffic is under about 300 visitors a week to the funnel (do a heuristic review and say so) or when the offer is the problem (say it plainly). Do not scale acquisition into a leaking funnel.

## Input/Output Requirements
Inputs: the accepted brief, the funnel steps with 28 days of counts by device, source and new versus returning, the URLs, the goal event, the tools connected (`playwright` and `chrome-devtools-mcp` for Kaan and Emre), and who can change the pages.

Outputs: Ava's bottleneck statement and ICE backlog; Kaan's friction findings with severity, location, evidence and fix (`conversion-funnel-optimization`); Emre's walk-through report and instrumentation check; Jamileh's and Deniz's change specs or changes; experiment briefs through `ab-test-setup`; Defne's review of any new tracking, consent text or claims. **Evidence to attach**: the step counts with their date range, screenshots per viewport, the failing selectors.

## Step-by-Step Runbook
```mermaid
graph TD
    B([Accepted brief]) --> P0[Phase 0: map accepted]
    P0 --> P1[Phase 1: counts and bottleneck, Ava]
    P1 --> P2[Phase 2: audit and walk-through, Kaan and Emre]
    P2 --> P3[Phase 3: fixes built, experiments briefed]
    P3 --> G{Emre verifies fixes and events?}
    G -->|No| P3
    G -->|Yes| Done([Report and read-out date])
```

1. **Phase 0.** Consult Ava and Kaan read-only; present the delegation map.
2. **Phase 1: Ava** draws the funnel with counts, finds the leak by comparison against a sourced benchmark, and names the segment that carries it. If the data cannot split by segment, instrumentation becomes fix zero for Deniz and Emre.
3. **Phase 2: Kaan and Emre in parallel.** Kaan audits each step (clarity, effort, anxiety, relevance, distraction) and grades findings S1 to S4; Emre walks the flow at 375 and 1280 pixels, checks that the events fire and that the page has no console errors, and attaches evidence. S1 and S2 are fixes, not experiments.
4. **Phase 3.** Jamileh specs layout changes, Kaan supplies the copy as typed props, Deniz builds the fixes with test ids; Ava writes the experiment queue and Kaan the briefs with `ab-test-setup`. Defne reviews new consent text, tracking and claims before anything ships.
5. **Gate and hand-off.** Emre re-runs the walk-through and the events on the changed pages. Red goes back to the owner.
6. **Read-out.** The report names the day the first results are read and the decision rule agreed in advance.

| Transition | Prerequisites | Gate (evidence) | Success criteria |
|---|---|---|---|
| Phase 1 -> Phase 2 | Counts per step with a date range, bottleneck named | Lead checked the arithmetic of one step | Leak identified by segment, or "unknown" with a fix zero |
| Phase 2 -> Phase 3 | Findings graded with evidence | Emre's walk-through report read | Every S1 and S2 has an owner and a fix |
| Phase 3 -> Report | Fixes built, briefs written | Emre green on the changed pages; Defne cleared | Events verified; decision rule written before launch |

## Code & Config Exemplars
### Worked example
A course checkout (invented). Funnel: pricing 7,360, checkout started 1,470 (20 percent), paid 590. Mobile 11 percent, desktop 28 percent; paid social 9 percent, organic 27 percent.

```text
S1 Ava     bottleneck: pricing -> checkout on mobile paid social
S2 Kaan    findings: F1 S2 plan button below a 900 px table on mobile; F2 S2 ad promises a free lesson not shown; F3 S3 phone field with no reason
S2 Emre    walk-through at 375 px: confirms F1 (screenshot), finds the checkout error banner never clears (S1, new)
S3 Deniz   fix F1 and the S1 banner; test ids; S3 Jamileh: layout spec for F1; Kaan: copy for F2 as props
S3 Ava     experiment queue: F2 and F3 as tests; Kaan briefs with ab-test-setup (primary: pricing to checkout on mobile paid social)
S4 Emre    re-walk and events; Defne: consent text for the phone field
```
Rollback protocol: a fix that breaks a verified step is reverted by Deniz and the walk-through repeats; an experiment that harms the guardrail is stopped by the decision rule that was written before launch.

### Anti-patterns
- Averaging across segments and recommending for the average.
- Testing an S1 bug instead of fixing it.
- A redesign when the findings are small and located.
- Quoting a benchmark without its source and date.
- Reporting a flow nobody walked.
- Shipping new tracking before Defne has seen it.

## Edge Cases & Error Recovery
- **No segment data**: fix zero is instrumentation; the first read-out will be late and the report says so.
- **The site blocks automated browsing**: Emre does not work around it; the lead asks the client for an allow-list or a recording.
- **Seasonality or a campaign changes traffic mid-teardown**: use the same date range for every number and note the event.
- **The client wants a test on tiny traffic**: refuse politely, explain the sample arithmetic from `ab-test-setup`, offer qualitative research instead.
- **A fix and an experiment touch the same page**: ship the fix first, then start the experiment on the corrected baseline.

## Verification Checklist
- [ ] Every number has a date range; the leak is segmented or marked unknown.
- [ ] S1 and S2 findings are listed as fixes; experiments each have a brief with a decision rule.
- [ ] Emre's walk-through and events check are attached with screenshots and selectors.
- [ ] Defne cleared new consent text, tracking and claims before shipping.
- [ ] A rollback route exists for fixes and a stop rule for experiments.
- [ ] The report names the read-out day and the owners of open items.
