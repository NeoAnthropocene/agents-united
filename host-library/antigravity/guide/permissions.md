---
host: antigravity
artifact: permissions
reviewedAgainst: "2.0 2.18.1, CLI 1.2.11, IDE 2.5.5, SDK 0.1.18"
---

# Antigravity — authoring guide: permissions, presets and the terminal sandbox

Distilled from the snapshots in `host-library/antigravity/pages/`. Primary sources: [permissions](../pages/permissions/permissions.md), [sandbox](../pages/permissions/sandbox.md). Supporting sources: [agent settings](../pages/agent/agent-settings.md), [settings](../pages/settings/settings.md), [CLI reference](../pages/settings/cli-reference.md), [SDK policies](../pages/tools/sdk-policies.md).

**Two systems exist, by platform.** The unified permission engine with presets is available on macOS and Linux; Windows still uses the previous system. Every rule below says which it applies to.

## Rules

### The engine (macOS and Linux; the rule model is the same on Windows)

- **Every sensitive operation is a permission resource, `action(target)`, checked against Deny, Ask and Allow lists, in that precedence order (Deny over Ask over Allow).** [Agent permissions](../pages/permissions/permissions.md#agent-permissions), [macOS & Linux](../pages/permissions/permissions.md#macos--linux)
- **The actions are `read_file`, `write_file`, `read_url`, `execute_url`, `command` and `mcp`; `*` matches everything in an action; `command(...)` matches a word prefix, or a regular expression with `regex:`.** [Supported Actions & Matching Rules](../pages/permissions/permissions.md#supported-actions--matching-rules)
- **A command is matched on the whole line, character for character, when it contains command substitution, process substitution, arithmetic, brace expansion, a non-literal command name, a network redirection, or a flag that runs subcommands (such as `git -c core.pager=` or `tar --to-command`); otherwise it falls back to Ask.** Ordinary pipelines, `&&` chains and wrappers such as `timeout` still prefix-match. [When Commands Require an Exact Match](../pages/permissions/permissions.md#when-commands-require-an-exact-match)
- **Allowing `write_file` on a path implies `read_file`, and denying `read_file` implies denying `write_file`.** [Implicit Permission Rules](../pages/permissions/permissions.md#implicit-permission-rules)
- **Unlisted actions fall back to defaults: workspace files are allowed, web reads and MCP tools ask, and under the Default preset commands run without asking inside the sandbox and ask outside it.** An explicit rule always beats a default. [Default System Behaviors & Guardrails](../pages/permissions/permissions.md#default-system-behaviors--guardrails)

### Presets and the sandbox

- **The preset is Default (sandbox on, workspace and temp access), Request Review (sandbox off, every command asks) or Turbo (everything allowed, full filesystem); allow, deny and ask rules are layered on top and win.** Set it under Settings → General → Permission Settings, or per project. [Permission Presets](../pages/permissions/permissions.md#permission-presets), [Permission Settings](../pages/agent/agent-settings.md#permission-settings)
- **The sandbox uses Linux namespaces or macOS `sandbox-exec`; commands see the project, temp and cache directories, system directories read-only, no `~/.ssh` or `.env`, and no network except domains granted under `read_url`.** Grants on `read_file` and `write_file` add read-only and read-write paths. [Terminal sandbox](../pages/permissions/sandbox.md#terminal-sandbox), [Permissions integration](../pages/permissions/sandbox.md#permissions-integration)
- **A command that cannot run in the sandbox is requested outside it and always asks, unless a `command` allow or deny rule covers it.** [Unsandboxed commands](../pages/permissions/sandbox.md#unsandboxed-commands)
- **A subagent inherits the parent's allowed command prefixes, file scopes and sandbox settings.** [Permissions and Configuration Inheritance](../pages/agent/subagents.md#permissions-and-configuration-inheritance)

### Windows and the CLI

- **On Windows the older system applies: a separate `unsandboxed(...)` action exists, "Terminal Command Auto Execution" has Request Review, Proceed in Sandbox and Always Proceed, and the sandbox is a preview toggle that no preset turns on.** [Windows](../pages/permissions/permissions.md#windows), [Terminal Command Auto Execution](../pages/agent/agent-settings.md#terminal-command-auto-execution), [Security presets](../pages/permissions/sandbox.md#security-presets)
- **The CLI keeps the same rules in `~/.gemini/antigravity-cli/settings.json` under `permissions.allow`, `deny` and `ask`, with `toolPermission` (`request-review`, `proceed-in-sandbox`, `strict`, `always-proceed`) and `enableTerminalSandbox` (default `false`).** `--sandbox` turns the sandbox on for one session. [CLI fine-grained permissions](../pages/permissions/permissions.md#cli-fine-grained-permissions), [CLI configuration examples](../pages/permissions/permissions.md#cli-configuration-examples), [Configuration keys (`settings.json`)](../pages/settings/cli-reference.md#configuration-keys-settingsjson), [CLI configuration](../pages/permissions/sandbox.md#cli-configuration)
- **In the SDK, a declarative policy list (`deny`, `allow`, `ask_user`) gates tool calls; custom functions and read-only tools are allowed by default and `run_command` needs a rule.** [Declarative policy engine](../pages/tools/sdk-policies.md#declarative-policy-engine)

## Authoring notes (agents-united, not host behaviour)

- **A package ships no permission rules.** They are the user's, in the user's settings, and a deny rule written by a package for `git push --force` would be a second, weaker copy of the hook guard (see the hook guide). `commandExecutionPolicy` is an agent frontmatter key (see the agent guide), the documented per-role control; the repository's overlay mechanism (`src/core/overlays.ts`) already treats it as a per-host authored field.
- **The platform split matters for verification.** This repository's maintainer machine is Windows, where the unified engine, `command(...)` allow rules and the default-on sandbox do not apply, so a real-session claim about sandboxed commands needs a macOS or Linux run and is otherwise unverified.
- **Docs disagree with themselves in places** (the CLI reference says the sandbox is off by default while the permissions page says the Default preset turns it on; one settings section says Linux uses `nsjail` while the sandbox page says namespaces). Prefer the permissions and sandbox pages, which carry the platform split, and mark anything that depends on the difference as unverified.
- `agy` 1.2.15 notes say a permission request that is denied (for example one raised by a subagent that cannot ask the user) is respected and no longer worked around; the docs describe bubbling up only. Release-notes fact, not in the snapshots.
