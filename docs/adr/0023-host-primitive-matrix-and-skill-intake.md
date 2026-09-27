# ADR 0023: Host Primitive Matrix & Skill Intake Standard

- **Status**: Accepted — 2026-09-27 (Plan 026, owner-approved via project thread). Extends
  ADR 0021's Contract Floor / Declared-Delta framework with a written reference and an intake
  procedure; does not supersede any prior decision.
- **Context**: PROJECT.md §6.3 mapped only agent frontmatter and tool names, and only
  Antigravity ↔ Cline — Claude Code was absent from the table entirely, and skills, hooks,
  rules and workflows had no cross-host reference at all. The Declared-Delta Registry
  (`registry/translation-ledger.json`, ADR 0021 decision 9) held 24 entries, every one of them
  `host: "claude"`; Antigravity's and Cline's own deltas were never declared, even though
  `src/core/cline-projector.ts` was silently dropping `commandExecutionPolicy`, `hooks`,
  `mcpServers`, and the per-agent `skills:` list on every projection with no ledger entry
  anywhere recording it. Plans 027/028 are about to add third-party skills to the catalog with
  no written procedure for licence checks, upstream attribution, or per-host compliance —
  without a reference, each contributor would re-derive host limits from scratch or assume a
  parity that does not exist. A 2026-09-27 docs pull of the current Claude Code, Antigravity
  and Cline documentation, cross-checked against this repo's own verified ADRs (0008, 0009,
  0013, 0018, 0021), supplied the evidence this ADR and its companion documents are built on.
- **Decision**:
  1. **Skills are the primary portable unit.** All three hosts implement the same shape — a
     `SKILL.md` directory with progressive disclosure (metadata always loaded, body loaded on
     trigger, bundled scripts run with only their output entering context) — differing only in
     frontmatter rules and size limits. Every other primitive (subagents, rules, hooks,
     workflows) has at least one host with a materially different or absent realization; skills
     do not. New capability, where the choice exists, should be authored as a skill first.
  2. **`docs/host-primitive-matrix.md`** is the single written reference for how skills,
     subagents (Cline split into its CLI Configured Agents and extension `use_subagents`
     surfaces, which are unrelated features that happen to share a name), rules, hooks, and
     workflows behave on each host: location, required fields, discovery, limits, precedence,
     and the canonical-feature-to-host-realization disposition. It is linked from PROJECT.md §6
     and the README "One Library, Every Assistant" section, and each host column is dated to
     the version it was verified against (Risk R1: hosts ship monthly).
  3. **Every non-portable feature is declared, never silently dropped.** The Declared-Delta
     Registry now carries `antigravity` and `cline` entries alongside `claude` for every Step 0
     canonical feature (including a new `workflows` feature, since Claude Code's own
     "workflows" name an unrelated JavaScript orchestration mechanism that Antigravity's and
     Cline's markdown-macro "workflows" do not share). `agents doctor --host <h>` surfaces the
     `degraded`/`unsupported` entries for the installed bundle's host, so a user can see what
     does not carry over without reading the registry file directly.
  4. **A per-agent `skills:` field on Cline Configured Agents is authorized (Plan 026 Step 4),
     conditioned on verified scoping semantics.** `cline/cline` PR #9502 (merged 2026-02-24,
     shipped by the currently published 3.0.65) was read at the source level:
     `SubagentRunner.run()` uses the agent's configured `skills:` list to **filter**
     `getAvailableSkills()` down to the named subset before it enters `SystemPromptContext` —
     the same metadata-only discovery objects the unfiltered path already builds, not full
     `SKILL.md` bodies. The field scopes discovery; it does not preload skill content. On this
     evidence the `cline`/`skills` Declared-Delta entry moves from `degraded` to `mapped`, and
     `.cline/agents/<role>.yml` projection emits each specialist's canonical skill list.
  5. **Third-party skills enter only through the intake procedure** (`docs/skill-intake.md`):
     licence check (redistributable licences only; link, don't vendor, otherwise), upstream pin
     (`metadata.source` = repository URL + commit SHA), attribution (README §5 Credits),
     adaptation into this repo's own SKILL.md conventions (PROJECT.md §7.2), a host check
     against the matrix (name rules, size, cross-platform scripts), bundle placement (vendor and
     niche skills go to addons, never Essentials), specialist wiring (a Skill Consultation Map
     row per Plan 025), and catalog bookkeeping (bundle listings, pinned skill counts). Plans
     027/028 carry this checklist inline so they do not have to wait on this document landing
     first.
  6. **A portability lint catches what review alone would miss** (`src/core/
     skill-portability-lint.ts`): a skill name that breaks the Claude Code or Cline naming
     rules, a SKILL.md body over the smaller of the two hosts' size guidance, or a bundled
     `.sh` script with no cross-platform counterpart, each fail with a specific, actionable
     message. It is not (yet) wired to run over the entire existing catalog as a blocking CI
     gate: `registry/skills/generative_ui` is a pre-existing, deliberately grandfathered name
     (an underscore, normalized to `generative-ui` at Claude projection time by
     `ClaudeProjector.normalizeSkillName()`) that would otherwise register as a false failure.
     New skill intake is expected to be compliant from the start; retrofitting the lint as a
     full-catalog CI gate is left for a follow-up plan once every existing skill has been
     audited against it individually.
- **Consequences**:
  - Positive: a contributor adding a new specialist, a new skill, or a new host feature has one
    place to check what's portable and what isn't, instead of re-deriving it from source reads
    every time; `agents doctor` makes host-specific loss visible to end users instead of leaving
    it undocumented; the Cline per-agent skills gap (Plan 026's own Finding, discovered in
    Step 0) is closed on verified evidence rather than an assumption.
  - Negative: the Declared-Delta Registry roughly triples in size (24 → 62 entries) and now
    needs maintenance on three hosts' churn instead of one; the matrix itself will drift as
    each host ships and needs the same "re-check on touch" discipline ADR 0021's Capability
    Profiles already established for Claude.
  - Risks: the matrix goes stale as hosts ship monthly (mitigated by per-host dated verification
    and a re-check-on-touch norm); a doc claim copied from a web page turns out wrong
    (mitigated by preferring this repo's own already-verified ADRs on conflict, and by a
    Step 5 adversarial spot-check against live sources before this ADR was accepted); the
    portability lint's partial rollout (fixtures only, not the full catalog) leaves existing
    non-compliant skills undetected until a future audit plan runs it catalog-wide.
