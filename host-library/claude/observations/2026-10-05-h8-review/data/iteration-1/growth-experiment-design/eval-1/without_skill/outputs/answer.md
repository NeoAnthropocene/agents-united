## Growth Strategy Playbook

### Executive Summary & Unit Economics
Your biggest leak is activation. 75% of signups never create an invoice, and that is about 4,650 people a month. Fix that before you buy or chase more traffic.

| Step | Count | Step conversion | Lost |
|---|---|---|---|
| Visit → signup | 41,000 → 6,200 | 15.1% | n/a |
| Signup → first invoice created | 6,200 → 1,550 | **25.0%** | **4,650** |
| Created → sent | 1,550 → 930 | 60.0% | 620 |
| Sent → active at day 30 | 930 → 410 | 44.1% | 520 |

- **Current bottleneck:** Activation, specifically signup → first invoice. The second leak is created → sent.
- **Unit economics:** I can't compute LTV, CAC or payback without price, churn and spend. Until you share them, don't scale paid spend. Please send ARPA, gross margin and monthly churn.
- **Referral loops:** hold off until activation is healthy.

Two caveats on the data:
- **Cohorts:** I assumed the 410 come from the same cohort as the 930. If they are last month's actives from older signups, the 44% is wrong. Check this first.
- **Signup rate:** A 15% visit-to-signup rate is unusually high for a SaaS product. It may include bots, invited collaborators, or traffic from a free tool. Check the signup count before you trust the rest.

Activation event: "sent first invoice" is my best candidate. It is unconfirmed. Confirm it with a cohort check: do users who created but never sent retain much worse than senders?

### ICE Experiment Backlog
| Rank | Experiment | Hypothesis | Impact | Conf | Ease | ICE |
|---|---|---|---|---|---|---|
| 1 | Pre-filled starter invoice | Opening a sample invoice (client, line item, totals already filled in) raises signup → first invoice from 25% to 30% | 8 | 7 | 8 | 7.7 |
| 2 | Draft-to-send nudge email | A reminder 4 hours and 24 hours after an unsent draft lifts created → sent from 60% to 66% | 6 | 7 | 9 | 7.3 |
| 3 | Defer setup until after first invoice | Moving business profile, logo and tax settings to after the first send raises first invoice by 15% relative | 9 | 6 | 5 | 6.7 |
| 4 | Unpaid-invoice status alerts and reminders | Giving users a reason to come back lifts day-30 activity by 10% relative | 7 | 5 | 5 | 5.7 |

These scores are my estimates. There is no historical test data behind them.

### Detailed Experiment Briefs
#### Experiment 1: Pre-filled starter invoice (test first)
- **Primary metric:** Share of signups who create an invoice within 7 days.
- **Guardrails:** Created → sent rate and day-30 active rate. A starter invoice could produce junk drafts that never get sent.
- **Target lift:** 25% → 30%.
- **Control:** The current first-run flow.
- **Variant:** After signup, go straight to an invoice editor filled with a sample client and line item, plus one clear "Edit and send" action. Skip the empty dashboard.
- **Sample size (estimate):** About 1,200 users per arm detects 25% → 30% at 80% power. At about 1,550 signups a week split 50/50, that takes roughly 2 weeks.
- **Dev cost:** About 3–4 days, which fits in two weeks at 2 days a week.

#### Experiment 2: Draft-to-send nudge
- **Primary metric:** Created → sent rate.
- **Target lift:** 60% → 66%.
- **Control:** No reminder.
- **Variant:** A reminder email at +4 hours and +24 hours, with a deep link back to the draft. Exit the sequence once the invoice is sent.
- **Dev cost:** About 0.5 days plus the email tool. It touches a different step from Experiment 1, so the two can run together. Read the results by step.
- **Consent:** These are transactional lifecycle emails. Check consent and suppression rules before sending.

### Two-week plan at 2 dev days a week
- **Week 1:** Add events (signup, invoice_created, invoice_sent, active_d30) and confirm the cohort definition. Walk the first-run flow on a clean account and record how many steps stand between signup and the first invoice. Start building Experiment 1.
- **Week 2:** Launch Experiment 1 and the nudge email.
- **Weeks 3–4:** Read the results. Then build Experiment 3 or the day-30 work, based on what the stall map shows.

### Visual Funnel Projection
```json
{
  "type": "bar",
  "data": {
    "labels": ["Visits", "Signups", "First invoice", "Sent", "Active D30"],
    "datasets": [{ "label": "Last month (users)", "data": [41000, 6200, 1550, 930, 410] }]
  }
}
```

### Skills and gaps
- I loaded `onboarding-cro`.
- `growth-experiment-design` and `ab-test-setup` are disabled in your skill settings. The ICE scores and sample sizes above come from my own method. Please verify the sample sizes with your A/B tool before launch.
- I wrote no file. This reply is the playbook. Say so if you want it saved.

**Peer messages received:** none

**Open items:**
1. The cohort basis for the 410.
2. Price, churn and CAC, so I can model LTV:CAC.
3. What a clean-account first run looks like, and the median minutes from signup to first invoice.
4. How the 15% signup rate is counted.