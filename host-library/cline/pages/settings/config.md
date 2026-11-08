> ## Documentation Index
> Fetch the complete documentation index at: https://docs.cline.bot/llms.txt
> Use this file to discover all available pages before exploring further.

# Config

> Understand where Cline stores configuration and how global and project config work together.

Cline configuration lives in two scopes:

* **Global configuration** in `~/.cline/` (applies globally across all Cline applications, including IDE, CLI, and SDK)
* **Project configuration** in `.cline/` (applies only to the current workspace)

## Configuration Directory Layout

Cline stores shared configuration across a few well-known locations. The primary root is `~/.cline/`, with structured app state under `~/.cline/data/`:

```text theme={"system"}
~/.cline/
  data/
    settings/
      providers.json           # API keys and provider configuration
      global-settings.json     # Global settings
      cline_mcp_settings.json  # MCP settings
    teams/                     # Team state
    sessions/                  # One folder of messages per session
    db/                        # SQLite databases (sessions.db, cron.db, ...)
    logs/                      # CLI and hub logs
  rules/                       # Global rules
  workflows/                   # Global workflows
  hooks/                       # Global hooks
  skills/                      # Global skills
  agents/                      # Global agent definitions
  plugins/                     # Global plugins (.js, .ts)
  cron/                        # Global cron specs
```

Additional global search paths supported by the code:

```text theme={"system"}
~/Documents/Cline/
  Rules/                       # Additional global rules
  Hooks/                       # Additional global hooks
  Plugins/                     # Additional global plugins
  Workflows/                   # Additional global workflows
```

Project-level configuration lives in `.cline/` at your repository root:

```text theme={"system"}
.cline/
  rules/                       # Project rules
  workflows/                   # Project workflows
  skills/                      # Project skills
  hooks/                       # Lifecycle hooks
  agents/                      # Project agent definitions
  plugins/                     # Project plugins
```

Notes:

* Global provider settings, global settings, and MCP settings are stored under `~/.cline/data/settings/`.
* Global rules, workflows, hooks, skills, agents, plugins, and cron specs resolve directly under `~/.cline/`.
* Rules, hooks, plugins, and workflows may also be discovered from `~/Documents/Cline/` for compatibility.
* In a project, Cline also reads the older `.clinerules/` layout (rules, plus its `workflows/`, `skills/` and `hooks/` folders), `AGENTS.md` at the project root, and skills in `.agents/skills/`. Globally, it also reads `~/.agents/AGENTS.md` and skills in `~/.agents/skills/`.

## What Goes Where?

* Use **global (`~/.cline/`)** for defaults shared across all Cline applications (IDE, CLI, SDK) on your machine.
* Use **project (`.cline/`)** for team-shared behavior that should travel with the repo.

Commit `.cline/` files you want to share with your team. Keep secrets out of the repo.

## Configure Through the CLI

Use the interactive config UI:

```bash theme={"system"}
cline config
```

From there, you can view/edit:

* Settings (global + workspace)
* Rules
* Skills
* Hooks

## Useful Configuration Commands

Use a custom configuration directory:

```bash theme={"system"}
cline --config /path/to/custom/config "your task"
```

Or via environment variable:

```bash theme={"system"}
export CLINE_DIR=/path/to/custom/config
cline "your task"
```

Open the CLI log file (`~/.cline/data/logs/cline.log`, or the file `CLINE_LOG_PATH` names) when troubleshooting:

```bash theme={"system"}
cline doctor log
```

## Environment Variables

| Variable | Description |
| - | - |
| `CLINE_DIR` | Custom configuration directory (replaces `~/.cline/`), like `--config` |
| `CLINE_DATA_DIR` | Custom data directory (replaces `~/.cline/data/`) |
| `CLINE_HUB_PORT` | Port of the local hub (default: `25463`) |
| `CLINE_HUB_ADDRESS` | Hub address for `cline schedule` commands, like their `--address` option |
| `CLINE_SESSION_BACKEND_MODE` | Force backend mode (`local`, `hub`, `remote`, `auto`) |
| `CLINE_SANDBOX` | Enable sandbox mode |
| `CLINE_SANDBOX_DATA_DIR` | Sandbox session storage directory |
| `CLINE_HOOKS_DIR` | Additional hooks directory |
| `CLINE_LOG_PATH` | CLI log file (default: `~/.cline/data/logs/cline.log`). `cline doctor log` opens it |

### CLINE\_DATA\_DIR

```bash theme={"system"}
export CLINE_DATA_DIR=/custom/path/to/cline
cline "your task"
```

## Related Docs

* [Rules](https://docs.cline.bot/customization/cline-rules.md)
* [Skills](https://docs.cline.bot/customization/skills.md)
* [Hooks](https://docs.cline.bot/customization/hooks.md)
* [Plugins](https://docs.cline.bot/customization/plugins.md)
* [.clineignore](https://docs.cline.bot/customization/clineignore.md) (deprecated)

## Security Notes

> [!WARNING]
>
> Only use rules, hooks, skills, and plugins from sources you trust.

Hooks and plugins can execute code. Review them like any other executable artifact before adding them globally or to a project.


This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.
