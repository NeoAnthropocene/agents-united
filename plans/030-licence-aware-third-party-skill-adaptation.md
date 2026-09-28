# Plan 030: Licence-Aware Third-Party Skill Adaptation — Copyleft and Share-Alike Sources

> **Executor instructions**: self-contained; TDD; STOP on listed conditions; update this plan's
> row in `plans/README.md` when done. Source: the owner's request of 2026-09-28 (project thread)
> to adapt the skills Plan 027 left as link-only stubs, giving credit in README
> § Credits & Acknowledgments, plus a licence audit of the upstream clones the same day
> (§ Evidence). Runs in parallel with Plan 029. Files touched: `docs/skill-intake.md`,
> README (Skill & Agent Contribution Standard; Credits & Acknowledgments), a new ADR
> (`docs/adr/0024-*`), `registry/skills/<new or replaced>/**`, `registry/bundles.json`, the
> security/devops/QA specialists' `skills:` frontmatter and Skill Consultation Maps,
> `src/core/skill-portability-lint.ts` (or a sibling licence lint), `tests/**`, total skill
> counts in README/PROJECT.md/CONTEXT.md.

## Status

- **State**: PROPOSED — 2026-09-28 (owner asked for this plan; awaiting approval and the
  Step 0 owner decisions)
- **Priority**: P2 · **Effort**: M · **Risk**: Medium (licence compliance; the catalog
  starts carrying non-MIT files)
- **Depends on**: the Claude projector fix for nested skill folders (see § Prerequisite).
  Independent of Plan 029.
- **Category**: catalog / skills / licensing
- **Branch**: `feat/licence-aware-skill-adaptation` (cut fresh from `dev` when authorized)

## Why this exists

Plan 027 left two skills as link-only stubs, `threat-modeling` (Trail of Bits) and
`terraform-test-patterns` (HashiCorp), and dropped others, because `docs/skill-intake.md` §1
allows only MIT, Apache-2.0, BSD, CC-BY and public-domain sources. The owner wants those skills
adapted into the bundles where they belong, with credit in the README.

Two findings change the picture:

1. **`threat-modeling` was never licence-blocked.** The stub cites the repo-root
   CC-BY-SA-4.0 licence of `trailofbits/skills-curated`, but the skill it describes is the
   `openai-security-threat-model` plugin, which carries its own **Apache-2.0** `LICENSE`. Same
   for `openai-security-best-practices`. Both can be vendored under the existing policy today.
   This corrects Plan 027 Step 0.
2. **Credits alone do not satisfy share-alike or copyleft licences.** A README credit meets the
   *attribution* term of CC-BY-SA-4.0 and MPL-2.0, but not their other terms:
   - **CC-BY-SA-4.0** (Trail of Bits `skills`): an adapted skill must itself be released under
     CC-BY-SA-4.0 (or a compatible licence), carry a licence notice or link, and say that it
     was changed. The share-alike reaches the adapted skill, not the rest of this repository,
     because each skill sits in its own folder as a separate work.
   - **MPL-2.0** (HashiCorp `agent-skills`): file-level copyleft. The files we take and modify
     stay MPL-2.0, and the licence text travels with them. The rest of the repository keeps
     its own licence.

   So vendoring is possible, but only if each such skill folder carries its licence file, a
   `metadata.license` value, and a changes note, alongside the README credit. This is a
   reading of the licences, not legal advice; the owner confirms it in Step 0.

## Evidence

- `trailofbits/skills` @ `0cc1c73a5e96749ab32d7ea5e14892fafa6972ae`: root `LICENSE`
  CC-BY-SA-4.0; no per-plugin override found for the shortlisted plugins.
- `trailofbits/skills-curated` @ `6d05be4889017b06fb15069f371afd220daffb62`: root licence
  CC-BY-SA-4.0, but per-plugin licences differ. `openai-*` plugins (including
  `openai-security-threat-model` and `openai-security-best-practices`) ship an Apache-2.0
  `LICENSE`; `ffuf-web-fuzzing`, `react-pdf`, `security-awareness` and others ship MIT;
  `wooyun-legacy` is CC-BY-NC-SA (never usable); plugins with no own licence fall back to the
  root CC-BY-SA-4.0.
- `hashicorp/agent-skills` @ `516354c484b43fa5469567485113dd0c769c3d24`: MPL-2.0.
  `terraform-test` is 451 lines; `terraform-style-guide`, `refactor-module` and
  `terraform-policy` sit alongside it.
- Precedent for a licence file inside a skill: `registry/skills/frontend-design/LICENSE.txt`
  (Apache-2.0), carried into `.agents/` by the installer.

## Prerequisite — Claude projection drops skill subfolders

