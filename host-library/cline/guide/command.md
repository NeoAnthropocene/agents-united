---
host: cline
artifact: command
reviewedAgainst: "4.1.22"
---

# Cline — authoring guide: slash commands

Distilled from the snapshots in `host-library/cline/pages/`. Primary source: [using-commands](../pages/command/using-commands.md). Supporting sources: [skills](../pages/skill/skills.md), [sdk-plugins](../pages/plugin/sdk-plugins.md).

Cline has no documented file format for a user-defined slash command. A package reaches the `/` menu through skills (every enabled skill is a command) and, on the CLI only, through plugins.

## Rules

### Built-in commands

- **The built-in slash commands are `/newtask`, `/smol`, `/newrule`, `/deep-planning` and `/reportbug`.** Type `/` in the chat input to list them. [Slash commands](../pages/command/using-commands.md#slash-commands)
- **`/newtask` hands the work to a fresh task with distilled context, and `/smol` (alias `/compact`) compresses the current conversation in place.** Use `/newtask` when the context is mostly tool-call noise and `/smol` to continue in the same task. [/newtask](../pages/command/using-commands.md#newtask), [/smol](../pages/command/using-commands.md#smol)
- **`/deep-planning` runs a four-step plan: silent investigation, discussion, an `implementation_plan.md`, then a task with trackable steps.** It fits changes that touch many parts of a codebase. [/deep-planning](../pages/command/using-commands.md#deep-planning)
- **`/newrule` creates a rule file in `.clinerules` interactively.** [/newrule](../pages/command/using-commands.md#newrule)

### Commands from skills and plugins

- **Any enabled skill is a slash command named after the skill.** Selecting it loads that skill's `SKILL.md` instructions for the task, the fast path to skill-specific guidance. [Skills via slash commands](../pages/command/using-commands.md#skills-via-slash-commands), [Triggering skills with slash commands](../pages/skill/skills.md#triggering-skills-with-slash-commands)
- **A plugin can register slash commands (the Command extension point) to give users a manually triggered action.** Plugins apply to the SDK, CLI and Kanban only. [Extension glossary](../pages/plugin/sdk-plugins.md#extension-glossary), [Plugins](../pages/plugin/plugins.md#plugins)

## Authoring notes (agents-united, not host behaviour)

- Our `workflow-*` skills become `/workflow-<task>` commands simply by being skills in `.cline/skills/`, the same shape as on Claude, so a skill-only workflow needs no extra command artifact on Cline.
- Do not invent a `commands/` folder for Cline: nothing in the library documents one.
- A skill named like a built-in (`newtask`, `smol`, `newrule`, `deep-planning`, `reportbug`) would collide in the `/` menu, and the docs do not say which wins, so the package never uses those names.
- **Observed ([observations](../observations/2026-10-02-cli-3.0.68.md)):** `cline config workflows` lists markdown files in `.clinerules/workflows/` and `.cline/workflows/`, which is probably where a `/name` workflow lives and a natural home for our `workflow-*` runbooks. It could not be confirmed: a prompt starting with `/` is rejected by the CLI's argument parser, so invocation was not testable headless.
