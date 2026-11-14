import path from 'node:path';
import fs from 'fs-extra';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { factoryJobFixture, sha256, type FactoryJobFixture } from './helpers/factory-job.js';

describe('installed realization job preflight', () => {
  let f: FactoryJobFixture;
  beforeEach(async () => { f = await factoryJobFixture(); });
  afterEach(async () => { await fs.remove(f.root); });
  const blocked = (reason: RegExp): void => {
    const result = f.run('check-job');
    expect(result.exit, result.raw).toBe(1);
    expect(result.report?.ok, result.raw).toBe(false);
    expect(result.report?.findings.join('\n'), result.raw).toMatch(reason);
  };
  it('checks actual pinned files, emits the canonical fixed-job digest and writes nothing', async () => {
    const before = await fs.readFile(f.jobFile);
    const result = f.run('check-job');
    expect(result.exit, result.raw).toBe(0);
    expect(result.report).toMatchObject({ ok: true, digest: f.digest(), quality: 'pending', live: 'unverified' });
    expect(await fs.pathExists(f.draft)).toBe(false);
    expect(await fs.readFile(f.jobFile)).toEqual(before);
    expect(await fs.readdir(f.evidence)).toEqual(['job.json']);
  });
  it('fails unknown nested fields and unsupported adapter/surface rather than ignoring them', async () => {
    Object.assign(f.job.constraints, { surprise: true });
    await f.save(); blocked(/unknown|additional/i);
    delete (f.job.constraints as unknown as Record<string, unknown>).surprise;
    f.job.targetHost.host = 'codex';
    await f.save(); blocked(/targetHost|unavailable|claude/i);
  });
  it('blocks held, missing or altered required inputs', async () => {
    f.job.inputs[0]!.status = 'held'; await f.save(); blocked(/held/i);
    f.job.inputs[0]!.status = 'clear'; await f.save();
    await fs.appendFile(f.job.inputs[0]!.path, 'changed'); blocked(/hash|pin/i);
    await fs.remove(f.job.inputs[0]!.path); blocked(/missing|unavailable/i);
  });
  it('requires guide, snapshot, profile, tool policy, pair, loading, guard and runnable checker pins', async () => {
    f.job.inputs = f.job.inputs.filter(item => item.kind !== 'guide'); await f.save(); blocked(/guide/i);
  });
  it('rejects an unpinned cited snapshot or a snapshot that disagrees with the pinned library lock', async () => {
    const guide = f.job.inputs.find(input => input.kind === 'guide')!;
    const original = await fs.readFile(guide.path);
    const bytes = 'Read [required snapshot](../pages/agent/other.md#required).\n';
    await fs.writeFile(guide.path, bytes); guide.sha256 = sha256(bytes); await f.save(); blocked(/snapshot|citation/i);
    await fs.writeFile(guide.path, original); guide.sha256 = sha256(original);
    const lock = f.job.inputs.find(input => input.path.endsWith('library.lock.json'))!;
    await fs.writeJson(lock.path, { files: {} }); lock.sha256 = sha256(await fs.readFile(lock.path));
    await f.save(); blocked(/snapshot.*lock|lock.*snapshot/i);
  });
  it('rejects a checkout HEAD mismatch and writable/source or managed overlap', async () => {
    const originalHead = f.job.source.head;
    f.job.source.head = 'f'.repeat(40); await f.save(); blocked(/HEAD|baseline/i);
    f.job.source.head = originalHead;
    f.job.roots.draft = path.join(f.registry, 'new-draft'); await f.save(); blocked(/overlap/i);
    f.job.roots.draft = path.join(f.workspace, '.claude/drafts'); await f.save(); blocked(/overlap|managed/i);
  });
  it('rejects traversal, case-colliding destinations and create/update overlap', async () => {
    f.job.allowedChanges.create.push('../escape.md'); await f.save(); blocked(/relative|traversal/i);
    f.job.allowedChanges.create.pop(); f.job.allowedChanges.create.push('HOSTS/claude/agents/example.md'); await f.save(); blocked(/case|duplicate/i);
    f.job.allowedChanges.create.pop(); f.job.allowedChanges.update.push(f.job.allowedChanges.create[0]!); await f.save(); blocked(/overlap|duplicate/i);
  });
  it('requires an empty create draft and exact complete update baseline with immutable snapshot pins', async () => {
    const rel = 'hosts/claude/agents/example.md';
    const bytes = Buffer.from('Example reviewer. original\n');
    await fs.outputFile(path.join(f.draft, rel), bytes); blocked(/create|baseline/i);
    const snapshot = path.join(f.evidence, 'baseline/example.md'); await fs.outputFile(snapshot, bytes);
    f.job.operation = 'update'; f.job.allowedChanges = { create: [], update: [rel], delete: [] };
    f.job.baseline = [{ path: rel, sha256: sha256(bytes), bytes: bytes.length, snapshot }];
    await f.save();
    expect(f.run('check-job').exit).toBe(0);
    await fs.outputFile(path.join(f.draft, 'unrelated.md'), 'preserve'); blocked(/baseline|inventory/i);
    await fs.remove(path.join(f.draft, 'unrelated.md'));
    await fs.appendFile(snapshot, 'tampered'); blocked(/snapshot|hash|pin/i);
  });
  it('rejects linked ancestors even when the final draft does not exist', async () => {
    const outside = path.join(f.root, 'outside'); await fs.ensureDir(outside);
    const linked = path.join(f.workspace, 'linked'); await fs.symlink(outside, linked, 'junction');
    f.job.roots.draft = path.join(linked, 'absent'); await f.save(); blocked(/link/i);
  });
  it('does not execute job-supplied commands and rejects a spending or oversized check budget', async () => {
    const marker = path.join(f.workspace, 'must-not-exist');
    f.job.checks[0]!.argv = ['-e', `require('node:fs').writeFileSync(${JSON.stringify(marker)},'bad')`];
    await f.save();
    const result = f.run('check-job');
    expect(result.exit, result.raw).toBe(1); // Required native-validation command is no longer present.
    expect(await fs.pathExists(marker)).toBe(false);
    f.job.budget.maxUsd = 1; await f.save(); blocked(/budget|maxUsd|constant/i);
  });
});
