# ADR 0018: Claude Code Projection Architecture — Compound Lane & Posture-Preserving Translation

- **Date**: 2026-09-21
- **Status**: Accepted
- **Extends**: ADR 0008 (universal host projection). **Related**: ADR 0013 (Cline native discovery projection), ADR 0017 (projection staleness detection), ADR 0019 (Host Dialect Codex, companion decision)
- **Implemented by**: `plans/016-claude-code-projection.md`; generalized by `plans/017-host-dialect-codex-and-translation-ledger.md`

## Context

Agents United keeps one canonical store (`.agents/`) and projects translated copies into each host runtime (ADR 0008). The Cline lane was rebuilt as a compound projection with lockfile refcounting and staleness detection (ADR 0013, ADR 0017). The **Claude Code lane never received that treatment**: it is the stateless generic fallback inside `HostProjector.projectAgent()`, which keeps `name`/`description`, translates `tools` through a hardcoded map, and deletes every Antigravity-only key.

Measurements at commit `b9f9a78` (Step 0 census, 2026-09-21) quantify the cost:

- All 59 agents declare `hooks`, `permissionMode`, and `rules`; `effort` is declared by all 59. For Claude, every one of these is dropped.
- **18 distinct canonical tool tokens** exist across the catalog. The delegation primitives (`invoke_subagent`, `define_subagent`, `manage_subagents`, `send_message`) and both web tools (`search_web`, `read_url_content`) have **no mapping at all** — the existing map covers `web_search`, which the catalog does not use — so they are dropped even though Claude exposes `Agent(...)`, `WebSearch`, and `WebFetch`.
- Prompt **bodies** are written in Antigravity dialect: `view_file` in 38 files (73 occurrences), `run_command` 31/64, `schedule` 26/53, `manage_task` 25/27, `generate_image` 2/3. Today's only mitigation is a generic "runtime note" header.
- `lockfile.projections` is written **only** for the Cline lane (`src/core/installer.ts:632-650`), so ADR 0017 drift and outdated-projection detection are blind to `.claude/`.
- 166 canonical skills are never projected, although Claude discovers `.claude/skills/<name>/SKILL.md` natively; `rules:` bindings never project either, so git-guardrails/TDD policies are absent from Claude sessions.
- One skill, `generative_ui`, has a name that is invalid in every dialect and is referenced from **five** locations (`registry/bundles.json:786`; `subagent-marketing-creative-designer.md:40,94,95`; `subagent-ui-designer.md:40`; `mcp-skills/mcp-setup/SKILL.md:217,230`; `README.md:742`).
- Unknown tool names are not cosmetic: Claude Code **refuses to launch a subagent whose `tools` list resolves to nothing** (v2.1.208+).

Claude's documented surface (verified **2026-09-18**) differs structurally from Antigravity's: `Agent(type, …)` allowlists that take effect only for a main-thread agent launched via `claude --agent`; a different `permissionMode` vocabulary; `effort` levels; `maxTurns`; skills as first-class slash commands whose `user-invocable` / `disable-model-invocation` polarity is the **opposite** of our `disable-slash-command`; `.claude/rules/` that load unconditionally unless scoped with `paths:`; plugin manifests at `.claude-plugin/plugin.json` with **no project-local auto-discovery**; and experimental agent teams behind `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` with one team per session, a fixed lead, and no session resumption.

## Decision

