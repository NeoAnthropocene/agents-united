# Plan 019: Orchestrator-as-PM, Tier-1 Planning Consultation & Projection-Residue Purge

> **Executor instructions**: self-contained; execute steps in order; STOP on listed conditions.
> Update this plan's row in `plans/README.md` when done. The residue inventory below was
> measured on 2026-09-24; re-run the measurement commands before editing and treat drift as a
> STOP condition.

## Status

- **State**: READY — approved by product owner 2026-09-24 (decision: the canonical purge's
  **per-file-group sign-off mechanism is CONFIRMED** — `.cline/**` byte changes from canonical
  edits are accepted, reviewed per file-group)
- **Priority**: P1 · **Effort**: M · **Risk**: MEDIUM (canonical content changes affect every host lane)
- **Depends on**: plans/017 (residue lint + overlays — hard dep for Steps 4–5), plans/018 (tier semantics — soft dep for Step 3 wording)
- **Category**: catalog / runtime integration
- **Decision record**: ADR number assigned at execution (do NOT use 0019)
- **Branch**: fresh branch cut from `dev` (e.g. `feat/orchestrator-pm-and-residue-purge`)

## Why this exists (measured residue inventory, 2026-09-24)

Projected Claude agents still carry sections written for Antigravity/Cline-era mechanics. Scan
command: `Select-String -Path registry\agents\*.md -Pattern '<pattern>'`. Measured:

| Pattern | Files | Hits | Problem |
|---|---|---|---|
| `## 🤝 Nested Subagent Delegation Protocol` | 7 | 7 | Antigravity-era nesting model; contradicts Claude's bounded `Agent(...)` allowlist |
| `### ⚡ Subagent Delegation & Host Routing (ADR 0009 / ADR 0014)` | 1+ | — | host-routing jargon; the Claude lane replaces it via ONE `bodySectionOverride` (`src/core/claude-projector.ts:179-187`) — all OTHER sections pass through raw |
| `Subagent-First` **and** `Planner-Orchestrator` both present | 1 | 2 policies | `orchestrator-engineering.md` carries **contradictory** delegation policies: `## 🥇 Subagent-First Delegation Policy (ADR 0014)` AND `## Planner-Orchestrator Policy (ADR 0015)`; ADR 0015's own text says it REPLACES the 0014 loop |
| `Cline` | 12 | 23 | host names + routing prose inside host-neutral canonical |
| `Antigravity` | 4 | 8 | same |
| `language_server` | 1 | 1 | ADR-0009-era desktop limitation note inside an agent body |
| `invoke_subagent` | 9 | 23 | canonical token (rewritten by vocabulary — OK in body, but check headings) |

Plus `orchestrator-digital-agency.md` opens with Antigravity-era onboarding blocks
(`### 💡 What we can do right now`, `### ⚡ Superpowers you can unlock by connecting missing
tools`, `### 🛠️ How to connect any tool`) before its actual role section.

**Product requirement (owner, 2026-09-24):** orchestration agents must first be a good project
manager — understand the user with the grill skills (`/grill-me`, `/grill-with-docs`), and build
the plan by **consulting their specialists in a brief planning stage** (brainstorming together,
then asking the user the right questions in simplified, layman terms).

## Objective

1. **Purge the residue class at the canonical source** (`registry/agents/*.md`): exactly one
   delegation policy per orchestrator (engineering ⇒ ADR 0015 Planner-Orchestrator; agency ⇒
   ADR 0014 Subagent-First), no host-routing prose in canonical, no `language_server` notes, no
   "Nested Subagent Delegation" sections (their useful content — bounded peer exchange — already
   exists in the "Parallel Work, Handoff & Peer Reachability" sections).
2. **Add a Tier-1 Planning Consultation Phase** to orchestrators: (a) grill the user with the
   grill skills in layman terms; (b) consult 1–3 specialists read-only (bounded per ADR 0014's
   budget: ≤2 exchanges/pair, ≤300 words per consult) before finalizing the delegation map.
   Tier-2 keeps its Phase 0/0.5 council shape but gains the layman-question requirement.
3. **Prevent the class**: a projection residue lint (host-keyed forbidden patterns) so a future
   canonical edit cannot ship foreign-dialect sections again.

