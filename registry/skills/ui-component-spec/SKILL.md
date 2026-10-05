---
name: ui-component-spec
description: "Use when building or changing a shared component, when a designer's frame shows a pattern that will repeat, or when QA cannot tell what correct is for a control; trigger phrases: write a spec for this component, what states does it need, spec the button, define the props, QA does not know what the component should do. Produces one spec per component: purpose and anti-purpose, anatomy, typed props, every state, keyboard and focus behaviour, semantics, responsive rules, content limits, test ids, events and open questions. Skip it for a whole page (use design-handoff-spec) and for markup used once."
metadata:
  author: agents-united
  version: 3.0.0
  icon: 🧩
disable-slash-command: true
---

# UI Component Spec

A component spec is the contract between whoever decides what a component does and whoever builds and tests it. Without one, the same button is built three ways and each reviewer finds a different missing state.

## Overview & Purpose
For the front-end architect: a fixed shape for that contract, short enough to read in two minutes and complete enough to test against. It specifies one component or a small family; Jamileh's frames and tokens are an input, and nothing beyond the typed interface is production code.

## Execution Triggers
Load it before building or changing a shared component, when a frame shows a pattern that will repeat, or when QA cannot tell what "correct" is for a control. Do not use it for a whole page (`design-handoff-spec`) or for markup used once.

## Input/Output Requirements
Inputs: the frames or description; the token set (`design-tokens.json` or the existing theme); the copy and its limits from Kaan; where the component will be used; the framework and its conventions; any similar existing component.

Output: one spec file per component, none of these fields blank: purpose and when not to use it, anatomy, props as a TypeScript interface, states, interaction and keyboard behaviour, accessibility, responsive behaviour, content rules, test ids and events, open questions. Shape: [examples/spec-template.md](examples/spec-template.md). **Evidence to attach**: the frame or file each rule came from, or the statement that it is an assumption.

## Step-by-Step Runbook
1. **Write the purpose in one sentence and the anti-purpose in one**: "A button triggers an action in place; it does not navigate" prevents a misuse.
2. **Draw the anatomy** as named parts (container, icon, label, helper text), each mapped to a token for colour, size and spacing. No raw values.
3. **Define props as a typed interface**: required or optional, defaults, allowed values as unions instead of free strings, and what the component does with an invalid combination. Content comes in as props (the copy owner's typed section props), never hardcoded.
4. **Enumerate every state** that applies: default, hover, focus-visible, active, disabled, loading, error, empty, selected. For each, what changes (token) and what the user can still do. A missing state is the most common defect found in review.
5. **Specify keyboard and focus**: tab order; which keys act (Space and Enter for a button, arrows inside a group); where focus goes after the component opens, closes or errors; a visible focus indicator with at least 3 to 1 contrast against its surroundings.
6. **Specify semantics**: the native element first (a real `button`, not a styled `div`); a role and accessible name only if no native element exists; live-region behaviour for status and error text; the reduced-motion alternative for any animation.
7. **Specify responsive behaviour**: what changes at the narrow breakpoint, the minimum touch target (44 by 44 CSS pixels), and long and empty content.
8. **Add the hooks**: a `data-testid` on every interactive element, and analytics events with names and properties (agreed with Jale or Ava if they consume them).
9. **Hand off.** The spec to the builder (often Deniz), to Emre for the test plan from the states table, to Jamileh to confirm every state has a frame, and to Kaan for content limits; open questions to the named owner.

## Code & Config Exemplars
Load [examples/worked-example.md](examples/worked-example.md) for a PlanCard spec: anatomy, the props interface, states, keyboard, test ids, an event and an open question.

Anti-patterns, each with its reason:
- A spec showing only the default state: the other states get built by guesswork.
- Props typed `string` where a union exists: invalid values reach the screen.
- Colour as the only difference between two states: some users cannot see it.
- A `div` with a click handler where a `button` exists: no keyboard, no role.
- Hardcoded copy inside the component: it cannot be localised or limited.
- Behaviour the frames never show, unmarked: the builder cannot tell design from invention.

## Edge Cases & Error Recovery
- **Frames disagree with the tokens**: the tokens win; flag the frame to Jamileh as an open question.
- **An existing component almost fits**: extend it with a variant and say which; do not create a near-duplicate.
- **Very long, very short or missing content**: specify wrap, truncation with a tooltip only when the content repeats elsewhere, and the empty behaviour.
- **A state not reachable today**: specify it anyway, marked "not reachable yet", so it exists before it is needed.
- **Third-party library constraints**: say which parts you can and cannot change; ask Deniz before assuming.

## Verification Checklist
- [ ] Purpose and anti-purpose are each one sentence.
- [ ] Anatomy parts map to tokens; no raw values.
- [ ] Props are a typed interface with ranges, defaults and invalid-combination behaviour.
- [ ] Every applicable state is listed with what changes and what the user can still do.
- [ ] Keyboard, focus, accessible name, live-region and reduced-motion behaviour are written.
- [ ] Test ids and events are named; open questions have owners; hand-offs name Emre, Jamileh and Kaan.
