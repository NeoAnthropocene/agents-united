# Claude Code: provisioning MCP servers

Reference for the `mcp-setup` skill, for the digital-agency lead. Checked on Claude Code 2.1.291 (Windows 11), 2026-10-06; the observations are in `host-library/claude/observations/2026-10-06-claude-2.1.291-hardening-h9.md`, the command shapes follow the host's own page (`host-library/claude/pages/mcp/mcp.md`). Where something was not run it says so.

## Add a server

```bash
claude mcp add --scope project <name> -- <command> [args...]
```

- `--scope project` writes `.mcp.json` in the working folder. The user approves it at the next start. This is the only scope the lead runs. `--scope local` (the default) stores the server in `~/.claude.json` under this folder's path, private to the user; `--scope user` stores it for every folder. Both change the user's account file, so the lead never runs them.
- Claude's own options (`--scope`, `--env`, `--transport`, `--header`) go before the name; everything after `--` is the server's command. Without the `--`, flags such as `-y` are read as Claude's own and the server does not start.
- A remote server: `claude mcp add --scope project --transport http <name> <url>`.
- Undo: `claude mcp remove <name> --scope project`.

## Servers that need no account or key

The lead may install these after the user's yes. Name the package, its source and what it downloads when you ask.

| Server | Command | Needs | Downloads |
|---|---|---|---|
| context7 | `claude mcp add --scope project context7 -- npx -y @upstash/context7-mcp` | Node | the npm package |
| playwright | `claude mcp add --scope project playwright -- npx -y @executeautomation/playwright-mcp-server` | Node and a browser (below) | the npm package; the browser is separate |
| chrome-devtools-mcp | `claude mcp add --scope project chrome-devtools-mcp -- npx -y chrome-devtools-mcp` | Node and Chrome installed | the npm package (about 14 MB unpacked) |
| markitdown | `claude mcp add --scope project markitdown -- uvx markitdown-mcp` | `uv` | 81 Python packages, about 118 MB of wheels, on the first run |

**Playwright's browser.** The server 1.0.12 pins Playwright 1.57.0, which needs Chromium build 1200; a newer cached build does not satisfy it, and the server's three `@playwright/browser-*` dependencies each run an install script that downloads a browser when the server first starts, which can make the first start time out. Install the one build it needs, once: `npx -y playwright@1.57.0 install chromium` (a 178 MB zip and a 112 MB headless shell). To keep the other two browsers out, set `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` for the first fetch of the server (`PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npx -y @executeautomation/playwright-mcp-server < /dev/null`). Ask before any of it: it is about 290 MB.

## Servers that need a credential

The lead never runs these and never asks for the value in the chat. It prints the command with the placeholder for the user to run in their own terminal. They use `--scope local`, so the key stays in the user's own file and not in a `.mcp.json` that is shared with the team. The commands come from the skill's server matrix and were not run here.

```bash
claude mcp add --scope local github --env GITHUB_PERSONAL_ACCESS_TOKEN=<your-token> -- npx -y @modelcontextprotocol/server-github
claude mcp add --scope local firecrawl --env FIRECRAWL_API_KEY=<your-api-key> -- npx -y firecrawl-mcp
claude mcp add --scope local stitch -- npx -y mcp-remote https://stitch.googleapis.com/mcp --header "X-Goog-Api-Key: <your-api-key>"
claude mcp add --scope local figma --env FIGMA_ACCESS_TOKEN=<your-token> -- npx -y ai-figma-mcp
```

## Check an install

- `claude mcp get <name>` shows one server; `claude mcp list` shows all, with a status: Connected, Failed, or **Pending approval** (a project-scoped server the user has not approved yet; it is the normal status right after an install).
- In the session, `ToolSearch` lists a server's tools as `mcp__<name>__<tool>`. A server whose tools do not appear is not usable, whatever `claude mcp list` says.
- The lead reports what it saw, not what it expects.

## What a running session sees (observed on 2.1.291)

A session that is already running does not list a server added after it started: `/mcp` does not list it, and `/mcp reconnect playwright` answers `MCP server "playwright" not found`. `claude mcp list` from another terminal shows it as Pending approval. The way in is a restart: after `/exit` and `claude --continue`, Claude Code asks **New MCP server found in this project: playwright** with three choices, "Use this MCP server", "Use this and all future MCP servers in this project" and "Continue without using this MCP server"; after the first, `/mcp` shows the server under Project MCPs. `/mcp reconnect <name>` is for a server that is loaded and failed.

A resume does not restore in-process teammates, so the team starts only after the restart.

## The restart message

The lead gives the user the command, what to expect, and a starting prompt (the accepted plan in at most 25 lines, the servers just installed, "check them with `ToolSearch`, recreate the task list, then spawn the team").

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

Add the `--model` and `--effort` the session ran on. Unverified: whether `claude --continue` keeps the agent, the model and the team variables without these flags, and whether the combination of `--continue` and `--agent` is accepted as written; the starting prompt makes the restart work either way, because it carries the plan. Unverified: the desktop app. There, start a new session in the same folder, approve the server when asked, and paste the starting prompt.

## Windows

`npx` and `uvx` ran as written on 2.1.291, with no wrapper. If a server fails with "Connection closed", a possible cause on native Windows is that `npx` is a `.cmd` file, and a workaround people use is `cmd /c npx` in place of `npx` (`claude mcp add --scope project <name> -- cmd /c npx -y <package>`). That form is not in the host library snapshot (its changelog only mentions a removed "Windows requires cmd /c wrapper" warning), it was not needed here, and it is not verified.
