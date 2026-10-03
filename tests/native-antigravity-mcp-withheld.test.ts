import fs from 'fs-extra';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ANTIGRAVITY_MCP_FILE, inspectAntigravityMcp, loadMcpCatalog, mcpEntryHash, syncAntigravityMcp, type McpEntry } from '../src/core/antigravity-mcp.js';
import { DoctorEngine } from '../src/core/doctor.js';
import { InstallEngine } from '../src/core/installer.js';
import { UninstallEngine } from '../src/core/uninstaller.js';

/**
 * Plan 032 Phase 8 — decision 3 of the 2026-10-03 probes. A server marked `disabled: true` in the workspace file still started in a real
 * session, so the lane no longer depends on the switch: a server that needs a credential (`github`, `firecrawl`, `stitch`, `figma`) is not
 * written at all. The install prints the entry and the variable for the user to add once they hold the credential. Entries of ours that an
 * older release wrote are removed on the next install or `agents update`, unless the user switched one on or edited it.
 */

const REGISTRY = path.resolve('registry');
const BUNDLE = 'software-engineering';
const catalog = loadMcpCatalog(REGISTRY);
const read = (file: string): string => fs.readFileSync(file, 'utf8');
const CREDENTIALED = ['figma', 'firecrawl', 'github', 'stitch'];
const FREE = ['chrome-devtools-mcp', 'context7'];

describe('the catalog marks what needs a credential and never ships a switch', () => {
  it('lists the credentialed servers by their requiresEnv, and their entries carry no disabled switch', () => {
    expect(Object.keys(catalog).filter(name => catalog[name].requiresEnv.length > 0).sort()).toEqual(CREDENTIALED);
    for (const name of Object.keys(catalog)) expect(catalog[name].entry, name).not.toHaveProperty('disabled');
  });
});

