import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'fs-extra';
import yaml from 'yaml';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DoctorEngine } from '../src/core/doctor.js';
import { InstallEngine } from '../src/core/installer.js';
import { listNativeRoles, listNativeRules, nativeRoleSource, nativeRuleSource, renderNativeRole, renderNativeRule } from '../src/core/native-package.js';
import { HostProjector } from '../src/core/projector.js';
import { UninstallEngine } from '../src/core/uninstaller.js';

/**
 * Plan 032 Phase 8 / ADR 0031 — the native install lane for Antigravity (agents and rules; the hooks file is a later slice). Antigravity's
 * layout is the canonical store the base install already writes, so a native file can land on a path the store owns (`orchestrator-engineering.md`,
 * `git-guardrails.md`). With `--native` the store therefore skips the assets that have a native file, and the native files are installed as tracked
 * projections instead; turning the lane off prunes them and the store copies come back. Recorded per host (`nativeLanes.antigravity`), sticky.
 */

const REGISTRY = path.resolve('registry');
const BUNDLE = 'software-engineering';
const ROLES = ['backend-architect', 'code-reviewer', 'frontend-architect', 'orchestrator-engineering', 'repo-index'];
const RULES = ['clean-code-and-architecture', 'domain-modeling-and-adr', 'git-guardrails', 'multi-agent-coordination', 'quality-aesthetics-accessibility', 'test-driven-development'];
/** The canonical store file a native role replaces: specialists keep their `subagent-` prefix there, the coordinator does not. */
const storeFileOf = (role: string): string => (role === 'orchestrator-engineering' ? `${role}.md` : `subagent-${role}.md`);
const sha256 = (text: string): string => `sha256:${crypto.createHash('sha256').update(text).digest('hex')}`;
const read = (file: string): string => fs.readFileSync(file, 'utf8');

describe('native package helpers for Antigravity', () => {
  it('list the five agents and the six rules the host ships, sorted', () => {
    expect(listNativeRoles(REGISTRY, 'antigravity')).toEqual(ROLES);
    expect(listNativeRules(REGISTRY, 'antigravity')).toEqual(RULES);
  });

  it('keep a rule\'s own frontmatter first and put the marker after it, because Antigravity discards a rule that does not start with frontmatter', () => {
    const source = '---\r\ntrigger: always_on\r\ndescription: "A rule."\r\n---\r\n\r\n# Title\r\n\r\nBody.\r\n';
    const rendered = renderNativeRule(source, 'hosts/antigravity/rules/x.md', 'antigravity');
    expect(rendered.startsWith('---\n')).toBe(true);
    expect(rendered).not.toContain('\r');
    const [, front, body] = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(rendered)!;
    expect(yaml.parse(front)).toEqual({ trigger: 'always_on', description: 'A rule.' });
    expect(body.replace(/^\n/, '').split('\n')[0]).toMatch(/^<!-- managed-by: agents-united \| profile: antigravity-native \| canonical: hosts\/antigravity\/rules\/x\.md \| source: sha256:[0-9a-f]{64} \| do not edit -->$/);
    expect(HostProjector.hasManagedMarker(rendered)).toBe(true);
    expect(rendered.endsWith('# Title\n\nBody.\n')).toBe(true);
  });
});

