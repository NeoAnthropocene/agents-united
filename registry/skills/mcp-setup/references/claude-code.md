# Claude Code: provisioning MCP servers

Reference for the `mcp-setup` skill, for the digital-agency lead. Checked on Claude Code 2.1.291 (Windows 11), 2026-10-06, and on 2.1.292, 2026-10-07 (the routes); the observations are in `host-library/claude/observations/2026-10-06-claude-2.1.291-hardening-h9.md`, `...-h9-retest.md` and `2026-10-07-claude-2.1.292-n1-routes.md`, the command shapes follow the host's own page (`host-library/claude/pages/mcp/mcp.md`). Where something was not run it says so.

## Routes: manual, plugin, connector

An integration can reach the session by three routes. They give the same service under different names, and a role's `tools:` line names servers, so the route decides who can use the tools (see "Names by route").

| Route | Who runs it | The tools are named | After the install |
|---|---|---|---|
| **Manual**: `claude mcp add --scope project`, the pinned commands below | the lead, after the user's yes | `mcp__<name>__<tool>` | a running session never loads it: restart (seen) |
| **Plugin**: `claude plugin install <name>@claude-plugins-official --scope project` | the lead, after the user's yes | `mcp__plugin_<plugin>_<server>__<tool>` | the user types `/reload-plugins --force` and the running session loads it: no restart (seen with context7, playwright and chrome-devtools-mcp) |
| **Connector**: a claude.ai directory page, authorised in a browser | the user | CLI `mcp__claude_ai_<Name>__<tool>`, desktop app `mcp__<directory id>__<tool>` | the lead checks with `claude mcp list` and `ToolSearch` |

The manual route is the default: its commands are pinned, the names are the ones the roles have always named, and a server that needs no account needs nothing but the user's yes. Offer the plugin route in the same question, as the option for a user who wants to avoid the restart (a restart ends the team, because a resume restores no teammate), for every integration that has a plugin that carries an MCP server (the table below): the plugin floats with its own version, and its server may ask the user to authenticate. A connector is the user's own act: print its directory link, say what it gives, and check afterwards; the roles name the CLI form of Firecrawl's connector only.

### The plugin route, step by step

1. **Search.** `node ${CLAUDE_SKILL_DIR}/scripts/find-plugin.mjs <word>` reads the two plugin catalogs on disk and prints the surfaces, the source and the install command (exit 1: no plugin matches). It changes nothing and needs no network; `claude plugin marketplace update` refreshes the catalogs.
2. **Install, after the user's yes:** `claude plugin install <name>@claude-plugins-official --scope project`. If the user changes their mind after a manual install, remove the entries you added (`claude mcp remove <name> --scope project`) before the plugin install, so that the names do not double up: `/reload-plugins` does not load a server that `claude mcp add` added (seen: "0 plugin MCP servers").
3. **Ask for the reload.** Say: "type `/reload-plugins --force`", because only the user can type a slash command. The command warns and skips when the reload would change which MCP tools are loaded and invalidate the prompt cache (the host docs), so ask for `--force`. Seen on 2.1.291 in a session with no model turn yet: the plain command loaded the server, and `--force` changed nothing. Seen on 2.1.292 in a session with model turns: `/reload-plugins --force` loaded two plugin MCP servers (playwright and chrome-devtools-mcp), the lead found their tools with `ToolSearch`, and the team used them in the same session; the plain command was not tried there.
4. **Check.** Then check with `ToolSearch` and report what it lists. A server that needs authentication (`/mcp` and `claude mcp list` say so; the context7 plugin does) has no tools until the user authenticates in `/mcp`: name that step, and never ask for a token. A plugin that ships no MCP server (the firecrawl plugin ships skills) gives skills, not tools.
5. **If the server does not load,** use the restart message below: the plugin is stored in the user's plugin folder and the project settings, so a new session loads it.

## Per integration

Checked on 2026-10-07 against the official marketplace and the plugins' own manifests at their pinned commits. "Seen" means run on 2.1.291.

