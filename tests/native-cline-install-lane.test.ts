import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'fs-extra';
import yaml from 'yaml';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DoctorEngine } from '../src/core/doctor.js';
import { InstallEngine } from '../src/core/installer.js';
import {
  listNativePlugins,
  listNativeRoles,
  listNativeRules,
  listNativeSkills,
  listNativeWorkflows,
  nativePluginSource,
  nativeRoleSource,
  nativeRuleSource,
  nativeSkillSource,
  nativeWorkflowSource,
  renderNativePlugin,
  renderNativeRole,
  renderNativeRule,
  renderNativeSkill,
  renderNativeWorkflow,
} from '../src/core/native-package.js';
import { HostProjector } from '../src/core/projector.js';
import { UninstallEngine } from '../src/core/uninstaller.js';

/**
 * Plan 032 Phase 8 / ADR 0026 decision 6 — the native install lane for Cline. One `--native` flag, recorded per host: for Cline it
 * installs the four configured agents (`.cline/agents/<role>.yml`), the orchestrator's rule and skill in place of the orchestrator agent
 * (ADR 0028 decision 6), the three native workflows in place of the same-named workflow projections, and the guard plugin
 * (`.cline/plugins/`, CLI-only). Anything without a native file keeps its legacy projection. The doctor warns when the guard is missing
 * or when `.agents/skills` shadows a native skill (observed: `.agents/skills` wins over `.cline/skills`, observations 3.0.68).
 */

const REGISTRY = path.resolve('registry');
const BUNDLE = 'software-engineering';
const ROLES = ['backend-architect', 'code-reviewer', 'frontend-architect', 'repo-index'];
const WORKFLOWS = ['workflow-implement', 'workflow-review', 'workflow-test'];
const RULE = 'agents-united-orchestrator-engineering';
const SKILL = 'orchestrator-engineering';
const GUARD = 'agents-united-guard';
const sha256 = (text: string): string => `sha256:${crypto.createHash('sha256').update(text).digest('hex')}`;
const lf = (text: string): string => text.replace(/\r\n/g, '\n');
const read = (file: string): string => fs.readFileSync(file, 'utf8');

describe('native package helpers for Cline', () => {
  it('list what the host ships, sorted, per kind', () => {
    expect(listNativeRoles(REGISTRY, 'cline')).toEqual(ROLES);
    expect(listNativeWorkflows(REGISTRY, 'cline')).toEqual(WORKFLOWS);
    expect(listNativeRules(REGISTRY, 'cline')).toEqual([RULE]);
    expect(listNativeSkills(REGISTRY, 'cline')).toEqual([SKILL]);
    expect(listNativePlugins(REGISTRY, 'cline')).toEqual([GUARD]);
    expect(listNativeRules(REGISTRY, 'claude')).toEqual([]);
    expect(listNativePlugins(REGISTRY, 'no-such-host')).toEqual([]);
  });

  it('find a source by name, and nothing for a name that is not shipped or tries to escape', () => {
    expect(nativeRoleSource(REGISTRY, 'cline', 'code-reviewer')).toBe(path.join(REGISTRY, 'hosts', 'cline', 'agents', 'code-reviewer.yml'));
    expect(nativeWorkflowSource(REGISTRY, 'cline', 'workflow-review')).toBe(path.join(REGISTRY, 'hosts', 'cline', 'workflows', 'workflow-review.md'));
    expect(nativeRuleSource(REGISTRY, 'cline', RULE)).toBe(path.join(REGISTRY, 'hosts', 'cline', 'rules', `${RULE}.md`));
    expect(nativeSkillSource(REGISTRY, 'cline', SKILL)).toBe(path.join(REGISTRY, 'hosts', 'cline', 'skills', SKILL, 'SKILL.md'));
    expect(nativePluginSource(REGISTRY, 'cline', GUARD)).toBe(path.join(REGISTRY, 'hosts', 'cline', 'plugins', `${GUARD}.js`));
    expect(nativeRoleSource(REGISTRY, 'cline', 'devops-engineer')).toBeUndefined();
    expect(nativeRoleSource(REGISTRY, 'cline', '../profile')).toBeUndefined();
    expect(nativeSkillSource(REGISTRY, 'cline', '../agents')).toBeUndefined();
  });

  const framed = '---\r\nname: demo\r\ndescription: A demo.\r\n---\r\n\r\n# demo\r\n\r\nBody.\r\n';

  it.each([
    ['role', (text: string) => renderNativeRole(text, 'agents/subagent-demo.md', 'cline')],
    ['workflow', (text: string) => renderNativeWorkflow(text, 'skills/demo/SKILL.md', 'cline')],
    ['skill', (text: string) => renderNativeSkill(text, 'hosts/cline/skills/demo/SKILL.md', 'cline')],
  ])('stamps a %s with a cline-native marker as the first body line, keeping the frontmatter and normalising line endings', (_kind, render) => {
    const rendered = render(framed);
    expect(HostProjector.hasManagedMarker(rendered)).toBe(true);
    expect(rendered).not.toContain('\r');
    const [, front, body] = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(rendered)!;
    expect(yaml.parse(front)).toEqual({ name: 'demo', description: 'A demo.' });
    expect(body.replace(/^\n/, '').split('\n')[0]).toMatch(/^<!-- managed-by: agents-united \| profile: cline-native \| canonical: \S+ \| source: sha256:[0-9a-f]{64} \| do not edit -->$/);
    expect(rendered).toContain(sha256(lf(framed)));
    expect(rendered.endsWith('# demo\n\nBody.\n')).toBe(true);
  });

  it('stamps a rule (no frontmatter) with the marker above its title, and a plugin with a comment as its last line', () => {
    const rule = renderNativeRule('# Title\r\n\r\nBody.\r\n', 'hosts/cline/rules/x.md', 'cline');
    expect(HostProjector.hasManagedMarker(rule)).toBe(true);
    expect(rule.startsWith('<!-- managed-by: agents-united | profile: cline-native | canonical: hosts/cline/rules/x.md | source: sha256:')).toBe(true);
    expect(rule.endsWith('# Title\n\nBody.\n')).toBe(true);

    const plugin = renderNativePlugin('export default { name: "x" };\r\n', 'hosts/cline/plugins/x.js', 'cline');
    expect(plugin.startsWith('export default { name: "x" };\n')).toBe(true);
    expect(plugin.trimEnd().split('\n').pop()).toMatch(/^\/\/ managed-by: agents-united \| profile: cline-native \| canonical: hosts\/cline\/plugins\/x\.js \| source: sha256:[0-9a-f]{64} \| do not edit$/);
    expect(HostProjector.hasManagedMarker(plugin)).toBe(true);
  });

  it('is deterministic, and refuses a framed kind without frontmatter', () => {
    expect(renderNativeRole(framed, 'agents/subagent-demo.md', 'cline')).toBe(renderNativeRole(lf(framed), 'agents/subagent-demo.md', 'cline'));
    expect(() => renderNativeRole('# no frontmatter\n', 'agents/x.md', 'cline')).toThrow(/frontmatter/);
    expect(() => renderNativeSkill('# no frontmatter\n', 'x', 'cline')).toThrow(/frontmatter/);
  });
});

