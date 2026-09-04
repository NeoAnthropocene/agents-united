# Agents United

The universal package manager for AI agents. Curated teams of orchestrators, sub-agents, skills, and workflows — installed once, projected across Gemini, Claude, Cursor, Cline, and Codex.

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

**Workflow**:
A multi-step procedural template or interactive orchestration prompt (`workflow-<task>.md`) defining deterministic phase transitions, verification gates, human review checkpoints, and rollback protocols.
_Avoid_: Pipeline, playbook, recipe

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

**Organization Bundle (Tier 2 / Experimental)**:
A cross-functional composite team modeled after real-world professional organizations (e.g. `digital-agency`, `venture-studio`). Unlike domain bundles, organization bundles orchestrate cross-discipline agents and integrate **Model Context Protocol (MCP) server tool calling**, external packages, and API keys. Because they require runtime prerequisites, they are not recommended autonomously by global orchestrators and require explicit user opt-in.
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
- **1. Fully Operational Mode (Authenticated MCP)**: All prerequisite MCP servers, CLI binaries, and bearer tokens/API keys (e.g. `FIRECRAWL_API_KEY`, GitHub PAT, Figma Access Token) are verified and active, unlocking full-scale web crawling, automated PR merges, live design token extraction, and cloud analytics.
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

---

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
   - `full` (Complete Universal Suite): Aggregates all 7 Lead Orchestrators + 38 Sub-Agents (45 agents total), 90 skills, and 63 workflows.

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

**Skill Attribution Standard**:
A mandatory rule requiring all skills adopted from external creators to specify `metadata.author`, `metadata.version`, `metadata.source`, and `metadata.license` in their YAML frontmatter, and maintain formal acknowledgment in `README.md` under `## Credits & Acknowledgments`.
_Avoid_: Uncredited fork, silent copy

---

### Testing & Code Quality Standards

**4-Tier Testing Methodology**:
A deterministic test verification hierarchy:
- **Tier 1 (Feature Coverage)**: Happy path validation of exported functions, interfaces, frontmatter schemas, and expected return types.
- **Tier 2 (Boundary & Corner Cases)**: Negative testing covering empty inputs, malformed files, invalid enums, and graceful error handling.
- **Tier 3 (Cross-Feature Pairwise)**: Interoperability testing between Registry, Installer, Adapters, Lockfile Engine, and CLI.
- **Tier 4 (Full Real-World Scenarios)**: End-to-end catalog audits over all 24 bundles, 46 agents, 90 skills, and 63 workflows.

**Deterministic Verification**:
Testing practices that eliminate arbitrary timeouts (`setTimeout`) in favor of auto-waiting assertions, isolated test workspaces, predictable mock factories, and clean teardowns.

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
- **Symlink Mode** (`-s`, `--symlink`, Recommended): Creates symbolic links (or directory junctions on Windows) to a canonical registry cache. Serves as a single source of truth; package updates reflect instantly without file duplication.
- **Copy Mode** (`--copy`): Creates independent physical copies of all asset files in the destination directory, enabling local modifications and offline isolated edits.

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
