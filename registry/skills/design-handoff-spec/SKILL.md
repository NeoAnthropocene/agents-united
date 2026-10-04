---
name: design-handoff-spec
description: "Turn a designer's frames into a spec a front-end builder can implement without guessing: tokens instead of raw values, every state, rules per breakpoint, motion with a reduced-motion form, content as typed props, test ids, and a definition of ready."
metadata:
  author: agents-united
  version: 3.0.0
  icon: 🤝
disable-slash-command: true
---

# Design Handoff Spec

## Overview & Purpose
Handoff fails when the builder has to ask, or worse, to guess. This skill is the checklist and the document shape that closes the gap between Jamileh's frames, Kaan's copy and Deniz's build. It is read by the front-end architect when translating a handoff into component structure, and used by the designer to decide whether a handoff is ready to send.

The handoff describes a page or a flow. A single reusable component is specified with `ui-component-spec`.

## Execution Triggers
Load it when a design (frames, a generated prototype, a Figma file) is about to be built, or when the builder reports missing information. Do not use it for early exploration (nothing to hand off yet) or for tweaks inside an existing handoff (amend the spec).

## Input/Output Requirements
Inputs: the frames or file link with the frame identifiers, the token set, the copy as typed section props from Kaan, the component inventory already built, the target breakpoints, the analytics and SEO requirements, and the acceptance criteria.

Outputs: one handoff spec per page or flow containing: scope and links, component map (existing, extended, new), layout and spacing in tokens, states, responsive rules per breakpoint, motion, content bindings, accessibility notes, assets, test ids and events, and open questions. **Evidence to attach**: the frame identifier or link for each section, so a reviewer can compare spec to design.

## Step-by-Step Runbook
1. **Check Definition of Ready first.** The handoff is ready only if: frames exist for every state of every interactive element, the desktop and the narrowest breakpoint are both designed, all copy is final or has a length limit, the tokens needed exist, and the open questions are listed with owners. If not, return it with the missing list instead of building from it.
2. **Map components.** For each part of the page, say which existing component it uses, which needs a new variant, and which is new (and needs `ui-component-spec`).
3. **State layout in tokens.** Spacing between sections and inside components as token names, grid columns and gutters per breakpoint, maximum content width. A pixel value that matches no token is a defect in the design, raised as an open question, not copied.
4. **Give responsive rules as rules**, not as three screenshots: what reflows, what stacks, what hides (and where it goes instead), the order of content on the narrow layout, which images swap. Name the breakpoints used by the product.
5. **List the states and transitions**: loading, empty, error, success, disabled; what each shows and how long a loading state may last before an error appears.
6. **Specify motion**: purpose, duration (typically 150 to 300 ms for interface feedback), easing, and the reduced-motion alternative (no movement, a fade or an instant change). If you cannot say what an animation is for, remove it.
7. **Bind content**: the copy as the typed props Kaan supplies, with maximum lengths and what happens beyond them; images with alt text written or marked decorative.
8. **Add the hooks**: a `data-testid` for every interactive element and key region, the analytics events, the headings and landmarks outline for accessibility and for Selin's SEO needs.
9. **Hand off with the open questions** each addressed to a named owner (Jamileh for design, Kaan for copy, Selin for SEO, Defne for legal text) and ask Emre to read the spec and say which acceptance checks cannot be written yet.

## Code & Config Exemplars
### Worked example
Page: pricing, frames `Pricing / Desktop`, `Pricing / Mobile`, file link in the brief.

Definition of Ready check: loading and error states for the "Start trial" action are not drawn (missing); the annual toggle has no frame for keyboard focus (missing); copy for the guarantee line is not final. Returned to Jamileh and Kaan with the three items before build; the rest proceeds.

Spec excerpt:
```text
SECTION   hero + plan cards
COMPONENTS  PageHero (existing), PlanCard (new, see ui-component-spec), BillingToggle (extended: add "annual" variant)
LAYOUT    desktop: 12 columns, gutter space.6, cards in a row of 3, section padding space.12 vertical
          mobile (<= 640 px): cards stack in order Starter, Team, Business, section padding space.8
STATES    BillingToggle: default, focus-visible, selected; Start trial: default, loading (max 8 s, then error banner), error
MOTION    price change on toggle: 200 ms fade of the number; reduced motion: instant swap
CONTENT   PageHero props from Kaan (headline <= 60 chars); guarantee line: OPEN QUESTION (Kaan)
TEST IDS  billing-toggle, plan-card-cta-{slug}, trial-error-banner
EVENTS    billing_toggled { period }, plan_selected { plan, position }
OPEN      focus frame for the toggle (Jamileh); guarantee wording (Kaan, then Defne)
```

### Anti-patterns
- Raw pixel and hex values copied from the design tool.
- "Responsive: standard" with no rules.
- Only the happy state designed.
- Animation with no stated purpose or reduced-motion form.
- Copy pasted from the frame as a screenshot instead of typed props.
- Starting the build while the open questions have no owner.

## Edge Cases & Error Recovery
- **The design uses a new colour or size**: raise it as a token request to Jamileh; the builder does not invent a value.
- **A generated prototype is the "design"**: treat it as a sketch; extract tokens and components, and list what is hardcoded in it.
- **Frames contradict the copy lengths**: copy limits win; ask Jamileh to redraw with the real length.
- **Behaviour the frames cannot show** (validation, loading): write it in words and mark it as specified, not designed.
- **The builder finds a gap mid-build**: record it in the spec's open list and stop only the affected part.

## Verification Checklist
- [ ] Definition of Ready was checked and the missing items, if any, were returned.
- [ ] Layout and spacing are token names; no raw values appear.
- [ ] Responsive rules, states, motion with its reduced-motion form and content limits are written.
- [ ] Test ids, events and the headings outline are listed.
- [ ] Each section links to its frame identifier.
- [ ] Open questions each name an owner, and Emre has been asked to review the acceptance checks.
