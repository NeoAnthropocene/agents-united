---
name: sarif-triage
description: Reads, filters, deduplicates, merges and diffs SARIF results from
  Semgrep, CodeQL or any other scanner, resolving severity correctly and
  producing a prioritised finding list or a new-versus-baseline diff. Use when
  scan results already exist as SARIF and need triage, aggregation, CI gating
  or conversion; not for running scans or reading source code directly.
metadata:
  author: Trail of Bits / agents-united
  version: 1.0.0
  source: https://github.com/trailofbits/skills/tree/0cc1c73a5e96749ab32d7ea5e14892fafa6972ae/plugins/static-analysis/skills/sarif-parsing
  commit: 0cc1c73a5e96749ab32d7ea5e14892fafa6972ae
  license: CC-BY-SA-4.0
  icon: 🗂️
disable-slash-command: true
---

# SARIF Triage

## Overview & Purpose
Turns one or more SARIF 2.1.0 files into a triage-ready list: severity resolved the
way the spec defines it (a result's `level` may be absent and inherited from its
rule), duplicates collapsed by stable fingerprint, paths normalised, and new findings
separated from a baseline.

Adapted from Trail of Bits' `static-analysis/sarif-parsing` skill. This folder is
released under **CC-BY-SA-4.0**, not the repository's MIT licence (see `LICENSE`,
`NOTICE.md`). Boundaries: `semgrep-scanning` and `codeql-scanning` produce the SARIF;
`variant-analysis` goes back to source for siblings of a confirmed finding;
`security-audit` is a manual review without scanner output.

## Execution Triggers & Prerequisites
### Execution Triggers
- "Parse / summarise / deduplicate these SARIF results", "what's new since main".
- A scan skill hands over `results.sarif`, or CI needs a fail-on-new-findings gate.

### Prerequisites
- `jq` for quick queries, or Python 3.10+ for `scripts/sarif_helpers.py` (standard
  library only; works the same on Windows and POSIX).

## Input & Output Requirements
### Inputs
| Parameter | Type | Required | Description |
|---|---|---|---|
| SARIF file(s) | paths | Yes | One or more `.sarif` files |
| Baseline | path | No | Earlier SARIF for new/fixed diffing |
| Filters | levels, rules, paths | No | What to keep |

### Outputs
| Artifact | Path / Format | Description |
|---|---|---|
| Triage list | Markdown table or CSV | rule, level, file:line, message, fingerprint |
| Diff | Markdown | New and fixed findings against the baseline |
| Merged SARIF | `.sarif` | When several tools' output must become one file |

## Step-by-Step Execution Runbook

### Phase 1 — Inspect
1. Check `version` is `2.1.0` and count runs, results and distinct rule ids.
2. Pick the tool: `jq` for a one-off question, `scripts/sarif_helpers.py` for
   anything repeated, merged or diffed ([references/upstream-method.md](references/upstream-method.md)
   compares options).

### Phase 2 — Resolve severity and locations
1. Resolve each result's level from the result, then its rule's
   `defaultConfiguration.level`, then `warning`; a non-`fail` kind is `none`
   (`resolve_level`).
2. Normalise URIs (strip `file://`, decode, make relative to the repo root).

### Phase 3 — Deduplicate and filter
1. Deduplicate by `partialFingerprints` when present, otherwise by a computed
   fingerprint of rule, path and line (`compute_fingerprint`, `deduplicate`).
2. Apply the requested level, rule and path filters.

### Phase 4 — Compare and report
1. With a baseline, report new and fixed findings (`diff_findings`).
2. Group by file or rule, sort by severity, and hand over the table; note any tool
   whose run reported errors in `invocations`.

## Code & Config Exemplars

### Exemplar 1: Python triage
```python
from sarif_helpers import load_sarif, extract_findings, deduplicate, filter_by_level, count_by_rule

findings = deduplicate(extract_findings(load_sarif("results/results.sarif")))
serious = filter_by_level(findings, "error", "warning")
print(count_by_rule(serious))
```

### Exemplar 2: jq one-liners
```bash
jq '[.runs[].results[]] | length' results.sarif
jq '[.runs[].results[].ruleId] | unique' results.sarif
```
Level-aware jq filters are in [references/jq-queries.md](references/jq-queries.md).

## Edge Cases & Error Recovery

### Scenario A: Every result shows the same level
1. **Diagnosis**: The query read `result.level` only; the tool puts levels on rules.
2. **Recovery Protocol**: Resolve through the rule (Phase 2).

### Scenario B: Duplicates survive across runs
1. **Diagnosis**: Line numbers shifted, so line-based fingerprints differ.
2. **Recovery Protocol**: Prefer tool `partialFingerprints`; otherwise fingerprint on
   a code snippet rather than the line number.

### Scenario C: Very large SARIF
1. **Recovery Protocol**: Stream results per run rather than loading all runs at once.

## Verification Checklist
- [ ] Severity resolved through the rule, not read from `result.level` alone.
- [ ] Paths normalised before grouping or diffing.
- [ ] Duplicates removed and the method stated.
- [ ] Tool errors from `invocations` surfaced, not hidden.
- [ ] Output lists rule, level, location and message for every kept finding.
