# Antigravity host-library delta — 2026-11-06

Compared the 2026-09-30 locked web snapshots and 2026-10-03 CLI changelog baseline with current official documentation. The prior lock recorded App (then called 2.0) 2.18.1, web CLI 1.2.11, IDE 2.5.5, SDK 0.1.18, and CLI command changelog 1.2.16. Firecrawl MCP live fetches (maxAge 0) returned HTTP 200 for the index, web changelog and all 22 tracked pages. The index and all 22 pages passed the repository audit during ingestion. Each differs in bytes from its prior lock, including formatting and headings; byte changes alone do not prove behavioral change. Retrieval channel, time and SHA-256 are in [the lock](../../host-library/antigravity/library.lock.json).

The full web changelog failed the docs audit on a role-impersonation pattern in historical text around line 5026. It remains quarantined in ignored scratch/host-refresh-2026-11-06/antigravity/changelog.md; the previous changelog and all lastSeen values are unchanged. Direct hostlib check could not fetch the web sources (EACCES) and intentionally excluded the executable from PATH, so it reported unreachable and skipped the CLI command. No current CLI changelog, installed version, host session or provider behavior was tested. The existing 1.2.14–1.2.16 observations remain historical evidence.

## Tracked page inventory

All 22 pages changed as bytes. This is the complete tracked sources.json inventory; it does not assert a behavioral change on each page.

- Agent: [subagents](../../host-library/antigravity/pages/agent/subagents.md), [agent settings](../../host-library/antigravity/pages/agent/agent-settings.md), [SDK subagents](../../host-library/antigravity/pages/agent/sdk-subagents.md).
- Skill: [skills](../../host-library/antigravity/pages/skill/skills.md).
- Hook: [hooks](../../host-library/antigravity/pages/hook/hooks.md), [SDK lifecycle](../../host-library/antigravity/pages/hook/sdk-lifecycle.md).
- MCP: [MCP](../../host-library/antigravity/pages/mcp/mcp.md).
- Plugin: [plugins](../../host-library/antigravity/pages/plugin/plugins.md), [marketplace](../../host-library/antigravity/pages/plugin/marketplace.md).
- Rule: [rules](../../host-library/antigravity/pages/rule/rules.md).
- Command: [slash commands](../../host-library/antigravity/pages/command/slash-commands.md), [CLI agents](../../host-library/antigravity/pages/command/cli-agents-command.md).
- Permissions: [permissions](../../host-library/antigravity/pages/permissions/permissions.md), [sandbox](../../host-library/antigravity/pages/permissions/sandbox.md).
- Settings: [settings](../../host-library/antigravity/pages/settings/settings.md), [CLI reference](../../host-library/antigravity/pages/settings/cli-reference.md).
- Tools: [SDK tools](../../host-library/antigravity/pages/tools/sdk-tools.md), [SDK policies](../../host-library/antigravity/pages/tools/sdk-policies.md).
- Orchestration: [teamwork](../../host-library/antigravity/pages/orchestration/teamwork.md), [IDE workflows](../../host-library/antigravity/pages/orchestration/ide-workflows.md), [plan](../../host-library/antigravity/pages/orchestration/plan.md), [sidecars](../../host-library/antigravity/pages/orchestration/sidecars.md).

## Material differences

