---
name: viral-referral-loops
description: "Design a referral or viral loop with its arithmetic (K-factor, cycle time, reward bounded by CAC), the moments to ask, the qualification and abuse controls, the consent limits, and the spec that engineering and legal can act on."
metadata:
  author: agents-united
  version: 3.0.0
  icon: 🔁
disable-slash-command: true
---

# Viral & Referral Loops

## Overview & Purpose
A loop only matters if it is arithmetic you can defend: how many people each user brings, how fast, at what cost, and how much of it is real. This skill gives the growth strategist the formulas, the design rules and the controls, and ends in a spec that Deniz can build, Defne can review and Emre can verify. It does not write the interface (Jamileh and Deniz do) and it does not choose what personal data may be used (Defne does).

Two kinds of loop exist: a **product loop** (sharing is part of using the product: invites, shared documents, public links, "made with" marks) and an **incentive loop** (a reward for inviting). Prefer the product loop; an incentive loop bolted on to a product people do not recommend produces fraud and cost, not growth.

## Execution Triggers
Load it when the brief asks for a referral program, a viral mechanic, or lower blended CAC through existing users; when activation and day-30 retention are already healthy; or when a program exists and its cost per acquired user is unknown. Do not load it while the funnel leaks before activation (fix `onboarding-cro` first: a loop multiplies whatever the product does to a new user, good or bad).

## Input/Output Requirements
Inputs: the activation event, current invites sent per active user (if any), invite-to-signup and signup-to-activation rates, CAC from paid channels, gross margin per user, what a user's friend gets on arrival.

Outputs: a one-page loop model (K, cycle time, the reward and its cost against CAC), the trigger moments, the qualification rule, the abuse controls, the event list, the consent notes, and the test brief for the first iteration. **Evidence to attach**: where each rate came from (a measurement with its date range, or an assumption marked as one).

## Step-by-Step Runbook
1. **Write the loop as a chain**: a user does X, an invitation reaches a person, the person lands, signs up, activates, and becomes a user who can do X. Every arrow gets a rate you either have or will measure.
2. **Model K and cycle time.** K = i x c: invitations per user (i) times the share of invitations that become activated users (c). K above 1 is self-sustaining and rare; **K of 0.2 to 0.5 is a useful boost to paid and organic acquisition**, not a replacement. Cycle time is days from signup to the invitees' own first invitation: halving it matters more than a 10 percent gain in c.
3. **Bound the reward by economics.** A double-sided reward must cost less than the CAC you would otherwise pay: when the reward is paid on activation, cost per referred activation = referrer reward + referee reward (if you pay earlier, add the rewards that never turn into activated users); require it to stay under half your blended CAC, and under the first year's gross margin per user. If you cannot compute CAC, you cannot set a reward: say so.
4. **Ask at a moment of success**, never during setup or errors: right after a first result is delivered, after a 9 or 10 satisfaction score, after a milestone the user cares about. One prompt per moment, easy to dismiss and not shown again for 30 days after a dismissal.
5. **Qualify rewards on a real action** by the invitee (their first meaningful use, not just signup), hold the reward for 48 hours to 14 days against refunds and chargebacks, and cap rewards per referrer per month.
6. **Specify abuse controls**: no reward for the same device, payment method or workspace domain as the referrer; rate limits on invites; a pending state visible to the referrer; a manual review queue above a threshold. Self-referral and reward farming are the default behaviour of any programme with money in it.
7. **Respect consent.** Never access a user's contacts, scrape addresses or send an invitation on someone's behalf without a clear, specific action by that user; the invitee must be able to opt out of reminders at once. Personal-data and marketing-consent questions go to Defne; do not guess the law of any country.
8. **Hand off.** The spec to Deniz (codes, attribution, ledger, events), Jamileh (the share screen, in the product's own design system), Emre (verify attribution on a blocked-cookie browser and the abuse rules), and the first test to `ab-test-setup`.

## Code & Config Exemplars
### Worked example
A project-planning tool (invented numbers). Active users 4,000; each sends on average i = 1.2 invitations in the first month; 22 percent of invitations become signups and 55 percent of those activate, so c = 0.22 x 0.55 = 0.121; **K = 1.2 x 0.121 = 0.145**. Paid CAC is 48 dollars.

Reward proposal: 10 dollars credit to each side, paid when the invitee completes a first project (that is the activation event). Cost per referred activation = 10 + 10 = 20 dollars, which is under half of 48 (24). A 20-dollar reward on each side would cost 40, inside the CAC but not under half: reject it, or test it as a variant.

What it buys: 4,000 users x 0.145 = about 580 extra activated users from one month's cohort at about 20 dollars each (11,600 dollars), against about 28,000 dollars for the same number from paid. These are estimates from the inputs; the first month's real i and c replace them.

Cycle time: users send their invitations on day 9 on average. Move the prompt to the moment the first plan is shared (day 2): the same K arrives in a third of the time.

Events to instrument:
```
referral_prompt_viewed, referral_link_copied, invite_sent,
referee_landed, referee_signed_up, referee_activated, reward_pending, reward_granted, reward_blocked(reason)
```

### Anti-patterns
- A reward larger than the CAC it replaces.
- Paying on signup instead of on a real action.
- Prompting during onboarding or after an error.
- "Import your contacts" with no explicit, per-action consent.
- Counting invitations sent as growth (the unit is activated users).
- Copying another product's reward without its margin.

## Edge Cases & Error Recovery
- **Attribution lost** (blocked cookies, link opened on another device): add a manual code field at signup and match by server-side session; report the share of unattributed activations instead of ignoring it.
- **Existing user clicks an invitation**: say rewards apply to new accounts and send them to their own invite screen.
- **Fraud spike**: pause rewards, keep granting nothing silently, tell affected users the reason, review pending rewards; the pause is the lead's decision, you recommend it.
- **K measured below 0.05 after two cycles**: the product is not shared; drop the incentive and look for a product loop instead.
- **Employees or partners in the pool**: exclude them from K and cost.

## Verification Checklist
- [ ] The chain from user to new user has a rate on every arrow, each marked measured or assumed.
- [ ] K and cycle time are computed with the arithmetic shown; the reward cost per activation is compared with CAC.
- [ ] Rewards are qualified on a real action, held, and capped.
- [ ] Abuse controls and the consent limits are written, and Defne is named for the consent review.
- [ ] Every figure not computed from data you read is labelled an estimate.
- [ ] Hand-offs name Deniz, Jamileh, Emre and `ab-test-setup` with what each delivers.
