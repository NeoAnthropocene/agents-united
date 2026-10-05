---
name: email-drip-sequences
description: "Use when writing a welcome, activation, trial, nurture, launch or win-back sequence of three to five emails; trigger phrases: write a welcome sequence, draft a trial drip, onboarding emails for new signups, nurture emails, write subject lines and previews for the sequence. Produces, per email, the purpose, send day, subject, preview, body, one call to action, a UTM link and an exit rule, plus a sequence table. Skip it for a newsletter (no goal, no exit), for transactional mail, and until email-marketing-automation has settled consent and suppression for the audience."
metadata:
  author: agents-united
  version: 3.0.0
  icon: 💧
disable-slash-command: true
---

# Email Drip Sequences

A drip is a short conversation with a goal, not a schedule of announcements: each email does one job, the sequence stops when the goal is met, and the reader can always tell why they are receiving it.

## Overview & Purpose
The writing and sequencing half. `email-marketing-automation` covers authentication, consent, caps and the flow rules around it.

## Execution Triggers
Load it for a welcome, activation, trial, nurture, launch or win-back sequence of three to five emails. Do not use it for a newsletter (no goal, no exit), for transactional mail, or before `email-marketing-automation` has settled consent and suppression for the audience.

## Input/Output Requirements
Inputs: the goal as one event ("creates a first project"), the segment and what it has already done, the product facts and proof available, the sender, voice samples, the earliest and latest the sequence may run.

Output per email: purpose, send day, subject (40 to 50 characters as a working limit), preview text (a continuation of the subject, not a repeat), body, one call to action, a UTM-tagged link and the exit rule; plus the sequence table. Shapes: [examples/templates.md](examples/templates.md). **Evidence to attach**: where each product fact and proof point comes from.

## Step-by-Step Runbook
1. **State the goal and the exit.** The sequence ends the moment the goal event happens, the person unsubscribes, replies with a question or buys. Write it at the top; the flow is built from it.
2. **Give each email one purpose** from the arc: help them start (welcome and a first step), show it working (a short proof), remove the next objection, offer help from a person, ask for the decision with a real deadline if there is one. Never repeat a purpose.
3. **Space by the reader's need**: day 0, then 2 to 3 days between early emails, longer later, never faster than the person can act on the last one. For a time-limited trial, tie the last email to the real end date.
4. **Write the subject and preview as a pair.** The subject states the reason in plain words; the preview adds the second half. No all caps, no false "Re:", no urgency that is not true.
5. **Write the body for one action**: one idea, short paragraphs, the call to action a verb plus the outcome, one link for it. Say who is sending and why the person gets it.
6. **Tag every link** with `utm_source`, `utm_medium`, `utm_campaign` and `utm_content` (the email number), keeping the campaign's existing naming scheme.
7. **Hand off.** The table and exit rules to Deniz or whoever builds the flow; layout to Jamileh; conversion-critical copy review to Kaan; the footer and consent check to Defne. Emre verifies links and the exit after a first send to a test address.

## Code & Config Exemplars
Load [examples/worked-example.md](examples/worked-example.md) for a four-email trial drip with its table, its exit rules and the first email's body.

Anti-patterns, each with its reason:
- Four emails, four calls to action, no single goal: the reader cannot tell what to do.
- The proof email sent to someone who already started: it shows the sequence is not listening.
- A last email with a false deadline: it spends trust for one conversion.
- Subject lines that promise what the body does not give: opens turn into complaints.
- Links without UTM tags: nothing is attributable.
- No exit rule: converted users keep receiving the pitch.

## Edge Cases & Error Recovery
- **The first email arrives after the person already acted**: the flow evaluates the goal event at send time, not only at entry.
- **Unknown first name**: use a neutral fallback ("Hi there"), never the raw token.
- **The sequence overlaps another flow**: follow the priority order from `email-marketing-automation` and hold the lower-priority email.
- **Low reply or click rate after two sends**: change the purpose or the audience before the subject line.
- **Proof you cannot source**: do not use it; ask Yavuz or the client for a real example.

## Verification Checklist
- [ ] A single goal event and the exit conditions are written at the top.
- [ ] Each email has one purpose, one call to action, a subject and a distinct preview text.
- [ ] Spacing and any deadline are real and stated.
- [ ] Every link carries the four UTM fields with a distinct `utm_content` per email.
- [ ] Each fact or proof point has a source in the evidence list.
- [ ] Hand-offs name the builder, Jamileh, Kaan, Defne and Emre.
