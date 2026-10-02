---
host: antigravity
artifact: plugin
reviewedAgainst: "2.0 2.18.1, CLI 1.2.11, IDE 2.5.5, SDK 0.1.18"
---

# Antigravity — authoring guide: plugins and the marketplace

Distilled from the snapshots in `host-library/antigravity/pages/`. Primary sources: [plugins](../pages/plugin/plugins.md), [marketplace](../pages/plugin/marketplace.md). Supporting sources: [skills](../pages/skill/skills.md), [rules](../pages/rule/rules.md), [sidecars](../pages/orchestration/sidecars.md).

A plugin is the host's distribution package. Native output (Plan 032, Phase 8) may include a plugin form of a bundle, built from the same committed native files, never a different behavioural source.

## Rules

### Structure

- **A plugin is a directory with a required `plugin.json` and optional `mcp_config.json`, `hooks.json`, `skills/`, `agents/` and `rules/`.** [Directory structure](../pages/plugin/plugins.md#directory-structure), [Supported components](../pages/plugin/plugins.md#supported-components)
- **`plugin.json` has only `name` (letters, digits, hyphen, underscore; required by the CLI, defaulting to the folder name in 2.0 and the IDE) and `description`; the schema forbids other properties.** Add `$schema` for editor validation. [Manifest file (`plugin.json`)](../pages/plugin/plugins.md#manifest-file-pluginjson), [Field reference](../pages/plugin/plugins.md#field-reference), [Full JSON Schema](../pages/plugin/plugins.md#full-json-schema)
- **Plugins can also carry sidecars (`sidecars/<name>/sidecar.json`) under `~/.gemini/config/plugins/<pluginName>/`.** [Configuration](../pages/orchestration/sidecars.md#configuration)

### Installing and managing

- **Install by placing the folder in `.agents/plugins/` (workspace) or `~/.gemini/config/plugins/` (global); the same locations apply to 2.0 and the IDE.** [Manual plugin installation](../pages/plugin/plugins.md#manual-plugin-installation), [Standalone IDE plugin installation](../pages/plugin/plugins.md#standalone-ide-plugin-installation)
- **In the CLI, `agy plugin list | install <path> | enable | disable | uninstall` works from the shell, and `/plugin` (alias `/plugins`) does the same inline and opens the Plugins Manager; an installed CLI plugin is staged under `~/.gemini/antigravity-cli/plugins/<plugin_name>/`.** [CLI shell subcommands (`agy plugin`)](../pages/plugin/plugins.md#cli-shell-subcommands-agy-plugin), [CLI filesystem location](../pages/plugin/plugins.md#cli-filesystem-location), [Inline `/plugin` commands](../pages/plugin/marketplace.md#inline-plugin-commands)
- **Marketplace plugins install with `/plugin install <plugin-name>@<marketplace-name>`; plugins installed in 2.0 sync to the CLI's Installed tab.** [Inline `/plugin` commands](../pages/plugin/marketplace.md#inline-plugin-commands), [Marketplace and bundled plugins](../pages/plugin/plugins.md#marketplace-and-bundled-plugins)

## Authoring notes (agents-united, not host behaviour)

- **`.agents/plugins/<bundle>/plugin.json` is already a path this repository writes** (the Agent Plugins manifest of the legacy Cline lane, with a `$schema` pointing at agent-plugins.org). The Antigravity manifest is a different schema (`additionalProperties: false`, its own `$schema` URL), so the two cannot share one file: a plugin for this host is generated from the Antigravity guide, and the shared directory means an install must not overwrite a Cline-lane manifest.
- **A plugin's hooks and agents carry the same constraints as loose ones:** no frontmatter `hooks:` in a packaged agent (plan 031), and a packaged `hooks.json` is real guard code that passes the audit gate.
- **Not verified:** whether a project-level plugin in `.agents/plugins/` loads in a headless `agy -p` run, how enable and disable state is stored for a manually placed plugin, and whether a packaged agent is discovered by name.
- Release notes (`agy changelog`, 1.2.11) say a plugin placed directly in `~/.gemini/config/plugins` whose MCP server needs configuration variables starts disabled until enabled; a package that needs configuration must say so.
