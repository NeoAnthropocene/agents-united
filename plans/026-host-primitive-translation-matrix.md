# Plan 026: Host Primitive Translation Matrix — Skills, Rules, Hooks & Workflows

> **Executor instructions**: self-contained; TDD; STOP on listed conditions; update this plan's
> row in `plans/README.md` when done. Source evidence: owner request 2026-09-27 ("each of the
> host skill integration may differ... maybe you should write a document to translate each
> skill for every active host") plus a two-agent documentation pull covering Claude Code,
> Google Antigravity, and Cline's current (2026-09-27) subagent/rules/hooks/workflow/skill docs
> (see § Evidence). Runs independently of Plans 025/027/028; touches `PROJECT.md`, a new
> `docs/adr/00NN-host-primitive-translation-matrix.md`, and `src/core/projector.ts` /
> `src/core/cline-projector.ts` only.

## Status

- **State**: PROPOSED — awaiting owner approval
- **Priority**: P1 · **Effort**: L · **Risk**: Medium (documentation + one new capability-gating
  check in the projection engine; no change to existing projected output for compliant bundles)
- **Depends on**: none (independent of 025/027/028)
- **Category**: core architecture / documentation / catalog
- **Branch**: `feat/host-primitive-translation-matrix` (cut fresh from `dev` when authorized)

## Why this exists

Agents United already has a Host Projection Engine (ADR 0008, 0013, 0018, 0021) and a partial
translation table for *agent frontmatter* (PROJECT.md §6.3). It has no equivalent reference for
*skills, rules, hooks, and workflows* — the four other primitives the owner is now trying to
extend with new third-party content (Plans 027/028). Without a written translation matrix,
adding a skill "for one host" risks silently breaking assumptions on another: the three hosts
are not offering the same primitive underneath a shared name.

A same-day documentation pull against the current public docs for Claude Code, Google
Antigravity, and Cline found the primitives fall into three groups:

- **Skills are the most portable primitive** — all three hosts use a `SKILL.md` + optional
  `scripts/`/`resources/` directory bundle with the same progressive-disclosure model
  (lightweight `name`/`description` always loaded, full body loaded on trigger, script *output*
  but never script *code* re-enters context). Frontmatter differs only in details: Cline
  requires `name` to exactly equal the directory name; Claude Code forbids "claude"/"anthropic"
  in `name` and recommends a <500-line body; Cline recommends <5k tokens; Antigravity states no
  documented size limit but has a directory-precedence quirk (global skills win over project
  skills on a name collision — the opposite of the other two hosts).
- **Rules converge on path/glob scoping but diverge on budget enforcement** — Claude Code
  (`.claude/rules/*.md`, `paths:` frontmatter), Antigravity (`.agents/rules/*.md`,
  `trigger: glob` + `globs:`), and Cline (`.clinerules/` or `.cline/rules/`, `paths:`) all
  support conditional loading by file glob, but only Antigravity enforces a hard 24 KB-per-file
  / 20,000-token aggregate budget with automatic demotion of oversized rules to pointer-only. A
  canonical rule written with no size awareness can silently get truncated on Antigravity while
  rendering in full elsewhere.
- **Subagents, hooks, and workflows are NOT equivalent primitives across hosts** — this is the
  critical finding. Claude Code and Antigravity subagents are comparable (general-purpose,
  full/near-full tool access, can write files, can nest, can invoke skills). Cline's "subagent"
  is a fixed, read-only research primitive (`read_file`/`list_files`/`search_files`/
  `list_code_definition_names`/read-only `execute_command`/`use_skill` only — no write, no
  browser, no MCP, no nesting) with no user-definable schema at all. Claude Code and Antigravity
  both have first-class, file-based `PreToolUse`/`PostToolUse`/`Stop`-style hook systems
  (`.claude/settings.json`, `.agents/hooks.json`); Cline has no end-user hook file format at
  all — hooks exist only as an SDK/CLI plugin capability, unavailable in the VS Code/JetBrains
  extension most Cline users run. Workflows mean three different artifact types: a literal
  JavaScript orchestration script with branching/loops in Claude Code, a markdown step-list
  slash-command macro in Antigravity (currently being deprecated in favor of Skills by
  2026-11-01) and in Cline (one-shot prompt injection, no scripting).

PROJECT.md §6.3 currently only documents the Antigravity ↔ Cline mapping for agent frontmatter
keys and tool-calling primitives. It has no row for hooks, no row for workflows beyond the
existing frontmatter note, and nothing at all for Claude Code. Extending the ecosystem to more
skills (Plans 027/028) without this reference means every future contributor re-derives host
constraints from scratch, or worse, assumes false parity (e.g. authoring a hook-dependent
skill and expecting it to work unmodified on Cline).

## Objective

1. **Write the reference document** (`docs/host-primitive-matrix.md`, linked from PROJECT.md
   §6) as the single source of truth for what each of the five primitives (skills, subagents,
   rules, hooks, workflows) means on each of the three actively-projected hosts (Claude Code,
   Antigravity, Cline), covering: file location, required/optional frontmatter fields, discovery
   mechanism, size/budget constraints, and — critically — a "degrades to" column stating what
   happens when a canonical definition uses a feature the target host doesn't support (e.g. a
   subagent with a hook → Claude Code/Antigravity project it as-is; Cline drops the hook and the
   subagent projects as a plain skill invoked by the main agent, per the existing "graceful
   degradation, documented not faked" principle already stated in README.md's per-runtime
   caveats section).
