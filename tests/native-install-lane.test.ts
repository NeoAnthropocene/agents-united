import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'fs-extra';
import yaml from 'yaml';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DoctorEngine } from '../src/core/doctor.js';
import { InstallEngine } from '../src/core/installer.js';
import { listNativeRoles, nativeRoleSource, renderNativeRole } from '../src/core/native-package.js';
import { HostProjector } from '../src/core/projector.js';
import { ClaudeProjector } from '../src/core/claude-projector.js';
import { UninstallEngine } from '../src/core/uninstaller.js';

/**
 * Plan 032 Phase 7 — the native-package install lane for Claude agents. Opt-in beside the legacy projection lane
 * (strangler): `nativeLane` installs the committed `registry/hosts/claude/agents/<role>.md` verbatim behind a managed
 * marker, with no rendering step and no LLM. The lane is sticky in the lockfile like the plugin lane, and doctor's
 * freshness check compares against the same native render.
 */

const REGISTRY = path.resolve('registry');
const BUNDLE = 'software-engineering';
const NATIVE_ROLES = ['backend-architect', 'code-reviewer', 'frontend-architect', 'repo-index'];
const sha256 = (text: string): string => `sha256:${crypto.createHash('sha256').update(text).digest('hex')}`;
const lf = (text: string): string => text.replace(/\r\n/g, '\n');

describe('native package helpers', () => {
  it('lists the committed native roles of a host, sorted', () => {
    expect(listNativeRoles(REGISTRY, 'claude')).toEqual(NATIVE_ROLES);
    expect(listNativeRoles(REGISTRY, 'no-such-host')).toEqual([]);
  });

  it('finds a role source by its stripped name, and nothing for a legacy-only role', () => {
    expect(nativeRoleSource(REGISTRY, 'claude', 'code-reviewer')).toBe(path.join(REGISTRY, 'hosts', 'claude', 'agents', 'code-reviewer.md'));
    expect(nativeRoleSource(REGISTRY, 'claude', 'orchestrator-engineering')).toBeUndefined();
    expect(nativeRoleSource(REGISTRY, 'claude', '../profile')).toBeUndefined();
  });

  const source = '---\r\nname: demo\r\ndescription: A demo.\r\n---\r\n\r\n# demo\r\n\r\nBody.\r\n';

  it('stamps a managed marker as the first body line, keeps the frontmatter, and normalises line endings', () => {
    const rendered = renderNativeRole(source, 'agents/subagent-demo.md');
    expect(HostProjector.hasManagedMarker(rendered)).toBe(true);
    expect(rendered).not.toContain('\r');
    const [, front, body] = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(rendered)!;
    expect(yaml.parse(front)).toEqual({ name: 'demo', description: 'A demo.' });
    const lines = body.replace(/^\n/, '').split('\n');
    expect(lines[0]).toMatch(/^<!-- managed-by: agents-united \| profile: claude-native \| canonical: agents\/subagent-demo\.md \| source: sha256:[0-9a-f]{64} \| do not edit -->$/);
    expect(lf(rendered).endsWith('# demo\n\nBody.\n')).toBe(true);
  });

  it('is deterministic and carries the hash of the normalised source', () => {
    expect(renderNativeRole(source, 'agents/subagent-demo.md')).toBe(renderNativeRole(source.replace(/\r\n/g, '\n'), 'agents/subagent-demo.md'));
    expect(renderNativeRole(source, 'agents/subagent-demo.md')).toContain(sha256(lf(source)));
    expect(renderNativeRole(`${source}More.\n`, 'agents/subagent-demo.md')).not.toBe(renderNativeRole(source, 'agents/subagent-demo.md'));
  });

  it('refuses a source without frontmatter', () => {
    expect(() => renderNativeRole('# no frontmatter\n', 'agents/x.md')).toThrow(/frontmatter/);
  });
});

describe('native agents follow the specialist model posture of ADR 0018 decision 7', () => {
  it.each(NATIVE_ROLES)('%s pins the specialist model and effort', role => {
    const text = lf(fs.readFileSync(nativeRoleSource(REGISTRY, 'claude', role)!, 'utf8'));
    const meta = yaml.parse(/^---\n([\s\S]*?)\n---\n/.exec(text)![1]);
    expect(meta.model).toBe(ClaudeProjector.CLAUDE_DIALECT.roleModelDefaults?.specialist);
    expect(meta.effort).toBe(ClaudeProjector.CLAUDE_DIALECT.roleEffortDefaults?.specialist);
  });
});