describe('native install lane for Cline (agents add --fanout cline --native)', () => {
  const workspace = path.resolve(process.cwd(), 'scratch/test-native-cline-lane');
  const agentsDir = path.join(workspace, '.agents');
  const lockPath = path.join(agentsDir, 'agents-united.json');
  const at = (rel: string): string => path.join(workspace, rel);
  const install = (nativeLane?: boolean, extra: Record<string, unknown> = {}, fanout: string[] = ['cline']) =>
    new InstallEngine().install(BUNDLE, { targetDir: agentsDir, method: 'copy', fanout, nativeLane, ...extra });

  const expectedRole = (role: string): string => renderNativeRole(read(nativeRoleSource(REGISTRY, 'cline', role)!), `agents/subagent-${role}.md`, 'cline');
  const expectedWorkflow = (name: string): string => renderNativeWorkflow(read(nativeWorkflowSource(REGISTRY, 'cline', name)!), `skills/${name}/SKILL.md`, 'cline');
  const expectedRule = (): string => renderNativeRule(read(nativeRuleSource(REGISTRY, 'cline', RULE)!), `hosts/cline/rules/${RULE}.md`, 'cline');
  const expectedSkill = (): string => renderNativeSkill(read(nativeSkillSource(REGISTRY, 'cline', SKILL)!), `hosts/cline/skills/${SKILL}/SKILL.md`, 'cline');
  const expectedPlugin = (): string => renderNativePlugin(read(nativePluginSource(REGISTRY, 'cline', GUARD)!), `hosts/cline/plugins/${GUARD}.js`, 'cline');
  const NATIVE_ONLY = [`.cline/rules/${RULE}.md`, `.cline/skills/${SKILL}/SKILL.md`, `.cline/plugins/${GUARD}.js`];

  beforeEach(async () => {
    await fs.remove(workspace);
    await fs.ensureDir(workspace);
  });
  afterEach(async () => {
    await fs.remove(workspace);
  });

  it('is off by default: legacy projections, the orchestrator as an agent, no native-only file, nothing recorded', async () => {
    await install();
    for (const role of ROLES) expect(read(at(`.cline/agents/${role}.yml`)), role).not.toContain('cline-native');
    expect(await fs.pathExists(at('.cline/agents/orchestrator-engineering.yml'))).toBe(true);
    expect(await fs.pathExists(at(`.cline/rules/agents-united-${BUNDLE}.md`))).toBe(true);
    for (const rel of NATIVE_ONLY) expect(await fs.pathExists(at(rel)), rel).toBe(false);
    const lock = await fs.readJson(lockPath);
    expect(lock.nativeLanes).toBeUndefined();
    expect(lock.nativeLane).toBeUndefined();
  });

  it('writes the committed native files: four agents, three workflows, the orchestrator rule and skill, and the guard plugin', async () => {
    await install(true);
    for (const role of ROLES) expect(read(at(`.cline/agents/${role}.yml`)), role).toBe(expectedRole(role));
    for (const name of WORKFLOWS) expect(read(at(`.cline/workflows/${name}.md`)), name).toBe(expectedWorkflow(name));
    expect(read(at(`.cline/rules/${RULE}.md`))).toBe(expectedRule());
    expect(read(at(`.cline/skills/${SKILL}/SKILL.md`))).toBe(expectedSkill());
    expect(read(at(`.cline/plugins/${GUARD}.js`))).toBe(expectedPlugin());
  });

  it('replaces the orchestrator agent and the legacy coordinator rule by the native rule and skill (ADR 0028 decision 6)', async () => {
    await install(true);
    expect(await fs.pathExists(at('.cline/agents/orchestrator-engineering.yml'))).toBe(false);
    expect(await fs.pathExists(at(`.cline/rules/agents-united-${BUNDLE}.md`))).toBe(false);
  });

  it('keeps the legacy projection for what has no native file: the other workflows, the domain rules and the Agent Plugin package', async () => {
    await install(true);
    const legacyWorkflow = read(at('.cline/workflows/workflow-build.md'));
    expect(legacyWorkflow).toContain('profile: cline |');
    expect(legacyWorkflow).not.toContain('cline-native');
    expect(await fs.pathExists(at(`.agents/plugins/${BUNDLE}/plugin.json`))).toBe(true);
  });

  it('records the lane per host and every projection hash matches the file on disk; native-only files have no canonical', async () => {
    await install(true);
    const lock = await fs.readJson(lockPath);
    // One flag covers every host being installed, and the main library is installed too (ADR 0031), so Antigravity is recorded as well.
    expect(lock.nativeLanes).toEqual({ antigravity: true, cline: true });
    expect(lock.nativeLane).toBeUndefined();
    for (const role of ROLES) {
      const record = lock.projections[`.cline/agents/${role}.yml`];
      expect(record.kind).toBe('role');
      expect(record.canonical).toBe(`agents/subagent-${role}.md`);
      expect(record.owners).toContain(BUNDLE);
      expect(record.hash).toBe(sha256(read(at(`.cline/agents/${role}.yml`))));
    }
    for (const rel of NATIVE_ONLY) {
      const record = lock.projections[rel];
      expect(record, rel).toBeDefined();
      expect(record.canonical, rel).toBeUndefined();
      expect(record.owners, rel).toEqual([BUNDLE]);
      expect(record.managedMarker, rel).toBe(true);
      expect(record.hash, rel).toBe(sha256(read(at(rel))));
    }
    expect(lock.projections[`.cline/plugins/${GUARD}.js`].kind).toBe('plugin');
    expect(lock.projections[`.cline/skills/${SKILL}/SKILL.md`].kind).toBe('skill');
  });

  it('is byte-stable: a second install regenerates identical files without --force', async () => {
    await install(true);
    const first = await fs.readFile(at(`.cline/plugins/${GUARD}.js`));
    await install(true);
    expect((await fs.readFile(at(`.cline/plugins/${GUARD}.js`))).equals(first)).toBe(true);
  });

  it('is sticky: an install without the flag (what `agents update` does) keeps the native files', async () => {
    await install(true);
    await install(undefined, { force: true });
    expect(read(at('.cline/agents/code-reviewer.yml'))).toBe(expectedRole('code-reviewer'));
    expect(await fs.pathExists(at(`.cline/plugins/${GUARD}.js`))).toBe(true);
    expect((await fs.readJson(lockPath)).nativeLanes).toEqual({ antigravity: true, cline: true });
  });

  it('can be turned off explicitly: legacy projections return, the native-only files go, and the record is dropped', async () => {
    await install(true);
    await install(false, { force: true });
    expect(read(at('.cline/agents/code-reviewer.yml'))).not.toContain('cline-native');
    expect(await fs.pathExists(at('.cline/agents/orchestrator-engineering.yml'))).toBe(true);
    expect(read(at('.cline/workflows/workflow-review.md'))).not.toContain('cline-native');
    for (const rel of NATIVE_ONLY) expect(await fs.pathExists(at(rel)), rel).toBe(false);
    expect((await fs.readJson(lockPath)).nativeLanes).toBeUndefined();
  });

  it('is recorded per host: one flag covers every fanned-out host with a native package, and a host not fanned out is untouched', async () => {
    await install(true, {}, ['claude', 'cline']);
    const both = await fs.readJson(lockPath);
    expect(both.nativeLane).toBe(true);
    expect(both.nativeLanes).toEqual({ antigravity: true, cline: true });
    expect(read(at('.claude/agents/code-reviewer.md'))).toContain('claude-native');

    await fs.remove(workspace);
    await fs.ensureDir(workspace);
    await install(true, {}, ['claude']);
    const claudeOnly = await fs.readJson(lockPath);
    expect(claudeOnly.nativeLane).toBe(true);
    expect(claudeOnly.nativeLanes).toEqual({ antigravity: true }); // the main library is installed, Cline is not fanned out
    expect(await fs.pathExists(at('.cline'))).toBe(false);
  });

  it('a dry run reports the native paths and writes nothing', async () => {
    const dry = await install(true, { dryRun: true });
    const paths = dry.projections.map(p => p.path);
    expect(paths).toEqual(expect.arrayContaining([...ROLES.map(role => `.cline/agents/${role}.yml`), ...NATIVE_ONLY, ...WORKFLOWS.map(name => `.cline/workflows/${name}.md`)]));
    expect(paths).not.toContain('.cline/agents/orchestrator-engineering.yml');
    expect(await fs.pathExists(at('.cline'))).toBe(false);
  });

  it('refuses to overwrite an unmanaged file of the same name without --force', async () => {
    await fs.outputFile(at(`.cline/plugins/${GUARD}.js`), 'export default { name: "mine" };\n');
    await expect(install(true)).rejects.toThrow(/not managed by agents-united/);
    await install(true, { force: true });
    expect(read(at(`.cline/plugins/${GUARD}.js`))).toBe(expectedPlugin());
  });

  it('removing the bundle removes every native file it installed', async () => {
    await install(true);
    await new UninstallEngine().uninstall(BUNDLE, { targetDir: agentsDir });
    for (const rel of [...NATIVE_ONLY, ...ROLES.map(role => `.cline/agents/${role}.yml`), ...WORKFLOWS.map(name => `.cline/workflows/${name}.md`)]) {
      expect(await fs.pathExists(at(rel)), rel).toBe(false);
    }
  });

  describe('doctor', () => {
    it('finds a fresh native install healthy: no warning at all, in particular no shadow warning from the canonical skills', async () => {
      // The Cline-only install the CLI makes: the store is implicit (ADR 0034), so the generic workflow skills are not in it to shadow the native workflows.
      await install(true, { implicitStore: true });
      const report = await DoctorEngine.runDoctor(agentsDir);
      expect(report.issues).toEqual([]);
      expect(report.warnings.filter(w => /projection|drift|Outdated|guard|shadow/i.test(w))).toEqual([]);
    });

    it('reports drift on a native file and a stale render', async () => {
      await install(true);
      await fs.appendFile(at('.cline/agents/code-reviewer.yml'), '\nA local edit.\n');
      expect((await DoctorEngine.runDoctor(agentsDir)).warnings.join('\n')).toMatch(/Content drift \.cline\/agents\/code-reviewer\.yml/);
    });

    it('warns when a native writer role is installed but its guard plugin is gone, and says how to restore it', async () => {
      await install(true);
      await fs.remove(at(`.cline/plugins/${GUARD}.js`));
      const text = (await DoctorEngine.runDoctor(agentsDir)).warnings.join('\n');
      expect(text).toMatch(/guard plugin/i);
      expect(text).toMatch(/backend-architect/);
      expect(text).toMatch(/agents update software-engineering --fanout cline/);
    });

    it('warns when `.agents/skills` holds a skill of the same name as a native `.cline/skills` one, because that copy wins', async () => {
      await install(true);
      await fs.outputFile(at(`.agents/skills/${SKILL}/SKILL.md`), `---\nname: ${SKILL}\ndescription: Somebody else's copy.\n---\n\nOther.\n`);
      const text = (await DoctorEngine.runDoctor(agentsDir)).warnings.join('\n');
      expect(text).toMatch(new RegExp(`\\.agents/skills/${SKILL}.*(shadow|wins|override)`, 'i'));
      expect(text).toMatch(new RegExp(`\\.cline/skills/${SKILL}`));
    });

    it('does not run the native checks on a legacy install', async () => {
      await install();
      await fs.outputFile(at(`.agents/skills/${SKILL}/SKILL.md`), '---\nname: x\ndescription: y\n---\n');
      const text = (await DoctorEngine.runDoctor(agentsDir)).warnings.join('\n');
      expect(text).not.toMatch(/guard plugin|shadow/i);
    });
  });
});
