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

export class PrerequisiteChecker {
  /**
   * Discovers whether an MCP server is configured across supported host runtimes
   * (Antigravity/Gemini, Cursor, Cline, Claude Code, etc.)
   */
  public static async isMcpConfigured(
    mcpName: string,
    cwd: string = process.cwd()
  ): Promise<{ configured: boolean; host?: string; location?: string }> {
    const normName = mcpName.trim().toLowerCase();
    const homeDir = os.homedir();

    // 1. Workspace Local Candidates First (Cursor, Cline, Gemini, Claude in cwd)
    const localCursor = [
      path.join(cwd, '.cursor', 'mcp.json'),
      path.join(cwd, 'cursor.mcp.json'),
    ];
    for (const cand of localCursor) {
      if (await fs.pathExists(cand)) {
        try {
          const config = await fs.readJson(cand);
          const servers = config?.mcpServers || config?.servers || config;
          if (servers && (servers[normName] || servers[mcpName])) {
            return { configured: true, host: 'cursor', location: cand };
          }
        } catch {}
      }
    }

    const localCline = [
      path.join(cwd, 'cline_mcp_settings.json'),
      path.join(cwd, '.cline', 'mcp.json'),
    ];
    for (const cand of localCline) {
      if (await fs.pathExists(cand)) {
        try {
          const config = await fs.readJson(cand);
          const servers = config?.mcpServers || config?.servers || config;
          if (servers && (servers[normName] || servers[mcpName])) {
            return { configured: true, host: 'cline', location: cand };
          }
        } catch {}
      }
    }

    const localClaude = [
      path.join(cwd, 'claude.json'),
      path.join(cwd, '.claude', 'mcp.json'),
    ];
    for (const cand of localClaude) {
      if (await fs.pathExists(cand)) {
        try {
          const config = await fs.readJson(cand);
          const servers = config?.mcpServers || config?.servers || config;
          if (servers && (servers[normName] || servers[mcpName])) {
            return { configured: true, host: 'claude', location: cand };
          }
        } catch {}
      }
    }

    const localGemini = [
      path.join(cwd, '.gemini', 'antigravity', 'mcp', normName),
      path.join(cwd, '.gemini', 'antigravity', 'mcp'),
    ];
    for (const cand of localGemini) {
      if (await fs.pathExists(cand)) {
        if (cand.endsWith(normName)) {
          return { configured: true, host: 'gemini', location: cand };
        }
        const entries = await fs.readdir(cand).catch(() => []);
        if (entries.some(e => e.toLowerCase() === normName || e.toLowerCase().startsWith(`${normName}.`))) {
          return { configured: true, host: 'gemini', location: cand };
        }
      }
    }

    // 2. Global Home Directory Candidates
    const globalGemini = [
      path.join(homeDir, '.gemini', 'antigravity', 'mcp', normName),
      path.join(homeDir, '.gemini', 'antigravity', 'mcp'),
    ];
    for (const cand of globalGemini) {
      if (await fs.pathExists(cand)) {
        if (cand.endsWith(normName)) {
          return { configured: true, host: 'gemini', location: cand };
        }
        const entries = await fs.readdir(cand).catch(() => []);
        if (entries.some(e => e.toLowerCase() === normName || e.toLowerCase().startsWith(`${normName}.`))) {
          return { configured: true, host: 'gemini', location: cand };
        }
      }
    }

    const globalCursor = [path.join(homeDir, '.cursor', 'mcp.json')];
    for (const cand of globalCursor) {
      if (await fs.pathExists(cand)) {
        try {
          const config = await fs.readJson(cand);
          const servers = config?.mcpServers || config?.servers || config;
          if (servers && (servers[normName] || servers[mcpName])) {
            return { configured: true, host: 'cursor', location: cand };
          }
        } catch {}
      }
    }

    const globalCline = [path.join(homeDir, 'cline_mcp_settings.json')];
    for (const cand of globalCline) {
      if (await fs.pathExists(cand)) {
        try {
          const config = await fs.readJson(cand);
          const servers = config?.mcpServers || config?.servers || config;
          if (servers && (servers[normName] || servers[mcpName])) {
            return { configured: true, host: 'cline', location: cand };
          }
        } catch {}
      }
    }

    const globalClaude = [
      path.join(homeDir, 'claude.json'),
      path.join(homeDir, '.claude', 'mcp.json'),
    ];
    for (const cand of globalClaude) {
      if (await fs.pathExists(cand)) {
        try {
          const config = await fs.readJson(cand);
          const servers = config?.mcpServers || config?.servers || config;
          if (servers && (servers[normName] || servers[mcpName])) {
            return { configured: true, host: 'claude', location: cand };
          }
        } catch {}
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
}
