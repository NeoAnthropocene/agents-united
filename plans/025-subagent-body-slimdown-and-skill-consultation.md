# Plan 025: Subagent Body Slim-Down & Declared Skill-Consultation Convention

> **Executor instructions**: self-contained; TDD; STOP on listed conditions; update this plan's
> row in `plans/README.md` when done. Source evidence: owner request 2026-09-27 ("subagent
> definitions are not right... code informations and best practise examples should be inside
> the skill itself"), confirmed by a read-only repo audit the same day (see § Evidence).
> Runs independently of Plans 026–028; touches `registry/agents/**` and a handful of
> `registry/skills/**` SKILL.md files only.

## Status

- **State**: PROPOSED — awaiting owner approval
- **Priority**: P1 · **Effort**: L · **Risk**: Medium (touches every domain specialist's prompt)
- **Depends on**: none (independent of 026–028; can run in parallel with all three)
- **Category**: catalog / core architecture
- **Branch**: `feat/subagent-body-slimdown` (cut fresh from `dev` when authorized)

## Why this exists

`registry/agents/subagent-backend-architect.md` carries a `## Concrete Code & Command
Exemplars` section (~190 lines) with full inline code: a Supabase RLS migration + typed
client, a Turso LibSQL replica-sync client, a Vercel Edge streaming route handler, an Azure
OpenAI managed-identity fetch snippet, and a Lovable/v0-to-repo migration example — each one
duplicating a skill the same agent's own `skills:` frontmatter already lists
(`supabase-backend-architecture`, `turso-distributed-sqlite`, and prose references to a
Vercel-deploy skill, `azure-infrastructure-bicep`, `ai-prototype-refactoring`). A repo-wide
sample confirms this is systemic, not a one-off: `subagent-frontend-architect.md` (9 fenced
code blocks), `subagent-devops-engineer.md` (7), `subagent-appsec-penetration-tester.md` (12),
and `subagent-cloud-security-architect.md` (8) all carry the same "Exemplars" section pattern.
`subagent-ml-platform-engineer.md` is the clean counter-example — zero embedded snippets, pure
prose directives that name the skill to consult.

This inflates every specialist's always-loaded prompt with knowledge that belongs in
skills (loaded on demand per Claude/Antigravity/Cline's shared progressive-disclosure model —
see Plan 026), makes the code stale wherever the skill's own guidance changes independently,
and buries the agent's actual job (role, scope, delegation boundaries) under implementation
detail a reader has to scroll past. PROJECT.md §7.2 already designates "Code & Config
Exemplars" as skill section 5 of 7 — the agents are duplicating a section that has a proper
home one file away. Root cause, partially: the two lean-style skills this agent references
(`supabase-backend-architecture`, `turso-distributed-sqlite`) predate PROJECT.md's 7-section
mandate and have no "Code & Config Exemplars" section of their own, which likely encouraged the
agent author to inline the code instead of putting it where it belonged.

## Evidence

- `registry/agents/subagent-backend-architect.md` L126–313: full Supabase/Turso/Vercel/Azure/
  Lovable-v0 code blocks under `## Concrete Code & Command Exemplars`.
- `registry/agents/subagent-frontend-architect.md`, `subagent-devops-engineer.md`,
  `subagent-appsec-penetration-tester.md`, `subagent-cloud-security-architect.md`: same section
  pattern, 7–12 fenced blocks each.
- `registry/agents/subagent-ml-platform-engineer.md`: no fenced blocks — the target shape.
- `registry/skills/supabase-backend-architecture/SKILL.md`,
  `registry/skills/turso-distributed-sqlite/SKILL.md`: lean 3-section format (Overview,
  Core Directives & Standards, Verification Checklist) — missing PROJECT.md's mandated
  "Code & Config Exemplars" section.
- `registry/agents/orchestrator-engineering.md` L136–150: an "SDLC Workflow Skills Execution
  Matrix" table mapping SDLC phase → skill name → `.agents/skills/<name>/SKILL.md` path →
  slash command — this is the existing, working convention for "which skill do I need, when."
  Every agent already carries a flat `skills:` frontmatter array; there is no per-scenario
  mapping at the agent level and no "may need vs. must have" distinction anywhere in the repo.

## Objective

1. **Extract, don't delete.** For every agent identified with an embedded exemplars section,
   move the code/config content verbatim (updated only where it references something already
   stale) into the "Code & Config Exemplars" section of the skill(s) it belongs to, creating
   that section where the target skill doesn't have one yet.
2. **Backfill the 7-section format** on the two skills confirmed non-conformant
   (`supabase-backend-architecture`, `turso-distributed-sqlite`) and any other skill a Step 1
   sweep finds still on the lean 3-section shape, per PROJECT.md §7.2.
3. **Replace the agent-body exemplars section** with a short "Skill Consultation Map" table:
   `Scenario → Skill → When to load it`, in the same spirit as `orchestrator-engineering.md`'s
   existing SDLC matrix but scoped to the specialist's own responsibilities (e.g. "Provisioning
   Postgres RLS → `supabase-backend-architecture` → before writing any migration"). No code in
   this table — only scenario, skill name, and a one-line trigger condition. This is also the
   shape the Microsoft Agent-Framework "distributed skills" pattern recommends (skill index +
   on-demand full load, never re-embed the skill's content in the caller) — cited as design
   validation, not as a dependency to build.
4. **Codify the convention** in `PROJECT.md` §7.1 (agent frontmatter interface) and §7.2 (skill
   interface) as an explicit rule: an agent body may reference a skill by name and describe
   *when* to consult it; it may not embed the skill's own code exemplars, migration scripts, or
   command sequences beyond a single illustrative one-liner.
5. **Add a regression guard** (test or lint) that fails if a `registry/agents/*.md` body
   contains a fenced code block longer than a small threshold (e.g. >8 lines) outside of its
   frontmatter, so the pattern can't silently return.

## Implementation steps (TDD)

**Step 0 — full inventory (delegate: `subagent-repo-index`, read-only).** Grep every
`registry/agents/*.md` for fenced code blocks outside frontmatter; for each hit, classify as
(a) illustrative one-liner (keep), (b) full exemplar duplicating a referenced skill (extract),
or (c) exemplar with no matching skill in the agent's `skills:` list (flag for a Step 2
judgment call — either add the skill reference or create a narrow new skill). Produce a
file-by-file worksheet. STOP and ask the owner if any (c) case implies a new skill outside the
Plan 026/027/028 scope.

**Step 1 — RED tests (delegate: `subagent-qa-automation-lead`).** A `tests/agent-body-lint.test.ts`
asserting: no `registry/agents/*.md` body contains a fenced code block over the length
threshold; every skill named in an agent's "Skill Consultation Map" exists in
`registry/skills/`; every skill in an agent's frontmatter `skills:` array appears at least once
in its Skill Consultation Map (no orphaned declarations). All should currently fail against the
flagged files from Step 0.

**Step 2 — skill backfill (delegate: `subagent-backend-architect`).** For each skill on the
lean 3-section format, add the missing PROJECT.md-mandated sections (Execution Triggers,
Input/Output Requirements, Step-by-Step Runbook, Code & Config Exemplars, Edge Cases & Error
Recovery) and move in the extracted code from Step 0's worksheet, organized by scenario.

**Step 3 — agent slim-down (delegate: `subagent-backend-architect`, then repeat per-domain
via `subagent-frontend-architect`/`subagent-devops-engineer`/`subagent-appsec-penetration-tester`/
`subagent-cloud-security-architect` context where a peer specialist's own file is being edited).**
Replace each flagged `## Concrete Code & Command Exemplars` section with the Skill Consultation
Map table. Re-verify the agent's `skills:` frontmatter array is complete and matches the table.

**Step 4 — PROJECT.md convention update (delegate: `subagent-technical-writer` or
`subagent-backend-architect` if no writer role exists).** Update §7.1/§7.2 with the rule from
Objective 4, plus one before/after example (backend-architect) so future contributors have a
template to copy.

**Step 5 — adversarial audit (delegate: `subagent-code-reviewer`).** Confirm no code/behavioral
content was lost in the extraction (diff each moved block against its new skill location),
confirm the lint guard actually catches a reintroduced violation (add a temporary violating
fixture, see it fail, remove it), confirm bundle projections (`.claude/agents/`, Cline
compound lane, `AGENTS.md` bridge) still render without drift for the touched agents.

## Acceptance gates

1. `npm run typecheck` exit 0 · `npm test` fully green including the new
   `tests/agent-body-lint.test.ts`.
2. Zero fenced code blocks over the length threshold remain in any `registry/agents/*.md` body.
3. Every skill referenced in an agent's Skill Consultation Map resolves to a real
   `registry/skills/<name>/SKILL.md`; every skill in `skills:` frontmatter is referenced in the
   map (no orphans in either direction).
4. `supabase-backend-architecture`, `turso-distributed-sqlite`, and any other skill flagged in
   Step 0 now carry all 7 PROJECT.md §7.2 sections including a populated "Code & Config
   Exemplars."
5. `agents doctor` and a fresh `--fanout claude,cline` dry-run on `software-engineering` and
   `secops-application-security` show zero unexpected drift beyond the intended content change.
6. PROJECT.md §7.1/§7.2 carry the new convention with a worked example.

## Risk register

| # | Risk | Sev | Mitigation |
|---|---|---|---|
| R1 | Extraction silently drops a code detail a specialist relied on | High | Step 5 diff-based audit against the original agent body before it's replaced |
| R2 | Lint threshold too strict, breaks legitimate short illustrative snippets | Low | threshold tunable constant, reviewed against a sample of already-clean agents (`subagent-ml-platform-engineer`) before merge |
| R3 | Golden/projection snapshots churn across all touched agents at once, hiding an unrelated regression | Med | touch one domain (backend-architect) fully first, verify render diff is content-only, then repeat pattern for the rest |
| R4 | New "Skill Consultation Map" table format drifts per-agent (inconsistent columns) | Low | Step 4 publishes one canonical table template in PROJECT.md before Step 3 fans out |

## Delegation map (ADR 0015 planner-orchestrator posture)

| Phase | Specialist | Scope |
|---|---|---|
| Step 0 | `subagent-repo-index` | fenced-code inventory & classification |
| Step 1 | `subagent-qa-automation-lead` | RED lint/consistency tests |
| Step 2 | `subagent-backend-architect` | skill 7-section backfill |
| Step 3 | `subagent-backend-architect` (+ per-domain specialist for its own file) | agent slim-down |
| Step 4 | `subagent-backend-architect` | PROJECT.md convention update |
| Step 5 | `subagent-code-reviewer` | adversarial audit |

## References

- Evidence: read-only repo audit, 2026-09-27 (this session).
- Sibling: Plan 026 (host primitive translation matrix) governs *how* a skill is discovered
  and loaded per host — this plan governs *what* stays in the agent vs. the skill regardless
  of host. Plans 027/028 add new skills using the Skill Consultation Map convention this plan
  establishes, so land this plan first if sequencing matters, though all four can execute in
  parallel with only `registry/bundles.json` as a shared file requiring careful, non-competing
  edits.
- Design validation (external, non-binding): Microsoft Agent Framework devblog, "From
  Specialist Agents to Distributed Skills over MCP" — argues for moving domain knowledge out of
  a specialist's own prompt into a referenced, on-demand-loaded skill document rather than
  duplicating it inline; matches the direction of this plan.
