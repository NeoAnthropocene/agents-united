# Plan 016: Claude Code Projection Architecture — Compound Lane, Launcher Parity & Opt-In Extras

> **Executor instructions**: Follow this plan step by step. Run every verification
> command and confirm the expected result before moving to the next step. If any
> STOP condition occurs, stop and report — do not improvise. When done, update the
> status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat b9f9a78..HEAD -- registry/ src/ tests/ docs/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.
>
> **Documentation snapshot**: All Claude Code behavior claims in this plan were
> verified against the official docs on **2026-09-18** (see § References).
> Claude Code moves fast (docs are versioned "as of v2.1.x"); before executing a
> step that depends on a Claude behavior, re-verify the claim against the live
> doc page and record any drift as a STOP condition.

## Status

- **State**: PLANNED — approved for execution, not started
- **Priority**: P1
- **Effort**: L
- **Risk**: MEDIUM (bounded by the Step 2 guards and the Step 4 migration machinery)
- **Depends on**: plans/007, plans/008, plans/013, plans/015 (ADR 0013/0016/0017 era)
- **Category**: runtime integration
- **Planned at**: commit `b9f9a78`, 2026-09-18
- **Decision record**: `docs/adr/0018-claude-code-projection-architecture.md` (authored in Step 1)

## Why this matters

Agents United is manually verified on **Cline** and **Google Antigravity**, and
`README.md` explicitly solicits feedback for the remaining runtimes — Claude Code
first among them. Today the Claude lane is the **stateless generic fallback** of
`HostProjector.projectAgent()`: it keeps `name`/`description`, translates `tools`
via `TOOL_NAME_MAP`, deletes every Antigravity-only key, and writes
`.claude/agents/<canonical-filename>.md`. That fallback has four hard defects:

1. **Lost orchestration** — every delegation primitive (`invoke_subagent`,
   `define_subagent`, `manage_subagents`, `send_message`, `manage_task`,
   `schedule`, `find_by_name`, `multi_replace_file_content`, `ask_question`)
   has no `TOOL_NAME_MAP` entry, so it is dropped with a warning. Claude Code
   has a first-class equivalent (`Agent(type, …)` allowlists + the `Agent`
   tool) that we do not use. Claude Code **refuses to launch a subagent whose
   `tools` list resolves to nothing** (v2.1.208+), so this is also a correctness
   hazard, not just a capability gap.
2. **No lockfile projection records** — `lockfile.projections[...]` is written
   only when `host === 'cline'` (`src/core/installer.ts:632-650`). Claude
   projections exist only in `files[].projectedTo`, so refcounted ownership,
   ADR 0017 **Content drift** and **Outdated projection** detection are all
   blind to `.claude/`.
3. **Skills invisible** — 166 canonical skills are never projected, although
   Claude Code natively discovers `.claude/skills/<name>/SKILL.md`.
4. **Rules invisible** — `rules:` bindings (declared by **all 59 agents**) are
   dropped, so git guardrails / TDD / a11y policies never reach Claude sessions.

This plan closes all four defects and adds launcher parity (`agents start
--host claude`, `agents doctor --host claude`) plus two opt-in extras (a
Claude plugin manifest lane and a minimal experimental agent-teams scaffold),
following the proven ADR 0013 compound-lane architecture rather than extending
the stateless generic lane.

## Current state (verified at commit `b9f9a78`)

### Repo state

