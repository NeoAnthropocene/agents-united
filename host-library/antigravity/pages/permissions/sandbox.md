# Terminal sandbox

The terminal sandbox isolates agent shell commands inside OS-level container boundaries to protect your workstation and sensitive files.

*   [Antigravity 2.0](#tab-panel-31)
*   [Antigravity CLI](#tab-panel-32)

Note

Antigravity’s updated permission system is currently available on **macOS and Linux**, where the sandbox is enabled by default. On **Windows**, Antigravity continues to use the previous behavior — refer to the [Windows](#windows) section below.

## macOS & Linux

### Overview

Antigravity includes a **Terminal Sandbox** that isolates shell commands executed by agents. Sandboxed commands can write to your project folders, temp directories, and common build caches, and read system directories like `/usr` and `/etc` so your tools keep working. Sensitive files like `~/.ssh` and `.env` are blocked, anything not explicitly mounted is invisible inside the sandbox, and network access is limited to domains you’ve approved.

The sandbox is built on native operating system primitives, so there are no virtual machines or Docker images to manage and no startup delay:

| Operating System | Technology | Details |
| :-- | :-- | :-- |
| **Linux** | Namespaces | Kernel namespaces isolate the filesystem, hide host processes, and cut off networking. |
| **macOS** | `sandbox-exec` | Seatbelt profiles (SBPL) restrict filesystem access and socket connections. |

### Configuration

Whether the sandbox is used is controlled by your **permission preset**, configured under **Settings → General → Permission Settings**:

| Preset | Sandbox | Commands |
| :-- | :-- | :-- |
| **Default** | On | Allowed in sandbox; ask outside |
| **Request Review** | Off | Always ask |
| **Turbo** | Off | Allowed without prompting, unrestricted |

You can override the global preset in an individual project under **Settings → Projects**. Projects default to **Inherit General** upon creation, which follows your global preset.

Refer to **[Agent Permissions](/docs/permissions)** for the full preset behavior, including file access, MCP tools, and web page reads.

### Unsandboxed commands

Some commands cannot work inside the sandbox — for example, those needing network access or talking to system services. The agent can request to run such commands outside the sandbox, where they run on your host with full privileges. These requests always pause for your approval, unless the command is already covered by a `command` allow or deny rule.

To let a specific command run without prompting — inside or outside the sandbox — add a `command` allow rule:

```
command(git push)
command(regex:docker compose .*)
```

### Permissions integration

The sandbox derives its access boundaries from your **[Permissions](/docs/permissions)** configuration:

*   **Filesystem**: Your project folders are mounted read-write. Paths allowed under `read_file` are mounted read-only, and paths allowed under `write_file` are mounted read-write, on top of the default system mounts. Everything else is inaccessible.
*   **Network**: Sandboxed commands run without network access by default. Domains allowed under `read_url` are added to the sandbox’s outbound allowlist.

## Windows

Note

Windows currently uses the behavior described in this section. It will be updated to the unified permission system in a future release.

### Overview

Antigravity includes a **Terminal Sandbox** that isolates shell commands executed by agents. Sandboxed commands can write to your project folders, temp directories, and common build caches, and read system directories so your tools keep working. Sensitive files like `.env` are blocked, anything not explicitly mounted is invisible inside the sandbox, and network access is limited to domains you’ve approved.

### Configuration

You can configure the sandbox globally or per project.

#### Global settings

In **Settings > General**, under **Agent Settings**:

*   **Enable Sandbox Mode (Preview)**: Runs agent terminal commands inside the sandbox.
*   **Terminal Command Auto Execution**: Set to **Proceed in Sandbox** to let sandboxed commands run without approval; commands that need to run outside the sandbox still ask first. The other options are **Require Review** and **Always Proceed**.

#### Project settings

Select a project under **Settings > Projects** to override these settings for that project. Each setting gains an **Inherit General** option, and **Enable Sandbox Mode** becomes a dropdown: **Inherit General**, **Enabled**, or **Disabled**.

### Security presets

The **Security Preset** dropdown in the same settings section bundles the terminal and file access policies:

| Preset | Terminal Command Auto Execution | Outside-of-folders file access |
| :-- | :-- | :-- |
| **Default** | Require Review | Always Ask |
| **Full machine** | Require Review | Allow |
| **Turbo mode** | Always Proceed | Allow |

None of the presets turn the sandbox on. Enabling **Enable Sandbox Mode** switches the preset to **Custom**, where you set each option yourself — a common combination is the sandbox with **Proceed in Sandbox**.

### Unsandboxed commands

When a command needs to run outside the sandbox—because it matches an `unsandboxed(...)` rule, the agent requested it, or the sandbox is disabled—the command runs on your host with full privileges. Depending on your execution policy, the agent pauses for your approval first.

### Permissions integration

The sandbox derives its access boundaries from your **[Permissions](/docs/permissions)** configuration:

*   **Filesystem**: Your project folders are mounted read-write. Paths allowed under `read_file` are mounted read-only, and paths allowed under `write_file` are mounted read-write, on top of the default system mounts. Everything else is inaccessible.
*   **Network**: When network access is enabled, domains allowed under `read_url` are added to the sandbox’s outbound allowlist.
*   **Escape hatches (`unsandboxed`)**: To let specific commands run outside the sandbox without disabling it entirely, add an `unsandboxed` allow rule:

    ```
    unsandboxed(git push)
    unsandboxed(docker compose .*)
    ```


## How it works

With the terminal sandbox enabled, Antigravity CLI executes commands inside an OS-level isolation boundary. Commands can write to your workspace, temp directories, and common build caches, and read system directories like `/usr` and `/etc` so your tools keep working. Sensitive files like `~/.ssh` and `.env` are blocked, anything not explicitly mounted is invisible inside the sandbox, and network access is limited to domains you’ve approved.

The sandbox is built on native operating system primitives, so there are no virtual machines or Docker images to manage and no startup delay:

| Operating System | Technology | Details |
| :-- | :-- | :-- |
| **Linux** | Namespaces | Kernel namespaces isolate the filesystem, hide host processes, and cut off networking. |
| **macOS** | `sandbox-exec` | Seatbelt profiles (SBPL) restrict filesystem access and socket connections. |

## CLI configuration

Enable the sandbox in `~/.gemini/antigravity-cli/settings.json`, or interactively via `/config`:

```
{
    "enableTerminalSandbox": true,
    "toolPermission": "proceed-in-sandbox"
}
```

*   **`enableTerminalSandbox`** (boolean, default: `false`): Runs agent commands inside the sandbox.
*   **`toolPermission`** (string, default: `"request-review"`): Setting this to `"proceed-in-sandbox"` lets sandboxed commands run automatically, while commands that need to run outside the sandbox still prompt for review. Refer to [Settings](/docs/settings) for the other modes.

### CLI flags

You can also control sandboxing when launching the CLI:

```
# Force the sandbox on for this session
antigravity --sandbox
```

*   **`--sandbox`**: Turns the sandbox on for the session, overriding `settings.json`.

## CLI permissions integration

The sandbox derives its access boundaries from your **[Permissions](/docs/permissions)** configuration:

*   **Filesystem**: Workspace folders and paths allowed under `write_file` are mounted read-write. Paths allowed under `read_file` are mounted read-only, on top of the default system mounts. Denied paths are blocked, and everything else is inaccessible.
*   **Network**: Sandboxed commands run without network access by default. Domains allowed under `read_url` are added to the sandbox’s outbound allowlist.
*   **Escape hatches (`unsandboxed`)**: Commands matching an `unsandboxed` allow rule run outside the sandbox without prompting. This is useful for tools that can’t work inside the isolation boundary, like Docker or commands that talk to system services.

The agent can also request to run a command outside the sandbox on its own—for example, to retry a command that failed due to sandbox restrictions. These requests always require your approval unless the command matches an `unsandboxed` allow rule.

### Example

```
{
    "permissions": {
        "allow": [
            "command(npm test)",
            "command(git diff)",
            "unsandboxed(git push)",
            "read_file(/var/log/app)",
            "write_file(src/)"
        ],
        "deny": [
            "command(rm -rf /)",
            "command(sudo *)",
            "write_file(/home/user/.ssh)"
        ]
    }
}
```

With this configuration:

*   `npm test` and `git diff` run inside the sandbox.
*   `git push` runs outside the sandbox via `unsandboxed(git push)`.
*   `rm -rf /` and `sudo` are always blocked.

## Interactive prompts

When a command needs review, you can approve it once or turn the approval into a standing rule:

```
Do you want to proceed?
1. Yes
2. Yes, and always allow in this conversation for commands that start with 'npm test'
3. Yes, and always allow for commands that start with 'npm test' (Persist to settings.json)
4. No
```

When the agent asks to bypass the sandbox, the prompt calls it out explicitly so you can judge the risk:

```
🔓 Allow sandbox bypass for command execution?
⚠️ Confirm the command is safe to run outside of the sandbox with full network and disk access.
```

Approving “always allow” here records an `unsandboxed(...)` rule instead of a plain `command(...)` rule.

## Related resources

*   **[Agent Permissions](/docs/permissions)**: Configure allow, deny, and ask rules.
*   **[Agent Settings](/docs/agent-settings)**: Command execution policies and file access controls.
*   **[Settings](/docs/settings)**: Global application and CLI preferences.
*   **[Projects](/docs/projects)**: Multi-folder configuration and per-project settings.
