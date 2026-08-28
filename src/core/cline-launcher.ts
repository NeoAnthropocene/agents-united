import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import fs from 'fs-extra';
import { AgentHostAdapter } from './adapter.js';
import { ClineCapabilityProbe, defaultProcessRunner } from './cline-capabilities.js';
import type {
  ClineActivationStrategy,
  ClineCapabilityReport,
  InstallScope,
  LockfileManifest,
  ProcessRunner,
} from './types.js';

export interface ClineActivationPlan {
  bundleName: string;
  scope: InstallScope;
  workspace: string;
  teamName: string;
  strategy: ClineActivationStrategy;
  executable: string;
  argv: string[];
  bootstrapPrompt: string;
}

export interface PlanActivationOptions {
  bundleName: string;
  workspace: string;
  scope: InstallScope;
  report: ClineCapabilityReport;
  prompt?: string;
  teamName?: string;
  allowAddons?: boolean;
  headless?: boolean;
  /** Optional coordinator agent filename (e.g. "orchestrator-universal.md"). Resolved from the bundle definition by the caller; defaults to orchestrator-engineering.md for backward compatibility. */
  orchestrator?: string;
}

export interface ResolveInstallationOptions {
  scope?: InstallScope;
  global?: boolean;
  cwd?: string;
}

export class ClineLauncher {
  private probe: ClineCapabilityProbe;
  private runner: ProcessRunner;

  constructor(probe?: ClineCapabilityProbe, runner?: ProcessRunner) {
    this.probe = probe || new ClineCapabilityProbe();
    this.runner = runner || defaultProcessRunner;
  }

  /**
   * Generate stable team name: au-<bundle>-<first-8-sha256-of-workspace>
   */
  public static generateTeamName(bundleName: string, workspace: string): string {
    const sanitizedBundle = bundleName.replace(/[^A-Za-z0-9_-]/g, '-');
    const hash = crypto.createHash('sha256').update(path.resolve(workspace)).digest('hex').slice(0, 8);
    const prefix = `au-${sanitizedBundle}`;
    const maxPrefixLen = 64 - 9; // 64 - (1 for hyphen + 8 for hash)
    const truncatedPrefix = prefix.slice(0, maxPrefixLen);
    return `${truncatedPrefix}-${hash}`;
  }

  /**
   * Validate custom team names against safe identifier requirements.
   */
  public static validateTeamName(name: string): boolean {
    return /^[A-Za-z0-9_-]{1,64}$/.test(name);
  }

  /**
   * Resolve an installed bundle for Cline activation.
   */
  public async resolveInstallation(
    bundleName: string,
    options: ResolveInstallationOptions = {}
  ): Promise<{ scope: InstallScope; workspace: string; lockfile: LockfileManifest; manifestPath: string }> {
    const cwd = options.cwd || process.cwd();
    const isGlobal = !!options.global;

    let targetDir: string;
    let scope: InstallScope;
    let workspace: string;

    if (isGlobal) {
      targetDir = AgentHostAdapter.resolveHostDir('global', 'agents');
      scope = 'global';
      workspace = os.homedir();
    } else {
      workspace = cwd;
      targetDir = path.join(cwd, '.agents');
      scope = 'project';
    }

    const lockfilePath = path.join(targetDir, 'agents-united.json');
    if (!await fs.pathExists(lockfilePath)) {
      if (!isGlobal) {
        // Check if global installation exists as fallback
        const globalTarget = AgentHostAdapter.resolveHostDir('global', 'agents');
        const globalLockfile = path.join(globalTarget, 'agents-united.json');
        if (await fs.pathExists(globalLockfile)) {
          const gLock: LockfileManifest = await fs.readJson(globalLockfile);
          if (gLock.installed?.bundles?.includes(bundleName)) {
            return this.resolveInstallation(bundleName, { ...options, global: true });
          }
        }
      }
      throw new Error(`Bundle '${bundleName}' is not installed in ${scope} scope.`);
    }

    const lockfile: LockfileManifest = await fs.readJson(lockfilePath);
    if (!lockfile.installed?.bundles?.includes(bundleName)) {
      throw new Error(`Bundle '${bundleName}' is not installed in ${scope} scope.`);
    }

    // Check Cline fanout and Team Manifest presence
    const hasClineFanout = (lockfile.fanout || []).includes('cline');
    const manifestRel = `.agents/plugins/${bundleName}/agents-united/teams/${bundleName}.yaml`;
    const manifestPath = path.join(workspace, manifestRel);

    if (!hasClineFanout || !await fs.pathExists(manifestPath)) {
      throw new Error(
        `Bundle '${bundleName}' is not projected to Cline. Run 'agents update ${bundleName} --fanout cline' first.`
      );
    }

    return {
      scope,
      workspace,
      lockfile,
      manifestPath,
    };
  }