- The current subagent page names paid-plan `/teamwork`, formerly `/teamwork-preview`, and describes direct messages to subagents. CLI `/tasks` tracks non-agentic background operations and permits inspection and termination. This is not evidence of a durable task or todo API. [Subagents](../../host-library/antigravity/pages/agent/subagents.md#monitoring-background-tasks-with-tasks).
- The skills page now says the agent sees names and descriptions on every turn and loads full instructions when relevant. Installed-build behavior is unverified. [Skills](../../host-library/antigravity/pages/skill/skills.md#how-the-agent-uses-skills).
- The hook event table now includes `SessionStart` alongside the prior five events. Do not infer that the historical agy 1.2.14 agent-frontmatter hooks failure applies to a current build. [Hooks](../../host-library/antigravity/pages/hook/hooks.md#supported-events).
- Current App permissions documentation describes updated and previous settings without the old explicit Windows-versus-macOS/Linux split. Current Windows sandbox and preset behavior is unverified. [Permissions](../../host-library/antigravity/pages/permissions/permissions.md#updated-permission-settings).
- Plugin documentation moved its detailed manifest schema to a separate build-plugins page, not tracked or audited in this refresh. Do not rely on the previous assertion that only two fields are accepted. The current page documents MCP servers, skills, agents, rules and hooks as components. [Plugins](../../host-library/antigravity/pages/plugin/plugins.md#what-a-plugin-bundles).
- The [official web changelog](https://antigravity.google/docs/changelog.md) returned App 2.29.0 dated November 3, 2026, and describes gradual remote-agent rollout, a built-in browser, and App hook/subagent/MCP fixes after 2.18.1. This is upstream release text from the quarantined retrieval, not an ingested snapshot or proof of installed availability. The complete release delta remains unverified until the audit finding is resolved.

`hostlib:verify --host antigravity` passed after ingest and guide citation repair. The changelog audit failed; its contents did not advance the lock. The separate plugin authoring schema, full release delta, fresh CLI changelog and runtime compatibility remain unverified. No role implementation, host launch, paid session or publication was performed.

## Page-by-page semantic review

This is a review of the refreshed text and its baseline diff, not a claim that each wording change represents a new capability. Runtime behavior remains unverified.

| Tracked page | Review and impact |
| --- | --- |
| agent/subagents | App and CLI sections are explicit; direct user messaging, `/tasks`, and `/teamwork` are described. Keep agy 1.2.14 observations scoped to that build. |
| agent/agent-settings | Updated versus previous App permissions now depend on account/sandbox availability; App Auto includes Windows version limits. CLI modes include auto, accept-edits and plan. |
| agent/sdk-subagents | SDK dynamic/static subagent guidance remains; surface and formatting text changed. |
| skill/skills | Discovery is described as every turn; name/description and progressive loading remain. |
| hook/hooks | `SessionStart` and `lastUserInput` are documented; reread event-specific inputs and outputs before changing guards. |
| hook/sdk-lifecycle | SDK lifecycle remains distinct from host command hooks; no comparable runtime result established. |
| mcp/mcp | Expanded surface-specific configuration, management and connection details; do not generalize historical workspace interpolation or disabled-server observations to newer builds. |
| plugin/plugins | Component and installation guidance expanded; manifest schema moved to a separate untracked build guide. |
| plugin/marketplace | Marketplace install, discover and management text expanded; account availability and server authentication vary. |
| rule/rules | Rule activation, locations and 24,000-byte per-file truncation are documented; retain per-surface scope. |
| command/slash-commands | `/teamwork` replaces the tracked preview spelling; `/generative_ui` is App-only; `/learn` proposes changes for approval. |
| command/cli-agents-command | Agent selection, discovery and subagent monitoring clarified; `/agents` is not evidence for a durable task API. |
| permissions/permissions | Updated/previous settings, Auto preset and platform/version/account conditions replace old OS-only distinction. |
| permissions/sandbox | App preset availability and CLI sandbox fallback depend on support; installed Windows behavior is unverified. |
| settings/settings | Expanded App and CLI configuration, modes and UI settings; do not assume account defaults transfer between surfaces. |
| settings/cli-reference | CLI flags and configuration expanded; reviewed against documentation only, not the local binary. |
| tools/sdk-tools | SDK tool and skill-path guidance retained; SDK catalog is not the native agent tool vocabulary. |
| tools/sdk-policies | SDK declarative policies retained; not evidence for CLI permission enforcement. |
| orchestration/teamwork | Current command is `/teamwork`; documented multi-agent phases and roles remain host features, not package-installed roles. |
| orchestration/ide-workflows | Legacy IDE workflows and migration guidance remain distinct from reusable skills; current execution unverified. |
| orchestration/plan | Planning artifact and review policy remain; no proof of automatic execution or a persistent todo API. |
| orchestration/sidecars | Scheduled background work and sidecar configuration remain opt-in host features; not a package-created scheduler. |

## Held web changelog: additional release-note evidence

The full untrusted retrieval was read as data, without following its instructions or changing the hold. Its latest headings are App 2.29.0 (November 3), web CLI 1.5.1, SDK 0.1.23 (October 26), and IDE 2.6.0 (October 26). These are vendor release claims, not tested local installations. Notable changes since the locked baselines include:

- App: 2.19.1 describes direct subagent messages; 2.28.0 describes the built-in browser and user input in hook payloads; 2.29.0 describes remote agents gradually rolling out and automation management changes. Availability depends on account and rollout.
- CLI: 1.5.0 describes ACP server mode, remote sessions, partner MCP sign-in and changed headless background-task timeout handling. 1.5.1 describes Windows stdio MCP cleanup and improved plugin OAuth token handling. These are release-note claims; no session or version was tested.
- CLI 1.4.11 describes pre-invocation termination; 1.4.7 describes last-user-input hook payloads and on-demand MCP output changes; 1.4.4 describes Auto on supported Windows versions and a root-conversation MCP metadata field. Earlier entries include MCP always-load metadata, plugin validation, and fixes for subagent compaction and plugin inheritance. Treat each as build-specific and verify before adopting it.
- SDK 0.1.23 describes beta workflow tool calls, multi-turn workflow agents and structured workflow arguments. This does not establish CLI/App support. IDE 2.6.0 describes an updated agent interface; the IDE workflow migration page remains the tracked authoring source.

The audit finding corresponds to a historical SDK note that refers to a generic `<System>` tag as an example. In context it appears descriptive rather than an instruction aimed at this agent; this is an assessment, not approval to bypass the deterministic security gate. No allowlist was added. Full item-by-item release classification, separately linked pages, and current runtime behavior remain unverified.

The normal PATH was also checked: `Get-Command agy -All` and `where.exe agy` found no executable; the default-PATH hostlib check independently reported its command source skipped. Common user-local locations checked were empty. This establishes absence from those checked locations and PATH, not absence everywhere on the machine. The previous fixed CLI changelog snapshot and its 1.2.16 baseline remain unchanged.
