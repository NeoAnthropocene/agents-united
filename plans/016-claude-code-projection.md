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

- **State**: **DONE** — Steps 0–8 complete, automated gates green (2026-09-22). **Owner manual Claude Code verification is outstanding** (gate defined in `plans/017` § Rollout scope); no PR is opened until the owner reports it.
- **Priority**: P1
- **Effort**: L
- **Risk**: MEDIUM (bounded by the Step 2 guards and the Step 4 migration machinery)
- **Depends on**: plans/007, plans/008, plans/013, plans/015 (ADR 0013/0016/0017 era)
- **Category**: runtime integration
- **Planned at**: commit `b9f9a78`, 2026-09-18
- **Decision record**: `docs/adr/0018-claude-code-projection-architecture.md` (authored in Step 1)
- **Followed by**: `plans/017-host-dialect-codex-and-translation-ledger.md` (ADR 0019; generalizes this lane's mappings into `HostDialectSpec`, adds declarative overlays, the cross-host Translation Ledger, and the projection-conformance CI job)
- **Rollout scope (2026-09-21)**: **Claude only.** This branch delivers, tests, and verifies the Claude lane exclusively — automated suite plus **owner manual testing in Claude Code** (the gate is defined in `plans/017` § Rollout scope). Cline is the next target on its own branch; cursor/opencode/codex/kimi are deferred.
- **Execution progress (2026-09-22)**: **STEPS 0–8 DONE — Plan complete except the owner's manual Claude Code verification.**
  - **Steps 0–1** (`7ebaf65`): Step 0 recon census + findings; `docs/adr/0018-claude-code-projection-architecture.md` authored; `CONTEXT.md` domain terms registered.
  - **Steps 2–3** (`96ebdd4`, `8e98133`): `ClaudeProjector` compound renderer with `CLAUDE_DIALECT`, the translation ledger, code-fence-aware body rewriting, catalog-conformance guards; 40 green tests in `tests/claude-projector.test.ts` + `tests/claude-catalog-conformance.test.ts`.
  - **Step 4** (`710cbc8`): the compound-lane body was extracted into a host-parameterised `applyCompoundLane` (Cline passes the same literal `'cline'`, proven byte-identical against HEAD) and the Claude lane wired into `src/core/installer.ts`: `.claude/agents/*.md` with stripped role names, `.claude/skills/<name>/SKILL.md`, lean `.claude/rules/*.md`, and `lockfile.projections` records with `host: 'claude'`, refcounted owners, sha256 hash and `managedMarker`. Superseded-projection pruning is the `subagent-` prefix-strip migration; `src/core/updater.ts` gained the ADR 0016-style silent `generative_ui → generative-ui` migration. `tests/claude-lane-install.test.ts` (13 cases).
  - **Step 5** (`ec30fdd`): `renderProjectionVariants()` now dispatches `ClineProjector` vs `ClaudeProjector` by `projection.host`, and the ADR 0017 freshness pass diffs each projection only against its own host's renderer (previously inert for `.claude/**`). Warning sources are deduplicated per path; pre-rename paths classify as `Stale projection … (superseded by …)` and never as `Missing`; `Missing Cline projection` is now host-correct. Adds `src/core/claude-capabilities.ts` (`ClaudeCapabilityProbe`) and the `agents doctor --host claude` capability block.
  - **Step 6** (`71a0de5`): `src/core/claude-launcher.ts` mirroring `ClineLauncher` (same resolve/plan/launch split, argv built one value per element, spawned with `shell: false`): `claude --agent <coordinator> --add-dir <workspace> [--bg] [--plugin-dir <dir>] <prompt>`. CLI wiring for `agents start --host claude [--bg] [--teams] [--plugin] [--dry-run]` with host dispatch (explicit `--host` wins, else the recorded lockfile fanout, else Cline unchanged) and `--teams` injecting `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` **ephemerally** into the spawned env only.
  - **Step 7** (`3e21e06`): flag-gated `ClaudeProjector.planPluginLane()` emitting `.agents/plugins/<bundle>/.claude-plugin/plugin.json` plus an `agents/` subdir that mirrors `.claude/agents/` byte-for-byte. `InstallOptions.pluginLane` (CLI `agents add --plugin`) is inert for Cline; artifacts are `distributionOnly`, so they are tracked in `lockfile.projections` but never recorded as `projectedTo` targets.
  - **Step 8** (`800d874`): `subagent-code-reviewer` read-only adversarial audit, then three defect fixes — the plugin-lane opt-in is now **persisted** in `LockfileManifest.pluginLane` (an unset flag inherits it, so `agents update` can no longer silently prune the opted-in package; `--no-plugin` turns it off), the bootstrap prompt no longer dangles on the host-neutral manifest for a claude-only fanout, and the launch path pre-flights the projected coordinator definition so a cline-only workspace cannot spawn a session whose `--agent` target is missing.

  - **Post-gate fix** (`58137bd`, found from the owner's manual run): every projected `.claude/rules/*.md` began with a literal `--- {} ---`. `renderRule` built a frontmatter template unconditionally, so an unscoped rule emitted an empty YAML map. Re-verified against the live doc before touching it (`https://code.claude.com/docs/en/memory.md`, fetched 2026-09-22 — no drift from the 2026-09-18 snapshot of § References): *"Rules without a `paths` field are loaded unconditionally and apply to all files."* Frontmatter is optional, so `paths:` now emits only when a rule is actually scoped and an unscoped rule renders marker-first, matching the Cline lane's rule shape. Scoped rules are byte-identical; the Step-3 test that asserted the old shape was replaced with a Red-first assertion. Gates re-run after the change: `typecheck` exit 0, `npm test` **41 files / 630 passed / 0 failed**, and a fresh install shows **0 of 6** rules starting with a frontmatter block. **Note for existing installs:** the 6 rule files change bytes, so `agents doctor` reports `Content drift` for them until `agents update` re-renders — this is expected, not a regression.

  **Gate evidence — every item below was executed in this session.**

  1. `npm run typecheck` → exit 0. `npm test` → **41 test files passed, 630 passed, 208 skipped, 0 failed** (was 36 files / 565 tests before this branch's Step-4+ suites).
  2. `agents add software-engineering -t agents --fanout claude --dry-run` → **36 artifacts**: 5 stripped-name roles (`.claude/agents/{orchestrator-engineering,backend-architect,frontend-architect,code-reviewer,repo-index}.md`), 25 × `.claude/skills/<name>/SKILL.md`, 6 × `.claude/rules/*.md`; writes nothing. A real `--copy` install into `scratch/gate2/` wrote exactly those files and **36** `lockfile.projections` entries, all `host: "claude"`, e.g. `.claude/agents/backend-architect.md → {kind: role, canonical: agents/subagent-backend-architect.md, owners: [software-engineering], hash: sha256:add0293d…, managedMarker: true}`. No `.cline/`, `CLAUDE.md`, `.claude/settings.json` or `.claude/workflows/`.
  3. Pre-rename migration: a seeded pre-rename install (`.claude/agents/subagent-backend-architect.md` + its `projections` entry + its `projectedTo` pointer) followed by `agents update` removed the file, the entry and the pointer — **zero orphans**, and `doctor` reported **0** warnings. Re-seeding the record *without* the file produced **exactly one** `Stale projection .claude/agents/subagent-backend-architect.md for canonical agents/subagent-backend-architect.md (superseded by .claude/agents/backend-architect.md). Run: agents update software-engineering --fanout claude to reconcile.` and **zero** `Missing` warnings; `agents update` self-healed it back to 0 warnings. One hand-edited projection produced **exactly one** `Content drift` warning naming that path and nothing else.
  4. `agents doctor --host claude` printed the Claude Code Runtime & Native Discovery Audit block (Installed ✔, Version `2.1.278`, `--plugin-dir` ✔ Supported, Agent Teams ✖ Unsupported, 5 agents projected). `agents start software-engineering --host claude --dry-run` printed the plan with argv element `[0] --agent`, `[1] orchestrator-engineering`, `[2] --add-dir`, `[3] <workspace>` — each flag/value pair its own element, `shell: false`.
  5. Scope: `git status --porcelain` shows only `src/**` and `tests/**` changed. No `CLAUDE.md`, `CLAUDE.local.md`, `.claude/`, `.claude-plugin/`, `.claude/settings.json`, `.claude/workflows/**` or `~/.claude/**` write; `registry/**` untouched (no `generative_ui` rename — normalization is projection-level).

### Resumption notes (environment facts discovered during Steps 0–1)

- **Subagent delegation unavailable at pause**: `subagent_*` tools returned `Unauthorized: … re-authenticate your Cline account` — verified on **two** roles (`subagent-repo-index`, `subagent-qa-automation-lead`), so the failure is account-wide rather than role-specific. Steps 0–1 were therefore executed in the main session under the ADR 0014/0015 fallback clause; after re-authentication the plan's delegation map governs Steps 2–8.
- **`npm` cannot be invoked directly in this PowerShell** (execution policy blocks `npm.ps1`) — use the `cmd /c "npm run <script>"` bridge, the same Windows pattern the Cline capability probe relies on. Then check `$LASTEXITCODE`.
- **Repo state at pause**: branch `feat/claude-code-projection`, HEAD `7ebaf65`, clean tree. The Step 0 drift check confirmed `registry/`, `src/`, `tests/`, and `docs/` were untouched since `b9f9a78`; only `plans/`, `CONTEXT.md`, and the new ADR changed.
  **Post-gate follow-up on this branch (2026-09-22 — the Tier 1 / Tier 2 parallel-work posture).** Delivered after the gates above, at the owner's direction, so both tiers behave as specified:
  1. **Peer-messaging grant** (`c558f0d`) — `send_message` added to the canonical `tools:` of `subagent-code-reviewer`, `subagent-repo-index`, `subagent-backend-architect` and `subagent-frontend-architect`, matching the token the nine orchestrators already declare. Each body gained `## 📨 Peer Messaging & Direct Reachability`, which states both routes honestly instead of promising a mesh Claude does not provide: under `--teams` a named peer teammate or the lead is reachable via `send_message` (subject to the documented limits — one team per session, fixed lead, no nested teams, never load-bearing), while an ordinary subagent's siblings are **not** directly reachable (Claude's subagent model is report-back-to-the-caller), so findings go to the orchestrator for relay and a bounded exchange uses the existing bare `Agent` tool inside the 3-layer depth. ADR 0014's consultation budget is reused verbatim, no new limits invented.
  2. **Tier-aware Agent Teams posture** (`93757bb`) — `resolveClaudeTeamsPosture()` is pure, exported and unit-tested: explicit `--teams` wins; explicit `--no-teams` wins over the tier; `organization` (Tier 2) enables by default; `domain` (Tier 1) does not; an undeclared tier stays Tier-1. The launch path names which rule fired, and `--dry-run` prints `Bundle tier:` plus the deciding `Agent teams (--teams):` line. The capability probe is never a gate (v2.1.278 `--help` carries no teams text).
  3. **Tier 1 labelled explicitly** — all **33** Tier-1 bundles now declare `"tier": "domain"` in `registry/bundles.json` (33 insertions, no reformatting); only `digital-agency` and `mock-organization-under-construction` remain `organization`. A guard test fails if any bundle loses its tier.
  4. **Tier-2 specialists completed** — the eight further specialists declared by `digital-agency` received the same grant and section, so the teammates a Tier-2 lead spawns can actually message each other. Without this the tier default was hollow: the four engineering specialists originally named are **not** the specialists an organization bundle declares. A guard test derives the required set from `bundles.json` rather than hard-coding it.
  5. **Cross-host honesty (Tier 2 is Claude-only)** — verified by dry-run against the real `digital-agency` bundle: `--host claude` ⇒ `Agent teams: yes (default for tier 'organization')` with `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`; `--host cline` ⇒ `Tier: organization` / `Agent teams: not available on this host (claude-only runtime feature)` with the capability-driven `named-team`/`adaptive-session` strategy intact; `--host agents` (Antigravity) ⇒ the pre-existing "no activation launcher yet; falling back to the Cline lane" note plus the same honest tier lines. A test proves no teams scaffolding can leak into the Cline argv.
  6. **Dialect-codex completeness** — `send_message` was the one entry missing from `CLAUDE_DIALECT.bodyToolVocabulary`, so projected **prose** kept the canonical spelling while the frontmatter mapped to `SendMessage`. Added (whole-word, code-fence-aware, ledger-recorded) — which is what ADR 0018 decision 8 actually requires — so the four new sections no longer need an inline dialect gloss.
  7. **Cline roster dual-path (the parked defect)** — `### Installed Specialist Roles` in `.cline/rules/agents-united-<bundle>.md` now reads `` - **subagent-<role>**: `.cline/agents/<role>.yml` | `.agents/agents/subagent-<role>.md` ``, mirroring the "Installed Workflows" section. This is the **first intentional change to `.cline/**` content** on this branch: the byte-identity contract proven in Step 4 covered the *renderer refactor* (unchanged inputs ⇒ unchanged bytes), not canonical content edits, and a canonical edit legitimately changes every lane's output.
  8. **Unbundled-fallback defect (found by the owner's manual check, 2026-09-22)** — `.claude/agents/orchestrator-engineering.md` had **6 tools and no `Agent` tool at all**, so an `--agent` session could not delegate. Cause: a fanout whose identifier has no bundle definition (`domain:engineering` is a Domain-Atlas pseudo-entry — `registry.ts` resolves it to `targetBundle: 'domain:engineering'`, which is not in `bundles.json`) cannot use the compound lane, so the generic fallback rendered the file with the legacy `TOOL_NAME_MAP`, which drops `invoke_subagent` and `send_message` outright. The ADR-0017 guard then made the degradation permanent: it skipped **any** existing role projection, including ones this fallback had written itself, so re-projection could never repair them. Fixed three ways — the Claude fallback now renders through `ClaudeProjector.renderRole` (identical vocabulary, frontmatter translation and ledger to the compound lane), the guard was narrowed so a *fallback-owned* role (its recorded `canonical` carries the `.agents/` prefix) is re-rendered while a *compound-owned* one stays authoritative, and a bare `Agent` is no longer emitted beside `Agent(<specialists>)` — the live reference treats a bare `Agent` as "allow spawning any subagent without restrictions", so keeping both would have silently widened every coordinator's allowlist. Live reproduction: a `domain:engineering` fanout now yields **11 tools including `Agent`**; a compound install then replaces the bare `Agent` with the allowlist; re-running the bundle-less fanout leaves the allowlist intact; and a deliberately degraded fallback-owned file is **repaired to 11 tools** on re-projection — which is exactly what `agents update` will do to the owner's workspace. Regression suite: `tests/claude-unbundled-fallback.test.ts`.

  **Tool names verified against the live reference** (`https://code.claude.com/docs/en/tools-reference`, fetched 2026-09-22) for the projected coordinator set: `Agent`, `AskUserQuestion`, `Bash`, `CronCreate`/`CronList`/`CronDelete`, `Edit`, `Glob`, `Grep`, `Read`, `SendMessage`, `TaskCreate`/`TaskList`/`TaskUpdate`, `WebFetch`, `WebSearch`, `Write` are all real built-in tools, so the Claude lane's vocabulary matches the published surface. Two caveats recorded rather than coded around: `Glob` is **absent by default on macOS, Linux and WSL** (harmless on Windows, relevant if the lane is ever run there), and the task tools are *"provided by default only on the models listed under Task tool availability, and on other models when you opt in"*, so `TaskCreate` in a tools list can resolve to nothing on some models — which is also why `manage_task → TaskCreate` is best read as `approximated`. `SendMessage` additionally reaches other local sessions (v2.1.224+), matching the `approximated` ledger disposition already recorded for `send_message`.
  9. **Model / effort posture, the hand-off tool, and a ledger correction (owner decisions, 2026-09-22)** — three changes recorded in the ADR 0018 amendment of the same date. (a) **Model/effort posture**: the catalog declares `model: inherit` on all 59 agents, so `inherit` was a de-facto value rather than an intent and every projection inherited the *session* model; `inherit` now resolves to `CLAUDE_DIALECT.roleModelDefaults` — **coordinators `opus`, specialists `sonnet`** — and `effort` falls back to `roleEffortDefaults` (high / medium) only when the canonical declares none, with any explicit tier or effort still winning. (b) **`manage_task → TaskCreate` corrected from `mapped` to `approximated`**: the live reference says the task tools are *"provided by default only on the models listed under Task tool availability, and on other models when you opt in"*, so the grant can resolve to nothing depending on the model. (c) **`SubagentHandback` granted to specialists** — the runtime's own hand-off channel (*"delivers a subagent's final report to whichever conversation receives that subagent's result"*, v2.1.271+, auto mode): `ClaudeCapabilityProbe` now derives `subagentHandback` from `--version`, the doctor block and the `start --dry-run` plan report it, and the projected runtime note names it so a specialist knows the hand-off route. Live proof after re-projection: `orchestrator-engineering` → `model=opus effort=high` + `Agent(…)` allowlist and **no** handback grant; `backend-architect`, `code-reviewer`, `repo-index`, `frontend-architect`, `marketing-content-strategist` → `model=sonnet effort=medium` + bare `Agent` + `SubagentHandback`.
  10. **Coordinator posture on the unbundled path, Claude-native delegation text, and a test type-check gate (owner findings, 2026-09-22)** — (a) `renderRole` decided "coordinator" from a caller-supplied allowlist alone, so the bundle-less `domain:engineering` projection put `orchestrator-engineering` on **Sonnet with a bare `Agent`** while the bundled one was on **Opus with an allowlist**; coordinator-ness now comes from the canonical role (`type: orchestrator` / `mainAgent: true`), and the unbundled fallback supplies the allowlist from the peer roster of the same projection run. (b) The canonical `### ⚡ Subagent Delegation & Host Routing (ADR 0009 / ADR 0014)` section describes *other* runtimes (`language_server.exe`, `subagent_*` tools), so `CLAUDE_DIALECT.bodySectionOverrides` now re-renders it as `### ⚡ Subagent Delegation & Agent Routing (Claude Code)` — allowlist semantics, one self-contained prompt, parallel spawns, `SubagentHandback`, and the teams opt-in. (c) The operator's two findings are resolved: `npm run typecheck` now also runs `tsc --noEmit -p tsconfig.test.json` (its first run found **42 real type errors** in `tests/**` — 35 stream-event fixtures missing `timestamp`, three `unknown`-typed lockfile walks, a missing `BundleDefinition` import, and a legacy fixture missing `description`/`$schema`/`files`), and `cli.ts`'s two copy-pasted Claude capability blocks now share one `renderClaudeCapabilityBlock`. Live proof: `orchestrator-engineering` → `model=opus effort=high` + `Agent(backend-architect, frontend-architect, code-reviewer, repo-index)` + the Claude-native section with no `language_server.exe`; `backend-architect` → `model=sonnet effort=medium` + bare `Agent` + `SubagentHandback`.

  11. **Domain-wide delegation allowlist** (`3dda30e`, owner correction 2026-09-22) — the coordinator's `Agent(...)` allowlist was *this bundle's* declared agents, so an essentials install stranded the domain lead with 4 of the `engineering` domain's 15 specialists, and the list only grew if the operator installed more and happened to re-project. `bundles.json` already groups bundles under a `domain`, so the roster is now the union of that domain's `agents` minus the coordinator — stable across install state and complete for the team it represents (`software-engineering` → 15 names incl. `devops-engineer`/`data-engineer`; `digital-agency` unchanged at 9, since its domain roster *is* its declared team). The delegation prose teaches the consequence (a listed-but-uninstalled type fails to spawn → recommend `agents add <addon>`, else do the slice yourself), and the plugin mirror computes the same roster with a byte-identity assertion. **Known YAML trap pinned in a test**: the `tools:` flow scalar wraps long allowlists across lines, so any parser of `Agent(...)` must fold continuation lines before splitting — a naive `split(', ')` silently merges the names at each wrap point (it made 15 look like 11).

  **Gate evidence for the follow-up (run 2026-09-22, re-run after item 11).** `npm run typecheck` exit 0 (source and test trees); `npm test` **44 files / 686 passed / 208 skipped / 0 failed**. Projected proofs: all four engineering specialists carry `SendMessage` with the bare `Agent` pin intact, and all **ten** `digital-agency` projections do too, with zero `send_message` leaks into any projected body. The Cline lane emits no unmapped-tool warnings. Repo scope: only `registry/**`, `src/**`, `tests/**` and `plans/**` changed.

  **Delegation note (Steps 4–8).** `subagent-repo-index` (recon), `subagent-backend-architect` (Steps 4, 5, 6, 7 implementation) and `subagent-qa-automation-lead` (Steps 4–7 tests) were used as the plan's delegation map specifies. Two caveats worth carrying forward: (a) `subagent-qa-automation-lead` has `maxIterations: 8`, which truncated two of its invocations mid-write — one test file (`tests/claude-capabilities.test.ts`) arrived syntactically incomplete and had to be repaired, and its step reports were never emitted; (b) the Step-7 `subagent-backend-architect` invocation returned a `Unauthorized: … re-authenticate` envelope **while still landing its work in the worktree**, so an `Unauthorized` response is not by itself proof that nothing ran — always inspect `git status`. The Step-5/6 verification suites (`tests/claude-doctor.test.ts`, `tests/claude-launcher.test.ts`), the Step-8 fixes and every gate below were therefore completed in the main session under the ADR 0014/0015 fallback clause.

  **Open risks handed to Plan 017** (all found by the Step 8 audit; none blocks the automated gates, all are recorded rather than fixed because each changes a published ADR 0018 decision or another host's lane):
  1. **Host-neutral team manifest ownership.** ADR 0018 decision 6 keeps exactly one manifest at `.agents/plugins/<bundle>/agents-united/teams/<bundle>.yaml`, and today only the Cline half of the compound lane writes it. A claude-only fanout therefore has no manifest; the launcher now degrades gracefully (it points the coordinator at the projected `.claude/agents/` roster instead of naming a path that does not exist), but Plan 017 should decide whether the `team-manifest` artifact moves into the shared host-neutral lane so the reference is always backed by a file.
  2. **Auxiliary skill resources carry `owners: []`.** `planCompoundProjection` marks non-`SKILL.md` skill files `managedMarker: false` and gives them no declaring owner, so uninstall can leave both the files and their `projections` entries behind. This is the same latent pattern the Cline lane has, and it is reachable today only via the `full` bundle (`frontend-design/LICENSE.txt`, `stitch-design-taste/DESIGN.md`).
  3. **`resolveStartHost` preference.** When a lockfile records both `cline` and `claude`, auto-detection picks Claude without announcing the lane switch, so a user's `agents start` silently changes renderer. The explicit `--host` path is unaffected.
  4. **Ownership cross-validation warnings bypass the per-path dedup set.** Deliberate (deduping them would change Cline's output), but it means "exactly one warning per path" is enforced for presence / marker / content only, not for the ownership checks.
  5. **`ClaudeCapabilityReport.agentTeamsExperimental` is `false` on the installed v2.1.278** because `claude --help` carries no agent-teams text. The `--teams` scaffold is therefore never gated on that boolean; it is a display-only signal.

  **Manual verification is still outstanding.** The owner performs the checklist in `plans/017` § Rollout scope (both the `--agent` launch path and a plain session, plus add / doctor / drift / remove) — the automated suite does **not** stand in for it, and no PR is opened until the owner reports the result.

- **Sequencing invariants from the pause**: Step 4 requires Step 3 green; do **not** begin Step 6 (probe/launcher) before the Step 4 migration tests pass; the Claude-only rollout scope forbids touching any non-Claude renderer (the byte-identical guard in Step 4 verifies this).
- **Open question at pause**: whether to `git push -u origin feat/claude-code-projection` (recommended by `docs/workflow-guide.md` for backup + CI on the eventual PR).

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
16. **Dialect-Codex alignment (Plan 017; amendment added 2026-09-21).** All Claude mapping tables (tool vocabulary, field rules, budgets, name rules, launcher surface) live as one exported pure-data constant **`CLAUDE_DIALECT`** in `src/core/claude-projector.ts`, so Plan 017 lifts them into the shared `HostDialectSpec` without rewriting this renderer. The Claude lane additionally emits **Translation Ledger dispositions** (`mapped | approximated | degraded | unsupported`) for every frontmatter key dropped or degraded, and applies a **deterministic body-tool rewrite** (canonical tool names in prompt-body prose → Claude-native names, whole-word, code-fence-aware) with a **body lint** that fails on any unmapped survivor. The cross-host ledger registry, overlay support, and the CI conformance job are Plan 017 scope — this plan only wires the Claude-side emission points.

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

### Step 0 — Recon (EXECUTED 2026-09-21 — findings recorded below; no action required)
Produce a written impact list: (a) every test assertion that encodes current Claude-lane behavior (`tests/projector.test.ts`, `tests/fanout.test.ts:19-54`, `tests/doctor.test.ts:145-287`, `tests/projection-lifecycle.test.ts`, `tests/helpers/bundle-lifecycle.ts:69-97`); (b) every call site of `HostProjector.projectAgent` for the `claude-code` profile; (c) confirmation that stripped role names are unique across `registry/agents/` and that no other skill name fails `^[a-z0-9]+(-[a-z0-9]+)*$`.
**STOP if**: any in-scope file drifted since `b9f9a78`, or a stripped-name collision / second invalid name exists.

**Step 0 findings (executed 2026-09-21, main session — `subagent_repo_index` returned `Unauthorized` in this runtime; main-session fallback permitted by ADR 0014/0015, mirroring the Plan 013 precedent):**

- **Drift check clean**: `git diff --stat b9f9a78..HEAD -- registry/ src/ tests/ docs/` is empty (only `plans/` changed).
- **Role names**: 59 agent files; **zero collisions** after `subagent-` stripping; every basename matches `^[a-z0-9]+(-[a-z0-9]+)*$` before *and* after stripping.
- **Skills**: 166 skill directories; exactly **one** name violation — `generative_ui` (both directory and frontmatter). Zero directory↔frontmatter name mismatches elsewhere.
- **Frontmatter tool vocabulary = 18 tokens**: `view_file` 59, `find_by_name` 59, `grep_search` 58, `write_to_file` 56, `list_dir` 56, `replace_file_content` 52, `run_command` 29, `manage_task` 25, `schedule` 25, `search_web` 13, `read_url_content` 12, `ask_question` 12, `multi_replace_file_content` 10, `invoke_subagent` 9, `define_subagent` 9, `manage_subagents` 9, `send_message` 9, `generate_image` 3.
- **Additional mapping requirements surfaced by Step 0** (fold into the Claude dialect; do not improvise at implementation time): `find_by_name` → `Glob`; `search_web` → `WebSearch`; `read_url_content` → `WebFetch`; `multi_replace_file_content` → `Edit`; `generate_image` → ledger `unsupported` (Claude exposes no image-generation tool) + prose rewrite; `define_subagent` / `manage_subagents` → ledger `approximated` + prose rewrite to "agents are pre-defined; delegate via the Agent tool". Note `TOOL_NAME_MAP` today maps `web_search` (not `search_web`), so the two web tools are currently dropped silently.
- **`generative_ui` references are wider than one line**: `registry/bundles.json:786`, `registry/agents/subagent-marketing-creative-designer.md:40,94,95`, `registry/agents/subagent-ui-designer.md:40`, `registry/skills/mcp-setup/SKILL.md:217,230`, `README.md:742`. The Claude lane must therefore rewrite **skill references inside bodies** too (`generative_ui` → `generative-ui`), not only the artifact name.
- **Workspace facts**: `.gitignore:159` contains `/.claude/`; no `.claude/` directory exists yet; `src/core/claude-projector.ts` and `src/core/dialects.ts` do not exist (lane confirmed unimplemented).
- **Call-site blast radius (small, good)**: `'claude-code'` appears only in `src/core/hosts.ts:6,51` (profile definition) and as a comment at `src/core/projector.ts:156`; the Claude namespace prefix lives at `src/core/installer.ts:181`. **No test asserts a `.claude/agents/*` path shape** — only three suites mention `.claude/` at all (`tests/cli-e2e.test.ts`, `tests/doctor.test.ts`, `tests/fanout.test.ts`, 2 references each), so the rename touches far fewer assertions than feared.
- **Test-harness findings (2026-09-21, discovered while running the Step 3 gate)**:
  1. The doctor suite shares the `scratch/` root with the projection lanes, which write **sibling** dirs (`scratch/.agents/plugins/<bundle>/**` from the Cline lane, `scratch/.claude/**`, …). Adding two test files shifted worker scheduling and exposed a latent `ENOTEMPTY` race in `tests/doctor.test.ts`'s cleanup. Hardened with a bounded in-test re-attempt loop.
  2. **Passing `maxRetries`/`retryDelay` options through to `fs-extra`'s `remove()` hangs in this environment** (reproduced: the doctor suite never finished; reverting to a plain `remove()` restored a 3.2 s / 17-test pass). Do not use those options here — use the in-test retry loop instead.
  3. **Step 3 gate result**: `npm test` → **36 files, 565 passed, 208 skipped, 0 failed**; `npm run typecheck` exit 0. The two new suites contribute 40 tests (32 projector + 8 conformance).

### Step 1 — Decision record & domain language (Coordinator)
Author `docs/adr/0018-claude-code-projection-architecture.md` (Context / Decision = the 15 design decisions above / Consequences incl. non-goals and the doc snapshot date). Add `CONTEXT.md` terms: **Claude Code Projection**, **Claude Skills Lane**, **Claude Lean Rules Lane**, **Claude Plugin Lane (distribution-only)**, **Claude Agent-Teams Scaffold (experimental)**, **Claude Capability Probe**.
**Verify**: `npm run typecheck` exit 0 (docs-only, but run anyway as gate hygiene).

### Step 2 — RED: guards & projector tests (delegate: `subagent-qa-automation-lead`)
Author failing tests first; run and confirm each fails for the intended reason:
1. `tests/claude-projector.test.ts` — role render (prefix strip, name validity, tool translation, `Agent(…)` allowlist on coordinator, bare `Agent` on specialists, `effort` passthrough, `permissionMode` mapping, `model` mapping incl. `pro→sonnet`/`flash→haiku`, `maxTurns` from budget, marker placement, determinism/byte-identical repeats); skills render (`SKILL.md` shape, `user-invocable: false` polarity — asserting `disable-model-invocation` is **absent** —, auxiliary file copy plan, non-standard field stripping); lean rules render (≤ 200 lines, `paths:` scoping, entrypoint rules skipped, dedup); no `.claude/agents-united/` artifact; boundary cases (no frontmatter, invalid YAML, empty rules, collision with a foreign same-named file); **body-tool rewrite** (canonical tool names in prompt-body prose → Claude-native per the vocabulary map — measured today (files/occurrences): `view_file` 38/73, `run_command` 31/64, `schedule` 26/53, `manage_task` 25/27, plus 14 more tokens — **18 total**, see the Step 0 findings census — whole-word matching, code-fence skipping, lint fails on any unmapped survivor); **ledger emission** (every dropped/degraded frontmatter key produces a Translation Ledger disposition entry).
2. Catalog conformance guards (extend `tests/registry.test.ts` or new `tests/claude-catalog-conformance.test.ts`): every agent name passes `^[a-z0-9]+(-[a-z0-9]+)*$` post-strip; every skill name passes the same regex (fails today on `generative_ui` — the intended Red); per-skill `name+description` ≤ 1,536 chars; aggregate projected subagent descriptions < 15,000 tokens; `effort` ∈ {low, medium, high}.
**STOP if**: any guard passes before implementation for a reason other than the intended Red (e.g. the aggregate budget already exceeding — then re-plan the skills-lane scope).

### Step 3 — GREEN: renderer (delegate: `subagent-backend-architect`)
Implement `src/core/claude-projector.ts` (pure, no I/O beyond registry reads) + `src/core/types.ts` additions (`ProjectionKind` extension if the plugin manifest needs a distinct kind; Claude artifact/capability/plan types). Export every mapping table as the single **`CLAUDE_DIALECT` pure-data constant** (the Plan 017 lift point) and integrate the deterministic body-tool rewrite pass + ledger emission hooks (the cross-host ledger registry and CI job are Plan 017 scope). **DECIDED (2026-09-21, coordinator — reversible):** the skill `generative_ui` (referenced at `registry/bundles.json:786`) carries a name that is invalid in every dialect. Chosen: **normalize in the Claude projection only** — emit `.claude/skills/generative-ui/` with `name: generative-ui`, plus a ledger disposition mapping `generative_ui → generative-ui`, **and rewrite the skill's references inside projected bodies** (Step 0 located them at `registry/bundles.json:786`, `registry/agents/subagent-marketing-creative-designer.md:40,94,95`, `registry/agents/subagent-ui-designer.md:40`, `registry/skills/mcp-setup/SKILL.md:217,230`, `README.md:742` — a projected specialist that still says `generative_ui` would reference a skill that does not exist under that name); zero cross-host impact and fully compliant with the Claude-only rollout scope. A Claude-lane guard test asserts every projected skill name matches `^[a-z0-9]+(-[a-z0-9]+)*$`. The canonical rename (folder + `bundles.json` reference) is deferred to the follow-up branch, where it becomes a cross-host silent migration touching the Cline lane.
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
9. Body lint & ledger: zero unmapped canonical tool names survive in any projected `.claude/` body (whole-word, code-fence-aware); every dropped or degraded frontmatter key carries a Translation Ledger disposition (`mapped | approximated | degraded | unsupported`).

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

## Appendix — Team delegation prompt (handoff at `8e98133`)

Copy the block below into a fresh Cline CLI session on branch `feat/claude-code-projection`. It is self-contained — the receiving team needs no other context.

```text
You are the engineering team taking over Plan 016 (Claude Code projection lane, ADR 0018) in the
repository C:\github\agents-united, on branch `feat/claude-code-projection` at commit `8e98133`.

LOAD THESE FIRST, IN ORDER
1. plans/016-claude-code-projection.md — the authoritative plan. Steps 0–3 are DONE: read its
   sections "Execution progress", "Step 0 findings" and "Resumption notes" before doing anything.
2. docs/adr/0018-claude-code-projection-architecture.md — the 15 binding design decisions.
3. plans/017-host-dialect-codex-and-translation-ledger.md — follow-on work. DO NOT start it.
4. CONTEXT.md — the terms Claude Code Projection, Claude Skills Lane, Claude Lean Rules Lane,
   Claude Plugin Lane, Claude Agent-Teams Scaffold, Claude Capability Probe, Translation Ledger.
5. src/core/claude-projector.ts and tests/claude-projector.test.ts,
   tests/claude-catalog-conformance.test.ts — the renderer and its 40 green tests you build on.

HARD SCOPE BOUNDARIES (violating any of these fails the task)
- Claude lane ONLY. Do not modify the cline/cursor/opencode/codex renderers or any .cline/** output.
- Never write to CLAUDE.md, CLAUDE.local.md, .claude/settings.json, ~/.claude/** or .claude/workflows/**.
- Do NOT rename registry/skills/generative_ui/ (normalization is projection-level by decision).
- No force-pushes, no commits to main/dev, conventional commits only.

TASKS — execute Plan 016 Steps 4 → 5 → 6 → 7 → 8 in order, honouring every listed STOP condition
- Step 4 (installer lane, lockfile, migration): wire the Claude compound lane into src/core/installer.ts;
  deploy artifacts; write lockfile.projections entries with host "claude", refcounted owners, hash and
  managedMarker; extend the existing Plan-015c reconcile pass; PRUNE superseded
  .claude/agents/subagent-*.md files; port the generative_ui silent migration into src/core/updater.ts;
  add uninstaller refcount parity.
- Step 5 (doctor): dispatch the renderer by projection.host in DoctorEngine.renderProjectionVariants;
  add the `--host claude` branch; classify pre-rename paths as "Stale projection … (superseded by …)"
  — never as "Missing projection" — with exactly one warning per path and zero speculative warnings.
- Step 6 (probe + launcher): add src/core/claude-capabilities.ts and src/core/claude-launcher.ts using
  `claude --version` and `--help` parsing ONLY (never `claude agents --json`, never headless -p), argv
  arrays with shell:false, and the Windows .cmd/.bat cmd.exe bridge; wire
  `agents start --host claude [--bg] [--teams] [--plugin]` and `agents doctor --host claude` in src/cli.ts.
- Step 7 (opt-in extras): flag-gated .claude-plugin/plugin.json + agents/ subdir inside
  .agents/plugins/<bundle>/ with a test proving Cline's plugin.json hard-stop is unaffected; the
  `--teams` scaffold injects CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 ephemerally into the spawned
  process and names projected agent types — nothing persisted, nothing written to ~/.claude.
- Step 8: run subagent-code-reviewer as a read-only adversarial audit, then the full gates and docs.

DELEGATION — use the configured subagent tools when authorized in this session; if they return
"Unauthorized", execute in the main session and state that in every report.
  subagent-backend-architect  -> Steps 4, 5, 6, 7 (implementation)
  subagent-qa-automation-lead -> new Red tests for Steps 4–6 (installer, migration, doctor, launcher)
  subagent-code-reviewer      -> Step 8 audit, read-only, severity-rated
  subagent-repo-index         -> read-only recon when you need a blast radius

WINDOWS ENVIRONMENT WORKAROUNDS (already learned — do not rediscover)
- `npm` cannot run directly in PowerShell. Use `cmd /c "npm run typecheck"` and check $LASTEXITCODE.
- Long commands exceed the 30s command budget: run detached, e.g.
  Start-Process cmd.exe '/c "npm test > %TEMP%\au-logs\step4.log 2>&1"' -WindowStyle Hidden, then poll
  the log with Start-Sleep + Get-Content.
- NEVER redirect logs into scratch/ — tests/doctor.test.ts uses scratch/ as its workspace and deletes
  sibling projection dirs.
- NEVER pass maxRetries/retryDelay to fs-extra's remove(): it hangs this environment (reproduced).
- PowerShell: $pid is read-only (use another name); do not run a "kill stale vitest" command and a
  "start vitest" command in the same parallel batch.
- Stale workers: Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine
  -match 'vitest|agents-united.dist.cli.js' } | Stop-Process -Force

GATES — before declaring Plan 016 DONE
1. `npm run typecheck` exit 0 and `npm test` fully green (36+ files, 0 failures).
2. `agents add software-engineering -t agents --fanout claude --dry-run` enumerates role, skills and
   rules artifacts; a real install into scratch/<case>/ writes .claude/agents/*.md (stripped names),
   .claude/skills/*/SKILL.md, .claude/rules/*.md and lockfile.projections['.claude/…'] with
   host "claude" and refcounted owners.
3. A pre-rename install followed by `agents update` prunes every old .claude/agents/subagent-*.md with
   zero orphans; doctor gives exactly one warning per genuinely drifted path.
4. `agents doctor --host claude` prints a capability block; `agents start software-engineering
   --host claude --dry-run` prints argv containing `--agent orchestrator-engineering`.
5. No file outside .claude/**, .agents/** (lockfile + plugin lane), registry/translation-ledger.json,
   src/**, tests/**, docs/** and plans/** is written.

WHEN DONE
- Update plans/016-…md "Execution progress" and the plans/README.md row to DONE with gate evidence.
- Hand the owner the manual Claude Code checklist from plans/017 § Rollout scope (both the --agent
  launch path and a plain session, plus add/doctor/drift/remove) — the OWNER performs it; do not claim it.
- Stop and report: commits, changed files, gate evidence, open risks, recommended next step (Plan 017).
- Do not open the PR until the owner reports the manual gate result.

REPORT FORMAT per step: (1) what changed with file:line, (2) the exact verification command and its
observed result, (3) any STOP condition hit, (4) the next step. Keep it factual; never report a gate as
passing unless you ran it in this session.
```







