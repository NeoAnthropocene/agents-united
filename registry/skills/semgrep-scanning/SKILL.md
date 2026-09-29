---
name: semgrep-scanning
description: Runs a Semgrep security scan over a codebase - detects languages,
  picks official and third-party rulesets, gets the scan plan approved, runs
  with telemetry off, and merges results to one SARIF file, in "run all" or
  "important only" mode. Use when asked to scan code for vulnerabilities with
  Semgrep or run a first-pass SAST scan; not for writing custom rules or for
  parsing SARIF that already exists.
metadata:
  author: Trail of Bits / agents-united
  version: 1.0.0
  source: https://github.com/trailofbits/skills/tree/0cc1c73a5e96749ab32d7ea5e14892fafa6972ae/plugins/static-analysis/skills/semgrep
  commit: 0cc1c73a5e96749ab32d7ea5e14892fafa6972ae
  license: CC-BY-SA-4.0
  icon: 🔎
disable-slash-command: true
---

# Semgrep Scanning

## Overview & Purpose
A disciplined Semgrep scan: language detection, ruleset selection that always adds
third-party rules (Trail of Bits, 0xdea, Decurity) for the detected languages, an
explicit approval gate, telemetry off on every command, and one merged SARIF result
with a record of what did not run.

Adapted from Trail of Bits' `static-analysis/semgrep` skill. This folder is released
under **CC-BY-SA-4.0**, not the repository's MIT licence (see `LICENSE`, `NOTICE.md`).
Boundaries: `security-audit` is a manual OWASP checklist; `codeql-scanning` gives
deeper inter-procedural taint analysis where a build is available; `sarif-triage`
processes the output; `variant-analysis` hunts siblings of one known bug.

## Execution Triggers & Prerequisites
### Execution Triggers
- "Run Semgrep", "scan this repo for vulnerabilities", "first-pass SAST".
- Not when the project already runs Semgrep in CI (read that pipeline's results instead).

### Prerequisites
- `semgrep --version` works (pip, pipx or Homebrew; on Windows use WSL or the
  Docker image if the native build is unavailable).
- `git` for cloning third-party rule repos. Python 3.11+ for `scripts/merge_sarif.py`.
- Optional Semgrep Pro for cross-file taint tracking (check in Phase 1).

## Input & Output Requirements
### Inputs
| Parameter | Type | Required | Description |
|---|---|---|---|
| Target | absolute path | Yes | Code to scan |
| Mode | run-all / important-only | Yes | Chosen in Phase 2 |
| Output dir | path | No | Defaults to `static_analysis_semgrep_<n>` (first unused n) |

### Outputs
| Artifact | Path / Format | Description |
|---|---|---|
| Approved plan | `<out>/rulesets.json` | Exact rulesets, target, engine, mode |
| Raw results | `<out>/raw/<lang>-<ruleset>.{json,sarif}` | One pair per scan |
| Merged SARIF | `<out>/results/results.sarif` | Input for `sarif-triage` |
| Summary | Handoff report | Counts by severity/category, plus failed and skipped scans |

## Step-by-Step Execution Runbook

### Phase 1 — Detect
1. Create the output directory with `raw/` and `results/`.
2. Count files per language with file search (not a shell loop).
3. Check Pro: `semgrep --pro --validate --metrics=off --config p/default`. Record the
   reason if it fails; do not silently downgrade.

### Phase 2 — Select
1. Choose the mode ([references/scan-modes.md](references/scan-modes.md)).
2. Build the ruleset list with the algorithm in
   [references/rulesets.md](references/rulesets.md): baseline `p/security-audit` and
   `p/secrets`, per-language packs, framework packs, and the third-party repos that
   match each detected language.

### Phase 3 — Approval gate (hard stop)
1. Present target, mode, engine (Pro or OSS) and the exact ruleset list. The original
   "scan this" request is **not** approval; wait for an explicit yes.
2. Write the approved list to `rulesets.json`. Do not add rulesets afterwards.

### Phase 4 — Run
1. Run the helper against the approved plan (works the same on Windows and POSIX; it
   needs only Python 3, `git` and `semgrep`):
   `python scripts/run_scans.py --target <abs-target> --output-dir <abs-out>
   --mode run-all|important-only --rulesets <out>/rulesets.json [--pro]`.
   Preview the commands first with `--dry-run`.
2. It clones third-party rule repos once into `<out>/repos/`, runs one command per
   language-scoped ruleset (with `--include` for that language) and one unscoped command per
   cross-language ruleset, and puts `--metrics=off` and the output-directory exclusion on
   every command. Do not type semgrep commands by hand for the approved plan.
3. Read `<out>/scans.json`: every scan's exit code and finding count is there. A scan that
   failed, was skipped or covered nothing goes in the report, never silently dropped.

### Phase 5 — Filter, merge, report, clean up
1. Important-only: apply the metadata post-filter from `scan-modes.md` to each JSON file.
2. Merge: `python scripts/merge_sarif.py <out>/raw <out>/results/results.sarif`
   (add `--important` in important-only mode).
3. Report counts by severity and category, list failed/skipped scans, delete `<out>/repos/`.

## Code & Config Exemplars

### Exemplar 1: What the helper runs for one language-scoped scan
```bash
semgrep scan --metrics=off --config p/python --include "*.py" \
  --exclude "static_analysis_semgrep_1" \
  --json -o static_analysis_semgrep_1/raw/python-python.json \
  --sarif-output static_analysis_semgrep_1/raw/python-python.sarif /abs/target
```

### Exemplar 2: Plan presented at the gate
```text
Target: /abs/target   Engine: OSS (Pro: not logged in)   Mode: important-only
Rulesets: p/security-audit, p/secrets, p/python, p/django,
          trailofbits/semgrep-rules (python), 0xdea/semgrep-rules (python)
Proceed? (yes / edit list)
```

## Edge Cases & Error Recovery

### Scenario A: A third-party repo will not clone
1. **Recovery Protocol**: Continue with the rest, list it as skipped in the report.

### Scenario B: Every scan failed
1. **Diagnosis**: No results to merge.
2. **Recovery Protocol**: Report the failure and stop; do not hand-run a subset and
   present it as a full scan.

### Scenario C: Zero findings
1. **Recovery Protocol**: Confirm the language filters matched files (check "covered
   nothing" scans) before reporting a clean result.

## Verification Checklist
- [ ] Every `semgrep` command used `--metrics=off`; `--config auto` was never used.
- [ ] The plan was explicitly approved and `rulesets.json` matches what ran.
- [ ] Third-party rulesets were included for every detected language.
- [ ] Failed, skipped and covered-nothing scans are listed in the report.
- [ ] `results/results.sarif` exists and parses as JSON; cloned repos removed.

Full upstream method text: [references/upstream-method.md](references/upstream-method.md)
and [references/workflow-scan-workflow.md](references/workflow-scan-workflow.md).
