# Plan 020: Host Slash-Commands Rulebook & Command-Aware Projection

> **Executor instructions**: self-contained; steps in order; STOP on listed conditions. Update
> the plan's row in `plans/README.md` when done. Vendor facts were fetched 2026-09-24; the
> agentscamp sources are SECONDARY and must be re-verified against official docs in Step 0.

## Status

- **State**: READY — approved by product owner 2026-09-24
- **Priority**: P2 · **Effort**: S–M · **Risk**: LOW–MEDIUM (docs + ledger data; one projection-surface change)
- **Depends on**: plans/017 (ledger + lint seams — hard dep for Steps 2–3)
- **Category**: documentation / catalog / core
- **Decision record**: ADR number assigned at execution (do NOT use 0019)
- **Branch**: fresh branch cut from `dev` (e.g. `feat/slash-commands-rulebook`)

## Why this exists (owner requirement, 2026-09-24)

Hosts expose slash commands with wildly different mechanics, and our agents must neither
reinvent them nor reference them naively (a host command name in host-neutral canonical is the
same defect class as a canonical tool name — Plan 017's ledger exists precisely for that). The
owner wants: (a) planning to use host slash commands wherever they make things efficient, and
(b) a durable **rulebook** consulted every time an agent is created or updated for any current
or future host.

## Verified host facts (2026-09-24 — re-verify in Step 0)

**Claude Code** (secondary: agentscamp.com/guides/configuration/claude-code-slash-commands;
primary targets for Step 0: code.claude.com/docs/en/skills + /commands)
- Custom commands are **skills**: `.claude/skills/<name>/SKILL.md` is canonical and runs as
  `/<name>`; legacy `.claude/commands/*.md` still loads.
- Frontmatter levers: `disable-model-invocation: true` (typed-by-user only), `user-invocable:
  false` (model-only), `allowed-tools`, `description`, `arguments` (named) — body placeholders:
  `$ARGUMENTS`, zero-based `$0…`, named args.
- Plugin commands namespace as `/plugin-name:skill-name`.
- Consequence: **every skill we project into `.claude/skills/` is ALREADY a slash command** —
  naming and description are user-facing surface.

**Antigravity** (primary: antigravity.google/docs/slash-commands.md + /docs/plugins)
- Fixed catalog: `/boost` (3-tier deep reasoning, PAID), `/teamwork-preview` (PAID), `/goal`,
  `/plan` (requirement interview + reviewable plan artifact), **`/grill-me`** (native interview),
  `/learn`, `/schedule`, `/browser`, `/btw`. Custom commands via Plugins & Skills.
- Consequence: `/grill-me` and `/plan` **collide by name** with concepts we ship — see the
  collision register.

**Cline** (primary: docs.cline.bot/core-workflows/using-commands)
- Built-ins: `/newtask`, `/smol` (alias `/compact`), `/newrule`, `/deep-planning`, `/reportbug`.
- **Any enabled skill is triggerable as `/<skill-name>`** (same skills-as-commands model).
- Teams add `/team` (interactive), per Plan 018.

## Objective

1. `docs/host-slash-commands-rulebook.md` — the durable rulebook (created by the executor; the
   only non-`plans/` file in this plan).
2. **Command names are host-dialect tokens**: extend the Translation Ledger vocabulary so
   canonical prose can say "open the team command" and the projection renders `/team` (Cline),
   `/teamwork-preview` (Antigravity), or team-mode guidance (Claude) — never a bare foreign
   command name. New canonical tokens: `team_command`, `deep_planning_command`,
   `interview_command` (map or approximate per host; disposition + rationale mandatory).
3. A **collision register** + naming policy for agents-united skills that shadow host commands.
4. The rulebook checklist (below) becomes part of agent/skill review (referenced from
   `CONTEXT.md` and the review workflows).

## The rulebook checklist (spec — executor expands this into the doc)

When creating or updating ANY agent or skill, for every current and future host:
1. **Reuse over reinvent** — does the workflow map to an existing host command (`/plan`,
   `/deep-planning`, `/grill-me`, `/newtask`, `/team`…)? Reference it through ledger tokens,
   never by raw name in canonical text.
2. **User-typed or model-loaded?** A projected skill is a slash command on Claude and Cline;
   set `disable-model-invocation` / `user-invocable` deliberately and document the choice.
3. **Naming** — avoid shadowing host built-ins unless intentional; if shadowed, register it in
   the collision register with the expected behaviour per host.
4. **Arguments contract** — document `$ARGUMENTS`/positional/named `arguments` where the skill
   takes input; keep prompts composable (no interactive-only assumptions in agent-invoked paths).
5. **Namespacing** — plugin projections must tolerate `/plugin-name:skill-name` addressing.
6. **Availability floors** — paid-only (`/boost`, `/teamwork-preview`) or surface-limited
   (Cline teams = CLI/SDK/Kanban) commands must never be hard dependencies: probe, notice,
   fallback (Plan 018 discipline).
7. **Ledger completeness** — any new host command token needs a disposition (`mapped |
   approximated | degraded | unsupported`) × host before merge (Plan 017 gate 5).

## Implementation steps (TDD)

**Step 0 — Verify the SECONDARY source (delegate: `subagent-repo-index`).** Re-check the
agentscamp claims against `code.claude.com/docs/en/skills` and `/docs/en/commands` (or current
equivalents): skill-as-command, `disable-model-invocation`, `user-invocable`, `arguments`
placeholders. Record verified-vs-corrected in the rulebook's source table. **STOP on mismatch.**

**Step 1 — RED (delegate: `subagent-qa-automation-lead`).** New
`tests/slash-command-vocabulary.test.ts` (pattern: `tests/claude-projector.test.ts` vocabulary
tests): `team_command`/`deep_planning_command`/`interview_command` rewrite per host; canonical
bodies contain no raw `/teamwork-preview`/`/team`/`/deep-planning` strings; collision register
parses and covers `grill-me`, `plan`.

**Step 2 — GREEN: ledger tokens (delegate: `subagent-backend-architect`).** Add the three
tokens to the per-host body vocabulary with dispositions; keep `schedule`-style English-word
exclusions documented (Plan 017 handover item 1 pattern).

**Step 3 — Rulebook + collision register (Coordinator).** Write
`docs/host-slash-commands-rulebook.md`: source table (URL + fetch date + primary/secondary),
the checklist above, per-host command tables, the collision register (initially: `grill-me`
vs Antigravity native, `plan` vs Antigravity `/plan`, `team` vs Cline `/team`, `smol`, `boost`),
and the review workflow hook. Reference it from `CONTEXT.md`.

**Step 4 — Review + gates.** `subagent-code-reviewer`; full suite; README row.

## Done criteria

1. `npm run typecheck` 0 · `npm test` green (vocabulary suite included).
2. Rulebook exists with primary-source verification marks; collision register complete for the
   three known collisions.
3. Zero raw host command names in canonical agent bodies (lint-enforced via Plan 017's seam).

## Escape hatches (STOP and report)

- If Step 0 disproves skill-as-command on Claude, drop the naming-policy half of the rulebook
  and keep only the command-vocabulary half.
- If a token cannot be mapped cleanly on a host, disposition it `unsupported` with a remedy —
  never leave it unmapped (Plan 017 gate 5 fails on silent drops).

## Maintenance notes

Host command catalogs drift between releases (Claude's own docs say the in-product menu beats
any published list); the rulebook's source table carries fetch dates and the review checklist
requires re-verification per host at agent-update time.

## References

- Internal: `registry/translation-ledger.json` (Plan 017 shape), `src/core/claude-projector.ts`
  (`bodyToolVocabulary`), `CONTEXT.md`, `tests/claude-projector.test.ts`.
- External (2026-09-24): agentscamp slash-commands guide (SECONDARY); agentscamp agent-architect
  (SECONDARY); antigravity.google/docs/slash-commands.md (PRIMARY); docs.cline.bot/core-workflows/
  using-commands (PRIMARY); code.claude.com/docs/en/sub-agents.md + agent-teams.md (PRIMARY).