| Integration | Manual (pinned) | Plugin | Connector |
|---|---|---|---|
| github | the remote server with a token, which the user runs: `--scope local`, see "Servers that need a credential" | `github@claude-plugins-official`, server `plugin:github:github`; it reads `GITHUB_PERSONAL_ACCESS_TOKEN` from the user's own environment, which the lead never sets or asks for | none |
| firecrawl | `firecrawl-mcp@3.27.3` with `FIRECRAWL_API_KEY`, which the user runs (`--scope local`) | the plugin has skills and commands and no MCP server, so it is not a route to the tools | `claude.ai/directory/firecrawl`; in the CLI the tools are `mcp__claude_ai_Firecrawl__*` (seen) |
| context7 | `@upstash/context7-mcp@4.1.1`, no key | `context7@claude-plugins-official`, server `plugin:context7:context7` (seen); a hosted server that needs authentication (`/mcp` says "needs authentication") | `claude.ai/directory/context7` |
| playwright | `@playwright/mcp@0.0.83`, Chrome installed, no key | `playwright@claude-plugins-official`; it runs `@playwright/mcp@latest`, not pinned | none |
| chrome-devtools-mcp | `chrome-devtools-mcp@1.10.1`, Chrome installed, no key | `chrome-devtools-mcp@claude-plugins-official`, server `plugin:chrome-devtools-mcp:chrome-devtools`; it pins 1.9.0 (read at its commit) | none |
| figma | `ai-figma-mcp@1.0.8` with `FIGMA_ACCESS_TOKEN`, which the user runs (`--scope local`) | `figma@claude-plugins-official`, a hosted server (`https://mcp.figma.com/mcp`) | `claude.ai/directory/figma` |
| markitdown | `markitdown-mcp@0.0.1a7`, needs `uv` | no plugin in the official marketplace | none |
| stitch | a remote HTTP server with a key, which the user runs (`--scope local`) | no plugin | `claude.ai/directory/c25fdbda-aebd-4312-95fb-6513ffae0f43` |

## Names by route

- **Manual:** `mcp__<name>__<tool>`; the server keeps the name given to `claude mcp add` (seen in every run of this plan).
- **Plugin:** the server is `plugin:<plugin>:<server>` (seen: `plugin:context7:context7` in `claude mcp list` and `/mcp`), and its tools are `mcp__plugin_<plugin>_<server>__<tool>` (the host docs, `host-library/claude/pages/mcp/mcp.md`; seen on 2.1.292: `mcp__plugin_playwright_playwright__browser_navigate` and `mcp__plugin_chrome-devtools-mcp_chrome-devtools__list_console_messages`; the context7 server lists no tool until the user authenticates).
- **Connector:** in the CLI `mcp__claude_ai_<Name>__<tool>`, the display name's spaces turned into `_` (seen in earlier CLI sessions: Firecrawl, Vercel, Supabase, Claude Docs, Google Calendar, Gmail; on 2026-10-07 the CLI listed no claude.ai connector until the user ran `/login`, and after it Firecrawl's tools appeared in `ToolSearch`); in the desktop app's Code tab `mcp__<directory id>__<tool>`, where the id is the one in the connector's directory link (seen for Stitch, `c25fdbda-aebd-4312-95fb-6513ffae0f43`).

A grant in a role's `tools:` line names one server. The digital-agency roles and the lead name the manual form of each of their servers, the plugin form of the five that have a plugin MCP server (github, playwright, context7, figma, chrome-devtools-mcp), and Firecrawl's CLI connector form. They do not name the desktop app's directory ids, and no other connector name was seen: a connector connected there, or in the CLI under another name, is not reachable by the roles, and the lead says so instead of reporting the integration as ready.

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

## Photographic images: the optional `image-gen` server

An optional extra for the creative designer, never part of the required list: the doctor, the install gate and the Antigravity sync do not know it. It gives her one tool, `mcp__image-gen__generate_image`, which makes an image with the models of Google (Gemini, the default), OpenAI or BytePlus (Seedream), from the user's own keys, and saves it in the project. Offer it only when a plan holds photograph-like assets that nobody supplied and the user wants them generated. Once it is connected, the designer follows two skills: `image-creation` (whether to generate, the look, the record) and `image-generation` (the rules, the provider, the call).

