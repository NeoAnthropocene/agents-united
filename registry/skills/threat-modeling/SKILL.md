---
name: threat-modeling
description: Repository-grounded threat modeling that maps components, trust
  boundaries, assets and attacker capabilities, then ranks concrete abuse
  paths with mitigations and writes a Markdown threat model. Use only when
  someone explicitly asks to threat model a codebase or path, enumerate
  threats or abuse paths, or run an AppSec threat-modeling pass; not for
  general architecture summaries or ordinary code review.
metadata:
  author: OpenAI (via Trail of Bits skills-curated) / agents-united
  version: 2.0.0
  source: https://github.com/trailofbits/skills-curated/tree/6d05be4889017b06fb15069f371afd220daffb62/plugins/openai-security-threat-model
  commit: 6d05be4889017b06fb15069f371afd220daffb62
  license: Apache-2.0
  icon: 🧭
disable-slash-command: true
---

# Threat Modeling

## Overview & Purpose
Produces an AppSec-grade threat model that is specific to one repository (or one
path inside it), not a generic checklist. Every architectural claim is tied to an
evidence anchor in the repo, assumptions are explicit, and the output ranks a small
number of realistic abuse paths by likelihood and impact.

Adapted from the Apache-2.0 `openai-security-threat-model` skill that Trail of Bits
curates; see `NOTICE.md` for what changed. Boundaries against neighbouring skills:
- `security-audit` is an OWASP/SAST checklist over code. Use it to *find bugs*; use
  this skill to decide *where bugs would matter* before or alongside that pass.
- `security-best-practices` reviews code against language/framework guidance.
- `security-diff-review` reviews one change; this skill models the whole system.

## Execution Triggers & Prerequisites
### Execution Triggers
- "Threat model this repo / service / directory", "what are the abuse paths", "map
  the trust boundaries", or an orchestrator task that names threat modeling.
- A design review of a new internet-facing component where the reviewer asks for
  attacker goals, not a code audit.

### Prerequisites
- Read access to the repository. No tools beyond file reading and search are needed.
- Context about deployment, exposure and data sensitivity if available; otherwise it
  is inferred and marked as an assumption.

## Input & Output Requirements
### Inputs
| Parameter | Type | Required | Description |
|---|---|---|---|
| Repo root / in-scope paths | path(s) | Yes | What to model; everything else is explicitly out of scope |
| Intended usage and deployment | text | No | Server, CLI, library, worker; internet exposure; tenancy |
| Existing summaries or specs | files | No | Architecture docs to reuse instead of re-deriving |

### Outputs
| Artifact | Path / Format | Description |
|---|---|---|
| Threat model | `<repo-or-dir-name>-threat-model.md` | Output contract in [references/prompt-template.md](references/prompt-template.md) |
| Assumption questions | Handoff report | 1–3 questions that change the ranking, asked before the final write |

## Step-by-Step Execution Runbook

### Phase 1 — Scope and system model
1. Summarise the repo with the repository-summary prompt in
   [references/prompt-template.md](references/prompt-template.md).
2. List components, data stores, external integrations and entrypoints. Separate
   runtime behaviour from CI/build/dev tooling and from tests/examples.
3. Never claim a component, flow or control without an evidence anchor (path plus
   symbol, config key or short quote).

### Phase 2 — Boundaries, assets, entry points
1. Enumerate trust boundaries as concrete edges: source, destination, data crossing,
   protocol, and the auth/validation/rate limiting on that edge.
2. List the assets that drive risk (credentials, PII, integrity-critical state, build
   artifacts). [references/security-controls-and-assets.md](references/security-controls-and-assets.md)
   is an optional prompt list.
3. Describe realistic attacker capabilities and, just as explicitly, non-capabilities.

### Phase 3 — Abuse paths and ranking
1. Write threats as multi-step abuse paths tied to an entry point, a boundary and an
   asset. Keep the list short and high quality.
2. Rate likelihood and impact (low/medium/high) with one or two sentences each; set
   priority (critical/high/medium/low) from likelihood × impact, adjusted for
   existing controls. Name the assumptions that move the ranking most.

### Phase 4 — Validate context before finalising
1. Report the key assumptions and 1–3 targeted questions (owner, exposure, tenancy,
   data sensitivity) to the orchestrator, and wait for the answers.
2. If they cannot be answered, proceed and mark conditional conclusions as such.

### Phase 5 — Mitigations and write-up
1. Separate existing mitigations (with evidence) from recommended ones; tie each to
   a concrete location and control type.
2. Run the quality check below, then write the file named in Outputs.

## Code & Config Exemplars

### Exemplar 1: One ranked abuse path
```markdown
### T3 — Cross-tenant read via unscoped export job (priority: high)
- Entry point: `POST /api/exports` (src/routes/exports.ts `createExport`)
- Boundary: API → worker queue (no tenant id re-check in `jobs/export.ts:41`)
- Asset: other tenants' invoices (PII, contractual)
- Likelihood: medium — any authenticated user can enqueue; ids are sequential.
- Impact: high — full invoice history of another tenant.
- Existing control: session auth on the route (src/middleware/auth.ts).
- Recommended: re-derive tenant from the job's owner in the worker; random export ids.
```

### Exemplar 2: Priority guide
High: pre-auth RCE, auth bypass, cross-tenant access, key or token theft. Medium:
targeted DoS of a critical component, partial data exposure, rate-limit bypass with
real impact. Low: low-sensitivity leaks, noisy DoS with easy mitigation.

## Edge Cases & Error Recovery

### Scenario A: The repo is a library, not a service
1. **Diagnosis**: No listeners or deployment; "attacker" is whoever controls inputs.
2. **Recovery Protocol**: Model the caller as the boundary; attacker-controlled
   inputs are the library's parsers and public API; downgrade network-only threats.

### Scenario B: No answers to the assumption questions
1. **Diagnosis**: The orchestrator or user cannot confirm exposure or tenancy.
2. **Recovery Protocol**: State the assumption in the report, show how the ranking
   changes if it is wrong, and mark those recommendations conditional.

### Scenario C: Secrets found during discovery
1. **Recovery Protocol**: Never print them. Record presence and location only.

## Verification Checklist
- [ ] Every discovered entrypoint and every trust boundary appears in at least one threat.
- [ ] Runtime, CI/build and test code are separated.
- [ ] Every architectural claim has an evidence anchor.
- [ ] Assumptions and open questions are explicit; answers are reflected.
- [ ] The report follows the output contract in `references/prompt-template.md`,
      including one Mermaid diagram that renders.
- [ ] No secrets appear in the output.