  /**
   * Plan activation strategy, argv, and bootstrap prompt without launching process.
   */
  public planActivation(options: PlanActivationOptions): ClineActivationPlan {
    const {
      bundleName,
      workspace,
      scope,
      report,
      prompt,
      teamName: customTeamName,
      allowAddons,
      headless,
      orchestrator,
    } = options;

    const command = report.command || {
      executable: 'cline',
      prefixArgs: [],
      source: 'path-executable' as const,
    };

    let teamName = ClineLauncher.generateTeamName(bundleName, workspace);
    if (customTeamName) {
      if (!ClineLauncher.validateTeamName(customTeamName)) {
        throw new Error(
          `Invalid team name "${customTeamName}". Must match [A-Za-z0-9_-] and be at most 64 characters.`
        );
      }
      teamName = customTeamName;
    }

    const strategy: ClineActivationStrategy = report.namedTeams ? 'named-team' : 'adaptive-session';

    const manifestRel = scope === 'global'
      ? `~/.agents/plugins/${bundleName}/agents-united/teams/${bundleName}.yaml`
      : `.agents/plugins/${bundleName}/agents-united/teams/${bundleName}.yaml`;
    // Coordinator role = the bundle's declared orchestrator when available; fall back to
    // orchestrator-engineering.md only to preserve pre-existing platform-manifest behavior.
    const coordinatorFile = (orchestrator || 'orchestrator-engineering.md').replace(/\.md$/, '');
    const coordinatorCanonical = `.agents/agents/${coordinatorFile}.md`;

    const addonPolicyText = allowAddons
      ? 'Addon auto-installation is pre-authorized for this session.'
      : `Before installing any recommended addon, explain the requirement to the user and request explicit confirmation to run: agents add <addon> -t cline ${scope === 'global' ? '-g ' : ''}-y.`;

    const pluginInstallText = `Before proceeding, ensure you have installed this bundle's plugin by running: cline plugin install .agents/plugins/${bundleName}`;

    const taskText = prompt && prompt.trim().length > 0
      ? `User task: ${prompt.trim()}`
      : 'Please introduce your coordinator role to the user and ask for their first task.';

    const bootstrapPrompt = [
      `You are coordinating the "${bundleName}" team in Agents United.`,
      `Read the Team Manifest at "${manifestRel}" and your coordinator role definition at "${coordinatorCanonical}" before acting.`,
      `Use specialist roles only when necessary.`,
      addonPolicyText,
      pluginInstallText,
      taskText,
    ].join('\n\n');

    const argv: string[] = [...command.prefixArgs];
    if (strategy === 'named-team') {
      argv.push('--team-name', teamName);
    }
    argv.push('--cwd', workspace);
    if (!headless) {
      argv.push('-i');
    }
    argv.push(bootstrapPrompt);

    return {
      bundleName,
      scope,
      workspace,
      teamName,
      strategy,
      executable: command.executable,
      argv,
      bootstrapPrompt,
    };
  }

  /**
   * Launch Cline session using argument array.
   */
  public async launch(plan: ClineActivationPlan): Promise<void> {
    const { spawn } = await import('node:child_process');
    const child = spawn(plan.executable, plan.argv, {
      cwd: plan.workspace,
      stdio: 'inherit',
      shell: false,
    });

    await new Promise<void>((resolve, reject) => {
      child.on('error', reject);
      child.on('exit', (code) => {
        if (code === 0 || code === null) {
          resolve();
        } else {
          resolve(); // return cleanly on process exit
        }
      });
    });
  }
}
