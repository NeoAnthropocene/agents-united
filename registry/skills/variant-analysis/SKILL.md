---
name: variant-analysis
description: Hunts for the other instances of a bug already found - the
  variants of one root cause across a codebase - by building an exact-match
  pattern and generalising it one element at a time with grep, Semgrep or
  CodeQL, then triaging each candidate. Use right after a vulnerability or bad
  pattern is confirmed and the question is "where else does this happen?";
  not for initial discovery with no bug in hand.
metadata:
  author: Trail of Bits / agents-united
  version: 1.0.0
  source: https://github.com/trailofbits/skills/tree/0cc1c73a5e96749ab32d7ea5e14892fafa6972ae/plugins/variant-analysis
  commit: 0cc1c73a5e96749ab32d7ea5e14892fafa6972ae
  license: CC-BY-SA-4.0
  icon: 🧫
disable-slash-command: true
---

# Variant Analysis

## Overview & Purpose
One root cause usually has several manifestations, rarely in the module where the
first one turned up. This skill turns one confirmed finding into a family search:
understand the root cause, match the known instance exactly, generalise step by step
while reading every match, triage, and leave a regression rule behind.

Adapted from Trail of Bits' `variant-analysis` skill. This folder is released under
**CC-BY-SA-4.0**, not the repository's MIT licence (see `LICENSE`, `NOTICE.md`).
Boundaries: `security-audit`, `semgrep-scanning` and `codeql-scanning` do initial
discovery; this skill starts from one known bug. `security-diff-review` checks one
change; `sarif-triage` processes scanner output.

## Execution Triggers & Prerequisites
### Execution Triggers
- A vulnerability, logic bug or bad pattern is confirmed in a specific file and the
  next question is "are there others like this?".
- Generalising one instance into a CodeQL or Semgrep query for its pattern family.

### Prerequisites
- The confirmed instance: file, line, and why it is wrong.
- `rg`/grep; Semgrep and/or CodeQL (with a database) for structural searches.

## Input & Output Requirements
### Inputs
| Parameter | Type | Required | Description |
|---|---|---|---|
| Seed finding | file:line + explanation | Yes | The known bug |
| Scope | paths | No | Whole repo by default |

### Outputs
| Artifact | Path / Format | Description |
|---|---|---|
| Variant report | Markdown ([references/variant-report-template.md](references/variant-report-template.md)) | Confirmed variants with severity, ruled-out candidates, failed patterns |
| Regression rule | Semgrep YAML or CodeQL query | For CI, so the family cannot return |

## Step-by-Step Execution Runbook

### Phase 1 — Root cause
1. State why the code is wrong, not what it does, and list the directions a variant
   could hide in: related identifiers, other APIs with the same mistake, data-type
   edge cases ([references/root-cause.md](references/root-cause.md)).

### Phase 2 — Exact match
1. Write a pattern that matches only the known instance and confirm it hits. A pattern
   that matches nothing means the bug is misunderstood; stop and revisit Phase 1.

### Phase 3 — Generalise one element at a time
1. Relax one element per step (callee, argument shape, sink, sanitiser), run, and read
   every match. Stop generalising when more than half the matches are noise
   ([references/searching.md](references/searching.md) for the ladder and tool choice).
2. Start from the starter templates in `assets/semgrep/` and `assets/codeql/` for the
   language.

### Phase 4 — Triage and report
1. For each candidate decide real / not real with a reason and a severity; try null,
   empty and boundary inputs ([references/triage.md](references/triage.md)).
2. Write the report, including patterns that failed, and propose the CI rule
   ([references/reporting.md](references/reporting.md)).

## Code & Config Exemplars

### Exemplar 1: Climbing the ladder (Semgrep)
```yaml
# Step 0 — exact: only the known sink call
pattern: subprocess.run(f"convert {filename} out.png", shell=True)
# Step 1 — any f-string into run(shell=True)
pattern: subprocess.run(f"...", shell=True)
# Step 2 — any subprocess entry point with shell=True and a non-literal command
patterns:
  - pattern-either:
      - pattern: subprocess.$FN($CMD, ..., shell=True, ...)
  - pattern-not: subprocess.$FN("...", ..., shell=True, ...)
```

### Exemplar 2: Why hunts fail
Narrow scope, a pattern too specific, chasing one vulnerability class, happy-path
testing only, or generalising several elements at once so noise cannot be attributed.

## Edge Cases & Error Recovery

### Scenario A: The generalised pattern floods with noise
1. **Recovery Protocol**: Step back one rung and add a false-positive filter
   (sanitiser, constant argument) instead of reading hundreds of matches.

### Scenario B: No variants found
1. **Recovery Protocol**: Report that explicitly with the patterns tried and the
   scope searched; a negative result is a result.

### Scenario C: Variant sits in vendored or generated code
1. **Recovery Protocol**: Report it with its provenance and route the fix upstream.

## Verification Checklist
- [ ] The exact-match pattern hit the seed before any generalisation.
- [ ] Each generalisation step changed one element and its matches were read.
- [ ] Every candidate is marked real or ruled out, with a reason.
- [ ] The report lists failed patterns and the scope searched.
- [ ] A regression rule is proposed for CI.

Full upstream method text: [references/upstream-method.md](references/upstream-method.md).
