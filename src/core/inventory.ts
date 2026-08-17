import path from 'node:path';
import os from 'node:os';
import fs from 'fs-extra';
import { RegistryResolver } from './registry.js';
import { AgentHostAdapter } from './adapter.js';
import { KNOWN_HOST_IDS } from './hosts.js';
import type {
  InventoryOptions,
  PackageInventory,
  InstalledPackageRecord,
  LockfileManifest,
  InstallScope,
  AgentHost,
  VersionDriftStatus,
} from './types.js';

export class InventoryScanner {
  private registry: RegistryResolver;

  constructor(registry?: RegistryResolver) {
    this.registry = registry || new RegistryResolver();
  }

  public static formatDisplayLocation(scope: InstallScope, host: AgentHost, targetDir: string): string {
    const home = os.homedir();
    const cwd = process.cwd();

    let prettyPath = targetDir;
    if (targetDir.startsWith(cwd)) {
      const rel = path.relative(cwd, targetDir);
      prettyPath = rel ? `./${rel.replace(/\\/g, '/')}` : '.';
    } else if (targetDir.startsWith(home)) {
      const rel = path.relative(home, targetDir);
      prettyPath = `~/${rel.replace(/\\/g, '/')}`;
    }

    return `[${scope}: ${prettyPath}]`;
  }

  private parseHosts(options: InventoryOptions): AgentHost[] {
    if (options.hosts && options.hosts.length > 0) return options.hosts;
    if (options.target) {
      const raw = Array.isArray(options.target) ? options.target.join(',') : options.target;
      const parsed = raw.split(',').map(s => s.trim().toLowerCase()) as AgentHost[];
      const valid = parsed.filter(h => KNOWN_HOST_IDS.includes(h));
      if (valid.length > 0) return valid as AgentHost[];
    }
    return [...KNOWN_HOST_IDS] as AgentHost[];
  }

