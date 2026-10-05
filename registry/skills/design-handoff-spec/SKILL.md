---
name: design-handoff-spec
description: "Use when a design (frames, a generated prototype, a Figma file) is about to be built, or when the builder reports missing information; trigger phrases: hand this design to dev, is this handoff ready, the builder keeps asking questions, spec the pricing page for build. Produces one handoff spec per page or flow: component map, layout in tokens, states, responsive rules per breakpoint, motion with a reduced-motion form, content bindings, test ids, events and open questions. Skip it for early exploration (nothing to hand off yet) and for tweaks inside an existing handoff (amend the spec)."
metadata:
  author: agents-united
  version: 3.0.0
  icon: 🤝
disable-slash-command: true
---

# Design Handoff Spec

Handoff fails when the builder has to ask, or worse, to guess. This is the checklist and the document shape that close the gap between Jamileh's frames, Kaan's copy and Deniz's build.

## Overview & Purpose
Read by the front-end architect when translating a handoff into component structure, and used by the designer to decide whether a handoff is ready to send. It describes a page or a flow; one reusable component is specified with `ui-component-spec`.

## Execution Triggers
Load it when a design (frames, a generated prototype, a Figma file) is about to be built, or when the builder reports missing information. Do not use it for early exploration (nothing to hand off yet) or for tweaks inside an existing handoff (amend the spec).

## Input/Output Requirements
Inputs: the frames or file link with frame identifiers; the token set; the copy as typed section props from Kaan; the component inventory already built; the target breakpoints; analytics and SEO requirements; the acceptance criteria.

Output: one handoff spec per page or flow: scope and links, component map (existing, extended, new), layout and spacing in tokens, states, responsive rules per breakpoint, motion, content bindings, accessibility notes, assets, test ids and events, open questions. Shape: [examples/handoff-template.md](examples/handoff-template.md). **Evidence to attach**: the frame identifier or link for each section, so a reviewer can compare spec to design.

## Step-by-Step Runbook
1. **Check Definition of Ready first.** Ready only if: frames exist for every state of every interactive element; desktop and the narrowest breakpoint are both designed; all copy is final or has a length limit; the tokens needed exist; the open questions are listed with owners. If not, return the handoff with the missing list instead of building from it.
2. **Map components**: for each part of the page, the existing component it uses, which needs a new variant, and which is new (and needs `ui-component-spec`).
3. **State layout in tokens**: spacing between and inside sections as token names, grid columns and gutters per breakpoint, maximum content width. A pixel value that matches no token is a defect in the design, raised as an open question, never copied.
4. **Give responsive rules as rules**, not as three screenshots: what reflows, stacks or hides (and where it goes instead), the content order on the narrow layout, which images swap; name the product's breakpoints.
5. **List the states and transitions**: loading, empty, error, success, disabled; what each shows, and how long loading may last before an error appears.
6. **Specify motion**: purpose, duration (typically 150 to 300 ms for interface feedback), easing, and the reduced-motion alternative (no movement, a fade or an instant change). If you cannot say what an animation is for, remove it.
7. **Bind content**: the copy as the typed props Kaan supplies, with maximum lengths and what happens beyond them; images with alt text written or marked decorative.
8. **Add the hooks**: a `data-testid` for every interactive element and key region, the analytics events, and the headings and landmarks outline for accessibility and for Selin's SEO needs.
9. **Hand off with the open questions**, each addressed to a named owner (Jamileh for design, Kaan for copy, Selin for SEO, Defne for legal text), and ask Emre to say which acceptance checks cannot be written yet.

## Code & Config Exemplars
Load [examples/worked-example.md](examples/worked-example.md) for a pricing-page handoff: the Definition of Ready check that sent three items back, and a spec excerpt.

Anti-patterns, each with its reason:
- Raw pixel and hex values copied from the design tool: the tokens are bypassed.
- "Responsive: standard" with no rules: the builder has to guess.
- Only the happy state designed: loading and error get built by guesswork.
- Animation with no purpose or reduced-motion form: it cannot be justified or made safe.
- Copy pasted as a screenshot instead of typed props: it cannot be built or limited.
- Starting the build while open questions have no owner: nobody will answer them.

## Edge Cases & Error Recovery
- **The design uses a new colour or size**: raise a token request to Jamileh; the builder invents no value.
- **A generated prototype is the "design"**: treat it as a sketch; extract tokens and components and list what is hardcoded in it.
- **Frames contradict the copy lengths**: copy limits win; ask Jamileh to redraw with the real length.
- **Behaviour frames cannot show** (validation, loading): write it in words and mark it specified, not designed.
- **The builder finds a gap mid-build**: record it in the spec's open list and stop only the affected part.

## Verification Checklist
- [ ] Definition of Ready was checked and the missing items, if any, were returned.
- [ ] Layout and spacing are token names; no raw values appear.
- [ ] Responsive rules, states, motion with its reduced-motion form and content limits are written.
- [ ] Test ids, events and the headings outline are listed.
- [ ] Each section links to its frame identifier.
- [ ] Open questions each name an owner, and Emre has been asked to review the acceptance checks.