Design principles (source: AgentsCamp "Agent Architect", fetched 2026-09-24 — SECONDARY source,
craft guidance, not spec): one agent = one job (if the purpose needs "and", it is two agents);
the frontmatter is the agent's API; the `description` drives auto-delegation — write it for the
moment of delegation; minimal toolset (a reviewer never holds Write); define the output contract
(the structured handoff a caller can consume).

## Implementation steps (TDD)

**Step 0 — Full heading inventory (delegate: `subagent-repo-index`, read-only).**
List every `##`/`###` heading across all 9 orchestrators + 50 subagents and classify each:
KEEP / HOST-SPECIFIC (→ overlay via Plan 017) / DELETE (contradiction or dead era) /
REWRITE-TIER-AWARE. Deliver as a table appended to this plan. **STOP if the inventory shows a
class not listed above** — report before editing.

**Step 1 — RED tests (delegate: `subagent-qa-automation-lead`).**
New `tests/claude-projection-residue.test.ts` (pattern: `tests/claude-catalog-conformance.test.ts`):
render every agent through `ClaudeProjector` and assert (a) no forbidden pattern survives
(`/Nested Subagent Delegation/`, `/language_server/`, `/Host Routing/`, `/Cline & CLI/`);
(b) each orchestrator carries exactly one delegation-policy section; (c) Tier-1 orchestrators
carry the Planning Consultation Phase. Also a canonical-level test: zero files contain both
`ADR 0014` and `ADR 0015`.

**Step 2 — Canonical purge (delegate: `subagent-backend-architect` + Coordinator review).**
Apply the Step 0 classification to `registry/agents/*.md`. **Every canonical byte change
legitimately changes all host lanes** (Plan 016 roster precedent) — commit per file-group with
the rendered before/after for BOTH `.claude/` and `.cline/` in the PR description. Owner
sign-off required per group.

**Step 3 — Planning Consultation Phase (same).**
Tier-1 section (new, per orchestrator): grill-first user alignment in layman terms (reference
the projected `grill-with-docs` / `grill-me` skills where bundled), then bounded specialist
consults, THEN the delegation map; explicitly "consult in planning, delegate in execution".
Tier-2: add the layman-question requirement to the existing Phase 0/0.5 wording. Canonical
wording must stay host-neutral; host-specific routes (which tool spawns the consult) belong to
Plan 018's overlays.

**Step 4 — Residue lint (delegate: `subagent-backend-architect`, requires Plan 017 seam).**
Host-keyed forbidden-pattern lists feeding Plan 017's body lint (acceptance gate 4 extension).

**Step 5 — Manual verification checklist + docs.** Owner runs one Tier-1 Claude session
expecting: layman questions before a plan, ≥1 specialist consulted during planning, then
delegation. Record in the README row.

## Done criteria

1. `npm run typecheck` 0 · `npm test` fully green (residue suite included).
2. Zero forbidden patterns in any rendered `.claude/` artifact; exactly one delegation policy
   per orchestrator in canonical AND every projection.
3. Tier-1 orchestrators contain the Planning Consultation Phase; owner manual check recorded.
4. `.cline/` before/after diffs reviewed and signed off (they WILL change — expected).

## Escape hatches (STOP and report)

- If a purge would delete content a lane depends on (e.g. Cline smart-team-activation
  references), STOP and move that section to a per-host overlay instead (Plan 017).
- If `/grill-me` wording collides with Antigravity's NATIVE `/grill-me` command
  (antigravity.google/docs/slash-commands.md, 2026-09-24), keep the canonical as a skill
  REFERENCE, never a typed-command expectation — see Plan 020's collision register.

## Maintenance notes

The lint list must grow with every new host section; the one-delegation-policy rule is what
keeps Tier semantics (Plan 018) unambiguous. Re-run the Step 0 scan after any bulk canonical
edit.

## References

- Internal: `src/core/claude-projector.ts` (`bodySectionOverrides`), `registry/agents/*.md`,
  `tests/claude-catalog-conformance.test.ts`, ADR 0014/0015/0018, `CONTEXT.md`.
- External (2026-09-24): agentscamp.com/agents/meta-orchestration/agent-architect (SECONDARY);
  code.claude.com/docs/en/sub-agents.md (handoff + `Agent(...)` bounds).