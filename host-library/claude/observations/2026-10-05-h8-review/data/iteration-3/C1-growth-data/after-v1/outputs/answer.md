**Missing: the pricing/plan model and what a user sees right after signup.** I can't size a paid-spend recommendation or write an experiment brief without them. This is provisional. I haven't written a file or a brief.

**What your numbers show**

| Step | Users | Step conversion | Lost |
|---|---|---|---|
| Visit → signup | 41,000 → 6,200 | 15.1% | n/a |
| Signup → first invoice | 6,200 → 1,550 | **25.0%** | **4,650** |
| Invoice created → sent | 1,550 → 930 | 60.0% | 620 |
| Sent → active at day 30 | 930 → 410 | 44.1% | 520 |

Only 6.6% of signups end up active. The bottleneck is **Activation**: three out of four signups never create an invoice, and that step loses far more people than any other. I wouldn't spend on acquisition until this improves. Visit-to-signup is already strong, so more traffic would mostly add to the leak.

**Caveat on the data.** The day-30 count of 410 can't come from last month's signups, because those users haven't reached day 30 yet. These are probably different cohorts, so the 44% retention figure is soft. Cohort it properly before trusting it.

**Provisional test order (a dev two days a week is enough)**
1. **Signup → first invoice.** Send new users straight into the invoice editor with a sample or prefilled invoice. Ask for business details only when they hit send. This is a small change on one screen. At about 1,430 signups a week, two weeks gives roughly 1,430 per arm. That detects a lift of about 4–5 points (25% to ~30%), not smaller ones. Treat that as an estimate, not a finished power calculation.
2. **Created → sent (60%).** Remove friction at the send step: client email capture, a preview, and fewer required fields. Run it after test 1, since it needs the same dev time.
3. **Retention after send.** Add payment-status or "invoice viewed" notifications. This is the likely day-30 lever, but fix the cohort data first.

**What I need, with why**
- **Price, plan model (free or trial) and gross margin:** needed for LTV and CAC payback. Without them I can't say whether any paid channel is viable.
- **What happens between signup and the empty invoice screen:** it tells me which activation fix to test first. For example, is there an onboarding questionnaire, email verification or a blank dashboard?
- **How "active" is defined, and whether the counts come from the same cohort:** this decides whether the retention numbers can be used.
- **Traffic mix:** 15% visit-to-signup is unusually high. If "visits" includes logged-in or returning users, the top of the funnel is overstated.

When you send those, I'll build the full ICE-ranked backlog, the briefs for the top three tests and the funnel projection.

**Open items:** none beyond the questions above. This was a direct reply, so no peers or task list were involved.