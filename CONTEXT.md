# Agents United

The universal package manager for AI agents. Curated teams of orchestrators, sub-agents, skills, and workflows — installed once, projected across Google Antigravity, Claude Code, Cursor, Cline, OpenCode, and Codex / AGENTS.md.

## Language & Ubiquitous Domain Dictionary

### Core Primitives

**Orchestrator Agent**:
A primary agent (`orchestrator-<bundle>.md` or `orchestrator-<task>.md`) with `mainAgent: true` and `subagent: true` configured to coordinate high-level tasks, formulate implementation plans, delegate to specialized sub-agents, and execute multi-step workflows with phase gates.
_Avoid_: Master agent, boss, coordinator bot

**Sub-Agent**:
A task-specialized worker agent (`subagent-<role>.md`) with `subagent: true` equipped with domain-specific tools, scoped safety policies, and declarative lifecycle hooks.
_Avoid_: Child agent, slave agent, helper script

**Skill**:
A modular capability folder containing a `SKILL.md` file with progressive disclosure frontmatter (`name`, `description`, `metadata: { author, version, source, license }`), execution runbooks, code exemplars, and error recovery procedures.
_Avoid_: Action, toolset, capability-pack

**Maintainer-only Skill Folder**:
A folder directly under a skill that belongs to the maintainers and is never installed: `evals/`, the prompts a skill is tried with (Plan 035). No install lane copies it (the Claude projector, the Cline plugin copy, the canonical store's copy) and the lockfile never records it. A link shows the whole registry folder, so Symlink Mode still exposes it; `references/evals/` is an ordinary folder and ships. Defined once, in `src/core/skill-folder.ts`.
_Avoid_: Assuming every subfolder of a skill reaches the user's project

**Workflow Skill** (formerly Workflow):
A multi-step procedural runbook or interactive orchestration skill (`skills/workflow-<task>/SKILL.md`) defining deterministic phase transitions, Mermaid execution flowcharts, verification gates, human review checkpoints, and automated rollback protocols. Conforms to the open Agent Skills standard (`agentskills.io`) while retaining `/workflow-<task>` slash command projection across host environments (ADR 0016).
_Avoid_: Standalone legacy workflow markdown file, pipeline script, recipe

**Rule**:
A persistent guideline or constraint file (`GEMINI.md`, `AGENTS.md`, `CLAUDE.md`, `CURSOR.md`, or `registry/rules/*.md`) injected hierarchically into agent contexts (e.g. Git Guardrails, TDD Protocol, Skill Attribution Standard, Multi-Agent Coordination).
_Avoid_: System prompt snippet, instruction file

**Department Domain**:
A high-level business or engineering discipline grouping multiple related team bundles (e.g. `Software Engineering & Delivery`, `System Architecture & SRE`, `Product Design & UI/UX`, `Growth & Marketing Operations`, `Security Operations`, `Deep Technical Research`, `Business Strategy & Economics`, `Universal Autonomous Department`).
_Avoid_: Category folder, tag group

**Bundle**:
A curated, named package grouping an orchestrator agent, sub-agents, skills, workflows, and rules tailored for a specific team or domain discipline.
_Avoid_: Plugin pack, preset, collection

**Domain Bundle (Tier 1)**:
A single-discipline team package scoped to one expertise domain (e.g. `software-engineering`, `product-design`, `growth-marketing`). Domain bundles are self-contained prompt/workflow units with minimal external runtime prerequisites, lean token footprints, and can be recommended autonomously by Lead Orchestrators.
_Avoid_: Simple pack, basic bundle

**Organization Bundle (Tier 2)**:
A cross-functional composite team modeled after real-world professional organizations (e.g. `digital-agency`, `venture-studio`). Unlike domain bundles, organization bundles orchestrate cross-discipline agents and integrate **Model Context Protocol (MCP) server tool calling**, external packages, and API keys. Because they require runtime prerequisites, they are not recommended autonomously by global orchestrators and require explicit user opt-in. Led by dedicated Tier-2 organization orchestrators such as `orchestrator-digital-agency.md` (Campaign Director / Chris).
_Avoid_: Mega bundle, company bot

**Prerequisite Gate & Informative Visibility**:
An informative verification mechanism evaluated by the CLI (`PrerequisiteChecker`) and Lead Orchestrators when installing or activating Organization Bundles. It inspects host MCP configurations across Cursor, Cline (CLI & Extension), Antigravity/Gemini (App & CLI), Claude Code, OpenCode, and Windsurf via `McpLocationRegistry`, alongside npm packages and environment variables. In the CLI installer, it displays an informative evaluation status without blocking installation. In conversational sessions, the Lead Orchestrator adapts dynamically to available tools and guides live MCP setup conversationally via the `mcp-setup` skill.
_Avoid_: Rigid blocking installer, dependency blocker

**In-Session Agentic MCP Onboarding**:
The conversational onboarding protocol executed by Lead Orchestrators at session initialization. The orchestrator performs a tool inventory check, transparently presents its operational envelope (Limited Operational / Native Fallback Mode ready immediately), and offers to configure, test, and activate live MCP integrations (e.g. Playwright browser automation, Figma design token extraction, Firecrawl web crawling) on demand using OS-specific diagnostics.
_Avoid_: Static CLI injection, manual JSON troubleshooting

**Multi-Host MCP Evaluation & Partial Detection**:
The multi-signal capability of the `PrerequisiteChecker` that evaluates prerequisite presence across all target hosts selected in the installation session. When an MCP is detected in some targets (e.g. Antigravity) but missing in others (e.g. Cline CLI), it is marked as `~ Partial` with an explicit platform breakdown (`Detected in Antigravity; Missing in Cline CLI`), guiding targeted differential injection.
_Avoid_: Binary present/missing check, single-file assumption

**McpLocationRegistry**:
A declarative, maintainable registry in `src/core/mcp-locations.ts` maintaining cross-platform resolvers for all known MCP JSON configuration locations (Antigravity global/system, Cline CLI data settings, Cline/Roo Code VS Code extensions, Cursor workspace/global, Claude Code workspace/global, Claude Desktop, Windsurf, OpenCode, and Zed).
_Avoid_: Hardcoded paths, single-host settings

**Organization Bundle Execution Tiers & Graceful MCP Degradation**:
The operational envelopes supported by all Organization Bundles (`digital-agency` and future cross-functional enterprise bundles):
- **1. Fully Operational Mode (Authenticated MCP)**: All required MCP servers (for `digital-agency`, the six required integrations of the Canonical Agency MCP Suite), CLI binaries, and bearer tokens/API keys (e.g. `FIRECRAWL_API_KEY`, GitHub PAT, Figma Access Token) are verified and active, unlocking full-scale web crawling, automated PR merges, live design token extraction, and cloud analytics.
- **2. Limited Operational Mode (Unauthenticated / Community MCP)**: MCP servers run in free, local, or unauthenticated mode without API keys (e.g. Context7 public library queries, unauthenticated GitHub rate-limited public inspection, local Playwright headless browser testing, local MarkItDown document conversion, and local Chrome DevTools inspection). The team executes automated workflows within provider public rate limits.
- **3. Brainstorming Mode (Native Fallback)**: A zero-MCP fallback envelope activated when the user declines to install or configure MCP servers, or operates in offline/isolated environments. The Lead Orchestrator explicitly notifies the user of the reduced capability envelope, and all agents switch to native workspace tools (`run_command` with git/curl, `write_to_file`, `grep_search`, and local simulation templates).
- **Dynamic Mode Switching**: Lead Orchestrators allow users to seamlessly switch between operational modes mid-session (e.g., `/mode operational` or `/mode brainstorming`) and provide guided prompts to add missing tokens without restarting the conversation.
_Avoid_: Rigid binary mode, silent error failing, unnotified degradation

**Continuous Evaluation Harness (Stream-JSON Evals)**:
An automated benchmarking and regression testing pipeline executing agent interactions in headless streaming JSON mode (`--input-format stream-json --output-format stream-json --json-schema`). It reconstructs fragmented NDJSON streams, traces multi-hop DAG message graphs (`send_message` with `/handoff` and `/design-handoff-spec`), and asserts runtime compliance across Tri-Tier execution boundaries.
_Avoid_: Static prompt test, mock scraper

**Two-Stage Hybrid Evaluator (LLM Judge & Gatekeeper)**:
A dual-phase evaluation architecture combining a 0ms deterministic gatekeeper (verifying tool invocation syntax, recipient validity, character thresholds, and `/handoff` directives) with a schema-constrained semantic LLM evaluator enforcing structured Zod rubrics and returning strictly typed `EvaluationVerdict` objects.
_Avoid_: Unstructured LLM grader, regex-only validator

**Bundle Lifecycle State**:
The formal release maturity status of a bundle:
- **`stable`**: Production-ready, fully verified and tested.
- **`experimental`**: Functional with MCP/runtime tools, but interfaces and runbooks may evolve.
- **`under-construction`**: Placeholder or in-development design phase. Blocked from accidental install by the Under-Construction Gate.
- **`needs-audit`**: Fully operational, but flagged for composition drift review in Milestone 1.
- **`deprecated`**: Maintained for backwards compatibility only.
_Avoid_: Dev/prod tag, informal draft

**Under-Construction Gate**:
A protective safety barrier evaluated by `agents add` preventing the accidental installation of placeholder or in-development bundles. In interactive mode, it displays planned capabilities and offers a cancel/preview prompt; in non-interactive mode, it exits with error code `1` unless overridden via `--allow-under-construction` or `--force`.
_Avoid_: Broken installer, silent failure

**Essentials Bundle**:
The base foundational bundle of a department domain (e.g. `software-engineering`, `system-architecture`, `growth-marketing`, `product-design`, `security-operations`, `deep-research`, `business-strategy`) providing core orchestrators, fundamental skills, and master workflows.
_Avoid_: Base pack, core bundle

**Universal Meta-Skills Bundle (`universal-skills`)**:
A domain-agnostic baseline bundle containing shared, universal meta-skills (`grill-me`, `grill-with-docs`, `domain-modeling`, `to-spec`, `to-tickets`, `handoff`). It has no orchestrator or dedicated agents — it serves as a lightweight capability layer installable locally into projects or globally across machine environments (`agents add universal-skills -g`).
_Avoid_: Global bot pack, miscellaneous tools

**Prime Orchestrator**:
A tier of orchestrator *above* the Lead Orchestrators. A Prime Orchestrator does not execute a single department's work; it has a compact Domain Atlas, triages ambiguous requests, routes across Department Domains, and hands off to the correct department's Lead Orchestrator as the **main agent of a fresh session**. Sole instance: `orchestrator-universal.md` in the `universal-orchestration` bundle.
_Avoid_: Meta-orchestrator, all-seeing agent, super-boss

**Domain Atlas**:
The generated, compact **Department Domain → Essentials Bundle** routing map embedded in the Prime Orchestrator (`orchestrator-universal.md`). Contract-tested against the Registry Manifest (`bundles.json`); never fetched remotely. When the Atlas is stale, the Prime Orchestrator consults the installed registry via `agents find <task> --json` / `agents list --json` and reports drift. Organizational Bundles are excluded from the Atlas by construction.
_Avoid_: Routing codex, capability table, registry mirror

**Universal Orchestration Bundle (`universal-orchestration`)**:
An optional guided-routing bundle in the Universal Autonomous Department containing the Prime Orchestrator (`orchestrator-universal.md`) plus the `handoff` and `grill-me` skills. It does not install or execute work itself — it triages, routes to the correct department Essentials bundle (with explicit consent), and hands off. Distinct from `universal-skills` (skills-only baseline) and `full` (aggregate suite). Aliases: `orchestration`, `router`.
_Avoid_: Universal agent pack, super skills, router-only bot

**Route & Instruct Contract**:
The guaranteed cross-host activation contract enforced by the Prime Orchestrator: **triage → consented Essentials-bundle install → `/handoff` note → presentation of the exact `agents start <bundle> "<task>"` command** so the department Lead Orchestrator activates as the main agent of a fresh session. In-session persona-swap and sub-agent masking are prohibited.
_Avoid_: Auto-launch promise, in-session takeover, silent reroute

**Inherited Sub-Team Bundle**:
A specialized sub-team bundle that extends an Essentials bundle via `parentBundle` inheritance (e.g. `ai-ml-engineering`, `mobile-development`, `frontend-engineering`, `backend-distributed-systems`, `qa-automation`, `devops-engineering`, `sysops-sre`, `design-systems-ops`, `design-research-testing`, `seo-content-marketing`, `performance-paid-acquisition`, `product-led-growth`, `lifecycle-email-marketing`), inheriting base capabilities without duplicating asset definitions.
_Avoid_: Child bundle, sub-plugin

**Dual-Bridge Operational Model**:
The architectural separation of delivery and reliability operations:
- **DevOps (`devops-engineering`)**: Sits under `Software Engineering` as the *Delivery Bridge* for developer velocity, CI/CD pipelines, containerization, and preview deployments.
- **SysOps & SRE (`sysops-sre`)**: Sits under `System Architecture` as the *Reliability Bridge* for 99.999% uptime, Prometheus/Grafana telemetry, incident response, and disaster recovery.

**Cross-Bundle Dynamic Recommendation Protocol**:
A real-time routing protocol embedded in all 7 Lead Orchestrators. When a user requests a task requiring deep sub-domain capabilities (e.g. native mobile compilation, serverless GPU cluster, programmatic SEO, microservices event streaming), the orchestrator identifies the requirement, explains the capability, and presents the exact installation command (`agents add <sub-bundle>` or `agents add domain:<department>`).

**Essentials-First Install Model**:
The architectural principle that every department domain installs as a lean **Essentials bundle** by default — containing only the Lead Orchestrator, core sub-agents, and foundational skills needed for the majority of everyday tasks. Addon sub-bundles are not installed unless explicitly requested or automatically triggered by the orchestrator's gap detection logic. This keeps project workspace context footprints minimal and agent token loads low.
_Avoid_: Full-stack install, monolithic team, always-on agents

**On-Demand Addon Auto-Install**:
The behavior where a Lead Orchestrator, upon detecting that a requested task requires capabilities beyond the currently installed Essentials bundle, proactively names the required addon bundle and — in CLI-enabled environments — executes `agents add <sub-bundle>` automatically, scoped to the same project or global installation as the parent Essentials bundle. The orchestrator confirms the action and continues execution without requiring manual user intervention.
_Avoid_: Manual plugin install, deferred setup, external configuration

**Domain-Level Installation (`domain:<name>`)**:
A batch installation resolution mechanism allowing users to install an entire department domain (e.g. `domain:engineering`, `domain:marketing`, `domain:architecture`) in a single command, recursively aggregating all agents, skills, and workflows across every sub-team under that domain with confirmation safeguards.

**Scoped AI Safety Policy**:
An agent-level security configuration header and interceptor framework that enforces zero-trust boundaries:
- **Secret Redaction / Zero Secret Exposure**: Prevents unencrypted API keys (`OPENAI_API_KEY`, `MODAL_TOKEN_ID`, `REPLICATE_API_TOKEN`, `RUNPOD_API_KEY`) from appearing in logs, terminal commands, or git commits.
- **GPU Cost Ceilings**: Enforces scale-to-zero timeouts (60–300s) and concurrency limits on serverless GPU infrastructure.
- **Training Data Privacy & PII Scrubbing**: Mandates automated pre-processing to mask PII prior to vector database indexing or model fine-tuning.

**AI Prototype Refactoring**:
The systematic process of converting rapid AI-generated single-file prototypes (from Lovable.dev, v0.dev, Bolt.new) into enterprise-grade modular React components, typed design tokens, custom hooks, semantic HTML, and WCAG AA accessibility standards.

**Distributed Edge Database & Embedded Replicas**:
An edge-first persistence pattern (e.g. Turso / LibSQL) combining microsecond read latencies from local in-process SQLite embedded replicas with automated background WAL synchronization to global primary databases and ephemeral PR database branching.

**Subagent-First Delegation Policy**:
The mandatory delegation posture of a Lead Orchestrator in a planning-loop bundle: specialist tasks are executed by the bundle's spawnable `subagent_*` agents, and the coordinator completes specialist work in the main session **only if** the subagent tools are genuinely absent from the runtime or the task is trivial (single-file read, one-line answer, formatting). Never as a convenience, speed choice, or fallback of habit.
_Avoid_: Solo orchestrator, convenience self-execution, lazy fallback

**Planning Dialogue Loop**:
The closed orchestration cycle of a planning-loop bundle, executed before any substantive work. In **subagent-first mode** it runs four phases: **Phase 0 — User Alignment** (Socratic grilling via `/grill-me` for strategy or `/grill-with-docs` for code/docs), **Phase 0.5 — Sidekick Clarification** (spawn ≤ `sidekicks.max` relevant specialists into the planning conversation to resolve remaining ambiguity; they advise the orchestrator, who relays to the user), **Phase 1 — Specialist Council** (every relevant specialist returns a bounded Scope-of-Work Statement), **Phase 2 — Delegation Map** (task→specialist map synthesized and presented to the user before execution). In **planner-orchestrator mode** only Phase 0 and Phase 2 run — both performed solo by the orchestrator.
_Avoid_: Ad-hoc planning, post-plan delegation, silent task splitting

**Planning Sidekick**:
A specialist subagent spawned by the Lead Orchestrator **during the planning conversation itself** (Phase 0.5) to clarify an ambiguous user brief. Sidekicks advise the orchestrator with targeted clarifying input; the orchestrator relays their questions to the user. At most `sidekicks.max` sidekicks may be active per planning cycle.
_Avoid_: Silent shadow agent, full-time co-pilot, second orchestrator

**Specialist Council**:
The planning round (Phase 1 of the Planning Dialogue Loop) in which every relevant specialist of a planning-loop bundle returns a **Scope-of-Work Statement** — a bounded declaration of (1) its scope, (2) inputs needed from peers, (3) its deliverable per its own workflows, and (4) at most two open questions — so the orchestrator synthesizes the delegation map from expert inputs rather than a solo guess.
_Avoid_: Team meeting theater, unstructured brainstorm dump, voting body

**Scope-of-Work Statement**:
The capped, structured contribution a specialist makes to a Specialist Council round: scope, peer dependencies, deliverable definition, and open questions — limited to `summaryWordCap` words. It is a planning artifact, not a deliverable; execution still follows the specialist's own workflows.
_Avoid_: Mini-PRD, full implementation plan, uncapped essay

**Consultation Budget**:
The declarative cap set that bounds all inter-agent planning dialogue in a planning-loop bundle, declared once in `registry/bundles.json` (`planningLoop.budget`) and rendered into the coordinator rule, Team Manifest, and subagent prompts: `maxPlanningRounds` (orchestrator↔council cycles per task), `maxPeerExchangesPerPair` (directed questions per specialist pair), `summaryWordCap` (per Scope-of-Work Statement), and `maxIterations` (the host-enforced per-invocation hard cap rendered into Cline configured-agent `.yml`; inert on hosts that ignore it — documented, not faked).
_Avoid_: Token counter, open-ended discussion, silent infinite chatter

**Planner-Orchestrator Mode**:
The Tier-1 Domain Bundle delegation posture (ADR 0015): the Lead Orchestrator plans solo with the user — Socratic alignment plus direct consultation of the bundle's shared skills — and composes the delegation map alone, without spawning Planning Sidekicks or convening a Specialist Council; execution deliverables are then delegated to the bundle's `subagent_*` agents. Planning is solo; execution is not.
_Avoid_: Solo execution, one-agent team, subagent-first planning

**Planning Aid Boundary**:
The estimate-versus-deliverable line governing an orchestrator's skill use while planning (ADR 0015): consulting skills and reasoning to give provisional answers and estimates is planning aid and stays in the main session; producing a concrete deliverable — data analysis, code, assets, documents — is specialist work, deferred to the delegation map for subagent execution.
_Avoid_: Planning-time self-execution, anything-goes skill use, provisional deliverables

**Agency Assembly Line (Deterministic Execution DAG)**:
The 4-tier deterministic execution pipeline governing `digital-agency` campaign fulfillment:
- **Tier 1 (Strategy & Unit Economics)**: Ava + Chris
- **Tier 2 (Creative, Copy & Content Engine)**: Kaan + Jamileh + Yavuz
- **Tier 3 (Production, Code & Distribution)**: Frontend Architect + SEO Specialist + Jale
- **Tier 4 (Verification, Quality & Compliance)**: QA Automation Lead + Compliance GRC Specialist
Enforces strict data cross-pollination contracts (`design-tokens.json` to Tailwind, typed section props to React, `data-testid` & `dataLayer` to Playwright, email/ad assets to FTC/CAN-SPAM/CMP gating).
_Avoid_: Random agent dispatch, circular handoffs, untracked asset passing

**Canonical Agency MCP Suite**:
The 8 canonical Model Context Protocol tool servers declared in `registry/bundles.json` for the `digital-agency` bundle: `github` (PR management), `firecrawl` (web research & competitive crawling), `context7` (framework documentation), `playwright` (headless browser & CRO funnel testing), `markitdown` (pitch deck & document conversion), `chrome-devtools-mcp` (Core Web Vitals & live DOM profiling), `stitch` (AI UI generation & token construction), and `figma` (design system extraction). Six are **required** for the lead's Fully Operational mode (`github`, `firecrawl`, `context7`, `playwright`, `chrome-devtools-mcp`, `figma`); `markitdown` and `stitch` are **optional extras**, which the lead names as connected when it can call them and never counts or reports as missing. In the bundle's `requiredMcps` they carry `optional: true`, so the doctor and the install gate leave them out.
_Avoid_: Arbitrary tool injection, undocumented MCP dependencies

**MCP Route**:
How an integration of the Canonical Agency MCP Suite reaches a Claude Code session: manual (`claude mcp add --scope project`, pinned commands, the tool names the roles have always carried), plugin (`claude plugin install <name>@claude-plugins-official --scope project`, then the user's `/reload-plugins --force`, no restart) or connector (a claude.ai directory page that only the user can authorise). The routes give the same service under different tool names (`mcp__<name>__`, `mcp__plugin_<plugin>_<server>__`, `mcp__claude_ai_<Name>__`), a role's allowlist names servers, and `src/core/claude-mcp-routes.ts` is where the other forms are named. The lead recommends manual, offers plugin in the same install question, and prints a connector as a link.
_Avoid_: Calling a plugin a connector, assuming a plugin carries an MCP server (the firecrawl plugin ships skills only)

**Mode-Line Gate**:
The `PreToolUse` hook of the digital-agency lead (`registry/hosts/claude/hooks/agents-united-mode-line-gate.js`, guard kind `mode-line`) that holds lead calls other than `ToolSearch` until a saved assistant text block opens with `Mode: <Fully|Limited> Operational.` (ADR 0044). It ignores calls carrying `agent_id` and fails open on unreadable evidence or unusable state. The transcript may lag the current response, so a retry can be held again; elapsed time never releases it. A version-2 marker records that a line was seen; a marker from the older timed gate is rechecked. The message calls the hold expected, and a duplicate line remains accepted (ADR 0043). Presence of a mode prefix is checked, not the accuracy of the integration report. Live behaviour after this R2 fix is unverified.
_Avoid_: Treating a timer as proof that the line was written, assuming every hold is one-time, treating the gate as a role tool-permission guard

**Multimodal Asset Inlining (`@path/to/file`)**:
The unified cross-host asset intake standard supported across Google Antigravity (2.11.0+) and Cline (4.1.x), allowing agents to ingest local PDF pitch decks (`@deck.pdf` via `StartPage`/`EndPage`), spreadsheets (`@metrics.csv`), and high-resolution UI screenshots (`@screenshot.png`) directly into prompt context without context bloat.
_Avoid_: External OCR scripts, blind asset generation

**Advertising Policy & Consent Guardrails**:
The mandatory regulatory compliance checks enforced by `orchestrator-digital-agency` and `subagent-compliance-grc-specialist`: FTC 16 CFR § 255 conspicuous disclosures (`#ad`, `#sponsored`, `rel="sponsored"`), GDPR/ePrivacy Cookie Consent Management Platform (CMP) gating before marketing tracking pixels fire, and CAN-SPAM/CASL single-click automated unsubscribe headers and physical postal addresses.
_Avoid_: Deceptive dark patterns, ungated tracking pixels, spam email sequences

**Cross-Platform Capability Projection (Antigravity ↔ Cline)**:
The deterministic translation architecture implemented by `ClineProjector` (ADR 0013) that bridges Google Antigravity native capabilities into Cline:
- Strips unsupported Antigravity frontmatter keys (`rules`, `inheritCustomizations`, `effort`, `hooks`) while preserving execution semantics.
- Projects frontmatter `rules:` into `.cline/rules/` and active coordinator markdown rules (`.agents/plugins/<bundle>/rules/`).
- Maps Antigravity tool primitives (`view_file`, `replace_file_content`, `run_command`, `grep_search`, `list_dir`) to Cline equivalents (`read_file`, `replace_in_file`, `execute_command`, `search_files`, `list_files`) via injected runtime translation notes.
- Projects subagents into configured `.cline/agents/*.yml` with the Consultation Budget's `maxIterations` cap (Tier-2 organization bundles) and exposes them as callable `subagent_*` tools.
- Leverages cross-host standards for multimodal inlining (`@path/to/file`) and KaTeX math formatting.
_Avoid_: Leaking Antigravity-specific YAML keys into Cline, assuming identical tool call signatures across hosts

**Claude Code Projection**:
The compound, machine-managed projection of the canonical store into Anthropic Claude Code's discovery paths: `.claude/agents/<role>.md` (roles, `subagent-` prefix stripped), `.claude/skills/<name>/SKILL.md` (skills), and `.claude/rules/<rule>.md` (a lean, path-scoped subset). Every artifact is refcounted in `lockfile.projections` with `host: "claude"` and stamped with the managed marker. Rendered by `ClaudeProjector` (ADR 0018); never symlinked, never hand-edited.
_Avoid_: The stateless generic fanout lane, Antigravity-dialect copies left in `.claude/`

**Claude Skills Lane**:
The `.claude/skills/<name>/SKILL.md` surface through which canonical skills (including `workflow-*` skills) become native Claude slash commands. Frontmatter is translated to Claude semantics — crucially `disable-slash-command: true` becomes **`user-invocable: false`** (hidden from the `/` palette, still model-invocable) and **never** `disable-model-invocation`, whose polarity is inverted. Non-standard fields are stripped, auxiliary files copy byte-for-byte, and only installed-bundle skills project (listings cap each skill at 1,536 description characters).
_Avoid_: Treating `disable-model-invocation` as the inverse of `disable-slash-command`, projecting all 190 skills regardless of installed bundles

**Claude Lean Rules Lane**:
The `.claude/rules/<rule>.md` projection of the deduplicated, agent-referenced rule set only — each file capped at ~200 lines, with `paths:` frontmatter where a rule is file-type-scoped. Host entrypoint rules are skipped, and bundle coordination policy lives in the orchestrator agent body rather than in an always-on rule, because Claude loads unscoped rules unconditionally in every session.
_Avoid_: Porting the whole `registry/rules/` tree, always-on coordinator rules that hijack unrelated sessions

**Claude Plugin Lane (distribution-only)**:
The opt-in `.claude-plugin/plugin.json` plus `agents/` package emitted inside `.agents/plugins/<bundle>/` so the same folder can be consumed via `claude --plugin-dir` for distribution and portability. It is never the behavioural source: Claude has no project-local plugin auto-discovery, plugin agents are namespaced (`plugin:agent`), and plugin `permissionMode` is ignored.
_Avoid_: Treating the plugin lane as an activation path, assuming plugin agents shadow `.claude/agents/`

**Native Lane**:
The opt-in install lane (`agents add --native`, Plan 032 Phase 7) that installs a committed native agent from `registry/hosts/claude/agents/<role>.md` verbatim behind a managed marker (`profile: claude-native`, with the source hash), instead of projecting the canonical asset. Roles without a native agent keep the legacy projection. It also installs a committed host workflow (`registry/hosts/claude/workflows/<name>.js`) into `.claude/workflows/` and, because both own the slash command `/<name>`, installs it **instead of** the skill of the same name. The roles carry their guard as a script file, not as `node -e <script>` (which Claude prints in full in every block message): `.claude/hooks/agents-united-guard.js` and `agents-united-readonly-guard.js` are tracked projections of `registry/hosts/claude/hooks/` (owned by the bundle that installs a role naming them, refcounted), the role names the file as `${CLAUDE_PROJECT_DIR}/.claude/hooks/<name>.js`, and doctor warns when a script is gone because the host then lets the call through; a **global** install keeps the inline guard, since a user-level role has no portable way to name a script (ADR 0035). Recorded as `nativeLane` in the lockfile and sticky across `agents update`; doctor's freshness check compares against the same native render. For Cline (Plan 032 Phase 8, ADR 0029) the one flag installs `registry/hosts/cline/` instead: the four configured agents (`.cline/agents/<role>.yml`), the orchestrator's rule and skill (which stand in for its agent and for the legacy coordinator rule), the markdown workflows, and the guard plugin (`.cline/plugins/`, CLI-only), recorded per host as `nativeLanes.cline`; skills the registry already ships stay served by `.agents/skills`, so only native-only files go to `.cline/`. For Antigravity (ADR 0031) the `.agents/` main library is the host layout itself, so with the lane on the native agents and rules are installed as tracked projections **instead of** the library copies they replace (recorded as `nativeLanes.antigravity`); turning it off prunes them and the library copies return. The legacy `GEMINI.md` rule is left out of `.agents/rules/` while any native rule is installed, because agy reads it as well and the same policy would arrive twice (ADR 0031 addendum). The guard hook travels with any native role: its script is a tracked projection (`.agents/hooks/agents-united-guard.js`), and its registration is a **merge** of the one key `agents-united-guard` into the user-owned `.agents/hooks.json` (see **Guard Hook**), and the MCP servers the bundle's agents declare are merged into `.agents/mcp_config.json` (see **MCP Wiring**). With the lane on, the skills in `.agents/skills/` are real copies, whatever the install method, each file recorded as a copy with its hash (ADR 0033); an existing link install migrates on the next install or `agents update`, and an edited copy is not overwritten without `--force`.
_Avoid_: Calling it a renderer (nothing is generated at install time, and no LLM runs on the user's machine), assuming it is the default

**Implicit Store**:
The `.agents/` store when it exists only because another host needed it (Cline, the Claude plugin lane) and Antigravity was not asked for (`-t agents`, the default, or `--canonical-store`). Recorded in the lockfile as `implicitStore` (ADR 0034). An implicit store gets no Antigravity native lane, and a native Cline lane leaves the three generic workflow skills out of it so they cannot shadow the native Cline workflows.
_Avoid_: Calling it the sidecar (that is the store-less Claude state folder), assuming a Cline install is an Antigravity install

**Claude Agent-Teams Scaffold (experimental)**:
The minimal, opt-in support for Claude's experimental agent teams: `agents start --host claude --teams` injects `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` ephemerally into the spawned process and instructs the lead to spawn teammates from projected agent types by name. Nothing is persisted to `settings.json` or `~/.claude/**`, and the scaffold is never load-bearing (one team per session, fixed lead, no session resumption).
_Avoid_: Persisted team configuration, teardown-dependent workflows, replacing subagents with teams

**Native Agent Team (Tier 2)**:
An organization-tier bundle installed with the native lane (`agents add digital-agency --native`, ADR 0036) and run as a live Claude Agent Team: a lead (`orchestrator-digital-agency`, started as the main agent, normally through `agents start`, which switches Agent Teams on for the session) and native teammates spawned with an `Agent` call that sets `name` and `subagent_type`. The Plan 022 comms law is bound to it: relay by default, team mode only when the brief lists each peer, at most two exchanges per pair (an exchange is one message and its reply), one hand-back with `Peer messages received` and `Open items`. A message to a working teammate is delivered only after its turn ends, as a new turn (observed), so teammates do not wait for replies and report again as an update. The roster is the lead plus nine agency-only teammates, each with a persona (Ava, Kaan, Jamileh, Yavuz, Jale, Selin, Deniz, Emre, Defne; ADR 0039). The bundle stays `experimental` until a full-roster live run.
_Avoid_: Calling it the Agent-Teams scaffold (that is the ephemeral launch switch), assuming a teammate carries its definition's hooks or permission mode, running it as a subagent and expecting peers to be reachable by name

**Bundle-scoped Native Role**:
A native role a bundle installs under its own name in place of a role it shares with another bundle, declared by `nativeRoles` in `registry/bundles.json` (canonical agent file to native role name). It is owned by the installing bundle alone and records no canonical pointer, so the other bundles keep theirs and removing the bundle removes only its own files; the lead's `Agent(...)` allowlist and the roster use the scoped name. `digital-agency` maps every one of its nine agents to an `agency-*` name (ADR 0039); the pilot was three marketing roles (`agency-growth-strategist`, `agency-creative-designer`, `agency-conversion-specialist`). The agency copy of the frontend architect carries its persona (Deniz) in its body because the shared core is persona-free.
_Avoid_: Copying a canonical agent under a new name, treating it as a second owner of the canonical asset

**Teammate Guard**:
The guard a teammate actually has. A subagent definition's frontmatter hook (and `permissionMode`, and `skills`) does not apply to an in-process teammate that reuses it (observed on Claude Code 2.1.288); only a settings-level hook does, and a teammate's `tools:` list is its least privilege. So a native Tier-2 install offers the opt-in `--session-guard` merge (default yes, consent first), prints where the guard stands, and `agents doctor` warns while it is not in effect.
_Avoid_: Relying on a role's frontmatter guard for a team, writing the settings file without consent

**Claude Capability Probe**:
The side-effect-free detection of Claude Code for a workspace: `CLAUDE_BIN_PATH` / PATH resolution (including the Windows `.cmd`/`.bat` `cmd.exe` bridge), `claude --version`, and `--help` flag parsing. `claude agents --json` and headless `-p` runs are deliberately excluded because they can start the supervisor daemon or spend tokens.
_Avoid_: Daemon-starting probes, billed verification runs

**Translation Ledger**:
The declarative record (`registry/translation-ledger.json`) of how every canonical feature is treated per host, with exactly one disposition — `mapped`, `approximated`, `degraded`, or `unsupported` — plus a rationale and an optional remedy. Renderers must disposition every drop; an undispositioned drop is a render-time error rather than a silent warning, which is what makes translation loss auditable instead of invisible (ADR 0018 decision 9, generalized by ADR 0019).
_Superseded semantics (ADR 0021)_: this record becomes the **Declared-Delta Registry** — dispositions classify host-native deltas above the Contract Floor rather than translation loss.
_Avoid_: Unenforced warning lists, silent feature drops, per-host prose explanations instead of data

---

### Host Dialect Codex Terms (ADR 0020)

- **Host Dialect Spec (`HostDialectSpec`)**: typed, validated per-host translation description
  (`src/core/dialects.ts` → `HOST_DIALECTS`): fields, tool/body vocabularies, command-token map,
  role model/effort defaults, section overrides, runtime note, budgets, name rules. It is the
  only writer for its host's projections, unbundled fallback included.
  _Superseded semantics (ADR 0021)_: this spec becomes the host's **Binding Table** schema —
  creator of record per host, not translator of record.
- **Translation Ledger (`registry/translation-ledger.json`)**: host-keyed record of what happens
  to every foreign feature/token at projection time. Dispositions: `mapped`, `approximated`,
  `degraded`, `unsupported` — each with a rationale. A drop without a disposition throws.
- **Command Token**: canonical slash-command placeholder (`team_command`,
  `deep_planning_command`, `interview_command`) rewritten per host into that host's real command
  (Cline `/team`, Antigravity `/teamwork-preview`) or prose guidance (Claude). Host command
  names never appear in canonical prose.
- **Projection Overlay**: declarative per-agent (optionally per-tier × per-host) field/section
  replacement in the catalog. Precedence: overlay > dialect default > canonical.
- **Section-Residue Lint**: CI-blocking check that projected bodies carry no foreign-host
  section patterns (`Nested Subagent Delegation`, `Host Routing`, `language_server`, `Cline &
  CLI`) and no raw canonical tool tokens outside code fences.
- **Golden Snapshot**: committed byte-exact expected projection (`tests/golden/claude/**`),
  regenerated only via a maintainer `UPDATE_GOLDEN=1` run with a PR-reviewed diff.

---

### Agent-factory foundation terms (ADR 0045)

- **Subagent Contract**: a Semantic Core stem (`definition`) and explicit permitted `workflows`, `skills`, `hooks` identifier lists. It carries no host mechanics and grants no runtime permissions.
- **Host Authoring Input**: host, surface, observed version, artifact types, workspace/output root, create/update operation, local/upstream intent and evidence budget supplied before authoring.
- **Affordance Binding**: the host realization's record of a permitted identifier's native source, loading/invocation, prerequisites, enforcement, declared delta and evidence. The shared core does not hold this record.
- **Contributor Draft**: authored files in a user-selected directory outside managed install outputs; local installation semantics remain proposed in ADR 0046.
- **Contribution Runbook**: the proposed procedure that validates an artifact, assembles provenance and host evidence, and prepares an authorized contribution PR to `dev`. Its future skill/workflow realization is deferred to Plan 033's later slices.
- **Pipeline / Runbook**: a pipeline schedules delegated stages and checks their results; a runbook guides one agent's decisions. Host-native realization determines whether scheduling is scripted or prose.

### Semantic Core Architecture Terms (ADR 0021)

- **Semantic Core**: tool-free definition of what an agent *is* — identity, mission, scope
  boundaries, structured output contract, safety rules, and tool-neutral behavioural invariants.
  Authored in `registry/core/**`, shipped in the package, edited via PR only. Contains zero host
  tool names, command names, or host mechanics.
- **Contract Floor**: the subset of the Core (identity, scope boundaries, output contract, safety)
  every host realization must honor verbatim. Host-native specialization may never cross it.
- **Realization Layer**: one host's native rendering of a core agent — invariant → tool bindings,
  host-native choreography, and declared deltas. Six realizations may read differently; they may
  not *mean* differently below the floor. _Claude: the committed native file is the realization; `registry/realizations/` was retired (ADR 0037)._
- **Binding Table**: per-host data mapping invariants and behaviours to concrete host tools,
  commands, and mechanics (successor to the translator vocabulary maps). Targets a Capability
  Profile; a host release change touches this table only. _Retired for Claude (ADR 0037): the dialect keeps its vocabulary maps for the legacy lane; the comms law bound to Claude mechanics lives in the native bodies and `tests/helpers/comms-law.ts`._
- **Capability Profile**: versioned snapshot of a host's tool surface (e.g. `claude@2.1.271`,
  `antigravity@2026-08`). Absorbs host churn as one-host data PRs with a one-host blast radius. _The Claude file `claude@2.1.271` was retired (ADR 0037); `registry/hosts/claude/profile.json` carries its version floor as `minVersion`._
- **Declared Delta**: an audited, host-specific deviation *above* the Contract Floor (more or less
  scope, host-native affordances), classified `mapped | approximated | degraded | unsupported` with
  a rationale. Undeclared divergence is a conformance failure.
- **Creation Engine**: deterministic codegen assembling Semantic Core + Binding Table + Capability
  Profile into native host files (successor to the Projector). Renders are creators of record —
  never translators, never LLMs (supersedes ADR 0020 decision 1's "translators of record"). _Retired (ADR 0037): `createRole` and its goldens were removed after their assertions were ported; no engine generates a native file, they are authored and committed._
- **Conformance Suite**: per-host golden snapshots plus floor-identity assertions (successor to the
  Plan 017 golden pin). A realization ships only when its suite is green. _Now (ADR 0037): floor identity, invariant coverage (evidence or declared delta), least privilege and comms evidence over the native and legacy files; there are no created goldens._
- **Semantic Core vs Realization**: the single most important distinction in this domain. The core
  answers *what this agent is and must never stop being*; a realization answers *how that is
  enacted on one host*. Translation loss is eliminated structurally: no cross-host prose hop exists.
_Avoid_: letting host tool names leak into the core, undeclared scope drift between realizations,
runtime host detection/rewiring (nondeterministic — churn belongs in capability-profile data)

### Native Host Package Terms (ADR 0025)

- **Native Host Package**: the committed, fully native artifact set for one host under
  `registry/hosts/<host>/` (agents, skills, hooks, rules, commands, `workflows/`, `profile.json`,
  `tool-policy.json`). Installed by copying — never rendered, never LLM-generated at install time.
- **Host Docs Library**: `host-library/<host>/` (not shipped) — the host's `llms.txt` index,
  changelog, curated page map (`sources.json`), page snapshots, `library.lock.json` and distilled
  `guide/<artifactType>.md`. The only reference an authoring LLM may rely on; the machine-diffable
  feed for `docs/host-primitive-matrix.md` (ADR 0023).
- **Host-Update Workflow**: the `host-update-sync` maintainer skill — changelog first, refresh only
  affected snapshots, write an adaptation plan, open a `host-update` PR to `dev`. Never implements
  artifact changes itself.
- **Doc-Guided Authoring**: the `realize-for-host` maintainer skill drafting native artifacts from
  the Contract Floor + the library guides; output lands through a reviewed PR.
- **Skill Provenance**: `host-library/_upstream/skills.json` — each skill is *third-party pinned*
  (repo, path, commit, full folder snapshot), *in-house* (origin `registry/skills/<skill>/`) or
  *not-found* (date + URLs tried; used as is, never blocked). Extends intake step 2 (upstream pin).
- **Security Audit Gate**: quarantine + deterministic scan (`npm run hostlib:audit`) + read-only LLM
  review before anything enters `_upstream/` or a pinned commit moves; runs before the licence tier
  check (ADR 0024). `fail`/`needs-review` → `security-hold`, never auto-merged. Also guards docs
  snapshots.
- **Capability Class**: a tool-neutral grant unit a role declares in its Semantic Core
  `capabilities:` list (read, search, code-intel, edit, shell, background-monitor, web, delegate,
  workflow, scheduling, ask-user, notify, worktree, report, handback, artifacts, skill, messaging,
  task-tracking, plan, mcp-discovery; `meta` is never grantable). `scheduling` is the ADR's
  `schedule`, respelled because core files may not contain that forbidden token. The host's
  `tool-policy.json` maps classes to its full native tool catalog, with per-tool availability
  conditions and subagent rules; `resolveGrant()` turns classes into a concrete tool list.
- **Host Profile**: `registry/hosts/<host>/profile.json` — the artifact vocabularies a native
  package may use (agent and skill frontmatter keys, hook events, plugin manifest keys, MCP scopes,
  permission modes), pinned to the docs library baseline and drift-tested against its snapshots.
  The legacy **Capability Profile** it once sat beside (`registry/profiles/claude@2.1.271.json`) was
  retired with the created lane (ADR 0037); `minVersion` carries its version floor.
- **Native Declared Delta**: a Semantic Core invariant that a native role does not bind in its body on purpose, declared in `registry/hosts/<host>/deltas.json` with a disposition (`mapped`, `approximated`, `degraded`, `unsupported`) and a rationale (ADR 0037). Every other invariant of a native role is evidenced in its file; a delta is stale, and fails the suite, when the body does evidence the invariant.
  _Avoid_: declaring a delta instead of fixing a body that should bind the invariant, leaving an invariant silent
- **Tool Policy Report**: `toolPolicyReport()` — per role, tools its classes would add or that were
  granted by hand outside them; overall, catalog tools no role reaches. A host's new tool surfaces
  here and in the catalog-drift test in the host-update PR.
- **Workflow skill vs dynamic workflow**: a *workflow skill* is ours (`skills/workflow-<task>/`,
  ADR 0016); a *dynamic workflow* is Claude Code's scripted multi-agent orchestration (`Workflow`
  tool, `.claude/workflows/*.js`). Multi-agent workflow skills become dynamic workflows (plus a thin
  trigger) in the Claude package; single-agent runbooks stay skills.
- **Cline Workflow Projection** (ADR 0016 decision 6, amended 2026-10-05): the `.cline/workflows/<slug>.md` file written for each
  `workflow-*` skill of an installed bundle, from the body of its `SKILL.md`. A workflow file has no folder of its own, so a relative
  link in the body to a file the install carries next to `SKILL.md` is replaced by the backticked path of that file in the canonical
  store: `.agents/skills/<name>/<file>` from the project root, and the absolute path in the global scope (Cline reads a relative path
  against its working directory and does not expand `~`). A skill with only `SKILL.md` projects unchanged. On Cline 3.0.68 a same-named
  skill answers the slash command before the workflow does (ADR 0034), so this is the form that runs where the skill does not.
  _Avoid_: calling it the skill (it is a second, flatter form of the same runbook), naming the plugin copy in it (that path names a bundle)
- **Host Observation** (ADR 0027): a dated, versioned record of what an installed host build actually does, kept in
  `host-library/<host>/observations/` and never cited as vendor documentation. A guide's authoring notes point to it where it
  disagrees with the docs, and an artifact that depends on one is marked "observed on `<version>`" in the delta table.
- **Command Source** (ADR 0030 addendum 2026-10-03): a host binary's own changelog followed as a changelog source, declared under `commands` in `sources.json` (a bare executable name, fixed plain-token arguments, a section, a snapshot, a format; Antigravity: `agy changelog`, which is free and ahead of the docs). It is run with no shell, with secret-named variables removed from its environment and a time limit, and **skipped, never failed, when the binary is not installed** (CI has none). Its output is rendered into the sectioned changelog the parser reads, snapshotted as `changelog-agy.md` through the same audit gate and hash lock (`url: command:agy changelog`, `via: command`), and tracked with its own baseline per section, apart from the docs section of the same product.
- **Releases Source** (ADR 0027 addendum): a host's GitHub release stream followed as a changelog source, declared under
  `releases` in `sources.json` (repo, tag prefix, section). It is rendered into the sectioned changelog the parser reads,
  snapshotted as `changelog-<section>.md`, and tracked with its own baseline per section. For hosts that release several
  products from one repository (Cline's CLI and SDK).
- **Honest Gap** (ADR 0026): a piece of a native package that the host has no primitive for. It is listed as a gap
  (or partial) in the `doctor --host` delta table and is never reshaped into an artifact that pretends to the
  host's missing behaviour (for example a guard hook claimed as enforcement on a surface where plugins do not run, such as
  Cline's IDE extensions). A gap is a statement about everything searched (docs, the repository's own prior work, a probe of the
  installed host), not about one docs page (ADR 0028).
- **CLI Extra Layer** (ADR 0026): an add-on to a host's base native package that only one surface of that host
  can run, shipped as its own reviewed PR (for Cline, the team-prompt roster for `cline --team-name`, which the
  VS Code and JetBrains extensions cannot use). The base package never depends on it.
- **Guard Plugin** (ADR 0026, narrowed by ADR 0028): on Cline, the reviewed single-file SDK plugin that blocks destructive shell
  commands, the native counterpart of Claude's `PreToolUse` guard hooks. It is executable code, so it passes the security audit
  gate. A read-only role does not need it: a configured agent's `tools:` list is enforced by the host.
- **Guard Hook** (ADR 0030 decision 10, ADR 0031 addendum): on Antigravity, the reviewed command-hook script `.agents/hooks/agents-united-guard.js` plus its registration under the key `agents-united-guard` in `.agents/hooks.json`, which is the user's own file and is therefore only merged (strict JSON, the user's other hooks and formatting kept; a file that cannot be parsed, or a key the user edited, is left alone and reported). The key exists exactly while the script is a recorded projection, so it follows the lane, the bundle owners and `--no-native`; `agents doctor` judges the hook by that key alone and warns when a native role that can run commands or edit files has no guard in effect. Distinct from the **Guard Plugin** (Cline) and from the Claude `PreToolUse` guard.
- **MCP Wiring** (ADR 0032): on Antigravity, the servers the bundle's agents already declare by name (`mcpServers:` in the registry agents) written as entries into `.agents/mcp_config.json`, the user's own file, from the reviewed catalog `registry/hosts/antigravity/mcp/servers.json` (one entry per declared name, command and args only). It is part of the native lane: merged under strict JSON (a file that cannot be parsed is left alone and the entries are printed), a key is ours only while the lockfile (`antigravityMcp`) records it, a name the user already has stays theirs, owners are refcounted by bundle, and removal takes only our keys. No credential is ever written, and a server that needs one is not written at all (ADR 0032 addendum 2: a `disabled: true` entry still started in a real session): the install prints its entry and the variable for the user to add. The `disabled` switch of a server we do write is the user's, and never drift. Distinct from **Native MCP Provisioning** (`agy mcp add`), which the legacy prerequisite flow prints.
- **Configured Agent** (ADR 0013, ADR 0028): a Cline role file `.cline/agents/<role>.yml` (fenced frontmatter `name`, `description`,
  `maxIterations`, `skills`, `tools`, and a body that is the system prompt), exposed to the lead as the tool `subagent_<name>`.
_Avoid_: install-time LLM generation, scoring hosts against Antigravity keys, adopting a third-party
skill without reading its upstream original, snapshotting unaudited upstream content

### Agent Registry & Department Hierarchy

The registry catalog maintains **45 specialized agents** (7 Lead Orchestrators and 38 Sub-Agents) structured into **18 curated bundles** across **8 department domains**:

1. **🛠️ Software Engineering & Delivery** (`engineering`):
   - **Lead Orchestrator**: `orchestrator-engineering.md`
   - `software-engineering` (Essentials Base): `subagent-backend-architect.md`, `subagent-frontend-architect.md`, `subagent-code-reviewer.md`, `subagent-repo-index.md`
   - `ai-ml-engineering` (Addon): `subagent-ml-platform-engineer.md`, `subagent-ai-model-architect.md`
   - `mobile-development` (Addon): `subagent-ios-architect.md`, `subagent-android-architect.md`, `subagent-cross-platform-specialist.md`
   - `frontend-engineering` (Addon): `subagent-frontend-architect.md`, `subagent-accessibility-lead.md`
   - `backend-distributed-systems` (Addon): `subagent-distributed-systems-architect.md`, `subagent-data-engineer.md`
   - `qa-automation` (Addon): `subagent-qa-automation-lead.md`, `subagent-e2e-tester.md`
   - `devops-engineering` (Addon): `subagent-devops-engineer.md`

2. **🏛️ System Architecture & SRE** (`architecture`):
   - **Lead Orchestrator**: `orchestrator-system-architecture.md`
   - `system-architecture` (Essentials Base): `subagent-system-architect.md`, `subagent-backend-architect.md`
   - `sysops-sre` (Addon): `subagent-sysops-sre-lead.md`

3. **🎨 Product Design & UI/UX** (`design`):
   - **Lead Orchestrator**: `orchestrator-design.md`
   - `product-design` (Essentials Base): `subagent-ui-designer.md`, `subagent-ux-strategist.md`, `subagent-interaction-designer.md`, `subagent-design-systems-architect.md`, `subagent-design-researcher.md`, `subagent-design-ops-lead.md`, `subagent-designer-toolkit-expert.md`, `subagent-prototype-tester.md`

4. **📈 Growth & Marketing Operations** (`marketing`):
   - **Lead Orchestrator**: `orchestrator-marketing.md`
   - `growth-marketing` (Essentials Base): `subagent-marketing-growth-strategist.md`, `subagent-marketing-content-strategist.md`, `subagent-marketing-conversion-specialist.md`, `subagent-marketing-campaign-specialist.md`, `subagent-marketing-creative-designer.md`
   - `seo-content-marketing` (Addon): `subagent-seo-specialist.md`
   - `performance-paid-acquisition` (Addon): `subagent-paid-acquisition-specialist.md`
   - `product-led-growth` (Addon): `subagent-plg-strategist.md`
   - `lifecycle-email-marketing` (Addon): `subagent-lifecycle-email-specialist.md`

5. **🔒 Security Operations** (`security`):
   - **Lead Orchestrator**: `orchestrator-security.md`
   - `security-operations` (Essentials Base): `subagent-security-engineer.md`

6. **🔬 Deep Technical Research** (`research`):
   - **Lead Orchestrator**: `orchestrator-research.md`
   - `deep-research` (Essentials Base): `subagent-deep-research.md`, `subagent-socratic-mentor.md`, `subagent-repo-index.md`

7. **💼 Business Strategy & Economics** (`business`):
   - **Lead Orchestrator**: `orchestrator-business.md`
   - `business-strategy` (Essentials Base): `subagent-business-panel-experts.md`

8. **🌐 Universal Autonomous Department** (`universal`):
   - `universal-orchestration` (Guided Front Door): Prime Orchestrator (`orchestrator-universal.md`) + `handoff` + `grill-me`; routes to the correct department Essentials bundle and hands off.
   - `universal-skills` (Baseline): Domain-agnostic meta-skills; no agents.
   - `full` (Complete Universal Suite): Aggregates all 7 Lead Orchestrators + 38 Sub-Agents (45 agents total), and all 190 modular skills (121 domain skills + 69 workflow playbooks).

9. **🏢 Organization Bundles** (`organization`):
   - **Lead Orchestrator**: `orchestrator-digital-agency.md` (Campaign Director / Chris)
   - `digital-agency` (Cross-Functional Composite): `subagent-marketing-growth-strategist.md`, `subagent-marketing-campaign-specialist.md`, `subagent-marketing-content-strategist.md`, `subagent-marketing-creative-designer.md`, `subagent-marketing-conversion-specialist.md`, `subagent-seo-specialist.md`, `subagent-frontend-architect.md`, `subagent-qa-automation-lead.md`, `subagent-compliance-grc-specialist.md`

---

### Alignment & Domain Skills

**Grill With Docs (`grill-with-docs`)**:
An interactive Socratic grilling skill tailored for **coding & engineering domains**. It rigorously interrogates technical requirements, generates Architectural Decision Records (ADRs under `docs/adr/`), and **automatically updates `CONTEXT.md`** to register newly identified domain terms and primitives into the ubiquitous language dictionary.
_Avoid_: Code interview, prompt grilling

**Grill Me (`grill-me`)**:
A pure Socratic alignment skill for **non-code and high-level strategy domains**. Interrogates problem framing, user goals, and constraints without generating code artifacts or ADRs.
_Avoid_: General quiz, bot chat

**Domain Modeling (`domain-modeling`)**:
The capability that structures, defines, and refines domain entities and ubiquitous language in `CONTEXT.md`.

**Templated Skill (ADR 0040)**:
A skill whose body is mostly lines that other skills also carry once its own name is taken out (a template with the title swapped), measured as a share of its content lines found in a frozen boilerplate corpus (0.30 or more fails), or a hand-written in-house skill under 30 content lines with no `references/` or `scripts/` (a stub). `tests/skill-quality-ratchet.test.ts` rejects both unless the skill is on the shrinking allowlist.
_Avoid_: Boilerplate skill, generated skill (some generated skills are fine; the test is on repetition)

**Skill Layout (ADR 0040, Plan 035)**:
How a rewritten skill of the digital-agency bundle is laid out, after the Claude Code skills guidance. A short `SKILL.md` (at most 90 lines and 6,000 characters, the most important text first, the description leading with "Use when" and listing trigger phrases and when to skip) points to supporting folders that are read only when needed: `examples/` (worked examples and templates), `references/` (checklists, tables, formulas), `scripts/` (Node `.mjs`, only where the role that loads the skill has a shell) and `evals/evals.json` (for the maintainers: no install copies it). A skill is held to the layout once a marker file for it exists in `tests/fixtures/laid-out-skills/` (a **laid-out skill**); `tests/skill-layout.test.ts` checks it.
_Avoid_: Template (that is a Templated Skill), skill pack

**Skill Allowlist Marker**:
One small file in `tests/fixtures/templated-skills/` named for a skill that failed the audit. A rewrite deletes its own marker; no marker can be added, and a marker for a skill that now passes fails the test, so the allowlist only shrinks and parallel rewrites never conflict.
_Avoid_: Exemption, waiver

**Skill Attribution Standard**:
A mandatory rule requiring all skills adopted from external creators to specify `metadata.author`, `metadata.version`, `metadata.source`, and `metadata.license` in their YAML frontmatter, and maintain formal acknowledgment in `README.md` under `## Credits & Acknowledgments`.
_Avoid_: Uncredited fork, silent copy

---

**Claude Design brief**:
A pasteable block (`CLAUDE DESIGN BRIEF: ...`) that the creative designer ends her report with when the lead or the user names Claude Design as the next step: the placements, the design system or the tokens as lines of name, value and usage, the supplied copy, the hook variants, the safe zones, what the design must not contain, the photography, what was not rendered and the claims for review. A person pastes it into `/design` or claude.ai/design; she publishes nothing and calls no design tool (`ad-creative-design/references/claude-design-brief.md`, Plan 036 O1).
_Avoid_: Design prompt, design export

**Design artifact**:
An Artifact of the Design type (a canvas of artboards) or the Design System type (tokens in list form, a brand book and a cover) that the creative designer publishes to Claude Design through the `Artifact` tool, only when the user asks, private, and then reads back (Plan 036 S11, ADR 0047). The skill `design-artifact-publishing` carries the rules; the vendor format is read live from the type's own instructions.
_Avoid_: calling a plain SVG or HTML file one, saying it is shared, publishing as a side effect of a design task

### Testing & Code Quality Standards

**4-Tier Testing Methodology**:
A deterministic test verification hierarchy:
- **Tier 1 (Feature Coverage)**: Happy path validation of exported functions, interfaces, frontmatter schemas, and expected return types.
- **Tier 2 (Boundary & Corner Cases)**: Negative testing covering empty inputs, malformed files, invalid enums, and graceful error handling.
- **Tier 3 (Cross-Feature Pairwise)**: Interoperability testing between Registry, Installer, Adapters, Lockfile Engine, and CLI.
- **Tier 4 (Full Real-World Scenarios)**: End-to-end catalog audits over all 26 bundles, 59 agents, and 190 skills.

**Deterministic Verification**:
Testing practices that eliminate arbitrary timeouts (`setTimeout`) in favor of auto-waiting assertions, isolated test workspaces, predictable mock factories, and clean teardowns.

**Gate Command Portability**:
The convention that phase-gate commands in workflow runbooks are written to tolerate absent project tooling (`npm run <script> --if-present`), and that a gate whose command cannot run is recorded as `N/A` rather than silently reported as passing.
_Avoid_: Gate literals that assume the maintainer's own `package.json`, silently skipped gates.

---

### Runtime & Configuration

**Git Guardrails**:
A persistent safety rule preventing agents from committing directly to protected branches (`main`, `master`), executing force-pushes (`git push -f`), or staging unencrypted secrets (`.env`, tokens).
_Avoid_: Git hook hack, commit blocker

**Nested Lifecycle Hooks**:
Declarative event-driven interceptors (`PreInvocation`, `PostInvocation`, `PreToolUse`, `PostToolUse`) embedded in YAML frontmatter to validate environments, enforce preconditions, and run automated post-tool verifications.
_Avoid_: Middleware, interceptors, triggers

**Installation Scope**:
The target visibility and location where assets are installed:
- **Project Scope** (default): Stored inside the workspace repository (`./.agents/`, `./.gemini/`, `./.claude/`, `./.cursor/`), tracked in git, and shared across the team with lockfile verification.
- **Global Scope** (`-g`, `--global`): Stored in the user home directory (`~/.agents/`, `~/.gemini/config/`, `~/.claude/`), available across every workspace on the machine.

**Installation Method**:
The mechanism used to link or replicate files into target directories:
- **Symlink Mode** (`-s`, `--symlink`, Recommended): Creates symbolic links (or directory junctions on Windows) to a canonical registry cache. Serves as a single source of truth; package updates reflect instantly without file duplication. With the Antigravity **Native Lane** on, skills are copied instead (ADR 0033), because agy 1.2.16 did not list a skill folder that is a link.
- **Copy Mode** (`--copy`): Creates independent physical copies of all asset files in the destination directory, enabling local modifications and offline isolated edits. A skill's **Maintainer-only Skill Folder** (`evals/`) is the one thing it leaves out.

**Multi-Agent Target Host**:
The specific agent environments targeted for deployment:
- **Universal Multi-Agent** (`agents`): `./.agents/` or `~/.agents/`
- **Antigravity 2.0 / Gemini** (`gemini`): `./.gemini/` or `~/.gemini/config/`
- **Claude Code** (`claude`): `./.claude/` or `~/.claude/`
- **Cursor / Codex** (`cursor`): `./.cursor/` or `~/.cursor/`

**Lockfile (`agents-united.json`)**:
The machine-generated manifest stored at the root of target agent directories, recording installed bundles, assets, installation methods, scopes, and target host mappings to guarantee deterministic reproducibility.

**Health Doctor**:
The diagnostic engine (`agents doctor` / `node dist/cli.js doctor`) that scans installed agent directories, validating frontmatter schema compliance, lifecycle hook configurations, file integrity, and lockfile synchronization.

**Registry Manifest**:
The authoritative index (`bundles.json`) mapping bundles, agents, skills, workflows, and rules to their sources, versions, aliases, domains, and parent inheritance relationships.

**Package Inventory Scanner (`InventoryScanner`)**:
The discovery engine (`src/core/inventory.ts`) that inspects active workspace host directories (`./.agents/`, `./.gemini/`, `./.claude/`, `./.cursor/`) and global configuration directories (`~/.agents/`, `~/.gemini/config/`, `~/.claude/`, `~/.cursor/`) to parse lockfiles (`agents-united.json`) into structured inventory records.

**Installed Package Record (`InstalledPackageRecord`)**:
A normalized data structure representing an active bundle or standalone asset installation, tracking `name`, `type` (`bundle` | `agent` | `skill` | `workflow`), `scope` (`project` | `global`), `host` (`agents` | `gemini` | `claude` | `cursor`), `targetDir`, `installedVersion`, `upstreamVersion`, and `driftStatus` (`up-to-date` | `outdated` | `modified`).

**Upstream Version Drift (`VersionDrift`)**:
The delta between the version/hash recorded in the local lockfile and the canonical registry manifest (`bundles.json` or skill frontmatter `metadata.version`).

**Scope Location Badge**:
The standardized TUI terminal badge displaying installation scope and resolved path adjacent to package names in interactive menus (e.g. `[project: ./.agents]` or `[global: ~/.gemini/config]`).

**Package Update Engine (`UpdateEngine`)**:
The core engine (`src/core/updater.ts`) responsible for checking version drift, orchestrating batch and selective package updates, preserving user-modified files with conflict guardrails, and synchronizing lockfiles.

**Canonical Store**:
`.agents/` — the **main library**. It is the single source of truth the lockfile tracks, and the *one* folder you edit. Every other assistant's translated copies are derived from — never diverging from — this store. (Antigravity reads it directly in interactive sessions — CLI TUI panel and desktop; see ADR 0009. Other runtimes only via `--fanout` copies.)
_Avoid_: Source of record ambiguity, duplicated truth

**State Dir / Sidecar** (ADR 0022):
The directory holding an install's machine state — the lockfile `agents-united.json` plus the canonical copies it projects. It is either the **Canonical Store** (`.agents/`) or, for a Claude-only install, the hidden **sidecar** `.claude/.agents-united/`: a machine-owned, immutable snapshot (never edited, never loaded by Claude Code) that keeps doctor/update/remove working without a `.agents/` folder. Adding any store-requiring host later (or `--canonical-store` / `--plugin`) moves the sidecar into `.agents/`. Resolved by `src/core/state-dir.ts`.
_Avoid_: Hidden store, second library, cache

**Host Registry**:
The single table (`src/core/hosts.ts`) describing every known host runtime (dirs, subdirs, detection markers, projection profile), replacing the duplicated hard-coded host lists.
_Avoid_: Hard-coded host list, scattered host literals

**Host Projection**:
A **translated copy** a user-facing assistant needs before it can read the main library — written to that runtime's own loader directory (`.claude/agents/`, `.agents/plugins/<bundle>/`, …). Projections are always copies (never symlinks), machine-managed (they carry the managed marker), refcounted across bundles, and kept in sync by `agents update`.
_Avoid_: Foreign copy, mirror, symlink fan-out

**Cline Native Discovery Projection**:
The dual-lane machine-managed structure emitted when projecting into Cline (ADR 0013), matching Cline 3.x's verified discovery registry:
1. **Agent Plugin Package** (`.agents/plugins/<bundle>/`): A `plugin.json` manifest (agent-plugins.org v1.0.0) that hard-stops Cline's code-plugin scanner and makes the package portable to conforming clients; `skills/<skill>/` copies for cross-client portability; and the vendor-namespace Team Manifest under `agents-united/teams/`.
2. **Configured Agent Roles** (`.cline/agents/<role>.yml`): YAML files with `name` (canonical `subagent-` prefix stripped) and `description` frontmatter plus a system-prompt body — natively loaded by Cline and exposed as spawnable `subagent_<name>` tools.
3. **Coordinator Rule** (`.cline/rules/agents-united-<bundle>.md`): Always-active workspace rule instructing Cline sessions on bundle team coordination, manifest path, and role delegation.
4. **Workflows** (`.cline/workflows/<slug>.md`): Slugified-name workflow markdown surfaced natively as `/<slug>` slash commands.
5. **Skills**: No additional projection — Cline natively discovers the canonical `.agents/skills/` store.
_Avoid_: Cline code-plugin packaging (`package.json` + `cline.plugins[].paths`), loose `.cline` file dump, `cline plugin install` bootstrap steps

**Configured Agent (Cline)**:
A Cline-native role definition (`<workspace>/.cline/agents/<role>.yml` or `~/.cline/agents/`) with YAML frontmatter (`name`, `description`, optional `tools`, `skills`, `providerId`, `modelId`, `maxIterations`) and a system-prompt body. Cline exposes each configured agent as a spawnable `subagent_<name>` tool for team delegation.
_Avoid_: Markdown role copy, agent preset dump

**Team Manifest**:
The authoritative YAML document (`.agents/plugins/<bundle>/agents-united/teams/<bundle>.yaml`) declaring team membership, role descriptions, required skills, recommended addon bundles, and execution integrity modes (`strict`, `balanced`, `development`).
_Avoid_: Config file, prompt snippet

**Native Activation (Cline)**:
The zero-step activation model (ADR 0013) where an installed bundle becomes immediately usable in any Cline session: skills are discovered from the canonical `.agents/skills/` store, configured-agent `.yml` roles surface as spawnable `subagent_*` tools from `.cline/agents/`, the coordinator rule is always-on from `.cline/rules/`, and workflows appear as `/<slug>` slash commands from `.cline/workflows/`. No plugin-install or launch step exists or is required.
_Avoid_: Plugin install bootstrap, activation gate, manual `cline plugin install`

**Team Session Launcher**:
The optional CLI execution lifecycle (`agents start <bundle> [prompt]` or `agents add --start`) that discovers local workspace/global installations, validates local binary capabilities, constructs safe non-shell evaluated argument arrays, and launches a Cline session pre-seeded with the coordinator persona, Team Manifest context, persistent named-team state, and addon pre-authorization. Purely a convenience on top of Native Activation.
_Avoid_: Activation step, required initializer, shell wrapper

**Host Capability Probe**:
A side-effect-free, read-only probing engine (`ClineCapabilityProbe`) that validates binary presence, queries semantic versioning, and performs safe parser checks (e.g. `--team-name` validation) under strict timeouts without spawning interactive sessions or mutating workspace files.
_Avoid_: Blind execution, shell check

**Activation Strategy**:
The dynamically selected session launch strategy:
- `named-team`: Uses `--team-name <team>` with stable deterministic identifiers (`au-<bundle>-<hash8>`) when supported by the host CLI.
- `adaptive-session`: Falls back to standard session initialization with embedded bootstrap prompts referencing coordinator role and team manifest paths.
_Avoid_: Hard-coded command line, brittle argv

**Addon Consent Policy**:
The security and permission policy governing recommended addons during runtime execution. In default mode, coordinators are instructed to explain requirements and seek explicit user consent before executing `agents add <addon> -t cline -y`. Pre-authorization is granted ephemerally via `--allow-addons` without being persisted in lockfiles. The same consent contract applies to the Prime Orchestrator when it installs a department **Essentials bundle** at domain scope: `agents add <essentials-bundle> -y` requires explicit in-session confirmation (Route & Instruct Contract).
_Avoid_: Silent auto-install, unconsented mutation

**Projection Profile**:
The frontmatter dialect a projection is serialized into (`antigravity`, `claude-code`, `cursor`, `cline`, `opencode`, `agentsmd`). Profiles are isolated so each runtime's format (Claude/Cursor/Cline/OpenCode/Codex) can be updated independently.
_Avoid_: Translator, serialization scheme

**AGENTS.md Bridge**:
A generated root `AGENTS.md` indexing canonical assets for runtimes with no subagent loader (Codex & other AGENTS.md readers), bridging from the root index file into `.agents/`.
_Avoid_: Root index hack, static readme

**Managed Projection Marker**:
An HTML comment stamp identifying a file as machine-managed (e.g. `<!-- managed-by: agents-united | profile: claude-code | canonical: .agents/agents/<file> | do not edit -->`) placed as the first line of a projected file's body. Its presence gates deletion/overwrite so user-modified files are never clobbered.
_Avoid_: Dirty edit flag, unmarked copy

**Projection Content Drift**:
A managed projection whose on-disk bytes no longer match the hash recorded for it at projection time (`lockfile.projections[path].hash`) — the file was edited after installation while its **Managed Projection Marker** was left intact, so marker-integrity checks cannot see it. Detected by `agents doctor` (ADR 0017); repaired with `agents update <bundle> --fanout <host>`.
_Avoid_: Silent local edit, unmanaged tweak, marker-valid so assumed correct

**Outdated Projection**:
A managed projection whose content still matches its recorded hash but differs from what the current renderer produces for the same bundle — normally produced by an older bundle definition or CLI version, which is why no stored field can reveal it: detection requires **re-rendering** the projection set and diffing (ADR 0017). Reported by `agents doctor` with the self-healing remedy `agents update <bundle> --fanout <host>`.
_Avoid_: Stale projection (a superseded projection *path*, Plan 015e), Missing projection (a deleted file), stale-render assumption from version numbers alone

**Scoped Rule Binding (`rules: [...]`)**:
The declarative frontmatter property enabling agents to explicitly bind a curated array of relevant rule files (e.g. `rules: [git-guardrails.md, tdd-protocol.md]`), preventing full workspace rule trees from bloating the agent's context window.
_Avoid_: Global rule flood, untyped rule inclusion

**Customization Isolation (`inheritCustomizations: false / true`)**:
The boolean frontmatter switch controlling whether a specialized subagent adopts workspace-level customizations (skills, rules, plugins, subagents) or runs in an isolated, minimal runtime container.
_Avoid_: Context dumping, unbounded tool inheritance

**Skill Icon Branding (`metadata.icon`)**:
A visual Unicode emoji attribute declared in `SKILL.md` frontmatter (e.g. `icon: "🛡️"`) rendered in catalog list views, inspection headers, and slash command autocompletions.
_Avoid_: Unstyled skill text, raw icon paths

**Internal Skill Slash-Suppression (`disable-slash-command: true`)**:
A frontmatter flag in `SKILL.md` that hides internal or subagent-specialized skills from the interactive `/` autocomplete popup while keeping them fully discoverable and invocable by models.
_Avoid_: Command palette bloat, hidden skill deletion

**Declarative Reasoning Effort (`effort: low | medium | high`)**:
The frontmatter parameter mapping agent tasks to specific model reasoning budget tiers on supported models (e.g. Gemini 3.6/3.7 Flash and Pro), allowing high-latency deep reasoning for lead orchestrators and rapid low-latency execution for worker subagents.
_Avoid_: Fixed model thinking, uncontrolled latency

**Live URL Artifact Card**:
A specialized markdown artifact card format that opens web server endpoints (`http://localhost:3000`) or cloud docs directly inside Antigravity's in-app preview pane without switching application windows.
_Avoid_: Plain text link, external browser tab mandate

**Visual Multi-Modal Review Loop**:
An iterative design and QA review workflow combining side-by-side SVG/image visual diffs and region-selection commenting, allowing users to draw bounding boxes on generated UI screens and submit feedback with cropped previews.
_Avoid_: Pure text UI feedback, blind pixel review

**Native MCP Provisioning (`agy mcp`)**:
The automated configuration lifecycle where the CLI evaluates bundle prerequisites and leverages native host commands (`agy mcp add --type stdio|http`) to provision required tool servers (e.g. Firecrawl, GitHub) into `mcp_config.json`.
_Avoid_: Manual JSON editing, unverified MCP startup

### Git & Release Workflow

**Release Line (`main`)**:
The production branch of this repository. Accepts merges only from `dev` via PR; `semantic-release` publishes the npm package, Git tag, and `CHANGELOG.md` from it.
_Avoid_: Trunk, production-branch edits, default-branch direct commits

**Integration Line (`dev`)**:
The protected integration branch where all work lands before release. Kept in lockstep with `main` by the `Sync main to dev` auto-merge workflow after every release.
_Avoid_: Development branch, staging branch, WIP branch

**Branch Ruleset (Protected Branch)**:
The GitHub branch ruleset on `dev` requiring pull requests and a passing `test` status check (typecheck + build + Vitest) before merge, with admin bypass as the emergency escape hatch.
_Avoid_: Soft guideline, honorary protection, local hook enforcement

**Work Branch (`feat/…` `fix/…` `docs/…` `ci/…`)**:
A short-lived branch always cut from a fresh `origin/dev` (or `origin/main` for emergency hotfixes), pushed early as backup and CI trigger, and deleted after merge.
_Avoid_: Long-lived branch, personal branch, direct dev commits

**Two-Step Release Flow**:
The mandatory release path: PR #1 merges the work branch into `dev` (CI gate), then PR #2 merges `dev` into `main`, triggering semantic-release and the automated `main → dev` sync.
_Avoid_: Direct release push, manual versioning, one-step merge to main

**Conventional Commit Release Trigger**:
The rule that only `feat:` commits trigger a minor release and `fix:` commits a patch release on `main`; `docs:`, `ci:`, `chore:`, `refactor:`, `test:`, and `perf:` commits accumulate on `dev` and ride into the next release.
_Avoid_: Free-form commit messages, manual changelog editing

## Usage Examples

Universal install with fan-out to every supported runtime:

```bash
agents add software-engineering -t agents --fanout claude,cursor,cline,opencode,codex -y --copy
```

Produces the canonical `.agents/` tree (unchanged format) plus translated copies in
`.claude/agents/`, `.cursor/agents/`, `.agents/plugins/<bundle>/` (with native plugin package.json, skills, rules, and team manifest),
`.opencode/agent/`, and a generated root `AGENTS.md` bridge — all tracked in the lockfile under
`projectedTo` and `projections`, refcounted, and removable with a single `agents remove software-engineering`.

Canonical-only (no projections):

```bash
agents add software-engineering -t agents -y
```

Starting an installed team in Cline:

```bash
# Start default team in Cline
agents start software-engineering

# Start team with initial user task prompt
agents start software-engineering "Refactor authentication flow and add unit tests"

# Start with pre-authorized addon auto-installation
agents start software-engineering --allow-addons

# Preview activation plan without launching processes
agents start software-engineering --dry-run
```

Preview projections without writing files:

```bash
agents add software-engineering -t agents --fanout claude,cursor -y --copy --dry-run
```

Auditing workspace health and host runtime status:

```bash
# Audit project workspace
agents doctor

# Audit Cline runtime capabilities and native discovery projection status
agents doctor --host cline
```

Degradation in practice: `hooks:` / `permissionMode:` / `commandExecutionPolicy:` /
`mainAgent:` / `subagent:` / `type:` are Antigravity-only and do **not** execute in projected
(orchestrator) files — projected agents degrade to "system prompt + tool list" subagents, and
`invoke_subagent` orchestration is dropped with a warning outside Antigravity.
