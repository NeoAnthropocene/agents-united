---
name: onboarding-cro
description: "Raise the share of new users who reach first value. Define the activation event first, measure time to value, cut what comes before it, and specify a checklist, empty states and progressive questions with the metrics and hand-offs to prove they work."
metadata:
  author: agents-united
  version: 3.0.0
  icon: ✨
disable-slash-command: true
---

# Onboarding CRO

## Overview & Purpose
Onboarding is the stretch between a signup and the first moment the product visibly works for the person. Its only job is to shorten that stretch. This skill gives the conversion specialist the order of work: define activation, measure how long it takes and where people stall, remove what is in the way, then add guidance only where a stall remains.

It specifies; it does not build. The checklist, the empty states and the instrumentation are handed to Jamileh, Deniz and Emre.

## Execution Triggers
Load it when signup-to-activation is below about 25 to 40 percent for a self-serve product (label the figure as a rule of thumb unless you have a benchmark with its source), when new users go quiet after day 1, or when onboarding is being redesigned. Do not use it for sales-led products where a person onboards the customer (the method changes: say so), or before the activation event is known (step 1 first).

## Input/Output Requirements
Inputs: the first-run flow screen by screen, signup and activation counts for 28 days, time from signup to the first core action (median and 75th percentile if available), what the empty product looks like, and what questions the product asks at signup.

Outputs: the activation definition; a stall map (where new users stop, with counts); a prioritised change list with a reason and a metric per change; the checklist and empty-state specification; the progressive-question plan; the instrumentation list; test briefs for `ab-test-setup`. **Evidence to attach**: the step counts you read and their date range, and the screens you walked (or the statement that you did not).

## Step-by-Step Runbook
1. **Define activation as an event, not a feeling.** The first action that predicts retention: "created a project and invited one person within 7 days", "sent the first invoice". If the data cannot show which action predicts day-30 use, say so; name the best candidate and make confirming it the first task. Everything below depends on this event.
2. **Measure time to value (TTV)**: median minutes from signup to the activation event, and the share who never reach it. Set a target a user would call quick (for most self-serve tools, minutes, not days).
3. **Map the stalls.** List every step between signup and activation with the count that reaches each. The biggest drop is the first thing to fix; do not start with the checklist.
4. **Remove before you add.** Cut mandatory steps that do not feed the first value: a long survey, a credit card for a free trial, an unneeded verification, an empty dashboard that explains nothing. Ask the other questions after the first success (progressive profiling), one at a time, when a feature needs the answer.
5. **Replace empty states with a first action.** A blank list should offer a ready sample or a one-click starter that already works, and a sentence that says what to do next. Specify the content of each empty state, not just "add a template".
6. **Add a checklist only if stalls remain.** Three to five items, each one a step toward the activation event, ordered by effort, the first achievable in under a minute, progress visible, dismissible. A checklist of tasks that do not lead to activation raises completion of the checklist and nothing else.
7. **Instrument and hand off.** Events for each step and for activation (names and properties) to Deniz, who builds; visual design of the checklist and empty states to Jamileh; copy for each message to your own section props; Emre verifies events fire and the first-run works with a clean account; changes to be tested go to `ab-test-setup`. Questions about what personal data a signup question may collect go to Defne.

## Code & Config Exemplars
### Worked example
A team task tool (invented numbers). Signup 5,000 in 28 days; activation (created a project and added a task within 24 hours) 1,300, so 26 percent; median TTV for those who activate, 14 minutes.

Stall map: signup 5,000; verified email 4,100; finished the 6-question survey 3,000; created a project 1,700; added a task 1,300. The survey loses 1,100 people (27 percent of those who verified); it feeds nothing the first screen uses.

Changes in order: (1) move the survey after the first task and ask two questions, one at a time, on the dashboard; expected to lift activation (estimate, to be tested); (2) skip verification until the first invite; (3) empty project shows a sample project the user can edit; (4) checklist only if the survey change leaves a stall at "added a task": "Name your project" (30 seconds), "Add your first task", "Invite someone".

Test brief for change 1: primary metric activation within 24 hours of signup; guardrail: share of accounts with a company size recorded within 14 days; two weeks at about 180 signups a day is enough for a 4-point lift (check the arithmetic with `ab-test-setup`).

### Anti-patterns
- A checklist that measures completion of the checklist.
- A tour of seven tooltips before the user has done anything.
- Asking for team size, role and goals before the first value.
- Celebrating (confetti) steps that are not progress.
- Optimising signup volume while activation is flat.

## Edge Cases & Error Recovery
- **No instrumentation of the steps.** The first deliverable is the event list for Deniz and Emre; until then every number in the report is marked unknown.
- **Activation is reached by very few paths** (an enterprise tool): treat the buyer and the user as two flows and say which one you audited.
- **High activation, poor retention**: activation is probably defined too early; propose a stronger event and a cohort check.
- **A change helps one segment and hurts another**: report both and recommend a segmented experience only if the segments differ in goal, not only in size.
- **Region or privacy limits on tracking**: use only what the consent state allows; hand the question to Defne.

## Verification Checklist
- [ ] Activation is one named event with a reason (or an explicit "unconfirmed, confirm first").
- [ ] A stall map with counts per step exists, or its absence is stated as a gap with an owner.
- [ ] Every change has a reason, an expected metric and a place in the order: remove, then add.
- [ ] Checklist items each lead to activation; empty states have specified content.
- [ ] Figures not read from data are labelled estimates or rules of thumb.
- [ ] Hand-offs name Jamileh, Deniz, Emre, Defne and `ab-test-setup` with what each delivers.
