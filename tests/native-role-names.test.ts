import path from 'node:path';
import fs from 'fs-extra';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DoctorEngine } from '../src/core/doctor.js';
import { InstallEngine } from '../src/core/installer.js';
import { RegistryResolver } from '../src/core/registry.js';
import { UninstallEngine } from '../src/core/uninstaller.js';
import type { BundleDefinition, BundlesManifest } from '../src/core/types.js';

/**
 * Plan 032 close-out follow-up (2), slice 2 — a bundle-scoped native role name. The Tier-2 `digital-agency` bundle carries roles it
 * shares with Tier-1 bundles (`marketing-growth-strategist`, `seo-specialist`, `frontend-architect` and more). Maintainer decision: the agency
 * gets its OWN native copies (`agency-*`) so Tier-1 bundles stay as they are: the three marketing pilots in slice 2, the other six in ADR 0039
 * (the maintainer chose an agency-only copy for the frontend architect too, so the persona lives in the copy). `nativeRoles` in `registry/bundles.json` maps a bundle's canonical agent
 * file to the native role it installs instead; with the lane off, or for any other bundle, nothing changes.
 */

const REGISTRY = path.resolve('registry');
const manifest = JSON.parse(fs.readFileSync(path.join(REGISTRY, 'bundles.json'), 'utf8')) as BundlesManifest;
const AGENCY = manifest.bundles['digital-agency'] as BundleDefinition & { nativeRoles?: Record<string, string> };

const EXPECTED: Record<string, string> = {
  'subagent-marketing-growth-strategist.md': 'agency-growth-strategist',
  'subagent-marketing-creative-designer.md': 'agency-creative-designer',
  'subagent-marketing-conversion-specialist.md': 'agency-conversion-specialist',
  'subagent-marketing-content-strategist.md': 'agency-content-strategist',
  'subagent-marketing-campaign-specialist.md': 'agency-campaign-specialist',
  'subagent-seo-specialist.md': 'agency-seo-specialist',
  'subagent-qa-automation-lead.md': 'agency-qa-automation-lead',
  'subagent-compliance-grc-specialist.md': 'agency-compliance-grc-specialist',
  'subagent-frontend-architect.md': 'agency-frontend-architect',
};
const LEGACY_NAMES = [
  'marketing-growth-strategist', 'marketing-creative-designer', 'marketing-conversion-specialist', 'marketing-content-strategist',
  'marketing-campaign-specialist', 'seo-specialist', 'qa-automation-lead', 'compliance-grc-specialist',
];

describe('the registry entry', () => {
  it('maps every agent of the bundle but the lead to an agency-only native name, each with a committed native agent', () => {
    expect(AGENCY.nativeRoles).toEqual(EXPECTED);
    expect(Object.keys(AGENCY.nativeRoles ?? {}).sort(), 'no agent of the bundle is left on a legacy projection').toEqual((AGENCY.agents ?? []).slice().sort());
    for (const [file, name] of Object.entries(AGENCY.nativeRoles ?? {})) {
      expect(AGENCY.agents, `${file} is one of the bundle's agents`).toContain(file);
      expect(fs.existsSync(path.join(REGISTRY, 'hosts/claude/agents', `${name}.md`)), `${name} has a native Claude agent`).toBe(true);
    }
  });

  it('no other bundle declares nativeRoles, so Tier-1 marketing keeps the legacy roles', () => {
    const others = Object.entries(manifest.bundles).filter(([name, bundle]) => name !== 'digital-agency' && (bundle as { nativeRoles?: unknown }).nativeRoles !== undefined);
    expect(others.map(([name]) => name)).toEqual([]);
  });
});

describe('registry validation of nativeRoles', () => {
  const resolver = new RegistryResolver(REGISTRY) as unknown as { validateBundles(m: BundlesManifest): void };
  const withRoles = (nativeRoles: unknown, agents = ['subagent-alpha.md', 'subagent-beta.md']): BundlesManifest => ({
    ...manifest,
    bundles: { probe: { name: 'probe', agents, skills: [], nativeRoles } as unknown as BundleDefinition },
  });

  it('accepts a well-formed map', () => {
    expect(() => resolver.validateBundles(withRoles({ 'subagent-alpha.md': 'team-alpha' }))).not.toThrow();
  });

  it.each([
    ['a key that is not one of the bundle\'s agents', { 'subagent-gamma.md': 'team-gamma' }, /not one of its agents/],
    ['a name that is not a role name', { 'subagent-alpha.md': 'Team Alpha' }, /not a valid role name/],
    ['two files mapped to one name', { 'subagent-alpha.md': 'team-x', 'subagent-beta.md': 'team-x' }, /more than one/],
    ['a name that is another agent\'s default role name', { 'subagent-alpha.md': 'beta' }, /collides/],
    ['a map that is not an object', ['team-alpha'], /must be an object/],
  ])('rejects %s', (_label, nativeRoles, message) => {
    expect(() => resolver.validateBundles(withRoles(nativeRoles))).toThrow(message);
  });
});