describe('MCP wiring does not write credentialed servers (agents add --native)', () => {
  const workspace = path.resolve(process.cwd(), 'scratch/test-native-antigravity-mcp-withheld');
  const agentsDir = path.join(workspace, '.agents');
  const lockPath = path.join(agentsDir, 'agents-united.json');
  const file = path.join(workspace, ANTIGRAVITY_MCP_FILE);
  const install = (nativeLane?: boolean, extra: Record<string, unknown> = {}, bundle = BUNDLE) =>
    new InstallEngine().install(bundle, { targetDir: agentsDir, method: 'copy', nativeLane, ...extra });
  const wired = (): Record<string, Record<string, unknown>> => (JSON.parse(read(file)) as { mcpServers: Record<string, Record<string, unknown>> }).mcpServers;
  const notes = (result: Awaited<ReturnType<typeof install>>): string => result.projections.find(p => p.path === ANTIGRAVITY_MCP_FILE)?.warnings.join('\n') ?? '';
  const SECRET = 'ghp_SECRET_VALUE_THAT_MUST_NEVER_BE_WRITTEN';
  const saved: Record<string, string | undefined> = {};
  /** What an older release left: the credentialed entry written switched off, recorded in the lockfile. */
  const plantLegacy = async (name: string, state: 'off' | 'on' | 'edited'): Promise<void> => {
    const entry: McpEntry = { ...catalog[name].entry, ...(state === 'on' ? {} : { disabled: true }), ...(state === 'edited' ? { args: ['-y', 'my-own-fork'] } : {}) };
    const servers = { ...wired(), [name]: entry };
    await fs.outputFile(file, JSON.stringify({ mcpServers: servers }, null, 2));
    const lock = await fs.readJson(lockPath);
    lock.antigravityMcp.servers[name] = { entryHash: mcpEntryHash({ ...catalog[name].entry, disabled: true }), owners: [BUNDLE] };
    await fs.writeJson(lockPath, lock, { spaces: 2 });
  };

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

  it('writes only the servers that need nothing, with no disabled switch anywhere, and records only those', async () => {
    await install(true);
    expect(Object.keys(wired()).sort()).toEqual(FREE);
    expect(read(file)).not.toContain('disabled');
    expect(read(file)).not.toContain(SECRET);
    expect(Object.keys((await fs.readJson(lockPath)).antigravityMcp.servers).sort()).toEqual(FREE);
  });

  it('prints, for each credentialed server the bundle declares, the variable it needs and the entry to add, never a value', async () => {
    const text = notes(await install(true));
    for (const name of ['firecrawl', 'github', 'stitch']) expect(text, name).toContain(`"${name}"`);
    expect(text).toContain('GITHUB_PERSONAL_ACCESS_TOKEN');
    expect(text).toContain('FIRECRAWL_API_KEY');
    expect(text).toContain('STITCH_API_KEY');
    expect(text).toContain('@modelcontextprotocol/server-github');
    expect(text).toMatch(/environment agy starts from/);
    expect(text).toMatch(/not written/i);
    expect(text).not.toMatch(/agy mcp enable/);
    expect(text).not.toContain(SECRET);
    expect(text).not.toContain('figma'); // the bundle does not declare it
    expect(text).not.toContain('context7');
  });

  it('never claims or touches a server of the same name the user has', async () => {
    const own = { github: { serverUrl: 'https://api.githubcopilot.com/mcp/' } };
    await fs.outputFile(file, `${JSON.stringify({ mcpServers: own }, null, 2)}\n`);
    await install(true);
    expect(wired().github).toEqual(own.github);
    expect((await fs.readJson(lockPath)).antigravityMcp.servers.github).toBeUndefined();
    await install(undefined, { force: true });
    expect(wired().github).toEqual(own.github);
    await new UninstallEngine().uninstall(BUNDLE, { targetDir: agentsDir });
    expect(wired().github).toEqual(own.github);
  });

  it('is byte-stable and keeps the switch the user flips on a server we do write', async () => {
    await install(true);
    const first = read(file);
    await install(true);
    expect(read(file)).toBe(first);
    const config = JSON.parse(first) as { mcpServers: Record<string, Record<string, unknown>> };
    config.mcpServers.context7.disabled = true; // what `agy mcp disable context7` amounts to
    await fs.outputFile(file, JSON.stringify(config, null, 2));
    const switched = read(file);
    await install(undefined, { force: true });
    expect(read(file)).toBe(switched);
  });

  it('a dry run lists the file and writes nothing', async () => {
    const dry = await install(true, { dryRun: true });
    expect(dry.projections.map(p => p.path)).toContain(ANTIGRAVITY_MCP_FILE);
    expect(await fs.pathExists(path.join(workspace, '.agents'))).toBe(false);
  });

  describe('migration of what an older release wrote', () => {
    it('removes an untouched switched-off entry of ours on the next install, and its record', async () => {
      await install(true);
      for (const name of CREDENTIALED) await plantLegacy(name, 'off');
      const result = await install(undefined, { force: true }); // what `agents update` does
      expect(Object.keys(wired()).sort()).toEqual(FREE);
      expect(Object.keys((await fs.readJson(lockPath)).antigravityMcp.servers).sort()).toEqual(FREE);
      expect(notes(result)).toContain('"github"');
    });

    it('keeps a credentialed server the user switched on, untracked, and says it is theirs now', async () => {
      await install(true);
      await plantLegacy('github', 'on');
      const result = await install(undefined, { force: true });
      expect(wired().github.command).toBe('npx');
      expect(wired().github).not.toHaveProperty('disabled');
      expect((await fs.readJson(lockPath)).antigravityMcp.servers.github).toBeUndefined();
      expect(notes(result)).toMatch(/github[^\n]*(switched on|enabled)[^\n]*(yours|left)/i);
      await new UninstallEngine().uninstall(BUNDLE, { targetDir: agentsDir });
      expect(wired().github.command).toBe('npx');
    });

    it('keeps an entry the user edited, and says so', async () => {
      await install(true);
      await plantLegacy('github', 'edited');
      const result = await install(undefined, { force: true });
      expect(wired().github.args).toEqual(['-y', 'my-own-fork']);
      expect(notes(result)).toMatch(/github[^\n]*edited/i);
    });

    it('the doctor calls a recorded credentialed entry an older release, names the command, and is quiet after the update', async () => {
      await install(true);
      await plantLegacy('github', 'off');
      const warnings = (await DoctorEngine.runDoctor(agentsDir)).warnings.filter(w => /MCP/.test(w));
      expect(warnings.join('\n')).toMatch(/github.*older release/i);
      expect(warnings.join('\n')).toMatch(/agents update software-engineering --native/);
      await install(undefined, { force: true });
      expect((await DoctorEngine.runDoctor(agentsDir)).warnings.filter(w => /MCP/.test(w))).toEqual([]);
    });
  });

  it('a fresh install is healthy for the doctor', async () => {
    await install(true);
    const report = await DoctorEngine.runDoctor(agentsDir);
    expect(report.issues).toEqual([]);
    expect(report.warnings.filter(w => /MCP/.test(w))).toEqual([]);
  });
});

