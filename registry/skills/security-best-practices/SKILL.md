---
name: security-best-practices
description: Language- and framework-specific secure-coding guidance for
  Python (Django, Flask, FastAPI), JavaScript/TypeScript (Express, Next.js,
  React, Vue, jQuery) and Go. Use when asked for security best practices, a
  security best-practice report on a codebase, or secure-by-default code for
  one of those stacks; not for general code review or debugging.
metadata:
  author: OpenAI (via Trail of Bits skills-curated) / agents-united
  version: 1.0.0
  source: https://github.com/trailofbits/skills-curated/tree/6d05be4889017b06fb15069f371afd220daffb62/plugins/openai-security-best-practices
  commit: 6d05be4889017b06fb15069f371afd220daffb62
  license: Apache-2.0
  icon: 🔐
disable-slash-command: true
---

# Security Best Practices

## Overview & Purpose
Loads the secure-coding reference for the exact languages and frameworks in scope
and applies it in one of three modes: write new code secure by default, flag major
issues passively while working, or produce a prioritised best-practice report and
fix findings one at a time.

Adapted from the Apache-2.0 `openai-security-best-practices` skill that Trail of Bits
curates; see `NOTICE.md`. Boundaries:
- `security-audit` is the catalog's generic OWASP/SAST checklist; this skill adds
  per-framework specifics (Django CSRF settings, Next.js server actions, Express
  middleware order, and so on).
- `semgrep-scanning` / `codeql-scanning` run tools; this skill is reading and judgment.
- `threat-modeling` decides where risk concentrates; this skill says how to code it safely.

## Execution Triggers & Prerequisites
### Execution Triggers
- "Review this for security best practices", "write this securely", "give me a
  security report", or an orchestrator task naming secure-by-default coding.
- Supported stacks only (Python, JS/TS, Go). For others, say that no concrete
  guidance ships here and fall back to general practice.

### Prerequisites
- Read access to the code; the ability to identify every language and framework in scope.

## Input & Output Requirements
### Inputs
| Parameter | Type | Required | Description |
|---|---|---|---|
| Scope | paths | Yes | Code to review or the feature to write |
| Mode | write / passive / report | No | Defaults to write; report only when asked |
| Report path | path | No | Defaults to `security_best_practices_report.md` |

### Outputs
| Artifact | Path / Format | Description |
|---|---|---|
| Secure code | Source files | New or fixed code with a short comment citing the practice |
| Report | Markdown | Executive summary, findings grouped by severity, numeric ids, line numbers |

## Step-by-Step Execution Runbook

### Phase 1 — Identify the stack
1. List every language and framework in scope, frontend and backend, with evidence
   (manifest entries, imports).
2. Load every matching file from `references/`, named
   `<language>-<framework>-<stack>-security.md`, plus the `<language>-general-…` file
   for that language. For a web app, load both the backend and frontend files; if the
   frontend framework is unspecified, load
   [references/javascript-general-web-frontend-security.md](references/javascript-general-web-frontend-security.md).

### Phase 2 — Apply in the requested mode
1. **Write**: follow the loaded guidance for all new code.
2. **Passive**: while doing other work, flag only critical issues and high-impact
   insecure defaults, then ask before fixing.
3. **Report**: write the report (see Outputs); summarise it in the handoff and say
   where the file is.

### Phase 3 — Fix one finding at a time
1. Keep each fix small, commented with the practice it follows, and in its own commit.
2. Check for code that relies on the insecure behaviour before changing it, and run
   the project's tests after each fix.
3. Respect documented project overrides: note the override, suggest documenting it,
   and do not fight it.

## Code & Config Exemplars

### Exemplar 1: A report finding
```markdown
## Critical
### SBP-1 — SQL built by string formatting (app/orders.py:88)
Impact: any user can read or modify every order via the `sort` parameter.
Fix: use the ORM's `order_by` with an allow-list of column names.
```

### Exemplar 2: General advice that applies everywhere
- Public resource ids: use random UUIDv4 or long random hex, not incrementing integers.
- TLS: do not report missing TLS in local/dev setups; gate `Secure` cookies behind a
  production flag; do not recommend HSTS by default (lock-out risk).

## Edge Cases & Error Recovery

### Scenario A: Stack not covered by `references/`
1. **Recovery Protocol**: Say so explicitly in any report; apply well-known practice
   for that stack and label it as general guidance.

### Scenario B: A fix would break existing behaviour
1. **Diagnosis**: Other code depends on the insecure path.
2. **Recovery Protocol**: Report the second-order impact before changing anything and
   propose a staged fix.

## Verification Checklist
- [ ] Every framework in scope was matched to its reference file (or noted as uncovered).
- [ ] Report findings have numeric ids, severity sections and line numbers.
- [ ] Critical findings carry a one-sentence impact statement.
- [ ] Fixes are one finding per change, with tests run afterwards.
- [ ] No TLS/HSTS noise for non-production deployments.

The full upstream workflow text is in [references/upstream-method.md](references/upstream-method.md).