1. **Compound Claude lane.** A dedicated `ClaudeProjector` — mirroring `ClineProjector` (ADR 0013) — renders deterministic artifacts from *bundle* context. The stateless generic lane is retained only for residual profiles.
2. **Prefix stripping.** `subagent-<role>` projects to `.claude/agents/<role>.md`. Step 0 proved zero collisions across all 59 agents, before and after stripping.
3. **Delegation restored.** Coordinators project `tools: [Agent(<specialist>, …), Read, Write, Edit, Bash, Grep, Glob]`, which is a true allowlist when the session runs as main thread via `claude --agent`; specialists carry a bare `Agent` for optional peer exchange inside the documented 3-layer nesting depth; ordinary sessions delegate by description, and the bootstrap prompt says so.
4. **Skills lane.** Installed-bundle skills project into the flat `.claude/skills/<name>/` namespace with refcounted owners, byte-for-byte auxiliary files, non-standard frontmatter stripped, and `disable-slash-command: true → user-invocable: false` — **never** `disable-model-invocation`, whose polarity is inverted.
5. **Lean, path-scoped rules.** Only the deduplicated, agent-referenced rule set projects, each file ≤ 200 lines with `paths:` scoping where applicable; host entrypoint rules are skipped; the coordination policy lives in the orchestrator's body (loaded on demand) rather than in an always-on rule that would tax and hijack unrelated sessions.
6. **Single host-neutral team manifest.** No `.claude/agents-united/` duplicate; the bootstrap prompt references `.agents/plugins/<bundle>/agents-united/teams/<bundle>.yaml`.
7. **Posture-preserving field mappings.** `effort` passes through; `permissionMode` maps (`acceptEdits→acceptEdits`, `readOnly→plan` with write tools denied, `requestReview`/`strict→default`); `model` maps (`inherit→omit`, `pro→sonnet`, `flash→haiku`); budget `maxIterations→maxTurns`; tool vocabulary adds `find_by_name→Glob`, `search_web→WebSearch`, `read_url_content→WebFetch`, `multi_replace_file_content→Edit`.
8. **Body rewriting.** Projection deterministically rewrites canonical tool names **and dialected skill references** inside prompt bodies (whole-word, code-fence-aware), because prose is part of the interface, not decoration.

9. **Translation Ledger.** Every dropped or degraded feature emits a disposition (`mapped | approximated | degraded | unsupported`) recorded in a declarative ledger; a render-time drop without a disposition is an **error**, not a warning. Initial Claude dispositions: `generate_image` → unsupported (Claude exposes no image-generation tool); `schedule` and `ask_question` → approximated (Cron tools; `AskUserQuestion` is excluded from subagents by default); `define_subagent` and `manage_subagents` → approximated (agents are pre-defined; delegate via the Agent tool).
10. **Conservative frontmatter.** Only long-stable fields emit by default; version-gated fields (`omitClaudeMd` v2.1.271+, `experimental.cacheTtl` v2.1.248+) are probe- or flag-gated. The documentation snapshot date above governs re-verification.
11. **Side-effect-free probing.** Capability detection uses `claude --version` plus `--help` flag parsing only — never `claude agents --json` (it may start the supervisor daemon) and never headless `-p` runs (they cost tokens). Processes launch from argv arrays with `shell: false`, reusing the Cline Windows `.cmd`/`.bat` bridge.
12. **Plugin lane is distribution-only and opt-in.** `.claude-plugin/plugin.json` plus an `agents/` subdirectory inside the organization package supports `--plugin-dir` packaging and portability. It can never be the behavioural source: plugin agents are namespaced (`plugin:agent`) and their `permissionMode` is ignored.
13. **Agent teams stay minimal and experimental.** `--teams` injects `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` **ephemerally** into the spawned process and names projected agent types in the bootstrap prompt. Nothing is written to `settings.json` or `~/.claude/**`, no hooks are installed, and the scaffold is never load-bearing.
14. **Non-goals (documented, not faked).** No `.claude/workflows/*.js` generation (Claude workflows are JavaScript orchestration scripts, not markdown); no writes to `CLAUDE.md`, `CLAUDE.local.md`, `.claude/settings.json`, or any other user-owned file; no cross-session messaging or agent-view integration; no `.claude/commands/` legacy lane.
15. **Rollout and verification gate.** v1 is **Claude only**. It ships only after the automated suite is green **and** the owner completes manual verification — both the `claude --agent` launch path and a plain session, plus the add / doctor / drift / remove lifecycle checks. Only then does Cline become the next target, on its own branch; every other provider follows separately. The generalizing decision is ADR 0019.

## Amendment (2026-09-22) — model/effort posture, the hand-off tool, and one ledger correction

Owner decisions taken while executing the plan, applied in the Claude lane. They change decisions 3, 7 and 9
above, so the amendments live here rather than silently diverging from the record.

