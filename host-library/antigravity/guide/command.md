---
host: antigravity
artifact: command
reviewedAgainst: "2.0 2.18.1, CLI 1.2.11, IDE 2.5.5, SDK 0.1.18"
---

# Antigravity — authoring guide: slash commands and workflows

Distilled from the snapshots in `host-library/antigravity/pages/`. Primary sources: [slash commands](../pages/command/slash-commands.md), [CLI reference](../pages/settings/cli-reference.md). Supporting sources: [skills](../pages/skill/skills.md), [IDE workflows](../pages/orchestration/ide-workflows.md), [the `/agents` command](../pages/command/cli-agents-command.md).

## Rules

### Built-in commands

- **Public slash commands are the same across 2.0 and the CLI: `/boost`, `/teamwork-preview`, `/goal`, `/plan`, `/grill-me`, `/learn`, `/plugin`, `/schedule`, `/browser` and `/btw`.** Type `/` to open the menu. [Command catalog](../pages/command/slash-commands.md#command-catalog), [Cross-surface compatibility](../pages/command/slash-commands.md#cross-surface-compatibility)
- **The CLI adds its own commands (`/agents`, `/hooks`, `/mcp`, `/skills`, `/permissions`, `/config`, `/tasks`, `/fork`, `/resume`, `/planning` and more).** [Core slash commands](../pages/settings/cli-reference.md#core-slash-commands)
- **`/grill-me` interviews the user before code is written, and `/plan` produces a reviewable plan artifact.** [/grill-me](../pages/command/slash-commands.md#grill-me), [/plan](../pages/command/slash-commands.md#plan)

### Commands from skills

- **Every skill becomes a slash command named after it** (`/<skill-name>` in 2.0, and automatically in the CLI). [Invoking skills in Antigravity 2.0](../pages/skill/skills.md#invoking-skills-in-antigravity-20), [Slash command conversion](../pages/skill/skills.md#slash-command-conversion)
- **A plugin can bundle skills, so its commands arrive with it; `/plugin` itself manages and scaffolds plugins.** [/plugin](../pages/command/slash-commands.md#plugin)

### Workflows (being retired)

- **Workflows are markdown files, run as `/workflow-name`, may call other workflows, and are limited to 12,000 characters each.** [Workflows](../pages/orchestration/ide-workflows.md#workflows)
- **Workflows are deprecated in favour of skills by November 1, 2026,** and `/migrate-workflows` converts existing ones. [Workflows](../pages/orchestration/ide-workflows.md#workflows)

## Authoring notes (agents-united, not host behaviour)

- **Do not author new workflows for Antigravity.** The deprecation date is a month away, ADR 0016 already moved this repository's `workflow-*` runbooks into skills, and every skill is already a slash command, so a skill-form `workflow-*` needs no extra command artifact. The multi-agent runbooks stay skills here.
- **Names must not collide with the built-ins** (`boost`, `plan`, `goal`, `learn`, `schedule`, `browser`, `btw`, `plugin`, `grill-me`, `teamwork-preview`, and the CLI set). This repository ships a skill named `grill-me` that shares a name with the built-in `/grill-me`; which wins is not documented and unverified, so the package should either keep the name and say so, or not rely on the slash form.
- **There is no documented file format for a user-defined slash command other than a skill** (and a workflow, until it is removed); do not invent a `commands/` folder.
- **Not verified:** whether a headless `agy -p "/skill"` expands a skill (the CLI has `--disable-slash-commands` for print mode, which implies it does by default), and the Antigravity 2.0 behaviour when a skill and a built-in share a name.
