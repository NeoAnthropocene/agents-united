---
name: viral-referral-loops
description: "Use when the brief asks for a referral program, a viral mechanic or lower blended CAC through existing users, activation and day-30 retention are already healthy, or a program exists and its cost per acquired user is unknown; trigger phrases: build a referral program, how do we get users to invite others, what reward should we offer, what is our viral coefficient. Produces a one-page loop model (K, cycle time, reward against CAC), trigger moments, abuse and consent controls, the event list and a first test brief. Skip it while the funnel leaks before activation (fix onboarding-cro first)."
metadata:
  author: agents-united
  version: 3.0.0
  icon: 🔁
disable-slash-command: true
---

# Viral & Referral Loops

A loop only matters if its arithmetic is defensible: people brought per user, how fast, at what cost, how much of it is real. Prefer a **product loop** (sharing is part of using the product) to an **incentive loop** (a reward for inviting): bolted onto a product people do not recommend, a reward buys fraud and cost, not growth.

## Overview & Purpose
For the growth strategist. It ends in a spec Deniz can build, Defne can review and Emre can verify; it writes no interface (Jamileh, Deniz) and decides no personal-data use (Defne).

## Execution Triggers
Load it when the brief asks for a referral program, a viral mechanic or lower blended CAC through existing users, activation and day-30 retention are healthy, or a program's cost per acquired user is unknown. Not while the funnel leaks before activation: fix `onboarding-cro` first, since a loop multiplies whatever the product does to a new user.

## Input/Output Requirements
Inputs: the activation event, invites sent per active user, invite-to-signup and signup-to-activation rates, paid CAC, gross margin per user, what a friend gets on arrival.

Output: a one-page loop model (K, cycle time, the reward and its cost against CAC); trigger moments; the qualification rule; abuse controls; the event list; consent notes; the first test brief. **Evidence to attach**: where each rate came from (a measurement with its date range, or an assumption marked as one).

## Step-by-Step Runbook
1. **Write the loop as a chain**: a user does X, an invitation reaches a person, who lands, signs up, activates and becomes a user who can do X. Every arrow gets a rate you have or will measure.
2. **Model K and cycle time.** K = i x c: invitations per user times the share of invitations that become activated users. K above 1 is self-sustaining and rare; **K of 0.2 to 0.5 is a useful boost to paid and organic acquisition**, not a replacement. Cycle time is days from signup to the invitees' own first invitation: halving it beats a 10 percent gain in c.
3. **Bound the reward by economics.** Cost per referred activation = referrer reward + referee reward (add rewards paid before activation that never convert). Keep it under half the blended CAC and under the first year's gross margin per user. No CAC, no reward: say so.
4. **Ask at a moment of success**, never during setup or errors; one prompt per moment, dismissible, not shown again for 30 days after a dismissal (the moments are in [references/controls.md](references/controls.md)).
5. **Qualify rewards on a real action** by the invitee (first meaningful use, not signup), hold the reward 48 hours to 14 days against refunds and chargebacks, and cap rewards per referrer per month.
6. **Specify abuse controls** from [references/controls.md](references/controls.md): self-referral and reward farming are the default behaviour of any programme with money in it, so the controls ship with the reward.
7. **Respect consent.** Never access contacts, scrape addresses or invite on someone's behalf without a clear, specific action by that user; invitees can opt out of reminders at once. Consent questions go to Defne; do not guess any country's law.
8. **Hand off.** The spec to Deniz (codes, attribution, ledger, events), Jamileh (the share screen) and Emre (attribution on a blocked-cookie browser, the abuse rules); the first test to `ab-test-setup`.

## Code & Config Exemplars
Load [examples/worked-example.md](examples/worked-example.md) for a full loop model: K, a reward checked against CAC, what it buys against paid, cycle time and the event list.

Anti-patterns, each with its reason:
- A reward larger than the CAC it replaces: every referral loses money.
- Paying on signup, not a real action: it pays for accounts nobody uses.
- Prompting during onboarding or after an error: the person is least willing to recommend then.
- "Import your contacts" with no per-action consent: the fastest route to a privacy complaint.
- Counting invitations sent as growth: the unit is activated users.
- Copying another product's reward: sized to a different margin and CAC.

## Edge Cases & Error Recovery
- **Attribution lost** (blocked cookies, another device): add a manual code field at signup, match by server-side session, report the unattributed share.
- **An existing user clicks an invitation**: rewards apply to new accounts; send them to their own invite screen.
- **A fraud spike**: pause rewards, grant nothing silently, tell affected users why, review pending rewards; the lead decides the pause, you recommend it.
- **K below 0.05 after two cycles**: the product is not shared; drop the incentive, look for a product loop.
- **Employees or partners in the pool**: exclude them from K and cost.

## Verification Checklist
- [ ] The chain from user to new user has a rate on every arrow, marked measured or assumed.
- [ ] K and cycle time are computed with the arithmetic shown; reward cost per activation is compared with CAC.
- [ ] Rewards are qualified, held and capped; abuse controls and consent limits are written, with Defne named.
- [ ] Every figure not computed from data you read is labelled an estimate.
- [ ] Hand-offs name Deniz, Jamileh, Emre and `ab-test-setup` with what each delivers.
