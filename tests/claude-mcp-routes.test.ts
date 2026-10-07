import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CLAUDE_MCP_ROUTES, connectorServerGrant, integrationOf, pluginServerGrant, withRoutes } from '../src/core/claude-mcp-routes.js';

/**
 * The other names an integration's tools take on Claude Code (Plan 035 N1 slice 3, 2026-10-07).
 *
 * `claude mcp add --scope project playwright` keeps the name, and its tools are `mcp__playwright__<tool>`: the form a role's `tools:` line names. A plugin's MCP
 * server is another server. Seen on 2.1.291 with context7: after `claude plugin install context7@claude-plugins-official --scope project`, `claude mcp list` and
 * `/mcp` show `plugin:context7:context7`, and the running session loads it after `/reload-plugins`, with no restart. Its tools are named
 * `mcp__plugin_<plugin>_<server>__<tool>` (the host docs; context7 asks for authentication, so no tool name was seen). A grant names one server, so the roles
 * would not reach a plugin's tools. A claude.ai connector in the CLI is `mcp__claude_ai_<Name>__<tool>` (seen for Firecrawl in earlier session records).
 */

describe('the route table', () => {
  it('gives the five integrations that have a plugin MCP server their plugin grant, with the server key of each plugin', () => {
    expect(pluginServerGrant('context7')).toBe('mcp__plugin_context7_context7');
    expect(pluginServerGrant('github')).toBe('mcp__plugin_github_github');
    expect(pluginServerGrant('playwright')).toBe('mcp__plugin_playwright_playwright');
    expect(pluginServerGrant('figma')).toBe('mcp__plugin_figma_figma');
    // The chrome-devtools-mcp plugin declares its server as `chrome-devtools`, not `chrome-devtools-mcp` (its plugin.json, read at the pinned commit).
    expect(pluginServerGrant('chrome-devtools-mcp')).toBe('mcp__plugin_chrome-devtools-mcp_chrome-devtools');
  });

  it('gives no plugin grant to the integrations whose plugin has no MCP server or that have no plugin', () => {
    // The firecrawl plugin carries skills and commands only (no .mcp.json, no mcpServers); markitdown and stitch have no plugin in the official marketplace.
    for (const integration of ['firecrawl', 'markitdown', 'stitch', 'unknown']) expect(pluginServerGrant(integration), integration).toBeUndefined();
  });

  it('gives Firecrawl its connector grant and no other integration one, because no other connector name was seen', () => {
    expect(connectorServerGrant('firecrawl')).toBe('mcp__claude_ai_Firecrawl');
    for (const integration of ['github', 'context7', 'playwright', 'chrome-devtools-mcp', 'figma', 'markitdown', 'stitch']) {
      expect(connectorServerGrant(integration), integration).toBeUndefined();
    }
  });

  it('keeps the table to integrations of the agency', () => {
    expect(Object.keys(CLAUDE_MCP_ROUTES).sort()).toEqual(['chrome-devtools-mcp', 'context7', 'figma', 'firecrawl', 'github', 'playwright']);
  });
});

describe('withRoutes', () => {
  it('follows a server-level grant with the plugin grant and, where there is one, the connector grant', () => {
    expect(withRoutes(['mcp__playwright'])).toEqual(['mcp__playwright', 'mcp__plugin_playwright_playwright']);
    expect(withRoutes(['mcp__firecrawl'])).toEqual(['mcp__firecrawl', 'mcp__claude_ai_Firecrawl']);
  });

  it('keeps the tool of a pinned read-only grant under the plugin name', () => {
    expect(withRoutes(['mcp__github__search_code', 'mcp__github__pull_request_read'])).toEqual([
      'mcp__github__search_code',
      'mcp__plugin_github_github__search_code',
      'mcp__github__pull_request_read',
      'mcp__plugin_github_github__pull_request_read',
    ]);
  });

  it('leaves what has no other route, and what is not an MCP grant, as it is', () => {
    expect(withRoutes(['Read', 'mcp__markitdown', 'mcp__stitch', 'mcp__unknown__tool'])).toEqual(['Read', 'mcp__markitdown', 'mcp__stitch', 'mcp__unknown__tool']);
  });

  it('adds no grant twice', () => {
    expect(withRoutes(['mcp__context7', 'mcp__plugin_context7_context7'])).toEqual(['mcp__context7', 'mcp__plugin_context7_context7']);
  });
});

describe('integrationOf', () => {
  it('names the integration behind a grant, whatever the route and with or without a tool', () => {
    expect(integrationOf('mcp__github')).toBe('github');
    expect(integrationOf('mcp__github__search_code')).toBe('github');
    expect(integrationOf('mcp__plugin_github_github')).toBe('github');
    expect(integrationOf('mcp__plugin_github_github__search_code')).toBe('github');
    expect(integrationOf('mcp__plugin_chrome-devtools-mcp_chrome-devtools')).toBe('chrome-devtools-mcp');
    expect(integrationOf('mcp__claude_ai_Firecrawl')).toBe('firecrawl');
    expect(integrationOf('mcp__claude_ai_Firecrawl__firecrawl_scrape')).toBe('firecrawl');
    expect(integrationOf('mcp__markitdown')).toBe('markitdown');
  });
});

describe('the digital-agency roles carry the plugin names, written out', () => {
  const toolsOf = (file: string): string => {
    const text = fs.readFileSync(path.resolve('registry/hosts/claude/agents', file), 'utf8').replace(/\r\n/g, '\n');
    return /^tools: (.*)$/m.exec(text)?.[1] ?? '';
  };

  it('Emre, who drives the browser, names the plugin forms of Playwright, Chrome DevTools and Context7 beside the manual ones', () => {
    const tools = toolsOf('agency-qa-automation-lead.md').split(', ');
    for (const name of ['mcp__playwright', 'mcp__plugin_playwright_playwright', 'mcp__chrome-devtools-mcp', 'mcp__plugin_chrome-devtools-mcp_chrome-devtools', 'mcp__context7', 'mcp__plugin_context7_context7']) {
      expect(tools, name).toContain(name);
    }
  });

  it('the compliance specialist reads GitHub under both names, with the same four read-only tools', () => {
    const tools = toolsOf('agency-compliance-grc-specialist.md').split(', ');
    for (const tool of ['search_code', 'get_file_contents', 'list_pull_requests', 'pull_request_read']) {
      expect(tools, tool).toContain(`mcp__github__${tool}`);
      expect(tools, tool).toContain(`mcp__plugin_github_github__${tool}`);
    }
    expect(tools).not.toContain('mcp__plugin_github_github');
  });

  it('the lead names every route, so that ToolSearch can see what an install by plugin brought in', () => {
    const tools = toolsOf('orchestrator-digital-agency.md').split(', ');
    for (const name of ['mcp__plugin_github_github', 'mcp__plugin_playwright_playwright', 'mcp__plugin_context7_context7', 'mcp__plugin_chrome-devtools-mcp_chrome-devtools', 'mcp__plugin_figma_figma', 'mcp__claude_ai_Firecrawl']) {
      expect(tools, name).toContain(name);
    }
  });
});
