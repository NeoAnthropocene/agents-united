---
name: ab-test-setup
description: "Specify an A/B test so its result can be trusted: one primary metric, the minimum detectable effect, the sample size and run length by hand, assignment and event checks, a stopping rule, and the brief that goes to the people who build it."
metadata:
  author: agents-united
  version: 3.0.0
  icon: 📊
disable-slash-command: true
---

# A/B Test Setup

## Overview & Purpose
Most failed tests fail before launch: the metric is vague, the sample is too small to see the effect the team hopes for, or the assignment is broken and nobody checks. This skill is the checklist and the arithmetic that turns an idea (from `growth-experiment-design` or a CRO finding) into a brief someone else can build and verify.

It covers the statistics a strategist can do by hand. It does not run the test and it cannot see your data; every figure it produces is an estimate until the instrumented numbers exist, and the brief says so.

## Execution Triggers
Load it when you write an experiment brief, are asked "how long should we run this", or must judge whether a finished test can be believed. Do not use it for changes you will ship without measuring (say that plainly instead), or for tests on fewer than about 500 visitors a week to the step (use qualitative research and explain why a test would be noise).

## Input/Output Requirements
Inputs: the change, the page or step, weekly visitors to it, the baseline rate of the primary metric (from data you read, with its date range), and the smallest lift worth shipping.

Output, one brief with these fields, none left blank:
- **Hypothesis** in the form "Because [evidence], [change] will move [metric] by [amount]".
- **One primary metric**, defined as numerator over denominator, with the time window ("signups with a first invoice within 24 hours of signup").
- **Guardrail metric(s)** with a threshold.
- **Minimum detectable effect (MDE)**, absolute and relative.
- **Sample size per arm** and **run length** (arithmetic shown).
- **Assignment unit** (user, session, account) and split (50/50 unless stated).
- **Stopping rule** and **decision rule**.
- **Verification plan** (what Emre checks before launch).

## Step-by-Step Runbook
1. **Pick one primary metric.** If you are tempted by three, you are testing three hypotheses; pick the one the change is meant to move and demote the others to secondary or guardrail. A metric with the wrong unit (clicks when you sell subscriptions) answers the wrong question.
2. **Set the MDE from business value, not from hope.** Ask what lift pays for the build and the risk, then check the test can see it. Smaller than that is not worth a test.
3. **Compute the sample per arm.** For a conversion rate at 5 percent significance and 80 percent power, use n = 16 x p x (1 - p) / d squared, where p is the baseline rate and d the *absolute* difference (0.008, not 20 percent). For a mean, n = 16 x s squared / d squared with s the standard deviation. Round up.
4. **Convert to a run length.** Days = (2 x n) / daily eligible visitors, rounded up **to whole weeks** so every weekday appears equally; never fewer than 7 days, and flag anything over 28 days as not worth running at this volume.
5. **Write the stopping rule before launch**: fixed sample or fixed date, whichever comes later, and nothing else. **No peeking**: looking daily and stopping at the first p below 0.05 inflates the false-positive rate several times over (general statistical knowledge, not measured here). If the team must look, use a sequential method and say which; do not improvise one.
6. **Plan the checks that catch broken tests.** Before launch: assignment is sticky per unit, the event fires in both arms, the variant renders on the browsers that matter. During the run: **sample-ratio mismatch (SRM)**, the observed split against the planned split with a chi-square test; a p below 0.001 means the result is invalid and the cause is found before anything else is read.
7. **Hand off.** The brief goes to Deniz (flag, variant, event names and payload), Emre (the verification plan above and the SRM check at day 3 and at the end) and Kaan if the variant is copy. Anything that sets a cookie or tracks an identifier goes to Defne for consent first.

## Code & Config Exemplars
### Worked example
Pricing page, 1,500 eligible visitors a day, baseline paid-plan click rate 4.0 percent (last 28 days). The team hopes for 20 percent relative, so d = 0.008.

n = 16 x 0.04 x 0.96 / 0.008 squared = 0.6144 / 0.000064 = **9,600 per arm**, 19,200 in total. 19,200 / 1,500 = 12.8 days, so run **14 days**. Stopping rule: stop at 14 days or 9,600 per arm, whichever is later. Decision rule: ship if the variant is higher and the interval excludes zero and the guardrail (refund requests) did not rise by more than 5 percent relative.

The same idea on a page with a 1.0 percent baseline and a hoped-for 10 percent relative lift: d = 0.001, n = 16 x 0.0099 / 0.000001 = **158,400 per arm**. Not feasible; make the change bolder, or test a metric earlier in the funnel.

SRM check at day 3: planned 50/50, observed 10,300 against 9,700 (total 20,000, expected 10,000 each). Chi-square = 300 squared / 10,000 + 300 squared / 10,000 = 18, which is above the 10.83 cut-off for p = 0.001: **stop and investigate**, do not read the result.

Brief header to copy:
```
EXPERIMENT   <id> <name>
PRIMARY      <numerator> / <denominator> within <window>
GUARDRAIL    <metric> must not worsen by more than <x>
MDE          <abs> absolute (<rel> relative)   N per arm <n>   RUN <days> days
UNIT/SPLIT   <user|account|session>  50/50
STOP         fixed sample or date, whichever is later; no peeking
DECIDE       ship if ...; kill if ...; otherwise iterate once
ESTIMATES    figures computed by hand from <source, date range>, not from a calculator
```

### Anti-patterns
- Stopping the moment the dashboard turns green.
- Reporting five metrics and calling whichever moved the primary one afterwards.
- A "winner" on 300 conversions in total.
- Testing the change and a new audience together.
- Counting the lifts of two simultaneous winners as additive.
- Sizing a test by percentage lift alone (the formula needs the absolute difference).

## Edge Cases & Error Recovery
- **Low baseline (under 1 percent).** The sample explodes; move to a higher-frequency proxy that really predicts the outcome, and say it is a proxy.
- **Traffic shared by other tests.** Test the interaction risk: separate pages, or mutually exclusive buckets; if neither is possible, do not run both.
- **Novelty or seasonality.** Include a full cycle; if a sale or launch falls in the window, extend or restart and say so in the log.
- **An arm shows a broken event.** The test is void; fix, relaunch, do not stitch the halves together.
- **Ambiguous result** (interval contains zero): record "no detectable effect at this MDE", which is a result, not a failure; iterate once with a bolder variant or drop the idea.

## Verification Checklist
- [ ] One primary metric with numerator, denominator and window; one or more guardrails with thresholds.
- [ ] MDE stated in absolute and relative terms, with the arithmetic for the sample per arm visible.
- [ ] Run length is in whole weeks, at least 7 days, and 28 days or fewer.
- [ ] Stopping and decision rules are written before launch.
- [ ] Verification plan for assignment, events and SRM is handed to Emre; tracking changes are handed to Defne.
- [ ] Every figure you did not compute from data you read is labelled an estimate in the brief.
