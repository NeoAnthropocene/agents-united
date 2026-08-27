import path from 'node:path';
import os from 'node:os';
import fs from 'fs-extra';
import type {
  BundleDefinition,
  PrerequisiteEvaluation,
  PrerequisiteItemCheck,
  BundlePrerequisites,
} from './types.js';

export interface PrerequisiteCheckOptions {
  cwd?: string;
  env?: Record<string, string | undefined>;
}

export interface DiscoveredConfigFile {
  host: 'gemini' | 'cursor' | 'cline' | 'claude' | 'opencode' | 'custom';
  label: string;
  path: string;
  exists: boolean;
  serverCount?: number;
}

export class PrerequisiteChecker {
  /**
   * Discovers all candidate and existing MCP configuration files across AI hosts
   */
  public static async discoverHostConfigFiles(cwd: string = process.cwd()): Promise<DiscoveredConfigFile[]> {
    const homeDir = os.homedir();
    const appData = process.env.APPDATA || (process.platform === 'darwin' ? path.join(homeDir, 'Library', 'Application Support') : path.join(homeDir, '.config'));

    const candidates: Array<{ host: DiscoveredConfigFile['host']; label: string; path: string }> = [
      // Google Antigravity / Gemini
      {
        host: 'gemini',
        label: 'Google Antigravity / Gemini Global Config',
        path: path.join(homeDir, '.gemini', 'config', 'mcp_config.json'),
      },
      {
        host: 'gemini',
        label: 'Google Antigravity System Config',
        path: path.join(homeDir, '.gemini', 'antigravity', 'mcp_config.json'),
      },
      {
        host: 'gemini',
        label: 'Google Antigravity Local Workspace Config',
        path: path.join(cwd, '.gemini', 'config', 'mcp_config.json'),
      },
      // Cursor
      {
        host: 'cursor',
        label: 'Cursor Workspace Config',
        path: path.join(cwd, '.cursor', 'mcp.json'),
      },
      {
        host: 'cursor',
        label: 'Cursor Global Config',
        path: path.join(homeDir, '.cursor', 'mcp.json'),
      },
      // Cline & Roo Code
      {
        host: 'cline',
        label: 'Cline Workspace Config',
        path: path.join(cwd, 'cline_mcp_settings.json'),
      },
      {
        host: 'cline',
        label: 'Cline Extension Global Settings',
        path: path.join(appData, 'Code', 'User', 'globalStorage', 'saoudrizwan.claude-dev', 'settings', 'cline_mcp_settings.json'),
      },
      {
        host: 'cline',
        label: 'Roo Code Global Settings',
        path: path.join(appData, 'Code', 'User', 'globalStorage', 'rooveterinaryinc.roo-cline', 'settings', 'cline_mcp_settings.json'),
      },
      {
        host: 'cline',
        label: 'Cline Global Config',
        path: path.join(homeDir, 'cline_mcp_settings.json'),
      },
      // Claude Code & Desktop
      {
        host: 'claude',
        label: 'Claude Workspace Config',
        path: path.join(cwd, '.claude', 'mcp.json'),
      },
      {
        host: 'claude',
        label: 'Claude Global Config',
        path: path.join(homeDir, '.claude', 'mcp.json'),
      },
      {
        host: 'claude',
        label: 'Claude Desktop Global Config',
        path: path.join(appData, 'Claude', 'claude_desktop_config.json'),
      },
      // OpenCode
      {
        host: 'opencode',
        label: 'OpenCode Workspace Config',
        path: path.join(cwd, '.opencode', 'mcp.json'),
      },
    ];

    const results: DiscoveredConfigFile[] = [];
    const seenPaths = new Set<string>();

    for (const cand of candidates) {
      const normalizedPath = path.normalize(cand.path);
      if (seenPaths.has(normalizedPath.toLowerCase())) continue;
      seenPaths.add(normalizedPath.toLowerCase());

      const exists = await fs.pathExists(normalizedPath);
      let serverCount = 0;
      if (exists) {
        try {
          const config = await fs.readJson(normalizedPath);
          const servers = config?.mcpServers || config?.servers || config;
          if (servers && typeof servers === 'object') {
            serverCount = Object.keys(servers).length;
          }
        } catch {}
      }

      results.push({
        host: cand.host,
        label: cand.label,
        path: normalizedPath,
        exists,
        serverCount,
      });
    }

    return results;
  }