The server must be named `image-gen`: the role's grant names it, and any other name leaves her without the tool. The lead never runs it and never asks for a key in the chat. It asks which provider keys the user has, prints this command with the placeholders of those providers, and the user runs it in their own terminal. The base command is for Gemini, with a key from `aistudio.google.com/apikey` in a Google project that has billing:

```bash
claude mcp add --scope local image-gen --env GEMINI_API_KEY=<your-ai-studio-key> --env IMAGE_PROVIDER=gemini --env SKIP_PROMPT_ENHANCEMENT=true --env IMAGE_OUTPUT_DIR=<absolute path of the project>/assets/generated -- npx -y mcp-image@0.18.0
```

To wire another provider, add one `--env` pair for each other provider the user has a key for, before the `--`:

| Provider | Pair to add | Where the user gets the key, and what the account needs |
|---|---|---|
| OpenAI | `--env OPENAI_API_KEY=<your-openai-key>` | `platform.openai.com/api-keys`; billing; the GPT Image models may need organization verification at OpenAI |
| BytePlus Seedream | `--env ARK_API_KEY=<your-byteplus-ark-key>` | `console.byteplus.com`, ModelArk, an API key made in the AP region (ap-southeast-1); billing |

Set `IMAGE_PROVIDER` to the provider used when a call names none: `gemini` (stated in the base command), `openai` or `seedream`. A user with no Gemini key leaves out the Gemini pair and sets `IMAGE_PROVIDER` to the provider they have. A call that names a provider without its key fails with a message that asks for that key and a restart: that is the lead's to fix with this section, never the designer's.

`--scope local` keeps the keys in the user's own file and the server out of the `.mcp.json` that is shared with the team. Write the path in the form of the user's shell (`C:\work\petpal\assets\generated` in PowerShell, `C:/work/petpal/assets/generated` in Git Bash).

| Setting | Why |
|---|---|
| `GEMINI_API_KEY`, `OPENAI_API_KEY`, `ARK_API_KEY` | The user's own keys, one for each provider they chose. Each account is billed per image |
| `IMAGE_PROVIDER=gemini` | The provider used when a call names none, stated so that the route is in the command |
| `SKIP_PROMPT_ENHANCEMENT=true` | The server would otherwise rewrite the designer's prompt with a second model call. Off, the prompt she writes is the prompt that is sent and recorded, and an image costs one call (Seedream still optimises the prompt on BytePlus's side) |
| `IMAGE_OUTPUT_DIR` | Absolute, and inside the project. The designer holds no shell and cannot move a file, so the picture has to land where the design can use it. The server creates the folder and overwrites a file of the same name |

**Why this version.** `mcp-image@0.18.0` is the number the `latest` tag pointed to on 2026-10-09 (published 2026-10-08). The maintainer asked for the latest tag on that day; it is pinned to the number and not to the floating tag, so that a later release cannot run with the user's keys before anyone has read it. (The first pin, 0.14.0, followed the rule "the newest release older than two weeks"; the maintainer replaced that rule.) MIT, one maintainer, Node 22 or later, no install script, no npm provenance attestation; three dependencies (`@google/genai`, `openai`, `@modelcontextprotocol/sdk`), the same three as 0.14.0, as ranges that `npx` resolves on the day. Read, not run: the diff of its `dist` against 0.14.0 (three new small modules for reference images and eleven changed files, mostly for reference images and a newer default Gemini model), and a search of every `.js` file in the package for subprocess, `eval`, network, environment and file use. It starts no process; it reaches Google and OpenAI through their SDKs and BytePlus with one `fetch` (`ark.ap-southeast.bytepluses.com`); it reads a file only when a call names input images (`inputImagePaths`: PNG, JPEG or WebP, at most 10 MiB each), which go to the provider; it writes one image per call into `IMAGE_OUTPUT_DIR`. **It has no check that the path is inside the project**: it resolves links and asks for an absolute path, an image extension and a regular file, and nothing more, so the rule for input files is the skill `image-generation`'s (`references/input-images-and-paths.md`). Its command line has a `skills install` that copies a skill folder; the server never runs it and nothing here uses it. Not run here: it needs the user's keys, so no call was made. Refresh the pin as for the others: `npm view mcp-image version time`, read what changed, then change this section and its test together.

