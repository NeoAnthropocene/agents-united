---
name: terraform-test-patterns
description: Points to HashiCorp's official Terraform testing guidance
  (terraform test, acceptance tests, provider/module scaffolding) rather than
  vendoring it, because the upstream skill set is MPL-2.0-licensed. Use when
  the user needs Terraform test patterns and can install the upstream skill
  directly, or wants a summary of what it covers and where to get it.
metadata:
  author: agents-united
  version: 1.0.0
  source: https://github.com/hashicorp/agent-skills
  commit: 516354c484b43fa5469567485113dd0c769c3d24
  license: MPL-2.0 (upstream licence; this stub's own text is original
    agents-united commentary, not vendored upstream content — see Overview)
  icon: 🔗
disable-slash-command: true
---

# Terraform Test Patterns — Link-Only Stub (Licence Blocked)

## Overview & Purpose
This skill intentionally does **not** vendor HashiCorp's Terraform testing
content. HashiCorp's `agent-skills` repository
(`github.com/hashicorp/agent-skills`, `plugins/terraform/skills/`) is
licensed under the **Mozilla Public License 2.0 (MPL-2.0)** — a real,
legitimate open-source licence, but not one of the redistribution-friendly
licences this catalog vendors under (MIT / Apache-2.0 / BSD / CC-BY, per the
"Skill & Agent Contribution Standard" in `README.md`). Rather than
copy-adapting MPL-2.0 material into an MIT-style catalog entry, this stub
tells the agent what the upstream skill set covers and how to reach it
directly.

## Execution Triggers & Prerequisites
### Execution Triggers
- The user asks for Terraform test/acceptance-test patterns, module
  scaffolding conventions, or state-management testing guidance.
- A DevOps or infrastructure task needs Terraform-specific testing depth
  beyond what this catalog's own `test-driven-development` and
  `azure-infrastructure-bicep` skills cover generically.

### Prerequisites
- None to read this stub. Installing the upstream skill set requires the
  user's own tooling (`npx skills add ...` or the plugin marketplace flow
  HashiCorp documents) and accepting MPL-2.0 for that content directly.

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
1. When a task calls for Terraform test/acceptance-test patterns, recognize
   this catalog does not vendor that depth, and say so plainly rather than
   improvising untested Terraform testing advice from general knowledge.

### Phase 2 — Point to the Real Source
1. Direct the user to `github.com/hashicorp/agent-skills`
   (`plugins/terraform/skills/`), HashiCorp's own maintained skill set,
   covering provider scaffolding, module conventions, `terraform test`
   (native `.tftest.hcl` acceptance tests), and Terraform Cloud/HCP state
   management.
2. If the user's own tooling supports it, they can install it directly
   (e.g. via the HashiCorp Claude Code plugin marketplace or a skills-CLI
   fetch of that repository) under its own MPL-2.0 terms — this repository
   does not need to (and does not) re-host that content to make it usable.

### Phase 3 — Offer What This Catalog *Does* Cover
1. For general infrastructure-as-code discipline not specific to Terraform's
   own test runner, point to this catalog's `azure-infrastructure-bicep` and
   `test-driven-development` skills, which are agents-united-authored and
   fully vendored here.
2. If the user specifically wants `terraform test` / `.tftest.hcl` syntax
   help, state clearly that the authoritative source is HashiCorp's own
   documentation and the linked skill set, not this stub.

## Code & Configuration Exemplars

### Exemplar 1: Installing the Upstream Skill Set (illustrative, not vendored)
```bash
# Real upstream location — not run or bundled by this repository:
# https://github.com/hashicorp/agent-skills (plugins/terraform/skills/)
# Install per that repo's own documented method, under its MPL-2.0 licence.
```

## Edge Cases & Error Recovery Procedures

### Scenario A: User Expects Full Terraform Test Content Here
1. **Diagnosis**: The user assumed this skill name meant vendored content,
   as with the other addon skills in this bundle.
2. **Recovery Protocol**:
   - Step 1: Explain plainly that this entry is a link-only stub due to
     licence terms (MPL-2.0), not an oversight.
   - Step 2: Point to the upstream repository and, if relevant, this
     catalog's own IaC-adjacent skills for what generic guidance is
     available here.

### Scenario B: A Future Contributor Wants to Vendor It Anyway
1. **Diagnosis**: Someone proposes copying HashiCorp's MPL-2.0 content
   verbatim into this MIT-style catalog.
2. **Recovery Protocol**:
   - Step 1: This requires either relicensing this catalog entry under
     MPL-2.0 (with proper file-level notices) or obtaining explicit
     permission from HashiCorp — neither is a change to make unilaterally in
     a routine skill-authoring pass.
   - Step 2: Re-run this plan's Step 0 licence check before changing this
     skill's disposition.

## Verification & Validation Checklist
- [ ] This stub makes no claim to have vendored HashiCorp's Terraform
      testing content.
- [ ] `metadata.source` points to the real upstream repository.
- [ ] The stub explains, in plain terms, why the content is not here
      (MPL-2.0, not on the catalog's redistribution allow-list).
- [ ] No commands or APIs are invented in place of the real upstream
      content.