1. **Model and effort are an explicit role posture, not session inheritance (amends decision 7).** The
   catalog declares `model: inherit` on all 59 agents, which made `inherit` a de-facto value rather than an
   intent and left every projection inheriting the *session* model. `inherit` now resolves against
   `CLAUDE_DIALECT.roleModelDefaults` — coordinators `opus`, specialists `sonnet` — and `effort` falls back to
   `roleEffortDefaults` (high / medium) only when the canonical declares none. An explicitly declared tier or
   effort always wins, so per-agent authoring survives (eight specialists declare `effort: high` today and
   keep it). Both are documented subagent frontmatter: `model` accepts
   `sonnet | opus | haiku | fable | <full model id> | inherit`, and `effort` accepts
   `low | medium | high | xhigh | max` and *overrides the session effort level*. Caveats recorded rather than
   coded around: Opus is unavailable on some plans, and `xhigh`/`max` exist only on newer models — a different
   anchor is a one-constant change in `CLAUDE_DIALECT`.
2. **`manage_task` is `approximated`, not `mapped` (corrects decision 9).** The live tools reference says
   `TaskCreate` / `TaskList` / `TaskUpdate` are *"provided by default only on the models listed under Task tool
   availability, and on other models when you opt in"*, so the grant can resolve to nothing depending on the
   model. The ledger entry now carries that reason instead of claiming a clean mapping.
3. **`SubagentHandback` is granted to specialists (extends decision 3).** It is the runtime's own hand-off
   channel — *"delivers a subagent's final report to whichever conversation receives that subagent's result"* —
   which the reference dates at Claude Code **v2.1.271+** and provides **only in auto mode**. Specialists carry
   it; coordinators do not, since it delivers *to* the receiving conversation. `ClaudeCapabilityProbe` now
   reports `subagentHandback`, derived from `--version` (it cannot detect the permission mode from a
   side-effect-free probe), so `agents doctor --host claude` and the `start --dry-run` plan both state whether
   the version floor is met. Where the runtime does not provide the tool the entry simply does not resolve, and
   Claude Code refuses to launch an agent only when *nothing* in its tools list resolves.

## Consequences

**Positive**

- Orchestration works on Claude for the first time: coordinators delegate through the `Agent` tool/allowlist instead of losing every primitive.
- 166 skills and the guardrail rules become reachable in Claude sessions — the largest capability gap versus Cline closes.
- Translation loss stops being silent: the ledger makes every drop auditable and lets CI enforce completeness.
- ADR 0017 staleness detection (content drift + outdated projection) extends to `.claude/`, so the Claude lane self-heals like the Cline lane.
- Mapping tables are shaped as pure data (`CLAUDE_DIALECT`), so ADR 0019 lifts them into a shared dialect spec without rewriting the lane.
- Posture preservation: `effort`, `permissionMode`, `maxTurns`, model tiers, and delegation semantics survive the hop instead of degrading to a "system prompt + tool list" stub.

**Negative / costs**

- More managed files per bundle (roles + skills + rules) means a larger projection surface to refcount, prune, and diff.
- Skill description budgets must be watched (1,536 characters per skill in listings); the lane is therefore scoped to installed-bundle skills, which keeps it well inside the cap.
- Body rewriting adds a deterministic pass per projection and needs false-positive guards (whole-word matching, fenced-code skipping).
- The ledger is a new maintained artifact that must be updated whenever a canonical feature is added.
- Claude Code's documented behavior moves quickly (v2.1.x): mappings need periodic re-verification against the recorded snapshot date, and version-gated fields are deliberately withheld until probed.

**Follow-up**

- ADR 0019 / Plan 017: generalize the dialect data, add declarative per-asset overlays, and add the projection-conformance CI workflow (golden snapshots, ledger audit, body lint, blocking deterministic gates, optional non-blocking LLM advisor/judge jobs).
- Deferred to later branches: the canonical `generative_ui` rename, the Cline lane's dialect migration, and the cursor/opencode/codex/kimi dialects.
- Manual verification results are recorded in `plans/README.md` before any Cline work begins.

