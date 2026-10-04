---
name: ui-component-spec
description: "Specify a UI component before it is built: purpose and anatomy, typed props, every state, keyboard and focus behaviour, responsive rules, content limits, test ids and analytics events, so design, build and QA read the same page."
metadata:
  author: agents-united
  version: 3.0.0
  icon: 🧩
disable-slash-command: true
---

# UI Component Spec

## Overview & Purpose
A component spec is the contract between whoever decides what a component does and whoever builds and tests it. Without one, the same button is built three ways and each reviewer finds a different missing state. This skill gives the front-end architect a fixed shape for that contract, short enough to read in two minutes and complete enough to test against.

It specifies one component or a small family. It does not design the visual look (Jamileh's frames and tokens are an input), and it does not write production code beyond the typed interface.

## Execution Triggers
Load it before building or changing a shared component, when a designer's frame shows a pattern that will repeat, or when QA cannot tell what "correct" is for a control. Do not use it for a whole page (use `design-handoff-spec`) or for one-off markup used once.

## Input/Output Requirements
Inputs: the design frames or description, the token set (`design-tokens.json` or the existing theme), the copy and its limits from Kaan, the places the component will be used, the framework and its conventions, and any existing similar component.

Outputs: one spec file per component with these fields, none blank: purpose and when not to use it, anatomy, props as a TypeScript interface, states, interaction and keyboard behaviour, accessibility, responsive behaviour, content rules, test ids and events, open questions. **Evidence to attach**: the frame or file each rule came from, or the statement that it is an assumption.

## Step-by-Step Runbook
1. **Write the purpose in one sentence and the anti-purpose in one**: "A button triggers an action in place; it does not navigate" is the kind of line that prevents a misuse.
2. **Draw the anatomy** as a list of parts with names (container, icon, label, helper text), each mapped to a token for its colour, size and spacing. No raw values.
3. **Define props as a typed interface.** Required versus optional, defaults, allowed values as unions instead of free strings, and what the component does with an invalid combination. Content goes in as props (the copy owner's typed section props), not hardcoded.
4. **Enumerate every state**: default, hover, focus-visible, active, disabled, loading, error, empty, selected where they apply. For each, what changes (token) and what the user can still do. A missing state is the most common defect found in review.
5. **Specify keyboard and focus**: tab order, which keys act (Space and Enter for a button; arrow keys inside a group), where focus goes after the component opens, closes or errors, and that the focus indicator is visible with at least 3 to 1 contrast against its surroundings.
6. **Specify accessibility semantics**: the native element to use first (a real `button`, not a styled `div`), the role and accessible name if a native element is impossible, the live-region behaviour for status and error text, and the reduced-motion alternative for any animation.
7. **Specify responsive behaviour**: how it changes at the narrow breakpoint, the minimum touch target (44 by 44 CSS pixels), what happens with long and empty content.
8. **Add the test hooks and events**: a `data-testid` on every interactive element, and the analytics events with names and properties (agreed with Jale or Ava if they consume them).
9. **Hand off.** The spec to the builder (often Deniz himself), to Emre for the test plan derived from the states table, to Jamileh to confirm every state has a frame, and to Kaan for content limits. Open questions go to whoever owns the answer, named.

## Code & Config Exemplars
### Worked example
Component: `PlanCard` on a pricing page. Purpose: show one plan with its price and one action; not for comparing plans (that is the comparison table).

Anatomy: container (`surface.default`, `radius.lg`), plan name (`text.default`, heading 3), price (`text.default`, heading 1), billing note (`text.muted`), feature list, primary action. Props:

```ts
export interface PlanCardProps {
  name: string;                 // 1 to 24 characters
  priceMonthlyCents: number;    // integer, >= 0; 0 renders "Free"
  billingNote?: string;         // 0 to 60 characters
  features: readonly string[];  // 3 to 7 items, each up to 80 characters
  highlighted?: boolean;        // default false; adds a "Most chosen" badge, never colour alone
  ctaLabel: string;             // verb plus outcome, up to 28 characters
  onSelect: () => void;
}
```

States: default; hover (action darkens one step); focus-visible (2 px outline, 3 to 1 against the card); loading (action shows a spinner and `aria-busy`, still focusable, no double submit); disabled when the plan is the current plan (label "Your plan", `aria-disabled`). No empty state: features are required.

Keyboard: Tab reaches the action; Enter and Space activate it. Accessible name of the action: `"{ctaLabel}, {name} plan"`. Test ids: `plan-card-{slug}`, `plan-card-cta-{slug}`. Event: `plan_selected` with `{ plan, price_cents, position }`. Responsive: cards stack at 375 px, target 44 px high, long feature text wraps, never truncates. Open question for Kaan: maximum length of the billing note in German.

### Anti-patterns
- A spec that shows only the default state.
- Props typed as `string` where a union exists.
- Colour as the only difference between two states.
- A `div` with a click handler where a `button` exists.
- Hardcoded copy inside the component.
- Specifying behaviour the design frames never show, without saying it is an assumption.

## Edge Cases & Error Recovery
- **Design frames disagree with the tokens**: the tokens win; flag the frame to Jamileh as an open question.
- **An existing component almost fits**: extend it with a variant and say which; do not create a near-duplicate.
- **Very long, very short or missing content**: specify wrap, truncation with a tooltip only when the content is repeated elsewhere, and the empty behaviour.
- **A state cannot be reached in the product today**: still specify it, mark it "not reachable yet", so it is built before it is needed.
- **Third-party component library constraints**: state which parts you can and cannot change, and ask Deniz before assuming.

## Verification Checklist
- [ ] Purpose and anti-purpose are each one sentence.
- [ ] Anatomy parts map to tokens; no raw values.
- [ ] Props are a typed interface with ranges, defaults and invalid-combination behaviour.
- [ ] Every applicable state is listed with what changes and what the user can still do.
- [ ] Keyboard, focus, accessible name, live-region and reduced-motion behaviour are written.
- [ ] Test ids and events are named; open questions have owners; hand-offs name Emre, Jamileh and Kaan.
