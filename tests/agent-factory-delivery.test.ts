import path from 'node:path';
import os from 'node:os';
import fs from 'fs-extra';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { InstallEngine } from '../src/core/installer.js';
import { RegistryResolver } from '../src/core/registry.js';
import { UpdateEngine } from '../src/core/updater.js';
import type { InstallOptions } from '../src/core/types.js';

describe('bundle host availability before writes', () => {
  let directory: string;
  let registry: string;
  let workspace: string;
  let resolver: RegistryResolver;
  const availability = { claude: { lane: 'native', scopes: ['workspace'] } };
  beforeEach(async () => {
    directory = await fs.mkdtemp(path.join(os.tmpdir(), 'au-factory-delivery-'));
    registry = path.join(directory, 'registry');
    workspace = path.join(directory, 'workspace');
    await fs.ensureDir(workspace);
    await fs.outputJson(path.join(registry, 'bundles.json'), {
      version: 1, bundles: {
        'restricted-tools': { name: 'restricted-tools', domain: 'contributor', skills: ['draft-fixture'], hostAvailability: availability },
        legacy: { name: 'legacy', skills: ['legacy-fixture'] },
      },
    });
    for (const name of ['draft-fixture', 'legacy-fixture']) {
      await fs.outputFile(path.join(registry, 'skills', name, 'SKILL.md'), `---\nname: ${name}\ndescription: A fixture task.\n---\n# Fixture\n`);
    }
    await fs.outputFile(path.join(registry, 'rules/GEMINI.md'), '# Fixture baseline\n');
    await fs.outputJson(path.join(registry, 'hosts/antigravity/mcp/servers.json'), { servers: {} });
    resolver = new RegistryResolver(registry);
  });
  afterEach(async () => { await fs.remove(directory); });
  const options = (extra: InstallOptions = {}): InstallOptions => ({
    targetDir: path.join(workspace, '.claude/.agents-united'), method: 'copy', fanout: ['claude'], nativeLane: true, ...extra,
  });
  const snapshot = async (): Promise<Record<string, string>> => {
    const result: Record<string, string> = {};
    const walk = async (dir: string): Promise<void> => {
      for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
        const file = path.join(dir, entry.name);
        if (entry.isDirectory()) await walk(file);
        else result[path.relative(workspace, file)] = (await fs.readFile(file)).toString('base64');
      }
    };
    await walk(workspace);
    return result;
  };
  it.each(['agents', 'gemini', 'cline', 'codex', 'cursor', 'opencode'])('rejects %s despite overrides without creating directories', async host => {
    await expect(new InstallEngine(resolver).install('restricted-tools', options({ fanout: [host], force: true, allowUnderConstruction: true }))).rejects.toThrow(/restricted-tools.*unavailable/i);
    expect(await fs.readdir(workspace)).toEqual([]);
  });
  it.each([
    { nativeLane: false }, { scope: 'global' as const }, { fanout: ['claude', 'cline'] },
    { hosts: ['agents', 'claude'] as const, targetDir: 'store' },
  ])('rejects incompatible lane/scope/mixed target request %j atomically', async extra => {
    const installOptions = options({ ...extra, hosts: extra.hosts ? [...extra.hosts] : undefined });
    if (extra.targetDir) installOptions.targetDir = path.join(workspace, '.agents');
    await expect(new InstallEngine(resolver).install('restricted-tools', installOptions)).rejects.toThrow(/restricted-tools.*unavailable/i);
    expect(await fs.readdir(workspace)).toEqual([]);
  });
  it.each([{ target: 'claude,antigravity' }, { target: ['claude', 'unknown-host'] }])('rejects every raw requested target $target before partial delivery', async ({ target }) => {
    await expect(new InstallEngine(resolver).install('restricted-tools', options({ target }))).rejects.toThrow(/unavailable/i);
    expect(await fs.readdir(workspace)).toEqual([]);
  });
  it('allows Claude sidecar and inherits the recorded native lane and fanout on reinstall', async () => {
    const engine = new InstallEngine(resolver);
    await engine.install('restricted-tools', options());
    const before = await fs.readJson(path.join(options().targetDir!, 'agents-united.json'));
    expect(before.nativeLane).toBe(true);
    await engine.install('restricted-tools', options({ nativeLane: undefined, fanout: undefined }));
    const after = await fs.readJson(path.join(options().targetDir!, 'agents-united.json'));
    expect(after.nativeLane).toBe(true);
    expect(after.fanout).toEqual(['claude']);
  });
  it('allows an implicit store for Claude and rejects a canonical Antigravity request', async () => {
    await new InstallEngine(resolver).install('restricted-tools', options({ targetDir: path.join(workspace, '.agents'), implicitStore: true }));
    const before = await snapshot();
    await expect(new InstallEngine(resolver).install('restricted-tools', options({ targetDir: path.join(workspace, '.agents'), implicitStore: false, force: true }))).rejects.toThrow(/unavailable/i);
    expect(await snapshot()).toEqual(before);
  });
  it('inherits the native choice from a sidecar during an implicit-store upgrade, including dry-run', async () => {
    await new InstallEngine(resolver).install('restricted-tools', options());
    const before = await snapshot();
    const upgrade = options({ targetDir: path.join(workspace, '.agents'), storeShape: 'store', implicitStore: true, pluginLane: true, nativeLane: undefined });
    const dry = await new InstallEngine(resolver).install('restricted-tools', { ...upgrade, dryRun: true });
    expect(dry.dryRun).toBe(true);
    expect(await snapshot()).toEqual(before);
    await new InstallEngine(resolver).install('restricted-tools', upgrade);
    const lock = await fs.readJson(path.join(workspace, '.agents/agents-united.json'));
    expect(lock.nativeLane).toBe(true);
    expect(lock.implicitStore).toBe(true);
    expect(lock.fanout).toEqual(['claude']);
    expect(await fs.pathExists(path.join(workspace, '.claude/.agents-united/agents-united.json'))).toBe(false);
  });
  it('normalizes requested host whitespace/case consistently', async () => {
    await new InstallEngine(resolver).install('restricted-tools', options({ fanout: [' CLAUDE '] }));
    const lock = await fs.readJson(path.join(options().targetDir!, 'agents-united.json'));
    expect(lock.fanout).toEqual(['claude']);
  });
  it('rejects direct contributor-exclusive skills on unsupported hosts', async () => {
    await expect(new InstallEngine(resolver).install('draft-fixture', options({ fanout: ['cline'] }))).rejects.toThrow(/unavailable/i);
    expect(await fs.readdir(workspace)).toEqual([]);
  });
  it('rejects a restricted parent required by a child bundle', async () => {
    const manifest = await fs.readJson(path.join(registry, 'bundles.json'));
    manifest.bundles.child = { name: 'child', domain: 'contributor', parentBundle: 'restricted-tools', skills: ['legacy-fixture'] };
    await fs.writeJson(path.join(registry, 'bundles.json'), manifest);
    await expect(new InstallEngine(new RegistryResolver(registry)).install('child', options({ nativeLane: false }))).rejects.toThrow(/restricted-tools.*unavailable/i);
    expect(await fs.readdir(workspace)).toEqual([]);
  });
  it('rejects sticky unsupported fanout and explicit no-native before changing an existing install', async () => {
    await new InstallEngine(resolver).install('restricted-tools', options());
    const before = await snapshot();
    await expect(new InstallEngine(resolver).install('restricted-tools', options({ nativeLane: false, force: true }))).rejects.toThrow(/unavailable/i);
    expect(await snapshot()).toEqual(before);
    const lockPath = path.join(options().targetDir!, 'agents-united.json');
    const lock = await fs.readJson(lockPath);
    lock.fanout.push('cline');
    await fs.writeJson(lockPath, lock);
    const changed = await snapshot();
    await expect(new InstallEngine(resolver).install('restricted-tools', options({ fanout: undefined }))).rejects.toThrow(/unavailable/i);
    expect(await snapshot()).toEqual(changed);
  });
  it('rejects an incompatible update before legacy migration or any state write', async () => {
    await new InstallEngine(resolver).install('restricted-tools', options());
    const lockPath = path.join(options().targetDir!, 'agents-united.json');
    const lock = await fs.readJson(lockPath);
    lock.projections['.claude/skills/generative_ui/SKILL.md'] = { host: 'claude', canonical: 'skills/generative_ui/SKILL.md', bundle: 'restricted-tools', owners: ['restricted-tools'] };
    await fs.outputFile(path.join(workspace, '.claude/skills/generative_ui/SKILL.md'), '<!-- managed-by: agents-united -->\nold\n');
    await fs.writeJson(lockPath, lock);
    const before = await snapshot();
    await expect(new UpdateEngine(resolver).update('restricted-tools', { targetDir: options().targetDir, fanout: ['claude', 'cline'], force: true })).rejects.toThrow(/unavailable/i);
    expect(await snapshot()).toEqual(before);
  });
  it('rejects a populated factory without its required availability declaration', async () => {
    const manifest = await fs.readJson(path.join(registry, 'bundles.json'));
    manifest.bundles['agent-factory'] = { name: 'agent-factory', domain: 'contributor', skills: ['draft-fixture'] };
    await fs.writeJson(path.join(registry, 'bundles.json'), manifest);
    await expect(new InstallEngine(new RegistryResolver(registry)).install('agent-factory', options({ fanout: ['cline'] }))).rejects.toThrow(/hostAvailability/i);
    expect(await fs.readdir(workspace)).toEqual([]);
  });
  it('rejects the runnable factory skill when its owning bundle declaration is absent', async () => {
    await fs.outputFile(path.join(registry, 'skills/author-skill/SKILL.md'), '---\nname: author-skill\ndescription: Missing owning bundle fixture.\n---\n');
    await expect(new InstallEngine(resolver).install('author-skill', options({ fanout: ['cline'] }))).rejects.toThrow(/owning.*bundle|bundle.*declaration/i);
    expect(await fs.readdir(workspace)).toEqual([]);
  });
  it('keeps bundles without availability metadata installable on existing targets', async () => {
    const result = await new InstallEngine(resolver).install('legacy', options({ nativeLane: false, fanout: ['cline'] }));
    expect(result.installed.skills).toContain('legacy-fixture');
  });
  it.each([null, {}, [], { agents: { lane: 'native', scopes: ['workspace'] } }, { claude: { lane: 'legacy', scopes: ['workspace'] } }, { claude: { lane: 'native', scopes: [] } }, { claude: { lane: 'native', scopes: ['project'] } }])('validates malformed manifest availability %j', async hostAvailability => {
    const manifest = await fs.readJson(path.join(registry, 'bundles.json'));
    manifest.bundles['restricted-tools'].hostAvailability = hostAvailability;
    await fs.writeJson(path.join(registry, 'bundles.json'), manifest);
    await expect(new RegistryResolver(registry).loadBundles()).rejects.toThrow(/hostAvailability/i);
  });
});
