import path from 'node:path';
import fs from 'fs-extra';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { factoryJobFixture, sha256, type FactoryJobFixture } from './helpers/factory-job.js';
import { NO_ALT, NO_CASE, NO_SHORT, altLeafOf, otherCaseOf, shortLeafOf } from './helpers/path-spellings.js';

const CHECK_JOB_SOURCE = path.resolve('registry/skills/realize-artifact/scripts/check-job.mjs');
const CASE_SENSITIVE_ONLY = 'this volume ignores case, so another case names the same folder; the case runs only on a case-sensitive volume (Linux CI is its first run)';

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
  it('ADR 0072: pins the canonical agent the registry holds, and a declared coverage file gets --coverage, the .json format and no deletion', async () => {
    const native = f.job.checks.find(check => check.id === 'native')!;
    const coverageRel = 'hosts/claude/agents/example.coverage.json';
    // A canonical agent in the selected registry must be pinned and named with --canonical.
    const canonicalFile = path.join(f.registry, 'agents/subagent-example.md');
    await fs.outputFile(canonicalFile, '# canonical agent fixture\n');
    blocked(/canonical input/i);
    f.job.inputs.push({ kind: 'canonical', path: canonicalFile, sha256: sha256(await fs.readFile(canonicalFile)), sections: ['Primary Directives'], status: 'clear' });
    await f.save(); blocked(/native-validation checker command/i);
    native.argv.push('--canonical', canonicalFile);
    await f.save();
    expect(f.run('check-job').exit, f.run('check-job').raw).toBe(0);
    // A declared coverage file must be on the same check as --coverage.
    f.job.allowedChanges.create.push(coverageRel);
    await f.save(); blocked(/native-validation checker command/i);
    native.argv.push('--coverage', path.join(f.draft, coverageRel));
    await f.save();
    expect(f.run('check-job').exit, f.run('check-job').raw).toBe(0);
    f.job.constraints.formats = ['.md'];
    await f.save(); blocked(/\.json among the allowed formats/);
    f.job.constraints.formats = ['.md', '.json'];
    f.job.allowedChanges.create.pop(); f.job.allowedChanges.delete.push(coverageRel);
    await f.save(); blocked(/never deleted/);
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

  // P27-A: the root rules compare physical paths as well as strings. A refusal holds when the paths overlap as strings or physically;
  // a grant ("inside this root", "this is the pinned file") needs both, in exact case where the volume is case-sensitive.
  describe('root rules compare physical paths as well as strings (P27-A)', () => {
    const overlap = /^Writable\/source\/managed\/protected roots overlap: /;
    /** Moves the draft root, and the required native-validation command that names it. */
    const draftAt = (draft: string): void => {
      f.job.roots.draft = draft;
      const at = f.job.checks[0]!.argv.indexOf('--artifact') + 1;
      expect(at).toBeGreaterThan(0);
      f.job.checks[0]!.argv[at] = path.join(draft, f.job.artifact.paths[0]!);
    };
    const finding = (): string => {
      const result = f.run('check-job');
      expect(result.exit, result.raw).toBe(1);
      expect(result.report?.ok, result.raw).toBe(false);
      return result.report!.findings.join('\n');
    };

    it('refuses a draft root inside a protected root given by its NTFS short name (runs on Windows with short names, skipped otherwise)', async ctx => {
      const prot = path.join(f.workspace, 'Protected Folder');
      await fs.ensureDir(prot);
      const short = shortLeafOf(prot);
      if (!short) ctx.skip(NO_SHORT);
      f.job.roots.protected = [prot];
      // Accepted before P27-A: as strings workspace\PROTEC~1\draft is not inside workspace\Protected Folder.
      draftAt(path.join(short!, 'draft'));
      await f.save();
      expect(finding()).toMatch(overlap);
      expect(await fs.pathExists(path.join(prot, 'draft'))).toBe(false);
    });

    it('refuses a draft root inside another case of a protected root (runs where the volume ignores case, skipped otherwise; a compatibility case that the case-folded string comparison refuses too)', async ctx => {
      const prot = path.join(f.workspace, 'prot-dir');
      await fs.ensureDir(prot);
      const flipped = otherCaseOf(prot);
      if (!flipped) ctx.skip(NO_CASE);
      f.job.roots.protected = [prot];
      draftAt(path.join(flipped!, 'draft'));
      await f.save();
      expect(finding()).toMatch(overlap);
    });

    it('passes a legal job whose disjoint roots are given in two spellings (a protected and a managed folder by their short name or other case, the rest long)', async ctx => {
      const prot = path.join(f.workspace, 'Protected Folder');
      const managed = path.join(f.workspace, 'Managed Folder');
      await fs.ensureDir(prot); await fs.ensureDir(managed);
      const altProt = altLeafOf(prot, false), altManaged = altLeafOf(managed, false);
      if (!altProt || !altManaged) ctx.skip(NO_ALT);
      f.job.roots.protected = [altProt!];
      f.job.roots.managed = [altManaged!];
      await f.save();
      const result = f.run('check-job');
      expect(result.exit, result.raw).toBe(0);
      expect(result.report).toMatchObject({ ok: true, digest: f.digest() });
    });

    it('refuses a check cwd in a folder that differs from the checkout only in case (runs only on a case-sensitive volume; Linux CI is its first run)', async ctx => {
      if (otherCaseOf(f.checkout)) ctx.skip(CASE_SENSITIVE_ONLY);
      const upper = path.join(path.dirname(f.checkout), path.basename(f.checkout).toUpperCase());
      await fs.ensureDir(upper);
      f.job.checks[0]!.cwd = upper;
      await f.save();
      // Before P27-A the case-folded string comparison counted …/SOURCE as inside the checkout …/source. The string part still folds; the
      // physical part (exact case off Windows; SOURCE exists, so its real path is …/SOURCE) refuses it.
      expect(finding()).toBe('Check cwd must be within selected validation checkout.');
    });

    it('resolves physical paths by walking up only on ENOENT or ENOTDIR and refuses any other real-path error (source text; EACCES cannot be produced portably)', async () => {
      const text = await fs.readFile(CHECK_JOB_SOURCE, 'utf8');
      expect(text).toMatch(/error\?\.code !== 'ENOENT' && error\?\.code !== 'ENOTDIR'/);
      expect(text).toContain('Cannot resolve the physical path of');
      expect(text).toContain('fs.realpathSync.native(current)');
      expect(text).toContain('const overlaps = (a, b) => [[a, b], [physical(a), physical(b)]].some(([x, y]) => within(x, y) || within(y, x));');
    });
  });
});
