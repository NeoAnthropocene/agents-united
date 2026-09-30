# Marketplace

The Marketplace lets you discover, install, and manage curated [plugins](/docs/plugins) that extend your agent with reusable [skills](/docs/skills), [MCP servers](/docs/mcp), [rules](/docs/rules), and [subagents](/docs/subagents).

Note

**Cross-surface synchronization**: Plugins installed in **Antigravity 2.0** are automatically updated and displayed in the **Antigravity CLI**’s **Installed** tab.

*   [Antigravity 2.0](#tab-panel-10)
*   [Antigravity CLI](#tab-panel-11)

## Browse and install plugins

To browse and install marketplace plugins in Antigravity 2.0, follow these steps:

1.  In the left sidebar, click the **Customizations** tab (below **Scheduled Tasks**):

    ![Customization tab](/assets/image/docs/plugins/customization-tab.png)

2.  Click the **Marketplace** tab to view available plugins:

    ![Marketplace tab](/assets/image/docs/plugins/marketplace-plugins.png)

3.  Click any plugin card to inspect its details and bundled capabilities:

    ![Plugin details view](/assets/image/docs/plugins/plugin-card.png)

4.  Click **+** on the plugin card to install it.


## Manage installed plugins

To inspect, toggle, or uninstall existing plugins:

1.  In the **Customizations** panel, click the **Installed** tab:

    ![Installed plugins](/assets/image/docs/plugins/installed-plugins.png)

2.  Click the toggle switch beside any plugin to enable or disable it.

3.  To uninstall a plugin, click the plugin card and select **Uninstall**.


Any plugins you install in Antigravity 2.0 automatically sync and appear in the Antigravity CLI’s **Installed** tab.

## Open the Plugins Manager in the CLI

In the Antigravity CLI, open the interactive Plugins Manager using the `/plugin` slash command (or its alias `/plugins`):

```
/plugin
```

/plugin—Antigravity CLI

Plugins

Installed (6)Discover (15)(tab to cycle)

× clear

  \+ Install from local directory... Path: ./my-custom-plugin (press Enter or Esc)

Keyboard:↑/↓Navigate←/→PagetabCycle TabsenterExpand DetailsspaceToggle Enablectrl+sUninstallescExit

Interactive CLI Plugins Manager — press Tab (or click a tab) to switch between Installed and Discover, ↑/↓ to navigate, Enter to expand details, Space to toggle enable/disable, and Ctrl+S to install or uninstall.

Press Tab to switch between the **Installed** tab and the **Discover** tab.

* * *

## Discover tab

Use the **Discover** tab to browse the marketplace catalog and install new plugins:

*   **Search plugins**: Start typing to search and filter for specific plugins.
*   **Install from a local directory**: Highlight **Install from local directory** and press Enter to provide a local filesystem path for plugin installation.
*   **View plugin details**: Highlight a plugin and press Enter to expand its details view. The details view displays:
    *   Description
    *   Included components (MCP servers, skills, rules, agents, etc.)
    *   Marketplace name
    *   Version
*   **Install or uninstall**: Press Ctrl + S on an uninstalled plugin to install it, or press Ctrl + S on an installed plugin to uninstall it.

### After installation

Once a plugin is installed:

*   **Discover tab**: A green dot (`●`) appears beside the plugin name indicating its installed status.
*   **Installed tab**: The plugin name appears in the **Installed** tab list.

## Installed tab

Use the **Installed** tab to inspect and manage the plugins you have installed:

*   **Search installed plugins**: Start typing to filter your installed plugins.
*   **Enable or disable**: Press Space on an installed plugin to toggle it between enabled and disabled.
*   **View plugin details**: Press Enter on an installed plugin to expand its details view. The details view displays:
    *   Description
    *   Skills (if applicable)
    *   MCP servers (if applicable)
    *   Rules (if applicable)
    *   Agents (if applicable)
    *   Marketplace name
    *   Local installation path
    *   Version
*   **Uninstall**: Press Ctrl + S on an installed plugin to uninstall it.

### Keyboard shortcuts

| Key | Tab | Action |
| :-- | :-- | :-- |
| Tab | Both | Switch between the **Installed** tab and **Discover** tab. |
| Any key | Both | Search and filter plugins in the active tab. |
| Enter | Both | Expand plugin details (or select **Install from local directory** in **Discover**). |
| Ctrl + S | Both | Install an uninstalled plugin, or uninstall an installed plugin. |
| Space | **Installed** | Toggle enable or disable on an installed plugin. |

* * *

## Inline `/plugin` commands

In addition to the interactive panel, `/plugin` supports inline commands to `install`, `uninstall`, `enable`, `disable`, and `list` plugins directly from the prompt without opening the Plugins Manager UI:

*   **Install from a marketplace or local directory**:

    ```
    /plugin install <plugin-name>@<marketplace-name>
    /plugin install <local-path>
    ```

    For example, running `/plugin install firebase@agent-marketplace` outputs:

    ```
    Successfully installed plugin "firebase" from "agent-marketplace"
    ```

*   **Manage and list plugins inline**:

    ```
    /plugin uninstall <plugin-name>
    /plugin enable <plugin-name>
    /plugin disable <plugin-name>
    /plugin list
    ```


* * *

## Next steps

*   **[Get your plugin in the marketplace](https://forms.gle/2EX5RFYPoJe1UgxR9)**: Fill out this interest form to learn more about how to get your plugin listed in the Antigravity Marketplace.
*   **[Plugins](/docs/plugins)**: Learn how to author custom `plugin.json` manifests and package your own plugins.
*   **[Build with Google](/docs/build-with-google)**: Explore curated Google plugins for Firebase, Android, Flutter, Chrome DevTools, BigQuery, and more.
*   **[CLI Reference](/docs/cli/reference)**: View all slash commands and keyboard shortcuts in the Antigravity CLI.
