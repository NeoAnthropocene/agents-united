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

A funnel audit answers four questions in order: where do people leave, who leaves there, why, and what is the cheapest change that keeps them. Most audits skip the second and recommend a change that helps the average visitor, who was never the problem.

## Overview & Purpose
The conversion specialist's method. It ends in a report, not a redesign: Kaan finds and specifies, Jamileh designs, Deniz builds, and a finding that needs a test goes to `ab-test-setup`.

## Execution Triggers
Load it when the brief is "our funnel converts badly", a launch page underperforms, or a CRO audit is wanted before spending on traffic. Do not use it with under about 300 visitors a week to the funnel (do a heuristic review and label it) or when the problem is the offer: a better button will not fix a product nobody wants, so say so.

## Input/Output Requirements
Inputs: the funnel as steps with unique visitors per step over the same 28 days, split by device, source and new versus returning where the data allows; each step's URL; the goal event. List what is missing as a gap.

Outputs, in the role's report order: summary; findings (location, principle, severity, concrete fix); ICE-scored backlog; briefs for the top three. Shapes: [examples/templates.md](examples/templates.md). **Evidence to attach** per finding: a count, recording, screenshot path or page element you read.

## Step-by-Step Runbook
1. **Draw the funnel with numbers.** Per step: step conversion (visitors at n over n-1) and cumulative conversion. The leak is the largest drop-off *against the benchmark*, not the largest absolute one: losing 90 percent at the top of a content funnel is normal, 60 percent between "added to cart" and "started checkout" is not.
2. **Segment the leak** by device, main source and new versus returning. A mobile-only leak is a layout bug, a paid-only leak is a mismatch with the ad. Name the segment that carries the loss or say it is unknown: an average hides who is leaving.
3. **Walk the step as the visitor.** With `playwright` connected, open each step at 375 and 1280 pixels and record what you see; with `chrome-devtools-mcp` read the console and failed requests. Without a browser tool, work from page source and screenshots and **say that you did not run the flow**.
4. **Name one cause at a time** with five questions per step: is the next action obvious (clarity), how much effort does it take (fields, clicks, waits), what does the visitor fear (cost, commitment, data: anxiety), is the earlier promise kept (relevance), what competes for attention (distraction).
5. **Grade each finding.** S1 blocks completion for someone (broken button, form rejecting valid input); S2 loses a segment (mobile layout, missing payment method); S3 slows people down (extra field, unclear label); S4 is polish. S1 and S2 are fixes, not experiments, and S1 comes before any test: a test on a broken step measures the bug.
6. **Write each fix so it can be built**: the element and its location ("pricing page, plan card 2, button label"), the change, the principle it rests on, the metric it should move.
7. **Hand off.** Copy findings to your own typed section props; layout to Jamileh; build and event names to Deniz; page speed and indexing to Selin; tests to `ab-test-setup`. Emre verifies any S1 you could not reproduce.

## Code & Config Exemplars
Load [examples/worked-example.md](examples/worked-example.md) for a funnel, its leak, a split by device and source, and three graded findings to compare yours against.

Anti-patterns, each with its reason:
- Averaging across segments: the recommendation fits nobody's actual problem.
- "Make the button bigger" with no location, evidence or metric: nobody can build it or tell if it worked.
- A test for an S1 bug: it measures the bug.
- An industry benchmark with no source and date: nobody can check it.
- Reporting a flow you did not walk: the client acts on a false claim.
- Rewriting the page when the finding is one field: the cost is out of proportion.

## Edge Cases & Error Recovery
- **Counts that do not shrink step to step**: mis-instrumented, or steps can be entered directly; say so and use cohort counts or the entry point you can trust.
- **No segment data**: report the aggregate leak, mark the "who" unknown, make instrumentation by device and source Deniz's first fix.
- **The site is out of reach** (login, region, bot protection): do not work around it; report the gap.
- **A consent banner hides the flow**: record your choice; tick no tracking boxes for anyone; privacy questions go to Defne.
- **The page looks fine, the numbers are bad**: trust the numbers; look at the step before and the traffic source.

## Verification Checklist
- [ ] Every step has a count from the same date range, with step and cumulative conversion.
- [ ] The leak is segmented, or the report says the segment is unknown.
- [ ] Every finding has a location, evidence, a principle, a severity and a concrete fix.
- [ ] S1 and S2 findings are labelled fixes, not experiments.
- [ ] The report says which flows you walked, at which widths, and which you did not.
- [ ] Hand-offs name Jamileh, Deniz, Selin or Emre as needed, and `ab-test-setup` for tests.
