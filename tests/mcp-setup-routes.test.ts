import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The three routes to an integration on Claude Code (Plan 035 N1 slice 2, 2026-10-07): manual (`claude mcp add`), plugin (`claude plugin install`) and
 * connector (a claude.ai directory page). What was seen on 2.1.291: a running session never loads a server added with `claude mcp add` (a restart is needed);
 * after `claude plugin install context7@claude-plugins-official --scope project` the session loaded `plugin:context7:context7` once the user typed
 * `/reload-plugins`, with no restart; and the firecrawl plugin ships skills and no MCP server. The reference holds the table and the choice; the lead's
 * Preflight applies it.
 */

const read = (relative: string): string => fs.readFileSync(path.resolve(relative), 'utf8').replace(/\r\n/g, '\n');
const REF = read('registry/skills/mcp-setup/references/claude-code.md');
const SKILL = read('registry/skills/mcp-setup/SKILL.md');
const LEAD = read('registry/hosts/claude/agents/orchestrator-digital-agency.md');
const PREFLIGHT = LEAD.slice(LEAD.indexOf('## Preflight: the integrations the plan needs'), LEAD.indexOf('## Run the team'));

const between = (text: string, from: string, to?: string): string => {
  const start = text.indexOf(from);
  if (start === -1) return '';
  const end = to ? text.indexOf(to, start + from.length) : -1;
  return end === -1 ? text.slice(start) : text.slice(start, end);
};
const ROUTES = between(REF, '## Routes: manual, plugin, connector', '\n## ');
const row = (integration: string): string => REF.split('\n').find(line => line.startsWith(`| ${integration} |`)) ?? '';

