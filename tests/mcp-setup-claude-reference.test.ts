import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The `mcp-setup` skill carries a Claude Code reference that the digital-agency lead loads when an integration its plan needs is missing
 * (Plan 035 H9, 2026-10-06). Its commands were wrong for this host (`claude mcp add <name> <command> [args...]`, no `--`, no scope, a workspace file
 * at `.claude/mcp.json`); the reference holds the exact commands of the eight integrations, how to check an install, what a running session does and
 * does not see, and the restart. Nothing in it is a secret: a credentialed server is a command with a placeholder.
 */

const SKILL_DIR = path.resolve('registry/skills/mcp-setup');
const SKILL = (): string => fs.readFileSync(path.join(SKILL_DIR, 'SKILL.md'), 'utf8').replace(/\r\n/g, '\n');
const REF = (): string => fs.readFileSync(path.join(SKILL_DIR, 'references/claude-code.md'), 'utf8').replace(/\r\n/g, '\n');

describe('mcp-setup: the Claude Code row and the pointer to the reference', () => {
  it('names the workspace file `.mcp.json` and the command with its scope and the `--`, and points at the reference', () => {
    const row = SKILL().split('\n').find(line => line.startsWith('| **Claude Code (CLI)**')) ?? '';
    expect(row).toContain('`.mcp.json`');
    expect(row).toContain('claude mcp add --scope project <name> -- <command> [args...]');
    expect(row).toContain('references/claude-code.md');
    expect(SKILL()).not.toContain('claude mcp add <name> <command> [args...]');
    expect(SKILL()).not.toContain('`.claude/mcp.json`');
  });

  it('sends the Claude Code runbook to the reference, with the restart that a running session needs', () => {
    const runbook = SKILL().slice(SKILL().indexOf('### Phase 3'));
    expect(runbook).toContain('references/claude-code.md');
    expect(runbook).toMatch(/restart/i);
  });
});