describe('native install lane (agents add --native)', () => {
  const workspace = path.resolve(process.cwd(), 'scratch/test-native-install-lane');
  const agentsDir = path.join(workspace, '.agents');
  const lockPath = path.join(agentsDir, 'agents-united.json');
  const claudeAgent = (role: string): string => path.join(workspace, '.claude', 'agents', `${role}.md`);

  const install = (nativeLane?: boolean, extra: Record<string, unknown> = {}) =>
    new InstallEngine().install(BUNDLE, { targetDir: agentsDir, method: 'copy', fanout: ['claude'], nativeLane, ...extra });
  const expected = (role: string): string =>
    renderNativeRole(fs.readFileSync(nativeRoleSource(REGISTRY, 'claude', role)!, 'utf8'), `agents/subagent-${role}.md`);

  beforeEach(async () => {
    await fs.remove(workspace);
    await fs.ensureDir(workspace);
  });
  afterEach(async () => {
    await fs.remove(workspace);
  });

  it('is off by default: the legacy projection is written for every role', async () => {
    await install();
    for (const role of NATIVE_ROLES) {
      const text = await fs.readFile(claudeAgent(role), 'utf8');
      expect(text, role).toContain('profile: claude |');
      expect(text, role).not.toContain('claude-native');
    }
    expect((await fs.readJson(lockPath)).nativeLane).toBeUndefined();
  });

  it('writes the committed native file for each native role, and the legacy projection for the rest', async () => {
    await install(true);
    for (const role of NATIVE_ROLES) expect(await fs.readFile(claudeAgent(role), 'utf8'), role).toBe(expected(role));
    const orchestrator = await fs.readFile(claudeAgent('orchestrator-engineering'), 'utf8');
    expect(orchestrator).toContain('profile: claude |');
    expect(orchestrator).not.toContain('claude-native');
  });

  it('records the lane, and every projection hash matches the file on disk', async () => {
    await install(true);
    const lock = await fs.readJson(lockPath);
    expect(lock.nativeLane).toBe(true);
    for (const role of NATIVE_ROLES) {
      const record = lock.projections[`.claude/agents/${role}.md`];
      expect(record.kind).toBe('role');
      expect(record.canonical).toBe(`agents/subagent-${role}.md`);
      expect(record.managedMarker).toBe(true);
      expect(record.hash).toBe(sha256(await fs.readFile(claudeAgent(role), 'utf8')));
    }
  });

  it('is byte-stable: a second install regenerates identical files without --force', async () => {
    await install(true);
    const first = await fs.readFile(claudeAgent('code-reviewer'));
    await install(true);
    expect((await fs.readFile(claudeAgent('code-reviewer'))).equals(first)).toBe(true);
  });

  it('is sticky: an install without the flag (what `agents update` does) keeps the native files', async () => {
    await install(true);
    await install(undefined, { force: true });
    expect(await fs.readFile(claudeAgent('code-reviewer'), 'utf8')).toBe(expected('code-reviewer'));
    expect((await fs.readJson(lockPath)).nativeLane).toBe(true);
  });

  it('can be turned off explicitly: the legacy projection returns and the record is dropped', async () => {
    await install(true);
    await install(false, { force: true });
    expect(await fs.readFile(claudeAgent('code-reviewer'), 'utf8')).toContain('profile: claude |');
    expect((await fs.readJson(lockPath)).nativeLane).toBeUndefined();
  });

  it('a dry run reports the same projection paths and writes nothing', async () => {
    const dry = await install(true, { dryRun: true });
    expect(dry.projections.map(p => p.path)).toEqual(expect.arrayContaining(NATIVE_ROLES.map(role => `.claude/agents/${role}.md`)));
    expect(await fs.pathExists(path.join(workspace, '.claude'))).toBe(false);
  });

  it('refuses to overwrite an unmanaged file of the same name without --force', async () => {
    await fs.outputFile(claudeAgent('code-reviewer'), '---\nname: code-reviewer\n---\nMine.\n');
    await expect(install(true)).rejects.toThrow(/not managed by agents-united/);
    await install(true, { force: true });
    expect(await fs.readFile(claudeAgent('code-reviewer'), 'utf8')).toBe(expected('code-reviewer'));
  });

  it('doctor finds a fresh native install healthy, and reports drift and stale renders', async () => {
    await install(true);
    const healthy = await DoctorEngine.runDoctor(agentsDir);
    expect(healthy.warnings.filter(w => /projection|drift|Outdated/i.test(w))).toEqual([]);

    const file = claudeAgent('code-reviewer');
    await fs.appendFile(file, '\nA local edit.\n');
    const drifted = await DoctorEngine.runDoctor(agentsDir);
    expect(drifted.warnings.join('\n')).toMatch(/Content drift \.claude\/agents\/code-reviewer\.md/);
  });

  it('doctor reports a native install whose source moved on as outdated (hash freshness)', async () => {
    await install(true);
    const lock = await fs.readJson(lockPath);
    const file = claudeAgent('repo-index');
    // Simulate an older release: rewrite the file with a different source hash, keep the recorded hash in step.
    const older = (await fs.readFile(file, 'utf8')).replace(/source: sha256:[0-9a-f]{64}/, `source: sha256:${'0'.repeat(64)}`);
    await fs.writeFile(file, older);
    lock.projections['.claude/agents/repo-index.md'].hash = sha256(older);
    await fs.writeJson(lockPath, lock);
    const report = await DoctorEngine.runDoctor(agentsDir);
    expect(report.warnings.join('\n')).toMatch(/Outdated projection \.claude\/agents\/repo-index\.md/);
  });

  it('removing the bundle removes the native files it installed', async () => {
    await install(true);
    await new UninstallEngine().uninstall(BUNDLE, { targetDir: agentsDir });
    for (const role of NATIVE_ROLES) expect(await fs.pathExists(claudeAgent(role)), role).toBe(false);
  });
});
