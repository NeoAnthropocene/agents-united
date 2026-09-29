# Plan 029: Orchestrator MCP Access & Antigravity Runtime — Launcher and Subagent Reachability

> **Executor instructions**: self-contained; TDD; STOP on listed conditions; update this plan's
> row in `plans/README.md` when done. Source evidence: the owner's Windows field test of
> Plans 025–028 (2026-09-28, project thread) and a read-only repo audit the same day
> (§ Evidence). Runs in parallel with Plan 030. Files touched: `registry/agents/orchestrator-*.md`
> and the engineering/architecture/security specialists' `mcpServers:` frontmatter,
> `src/core/claude-projector.ts`, `src/core/mcp-locations.ts`, `src/core/doctor.ts`,
> `registry/translation-ledger.json`, a new `src/core/antigravity-launcher.ts` +
> `src/core/antigravity-capabilities.ts`, the `start` command in `src/cli.ts`,
> `docs/host-primitive-matrix.md`, goldens under `tests/golden/**`.

## Status

- **State**: EXECUTED — 2026-09-28 (owner approved; execution completed on
  `feat/orchestrator-mcp-and-antigravity-launcher`). Acceptance gates 2–5 pass; gate 1
  (`npm test` green) passes after the Plan 029 timeout-headroom fix to the three install-heavy
  `host-primitive-matrix.test.ts` cases; gate 6 (owner manual Windows checks) is pending.
- **State history**: PROPOSED — 2026-09-28 (owner asked for this plan; awaiting approval)
- **Priority**: P1 · **Effort**: M–L · **Risk**: Medium (changes every projected Claude
  orchestrator's tool list; adds a new launcher)
- **Depends on**: none. Plan 030 is independent.
- **Category**: runtime integration / host projection
- **Branch**: `feat/orchestrator-mcp-and-antigravity-launcher` (cut fresh from `dev` when authorized)

## Why this exists

The owner's field test surfaced three gaps that the 025–028 work did not cover:

1. **Claude orchestrators and specialists cannot reach MCP servers the user has installed.**
   On Claude Code the orchestrator could not use Context7 (and did not have Firecrawl or
   GitHub). The audit found why: every projected Claude role carries an explicit `tools:`
   allowlist (e.g. `backend-architect`: Read, Edit, Write, Bash, Grep, Glob, SendMessage,
   SubagentHandback), and a Claude subagent with an explicit `tools:` list gets only those
   tools, so no MCP tool is reachable. The canonical roles already declare the servers they
   need (`orchestrator-engineering`: github, context7, chrome-devtools-mcp), but the Claude
   lane drops `mcpServers` (`src/core/claude-projector.ts:73`, ledger `claude/mcpServers` =
   `degraded`).
2. **Coverage is uneven.** Declared servers per orchestrator today: business — markitdown;
   design — stitch, figma, chrome-devtools-mcp; digital-agency — github, firecrawl, context7,
   playwright, markitdown, chrome-devtools-mcp, stitch, figma; engineering — github, context7,
   chrome-devtools-mcp; marketing — firecrawl, markitdown, context7; research — firecrawl,
   context7, markitdown; security — github; system-architecture — github, context7;
   universal — github, context7. The owner wants **Context7, Firecrawl and GitHub on every
   orchestrator**, plus MCP access for the specialists that need current docs.
3. **Antigravity has no `agents start` launcher, and its orchestrators re-create specialists.**
   `agents start secops-application-security --host antigravity` prints "no activation launcher
   yet; falling back to the Cline lane". Launched by @-mentioning the orchestrator file in the
   Antigravity app instead, the orchestrator could not invoke `.agents/agents/subagent-*` by
   name; it registered new subagents at runtime with `define_subagent`, flattened to
   name/description/system prompt/tool booleans. Those copies dropped the roles' hooks and were
   summarized rather than copied, so the Safety and Skill Consultation Map sections are not
   guaranteed to survive.

## Evidence

- Projected `.claude/agents/backend-architect.md` and `orchestrator-engineering.md` from a
  scratch `agents add backend-distributed-systems --fanout claude,cline` (2026-09-28): explicit
  `tools:` lists with no `mcp__*` entry and no `mcpServers:` field.
- `registry/translation-ledger.json`: `mcpServers` — claude `degraded`, antigravity `mapped`,
  cline `unsupported`.
- `src/core/mcp-locations.ts:149,164` register `.claude/mcp.json` and `~/.claude/mcp.json` for
  Claude Code. Claude Code's documented project file is `.mcp.json` at the repo root, with user
  servers in `~/.claude.json`; Step 0 confirms and corrects.
- `src/cli.ts` `start` action: only `claude` and the Cline lane have launchers.
- ADR 0009: the Antigravity CLI is `agy`; the interactive TUI and the Antigravity 2.0 desktop
  read `.agents/agents/` natively; `--agent NAME` injects when the name matches a discovered
  agent; headless `-p` is not a conformance target (pinned `agy` 1.1.15, 2026-08-19).
- ADR 0011: `agy mcp add|remove|list|enable|disable` exists.

## Objective

### A. MCP access (all three hosts)

1. **Baseline set.** Every orchestrator declares `context7`, `firecrawl` and `github` in its
   canonical `mcpServers:` (added to what it already declares). Specialists that write code or
   configuration against vendor APIs get `context7` (engineering, architecture and security
   specialists); the security specialists also get `github`. Step 0 lists the exact roles.
2. **Claude lane: stop dropping `mcpServers`.** Project each canonical server so a Claude
   orchestrator or specialist can call its tools despite the explicit `tools:` list — via the
   documented subagent mechanism Step 0 confirms (per-subagent `mcpServers:` field and/or
   `mcp__<server>` entries in `tools:`). Ledger `claude/mcpServers` → `mapped` (or
   `approximated` with the reason). Never write server credentials or API keys; projection
   references servers by name only.
3. **Configured-server check.** `agents doctor --host <h>` reads the MCP location registry and
   warns for each server an installed role declares but the host has not configured, printing
   the host's own add command (`claude mcp add …`, `agy mcp add …`, or the Cline settings file
   path). It never installs a server itself.
