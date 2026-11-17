import fs from 'fs-extra';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ClaudeLauncher, FACTORY_SESSION_SETTINGS_ARG, factoryLaunchShapeOk } from '../src/core/claude-launcher.js';
import { describeClaudeTeamsPosture, describeClaudeTeamsScaffold, renderClaudeActivationPlan, resolveClaudeTeamsPosture } from '../src/cli.js';
import { InstallEngine } from '../src/core/installer.js';
import { RegistryResolver } from '../src/core/registry.js';
import type { ClaudeCapabilityReport, LockfileManifest } from '../src/core/types.js';
import { COORDINATOR_SUPPORT, FACTORY_FORBIDDEN_ENV, cleanFactoryEnv, coordinatorTree, prepareFactoryCoordinator } from './helpers/factory-coordinator.js';

const SKILL_ENTRY_SENTENCE = 'If the text of the "coordinate-artifact" Skill is not already in your context, read its installed entry ".claude/skills/coordinate-artifact/SKILL.md" in full before your first action.';
const SKILL_DIR_SENTENCE = 'In a Skill file, "${CLAUDE_SKILL_DIR}" means that Skill\'s installed folder (".claude/skills/<skill name>" in the project), and a "scripts/", "references/" or "assets/" path in a Skill file is relative to that folder; use the absolute path when running a script.';

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
    // P22: the launcher passes the parent's fork variable through unchanged, so the tests start from a parent without it.
    vi.stubEnv('CLAUDE_CODE_FORK_SUBAGENT', undefined);
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
    await fs.writeFile(script, `import fs from 'node:fs'; fs.writeFileSync(${JSON.stringify(sentinel)}, JSON.stringify({argv: process.argv.slice(2), todo: process.env.CLAUDE_CODE_ENABLE_TODO_TOOLS, teams: process.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS ?? null, teamsVars: Object.entries(process.env).filter(([key]) => key.toUpperCase() === 'CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS'), forkVars: Object.entries(process.env).filter(([key]) => key.toUpperCase() === 'CLAUDE_CODE_FORK_SUBAGENT')}));\n`);
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
      '.claude/skills/coordinate-artifact/references/bundle-authoring.md', '.claude/skills/coordinate-artifact/scripts/check-bundle-return.mjs',
      '.claude/skills/coordinate-artifact/assets/bundle-task.schema.json', '.claude/skills/coordinate-artifact/assets/bundle-return.schema.json',
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
    expect(plan.env).toEqual({ CLAUDE_CODE_ENABLE_TODO_TOOLS: '1', CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: '0' });
    const before = await coordinatorTree(fixture.workspace);
    await launcher.launch(plan);
    expect(await fs.readJson(sentinel)).toEqual({ argv: plan.argv.slice(1), todo: '1', teams: '0', teamsVars: [[FACTORY_FORBIDDEN_ENV, '0']], forkVars: [] });
    expect(await coordinatorTree(fixture.workspace)).toEqual(before);
    const optout = launcher.planActivation({ bundleName: 'agent-factory', workspace: plan.workspace, scope: plan.scope, report, nativeFactoryMain: plan.nativeFactoryMain, taskTracking: false });
    expect(optout.env).toEqual({ CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: '0' });
  });

  // Fix 3 (findings S1-A and S2-B of the 2026-11-15 headless factory runs): a main started with --agent in a headless session did not have the text of
  // its preloaded Skill in context, and the first message said "preload" without a path. It now names the installed entry.
  it('names the installed Skill entry by its path and asks the main to read it in full when its text is not already in context', async () => {
    const { plan } = await harmlessPlan();
    const prompt = plan.bootstrapPrompt;
    expect(prompt).toContain('Read your checked native main at ".claude/agents/orchestrator-agent-factory.md" before acting.');
    expect(prompt).not.toMatch(/"coordinate-artifact" preload/);
    expect(plan.argv.filter(arg => arg === prompt)).toHaveLength(1);
    // The two sentences below stand in the first message and in the opening instructions of the main in the same words, once each.
    const body = (await fs.readFile(path.resolve('registry/hosts/claude/agents/orchestrator-agent-factory.md'), 'utf8')).replace(/\r\n/g, '\n');
    for (const sentence of [SKILL_ENTRY_SENTENCE, SKILL_DIR_SENTENCE]) {
      expect(prompt.split(sentence), sentence).toHaveLength(2);
      expect(body.split(sentence), sentence).toHaveLength(2);
    }
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

  // Plan 033 P38 (finding S1-C of the 2026-11-15 headless factory runs): an inherited teams opt-in no longer refuses the factory; the launcher turns teams off for the factory's own session.
  it('turns agent teams off for the factory session when the opt-in is inherited, instead of refusing at planning or before spawning', async () => {
    vi.stubEnv('CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS', '1');
    const { launcher, sentinel, plan } = await harmlessPlan();
    expect(plan.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS).toBe('0');
    // The literal pins the shape of the element; the constant is what the code builds it from.
    expect(plan.argv.filter(arg => arg.startsWith('--settings'))).toEqual(['--settings={"env":{"CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS":"0"}}']);
    expect(FACTORY_SESSION_SETTINGS_ARG).toBe('--settings={"env":{"CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS":"0"}}');
    expect(plan.argv[plan.argv.length - 1]).toBe(plan.bootstrapPrompt);
    expect(plan.argv.indexOf(FACTORY_SESSION_SETTINGS_ARG)).toBeLessThan(plan.argv.length - 1);
    // Launching with the inherited `1` still reaches the spawn, and the child sees `0`: the plan's env is merged over the process environment.
    await launcher.launch(plan);
    expect(await fs.readJson(sentinel)).toEqual({ argv: plan.argv.slice(1), todo: '1', teams: '0', teamsVars: [[FACTORY_FORBIDDEN_ENV, '0']], forkVars: [] });
    expect(process.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS).toBe('1');
  });

  // FIX1 point 7: the full factory argv order with no executable prefix, and the same five-element tail behind a prefix.
  it('plans exactly five argv elements with no executable prefix: --agent, the main, --add-dir, the settings element, the first message', async () => {
    await install();
    const plan = new ClaudeLauncher().planActivation({ ...(await resolve()), bundleName: 'agent-factory', report });
    expect(plan.argv).toEqual(['--agent', 'orchestrator-agent-factory', `--add-dir=${fixture.workspace}`, FACTORY_SESSION_SETTINGS_ARG, plan.bootstrapPrompt]);
  });

  // FIX1 points 3 and 4: an executable prefix never starts with `--`, and the launcher keeps the two prefix forms it really resolves (a Node wrapper path; `/c <path>` for a .cmd shim).
  it.each([['--'], ['--setting-sources=user'], ['--model'], ['--bg'], ['--settings']])('refuses an executable prefix element %s at planning', async element => {
    await install();
    const resolution = await resolve();
    expect(() => new ClaudeLauncher().planActivation({ ...resolution, bundleName: 'agent-factory', report: { ...report, command: { executable: 'node', prefixArgs: [element], source: 'node-wrapper' } } })).toThrow(/prefix/i);
  });

  it.each([
    ['a Node wrapper path', 'node', ['C:/Users/someone/node_modules/@anthropic-ai/claude-code/cli.js'], 'node-wrapper'],
    ['a .cmd shim through /c', 'cmd.exe', ['/c', 'C:/Users/someone/AppData/Roaming/npm/claude.cmd'], 'path-executable'],
  ] as const)('plans and passes the launch tail check with the resolved prefix form: %s', async (_label, executable, prefixArgs, source) => {
    await install();
    const plan = new ClaudeLauncher().planActivation({ ...(await resolve()), bundleName: 'agent-factory', report: { ...report, command: { executable, prefixArgs: [...prefixArgs], source } } });
    expect(plan.argv.slice(0, prefixArgs.length)).toEqual([...prefixArgs]);
    expect(plan.argv.slice(prefixArgs.length)).toEqual(['--agent', 'orchestrator-agent-factory', `--add-dir=${fixture.workspace}`, FACTORY_SESSION_SETTINGS_ARG, plan.bootstrapPrompt]);
    expect(factoryLaunchShapeOk(plan)).toBe(true);
  });

  it.each([
    ['the settings element stands after the first message', (p: { argv: string[]; env: Record<string, string> }) => { p.argv.splice(p.argv.indexOf(FACTORY_SESSION_SETTINGS_ARG), 1); p.argv.push(FACTORY_SESSION_SETTINGS_ARG); }],
    ['the settings element stands directly after --model', (p: { argv: string[]; env: Record<string, string> }) => { p.argv.splice(p.argv.indexOf(FACTORY_SESSION_SETTINGS_ARG), 1); p.argv.splice(1, 0, '--model', FACTORY_SESSION_SETTINGS_ARG); }],
    ['-- stands before the first message', (p: { argv: string[]; env: Record<string, string> }) => { p.argv.splice(p.argv.length - 1, 0, '--'); }],
    ['-- stands in the executable prefix', (p: { argv: string[]; env: Record<string, string> }) => { p.argv.splice(1, 0, '--'); }],
    ['--setting-sources=user stands in the executable prefix', (p: { argv: string[]; env: Record<string, string> }) => { p.argv.splice(1, 0, '--setting-sources=user'); }],
    ['--setting-sources=user stands before the first message', (p: { argv: string[]; env: Record<string, string> }) => { p.argv.splice(p.argv.length - 1, 0, '--setting-sources=user'); }],
    ['the last element is not the planned first message', (p: { argv: string[]; env: Record<string, string> }) => { p.argv[p.argv.length - 1] = 'another message'; }],
    ['the env value is the empty string', (p: { argv: string[]; env: Record<string, string> }) => { p.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS = ''; }],
    ['the plan env holds a lower-case spelling of the variable', (p: { argv: string[]; env: Record<string, string> }) => { p.env.claude_code_experimental_agent_teams = '0'; }],
    ['the plan env holds a lower-case spelling with the value 1', (p: { argv: string[]; env: Record<string, string> }) => { p.env.Claude_Code_Experimental_Agent_Teams = '1'; }],
  ])('refuses a fabricated factory plan before spawning when %s', async (_label, mutate) => {
    const { launcher, sentinel, plan } = await harmlessPlan();
    mutate(plan);
    await expect(launcher.launch(plan)).rejects.toThrow(/factory.*plan/i);
    expect(await fs.pathExists(sentinel)).toBe(false);
  });

  // FIX1 point 5: Windows environment names are case-insensitive. On Windows `process.env` itself folds the spelling, so the stub below overwrites the one variable and the child sees one `0`;
  // on POSIX the lower-case spelling is a second variable, which the launcher must drop before merging the plan env. Either way exactly one variable with the value 0 reaches the child.
  it('hands the child exactly one teams variable, with the value 0, when another spelling of its name is set in the parent', async () => {
    vi.stubEnv('claude_code_experimental_agent_teams', '1');
    vi.stubEnv('Claude_Code_Experimental_Agent_Teams', '1');
    const { launcher, sentinel, plan } = await harmlessPlan();
    await launcher.launch(plan);
    const seen = await fs.readJson(sentinel);
    expect(seen.teamsVars).toHaveLength(1);
    expect(seen.teamsVars[0][1]).toBe('0');
    expect(seen.teamsVars[0][0].toUpperCase()).toBe(FACTORY_FORBIDDEN_ENV);
  });

  it('still refuses every other unsupported factory option when the opt-in is inherited', async () => {
    const { launcher, plan } = await harmlessPlan();
    vi.stubEnv('CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS', '1');
    const base = { bundleName: 'agent-factory', workspace: plan.workspace, scope: 'project' as const, report, nativeFactoryMain: plan.nativeFactoryMain };
    for (const delta of [{ background: true }, { teams: true }, { pluginDir: 'plugin' }, { scope: 'global' as const }, { workspace: 'relative/workspace' }, { orchestrator: 'orchestrator-engineering.md' }]) {
      expect(() => launcher.planActivation({ ...base, ...delta }), JSON.stringify(delta)).toThrow(/factory/i);
    }
    expect(() => launcher.planActivation({ ...base, report: { ...report, command: { executable: 'claude', prefixArgs: ['--settings', '{}'], source: 'path-executable' } } })).toThrow(/prefix/i);
    expect(() => launcher.planActivation({ ...base, report: { ...report, command: { executable: 'claude', prefixArgs: ['--settings={}'], source: 'path-executable' } } })).toThrow(/prefix/i);
  });

  it.each([
    ['is missing', (p: { argv: string[]; env: Record<string, string> }) => { p.argv.splice(p.argv.indexOf(FACTORY_SESSION_SETTINGS_ARG), 1); }],
    ['is duplicated', (p: { argv: string[]; env: Record<string, string> }) => { p.argv.splice(p.argv.length - 1, 0, FACTORY_SESSION_SETTINGS_ARG); }],
    ['carries another payload', (p: { argv: string[]; env: Record<string, string> }) => { p.argv[p.argv.indexOf(FACTORY_SESSION_SETTINGS_ARG)] = '--settings={"env":{"CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS":"1"}}'; }],
    ['carries a payload with an extra key', (p: { argv: string[]; env: Record<string, string> }) => { p.argv[p.argv.indexOf(FACTORY_SESSION_SETTINGS_ARG)] = '--settings={"env":{"CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS":"0","X":"1"}}'; }],
    ['is given in the two-element form', (p: { argv: string[]; env: Record<string, string> }) => { p.argv.splice(p.argv.indexOf(FACTORY_SESSION_SETTINGS_ARG), 1, '--settings', FACTORY_SESSION_SETTINGS_ARG.slice('--settings='.length)); }],
    ['is followed by a second one in the two-element form', (p: { argv: string[]; env: Record<string, string> }) => { p.argv.splice(p.argv.length - 1, 0, '--settings', '{}'); }],
    ['is accompanied by an env value of 1', (p: { argv: string[]; env: Record<string, string> }) => { p.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS = '1'; }],
    ['is accompanied by no env value', (p: { argv: string[]; env: Record<string, string> }) => { delete p.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS; }],
  ])('refuses a fabricated factory plan before spawning when the teams-off switch %s', async (_label, mutate) => {
    const { launcher, sentinel, plan } = await harmlessPlan();
    mutate(plan);
    await expect(launcher.launch(plan)).rejects.toThrow(/factory.*plan/i);
    expect(await fs.pathExists(sentinel)).toBe(false);
  });

  it('gives a non-factory plan no --settings element and leaves its teams behaviour as it was', async () => {
    await install();
    const launcher = new ClaudeLauncher();
    const plain = launcher.planActivation({ bundleName: 'software-engineering', workspace: fixture.workspace, scope: 'project', report });
    expect(plain.argv.some(arg => /^--settings(?:=|$)/.test(arg))).toBe(false);
    expect(plain.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS).toBeUndefined();
    const teams = launcher.planActivation({ bundleName: 'software-engineering', workspace: fixture.workspace, scope: 'project', report, teams: true });
    expect(teams.argv.some(arg => /^--settings(?:=|$)/.test(arg))).toBe(false);
    expect(teams.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS).toBe('1');
  });

  it('previews the factory through the built CLI with the opt-in inherited: exit 0, the --settings element and the env value 0 shown, no claim that teams are on', async () => {
    await install();
    const result = spawnSync(process.execPath, [path.resolve('dist/cli.js'), 'start', 'agent-factory', '--host', 'claude', '--dry-run'], {
      cwd: fixture.workspace, encoding: 'utf8', timeout: 15000,
      env: cleanFactoryEnv({ CLAUDE_BIN_PATH: process.execPath, PATH: '', CI: 'true', [FACTORY_FORBIDDEN_ENV]: '1' }),
    });
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(result.stdout).toContain(`  [3] ${FACTORY_SESSION_SETTINGS_ARG}`);
    expect(result.stdout).toContain('Env injected (merged over process.env): CLAUDE_CODE_ENABLE_TODO_TOOLS=1, CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=0');
    expect(result.stdout).not.toContain('CLAUDE_CODE_FORK_SUBAGENT');
    expect(result.stdout).not.toContain('Fork mode');
    expect(result.stdout).toContain('Argv (5 elements, one element per line, spawned with shell: false):');
    expect(result.stdout.split('--settings=').length - 1).toBe(1);
    expect(result.stdout).not.toContain('Agent teams (--teams): yes');
    expect(result.stdout).toContain('Agent teams (--teams): no');
    expect(result.stdout).toContain('Agent teams (--teams): no (turned off for this session by the launcher: environment value 0 and the --settings element below; managed settings can still enable agent teams)');
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

  // FIX1 points 1, 2 and 7: the dry-run line and the real-start note share their reason; the non-factory lines stay as they were.
  it('says in the dry run and in the real-start note that the launcher turned teams off, with the managed-settings limit, and leaves the non-factory lines unchanged', async () => {
    await install();
    const launcher = new ClaudeLauncher();
    const posture = resolveClaudeTeamsPosture(undefined, 'domain');
    const factoryPlan = launcher.planActivation({ ...(await resolve()), bundleName: 'agent-factory', report });
    expect(renderClaudeActivationPlan(factoryPlan, report, ['claude'], posture).split('\n'))
      .toContain('Agent teams (--teams): no (turned off for this session by the launcher: environment value 0 and the --settings element below; managed settings can still enable agent teams)');
    expect(describeClaudeTeamsScaffold(false, posture, factoryPlan.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS))
      .toBe('no (turned off for this session by the launcher; managed settings can still enable agent teams)');
    // A non-factory plan with teams off keeps the old text in both places.
    const plain = launcher.planActivation({ bundleName: 'software-engineering', workspace: fixture.workspace, scope: 'project', report });
    const rendered = renderClaudeActivationPlan(plain, report, ['claude'], posture);
    expect(rendered.split('\n')).toContain(`Agent teams (--teams): no (${describeClaudeTeamsPosture(posture)})`);
    expect(rendered).not.toContain('turned off for this session');
    expect(describeClaudeTeamsScaffold(false, posture, plain.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS)).toBe(`no (${describeClaudeTeamsPosture(posture)})`);
    // P22 (reverses P19): the launcher no longer touches fork mode, so no plan prints a fork-mode line.
    const dry = renderClaudeActivationPlan(factoryPlan, report, ['claude'], posture).split('\n');
    expect(dry.filter(line => /fork mode/i.test(line))).toEqual([]);
    expect(rendered).not.toContain('Fork mode');
    const explicit = resolveClaudeTeamsPosture(true, 'domain');
    expect(describeClaudeTeamsScaffold(true, explicit, '1')).toBe(`yes (${describeClaudeTeamsPosture(explicit)}; experimental, ephemeral env only)`);
  });

  // Plan 033 P22 (reverses P19, 2026-11-16: the maintainer chose background workers; the coordinator waits for each hand-back): the launcher turns only agent teams off.
  it('carries only the teams variable as 0, in the plan env and in the one --settings element, and no fork variable', async () => {
    await install();
    const plan = new ClaudeLauncher().planActivation({ ...(await resolve()), bundleName: 'agent-factory', report });
    expect(Object.keys(plan.env).map(key => key.toUpperCase())).not.toContain('CLAUDE_CODE_FORK_SUBAGENT');
    expect(plan.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS).toBe('0');
    expect(FACTORY_SESSION_SETTINGS_ARG).toBe('--settings={"env":{"CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS":"0"}}');
    expect(plan.argv.filter(arg => /^--settings(?:=|$)/.test(arg))).toEqual([FACTORY_SESSION_SETTINGS_ARG]);
    expect(plan.argv.join('\n')).not.toContain('FORK');
    expect(plan.argv).toHaveLength(5);
    expect(factoryLaunchShapeOk(plan)).toBe(true);
  });

  it.each(['1', '0', ''])('plans the factory without a fork variable when CLAUDE_CODE_FORK_SUBAGENT=%j is set in the caller environment', async value => {
    vi.stubEnv('CLAUDE_CODE_FORK_SUBAGENT', value);
    await install();
    const plan = new ClaudeLauncher().planActivation({ ...(await resolve()), bundleName: 'agent-factory', report });
    expect(Object.keys(plan.env).map(key => key.toUpperCase())).not.toContain('CLAUDE_CODE_FORK_SUBAGENT');
    expect(factoryLaunchShapeOk(plan)).toBe(true);
  });

  it.each([
    ['the --settings element is the P19 teams-and-fork one', (p: { argv: string[]; env: Record<string, string> }) => { p.argv[p.argv.indexOf(FACTORY_SESSION_SETTINGS_ARG)] = '--settings={"env":{"CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS":"0","CLAUDE_CODE_FORK_SUBAGENT":"0"}}'; }],
    ['the --settings element is a fork-only one', (p: { argv: string[]; env: Record<string, string> }) => { p.argv[p.argv.indexOf(FACTORY_SESSION_SETTINGS_ARG)] = '--settings={"env":{"CLAUDE_CODE_FORK_SUBAGENT":"0"}}'; }],
    ['two --settings elements stand in the argv', (p: { argv: string[]; env: Record<string, string> }) => { p.argv.splice(p.argv.length - 1, 0, FACTORY_SESSION_SETTINGS_ARG); }],
  ])('refuses a factory plan, in the shape check and before spawning, when %s', async (_label, mutate) => {
    const { launcher, sentinel, plan } = await harmlessPlan();
    mutate(plan);
    expect(factoryLaunchShapeOk(plan)).toBe(false);
    await expect(launcher.launch(plan)).rejects.toThrow(/factory.*plan/i);
    expect(await fs.pathExists(sentinel)).toBe(false);
  });

  // The launcher neither sets nor removes the fork variable: whatever the parent holds reaches the child unchanged.
  it.each(['0', '1'])('hands the child the parent\'s CLAUDE_CODE_FORK_SUBAGENT=%s unchanged', async value => {
    vi.stubEnv('CLAUDE_CODE_FORK_SUBAGENT', value);
    const { launcher, sentinel, plan } = await harmlessPlan();
    await launcher.launch(plan);
    const seen = await fs.readJson(sentinel);
    expect(seen.forkVars).toEqual([['CLAUDE_CODE_FORK_SUBAGENT', value]]);
    expect(seen.teams).toBe('0');
  });

  it('gives a non-factory plan no fork variable, no --settings element and no Fork mode line', async () => {
    await install();
    const launcher = new ClaudeLauncher();
    const posture = resolveClaudeTeamsPosture(undefined, 'domain');
    for (const extra of [{}, { teams: true }]) {
      const plain = launcher.planActivation({ bundleName: 'software-engineering', workspace: fixture.workspace, scope: 'project', report, ...extra });
      expect(Object.keys(plain.env).map(key => key.toUpperCase())).not.toContain('CLAUDE_CODE_FORK_SUBAGENT');
      expect(plain.argv.some(arg => /^--settings(?:=|$)/.test(arg))).toBe(false);
      expect(renderClaudeActivationPlan(plain, report, ['claude'], posture)).not.toContain('Fork mode');
    }
  });
});
