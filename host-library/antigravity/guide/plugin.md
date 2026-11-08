---
host: antigravity
artifact: plugin
reviewedAgainst: "Documentation fetched 2026-11-06; runtime unverified"
---

# Antigravity — authoring guide: plugins and the marketplace

Distilled from the snapshots in `host-library/antigravity/pages/`. Primary sources: [plugins](../pages/plugin/plugins.md), [marketplace](../pages/plugin/marketplace.md). Supporting sources: [skills](../pages/skill/skills.md), [rules](../pages/rule/rules.md), [sidecars](../pages/orchestration/sidecars.md).

A plugin is the host's distribution package. Native output (Plan 032, Phase 8) may include a plugin form of a bundle, built from the same committed native files, never a different behavioural source.

## Rules

### Structure

- **Plugins bundle skills, MCP servers, custom agents, rules and lifecycle hooks.** The current page directs plugin authors to a separate build guide; its manifest schema is not included in this snapshot and is unverified here. [What a plugin bundles](../pages/plugin/plugins.md#what-a-plugin-bundles)
- **Plugins can also carry sidecars (`sidecars/<name>/sidecar.json`) under `~/.gemini/config/plugins/<pluginName>/`.** [Configuration](../pages/orchestration/sidecars.md#configuration)

### Installing and managing

- **Install by placing the folder in `.agents/plugins/` (workspace) or `~/.gemini/config/plugins/` (global); the same locations apply to 2.0 and the IDE.** [Manual plugin installation](../pages/plugin/plugins.md#manual-plugin-installation), [Standalone IDE plugin installation](../pages/plugin/plugins.md#standalone-ide-plugin-installation)
- **In the CLI, `agy plugin list | install <path> | enable | disable | uninstall` works from the shell, and `/plugin` (alias `/plugins`) does the same inline and opens the Plugins Manager; an installed CLI plugin is staged under `~/.gemini/antigravity-cli/plugins/<plugin_name>/`.** [CLI shell subcommands (`agy plugin`)](../pages/plugin/plugins.md#cli-shell-subcommands-agy-plugin), [CLI filesystem location](../pages/plugin/plugins.md#cli-filesystem-location), [Inline `/plugin` commands](../pages/plugin/marketplace.md#inline-plugin-commands)
- **Marketplace plugins install with `/plugin install <plugin-name>@<marketplace-name>`; plugins installed in 2.0 sync to the CLI's Installed tab.** [Inline `/plugin` commands](../pages/plugin/marketplace.md#inline-plugin-commands), [Marketplace and bundled plugins](../pages/plugin/plugins.md#managing-plugins-by-surface)

## Authoring notes (agents-united, not host behaviour)

- **Avoid overwriting another lane's plugin manifest.** The current snapshot no longer specifies its full schema; confirm the separate build guide before authoring one.
- **A plugin's hooks and agents carry the same constraints as loose ones:** the native lane omits agent-frontmatter `hooks:` following the agy 1.2.14 observation (plan 031; current behavior unverified), and a packaged `hooks.json` is real guard code that passes the audit gate.
- **Not verified:** whether a project-level plugin in `.agents/plugins/` loads in a headless `agy -p` run, how enable and disable state is stored for a manually placed plugin, and whether a packaged agent is discovered by name.
- Release notes (`agy changelog`, 1.2.11) say a plugin placed directly in `~/.gemini/config/plugins` whose MCP server needs configuration variables starts disabled until enabled; a package that needs configuration must say so.
