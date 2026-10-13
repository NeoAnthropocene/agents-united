import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import fs from 'fs-extra';
import YAML from 'yaml';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { InstallEngine } from '../src/core/installer.js';
import { RegistryResolver } from '../src/core/registry.js';
import { DoctorEngine } from '../src/core/doctor.js';
import { UpdateEngine } from '../src/core/updater.js';
import { UninstallEngine } from '../src/core/uninstaller.js';
import type { InstallOptions, LockfileManifest } from '../src/core/types.js';

describe('shipped factory native lifecycle in fresh workspaces', () => {
  let root: string;
  let state: string;
  let skill: string;
  const options = (extra: InstallOptions = {}): InstallOptions => ({ targetDir: state, method: 'copy', fanout: ['claude'], nativeLane: true, ...extra });
  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'au-factory-native-'));
    state = path.join(root, '.claude/.agents-united');
    skill = path.join(root, '.claude/skills/author-skill');
  });
  afterEach(async () => { await fs.remove(root); });
  it('loads the production source entry and every required resource with ordinary hashes and ownership', async () => {
    const result = await new InstallEngine().install('agent-factory', options());
    expect(result.installed.targetBundle).toBe('agent-factory');
    const entry = await fs.readFile(path.join(skill, 'SKILL.md'), 'utf8');
    const front = YAML.parse(/^---\n([\s\S]*?)\n---/.exec(entry)![1]!);
    expect(front).toMatchObject({ context: 'fork', agent: 'general-purpose', background: false });
    expect(entry).toContain('(references/skill-attribution.md)');
    const binding = await fs.readJson(path.resolve('registry/hosts/claude/agent-factory.binding.json'));
    const lock = await fs.readJson(path.join(state, 'agents-united.json')) as LockfileManifest;
    for (const resource of ['SKILL.md', ...binding.requiredSupport, 'references/skill-attribution.md'] as string[]) {
      const rel = `.claude/skills/author-skill/${resource}`;
      const bytes = await fs.readFile(path.join(root, rel));
      expect(lock.projections?.[rel]?.owners, resource).toContain('agent-factory');
      expect(lock.projections?.[rel]?.hash, resource).toBe(`sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`);
    }
    expect(await fs.pathExists(path.join(root, '.claude/rules/skill-attribution.md'))).toBe(false);
    expect(await fs.pathExists(path.join(skill, 'evals'))).toBe(false);
    expect(await fs.pathExists(path.join(state, 'skills/author-skill/evals'))).toBe(false);
    const report = await DoctorEngine.runDoctor(state);
    expect(report.issues).toEqual([]);
    expect(report.warnings.filter(w => /projection|drift|Outdated|author-skill|skill-attribution/i.test(w))).toEqual([]);
  });
  it('excludes maintainer evals even when an implicit store requests symlinks', async () => {
    const store = path.join(root, '.agents');
    await new InstallEngine().install('agent-factory', options({ targetDir: store, implicitStore: true, method: 'symlink' }));
    expect(await fs.pathExists(path.join(store, 'skills/author-skill/evals'))).toBe(false);
    expect(await fs.pathExists(path.join(skill, 'evals'))).toBe(false);
    expect(await fs.pathExists(path.join(store, 'skills/author-skill/assets/report.md'))).toBe(true);
  });
  it('doctor detects local entry/support drift and a missing attribution projection', async () => {
    await new InstallEngine().install('agent-factory', options());
    await fs.appendFile(path.join(skill, 'SKILL.md'), '\nLocal user edit.\n');
    await fs.appendFile(path.join(skill, 'references/job.md'), '\nLocal user note.\n');
    await fs.remove(path.join(skill, 'references/skill-attribution.md'));
    const report = await DoctorEngine.runDoctor(state);
    expect(report.warnings.join('\n')).toMatch(/Content drift .*author-skill\/SKILL.md/);
    expect(report.warnings.join('\n')).toMatch(/user-modified projection .*author-skill\/references\/job.md/);
    expect([...report.issues, ...report.warnings].join('\n')).toMatch(/Missing projection .*author-skill\/references\/skill-attribution.md/i);
  });
  it('update retains the recorded native choice and restores an absent attribution file', async () => {
    await new InstallEngine().install('agent-factory', options());
    await fs.remove(path.join(skill, 'references/skill-attribution.md'));
    const result = await new UpdateEngine().update('agent-factory', { targetDir: state });
    expect(result.updated.map(record => record.name)).toContain('agent-factory');
    const lock = await fs.readJson(path.join(state, 'agents-united.json'));
    expect(lock.nativeLane).toBe(true);
    expect(await fs.pathExists(path.join(skill, 'references/skill-attribution.md'))).toBe(true);
    const entry = await fs.readFile(path.join(skill, 'SKILL.md'), 'utf8');
    expect(entry).toContain('agent: general-purpose');
  });
  it('direct skill and direct Claude API requests still use the complete owned native binding', async () => {
    await new InstallEngine().install('author-skill', { hosts: ['claude'], targetDir: path.join(root, '.claude'), method: 'copy', nativeLane: true });
    expect(await fs.pathExists(path.join(skill, 'references/skill-attribution.md'))).toBe(true);
    const entry = await fs.readFile(path.join(skill, 'SKILL.md'), 'utf8');
    expect(entry).toContain('agent: general-purpose');
    const lock = await fs.readJson(path.join(state, 'agents-united.json'));
    expect(lock.installed.bundles).toContain('agent-factory');
    expect(await fs.pathExists(path.join(root, '.agents'))).toBe(false);
  });
  it('projects a direct Claude target alongside an explicitly implicit state host', async () => {
    await new InstallEngine().install('agent-factory', { hosts: ['agents', 'claude'], targetDir: state, implicitStore: true, method: 'copy', nativeLane: true });
    expect(await fs.pathExists(path.join(skill, 'SKILL.md'))).toBe(true);
    expect(await fs.pathExists(path.join(skill, 'references/skill-attribution.md'))).toBe(true);
    expect(await fs.pathExists(path.join(root, '.agents'))).toBe(false);
  });
  it('removal clears factory files while retaining ordinary bundle assets and their owners', async () => {
    await new InstallEngine().install('digital-agency', options());
    const shared = ['brand-identity', 'color-theory', 'brand-consistency-audit', 'stitch-design-taste', 'image-creation'];
    const before = new Map<string, Buffer>();
    for (const name of shared) before.set(name, await fs.readFile(path.join(root, '.claude/skills', name, 'SKILL.md')));
    await new InstallEngine().install('agent-factory', options());
    await new UninstallEngine().uninstall('agent-factory', { targetDir: state });
    expect(await fs.pathExists(path.join(skill, 'SKILL.md'))).toBe(false);
    expect(await fs.pathExists(path.join(skill, 'references/skill-attribution.md'))).toBe(false);
    const lock = await fs.readJson(path.join(state, 'agents-united.json')) as LockfileManifest;
    expect(lock.installed.bundles).toContain('digital-agency');
    expect(lock.installed.bundles).not.toContain('agent-factory');
    expect(Object.keys(lock.projections ?? {}).filter(file => file.includes('/author-skill/'))).toEqual([]);
    for (const name of shared) {
      const rel = `.claude/skills/${name}/SKILL.md`;
      expect(await fs.readFile(path.join(root, rel))).toEqual(before.get(name));
      expect(lock.projections?.[rel]?.owners).toContain('digital-agency');
    }
    const full = await new RegistryResolver().resolve('full');
    expect(full.skills).not.toContain('author-skill');
    expect(full.rules).not.toContain('skill-attribution.md');
    for (const name of shared) expect(full.skills).toContain(name);
  });
});