| Area | Reality | Evidence |
|---|---|---|
| Host entry | `claude` → `.claude/`, `agentsSubdir: 'agents'`, profile `claude-code`, `projectionCapable: true` | `src/core/hosts.ts:44-53` |
| Renderer | No Claude renderer. `projectAgent()` special-cases only `cline`; Claude falls through the generic lane (keep `name`/`description`, keep `model` unless `inherit`, translate `tools`, delete `ANTIGRAVITY_ONLY_KEYS` — including `effort`, `rules`, `permissionMode`) | `src/core/projector.ts:149-188`, keys at `:57-68` |
| Output path | `.claude/agents/<canonical-filename>.md` — the `subagent-` prefix is **kept** | `src/core/installer.ts:133-138`, `:387-389` |
| Lockfile | `files[].projectedTo` recorded; `lockfile.projections` written **only for cline** | `src/core/installer.ts:632-650` |
| Namespace prefixes | `projectionNamespacePrefixes('claude') === ['.claude/']` — already covers any new sublanes | `src/core/installer.ts:177-194` |
| Doctor | `renderProjectionVariants()` hardcodes `ClineProjector` and iterates only `manifest.projections`; `--host` branch is cline-only | `src/core/doctor.ts:46-91`, `:310-316` |
| Stale/missing classifier | Exists and already handles `.claude/…` paths ("Stale projection … (superseded by …)" + `agents update <bundle> --fanout claude` remedy) | `tests/doctor.test.ts:145-202` |
| Launcher | `agents start` hardwires `ClineLauncher` + `ClineCapabilityProbe` | `src/cli.ts:2097-2163` |
| Gitignore | `/.claude/` already ignored | `.gitignore` |
| Catalog fields | 59 agents: **all** `model: inherit`; 58 × `permissionMode: acceptEdits` + 1 × `strict`; `effort`: 17 `high` / 42 `medium`; **all 59 declare `rules:`** | measured |
| Budgets | Subagent `name+description` ≈ **3,718 tokens** (cap 15,000). Per-skill `name+description`: max **990 chars** (`modern-web-guidance`; cap 1,536), aggregate 34,468 chars | measured |
| Naming defect | `registry/skills/generative_ui/` — underscore name invalid for Claude (referenced at `registry/bundles.json:786`); currently `disable-slash-command: true` | measured |

### Claude Code surface (verified 2026-09-18)

- **Subagents**: `.claude/agents/**/*.md` (recursive, project), `~/.claude/agents/`, plugin `agents/`. Precedence: managed > `--agents` > project > user > plugin. Frontmatter: `name` (required; lowercase letters + hyphens; no `:`; not `-`-prefixed), `description` (required), `tools`, `disallowedTools`, `model` (`sonnet|opus|haiku|fable|<full-id>|inherit`), `permissionMode` (`default|acceptEdits|auto|dontAsk|bypassPermissions|plan`; ignored for plugin agents), `maxTurns`, `skills` (preload), `omitClaudeMd` (v2.1.271+), `effort` (`low|medium|high|xhigh|max`), `isolation: worktree`, `color`, `initialPrompt`, `experimental`, `mcpServers`, `hooks`.
- **Tools vocabulary**: `Read`, `Write`, `Edit`, `Bash`, `Grep`, `Glob`, `WebSearch`, `WebFetch`, `Agent` (renamed from `Task` in v2.1.63; `Task(…)` still aliases), `TodoWrite`, `NotebookEdit`, `Skill`, `ListAgents`, `TaskCreate/Get/List/Update`, `CronCreate/Delete/List`, `Monitor`, `TaskStop`, `SendMessage`, `Artifact`, `SubagentHandback`, `EnterWorktree`, `ExitWorktree`. Excluded from subagents by default: `AskUserQuestion`, `EnterPlanMode`/`ExitPlanMode` (unless `permissionMode: plan`), `ScheduleWakeup`, `TaskOutput`, `WaitForMcpServers`, `Workflow`, `EndConversation`. **Unknown tool names block agent launch** (v2.1.208+).
- **Delegation**: `Agent(type, …)` allowlist syntax applies **only** to an agent running as the main thread via `claude --agent`; inside a subagent definition a bare `Agent` enables nested spawn (parenthesized list ignored). Nesting depth default **3 layers** (env `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH`). Main-thread agents via `--agent` **do** load `CLAUDE.md` + project memory.
- **Skills**: `.claude/skills/<name>/SKILL.md` (folder + filename must be exactly `SKILL.md`), `~/.claude/skills/`, plugin `skills/`. Slash-invocable (`/<name>`). Frontmatter includes `when_to_use`, `allowed-tools`, `disallowed-tools`, `disable-model-invocation`, `user-invocable`, `context: fork`, `agent`, `model`, `effort`, `hooks`, `paths`, `shell`, `metadata`, `license`, `compatibility`. Unknown frontmatter fields are ignored locally (but break claude.ai upload/packaging). Skill folders may carry extra files (scripts/references) which are loadable. Skill listings cap combined `description`+`when_to_use` at **1,536 characters**. Polarity: `disable-model-invocation: true` = model cannot auto-trigger (slash stays); `user-invocable: false` = hidden from the `/` palette (model can still invoke).
- **Memory/rules**: `./CLAUDE.md` / `./.claude/CLAUDE.md`, `CLAUDE.local.md`, `~/.claude/CLAUDE.md`; **`.claude/rules/`** (path-scopable via `paths:` frontmatter; rules without `paths` load **unconditionally**); imports via `@path`. Guidance: **"target under 200 lines per CLAUDE.md file"**; longer files reduce adherence.

