---
host: antigravity
artifact: settings
reviewedAgainst: "Documentation fetched 2026-11-06; runtime unverified"
---

# Antigravity — authoring guide: settings and configuration files

Distilled from the snapshots in `host-library/antigravity/pages/`. Primary sources: [settings](../pages/settings/settings.md), [CLI reference](../pages/settings/cli-reference.md). Supporting sources: [agent settings](../pages/agent/agent-settings.md), [permissions](../pages/permissions/permissions.md), [sandbox](../pages/permissions/sandbox.md).

## Rules

### Where settings live

- **Settings are global (account, permissions, appearance, model, customizations) or per project (folders, agent settings, project permissions); a standalone conversation has its own.** [The four settings categories](../pages/settings/settings.md#the-four-settings-categories), [Settings architecture](../pages/settings/settings.md#settings-architecture)
- **The CLI keeps preferences in `~/.gemini/antigravity-cli/settings.json`, writing only values that differ from the defaults; `/config` (alias `/settings`) edits them interactively and a flag such as `--sandbox` overrides one for a session.** [Configuration file location](../pages/settings/settings.md#configuration-file-location), [The interactive settings panel](../pages/settings/settings.md#the-interactive-settings-panel), [Command-line overrides](../pages/settings/settings.md#command-line-overrides)
- **Custom keybindings go in `~/.gemini/antigravity-cli/keybindings.json`; an invalid file falls back to defaults for those actions, and `cli.exit` and `cli.enter` cannot be disabled.** [Keybindings file location](../pages/settings/settings.md#keybindings-file-location), [Format and customization](../pages/settings/settings.md#format-and-customization)

### Keys that bear on a package

- **`toolPermission` is `request-review` (default), `proceed-in-sandbox`, `strict` or `always-proceed`; `artifactReviewPolicy` is `asks-for-review` (default), `agent-decides` or `always-proceed`; `enableTerminalSandbox` and `allowNonWorkspaceAccess` default to `false`.** [Safety and permissions](../pages/settings/settings.md#safety-and-permissions), [Configuration keys (`settings.json`)](../pages/settings/cli-reference.md#configuration-keys-settingsjson)
- **Strict mode forces command, browser-script and artifact review to Request Review, ignores the terminal allowlist, respects `.gitignore`, blocks files outside the workspace and turns the sandbox on without network.** [Strict mode](../pages/settings/settings.md#strict-mode)
- **Telemetry (`enableTelemetry`) defaults to on and is the user's choice.** [Data collection settings](../pages/settings/settings.md#data-collection-settings), [Configuration keys (`settings.json`)](../pages/settings/cli-reference.md#configuration-keys-settingsjson)
- **Rendering, colour, editor and notification keys are personal preferences with defaults listed in the CLI reference.** [Display and rendering](../pages/settings/settings.md#display-and-rendering), [Editor and notifications](../pages/settings/settings.md#editor-and-notifications)

### Per-surface data

- **The application data directory differs per surface: `~/.gemini/antigravity` (2.0), `~/.gemini/antigravity-cli` and `~/.gemini/antigravity-ide`.** [Common Input Fields](../pages/hook/hooks.md#common-input-fields)
- **Current App documentation describes updated and previous permission settings; which applies on Windows is unverified.** [Permission settings](../pages/agent/agent-settings.md#permission-settings), [Previous permission settings](../pages/agent/agent-settings.md#previous-permission-settings)

## Authoring notes (agents-united, not host behaviour)

- **A package writes no user settings.** `settings.json`, `keybindings.json` and the permission lists are the user's; changing them is a security-relevant act the package never performs, in line with the permission-preset rule for the other hosts (a preset is an explicit opt-in, never implied). The only host files a package writes are the ones the other guides describe: agents, skills, rules, hooks, an MCP fragment and a plugin.
- **The settings file lives under `~/.gemini/`, outside the repository,** so no test may touch it; any check reads it through an injectable path.
- **The two config directories are easy to confuse:** `~/.gemini/config/` holds customizations shared by 2.0 and the IDE (agents, skills, rules, hooks, MCP, plugins, sidecars), while `~/.gemini/antigravity-cli/` holds the CLI's own copy of skills, rules, plugins and `settings.json`. A global install has to say which it targets.
- The locked web changelog baseline is CLI 1.2.11 and the separate command changelog baseline is 1.2.16. `agy` was absent from PATH on 2026-11-06, so the installed version and current command changelog are unverified.
