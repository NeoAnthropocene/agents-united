# Plan 026: Host Primitive Matrix & Skill Intake Standard — Skills, Subagents, Rules, Hooks, Workflows on Claude Code / Antigravity / Cline

> **Executor instructions**: self-contained; TDD; STOP on listed conditions; update this plan's
> row in `plans/README.md` when done. Source evidence: owner request 2026-09-27 ("each of the
> host skill integration may differ... find a way how to integrate new skills into our
> system... maybe write a document to translate each skill for every active host") and a
> documentation pull of the current Claude Code, Antigravity and Cline docs the same day
> (§ Evidence). Runs in parallel with Plans 025/027/028. Files touched: new
> `docs/host-primitive-matrix.md`, new `docs/skill-intake.md`, a new ADR, `registry/
> translation-ledger.json`, `src/core/doctor.ts`, a new skill-name/size lint, PROJECT.md §6.

## Status

- **State**: AUTHORIZED — owner approved 2026-09-27 (via project thread)
- **Priority**: P1 · **Effort**: M · **Risk**: Low–Medium (docs + ledger entries + doctor
  checks; the one projection change in Step 4 is opt-in behind its own gate)
- **Depends on**: none. Uses the Declared-Delta Registry and body-lint seam that already exist
  (ADR 0021, Plan 021); does not build Plan 017's remaining codex work.
- **Category**: core architecture / documentation / catalog
- **Branch**: `feat/host-primitive-matrix` (cut fresh from `dev` when authorized)

## Why this exists

PROJECT.md §6.3 maps only agent frontmatter and tool names, and only Antigravity ↔ Cline.
There is no written reference for how skills, rules, hooks and workflows behave on each active
host, and no procedure for bringing a third-party skill into the catalog. Plans 027/028 are
about to add third-party skills; without a reference, each contributor re-derives host limits
or assumes parity that does not exist.

What the docs pull found, reconciled with what this repo already verified:

- **Skills are the portable primitive.** All three hosts use a `SKILL.md` directory with
  optional scripts/resources and the same progressive disclosure (description always loaded,
  body on trigger, scripts run with only output entering context). Differences are
  frontmatter rules and limits: Claude Code wants `name` ≤64 chars of lowercase letters,
  digits and hyphens (no "claude"/"anthropic") and a body under ~500 lines; Cline requires
  `name` to equal the directory name, recommends <5k tokens, and lets a **global** skill win
  over a project skill with the same name; Antigravity makes `name` optional.
- **Subagents: Cline has two different surfaces.** The Cline **CLI** configured agents
  (`.cline/agents/*.yml` → spawnable `subagent_<name>` tools, schema `name`, `description`,
  `tools`, `skills`, `providerId`, `modelId`, `maxIterations`) are what this repo projects to,
  verified against Cline 3.0.61 in ADR 0013. The Cline **extension's** built-in `use_subagents`
  is a separate read-only research helper with no user schema. The matrix must keep the two
  apart; the earlier draft of this plan conflated them.
- **Per-agent skill declarations are lost on two hosts.** The Claude lane drops canonical
  `skills:` on purpose (`src/core/claude-projector.ts:72`, `degraded`), and Cline role `.yml`
  files get only bundle-level skills via the Team Manifest, although the configured-agent
  schema accepts a per-agent `skills` field. Only Antigravity reads the canonical list.
- **Hooks are not portable.** Claude Code (`.claude/settings.json`, frontmatter `hooks:`) and
  Antigravity (`.agents/hooks.json`, `PreToolUse`/`PostToolUse`/`PreInvocation`/
  `PostInvocation`/`Stop`) both have file-based hooks. Cline has no end-user hook file; hooks
  exist only as an SDK/CLI plugin capability. The repo already strips `hooks:` from Cline
  projections (Plan 015 note) but records none of this in the ledger.
- **Rules converge on glob scoping; only Antigravity enforces budgets** (24 KB per rule file,
  ~20k-token aggregate for active rules, oversize rules demoted to pointers).
- **Workflows mean different things.** Claude Code workflows are JavaScript orchestration
  scripts; Antigravity and Cline workflows are markdown slash-command macros, and Antigravity's
  are deprecated in favour of skills from 2026-11-01. This repo already converted workflows to
  skills (ADR 0016), so the matrix records `workflow-*` skills as the canonical form and Claude
  JS workflows as not a projection target.

The Declared-Delta Registry (`registry/translation-ledger.json`) is the existing home for "what
differs on this host and how" — but it holds 21 entries, all for `claude`. Antigravity and
Cline deltas are undeclared.

## Objective

1. **`docs/host-primitive-matrix.md`**: five primitives × three hosts (Cline split into CLI and
   extension columns where they differ): location, required fields, discovery, limits,
   precedence, and a "canonical feature → host realization" column with the ledger disposition
   (`mapped | approximated | degraded | unsupported`). Each host column carries the host version
   and date it was verified against.
2. **Declare the missing deltas**: add `antigravity` and `cline` entries to
   `registry/translation-ledger.json` for every canonical feature that is not a 1:1 mapping
   (at minimum `skills` per-agent list, `hooks`, `rules:` frontmatter, `mcpServers`,
   `commandExecutionPolicy`, `permissionMode`, workflows), each with a rationale.
3. **Doctor reads the ledger**: `agents doctor --host <h>` prints the degraded/unsupported
   features that apply to the installed bundles, so a user can see what does not carry over.
4. **Per-agent skills on Cline (opt-in change)**: emit each specialist's canonical `skills:`
   into its `.cline/agents/<role>.yml` (`mapped`), after confirming on the pinned Cline CLI that
   the field scopes rather than preloads. STOP and keep it `degraded` if it preloads full skill
   bodies.
5. **Portability lint for skills**: fail when a canonical skill name breaks the Claude/Cline
   name rules, or its SKILL.md body exceeds the smallest host limit without splitting into
   `references/`; warn when a projected rule set exceeds Antigravity's budgets.
6. **`docs/skill-intake.md` — the procedure for adding third-party skills**: licence check
   (redistributable licences only; otherwise link, don't vendor), upstream pin
   (`metadata.source` = repo URL + commit SHA), attribution (README §5 + Credits), adaptation
   (PROJECT.md §7.2 sections, long material in `references/`), host check against this matrix
   (name rules, size, scripts runnable on Windows and POSIX without bash-only syntax), bundle
   placement (vendor/niche skills go to addons, not Essentials), specialist wiring (a Skill
   Consultation Map row per Plan 025), catalog bookkeeping (`full` bundle, pinned skill counts,
   README/PROJECT counts). Plans 027/028 carry the same checklist inline so they need not wait.
7. **ADR** (next free number at execution) recording: skills are the primary portable unit;
   every non-portable feature is declared in the ledger and surfaced by doctor, never silently
   dropped; third-party skills enter only through the intake procedure.
8. **PROJECT.md §6.3** gains a Claude Code column and rows for skills, hooks, rules and
   workflows, linking the matrix.

## Implementation steps (TDD)

**Step 0 — inventory (delegate: `subagent-repo-index`, read-only).** List every canonical
feature each projector maps, strips or rewrites today (Claude, Cline; Antigravity reads
canonical), and where it happens in `src/core/*projector*.ts`. Compare with the ledger.
STOP if a projector silently changes behaviour that no ledger entry or doc explains.

**Step 1 — RED tests (delegate: `subagent-qa-automation-lead`).** Ledger completeness per host
for the Step 0 feature list; doctor prints degraded features for a fixture bundle; skill
portability lint on fixtures (bad name, oversize body, bash-only script); existing goldens for
`software-engineering` and `digital-agency` unchanged.

**Step 2 — matrix, intake doc, ADR (delegate: `subagent-backend-architect`).** Write
Objectives 1, 6 and 7; link from PROJECT.md §6 and the README "One Library, Every Assistant"
section.

**Step 3 — ledger + doctor + lint (delegate: `subagent-backend-architect`).** Objectives 2, 3, 5.

**Step 4 — Cline per-agent skills (delegate: `subagent-backend-architect`).** Verify, then
implement Objective 4 behind its STOP condition; regenerate the Cline goldens it changes in a
reviewed pass.

**Step 5 — adversarial audit (delegate: `subagent-code-reviewer`).** Check the matrix against
ADRs 0008/0009/0013/0018/0021 for contradictions; spot-check five claims against the live docs;
confirm no projection changed outside Step 4.

## Acceptance gates

1. `npm run typecheck` exit 0 · `npm test` green, including ledger, doctor and lint tests.
2. Every Step 0 feature has a ledger entry for `claude`, `antigravity` and `cline`.
3. `agents doctor --host cline` and `--host antigravity` list degraded features for an installed
   bundle; `--host claude` output unchanged except for that section.
4. `software-engineering` and `digital-agency` projections byte-identical, except the Step 4
   Cline role files if Objective 4 ships.
5. `docs/host-primitive-matrix.md`, `docs/skill-intake.md` and the ADR exist and are linked
   from PROJECT.md §6 and README.
6. **Owner manual check (Windows)**: on Cline CLI, a specialist spawned as `subagent_<name>`
   sees its own skills (Step 4); on Antigravity and Claude Code, `agents doctor --host` output
   matches what the owner observes for one degraded feature (e.g. a hook that does not fire on
   Cline).

## Risk register

| # | Risk | Sev | Mitigation |
|---|---|---|---|
| R1 | Matrix goes stale as hosts ship monthly | Med | per-host "verified against version/date"; re-check whenever a plan touches that host's projector |
| R2 | Cline per-agent `skills` preloads bodies and inflates context | Med | Objective 4 STOP condition; stays `degraded` until verified |
| R3 | Overlap with Plan 017's unfinished codex work | Med | this plan only adds ledger entries, doctor output and docs on the existing ADR 0021 machinery |
| R4 | Doc claims copied from web pages are wrong | Med | Step 5 spot-check against live docs and the repo's own verified ADRs, which win on conflict |

## Delegation map (ADR 0015 planner-orchestrator posture)

| Phase | Specialist | Scope |
|---|---|---|
| Step 0 | `subagent-repo-index` | projector behaviour vs ledger inventory |
| Step 1 | `subagent-qa-automation-lead` | RED ledger/doctor/lint tests |
| Steps 2–4 | `subagent-backend-architect` | docs + ADR, ledger/doctor/lint, Cline per-agent skills |
| Step 5 | `subagent-code-reviewer` | adversarial audit |

## References

- Evidence: docs pull 2026-09-27 — `code.claude.com/docs/en/{sub-agents,workflows,memory,
  best-practices}`, `platform.claude.com/docs/en/agents-and-tools/agent-skills/{overview,
  best-practices}`, `antigravity.google/docs/{subagents,rules,ide/workflows,hooks,sidecars,
  skills}`, `docs.cline.bot/{features/subagents,customization/cline-rules,customization/plugins,
  customization/hooks,customization/skills}`, `cline.bot/blog/stop-adding-rules-when-you-need-
  workflows`. (The Claude "inference hooks" page is an Enterprise prompt-gating server, not an
  agent hook system; out of scope.)
- Binding: ADR 0008, 0009, 0013, 0016, 0018, 0021; Plan 015 (Cline hook stripping note).
- Siblings: Plans 027/028 follow the intake checklist inline; Plan 025 supplies the Skill
  Consultation Map that intake step "specialist wiring" refers to.