2. **Record an ADR** (`docs/adr/00NN-host-primitive-translation-matrix.md`, next available
   number) capturing the decision to treat skills as the primary portable unit and to explicitly
   document, rather than silently drop or fake, every non-portable feature per host — extending
   the precedent already set by ADR 0008/0013 for agent frontmatter to the other four
   primitives.
3. **Add one capability-gating check** to the projection engine: when a canonical
   `registry/agents/*.md` or `registry/skills/*/SKILL.md` declares a `hooks:` block or a
   subagent frontmatter shape that Cline cannot represent, the Cline projector must emit the
   documented degraded form (skill-invocation fallback for a hook-bearing subagent) instead of
   silently dropping the block, and `agents doctor --host cline` must report which canonical
   features were degraded for a given bundle so the gap is visible, not hidden. This closes a
   real gap: today `ClineProjector` drops unsupported keys with only a source-code comment
   (PROJECT.md §6.2 "dropped elsewhere with a warning") and no user-facing accounting.
4. **No behavior change for already-conformant bundles.** `software-engineering` and
   `digital-agency` (the only two bundles README.md calls "actively implemented and
   production-verified") must render byte-identical projections before and after this plan,
   confirmed by golden snapshot diff.

## Implementation steps (TDD)

**Step 0 — inventory (delegate: `subagent-repo-index`, read-only).** Enumerate every
`hooks:`/`mcpServers:`/`commandExecutionPolicy:`/`rules:` frontmatter usage across
`registry/agents/**` and `registry/skills/**` and classify each against the new matrix: does it
project cleanly to all three hosts, degrade on one, or currently silently drop somewhere. Cross-
reference against the existing `ClineProjector`/`HostProjector` source to confirm current
(silent) behavior for each degrade case.

**Step 1 — RED tests (delegate: `subagent-qa-automation-lead`).**
`tests/host-primitive-matrix.test.ts` asserting: a fixture subagent with a `hooks:` block
projects to Cline as a skill-invocation fallback (not silently dropped); `agents doctor --host
cline` output includes a "degraded features" section listing what changed and why; the existing
golden snapshots for `software-engineering` and `digital-agency` remain byte-identical after
the change (regression guard, not a new behavior).

**Step 2 — write the matrix document + ADR (delegate: `subagent-backend-architect` or a
technical-writer role if one exists).** Author `docs/host-primitive-matrix.md` per Objective 1
and the ADR per Objective 2. Link both from PROJECT.md §6 and README.md's "One Library, Every
Assistant" section.

**Step 3 — Cline degrade-path implementation (delegate: `subagent-backend-architect`).**
Extend `src/core/cline-projector.ts` to emit the documented skill-invocation fallback for a
hook-bearing or general-purpose-subagent-shaped canonical definition, and extend
`src/core/doctor.ts` to surface a per-bundle "degraded on Cline" report.

**Step 4 — PROJECT.md §6.3 extension (delegate: `subagent-backend-architect`).** Add hooks and
workflows rows to the existing Antigravity ↔ Cline table, and add a parallel Claude Code column
(the table is currently Antigravity ↔ Cline only, per PROJECT.md L307–319).

**Step 5 — adversarial audit (delegate: `subagent-code-reviewer`).** Confirm the two
production-verified bundles are byte-identical (golden diff), confirm the degrade-path fallback
actually produces a working Cline skill invocation (not just non-crashing output), confirm the
ADR and matrix doc don't contradict ADR 0008/0009/0013/0018/0021.

## Acceptance gates

1. `npm run typecheck` exit 0 · `npm test` fully green including
   `tests/host-primitive-matrix.test.ts`.
2. `software-engineering` and `digital-agency` `--fanout claude,cline` dry-runs are byte-
   identical to their pre-change golden snapshots.
3. A fixture bundle with a hook-bearing subagent, fanned out to Cline, produces a skill-
   invocation fallback file, not a silently-dropped feature.
4. `agents doctor --host cline` on that fixture bundle prints a non-empty "degraded features"
   section naming the dropped/transformed feature and why.
5. `docs/host-primitive-matrix.md` exists, is linked from PROJECT.md §6 and README.md, and
   covers all five primitives × three hosts with the columns specified in Objective 1.
6. New ADR is filed under `docs/adr/` with the next sequential number and cross-references
   ADR 0008/0013/0018/0021.

## Risk register

| # | Risk | Sev | Mitigation |
|---|---|---|---|
| R1 | Golden snapshots churn for the two production bundles, masking a real regression | High | Step 5 explicit byte-diff gate before merge; no other bundle's behavior is in scope |
| R2 | "Degrade gracefully" fallback for Cline produces a technically-valid but useless projection | Med | Step 3 fallback must be a real, tested skill-invocation path, not a stub file |
| R3 | Matrix document goes stale as host docs change (all three hosts ship features monthly) | Med | ADR records the capture date and source URLs; matrix doc includes a "last verified" date field per host, revisited whenever a future plan touches that host's projector |
| R4 | Scope creep into implementing full parity for Cline hooks (not possible — no end-user hook surface exists) | Med | Objective 3 explicitly scopes to *documenting and gracefully degrading*, not building a Cline hook system |

## Delegation map (ADR 0015 planner-orchestrator posture)

| Phase | Specialist | Scope |
|---|---|---|
| Step 0 | `subagent-repo-index` | hook/rule/subagent-shape inventory & classification |
| Step 1 | `subagent-qa-automation-lead` | RED tests + golden-snapshot regression guard |
| Step 2 | `subagent-backend-architect` | matrix document + ADR |
| Step 3 | `subagent-backend-architect` | Cline degrade-path + doctor reporting |
| Step 4 | `subagent-backend-architect` | PROJECT.md §6.3 extension |
| Step 5 | `subagent-code-reviewer` | adversarial audit |

## References

- Evidence: two-agent documentation pull against Claude Code, Antigravity, and Cline docs,
  2026-09-27 (this session) — sources: `code.claude.com/docs/en/sub-agents`,
  `platform.claude.com/docs/en/agents-and-tools/agent-skills/*`,
  `code.claude.com/docs/en/workflows`, `code.claude.com/docs/en/memory`,
  `platform.claude.com/docs/en/manage-claude/inference-hooks`, `antigravity.google/docs/*`,
  `docs.cline.bot/*`, `cline.bot/blog/stop-adding-rules-when-you-need-workflows`.
- Binding: `docs/adr/0008-universal-host-projection-architecture.md`,
  `0009-host-conformance-targets.md`, `0013-cline-native-discovery-projection.md`,
  `0018-claude-code-projection-architecture.md`,
  `0021-semantic-core-and-per-host-native-realization.md`.
- Sibling: Plans 027/028 should author new skills against this matrix's guidance once landed;
  they do not block on it (both can proceed with the existing skill-only primitive, which this
  plan confirms is already the most portable, and re-check their new skills against the matrix
  post-merge if this plan lands second).
