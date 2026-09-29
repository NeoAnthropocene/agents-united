---
name: codeql-scanning
description: Scans a codebase with CodeQL's inter-procedural data-flow and
  taint analysis - builds and quality-checks the database, adds data
  extensions for project-specific sources and sinks, and runs an explicit
  query suite in "run all" or "important only" mode. Use when asked for a
  CodeQL scan, taint or data-flow analysis, or a deep SAST pass on Python,
  JS/TS, Go, Java/Kotlin, C/C++, C#, Ruby or Swift.
metadata:
  author: Trail of Bits / agents-united
  version: 1.0.0
  source: https://github.com/trailofbits/skills/tree/0cc1c73a5e96749ab32d7ea5e14892fafa6972ae/plugins/static-analysis/skills/codeql
  commit: 0cc1c73a5e96749ab32d7ea5e14892fafa6972ae
  license: CC-BY-SA-4.0
  icon: 🧬
disable-slash-command: true
---

# CodeQL Scanning

## Overview & Purpose
Runs CodeQL end to end without the silent failure modes that make "zero findings"
meaningless: a database that built but extracted nothing, a pack's default suite that
filtered every query away, or framework wrappers no shipped model covers.

Adapted from Trail of Bits' `static-analysis/codeql` skill. This folder is released
under **CC-BY-SA-4.0**, not the repository's MIT licence (see `LICENSE`, `NOTICE.md`).
Boundaries: `semgrep-scanning` is faster single-file pattern matching and works without
a build; `sarif-triage` processes the SARIF this produces; `variant-analysis` writes a
targeted query for one known bug.

## Execution Triggers & Prerequisites
### Execution Triggers
- "Run CodeQL", "build a CodeQL database", "taint analysis", "data-flow analysis".
- A Semgrep pass needs cross-file depth and no Semgrep Pro licence is available.

### Prerequisites
- `codeql --version` works (CodeQL bundle, `gh codeql`, or Homebrew cask).
- Python 3.11+ for the two guard scripts in `scripts/` (standard library only).
- For compiled languages, a working build of the project.

## Input & Output Requirements
### Inputs
| Parameter | Type | Required | Description |
|---|---|---|---|
| Target | absolute path | Yes | Source root |
| Language | CodeQL language id | Yes | Detected, or named by the user |
| Mode | run-all / important-only | Yes | See the suite references |
| Existing database | path | No | Discover by its `codeql-database.yml` marker; ask if several |

### Outputs
| Artifact | Path / Format | Description |
|---|---|---|
| Database | `<out>/codeql.db/` | Plus `<out>/build.log` |
| Extensions | `<out>/extensions/*.yml` | Project sources/sinks/summaries, or a stated reason for none |
| Suite | `<out>/raw/<mode>.qls` | Explicit suite, never a bare pack name |
| Results | `<out>/raw/results.sarif`, `<out>/results/results.sarif` | Unfiltered and final |

## Step-by-Step Execution Runbook

### Phase 1 — Build the database
1. Resolve `<out>` (default `static_analysis_codeql_<n>`, first unused n) and create it.
   Existing databases: `python scripts/find_databases.py [root]` lists them, one per line.
   Log each build step with `python scripts/build_log.py step|cmd|result "..."`, and run a
   build command through `python scripts/build_log.py run -- <command>` to log it and keep
   its exit status (log: `$LOG_FILE`, else `<out>/build.log`).
2. Interpreted languages: `codeql database create <out>/codeql.db --language=<lang>
   --source-root=<target>`. Compiled languages: try autobuild, then an explicit
   `--command`, applying fixes from [references/build-fixes.md](references/build-fixes.md);
   `--build-mode=none` only as a last resort, and say so. Apple Silicon exit 137:
   [references/macos-arm64e-workaround.md](references/macos-arm64e-workaround.md).
3. Gate: `python scripts/check_db_quality.py <out>/codeql.db` must exit 0. Detail in
   [references/quality-assessment.md](references/quality-assessment.md).

### Phase 2 — Data extensions
1. Enumerate candidate sources and sinks with
   [references/diagnostic-query-templates.md](references/diagnostic-query-templates.md).
2. Model project wrappers (DB access, request parsing, shell execution) as extension
   YAML ([references/extension-yaml-format.md](references/extension-yaml-format.md));
   full procedure in [references/workflow-create-data-extensions.md](references/workflow-create-data-extensions.md).
   If none are needed, record why.

### Phase 3 — Run the analysis
1. Pick packs from [references/ruleset-catalog.md](references/ruleset-catalog.md)
   (official plus Trail of Bits and Community packs where installed); log them.
2. Write the suite: `python scripts/generate_suite.py run-all|important-only --lang <lang>
   --output-dir <out> [--packs "<pack> <pack>"]` (templates and rationale in
   [references/run-all-suite.md](references/run-all-suite.md) and
   [references/important-only-suite.md](references/important-only-suite.md)).
3. Gate (`generate_suite.py` already runs it and deletes an unverified suite): `python scripts/verify_query_suite.py <out>/raw/<mode>.qls` must exit 0.
4. `codeql database analyze <out>/codeql.db <out>/raw/<mode>.qls --format=sarif-latest
   --output=<out>/raw/results.sarif` with any `--model-packs` / `--threat-model` chosen
   ([references/threat-models.md](references/threat-models.md)). Tuning:
   [references/performance-tuning.md](references/performance-tuning.md).
5. Copy (run-all) or filter (important-only) into `<out>/results/results.sarif`.

## Code & Config Exemplars

### Exemplar 1: Interpreted-language happy path
```bash
codeql database create out/codeql.db --language=python --source-root=/abs/app
python scripts/check_db_quality.py out/codeql.db
python scripts/verify_query_suite.py out/raw/run-all.qls
codeql database analyze out/codeql.db out/raw/run-all.qls \
  --format=sarif-latest --output=out/raw/results.sarif
```

### Exemplar 2: Why an explicit suite
Passing `codeql/python-queries` directly applies that pack's `defaultSuiteFile`, which
can filter a small codebase to zero results. The `.qls` imports both
`security-and-quality` and `security-experimental`.

## Edge Cases & Error Recovery

### Scenario A: Zero findings
1. **Recovery Protocol**: Confirm both guard scripts passed, the extracted file count
   matches the source tree, and extensions were considered. Report all three.

### Scenario B: Several existing databases
1. **Recovery Protocol**: List each with language and creation time and ask which to
   use (or build new) unless the task already names one.

### Scenario C: Build cannot be traced
1. **Recovery Protocol**: Work down the build ladder, log each attempt in `build.log`,
   and mark results from `--build-mode=none` as incomplete.

## Verification Checklist
- [ ] `check_db_quality.py` and `verify_query_suite.py` both exited 0, and the report says so.
- [ ] Analysis used an explicit `.qls`, never a bare pack name.
- [ ] Data extensions created, or skipped with a reason.
- [ ] Packs used are logged; unfiltered SARIF kept in `raw/`.
- [ ] All artifacts live under the output directory.

Full upstream method text: [references/upstream-method.md](references/upstream-method.md),
[references/workflow-build-database.md](references/workflow-build-database.md),
[references/workflow-run-analysis.md](references/workflow-run-analysis.md).