describe('native install lane for Antigravity (agents add --native)', () => {
  const workspace = path.resolve(process.cwd(), 'scratch/test-native-antigravity-lane');
  const agentsDir = path.join(workspace, '.agents');
  const lockPath = path.join(agentsDir, 'agents-united.json');
  const at = (rel: string): string => path.join(workspace, rel);
  const install = (nativeLane?: boolean, extra: Record<string, unknown> = {}, fanout?: string[]) =>
    new InstallEngine().install(BUNDLE, { targetDir: agentsDir, method: 'copy', nativeLane, ...(fanout ? { fanout } : {}), ...extra });
  const expectedRole = (role: string): string => renderNativeRole(read(nativeRoleSource(REGISTRY, 'antigravity', role)!), `hosts/antigravity/agents/${role}.md`, 'antigravity');
  const expectedRule = (name: string): string => renderNativeRule(read(nativeRuleSource(REGISTRY, 'antigravity', name)!), `hosts/antigravity/rules/${name}.md`, 'antigravity');
  const NATIVE_PATHS = [...ROLES.map(role => `.agents/agents/${role}.md`), ...RULES.map(name => `.agents/rules/${name}.md`)];

  beforeEach(async () => {
    await fs.remove(workspace);
    await fs.ensureDir(workspace);
  });
  afterEach(async () => {
    await fs.remove(workspace);
  });

  it('is off by default: the store holds the legacy files (including the hidden prefixed agents), and nothing is recorded', async () => {
    await install();
    for (const role of ROLES) expect(await fs.pathExists(at(`.agents/agents/${storeFileOf(role)}`)), role).toBe(true);
    expect(read(at('.agents/agents/orchestrator-engineering.md'))).not.toContain('antigravity-native');
    expect(read(at('.agents/rules/git-guardrails.md')).startsWith('---')).toBe(false);
    expect(await fs.pathExists(at('.agents/agents/code-reviewer.md'))).toBe(false);
    expect((await fs.readJson(lockPath)).nativeLanes).toBeUndefined();
  });

  it('installs the native agents and rules in place of the store copies they replace', async () => {
    await install(true);
    for (const role of ROLES) expect(read(at(`.agents/agents/${role}.md`)), role).toBe(expectedRole(role));
    for (const name of RULES) expect(read(at(`.agents/rules/${name}.md`)), name).toBe(expectedRule(name));
    for (const name of RULES) expect(read(at(`.agents/rules/${name}.md`)).startsWith('---\n'), name).toBe(true);
    // The prefixed specialist copies are gone, and the coordinator's path now holds the native agent, not a second copy.
    for (const role of ROLES.filter(item => item !== 'orchestrator-engineering')) expect(await fs.pathExists(at(`.agents/agents/${storeFileOf(role)}`)), role).toBe(false);
    expect(read(at('.agents/agents/orchestrator-engineering.md'))).toBe(expectedRole('orchestrator-engineering'));
    // What has no native file stays: the host entrypoint rule and the skills.
    expect(await fs.pathExists(at('.agents/rules/GEMINI.md'))).toBe(true);
    expect(await fs.pathExists(at('.agents/skills/test-driven-development/SKILL.md'))).toBe(true);
  });

  it('records the lane per host, tracks every native file as a projection whose hash matches the disk, and leaves no stub for the skipped store assets', async () => {
    await install(true);
    const lock = await fs.readJson(lockPath);
    expect(lock.nativeLanes).toEqual({ antigravity: true });
    expect(lock.nativeLane).toBeUndefined();
    for (const rel of NATIVE_PATHS) {
      const record = lock.projections[rel];
      expect(record, rel).toBeDefined();
      expect(record.host).toBe('antigravity');
      expect(record.kind).toBe(rel.includes('/agents/') ? 'role' : 'rule');
      expect(record.owners).toContain(BUNDLE);
      expect(record.managedMarker).toBe(true);
      expect(record.hash).toBe(sha256(read(at(rel))));
    }
    for (const role of ROLES) expect(Object.keys(lock.files), `no store record for ${storeFileOf(role)}`).not.toContain(`agents/${storeFileOf(role)}`);
    for (const name of RULES) expect(Object.keys(lock.files), `no store record for ${name}`).not.toContain(`rules/${name}.md`);
    for (const record of Object.values(lock.files) as Array<{ hash: string }>) expect(record.hash, 'no empty-hash stub').not.toBe('');
  });

  it('is byte-stable and sticky: a second install, and one without the flag (what `agents update` does), keep the native files', async () => {
    await install(true);
    const first = await fs.readFile(at('.agents/agents/code-reviewer.md'));
    await install(true);
    expect((await fs.readFile(at('.agents/agents/code-reviewer.md'))).equals(first)).toBe(true);
    await install(undefined, { force: true });
    expect(read(at('.agents/agents/code-reviewer.md'))).toBe(expectedRole('code-reviewer'));
    expect(await fs.pathExists(at('.agents/agents/subagent-code-reviewer.md'))).toBe(false);
    expect((await fs.readJson(lockPath)).nativeLanes).toEqual({ antigravity: true });
  });

  it('can be turned off explicitly: the native projections go, the store copies come back, and the record is dropped', async () => {
    await install(true);
    await install(false, { force: true });
    for (const role of ROLES) expect(await fs.pathExists(at(`.agents/agents/${storeFileOf(role)}`)), role).toBe(true);
    expect(await fs.pathExists(at('.agents/agents/code-reviewer.md'))).toBe(false);
    expect(read(at('.agents/agents/orchestrator-engineering.md'))).not.toContain('antigravity-native');
    expect(read(at('.agents/rules/git-guardrails.md')).startsWith('---')).toBe(false);
    const lock = await fs.readJson(lockPath);
    expect(lock.nativeLanes).toBeUndefined();
    for (const rel of NATIVE_PATHS.filter(item => !item.endsWith('orchestrator-engineering.md') && !item.includes('/rules/'))) expect(lock.projections?.[rel], rel).toBeUndefined();
    expect(Object.keys(lock.files)).toContain('agents/subagent-code-reviewer.md');
  });

  it('is recorded per host beside Cline: one flag, both records', async () => {
    await install(true, {}, ['cline']);
    expect((await fs.readJson(lockPath)).nativeLanes).toEqual({ cline: true, antigravity: true });
    expect(read(at('.cline/agents/code-reviewer.yml'))).toContain('cline-native');
    expect(read(at('.agents/agents/code-reviewer.md'))).toContain('antigravity-native');
  });

  it('a dry run reports the native paths and writes nothing', async () => {
    const dry = await install(true, { dryRun: true });
    expect(dry.projections.map(p => p.path)).toEqual(expect.arrayContaining(NATIVE_PATHS));
    expect(await fs.pathExists(at('.agents'))).toBe(false);
  });

  it('refuses to replace a legacy store file the user has edited, and an unmanaged file at a native path, without --force', async () => {
    await install(false);
    await fs.appendFile(at('.agents/agents/orchestrator-engineering.md'), '\nMy own addition.\n');
    await expect(install(true)).rejects.toThrow(/user modifications/);
    await fs.remove(workspace);
    await fs.ensureDir(workspace);
    await fs.outputFile(at('.agents/agents/code-reviewer.md'), '---\nname: code-reviewer\ndescription: Mine.\n---\nMine.\n');
    await expect(install(true)).rejects.toThrow(/not managed by agents-united/);
    await install(true, { force: true });
    expect(read(at('.agents/agents/code-reviewer.md'))).toBe(expectedRole('code-reviewer'));
  });

  it('removing the bundle removes every native file it installed', async () => {
    await install(true);
    await new UninstallEngine().uninstall(BUNDLE, { targetDir: agentsDir });
    for (const rel of NATIVE_PATHS) expect(await fs.pathExists(at(rel)), rel).toBe(false);
  });

  describe('doctor', () => {
    it('finds a fresh native install healthy', async () => {
      await install(true);
      const report = await DoctorEngine.runDoctor(agentsDir);
      expect(report.issues).toEqual([]);
      expect(report.warnings.filter(w => /projection|drift|Outdated|Missing/i.test(w))).toEqual([]);
    });

    it('reports drift on a native file, and a native file that went missing', async () => {
      await install(true);
      await fs.appendFile(at('.agents/rules/git-guardrails.md'), '\nA local edit.\n');
      await fs.remove(at('.agents/agents/repo-index.md'));
      const text = (await DoctorEngine.runDoctor(agentsDir)).warnings.join('\n');
      expect(text).toMatch(/\.agents\/rules\/git-guardrails\.md/);
      expect(text).toMatch(/\.agents\/agents\/repo-index\.md/);
    });
  });
});
