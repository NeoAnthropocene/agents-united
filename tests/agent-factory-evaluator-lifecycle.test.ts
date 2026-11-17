import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { InstallEngine } from '../src/core/installer.js';
import { RegistryResolver } from '../src/core/registry.js';
import { UpdateEngine } from '../src/core/updater.js';
import { UninstallEngine } from '../src/core/uninstaller.js';
import { DoctorEngine } from '../src/core/doctor.js';
import type { LockfileManifest } from '../src/core/types.js';
import { prepareProductionEvaluator } from './helpers/factory-evaluator.js';
import { evaluationTree, reviewPin } from './helpers/factory-evaluation.js';

describe('production evaluator lifecycle independently of realization', () => {
  let fixture: Awaited<ReturnType<typeof prepareProductionEvaluator>>;
  let resolver: RegistryResolver;
  const skill = '.claude/skills/evaluate-artifact';
  beforeEach(async () => {
    fixture = await prepareProductionEvaluator(await fs.mkdtemp(path.join(os.tmpdir(), 'au-evaluator-life-')));
    resolver = new RegistryResolver(fixture.registry);
    await fs.writeFile(fixture.installed('unrelated-draft.md'), 'Preserve this unrelated draft.\n');
  });
  afterEach(async () => { await fs.remove(fixture.root); });

  it('records every native-only owner/hash and is idempotent without a canonical carrier', async () => {
    const installer = new InstallEngine(resolver);
    await installer.install('agent-factory', fixture.options);
    const before = await evaluationTree(fixture.workspace);
    await installer.install('agent-factory', fixture.options);
    expect(await evaluationTree(fixture.workspace)).toEqual(before);
    const lock = await fs.readJson(path.join(fixture.state, 'agents-united.json')) as LockfileManifest;
    for (const rel of [fixture.binding.installed, `${skill}/assets/claude-binding.json`, '.claude/agents/factory-evaluator.md',
      '.claude/hooks/agents-united-readonly-guard.js', ...fixture.binding.requiredSupport.map(rel => `${skill}/${rel}`),
      ...fixture.binding.references.map(ref => ref.installed)]) {
      expect(lock.projections?.[rel]?.owners, rel).toEqual(['agent-factory']);
      expect(lock.projections?.[rel]?.hash, rel).toBe(`sha256:${(await reviewPin(fixture.installed(rel))).sha256}`);
    }
    expect(lock.projections?.['.claude/agents/factory-evaluator.md']?.canonical).toBeUndefined();
    expect(await fs.pathExists(fixture.installed('.claude/agents/factory-realizer.md'))).toBe(false);
  });

  it('doctor counts the evaluator and detects missing role/support/guard and edited resources', async () => {
    await new InstallEngine(resolver).install('agent-factory', fixture.options);
    const clean = await DoctorEngine.runDoctor(fixture.state, 'claude');
    expect(clean.agentsCount).toBe(1);
    expect(clean.issues).toEqual([]);
    await fs.remove(fixture.installed('.claude/agents/factory-evaluator.md'));
    await fs.remove(fixture.installed('.claude/hooks/agents-united-readonly-guard.js'));
    await fs.remove(fixture.installed(`${skill}/assets/result.schema.json`));
    await fs.appendFile(fixture.installed(`${skill}/references/evidence.md`), '\nLocal note.\n');
    const report = await DoctorEngine.runDoctor(fixture.state, 'claude');
    const findings = [...report.issues, ...report.warnings].join('\n');
    for (const name of ['factory-evaluator', 'agents-united-readonly-guard', 'result.schema.json', 'evidence.md']) expect(findings).toContain(name);
  });

  it('restores a missing support file through the recorded native lane', async () => {
    await new InstallEngine(resolver).install('agent-factory', fixture.options);
    const file = fixture.installed(`${skill}/references/rules/domain-modeling-and-adr.md`);
    const original = await fs.readFile(file);
    await fs.remove(file);
    await new UpdateEngine(resolver).update('agent-factory', { targetDir: fixture.state });
    expect(await fs.readFile(file)).toEqual(original);
    expect((await fs.readJson(path.join(fixture.state, 'agents-united.json'))).nativeLane).toBe(true);
  });

  it('refuses missing source binding during update before changing installed state', async () => {
    await new InstallEngine(resolver).install('agent-factory', fixture.options);
    await fs.remove(fixture.source('hosts/claude/agent-factory-evaluate.binding.json'));
    const before = await evaluationTree(fixture.workspace);
    await expect(new UpdateEngine(resolver).update('agent-factory', { targetDir: fixture.state })).rejects.toThrow(/factory.*missing/i);
    expect(await evaluationTree(fixture.workspace)).toEqual(before);
  });

  it('preserves edited support and all state until explicit forced replacement', async () => {
    await new InstallEngine(resolver).install('agent-factory', fixture.options);
    const file = fixture.installed(`${skill}/references/evidence.md`), original = await fs.readFile(file);
    await fs.appendFile(file, '\nKeep this local evidence.\n');
    const before = await evaluationTree(fixture.workspace);
    await expect(new UpdateEngine(resolver).update('agent-factory', { targetDir: fixture.state })).rejects.toThrow(/modifi/i);
    expect(await evaluationTree(fixture.workspace)).toEqual(before);
    await new UpdateEngine(resolver).update('agent-factory', { targetDir: fixture.state, force: true });
    expect(await fs.readFile(file)).toEqual(original);
  });

  it('uses its own installed receipt to refuse partial removal with source/other receipts absent', async () => {
    await new InstallEngine(resolver).install('agent-factory', fixture.options);
    await fs.remove(fixture.source('hosts/claude/agent-factory-evaluate.binding.json'));
    await fs.appendFile(fixture.installed(`${skill}/references/handback.md`), '\nUser-owned evidence.\n');
    const lock = await fs.readJson(path.join(fixture.state, 'agents-united.json')) as LockfileManifest;
    expect(lock.projections?.['.claude/skills/realize-artifact/assets/claude-binding.json']).toBeUndefined();
    expect(lock.projections?.['.claude/skills/author-contract/assets/claude-binding.json']).toBeUndefined();
    const before = await evaluationTree(fixture.workspace);
    await expect(new UninstallEngine(resolver).uninstall('agent-factory', { targetDir: fixture.state })).rejects.toThrow(/modifi/i);
    expect(await evaluationTree(fixture.workspace)).toEqual(before);
  });

  it('removes unedited delivery from installed records with the source binding absent and preserves unrelated drafts', async () => {
    await new InstallEngine(resolver).install('agent-factory', fixture.options);
    await fs.remove(fixture.source('hosts/claude/agent-factory-evaluate.binding.json'));
    await new UninstallEngine(resolver).uninstall('agent-factory', { targetDir: fixture.state });
    expect(await fs.pathExists(fixture.installed('.claude/agents/factory-evaluator.md'))).toBe(false);
    expect(await fs.pathExists(fixture.installed(`${skill}/scripts/check-review.mjs`))).toBe(false);
    expect(await fs.readFile(fixture.installed('unrelated-draft.md'), 'utf8')).toBe('Preserve this unrelated draft.\n');
  });

  it('preserves an ordinary reviewer and its shared read-only guard owner when removing the factory', async () => {
    for (const rel of ['agents/subagent-code-reviewer.md', 'core/subagent-code-reviewer.core.md', 'hosts/claude/agents/code-reviewer.md', 'skills/security-audit', 'rules']) {
      await fs.copy(path.resolve('registry', rel), fixture.source(rel));
    }
    const manifest = await fs.readJson(fixture.source('bundles.json'));
    manifest.bundles['review-tools'] = { name: 'review-tools', description: 'Existing ordinary reviewer', agents: ['subagent-code-reviewer.md'], skills: ['security-audit'] };
    await fs.writeJson(fixture.source('bundles.json'), manifest);
    const installer = new InstallEngine(new RegistryResolver(fixture.registry));
    await installer.install('review-tools', fixture.options);
    await installer.install('agent-factory', fixture.options);
    const guard = fixture.installed('.claude/hooks/agents-united-readonly-guard.js');
    const original = await fs.readFile(guard);
    await new UninstallEngine(new RegistryResolver(fixture.registry)).uninstall('agent-factory', { targetDir: fixture.state });
    expect(await fs.readFile(guard)).toEqual(original);
    expect(await fs.pathExists(fixture.installed('.claude/agents/code-reviewer.md'))).toBe(true);
    const lock = await fs.readJson(path.join(fixture.state, 'agents-united.json')) as LockfileManifest;
    expect(lock.projections?.['.claude/hooks/agents-united-readonly-guard.js']?.owners).toEqual(['review-tools']);
  });

  it('preserves the entire workspace on a late unmanaged support collision', async () => {
    await fs.outputFile(fixture.installed(`${skill}/assets/report.json`), 'User-owned report.\n');
    const before = await evaluationTree(fixture.workspace);
    await expect(new InstallEngine(resolver).install('agent-factory', fixture.options)).rejects.toThrow(/unmanaged|collision/i);
    expect(await evaluationTree(fixture.workspace)).toEqual(before);
  });

  it('resolves the direct author-skill route to its complete owning factory with the evaluator', async () => {
    const result = await new InstallEngine(resolver).install('author-skill', fixture.options);
    expect(result.installed.skills).toEqual(['author-skill', 'evaluate-artifact']);
    expect(await fs.pathExists(fixture.installed('.claude/skills/author-skill/SKILL.md'))).toBe(true);
    expect(await fs.pathExists(fixture.installed('.claude/agents/factory-evaluator.md'))).toBe(true);
    expect(await fs.pathExists(fixture.installed(`${skill}/SKILL.md`))).toBe(true);
  });

  it('refuses an unapproved partial evaluator request before any installation mutation', async () => {
    const before = await evaluationTree(fixture.workspace);
    await expect(new InstallEngine(resolver).install('evaluate-artifact', fixture.options)).rejects.toThrow(/partial|bundle by name/i);
    expect(await evaluationTree(fixture.workspace)).toEqual(before);
  });
});
