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

**Prerequisite Gate**:
A blocking verification mechanism evaluated by the CLI (`PrerequisiteChecker`) and Lead Orchestrators before installing or activating Organization Bundles. It inspects host MCP configurations across Cursor, Cline, Antigravity/Gemini, and Claude Code, alongside npm packages and environment variables. If prerequisites are unsatisfied, it presents a 3-way resolution: abort and show setup guidance, degrade to Brainstorming Mode, or force Operational install.
_Avoid_: Dependency blocker, install hook

**Dual Execution Modes (Operational vs Brainstorming)**:
The two operational envelopes supported by Organization Bundles:
- **Fully Operational Mode**: All prerequisite MCP servers, CLI packages, and API keys are verified and active, enabling real-world web research, browser automation, git operations, and code deployment.
- **Brainstorming Mode (Fallback)**: A resilient, read-only ideation and planning envelope activated when prerequisites are missing or incomplete. Orchestrators and agents produce full architecture designs, wireframe specifications, and marketing strategy deliverables without executing live MCP tool mutations.
_Avoid_: Read-only mode, offline mock

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
- **Tier 4 (Full Real-World Scenarios)**: End-to-end catalog audits over all 18 bundles, 45 agents, 90 skills, and 63 workflows.

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
A **translated copy** a user-facing assistant needs before it can read the main library — written to that runtime's own loader directory (`.claude/agents/`, `.cline/agents/`, …). Projections are always copies (never symlinks), machine-managed (they carry the managed marker), refcounted across bundles, and kept in sync by `agents update`.
_Avoid_: Foreign copy, mirror, symlink fan-out

**Cline Compound Projection**:
The 4-part machine-managed artifact structure emitted when projecting into Cline:
1. **Role Definitions** (`.cline/agents/<role>.md`): Frontmatter containing `name` and `description` with full system instructions, stripped of Claude-specific tool lists and Antigravity-only keys.
2. **Skills** (`.cline/skills/<skill>/`): Preserved `SKILL.md` documents with progressive disclosure guidelines and auxiliary resources copied byte-for-byte.
3. **Coordinator Rule** (`.cline/rules/agents-united-<bundle>.md`): Workspace instruction file instructing Cline sessions on bundle team coordination, manifest path, and role delegations.
4. **Team Manifest** (`.cline/agents-united/teams/<bundle>.yaml`): Declarative manifest specifying coordinator role, specialist roles, skills, recommended addons, integrity mode, and fallback strategies.
_Avoid_: Single-role Cline mirror, unmanaged rule drop

**Coordinator Role Projection**:
The primary orchestrator role projected into `.cline/agents/` acting as the team's central dispatcher, responsible for decomposing vertical slices, reading team manifests, and routing specialized work to role definitions.
_Avoid_: Master agent, boss prompt

**Team Manifest**:
The authoritative YAML document (`.cline/agents-united/teams/<bundle>.yaml`) declaring team membership, role descriptions, required skills, recommended addon bundles, and execution integrity modes (`strict`, `balanced`, `development`).
_Avoid_: Config file, prompt snippet

**Runtime Activation**:
The CLI execution lifecycle (`agents start <bundle> [prompt]` or `agents add --start`) that discovers local workspace/global installations, checks Cline compound projections, validates local binary capabilities, constructs safe non-shell evaluated argument arrays, and launches the host assistant session.
_Avoid_: Shell wrapper, blind launcher

**Host Capability Probe**:
A side-effect-free, read-only probing engine (`ClineCapabilityProbe`) that validates binary presence, queries semantic versioning, and performs safe parser checks (e.g. `--team-name` validation) under strict timeouts without spawning interactive sessions or mutating workspace files.
_Avoid_: Blind execution, shell check

**Activation Strategy**:
The dynamically selected session launch strategy:
- `named-team`: Uses `--team-name <team>` with stable deterministic identifiers (`au-<bundle>-<hash8>`) when supported by the host CLI.
- `adaptive-session`: Falls back to standard session initialization with embedded bootstrap prompts referencing coordinator role and team manifest paths.
_Avoid_: Hard-coded command line, brittle argv

**Addon Consent Policy**:
The security and permission policy governing recommended addons during runtime execution. In default mode, coordinators are instructed to explain requirements and seek explicit user consent before executing `agents add <addon> -t cline -y`. Pre-authorization is granted ephemerally via `--allow-addons` without being persisted in lockfiles.
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
## Usage Examples

Universal install with fan-out to every supported runtime:

```bash
agents add software-engineering -t agents --fanout claude,cursor,cline,opencode,codex -y --copy
```

Produces the canonical `.agents/` tree (unchanged format) plus translated copies in
`.claude/agents/`, `.cursor/agents/`, `.cline/agents/` (plus compound skills, rules, and team manifest),
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

# Audit Cline runtime capabilities and compound projection status
agents doctor --host cline
```

Degradation in practice: `hooks:` / `permissionMode:` / `commandExecutionPolicy:` /
`mainAgent:` / `subagent:` / `type:` are Antigravity-only and do **not** execute in projected
(orchestrator) files — projected agents degrade to "system prompt + tool list" subagents, and
`invoke_subagent` orchestration is dropped with a warning outside Antigravity.
