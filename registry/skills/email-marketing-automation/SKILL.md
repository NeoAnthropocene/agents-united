---
name: email-marketing-automation
description: "Specify lifecycle email automation that reaches the inbox and stays lawful: sender authentication, consent and suppression, segmentation, triggers and frequency caps, one-click unsubscribe, and the metrics that show it works."
metadata:
  author: agents-united
  version: 3.0.0
  icon: ✉️
disable-slash-command: true
---

# Email Marketing Automation

## Overview & Purpose
Automation sends the right message when something happens: a signup, a milestone, a lapse. It also multiplies mistakes: a wrong trigger emails every user, a missing suppression list emails people who left. This skill gives the campaign specialist the order of work for a lifecycle programme: authenticate, consent, segment, trigger, cap, measure.

It specifies and writes copy briefs. The campaign specialist does not hold the email service account, does not send, and does not give legal advice: consent and regional law go to Defne.

## Execution Triggers
Load it when a brief asks for welcome, activation, win-back or promotional flows, automation rules, or a deliverability problem (open rates collapse, mail lands in spam). Do not load it for a one-off announcement (a single send needs only the footer checklist) or for transactional mail (receipts and security notices are not marketing and follow other rules; say so).

## Input/Output Requirements
Inputs: the lifecycle stages and the events that mark them, the sending domain and what authentication exists, the email service in use, the list sources and how consent was collected, current volumes and complaint or unsubscribe rates if known, and the business goal for each flow.

Outputs: a flow map (trigger, audience, exit condition, steps with delays), a suppression and consent specification, a frequency policy, the authentication checklist, the compliance footer checklist per message, the measurement plan, and a test plan. Evidence to attach: what you read to establish the current state (DNS records someone gave you, a sample header, a dashboard export) or the statement that you did not see them.

## Step-by-Step Runbook
1. **Confirm authentication before designing flows.** The sending domain should publish SPF and DKIM and a DMARC policy (start at monitoring, move to enforcement once reports are clean). Large mailbox providers require this, plus one-click unsubscribe and a low spam-complaint rate, from bulk senders; treat a complaint rate above 0.1 percent as a warning and 0.3 percent as an emergency. If you cannot see the records, make "verify SPF, DKIM, DMARC" the first task and name its owner (Deniz or the client's IT).
2. **Define consent and suppression.** Mail only people who agreed, to the kind of mail they agreed to. A global suppression list (unsubscribed, bounced, complained, deleted) must be checked before every send by every flow; an unsubscribe applies to all marketing flows within a stated time. Where consent for a region is unclear, stop and ask Defne.
3. **Segment by behaviour, not by guess.** Use events (created a project, did not return in 7 days, hit a plan limit). A segment must have a rule a developer can implement and a size you can check.
4. **Design each flow with an exit condition**: purchase, activation, unsubscribe or reply ends the sequence immediately. A person who has already done the thing must not receive the email that asks them to.
5. **Cap frequency across flows**, not within one: for example no more than one marketing email in 24 hours and a stated weekly maximum, and a priority order when two flows fire together (activation outranks promotion).
6. **Specify send mechanics**: local-time sending where useful, one-click unsubscribe header (RFC 8058) plus a visible unsubscribe link, a plain-text part, sender name a person recognises, reply-to monitored. Tag every link with the four UTM fields.
7. **Plan measurement** that does not lie: opens are unreliable because of mail privacy features, so judge by clicks, activation and revenue per recipient, plus unsubscribe and complaint rates as guardrails. Test one thing at a time (subject, send time) with `ab-test-setup`.
8. **Hand off.** Flow rules and events to Deniz; copy for each email to Kaan or the campaign specialist's own drafting with `email-drip-sequences`; layout to Jamileh; the authentication and consent questions to Defne and the client's IT; verification (links, unsubscribe, rendering) to Emre.

## Code & Config Exemplars
### Worked example
A SaaS tool, 18,000 contacts, sending from a shared service. Current complaint rate 0.18 percent (from the dashboard export the client attached). DMARC at `p=none`, no reports reviewed.

Findings: complaint rate above the 0.1 percent warning line; activation emails still go to people who activated; no cross-flow cap. Plan: (1) the client's IT verifies SPF and DKIM alignment and begins reading DMARC reports for two weeks, then moves to `p=quarantine`; (2) suppress anyone with the activation event from the onboarding flow, evidence: check on a sample of 50 recipients; (3) a 24-hour, 3-per-week cap, activation beats win-back; (4) win-back runs only for users inactive 30 days, two emails, exit on any login.

```text
FLOW   win-back
TRIGGER no login for 30 days AND plan = free or trial AND not suppressed
EXIT    login | upgrade | unsubscribe | complaint
STEP 1  day 0,  send 09:30 local, subject <=50 chars, one CTA "Open your workspace"
STEP 2  day 5,  only if no login, one CTA "Tell us what stopped you" (reply-to monitored)
CAP     max 1 marketing email / 24h, 3 / week across all flows; priority activation > win-back > promo
FOOTER  postal address, visible unsubscribe, one-click header, sender identity (see checklist)
```

### Anti-patterns
- Building flows on a domain whose authentication nobody has checked.
- Judging success by open rate.
- Sending the "get started" email to people who already started.
- Treating an unsubscribe in one flow as irrelevant to the others.
- Buying or scraping lists.
- Giving legal conclusions instead of handing the question to Defne.

## Edge Cases & Error Recovery
- **Complaint rate rising**: pause promotional flows (recommend; the lead decides), keep transactional mail, find which flow and segment drive it, tighten the audience before the copy.
- **Bounces above about 2 percent**: remove hard bounces, check the list source, and do not re-send to old addresses.
- **Two flows fire the same day**: apply the priority order, never send both.
- **Time zone unknown**: send at a fixed hour in the audience's main zone and say so.
- **Consent record missing for a segment**: exclude it until Defne confirms.

## Verification Checklist
- [ ] Authentication (SPF, DKIM, DMARC) is verified or listed as the first task with an owner.
- [ ] Every flow has a trigger, an audience rule, an exit condition and a delay per step.
- [ ] A suppression check and a frequency cap with a priority order apply across all flows.
- [ ] Each message carries the compliance footer checklist, a visible unsubscribe and a one-click header, and four UTM tags per link.
- [ ] Success is measured by clicks, activation or revenue; opens are not the primary metric.
- [ ] Hand-offs name Deniz, Kaan, Jamileh, Defne and Emre; legal questions are not answered by this skill.
