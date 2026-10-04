---
name: social-media-campaign
description: "Plan and write a social campaign in shapes native to each platform: one claim per post, source material first, a calendar with owners, disclosure of paid content, no engagement bait, a response plan and measurement."
metadata:
  author: agents-united
  version: 3.0.0
  icon: 📣
disable-slash-command: true
---

# Social Media Campaign

## Overview & Purpose
A campaign is a message, told in the form each platform's readers expect, on a schedule, with a plan for what happens when people answer. Resizing one post for five networks is not a campaign. This skill gives the campaign specialist the order of work and the rules that keep a campaign honest.

The campaign specialist drafts and plans. Nothing is posted by this role: publishing is the client's or the lead's act, with their accounts. Visuals belong to Jamileh and claims review to Defne.

## Execution Triggers
Load it for a launch announcement matrix, an always-on content plan, an event or a feature-adoption push. Do not use it for paid ad creative (use `ad-creative-design`), or for a long-form content plan (use `content-calendar-strategy`).

## Input/Output Requirements
Inputs: the campaign goal as one measurable outcome, the audience and where they already are, the one message, source material (posts, articles, product demos, changelog, quotes), the channels the client actually operates, who approves, and the dates.

Outputs: a campaign brief (goal, audience, message, channels, success metric); a matrix of posts per platform with angle, copy, asset need and call to action; a dated calendar with owners and approval step; disclosure notes; a response plan; the measurement plan with UTM scheme. Evidence to attach: the source of each fact or number used in a post.

## Step-by-Step Runbook
1. **Start from source material, not from a formula.** What did the team actually build, measure or learn? A post is the smallest true thing worth telling about it.
2. **One claim per post.** If a post needs "and also", it is two posts. Write the claim first, then the shape.
3. **Use the platform-native shape.** Short and concrete on X (the claim first, then the proof). Professional networks: enough context for someone outside the niche, no fake lesson. Community forums: an honest question or a post-mortem, written as a member, no sales language. Video: show the result in the first seconds, script the visual sequence. A thread, a post and a video of the same news are three pieces, each making its claim in its own form.
4. **Plan the calendar around moments**, not slots: a release, an event, a customer story, a result. Put the pillar piece first, derivatives after, and a gap for reacting to what happens.
5. **Disclose.** Paid, sponsored, affiliate or gifted content is labelled as such in the place the platform expects; employees and partners say who they work for. A false or buried disclosure is a reason to stop (Defne).
6. **No engagement bait.** No "comment YES for the guide", no fake polls, no tagging people who did not agree to it, no asking for shares or votes in exchange for nothing, no purchased engagement.
7. **Write the response plan before the first post**: who watches replies and for how long, what gets answered, what escalates to the lead (complaints, press, legal, a crisis), what is never deleted, and a pause rule (stop scheduled posts when something serious happens).
8. **Measure what the goal is**: clicks to the campaign page via UTM, signups or replies, not impressions alone. Name one primary metric and a guardrail (unfollows, negative replies).
9. **Hand off.** Visual briefs to Jamileh (sizes per platform), landing-page copy to Kaan, content pieces from Yavuz's calendar, claims and disclosure to Defne, link and UTM checks to Emre. The lead decides when to post.

## Code & Config Exemplars
### Worked example
Launch of a webhook-retry feature. Source material: the changelog, a measurement (retries now recover 94 percent of failed deliveries in a staging test of 10,000 events, invented here), and one customer quote.

Message: "Failed webhooks now recover on their own." One claim, one proof.

| Platform | Shape | Copy (excerpt) | Asset | CTA |
|---|---|---|---|---|
| X | claim then proof | "Failed webhooks now retry on their own. In a staging test of 10,000 events, 94% recovered with no code on your side." | one chart | link to the guide, UTM tagged |
| LinkedIn | short story | "Last year one of our customers lost a day to a missed webhook. We built retries so the next team does not." | founder photo, no stock image | link, UTM tagged |
| Community forum | post-mortem as a member | "How we designed retry backoff and what we got wrong first" | none | the guide, no sales pitch |
| Short video | result first | 0:00 failed event, 0:04 it retries, 0:10 delivered | screen recording | pinned link |

Response plan: the campaign specialist's brief names the client's support lead as the person who answers technical replies within one working day; "this lost me data" replies escalate to the lead the same day; no post is deleted except for abuse. Metric: guide visits from the campaign UTM; guardrail: negative replies share.

```text
utm_source=<platform> utm_medium=social utm_campaign=webhook-retries utm_content=<post-id>
```

### Anti-patterns
- The same text, five sizes.
- Three claims in one post.
- "Comment to get the link" to farm replies.
- Posting with no one watching the replies.
- Impressions as the success metric.
- An undisclosed sponsored mention.

## Edge Cases & Error Recovery
- **A crisis or tragedy lands on a scheduled day**: recommend pausing the schedule; the lead decides.
- **A negative reply with a valid point**: reply once, correct what is wrong, move the rest to support; do not argue publicly.
- **A platform changes its format**: use the format that works now; do not invest in a deprecated one.
- **A claim cannot be sourced**: the post waits (Defne and Yavuz).
- **No approval path**: the campaign brief names the approver; nothing is scheduled without one.

## Verification Checklist
- [ ] One goal, one message, one primary metric and one guardrail.
- [ ] Each post makes one claim in its platform's native shape, with its source in the evidence list.
- [ ] Paid, sponsored or affiliate content has a disclosure note per post.
- [ ] A response plan names who watches, for how long, and what escalates.
- [ ] Every link is UTM-tagged; no post asks for engagement as a favour.
- [ ] Hand-offs name Jamileh, Kaan, Yavuz, Defne and Emre; the lead owns the posting decision.
