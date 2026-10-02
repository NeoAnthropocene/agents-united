---
host: cline
artifact: permissions
reviewedAgainst: "4.1.22"
---

# Cline — authoring guide: permissions and approval

Distilled from the snapshots in `host-library/cline/pages/`. Primary sources: [auto-approve](../pages/permissions/auto-approve.md), [permission-handling](../pages/permissions/permission-handling.md). Supporting sources: [config](../pages/settings/config.md), [cli-reference](../pages/settings/cli-reference.md), [mcp-overview](../pages/mcp/mcp-overview.md).

Cline has three separate approval mechanisms: the user's Auto Approve settings (IDE), tool policies (SDK), and a command allow and deny policy (CLI environment variable). They do not share a file a package can install.

## Rules

### Auto Approve (the IDE)

- **Auto Approve is evaluated per tool call by category: read, edit, commands, browser and MCP.** The settings are Read project files, Read all files, Edit project files, Edit all files, Execute safe commands, Execute all commands, Use the browser, Use MCP servers and Enable notifications. [How it works](../pages/permissions/auto-approve.md#how-it-works), [Permissions](../pages/permissions/auto-approve.md#permissions)
- **"Read all files" and "Edit all files" only extend their base toggle:** if the base toggle is off they do nothing. [Permissions](../pages/permissions/auto-approve.md#permissions)
- **There is no fixed command allowlist: the model marks each command `requires_approval`.** `npm test` and `git status` are commonly safe; `npm install`, `rm -rf`, `mv` and `sed -i` commonly need approval. The page says these are examples, not guarantees. [Safe vs approval-required commands](../pages/permissions/auto-approve.md#safe-vs-approval-required-commands)
- **The recommended default is Read project files on and everything else off,** with Checkpoints enabled if edits are allowed. [Recommendations](../pages/permissions/auto-approve.md#recommendations)
- **YOLO mode auto-approves everything: file changes anywhere, terminal commands, browser actions, MCP tools and mode transitions.** It disables all safety checks, so it belongs in throwaway or sandboxed environments with version control as the safety net. [YOLO mode](../pages/permissions/auto-approve.md#yolo-mode), [Best practices for YOLO mode](../pages/permissions/auto-approve.md#best-practices-for-yolo-mode)

### The CLI

- **The CLI auto-approves all tools by default (`--auto-approve`, default `true`; the default is `false` in ACP mode).** A headless `cline "prompt"` therefore runs without prompting, so anything that must be gated has to be enforced by a policy, not by approval. [Global options](../pages/settings/cli-reference.md#global-options)
- **`CLINE_COMMAND_PERMISSIONS` restricts shell commands with JSON `allow` and `deny` glob lists and `allowRedirects`.** `deny` always wins over `allow`; once `allow` is set, any command not matching it is denied; `allowRedirects` (default `false`) controls `>`, `>>` and `<`. [CLINE_COMMAND_PERMISSIONS](../pages/settings/config.md#cline_command_permissions), [Environment variables](../pages/settings/cli-reference.md#environment-variables)

### Tool policies (the SDK)

- **A tool policy sets `autoApprove` or `enabled: false` per tool name; a tool with no policy is enabled and auto-approved.** `{ enabled: false }` removes the tool from what the model sees, so set policies explicitly for any tool that needs review. [Tool policies](../pages/permissions/permission-handling.md#tool-policies), [Policy options](../pages/permissions/permission-handling.md#policy-options)
- **A tiered setup auto-approves read tools and requires approval for write tools,** and a custom `requestToolApproval` handler can approve by what a call actually does. [Tiered permissions](../pages/permissions/permission-handling.md#tiered-permissions), [Conditional approval logic](../pages/permissions/permission-handling.md#conditional-approval-logic)
- **A rejected tool call returns a rejection message to the agent, which adjusts its approach.** It does not loop on the rejection. [What happens when a tool is rejected](../pages/permissions/permission-handling.md#what-happens-when-a-tool-is-rejected)

### MCP

- **MCP servers have their own `autoApprove` list: limit it to safe tools and review the other calls.** [Security basics](../pages/mcp/mcp-overview.md#security-basics)

## Authoring notes (agents-united, not host behaviour)

- The destructive-command guard has three possible homes on Cline, none a file the install lane copies except the plugin: the guard plugin (CLI only, enforced), `CLINE_COMMAND_PERMISSIONS` (CLI, an environment variable the package can only document), and the user's Auto Approve settings (IDE, user-owned). The package ships the plugin and documents the others in the doctor output.
- Because the CLI default is auto-approve, real-session runs of a Cline package must set `--auto-approve` deliberately and say so in the PR.
- The permissions page for the IDE does not say whether a hook or plugin can read the Auto Approve settings; do not assume it.
