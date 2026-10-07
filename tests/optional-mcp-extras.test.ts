import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DoctorEngine } from '../src/core/doctor.js';
import { InstallEngine } from '../src/core/installer.js';
import { PrerequisiteChecker, describeRequiredMcps, optionalMcpNames, prerequisiteStatusLabel } from '../src/core/prerequisites.js';
import { RegistryResolver } from '../src/core/registry.js';
import type { BundleDefinition, PrerequisiteItemCheck, RequiredMcp } from '../src/core/types.js';

/**
 * The narrowed list of the digital-agency (Plan 035 N1, 2026-10-07): six required MCP servers and two optional extras, MarkItDown and Stitch.
 *
 * The lead's mode already counts six (`tests/agency-operational-mode-counts.test.ts`). The bundle's prerequisites kept all eight as required, so the doctor warned
 * for every declared server that was not configured (including the two extras), and the install gate called a bundle "not fully satisfied" and chose Limited
 * Operational while the lead would have reported Fully Operational. An entry of `requiredMcps` can now say `optional: true`: it is shown, never a failure.
 */

const bundle = (name: string, requiredMcps?: RequiredMcp[]): BundleDefinition => ({ name, prerequisites: requiredMcps ? { requiredMcps } : undefined }) as unknown as BundleDefinition;

const REQUIRED = ['github', 'firecrawl', 'context7', 'playwright', 'chrome-devtools-mcp', 'figma'];
const EXTRAS = ['markitdown', 'stitch'];

describe('optionalMcpNames: which servers no installed bundle requires', () => {
  it('names the servers a bundle lists as optional extras, in lower case', () => {
    const names = optionalMcpNames([bundle('agency', [{ name: 'github' }, { name: 'MarkItDown', optional: true }, { name: 'stitch', optional: true }])]);
    expect([...names].sort()).toEqual(['markitdown', 'stitch']);
  });

  it('does not name a server that another installed bundle requires', () => {
    const names = optionalMcpNames([
      bundle('agency', [{ name: 'markitdown', optional: true }, { name: 'stitch', optional: true }]),
      bundle('research', [{ name: 'markitdown' }]),
    ]);
    expect([...names]).toEqual(['stitch']);
  });

  it('is empty for bundles with no prerequisites and for a server that no bundle lists', () => {
    expect(optionalMcpNames([bundle('software-engineering'), bundle('empty', [])]).size).toBe(0);
    expect(optionalMcpNames([]).size).toBe(0);
  });
});

describe('the labels of the install panel and the list', () => {
  const item = (patch: Partial<PrerequisiteItemCheck>): PrerequisiteItemCheck => ({ type: 'mcp', name: 'x', satisfied: false, status: 'missing', ...patch });

  it('keeps Detected, Partial and Missing as they were', () => {
    expect(prerequisiteStatusLabel(item({ satisfied: true, status: 'ok' }))).toEqual({ label: 'Detected', tone: 'ok' });
    expect(prerequisiteStatusLabel(item({ status: 'partial' }))).toEqual({ label: 'Partial', tone: 'partial' });
    expect(prerequisiteStatusLabel(item({ status: 'missing' }))).toEqual({ label: 'Missing', tone: 'missing' });
  });

  it('shows an unmet optional extra as optional, never as missing or partial, and a met one as detected', () => {
    expect(prerequisiteStatusLabel(item({ optional: true, status: 'missing' }))).toEqual({ label: 'Optional, not configured', tone: 'optional' });
    expect(prerequisiteStatusLabel(item({ optional: true, status: 'partial' }))).toEqual({ label: 'Optional, not configured', tone: 'optional' });
    expect(prerequisiteStatusLabel(item({ optional: true, satisfied: true, status: 'ok' }))).toEqual({ label: 'Detected', tone: 'ok' });
  });

  it('marks the optional servers in the list of a bundle', () => {
    expect(describeRequiredMcps([{ name: 'github' }, { name: 'markitdown', optional: true }])).toBe('github, markitdown (optional)');
    expect(describeRequiredMcps([])).toBe('');
  });
});

describe('the digital-agency bundle carries the narrowed list', () => {
  it('requires six servers and marks MarkItDown and Stitch as optional extras', async () => {
    const agency = await new RegistryResolver().getBundle('digital-agency');
    const mcps = agency?.prerequisites?.requiredMcps ?? [];
    expect(mcps.map(mcp => mcp.name).sort()).toEqual([...REQUIRED, ...EXTRAS].sort());
    for (const mcp of mcps) expect(mcp.optional === true, `${mcp.name} optional`).toBe(EXTRAS.includes(mcp.name));
    expect(agency?.description).toMatch(/6 required MCP servers and 2 optional extras/);
    expect(agency?.description).not.toMatch(/with 8 MCP servers/);
  });
});

