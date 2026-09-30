# Agent Settings

Note

Antigravity’s updated permission system is currently available on **macOS and Linux**. On **Windows**, Antigravity continues to use the previous settings — see the [Windows](#windows) section below.

## macOS & Linux

### Permission Settings

Controls how agent actions — terminal commands, file access, MCP tools, and web page reads — are approved, via a **permission preset**:

*   **Default**: Commands run without prompting inside the [Terminal Sandbox](/docs/sandbox); running outside the sandbox requires approval. The agent can read and write the workspace and temp directories, and needs approval for anything else.
*   **Request Review**: The sandbox is off and every terminal command requires approval. The agent can read and write the workspace, and needs approval for anything else.
*   **Turbo**: All commands run without prompting with no isolation or restrictions, and the agent has full read and write access to your filesystem.

The preset is configured under **Settings → General → Permission Settings**, and can be overridden per project under **Settings → Projects**. Projects default to **Inherit General**, which follows your global preset.

Your configured allow/deny/ask permission rules are layered on top of the preset and always take precedence. Learn more in **[Agent Permissions](/docs/permissions)**.

## Windows

### Terminal Command Auto Execution

Controls how the agent executes generated shell commands:

*   **Request Review**: The agent will never execute terminal commands without prompting (except those explicitly added to your configurable Allow list).
*   **Proceed in Sandbox**: Commands run without prompting inside the [Terminal Sandbox](/docs/sandbox); commands that need to run outside it still require review.
*   **Always Proceed**: The agent will execute commands without prompting (except those explicitly added to your configurable Deny list).

### Agent Non-Workspace File Access

Allows the agent to view and edit files outside of the active project folders.

*   By default, the agent only has access to the folders inside your Project and the application’s local app data directory `~/.gemini/antigravity/` (which contains Artifacts, Knowledge Items, etc.).
*   Enforcing this boundary protects your local sensitive data. Enable non-workspace access with caution.

### Terminal Sandbox Mode

Restricts agent terminal commands to an isolated sandbox.

*   When enabled, shell commands execute inside the sandbox without access to sensitive system paths or unauthorized networks.
*   Configurable globally in application preferences or overridden per project.
*   Learn more in the **[Terminal Sandbox](/docs/sandbox)** guide.
