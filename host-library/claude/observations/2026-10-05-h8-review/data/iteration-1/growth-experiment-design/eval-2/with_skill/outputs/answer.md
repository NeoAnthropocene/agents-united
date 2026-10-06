## Growth Strategy Playbook (provisional)

**I have no funnel data, so this is a draft.** The workspace has no metrics, funnel counts or past experiments. It's a tooling repo, not your SaaS. Every confidence score is therefore 2–3, I've named no bottleneck, and I haven't quoted benchmarks as your numbers. A flat SaaS leaks at activation, retention or expansion more often than it lacks traffic. That is a prior, not a finding.

### Executive Summary & Unit Economics
- **Current bottleneck:** unknown. Experiment 0 fixes that.
- **Paid acquisition is held back.** Nothing here scales spend until I've seen day-7 and day-30 retention and LTV:CAC (target ≥ 3:1, CAC payback ≤ 12 months).
- All ten experiments fit in 14 days, but I haven't checked traffic. Anything under about 500 weekly visitors to its step needs user sessions, not a test.

### ICE Experiment Backlog
| Rank | Experiment | Hypothesis (provisional, no evidence clause yet) | Stage | I | C | E | ICE |
|---|---|---|---|---|---|---|---|
| 0 | **Instrument the funnel** | Without per-stage counts and a defined activation event, no result is readable | All | n/a | n/a | n/a | Prerequisite |
| 1 | Onboarding checklist, 3 steps with progress bar | Guiding to the first value event raises signup→activation | Activation | 8 | 3 | 7 | 6.0 |
| 2 | Cut signup fields to the minimum | Fewer fields raise visit→signup completion | Activation | 7 | 3 | 8 | 6.0 |
| 3 | Behavioural email at 24h and 72h for users who stalled | Nudging toward the unfinished step lifts D7 activation | Activation | 7 | 3 | 8 | 6.0 |
| 4 | Annual-plan option at checkout | Annual lifts cash and cuts early churn | Revenue | 6 | 3 | 8 | 5.7 |
| 5 | Win-back email to users who churned in the last 90 days | A "what's new" message reactivates some | Retention | 5 | 3 | 9 | 5.7 |
| 6 | Cancellation flow with a reason survey, pause and downgrade options | Pause or downgrade saves a share of cancellers | Retention | 7 | 3 | 6 | 5.3 |
| 7 | Upgrade prompt at the moment of first value | Asking at peak value beats asking at trial end | Revenue | 7 | 2 | 7 | 5.3 |
| 8 | "Invite a teammate" prompt right after first value | A built-in collaboration loop raises K-factor | Referral | 8 | 2 | 6 | 5.3 |
| 9 | Shareable output with an opt-in "made with" link | Shared artefacts bring organic signups | Referral | 7 | 2 | 6 | 5.0 |
| 10 | Double-sided referral offer, minimum viable version | An incentive on both sides lifts invites sent | Referral | 7 | 2 | 5 | 4.7 |

Guardrails to set before launch:
- **Experiment 2:** lead quality and signup→activation, so a fuller funnel isn't just a lower-quality one.
- **Experiment 6:** cancelling must stay one clear click away. No dark patterns.
- **Experiments 8–10:** no contact scraping. Invites are opt-in only.
- **Experiments 3 and 5:** unsubscribe rate. Consent and suppression need a check before sending.
- **Experiment 4:** pricing changes go to you for sign-off. I'm only testing the option's placement.

### Top three briefs (to be completed once data exists)
1. **Onboarding checklist**
   - **Primary metric:** signup→activation within 7 days.
   - **Target lift:** I'll set it from your baseline. I won't guess one.
   - **Control:** current onboarding.
   - **Variant:** 3-step checklist with a progress bar.
   - **Decision rule:** fixed in the brief before launch.
2. **Signup fields**
   - **Primary metric:** visit→signup.
   - **Control:** current form.
   - **Variant:** only the fields with a stated reason.
3. **Stalled-user emails**
   - **Primary metric:** D7 activation.
   - **Control:** no email.
   - **Variant:** 24h and 72h behavioural emails.

I haven't sized any of these. `ab-test-setup` needs your weekly traffic first. I skipped the Chart.js funnel projection because any curve I drew would be invented.

### What I need from you
1. Funnel counts for the last 28 days: visits, signups, activated, paid, retained at D7 and D30, churned.
2. Your activation event, or confirmation that none is defined yet.
3. Weekly visitors to the signup and onboarding steps.
4. What engineering can ship, and how fast.
5. Past experiments and their results.
6. Current ARPA, CAC and churn, so I can check unit economics.

With those I'll name the bottleneck, drop the experiments aimed at stages that aren't leaking, and rescore with real confidence.

### Hand-offs (once the data arrives)
- **Kaan:** variant copy for experiments 1–3.
- **Deniz:** build and event names.
- **Emre:** confirm events fire before launch.

**Peer messages received:** none.
**Open items:**
- The data list above is the blocker.
- Pricing (experiment 4) and consent for the emails (experiments 3 and 5) need your decision.
- I wrote no file because you asked for a list. Say so if you want it saved as a playbook document.