- **Workflows**: `.claude/workflows/*.js` are **JavaScript orchestration scripts** — never markdown. Our workflow-skills belong in `.claude/skills/`.
- **Agent teams**: **experimental**, `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` (settings `env` object or environment); team config `~/.claude/teams/<name>/config.json` (`members[]` with `name/agent_type/model/created_at/session_id`; `lead.agent_type: team-lead`); tasks under `~/.claude/tasks/<name>/`; hooks `TeammateIdle`, `TaskCreated`, `TaskCompleted`; `teammateMode` setting; **one team per session, no nested teams, fixed lead, no session resumption, no per-teammate permission modes at spawn**. Teammates can be spawned **from a subagent definition by naming its type**.
- **Plugins**: `.claude-plugin/plugin.json` (`name`, `description`, `version`, `author`, `homepage`, `repository`, `license`); layout `agents/`, `skills/`, `commands/`, `hooks/hooks.json`, `.mcp.json`, `.lsp.json`, `monitors/`, `bin/`, `settings.json`. **No project-local auto-discovery** — activation is marketplace install or `--plugin-dir <root|zip>`. Plugin agents are **namespaced** (`plugin:agent`) and **ignore `permissionMode`**; project/user `.claude/agents/` override same-named plugin agents.
- **CLI**: `claude --agent <name>` (run a session as that definition), `--agents <json>` (ephemeral session agents), `--bg`, `-p` (headless), `--plugin-dir`, `claude --version`, `claude agents [--json] [--cwd]`. `claude agents --json` may start the supervisor daemon → **never use it in a probe**.
- **Description budgets**: subagent descriptions warn past **15,000 tokens** combined; skill listings cap at **1,536 chars per skill**.

## Design decisions (Socratic grilling + doc verification; user-approved)

