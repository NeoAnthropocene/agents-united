# Plan 025: Specialist Anatomy Redesign — Skill Consultation Map, Vendor-Neutral Roles & Exemplar Extraction (`domain:engineering` first)

> **Executor instructions**: self-contained; TDD; STOP on listed conditions; update this plan's
> row in `plans/README.md` when done. Source evidence: owner request 2026-09-27 ("subagent
> definitions are not right... code informations and best practise examples should be inside
> the skill itself"), confirmed by a read-only repo audit the same day (see § Evidence).
> Runs in parallel with Plans 026–028. Files touched: `registry/agents/**` (engineering
> specialists), `registry/core/*.json` + `registry/realizations/claude/**` (the 5 Plan 021
> pilot roles), the skills that receive extracted exemplars, `src/core/residue-patterns.ts`
> (body lint seam), goldens under `tests/golden/**`, and PROJECT.md §7.

## Status

- **State**: AUTHORIZED — owner approved 2026-09-27 (via project thread)
- **Phase A EXECUTED — 2026-09-27** on `feat/specialist-anatomy-redesign` (#57): Steps 0–5 for the
  15 `domain:engineering` specialists. Phase B (Step 6, 10 non-engineering roles) not started.
  Gate 7 (owner manual check on Windows) pending.
- **Priority**: P1 · **Effort**: L · **Risk**: Medium (changes the prompt of every engineering
  specialist; golden regeneration required)
- **Depends on**: none. Plans 027/028 wire their new skills into the map this plan introduces;
  if they land first, that wiring is a small follow-up here.
- **Category**: catalog / core architecture
- **Branch**: `feat/specialist-anatomy-redesign` (cut fresh from `dev` when authorized)

## Why this exists

The owner asked for the `domain:engineering` subagents to be redesigned so that a specialist
knows *which skill it needs*, while code and best-practice examples live in the skill. The
audit found three separate design faults, not one:

1. **Code exemplars in role bodies.** `subagent-backend-architect.md` L123–328 is a
   `## Concrete Code & Command Exemplars` section with six full code/CLI blocks (Supabase RLS
   migration + typed client, Turso LibSQL replica client, Vercel Edge streaming route, Azure
   OpenAI managed-identity call, Lovable/v0 mock→repository migration). Eleven agents carry the
   same section; by fenced-block count the worst are `designer-toolkit-expert` (11),
   `frontend-architect` (10), `backend-architect` (10), `interaction-designer` (9),
   `devops-engineer` (7), `appsec-penetration-tester` (6).
2. **Vendor knowledge baked into Essentials roles.** `backend-architect` ships in the
   `software-engineering` Essentials bundle, but the skills its exemplars duplicate
   (`supabase-backend-architecture`, `turso-distributed-sqlite`, `vercel-deploy-best-practices`,
   `azure-infrastructure-bicep`, `ai-prototype-refactoring`) are installed only by addons
   (`backend-distributed-systems`, `frontend-engineering`, `devops-engineering`, …). The role's
   description and mission name those vendors outright. Essentials users get a role that claims
   Supabase/Turso/Azure expertise without the skills behind it, and the Cross-Bundle
   Recommendation Protocol never fires because the role thinks it already knows.
3. **Two incompatible role anatomies.** Engineering specialists come in two sizes: ~400-line
   roles (`backend` 404, `frontend` 439, `devops` 445 lines) and ~70-line roles (`ios`,
   `android`, `cross-platform`, `accessibility-lead`, `distributed-systems`, `data-engineer`,
   `e2e-tester`). The thin ones have no protocol, no report format beyond one sentence, no
   safety section and no skill guidance at all; `ios-architect` is told to deliver buildable
   Swift but has no `run_command` tool to build or test it.

**Why a body-level map, not frontmatter alone.** Every agent already has a flat `skills:`
frontmatter array, but it does not survive projection on two of the three active hosts: the
Claude lane deliberately drops it (`src/core/claude-projector.ts:72`, disposition `degraded` —
preloading would pay every listed skill's token cost on each spawn), and Cline's configured-agent
`.yml` carries only bundle-level skills via the Team Manifest. Only Antigravity reads the
canonical `.md` directly. A short "Skill Consultation Map" in the body is therefore the one
carrier of "which skill, when" that reaches every host, and it costs a few lines instead of the
skill bodies. This matches the "skill index + load on demand" pattern in Microsoft's
Agent-Framework post on distributed skills (cited as validation, not as a dependency).

## Evidence

- `registry/agents/subagent-backend-architect.md` L1–46 (frontmatter: vendor list in
  `description`; `skills:` lacks every vendor skill), L123–328 (exemplars).
- `registry/bundles.json`: vendor skills above appear only in addon bundles, never in
  `software-engineering`.
- `src/core/claude-projector.ts:72`: `skills` → `degraded` on Claude.
- `tests/golden/claude-created/backend-architect.md`: the Plan 021 created lane already renders
  a separate Mission/Scope from `registry/core/subagent-backend-architect.json`, which repeats
  the vendor list.
- `subagent-ml-platform-engineer.md`: zero exemplar blocks, prose directives naming its skills —
  the closest existing example of the target shape.

## Objective

1. **One specialist anatomy.** Define a standard section template for every specialist (Role &
   boundaries · Skill Consultation Map · Protocol · Safety · Report format · the existing comms
   sections from Plans 022/024 unchanged). Apply it to all 15 `domain:engineering` roles, thin
   and heavy alike.
2. **Skill Consultation Map.** A table per specialist: `Situation → Skill → Load when →
   Provided by`. `Provided by` is the bundle that installs the skill; when that is not a bundle
   the role ships in, the row tells the specialist to report the gap to its orchestrator, which
   triggers the existing Cross-Bundle Recommendation Protocol instead of improvising from memory.
   No code in the map.
3. **Vendor-neutral Essentials roles.** Strip vendor names from the `description`/mission of
   roles that ship in an Essentials bundle; vendor expertise is expressed only through map rows
   pointing at addon skills.
4. **Extract, don't delete.** Move every exemplar verbatim into the skill it belongs to. Long
   exemplars go into `registry/skills/<skill>/references/<topic>.md` with a one-line pointer from
   the SKILL.md "Code & Config Exemplars" section, so SKILL.md bodies stay short (Claude's skill
   guidance is <500 lines; Cline recommends <5k tokens) and the content loads only when read.
   Markerless `references/**` sidecars are already supported by the installer, doctor and
   uninstaller (Plan 022 pre-work). Exemplars with no matching skill are listed for an owner
   decision (Step 0 STOP), never silently dropped.
5. **Backfill** the PROJECT.md §7.2 sections on the receiving skills still on the lean
   3-section shape (`supabase-backend-architecture`, `turso-distributed-sqlite`, and any others
   Step 0 finds).
6. **Lint guard** in the existing body-lint seam (`src/core/residue-patterns.ts`): fail on a
   fenced block over a small threshold in any `registry/agents/*.md` body, on a map row naming a
   skill that does not exist, and on a frontmatter `skills:` entry missing from the map.
7. **Phase B (other domains).** After the engineering pass is verified, apply the same anatomy
   to the remaining exemplar-carrying roles (`designer-toolkit-expert`, `interaction-designer`,
   `cloud-security-architect`, `appsec-penetration-tester`, `seo-specialist`,
   `compliance-grc-specialist`, `database-administrator`, `cloud-infrastructure-architect`,
   `statistical-analyst`, `marketing-creative-designer`) as a separate commit group.

## Implementation steps (TDD)

**Step 0 — inventory (delegate: `subagent-repo-index`, read-only).** For every fenced block in
the 15 engineering roles (then the Phase B roles), classify: (a) illustrative one-liner — keep;
(b) duplicates a skill — extract to that skill, record the target path; (c) no matching skill —
list for the owner. Record, per role, which bundles ship it and which of its vendor claims have
no skill in those bundles. STOP for owner decision on every (c) row.

**Step 1 — RED tests (delegate: `subagent-qa-automation-lead`).** Extend the body lint and add
`tests/specialist-anatomy.test.ts`: every engineering specialist has the template's sections;
no over-threshold fenced block; every map skill exists; every frontmatter skill appears in the
map; every map row whose skill is outside the role's bundles says "report to orchestrator";
no vendor name in the `description` of a role shipped in an Essentials bundle.

**Step 2 — skill backfill and extraction (delegate: `subagent-backend-architect`).** Add the
missing §7.2 sections; move each (b) block into `references/` with a pointer.

**Step 3 — role rewrite (delegate: `subagent-backend-architect`).** Rewrite the 15 engineering
roles to the anatomy: heavy roles lose exemplars and vendor identity, thin roles gain protocol,
map, safety and report sections. Fix tool/mandate mismatches found in Step 0 (e.g.
`ios-architect` asked to build without a command tool) with the least privilege the task needs,
keeping Plan 022's read-only roles read-only.

**Step 4 — Semantic Core + created lane (delegate: `subagent-backend-architect`).** Update
`registry/core/*.json` and `registry/realizations/claude/**` for the 5 pilot roles so the
created lane carries the same map and vendor-neutral mission; regenerate
`tests/golden/claude-created/**` and the legacy `tests/golden/claude/**` in one reviewed pass.

**Step 5 — convention (delegate: `subagent-backend-architect`).** PROJECT.md §7.1/§7.2: the
anatomy, the map format, the "no exemplars in role bodies" rule, one before/after example.

**Step 6 — Phase B (delegate: `subagent-backend-architect`).** Repeat Steps 2–4 for the
Phase B roles.

**Step 7 — adversarial audit (delegate: `subagent-code-reviewer`).** Diff every extracted block
against its new home (nothing lost); prove the lint catches a reintroduced exemplar; confirm
projections for Claude, Cline and Antigravity carry the map.

## Acceptance gates

1. `npm run typecheck` exit 0 · `npm test` green, including the new anatomy and lint tests.
2. No over-threshold fenced block in any engineering role body (all roles after Phase B).
3. Map ↔ frontmatter ↔ `registry/skills/` consistent for every specialist.
4. No vendor name in the description of any role shipped in an Essentials bundle.
5. Goldens regenerated only in a reviewed pass; the diff is content-only.
6. `agents add software-engineering --fanout claude,cline` dry-run: projected specialists carry
   the map; `agents doctor` 0 warnings.
7. **Owner manual check (Windows)**, `software-engineering` only installed, on Claude Code,
   Antigravity and Cline: ask the orchestrator for a Supabase RLS migration. Pass = the
   delegated backend specialist reports that `supabase-backend-architecture` is not installed
   and the orchestrator recommends `backend-distributed-systems`; with the addon installed, the
   specialist loads that skill (visible skill read) before writing the migration.

## Risk register

| # | Risk | Sev | Mitigation |
|---|---|---|---|
| R1 | Extraction drops a detail a specialist relied on | High | Step 7 block-by-block diff before replacement |
| R2 | Vendor-neutral Essentials roles feel weaker to users without addons | Med | map rows route to the addon via the existing recommendation protocol; gate 7 checks it |
| R3 | Golden churn hides an unrelated regression | Med | backend-architect first, verify content-only diff, then fan out |
| R4 | Specialists stop loading skills because the map is only prose | Med | gate 7 observes a real skill read on each host; if a host ignores the map, record it for Plan 026's ledger work |
| R5 | Lint threshold rejects legitimate short snippets | Low | tunable constant, calibrated on `ml-platform-engineer` and the comms sections |

## Delegation map (ADR 0015 planner-orchestrator posture)

| Phase | Specialist | Scope |
|---|---|---|
| Step 0 | `subagent-repo-index` | exemplar and vendor-claim inventory |
| Step 1 | `subagent-qa-automation-lead` | RED anatomy + lint tests |
| Steps 2–6 | `subagent-backend-architect` | skill backfill, role rewrite, core/created lane, convention, Phase B |
| Step 7 | `subagent-code-reviewer` | adversarial audit |

## References

- Evidence: read-only repo audit, 2026-09-27.
- Binding: ADR 0015 (planner-orchestrator), ADR 0021 (Semantic Core / created lane),
  Plan 022 (comms sections, least privilege — unchanged by this plan), Plan 009 (Essentials
  stay lean).
- Siblings: Plan 026 records how `skills:` projects per host in the Declared-Delta Registry;
  Plans 027/028 add skills that get map rows here.
- External validation: Microsoft Agent Framework devblog, "From Specialist Agents to Distributed
  Skills over MCP".
