---
name: threat-modeling
description: Points to Trail of Bits' official threat-modeling and security
  research skills rather than vendoring them, because their skill sets are
  CC-BY-SA-4.0-licensed (ShareAlike). Use when the user needs repository-
  grounded threat modeling — trust boundaries, abuse paths, adversarial
  review — and can install the upstream skill directly, or wants a summary of
  what it covers and where to get it.
metadata:
  author: agents-united
  version: 1.0.0
  source: https://github.com/trailofbits/skills
  commit: 0cc1c73a5e96749ab32d7ea5e14892fafa6972ae
  license: CC-BY-SA-4.0 (upstream licence; this stub's own text is original
    agents-united commentary, not vendored upstream content — see Overview)
  icon: 🔗
disable-slash-command: true
---

# Threat Modeling — Link-Only Stub (Licence Blocked)

## Overview & Purpose
This skill intentionally does **not** vendor Trail of Bits' threat-modeling
content. Their skills repositories — `github.com/trailofbits/skills` (their
own authored security-research skills) and `github.com/trailofbits/skills-
curated` (a marketplace of skills curated *from* other sources, including a
Claude-Code-plugin conversion of an OpenAI-originated threat-model skill) —
are licensed under **Creative Commons Attribution-ShareAlike 4.0
(CC-BY-SA-4.0)**. ShareAlike requires any adaptation to be re-licensed under
a compatible CC-BY-SA licence, which this MIT-style catalog does not do for
its skill content (per the "Skill & Agent Contribution Standard" in
`README.md`, which vendors under MIT/Apache-2.0/BSD/CC-BY only — CC-BY-SA's
copyleft clause is explicitly excluded). Rather than copy-adapting
ShareAlike-encumbered material into an incompatible licence, this stub
describes what the upstream skills cover and how to reach them directly.

## Execution Triggers & Prerequisites
### Execution Triggers
- The user asks for a threat model of a service: trust boundaries, abuse
  paths, adversarial review of a design or codebase.
- A security review needs Trail-of-Bits-calibre depth (their skill set also
  covers constant-time analysis, smart-contract auditing, and variant
  analysis) beyond this catalog's generic `security-audit` skill.

### Prerequisites
- None to read this stub. Installing the upstream skill set requires the
  user's own tooling and accepting CC-BY-SA-4.0 for that content directly.

## Input & Output Requirements
### Inputs
| Parameter | Type | Required | Description |
|---|---|---|---|
| none | — | — | This is a pointer skill; it takes no inputs of its own |

### Outputs
| Artifact | Path / Format | Description |
|---|---|---|
| Pointer | This document | Where the real content lives and why it isn't vendored here |

## Step-by-Step Execution Runbook

### Phase 1 — Recognize the Need
1. When a task calls for structured threat modeling (trust boundaries, abuse
   paths, adversarial review), recognize this catalog does not vendor Trail
   of Bits' specific methodology, and say so rather than improvising a
   threat model that claims their pedigree.

### Phase 2 — Point to the Real Source
1. Direct the user to `github.com/trailofbits/skills` for Trail of Bits'
   own-authored security-research skills (static analysis, variant analysis,
   differential review, insecure-defaults detection), and to
   `github.com/trailofbits/skills-curated/plugins/openai-security-threat-
   model` for their curated conversion of a repository-grounded threat-model
   skill — both under CC-BY-SA-4.0.
2. If the user's own tooling supports it, they can install either directly
   under CC-BY-SA-4.0's own terms (attribution + ShareAlike on their own
   derivative work) — this repository does not need to, and does not,
   re-host that content.

### Phase 3 — Offer What This Catalog *Does* Cover
1. For a general, non-Trail-of-Bits-branded security pass, point to this
   catalog's own `security-audit` skill (OWASP Top 10 / SAST checklist,
   agents-united-authored) and, for edge/Workers apps specifically, the
   `edge-security-audit` skill (adapted from Cloudflare's MIT-licensed
   `security-audit-skill`).
2. State clearly that neither of those is a substitute for Trail of Bits'
   specific adversarial-review methodology if that depth is what was asked
   for — send the user to the real source instead of approximating it.

## Code & Configuration Exemplars

### Exemplar 1: Where the Real Content Lives (illustrative, not vendored)
```text
Trail of Bits' own skills:      https://github.com/trailofbits/skills
Curated threat-model skill:     https://github.com/trailofbits/skills-curated
                                 (plugins/openai-security-threat-model)
Licence for both: CC-BY-SA-4.0 — install and use under their own terms.
```

## Edge Cases & Error Recovery Procedures

### Scenario A: User Expects Full Threat-Modeling Content Here
1. **Diagnosis**: The user assumed this skill name meant vendored content, as
   with the other addon skills in this bundle.
2. **Recovery Protocol**:
   - Step 1: Explain plainly that this entry is a link-only stub due to
     licence terms (CC-BY-SA-4.0's ShareAlike clause), not an oversight.
   - Step 2: Point to the upstream repositories and this catalog's own
     `security-audit`/`edge-security-audit` skills for what generic guidance
     is available here.

### Scenario B: A Future Contributor Wants to Vendor It Anyway
1. **Diagnosis**: Someone proposes copying Trail of Bits' CC-BY-SA-4.0
   content verbatim into this MIT-style catalog.
2. **Recovery Protocol**:
   - Step 1: This requires either relicensing this catalog entry (and,
     under ShareAlike, arguably adjacent derivative material) under a
     CC-BY-SA-compatible licence, or obtaining explicit permission from
     Trail of Bits — neither is a change to make unilaterally in a routine
     skill-authoring pass.
   - Step 2: Re-run this plan's Step 0 licence check before changing this
     skill's disposition.

## Verification & Validation Checklist
- [ ] This stub makes no claim to have vendored Trail of Bits' threat-
      modeling content.
- [ ] `metadata.source` points to the real upstream repository/repositories.
- [ ] The stub explains, in plain terms, why the content is not here
      (CC-BY-SA-4.0 ShareAlike, not on the catalog's redistribution
      allow-list).
- [ ] No commands, tools, or methodology are invented and attributed to
      Trail of Bits in place of the real upstream content.
