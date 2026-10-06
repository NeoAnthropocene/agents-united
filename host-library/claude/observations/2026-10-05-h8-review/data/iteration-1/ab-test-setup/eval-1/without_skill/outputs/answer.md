## How long to run it

**Run it for 14 days (two full weeks), split 50/50.** I computed this by hand with the standard two-proportion formula. I haven't checked it in a calculator.

| Input | Value |
|---|---|
| Baseline click-through | 4.0% |
| Target (a 20% relative lift) | 4.8% |
| Significance (two-sided) | 5% |
| Power | 80% |
| Sample needed | about 10,300 visitors per arm, about 20,600 in total |
| Time at 1,500/day | about 13.7 days, so run 14 |

- **Why 14 days:** it covers two full weekly cycles, so weekday and weekend behaviour is balanced. Don't stop early when the number looks good. Peeking inflates false positives.
- **If the real lift is smaller:** a 10% relative lift (4.0% to 4.4%) needs roughly 4x the sample, about 7–8 weeks. If a 20% lift is a hope rather than a likely outcome, decide now whether a result of 4.0% to 4.4% would still be worth shipping.
- **If 1,500/day is sessions, not unique visitors:** repeat visitors dilute the sample. Randomise by user ID or cookie, not by session, and recheck the daily unique count.

## Write-up for the dev

**Experiment: Shorter signup form on the pricing page**

- **Hypothesis:** Removing fields from the signup form will raise the pricing-page click-through to the paid plan by 20% relative (4.0% to 4.8%). Fewer fields means less friction at the decision point.
- **Primary metric:** Pricing-page visitors who click through to the paid plan, divided by unique visitors who saw the pricing page. Please confirm this is the exact definition of the 4%.
- **Guardrail metrics (must not drop):**
  - Signup completion rate.
  - Day-7 activation.
  - Paid conversion and refund rate, if they're available.
  - Page load time and form error rate.
  - A short form can raise clicks but lower lead quality, so we need these to catch it.
- **Control:** The current form, unchanged.
- **Variant:** The shortened form. Please list the exact fields removed. Only change the fields, with no copy, layout or styling changes, so any lift is attributable.
- **Assignment:**
  - 50/50 random split, sticky per user, so the same person always sees the same version.
  - Assign at first pricing-page view and exclude internal and bot traffic.
- **Events to log:**
  - `pricing_viewed` and `plan_cta_clicked` (with `variant`).
  - `form_started`, `form_field_error` (with field name) and `form_submitted`.
  - Every event carries `user_id`, `variant` and a timestamp.
- **Duration and stopping rule:**
  - Run 14 days, or until each arm has at least 10,300 users, whichever is later.
  - No early stop or mid-test changes.
  - Kill it only if a guardrail breaks badly or the page errors.
- **Pre-launch check:**
  - Confirm the split is about 50/50 (a sample-ratio check) after day 1.
  - Check both variants on mobile.
  - Verify events fire in both arms before turning on full traffic.
- **Decision rule:** Ship the variant if the primary metric is significantly higher (p < 0.05) and no guardrail has dropped. Otherwise keep the control.

## Notes and gaps

- The `ab-test-setup` and `growth-experiment-design` skills aren't installed in this environment, so I did the sample-size math by hand. If you have a calculator you trust, run the same inputs through it.
- I didn't write a file. Say the word and I'll save the brief to the repo.
- **Peer messages received:** none.
- **Open items:**
  - Is 4% measured on unique visitors, and does it end at the plan click or at a completed signup?
  - Which fields are being cut?
  - Is a 10% lift still worth shipping?