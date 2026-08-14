# Agents United

A universal package manager and registry CLI for open AI agents, skills, workflows, and rules across agent ecosystems (Antigravity 2.0, Claude Code, Cursor, Windsurf, Codex).

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

**Essentials Bundle**:
The base foundational bundle of a department domain (e.g. `software-engineering`, `system-architecture`) providing core orchestrators, fundamental skills (TDD, debugging, code review), and master workflows.
_Avoid_: Base pack, core bundle

**Inherited Sub-Team Bundle**:
A specialized sub-team bundle that extends an Essentials bundle via `parentBundle` inheritance (e.g. `mobile-development`, `frontend-engineering`, `backend-distributed-systems`, `qa-automation`, `devops-engineering`, `sysops-sre`), inheriting base capabilities without duplicating asset definitions.
_Avoid_: Child bundle, sub-plugin

**Dual-Bridge Operational Model**:
The architectural separation of delivery and reliability operations:
- **DevOps (`devops-engineering`)**: Sits under `Software Engineering` as the *Delivery Bridge* for developer velocity, CI/CD pipelines, containerization, and preview deployments.
- **SysOps & SRE (`sysops-sre`)**: Sits under `System Architecture` as the *Reliability Bridge* for 99.999% uptime, Prometheus/Grafana telemetry, incident response, and disaster recovery.

**Domain-Level Installation (`domain:<name>`)**:
A batch installation resolution mechanism allowing users to install an entire department domain (e.g. `domain:engineering`, `domain:architecture`) in a single command, recursively aggregating all agents, skills, and workflows across every sub-team under that domain with confirmation safeguards.

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
- **Tier 1 (Feature Coverage)**: Happy path validation of exported functions, interfaces, and expected return types.
- **Tier 2 (Boundary & Corner Cases)**: Negative testing covering empty inputs, malformed files, invalid enums, and graceful error handling.
- **Tier 3 (Cross-Feature Pairwise)**: Interoperability testing between Registry, Installer, Adapters, Lockfile Engine, and CLI.
- **Tier 4 (Full Real-World Scenarios)**: End-to-end catalog audits over all 13 bundles, 38 agents, 65 skills, and 54 workflows.

**Deterministic Verification**:
Testing practices that eliminate arbitrary timeouts (`setTimeout`) in favor of auto-waiting assertions, isolated test workspaces, predictable mock factories, and clean teardowns.

---

### Runtime & Configuration

**Scoped Safety Policy**:
An agent-level configuration header (`permissionMode: acceptEdits`, `commandExecutionPolicy: auto | ask | never`) defining autonomous execution boundaries without constant human approval prompts.
_Avoid_: Sandbox mode, safety toggle

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
_Avoid_: Local/global toggle, install mode

**Installation Method**:
The mechanism used to link or replicate files into target directories:
- **Symlink Mode** (`-s`, `--symlink`, Recommended): Creates symbolic links (or directory junctions on Windows) to a canonical registry cache. Serves as a single source of truth; package updates reflect instantly without file duplication.
- **Copy Mode** (`--copy`): Creates independent physical copies of all asset files in the destination directory, enabling local modifications and offline isolated edits.
_Avoid_: File clone, hard copy

**Multi-Agent Target Host**:
The specific agent environments targeted for deployment:
- **Universal Multi-Agent** (`agents`): `./.agents/` or `~/.agents/`
- **Antigravity 2.0 / Gemini** (`gemini`): `./.gemini/` or `~/.gemini/config/`
- **Claude Code** (`claude`): `./.claude/` or `~/.claude/`
- **Cursor / Codex** (`cursor`): `./.cursor/` or `~/.cursor/`
_Avoid_: IDE client, bot host

**Lockfile (`agents-united.json`)**:
The machine-generated manifest stored at the root of target agent directories, recording installed bundles, assets, installation methods, scopes, and target host mappings to guarantee deterministic reproducibility.
_Avoid_: Package lock, state file

**Health Doctor**:
The diagnostic engine (`agents doctor` / `node dist/cli.js doctor`) that scans installed agent directories, validating frontmatter schema compliance, lifecycle hook configurations, file integrity, and lockfile synchronization.
_Avoid_: Linter, sanity checker

**Registry Manifest**:
The authoritative index (`bundles.json`) mapping bundles, agents, skills, workflows, and rules to their sources, versions, aliases, domains, and parent inheritance relationships.
_Avoid_: Catalog database, package registry
