---
name: growth-experiment-design
description: "Use when a funnel number is bad and nobody knows what to test, or the brief asks for a growth plan, an experiment backlog or a ranked test list; trigger phrases: what should we test first, build us an experiment backlog, where is the funnel leaking, activation is low, we need a growth plan, the last test was inconclusive. Produces a bottleneck statement, an ICE-ranked backlog, briefs for the top three and an experiment log. Skip it for a one-off copy tweak with no measurable outcome (hand it to Kaan as a finding) and for sizing a single test (use ab-test-setup)."
metadata:
  author: agents-united
  version: 3.0.0
  icon: 🧪
disable-slash-command: true
---

# Growth Experiment Design

A growth experiment is a bet with a price, a deadline and a stated way to lose. Two rules carry the rest: work on the funnel stage that leaks earliest, and fix what result means ship, kill or iterate before anyone sees data, because afterwards every result can be called a win.

## Overview & Purpose
For the growth strategist who decides which bets to place, in what order, and what was learned. It produces the backlog, the briefs and the log; Kaan and the product team run tests, and `ab-test-setup` sizes one.

## Execution Triggers
Load it when the brief asks for a growth plan or "what should we test first", when a funnel number is bad and the cause unknown (day-7 retention under 20 percent, signup-to-activation under 25 percent, trial-to-paid under 2 percent for self-serve), or when a test was inconclusive. Do not load it for a copy tweak with no measurable outcome, or to size one test.

## Input/Output Requirements
Inputs: the funnel with a count at every stage for the last 28 days (ask, never invent), the activation event, weekly traffic to the step, who can ship a change and how fast, past experiments.

Output, in this order: a bottleneck statement (one stage, its conversion, the benchmark and its source); a backlog table (rank, experiment, hypothesis, I, C, E, ICE); briefs for the top three only; an experiment log entry per experiment. Shapes: [examples/templates.md](examples/templates.md). **Evidence to attach**: where each count and benchmark came from, with the date range.

## Step-by-Step Runbook
1. **Locate the leak.** Divide each stage by the one before it. The bottleneck is the stage with the largest gap against its benchmark that sits earliest in the funnel: fixing a late stage while an early one leaks hides the real cost.
2. **Write every hypothesis in one form**: "Because [evidence], we believe [change] will move [metric] by [amount], and we will know within [days] when [metric] passes [threshold]." With no evidence clause it is a wish: Confidence 1 to 3.
3. **Score Impact, Confidence and Ease from 1 to 10; ICE is their mean.** Impact 9 to 10 means the bottleneck stage moves 20 percent relative or more; Confidence 7 or more needs numbers from this funnel; Ease 10 is one person in a day. Full bands: [references/ice-rubric.md](references/ice-rubric.md); a rubric makes two people score one idea alike.
4. **Cut to what fits two weeks.** An experiment that needs more than 14 days of traffic at this volume leaves the backlog: make the change bigger, test a step higher, or log "needs more traffic". Check with `ab-test-setup` before promising.
5. **One guardrail per experiment**, a metric that must not get worse (refund rate, support contacts, page speed, unsubscribe rate) with its threshold: a lift that costs trust is not a win.
6. **Fix the decision rule now**, in the brief: ship at X with the guardrail holding; kill if the lower bound is below zero at the planned sample; otherwise iterate once.
7. **Hand off, then log.** The brief goes to Kaan (variant copy) and Deniz (build, event names); Emre verifies that events fire before launch. Write the log entry within a day of the result: result, decision, one sentence of learning.

## Code & Config Exemplars
Load [examples/worked-example.md](examples/worked-example.md) when you build your first backlog or want numbers to check yours against; [examples/templates.md](examples/templates.md) holds the backlog row, brief and log entry to copy.

Anti-patterns, each with its reason:
- A backlog sorted by enthusiasm: without a rubric reason per score, two people rank one list differently.
- Ten experiments at once on one page: they interact and no result is readable; one per page per run.
- "Increase conversion" as a hypothesis: no number, evidence or end date, so it cannot fail.
- Scaling acquisition into a leaking funnel: the leak eats the spend.
- Choosing the decision rule after the results: any result can then be called a win.

## Edge Cases & Error Recovery
- **No funnel data**: say so in the first line; make instrumentation experiment zero for Deniz and Emre; score everything Confidence 1 to 3; never present industry averages as this product's numbers.
- **Under about 500 visitors a week to the step**: recommend qualitative work (five user sessions, a ticket review) and say why a test would be noise.
- **A surprising result**: check for sample-ratio mismatch and a broken event first; hand the check to Emre.
- **Two experiments both won**: ship one at a time or test the combination; lifts do not add.
- **Out of role**: pricing and anything touching consent or personal data go to the lead; privacy questions to Defne.

## Verification Checklist
- [ ] The bottleneck is one stage, with a count at every stage and a named benchmark source.
- [ ] Every backlog row has I, C and E from the rubric, and ICE is their mean.
- [ ] The top three have a primary metric, a guardrail with a threshold, a run length of 14 days or fewer and a decision rule.
- [ ] Every figure not computed from data you read is labelled an estimate.
- [ ] You re-read the playbook file after writing it and report what you saw.
- [ ] Hand-offs name Kaan, Deniz and Emre and what each must deliver.
