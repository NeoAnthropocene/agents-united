# Agent settings

Available on: Antigravity App, Antigravity CLI

Configure how the Antigravity agent executes terminal commands, modifies files, and uses the terminal sandbox across the desktop application and CLI.

## Antigravity App

### Updated permission settings

#### Permission settings

This setting controls how agent actions—terminal commands, file access, MCP tools, and web page reads—are approved using a **permission preset**:

*   **Request Review** (_“Every command requires approval.”_): The sandbox is off and every terminal command requires approval. The agent can read and write the workspace, and needs approval for anything else.
*   **Default** (_“Ask before sensitive operations.”_; default): Commands run without prompting inside the [Terminal sandbox](/docs/sandbox); running outside the sandbox requires approval. The agent can read and write the workspace and temp directories, and needs approval for anything else.
*   **Auto** (_“Automatically decide if commands run.”_): Commands run without prompting inside the [Terminal sandbox](/docs/sandbox), and the agent can read and write workspace and temporary directories without asking. When a command needs to run outside the sandbox, Antigravity automatically evaluates it so safe, reversible commands proceed without prompting while risky or irreversible actions still pause for your approval.
*   **Turbo** (_“Run all commands without restrictions.”_): All commands run without prompting with no isolation or restrictions, and the agent has full read and write access to your filesystem.

Your configured allow, deny, and ask permission rules are layered on top of the preset and always take precedence. To learn more, refer to **[Agent permissions](/docs/permissions)**.

Note

**Default** is selected by default (**Request Review** if the [Terminal sandbox](/docs/sandbox) isn’t available). **Auto** (shown as **Auto (Preview)** in version 2.29.0 and earlier) is available in `v2.23.0+` on macOS and Linux and `v2.26.0+` on Windows when the sandbox is available. It isn’t currently available for business or enterprise accounts, including [Antigravity in Gemini Enterprise](/docs/enterprise).

#### Change your permission preset

You can change the preset in three places:

*   **For all projects**: Open **Settings** > **General** > **Global Permissions** > **Permission Preset** (**Permissions** > **This Computer** if remote agents are available to you).
*   **For a single project**: Override the global preset under **Settings** > **Projects**. Projects default to **Inherit Global**, which follows your global preset.
*   **From the message box** (`v2.23.0+`): Choose a preset from the permissions picker. The picker changes your global preset, or the project’s preset if the project overrides it. To remove a project override, choose **Use Global Settings**.

For screenshots of the Settings selector and the message box picker, refer to **[Change your permission preset](/docs/permissions#change-your-permission-preset)**.

### Previous permission settings

Note

Business and enterprise accounts use the following settings instead of the permission presets above.

#### Terminal command auto execution

This setting controls how the agent executes generated shell commands:

*   **Require Review**: The agent never executes terminal commands without prompting (except those explicitly added to your configurable Allow list).
*   **Proceed in Sandbox**: Commands run without prompting inside the [Terminal sandbox](/docs/sandbox); commands that need to run outside it still require review.
*   **Always Proceed**: The agent executes commands without prompting (except those explicitly added to your configurable Deny list).

#### Agent non-workspace file access

This setting allows the agent to view and edit files outside of the active project folders:

*   By default, the agent only has access to the folders inside your project and the application’s local app data directory `~/.gemini/antigravity/` (which contains artifacts, knowledge items, and more).
*   Enforcing this boundary protects your local sensitive data. Enable non-workspace access with caution.

#### Terminal sandbox mode

This setting restricts agent terminal commands to an isolated sandbox:

*   When enabled, shell commands execute inside the sandbox without access to sensitive system paths or unauthorized networks.
*   You can configure this setting globally in application preferences or override it per project.
*   To learn more, refer to the **[Terminal sandbox](/docs/sandbox)** guide.

## Antigravity CLI

### Agent execution and permission settings

Antigravity CLI lets you configure how the agent edits files, runs shell commands, and enforces workspace boundaries through `/config` (`/settings`), `~/.gemini/antigravity-cli/settings.json`, or command-line flags:

*   **Agent Mode (`agentMode` / `--mode`)**: Controls the session execution mode (cycle during a session with Shift + Tab):
    *   `default` (the default; select `default` in `/config`, or leave `agentMode` unset or `""` in `settings.json`): Prompts for interactive diff review before modifying or creating files, and follows `toolPermission` for commands.
    *   `auto`: Automatically approves workspace file edits, runs terminal commands inside the [Terminal sandbox](/docs/sandbox) by default, and automatically evaluates commands that need to run outside the sandbox so safe, reversible commands run without prompting while risky or irreversible commands pause for approval. When active, the bottom-right status bar shows `auto` and the prompt input displays `Auto mode: edits & safe commands auto-approved (shift+tab to cycle)`.
    *   `accept-edits`: Automatically approves workspace file edits and creations while continuing to follow `toolPermission` for commands.
    *   `plan`: Analyzes the codebase and outlines a plan before making edits.
*   **Tool Permission (`toolPermission`)**: Controls the baseline authorization policy for tools outside `auto` mode (and for `strict` and `always-proceed` overrides):
    *   `request-review` (default `toolPermission` value): Prompts for approval before running write, shell, or web tools.
    *   `proceed-in-sandbox`: Automatically runs sandboxed terminal commands and prompts when commands need to run outside the sandbox.
    *   `strict`: Prompts before all non-read tool calls (overrides `auto` mode).
    *   `always-proceed`: Runs all tools without prompting (overrides `auto` mode; also activated by `--dangerously-skip-permissions`).
*   **Sandbox Mode (`enableTerminalSandbox` / `--sandbox`)**: Restricts agent shell commands to an OS-level container boundary (enabled automatically in `auto` mode; `false` by default in other modes).
*   **Non-Workspace Access (`allowNonWorkspaceAccess`)**: Controls whether the agent can read or write files outside your active workspace directories (`false` by default).

Note

`auto` mode is available in `v1.3.5+` on **macOS and Linux** and `v1.4.4+` on **Windows**, except for business and enterprise accounts. Starting in `v1.4.4`, if the terminal sandbox isn’t available on your machine, `auto` and `proceed-in-sandbox` aren’t offered, and Sandbox Mode has no effect. To learn more, refer to **[Terminal sandbox](/docs/sandbox)**.

### Example configuration

Configure your preferred agent execution settings in `~/.gemini/antigravity-cli/settings.json` (for example, to approve workspace edits automatically while prompting before shell commands):

```json
{
    "agentMode": "accept-edits"
}
```

To learn more, refer to **[Choose an execution mode](/docs/cli/modes)**, **[Settings](/docs/settings)**, **[Agent permissions](/docs/permissions)**, and **[Terminal sandbox](/docs/sandbox)**.
