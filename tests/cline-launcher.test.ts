import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'fs-extra';
import { ClineLauncher } from '../src/core/cline-launcher.js';
import { InstallEngine } from '../src/core/installer.js';
import type { ProcessRunner, ClineCapabilityReport } from '../src/core/types.js';

describe('Milestone 4: ClineLauncher', () => {
  const testWorkspace = path.resolve(process.cwd(), 'scratch/test-cline-launcher');
  const agentsDir = path.join(testWorkspace, '.agents');

  beforeEach(async () => {
    await fs.remove(testWorkspace);
    await fs.ensureDir(testWorkspace);
  });

  afterEach(async () => {
    await fs.remove(testWorkspace);
  });

  describe('Stable team name generation and validation', () => {
    it('generates deterministic team name under 64 characters with safe characters', () => {
      const name1 = ClineLauncher.generateTeamName('software-engineering', testWorkspace);
      const name2 = ClineLauncher.generateTeamName('software-engineering', testWorkspace);
      expect(name1).toBe(name2);
      expect(name1).toMatch(/^au-software-engineering-[a-f0-9]{8}$/);
      expect(name1.length).toBeLessThanOrEqual(64);
    });

    it('sanitizes special characters in bundle name for team name', () => {
      const name = ClineLauncher.generateTeamName('special@bundle/name', testWorkspace);
      expect(name).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('validates custom team names and rejects invalid characters', () => {
      expect(ClineLauncher.validateTeamName('my-custom-team_123')).toBe(true);
      expect(ClineLauncher.validateTeamName('invalid team with spaces')).toBe(false);
      expect(ClineLauncher.validateTeamName('invalid$team')).toBe(false);
    });
  });

  describe('Bootstrap prompt and safe argv construction', () => {
    const fakeProbeReport: ClineCapabilityReport = {
      installed: true,
      version: 'v3.0.55',
      namedTeams: true,
      rolePresetConsumer: 'unknown',
      command: {
        executable: 'cline',
        prefixArgs: [],
        source: 'path-executable',
      },
      diagnostics: [],
    };

    it('builds argument array keeping dangerous prompt strings in a single element (no shell evaluation)', () => {
      const launcher = new ClineLauncher();
      const dangerousPrompt = 'Review & delete $(rm -rf /) | echo "hacked" %PATH%\nMulti-line task';

      const plan = launcher.planActivation({
        bundleName: 'software-engineering',
        workspace: testWorkspace,
        scope: 'project',
        report: fakeProbeReport,
        prompt: dangerousPrompt,
      });

      expect(plan.strategy).toBe('named-team');
      expect(plan.argv).toContain('--team-name');
      expect(plan.argv).toContain('--cwd');
      expect(plan.argv).toContain('-i');

      // The last element of argv must contain the prompt without splitting
      const lastArg = plan.argv[plan.argv.length - 1];
      expect(lastArg).toContain(dangerousPrompt);
      expect(lastArg).toContain('User task: Review & delete $(rm -rf /)');
    });

    it('falls back to adaptive-session strategy when named teams are unsupported', () => {
      const launcher = new ClineLauncher();
      const reportNoTeams: ClineCapabilityReport = {
        ...fakeProbeReport,
        namedTeams: false,
      };

      const plan = launcher.planActivation({
        bundleName: 'software-engineering',
        workspace: testWorkspace,
        scope: 'project',
        report: reportNoTeams,
        prompt: 'Build backend',
      });

      expect(plan.strategy).toBe('adaptive-session');
      expect(plan.argv).not.toContain('--team-name');
      expect(plan.argv).toContain('--cwd');
    });

    it('includes pre-authorized addon consent in bootstrap prompt when allowAddons is true', () => {
      const launcher = new ClineLauncher();
      const plan = launcher.planActivation({
        bundleName: 'software-engineering',
        workspace: testWorkspace,
        scope: 'project',
        report: fakeProbeReport,
        allowAddons: true,
      });

      const bootstrap = plan.argv[plan.argv.length - 1];
      expect(bootstrap).toContain('Addon auto-installation is pre-authorized for this session');
    });

    it('builds plan with fallback executable when Cline is not locally installed (e.g. for dry-run simulation)', () => {
      const launcher = new ClineLauncher();
      const uninstalledReport: ClineCapabilityReport = {
        installed: false,
        namedTeams: false,
        rolePresetConsumer: 'unknown',
        diagnostics: ['Executable not found'],
      };

      const plan = launcher.planActivation({
        bundleName: 'software-engineering',
        workspace: testWorkspace,
        scope: 'project',
        report: uninstalledReport,
        prompt: 'Review & analyze codebase',
      });

      expect(plan.bundleName).toBe('software-engineering');
      expect(plan.executable).toBe('cline');
      expect(plan.strategy).toBe('adaptive-session');
      expect(plan.argv).toContain('--cwd');
      expect(plan.argv[plan.argv.length - 1]).toContain('Review & analyze codebase');
    });
  });

  describe('Installation resolution and error reporting', () => {
    it('throws actionable error when bundle is not projected to cline', async () => {
      const installer = new InstallEngine();
      // Install without fanout
      await installer.install('software-engineering', {
        targetDir: agentsDir,
        scope: 'project',
        hosts: ['agents'],
        method: 'copy',
        fanout: [],
      });

      const launcher = new ClineLauncher();
      await expect(
        launcher.resolveInstallation('software-engineering', { cwd: testWorkspace })
      ).rejects.toThrow(/not projected to Cline.*agents update software-engineering --fanout cline/);
    });

    it('resolves valid installation when projected to cline', async () => {
      const installer = new InstallEngine();
      await installer.install('software-engineering', {
        targetDir: agentsDir,
        scope: 'project',
        hosts: ['agents'],
        method: 'copy',
        fanout: ['cline'],
      });

      const launcher = new ClineLauncher();
      const resolved = await launcher.resolveInstallation('software-engineering', { cwd: testWorkspace });
      expect(resolved.scope).toBe('project');
      expect(resolved.manifestPath).toContain('software-engineering.yaml');
    });
  });
});
