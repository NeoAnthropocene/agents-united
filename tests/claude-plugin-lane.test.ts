import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'fs-extra';
import { InstallEngine } from '../src/core/installer.js';
import { ClaudeLauncher } from '../src/core/claude-launcher.js';
import type { ClaudeCapabilityReport, InstallOptions } from '../src/core/types.js';

const BUNDLE = 'software-engineering';
/** The artifact key set the Claude plugin manifest must carry — no extras, no omissions. */
const MANIFEST_KEYS = ['author', 'description', 'homepage', 'license', 'name', 'repository', 'version'];
const CLAUDE_PLUGIN_MARKER = 'managed-by: agents-united';

/**
 * Plan 016 Step 7 — the opt-in, flag-gated Claude plugin lane
 * (`.agents/plugins/<bundle>/.claude-plugin/plugin.json` + `agents/`) and the
 * non-regression guard that keeps Cline's `plugin.json` hard-stop intact.
 *
 * The lane is distribution-only (ADR 0018 decision 12): it is never the
 * behavioural source, and it stays inside the *cline* namespace
 * (`.agents/plugins/<bundle>/`) while being recorded as a `claude` projection.
 */
describe('Plan 016 Step 7 — opt-in Claude plugin lane (`agents add --plugin`)', () => {
  const testWorkspace = path.resolve(process.cwd(), 'scratch/test-claude-plugin-lane');
  const agentsDir = path.join(testWorkspace, '.agents');
  const pluginBase = path.join(agentsDir, 'plugins', BUNDLE);
  const claudeManifest = path.join(pluginBase, '.claude-plugin', 'plugin.json');
  const clineManifest = path.join(pluginBase, 'plugin.json');
  const pluginAgentsDir = path.join(pluginBase, 'agents');
  const lockPath = path.join(agentsDir, 'agents-united.json');

  async function installClaude(
    pluginLane: boolean,
    fanout: string[] = ['claude'],
    extra: Partial<InstallOptions> = {}
  ) {
    return new InstallEngine().install(BUNDLE, {
      targetDir: agentsDir,
      method: 'copy',
      fanout,
      pluginLane,
      ...extra,
    });
  }

  async function readLockfile(): Promise<any> {
    return fs.readJson(lockPath);
  }

  beforeEach(async () => {
    // NOTE: never pass maxRetries/retryDelay to fs-extra remove() — it hangs this environment.
    await fs.remove(testWorkspace);
    await fs.ensureDir(testWorkspace);
  });

  afterEach(async () => {
    await fs.remove(testWorkspace);
  });

  // ------------------------------------------------------------------ (a)
  it('a1 is flag-gated: no plugin lane without `pluginLane`, plugin lane with it', async () => {
    await installClaude(false);

    expect(await fs.pathExists(claudeManifest)).toBe(false);
    expect(await fs.pathExists(path.join(pluginBase, '.claude-plugin'))).toBe(false);
    // The canonical store itself is unaffected by the flag.
    expect(await fs.pathExists(path.join(agentsDir, 'agents', 'subagent-backend-architect.md'))).toBe(true);

    await fs.remove(testWorkspace);
    await fs.ensureDir(testWorkspace);
    await installClaude(true);

    expect(await fs.pathExists(claudeManifest)).toBe(true);
  });

  it('a2 is byte-stable: a second flagged install regenerates identical bytes without --force', async () => {
    await installClaude(true);
    const rel = '.agents/plugins/software-engineering/.claude-plugin/plugin.json';
    const first = await fs.readFile(claudeManifest);
    const firstHash = (await readLockfile()).projections[rel].hash;

    // Re-install over our own managed artifact: must regenerate silently (no --force, no throw).
    await installClaude(true);

    expect((await fs.readFile(claudeManifest)).equals(first)).toBe(true);
    expect((await readLockfile()).projections[rel].hash).toBe(firstHash);
  });

  // ------------------------------------------------------------------ (b)
  it('b1 emits exactly the Claude plugin field set with a valid name and version', async () => {
    await installClaude(true);

    const manifest = await fs.readJson(claudeManifest);
    expect(Object.keys(manifest).sort()).toEqual([...MANIFEST_KEYS]);

    expect(manifest.name).toBe(BUNDLE);
    expect(manifest.name).toMatch(/^[a-z0-9][a-z0-9-]*$/);
    expect(typeof manifest.version).toBe('string');
    expect(manifest.version.length).toBeGreaterThan(0);
    expect(manifest.version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('b2 keeps the managed marker inside the JSON so install/doctor treat it as ours', async () => {
    await installClaude(true);

    // `applyCompoundLane` regeneration and `agents doctor` both classify an artifact by
    // `HostProjector.hasManagedMarker()`, and JSON cannot carry an HTML comment — the
    // marker therefore has to survive inside the JSON text itself.
    expect(await fs.readFile(claudeManifest, 'utf8')).toContain(CLAUDE_PLUGIN_MARKER);
  });

  // ------------------------------------------------------------------ (c)
  it('c1 mirrors the project projection byte-for-byte and drops the subagent- prefix', async () => {
    await installClaude(true);

    const pluginRole = path.join(pluginAgentsDir, 'backend-architect.md');
    const projectRole = path.join(testWorkspace, '.claude', 'agents', 'backend-architect.md');
    expect(await fs.pathExists(pluginRole)).toBe(true);
    expect(await fs.pathExists(projectRole)).toBe(true);
    expect((await fs.readFile(pluginRole)).equals(await fs.readFile(projectRole))).toBe(true);

    const pluginRoles = (await fs.readdir(pluginAgentsDir)).filter(f => f.endsWith('.md'));
    expect(pluginRoles.length).toBeGreaterThan(0);
    for (const f of pluginRoles) {
      expect(f.startsWith('subagent-')).toBe(false);
    }
  });

  // ------------------------------------------------------------------ (d)
  it("d1 leaves Cline's plugin.json hard-stop discriminator byte-identical when the flag is on", async () => {
    await installClaude(false, ['cline', 'claude']);
    const withoutFlag = await fs.readFile(clineManifest);
    const baseline = JSON.parse(withoutFlag.toString('utf8'));

    await fs.remove(testWorkspace);
    await fs.ensureDir(testWorkspace);
    await installClaude(true, ['cline', 'claude']);

    expect(await fs.pathExists(clineManifest)).toBe(true);
    const withFlag = await fs.readFile(clineManifest);
    expect(withFlag.equals(withoutFlag)).toBe(true);

    const after = JSON.parse(withFlag.toString('utf8'));
    expect(after.$schema).toBe(baseline.$schema);
    expect(after.name).toBe(baseline.name);
  });

  it('d2 still rejects a foreign .agents/plugins/<bundle>/plugin.json without --force, preserving it', async () => {
    const foreignContent = '{"foreign":true}';
    await fs.ensureDir(pluginBase);
    await fs.writeFile(clineManifest, foreignContent, 'utf8');

    await expect(installClaude(true, ['cline', 'claude'])).rejects.toThrow(/--force/);
    expect(await fs.readFile(clineManifest, 'utf8')).toBe(foreignContent);
  });

  // ------------------------------------------------------------------ (e)
  it('e1 records the plugin manifest as a tracked claude projection in the lockfile', async () => {
    await installClaude(true);

    const rel = '.agents/plugins/software-engineering/.claude-plugin/plugin.json';
    const proj = (await readLockfile()).projections[rel];
    expect(proj).toBeDefined();
    expect(proj.host).toBe('claude');
    expect(proj.kind).toBe('plugin-manifest');
    expect(proj.owners).toContain(BUNDLE);
    expect(proj.hash).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it('e2 records the plugin agents as claude projections without a projectedTo pointer', async () => {
    await installClaude(true);

    const lockfile = await readLockfile();
    const rel = '.agents/plugins/software-engineering/agents/backend-architect.md';
    expect(lockfile.projections[rel]?.host).toBe('claude');
    expect(lockfile.projections[rel]?.kind).toBe('role');

    // ADR 0018 decision 12 — the lane is distribution-only: cline's `reconcileProjectedTo`
    // pass owns `.agents/plugins/<bundle>/` and would drop a claude pointer recorded there.
    const projectedTo: string[] = lockfile.files['agents/subagent-backend-architect.md']?.projectedTo ?? [];
    expect(projectedTo).toContain('.claude/agents/backend-architect.md');
    expect(projectedTo.some(p => p.startsWith('.agents/plugins/'))).toBe(false);
  });

  it('e3 removes the plugin lane again when the flag is switched off', async () => {
    await installClaude(true);
    expect(await fs.pathExists(claudeManifest)).toBe(true);

    await installClaude(false);

    expect(await fs.pathExists(claudeManifest)).toBe(false);
    expect(await fs.pathExists(pluginAgentsDir)).toBe(false);
    expect(
      (await readLockfile()).projections['.agents/plugins/software-engineering/.claude-plugin/plugin.json']
    ).toBeUndefined();
  });

  // ------------------------------------------------------------------ (f)
  it('f1 writes no non-goal artifacts anywhere in the workspace', async () => {
    await installClaude(true);

    expect(await fs.pathExists(path.join(testWorkspace, 'CLAUDE.md'))).toBe(false);
    expect(await fs.pathExists(path.join(testWorkspace, 'CLAUDE.local.md'))).toBe(false);
    expect(await fs.pathExists(path.join(testWorkspace, '.claude', 'settings.json'))).toBe(false);
    expect(await fs.pathExists(path.join(testWorkspace, '.claude', 'workflows'))).toBe(false);
    expect(await fs.pathExists(path.join(testWorkspace, '.claude', '.claude-plugin'))).toBe(false);
  });
});


/**
 * Plan 016 Step 7 / decision 14 — the teams scaffold is verification-only here: the
 * behaviour already lives in `ClaudeLauncher.planActivation`. Nothing is spawned, and the
 * assertions pin the two invariants that make it safe: ephemeral env, never argv, nothing persisted.
 */
describe('Plan 016 Step 7 — ephemeral `--teams` scaffold (no process spawned)', () => {
  const testWorkspace = path.resolve(process.cwd(), 'scratch/test-claude-plugin-lane-teams');
  const agentsDir = path.join(testWorkspace, '.agents');
  const TEAMS_ENV = 'CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS';

  const report: ClaudeCapabilityReport = {
    installed: true,
    version: 'v2.1.300',
    command: { executable: 'claude', prefixArgs: [], source: 'path-executable' },
    pluginSupport: true,
    agentTeamsExperimental: true,
    subagentHandback: true,
    diagnostics: [],
  };

  const plan = (teams: boolean) =>
    new ClaudeLauncher().planActivation({
      bundleName: BUNDLE,
      workspace: testWorkspace,
      scope: 'project',
      report,
      orchestrator: 'orchestrator-engineering.md',
      teams,
    });

  beforeEach(async () => {
    await fs.remove(testWorkspace);
    await fs.ensureDir(testWorkspace);
  });

  afterEach(async () => {
    await fs.remove(testWorkspace);
  });

  it('t1 injects the opt-in variable ephemerally when teams is true and omits it otherwise', () => {
    expect(plan(true).env[TEAMS_ENV]).toBe('1');
    expect(TEAMS_ENV in plan(false).env).toBe(false);
    expect(Object.keys(plan(false).env)).toHaveLength(0);
  });

  it('t2 never lets the variable leak into argv and names a projected agent type in the prompt', async () => {
    await new InstallEngine().install(BUNDLE, {
      targetDir: agentsDir,
      method: 'copy',
      fanout: ['claude'],
      pluginLane: true,
    });
    const projected = (await fs.readdir(path.join(testWorkspace, '.claude', 'agents')))
      .filter(f => f.endsWith('.md'))
      .map(f => f.replace(/\.md$/, ''));
    expect(projected.length).toBeGreaterThan(0);

    const teamsPlan = plan(true);
    expect(teamsPlan.argv.join(' ')).not.toContain(TEAMS_ENV);
    expect(teamsPlan.bootstrapPrompt).not.toContain(TEAMS_ENV);

    // The bootstrap must let the lead spawn teammates by the names it can actually see.
    expect(teamsPlan.bootstrapPrompt).toContain('.claude/agents/');
    expect(projected.some(name => teamsPlan.bootstrapPrompt.includes(name))).toBe(true);

    // Planning a session persists nothing.
    expect(await fs.pathExists(path.join(testWorkspace, '.claude', 'settings.json'))).toBe(false);
    expect(await fs.pathExists(path.join(testWorkspace, 'CLAUDE.md'))).toBe(false);
  });
});

/**
 * Plan 016 Step 7 — the opt-in is STICKY.
 *
 * `agents update` re-runs the installer without `--plugin`, so an unset flag must inherit the
 * recorded choice; otherwise every update would prune the opted-in package as a superseded
 * projection, silently and with no CLI way to preserve it. Only an explicit `pluginLane: false`
 * (CLI `--no-plugin`) turns the lane back off.
 */
describe('Plan 016 Step 7 — the plugin-lane opt-in is recorded and survives an update', () => {
  const testWorkspace = path.resolve(process.cwd(), 'scratch/test-claude-plugin-lane-sticky');
  const agentsDir = path.join(testWorkspace, '.agents');
  const manifest = path.join(agentsDir, 'plugins', BUNDLE, '.claude-plugin', 'plugin.json');
  const manifestRel = '.agents/plugins/software-engineering/.claude-plugin/plugin.json';

  const install = (options: InstallOptions = {}) =>
    new InstallEngine().install(BUNDLE, {
      targetDir: agentsDir,
      method: 'copy',
      fanout: ['claude'],
      ...options,
    });

  beforeEach(async () => {
    await fs.remove(testWorkspace);
    await fs.ensureDir(testWorkspace);
  });

  afterEach(async () => {
    await fs.remove(testWorkspace);
  });

  it('keeps the package when a later install omits the flag (the agents update path)', async () => {
    await install({ pluginLane: true });
    expect(await fs.pathExists(manifest)).toBe(true);
    expect((await fs.readJson(path.join(agentsDir, 'agents-united.json'))).pluginLane).toBe(true);

    // Exactly what UpdateEngine.update does: re-run the installer without --plugin.
    await install();

    expect(await fs.pathExists(manifest)).toBe(true);
    expect(await fs.pathExists(path.join(agentsDir, 'plugins', BUNDLE, 'agents'))).toBe(true);
    const lockfile = await fs.readJson(path.join(agentsDir, 'agents-united.json'));
    expect(lockfile.pluginLane).toBe(true);
    expect(lockfile.projections[manifestRel]).toBeDefined();
  });

  it('removes the package only when the flag is explicitly turned off', async () => {
    await install({ pluginLane: true });
    await install({ pluginLane: false });

    expect(await fs.pathExists(manifest)).toBe(false);
    const lockfile = await fs.readJson(path.join(agentsDir, 'agents-united.json'));
    expect(lockfile.pluginLane).toBeUndefined();
    expect(lockfile.projections[manifestRel]).toBeUndefined();
  });

  it('never enables the lane from the flag alone when the claude fanout is absent', async () => {
    await install({ fanout: ['cline'], pluginLane: true });

    const lockfile = await fs.readJson(path.join(agentsDir, 'agents-united.json'));
    expect(lockfile.pluginLane).toBeUndefined();
    expect(await fs.pathExists(manifest)).toBe(false);
  });
});

