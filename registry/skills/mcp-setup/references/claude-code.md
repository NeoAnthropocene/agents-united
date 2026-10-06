# Claude Code: provisioning MCP servers

Reference for the `mcp-setup` skill, for the digital-agency lead. Checked on Claude Code 2.1.291 (Windows 11), 2026-10-06; the observations are in `host-library/claude/observations/2026-10-06-claude-2.1.291-hardening-h9.md` and `...-h9-retest.md`, the command shapes follow the host's own page (`host-library/claude/pages/mcp/mcp.md`). Where something was not run it says so.

## Add a server

```bash
claude mcp add --scope project <name> -- <command> [args...]
```

- `--scope project` writes `.mcp.json` in the working folder. The user approves it at the next start. This is the only scope the lead runs. `--scope local` (the default) stores the server in `~/.claude.json` under this folder's path, private to the user; `--scope user` stores it for every folder. Both change the user's account file, so the lead never runs them.
- Claude's own options (`--scope`, `--env`, `--transport`, `--header`) go before the name; everything after `--` is the server's command. Without the `--`, flags such as `-y` are read as Claude's own and the server does not start.
- A remote server: `claude mcp add --scope project --transport http <name> <url>`.
- Undo: `claude mcp remove <name> --scope project`.

## Servers that need no account or key

The lead may install these after the user's yes, with the command below and no other: a package chosen from memory is not this table. Name the package, its version, its source and what it downloads when you ask.

Versions pinned on 2026-10-06, so that an install is the same tomorrow. Refresh a pin with `npm view <package> version` (for markitdown-mcp, the page of the package on PyPI), after checking that the server still connects, and change this table. Seen working on 2.1.291: context7 4.1.1, `@playwright/mcp` 0.0.83, chrome-devtools-mcp 1.10.1 and markitdown-mcp 0.0.1a7 (H6 and the H9 retest).

| Server | Command | Needs | Downloads |
|---|---|---|---|
| context7 | `claude mcp add --scope project context7 -- npx -y @upstash/context7-mcp@4.1.1` | Node | the npm package |
| playwright | `claude mcp add --scope project playwright -- npx -y @playwright/mcp@0.0.83` | Node and Chrome installed | the npm package; no browser download |
| chrome-devtools-mcp | `claude mcp add --scope project chrome-devtools-mcp -- npx -y chrome-devtools-mcp@1.10.1` | Node and Chrome installed | the npm package (about 14 MB unpacked) |
| markitdown | `claude mcp add --scope project markitdown -- uvx markitdown-mcp@0.0.1a7` | `uv` | 81 Python packages, about 118 MB of wheels, on the first run |

**Playwright.** `@playwright/mcp` uses the installed Chrome (its `--browser` option takes chrome, firefox, webkit or msedge). In the H9 retest the team drove the browser with `mcp__playwright__browser_*` tools and no browser download appeared: no new build in the Playwright cache, only a profile folder for the server. If Chrome is not installed, say so and ask before anything is downloaded.

**An alternative, the community server** `@executeautomation/playwright-mcp-server@1.0.12` (used in H6, which passed). It pins Playwright 1.57.0, which needs Chromium build 1200 (a newer cached build does not satisfy it), and its three `@playwright/browser-*` dependencies each run an install script that downloads a browser when the server first starts, which can make the first start time out. Install the one build it needs, once: `npx -y playwright@1.57.0 install chromium` (a 178 MB zip and a 112 MB headless shell), and keep the other two browsers out with `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` for the first fetch (`PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npx -y @executeautomation/playwright-mcp-server@1.0.12 < /dev/null`). That is about 290 MB: ask before any of it.

## Servers that need a credential

The lead never runs these and never asks for the value in the chat. It prints the command with the placeholder for the user to run in their own terminal. They use `--scope local`, so the key stays in the user's own file and not in a `.mcp.json` that is shared with the team. Not run here: github, firecrawl, stitch and figma.

```bash
claude mcp add --scope local --transport http github https://api.githubcopilot.com/mcp/ --header "Authorization: Bearer <your-token>"
claude mcp add --scope local firecrawl --env FIRECRAWL_API_KEY=<your-api-key> -- npx -y firecrawl-mcp@3.27.3
claude mcp add --scope local --transport http stitch https://stitch.googleapis.com/mcp --header "X-Goog-Api-Key: <your-api-key>"
claude mcp add --scope local figma --env FIGMA_ACCESS_TOKEN=<your-token> -- npx -y ai-figma-mcp@1.0.8
```

`@modelcontextprotocol/server-github`, the package in the skill's server matrix, is deprecated on npm ("Package no longer supported", checked 2026-10-06); GitHub's remote server above is the one the host's own page uses (`host-library/claude/pages/mcp/mcp.md`, "Connect to GitHub for code reviews"). Stitch is an HTTP server (`claude mcp list` shows it that way for an account that has it); its header comes from the skill's matrix.

## Check an install

- `claude mcp get <name>` shows one server; `claude mcp list` shows all, with a status: Connected, Failed, or **Pending approval** (a project-scoped server the user has not approved yet; it is the normal status right after an install).
- In the session, `ToolSearch` lists a server's tools as `mcp__<name>__<tool>`. A server whose tools do not appear is not usable, whatever `claude mcp list` says.
- The lead reports what it saw, not what it expects.

## What a running session sees (observed on 2.1.291)

A session that is already running does not list a server added after it started: `/mcp` does not list it, and `/mcp reconnect playwright` answers `MCP server "playwright" not found`. `claude mcp list` from another terminal shows it as Pending approval. The way in is a restart: after `/exit` and `claude --continue`, Claude Code asks **New MCP server found in this project: playwright** with three choices, "Use this MCP server", "Use this and all future MCP servers in this project" and "Continue without using this MCP server"; after the first, `/mcp` shows the server under Project MCPs. `/mcp reconnect <name>` is for a server that is loaded and failed.

A resume does not restore in-process teammates, so the team starts only after the restart.

## The restart message

The lead gives the user the command, what to expect, and a starting prompt (the accepted plan in at most 25 lines, the servers just installed, "check them with `ToolSearch`, recreate the task list, then spawn the team"). In the H9 retest the user ran `agents start digital-agency --host claude`: a new session on the lead's pinned model (Opus, medium effort), whose first message was the pasted starting prompt, and the lead re-checked the servers and ran the team.

PowerShell:

```powershell
$env:CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS='1'; $env:CLAUDE_CODE_ENABLE_TODO_TOOLS='1'
claude --continue --agent orchestrator-digital-agency
```

A POSIX shell:

```bash
export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 CLAUDE_CODE_ENABLE_TODO_TOOLS=1
claude --continue --agent orchestrator-digital-agency
```

Add the `--model` and `--effort` the session ran on. Unverified: whether `claude --continue` keeps the agent, the model and the team variables without these flags, and whether the combination of `--continue` and `--agent` is accepted as written (it was not run); the starting prompt makes the restart work either way, because it carries the plan. Unverified: the desktop app. There, start a new session in the same folder, approve the server when asked, and paste the starting prompt.

## Windows

`npx` and `uvx` ran as written on 2.1.291, with no wrapper. If a server fails with "Connection closed", a possible cause on native Windows is that `npx` is a `.cmd` file, and a workaround people use is `cmd /c npx` in place of `npx` (`claude mcp add --scope project <name> -- cmd /c npx -y <package>`). That form is not in the host library snapshot (its changelog only mentions a removed "Windows requires cmd /c wrapper" warning), it was not needed here, and it is not verified.