4. **Fix the Claude MCP locations** in `src/core/mcp-locations.ts` to the paths Step 0 confirms.
5. **Cline.** Record whether Cline 3.0.65 configured agents inherit the session's MCP tools
   (from `cline_mcp_settings.json`). If they do, the ledger entry becomes `approximated` with
   that rationale; if not, it stays `unsupported` and doctor says so.

### B. Antigravity launcher

6. `agents start <bundle> --host antigravity` (and auto-detected when the lockfile's only hosts
   are `agents`/Antigravity): an `AntigravityCapabilityProbe` (`agy --version`, on PATH or an
   `AGY_BIN_PATH` override) and an `AntigravityLauncher` that starts the interactive `agy` TUI
   with `--agent <bundle's orchestrator>`, passing the prompt as the opening message if `agy`
   supports it. `--dry-run` prints the resolved argv like the other launchers.
7. When `agy` is not installed, print the desktop route instead of silently falling back to
   Cline: open the workspace in Antigravity and @-mention `.agents/agents/<orchestrator>.md`.
   The Cline fallback happens only when the user passes `--host cline`.

### C. Antigravity subagent reachability

8. Verify on the current Antigravity release whether an orchestrator can invoke workspace
   agents in `.agents/agents/` by name (`invoke_subagent`). If yes, fix whatever made the field
   test fall back to `define_subagent` (naming, discovery path or orchestrator wording).
9. If runtime registration is required, add an Antigravity delegation rule to the orchestrators:
   when registering a specialist with `define_subagent`, pass the canonical role body verbatim
   (Role, Skill Consultation Map, Protocol, Safety, Report format) as its system prompt, never a
   summary, and set tool permissions from the role's `tools:`. Record the finding in
   `docs/host-primitive-matrix.md` (subagents row, Antigravity column).

## Implementation steps (TDD)

**Step 0 — verification (delegate: `subagent-repo-index` for the repo, owner for live hosts).**
Against the current docs and binaries, confirm: (a) how a Claude Code subagent with an explicit
`tools:` list reaches MCP servers (per-subagent `mcpServers:`, `mcp__<server>` tool names, or a
server-level wildcard), and Claude's project/user MCP config paths; (b) whether Cline configured
agents inherit session MCP tools; (c) current `agy` version, whether `--agent` still injects in
the interactive TUI, and whether an initial prompt can be passed; (d) whether Antigravity's
orchestrator can `invoke_subagent` a workspace agent by name. List the specialist roles for
Objective 1. STOP if (a) has no documented mechanism — keep `degraded` and fall back to the
doctor check plus a README note.

**Step 1 — RED tests (delegate: `subagent-qa-automation-lead`).** Every orchestrator declares
the baseline three; a projected Claude orchestrator exposes each declared server by the Step 0
mechanism; no credentials in any projected file; doctor warns for a declared-but-unconfigured
server using a fixture MCP config; `start --host antigravity --dry-run` prints the `agy` argv;
missing `agy` prints the desktop route and exits 0 without launching Cline.

**Step 2 — MCP (delegate: `subagent-backend-architect`).** Objectives 1–5; ledger updates;
regenerate the Claude goldens in one reviewed pass.