**Cost.** Image models have no free tier at any of the three providers: each account needs billing, and each call is charged. Gemini costs about $0.03 to $0.24 an image depending on the model and the size, Seedream $0.045 or $0.09, and OpenAI is billed by token with no published price per image (its first image is a probe). The dated table and the arithmetic are in the `image-generation` skill (`references/providers.md`). Suggest a budget alert on each account.

**Check.** After the restart below, `claude mcp get image-gen` shows it, and `ToolSearch` must list `mcp__image-gen__generate_image`: a server that is not listed is not usable. Report what was seen. A running session does not load a server added after it started.

**Undo.** `claude mcp remove image-gen --scope local`, and revoke the keys at their providers when they are no longer wanted.

## Check an install

- `claude mcp get <name>` shows one server; `claude mcp list` shows all, with a status: Connected, Failed, or **Pending approval** (a project-scoped server the user has not approved yet; it is the normal status right after an install).
- In the session, `ToolSearch` lists a server's tools as `mcp__<name>__<tool>`. A server whose tools do not appear is not usable, whatever `claude mcp list` says.
- The lead reports what it saw, not what it expects.

## What a running session sees (observed on 2.1.291)

A session that is already running does not list a server that `claude mcp add` added after it started (a plugin's server is the exception: see the plugin route above): `/mcp` does not list it, and `/mcp reconnect playwright` answers `MCP server "playwright" not found`. `claude mcp list` from another terminal shows it as Pending approval. The way in is a restart: after `/exit` and `claude --continue`, Claude Code asks **New MCP server found in this project: playwright** with three choices, "Use this MCP server", "Use this and all future MCP servers in this project" and "Continue without using this MCP server"; after the first, `/mcp` shows the server under Project MCPs. `/mcp reconnect <name>` is for a server that is loaded and failed.

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

A bare `claude --continue` keeps the session and the agent (seen on 2.1.292: the same session id, and the agent setting written again after the resume) but not the model: the first start had `--model sonnet` and the resumed session ran on Opus, which is both this account's default and the agent's pinned model, so the record cannot say which. Add the `--model` and `--effort` the session ran on to keep them (`claude --continue --agent orchestrator-digital-agency --model sonnet --effort low` was accepted as written and kept the session on 2026-10-06). The two team variables are the shell's, not the session's: set them before `claude --continue`; the lead checks them with `echo` before it spawns. The starting prompt makes the restart work either way, because it carries the plan. Unverified: the desktop app. There, start a new session in the same folder, approve the server when asked, and paste the starting prompt.

## Where this runs

- **The CLI** (Claude Code 2.1.291 and 2.1.292, Windows 11): everything above that says "seen" was run there.
- **The desktop app's Code tab** runs the same engine and reads `.mcp.json` and `~/.claude.json`. Its connectors carry directory ids in their tool names, and the host docs say `/reload-plugins` there runs only on input typed into the session and does not apply plugin MCP server changes: use the manual route and a new session, as in the restart message above. Not verified.
- **The VS Code extension** runs the same engine; what it shows for connectors and plugins is not in the host library, and it was not run: not verified.

## Windows

`npx` and `uvx` ran as written on 2.1.291, with no wrapper. If a server fails with "Connection closed", a possible cause on native Windows is that `npx` is a `.cmd` file, and a workaround people use is `cmd /c npx` in place of `npx` (`claude mcp add --scope project <name> -- cmd /c npx -y <package>`). That form is not in the host library snapshot (its changelog only mentions a removed "Windows requires cmd /c wrapper" warning), it was not needed here, and it is not verified.
