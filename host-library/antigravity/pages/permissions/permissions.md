# Agent permissions

Antigravity uses a unified fine-grained permission engine to evaluate sensitive tool operations across Deny, Ask, and Allow access lists.

*   [Antigravity 2.0](#tab-panel-17)
*   [Antigravity CLI](#tab-panel-18)

Note

Antigravity’s updated permission system is currently available on **macOS and Linux**. On **Windows**, Antigravity continues to use the previous permission system — refer to the [Windows](#windows) section below.

## macOS & Linux

Antigravity uses a robust, unified permission engine to secure your environment while enabling autonomous workflows. Every sensitive operation the Agent performs is represented as a **permission resource** formatted as `action(target)`.

Permissions are evaluated across three distinct access lists:

*   **Deny**: The action is blocked immediately.
*   **Ask**: The Agent pauses and prompts for your explicit approval before proceeding.
*   **Allow**: The action is allowed without prompting.

Note

**Precedence Rule:** Conflicting rules are strictly evaluated in priority order: **Deny > Ask > Allow**. For example, if you configure `command(*)` in Ask and `command(git)` in Allow, the Ask rule takes precedence and prompts before every command.

### Permission Presets

The **permission preset** controls how agent actions are approved. Your configured allow/deny/ask rules are layered on top of the preset and always take precedence.

| Preset | [Sandbox](/docs/sandbox) | Terminal Commands | File Access | MCP & Web |
| :-- | :-- | :-- | :-- | :-- |
| **Default** | Enabled | Allowed in sandbox; ask outside | Workspace + temp dirs | Ask |
| **Request Review** | Disabled | Always ask | Workspace only | Ask |
| **Turbo** | Disabled | Allowed (unrestricted) | Full filesystem | Allowed |

Under **Default**, terminal commands run inside the isolated **[Terminal Sandbox](/docs/sandbox)** with access restricted to your workspace and temp directories and **no network access**. When a command needs network connectivity or host resources, the agent requests to run it outside the sandbox — prompting for your approval unless covered by a `command(...)` allow rule.

Configure your preset under **Settings → General → Permission Settings**, or override it per project under **Settings → Projects** (new projects default to **Inherit General**, which follows your global preset). Refer to **[Agent Settings](/docs/agent-settings)** for more detail on each preset.

### Supported Actions & Matching Rules

| Action | Target Format | Matching Behavior | Default Fallback |
| :-- | :-- | :-- | :-- |
| `read_file` | `read_file(/path)`, `read_file(dir)`, or `read_file(*)` | Matches absolute paths or paths relative to project workspace roots. Grants recursive read access to all contained files/folders. Using `read_file(*)` matches all files on the system. | **Ask** (Allowed in workspace) |
| `write_file` | `write_file(/path)` or `write_file(*)` | Same as `read_file`. Implicitly grants `read_file` for the exact same target path. | **Ask** (Allowed in workspace) |
| `read_url` | `read_url(domain)` or `read_url(*)` | Matches hostnames and subdomains (e.g., `google.com` covers `mail.google.com`). Ignores URL path segments. Using `read_url(*)` matches any domain. | **Ask** |
| `execute_url` | `execute_url(domain)` or `execute_url(*)` | Actuating on web elements (clicking, typing) or driving interactive browser workflows on a domain. | **Ask** |
| `command` | `command(prefix)`, `command(regex:pattern)`, or `command(*)` | Matches by exact word/token prefix literally by default. To match by regular expression, start the target with the `regex:` prefix (each whitespace-separated token is evaluated as an anchored regular expression `^(?:pattern)$`, e.g. `command(regex:npm run (build.*))`). Covers execution both inside and outside the sandbox. | **Ask** (Allowed in sandbox under the Default preset) |
| `mcp` | `mcp(server/tool)`, `mcp(server/*)`, or `mcp(*)` | Matches exact MCP tools or all tools on a specified server (applies equally to local and remote MCP servers). Using `mcp(*)` matches any tool. | **Ask** |

Note

**Global Wildcard Syntax (`*`):** Across all supported action types (e.g., `read_file(*)`, `command(*)`, `mcp(*)`), passing the global wildcard `*` matches all targets within that entire action namespace.

#### When Commands Require an Exact Match

Certain shell constructs can hide arbitrary command execution behind an otherwise benign prefix — for example, command or process substitution (`$(...)`, backticks, `<(...)`), arithmetic contexts (`$((...))`), brace expansion (`{a,b}`), non-literal command names, network/fd redirections, and developer-tool flags that execute subcommands (such as `git -c core.pager=<cmd>` or `tar --to-command`). When Antigravity detects any of these (or cannot cleanly parse the command), it disables prefix matching for the entire command line: the command runs without prompting only if a rule matches the full line **character-for-character** (or across the full raw line for `regex:` rules), and otherwise falls back to **Ask**.

Standard shell composition still prefix-matches normally: pipelines, `&&`/`||`/`;` chains, quoted literals, plain `$VAR` arguments, simple file redirects, and transparent wrappers (`timeout`, `nohup`, `nice`, `env`, whose inner command is evaluated on its own). For example, with `command(git)` in your Allow list, `git status && git log` runs without prompting, while `git log $(whoami)` prompts for approval.

#### Understanding read\_url vs execute\_url Across the Platform

The `read_url` permission governs outbound web connectivity across three distinct areas of Antigravity:

1.  **The `read_url` Tool:** When the Agent uses the internal `read_url_content` tool to fetch web page markdown for research, it checks your `read_url` grants.
2.  **Browser Subagent & Tool:** When driving Chrome sessions, `read_url` authorizes loading and viewing the target domain. However, interactive UI actuation (clicking buttons, typing text) is governed independently by `execute_url`.
3.  **Terminal Sandboxing:** Any domain granted under `read_url` is compiled directly into the sandbox’s outbound network allowlist, permitting commands like `curl` or `npm` to connect to authorized hosts.

#### Cross-Platform Command & Path Matching

Antigravity ensures your permission rules work flawlessly whether you are developing on macOS, Linux, or Windows. On macOS and Linux, paths use standard forward slashes (`/`). On Windows, Antigravity automatically normalizes paths prior to rule evaluation by stripping drive letters (e.g., `C:`) and converting all backslashes (`\`) to forward slashes (`/`).

### Implicit Permission Rules

*   **Write implies Read:** Allowing `write_file` on a path automatically grants `read_file` on that path.
*   **Deny Read implies Deny Write:** Denying `read_file` on a path immediately blocks `write_file` on that path.

### Interactive Permission Prompts

When the Agent encounters an operation requiring approval (**Ask** mode), an interactive card appears in your editor. Before clicking **Allow** for file, URL, or MCP permissions, you can directly edit the target string in the prompt card to expand the granted scope (e.g., broadening a single file request like `/project/file.txt` to the parent directory `/project`). Antigravity validates that your edited target safely covers the operation and applies the expanded grant for the remainder of the turn, preventing repeated prompts for related operations. _(Note: Scope editing is not supported for terminal commands)._

### Terminal Commands & the Sandbox

Under the **Default** preset, the Agent runs terminal commands inside an isolated [Terminal Sandbox](/docs/sandbox) which by default has access only to your workspace and system temp directories, and no network access. Commands can run without manual approval in the sandbox, and your permission grants can further shape what the sandbox can reach:

*   Paths granted under `read_file` dynamically populate the sandbox’s read-only filesystem allowlist.
*   Paths granted under `write_file` dynamically populate the sandbox’s read-write filesystem allowlist.
*   Domains granted under `read_url` define outbound network access policies.

Since some commands cannot run in the sandbox — for example, those requiring network access — the Agent can still choose to run commands outside the sandbox. Such commands will prompt for your approval, unless already allowed or denied by a `command` rule.

### Default System Behaviors & Guardrails

When an action is not explicitly listed in your Allow, Deny, or Ask lists, Antigravity falls back to secure system defaults:

1.  **Commands:** Under the **Default** preset, commands run without prompting inside the sandbox and require approval to run outside it.
2.  **Workspace Files:** Reading and writing files inside your active project directory is allowed without prompting, while non-workspace files require approval.
3.  **Web Browsing Defaults to Ask:** Actions for `read_url` and `execute_url` default to **Ask**. Before the Agent navigates to or actuates on any web page, it will pause and prompt for your explicit approval unless an allow rule is configured.
4.  **MCP Tools Default to Ask:** Unconfigured MCP tool calls prompt for approval.

Note

Explicit rules always take precedence over defaults. An Ask rule such as `command(rm)` will prompt for approval even when the command would otherwise run without prompting in the sandbox.

### Configuration Examples

**Allow list** — actions that run without prompting:

```
command(git)                             # Standard git commands
command(regex:npm run (build|lint|test)) # Allow safe npm scripts via regex
command(git push)                        # Allow git push, inside or outside the sandbox
read_file(/var/log/app)                  # Read external log paths
write_file(src/)                         # Edit relative src/ folder
read_url(google.com)                     # Fetch Google subdomains
mcp(linter/*)                            # Run linter MCP tools
```

**Deny list** — actions that are permanently blocked:

```
command(rm -rf)                    # Block destructive deletions
command(regex:curl .*)             # Block unvetted curl downloads
command(sudo)                      # Block sudo privileges
write_file(.git/)                  # Safeguard Git history
write_file(/home/user/.ssh)        # Safeguard SSH keys
```

**Ask list** — actions that pause for manual confirmation:

```
command(*)                         # Prompt all commands
execute_url(aws.amazon.com)        # Prompt AWS console actuation
mcp(sql/execute_mutation)          # Prompt modifying SQL queries
```

## Windows

Note

Windows currently uses the permission system described in this section. It will be updated to the unified system described above in a future release.

Antigravity uses a robust, unified permission engine to secure your environment while enabling autonomous workflows. Every sensitive operation the Agent performs is represented as a **permission resource** formatted as `action(target)`.

Permissions are evaluated across three distinct access lists:

*   **Deny**: The action is blocked immediately.
*   **Ask**: The Agent pauses and prompts for your explicit approval before proceeding.
*   **Allow**: The action is allowed without prompting.

Note

**Precedence Rule:** Conflicting rules are strictly evaluated in priority order: **Deny > Ask > Allow**. For example, if you configure `command(*)` in Ask and `command(git)` in Allow, the Ask rule takes precedence and prompts before every command.

### Supported Actions & Matching Rules

| Action | Target Format | Matching Behavior | Default Fallback |
| :-- | :-- | :-- | :-- |
| `read_file` | `read_file(/path)`, `read_file(dir)`, or `read_file(*)` | Matches absolute paths or paths relative to project workspace roots. Grants recursive read access to all contained files/folders. Using `read_file(*)` matches all files on the system. | **Ask** (Allowed in workspace) |
| `write_file` | `write_file(/path)` or `write_file(*)` | Same as `read_file`. Implicitly grants `read_file` for the exact same target path. | **Ask** (Allowed in workspace) |
| `read_url` | `read_url(domain)` or `read_url(*)` | Matches hostnames and subdomains (e.g., `google.com` covers `mail.google.com`). Ignores URL path segments. Using `read_url(*)` matches any domain. | **Ask** |
| `execute_url` | `execute_url(domain)` or `execute_url(*)` | Actuating on web elements (clicking, typing) or driving interactive browser workflows on a domain. | **Ask** |
| `command` | `command(prefix)`, `command(regex:pattern)`, or `command(*)` | Matches by exact word/token prefix literally by default. To match by regular expression, start the target with the `regex:` prefix (each whitespace-separated token is evaluated as an anchored regular expression `^(?:pattern)$`, e.g. `command(regex:npm run (build.*))`). | **Ask** |
| `unsandboxed` | `unsandboxed(prefix)`, `unsandboxed(regex:pattern)`, or `unsandboxed(*)` | Matches command prefixes word-by-word literally by default (or with `regex:`). Commands matching this grant execute outside container isolation when terminal sandboxing is enabled. | **Ask** |
| `mcp` | `mcp(server/tool)`, `mcp(server/*)`, or `mcp(*)` | Matches exact MCP tools or all tools on a specified server (applies equally to local and remote MCP servers). Using `mcp(*)` matches any tool. | **Ask** |

Note

**Global Wildcard Syntax (`*`):** Across all supported action types (e.g., `read_file(*)`, `command(*)`, `mcp(*)`), passing the global wildcard `*` matches all targets within that entire action namespace.

#### When Commands Require an Exact Match

Certain shell constructs can hide arbitrary command execution behind an otherwise benign prefix — for example, command or process substitution (`$(...)`, backticks, `<(...)`), arithmetic contexts (`$((...))`), brace expansion (`{a,b}`), non-literal command names, network/fd redirections, and developer-tool flags that execute subcommands (such as `git -c core.pager=<cmd>` or `tar --to-command`). On Windows shells like PowerShell or Command Prompt, commands whose syntax cannot be cleanly split into separate words also fall into this category. When Antigravity detects any of these, it disables prefix matching for the entire command line: the command runs without prompting only if a rule matches the full line **character-for-character** (or across the full raw line for `regex:` rules, such as `command(regex:git .*)`), and otherwise falls back to **Ask**.

Standard shell composition still prefix-matches normally: pipelines, `&&`/`||`/`;` chains, quoted literals, plain `$VAR` arguments, simple file redirects, and transparent wrappers (`timeout`, `nohup`, `nice`, `env`, whose inner command is evaluated on its own). For example, with `command(git)` in your Allow list, `git status && git log` runs without prompting, while `git log $(whoami)` prompts for approval.

#### Understanding read\_url vs execute\_url Across the Platform

The `read_url` permission governs outbound web connectivity across three distinct areas of Antigravity:

1.  **The `read_url` Tool:** When the Agent uses the internal `read_url_content` tool to fetch web page markdown for research, it checks your `read_url` grants.
2.  **Browser Subagent & Tool:** When driving Chrome sessions, `read_url` authorizes loading and viewing the target domain. However, interactive UI actuation (clicking buttons, typing text) is governed independently by `execute_url`.
3.  **Terminal Sandboxing:** In sandbox mode, any domain granted under `read_url` is compiled directly into the container’s outbound network allowlist (`AllowedDomains`), permitting commands like `curl` or `npm` to connect to authorized hosts.

#### Cross-Platform Command & Path Matching

Antigravity ensures your permission rules work flawlessly whether you are developing on macOS, Linux, or Windows. On macOS and Linux, paths use standard forward slashes (`/`). On Windows, Antigravity automatically normalizes paths prior to rule evaluation by stripping drive letters (e.g., `C:`) and converting all backslashes (`\`) to forward slashes (`/`).

### Implicit Permission Rules

*   **Write implies Read:** Allowing `write_file` on a path automatically grants `read_file` on that path.
*   **Deny Read implies Deny Write:** Denying `read_file` on a path immediately blocks `write_file` on that path.

### Interactive Permission Prompts

When the Agent encounters an operation requiring approval (**Ask** mode), an interactive card appears in your editor. Before clicking **Allow** for file, URL, or MCP permissions, you can directly edit the target string in the prompt card to expand the granted scope (e.g., broadening a single file request like `/project/file.txt` to the parent directory `/project`). Antigravity validates that your edited target safely covers the operation and applies the expanded grant for the remainder of the turn, preventing repeated prompts for related operations. _(Note: Scope editing is not supported for terminal commands)._

### Terminal Sandboxing (Preview)

Permission grants also apply to commands when sandbox is enabled:

*   Paths granted under `read_file` dynamically populate the sandbox’s read-only filesystem allowlist.
*   Paths granted under `write_file` dynamically populate the sandbox’s read-write filesystem allowlist.
*   Domains granted under `read_url` define outbound network access policies.

Note

Refer to **[Terminal Sandbox](/docs/sandbox)** for architecture, preset configurations, and security details.

### Default System Behaviors & Guardrails

When an action is not explicitly listed in your Allow, Deny, or Ask lists, Antigravity falls back to secure system defaults:

1.  **Commands Default to Ask:** Unconfigured terminal commands (`command` and `unsandboxed`) require manual approval unless configured to run without prompting in your settings.
2.  **Workspace Files:** Reading and writing files inside your active project directory is allowed without prompting, while non-workspace files require approval.
3.  **Web Browsing Defaults to Ask:** Actions for `read_url` and `execute_url` default to **Ask**. Before the Agent navigates to or actuates on any web page, it will pause and prompt for your explicit approval unless an allow rule is configured.
4.  **MCP Tools Default to Ask:** Unconfigured MCP tool calls prompt for approval.

Note

Explicit rules always take precedence over defaults.

### Configuration Examples

**Allow list** — actions that run without prompting:

```
command(git)                       # Standard git commands
command(regex:npm run (build|lint|test)) # Allow safe npm scripts via regex
unsandboxed(git push)              # Allow git push outside sandbox
read_file(/var/log/app)            # Read external log paths
write_file(src/)                   # Edit relative src/ folder
read_url(google.com)               # Fetch Google subdomains
mcp(linter/*)                      # Run linter MCP tools
```

**Deny list** — actions that are permanently blocked:

```
command(rm -rf)                    # Block destructive deletions
command(regex:curl .*)             # Block unvetted curl downloads
command(sudo)                      # Block sudo privileges
write_file(.git/)                  # Safeguard Git history
write_file(/home/user/.ssh)        # Safeguard SSH keys
```

**Ask list** — actions that pause for manual confirmation:

```
command(*)                         # Prompt all commands
execute_url(aws.amazon.com)        # Prompt AWS console actuation
mcp(sql/execute_mutation)          # Prompt modifying SQL queries
```

## CLI fine-grained permissions

To secure your workstation while enabling autonomous workflows, Antigravity CLI integrates a robust **Fine-Grained Permissions Engine**. Every sensitive operation the agent performs is represented as a **permission resource** formatted as `action(target)`.

Permissions are evaluated across three distinct access lists configured inside your global settings:

```
~/.gemini/antigravity-cli/settings.json
```

*   **`deny`**: The action is blocked immediately.
*   **`ask`**: The agent pauses and prompts for your explicit approval before proceeding.
*   **`allow`**: The action is auto-approved without prompting.

Note

**Precedence Rule**: Conflicting rules are strictly evaluated in priority order: **Deny > Ask > Allow**. For example, if you configure `command(*)` in your `ask` list and `command(git)` in your `allow` list, the `ask` rule takes precedence and prompts before every command.

## Supported CLI actions and matching rules

Fine-grained permissions follow a standard schema pattern:

```
action(target)
```

The supported actions, target format specifications, and matching algorithms are:

| Action | Target Format | Matching Behavior | Default Fallback |
| :-- | :-- | :-- | :-- |
| **`read_file`** | `read_file(/path)`, `read_file(dir)`, or `read_file(*)` | Matches absolute paths or paths relative to workspace roots. Grants recursive read access to all contained files/folders. `read_file(*)` matches all files on the system. | **Ask** (Auto-allowed in workspace) |
| **`write_file`** | `write_file(/path)` or `write_file(*)` | Same as `read_file`. Implicitly grants `read_file` for the exact same target path. | **Ask** (Auto-allowed in workspace) |
| **`read_url`** | `read_url(domain)` or `read_url(*)` | Matches hostnames and subdomains (e.g., `google.com` covers `mail.google.com`). Ignores URL path segments. `read_url(*)` matches any domain. | **Ask** |
| **`execute_url`** | `execute_url(domain)` or `execute_url(*)` | Actuating on web elements (clicking, typing) or driving interactive browser workflows on a domain. | **Ask** |
| **`command`** | `command(prefix)`, `command(regex:pattern)`, or `command(*)` | Matches command prefixes word-by-word literally by default. If you want to use a regular expression, add the `regex:` prefix (for example, `command(regex:npm run (build|lint|test))`). | **Ask** |
| **`unsandboxed`** | `unsandboxed(prefix)`, `unsandboxed(regex:pattern)`, or `unsandboxed(*)` | Matches command prefixes word-by-word literally by default (or with `regex:`). Commands matching this grant execute outside container isolation when terminal sandboxing is enabled. | **Ask** |
| **`mcp`** | `mcp(server/tool)`, `mcp(server/*)`, or `mcp(*)` | Matches exact MCP tools or all tools on a specified server (applies to local and remote MCP servers). `mcp(*)` matches any tool. | **Ask** |

### CLI global wildcard syntax

Across all supported action types, passing the global wildcard `*` (such as `read_file(*)`, `command(*)`, `mcp(*)`) matches all targets within that entire action namespace.

### CLI implicit permission rules

*   **Write implies Read**: Allowing `write_file` on a path automatically grants `read_file` on that path.
*   **Deny Read implies Deny Write**: Denying `read_file` on a path immediately blocks `write_file` on that path.

### CLI cross-platform path normalization

Antigravity ensures your permission rules work flawlessly whether you are developing on macOS, Linux, or Windows. On macOS and Linux, paths use standard forward slashes (`/`). On Windows, Antigravity automatically normalizes paths prior to rule evaluation by stripping drive letters (e.g., `C:`) and converting all backslashes (`\`) to forward slashes (`/`).

### CLI cross-platform command matching

On Windows shells like PowerShell or Command Prompt, commands that can’t be cleanly split into separate words require an exact match by default. To match a command and its subcommands on Windows, use the `regex:` prefix (for example, `command(regex:git .*)` to allow any `git` command).

* * *

## Default CLI system behaviors and guardrails

When an action is not explicitly listed in your `allow`, `deny`, or `ask` lists, the system falls back to secure system defaults:

1.  **Workspaces are Auto-Allowed**: In standard operation, reading and writing files inside your active project directory is automatically allowed.
2.  **Web Browsing Defaults to Ask**: Actions for `read_url` and `execute_url` default to **Ask**. Before the agent navigates to or actuates on any web page, it will pause and prompt for your approval unless an allow rule is configured.
3.  **Unconfigured Actions Default to Ask**: All other unconfigured actions (`command`, `mcp`, `execute_url`, non-workspace files) default to **Ask**.

* * *

## Interactive CLI permission prompts

When the agent encounters an operation requiring approval (**Ask** mode), an interactive prompt card appears in your TUI.

Before confirming **Allow** for file, URL, or MCP permissions, you can directly edit the target string in the prompt card to expand the granted scope (e.g., broadening a single file request like `/project/file.txt` to the parent directory `/project`). The CLI validates that your edited target safely covers the operation and applies the expanded grant for the remainder of the turn, preventing repeated prompts for related operations. _(Note: Scope editing is not supported for terminal commands)._

* * *

## CLI configuration examples

Add these rules to your `~/.gemini/antigravity-cli/settings.json` file:

```
{
    "permissions": {
        "allow": [
            "command(git)",
            "command(regex:npm run (build|lint|test))",
            "unsandboxed(git push)",
            "read_file(/var/log/app)",
            "write_file(src/)",
            "read_url(google.com)",
            "mcp(linter/*)"
        ],
        "deny": [
            "command(rm -rf)",
            "command(regex:curl .*)",
            "command(sudo)",
            "write_file(.git/)",
            "write_file(/home/user/.ssh)"
        ],
        "ask": ["command(*)", "execute_url(aws.amazon.com)", "mcp(sql/execute_mutation)"]
    }
}
```

## Related resources

*   **[Permissions Command](/docs/cli/commands/permissions)**: Manage rules interactively in the TUI.
*   **[Sandbox Customization](/docs/sandbox)**: Enforce OS-level container isolation boundaries.
*   **[Plugins & Skills](/docs/plugins)**: Create your own custom skills slash commands.
*   **[Settings, Rendering & Keybindings](/docs/settings)**: Customize keyboard hotkeys and buffers.
