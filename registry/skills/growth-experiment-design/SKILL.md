---
name: growth-experiment-design
description: "Turn a funnel bottleneck into a ranked, two-week-testable experiment backlog with hypotheses, ICE scores that follow a rubric, guardrails, a decision rule fixed before launch, and a log that keeps the learning."
metadata:
  author: agents-united
  version: 3.0.0
  icon: 🧪
disable-slash-command: true
---

# Growth Experiment Design

## Overview & Purpose
A growth experiment is a bet with a price, a deadline and a stated way to lose. This skill is for the growth strategist who has to decide *which* bets to place, in what order, and how to know afterwards what was learned. It does not run tests (Kaan and the product team do) and it does not design the statistics of one test (`ab-test-setup` does). It produces the backlog, the briefs and the log.

Two rules carry everything else: work on the funnel stage that is actually leaking (activation before acquisition), and write down what result will make you ship, kill or iterate *before* anyone sees data.

## Execution Triggers
Load it when:
- the brief asks for a growth plan, an experiment backlog, or "what should we test first";
- a funnel number is bad and the cause is unknown (day-7 retention under 20 percent, signup-to-activation under 25 percent, trial-to-paid under 2 percent for self-serve);
- an earlier test was inconclusive and you must decide what to do with the result.

Do not load it for a one-off copy tweak with no measurable outcome (hand it to Kaan as a finding), or to size a single test (use `ab-test-setup`).

## Input/Output Requirements
You need: the funnel with a count at every stage for the last 28 days (ask for it, do not invent it), the product's activation event, the traffic per week on the page or step under test, who can ship a change and how fast, and any past experiments.

You produce, in this order, in the playbook:
1. **Bottleneck statement**: one stage, its conversion, the benchmark you compare against and where the benchmark came from.
2. **Backlog table**: rank, experiment, hypothesis, Impact, Confidence, Ease, ICE.
3. **Briefs** for the top three only: primary metric, guardrail, control, variant, traffic needed, run length, decision rule, owner.
4. **Experiment log entries** (one per experiment, appended to `growth/experiment-log.md` when the workspace has one, otherwise inside the playbook).

## Step-by-Step Runbook
1. **Locate the leak.** Divide each stage by the one before it. The bottleneck is the stage with the largest gap against the benchmark that sits *earliest* in the funnel. Fixing a late stage while an early one leaks hides the real cost.
2. **Write hypotheses in one form**: "Because [observed evidence], we believe [change] will [move metric] by [amount], and we will know within [days] when [primary metric] is [threshold]." A hypothesis with no evidence clause is a wish: mark its Confidence 1 to 3.
3. **Score with the rubric**, each 1 to 10, ICE is the mean:
   - *Impact*: 9 to 10 moves the bottleneck stage by 20 percent relative or more; 6 to 8 by 10 to 20; 3 to 5 by under 10; 1 to 2 only a vanity metric.
   - *Confidence*: 1 to 3 opinion; 4 to 6 qualitative evidence (session recordings, support tickets, interviews); 7 to 8 numbers from this funnel; 9 to 10 an earlier test on this product.
   - *Ease*: 10 copy or configuration by one person in a day; 7 a front-end change in one to three days; 4 needs backend or data work; 1 more than a month.
4. **Cut to what fits two weeks.** An experiment that needs more than 14 days of traffic at this page's volume is not in the backlog; make the change bigger, test a step higher in the funnel, or log it as "needs more traffic". Check with `ab-test-setup` before you promise.
5. **Choose one guardrail per experiment**: a metric that must not get worse (refund rate, support contacts, page speed, unsubscribe rate), with the threshold.
6. **Fix the decision rule now**: "Ship if the primary metric improves by at least X and the guardrail holds; kill if the lower bound is below zero at the planned sample; otherwise iterate once." Put it in the brief.
7. **Hand off, then log.** Brief goes to Kaan for the variant copy and to Deniz for the build and event names; Emre verifies the events fire before launch. When a result comes back, write the log entry within a day: result, decision, one sentence of learning.