**Step 3 — Antigravity launcher (delegate: `subagent-backend-architect`).** Objectives 6–7,
mirroring `ClaudeLauncher`/`ClaudeCapabilityProbe` structure.

**Step 4 — Antigravity reachability (delegate: `subagent-backend-architect`).** Objectives 8–9
per the Step 0 finding; update the host matrix.

**Step 5 — adversarial audit (delegate: `subagent-code-reviewer`).** No secret written
anywhere; Cline and Antigravity projections unchanged except the declared `mcpServers` lists;
the launcher never falls back to another host silently.

## Step 0 record (execution findings — kept here per the handoff, not in the handoff file)

Reconnaissance 2026-09-28, execution 2026-09-28, `orchestrator-engineering`.

**Step 0(a) — CONFIRMED, no STOP.** Two composable mechanisms pulled 2026-09-28 from
`code.claude.com/docs/en/sub-agents` and `code.claude.com/docs/en/mcp`: (1) a per-subagent
`mcpServers` frontmatter field given by name (inline server definitions are never emitted),
(2) MCP patterns in `tools:` — `mcp__<server>` for writable roles, exact
`mcp__<server>__<tool>` pins for read-only roles.

**Step 0(b) — Cline MCP inheritance: `unsupported`, medium confidence.**
Whether Cline Configured Agents inherit session MCP tools is undocumented, not explicitly
denied — the only explicit statement found is exclusion, so `cline/mcpServers` stays
`unsupported` with the rationale recorded in the ledger (and echoed by
`agents doctor --host cline`). A binary/source check (`SubagentRunner`/`SubagentBuilder`)
would be needed to reach high confidence.

**Step 0(c) — `agy` verified live on the target Windows machine (2026-09-28).**
`agy --version` → **1.2.12** (drift from the 1.1.15 pin; 1.2.12 is now the verified floor,
pinned in the probe as `AGY_MIN_VERSION = {1, 2, 12}`, reported as data). `--agent` still
injects; an opening prompt CAN be passed via `-i` / `--prompt-interactive`, so no capability
flag was needed — target argv `agy --agent <orchestrator> --prompt-interactive "<prompt>"`
(`--mode` also confirmed; `--print` is explicitly not a conformance target). `agy mcp`
exists (ADR 0011 holds). `claude` on the same box: 2.1.283.

**Step 0(d) — by-name reachability: RESOLVED NO (Plan 031, agy 1.2.13, owner probes
2026-09-29).** `agy agents` lists neither the flat nor the directory-layout fixture, and both
`-i` identity sessions ran the stock agent (`NOT_FOUND` on both markers) — the same failure
signature as the 1.1.14/1.1.15 headless verdicts. `--agent` accepts the name but resolves no
workspace roster in either layout. The matrix's explicitly-unverified note plus the fail-closed
verbatim rule stand as the final answer; gate 6(c) is blocked-by-vendor with the desktop route
as the supported path. Re-run the Plan 031 probes before touching the installer if a future
agy release restores workspace discovery.

## Acceptance gates

1. `npm run typecheck` exit 0 · `npm test` green.
2. All 9 orchestrators declare context7, firecrawl and github; the Step 0 specialist list
   declares its servers.
3. Projected Claude roles expose their declared servers; no API key or token in any projected
   file.
4. `agents doctor --host claude|antigravity|cline` lists declared-but-unconfigured servers with
   the host's add command.
5. `agents start <bundle> --host antigravity --dry-run` prints the `agy` argv; without `agy` it
   prints the desktop route and does not launch Cline.
6. **Owner manual check (Windows)**, with Context7, Firecrawl and GitHub configured on each
   host: (a) Claude Code — `orchestrator-engineering` and a spawned `backend-architect` each call
   Context7 successfully; (b) Cline — the orchestrator calls Context7, and the finding for
   configured agents matches the ledger; (c) Antigravity — `agents start software-engineering
   --host antigravity` opens `agy` on the orchestrator, and the orchestrator delegates to
   `backend-architect` with its full Safety and Skill Consultation Map sections intact.

## Risk register