describe('the reference: the three routes', () => {
  it('has a Routes section with the three routes, who runs each and what follows the install', () => {
    expect(ROUTES).not.toBe('');
    expect(ROUTES).toContain('| **Manual**');
    expect(ROUTES).toContain('| **Plugin**');
    expect(ROUTES).toContain('| **Connector**');
    expect(ROUTES).toContain('a running session never loads it');
    expect(ROUTES).toContain('no restart');
  });

  it('makes the manual route the default and says when to offer the plugin and what a connector is', () => {
    expect(ROUTES).toContain('The manual route is the default');
    expect(ROUTES).toMatch(/Offer the plugin route in the same question, as the option for a user who wants to avoid the restart/);
    expect(ROUTES).toMatch(/A connector is the user's own act: print its directory link/);
  });

  it('gives the plugin route as steps: search, the install after the yes, the reload only the user can type, the check, and the fallback', () => {
    const steps = between(REF, '### The plugin route, step by step', '\n## ');
    expect(steps).not.toBe('');
    expect(steps).toContain('${CLAUDE_SKILL_DIR}/scripts/find-plugin.mjs');
    expect(steps).toContain('claude plugin install <name>@claude-plugins-official --scope project');
    expect(steps).toContain('`/reload-plugins --force`');
    expect(steps).toMatch(/only the user can type a slash command/);
    expect(steps).toMatch(/warns and skips/);
    expect(steps).toContain('`ToolSearch`');
    expect(steps).toMatch(/needs authentication/i);
    expect(steps).toMatch(/restart message below/);
  });
});

describe('the reference: one row per integration', () => {
  it('github: the remote server with a token for the user to run, and the plugin that reads the token from the environment', () => {
    expect(row('github')).toContain('github@claude-plugins-official');
    expect(row('github')).toContain('GITHUB_PERSONAL_ACCESS_TOKEN');
    expect(row('github')).toContain('--scope local');
  });

  it('firecrawl: its plugin has no MCP server, so the connector is the other route to the tools', () => {
    expect(row('firecrawl')).toContain('no MCP server');
    expect(row('firecrawl')).toContain('claude.ai/directory/firecrawl');
    expect(row('firecrawl')).toContain('mcp__claude_ai_Firecrawl');
  });

  it('context7, playwright, chrome-devtools-mcp and figma: the pinned manual command, the plugin with its server name, the connector where there is one', () => {
    expect(row('context7')).toContain('@upstash/context7-mcp@4.1.1');
    expect(row('context7')).toContain('context7@claude-plugins-official');
    expect(row('context7')).toMatch(/needs authentication/i);
    expect(row('context7')).toContain('claude.ai/directory/context7');
    expect(row('playwright')).toContain('@playwright/mcp@0.0.83');
    expect(row('playwright')).toContain('playwright@claude-plugins-official');
    expect(row('playwright')).toContain('@playwright/mcp@latest');
    expect(row('chrome-devtools-mcp')).toContain('chrome-devtools-mcp@1.10.1');
    expect(row('chrome-devtools-mcp')).toContain('chrome-devtools-mcp@claude-plugins-official');
    expect(row('chrome-devtools-mcp')).toContain('plugin:chrome-devtools-mcp:chrome-devtools');
    expect(row('figma')).toContain('figma@claude-plugins-official');
    expect(row('figma')).toContain('claude.ai/directory/figma');
  });

  it('markitdown and stitch: no plugin, and Stitch has a connector', () => {
    expect(row('markitdown')).toContain('markitdown-mcp@0.0.1a7');
    expect(row('markitdown')).toContain('no plugin');
    expect(row('stitch')).toContain('no plugin');
    expect(row('stitch')).toContain('claude.ai/directory/c25fdbda-aebd-4312-95fb-6513ffae0f43');
  });
});

describe('the reference: names and environments', () => {
  it('says what each route calls the tools, which form was seen and which was only documented', () => {
    const names = between(REF, '## Names by route', '\n## ');
    expect(names).not.toBe('');
    expect(names).toContain('mcp__<name>__<tool>');
    expect(names).toContain('plugin:context7:context7');
    expect(names).toContain('mcp__plugin_<plugin>_<server>__<tool>');
    expect(names).toContain('mcp__claude_ai_<Name>__<tool>');
    expect(names).toMatch(/directory id/);
    expect(names).toMatch(/do not name the desktop app's directory ids/);
  });

  it('keeps the environments honest: the CLI was run, the desktop app and the VS Code extension were not', () => {
    const where = between(REF, '## Where this runs', '\n## ');
    expect(where).not.toBe('');
    expect(where).toMatch(/Claude Code 2\.1\.291/);
    expect(where).toMatch(/does not apply plugin MCP server changes/);
    expect(where).toMatch(/VS Code/);
    expect(where).toMatch(/not verified/);
  });
});

describe('the skill points at the routes and the script', () => {
  it('names the routes in the Claude Code row and runs the script through CLAUDE_SKILL_DIR in the runbook', () => {
    const claudeRow = SKILL.split('\n').find(line => line.startsWith('| **Claude Code (CLI)**')) ?? '';
    expect(claudeRow).toMatch(/three routes/);
    expect(claudeRow).toContain('references/claude-code.md');
    const runbook = SKILL.slice(SKILL.indexOf('### Phase 3'));
    expect(runbook).toContain('${CLAUDE_SKILL_DIR}/scripts/find-plugin.mjs');
    expect(runbook).toMatch(/connector/);
  });
});

describe('the lead: the route choice in the Preflight', () => {
  const routes = between(PREFLIGHT, '**Routes.**');

  it('has a Routes paragraph in the Preflight', () => {
    expect(PREFLIGHT).not.toBe('');
    expect(routes).not.toBe('');
  });

  it('uses the manual route unless the user asks to avoid the restart, and searches the plugin catalogs with the script', () => {
    expect(routes).toContain('The manual route is the recommended one');
    // Found by the live runs of 2026-10-07: a lead that asked only "install both?" gave the user no way to say they did not want a restart.
    expect(routes).toContain('Put the route in the same `AskUserQuestion` that asks which servers to install');
    expect(routes).toMatch(/a user who has already said they do not want to restart gets the plugin route without being asked/);
    expect(routes).toMatch(/If the user changes their mind after a manual install, remove the entries you added \(`claude mcp remove <name> --scope project`\) before the plugin install/);
    expect(routes).toContain('find-plugin.mjs');
    expect(routes).toContain('claude plugin install <name>@claude-plugins-official --scope project');
  });

  it('after a plugin install asks the user for the reload and then checks, and knows what a plugin without a server gives', () => {
    expect(routes).toContain('type `/reload-plugins --force`');
    expect(routes).toMatch(/only the user can type a slash command/);
    expect(routes).toMatch(/then check with `ToolSearch`/);
    expect(routes).toMatch(/a plugin that ships no MCP server \(the firecrawl plugin ships skills\) gives skills, not tools/);
    expect(routes).toMatch(/spawn nobody until the check has passed/);
  });

  it('prints a connector as a link, checks it afterwards, and says what the roles can reach', () => {
    expect(routes).toMatch(/a connector is the user's own act: print its directory link/);
    expect(routes).toContain('check afterwards with `claude mcp list` and `ToolSearch`');
    expect(routes).toMatch(/a connector connected in the desktop app is not reachable by the roles/);
  });

  it('keeps the restart for the manual route', () => {
    expect(PREFLIGHT).toMatch(/After a manual install, stop/);
  });
});

describe('the reference: what the live runs of 2026-10-07 showed (Claude Code 2.1.292)', () => {
  it('names the plugin tools that were seen, not only the documented form', () => {
    const names = between(REF, '## Names by route', '\n## ');
    expect(names).toContain('mcp__plugin_playwright_playwright__browser_navigate');
    expect(names).toContain('mcp__plugin_chrome-devtools-mcp_chrome-devtools__list_console_messages');
    expect(names).toMatch(/seen on 2\.1\.292/);
    expect(names).not.toMatch(/no tool name has been seen yet/);
  });

  it('records that the reload loaded two plugin servers into a session with model turns, and that it does not load a server `claude mcp add` added', () => {
    const steps = between(REF, '### The plugin route, step by step', '\n## ');
    expect(steps).toMatch(/loaded two plugin MCP servers/);
    expect(steps).toContain('does not load a server that `claude mcp add` added (seen: "0 plugin MCP servers")');
    expect(steps).toContain('If the user changes their mind after a manual install, remove the entries you added');
  });

  it('says what a bare `claude --continue` keeps and what it does not', () => {
    const restart = between(REF, '## The restart message', '\n## ');
    expect(restart).not.toBe('');
    expect(restart).toContain('A bare `claude --continue` keeps the session and the agent');
    expect(restart).toMatch(/not the model/);
    expect(restart).toMatch(/the shell's, not the session's/);
    expect(restart).toMatch(/Unverified/);
  });

  it('says that the CLI listed no connector until the user signed in again', () => {
    const names = between(REF, '## Names by route', '\n## ');
    expect(names).toMatch(/no claude\.ai connector until the user ran `\/login`/);
  });

  it('names both versions where it ran', () => {
    expect(between(REF, '## Where this runs', '\n## ')).toMatch(/2\.1\.291 and 2\.1\.292/);
  });
});

describe('the documents of N1 name the routes (Plan 035 N1)', () => {
  it('CONTEXT.md defines the MCP Route and the protocol amends H9 with the dated findings', () => {
    const context = read('CONTEXT.md');
    const term = between(context, '**MCP Route**:', '**Multimodal Asset Inlining');
    expect(term).not.toBe('');
    expect(term).toMatch(/manual \(`claude mcp add --scope project`/);
    expect(term).toMatch(/plugin \(`claude plugin install <name>@claude-plugins-official --scope project`/);
    expect(term).toMatch(/or connector \(a claude\.ai directory page/);
    expect(term).toMatch(/different tool names/);
    expect(term).toMatch(/_Avoid_/);
    const protocol = read('docs/live-test-protocol.md');
    const h9 = between(protocol, '## H9 Provisioning', '\n## H1 ');
    expect(h9).toMatch(/Amended 2026-10-07 \(Plan 035 N1, the routes\)/);
    expect(h9).toContain('`claude --continue` with no flags');
    expect(h9).toContain('2026-10-07-claude-2.1.292-n1-routes.md');
  });

  it('the ADR is numbered after the last one and states its status, context, decision and consequences', () => {
    const adr = read('docs/adr/0041-claude-integration-routes-and-optional-extras.md');
    for (const marker of ['- **Status**', '- **Context**', '- **Decision**', '- **Consequences**']) expect(adr).toContain(marker);
    expect(adr).toContain('# ADR 0041:');
  });
});
