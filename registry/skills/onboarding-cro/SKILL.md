---
name: onboarding-cro
description: "Use when signup-to-activation is low (under about 25 to 40 percent, self-serve), new users go quiet after day 1, or onboarding is being redesigned; trigger phrases: users sign up and never come back, improve our onboarding, activation is low, do we need a checklist or a product tour, time to value is too long. Produces an activation definition, a stall map, a prioritised change list, checklist and empty-state specs, the event list and test briefs. Skip it for sales-led products where a person onboards the customer (the method changes) and before the activation event is known."
metadata:
  author: agents-united
  version: 3.0.0
  icon: ✨
disable-slash-command: true
---

# Onboarding CRO

Onboarding is the stretch between a signup and the first moment the product visibly works for the person; its only job is to shorten it. Order of work: define activation, measure time and stalls, remove what is in the way, then add guidance only where a stall remains.

## Overview & Purpose
The conversion specialist's method. It specifies and does not build: the checklist, empty states and instrumentation go to Jamileh, Deniz and Emre.

## Execution Triggers
Load it when signup-to-activation is below about 25 to 40 percent for a self-serve product (a rule of thumb: label it as one), when new users go quiet after day 1, or when onboarding is being redesigned. Do not use it for sales-led products where a person onboards the customer (say the method changes), or before the activation event is known (step 1 first).

## Input/Output Requirements
Inputs: the first-run flow screen by screen; signup and activation counts for 28 days; minutes from signup to the first core action (median and 75th percentile); what the empty product looks like; the questions asked at signup.

Output: the activation definition; a stall map with counts; a prioritised change list (reason and metric each); checklist and empty-state specs; the progressive-question plan; the event list; briefs for `ab-test-setup`. Shapes: [examples/templates.md](examples/templates.md). **Evidence to attach**: the step counts you read, with dates, and the screens you walked (or did not).

## Step-by-Step Runbook
1. **Define activation as an event, not a feeling**: the first action that predicts retention ("created a project and invited one person within 7 days", "sent the first invoice"). If the data cannot show which action predicts day-30 use, say so, name the best candidate and make confirming it the first task; everything below depends on it.
2. **Measure time to value (TTV)**: median minutes from signup to the activation event, and the share who never reach it. Set a target a user would call quick (for most self-serve tools, minutes, not days).
3. **Map the stalls.** List every step from signup to activation with the count that reaches each. The biggest drop is the first thing to fix, so do not start with the checklist.
4. **Remove before you add.** Cut mandatory steps that do not feed the first value (a long survey, a card for a free trial, an unneeded verification, an empty dashboard that explains nothing). Ask the rest after the first success (progressive profiling), one question at a time, when a feature needs the answer.
5. **Replace empty states with a first action**: a blank list offers a ready sample or a one-click starter that already works, and a sentence saying what to do next. Specify each empty state's content, not just "add a template".
6. **Add a checklist only if stalls remain**: three to five items, each a step toward activation, ordered by effort, the first doable in under a minute, progress visible, dismissible. A checklist of tasks that do not lead to activation raises checklist completion and nothing else.
7. **Instrument and hand off.** Event names and properties to Deniz; checklist and empty-state design to Jamileh; copy to your own section props; Emre verifies that events fire and a clean-account first run works; tests to `ab-test-setup`; what a signup question may collect to Defne.

## Code & Config Exemplars
Load [examples/worked-example.md](examples/worked-example.md) for a stall map, the changes in order, a test brief and the event list for a team task tool.

Anti-patterns, each with its reason:
- A checklist that measures completion of the checklist: completion rises, activation does not.
- Seven tooltips before the user has done anything: nobody reads them and value is delayed.
- Team size, role and goals asked before first value: each question is a drop with nothing gained yet.
- Confetti on steps that are not progress: it teaches users to ignore celebration.
- Optimising signup volume while activation is flat: it buys more people who leave.

## Edge Cases & Error Recovery
- **No instrumentation of the steps**: the first deliverable is the event list for Deniz and Emre; until then every number is unknown.
- **Activation reached by very few paths** (an enterprise tool): treat buyer and user as two flows and say which you audited.
- **High activation, poor retention**: activation is probably defined too early; propose a stronger event and a cohort check.
- **A change helps one segment, hurts another**: report both; segment the experience only if the segments differ in goal, not only in size.
- **Region or privacy limits on tracking**: use only what the consent state allows; ask Defne.

## Verification Checklist
- [ ] Activation is one named event with a reason (or an explicit "unconfirmed, confirm first").
- [ ] A stall map with counts per step exists, or its absence is stated as a gap with an owner.
- [ ] Every change has a reason, an expected metric and a place in the order: remove, then add.
- [ ] Checklist items each lead to activation; empty states have specified content.
- [ ] Figures not read from data are labelled estimates or rules of thumb.
- [ ] Hand-offs name Jamileh, Deniz, Emre, Defne and `ab-test-setup` with what each delivers.
