## Growth Strategy Playbook (condensed, chat only, no file written)

### Executive Summary & Unit Economics
**Test the path from signup to first invoice first.** 75% of signups (4,650 of 6,200) never create an invoice. That is the earliest big leak, and it is cheaper to fix than anything downstream. Don't buy traffic yet.

| Stage | Count | Step conversion |
|---|---|---|
| Visit → signup | 41,000 → 6,200 | 15.1% |
| Signup → first invoice | 6,200 → 1,550 | **25.0%** |
| First invoice → sent | 1,550 → 930 | 60.0% |
| Sent → active at day 30 | 930 → 410 | 44.1% |
| Signup → day-30 active | 6,200 → 410 | 6.6% |

- **Current bottleneck:** Activation. Signup → first invoice sits at the bottom of the usual 25–40% self-serve range.
- **Acquisition looks fine.** A 15% visit-to-signup rate is high. Check that "visits" isn't counting only signup-intent pages.
- **Second leak:** 620 people (40%) built an invoice and never sent it.
- **Unit economics:** I can't model LTV, CAC or payback without price and ARPU. The plan recommends no paid spend, so that doesn't block it.
- **Benchmarks are my estimates.** I didn't search for sourced ones.

### ICE Experiment Backlog
| Rank | Experiment | Hypothesis | I | C | E | ICE |
|---|---|---|---|---|---|---|
| 1 | Short path to first invoice | Because 75% never create an invoice, dropping the user into the invoice editor with only client, one line item and amount required (business details and logo deferred) lifts signup → invoice from 25% to 30% within 14 days | 9 | 5 | 6 | 6.7 |
| 2 | "Finish your invoice" nudge email | Because most signups go quiet in session one, a day-1 email to signups with no invoice lifts signup → invoice by 2–3pp | 5 | 5 | 9 | 6.3 |
| 3 | Simpler send step | Because 40% of created invoices aren't sent, a one-click send with a preview and no blocking setup lifts created → sent from 60% to 68% | 6 | 5 | 6 | 5.7 |

Confidence is only 5 because I have no step-level data on where people stop inside the first session. Ranks 1 and 2 are close, so the tie-break is bottleneck impact.

### Detailed Experiment Briefs

#### Experiment 1: Short path to first invoice
- **Primary metric:** share of new signups who create a first invoice within 7 days.
- **Target lift:** +5pp (25% → 30%).
- **Control:** the current post-signup flow.
- **Variant:** land straight in the invoice editor with sample data prefilled. Require only client name, one line item and amount. Ask for business details at send time.
- **Guardrail:** created → sent must not fall below 55%, and support contacts must not rise.
- **Run length:** 14 days, about 2,860 signups, so about 1,430 per arm.
  - At a 25% baseline that detects roughly 4.6pp (rough rule of thumb, 80% power, my estimate).
  - The variant therefore has to be a big change, not a tweak.
- **Decision rule, fixed now:**
  - **Ship** if the lift is at least +4pp, the confidence interval's lower bound is above 0, and the guardrail holds.
  - **Kill** if the lower bound is below 0 and the point lift is under +2pp.
  - **Otherwise** iterate once.
- **Dev cost:** about 2 days of build plus an event check, so it fits one week of your dev time.

#### Experiment 2: Nudge email (no dev time)
- **Timing:** send it in the week the dev builds Experiment 1, so the two never overlap on the same users.
- **Test:** randomly hold out half of the signups with no invoice.
- **Metric:** invoice created within 3 days of the email.
- **Guardrail:** unsubscribe rate.
- **Then:** keep the email on in both arms of Experiment 1.

#### Experiment 3: Simpler send step
- **Timing:** run it after Experiment 1 is decided, to avoid two tests on one population.
- **Cost:** about 2 dev days.
- **Metric:** created → sent.

**Dev schedule:**
- Week 1: build Experiment 1.
- Weeks 2–3: run it.
- Week 3: build Experiment 3.

### Parked
- **Referral loops and paid acquisition.** Wait until activation is healthy.
- **Day-30 retention.** Senders retain at 44%, which looks workable. Revisit once you have cohort data.

### Funnel Projection
```json
{"type":"bar","data":{"labels":["Visit","Signup","First invoice","Sent","Active D30"],"datasets":[{"label":"Last month","data":[41000,6200,1550,930,410]}]}}
```

### Open items
- **Activation event.** Do you count "first invoice created" or "first invoice sent"? I assumed created.
- **Cohort mismatch.** Last month's signups may not all have reached day 30. Also confirm the 410 "active" users come from the same cohort as the 6,200 signups.
- **Session-one drop-off.** Where do signups stop in their first session? A session recording or event data would raise Experiment 1's confidence from 5 to 7 or higher.
- **Price and ARPU.** I need them for LTV and payback.
- **Email consent.** Do signups consent to lifecycle email? Experiment 2 depends on it.
- **Hand-offs.**
  - Someone needs to write the variant copy and the email.
  - Your dev builds the flow and the events.
  - Someone must verify that events fire before launch.

I didn't write a playbook file. Say so if you want one saved.