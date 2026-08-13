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
A modular capability folder containing a `SKILL.md` file with YAML progressive disclosure frontmatter, runbooks, and reference assets.
_Avoid_: Action, toolset, capability-pack

**Workflow**:
A multi-step procedural template or interactive orchestration prompt (`workflow-<task>.md`) defining deterministic phase transitions.
_Avoid_: Pipeline, playbook, recipe

**Rule**:
A persistent guideline or constraint file (`GEMINI.md`, `AGENTS.md`, or `.agents/rules/*.md`) injected hierarchically into agent contexts.
_Avoid_: System prompt snippet, instruction file

**Bundle**:
A curated, named package grouping an orchestrator agent, sub-agents, skills, workflows, and rules tailored for a specific discipline (e.g., `software-engineering`, `system-architecture`, `product-design`, `growth-marketing`, `security-operations`, `deep-research`, `business-strategy`, `full`).
_Avoid_: Plugin pack, preset, collection

### Runtime & Configuration

**Scoped Safety Policy**:
An agent-level configuration header (`permissionMode: acceptEdits`, `commandExecutionPolicy: auto | request-review | strict`) defining autonomous execution boundaries without constant human approval prompts.
_Avoid_: Sandbox mode, safety toggle

**Nested Lifecycle Hooks**:
Event-driven interceptors (`PreInvocation`, `PostInvocation`, `PreToolUse`, `PostToolUse` with tool matchers) embedded in YAML frontmatter to validate environments, enforce pre-conditions, and run automated post-tool verifications.
_Avoid_: Middleware, interceptors, triggers

**Installation Scope**:
The target location where items are installed—either `workspace` (project-local `.agents/`) or `global` (user-level configuration directory e.g. `~/.gemini/config/`).
_Avoid_: Local/global flag, install mode

**Target Agent Platform**:
The host agent execution environment (e.g., Antigravity 2.0 Desktop/CLI, Claude Code, Cursor, Codex) that consumes the installed definitions.
_Avoid_: IDE, client, tool host

**Registry Manifest**:
The authoritative index (`manifest.json` / registry metadata) mapping bundles, agents, skills, workflows, and rules to their sources, versions, and dependencies.
_Avoid_: Package lock, catalog database
