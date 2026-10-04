---
name: conversion-funnel-optimization
description: "Audit a conversion funnel step by step, find where and for whom people leave, grade every finding by severity with a located, concrete fix, and turn the top findings into test briefs and hand-offs."
metadata:
  author: agents-united
  version: 3.0.0
  icon: 📈
disable-slash-command: true
---

# Conversion Funnel Optimization

## Overview & Purpose
A funnel audit answers four questions in order: where do people leave, who leaves there, why, and what is the cheapest change that would keep them. Most audits skip the second question and so recommend a change that helps the average visitor who was never the problem.

This skill is the conversion specialist's method. It ends in a report, not in a redesign: Kaan finds and specifies, Jamileh designs, Deniz builds, and a finding that needs a test goes to `ab-test-setup`.

## Execution Triggers
Load it when the brief is "our funnel converts badly", a launch page underperforms, or the lead asks for a CRO audit before spending on traffic. Do not use it when there is no traffic to learn from (fewer than about 300 visitors a week to the funnel: do a heuristic review and label it as one), or when the problem is the offer, not the funnel (say so; a better button will not fix a product nobody wants).

## Input/Output Requirements
Inputs: the funnel as a list of steps with a unique visitor count for each over the same 28 days; the split of those counts by device, traffic source and new versus returning where the data allows; the URL of each step; the goal event. Ask for what is missing and list it as a gap.

Outputs (the report order of the role contract): executive summary; friction findings, each with location, the principle it breaks, severity and a concrete fix; an ICE-scored backlog; experiment briefs for the top three; and the evidence for every finding (a count, a recording, a screenshot path or a page element you read).

## Step-by-Step Runbook
1. **Draw the funnel with numbers.** For each step compute step conversion (visitors at step n over step n-1) and cumulative conversion. The leak is the largest *drop-off against the benchmark*, not the largest absolute drop-off: a 90 percent drop at the top of a content funnel is normal, a 60 percent drop between "added to cart" and "started checkout" is not.
2. **Segment the leak.** Recompute the leaking step for mobile and desktop, for each main source, and for new and returning visitors. A leak that exists on mobile only is a layout bug; one that exists for paid traffic only is a message mismatch with the ad. Write down which segment carries the loss; if the data cannot split, say it is unknown.
3. **Walk the step as the visitor.** If the `playwright` server is connected, open each step at 375 and 1280 pixels wide, follow the path, and record what you see; with `chrome-devtools-mcp` read the console and the network panel for failed requests. If no browser tool is connected, work from the page source and any screenshots the lead gives you and **say in the report that you did not run the flow**.
4. **Name the friction, one cause at a time.** Use five questions per step: is the next action obvious (clarity), how much effort does it take (fields, clicks, waits), what does the visitor fear (cost, commitment, data), is the promise of the previous step kept (relevance), and what competes for attention (distraction).
5. **Grade each finding**: S1 blocks completion for someone (broken button, a form that rejects valid input); S2 loses a segment (mobile layout, a missing payment method); S3 slows people down (extra field, unclear label); S4 polish. Fix S1 before testing anything; S1 and S2 are fixes, not experiments.
6. **Write each fix so it can be built**: the element and its location ("pricing page, plan card 2, button label"), the change, the principle it rests on, and the metric it should move.
7. **Hand off.** Copy findings to your own typed section props; layout findings to Jamileh; build and event-name needs to Deniz; page-speed and indexing findings to Selin; and the top three experiments to `ab-test-setup` for the brief. Ask Emre to verify any S1 you could not reproduce.

## Code & Config Exemplars
### Worked example
A course-signup funnel (invented numbers), 28 days: landing 18,400; pricing page 7,360 (40.0 percent); checkout started 1,470 (20.0 percent); paid 590 (40.1 percent). Cumulative landing-to-paid 3.2 percent.

Checkout-start is the leak (20.0 percent of pricing visitors against an expected 30 to 40 percent for a one-plan page; benchmark source to be named). By device: desktop 28 percent, mobile 11 percent; by source: paid social 9 percent, organic 27 percent.

Findings:
- **F1, S2, pricing page, mobile**: the plan card's button sits below a 900 px comparison table; on a 375 px screen it needs four scrolls. Evidence: recording at 375 px, screenshot `audit/pricing-375.png`. Fix: move the primary button above the table. Principle: clarity. Moves: pricing-to-checkout on mobile.
- **F2, S2, paid social**: the ad promises "free first lesson", the pricing page shows only the paid plan. Evidence: ad text from the brief against the page copy. Fix: add a free-lesson link above the plan. Principle: relevance.
- **F3, S3, checkout**: asks for a phone number with no reason given. Fix: remove it or add "for lesson reminders only" under the field. Principle: anxiety.

Backlog: F1 is a fix to ship this week (S2, trivial); F2 and F3 become tests (ICE 7.0 and 6.3); Kaan hands F1 to Jamileh and Deniz, and F2 and F3 to `ab-test-setup` with the paid-social segment as the audience.

### Anti-patterns
- Averaging across segments and recommending for the average.
- "Make the button bigger" with no location, no evidence and no metric.
- Running a test for an S1 bug.
- Quoting an industry benchmark without its source and date.
- Reporting a flow you did not walk as if you had.
- Rewriting the page when the finding is one field.

## Edge Cases & Error Recovery
- **Counts that do not reduce step to step** (a later step larger than an earlier one): the funnel is mis-instrumented or steps can be entered directly; say so and use cohort counts or the entry point you can trust.
- **No segment data**: report the aggregate leak, mark the "who" as unknown and make instrumentation by device and source the first fix for Deniz.
- **The tool cannot reach the site** (login, region, bot protection): do not work around it; report the gap and what you reviewed instead.
- **Consent banner hides the real flow**: record which choice you made while testing; do not tick tracking boxes on behalf of anyone; privacy questions go to Defne.
- **Findings contradict the data** (the page looks fine, the numbers are bad): trust the numbers, look at the step before and the traffic source.

## Verification Checklist
- [ ] Every step has a count from the same date range, with step and cumulative conversion.
- [ ] The leak is segmented, or the report says the segment is unknown.
- [ ] Every finding has a location, an evidence item, a principle, a severity and a concrete fix.
- [ ] S1 and S2 findings are labelled as fixes, not experiments.
- [ ] The report says which flows you walked, at which widths, and which you did not.
- [ ] The hand-offs name Jamileh, Deniz, Selin or Emre as needed and `ab-test-setup` for the tests.
