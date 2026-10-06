**Run it for 14 days (two full weeks).** That is about 10,500 visitors per arm, against the roughly 9,600 per arm it needs.

## The sizing

I worked this out by hand. I have no shell, so I didn't run the skill's script, and every figure is an estimate.

- **Baseline:** 4% (0.04).
- **Lift you hope for:** a fifth, so 4% → 4.8%. That is 0.8 points absolute, so d = 0.008.
- **Sample per arm:** 16 × 0.04 × 0.96 / 0.008² = **9,600**. That is 19,200 in total, at 5% significance and 80% power.
- **Days needed:** 19,200 / 1,500 = 12.8 days. Round up to whole weeks so each weekday appears equally: **14 days**.
- **Expected conversions:** about 420 per arm at baseline, so the result isn't resting on a handful of clicks.

This test can only detect a lift of about 20% or more. If the true lift is 10%, you'd need about 38,400 per arm, which is roughly 51 days. That's too long to be worth running, so a real but smaller win would most likely read as "no detectable effect". Before you commit, ask whether a 20% lift is the smallest win that pays for the change. If a 10% lift would still matter, the page doesn't have the traffic to test it.

## Brief for the dev

```text
EXPERIMENT   PRC-01 Shorter signup form on pricing page
HYPOTHESIS   Because fewer fields reduce friction at the point of choosing a plan, the short form
             will raise paid-plan click-through from 4.0% to 4.8%
PRIMARY      unique visitors who click through to the paid plan / unique visitors who view the
             pricing page, within the same visit (same session)
GUARDRAIL    (a) completed signups per visitor must not fall more than 5% relative
             (b) page error rate and form-submission errors must not rise
             (c) quality: share of new signups who reach activation (needs your definition)
MDE          0.8 pt absolute (20% relative)   N per arm 9,600 (plan on 10,500)   RUN 14 days
UNIT/SPLIT   visitor (sticky), 50/50
STOP         14 days or 19,200 visitors, whichever is later; no peeking
DECIDE       ship if the 95% interval for the lift is above zero and no guardrail is breached;
             kill if the interval is below zero or a guardrail is breached; if it contains zero,
             record "no detectable effect at this MDE" and iterate once with a bolder variant
CHECKS       assignment sticky across visits; click event fires in both arms; variant renders on
             mobile and desktop; sample-ratio check at day 3 and at the end (chi-square of 10.83
             or more voids the result)
ESTIMATES    figures computed by hand from your stated 1,500/day and 4%, not from a calculator;
             baseline date range not yet confirmed
OWNERS       build Deniz  verify Emre  copy Kaan  consent Defne (if assignment sets a cookie)
```

## What to tell the dev
- **Control:** the current form, unchanged.
- **Variant:** the shorter form. Please list exactly which fields are removed.
- **Variant scope:** change nothing else, such as copy, layout or pricing. Otherwise a difference has two explanations.
- **Events:** log `pricing_view` and `paid_plan_click` with the variant name, plus the signup-complete event, in both arms.
- **Assignment:** the visitor stays in the same arm on every visit.
- **Don't overlap:** don't run another test on this page at the same time. Don't launch during a sale or a pricing change, or if you do, extend the run and say so.

## Questions to settle before launch
1. **Is "click through" the right metric?** If the form sits after the click, the click may not change at all. Completed paid signups per visitor may be the real primary metric. That rate is probably lower than 4%, so the sample would need recomputing.
2. **Where do the 4% and 1,500 come from?** Confirm the date range, and confirm 1,500 means unique eligible visitors, not page views. If it's views, the run is longer.
3. **What is the smallest lift worth shipping?** This sets the MDE from business value rather than hope.
4. **Does the shorter form lose data that sales or onboarding use?** The quality guardrail needs an activation definition to be meaningful.