`src/core/claude-projector.ts` copies only the top-level files of each skill folder into
`.claude/skills/<name>/`. Anything under `references/`, `scripts/` or `assets/` never reaches
Claude Code (verified 2026-09-28: a scratch install of `backend-distributed-systems` produced
`.claude/skills/supabase-backend-architecture/` with only `SKILL.md`). This already affects a
dozen shipped skills (the Plan 025 exemplars, `brand-identity`'s scripts, and others). Plan 030
depends on it because an adapted skill's runbook will live in `references/`. This is a bug and
ships as its own fix PR ahead of this plan; Plan 030 only re-checks it in Gate 5.

## Objective

### A. Licence policy

1. **Tiered intake rule** in `docs/skill-intake.md` §1, the README Contribution Standard and a
   new ADR 0024 (amends ADR 0023's intake rule):

   | Tier | Licences | May vendor? | Requirements |
   |---|---|---|---|
   | Permissive | MIT, Apache-2.0, BSD, ISC, CC-BY, public domain | Yes | README credit; upstream `LICENSE`/`NOTICE` copied into the skill folder when the licence asks for it (Apache `NOTICE`, MIT/BSD notice) |
   | Weak copyleft | MPL-2.0 | Yes | Licence file in the skill folder; `metadata.license: MPL-2.0`; modified files stay MPL-2.0; changes note; README credit |
   | Share-alike | CC-BY-SA-4.0 | Yes | Licence file (or canonical link) in the skill folder; `metadata.license: CC-BY-SA-4.0`; the adapted skill is released under CC-BY-SA-4.0; changes note; README credit |
   | Blocked | Any NonCommercial or NoDerivatives term, GPL/AGPL, no licence | No | Link-only stub at most |

2. **Per-skill licence check.** Read the licence closest to the skill (plugin or skill folder)
   before the repository root; record which file decided it.
3. **Changes note.** Every adapted copyleft or share-alike skill gets a short
   `NOTICE.md` in its folder: upstream URL and SHA, licence, and a one-paragraph summary of
   what was changed (restructured to PROJECT.md §7.2, split into `references/`, etc.).
4. **README.** The Credits section replaces the "linked, not vendored" block with real credits,
   and the top-level licence statement says that some skill folders carry their own licence.

### B. Skill adaptation (shortlist; owner trims in Step 0)

| Skill (new name) | Upstream | Licence | Bundle | Specialist wiring |
|---|---|---|---|---|
| `threat-modeling` (replaces stub) | skills-curated `openai-security-threat-model` | Apache-2.0 | secops-application-security | appsec-penetration-tester, security-engineer |
| `security-best-practices` | skills-curated `openai-security-best-practices` | Apache-2.0 | secops-application-security | security-engineer |
| `terraform-test-patterns` (replaces stub) | hashicorp `terraform-test` | MPL-2.0 | devops-engineering | devops-engineer |
| `terraform-style-guide` | hashicorp `terraform-style-guide` | MPL-2.0 | devops-engineering, system-architecture-cloud | devops-engineer, cloud-infrastructure-architect |
| `semgrep-scanning` | trailofbits `static-analysis/semgrep` | CC-BY-SA-4.0 | secops-application-security | security-engineer |
| `codeql-scanning` | trailofbits `static-analysis/codeql` | CC-BY-SA-4.0 | secops-application-security | security-engineer |
| `sarif-triage` | trailofbits `static-analysis/sarif-parsing` | CC-BY-SA-4.0 | secops-application-security | security-engineer, appsec-penetration-tester |
| `supply-chain-risk-audit` | trailofbits `supply-chain-risk-auditor` | CC-BY-SA-4.0 | secops-application-security | security-engineer |
| `variant-analysis` | trailofbits `variant-analysis` | CC-BY-SA-4.0 | secops-application-security | appsec-penetration-tester |
| `security-diff-review` | trailofbits `differential-review` | CC-BY-SA-4.0 | secops-application-security | security-engineer; code-reviewer via a cross-bundle map row |
| `property-based-testing` | trailofbits `property-based-testing` | CC-BY-SA-4.0 | qa-automation | qa-automation-lead |
| `mutation-testing` | trailofbits `mutation-testing` | CC-BY-SA-4.0 | qa-automation | qa-automation-lead |

Out of scope for now: Trail of Bits smart-contract and blockchain scanners, the fuzzing
handbook, and C/C++/Rust review skills (niche; revisit with a demand signal). Never:
`wooyun-legacy` (NonCommercial).

Placement follows `docs/skill-intake.md` §6: all of these are addon-bundle skills; none joins
the `software-engineering` Essentials bundle. Names avoid collisions with the existing
`security-audit`, `edge-security-audit` and `requesting-code-review` skills, and each Overview
states the boundary against them.

## Implementation steps (TDD)

**Step 0 — owner decisions and re-verification (delegate: `subagent-repo-index`; owner).**
(a) The owner confirms the licence reading in § Why this exists (not legal advice) and
approves the tier table. (b) The owner trims or extends the shortlist. (c) Re-read each
shortlisted upstream skill's nearest licence file at the pinned SHA; if upstream has moved,
record the new SHA. STOP if the owner declines vendoring share-alike or copyleft content;
then ship only the two Apache-2.0 skills and leave `terraform-test-patterns` as a stub.

**Step 1 — RED tests (delegate: `subagent-qa-automation-lead`).** For every skill whose
`metadata.license` is not permissive: a licence file and `NOTICE.md` exist in its folder, and
`metadata.source` carries a 40-character SHA. No skill declares a NonCommercial, NoDerivatives
or GPL-family licence. Every vendored skill has a README Credits entry naming its upstream. The
two stubs are gone (no `disable-slash-command` link-only stub remains for an adapted skill).
Anatomy and portability lints (`lintSkillPortability`) pass for each new skill.

**Step 2 — policy (delegate: the orchestrator).** Objective A:
intake doc, README standard, ADR 0024.

**Step 3 — adaptation (delegate: `subagent-security-engineer` for security skills,
`subagent-devops-engineer` for Terraform, `subagent-qa-automation-lead` for testing).** Adapt
each skill to PROJECT.md §7.2 with the long runbook in `references/`; copy the licence file;
write `NOTICE.md`; pin the SHA. Scripts go through the Windows/POSIX check in intake §5.

**Step 4 — wiring (delegate: `subagent-backend-architect` or the orchestrator).** Bundles,
specialist `skills:` frontmatter and Skill Consultation Map rows (Map before Protocol, per the
anatomy test), README Credits, derived skill counts.

**Step 5 — adversarial audit (delegate: `subagent-code-reviewer`).** Each adapted skill really
is an adaptation (not a verbatim dump), carries its licence, and its NOTICE matches what
changed; no NonCommercial content anywhere; Claude, Cline and Antigravity projections all
carry the licence file and `references/`.

## Acceptance gates

1. `npm run typecheck` exit 0 · `npm test` green.
2. The licence tier rule is in `docs/skill-intake.md`, the README standard and ADR 0024.
3. Every shortlisted skill Step 0 kept is adapted, licensed, noticed, pinned, credited and
   wired; both stubs are replaced.
4. `agents doctor --host claude|cline|antigravity` is clean after installing
   `secops-application-security`, `devops-engineering` and `qa-automation`.
5. **Owner manual check (Windows)**: install `secops-application-security` with
   `--fanout claude,cline`; (a) in Claude Code, ask the security orchestrator for a threat
   model of a small repo and confirm the specialist loads the full runbook from
   `references/`; (b) `.claude/skills/threat-modeling/` and `.claude/skills/semgrep-scanning/`
   contain their `LICENSE` and `NOTICE.md`; (c) the same prompt on Cline no longer shows the
   link-only disclosure.

## Risk register

| # | Risk | Sev | Mitigation |
|---|---|---|---|
| R1 | The licence reading is wrong | High | owner confirmation in Step 0; per-folder licence files keep each work's terms explicit; STOP path keeps copyleft content out |
| R2 | Share-alike is read as reaching the whole MIT repo | Med | each adapted skill is a separate work in its own folder with its own licence; the README says so |
| R3 | A per-plugin licence differs from the repo root (as with `threat-modeling`) | Med | Objective A.2: nearest licence file wins; Step 0 re-reads each one |
| R4 | Overlap with `security-audit` / `requesting-code-review` confuses routing | Med | boundary statement in each Overview; distinct names |
| R5 | Parallel PR clashes on skill counts, plans index and map rows (seen with 025–028) | Low | derived counts; rebase on `dev` before merge |

## Delegation map (ADR 0015 planner-orchestrator posture)

| Phase | Specialist | Scope |
|---|---|---|
| Step 0 | `subagent-repo-index` + owner | licence re-read; owner decisions |
| Step 1 | `subagent-qa-automation-lead` | RED tests |
| Step 2 | orchestrator | policy docs, ADR |
| Step 3 | security engineer, devops engineer, QA lead | skill adaptation |
| Step 4 | `subagent-backend-architect` / orchestrator | bundles, wiring, credits |
| Step 5 | `subagent-code-reviewer` | adversarial audit |

## References

- Source: owner request 2026-09-28 (project thread); licence audit of the three upstream
  clones the same day.
- Binding: ADR 0023 / Plan 026 (`docs/skill-intake.md`), Plan 027 (stubs being replaced),
  Plan 025 (specialist anatomy and Skill Consultation Map order).
- Licences: CC-BY-SA-4.0 (creativecommons.org/licenses/by-sa/4.0), MPL-2.0
  (mozilla.org/MPL/2.0), Apache-2.0 (apache.org/licenses/LICENSE-2.0).
- Sibling: Plan 029 (orchestrator MCP access and Antigravity launcher).
