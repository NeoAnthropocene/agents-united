---
host: cline
artifact: settings
reviewedAgainst: "4.1.22"
---

# Cline — authoring guide: configuration and the CLI

Distilled from the snapshots in `host-library/cline/pages/`. Primary sources: [config](../pages/settings/config.md), [cli-reference](../pages/settings/cli-reference.md).

## Rules

### Scopes and layout

- **Configuration has two scopes: global `~/.cline/` (shared by the IDE, CLI and SDK) and project `.cline/` (this workspace only).** Commit the `.cline/` files meant for the team and keep secrets out of the repo. [Config](../pages/settings/config.md#config), [What goes where](../pages/settings/config.md#what-goes-where)
- **Project `.cline/` holds `rules/`, `skills/`, `hooks/`, `agents/`, `plugins/` and `cron/`; global `~/.cline/` holds the same plus `data/` (settings, teams, sessions, workflows).** Rules, hooks and plugins may also be discovered under `~/Documents/Cline/`. [Configuration directory layout](../pages/settings/config.md#configuration-directory-layout)
- **Provider keys and global settings live under `~/.cline/data/settings/`** (`providers.json`, `global-settings.json`, `cline_mcp_settings.json`). [Configuration directory layout](../pages/settings/config.md#configuration-directory-layout)
- **`cline config` is the interactive view of settings, rules, skills and hooks;** `cline doctor` diagnoses and fixes configuration issues. [Configure through the CLI](../pages/settings/config.md#configure-through-the-cli), [doctor](../pages/settings/cli-reference.md#doctor)

### Environment and flags

- **`CLINE_DATA_DIR` replaces the data directory, `CLINE_HOOKS_DIR` adds a hooks directory and `CLINE_COMMAND_PERMISSIONS` restricts shell commands.** `--config` and `--data-dir` set the same things per run, and `--data-dir` gives isolated local state, which suits a test run. [Environment variables](../pages/settings/config.md#environment-variables), [Useful configuration commands](../pages/settings/config.md#useful-configuration-commands), [Global options](../pages/settings/cli-reference.md#global-options)
- **Flags that matter for automation: `-p` (plan mode), `--json` (one JSON message per line), `--auto-approve <boolean>`, `-t` (timeout seconds), `-m` (model), `-P` (provider, default `cline`), `-k` (API key for the run), `--thinking`, `-c` (working directory) and `--hooks-dir`.** A bare prompt starts in act mode with auto-approve on. [Global options](../pages/settings/cli-reference.md#global-options), [Help menu (source of truth)](../pages/settings/cli-reference.md#help-menu-source-of-truth), [JSON output format](../pages/settings/cli-reference.md#json-output-format)
- **`cline plugin`, `cline mcp`, `cline schedule`, `cline hook` and `cline hub` manage plugins, MCP servers, schedules, hook payloads and the local hub daemon.** [Commands](../pages/settings/cli-reference.md#commands)

### Trust

- **Only use rules, hooks, skills and plugins from sources you trust; hooks and plugins can execute code.** Review them like any executable artifact before adding them globally or to a project. [Security notes](../pages/settings/config.md#security-notes)

## Authoring notes (agents-united, not host behaviour)

- A native package writes only under project `.cline/` and `.clinerules/` (and `.claude/skills/` is read too, see the skill guide); it never writes under `~/.cline/`, which is the user's. A global install, if ever wanted, is a separate decision.
- **Real-session runs on Cline:** the default provider is `cline`, an account that may be billed, and a headless run auto-approves all tools by default. Before the first run, tell the maintainer which provider and account it would use and the rough cost (ADR 0026, decision 7), pass `--auto-approve` deliberately, use `--data-dir` for isolated state and `--json` to read the result.