  /**
   * Helper that checks if a configured MCP server key or its configuration payload matches the target MCP name
   */
  public static matchesMcpServer(targetMcpName: string, serverKey: string, serverConfig: any = {}): boolean {
    const targetNorm = targetMcpName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const keyNorm = serverKey.toLowerCase().replace(/[^a-z0-9]/g, '');

    // 1. Direct or Substring Key Match (e.g. "github-mcp-server" -> "github", "StitchMCP" -> "stitch")
    if (keyNorm === targetNorm) return true;
    if (keyNorm.includes(targetNorm)) return true;
    if (targetNorm.includes(keyNorm)) return true;

    // Stripping common prefixes / suffixes: mcp, server, mcpserver
    const strippedKey = keyNorm
      .replace(/^mcp/g, '')
      .replace(/mcp$/g, '')
      .replace(/^server/g, '')
      .replace(/server$/g, '');
    if (strippedKey === targetNorm || (strippedKey.length > 2 && targetNorm.includes(strippedKey)) || (targetNorm.length > 2 && strippedKey.includes(targetNorm))) {
      return true;
    }

    // 2. Executable / Package Signature Match (in command or args)
    const cmd = String(serverConfig?.command || '').toLowerCase();
    const args = Array.isArray(serverConfig?.args)
      ? serverConfig.args.map((a: any) => String(a).toLowerCase()).join(' ')
      : '';
    const fullExec = `${cmd} ${args}`;

    if (targetMcpName === 'github') {
      if (fullExec.includes('github') || fullExec.includes('ghcr.io/github')) return true;
    }
    if (targetMcpName === 'playwright') {
      if (fullExec.includes('playwright')) return true;
    }
    if (targetMcpName === 'markitdown') {
      if (fullExec.includes('markitdown')) return true;
    }
    if (targetMcpName === 'chrome-devtools-mcp' || targetMcpName === 'chrome-devtools') {
      if (fullExec.includes('chrome-devtools')) return true;
    }
    if (targetMcpName === 'stitch') {
      if (fullExec.includes('stitch') || fullExec.includes('stitch.googleapis.com')) return true;
    }
    if (targetMcpName === 'figma') {
      if (fullExec.includes('figma')) return true;
    }
    if (targetMcpName === 'firecrawl') {
      if (fullExec.includes('firecrawl')) return true;
    }
    if (targetMcpName === 'context7') {
      if (fullExec.includes('context7')) return true;
    }
    if (targetMcpName === 'supabase') {
      if (fullExec.includes('supabase')) return true;
    }

    // 3. Endpoint / URL Signature Match (in url or serverUrl)
    const url = String(serverConfig?.url || serverConfig?.serverUrl || '').toLowerCase();
    if (url.includes(targetNorm)) return true;
    if (targetMcpName === 'stitch' && url.includes('stitch.googleapis.com')) return true;
    if (targetMcpName === 'context7' && url.includes('context7.com')) return true;
    if (targetMcpName === 'firecrawl' && url.includes('firecrawl.dev')) return true;
    if (targetMcpName === 'supabase' && url.includes('supabase.com')) return true;

    return false;
  }

  /**
   * Discovers whether an MCP server is configured across supported host runtimes
   * (Antigravity/Gemini, Cursor, Cline, Claude Code, etc.)
   */
  public static async isMcpConfigured(
    mcpName: string,
    cwd: string = process.cwd()
  ): Promise<{ configured: boolean; host?: string; location?: string; disabled?: boolean; serverKey?: string }> {
    const discovered = await PrerequisiteChecker.discoverHostConfigFiles(cwd);

    // 1. Check all discovered configuration files
    for (const file of discovered) {
      if (!file.exists) continue;
      try {
        const config = await fs.readJson(file.path);
        const servers = config?.mcpServers || config?.servers || config;
        if (servers && typeof servers === 'object') {
          for (const [key, serverDef] of Object.entries(servers)) {
            if (PrerequisiteChecker.matchesMcpServer(mcpName, key, serverDef)) {
              const isDisabled = (serverDef as any)?.disabled === true;
              return {
                configured: true,
                host: file.host,
                location: file.path,
                disabled: isDisabled,
                serverKey: key,
              };
            }
          }
        }
      } catch {
        // Ignore read errors
      }
    }

    // 2. Also check directory-based MCP definitions (e.g. Antigravity folder ~/.gemini/antigravity/mcp/<serverName>)
    const homeDir = os.homedir();
    const dirCandidates = [
      path.join(cwd, '.gemini', 'antigravity', 'mcp'),
      path.join(homeDir, '.gemini', 'antigravity', 'mcp'),
    ];
    for (const dir of dirCandidates) {
      if (await fs.pathExists(dir)) {
        const entries = await fs.readdir(dir).catch(() => []);
        for (const entry of entries) {
          if (PrerequisiteChecker.matchesMcpServer(mcpName, entry, {})) {
            return {
              configured: true,
              host: 'gemini',
              location: path.join(dir, entry),
              disabled: false,
              serverKey: entry,
            };
          }
        }
      }
    }

    return { configured: false };
  }

