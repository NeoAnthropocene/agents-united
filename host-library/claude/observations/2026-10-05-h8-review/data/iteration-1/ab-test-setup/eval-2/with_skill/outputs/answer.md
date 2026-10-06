**No, don't call it. The test is probably broken, and even if it isn't, 3 days is too short.**

**1. The traffic split looks wrong (sample-ratio mismatch).**
- You have 20,000 visitors in total. A 50/50 split should give about 10,000 per arm, but you have 10,300 and 9,700.
- Chi-square is (300²/10,000) + (300²/10,000) = 9 + 9 = **18**, which gives p ≈ 0.00002.
- The skill's rule is that a chi-square of 10.83 or more (p < 0.001) voids the result. A split this lopsided would happen by chance about 2 times in 100,000.
- I worked this out by hand because I have no shell here. Please run `node .claude/skills/ab-test-setup/scripts/srm-check.mjs 10300 9700` to confirm it.
- This assumes the test was meant to be 50/50. If you configured a different split, tell me and I'll recompute.
- Likely causes are a variant that is slower or crashes and drops visitors before the assignment event fires, bot filtering that hits one arm, a redirect-based variant that loses people, or assignment that isn't sticky.
- Until someone finds the cause, the 12% lift can't be trusted. The visitors who dropped out are probably not a random sample.

**2. Three days is too short.**
- The run length should be whole weeks (7, 14, 21 or 28 days) so each weekday appears equally. Three days is a partial week, which biases the result toward whichever weekdays you happened to catch.
- A p of 0.03 after a peek, before the planned sample size or end date, is not a real 0.03. Stopping at the first p below 0.05 inflates false positives several times over (general statistics, not measured here).
- I'm also assuming the sample size and end date were never fixed in advance. If they were, tell me.

**3. I can't judge how strong the evidence is without the conversion counts.**
- The skill warns that a "winner" on about 300 conversions in total is too small to separate from noise.
- A +12% relative lift is a small effect. At a baseline signup rate of roughly 4%, detecting it needs about 16 × 0.04 × 0.96 / 0.0048² ≈ **27,000 visitors per arm**. That is an estimate, and I assumed the 4% baseline. You have about 10,000 per arm.
- If the baseline is higher, the requirement drops, so send me the real signup counts per arm.

**What to do:**
1. Hand the SRM to Emre (assignment, events, SRM verification) to find the cause. Check that assignment is sticky, that the signup event fires in both arms, and that the variant isn't slower or erroring.
2. If a cause turns up that affects only one arm, void the test, fix it and relaunch. Don't stitch the halves together.
3. Before relaunching, write the brief: primary metric (signups ÷ unique visitors, in a stated window), MDE, sample per arm, a run of whole weeks, and a "stop at the planned sample or date, whichever is later" rule.
4. Re-check SRM at day 3 and at the end. Day 3 is for checking the split, not for deciding the winner.

If you send me the baseline signup rate, the signup counts per arm, your weekly traffic and the intended split, I'll write the full brief with sample size and run length. I'll also recompute the SRM against your actual split.

**Peer messages received:** none
**Open items:** SRM script and sample-size script need a shell, so I did the arithmetic by hand and didn't verify it. Root-cause investigation of the split goes to Emre via the lead. No files written and no tasks claimed.