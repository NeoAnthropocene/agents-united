---
name: workflow-agency-brand-design-system
description: "Use when a brand refresh, a new product's design foundations or a design-system audit is requested; trigger phrases: refresh our brand, set up a design system, define tokens and components, our design system is inconsistent. Produces Jamileh's identity and design-tokens.json with its contrast table, Kaan's voice guide, component and handoff specs, Deniz's theme and components, Emre's checks and Defne's licence review. Skip it for one campaign's visuals (use workflow-agency-ad-creative-sprint); an existing token set is audited and extended, never replaced."
metadata:
  author: agents-united
  version: 3.0.0
  license: MIT
  icon: 🔄
---

# Workflow: Agency Brand and Design System

## Overview & Purpose
A brand and design-system engagement ends with decisions engineering can use without asking: identity and voice, a token file, specified components, and proof that the built result keeps the contrast and accessibility the tokens promise. Chris runs it with Jamileh, Kaan, Deniz, Emre, Defne and Yavuz when the voice must reach content.

## Execution Triggers
Load it for a brand refresh, a new product's design foundations, or a system audit that must be fixed. Do not load it for a single campaign's visuals (`workflow-agency-ad-creative-sprint`) or a one-off banner. If the client already has a token set, audit and extend it; never replace it.

## Input/Output Requirements
Inputs: the accepted brief; the client's brand assets and guidelines; the surfaces (marketing site, product, email); whether a dark theme is required; fonts and their licences; the integration state (`figma`, `stitch`).

Output: Jamileh's identity (`brand-identity`) and `design-tokens.json` with the contrast table (`design-system-tokens`); Kaan's voice guide and interface text rules (`ux-writing`); component specs (`ui-component-spec`) and a handoff spec per key screen (`design-handoff-spec`); Deniz's theme and components; Emre's contrast, keyboard and viewport check; Defne's licence and claims review. **Evidence to attach**: computed contrast ratios, font and image licences, the theme's build output.

## Step-by-Step Runbook
```mermaid
graph TD
    B([Accepted brief]) --> P0[Phase 0: audit existing and map]
    P0 --> P1[Phase 1: identity and voice]
    P1 --> P2[Phase 2: tokens as the contract]
    P2 --> P3[Phase 3: component specs, then build]
    P3 --> G{Emre and Defne green on the built result?}
    G -->|No| P3
    G -->|Yes| Done([Documented hand-over])
```

1. **Phase 0.** Consult Jamileh and Deniz read-only on what exists; present the Delegation map. Record which brand values are given and which are proposed.
2. **Phase 1: Jamileh and Kaan.** Identity decisions and a short voice guide from real samples. Brand colours are taken as given; a derived step is added beside one that fails contrast.
3. **Phase 2: Jamileh.** `design-tokens.json` in three tiers with every text and boundary pair computed (4.5 to 1 for text, 3 to 1 for large text and boundaries) and a dark theme by remapping. The file is the contract: nothing is built before it is read back.
4. **Phase 3: Deniz and Jamileh.** Component specs for the ten to fifteen components that matter (every state, keyboard behaviour, test ids), then Deniz builds the theme and components from tokens only.
5. **Gate and hand-off.** Emre runs contrast, keyboard and viewport checks on the built result; Defne reviews font and image licences and claims in the guidelines; findings go to the owner (tokens to Jamileh, code to Deniz). The hand-over says where tokens live, how to add one, what may never be hardcoded and the open exceptions.

| Transition | Prerequisites | Gate (evidence) | Success criteria |
|---|---|---|---|
| Phase 1 -> Phase 2 | Identity and voice approved by the client | Client acceptance in the conversation | Given values are untouched; derived ones are labelled |
| Phase 2 -> Phase 3 | `design-tokens.json` exists | Contrast table read back; every alias resolves | No failing pair without a stated remedy |
| Phase 3 -> Hand-over | Theme and components built from tokens | Emre green and Defne cleared | No raw colour values in components |

Rollback protocol: if a token change breaks a verified component, the previous token file is restored (the client keeps it in version control), Emre re-runs the checks on the changed components, and the token is re-proposed with its contrast result.

## Code & Config Exemplars
Load [examples/worked-example.md](examples/worked-example.md) for the delegation map of a scheduling tool with a given blue and amber. The playbook works without it.

Anti-patterns, each with its reason:
- Changing the client's brand colour to pass a test: it is not ours to change.
- Components built before the tokens are agreed: they are rebuilt.
- Raw colour values in components: a palette change then touches every file.
- A voice guide invented without samples: it is a guess.
- A font used without a recorded licence: it may be pulled.
- Compliance claimed from tokens alone: only the built result is checked.

## Edge Cases & Error Recovery
- **No existing guidelines**: Jamileh proposes a minimal set, labelled provisional until accepted.
- **A brand pair fails and the client insists**: document the exception, restrict its use, put the risk in the report.
- **A third-party library constrains the build**: Deniz says what can be themed before Jamileh specifies beyond it.
- **The client changes the palette late**: re-run the Phase 2 gate; do not patch components one by one.

## Verification Checklist
- [ ] Given brand values are unchanged; derived values are labelled.
- [ ] Every text and boundary pair has a computed ratio and a remedy for any failure.
- [ ] Components use semantic tokens only; no raw colour values.
- [ ] Emre's checks and Defne's licence review are attached and green, or open items are listed.
- [ ] A rollback route for a token change and the hand-over are written.
