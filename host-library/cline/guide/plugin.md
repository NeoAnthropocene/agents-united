---
host: cline
artifact: plugin
reviewedAgainst: "4.1.22"
---

# Cline — authoring guide: plugins

Distilled from the snapshots in `host-library/cline/pages/`. Primary sources: [plugins](../pages/plugin/plugins.md), [plugin-install](../pages/plugin/plugin-install.md). Supporting sources: [sdk-plugins](../pages/plugin/sdk-plugins.md), [writing-plugins](../pages/hook/writing-plugins.md), [config](../pages/settings/config.md).

Plugins apply to the Cline SDK, CLI and Kanban; the docs say they are not applicable to the VS Code and JetBrains extensions. A plugin is code, so ours go through the security audit gate (ADR 0025 decision 7).

## Rules

### Shape

- **A plugin is an `AgentPlugin`: a `name`, a `manifest` with `capabilities`, a `setup(api, ctx)` function and an optional `hooks` object.** A plugin file exports it as the default export (or a named export). [What is a plugin](../pages/plugin/sdk-plugins.md#what-is-a-plugin), [Plugin manifest format](../pages/plugin/plugins.md#plugin-manifest-format)
- **A plugin can bundle tools, hooks, commands, rules and events.** Register tools in `setup()`, not in a lifecycle hook, and keep `setup()` synchronous and fast because it runs before the first model call. [Extension glossary](../pages/plugin/sdk-plugins.md#extension-glossary), [Plugin design guidelines](../pages/hook/writing-plugins.md#plugin-design-guidelines)
- **Use a factory function when the plugin needs configuration, and export the object directly when it does not.** [Plugin design guidelines](../pages/hook/writing-plugins.md#plugin-design-guidelines)
- **A plugin is plain `.ts` or `.js`.** Entry files are `.ts` or `.js` that export an `AgentPlugin`. [Plugin manifest format](../pages/plugin/plugins.md#plugin-manifest-format)

### Packaging

- **A single-file plugin can import only Node builtins and `@cline/*`.** As soon as it needs another npm dependency it must ship as a package. [Distributing via CLI install](../pages/hook/writing-plugins.md#distributing-via-cli-install)
- **A package declares entry points in `package.json` under `cline.plugins`, each with `paths` and `capabilities`, or as a plain string path.** Without the field the installer auto-discovers entry points by scanning `.ts` and `.js` files, skipping `node_modules` and `.git`. [Plugin manifest format](../pages/plugin/plugins.md#plugin-manifest-format)
- **`@cline/sdk`, `@cline/core`, `@cline/agents`, `@cline/llms` and `@cline/shared` are provided by the host.** Declare any you import as an optional peer dependency; the installer strips `@cline/*` before running `npm install`. [Host-provided dependencies](../pages/plugin/plugins.md#host-provided-dependencies)
- **A package plugin can include skills in a top-level `skills/` directory next to `package.json`,** discovered automatically when the plugin is installed or loaded through `pluginPaths`. [Bundling skills](../pages/hook/writing-plugins.md#bundling-skills)

### Installing and locating

- **`cline plugin install <source>` (alias `cline plugin i`) installs from an HTTPS file URL, a git repository, an npm package or a local path.** Flags: `--npm`, `--git`, `--force`, `--json`, `--cwd`. Git installs can pin a ref with `@ref`. [CLI installation](../pages/plugin/plugin-install.md#cli-installation), [Options](../pages/plugin/plugin-install.md#options), [Installing plugins via CLI](../pages/plugin/plugins.md#installing-plugins-via-cli)
- **Global plugins live in `~/.cline/plugins/` (managed installs under `_installed/`); project plugins live in `.cline/plugins/`.** Use `--cwd .` to keep a plugin with one project, and the CLI auto-discovers project plugins when run in that project. [Plugin directory structure](../pages/plugin/plugins.md#plugin-directory-structure), [Find all your plugins from your file system](../pages/plugin/plugin-install.md#find-all-your-plugins-from-your-file-system)
- **After installing, confirm the plugin is loaded with `cline config` and its plugin tab.** [Installing plugins via CLI](../pages/plugin/plugins.md#installing-plugins-via-cli), [Listing installed plugins](../pages/plugin/plugin-install.md#listing-installed-plugins)
- **In SDK code, load plugins with `pluginPaths` (ClineCore), `plugins` (Agent runtime) or `extensions` (ClineCore).** `pluginPaths` also accepts a package directory and follows its `cline.plugins` entries. [Programmatic installation](../pages/plugin/plugin-install.md#programmatic-installation), [Using pluginPaths (ClineCore)](../pages/plugin/plugin-install.md#using-pluginpaths-clinecore)

### Trust

- **Review a plugin like any executable artifact before adding it globally or to a project.** Hooks and plugins can execute code. [Security notes](../pages/settings/config.md#security-notes)

## Authoring notes (agents-united, not host behaviour)

- The Cline guard plugin is a single `.js` file that imports only Node builtins and `@cline/*`, so it needs no `package.json`, no `npm install` and no dependency to audit. Install it by copying to `.cline/plugins/` (project) as the install lane does for every other artifact, and record its hash in the lockfile.
- Because plugins do not apply to the IDE extensions, the doctor delta table must show "guard: CLI only" for them. Never describe the guard as enforced in the extensions.
- **Observed ([observations](../observations/2026-10-02-cli-3.0.68.md)):** a project plugin dropped into `.cline/plugins/<name>.js` (one file, default export of an `AgentPlugin`, no imports) was discovered without `cline plugin install`, which keeps the guard plugin a plain copy by the install lane.
