# Agents United

A universal package manager and registry CLI for open AI agents, skills, workflows, and rules across agent ecosystems (Antigravity 2.0, Claude, Cursor, Windsurf, Codex).

## Language

### Core Primitives

**Orchestrator Agent**:
A primary agent (`orchestrator-<bundle>.md` or `orchestrator-<task>.md`) with `mainAgent: true` and `subagent: true` configured to coordinate high-level tasks, delegate to specialized sub-agents, and execute multi-step workflows.
_Avoid_: Master agent, boss, coordinator bot

**Sub-Agent**:
A task-specialized worker agent (`subagent-<role>.md`) with `subagent: true` (and `mainAgent: false` or `true`) equipped with domain-specific tools, scoped safety policies, and nested lifecycle hooks.
_Avoid_: Child agent, slave agent, helper script

**Skill**:
A modular capability folder containing a `SKILL.md` file with progressive disclosure frontmatter (`name`, `description`, `metadata: { author, version }`), execution runbooks, code exemplars, and error recovery procedures.
_Avoid_: Action, toolset, capability-pack

**Workflow**:
A multi-step procedural template or interactive orchestration prompt (`workflow-<task>.md`) defining deterministic phase transitions, verification gates, and rollback protocols.
_Avoid_: Pipeline, playbook, recipe

**Rule**:
A persistent guideline or constraint file (`GEMINI.md`, `AGENTS.md`, or `.agents/rules/*.md`) injected hierarchically into agent contexts (e.g. Git Guardrails, Skill Attribution Standard).
_Avoid_: System prompt snippet, instruction file

**Bundle**:
A curated, named package grouping an orchestrator agent, sub-agents, skills, workflows, and rules tailored for a specific discipline (e.g., `software-engineering`, `system-architecture`, `product-design`, `growth-marketing`, `security-operations`, `deep-research`, `business-strategy`, `full`).
_Avoid_: Plugin pack, preset, collection

### Alignment & Domain Skills

**Grill With Docs (`grill-with-docs`)**:
An interactive Socratic grilling skill tailored for **coding & engineering domains**. It rigorously interrogates technical requirements, generates Architectural Decision Records (ADRs under `docs/adr/`), and **automatically triggers `CONTEXT.md` updates** to register newly identified domain terms and primitives into the ubiquitous language dictionary.
_Avoid_: Code interview, prompt grilling

**Grill Me (`grill-me`)**:
A pure Socratic alignment skill for **non-code and high-level strategy domains**. Interrogates problem framing, user goals, and constraints without generating code artifacts or ADRs.
_Avoid_: General quiz, bot chat

**Domain Modeling (`domain-modeling`)**:
The capability that structures, defines, and refines domain entities and ubiquitous language in `CONTEXT.md`.

**Skill Attribution Standard**:
A mandatory rule requiring all skills adopted from external creators to specify `metadata.author` and `metadata.source` in their YAML frontmatter, and maintain formal acknowledgment in `README.md` under `## Credits & Acknowledgments`.
_Avoid_: Uncredited fork, silent copy

### Runtime & Configuration

**Scoped Safety Policy**:
An agent-level configuration header (`permissionMode: acceptEdits`, `commandExecutionPolicy: auto | ask | never`) defining autonomous execution boundaries without constant human approval prompts.
_Avoid_: Sandbox mode, safety toggle

**Git Guardrails**:
A persistent safety rule preventing agents from committing directly to protected branches (`main`, `master`), executing force-pushes, or staging unencrypted secrets.
_Avoid_: Git hook hack, commit blocker

**Nested Lifecycle Hooks**:
Event-driven interceptors (`PreInvocation`, `PostInvocation`, `PreToolUse`, `PostToolUse` with tool matchers) embedded in YAML frontmatter to validate environments, enforce pre-conditions, and run automated post-tool verifications.
_Avoid_: Middleware, interceptors, triggers

**Installation Scope**:
The target visibility and location where assets are installed:
- **Project Scope** (default): Stored inside the repository (`./.agents/`, `./.gemini/`, `./.claude/`, `./.cursor/`), tracked in git, and shared across the team with lockfile verification.
- **Global Scope** (`-g`, `--global`): Stored in the user home directory (`~/.agents/`, `~/.gemini/config/`, `~/.claude/`), available across every workspace on the developer machine.
_Avoid_: Local/global toggle, install mode

**Installation Method**:
The mechanism used to link or replicate files into target directories:
- **Symlink Mode** (`-s`, `--symlink`, Recommended): Creates symbolic links (or directory junctions on Windows) to a canonical registry cache. Serves as a single source of truth; package updates reflect instantly without file duplication.
- **Copy Mode** (`--copy`): Creates independent physical copies of all asset files in the destination directory, enabling local modifications and isolated edits.
_Avoid_: File clone, hard copy

**Multi-Agent Target Host**:
The specific agent environments targeted for deployment:
- **Universal Agents** (`agents`): `./.agents/` or `~/.agents/`
- **Antigravity 2.0 / Gemini** (`gemini`): `./.gemini/` or `~/.gemini/config/`
- **Claude Code** (`claude`): `./.claude/` or `~/.claude/`
- **Cursor / Codex** (`cursor`): `./.cursor/` or `~/.cursor/`
_Avoid_: IDE client, bot host

**Lockfile (`agents-united.json`)**:
The machine-generated manifest stored at the root of target agent directories, recording installed bundles, assets, installation methods, scopes, and target host mappings to guarantee deterministic reproducibility.
_Avoid_: Package lock, state file

**Health Doctor**:
The verification engine (`node dist/cli.js doctor`) that scans installed agent directories, validating frontmatter schema compliance, lifecycle hook configurations, file integrity, and lockfile synchronization.
_Avoid_: Linter, sanity checker

**Registry Manifest**:
The authoritative index (`bundles.json`) mapping bundles, agents, skills, workflows, and rules to their sources, versions, and dependencies.
_Avoid_: Catalog database, package registry

