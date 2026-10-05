---
name: email-marketing-automation
description: "Use when a brief asks for welcome, activation, win-back or promotional email flows, automation rules, or a deliverability problem; trigger phrases: set up our email automation, build a welcome flow, win-back emails, our open rates collapsed, emails are landing in spam. Produces a flow map, suppression and consent spec, frequency policy, authentication and footer checklists, and a measurement and test plan. Skip it for a one-off announcement (a single send needs only the footer checklist) and for transactional mail (receipts and security notices follow other rules)."
metadata:
  author: agents-united
  version: 3.0.0
  icon: ✉️
disable-slash-command: true
---

# Email Marketing Automation

Automation sends the right message when something happens, and it multiplies mistakes: a wrong trigger emails every user, a missing suppression list emails people who left. The order of work: authenticate, consent, segment, trigger, cap, measure.

## Overview & Purpose
For the campaign specialist, who specifies and writes copy briefs. It holds no email service account, sends nothing and gives no legal advice: consent and regional law go to Defne.

## Execution Triggers
Load it when a brief asks for welcome, activation, win-back or promotional flows, automation rules, or a deliverability problem (open rates collapse, mail lands in spam). Do not load it for a one-off announcement (a single send needs only the footer checklist) or transactional mail (receipts and security notices are not marketing: say so).

## Input/Output Requirements
Inputs: lifecycle stages and the events that mark them; the sending domain and its authentication; the email service; list sources and how consent was collected; complaint and unsubscribe rates if known; the goal per flow.

Output: a flow map (trigger, audience, exit condition, steps with delays); a suppression and consent specification; a frequency policy; the authentication checklist; the footer checklist per message; the measurement plan; a test plan. **Evidence to attach**: what you read (DNS records, a sample header, a dashboard export), or that you saw none.

## Step-by-Step Runbook
1. **Confirm authentication before designing flows**: SPF, DKIM and a DMARC policy (monitoring first, enforcement once reports are clean). Complaints above 0.1 percent are a warning, 0.3 percent an emergency. If you cannot see the records, "verify SPF, DKIM, DMARC" is the first task, with an owner (Deniz or the client's IT).
2. **Define consent and suppression.** Mail only people who agreed, to the kind of mail they agreed to. A global suppression list (unsubscribed, bounced, complained, deleted) is checked before every send by every flow, and an unsubscribe applies to all marketing flows within a stated time. Unclear regional consent: stop and ask Defne.
3. **Segment by behaviour, not by guess**: events (created a project, no return in 7 days, hit a plan limit). A segment needs a rule a developer can implement and a size you can check.
4. **Give every flow an exit condition**: purchase, activation, unsubscribe or reply ends it at once. Someone who has done the thing must not get the email that asks them to.
5. **Cap frequency across flows**, not within one: for example one marketing email in 24 hours, a stated weekly maximum, and a priority order when flows collide (activation outranks promotion).
6. **Specify send mechanics**: local-time sending where useful, plus the footer checklist in [references/deliverability.md](references/deliverability.md).
7. **Measure without lying**: opens are unreliable under mail privacy features, so judge by clicks, activation and revenue per recipient, with unsubscribe and complaint rates as guardrails. Test one thing at a time with `ab-test-setup`.
8. **Hand off.** Flow rules and events to Deniz; copy to Kaan or your own drafting with `email-drip-sequences`; layout to Jamileh; authentication and consent questions to Defne and the client's IT; verification (links, unsubscribe, rendering) to Emre.

## Code & Config Exemplars
Load [examples/worked-example.md](examples/worked-example.md) for a flow audit (18,000 contacts, 0.18 percent complaints), its plan and a win-back flow to copy; [references/deliverability.md](references/deliverability.md) has the authentication and footer checklists.

Anti-patterns, each with its reason:
- Flows on a domain nobody has authenticated: the mail may never reach the inbox.
- Open rate as the measure of success: privacy features inflate it.
- The "get started" email to people who started: it shows nobody is listening.
- An unsubscribe in one flow ignored by the others: it breaks the promise made.
- Buying or scraping lists: no consent, and complaints follow.
- Legal conclusions instead of a hand-off to Defne: not this role's job.

## Edge Cases & Error Recovery
- **Complaint rate rising**: recommend pausing promotional flows (the lead decides), keep transactional mail, find the flow and segment behind it, tighten the audience before the copy.
- **Bounces above about 2 percent**: remove hard bounces, check the list source, never re-send to old addresses.
- **Two flows fire the same day**: apply the priority order; never send both.
- **Time zone unknown**: send at a fixed hour in the audience's main zone and say so.
- **Consent record missing for a segment**: exclude it until Defne confirms.

## Verification Checklist
- [ ] Authentication (SPF, DKIM, DMARC) is verified, or listed as the first task with an owner.
- [ ] Every flow has a trigger, an audience rule, an exit condition and a delay per step.
- [ ] A suppression check and a frequency cap with a priority order apply across all flows.
- [ ] Each message carries the footer checklist; success is clicks, activation or revenue, not opens.
- [ ] Hand-offs name Deniz, Kaan, Jamileh, Defne and Emre; legal questions are not answered here.
