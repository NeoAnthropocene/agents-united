# Plan 027: Third-Party Skill Ingestion — Batch 1 (Engineering, Security, SRE, ML/Data)

> **Executor instructions**: self-contained; TDD; STOP on listed conditions; update this plan's
> row in `plans/README.md` when done. Source evidence: owner-supplied source
> `github.com/VoltAgent/awesome-agent-skills#official-skills-by`, triaged by a research pass
> 2026-09-27 into the shortlist below (see § Evidence). Runs independently of Plans 025/026/028;
> touches only new `registry/skills/<name>/SKILL.md` directories, the `skills` arrays of the
> bundles named below in `registry/bundles.json`, and README.md's Credits section.

## Status

- **State**: PROPOSED — awaiting owner approval on the shortlist (§ Shortlist) before any skill
  is authored
- **Priority**: P2 · **Effort**: L · **Risk**: Low (additive; no existing agent/skill is
  modified except one naming collision noted below)
- **Depends on**: none (independent of 025/026/028; if Plan 025 lands first, author new skills
  directly in the "Skill Consultation Map" convention it establishes — otherwise use the
  existing flat `skills:` frontmatter convention and no rework is needed)
- **Category**: catalog / skills
- **Branch**: `feat/third-party-skills-batch-1` (cut fresh from `dev` when authorized)

## Why this exists

The owner asked to mine `VoltAgent/awesome-agent-skills` — a large, vendor-heavy aggregator —
for skills worth adding to the engineering-adjacent domains, explicitly asking for a curated
pick rather than a bulk import, and explicitly excluding ground already covered here (TDD,
debugging, git guardrails, code review, RAG/vector DBs, cloud IaC all already have skills in
this catalog). A same-day triage against that list, filtered against `registry/bundles.json`'s
current skill inventory per domain, produced twelve candidates with no existing overlap.

## Evidence / Shortlist

