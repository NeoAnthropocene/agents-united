import path from 'node:path';
import os from 'node:os';
import fs from 'fs-extra';
import type { AgentHost } from './types.js';

export type McpClientCategory = 'cli' | 'extension' | 'desktop' | 'workspace';

export interface McpLocationDescriptor {
  id: string;
  host: AgentHost | 'gemini' | 'cline' | 'claude' | 'cursor' | 'opencode' | 'windsurf' | 'zed' | 'custom';
  category: McpClientCategory;
  label: string;
  resolvePath: (cwd: string, homeDir: string, appData: string) => string;
  isPrimary?: boolean;
}

export interface DiscoveredMcpConfig {
  id: string;
  host: string;
  category: McpClientCategory;
  label: string;
  path: string;
  exists: boolean;
  serverCount: number;
  servers?: Record<string, any>;
  isPrimary?: boolean;
}

export class McpLocationRegistry {
  /**
   * Declarative catalog of known MCP configuration files across AI tools, CLIs, extensions, and workspaces.
   */
  public static readonly LOCATIONS: McpLocationDescriptor[] = [
    // --- Google Antigravity & Gemini ---
    {
      id: 'antigravity-global',
      host: 'gemini',
      category: 'cli',
      label: 'Google Antigravity & Gemini Global Config',
      resolvePath: (_, home) => path.join(home, '.gemini', 'config', 'mcp_config.json'),
      isPrimary: true,
    },
    {
      id: 'antigravity-system',
      host: 'gemini',
      category: 'desktop',
      label: 'Google Antigravity System Config',
      resolvePath: (_, home) => path.join(home, '.gemini', 'antigravity', 'mcp_config.json'),
    },
    {
      id: 'antigravity-workspace',
      host: 'gemini',
      category: 'workspace',
      label: 'Google Antigravity Local Workspace Config',
      resolvePath: (cwd) => path.join(cwd, '.gemini', 'config', 'mcp_config.json'),
    },
    {
      id: 'gemini-appdata',
      host: 'gemini',
      category: 'cli',
      label: 'Google Gemini AppData Config',
      resolvePath: (_, __, appData) => path.join(appData, 'gemini', 'config', 'mcp_config.json'),
    },

    // --- Cline CLI & VS Code Extension ---
    {
      id: 'cline-cli-settings',
      host: 'cline',
      category: 'cli',
      label: 'Cline CLI MCP Settings',
      resolvePath: (_, home) => path.join(home, '.cline', 'data', 'settings', 'cline_mcp_settings.json'),
      isPrimary: true,
    },
    {
      id: 'cline-extension-settings',
      host: 'cline',
      category: 'extension',
      label: 'Cline VS Code Extension Global Settings',
      resolvePath: (_, __, appData) => path.join(appData, 'Code', 'User', 'globalStorage', 'saoudrizwan.claude-dev', 'settings', 'cline_mcp_settings.json'),
    },
    {
      id: 'cline-insiders-extension-settings',
      host: 'cline',
      category: 'extension',
      label: 'Cline VS Code Insiders Extension Settings',
      resolvePath: (_, __, appData) => path.join(appData, 'Code - Insiders', 'User', 'globalStorage', 'saoudrizwan.claude-dev', 'settings', 'cline_mcp_settings.json'),
    },
    {
      id: 'cline-legacy-settings',
      host: 'cline',
      category: 'cli',
      label: 'Cline Home Legacy Settings',
      resolvePath: (_, home) => path.join(home, '.cline', 'settings', 'cline_mcp_settings.json'),
    },
    {
      id: 'cline-home-flat',
      host: 'cline',
      category: 'cli',
      label: 'Cline Home Flat Settings',
      resolvePath: (_, home) => path.join(home, 'cline_mcp_settings.json'),
    },
    {
      id: 'cline-workspace-flat',
      host: 'cline',
      category: 'workspace',
      label: 'Cline Workspace Settings',
      resolvePath: (cwd) => path.join(cwd, 'cline_mcp_settings.json'),
    },
    {
      id: 'cline-workspace-dot',
      host: 'cline',
      category: 'workspace',
      label: 'Cline Workspace .cline/mcp.json',
      resolvePath: (cwd) => path.join(cwd, '.cline', 'mcp.json'),
    },

    // --- Roo Code Extension ---
    {
      id: 'roo-code-extension-settings',
      host: 'cline',
      category: 'extension',
      label: 'Roo Code VS Code Extension Settings',
      resolvePath: (_, __, appData) => path.join(appData, 'Code', 'User', 'globalStorage', 'rooveterinaryinc.roo-cline', 'settings', 'cline_mcp_settings.json'),
    },

    // --- Cursor IDE / CLI ---
    {
      id: 'cursor-workspace',
      host: 'cursor',
      category: 'workspace',
      label: 'Cursor Workspace Config',
      resolvePath: (cwd) => path.join(cwd, '.cursor', 'mcp.json'),
      isPrimary: true,
    },
    {
      id: 'cursor-global',
      host: 'cursor',
      category: 'desktop',
      label: 'Cursor Global User Config',
      resolvePath: (_, home) => path.join(home, '.cursor', 'mcp.json'),
    },

    // --- Claude Code CLI & Claude Desktop ---
    {
      id: 'claude-workspace-dot',
      host: 'claude',
      category: 'workspace',
      label: 'Claude Code Workspace Config',
      resolvePath: (cwd) => path.join(cwd, '.claude', 'mcp.json'),
      isPrimary: true,
    },
    {
      id: 'claude-workspace-flat',
      host: 'claude',
      category: 'workspace',
      label: 'Claude Workspace claude.json',
      resolvePath: (cwd) => path.join(cwd, 'claude.json'),
    },
    {
      id: 'claude-global-dot',
      host: 'claude',
      category: 'cli',
      label: 'Claude Code Global Config',
      resolvePath: (_, home) => path.join(home, '.claude', 'mcp.json'),
    },
    {
      id: 'claude-global-flat',
      host: 'claude',
      category: 'cli',
      label: 'Claude Code Global claude.json',
      resolvePath: (_, home) => path.join(home, 'claude.json'),
    },
    {
      id: 'claude-desktop-global',
      host: 'claude',
      category: 'desktop',
      label: 'Claude Desktop Global Config',
      resolvePath: (_, __, appData) => path.join(appData, 'Claude', 'claude_desktop_config.json'),
    },

    // --- Windsurf IDE ---
    {
      id: 'windsurf-global',
      host: 'windsurf',
      category: 'desktop',
      label: 'Windsurf Global Config',
      resolvePath: (_, home) => path.join(home, '.codeium', 'windsurf', 'mcp_config.json'),
      isPrimary: true,
    },
    {
      id: 'windsurf-appdata',
      host: 'windsurf',
      category: 'desktop',
      label: 'Windsurf AppData Config',
      resolvePath: (_, __, appData) => path.join(appData, 'Windsurf', 'mcp_config.json'),
    },

    // --- OpenCode & Codex ---
    {
      id: 'opencode-workspace',
      host: 'opencode',
      category: 'workspace',
      label: 'OpenCode Workspace Config',
      resolvePath: (cwd) => path.join(cwd, '.opencode', 'mcp.json'),
      isPrimary: true,
    },
    {
      id: 'opencode-global',
      host: 'opencode',
      category: 'cli',
      label: 'OpenCode Global Config',
      resolvePath: (_, home) => path.join(home, '.config', 'opencode', 'mcp.json'),
    },
  ];

