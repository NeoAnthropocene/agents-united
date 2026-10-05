---
name: ab-test-setup
description: "Use when writing an experiment brief, sizing an A/B test, or judging whether a finished test can be trusted; trigger phrases: how long should we run this, how many visitors do we need, is this result real, can we call the winner, the split looks off. Produces one brief: a single primary metric, the minimum detectable effect, sample size and run length, a stopping rule and the checks that catch a broken test. Skip it for changes shipped without measuring and for steps under about 500 visitors a week (use qualitative research and say why a test would be noise)."
metadata:
  author: agents-united
  version: 3.0.0
  icon: 📊
disable-slash-command: true
---

# A/B Test Setup

Most failed tests fail before launch: a vague metric, a sample too small for the hoped-for effect, or a broken split nobody checks. This skill turns an idea into a brief someone else can build and verify. You work by hand: every figure is an estimate unless it comes from data you read, and the brief says which.

## Overview & Purpose
One brief per test, built from the hypothesis of `growth-experiment-design` or a CRO finding. It does not run the test or see your data.

## Execution Triggers
Load it when you write a brief, are asked "how long should we run this", or must judge a finished test. Do not load it for untested changes or for steps under about 500 visitors a week.

## Input/Output Requirements
Inputs: the change, the page or step, weekly visitors, the baseline rate with its date range, the smallest lift worth shipping. Output: the brief of [examples/brief-template.md](examples/brief-template.md), no field blank. **Evidence to attach**: where the baseline and the traffic came from.

## Step-by-Step Runbook
1. **One primary metric**, as numerator over denominator with a time window. Three metrics are three hypotheses; demote the others to secondary or guardrail.
2. **Set the minimum detectable effect (MDE) from business value**, not hope: the lift that pays for the build and the risk. A smaller lift is not worth a test.
3. **Size it.** n per arm = 16 x p x (1 - p) / d squared, with d the *absolute* difference (0.008, not "20 percent"). Look it up in [references/sample-size-table.md](references/sample-size-table.md); with a shell run `node ${CLAUDE_SKILL_DIR}/scripts/sample-size.mjs --baseline 0.04 --lift 0.20 --daily 1500`.
4. **Run length in whole weeks**, so every weekday appears equally: at least 7 days, and over 28 is not worth running at this volume.
5. **Write the stopping and decision rules before launch**: stop at the planned sample or date, whichever is later. Do not peek: stopping at the first p below 0.05 inflates false positives several times over (general statistics, not measured here).
6. **Plan the checks.** Before launch: sticky assignment, the event fires in both arms, the variant renders. During the run: sample-ratio mismatch (SRM) at day 3 and at the end; chi-square of 10.83 or more (p below 0.001) voids the result and the cause is found first. With a shell: `node ${CLAUDE_SKILL_DIR}/scripts/srm-check.mjs 10300 9700`; formulas in [references/formulas.md](references/formulas.md).
7. **Hand off.** Deniz builds (flag, variant, event names and payload); Emre verifies assignment, events and SRM; Kaan writes copy variants; anything that sets a cookie goes to Defne for consent first.

## Code & Config Exemplars
Load [examples/worked-example.md](examples/worked-example.md) when you write your first brief or want numbers to check yours against: a feasible test, an infeasible one, and an SRM that voids a result.

Anti-patterns, each with its reason:
- Stopping when the dashboard turns green: the false-positive rate climbs with every look.
- Five metrics reported, the one that moved called primary afterwards: that is a new hypothesis, tested on the same data.
- A "winner" on 300 conversions in total: too small to separate from noise.
- Testing the change and a new audience together: a difference then has two explanations.
- Adding the lifts of two simultaneous winners: they interact.

## Edge Cases & Error Recovery
- **Baseline under 1 percent:** the sample explodes; test a higher-frequency proxy that predicts the outcome, and call it a proxy.
- **Traffic shared with other tests:** separate pages or exclusive buckets; if neither is possible, do not run both.
- **A sale or launch in the window:** extend or restart and say so.
- **An arm has a broken event:** the test is void; fix and relaunch, never stitch the halves.
- **The interval contains zero:** record "no detectable effect at this MDE"; iterate once with a bolder variant or drop it.

## Verification Checklist
- [ ] One primary metric with numerator, denominator and window; guardrails with thresholds.
- [ ] MDE in absolute and relative terms; the sample arithmetic is visible.
- [ ] Run length is whole weeks, 7 to 28 days.
- [ ] Stopping and decision rules are written before launch.
- [ ] Verification plan for assignment, events and SRM is handed to Emre; tracking changes to Defne.
- [ ] Every figure not computed from data you read is labelled an estimate.
