---
name: product-launch-playbook
description: "Plan a product or feature launch from positioning to post-launch review: choose a launch tier, fix the message before any copy, run a dated T-minus checklist with owners, prepare submission kits and an incident plan, and measure against the goal."
metadata:
  author: agents-united
  version: 3.0.0
  icon: 🚀
disable-slash-command: true
---

# Product Launch Playbook

## Overview & Purpose
A launch is a coordinated set of dated actions around one message. Most launches fail quietly: the message was not settled before the copy was written, an owner was missing for one asset, nobody planned for the thing that broke on the day, or no one looked at the numbers afterwards. This skill gives the campaign specialist and the growth strategist one shared plan to avoid that.

The lead assembles the team; this skill defines what each role contributes and when.

## Execution Triggers
Load it when a brief names a launch (product, feature, pricing change, integration, rebrand) with a date, or when a launch is already scheduled and needs a plan. Do not use it for always-on social content (use `social-media-campaign`) or for a sequence to existing users (use `email-drip-sequences`).

## Input/Output Requirements
Inputs: what is launching and for whom, the launch date and any fixed constraint (an event, a conference, a contract), what is ready and what is not, the success metric, owners available, channels, the embargo or press rules, and the budget.

Outputs: the positioning brief; the launch tier; the dated checklist with an owner per item; the asset list; submission kits where relevant; the incident and rollback plan; the measurement plan; the post-launch review template. Evidence to attach: the source of each claim in the message, and where the "ready" status of the product came from (who confirmed it).

## Step-by-Step Runbook
1. **Settle positioning before writing anything.** One sentence: "[Product] helps [audience] [outcome] by [mechanism]", plus the single reason to act now. Test it with Ava and Kaan; it must survive a sceptical reading. No copy is drafted until the sentence is approved.
2. **Choose the launch tier**, because effort should match stakes. Tier 1, a new product or major change: full plan, press and community, 14 days of preparation. Tier 2, a notable feature: owned channels and a community post, 7 days. Tier 3, a small improvement: a changelog entry and one post, 1 day. Say the tier and why; the lead can overrule.
3. **Build the checklist backwards from the date**, each item with an owner and a due date. T-14 days: positioning approved, goals set, owners named, assets listed. T-7: copy and creative in review, landing page and tracking live in staging, email scheduled. T-1: everything verified (links, forms, UTM, unsubscribe), support briefed, the incident plan shared. Launch day: sequence of posts and sends with exact times, someone watching. T+1 and T+7: replies answered, numbers read, learnings recorded.
4. **Prepare submission kits** for the community or directory launches you will use: a tagline within the site's limit, a first comment written as the maker, a short honest description, and answers to the three likeliest questions. Never ask people to vote, and never organise voting; most communities ban it and it backfires. Check each site's current rules before submitting, because they change.
5. **Plan for failure.** For each launch-day dependency (the signup, the payment page, the API), name what breaks, who notices, who decides, and the rollback or holding message. Decide the stop rule for scheduled posts if something serious happens.
6. **Measure against the goal.** One primary metric with a number (signups, trials started, qualified leads), one guardrail (support contacts, refund requests), a baseline from the last 28 days, and a decision date. UTM scheme: one `utm_campaign` for the launch, `utm_source` per channel, `utm_content` per asset.
7. **Hand off.** Positioning to Kaan for the landing page; the calendar and posts to the campaign specialist's own matrix via `social-media-campaign`; the user email via `email-drip-sequences`; visuals to Jamileh; build, tracking and rollback to Deniz; verification to Emre; claims, pricing text and legal notices to Defne.

## Code & Config Exemplars
### Worked example
Tier 2 launch (invented): an integration with an accounting tool, launch Tuesday. Goal: 400 connections in 14 days (baseline: 60 per 14 days). Guardrail: support tickets about the integration under 5 percent of connections.

Positioning: "Freelancers who invoice from our tool can now send each invoice to their accounting software, so they enter it once." Reason to act now: launch week offers a guided import.

| When | Item | Owner | Done when |
|---|---|---|---|
| T-7 | landing copy approved | Kaan | positioning sentence appears above the fold |
| T-7 | UTM scheme in staging links | Deniz | links verified by Emre |
| T-1 | support briefed with the three likeliest questions | lead | answers in the help centre draft |
| T-1 | incident plan: connection fails | Deniz | holding message ready, rollback described |
| T0 09:00 | email to existing users (drip 1 of 2) | Jale | scheduled, unsubscribe verified |
| T0 10:00 | community post as the maker, no vote request | founder | posted, someone watching until 18:00 |
| T+7 | read the numbers | Ava | connections vs 400, tickets vs 5 percent |

Incident plan: if the connection page errors for more than 15 minutes, the lead pauses the scheduled posts and publishes the holding message ("we are fixing the connection step; your invoices are safe"); Deniz owns the fix, Emre confirms the repair.

### Anti-patterns
- Writing copy before the message is settled.
- A launch with no owner for the landing page or the tracking.
- Asking for upvotes or arranging a voting ring.
- No plan for the day something breaks.
- A launch tier that ignores the stakes.
- Declaring success by impressions.

## Edge Cases & Error Recovery
- **The date is fixed and the product is not ready**: say what will not be ready, cut scope of the launch (a lower tier) rather than the quality of what ships; the lead decides.
- **An owner is missing**: the item goes to the lead on the checklist, not to "the team".
- **Embargo or press timing**: the date and time zone are written next to every press item; nothing is sent early.
- **A competitor launches the same week**: do not rewrite the message in a panic; check the positioning still holds and, if it does, keep the plan.
- **Results are below the goal at T+7**: record why (message, channel, product) with evidence; hand the next move to Ava as an experiment, not a second launch.

## Verification Checklist
- [ ] The positioning sentence is approved before any copy is drafted.
- [ ] A tier is chosen with a reason; the checklist has T-14, T-7, T-1, T0 and T+7 items, each with an owner and a due date.
- [ ] Submission kits follow the site's current rules and contain no vote request.
- [ ] An incident and rollback plan names who notices, who decides and the holding message.
- [ ] One primary metric with a baseline, one guardrail and a decision date are written down.
- [ ] Hand-offs name Kaan, Jale, Jamileh, Deniz, Emre, Defne and Ava with what each delivers.