  /**
   * Discovers all MCP configuration files across the filesystem, inspecting existence and parsing server definitions.
   */
  public static async discoverAll(cwd: string = process.cwd()): Promise<DiscoveredMcpConfig[]> {
    const homeDir = os.homedir();
    const appData = process.env.APPDATA || (process.platform === 'darwin' ? path.join(homeDir, 'Library', 'Application Support') : path.join(homeDir, '.config'));

    const results: DiscoveredMcpConfig[] = [];
    const seenPaths = new Set<string>();

    for (const desc of McpLocationRegistry.LOCATIONS) {
      const resolved = path.normalize(desc.resolvePath(cwd, homeDir, appData));
      const key = resolved.toLowerCase();
      if (seenPaths.has(key)) continue;
      seenPaths.add(key);

      const exists = await fs.pathExists(resolved);
      let serverCount = 0;
      let servers: Record<string, any> | undefined;

      if (exists) {
        try {
          const config = await fs.readJson(resolved);
          const rawServers = config?.mcpServers || config?.servers || config;
          if (rawServers && typeof rawServers === 'object') {
            servers = rawServers;
            serverCount = Object.keys(rawServers).length;
          }
        } catch {}
      }

      results.push({
        id: desc.id,
        host: desc.host,
        category: desc.category,
        label: desc.label,
        path: resolved,
        exists,
        serverCount,
        servers,
        isPrimary: desc.isPrimary,
      });
    }

    return results;
  }

  /**
   * Returns discovered locations filtered for specific host(s).
   */
  public static async discoverForHosts(hosts: (AgentHost | string)[], cwd: string = process.cwd()): Promise<DiscoveredMcpConfig[]> {
    const all = await McpLocationRegistry.discoverAll(cwd);
    const hostSet = new Set(hosts.map(h => (h === 'agents' ? 'gemini' : h)));
    return all.filter(loc => hostSet.has(loc.host));
  }

  /**
   * Resolves the primary target write path for a given host runtime.
   */
  public static getPrimaryWritePath(host: AgentHost | string, cwd: string = process.cwd()): string {
    const homeDir = os.homedir();
    const appData = process.env.APPDATA || (process.platform === 'darwin' ? path.join(homeDir, 'Library', 'Application Support') : path.join(homeDir, '.config'));

    const targetHost = host === 'agents' ? 'gemini' : host;
    const desc = McpLocationRegistry.LOCATIONS.find(l => l.host === targetHost && l.isPrimary);
    if (desc) {
      return path.normalize(desc.resolvePath(cwd, homeDir, appData));
    }
    return path.normalize(path.join(cwd, '.cursor', 'mcp.json'));
  }
}
