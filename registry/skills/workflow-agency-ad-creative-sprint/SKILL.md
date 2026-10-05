---
name: workflow-agency-ad-creative-sprint
description: "Use when a request asks for new ads for a launch or a test of angles; trigger phrases: new ads for the launch, test three angles, run a creative sprint, ad variants for these placements, who reviews the ad claims. Produces the single message, a variant matrix, copy per variant, design specs per ratio, the set-up sheet with names and UTM tags, Defne's claims and disclosure review and Emre's link check. Skip it for brand identity (use workflow-agency-brand-design-system) and a full engagement (use workflow-agency-full-campaign); nothing here buys media or publishes an ad."
metadata:
  author: agents-united
  version: 3.0.0
  license: MIT
  icon: 🔄
---

# Workflow: Agency Ad Creative Sprint

## Overview & Purpose
A creative sprint produces a tested set of ads in days: one message, three to six variants that differ on purpose, every claim reviewed, every link tagged. One cycle, with a client decision at the start and a measured result at the end; Chris slices it among Ava, Kaan, Jamileh, Jale, Defne and Emre.

## Execution Triggers
Load it for "new ads for the launch" or "test three angles". Do not load it for brand identity (`workflow-agency-brand-design-system`) or a full engagement (`workflow-agency-full-campaign`). Nothing here buys media or publishes an ad: the client or the lead does that with their own account.

## Input/Output Requirements
Inputs: the accepted brief, the audience, the offer and its proof, the placements the client has budget for, brand tokens, required legal copy, what earlier ads taught.

Output: the creative brief with the single message; the variant matrix; copy per variant (Kaan); design specs per ratio (Jamileh, with `ad-creative-design`); the set-up sheet with names and UTM tags (Jale); Defne's claims and disclosure review; Emre's link and landing-page check. **Evidence to attach**: the source of each claim and the path of each asset file.

## Step-by-Step Runbook
```mermaid
graph TD
    B([Accepted brief]) --> P0[Phase 0: message and variant matrix]
    P0 --> G0{Client accepts the map?}
    G0 -->|Yes| P1[Phase 1: Kaan copy and Jamileh design in parallel]
    P1 --> P2[Phase 2: Jale set-up sheet]
    P2 --> P3[Phase 3: Defne review and Emre checks]
    P3 --> G1{Claims cleared and links verified?}
    G1 -->|No| P1
    G1 -->|Yes| Done([Hand to the client to launch])
```

1. **Phase 0.** Ava states the audience, the single message and the metric (cost per qualified signup, not clicks); the lead presents the Delegation map. Variants change one dimension, the angle (outcome, proof, objection) or the format, never both at once.
2. **Phase 1.** Kaan writes copy per variant, one claim each, with a source list; Jamileh designs per placement (sizes verified against the platform) with Kaan's headline as a fixed input.
3. **Phase 2.** Jale writes the set-up sheet: ad names equal to `utm_content`, UTM tags on every link, the audiences and exclusions the client set. Jale creates no accounts or campaigns.
4. **Phase 3.** Defne reviews claims, comparisons, "free" and price statements, endorsements and sponsored-placement disclosure; Emre checks that each link lands on the right page, tracking fires and the landing page matches the ad's promise.
5. **Hand to the client** to set up and launch; Ava defines the stop rule and the day the result is read.

| Transition | Prerequisites | Gate (evidence) | Success criteria |
|---|---|---|---|
| Phase 0 -> Phase 1 | Single message and matrix agreed | The client accepted the delegation map | One message, one change between variants |
| Phase 1 -> Phase 2 | Copy and design exist as files | Lead has read both back with paths | Every claim has a source in the list |
| Phase 2 -> Phase 3 | Set-up sheet drafted | Names and UTM scheme listed | Each ad name equals its utm_content |
| Phase 3 -> Hand-off | Defne cleared and Emre green | Both reports read in full | No unsupported claim; links verified |

Rollback protocol: if Defne rejects a claim, the variant is withdrawn or rewritten (Kaan, then Jamileh), the sheet is renamed v2 and Phase 3 re-runs on the changed assets only; if the landing page does not match the promise, Kaan revises the page copy, not the ad.

## Code & Config Exemplars
Load [examples/worked-example.md](examples/worked-example.md) for a three-angle sprint: the variants, names, stop rule and read-out. The playbook above works without it.

Anti-patterns, each with its reason:
- Three messages in one ad set: no result explains itself.
- Variants that differ in five ways: the same.
- Ads set up before the claims review: a rejected claim is found after spend.
- Results read before the stated impressions: it is noise.
- A specialist creating an ad account or spending: out of role.
- A landing page that does not carry the ad's promise: the click is wasted.

## Edge Cases & Error Recovery
- **A platform rejects an ad**: record the reason, fix that point, rename the variant and re-run Defne's review on it.
- **No proof for the strongest claim**: drop that variant; never fabricate or soften wording to hide it.
- **The client wants a competitor named**: Defne first; Kaan drafts only after clearance.
- **Brand tokens missing**: Jamileh uses a labelled provisional palette only if the client agrees.
- **Results disagree with the stop rule**: report both and let the client decide; do not move the goalposts.

## Verification Checklist
- [ ] One message; variants differ by one dimension; names match `utm_content`.
- [ ] Every claim has a source; Defne has cleared them in writing.
- [ ] Every link carries the four UTM fields and Emre verified the landing and tracking.
- [ ] Ava wrote the stop rule and the read-out days.
- [ ] This team published and bought nothing; the hand-off to the client is explicit.
- [ ] A rollback route is written for a rejected claim and a rejected ad.
