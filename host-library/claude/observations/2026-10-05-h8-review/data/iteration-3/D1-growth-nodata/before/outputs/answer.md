**No funnel data was available.** I found nothing in the workspace, so I don't know which stage is flat. This is a draft backlog. Every Confidence score is capped at 4, and I've used no industry averages as your numbers.

## Growth Strategy Playbook (draft)

### Executive summary
A flat SaaS usually has a leak at activation or retention. Acquisition is the less likely cause, and scaling it into a leak wastes the spend. Don't buy paid traffic this quarter unless LTV:CAC is at least 3:1 and CAC payback is 12 months or less. Both figures are unverified.

**Current bottleneck:** unknown. I need these inputs:
- Counts at every stage for the last 28 days: visit, signup, activated, paid, day-30 retained.
- Your activation event.
- Weekly traffic to each step.
- Who can ship changes, and how fast.

**Experiment 0 (prerequisite): instrumentation.** Deniz adds the funnel events and Emre verifies they fire. Without this, none of the ten results can be read.

### ICE backlog
ICE is the mean of Impact, Confidence and Ease. Ties are broken by funnel position, with the earliest stage first.

| Rank | Experiment | Hypothesis, to be confirmed by funnel data | I | C | E | ICE |
|---|---|---|---|---|---|---|
| 1 | Onboarding checklist (3 steps with a progress bar) | Guided steps raise signup-to-activation | 8 | 3 | 7 | 6.0 |
| 2 | Signup friction cut (fewer fields, social login) | Fewer fields raise visit-to-signup completion | 7 | 3 | 8 | 6.0 |
| 3 | Day-1 stall nudge (email or in-app, triggered when the activation event hasn't fired) | Users who go quiet after signup can be re-engaged | 7 | 3 | 8 | 6.0 |
| 4 | Cancel-reason survey (one question, optional) | Reasons for leaving will show the real churn drivers | 5 | 4 | 9 | 6.0 |
| 5 | Win-back email to lapsed users, with a clear unsubscribe | A portion of lapsed users will return | 5 | 3 | 9 | 5.7 |
| 6 | Annual-plan prompt at the upgrade moment | Annual plans cut churn and lift cash | 6 | 3 | 8 | 5.7 |
| 7 | Sample data or a template at first login | Faster time-to-value lifts activation | 8 | 3 | 5 | 5.3 |
| 8 | Pause or downgrade option in the cancel flow, with cancelling kept easy | Some leavers will take a lighter option | 6 | 3 | 7 | 5.3 |
| 9 | Landing page headline and proof test | A sharper message lifts visit-to-signup | 5 | 2 | 9 | 5.3 |
| 10 | In-product teammate invite at the first value moment | Invites start a product loop | 7 | 2 | 6 | 5.0 |

- **Experiment 10:** run it only after activation and day-30 retention are healthy. Otherwise it feeds a leaky funnel.
- **Experiments 6 and 8:** these touch pricing, so the lead decides on them.
- **Experiments 3 and 5:** consent and suppression for these emails go to Defne. They need confirming before launch.
- **Traffic:** if a step gets under about 500 visitors a week, a test there will be noise. Use five user sessions and a support-ticket review instead.

### Briefs for the top three
Each runs 14 days or fewer. The decision rule is fixed now: ship if the primary metric clears its target with the guardrail holding. Kill if the lower bound is below zero at the planned sample. Otherwise iterate once.

**1. Onboarding checklist**
- **Primary metric:** signup-to-activation rate.
- **Target:** about a 15% relative lift. This is an estimate and needs your baseline.
- **Control:** the current first-run experience.
- **Variant:** a 3-step checklist whose steps end at the activation event.
- **Guardrail:** day-7 retention must not drop.
- **Owners:** Kaan writes the copy, Deniz builds it, Emre checks the events.

**2. Signup friction cut**
- **Primary metric:** visit-to-signup completion.
- **Target:** to be set once the baseline is known.
- **Control:** the current form.
- **Variant:** only the fields that are needed, with a reason for each, plus social login.
- **Guardrail:** the share of signups that go on to activate. Easy signups that never activate don't count as a win.

**3. Day-1 stall nudge**
- **Primary metric:** activation within 7 days among users who stalled.
- **Control:** no message.
- **Variant:** one message that names the single next step.
- **Guardrail:** unsubscribe rate and support contacts.

### Chart specification
I haven't drawn a funnel or retention projection. With no data, any curve would be invented. I'll add it once you send the stage counts.

### Hand-offs and open items
- **Peer messages received:** none.
- **Needed from you:** the funnel counts, the activation event, weekly traffic per step, and past experiment results.
- **Pricing and plan changes (6, 8):** need a decision from the lead.
- **Email consent and suppression (3, 5):** need Defne's review before any send.
- **Task list:** I had no task-tracking tools, so I haven't updated any task status.

I wrote no file, because this workspace is the Agents United repo and not your product. I can save the playbook to a path you choose once the funnel data is in.