1. **Compound lane, not generic-lane extension.** New `ClaudeProjector` mirrors the proven `ClineProjector` shape (`planCompoundProjection(bundle, scope, resolved, registryDir, excludeAddons)` → deterministic `PlannedClaudeArtifact[]`). Rationale: bundle context is required for `Agent(…)` allowlists, skills/rules lanes, and addon-exclusion freshness renders — impossible in the stateless `projectAgent()`.
2. **Strip the `subagent-` prefix** in projected role names (`subagent-backend-architect.md` → `.claude/agents/backend-architect.md`), consistent with the Cline lane. Uniqueness of stripped names across all 59 agents is proven by a test (all registry filenames carry `subagent-`/`orchestrator-` prefixes, so no collisions exist). Orchestrator names keep their `orchestrator-` prefix.
3. **Delegation model (D3)**: coordinators project `tools: [Agent(<specialist-a>, …), Read, Write, Edit, Bash, Grep, Glob]` — a true allowlist when running as main thread via `claude --agent` (the `agents start --host claude` path); specialists project a bare `Agent` for optional peer exchange (parenthesized lists are ignored inside subagents; depth ≤ 3 respected, never assumed deeper). In ordinary sessions delegation is description-based — the bootstrap prompt and roster rule say so explicitly.
4. **Skills lane (D4)**: project **installed-bundle skills only** into the flat `.claude/skills/<name>/` namespace, refcounted across bundles (same canonical ⇒ same deterministic content ⇒ safe sharing). Auxiliary files copy byte-for-byte. Frontmatter translation: keep `name`/`description`/`metadata`/`license`, translate `disable-slash-command: true → user-invocable: false` (**never** `disable-model-invocation` — opposite polarity), drop non-standard fields.
5. **Lean, path-scoped rules lane (user decision ①)**: project the **deduplicated, agent-referenced rule set only** (never the whole `registry/rules/` tree, never host entrypoint rules — the existing `hostEntrypointRules` set already skips `CLAUDE.md`/`GEMINI.md`/`AGENTS.md`/`CURSOR.md`) into `.claude/rules/<rule>.md`, capped at **≤ 200 lines per file** (Claude's own adherence guidance), with `paths:` frontmatter added in the projection where a rule is file-type-scoped (e.g. TDD → `tests/**`). **No verbatim coordinator-rule port** — the full coordination policy lives in the orchestrator agent body (loaded only when that agent runs); `.claude/rules/agents-united-<bundle>.md` becomes a **lean roster + delegation-map pointer** only. Rationale: `.claude/rules/` loads unconditionally in every session; a large "you are the coordinator" rule would tax and hijack unrelated sessions.
6. **No duplicate team manifest (correction C4)**: the Claude lane references the existing host-neutral manifest at `.agents/plugins/<bundle>/agents-united/teams/<bundle>.yaml` (single copy, refcounted owners) from the bootstrap prompt and roster rule. Nothing is written under `.claude/agents-united/`.
7. **Field mappings (D7/D8)**: `effort` passes through (`low|medium|high`; `xhigh|max` never authored — guard test); `permissionMode`: `acceptEdits→acceptEdits`, `readOnly→plan` + `Write`/`Edit` denied, `requestReview→default`, `strict→default`; `model`: `inherit→omit`, `pro→sonnet`, `flash→haiku`; Consultation Budget `maxIterations → maxTurns`.
8. **Frontmatter conservativeness**: default emit set is long-stable fields only (`name`, `description`, `tools`, `model`, `permissionMode`, `effort`, `maxTurns`). Version-gated fields (`omitClaudeMd` v2.1.271+, `experimental.cacheTtl` v2.1.248+) are probe/flag-gated, never default. ADR 0018 records the doc snapshot date.

9. **Lockfile & reconcile**: write `lockfile.projections['.claude/…']` with `host: 'claude'`, refcounted `owners`, `hash`, `managedMarker` — same bookkeeping as the cline lane. The Plan-015c authoritative-reconcile pass already owns the `.claude/` namespace (`projectionNamespacePrefixes`), so path renames self-heal.
10. **Migration is a first-class requirement**: prefix-stripping renames every pre-existing `.claude/agents/subagent-*.md`. `agents update` must **prune the old files** (not just fix pointers), and doctor must classify them as **superseded — never "missing"** — extending the existing stale-vs-missing classifier (`tests/doctor.test.ts:145-202` pattern) rather than inventing a new one. The `generative_ui` rename gets the same cross-host silent-migration treatment (ADR 0016 precedent) for both `.claude/skills/` and `.agents/plugins/<bundle>/skills/` copies plus the `bundles.json` reference.
11. **Doctor (ADR 0017 extension)**: `renderProjectionVariants()` dispatches the renderer by `projection.host`; `agents doctor --host claude` adds a `claudeCapability` report to `HealthReport`.
12. **Probe & launcher**: `ClaudeCapabilityProbe` = `CLAUDE_BIN_PATH` → PATH/node-wrapper/`cmd.exe`-bridge resolution (reuse the Cline pattern, incl. the Node ≥18.20 `.cmd`/`.bat` `shell:false` EINVAL bridge) → `claude --version` + `claude --help` flag parsing (**read-only; no `claude agents --json`** — it can start the supervisor daemon; no headless `-p` runs — they cost tokens). `ClaudeLauncher` builds `claude --agent <coordinator> [--add-dir <ws>] [<bootstrap>]` argv arrays with `shell: false`.
13. **Plugin lane (D9, opt-in)**: `.claude-plugin/plugin.json` (+ an `agents/` subdir inside the package) emitted **flag-gated** into `.agents/plugins/<bundle>/` as a **distribution-only** artifact (zip + `claude --plugin-dir`); never the behavioural source (plugin agents are namespaced and ignore `permissionMode`). A dedicated test asserts Cline's `plugin.json` hard-stop scanner behavior is unaffected.
14. **Teams scaffold (user decision ②)**: minimal and experimental — `agents start --host claude --teams` injects `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` **ephemerally into the spawned process environment** (never persisted; never written to `settings.json`; nothing written under `~/.claude/teams/`) plus a bootstrap prompt instructing the lead to spawn teammates from the projected agent types by name. Acceptance is a documented eval scenario, not a feature checklist; the scaffold must never be load-bearing.
15. **Non-goals (documented, not faked)**: `.claude/workflows/*.js` generation; writing `CLAUDE.md`, `CLAUDE.local.md`, `.claude/settings.json`, or `~/.claude/**`; cross-session messaging and agent view; `.claude/commands/` legacy lane (skills supersede it); `claude --agents <json>` as default injection (documented in ADR 0018 as the ephemeral alternative).

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Build | `npm run build` | exit 0, outputs `dist/` |
| Typecheck | `npm run typecheck` | exit 0, 0 errors |
| Test suite | `npm test` | exit 0, all tests pass |
| Targeted tests | `npx vitest run tests/<file>.test.ts` | exit 0, all pass |
| Dry-run projection preview | `node dist/cli.js add software-engineering -t agents --fanout claude --dry-run` | enumerates every Claude lane artifact, writes nothing |

## Scope

**In scope**:
- `docs/adr/0018-claude-code-projection-architecture.md` (new ADR)
- `src/core/claude-projector.ts` (new), `src/core/claude-capabilities.ts` (new), `src/core/claude-launcher.ts` (new)
- `src/core/types.ts`, `src/core/installer.ts`, `src/core/doctor.ts`, `src/core/uninstaller.ts`, `src/core/updater.ts`, `src/core/projector.ts`, `src/cli.ts`
- `registry/skills/generative_ui/` rename + `registry/bundles.json` reference
- `tests/claude-projector.test.ts`, `tests/claude-launcher.test.ts`, `tests/claude-compatibility.test.ts` (new); `tests/projector.test.ts`, `tests/fanout.test.ts`, `tests/doctor.test.ts`, `tests/projection-lifecycle.test.ts`, `tests/helpers/bundle-lifecycle.ts`, `tests/cline-projector.test.ts` (updated)
- `plans/README.md`, `PROJECT.md` §3/§6, `README.md`, `CONTEXT.md` (docs rows + new domain terms)

**Out of scope**: `.claude/workflows/*.js` generation; any write to `CLAUDE.md` / `CLAUDE.local.md` / `.claude/settings.json` / `~/.claude/**`; cross-session messaging; agent view; `.claude/commands/`; Cursor/OpenCode/Codex lane changes (except where shared helpers are refactored).

## Implementation steps (TDD — Red before Green; execute in order)

### Step 0 — Recon (delegate: `subagent-repo-index`)
Produce a written impact list: (a) every test assertion that encodes current Claude-lane behavior (`tests/projector.test.ts`, `tests/fanout.test.ts:19-54`, `tests/doctor.test.ts:145-287`, `tests/projection-lifecycle.test.ts`, `tests/helpers/bundle-lifecycle.ts:69-97`); (b) every call site of `HostProjector.projectAgent` for the `claude-code` profile; (c) confirmation that stripped role names are unique across `registry/agents/` and that no other skill name fails `^[a-z0-9]+(-[a-z0-9]+)*$`.
**STOP if**: any in-scope file drifted since `b9f9a78`, or a stripped-name collision / second invalid name exists.

### Step 1 — Decision record & domain language (Coordinator)
Author `docs/adr/0018-claude-code-projection-architecture.md` (Context / Decision = the 15 design decisions above / Consequences incl. non-goals and the doc snapshot date). Add `CONTEXT.md` terms: **Claude Code Projection**, **Claude Skills Lane**, **Claude Lean Rules Lane**, **Claude Plugin Lane (distribution-only)**, **Claude Agent-Teams Scaffold (experimental)**, **Claude Capability Probe**.
**Verify**: `npm run typecheck` exit 0 (docs-only, but run anyway as gate hygiene).

### Step 2 — RED: guards & projector tests (delegate: `subagent-qa-automation-lead`)
Author failing tests first; run and confirm each fails for the intended reason:
1. `tests/claude-projector.test.ts` — role render (prefix strip, name validity, tool translation, `Agent(…)` allowlist on coordinator, bare `Agent` on specialists, `effort` passthrough, `permissionMode` mapping, `model` mapping incl. `pro→sonnet`/`flash→haiku`, `maxTurns` from budget, marker placement, determinism/byte-identical repeats); skills render (`SKILL.md` shape, `user-invocable: false` polarity — asserting `disable-model-invocation` is **absent** —, auxiliary file copy plan, non-standard field stripping); lean rules render (≤ 200 lines, `paths:` scoping, entrypoint rules skipped, dedup); no `.claude/agents-united/` artifact; boundary cases (no frontmatter, invalid YAML, empty rules, collision with a foreign same-named file).
2. Catalog conformance guards (extend `tests/registry.test.ts` or new `tests/claude-catalog-conformance.test.ts`): every agent name passes `^[a-z0-9]+(-[a-z0-9]+)*$` post-strip; every skill name passes the same regex (fails today on `generative_ui` — the intended Red); per-skill `name+description` ≤ 1,536 chars; aggregate projected subagent descriptions < 15,000 tokens; `effort` ∈ {low, medium, high}.
**STOP if**: any guard passes before implementation for a reason other than the intended Red (e.g. the aggregate budget already exceeding — then re-plan the skills-lane scope).

### Step 3 — GREEN: renderer (delegate: `subagent-backend-architect`)
Implement `src/core/claude-projector.ts` (pure, no I/O beyond registry reads) + `src/core/types.ts` additions (`ProjectionKind` extension if the plugin manifest needs a distinct kind; Claude artifact/capability/plan types). Rename `registry/skills/generative_ui/` → hyphenated name and update `registry/bundles.json:786` (cross-host silent migration lands in Step 4).
**Verify**: `npx vitest run tests/claude-projector.test.ts` green; `npm run typecheck` exit 0.

### Step 4 — Installer lane, lockfile, migration (delegate: `subagent-backend-architect`)
Wire the compound lane into `src/core/installer.ts` beside the cline lane: deploy artifacts, write `lockfile.projections` (`host: 'claude'`, refcounted owners, hash, marker), extend the Plan-015c reconcile pass, **prune superseded `.claude/agents/subagent-*.md` files** on re-projection, and port the `generative_ui` silent migration to `src/core/updater.ts` (ADR 0016 pattern) + `src/core/uninstaller.ts` refcount parity.
**Verify**: `npx vitest run tests/fanout.test.ts tests/projection-lifecycle.test.ts tests/uninstaller.test.ts tests/updater.test.ts` green; `node dist/cli.js add software-engineering -t agents --fanout claude --dry-run` enumerates lanes; a real install into `scratch/` shows `lockfile.projections['.claude/…']` with owners and **zero** stale `subagent-*.md` leftovers after `agents update`.

### Step 5 — Doctor: ADR 0017 host dispatch (delegate: `subagent-backend-architect` + QA)
Generalize `renderProjectionVariants()` (`src/core/doctor.ts:46-91`) to dispatch `ClineProjector` vs `ClaudeProjector` by `projection.host`; add the `--host claude` branch (probe report, lane inventory). Extend the stale-vs-missing classifier for the prefix-rename: old `.claude/agents/subagent-*.md` paths must classify as **"Stale projection … (superseded by …)"**, never "Missing projection", and exactly one warning per path.
**Verify**: `npx vitest run tests/doctor.test.ts` green incl. new cases — (a) hand-edited `.claude/**` ⇒ *Content drift*; (b) stale render ⇒ *Outdated projection*; (c) pre-rename install then `agents update` ⇒ old file pruned, no warnings; (d) deleted file ⇒ exactly one *Missing projection*.
**STOP if**: doctor emits any speculative warning on a clean workspace (ADR 0017 false-positive doctrine).

### Step 6 — Launcher & probe parity (delegate: `subagent-backend-architect`)
Implement `src/core/claude-capabilities.ts` + `src/core/claude-launcher.ts` (argv construction with `shell: false`; `CLAUDE_BIN_PATH` override; mocked-process tests — never spawn a real `claude` in CI). Wire `agents start --host claude [--bg] [--teams] [--plugin]` and `agents doctor --host claude` in `src/cli.ts` (auto-detect host from lockfile `fanout`, mirroring the cline UX).
**Verify**: `npx vitest run tests/claude-launcher.test.ts tests/claude-capabilities.test.ts` green; `agents start software-engineering --host claude --dry-run` prints a plan whose argv contains `--agent orchestrator-engineering`; probe degrades gracefully when `claude` is absent (exit ≠ 0 handled, never throws).

### Step 7 — Opt-in extras (delegate: `subagent-backend-architect`)
Plugin lane: flag-gated `.claude-plugin/plugin.json` + `agents/` subdir inside `.agents/plugins/<bundle>/`; test asserts Cline's hard-stop discriminator is untouched and the manifest validates against the Claude plugin field set. Teams scaffold: `--teams` = ephemeral `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` env injection + bootstrap prompt naming the projected specialist types; no file writes; documented as experimental.
**Verify**: targeted vitest green; `git status` shows no writes outside expected paths; plugin manifest JSON schema test passes.

### Step 8 — Adversarial review, full suite, docs & release (delegate: `subagent-code-reviewer` + Coordinator)
`subagent-code-reviewer` audits: marker handling, refcount leaks, namespace tracing (`.claude/` only), determinism, no non-goal writes, no unmapped tool names surviving. Then: full `npm run typecheck && npm test && npm run build`; update `plans/README.md` status row, `PROJECT.md` §3/§6, `README.md` (Claude lane description + caveats), `CONTEXT.md`; PR #1 → `dev` (`feat: …`), then PR #2 `dev` → `main` per the two-step release flow.
**Verify**: 100% suite green; reviewer report has zero open High-severity findings.

## Acceptance gates

1. `npm run typecheck` exit 0 · `npm test` fully green (incl. every updated suite).
2. `agents add <bundle> -t agents --fanout claude --dry-run` enumerates role + skills + rules lanes; a real install produces `.claude/agents/*.md` (stripped names), `.claude/skills/<name>/SKILL.md` (+ auxiliary files), `.claude/rules/*.md` (lean, path-scoped, ≤ 200 lines), and `lockfile.projections['.claude/…']` with `host: 'claude'` + refcounted owners.
3. Coordinators carry `tools: [Agent(<specialists>), Read, Write, Edit, Bash, Grep, Glob]`; **no unmapped tool name** survives in any projection (unknown names block Claude agent launch).
4. Doctor catches injected `.claude/` **Content drift** and **Outdated projection** (exactly one warning per path, correct remedy); pre-rename installs migrate cleanly with **zero stale `subagent-*.md`** leftovers.
5. Uninstall leaves zero orphans and never touches a foreign `.claude/agents/*.md`.
6. Budget guards: per-skill `name+description` ≤ 1,536 chars; projected subagent descriptions < 15,000 tokens; every projected name passes `^[a-z0-9]+(-[a-z0-9]+)*$`.
7. No writes to `CLAUDE.md`, `CLAUDE.local.md`, `.claude/settings.json`, `~/.claude/**`, or `.claude/workflows/` — enforced by a filesystem-audit test over `scratch/` workspaces.
8. Determinism: repeated renders are byte-identical (mirrors the Cline determinism contract).

## Risk register

| # | Risk | Sev | Mitigation |
|---|---|---|---|
| R1 | Budget overrun (subagent 15k tokens / skill 1,536 chars) | High→Low | Installed-bundle-only skills lane; Step 2 guard tests; measured today at 3.7k tokens / 990 chars worst-case |
| R2 | Prefix-rename orphans old `.claude/agents/subagent-*.md` | High | Step 4 prune + Step 5 superseded classification; pinned migration tests |
| R3 | Always-on rules hijack/token-tax unrelated sessions | Med | Lean + path-scoped rules (decision 5); ≤ 200-line guard; policy lives in orchestrator body |
| R4 | Claude Code doc/version drift (v2.1.x moving target) | Med | Conservative frontmatter set; probe version check; ADR 0018 snapshot date; per-step re-verification clause |
| R5 | Probe side effects (daemon spawn / token cost) | Med→Low | `--version` + `--help` only; never `agents --json`; never `-p` |
| R6 | Foreign-file collisions in `.claude/` | Low | Existing managed-marker + `--force` guard; explicit Claude collision test |
| R7 | Plugin lane regresses Cline's `plugin.json` hard-stop | Low | Dedicated discriminator test in Step 7 |
| R8 | Agent-teams instability (experimental, no resumption) | Med | Scaffold never load-bearing; ephemeral env only; documented eval scenario |

## Delegation map (ADR 0015 planner-orchestrator posture)

| Phase | Specialist | Scope |
|---|---|---|
| Step 0 | `subagent-repo-index` | Read-only recon; impact list; uniqueness/name audit |
| Steps 2–7 | `subagent-backend-architect` | All `src/core/*` + `src/cli.ts` implementation, lane wiring, migration |
| Step 2 | `subagent-qa-automation-lead` | Red-phase test architecture incl. guards + boundary/adversarial cases |
| Step 8 | `subagent-code-reviewer` | Severity-rated adversarial audit before release |

## References (verified 2026-09-18)

- Claude Code — Subagents: https://code.claude.com/docs/en/sub-agents.md
- Claude Code — Skills: https://code.claude.com/docs/en/skills.md
- Claude Code — Memory: https://code.claude.com/docs/en/memory.md
- Claude Code — Plugins: https://code.claude.com/docs/en/plugins.md
- Claude Code — Settings: https://code.claude.com/docs/en/settings.md
- Claude Code — Agent Teams: https://code.claude.com/docs/en/agent-teams.md
- Claude Code — Agent View / Background Agents: https://code.claude.com/docs/en/agent-view.md
- Claude Code — Cross-Session Messaging: https://code.claude.com/docs/en/cross-session-messaging.md
- Claude Code — Worktrees: https://code.claude.com/docs/en/worktrees.md
- Claude Code — Workflows (JS scripts): https://code.claude.com/docs/en/workflows.md
- Internal: ADR 0008/0013/0016/0017, Plans 007/008/015, `tests/doctor.test.ts` stale-vs-missing pattern