describe('syncAntigravityMcp and inspectAntigravityMcp with withheld servers', () => {
  const dir = path.resolve(process.cwd(), 'scratch/test-antigravity-mcp-withheld-unit');
  const target = path.join(dir, 'mcp_config.json');
  const OFF: McpEntry = { command: 'npx', args: ['-y', 'cred-mcp'] };
  const record = { file: ANTIGRAVITY_MCP_FILE, createdFile: false, createdKey: false, servers: { cred: { entryHash: mcpEntryHash(OFF), owners: ['b1'] } } };
  beforeEach(async () => {
    await fs.remove(dir);
    await fs.ensureDir(dir);
  });
  afterEach(async () => {
    await fs.remove(dir);
  });

  it('leaves a withheld server the user switched on, untracked, with its own outcome', async () => {
    await fs.outputFile(target, JSON.stringify({ mcpServers: { cred: OFF } }));
    const result = await syncAntigravityMcp(target, { desired: {}, bundle: 'b1', record, withheld: ['cred'] });
    expect(result.servers.cred).toBe('left-enabled');
    expect(result.record).toBeUndefined();
    expect(JSON.parse(read(target)).mcpServers.cred).toEqual(OFF);
  });

  it('removes a withheld server that is still switched off and unedited', async () => {
    await fs.outputFile(target, JSON.stringify({ mcpServers: { cred: { ...OFF, disabled: true }, mine: { command: 'x' } } }));
    const result = await syncAntigravityMcp(target, { desired: {}, bundle: 'b1', record, withheld: ['cred'] });
    expect(result.servers.cred).toBe('removed');
    expect(Object.keys(JSON.parse(read(target)).mcpServers)).toEqual(['mine']);
  });

  it('inspect reports a recorded server that the catalog now withholds as withdrawn', async () => {
    await fs.outputFile(target, JSON.stringify({ mcpServers: { cred: { ...OFF, disabled: true } } }));
    const view = await inspectAntigravityMcp(target, record, { cred: { entry: OFF, requiresEnv: ['X'], optionalEnv: [] } });
    expect(view.servers.cred).toBe('withdrawn');
  });
});

describe('the decision is recorded where the next author looks', () => {
  const doc = (rel: string): string => read(path.resolve(rel));

  it('ADR 0032 carries the addendum', () => {
    const adr = doc('docs/adr/0032-antigravity-mcp-wiring.md');
    expect(adr).toMatch(/Addendum 2 \(2026-10-03[^\n]*credentialed/i);
    expect(adr).toMatch(/supersedes decision 2|amends decision 2/i);
    expect(adr).toMatch(/agents update/);
  });

  it('the profile and the servers catalog no longer promise a switch', () => {
    const profile = JSON.parse(doc('registry/hosts/antigravity/profile.json')) as { features: Record<string, { status: string; note: string }> };
    expect(profile.features.mcpWiring.note).toMatch(/not written|withh/i);
    expect(profile.features.mcpWiring.note).toMatch(/ADR 0032/);
    expect(doc('registry/hosts/antigravity/mcp/servers.json')).not.toMatch(/agy mcp enable/);
  });
});
