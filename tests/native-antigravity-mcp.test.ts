import fs from 'fs-extra';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ANTIGRAVITY_MCP_FILE,
  inspectAntigravityMcp,
  loadMcpCatalog,
  mcpEntryHash,
  syncAntigravityMcp,
  type McpEntry,
} from '../src/core/antigravity-mcp.js';
import { declaredServerNames } from '../src/core/mcp-declarations.js';
import { McpLocationRegistry } from '../src/core/mcp-locations.js';
import { PrerequisiteChecker } from '../src/core/prerequisites.js';
import { DoctorEngine } from '../src/core/doctor.js';
import { InstallEngine } from '../src/core/installer.js';
import { UninstallEngine } from '../src/core/uninstaller.js';
import type { AntigravityMcpRecord } from '../src/core/types.js';

/**
 * Plan 032 Phase 8 / ADR 0032 — MCP wiring in the Antigravity native lane. The packaged entries are a reviewed catalog
 * (`registry/hosts/antigravity/mcp/servers.json`) of the servers the registry agents already declare by name. The workspace file
 * `.agents/mcp_config.json` is the user's own: only our keys are merged in, and a key is ours only when the lockfile says so. No secret
 * is ever written: a server that needs a credential ships switched off and names the variable it needs.
 */

const REGISTRY = path.resolve('registry');
const BUNDLE = 'software-engineering';
const read = (file: string): string => fs.readFileSync(file, 'utf8');
const catalog = loadMcpCatalog(REGISTRY);

const A: McpEntry = { command: 'npx', args: ['-y', 'a-mcp'] };
const B: McpEntry = { command: 'uvx', args: ['b-mcp'] };
const C: McpEntry = { command: 'npx', args: ['-y', 'c-mcp'], disabled: true };
const USER = { mine: { command: 'node', args: ['server.js'], env: { MY_KEY: 'user-owned-value' } }, remote: { serverUrl: 'https://example.com/mcp' } };

