---
name: email-drip-sequences
description: "Write a three to five email drip with one purpose per email, subject and preview text that earn the open, spacing and exit conditions that respect the reader, and UTM-tagged links, ready for the automation to be built."
metadata:
  author: agents-united
  version: 3.0.0
  icon: 💧
disable-slash-command: true
---

# Email Drip Sequences

## Overview & Purpose
A drip is a short conversation with a goal, not a schedule of announcements. Each email does one job, the sequence stops when the goal is met, and the reader can always tell why they are receiving it. This skill is the writing and sequencing half; `email-marketing-automation` covers authentication, consent, caps and the flow rules around it.

## Execution Triggers
Load it for a welcome, activation, trial, nurture, launch or win-back sequence of three to five emails. Do not use it for a newsletter (no goal and no exit), for transactional mail, or before `email-marketing-automation` has settled consent and suppression for the audience.

## Input/Output Requirements
Inputs: the goal as one event ("creates a first project"), the segment and what they have already done, the product facts and proof available, the sender, voice samples, and the earliest and latest the sequence may run.

Outputs per email: purpose, send day, subject (40 to 50 characters as a working limit), preview text (a continuation of the subject, not a repeat), body, one call to action, UTM-tagged link, and the exit rule. Plus the sequence summary table. **Evidence to attach**: where each product fact and proof point comes from.

## Step-by-Step Runbook
1. **State the goal and the exit.** The sequence ends the moment the goal event happens, the person unsubscribes, replies with a question, or buys. Write it at the top; the flow is built from it.
2. **Give each email one purpose** from the arc: help them start (welcome and first step), show it working (a short proof), remove the next objection, offer help from a person, ask for the decision with a real deadline if there is one. Do not repeat a purpose.
3. **Space by the reader's need.** Day 0, then 2 to 3 days between early emails, longer later; never faster than the person can act on the previous one. For a time-limited trial, tie the last email to the real end date.
4. **Write the subject and preview as a pair.** The subject states the reason in plain words; the preview adds the second half. No all caps, no false "Re:", no urgency that is not true.
5. **Write the body for one action.** One idea, short paragraphs, the call to action as a verb plus the outcome, one link for it. Say who is sending and why the person is getting it.
6. **Tag every link** with `utm_source`, `utm_medium`, `utm_campaign` and `utm_content` (the email number). Keep the naming scheme the campaign already uses.
7. **Hand off.** The table and the exit rules to Deniz or whoever builds the flow; layout to Jamileh; conversion-critical copy review to Kaan; the footer and consent check to Defne. Emre verifies links and the exit after the first send to a test address.

## Code & Config Exemplars
### Worked example
Goal: a new trial user creates a first project. Segment: trial, no project, signed up today.

| # | Day | Purpose | Subject | Preview | CTA |
|---|---|---|---|---|---|
| 1 | 0 | start | "Your first project in 2 minutes" | "Pick a template and add one task." | Open a template |
| 2 | 2 | proof | "How a 4-person agency planned a launch here" | "From blank page to a shared plan in one afternoon." | See the plan |
| 3 | 5 | objection | "Is it hard to move over from spreadsheets?" | "Import your sheet; most take under 10 minutes." | Import a sheet |
| 4 | 9 | help | "Want a 15-minute walkthrough?" | "A person, not a video." | Book a time |

Exit: creates a project, upgrades, unsubscribes, or replies. Email 4 is skipped for anyone who opened a project, and email 2 is skipped if email 1 led to a project.

Email 1 body (excerpt):
```text
Hi {{first_name|there}},

You signed up today, so the quickest way to see if this fits is to make one project.
Pick a template, add a task, and you have a shared plan.

Open a template: https://example.com/start?utm_source=email&utm_medium=lifecycle&utm_campaign=trial-drip&utm_content=e1

Reply to this email if something is unclear; it reaches a person.
```

### Anti-patterns
- Four emails, four calls to action, no single goal.
- Sending the proof email to someone who already started.
- A last email with a false deadline.
- Subject lines that promise what the body does not give.
- Links without UTM tags, so nothing is attributable.
- No exit rule, so converted users keep receiving the pitch.

## Edge Cases & Error Recovery
- **The first email arrives after the person already acted**: the flow must evaluate the goal event at send time, not only at entry.
- **Unknown first name**: use a neutral fallback ("Hi there"), never the raw token.
- **The sequence overlaps another flow**: follow the priority order from `email-marketing-automation`; hold the lower-priority email.
- **Low reply or click rate after two sends**: change the purpose or the audience before you change the subject line.
- **Proof you cannot source**: do not use it; ask Yavuz or the client for a real example.

## Verification Checklist
- [ ] A single goal event and the exit conditions are written at the top.
- [ ] Each email has one purpose, one call to action, a subject and a distinct preview text.
- [ ] Spacing and any deadline are real and stated.
- [ ] Every link carries the four UTM fields with a distinct `utm_content` per email.
- [ ] Each fact or proof point has a source in the evidence list.
- [ ] Hand-offs name the builder, Jamileh, Kaan, Defne and Emre.
