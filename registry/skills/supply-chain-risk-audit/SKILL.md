---
name: supply-chain-risk-audit
description: Audits a project's dependencies for supply-chain risk -
  version-matched advisories for direct dependencies and the lockfile tree,
  abandoned or archived upstreams, npm publisher concentration and
  install-time scripts - with measured figures from bundled collector
  scripts. Use when asked to audit dependencies or third-party package risk
  for npm, PyPI or Go projects; not for licence compliance or scanning the
  project's own source.
metadata:
  author: Trail of Bits / agents-united
  version: 1.0.0
  source: https://github.com/trailofbits/skills/tree/0cc1c73a5e96749ab32d7ea5e14892fafa6972ae/plugins/supply-chain-risk-auditor
  commit: 0cc1c73a5e96749ab32d7ea5e14892fafa6972ae
  license: CC-BY-SA-4.0
  icon: 📦
disable-slash-command: true
---

# Supply-Chain Risk Audit

## Overview & Purpose
Produces a supply-chain risk report whose every figure is measured, not estimated:
two bundled Python scripts query registries, advisory databases and repository
metadata; the agent adds only the judgment they cannot automate (what to act on
first, upgrade paths, replacement candidates).

Adapted from Trail of Bits' `supply-chain-risk-auditor` skill. This folder is released
under **CC-BY-SA-4.0**, not the repository's MIT licence (see `LICENSE`, `NOTICE.md`).
Boundaries: `dependency-management` covers routine upgrades and lockfile hygiene;
`security-audit` covers the project's own code; this skill measures the risk of
*other people's* packages and never reads dependency source.

## Execution Triggers & Prerequisites
### Execution Triggers
- "Audit our dependencies", "third-party package risk", "is this dependency tree safe".
- An AppSec engagement kickoff that includes the dependency tree.

### Prerequisites
- Python 3.11+ (standard library only), run as `python scripts/collect.py` or
  `uv run scripts/collect.py`; works the same on Windows and POSIX.
- Authenticated `gh` (`gh auth status`) for repository criteria; without it GitHub's
  60 requests/hour limit leaves many rows unassessable, and the report says so.
- Network access to the npm, PyPI and Go ecosystems' public APIs.

## Input & Output Requirements
### Inputs
| Parameter | Type | Required | Description |
|---|---|---|---|
| Project dir | path | Yes | Contains `package.json`, `pyproject.toml`, `requirements*.txt` or `go.mod` |
| Output dir | path | No | Outside the audited repo by default |

### Outputs
| Artifact | Path / Format | Description |
|---|---|---|
| Findings | `<out>/findings.json` | The datum behind every verdict |
| Report | `<out>/report.md` | Rendered facts, plus a clearly separated agent addendum |

## Step-by-Step Execution Runbook

### Phase 1 — Check scope
1. Confirm a supported manifest exists; otherwise say the ecosystem is unsupported and stop.
2. Note lockfiles: `package-lock.json`/`npm-shrinkwrap.json`, `uv.lock` and go 1.17+
   `go.mod` are read; `yarn.lock`, `pnpm-lock.yaml` and `poetry.lock` are not (the
   report says so and falls back to pins or latest release).
3. Run `gh auth status` and record the result.

### Phase 2 — Collect and render
1. `python scripts/collect.py <project-dir> --json <out>/findings.json`
2. `python scripts/render.py <out>/findings.json --out <out>/report.md`
3. If `collect.py` exits non-zero it is refusing to report on missing data; relay its
   message verbatim instead of working around it.

### Phase 3 — Add judgment, separately labelled
1. A short "act on first" narrative with the reason.
2. Upgrade paths for advisories (patch vs major bump).
3. Replacement candidates for abandoned or archived packages, verified to exist and
   labelled as judgment.
4. For flagged install scripts, whether `npm ci --ignore-scripts` is viable.

## Code & Config Exemplars

### Exemplar 1: A run
```bash
gh auth status
python scripts/collect.py ./my-service --json ../audit/findings.json
python scripts/render.py ../audit/findings.json --out ../audit/report.md
```

### Exemplar 2: Register for the addendum
```text
axios 0.21.1 carries 25 advisories; upgrading to 1.7.4 clears all of them and is a
major-version change that requires re-testing request interceptors.
```
Impersonal, active voice, no intensifiers; state the finding, the datum and the action.

## Edge Cases & Error Recovery

### Scenario A: Clean report on PyPI or Go
1. **Diagnosis**: Those ecosystems expose fewer criteria (no maintainer ACL, no registry).
2. **Recovery Protocol**: Quote the coverage table; "no findings" means "none among
   what was assessed".

### Scenario B: Tempted to fill gaps from memory or web search
1. **Recovery Protocol**: Do not. Unassessable rows stay unassessable; they bound
   every claim in the report.

### Scenario C: Rate-limited GitHub
1. **Recovery Protocol**: Say `gh` was unauthenticated and which criteria came back
   unassessable; re-run after `gh auth login` if the user wants them.

## Verification Checklist
- [ ] Every figure in the deliverable comes from `findings.json`, quoted verbatim.
- [ ] Unassessable rows and the coverage table are kept.
- [ ] Agent-added judgment is labelled and separate from measured facts.
- [ ] Unsupported lockfiles or ecosystems are named in the report.
- [ ] Nothing was installed, built or executed from the dependencies.

Full upstream method text: [references/upstream-method.md](references/upstream-method.md).