describe('mcp-setup: references/claude-code.md', () => {
  it('says what it was checked on', () => {
    expect(REF()).toMatch(/Claude Code 2\.1\.291/);
    expect(REF()).toMatch(/2026-10-06/);
  });

  it('shows the add command with its scope, the `--`, and why each matters', () => {
    const text = REF();
    expect(text).toContain('claude mcp add --scope project <name> -- <command> [args...]');
    expect(text).toMatch(/`--scope project` writes `\.mcp\.json`/);
    expect(text).toMatch(/`--scope local`[^\n]*`~\/\.claude\.json`/);
    expect(text).toMatch(/flags such as `-y`/);
    expect(text).toContain('claude mcp remove <name> --scope project');
  });

  it('holds the exact commands of the four servers that need no account or key', () => {
    const text = REF();
    for (const command of [
      'claude mcp add --scope project context7 -- npx -y @upstash/context7-mcp@4.1.1',
      'claude mcp add --scope project playwright -- npx -y @playwright/mcp@0.0.83',
      'claude mcp add --scope project chrome-devtools-mcp -- npx -y chrome-devtools-mcp@1.10.1',
      'claude mcp add --scope project markitdown -- uvx markitdown-mcp@0.0.1a7',
    ]) expect(text, command).toContain(command);
  });

  // Observed on 2.1.291 (H9 retest, 2026-10-06): the lead installed `@playwright/mcp@latest` from memory and the team drove the browser with it, with no browser
  // download (no new browser build appeared; only the server's profile folder). The community server the reference first held pins Playwright 1.57.0 and a browser build.
  it('pins every package, says how to refresh the pins and which ones were seen working, and never writes @latest', () => {
    const text = REF();
    expect(text).toMatch(/Versions pinned on 2026-10-06/);
    expect(text).toContain('npm view <package> version');
    expect(text).toMatch(/Seen working on 2\.1\.291[^\n]*context7[^\n]*@playwright\/mcp[^\n]*chrome-devtools-mcp[^\n]*markitdown/);
    expect(text).toMatch(/not run[^\n]*github[^\n]*firecrawl[^\n]*stitch[^\n]*figma/i);
    expect(text).not.toMatch(/npx -y [^\s`]+@latest/);
  });

  it('says that @playwright/mcp uses the installed Chrome with no browser download, and keeps the community server as an alternative with its facts', () => {
    const text = REF();
    expect(text).toMatch(/uses the installed Chrome/);
    expect(text).toMatch(/no browser download/);
    expect(text).toContain('@executeautomation/playwright-mcp-server@1.0.12');
    expect(text).toContain('npx -y playwright@1.57.0 install chromium');
    expect(text).toMatch(/Chromium build 1200/);
    expect(text).toContain('PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1');
    expect(text).toMatch(/178 MB/);
    expect(text).toMatch(/Chrome installed/);
    expect(text).toMatch(/`uv`/);
  });

  it('holds the four credentialed servers as commands with placeholders, in a scope that stays out of the shared file', () => {
    const text = REF();
    for (const needle of [
      'claude mcp add --scope local --transport http github https://api.githubcopilot.com/mcp/ --header "Authorization: Bearer <your-token>"',
      'claude mcp add --scope local firecrawl --env FIRECRAWL_API_KEY=<your-api-key> -- npx -y firecrawl-mcp@3.27.3',
      'claude mcp add --scope local --transport http stitch https://stitch.googleapis.com/mcp --header "X-Goog-Api-Key: <your-api-key>"',
      'claude mcp add --scope local figma --env FIGMA_ACCESS_TOKEN=<your-token> -- npx -y ai-figma-mcp@1.0.8',
    ]) expect(text, needle).toContain(needle);
    // `@modelcontextprotocol/server-github` (the skill's matrix) is deprecated on npm ("Package no longer supported"); the host docs use GitHub's remote server.
    expect(text).toMatch(/@modelcontextprotocol\/server-github[^\n]*deprecated/);
    expect(text).not.toMatch(/claude mcp add[^\n]*@modelcontextprotocol\/server-github/);
    expect(text).toMatch(/never runs these/i);
    expect(text).toMatch(/shared with the team/);
  });

  it('checks an install with `claude mcp get`, `claude mcp list` and ToolSearch, and reads the statuses', () => {
    const text = REF();
    for (const needle of ['claude mcp get <name>', 'claude mcp list', 'Pending approval', 'Connected', '`ToolSearch`', 'mcp__<name>__']) expect(text, needle).toContain(needle);
  });

  it('says what a running session sees, and what a restart shows (observed 2.1.291)', () => {
    const text = REF();
    expect(text).toMatch(/does not list it/);
    expect(text).toContain('MCP server "playwright" not found');
    expect(text).toContain('New MCP server found in this project');
    for (const choice of ['Use this MCP server', 'Use this and all future MCP servers in this project', 'Continue without using this MCP server']) expect(text, choice).toContain(choice);
    expect(text).toContain('Project MCPs');
    expect(text).toMatch(/does not restore in-process teammates/);
  });

  it('gives the restart command for PowerShell and for a POSIX shell, with both team variables, and marks what is unverified', () => {
    const text = REF();
    expect(text).toContain("$env:CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS='1'; $env:CLAUDE_CODE_ENABLE_TODO_TOOLS='1'");
    expect(text).toContain('export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 CLAUDE_CODE_ENABLE_TODO_TOOLS=1');
    expect(text).toContain('claude --continue --agent orchestrator-digital-agency');
    expect(text).toMatch(/Unverified/);
    expect(text).toMatch(/desktop app/i);
  });

  it('notes the Windows case, and holds no real-looking secret', () => {
    const text = REF();
    expect(text).toContain('cmd /c npx');
    expect(text).not.toMatch(/\bsk-[A-Za-z0-9]{10,}/);
    expect(text).not.toMatch(/\bghp_[A-Za-z0-9]{10,}/);
    expect(text).not.toMatch(/\bfc-[A-Za-z0-9]{10,}/);
    expect(text).not.toMatch(/\bfigd_[A-Za-z0-9]{10,}/);
  });
});