describe('the packaged catalog', () => {
  const registryAgents = (): string[] => fs.readdirSync(path.join(REGISTRY, 'agents')).filter(f => f.endsWith('.md'));

  it('has an entry for every server the registry agents declare, and for nothing else', async () => {
    const declared = await declaredServerNames(path.join(REGISTRY, 'agents'), registryAgents());
    expect(Object.keys(catalog).sort()).toEqual([...declared].sort());
    expect(declared).toEqual(expect.arrayContaining(['github', 'context7', 'firecrawl', 'stitch', 'chrome-devtools-mcp']));
  });

  it('writes only keys the host documents, one transport each, and never the legacy remote fields', () => {
    const documented = ['command', 'serverUrl', 'args', 'env', 'cwd', 'headers', 'authProviderType', 'oauth', 'disabled', 'disabledTools'];
    for (const [name, server] of Object.entries(catalog)) {
      const keys = Object.keys(server.entry);
      expect(keys.every(key => documented.includes(key)), name).toBe(true);
      expect(keys.filter(key => key === 'command' || key === 'serverUrl'), name).toHaveLength(1);
      expect(keys, name).not.toContain('url');
      expect(keys, name).not.toContain('httpUrl');
    }
  });

  it('carries no place a secret could sit: no env, headers or oauth block', () => {
    for (const [name, server] of Object.entries(catalog)) {
      for (const key of ['env', 'headers', 'oauth']) expect(server.entry, `${name}.${key}`).not.toHaveProperty(key);
    }
  });

  it('keeps the launch command of the existing server definitions, so the two cannot drift apart', () => {
    for (const [name, server] of Object.entries(catalog)) {
      const legacy = PrerequisiteChecker.getMcpDefinition(name, 'limited-operational', {});
      expect({ command: server.entry.command, args: server.entry.args }, name).toEqual({ command: legacy.command, args: legacy.args });
    }
  });

  it('names every variable the existing definitions would pass, and a server that needs one ships switched off', () => {
    const everything = { GITHUB_PERSONAL_ACCESS_TOKEN: 'x', FIRECRAWL_API_KEY: 'x', STITCH_API_KEY: 'x', FIGMA_ACCESS_TOKEN: 'x', UPSTASH_REDIS_REST_URL: 'x', UPSTASH_REDIS_REST_TOKEN: 'x' };
    for (const [name, server] of Object.entries(catalog)) {
      const legacyEnv = Object.keys(PrerequisiteChecker.getMcpDefinition(name, 'operational', everything).env ?? {});
      expect([...server.requiresEnv, ...server.optionalEnv].sort(), name).toEqual(expect.arrayContaining(legacyEnv));
      if (server.requiresEnv.length > 0) expect(server.entry.disabled, name).toBe(true);
      else expect(server.entry, name).not.toHaveProperty('disabled');
    }
    expect(catalog.github.requiresEnv).toEqual(['GITHUB_PERSONAL_ACCESS_TOKEN']);
    expect(catalog.context7.requiresEnv).toEqual([]);
  });

  it('hashes an entry without its disabled switch and without regard to key order', () => {
    expect(mcpEntryHash({ command: 'x', args: ['a'], disabled: true })).toBe(mcpEntryHash({ args: ['a'], command: 'x' }));
    expect(mcpEntryHash({ command: 'x', args: ['a'], disabled: false })).toBe(mcpEntryHash({ command: 'x', args: ['a'] }));
    expect(mcpEntryHash({ command: 'x', args: ['a'] })).not.toBe(mcpEntryHash({ command: 'x', args: ['b'] }));
    expect(mcpEntryHash(A)).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe('reading the declared servers', () => {
  const dir = path.resolve(process.cwd(), 'scratch/test-antigravity-mcp-declared');
  beforeEach(async () => {
    await fs.remove(dir);
    await fs.ensureDir(dir);
  });
  afterEach(async () => {
    await fs.remove(dir);
  });

  it('reads names from both list forms, dedupes, sorts, and skips a file it cannot read', async () => {
    await fs.outputFile(path.join(dir, 'one.md'), '---\nname: one\nmcpServers:\n  - name: github\n  - context7\n---\nbody');
    await fs.outputFile(path.join(dir, 'two.md'), '---\r\nname: two\r\nmcpServers:\r\n  - name: github\r\n  - name: figma\r\n---\r\nbody');
    await fs.outputFile(path.join(dir, 'broken.md'), '---\nname: [unclosed\n---\n');
    await fs.outputFile(path.join(dir, 'none.md'), 'no frontmatter');
    expect(await declaredServerNames(dir, ['one.md', 'two.md', 'broken.md', 'none.md', 'missing.md'])).toEqual(['context7', 'figma', 'github']);
    expect(await declaredServerNames(path.join(dir, 'nowhere'))).toEqual([]);
  });

  it('reads every .md file of the folder when no file list is given', async () => {
    await fs.outputFile(path.join(dir, 'one.md'), '---\nmcpServers:\n  - name: stitch\n---\n');
    await fs.outputFile(path.join(dir, 'note.txt'), 'ignored');
    expect(await declaredServerNames(dir)).toEqual(['stitch']);
  });
});

describe('merging into mcp_config.json', () => {
  const dir = path.resolve(process.cwd(), 'scratch/test-antigravity-mcp-merge');
  const file = path.join(dir, '.agents/mcp_config.json');
  const sync = (desired: Record<string, McpEntry>, record?: AntigravityMcpRecord, extra: { bundle?: string; dropAll?: boolean } = {}) =>
    syncAntigravityMcp(file, { desired, bundle: extra.bundle ?? 'b1', record, dropAll: extra.dropAll });
  const servers = (): Record<string, unknown> => (JSON.parse(read(file)) as { mcpServers: Record<string, unknown> }).mcpServers;
  const userFile = (indent: string | number = 2, eol = '\n'): string => `${JSON.stringify({ mcpServers: USER }, null, indent).replace(/\n/g, eol)}${eol}`;

  beforeEach(async () => {
    await fs.remove(dir);
    await fs.ensureDir(dir);
  });
  afterEach(async () => {
    await fs.remove(dir);
  });

  it('creates the file with only our servers and records what it wrote', async () => {
    const result = await sync({ a: A, c: C });
    expect(result.status).toBe('ok');
    expect(result.servers).toEqual({ a: 'added', c: 'added' });
    expect(JSON.parse(read(file))).toEqual({ mcpServers: { a: A, c: C } });
    expect(result.record).toEqual({
      file: ANTIGRAVITY_MCP_FILE,
      createdFile: true,
      createdKey: true,
      servers: { a: { entryHash: mcpEntryHash(A), owners: ['b1'] }, c: { entryHash: mcpEntryHash(C), owners: ['b1'] } },
    });
  });

  it("adds our servers beside the user's own, keeping their order, indent, line endings and final newline, and is byte-stable", async () => {
    await fs.outputFile(file, userFile('\t', '\r\n'));
    const first = await sync({ a: A });
    expect(Object.keys(servers())).toEqual(['mine', 'remote', 'a']);
    expect(servers().mine).toEqual(USER.mine);
    const text = read(file);
    expect(text).toContain('\r\n\t\t"a"');
    expect(text.endsWith('\r\n')).toBe(true);
    expect(text).not.toMatch(/[^\r]\n/);
    expect(first.record?.createdFile).toBe(false);
    expect(first.record?.createdKey).toBe(false);
    const again = await sync({ a: A }, first.record);
    expect(again.servers).toEqual({ a: 'unchanged' });
    expect(read(file)).toBe(text);
  });

  it('keeps the other top-level keys of the file', async () => {
    await fs.outputFile(file, `${JSON.stringify({ note: 'mine', mcpServers: {}, other: [1] }, null, 2)}\n`);
    await sync({ a: A });
    expect(Object.keys(JSON.parse(read(file)))).toEqual(['note', 'mcpServers', 'other']);
  });

  it('adds the mcpServers object to a file that has none, and removes it again so the user bytes return', async () => {
    const original = `${JSON.stringify({ note: 'mine' }, null, 2)}\n`;
    await fs.outputFile(file, original);
    const added = await sync({ a: A });
    expect(added.record?.createdKey).toBe(true);
    expect(added.record?.createdFile).toBe(false);
    expect(JSON.parse(read(file))).toEqual({ note: 'mine', mcpServers: { a: A } });
    const removed = await sync({}, added.record);
    expect(removed.servers).toEqual({ a: 'removed' });
    expect(removed.record).toBeUndefined();
    expect(read(file)).toBe(original);
  });

  it('never rewrites a file it cannot read as strict JSON, a root that is not an object, or an mcpServers that is not one', async () => {
    for (const text of ['{ // a comment\n "mcpServers": {} }', '{ "mcpServers": {}, }', '[]', 'null', '', '{ "mcpServers": [] }', '{ "mcpServers": 3 }']) {
      await fs.outputFile(file, text);
      const result = await sync({ a: A });
      expect(result.status, JSON.stringify(text)).toBe('skipped-invalid');
      expect(read(file)).toBe(text);
      expect((await inspectAntigravityMcp(file, { file: ANTIGRAVITY_MCP_FILE, createdFile: false, createdKey: false, servers: { a: { entryHash: 'x', owners: ['b1'] } } }, { a: { entry: A, requiresEnv: [], optionalEnv: [] } })).file).toBe('skipped-invalid');
      expect((await sync({}, undefined, { dropAll: true })).status).toBe('skipped-invalid');
      expect(read(file)).toBe(text);
    }
  });

  it("treats a server of the same name the user already has as theirs: untouched, never recorded, never removed", async () => {
    await fs.outputFile(file, `${JSON.stringify({ mcpServers: { a: { command: 'my-own-a' } } }, null, 2)}\n`);
    const before = read(file);
    const result = await sync({ a: A });
    expect(result.servers).toEqual({ a: 'user-owned' });
    expect(result.record).toBeUndefined();
    expect(read(file)).toBe(before);
  });

  it('leaves a server of ours the user edited alone, and replaces an older version of ours the lockfile recorded, keeping their switch', async () => {
    const first = await sync({ a: A, b: B });
    const edited = { ...A, args: ['-y', 'a-mcp', '--my-flag'] };
    await fs.outputFile(file, JSON.stringify({ mcpServers: { a: edited, b: { ...B, disabled: true } } }, null, 2));
    const before = read(file);
    const second = await sync({ a: A, b: B }, first.record);
    expect(second.servers.a).toBe('modified');
    expect(second.servers.b).toBe('unchanged'); // a switch alone is not an edit
    expect(read(file)).toBe(before);
    expect(second.record?.servers.a.entryHash).toBe(mcpEntryHash(A));

    const NEWER: McpEntry = { command: 'npx', args: ['-y', 'a-mcp@2'] };
    await fs.outputFile(file, JSON.stringify({ mcpServers: { a: { ...A, disabled: true }, b: B } }, null, 2));
    const third = await sync({ a: NEWER, b: B }, first.record);
    expect(third.servers.a).toBe('replaced');
    expect(servers().a).toEqual({ ...NEWER, disabled: true });
    expect(third.record?.servers.a.entryHash).toBe(mcpEntryHash(NEWER));
  });

  it('puts a deleted server of ours back on the next sync', async () => {
    const first = await sync({ a: A, b: B });
    await fs.outputFile(file, JSON.stringify({ mcpServers: { b: B } }, null, 2));
    const second = await sync({ a: A, b: B }, first.record);
    expect(second.servers.a).toBe('added');
    expect(Object.keys(servers()).sort()).toEqual(['a', 'b']);
  });

  it('removes only our servers, restoring the user bytes, and deletes the file only when it created it and nothing is left', async () => {
    const original = userFile();
    await fs.outputFile(file, original);
    const added = await sync({ a: A, b: B });
    const removed = await sync({}, added.record);
    expect(removed.servers).toEqual({ a: 'removed', b: 'removed' });
    expect(read(file)).toBe(original);

    await fs.remove(file);
    const created = await sync({ a: A });
    const gone = await sync({}, created.record);
    expect(gone.record).toBeUndefined();
    expect(await fs.pathExists(file)).toBe(false);

    await fs.outputFile(file, JSON.stringify({ mcpServers: { a: A } }));
    const kept = await sync({}, { file: ANTIGRAVITY_MCP_FILE, createdFile: false, createdKey: false, servers: { a: { entryHash: mcpEntryHash(A), owners: ['b1'] } } });
    expect(kept.servers).toEqual({ a: 'removed' });
    expect(JSON.parse(read(file))).toEqual({ mcpServers: {} });
  });

  it('keeps a server while another bundle still owns it', async () => {
    const one = await sync({ a: A, b: B }, undefined, { bundle: 'b1' });
    const two = await sync({ a: A }, one.record, { bundle: 'b2' });
    expect(two.record?.servers.a.owners).toEqual(['b1', 'b2']);
    expect(two.record?.servers.b.owners).toEqual(['b1']);
    const release1 = await sync({}, two.record, { bundle: 'b1' });
    expect(release1.servers).toEqual({ a: 'released', b: 'removed' });
    expect(Object.keys(servers())).toEqual(['a']);
    expect(release1.record?.servers.a.owners).toEqual(['b2']);
    const release2 = await sync({}, release1.record, { bundle: 'b2' });
    expect(release2.servers).toEqual({ a: 'removed' });
    expect(await fs.pathExists(file)).toBe(false);
  });

  it('drops a server a bundle no longer declares when it syncs again', async () => {
    const one = await sync({ a: A, b: B });
    const two = await sync({ a: A }, one.record);
    expect(two.servers.b).toBe('removed');
    expect(Object.keys(servers())).toEqual(['a']);
  });

  it('removes every recorded server whoever owns it when asked to drop all (the lane is off)', async () => {
    const one = await sync({ a: A }, undefined, { bundle: 'b1' });
    const two = await sync({ a: A, b: B }, one.record, { bundle: 'b2' });
    const off = await sync({}, two.record, { dropAll: true });
    expect(off.record).toBeUndefined();
    expect(await fs.pathExists(file)).toBe(false);
  });

  it('does not remove a server the user edited: it stays, the record is dropped, and the outcome says so', async () => {
    const added = await sync({ a: A });
    const edited = { ...A, env: { TOKEN: 'user-typed-secret' } };
    await fs.outputFile(file, JSON.stringify({ mcpServers: { a: edited } }, null, 2));
    const removed = await sync({}, added.record);
    expect(removed.servers).toEqual({ a: 'left-edited' });
    expect(removed.record).toBeUndefined();
    expect(servers().a).toEqual(edited);
  });

  it('inspects only the servers of ours the lockfile records', async () => {
    const added = await sync({ a: A, b: B, c: C });
    const shipped = { a: { entry: A, requiresEnv: [], optionalEnv: [] }, b: { entry: B, requiresEnv: [], optionalEnv: [] }, c: { entry: C, requiresEnv: ['X'], optionalEnv: [] } };
    const view = () => inspectAntigravityMcp(file, added.record!, shipped);
    expect(await view()).toEqual({ file: 'ok', servers: { a: 'wired', b: 'wired', c: 'wired' } });

    await fs.outputFile(file, JSON.stringify({ mine: 1, mcpServers: { ...USER, a: { ...A, disabled: true }, b: { command: 'changed' }, extra: {} } }, null, 8));
    expect(await view()).toEqual({ file: 'ok', servers: { a: 'disabled', b: 'modified', c: 'missing' } });

    await fs.outputFile(file, JSON.stringify({ mcpServers: { a: A, b: B, c: { ...C, disabled: false } } }));
    expect((await view()).servers.c).toBe('wired'); // the user switched on a server we ship off
    const newer = { ...shipped, a: { entry: { command: 'npx', args: ['-y', 'a-mcp@2'] }, requiresEnv: [], optionalEnv: [] } };
    expect((await inspectAntigravityMcp(file, added.record!, newer)).servers.a).toBe('stale');

    await fs.remove(file);
    expect((await view()).file).toBe('absent');
  });
});

describe('the MCP location registry', () => {
  it('knows the workspace file Antigravity documents, so the doctor and the prerequisite check see what the lane wrote', () => {
    const resolved = McpLocationRegistry.LOCATIONS.filter(loc => loc.host === 'gemini').map(loc => path.normalize(loc.resolvePath('/work', '/home/u', '/home/u/.config')));
    expect(resolved).toContain(path.normalize('/work/.agents/mcp_config.json'));
    expect(resolved).toContain(path.normalize('/home/u/.gemini/config/mcp_config.json'));
  });
});

describe('MCP wiring in the native install lane (agents add --native)', () => {
  const workspace = path.resolve(process.cwd(), 'scratch/test-native-antigravity-mcp');
  const agentsDir = path.join(workspace, '.agents');
  const lockPath = path.join(agentsDir, 'agents-united.json');
  const at = (rel: string): string => path.join(workspace, rel);
  const install = (nativeLane?: boolean, extra: Record<string, unknown> = {}, bundle = BUNDLE) =>
    new InstallEngine().install(bundle, { targetDir: agentsDir, method: 'copy', nativeLane, ...extra });
  const wired = (): Record<string, Record<string, unknown>> => (JSON.parse(read(at(ANTIGRAVITY_MCP_FILE))) as { mcpServers: Record<string, Record<string, unknown>> }).mcpServers;
  const SE = ['chrome-devtools-mcp', 'context7', 'firecrawl', 'github', 'stitch'];
  const SECRET = 'ghp_SECRET_VALUE_THAT_MUST_NEVER_BE_WRITTEN';
  const saved: Record<string, string | undefined> = {};

  beforeEach(async () => {
    await fs.remove(workspace);
    await fs.ensureDir(workspace);
    for (const key of ['GITHUB_PERSONAL_ACCESS_TOKEN', 'FIRECRAWL_API_KEY', 'STITCH_API_KEY']) saved[key] = process.env[key];
    process.env.GITHUB_PERSONAL_ACCESS_TOKEN = SECRET;
    process.env.FIRECRAWL_API_KEY = SECRET;
    process.env.STITCH_API_KEY = SECRET;
  });
  afterEach(async () => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await fs.remove(workspace);
  });

  it('packages every server the bundle declares', async () => {
    const bundle = (JSON.parse(read(path.join(REGISTRY, 'bundles.json'))) as { bundles: Record<string, { orchestrator: string; agents: string[] }> }).bundles[BUNDLE];
    expect(await declaredServerNames(path.join(REGISTRY, 'agents'), [bundle.orchestrator, ...bundle.agents])).toEqual(SE);
  });

  it('is off with the lane: nothing is written, nothing recorded', async () => {
    await install();
    expect(await fs.pathExists(at(ANTIGRAVITY_MCP_FILE))).toBe(false);
    expect((await fs.readJson(lockPath)).antigravityMcp).toBeUndefined();
  });

  it('writes the servers the bundle declares, the credentialed ones switched off, and never a secret', async () => {
    const result = await install(true);
    expect(Object.keys(wired()).sort()).toEqual(SE);
    for (const name of SE) expect(wired()[name], name).toEqual(catalog[name].entry);
    expect(wired().github.disabled).toBe(true);
    expect(wired().context7).not.toHaveProperty('disabled');
    expect(read(at(ANTIGRAVITY_MCP_FILE))).not.toContain(SECRET);
    expect(read(at(ANTIGRAVITY_MCP_FILE))).not.toMatch(/"(env|headers|oauth)"/);
    expect(read(at(ANTIGRAVITY_MCP_FILE))).not.toMatch(/"(url|httpUrl)"/);
    expect(await fs.readFile(lockPath, 'utf8')).not.toContain(SECRET);

    const lock = await fs.readJson(lockPath);
    expect(lock.antigravityMcp.file).toBe(ANTIGRAVITY_MCP_FILE);
    expect(lock.antigravityMcp.createdFile).toBe(true);
    expect(Object.keys(lock.antigravityMcp.servers).sort()).toEqual(SE);
    expect(lock.antigravityMcp.servers.github).toEqual({ entryHash: mcpEntryHash(catalog.github.entry), owners: [BUNDLE] });
    // mcp_config.json is the user's file, so it is not a hashed projection.
    expect(lock.projections?.[ANTIGRAVITY_MCP_FILE]).toBeUndefined();

    const info = result.projections.find(p => p.path === ANTIGRAVITY_MCP_FILE);
    const text = info?.warnings.join('\n') ?? '';
    expect(text).toContain('GITHUB_PERSONAL_ACCESS_TOKEN');
    expect(text).toContain('FIRECRAWL_API_KEY');
    expect(text).toContain('agy mcp enable github');
    expect(text).not.toContain('context7');
    expect(text).not.toContain(SECRET);
  });

  it("merges into a file the user already has, keeps their servers through update, a lane switch and removal, and never claims a server of theirs", async () => {
    const own = { mine: USER.mine, github: { serverUrl: 'https://api.githubcopilot.com/mcp/' } };
    const user = `${JSON.stringify({ mcpServers: own }, null, 2)}\n`;
    await fs.outputFile(at(ANTIGRAVITY_MCP_FILE), user);
    const result = await install(true);
    expect(Object.keys(wired())).toEqual(['mine', 'github', ...SE.filter(name => name !== 'github')]);
    expect(wired().github).toEqual(own.github);
    const lock = await fs.readJson(lockPath);
    expect(lock.antigravityMcp.createdFile).toBe(false);
    expect(lock.antigravityMcp.servers.github).toBeUndefined();
    expect(result.projections.find(p => p.path === ANTIGRAVITY_MCP_FILE)?.warnings.join('\n')).toMatch(/github.*already in .*yours|yours.*github/i);

    await install(undefined, { force: true }); // what `agents update` does: the lane and the wiring are sticky
    expect(Object.keys(wired())).toHaveLength(2 + SE.length - 1);

    await install(false, { force: true });
    expect(read(at(ANTIGRAVITY_MCP_FILE))).toBe(user);
    expect((await fs.readJson(lockPath)).antigravityMcp).toBeUndefined();

    await install(true);
    await new UninstallEngine().uninstall(BUNDLE, { targetDir: agentsDir });
    expect(read(at(ANTIGRAVITY_MCP_FILE))).toBe(user);
  });

  it('is byte-stable and keeps what the user switched on', async () => {
    await install(true);
    const first = read(at(ANTIGRAVITY_MCP_FILE));
    await install(true);
    expect(read(at(ANTIGRAVITY_MCP_FILE))).toBe(first);

    const config = JSON.parse(first) as { mcpServers: Record<string, Record<string, unknown>> };
    delete config.mcpServers.github.disabled; // what `agy mcp enable github` amounts to
    await fs.outputFile(at(ANTIGRAVITY_MCP_FILE), JSON.stringify(config, null, 2));
    const switched = read(at(ANTIGRAVITY_MCP_FILE));
    await install(undefined, { force: true });
    expect(read(at(ANTIGRAVITY_MCP_FILE))).toBe(switched);
  });

  it('turning the lane off removes our servers and deletes a file it created', async () => {
    await install(true);
    await install(false, { force: true });
    expect(await fs.pathExists(at(ANTIGRAVITY_MCP_FILE))).toBe(false);
    expect((await fs.readJson(lockPath)).antigravityMcp).toBeUndefined();
  });

  it('removing the bundle removes our servers and a file it created', async () => {
    await install(true);
    await new UninstallEngine().uninstall(BUNDLE, { targetDir: agentsDir });
    expect(await fs.pathExists(at(ANTIGRAVITY_MCP_FILE))).toBe(false);
  });

  it('is shared by bundles: a server stays until the last bundle that declares it is removed', async () => {
    await install(true);
    await install(undefined, {}, 'system-architecture');
    const lock = await fs.readJson(lockPath);
    expect(lock.antigravityMcp.servers.context7.owners).toEqual(expect.arrayContaining([BUNDLE, 'system-architecture']));
    await new UninstallEngine().uninstall(BUNDLE, { targetDir: agentsDir });
    expect(Object.keys(wired())).toEqual(['context7', 'firecrawl', 'github']); // what system-architecture declares; the rest left with the first bundle
    await new UninstallEngine().uninstall('system-architecture', { targetDir: agentsDir });
    expect(await fs.pathExists(at(ANTIGRAVITY_MCP_FILE))).toBe(false);
  });

  it('leaves a file it cannot parse untouched, says so, and prints the entries to add by hand', async () => {
    const jsonc = '{ // my servers\n  "mcpServers": {}\n}\n';
    await fs.outputFile(at(ANTIGRAVITY_MCP_FILE), jsonc);
    const result = await install(true);
    expect(read(at(ANTIGRAVITY_MCP_FILE))).toBe(jsonc);
    const text = result.projections.find(p => p.path === ANTIGRAVITY_MCP_FILE)?.warnings.join('\n') ?? '';
    expect(text).toMatch(/not valid JSON/);
    expect(text).toContain('"context7"');
    expect(text).not.toContain(SECRET);
    expect((await fs.readJson(lockPath)).antigravityMcp).toBeUndefined();
  });

  it('a dry run reports the file and writes nothing', async () => {
    const dry = await install(true, { dryRun: true });
    expect(dry.projections.map(p => p.path)).toContain(ANTIGRAVITY_MCP_FILE);
    expect(await fs.pathExists(at('.agents'))).toBe(false);
  });

  describe('doctor', () => {
    const mcpWarnings = async (): Promise<string[]> => (await DoctorEngine.runDoctor(agentsDir)).warnings.filter(w => /MCP/.test(w));
    const edit = async (change: (servers: Record<string, Record<string, unknown>>) => void): Promise<void> => {
      const servers = wired();
      change(servers);
      await fs.outputFile(at(ANTIGRAVITY_MCP_FILE), JSON.stringify({ mcpServers: servers }, null, 2));
    };

    it('finds a fresh install healthy, including the servers that ship switched off', async () => {
      await install(true);
      const report = await DoctorEngine.runDoctor(agentsDir);
      expect(report.issues).toEqual([]);
      expect(await mcpWarnings()).toEqual([]);
    });

    it("does not read the user's own servers, added or reformatted, as drift", async () => {
      await install(true);
      await fs.outputFile(at(ANTIGRAVITY_MCP_FILE), JSON.stringify({ mcpServers: { ...USER, ...wired(), another: { command: 'x' } } }, null, 8));
      expect(await mcpWarnings()).toEqual([]);
    });

    it.each([
      ['a server of ours is deleted', async (): Promise<void> => edit(s => void delete s.context7), /context7.*missing|no 'context7'/i],
      ['the file is deleted', async (): Promise<void> => void (await fs.remove(at(ANTIGRAVITY_MCP_FILE))), /does not exist/],
      ['a server of ours is switched off', async (): Promise<void> => edit(s => void (s.context7.disabled = true)), /context7.*(switched off|disabled)/i],
      ['a server of ours is edited by hand', async (): Promise<void> => edit(s => void (s.context7.args = ['-y', 'other'])), /context7.*edited by hand/i],
      ['the file stops being valid JSON', async (): Promise<void> => fs.outputFile(at(ANTIGRAVITY_MCP_FILE), '{ nope'), /not valid JSON/],
    ])('warns when %s', async (_label, damage, reason) => {
      await install(true);
      await damage();
      const text = (await mcpWarnings()).join('\n');
      expect(text).toMatch(reason);
      expect(text).toMatch(/agents update software-engineering --native/);
    });

    it('does not warn about a server of ours that is switched on when it ships off', async () => {
      await install(true);
      await edit(s => void delete s.github.disabled);
      expect(await mcpWarnings()).toEqual([]);
    });

    it('is silent when the lane is off', async () => {
      await install();
      expect(await mcpWarnings()).toEqual([]);
    });
  });
});
