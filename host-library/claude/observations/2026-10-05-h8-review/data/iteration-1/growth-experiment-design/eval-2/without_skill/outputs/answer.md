## Growth Strategy Playbook (provisional)

I haven't seen your funnel data, and none of the scores below come from it. They are my priors for a typical flat B2B SaaS, so treat the ranking as a draft until the week-0 baseline is in.

### Executive Summary & Unit Economics
Flat growth usually means new users roughly equal churn, so the biggest lever is probably activation or retention, not acquisition. I would not scale paid acquisition into a leaky funnel. The ranking below puts fixes before the viral and referral experiments.

- **Target LTV:CAC**: ≥ 3:1
- **Target CAC Payback**: ≤ 12 months
- **Current Bottleneck**: Unconfirmed. My hypothesis is Activation or Retention, and the week-0 baseline will confirm or reject it.

### Week 0 (before any experiment)
These are not experiments, but the rest of the plan depends on them.
1. Define the activation event, meaning the action that best predicts day-30 retention.
2. Pull the baseline numbers:
   - visit→signup rate
   - signup→activation rate
   - D1, D7 and D30 retention
   - logo and revenue churn by plan
   - blended CAC by channel
   - LTV
3. Check weekly traffic to each funnel step. Below roughly 300 visitors a week, a 2-week A/B test won't reach significance, so use before/after or holdout designs there.

### ICE Experiment Backlog
All scores are provisional.

| Rank | Experiment | Hypothesis | Impact | Conf | Ease | ICE |
|---|---|---|---|---|---|---|
| 1 | Onboarding checklist + empty states | A 3-step progress checklist toward the activation event lifts signup→activation | 8 | 7 | 8 | 7.7 |
| 2 | Day 0–7 activation email sequence | Behaviour-triggered emails pull stalled signups back to the activation event | 7 | 7 | 9 | 7.7 |
| 3 | Signup friction cut | Fewer fields plus social login raise visit→signup completion | 7 | 7 | 8 | 7.3 |
| 4 | Cancellation save flow | Reason survey plus a pause or downgrade offer saves some would-be churners | 7 | 7 | 7 | 7.0 |
| 5 | Annual-plan prompt | An annual toggle plus a savings framing at checkout raises annual mix and cash up front | 6 | 6 | 9 | 7.0 |
| 6 | Value-moment upgrade triggers | Showing the upgrade at the moment a limit or premium feature is hit beats the static pricing page | 8 | 6 | 6 | 6.7 |
| 7 | Dormant-user win-back | A 3-email sequence reactivates users inactive for 30–90 days | 5 | 6 | 9 | 6.7 |
| 8 | Teammate invite at activation | Prompting an invite right after the first success moment lifts seats per account | 7 | 5 | 7 | 6.3 |
| 9 | Comparison / alternatives pages | 3 bottom-funnel pages capture high-intent search | 6 | 5 | 6 | 5.7 |
| 10 | Double-sided referral pilot | Rewarding both sides makes referrals cheaper than blended CAC | 7 | 4 | 5 | 5.3 |

**Gates:**
- Run #8 and #10 only if D30 retention holds up at baseline. If it doesn't, drop them and move up the retention work (#4, #7).
- #9 is an SEO play. Its results will land after the quarter's first half, so judge it on leading indicators such as indexation and impressions.

### Detailed Experiment Briefs (top 3)
#### Experiment 1: Onboarding checklist
- **Primary Metric:** Signup→activation rate within 7 days
- **Target Lift:** +15% relative (placeholder until the baseline is known)
- **Control:** Current onboarding
- **Variant:** 3-step checklist tied to the activation event, with a progress bar and empty-state prompts
- **Guardrail:** Time to first value must not rise.

#### Experiment 2: Activation email sequence
- **Primary Metric:** Share of signups reaching the activation event by day 7
- **Target Lift:** +10% relative
- **Control:** Existing welcome email only
- **Variant:** 4 emails (days 0, 1, 3, 6), each triggered by the user's last unfinished step and with one CTA. Exit the sequence on activation.
- **Guardrail:** Unsubscribe and spam-complaint rates.

#### Experiment 3: Signup friction cut
- **Primary Metric:** Visit→signup completion, plus the activation rate of those signups
- **Target Lift:** +10% relative
- **Control:** Current form
- **Variant:** Only fields with a stated reason, social login, and email verification deferred until after first value
- **Guardrail:** Signup quality. More signups that never activate is not a win.

### Visual Cohort / Funnel Projection (template, to fill after week 0)
```json
{
  "type": "bar",
  "data": {
    "labels": ["Visit", "Signup", "Activated", "D30 Retained", "Paid"],
    "datasets": [{ "label": "Funnel conversion (%) - baseline", "data": [] }]
  }
}
```

### Open items
- Please share the funnel and retention numbers, or tell me where they live, such as an analytics export or a sheet. I'll then re-score with real data.
- I need to know whether the product is self-serve or sales-led. If sales-led, #1–#3 change substantially.
- I need to know your weekly traffic and signup volume, which decides the test design.
- The `growth-experiment-design` and `ab-test-setup` skills aren't installed here. I built this backlog without them, so sample-size and test-setup details should be checked once they are available.
- No files were written, and no peer messages were sent or received. I can save this as a playbook file if you want.