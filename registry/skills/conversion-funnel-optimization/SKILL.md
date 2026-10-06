---
name: conversion-funnel-optimization
description: "Use when a funnel converts badly, a launch page underperforms, or the lead wants a CRO audit before traffic is bought; trigger phrases: our funnel converts badly, where are people dropping off, why is checkout leaking, audit this landing page, run a CRO audit, conversion is down on mobile. Produces graded findings with a located fix, an ICE-scored backlog and test briefs. Skip it with fewer than about 300 visitors a week to the funnel (do a heuristic review and label it) and when the problem is the offer, not the funnel."
metadata:
  author: agents-united
  version: 3.0.0
  icon: 📈
disable-slash-command: true
---

# Conversion Funnel Optimization

A funnel audit answers four questions in order: where do people leave, who leaves there, why, and what is the cheapest change that keeps them. Most audits skip the second and fix the average visitor, who was never the problem.

## Overview & Purpose
Kaan finds and specifies, Jamileh designs, Deniz builds; a finding that needs a test goes to `ab-test-setup`. The output is a report, not a redesign.

## Execution Triggers
Load it when the brief is "our funnel converts badly", a launch page underperforms, or a CRO audit is wanted before buying traffic. Do not use it under about 300 visitors a week (do a heuristic review and label it) or when the problem is the offer: a better button will not fix a product nobody wants, so say so.

## Input/Output Requirements
Inputs: unique visitors per step over the same 28 days, split by device, source and new versus returning where possible; each step's URL; the goal event. Missing data is a gap.

The report always has these seven parts, in this order. A part you cannot fill says why and who can close it. Copy-ready blocks: [examples/templates.md](examples/templates.md).

| Part | Holds | Hand-off |
|---|---|---|
| 1 Summary | the leak, who carries it, the top three actions | |
| 2 Funnel | step and cumulative conversion, the segment split, a benchmark with source and date or "no benchmark" | Deniz: instrumentation gaps |
| 3 Findings | S1 to S4, location, evidence, principle, buildable fix, the metric it moves; "from the numbers, page not walked" if you read no page | layout: Jamileh; build, events: Deniz; speed, indexing: Selin; an S1 not reproduced: Emre |
| 4 Backlog | ICE-scored; S1 and S2 marked fix, the rest test | tests: `ab-test-setup` |
| 5 Briefs | the top three experiments | `ab-test-setup` |
| 6 Walked | flows and widths walked, and not walked | |
| 7 Gaps | data and access missing | an owner each |

## Step-by-Step Runbook
1. **Draw the funnel with numbers.** The leak is the biggest drop-off against a benchmark, not the biggest absolute one: 90 percent lost at the top of a content funnel is normal, 60 percent between cart and checkout is not.
2. **Segment the leak** by device, source, new versus returning: a mobile-only leak is a layout bug, a paid-only leak is a mismatch with the ad, and an average hides who leaves. Name the segment or say it is unknown.
3. **Walk each step as the visitor** at 375 and 1280 pixels (`playwright`; `chrome-devtools-mcp` for console and failed requests). With no browser tool, read source and screenshots and **say you did not run the flow**: a client acts on a flow you claim to have walked.
4. **Name one cause at a time**: clarity, effort (fields, clicks, waits), anxiety (cost, commitment, data), relevance (is the earlier promise kept), distraction.
5. **Grade each finding.** S1 blocks completion for someone, S2 loses a segment, S3 slows people down, S4 is polish. S1 and S2 are fixes, not experiments, S1 first: a test on a broken step measures the bug.
6. **Write each fix so it can be built**: element and location ("pricing page, plan card 2, button label"), the change, the principle, the metric. "Make the button bigger" can be neither built nor checked.

## Code & Config Exemplars
[examples/worked-example.md](examples/worked-example.md): a funnel, its leak, a device and source split, three graded findings.

Anti-patterns, each with its reason:
- Averaging across segments: the fix fits nobody's actual problem.
- A benchmark with no source and date: nobody can check it.
- A test for an S1 bug: it measures the bug.
- Rewriting the page for a one-field finding: the cost is out of proportion.

## Edge Cases & Error Recovery
- **Counts that do not shrink step to step**: mis-instrumented or steps entered directly; say so, use cohort counts.
- **No segment data**: report the aggregate leak, mark "who" unknown, make instrumentation by device and source Deniz's first fix.
- **Site out of reach** (login, region, bot protection): do not work around it; report the gap.
- **A consent banner hides the flow**: record your choice, tick no tracking boxes, privacy questions go to Defne.
- **Page fine, numbers bad**: trust the numbers; look at the step before and the traffic source.

## Verification Checklist
- [ ] Counts from one date range, with step and cumulative conversion; the leak is segmented or the segment is stated unknown.
- [ ] Every finding has location, evidence, principle, severity and a buildable fix; S1 and S2 are labelled fixes.
- [ ] The report says which flows were walked, at which widths, and which were not.
- [ ] Hand-offs name Jamileh, Deniz, Selin or Emre as needed, and `ab-test-setup` for tests.