  public async scan(options: InventoryOptions = {}): Promise<PackageInventory> {
    const cwd = options.cwd || process.cwd();
    const hosts = this.parseHosts(options);

    const scopes: InstallScope[] = [];
    if (options.global || options.scope === 'global') {
      scopes.push('global');
    } else if (options.scope === 'project') {
      scopes.push('project');
    } else {
      scopes.push('project', 'global');
    }

    const candidateDirs: Array<{ dir: string; scope: InstallScope; host: AgentHost }> = [];

    if (options.targetDir) {
      candidateDirs.push({
        dir: path.resolve(options.targetDir),
        scope: options.scope || 'project',
        host: hosts[0] || 'agents',
      });
    } else {
      for (const scope of scopes) {
        for (const host of hosts) {
          const dir = AgentHostAdapter.resolveHostDir(scope, host);
          candidateDirs.push({ dir, scope, host });
        }
      }
    }

    const allRecords: InstalledPackageRecord[] = [];
    const bundleRecords: InstalledPackageRecord[] = [];
    const standaloneRecords: InstalledPackageRecord[] = [];
    const scannedTargetDirs: Set<string> = new Set();

    for (const item of candidateDirs) {
      const lockfilePath = path.join(item.dir, 'agents-united.json');
      if (!await fs.pathExists(lockfilePath)) {
        continue;
      }

      scannedTargetDirs.add(item.dir);
      let lockfile: LockfileManifest;
      try {
        lockfile = await fs.readJson(lockfilePath);
      } catch {
        continue;
      }

      const displayLocation = InventoryScanner.formatDisplayLocation(item.scope, item.host, item.dir);

      // Track all skills/agents/workflows mapped to installed bundles
      const bundleOwnedSkills = new Set<string>();
      const bundleOwnedAgents = new Set<string>();
      const bundleOwnedWorkflows = new Set<string>();

      // 1. Process Installed Bundles
      const installedBundleNames = lockfile.installed?.bundles || [];
      for (const bundleName of installedBundleNames) {
        const bundleDef = await this.registry.getBundle(bundleName).catch(() => null);
        const resolvedBundle = await this.registry.resolve(bundleName).catch(() => null);
        const installedVersion = lockfile.bundleVersions?.[bundleName] || '1.0.0';
        const upstreamVersion = bundleDef?.version || '1.0.0';

        let driftStatus: VersionDriftStatus = 'up-to-date';
        if (installedVersion !== upstreamVersion) {
          driftStatus = 'outdated';
        }

        // Count associated files
        let fileCount = 0;
        if (lockfile.files) {
          fileCount = Object.values(lockfile.files).filter(f => f.bundle === bundleName).length;
        }

        if (resolvedBundle) {
          resolvedBundle.skills?.forEach(s => bundleOwnedSkills.add(s));
          resolvedBundle.agents?.forEach(a => {
            bundleOwnedAgents.add(a);
            bundleOwnedAgents.add(a.replace(/\.md$/, ''));
          });
          resolvedBundle.workflows?.forEach(w => {
            bundleOwnedWorkflows.add(w);
            bundleOwnedWorkflows.add(w.replace(/\.md$/, ''));
          });
        }
        if (bundleDef) {
          if (bundleDef.orchestrator) {
            bundleOwnedAgents.add(bundleDef.orchestrator);
            bundleOwnedAgents.add(bundleDef.orchestrator.replace(/\.md$/, ''));
          }
          bundleDef.skills?.forEach(s => bundleOwnedSkills.add(s));
          bundleDef.agents?.forEach(a => {
            bundleOwnedAgents.add(a);
            bundleOwnedAgents.add(a.replace(/\.md$/, ''));
          });
          bundleDef.workflows?.forEach(w => {
            bundleOwnedWorkflows.add(w);
            bundleOwnedWorkflows.add(w.replace(/\.md$/, ''));
          });
        }

        const record: InstalledPackageRecord = {
          id: `${bundleName}@${item.scope}:${item.host}`,
          name: bundleName,
          type: 'bundle',
          scope: item.scope,
          host: item.host,
          targetDir: item.dir,
          displayLocation,
          installedVersion,
          upstreamVersion,
          driftStatus,
          method: lockfile.method || 'symlink',
          fileCount,
          title: bundleDef?.name || bundleName,
          description: bundleDef?.description,
        };

        allRecords.push(record);
        bundleRecords.push(record);
      }

      // 2. Process Standalone Skills
      const installedSkills = lockfile.installed?.skills || [];
      for (const skillName of installedSkills) {
        if (bundleOwnedSkills.has(skillName)) continue;

        const record: InstalledPackageRecord = {
          id: `skill:${skillName}@${item.scope}:${item.host}`,
          name: skillName,
          type: 'skill',
          scope: item.scope,
          host: item.host,
          targetDir: item.dir,
          displayLocation,
          installedVersion: '1.0.0',
          upstreamVersion: '1.0.0',
          driftStatus: 'up-to-date',
          method: lockfile.method || 'symlink',
          fileCount: 1,
          title: skillName,
          description: `Standalone skill (${skillName})`,
        };

        allRecords.push(record);
        standaloneRecords.push(record);
      }

      // 3. Process Standalone Agents
      const installedAgents = lockfile.installed?.agents || [];
      for (const agentFile of installedAgents) {
        if (bundleOwnedAgents.has(agentFile)) continue;
        const agentName = agentFile.replace(/\.md$/, '');

        const record: InstalledPackageRecord = {
          id: `agent:${agentName}@${item.scope}:${item.host}`,
          name: agentName,
          type: 'agent',
          scope: item.scope,
          host: item.host,
          targetDir: item.dir,
          displayLocation,
          installedVersion: '1.0.0',
          upstreamVersion: '1.0.0',
          driftStatus: 'up-to-date',
          method: lockfile.method || 'symlink',
          fileCount: 1,
          title: agentName,
          description: `Standalone agent (${agentFile})`,
        };

        allRecords.push(record);
        standaloneRecords.push(record);
      }
    }

    return {
      records: allRecords,
      bundles: bundleRecords,
      standaloneItems: standaloneRecords,
      targetDirs: Array.from(scannedTargetDirs),
    };
  }
}
