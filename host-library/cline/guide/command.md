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
- **Workflows (ADR 0013, [observations](../observations/2026-10-02-cli-3.0.68.md)):** ADR 0013 records `.cline/workflows/<slug>.md` and `.clinerules/workflows/` as `/<slug>` slash commands (verified on CLI 3.0.61 from the source and the binary), the legacy lane already writes them, and `cline config workflows` lists them on 3.0.68. Headless invocation could not be tested (a prompt starting with `/` is rejected by the CLI's argument parser), so the doctor marks them "listed, invocation unverified". They are the natural home for our multi-agent `workflow-*` runbooks next to the skill form.
- **A workflow file has no folder, and its paths resolve against the process's working directory (CLI 3.0.68, read from the source, [observations](../observations/2026-10-05-cli-3.0.68-workflow-paths.md)):** the file-read tool takes an absolute path or one relative to `cwd` and does not expand `~`, so a relative link to a skill's `examples/` does not reach it. The projection of a workflow skill names the installed copy instead (`.agents/skills/<name>/<file>` from the project root, absolute in the global scope; ADR 0016 amendment). The same source searches `~/.cline/workflows` for global workflows, which is where a global install writes them, while the config page of the docs snapshot says `~/.cline/data/workflows/`; that path is not in the build's list. Nothing here was run.