| # | Skill (working name) | Vendor / source | One-line | Target bundle |
|---|---|---|---|---|
| 1 | `postgres-best-practices` | Supabase | PostgreSQL optimization, indexing, query patterns | `backend-distributed-systems` |
| 2 | `web-perf-audit` | Cloudflare | Core Web Vitals auditing and performance tuning | `frontend-engineering` |
| 3 | `terraform-test-patterns` | HashiCorp | Acceptance/config testing framework for IaC | `devops-engineering` |
| 4 | `edge-security-audit` | Cloudflare | Multi-phase security audit workflow for edge/Workers apps | `security-operations` (see § Naming collision) |
| 5 | `adversarial-threat-modeling` (subset of Trail of Bits' 22-skill set: threat modeling, fuzzing, contract security, vuln detection) | Trail of Bits | Deep, adversarial security review methodology | `secops-application-security` |
| 6 | `observability-incident-triage` (subset of Sentry's 40+ skills: issue diagnosis, alert config) | Sentry | Observability setup and incident triage across platforms | `sysops-sre` |
| 7 | `clickhouse-architecture-advisor` | ClickHouse | System/schema design patterns for analytical workloads | `system-architecture` |
| 8 | `neon-postgres-egress-optimizer` | Neon | Data-transfer/cost optimization for serverless Postgres | `backend-distributed-systems` |
| 9 | `hf-model-training` (TRL-based fine-tuning) | Hugging Face | Fine-tuning workflow orchestration | `ai-ml-engineering` |
| 10 | `hf-managed-jobs` (hf-cli / Hugging Face Jobs) | Hugging Face | Managed compute job execution for ML pipelines | `ai-ml-engineering` |
| 11 | `expo-cicd-workflows` | Expo | Mobile CI/CD pipeline generation | `mobile-development` |
| 12 | `wp-performance-audit` | WordPress community | Static analysis (phpstan) and performance profiling for PHP/WP | `qa-automation` |

Explicitly **not** shortlisted (lower priority / too vendor-narrow / redundant, per the triage):
a 50+ multi-framework E2E test skill (overlaps existing `test-driven-development` /
`playwright-best-practices` coverage), Netlify/Vercel deploy skills (redundant with the existing
`vercel-deploy-best-practices` skill and the Cloudflare picks above), Sanity's CMS-specific SEO/
content-experimentation skills (too CMS-niche for a bundle-wide fit), Composio (integration
glue, not domain knowledge — out of scope for a skill).

### Naming collision — resolve at Step 0

`security-operations` already has a skill named `security-audit`
(`registry/bundles.json` → `security-operations.skills`). Candidate #4's working name
`edge-security-audit` avoids a direct collision, but Step 0 must confirm the two skills'
scopes don't overlap in practice (existing `security-audit` is the general orchestrator-level
audit skill; #4 is Cloudflare/edge-specific) and STOP to ask the owner if they'd rather merge
Cloudflare's edge-specific guidance into the existing skill instead of adding a new one.

## Objective

1. Get owner sign-off on the shortlist (or a trimmed version of it) before authoring anything —
   this is a curation exercise, not a bulk import, and the owner may want to cut further.
2. For each approved skill, author `registry/skills/<name>/SKILL.md` conforming to PROJECT.md
   §7.2's 7 mandatory sections (or Plan 025's "Skill Consultation Map"-compatible shape if that
   plan has landed first), with the README.md §5 "Skill & Agent Contribution Standard"
   frontmatter (`metadata.author`, `metadata.version`, `metadata.source`, `metadata.license`)
   pointing at the real upstream project, not a placeholder.
3. Add each new skill to its target bundle's `skills` array in `registry/bundles.json` — only
   that bundle's array; do not touch other bundles' entries to keep this plan's diff isolated
   from Plans 025/026/028 sharing the same file.
4. Add a `## Credits & Acknowledgments` entry per skill in README.md, matching the existing
   entries for Modal Labs, Replicate, Supabase, etc.
5. Where a shortlisted item is itself a multi-skill set (Trail of Bits' 22 skills, Sentry's 40+),
   ship exactly one synthesized skill per row above (not all upstream skills individually) —
   the row's one-line description is the scope boundary; do not silently expand it into a
   separate skill per upstream file.

## Implementation steps (TDD)

**Step 0 — owner sign-off + naming collision resolution (delegate: none — surface directly).**
Present the shortlist table for approval/trim. Resolve the `security-audit` /
`edge-security-audit` naming and scope question per § Naming collision. STOP until answered.

**Step 1 — RED tests (delegate: `subagent-qa-automation-lead`).**
`tests/skill-schema.test.ts` extension (if not already generic) asserting: every skill listed
in a bundle's `skills` array in `registry/bundles.json` has a corresponding
`registry/skills/<name>/SKILL.md`; every new skill's frontmatter has non-placeholder
`metadata.author`/`metadata.source`; every new skill has all 7 PROJECT.md sections. These
should fail (missing files) until Step 2 lands each skill.

**Step 2 — author skills (delegate: `subagent-backend-architect` for #1/3/7/8, `subagent-
security-engineer` or `subagent-appsec-penetration-tester` for #4/5, `subagent-sysops-sre-lead`
for #6, `subagent-ai-model-architect`/`subagent-ml-platform-engineer` for #9/10, `subagent-
cross-platform-specialist` for #11, `subagent-qa-automation-lead` for #12).** One skill per
specialist invocation, each grounded in the real upstream source's documented practices (do not
fabricate commands/APIs — cite the real CLI/API surface of Supabase, Cloudflare, Trail of Bits,
Sentry, ClickHouse, Neon, Hugging Face, Expo, or WordPress tooling as applicable).

**Step 3 — bundle wiring + credits (delegate: `subagent-backend-architect`).** Add each skill
to its target bundle's `skills` array in `registry/bundles.json`; add the README.md credit
block per skill.

**Step 4 — adversarial audit (delegate: `subagent-code-reviewer`).** Verify no fabricated API
surface (spot-check against real upstream docs for at least 3 of the 12 skills), verify no
`registry/bundles.json` edit touched a bundle outside this plan's target list, verify a fresh
`agents doctor` and `agents list` show the new skills correctly attributed to their bundles.

## Acceptance gates

1. `npm run typecheck` exit 0 · `npm test` fully green including the skill-schema assertions.
2. All 12 (or owner-trimmed subset) skills exist under `registry/skills/`, each with real
   attribution metadata and all 7 PROJECT.md sections.
3. Each skill appears in exactly the bundle(s) named in § Shortlist's target column, and no
   other bundle's `skills` array changed.
4. README.md Credits section has one new entry per shipped skill, matching the existing format.
5. The `security-audit` / `edge-security-audit` naming question is resolved and recorded in
   this plan's verification note before Step 2 starts.
6. `agents list` and `agents find <new-skill-name>` surface every new skill correctly.

## Risk register

| # | Risk | Sev | Mitigation |
|---|---|---|---|
| R1 | Skill content fabricates or misstates a vendor's actual API/CLI | High | Step 4 spot-check against real upstream docs; each specialist must cite the real command surface, not invent one |
| R2 | `registry/bundles.json` edit collides with a parallel plan's edit to the same file | Med | Step 3 touches only the 6 target bundles' `skills` arrays; rebase against `dev` before merging if 025/026/028 land first |
| R3 | Trail of Bits/Sentry "one synthesized skill from a 22/40+ skill set" loses fidelity vendors intended as separate tools | Med | scope explicitly bounded per row; if a reviewer finds the synthesis too shallow, split into 2 skills max, not the full upstream count |
| R4 | New `security-operations`-adjacent skill collides in name or scope with the existing `security-audit` skill | Med | Step 0 resolution gate before any authoring begins |

## Delegation map (ADR 0015 planner-orchestrator posture)

| Phase | Specialist | Scope |
|---|---|---|
| Step 0 | (owner-facing, no delegate) | shortlist approval + naming resolution |
| Step 1 | `subagent-qa-automation-lead` | RED schema/attribution tests |
| Step 2 | domain specialist per skill (see step description) | skill authoring |
| Step 3 | `subagent-backend-architect` | bundle wiring + README credits |
| Step 4 | `subagent-code-reviewer` | adversarial audit |

## References

- Evidence: research pass against `github.com/VoltAgent/awesome-agent-skills#official-skills-by`,
  2026-09-27 (this session).
- Convention: README.md §"Skill & Agent Contribution Standard" (frontmatter attribution,
  README credits, deterministic verifications).
- Sibling: Plan 025 establishes the Skill Consultation Map convention for how agents reference
  skills — if it lands first, wire each new skill into the relevant specialist's map instead of
  (or in addition to) the flat `skills:` array. Plan 026's host primitive matrix should be
  consulted for any skill that bundles scripts, to confirm the script executes cleanly across
  all three hosts' progressive-disclosure model.
