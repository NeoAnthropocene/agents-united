---
name: workflow-agency-full-campaign
description: "Use when a brief covers strategy through launch across four or more roles (a product launch, a rebrand with a campaign, a new market); trigger phrases: run the full campaign, launch this product end to end, coordinate the whole team on this brief. Produces the delegation map, each slice's artefacts, Emre's gate report, Defne's compliance review and the final report with evidence and open items. Skip it for one deliverable (ask the one specialist) and for one discipline (use the narrower workflow-agency playbook)."
metadata:
  author: agents-united
  version: 3.0.0
  license: MIT
  icon: 🔄
---

# Workflow: Agency Full Campaign

## Overview & Purpose
Chris's playbook for the whole engagement: a client brief becomes strategy, creative, copy, a built and tracked page, a campaign kit and a verified, compliant result. Beside the lead's own steps (align, consult, map) it says how the campaign is sliced, which interfaces are fixed between roles and where the two gates sit.

## Execution Triggers
Load it when the brief covers strategy through launch across four or more roles. For one discipline use the narrower `workflow-agency-*` playbook; for one deliverable, ask the one specialist.

## Input/Output Requirements
Inputs: the accepted brief from `agency-brief-and-premises` (objective, audience, metric with number and date, constraints); the integration state (Operational, Limited or Brainstorming); the approval path; the dates; the roles installed.

Output: the delegation map (slice, owner, inputs, acceptance evidence); each slice's artefacts; Emre's gate report; Defne's compliance review; the final report in the lead's Output Contract. **Evidence to attach**: per slice, the file paths written and the acceptance evidence the owner reported.

## Step-by-Step Runbook
```mermaid
graph TD
    Brief([Accepted brief]) --> P0[Phase 0: consult and delegation map]
    P0 --> G0{User accepts the map?}
    G0 -->|No| P0
    G0 -->|Yes| P1[Phase 1: Ava strategy]
    P1 --> P2[Phase 2: Kaan, Jamileh, Yavuz in parallel]
    P2 --> P3[Phase 3: Deniz, Selin, Jale in parallel]
    P3 --> P4[Phase 4: Emre and Defne verify]
    P4 --> G1{Both gates green?}
    G1 -->|No| P3
    G1 -->|Yes| Done([Deliver and hand off])
```

1. **Phase 0: consult, then map.** Consult a relevant specialist read-only (usually Ava, plus Kaan when the page is the problem) and record who; present the delegation map; create no deliverable file until the client accepts it.
2. **Phase 1: Ava.** Funnel, unit economics, channel choice, ICE backlog: the fixed input of every later slice (metric, audience, positioning).
3. **Phase 2: Kaan, Jamileh, Yavuz in parallel.** Contract first: Kaan's typed section props and Jamileh's `design-tokens.json` exist as files before Deniz starts; Yavuz's keyword map before Selin starts.
4. **Phase 3: Deniz, Selin, Jale in parallel.** Deniz builds from tokens and props with `data-testid` and `dataLayer` hooks; Selin adds structured data and metadata to that layout; Jale sequences the kit with UTM tags from the page URL and copy.
5. **Phase 4: Emre and Defne verify the whole**, not slices: Emre's gate report (viewports, events, accessibility), Defne's review (consent, email, disclosures, claims). Red goes back to the owning specialist, never to a new one.
6. **Deliver and hand-off.** The final report, with each slice's evidence and the open items.

| Transition | Prerequisites | Gate (evidence) | Success criteria |
|---|---|---|---|
| Phase 0 -> Phase 1 | Brief accepted, consultation recorded, map presented | The client says yes in writing | No deliverable file exists before this row passes |
| Phase 2 -> Phase 3 | Tokens, typed props and keyword map exist as files | The lead has read each file back and listed its path | A slice never starts without the artefact it depends on |
| Phase 3 -> Phase 4 | Page built, kit drafted, structured data placed | Owners report their acceptance evidence | Tracking events and test ids are named |
| Phase 4 -> Delivery | Emre green and Defne cleared | Both reports read in full | Failures were fixed by their owners and re-verified |

Rollback protocol: if S4 is red for a defect in S3, only that owner reworks and the gate re-runs on the changed files; if the client withdraws a claim at any point, Defne and Kaan revise the affected assets and S4 re-runs.

## Code & Config Exemplars
Load [examples/worked-example.md](examples/worked-example.md) for the nine-slice delegation map of a feature launch. The playbook works without it.

Anti-patterns, each with its reason:
- Deniz started before the tokens and props exist: the build is guessed, then redone.
- The line run before the map is accepted: the client may refuse the work.
- A new specialist fixing another's failed slice: ownership and context are lost.
- Done declared on summaries: the gate reports were never read.
- All nine spawned at once on a small campaign: cost without value.

## Edge Cases & Error Recovery
- **A role is not installed**: say so in the map, name the bundle and the install command; do no expert work yourself unless the client declines.
- **A slice cannot finish** (missing client input): park it with an owner and date, continue the independent slices, say what is missing.
- **The client changes the objective mid-run**: stop spawning, re-run `agency-brief-and-premises`, re-issue the map.
- **A gate fails twice on one defect**: escalate to the client with the evidence; do not loop a third time.

## Verification Checklist
- [ ] The delegation map was accepted before any deliverable file existed.
- [ ] Every slice has an owner, an input artefact, an output path and acceptance evidence.
- [ ] Phase 2 artefacts were read back before Phase 3 started.
- [ ] Emre's gate and Defne's review were read in full and are green, or the open items are listed.
- [ ] A rollback route exists for each gate; the report names open items and owners.
