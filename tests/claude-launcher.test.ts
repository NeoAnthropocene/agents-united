import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'fs-extra';
import { ClaudeLauncher } from '../src/core/claude-launcher.js';
import { InstallEngine } from '../src/core/installer.js';
import type { ClaudeCapabilityReport } from '../src/core/types.js';

/**
 * Plan 016 Step 6 — ClaudeLauncher.
 *
 * Mirrors tests/cline-launcher.test.ts: the capability report is injected, so no `claude`
 * process is ever spawned and every assertion is deterministic. The argv discipline is the
 * point of this suite — each value must be its own array element with `shell: false`.
 */
describe('Plan 016 Step 6 — ClaudeLauncher', () => {
  const testWorkspace = path.resolve(process.cwd(), 'scratch/test-claude-launcher');
  const agentsDir = path.join(testWorkspace, '.agents');

  const TEAMS_ENV = 'CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS';

  const capabilityReport: ClaudeCapabilityReport = {
    installed: true,
    version: '2.1.272 (Claude Code)',
    command: { executable: 'claude', prefixArgs: [], source: 'path-executable' },
    pluginSupport: true,
    agentTeamsExperimental: false,
    diagnostics: [],
  };

  const plan = (options: Partial<Parameters<ClaudeLauncher['planActivation']>[0]> = {}) =>
    new ClaudeLauncher().planActivation({
      bundleName: 'software-engineering',
      workspace: testWorkspace,
      scope: 'project',
      report: capabilityReport,
      ...options,
    });

  beforeEach(async () => {
    await fs.remove(testWorkspace);
    await fs.ensureDir(testWorkspace);
  });

  afterEach(async () => {
    await fs.remove(testWorkspace);
  });

  describe('argv discipline — one value per element, never a joined command string', () => {
    it('places --agent and the projected coordinator name in separate argv elements', () => {
      const activation = plan({ orchestrator: 'orchestrator-engineering.md' });

      expect(activation.argv[0]).toBe('--agent');
      expect(activation.argv[1]).toBe('orchestrator-engineering');
      expect(activation.argv[2]).toBe('--add-dir');
      expect(activation.argv[3]).toBe(testWorkspace);
      // --agent + name, --add-dir + workspace, the prompt. Nothing else.
      expect(activation.argv).toHaveLength(5);
      expect(activation.executable).toBe('claude');
      expect(activation.argv.every(entry => typeof entry === 'string')).toBe(true);
    });

    it('derives the --agent value from the bundle orchestrator and strips a subagent- prefix', () => {
      expect(ClaudeLauncher.resolveCoordinatorName('orchestrator-engineering.md')).toBe('orchestrator-engineering');
      expect(ClaudeLauncher.resolveCoordinatorName('orchestrator-universal')).toBe('orchestrator-universal');
      expect(ClaudeLauncher.resolveCoordinatorName('subagent-backend-architect.md')).toBe('backend-architect');
      // Documented fallback for callers that could not resolve the bundle definition.
      expect(ClaudeLauncher.resolveCoordinatorName(undefined)).toBe('orchestrator-engineering');
      expect(ClaudeLauncher.resolveCoordinatorName('   ')).toBe('orchestrator-engineering');
    });

    it('keeps a shell-hostile prompt in a single final argv element', () => {
      const dangerousPrompt = 'Review & delete $(rm -rf /) | echo "hacked" %PATH%\nMulti-line task';
      const activation = plan({ prompt: dangerousPrompt });

      const last = activation.argv[activation.argv.length - 1];
      expect(last).toContain(dangerousPrompt);
      expect(last).toContain('User task: Review & delete $(rm -rf /)');
      // The prompt never leaks into a second element, and no element is a joined command string.
      expect(activation.argv.filter(entry => entry.includes('rm -rf /')).length).toBe(1);
      expect(activation.argv.some(entry => entry.includes('--add-dir '))).toBe(false);
      expect(activation.bootstrapPrompt).toContain(dangerousPrompt);
    });

    it('honours prefixArgs of a resolved node-wrapper command ahead of the flags', () => {
      const wrapper: ClaudeCapabilityReport = {
        ...capabilityReport,
        command: {
          executable: 'node',
          prefixArgs: ['/w/node_modules/@anthropic-ai/claude-code/cli.js'],
          source: 'node-wrapper',
        },
      };
      const activation = plan({ report: wrapper });

      expect(activation.executable).toBe('node');
      expect(activation.argv[0]).toBe('/w/node_modules/@anthropic-ai/claude-code/cli.js');
      expect(activation.argv[1]).toBe('--agent');
    });

    it('falls back to the plain claude executable when the report carries no command', () => {
      const activation = plan({ report: { ...capabilityReport, command: undefined } });
      expect(activation.executable).toBe('claude');
      expect(activation.argv[0]).toBe('--agent');
    });
  });

  describe('optional flags', () => {
    it('adds --bg only when the session is requested in the background', () => {
      expect(plan().argv).not.toContain('--bg');
      expect(plan({ background: false }).argv).not.toContain('--bg');

      const background = plan({ background: true });
      expect(background.argv).toContain('--bg');
      expect(background.argv.indexOf('--bg')).toBe(4);
    });

    it('carries the plugin root as its own --plugin-dir element when a plugin dir is set', () => {
      expect(plan().argv).not.toContain('--plugin-dir');

      const pluginDir = '.agents/plugins/software-engineering';
      const activation = plan({ pluginDir });
      const index = activation.argv.indexOf('--plugin-dir');
      expect(index).toBeGreaterThan(-1);
      expect(activation.argv[index + 1]).toBe(pluginDir);
    });
  });

  describe('ephemeral agent-teams scaffold (ADR 0018 decision 13)', () => {
    it('injects the opt-in variable into env only, never into argv or the prompt', () => {
      const teams = plan({ teams: true });
      expect(teams.env[TEAMS_ENV]).toBe('1');
      expect(teams.argv.join(' ')).not.toContain(TEAMS_ENV);
      expect(teams.bootstrapPrompt).not.toContain(TEAMS_ENV);
      expect(teams.argv.join('\u0000')).not.toContain('CLAUDE_CODE_EXPERIMENTAL');
    });

    it('leaves env empty when teams is not requested', () => {
      expect(Object.keys(plan().env)).toHaveLength(0);
      expect(TEAMS_ENV in plan({ teams: false }).env).toBe(false);
    });

    it('asks the lead to spawn teammates by projected agent type name only when teams is on', () => {
      const teams = plan({ teams: true });
      expect(teams.bootstrapPrompt).toContain('.claude/agents/');
      expect(teams.bootstrapPrompt).toContain('EXPERIMENTAL scaffold');

      const plain = plan();
      expect(plain.bootstrapPrompt).toContain('.claude/agents/');
      // The experimental scaffolding text is opt-in, not part of an ordinary session.
      expect(plain.bootstrapPrompt).not.toContain('EXPERIMENTAL scaffold');
    });
  });

  describe('bootstrap prompt and scope', () => {
    it('points at the host-neutral team manifest and the projected coordinator definition', () => {
      const activation = plan({ orchestrator: 'orchestrator-engineering.md' });

      expect(activation.bootstrapPrompt).toContain(
        '.agents/plugins/software-engineering/agents-united/teams/software-engineering.yaml'
      );
      expect(activation.bootstrapPrompt).toContain('.claude/agents/orchestrator-engineering.md');
      expect(activation.bootstrapPrompt).toContain('--agent orchestrator-engineering');
      // No prompt supplied ⇒ the documented opener is used instead of a task line.
      expect(activation.bootstrapPrompt).not.toContain('User task:');
      expect(activation.bootstrapPrompt).toContain('ask for their first task');
    });

    it('prefixes the global-scope manifest and coordinator references with ~/', () => {
      const activation = plan({ scope: 'global' });
      expect(activation.scope).toBe('global');
      expect(activation.bootstrapPrompt).toContain('~/.claude/agents/');
      expect(activation.bootstrapPrompt).toContain('~/.agents/plugins/');
    });

    it('drops the manifest instruction and points at .claude/agents/ when the manifest is absent', () => {
      const withManifest = plan({ manifestAvailable: true });
      expect(withManifest.bootstrapPrompt).toContain('Read the Team Manifest at');
      expect(withManifest.bootstrapPrompt).toContain(
        '.agents/plugins/software-engineering/agents-united/teams/software-engineering.yaml'
      );
      // Omitted ⇒ unchanged established behaviour.
      expect(plan().bootstrapPrompt).toContain('Read the Team Manifest at');

      const withoutManifest = plan({ manifestAvailable: false });
      expect(withoutManifest.bootstrapPrompt).not.toContain('Read the Team Manifest at');
      expect(withoutManifest.bootstrapPrompt).toContain('discoverable by name and description');
      expect(withoutManifest.bootstrapPrompt).toContain('.claude/agents/');
      expect(withoutManifest.bootstrapPrompt).toContain('--fanout cline');
      // The coordinator definition is still named — that is the instruction that must never dangle.
      expect(withoutManifest.bootstrapPrompt).toContain('.claude/agents/orchestrator-engineering.md');
    });
  });

  describe('resolveInstallation', () => {
    it('rejects a bundle that is not installed in the requested scope', async () => {
      await expect(
        new ClaudeLauncher().resolveInstallation('software-engineering', { cwd: testWorkspace })
      ).rejects.toThrow(/is not installed/);
    });

    it('rejects an installed bundle that carries no Claude projection signal', async () => {
      await new InstallEngine().install('software-engineering', {
        targetDir: agentsDir,
        method: 'copy',
      });

      await expect(
        new ClaudeLauncher().resolveInstallation('software-engineering', { cwd: testWorkspace })
      ).rejects.toThrow(/is not projected to Claude/);
    });

    it('resolves a bundle projected with --fanout claude', async () => {
      await new InstallEngine().install('software-engineering', {
        targetDir: agentsDir,
        method: 'copy',
        fanout: ['claude'],
      });

      const resolved = await new ClaudeLauncher().resolveInstallation('software-engineering', {
        cwd: testWorkspace,
      });

      expect(resolved.scope).toBe('project');
      expect(resolved.workspace).toBe(testWorkspace);
      expect(resolved.lockfile.fanout).toContain('claude');
      // ADR 0018 decision 6: exactly ONE host-neutral team manifest, under the organization package
      // and never duplicated into `.claude/`. It is written by the Cline half of the compound lane,
      // so a claude-only fanout has none on disk — the recorded fanout is what resolves the lane,
      // and `runClaudeStart` then passes `manifestAvailable: false` so the prompt cannot dangle.
      expect(resolved.manifestPath).toBe(
        path.join(testWorkspace, '.agents/plugins/software-engineering/agents-united/teams/software-engineering.yaml')
      );
      expect(await fs.pathExists(resolved.manifestPath)).toBe(false);
      expect(await fs.pathExists(path.join(testWorkspace, '.claude/agents-united'))).toBe(false);
    });

    it('resolves through the host-neutral team manifest when the cline lane emitted it', async () => {
      await new InstallEngine().install('software-engineering', {
        targetDir: agentsDir,
        method: 'copy',
        fanout: ['claude', 'cline'],
      });

      const resolved = await new ClaudeLauncher().resolveInstallation('software-engineering', {
        cwd: testWorkspace,
      });

      expect(await fs.pathExists(resolved.manifestPath)).toBe(true);
      // The manifest is host-neutral and lives outside the Claude namespace.
      expect(resolved.manifestPath).toContain(`.agents${path.sep}plugins`);
      expect(resolved.manifestPath).not.toContain(`.claude${path.sep}`);
    });
  });
});
