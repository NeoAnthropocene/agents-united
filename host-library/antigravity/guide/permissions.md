---
host: antigravity
artifact: permissions
reviewedAgainst: "Documentation fetched 2026-11-06; runtime unverified"
---

# Antigravity — authoring guide: permissions, presets and the terminal sandbox

Distilled from the snapshots in `host-library/antigravity/pages/`. Primary sources: [permissions](../pages/permissions/permissions.md), [sandbox](../pages/permissions/sandbox.md). Supporting sources: [agent settings](../pages/agent/agent-settings.md), [settings](../pages/settings/settings.md), [CLI reference](../pages/settings/cli-reference.md), [SDK policies](../pages/tools/sdk-policies.md).

**The App documentation distinguishes updated and previous permission settings**, but no longer assigns them by operating system. Applicability to the installed Windows build is unverified.

## Rules

### Updated App permission settings

- **Every sensitive operation is a permission resource, `action(target)`, checked against Deny, Ask and Allow lists, in that precedence order (Deny over Ask over Allow).** [Agent permissions](../pages/permissions/permissions.md#agent-permissions), [macOS & Linux](../pages/permissions/permissions.md#updated-permission-settings)
- **The actions are `read_file`, `write_file`, `read_url`, `execute_url`, `command` and `mcp`; `*` matches everything in an action; `command(...)` matches a word prefix, or a regular expression with `regex:`.** [Supported Actions & Matching Rules](../pages/permissions/permissions.md#supported-actions-and-matching-rules)
- **A command is matched on the whole line, character for character, when it contains command substitution, process substitution, arithmetic, brace expansion, a non-literal command name, a network redirection, or a flag that runs subcommands (such as `git -c core.pager=` or `tar --to-command`); otherwise it falls back to Ask.** Ordinary pipelines, `&&` chains and wrappers such as `timeout` still prefix-match. [When Commands Require an Exact Match](../pages/permissions/permissions.md#when-commands-require-an-exact-match)
- **Allowing `write_file` on a path implies `read_file`, and denying `read_file` implies denying `write_file`.** [Implicit Permission Rules](../pages/permissions/permissions.md#implicit-permission-rules)
- **Unlisted actions fall back to defaults: workspace files are allowed, web reads and MCP tools ask, and under the Default preset commands run without asking inside the sandbox and ask outside it.** An explicit rule always beats a default. [Default System Behaviors & Guardrails](../pages/permissions/permissions.md#default-system-behaviors-and-guardrails)

### Presets and the sandbox

- **App presets include Default, Request Review, Auto and Turbo; configured allow, deny and ask rules take precedence.** Auto evaluates out-of-sandbox commands and prompts for risky actions. The docs give version, account and sandbox availability limits. Set it under Settings → General → Permission Settings, or per project. [Permission Presets](../pages/permissions/permissions.md#permission-presets), [Permission Settings](../pages/agent/agent-settings.md#permission-settings)
- **The sandbox uses Linux namespaces or macOS `sandbox-exec`; commands see the project, temp and cache directories, system directories read-only, no `~/.ssh` or `.env`, and no network except domains granted under `read_url`.** Grants on `read_file` and `write_file` add read-only and read-write paths. [Terminal sandbox](../pages/permissions/sandbox.md#terminal-sandbox), [Permissions integration](../pages/permissions/sandbox.md#permissions-integration)
- **A command that cannot run in the sandbox is requested outside it and always asks, unless a `command` allow or deny rule covers it.** [Unsandboxed commands](../pages/permissions/sandbox.md#unsandboxed-commands)
- **A subagent inherits the parent's allowed command prefixes, file scopes and sandbox settings.** [Permissions and Configuration Inheritance](../pages/agent/subagents.md#permissions-and-configuration-inheritance)

### Windows and the CLI

- **The App documents previous settings separately**, including terminal auto-execution and a preview sandbox. The docs say business and enterprise accounts use these settings; installed-build behavior remains unverified. [Previous permission settings](../pages/permissions/permissions.md#previous-permission-settings)
- **The CLI keeps the same rules in `~/.gemini/antigravity-cli/settings.json` under `permissions.allow`, `deny` and `ask`, with `toolPermission` (`request-review`, `proceed-in-sandbox`, `strict`, `always-proceed`) and `enableTerminalSandbox` (default `false`).** `--sandbox` turns the sandbox on for one session. [CLI fine-grained permissions](../pages/permissions/permissions.md#cli-fine-grained-permissions), [CLI configuration examples](../pages/permissions/permissions.md#cli-configuration-examples), [Configuration keys (`settings.json`)](../pages/settings/cli-reference.md#configuration-keys-settingsjson), [CLI configuration](../pages/permissions/sandbox.md#cli-configuration)
- **In the SDK, a declarative policy list (`deny`, `allow`, `ask_user`) gates tool calls; custom functions and read-only tools are allowed by default and `run_command` needs a rule.** [Declarative policy engine](../pages/tools/sdk-policies.md#declarative-policy-engine)

## Authoring notes (agents-united, not host behaviour)

- **A package ships no permission rules.** They are the user's, in the user's settings, and a deny rule written by a package for `git push --force` would be a second, weaker copy of the hook guard (see the hook guide). `commandExecutionPolicy` is an agent frontmatter key (see the agent guide), the documented per-role control; the repository's overlay mechanism (`src/core/overlays.ts`) already treats it as a per-host authored field.
- **Windows behavior is unverified on a current build.** Do not infer current sandbox or preset behavior from older observations.
- **Docs disagree with themselves in places** (the CLI reference says the sandbox is off by default while the permissions page says the Default preset turns it on; one settings section says Linux uses `nsjail` while the sandbox page says namespaces). Prefer the permissions and sandbox pages, which distinguish settings versions, and mark anything that depends on the difference as unverified.
- `agy` 1.2.15 notes say a permission request that is denied (for example one raised by a subagent that cannot ask the user) is respected and no longer worked around; the docs describe bubbling up only. Release-notes fact, not in the snapshots.
