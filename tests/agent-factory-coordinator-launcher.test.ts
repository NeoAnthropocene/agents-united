import fs from 'fs-extra';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ClaudeLauncher } from '../src/core/claude-launcher.js';
import { InstallEngine } from '../src/core/installer.js';
import { RegistryResolver } from '../src/core/registry.js';
import type { ClaudeCapabilityReport, LockfileManifest } from '../src/core/types.js';
import { COORDINATOR_SUPPORT, FACTORY_FORBIDDEN_ENV, cleanFactoryEnv, coordinatorTree, prepareFactoryCoordinator } from './helpers/factory-coordinator.js';

describe('installed factory main selection through public resolve and plan', () => {
  let fixture: Awaited<ReturnType<typeof prepareFactoryCoordinator>>;
  const report: ClaudeCapabilityReport = {
    installed: true,
    version: '2.1.285 (injected report; no Claude invocation)',
    command: { executable: 'claude', prefixArgs: [], source: 'path-executable' },
    pluginSupport: true,
    agentTeamsExperimental: false,
    subagentHandback: true,
    diagnostics: [],
  };

  beforeEach(async () => {
    vi.stubEnv(FACTORY_FORBIDDEN_ENV, undefined);
    fixture = await prepareFactoryCoordinator();
  });
  afterEach(async () => { vi.unstubAllEnvs(); await fs.remove(fixture.root); });

  const install = async () => new InstallEngine(new RegistryResolver(fixture.registry)).install('agent-factory', fixture.options);
  const resolve = async () => new ClaudeLauncher().resolveInstallation('agent-factory', { cwd: fixture.workspace });
  const refreshHash = async (rel: string) => {
    const file = path.join(fixture.state, 'agents-united.json');
    const lock = await fs.readJson(file) as LockfileManifest;
    lock.projections![rel]!.hash = `sha256:${crypto.createHash('sha256').update(await fs.readFile(fixture.installed(rel))).digest('hex')}`;
    await fs.writeJson(file, lock);
  };
  const harmlessPlan = async () => {
    await install();
    const sentinel = path.join(fixture.root, 'spawned.json'), script = path.join(fixture.root, 'harmless.mjs');
    await fs.writeFile(script, `import fs from 'node:fs'; fs.writeFileSync(${JSON.stringify(sentinel)}, JSON.stringify({argv: process.argv.slice(2), todo: process.env.CLAUDE_CODE_ENABLE_TODO_TOOLS}));\n`);
    const launcher = new ClaudeLauncher(), resolution = await resolve();
    return { launcher, sentinel, plan: launcher.planActivation({ ...resolution, bundleName: 'agent-factory', report: {
      ...report, command: { executable: process.execPath, prefixArgs: [script], source: 'node-wrapper' },
    } }) };
  };

  it.each([false, true])('selects its own installed main with engineering co-installed: %s', async engineering => {
    const installer = new InstallEngine(new RegistryResolver(fixture.registry));
    await installer.install('agent-factory', fixture.options);
    if (engineering) {
      await installer.install('software-engineering', fixture.options);
      expect(await fs.pathExists(fixture.installed('.claude/agents/orchestrator-engineering.md'))).toBe(true);
    }

    const launcher = new ClaudeLauncher();
    const resolution = await launcher.resolveInstallation('agent-factory', { cwd: fixture.workspace });
    const plan = launcher.planActivation({
      ...resolution,
      bundleName: 'agent-factory',
      report,
      manifestAvailable: false,
    });

    expect(plan.argv.slice(0, 3)).toEqual([
      '--agent', 'orchestrator-agent-factory', `--add-dir=${fixture.workspace}`,
    ]);
  });

  it('previews the installed factory through the built CLI after the complete source registry disappears', async () => {
    await new InstallEngine(new RegistryResolver(fixture.registry)).install('agent-factory', fixture.options);
    const runtime = path.join(fixture.root, 'runtime');
    await fs.copy(path.resolve('dist'), path.join(runtime, 'dist'));
    const builtCli = path.join(runtime, 'dist/cli.js');
    // A stale dist/ fails here, loudly, instead of being patched into shape.
    const builtSource = await fs.readFile(builtCli, 'utf8');
    for (const rel of COORDINATOR_SUPPORT) expect(builtSource, `dist/cli.js is stale: run npm run build (missing ${rel})`).toContain(JSON.stringify(rel));
    await fs.symlink(path.resolve('node_modules'), path.join(runtime, 'node_modules'), 'junction');
    await fs.remove(fixture.registry);
    const result = spawnSync(process.execPath, [builtCli, 'start', 'agent-factory', '--host', 'claude', '--dry-run'], {
      cwd: fixture.workspace, encoding: 'utf8', timeout: 15000,
      env: cleanFactoryEnv({ CLAUDE_BIN_PATH: process.execPath, PATH: '', CI: 'true' }),
    });
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(result.stdout).toContain('orchestrator-agent-factory');
    expect(result.stdout).not.toContain('orchestrator-engineering');
  });

  it('refuses a truncated checked closure at the pure planner boundary', async () => {
    await new InstallEngine(new RegistryResolver(fixture.registry)).install('agent-factory', fixture.options);
    const launcher = new ClaudeLauncher();
    const resolution = await launcher.resolveInstallation('agent-factory', { cwd: fixture.workspace });
    const selection = resolution.nativeFactoryMain!;
    expect(() => launcher.planActivation({ ...resolution, bundleName: 'agent-factory', report,
      nativeFactoryMain: { ...selection, checked: selection.checked.filter(item => item.path === selection.installed || item.path === selection.receipt) },
    })).toThrow(/closure|selection|inventory/i);
  });

  it('refuses a linked ancestor above the selected workspace', async () => {
    await new InstallEngine(new RegistryResolver(fixture.registry)).install('agent-factory', fixture.options);
    const alias = path.join(fixture.root, 'alias');
    await fs.symlink(fixture.root, alias, 'junction');
    try {
      let failure: unknown;
      try { await new ClaudeLauncher().resolveInstallation('agent-factory', { cwd: path.join(alias, 'workspace') }); } catch (error) { failure = error; }
      expect(failure instanceof Error ? failure.message : 'resolution succeeded').toMatch(/linked|physical/i);
    } finally { await fs.unlink(alias); }
  });

  it('refuses a forged duplicate inline --agent before spawning', async () => {
    const { launcher, sentinel, plan } = await harmlessPlan();
    plan.argv.splice(plan.argv.length - 1, 0, '--agent=orchestrator-engineering');
    let failure: unknown;
    try { await launcher.launch(plan); } catch (error) { failure = error; }
    expect(failure instanceof Error ? failure.message : 'launch succeeded').toMatch(/factory.*plan|agent/i);
    expect(await fs.pathExists(sentinel)).toBe(false);
  });

  it('checks every file in the main and all three complete worker closures without the source registry', async () => {
    await install();
    await fs.remove(fixture.registry);
    const selection = (await resolve()).nativeFactoryMain!;
    expect(selection.checked.map(item => item.path)).toEqual(expect.arrayContaining([
      '.claude/agents/factory-realizer.md', '.claude/agents/factory-evaluator.md', '.claude/agents/factory-sync.md',
      '.claude/skills/author-skill/references/skill-attribution.md',
      '.claude/skills/realize-artifact/references/handback.md', '.claude/skills/evaluate-artifact/scripts/check-review.mjs',
      '.claude/skills/coordinate-artifact/references/skill-authoring.md', '.claude/skills/coordinate-artifact/scripts/check-skill-return.mjs',
      '.claude/skills/coordinate-artifact/assets/skill-task.schema.json', '.claude/skills/coordinate-artifact/assets/skill-return.schema.json',
      '.claude/skills/coordinate-artifact/references/contract-authoring.md', '.claude/skills/coordinate-artifact/scripts/check-contract-return.mjs',
      '.claude/skills/coordinate-artifact/assets/contract-task.schema.json', '.claude/skills/coordinate-artifact/assets/contract-return.schema.json',
      '.claude/skills/coordinate-artifact/references/host-sync.md', '.claude/skills/coordinate-artifact/references/contribution.md',
      '.claude/skills/sync-host/SKILL.md', '.claude/skills/sync-host/assets/claude-binding.json', '.claude/skills/sync-host/assets/sync-job.schema.json',
      '.claude/skills/sync-host/assets/sync-plan.schema.json', '.claude/skills/sync-host/scripts/check-sync.mjs', '.claude/skills/sync-host/references/plan.md',
      '.claude/skills/sync-host/references/rules/skill-attribution.md',
    ]));
    for (const item of selection.checked) {
      const file = fixture.installed(item.path), bytes = await fs.readFile(file);
      await fs.unlink(file);
      let failure: unknown;
      try { await resolve(); } catch (error) { failure = error; }
      await fs.writeFile(file, bytes);
      expect(failure instanceof Error ? failure.message : 'resolution succeeded', item.path).toMatch(/missing|required|ENOENT|not a regular/i);
    }
    expect((await resolve()).nativeFactoryMain).toEqual(selection);
  });

  it.each(['.claude/agents/factory-sync.md', '.claude/skills/sync-host/SKILL.md', '.claude/skills/sync-host/assets/claude-binding.json', '.claude/skills/sync-host/assets/sync-job.schema.json',
    '.claude/skills/sync-host/assets/sync-plan.schema.json', '.claude/skills/sync-host/scripts/check-sync.mjs', '.claude/skills/sync-host/references/handback.md',
    '.claude/skills/sync-host/references/rules/git-guardrails.md', '.claude/skills/coordinate-artifact/references/host-sync.md',
    '.claude/skills/coordinate-artifact/references/contribution.md'])('refuses startup when the sync closure file %s is missing', async rel => {
    await install();
    await fs.remove(fixture.registry);
    await fs.unlink(fixture.installed(rel));
    await expect(resolve()).rejects.toThrow(/missing|required|ENOENT|not a regular/i);
  });

  it('refuses startup for an edited sync closure file even when only the sync closure changed', async () => {
    await install();
    await fs.appendFile(fixture.installed('.claude/skills/sync-host/scripts/check-sync.mjs'), '\n// edited\n');
    await expect(resolve()).rejects.toThrow(/edited required file \.claude\/skills\/sync-host\/scripts\/check-sync\.mjs/);
  });

  it('refuses a selection that lacks any sync closure file at the pure planner boundary', async () => {
    await install();
    const launcher = new ClaudeLauncher();
    const resolution = await resolve();
    const selection = resolution.nativeFactoryMain!;
    for (const rel of ['.claude/agents/factory-sync.md', '.claude/skills/sync-host/scripts/check-sync.mjs', '.claude/skills/coordinate-artifact/references/host-sync.md']) {
      expect(selection.checked.map(item => item.path), rel).toContain(rel);
      expect(() => launcher.planActivation({ ...resolution, bundleName: 'agent-factory', report,
        nativeFactoryMain: { ...selection, checked: selection.checked.filter(item => item.path !== rel) },
      }), rel).toThrow(/closure|selection|inventory/i);
    }
  });

  it.each(['owner', 'host', 'kind', 'managed', 'edited', 'malformed', 'unknown', 'redirect', 'sourceHash'])('refuses %s receipt state, even with refreshed hashes for semantic mutations', async kind => {
    await install();
    const rel = '.claude/skills/coordinate-artifact/assets/claude-binding.json', file = fixture.installed(rel);
    if (['owner', 'host', 'kind', 'managed'].includes(kind)) {
      const lock = await fs.readJson(path.join(fixture.state, 'agents-united.json'));
      if (kind === 'owner') lock.projections[rel].owners = ['software-engineering'];
      if (kind === 'host') lock.projections[rel].host = 'cline';
      if (kind === 'kind') lock.projections[rel].kind = 'role';
      if (kind === 'managed') lock.projections[rel].managedMarker = false;
      await fs.writeJson(path.join(fixture.state, 'agents-united.json'), lock);
    } else if (kind === 'edited') await fs.appendFile(file, ' ');
    else {
      const receipt = await fs.readJson(file);
      if (kind === 'unknown') receipt.unreviewed = true;
      if (kind === 'redirect') receipt.roles[0].installed = '.claude/agents/orchestrator-engineering.md';
      if (kind === 'sourceHash') receipt.sourceHash = 'unverified';
      await fs.writeFile(file, kind === 'malformed' ? '{bad' : JSON.stringify(receipt));
      await refreshHash(rel);
    }
    await expect(resolve()).rejects.toThrow(/factory|binding/i);
  });

  it.each(['bundles string', 'fanout string', 'non-native', 'plugin', 'no Claude', 'no owner'])('refuses malformed or unsupported lock state %s', async kind => {
    await install();
    const file = path.join(fixture.state, 'agents-united.json'), lock = await fs.readJson(file);
    if (kind === 'bundles string') lock.installed.bundles = 'agent-factory';
    if (kind === 'fanout string') lock.fanout = 'claude';
    if (kind === 'non-native') lock.nativeLane = false;
    if (kind === 'plugin') lock.pluginLane = true;
    if (kind === 'no Claude') lock.fanout = ['cline'];
    if (kind === 'no owner') lock.installed.bundles = ['software-engineering'];
    await fs.writeJson(file, lock);
    await expect(resolve()).rejects.toThrow(/factory|not installed/i);
  });

  it.each(['role', 'ancestor', 'receipt', 'directory', 'case alias'])('refuses physical %s redirection', async kind => {
    await install();
    const rel = kind === 'receipt' ? '.claude/skills/coordinate-artifact/assets/claude-binding.json' : '.claude/agents/orchestrator-agent-factory.md';
    const file = fixture.installed(rel), bytes = await fs.readFile(file), target = path.join(fixture.root, 'redirected');
    if (kind === 'ancestor') {
      await fs.move(fixture.installed('.claude/agents'), target);
      await fs.symlink(target, fixture.installed('.claude/agents'), 'junction');
    } else if (kind === 'case alias') {
      const lockfile = path.join(fixture.state, 'agents-united.json'), lock = await fs.readJson(lockfile);
      lock.projections[rel.toUpperCase()] = lock.projections[rel];
      await fs.writeJson(lockfile, lock);
    } else {
      await fs.unlink(file);
      if (kind === 'directory') await fs.ensureDir(file);
      else { await fs.writeFile(target, bytes); await fs.symlink(target, file, 'file'); }
    }
    await expect(resolve()).rejects.toThrow(/linked|physical|regular|collid/i);
  });

  it.each(['realize-artifact', 'evaluate-artifact', 'sync-host', 'coordinate-artifact'])('checks %s critical preload semantics beyond its recorded hash', async skill => {
    await install();
    const rel = `.claude/skills/${skill}/SKILL.md`, original = await fs.readFile(fixture.installed(rel), 'utf8');
    for (const changed of [original.replace('user-invocable: false', 'user-invocable: false\nallowed-tools: Bash(*)'), `${original}\n!\`node unreviewed.mjs\`\n`]) {
      await fs.writeFile(fixture.installed(rel), changed);
      await refreshHash(rel);
      await expect(resolve()).rejects.toThrow(/preload|injection|mechanics/i);
    }
  });

  it.each(['orchestrator-agent-factory', 'factory-realizer', 'factory-evaluator', 'factory-sync'])('checks %s critical native mechanism beyond its recorded hash', async name => {
    await install();
    const rel = `.claude/agents/${name}.md`, original = await fs.readFile(fixture.installed(rel), 'utf8');
    for (const changed of [original.replace('model: inherit', 'model: opus'), original.replace('background: false', 'background: true'), original.replace('tools: ', 'tools: Workflow, '), original.replace('skills:', 'permissionMode: acceptEdits\nskills:'), original.replace('hooks:', 'not-hooks:')]) {
      await fs.writeFile(fixture.installed(rel), changed);
      await refreshHash(rel);
      await expect(resolve()).rejects.toThrow(/posture|preload|grant|registration|mechanics/i);
    }
  });

  it.each([false, true])('rechecks mutation after planning before harmless spawn, refreshed lock hash: %s', async refreshed => {
    const { launcher, sentinel, plan } = await harmlessPlan();
    const rel = '.claude/skills/realize-artifact/references/handback.md';
    await fs.appendFile(fixture.installed(rel), '\nchanged after planning\n');
    if (refreshed) await refreshHash(rel);
    await expect(launcher.launch(plan)).rejects.toThrow(/edited|changed after planning/i);
    expect(await fs.pathExists(sentinel)).toBe(false);
  });

  it('preserves exact argv, source responsibilities and ephemeral tracking in a harmless allowed spawn', async () => {
    const { launcher, sentinel, plan } = await harmlessPlan();
    expect(plan.bootstrapPrompt).toContain('registry/core/');
    expect(plan.bootstrapPrompt).toContain('registry/hosts/claude/');
    expect(plan.bootstrapPrompt).toContain('do not edit them');
    expect(plan.bootstrapPrompt).toContain('factory-realizer for bounded native draft creation/update, factory-evaluator for fresh independent read-only review and factory-sync for read-only host-update sync planning');
    expect(plan.bootstrapPrompt).not.toContain('Addon auto-installation');
    expect(plan.bootstrapPrompt).not.toContain('Team Manifest');
    expect(plan.env).toEqual({ CLAUDE_CODE_ENABLE_TODO_TOOLS: '1' });
    const before = await coordinatorTree(fixture.workspace);
    await launcher.launch(plan);
    expect(await fs.readJson(sentinel)).toEqual({ argv: plan.argv.slice(1), todo: '1' });
    expect(await coordinatorTree(fixture.workspace)).toEqual(before);
    const optout = launcher.planActivation({ bundleName: 'agent-factory', workspace: plan.workspace, scope: plan.scope, report, nativeFactoryMain: plan.nativeFactoryMain, taskTracking: false });
    expect(optout.env).toEqual({});
  });

  it.each(['--bg', '--bg=yes', '--plugin-dir=other', '--agent', '--add-dir=other'])('refuses fabricated unsupported argv %s before spawn', async flag => {
    const { launcher, sentinel, plan } = await harmlessPlan();
    plan.argv.splice(plan.argv.length - 1, 0, flag);
    await expect(launcher.launch(plan)).rejects.toThrow(/factory.*plan/i);
    expect(await fs.pathExists(sentinel)).toBe(false);
  });

  it('refuses unsupported factory planner options and missing selection', async () => {
    await install();
    const launcher = new ClaudeLauncher(), resolution = await resolve();
    for (const delta of [{ background: true }, { teams: true }, { pluginDir: 'plugin' }, { scope: 'global' as const }, { nativeFactoryMain: undefined }]) {
      expect(() => launcher.planActivation({ ...resolution, bundleName: 'agent-factory', report, ...delta })).toThrow(/factory|selection/i);
    }
    await expect(launcher.resolveInstallation('agent-factory', { global: true, cwd: fixture.workspace })).rejects.toThrow(/global/i);
  });

  it('refuses CLI --bg --dry-run before resolving any missing installation', async () => {
    const before = await coordinatorTree(fixture.workspace);
    const result = spawnSync(process.execPath, [path.resolve('dist/cli.js'), 'start', 'agent-factory', '--host', 'claude', '--bg', '--dry-run'], {
      cwd: fixture.workspace, encoding: 'utf8', timeout: 15000,
      env: cleanFactoryEnv({ CLAUDE_BIN_PATH: process.execPath, PATH: '', CI: 'true' }),
    });
    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).toMatch(/foreground.*--bg/i);
    expect(result.stdout + result.stderr).not.toMatch(/not installed/i);
    expect(await coordinatorTree(fixture.workspace)).toEqual(before);
  });

  it('refuses inherited teams activation at planning and immediately before spawning', async () => {
    const { launcher, sentinel, plan } = await harmlessPlan();
    vi.stubEnv('CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS', '1');
    expect(() => launcher.planActivation({ bundleName: 'agent-factory', workspace: plan.workspace, scope: 'project', report, nativeFactoryMain: plan.nativeFactoryMain })).toThrow(/teams|foreground/i);
    await expect(launcher.launch(plan)).rejects.toThrow(/teams|foreground/i);
    expect(await fs.pathExists(sentinel)).toBe(false);
  });

  it('normalizes relative resolve cwd and supports the existing canonical-store state shape', async () => {
    await new InstallEngine(new RegistryResolver(fixture.registry)).install('agent-factory', { ...fixture.options, targetDir: fixture.installed('.agents'), implicitStore: true });
    const launcher = new ClaudeLauncher();
    const resolution = await launcher.resolveInstallation('agent-factory', { cwd: path.relative(process.cwd(), fixture.workspace) });
    expect(resolution.workspace).toBe(fixture.workspace);
    expect(launcher.planActivation({ ...resolution, bundleName: 'agent-factory', report }).argv.slice(0, 3)).toEqual(['--agent', 'orchestrator-agent-factory', `--add-dir=${fixture.workspace}`]);
  });

  it('refuses a relabeled inline factory selector with background before spawning', async () => {
    const { launcher, sentinel, plan } = await harmlessPlan();
    const arg = plan.argv.indexOf('--agent');
    plan.argv.splice(arg, 2, '--agent=orchestrator-agent-factory', '--bg');
    plan.bundleName = 'software-engineering';
    delete plan.nativeFactoryMain;
    await expect(launcher.launch(plan)).rejects.toThrow(/factory|selection/i);
    expect(await fs.pathExists(sentinel)).toBe(false);
  });
});
