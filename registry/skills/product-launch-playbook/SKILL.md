---
name: product-launch-playbook
description: "Use when a brief names a launch (product, feature, pricing change, integration, rebrand) with a date, or a scheduled launch needs a plan; trigger phrases: plan our product launch, launch checklist, we launch on Tuesday, what do we need before launch day, what if something breaks on launch day. Produces the positioning brief, the launch tier, a dated T-minus checklist with owners, submission kits, an incident and rollback plan, the measurement plan and a post-launch review. Skip it for always-on social content (use social-media-campaign) and for a sequence to existing users (use email-drip-sequences)."
metadata:
  author: agents-united
  version: 3.0.0
  icon: 🚀
disable-slash-command: true
---

# Product Launch Playbook

A launch is a coordinated set of dated actions around one message. Most fail quietly: the message was not settled before the copy, an asset had no owner, nobody planned for what broke on the day, or no one read the numbers afterwards.

## Overview & Purpose
One shared plan for the campaign specialist and the growth strategist. The lead assembles the team; this skill defines what each role contributes and when.

## Execution Triggers
Load it when a brief names a launch (product, feature, pricing change, integration, rebrand) with a date, or a launch is scheduled and needs a plan. Do not use it for always-on social content (`social-media-campaign`) or a sequence to existing users (`email-drip-sequences`).

## Input/Output Requirements
Inputs: what launches and for whom; the date and any fixed constraint (an event, a conference, a contract); what is ready and what is not; the success metric; owners available; channels; embargo or press rules; budget.

Output: the positioning brief; the launch tier; the dated checklist with an owner per item; the asset list; submission kits where relevant; the incident and rollback plan; the measurement plan; the post-launch review. **Evidence to attach**: the source of each claim in the message, and who confirmed the product is ready.

## Step-by-Step Runbook
1. **Settle positioning before writing anything**: "[Product] helps [audience] [outcome] by [mechanism]", plus the single reason to act now. Test it with Ava and Kaan; it must survive a sceptical reading. No copy is drafted until the sentence is approved.
2. **Choose the launch tier**, so effort matches stakes. Tier 1, a new product or major change: full plan, press and community, 14 days of preparation. Tier 2, a notable feature: owned channels and a community post, 7 days. Tier 3, a small improvement: a changelog entry and one post, 1 day. Say the tier and why; the lead can overrule.
3. **Build the checklist backwards from the date**, each item with an owner and a due date: T-14, T-7, T-1, launch day, T+1 and T+7. The items are in [references/launch-checklists.md](references/launch-checklists.md).
4. **Prepare submission kits** for community or directory launches (contents in the reference). Never ask people to vote or organise voting: most communities ban it and it backfires. Check each site's current rules first.
5. **Plan for failure.** For each launch-day dependency (the signup, the payment page, the API) name what breaks, who notices, who decides, and the rollback or holding message. Decide the stop rule for scheduled posts if something serious happens.
6. **Measure against the goal**: one primary metric with a number, one guardrail (support contacts, refund requests), a baseline from the last 28 days and a decision date. One `utm_campaign` for the launch, `utm_source` per channel, `utm_content` per asset.
7. **Hand off.** Positioning to Kaan for the landing page; calendar and posts via `social-media-campaign`, the user email via `email-drip-sequences`; visuals to Jamileh; build, tracking and rollback to Deniz; verification to Emre; claims, pricing text and legal notices to Defne.

## Code & Config Exemplars
Load [examples/worked-example.md](examples/worked-example.md) for a tier 2 launch: its goal, positioning, checklist rows and incident plan.

Anti-patterns, each with its reason:
- Copy written before the message is settled: it is rewritten, late.
- No owner for the landing page or the tracking: each becomes someone's assumption.
- Asking for upvotes or arranging a voting ring: the community bans it and the launch pays.
- No plan for the day something breaks: the decision is made in a panic.
- A tier that ignores the stakes: too much work for a small change, too little for a big one.
- Success declared by impressions: they do not show the goal moved.

## Edge Cases & Error Recovery
- **The date is fixed and the product is not ready**: say what will not be ready and cut the scope of the launch (a lower tier) rather than the quality of what ships; the lead decides.
- **An owner is missing**: the item goes to the lead on the checklist, not to "the team".
- **Embargo or press timing**: the date and time zone sit next to every press item; nothing is sent early.
- **A competitor launches the same week**: do not rewrite the message in a panic; check the positioning still holds and, if it does, keep the plan.
- **Results are below the goal at T+7**: record why (message, channel, product) with evidence; hand the next move to Ava as an experiment, not a second launch.

## Verification Checklist
- [ ] The positioning sentence is approved before any copy is drafted.
- [ ] A tier is chosen with a reason; the checklist has T-14, T-7, T-1, T0 and T+7 items, each with an owner and a due date.
- [ ] Submission kits follow the site's current rules and contain no vote request.
- [ ] An incident and rollback plan names who notices, who decides and the holding message.
- [ ] One primary metric with a baseline, one guardrail and a decision date are written down.
- [ ] Hand-offs name Kaan, Jale, Jamileh, Deniz, Emre, Defne and Ava with what each delivers.
