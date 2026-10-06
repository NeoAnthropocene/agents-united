**Test first: get new signups to their first invoice faster.** That step loses the most people, and it's early enough in the funnel that fixing it improves everything after it.

## Funnel, last month

| Stage | Count | Step conversion |
|---|---|---|
| Visits → signups | 41,000 → 6,200 | 15.1% |
| Signup → first invoice made | 1,550 | **25.0%** |
| Made → sent | 930 | 60.0% |
| Sent → active at day 30 | 410 | 44.1% |
| Signup → active at day 30 | 410 | 6.6% |

- **The leak:** 4,650 people a month sign up and never make an invoice. A 25% activation rate is at the bottom of the 25–40% self-serve range. That range comes from my growth-experiment skill's guidance, not a source I looked up, so treat it as an estimate.
- **Second leak:** 620 people start an invoice and never send it. It's real, but it comes later in the funnel and can't be tested in two weeks at this volume.
- **Caveat on the 410:** these are probably not the same people as the 6,200 signups, because day-30 activity comes from earlier cohorts. Use the ratios as rough guides.
- **Visit-to-signup looks too high.** 15% is far above typical SaaS rates, which I'd guess at 2–5%. Check for bot signups or an undercounted visit number before you trust the top of the funnel.

## What you can test with this traffic

You get about 1,430 signups a week, so a two-week test has roughly 1,430 per arm. At a 25% baseline that can only detect a lift of about 4.6 points (about 18% relative) at 80% power. That's my own back-of-envelope sample-size calculation, not a tool run.

So your tests need bold changes. A small copy tweak would be noise. The created-to-sent step sees only about 360 users a week and would need a 10-point lift, so look at it with user sessions instead.

## Ranked backlog

All scores are my estimates. Confidence is low because I have no session data yet.

| Rank | Experiment | Impact | Confidence | Ease | ICE |
|---|---|---|---|---|---|
| 0 | Check the events, define "active", and watch 5–10 sessions or calls with signups who never made an invoice (no dev time) | n/a | n/a | 10 | do this first |
| 1 | **New signups land straight in the invoice editor, with business setup (logo, tax, address) deferred to the send step** | 9 | 5 | 6 | 6.7 |
| 2 | 24-hour reminder email to signups with no invoice, with a one-click link to the editor | 6 | 6 | 9 | 7.0 |
| 3 | First-invoice checklist and an empty-state button ("Make your first invoice in 2 minutes") | 6 | 5 | 9 | 6.7 |
| 4 | Fewer steps from draft to send (client email, preview) | 5 | 4 | 6 | 5.0 (not testable yet) |

Run the experiments in this order: 0, then 1, then 2 and 3.

Experiment 2 scores highest, but it's a modest nudge. Experiment 1 changes the product the most, and I expect it to be the only one big enough to detect in two weeks.

## Brief for experiment 1

- **Hypothesis:** Because 75% of signups never make an invoice, we believe landing them in a pre-filled invoice editor with setup deferred will lift signup-to-first-invoice from 25% to 30% or more. We'll know within 14 days, at about 2,800 signups.
- **Control:** The current post-signup flow.
- **Variant:** Signups go straight to the editor with a sample invoice. Business details are asked for only when they hit Send.
- **Primary metric:** Share of signups who make a first invoice within 7 days.
- **Guardrail:** Invoices sent per signup must not fall. Support contacts must not rise by more than 20%.
- **Decision rule, fixed before launch:**
  - Ship if the lift is at least 4 points, the lower bound is above zero and the guardrail holds.
  - Kill if the lower bound is below zero at the planned sample.
  - Otherwise iterate once.
- **Dev cost:** About one week of your two-day-a-week dev, so roughly three calendar weeks including the run.

## Your two dev days a week

- **Week 1:** Fix the events, build the checklist and empty state (experiment 3, small), and do the user sessions.
- **Weeks 2–3:** Build and launch experiment 1. Run one test per page at a time.
- **After the result:** Ship the 24-hour email, then look at the draft-to-send step using what the sessions showed.

## What to hold off on

- **Paid acquisition:** Don't scale it into a funnel where only 6.6% of signups are still active at day 30. I haven't seen your LTV or CAC, so I can't confirm the unit economics.
- **Referral program:** Wait until activation improves. Your best loop is probably the invoice itself, with a "pay online" link or small branding on the 930 invoices you send each month. Test it later.

## What I need from you

- How you define "active" at day 30.
- Whether the 410 comes from the same signup cohort as the 6,200.
- Your price and churn, so I can model LTV and CAC.

I answered inline and didn't write a playbook file or run any searches. If you want the full playbook with the funnel chart spec saved to the repo, say so.