describe('the install gate counts the required servers only', () => {
  let workspace: string;
  let home: string;
  const saved: Record<string, string | undefined> = {};
  const KEYS = ['USERPROFILE', 'HOME', 'APPDATA'] as const;

  beforeEach(async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'au-optional-mcp-'));
    workspace = path.join(root, 'ws');
    home = path.join(root, 'home');
    await fs.ensureDir(workspace);
    await fs.ensureDir(home);
    for (const key of KEYS) saved[key] = process.env[key];
    process.env.USERPROFILE = home;
    process.env.HOME = home;
    process.env.APPDATA = path.join(root, 'appdata');
  });

  afterEach(async () => {
    for (const key of KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
    await fs.remove(path.dirname(workspace));
  });

  const configure = async (names: string[]): Promise<void> => {
    await fs.writeJson(path.join(workspace, '.mcp.json'), { mcpServers: Object.fromEntries(names.map(name => [name, { command: 'npx', args: ['-y', name] }])) });
  };
  const evaluate = (def: BundleDefinition) => new PrerequisiteChecker().evaluate(def, { cwd: workspace, targetHosts: ['claude'] });

  it('is satisfied when the required server is configured and the optional extra is not, and keeps the extra visible', async () => {
    await configure(['alpha-mcp']);
    const result = await evaluate(bundle('demo', [{ name: 'alpha-mcp' }, { name: 'beta-extra', optional: true }]));
    expect(result.allSatisfied).toBe(true);
    expect(result.operationalPossible).toBe(true);
    const extra = result.items.find(entry => entry.name === 'beta-extra');
    expect(extra).toMatchObject({ satisfied: false, status: 'missing', optional: true });
  });

  it('is not satisfied while a required server is missing, whatever the extras do', async () => {
    await configure(['beta-extra']);
    const result = await evaluate(bundle('demo', [{ name: 'alpha-mcp' }, { name: 'beta-extra', optional: true }]));
    expect(result.allSatisfied).toBe(false);
  });
});

describe('the doctor warns for the required servers only', () => {
  let root: string;
  let workspace: string;
  let agentsDir: string;
  const originalCwd = process.cwd();
  const KEYS = ['USERPROFILE', 'HOME', 'APPDATA', 'CLAUDE_BIN_PATH', 'CLINE_BIN_PATH'] as const;
  const saved: Record<string, string | undefined> = {};

  const warnsAbout = (text: string, server: string): boolean =>
    text.split('\n').some(line => line.includes(`MCP server "${server}" is declared by the installed roles but not configured`));
  const textOf = (report: { warnings?: string[]; issues?: string[] }): string => [...(report.warnings ?? []), ...(report.issues ?? [])].join('\n');

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'au-doctor-optional-'));
    workspace = path.join(root, 'ws');
    agentsDir = path.join(workspace, '.agents');
    await fs.ensureDir(workspace);
    await fs.ensureDir(path.join(root, 'home'));
    await new InstallEngine().install('digital-agency', { targetDir: agentsDir, method: 'copy' });
    for (const key of KEYS) saved[key] = process.env[key];
    // The MCP location registry reads the home folder: point it at an empty one, so the fixture decides what is configured.
    process.env.USERPROFILE = path.join(root, 'home');
    process.env.HOME = path.join(root, 'home');
    process.env.APPDATA = path.join(root, 'appdata');
    delete process.env.CLAUDE_BIN_PATH;
    delete process.env.CLINE_BIN_PATH;
    process.chdir(workspace);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    for (const key of KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
    await fs.remove(root);
  });

  it('warns for each of the six required servers that is not configured, and for neither optional extra', async () => {
    const text = textOf(await DoctorEngine.runDoctor(agentsDir, 'claude'));
    for (const server of REQUIRED) expect(warnsAbout(text, server), `${server} should be warned about:\n${text}`).toBe(true);
    for (const server of EXTRAS) expect(warnsAbout(text, server), `${server} is an optional extra:\n${text}`).toBe(false);
  });

  it('has no MCP warning at all when the six required servers are configured and the extras are not', async () => {
    await fs.writeJson(path.join(workspace, '.mcp.json'), { mcpServers: Object.fromEntries(REQUIRED.map(name => [name, { command: 'npx', args: ['-y', name] }])) });
    const text = textOf(await DoctorEngine.runDoctor(agentsDir, 'claude'));
    expect(text).not.toContain('is declared by the installed roles but not configured');
  });
});

describe('the documents say how the extras are treated', () => {
  const read = (relative: string): string => fs.readFileSync(path.resolve(relative), 'utf8').replace(/\r\n/g, '\n');

  it('README: the doctor bullet and the authoring bullet name `optional: true`', () => {
    const readme = read('README.md');
    const doctor = readme.split('\n').find(line => line.startsWith('- **`agents doctor --host <host>`**')) ?? '';
    expect(doctor).not.toBe('');
    expect(doctor).toContain('`optional: true`');
    const authoring = readme.split('\n').find(line => line.startsWith('- Add `prerequisites`')) ?? '';
    expect(authoring).not.toBe('');
    expect(authoring).toContain('`optional: true`');
  });

  it('CONTEXT.md: the suite term says that the doctor and the install gate leave the extras out', () => {
    const context = read('CONTEXT.md');
    const term = context.slice(context.indexOf('**Canonical Agency MCP Suite**:'), context.indexOf('**Multimodal Asset Inlining'));
    expect(term).toContain('`optional: true`');
    expect(term).toMatch(/the doctor and the install gate leave them out/);
  });
});