| # | Risk | Sev | Mitigation |
|---|---|---|---|
| R1 | Listing MCP tools in `tools:` widens what a read-only role can do | Med | Step 0 confirms per-server scoping; read-only roles get read-only servers (Context7, Firecrawl), GitHub only where writes are in the role's mandate |
| R2 | A declared server that the user never configured fails at spawn | Med | doctor warning + add command; projection must not break when a server is absent (Step 0 checks Claude's behavior) |
| R3 | `agy` flags changed since 1.1.15 | Med | Step 0 re-verifies; launcher pins the verified version in its probe |
| R4 | Credentials leak into projected files | High | Step 1 test scans every projected file for token patterns; servers referenced by name only |
| R5 | Golden churn hides an unrelated change | Low | one reviewed regeneration; content-only diff |

## Delegation map (ADR 0015 planner-orchestrator posture)

| Phase | Specialist | Scope |
|---|---|---|
| Step 0 | `subagent-repo-index` + owner | repo inventory; live-host verification |
| Step 1 | `subagent-backend-architect` (reassigned from `subagent-qa-automation-lead` per owner decision 2026-09-28; the QA role lives in the uninstalled `qa-automation` addon and will not be installed) | RED tests |
| Steps 2–4 | `subagent-backend-architect` | MCP projection, launcher, Antigravity reachability |
| Step 5 | `subagent-code-reviewer` | adversarial audit |

## Final Objective-1 specialist list (owner decision: Option B, broad — 2026-09-28)

All 14 engineering/architecture/security roles that were missing `context7` receive it
(`context7` is read-only, so no R1 risk). The four security specialists already declare
`github`; no change there.
Added `context7`: `subagent-accessibility-lead`, `subagent-android-architect`,
`subagent-appsec-penetration-tester`, `subagent-cloud-security-architect`,
`subagent-code-reviewer`, `subagent-compliance-grc-specialist`,
`subagent-devops-engineer`, `subagent-e2e-tester`, `subagent-ios-architect`,
`subagent-qa-automation-lead`, `subagent-repo-index`, `subagent-security-engineer`,
`subagent-sysops-sre-lead`, `subagent-system-architect`.
Already complete: `subagent-ai-model-architect`, `subagent-backend-architect`,
`subagent-cloud-infrastructure-architect`, `subagent-cross-platform-specialist`,
`subagent-data-engineer`, `subagent-database-administrator`,
`subagent-distributed-systems-architect`, `subagent-finops-cost-engineer`,
`subagent-frontend-architect`, `subagent-ml-platform-engineer`.

## Risk R1 decision — Option B, pinned exact read-only tool names (2026-09-28)

`permissionMode: readOnly` roles (`subagent-code-reviewer`, `subagent-repo-index`, both
already declaring `github`) must NEVER receive the bare `mcp__github` grant: the plan-mode
filter strips only Write/Edit/NotebookEdit/Bash and never touches MCP entries, so bare
`mcp__github` would hand a `plan`-mode role GitHub write tools. The projector emits pinned
exact read-only names (`mcp__github__search_code`, `mcp__github__get_file_contents`,
`mcp__github__list_pull_requests`, `mcp__github__pull_request_read`,
`mcp__context7__resolve-library-id`, `mcp__context7__query-docs`); non-read-only roles get
server-level `mcp__<server>`. NOTE: an initial `mcp__context7__get-library-docs` pin shipped
in Step 2 but `get-library-docs` is Context7's deprecated tool name — corrected to
`mcp__context7__query-docs` (verified against the live MCP surface) in Step 3, with the two
affected goldens re-synced.

## Execution deviations and cross-plan touch (recorded for review)

- `subagent_*` tools returned `Unauthorized` transiently mid-session (Cline account auth; also
  documented in `plans/016-claude-code-projection.md`). All four were re-probed working before
  delegating Steps 0–5; one Step-1 delegation attempt failed once, then succeeded on retry.
  A later full plane outage was confirmed and explicitly attributed before any main-session
  completion, per the handoff contract.
- `tests/claude-agent-teams-posture.test.ts` (Plan 022 H2 gate) conflicted with the mandated
  `mcp__*` grants; per owner decision the regex excludes the MCP namespace
  (`/^(?!mcp__)[a-z][a-z_]*$/`), preserving the original intent.
- Planning reconnaissance had 13 stale seam line numbers (files had grown); all were re-verified
  against HEAD before execution.
- Step 0(d) (by-name reachability) and the R1/R3 drifts were recorded, not re-litigated.
- Known residual (independent Step 5 audit): `resolveStartHost` can route
  cursor/opencode/codex fanout installs to the Antigravity lane (MEDIUM-001), and a terminal
  `return 'cline'` exists for no-signal lockfiles (MEDIUM-002, errs rather than launches).
  Owner deferred both fixes.

## References

- Evidence: owner Windows field test 2026-09-28 (project thread); repo audit 2026-09-28.
- Binding: ADR 0009 (Antigravity conformance, `agy`), ADR 0011 (`agy mcp`), ADR 0013 (Cline
  configured agents), ADR 0018 (Claude projection), ADR 0021 (Declared-Delta Registry),
  ADR 0023 / Plan 026 (host primitive matrix).
- Sibling: Plan 030 (licence-aware skill intake) runs independently.
