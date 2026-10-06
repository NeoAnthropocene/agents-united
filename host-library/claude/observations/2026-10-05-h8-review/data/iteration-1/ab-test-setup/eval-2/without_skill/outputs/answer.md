**No, don't call it yet.** The sample ratio is the main problem, and the 3-day runtime is a second one.

**1. Sample ratio mismatch (SRM)**
- With a 50/50 split, 20,000 visitors should give about 10,000 per arm. You have 10,300 and 9,700.
- Chi-square is (300²/10,000) × 2 = 18 on 1 degree of freedom, so p ≈ 0.00002.
- A split this lopsided almost never happens by chance. It means assignment or tracking is broken somewhere, and a broken assignment can fake a lift or hide one. Your p = 0.03 is not trustworthy until the SRM is explained.
- Common causes:
  - The variant loads slowly or flickers, so some visitors bounce before they are counted.
  - A redirect or caching rule is dropping visitors.
  - Bot or internal traffic is hitting one arm.
  - Variant-side tracking is failing.
  - Users are being re-bucketed.
- Check the split by device, browser, country and traffic source. The segment where the split is most skewed usually points to the cause.

**2. Three days is too short**
- Traffic and behaviour vary by day of week, so run at least one full week, and ideally two.
- A p-value is only valid if you fixed the sample size or duration beforehand. Checking early and stopping when p < 0.05 inflates the false-positive rate well above 5%.
- Early lifts are often novelty effects and shrink over time.
- At p = 0.03, the evidence against "no effect" is only moderate. The 12% lift also likely has a wide confidence interval, probably something like +1% to +23%. Check this against your baseline rate.

**3. Signups may not be the right metric**
- A signup lift that doesn't carry through to activation and day-7 retention is a leaky-funnel win. It would mean paying to acquire users who don't stick.
- Look at activation for the variant cohort before you ship.

**What to do**
1. Find and fix the SRM cause. If you can't, discard the data and restart.
2. Set the sample size and duration up front, using your baseline rate and the minimum lift you care about.
3. Run it at least 7 days, ideally 14, and don't decide before then.
4. Judge it on signup rate plus activation, with a guardrail metric such as page speed or error rate.

I haven't seen your underlying data. If you share the baseline conversion rate, the daily counts per arm and how you assign users, I can check the confidence interval and help narrow down the SRM.