describe('the native install of digital-agency (Claude only, project scope)', () => {
  const workspace = path.resolve(process.cwd(), 'scratch/test-native-role-names');
  const sidecar = path.join(workspace, '.claude', '.agents-united');
  const lockPath = path.join(sidecar, 'agents-united.json');
  const agentFile = (name: string): string => path.join(workspace, '.claude/agents', `${name}.md`);
  const exists = (name: string): Promise<boolean> => fs.pathExists(agentFile(name));
  const install = (bundle: string, nativeLane?: boolean, extra: Record<string, unknown> = {}) =>
    new InstallEngine().install(bundle, { targetDir: sidecar, method: 'copy', fanout: ['claude'], nativeLane, ...extra } as never);

  beforeEach(async () => {
    await fs.remove(workspace);
    await fs.ensureDir(workspace);
  });
  afterEach(async () => {
    await fs.remove(workspace);
  });

  it('installs the agency-only native roles and the lead, and no legacy copy of any shared role', async () => {
    await install('digital-agency', true);
    for (const name of [...Object.values(EXPECTED), 'orchestrator-digital-agency']) expect(await exists(name), name).toBe(true);
    expect(await exists('frontend-architect'), 'the shared frontend architect stays out: the agency has its own copy').toBe(false);
    for (const name of LEGACY_NAMES) expect(await exists(name), `${name} stays out`).toBe(false);
    for (const name of Object.values(EXPECTED)) expect(fs.readFileSync(agentFile(name), 'utf8'), name).toContain('profile: claude-native');
  });

  it('leaves no legacy projection beside the native roles: every role of the bundle is native', async () => {
    await install('digital-agency', true);
    const installed = fs.readdirSync(path.join(workspace, '.claude/agents')).filter(file => file.endsWith('.md')).sort();
    expect(installed).toEqual([...Object.values(EXPECTED), 'orchestrator-digital-agency'].map(name => `${name}.md`).sort());
    for (const file of installed) expect(fs.readFileSync(path.join(workspace, '.claude/agents', file), 'utf8'), file).toContain('profile: claude-native');
  });

  it('records the native file as owned by the bundle alone, with no canonical pointer; the file\'s own marker names the canonical agent', async () => {
    await install('digital-agency', true);
    const lock = await fs.readJson(lockPath);
    for (const [file, name] of Object.entries(EXPECTED)) {
      const record = lock.projections[`.claude/agents/${name}.md`];
      expect(record, name).toMatchObject({ host: 'claude', kind: 'role', managedMarker: true });
      expect(record.owners, `${name} is owned by the agency alone`).toEqual(['digital-agency']);
      expect(record.canonical, `${name} records no canonical, so Tier-1 marketing's pointers are not touched`).toBeUndefined();
      expect(fs.readFileSync(agentFile(name), 'utf8')).toContain(`canonical: agents/${file}`);
      expect(lock.projections[`.claude/agents/${file.replace(/^subagent-/, '').replace(/\.md$/, '')}.md`], `no record for the legacy name of ${name}`).toBeUndefined();
    }
  });

  it('leaves the Tier-1 marketing bundle on its legacy roles, whatever the lane says', async () => {
    await install('marketing', true);
    expect(await exists('marketing-growth-strategist')).toBe(true);
    expect(fs.readFileSync(agentFile('marketing-growth-strategist'), 'utf8')).not.toContain('claude-native');
    for (const name of Object.values(EXPECTED)) expect(await exists(name), name).toBe(false);
  });

  it('turning the lane off brings the legacy names back and removes the agency-only files', async () => {
    await install('digital-agency', true);
    for (const name of Object.values(EXPECTED)) expect(await exists(name), `${name} was installed`).toBe(true);
    await install('digital-agency', false, { force: true });
    for (const name of Object.values(EXPECTED)) expect(await exists(name), `${name} is gone`).toBe(false);
    for (const name of LEGACY_NAMES) expect(await exists(name), `${name} is back`).toBe(true);
  });

  it('lets the agency live beside the Tier-1 frontend role of software-engineering, each with its own file', async () => {
    await install('software-engineering', true);
    await install('digital-agency', true);
    for (const name of ['frontend-architect', 'agency-frontend-architect']) expect(await exists(name), name).toBe(true);
    const lock = await fs.readJson(lockPath);
    expect(lock.projections['.claude/agents/agency-frontend-architect.md'].owners).toEqual(['digital-agency']);
    expect(lock.projections['.claude/agents/frontend-architect.md'].owners).not.toContain('digital-agency');
    await new UninstallEngine().uninstall('digital-agency', { targetDir: sidecar });
    expect(await exists('agency-frontend-architect')).toBe(false);
    expect(await exists('frontend-architect')).toBe(true);
  });

  it('lets both bundles live side by side, and removing the agency removes only its own files', async () => {
    await install('marketing', true);
    await install('digital-agency', true);
    for (const name of [...Object.values(EXPECTED), 'marketing-growth-strategist']) expect(await exists(name), name).toBe(true);
    // Side by side the doctor finds nothing wrong: the agency's copies do not move Tier-1 marketing's pointers.
    const both = await DoctorEngine.runDoctor(sidecar, 'claude');
    expect(both.issues).toEqual([]);
    expect(both.warnings.filter(warning => /Content drift|Stale|Missing|Outdated|superseded/.test(warning))).toEqual([]);
    await new UninstallEngine().uninstall('digital-agency', { targetDir: sidecar });
    for (const name of Object.values(EXPECTED)) expect(await exists(name), `${name} is removed`).toBe(false);
    expect(await exists('marketing-growth-strategist')).toBe(true);
    const after = await DoctorEngine.runDoctor(sidecar, 'claude');
    expect(after.warnings.filter(warning => /Content drift|Stale|Missing|Outdated|superseded/.test(warning))).toEqual([]);
  });

  it('is byte-stable on a second install and healthy under the doctor', async () => {
    await install('digital-agency', true);
    const before = new Map(Object.values(EXPECTED).map(name => [name, fs.readFileSync(agentFile(name), 'utf8')] as const));
    await install('digital-agency', true);
    for (const [name, text] of before) expect(fs.readFileSync(agentFile(name), 'utf8'), name).toBe(text);
    const report = await DoctorEngine.runDoctor(sidecar, 'claude');
    expect(report.issues).toEqual([]);
    expect(report.warnings.filter(warning => /Content drift|Stale|Missing projection|Native agent/.test(warning))).toEqual([]);
  });
});
