# Worked example (invented numbers, for checking your own work)

A project-planning tool. Active users 4,000; each sends on average i = 1.2 invitations in the first month; 22 percent of invitations become signups and 55 percent of those activate, so c = 0.22 x 0.55 = 0.121; **K = 1.2 x 0.121 = 0.145**. Paid CAC is 48 dollars.

## The reward, checked against CAC

Proposal: a 10-dollar credit to each side, paid when the invitee completes a first project (that is the activation event). Cost per referred activation = 10 + 10 = 20 dollars, which is under half of 48 (24). A 20-dollar reward on each side would cost 40: inside the CAC but not under half, so reject it or test it as a variant.

## What it buys

4,000 users x 0.145 = about 580 extra activated users from one month's cohort, at about 20 dollars each (11,600 dollars), against about 28,000 dollars for the same number from paid. These are estimates from the inputs; the first month's real i and c replace them.

## Cycle time

Users send their invitations on day 9 on average. Move the prompt to the moment the first plan is shared (day 2): the same K arrives in under a quarter of the time (2 days instead of 9).

## Events to instrument

```text
referral_prompt_viewed, referral_link_copied, invite_sent,
referee_landed, referee_signed_up, referee_activated, reward_pending, reward_granted, reward_blocked(reason)
```