  /**
   * Checks if an npm package is installed in node_modules or declared in package.json
   */
  public static async isPackageInstalled(
    pkgName: string,
    cwd: string = process.cwd()
  ): Promise<{ installed: boolean; location?: string }> {
    // 1. Direct node_modules check
    const modulePath = path.join(cwd, 'node_modules', ...pkgName.split('/'));
    if (await fs.pathExists(modulePath)) {
      return { installed: true, location: modulePath };
    }

    // 2. package.json dependencies check
    const pkgJsonPath = path.join(cwd, 'package.json');
    if (await fs.pathExists(pkgJsonPath)) {
      try {
        const pkg = await fs.readJson(pkgJsonPath);
        const deps = {
          ...pkg.dependencies,
          ...pkg.devDependencies,
          ...pkg.peerDependencies,
        };
        if (deps[pkgName]) {
          return { installed: true, location: pkgJsonPath };
        }
      } catch {
        // Ignore malformed package.json
      }
    }

    return { installed: false };
  }

  /**
   * Checks if an environment variable is defined in process.env or local .env files
   */
  public static async isEnvVarSet(
    varName: string,
    cwd: string = process.cwd(),
    customEnv?: Record<string, string | undefined>
  ): Promise<{ set: boolean; source?: string }> {
    const envSource = customEnv || process.env;
    if (envSource[varName] && envSource[varName]?.trim() !== '') {
      return { set: true, source: 'process.env' };
    }

    // Check local .env and .env.local in cwd
    const envFiles = [
      path.join(cwd, '.env.local'),
      path.join(cwd, '.env'),
    ];

    for (const envFile of envFiles) {
      if (await fs.pathExists(envFile)) {
        try {
          const content = await fs.readFile(envFile, 'utf8');
          const lines = content.split('\n');
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('#') || !trimmed.includes('=')) continue;
            const [k, ...v] = trimmed.split('=');
            if (k.trim() === varName && v.join('=').trim() !== '') {
              return { set: true, source: path.basename(envFile) };
            }
          }
        } catch {
          // Ignore read errors
        }
      }
    }

    return { set: false };
  }

  /**
   * Evaluates all prerequisites declared on a bundle
   */
  public async evaluate(
    bundle: BundleDefinition,
    options: PrerequisiteCheckOptions = {}
  ): Promise<PrerequisiteEvaluation> {
    const cwd = options.cwd || process.cwd();
    const env = options.env || process.env;
    const tier = bundle.tier || 'domain';
    const prereqs: BundlePrerequisites = bundle.prerequisites || {};

    const items: PrerequisiteItemCheck[] = [];

    // 1. Evaluate Required MCPs
    if (prereqs.requiredMcps && prereqs.requiredMcps.length > 0) {
      for (const mcp of prereqs.requiredMcps) {
        const check = await PrerequisiteChecker.isMcpConfigured(mcp.name, cwd);
        items.push({
          type: 'mcp',
          name: mcp.name,
          purpose: mcp.purpose,
          satisfied: check.configured,
          status: check.configured ? 'ok' : 'missing',
          details: check.configured ? `Configured in ${check.host || 'host'}` : 'Not found in host MCP configuration',
          optionalForBrainstorming: mcp.optionalForBrainstorming ?? true,
        });
      }
    }

    // 2. Evaluate Required Packages
    if (prereqs.requiredPackages && prereqs.requiredPackages.length > 0) {
      for (const pkg of prereqs.requiredPackages) {
        const check = await PrerequisiteChecker.isPackageInstalled(pkg, cwd);
        items.push({
          type: 'package',
          name: pkg,
          satisfied: check.installed,
          status: check.installed ? 'ok' : 'missing',
          details: check.installed ? 'Installed in workspace' : 'Not found in node_modules or package.json',
          optionalForBrainstorming: false,
        });
      }
    }

    // 3. Evaluate Required Environment Variables
    if (prereqs.requiredEnvVars && prereqs.requiredEnvVars.length > 0) {
      for (const envVar of prereqs.requiredEnvVars) {
        const check = await PrerequisiteChecker.isEnvVarSet(envVar, cwd, env);
        items.push({
          type: 'env',
          name: envVar,
          satisfied: check.set,
          status: check.set ? 'ok' : 'missing',
          details: check.set ? `Defined in ${check.source}` : 'Environment variable not set',
          optionalForBrainstorming: true,
        });
      }
    }

    const hasPrerequisites = items.length > 0;
    const allSatisfied = items.length === 0 || items.every(i => i.satisfied);
    const operationalPossible = allSatisfied;

    return {
      bundleName: bundle.name,
      tier,
      hasPrerequisites,
      allSatisfied,
      operationalPossible,
      items,
      modes: bundle.modes,
    };
  }

  /**
   * Returns canonical command and environment definitions for known MCP servers
   */
  public static getMcpDefinition(
    mcpName: string,
    mode: 'operational' | 'limited-operational' = 'operational',
    envVars: Record<string, string | undefined> = {}
  ): { command: string; args: string[]; env?: Record<string, string> } {
    const norm = mcpName.trim().toLowerCase();
    switch (norm) {
      case 'github':
        return {
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-github'],
          ...(mode === 'operational' && (envVars.GITHUB_PERSONAL_ACCESS_TOKEN || process.env.GITHUB_PERSONAL_ACCESS_TOKEN)
            ? { env: { GITHUB_PERSONAL_ACCESS_TOKEN: envVars.GITHUB_PERSONAL_ACCESS_TOKEN || process.env.GITHUB_PERSONAL_ACCESS_TOKEN || '' } }
            : {}),
        };
      case 'firecrawl':
        return {
          command: 'npx',
          args: ['-y', 'firecrawl-mcp'],
          ...(mode === 'operational' && (envVars.FIRECRAWL_API_KEY || process.env.FIRECRAWL_API_KEY)
            ? { env: { FIRECRAWL_API_KEY: envVars.FIRECRAWL_API_KEY || process.env.FIRECRAWL_API_KEY || '' } }
            : mode === 'limited-operational' && envVars.FIRECRAWL_API_URL
            ? { env: { FIRECRAWL_API_URL: envVars.FIRECRAWL_API_URL } }
            : {}),
        };
      case 'context7':
        return {
          command: 'npx',
          args: ['-y', '@upstash/context7-mcp'],
          ...(mode === 'operational' && envVars.UPSTASH_REDIS_REST_URL && envVars.UPSTASH_REDIS_REST_TOKEN
            ? { env: { UPSTASH_REDIS_REST_URL: envVars.UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN: envVars.UPSTASH_REDIS_REST_TOKEN } }
            : {}),
        };
      case 'playwright':
        return {
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-playwright'],
        };
      case 'markitdown':
        return {
          command: 'uvx',
          args: ['markitdown-mcp'],
        };
      case 'chrome-devtools-mcp':
      case 'chrome-devtools':
        return {
          command: 'npx',
          args: ['-y', 'chrome-devtools-mcp'],
        };
      case 'stitch':
        return {
          command: 'npx',
          args: ['-y', '@google/stitch-mcp'],
          ...(mode === 'operational' && (envVars.STITCH_API_KEY || process.env.STITCH_API_KEY)
            ? { env: { STITCH_API_KEY: envVars.STITCH_API_KEY || process.env.STITCH_API_KEY || '' } }
            : {}),
        };
      case 'figma':
        return {
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-figma'],
          ...(mode === 'operational' && (envVars.FIGMA_ACCESS_TOKEN || process.env.FIGMA_ACCESS_TOKEN)
            ? { env: { FIGMA_ACCESS_TOKEN: envVars.FIGMA_ACCESS_TOKEN || process.env.FIGMA_ACCESS_TOKEN || '' } }
            : {}),
        };
      default:
        return {
          command: 'npx',
          args: ['-y', norm],
        };
    }
  }

  /**
   * Generates client-specific MCP configuration objects for Cursor, Cline, Claude, or Antigravity
   */
  public static generateClientConfig(
    client: 'cursor' | 'cline' | 'claude' | 'antigravity',
    mcpNames: string[],
    mode: 'operational' | 'limited-operational' = 'operational',
    envVars: Record<string, string | undefined> = {}
  ): Record<string, any> {
    const servers: Record<string, any> = {};

    for (const name of mcpNames) {
      const def = PrerequisiteChecker.getMcpDefinition(name, mode, envVars);
      if (client === 'cline') {
        servers[name] = {
          ...def,
          disabled: false,
          autoApprove: [],
        };
      } else {
        servers[name] = def;
      }
    }

    return { mcpServers: servers };
  }

  /**
   * Attempts to automatically provision a missing MCP server using the native CLI.
   */
  public static async provisionMcpServer(
    mcpName: string,
    options: { cwd?: string; env?: Record<string, string | undefined> } = {}
  ): Promise<{ success: boolean; output?: string }> {
    try {
      const { execSync } = await import('node:child_process');
      const cmd = `npx @antigravity/cli mcp add ${mcpName} --type stdio`;
      const output = execSync(cmd, { 
        cwd: options.cwd || process.cwd(), 
        env: options.env || process.env,
        encoding: 'utf8' 
      });
      return { success: true, output };
    } catch (err: any) {
      return { success: false, output: err.message || String(err) };
    }
  }

  /**
   * Automatically configures missing MCP servers into a specific MCP JSON configuration file,
   * activating disabled servers and appending missing definitions.
   */
  public static async autoConfigureConfigFile(
    targetFilePath: string,
    mcpNames: string[],
    mode: 'operational' | 'limited-operational' = 'operational',
    envVars: Record<string, string | undefined> = {}
  ): Promise<{ success: boolean; targetFile: string; addedServers: string[]; enabledServers: string[] }> {
    await fs.ensureDir(path.dirname(targetFilePath));
    let existingConfig: any = {};
    if (await fs.pathExists(targetFilePath)) {
      try {
        existingConfig = await fs.readJson(targetFilePath);
      } catch {
        existingConfig = {};
      }
    }

    const isServersProp = Boolean(existingConfig.servers && !existingConfig.mcpServers);
    const existingServers = (isServersProp ? existingConfig.servers : existingConfig.mcpServers) || {};
    const addedServers: string[] = [];
    const enabledServers: string[] = [];

    for (const mcp of mcpNames) {
      let foundKey: string | null = null;
      for (const [key, serverDef] of Object.entries(existingServers)) {
        if (PrerequisiteChecker.matchesMcpServer(mcp, key, serverDef)) {
          foundKey = key;
          if ((serverDef as any)?.disabled === true) {
            (existingServers[key] as any).disabled = false;
            enabledServers.push(key);
          }
          break;
        }
      }

      if (!foundKey) {
        const def = PrerequisiteChecker.getMcpDefinition(mcp, mode, envVars);
        existingServers[mcp] = def;
        addedServers.push(mcp);
      }
    }

    if (isServersProp) {
      existingConfig.servers = existingServers;
    } else {
      existingConfig.mcpServers = existingServers;
    }

    await fs.writeJson(targetFilePath, existingConfig, { spaces: 2 });
    return {
      success: true,
      targetFile: targetFilePath,
      addedServers,
      enabledServers,
    };
  }

  /**
   * Automatically configures missing MCP servers into a specific AI host's configuration file.
   */
  public static async autoConfigureHost(
    host: string,
    mcpNames: string[],
    cwd: string = process.cwd(),
    mode: 'operational' | 'limited-operational' = 'operational',
    envVars: Record<string, string | undefined> = {}
  ): Promise<{ configured: boolean; targetFile: string; addedServers: string[] }> {
    const homeDir = os.homedir();
    let targetFile = '';

    if (host === 'gemini' || host === 'agents') {
      targetFile = path.join(homeDir, '.gemini', 'config', 'mcp_config.json');
    } else if (host === 'cline') {
      targetFile = path.join(cwd, 'cline_mcp_settings.json');
    } else if (host === 'claude') {
      targetFile = path.join(cwd, '.claude', 'mcp.json');
    } else {
      targetFile = path.join(cwd, '.cursor', 'mcp.json');
    }

    const res = await PrerequisiteChecker.autoConfigureConfigFile(targetFile, mcpNames, mode, envVars);
    return {
      configured: res.success,
      targetFile: res.targetFile,
      addedServers: [...res.addedServers, ...res.enabledServers],
    };
  }

  /**
   * Automatically installs missing NPM packages into the workspace.
   */
  public static async autoInstallPackages(
    packages: string[],
    cwd: string = process.cwd()
  ): Promise<{ success: boolean; output: string }> {
    try {
      const { execSync } = await import('node:child_process');
      const cmd = `npm install -D ${packages.join(' ')}`;
      const output = execSync(cmd, { cwd, encoding: 'utf8' });
      return { success: true, output };
    } catch (err: any) {
      return { success: false, output: err.message || String(err) };
    }
  }
}
