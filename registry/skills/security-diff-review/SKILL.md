---
name: security-diff-review
description: Security-focused review of one change (PR, commit or diff) -
  risk-classifies each changed file, checks git history for removed security
  fixes, measures blast radius by counting callers, checks test coverage of
  modified code, models an attacker for high-risk changes, and writes a
  report file. Use when reviewing a PR or diff for security impact or
  asking whether a change re-opens an old bug; not for greenfield code.
metadata:
  author: Trail of Bits / agents-united
  version: 1.0.0
  source: https://github.com/trailofbits/skills/tree/0cc1c73a5e96749ab32d7ea5e14892fafa6972ae/plugins/differential-review
  commit: 0cc1c73a5e96749ab32d7ea5e14892fafa6972ae
  license: CC-BY-SA-4.0
  icon: 🔬
disable-slash-command: true
---

# Security Diff Review

## Overview & Purpose
Reviews a change for what it does to security, not whether it is tidy. Depth scales
with codebase size and risk, every finding carries evidence (line, commit, attack
scenario), coverage limits are stated, and the result is always a report file.

Adapted from Trail of Bits' `differential-review` skill. This folder is released under
**CC-BY-SA-4.0**, not the repository's MIT licence (see `LICENSE`, `NOTICE.md`).
Boundaries: `requesting-code-review` and `receiving-code-review` cover general review
etiquette and quality; `security-audit` audits a whole codebase; `variant-analysis`
follows up a confirmed finding across the repo.

## Execution Triggers & Prerequisites
### Execution Triggers
- "Security review this PR/diff/commit", "could this change re-introduce the old bug",
  "what else could this break", "which changed code has no test".
- A code review where the diff touches auth, crypto, external calls, value transfer
  or input validation.

### Prerequisites
- A git checkout with history for the base and head.
- The project's test runner if coverage is to be measured, not estimated.

## Input & Output Requirements
### Inputs
| Parameter | Type | Required | Description |
|---|---|---|---|
| Change | PR, commit range or patch | Yes | What to review |
| Base | ref | Yes | Baseline to compare against |
| Time box | text | No | Drives strategy; coverage limits stated if cut short |

### Outputs
| Artifact | Path / Format | Description |
|---|---|---|
| Report | `DIFFERENTIAL_REVIEW_REPORT.md` | Structure in [references/reporting.md](references/reporting.md) |
| Summary | Handoff report | Top findings, confidence, what was not covered |

## Step-by-Step Execution Runbook

### Phase 0 — Triage
1. Size the codebase: SMALL (<20 files, deep), MEDIUM (20–200, focused, 1-hop deps),
   LARGE (200+, surgical, critical paths only).
2. Classify each changed file by risk: HIGH (auth, crypto, external calls, value
   transfer, validation removal), MEDIUM (business logic, state, new public API),
   LOW (comments, tests, UI, logging). Classify by risk, never by diff size.

### Phase 1 — Code and history
1. Read each HIGH and MEDIUM change in full context.
2. `git blame` / `git log -S` on removed lines: removed code from a "fix", "CVE" or
   "security" commit is an immediate red flag.

### Phase 2 — Test coverage
1. Find which modified functions have no test exercising them; missing tests raise
   the finding's risk rating.

### Phase 3 — Blast radius
1. Count callers of each modified HIGH-risk function (transitively where cheap).
   50+ callers plus a HIGH change requires Phase 5.

### Phase 4–5 — Deep context and adversarial modelling
1. For HIGH-risk changes, build the attacker model, attack vector, exploitability and
   a concrete exploit scenario ([references/adversarial.md](references/adversarial.md));
   compare with known patterns in [references/patterns.md](references/patterns.md).
   Detailed phase guidance: [references/methodology.md](references/methodology.md).

### Phase 6 — Report
1. Write the report file with findings (line numbers, commits, scenario), coverage
   gaps, blast radius and a stated confidence level.

## Code & Config Exemplars

### Exemplar 1: History checks on a removed guard
```bash
git log -S "require_admin" --oneline -- src/api/
git blame -L 40,60 origin/main -- src/api/users.py
git grep -n "def update_role" && git grep -n "update_role(" | wc -l   # blast radius
```

### Exemplar 2: One finding
```markdown
### DR-2 (HIGH) — admin check removed from role update
- Change: src/api/users.py:52 drops `require_admin(user)` (commit a1b2c3d)
- History: the check was added in 7e8f9a0 "fix: privilege escalation via role update"
- Blast radius: 14 callers; no test covers a non-admin caller
- Scenario: any logged-in user PATCHes /users/{id}/role to "admin"
```

## Edge Cases & Error Recovery

### Scenario A: "It's a small PR"
1. **Recovery Protocol**: Classify by risk anyway; a two-line change to auth is HIGH.

### Scenario B: "Just a refactor"
1. **Recovery Protocol**: Treat as HIGH until invariants are shown to hold.

### Scenario C: Time runs out
1. **Recovery Protocol**: Cover HIGH files first and state what was not reviewed.

## Verification Checklist
- [ ] Every changed file has a risk class.
- [ ] Removed security-relevant code was traced through git history.
- [ ] Blast radius counted for every HIGH change.
- [ ] Attack scenarios are concrete and tied to lines and commits.
- [ ] The report file exists and states coverage limits and confidence.

Full upstream method text: [references/upstream-method.md](references/upstream-method.md).