## Code & Config Exemplars
### Worked example
A freelancer invoicing tool, 6,200 signups a month (invented numbers, for illustration). Funnel (28 days): visit 41,000, signup 6,200 (15.1 percent), created a first invoice 1,550 (25.0 percent of signups), sent it 930 (60.0 percent of those who created one), day-30 active 410.

The leak: signup to first invoice at 25.0 percent against a self-serve benchmark of 35 to 40 percent (source and date to be named in the playbook). Acquisition is not the problem; do not recommend paid spend.

| Rank | Experiment | Hypothesis | I | C | E | ICE |
|---|---|---|---|---|---|---|
| 1 | Pre-filled sample invoice on first screen | Because 7 of 10 recordings show users leaving the blank invoice form, we believe a sample will lift first invoice from 25 to 30 percent within 14 days | 8 | 6 | 8 | 7.3 |
| 2 | Skip the company-profile step until after the first invoice | Because the profile step loses 22 percent of signups, removing it will lift activation by 4 points | 7 | 7 | 6 | 6.7 |
| 3 | Day-1 email with a one-click "send your first invoice" link | Because 38 percent open the welcome email and nothing in it asks for the action | 5 | 5 | 9 | 6.3 |

Brief for rank 1: primary metric signups-to-first-invoice within 24 hours; guardrail: invoices sent within 7 days must not fall by more than 3 percent relative; 6,200 signups a month is about 1,430 a week, so two weeks give about 1,430 per arm; detecting 5 points on a 25 percent base needs about 1,200 per arm (16 x 0.25 x 0.75 / 0.05 squared, an estimate, check it with `ab-test-setup`), so the test fits. Decision rule: ship at 30 percent or more with the guardrail holding. Owner Kaan for copy, Deniz for the build.

Log entry shape:
```
EXP-014 | 2026-10-04 | sample invoice on first screen
Hypothesis: ... | Primary: first invoice within 24h | Guardrail: invoices sent in 7 days
Result: 25.1 to 29.4 percent, n = 1,450 per arm | Decision: iterate (below the 30 percent bar, guardrail held)
Learning: the sample is read, but users edit the amounts; next, prefill from their last client.
```

### Anti-patterns
- A backlog sorted by enthusiasm: every row has an ICE score and the rubric reason for each of the three numbers.
- Ten experiments in parallel on one page: they interact; at most one per page per run.
- "Increase conversion" as a hypothesis, with no number, no evidence and no end date.
- Scaling acquisition into a leaking funnel because acquisition experiments are easier.
- Choosing the decision rule after the results are in.

## Edge Cases & Error Recovery
- **No funnel data.** Say so in the first line of the playbook, give the instrumentation task (events and where they fire) as experiment zero for Deniz and Emre, and mark every score Confidence 1 to 3. Do not fill the gap with industry averages as if they were this product's numbers.
- **Traffic too low for any test** (under about 500 visitors a week to the step): recommend qualitative work instead (five user sessions, a support ticket review) and say why a test would be noise.
- **A result that surprises you.** Check for sample-ratio mismatch and a broken event before you believe it; hand the check to Emre.
- **Two experiments both won.** Ship one at a time or run the combination as its own test; do not add the lifts.
- **Out of role.** Pricing changes and anything touching consent or personal data go to the lead; hand privacy questions to Defne.

## Verification Checklist
- [ ] The bottleneck is one stage, with a count at every stage and a named benchmark source.
- [ ] Every backlog row has I, C, E from the rubric and the ICE is their mean.
- [ ] The top three have a primary metric, a guardrail with a threshold, a run length of 14 days or fewer and a decision rule.
- [ ] Every figure you did not compute from data you read is labelled as an estimate.
- [ ] You re-read the playbook file after writing it and report what you saw, not what you intended.
- [ ] The hand-offs name Kaan, Deniz and Emre and what each must deliver.
