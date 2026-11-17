import path from 'node:path';
import fs from 'fs-extra';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { factoryJobFixture, sha256, type FactoryJobFixture } from './helpers/factory-job.js';
import { NO_ALT, NO_CASE, NO_SHORT, altLeafOf, otherCaseOf, shortLeafOf } from './helpers/path-spellings.js';

const CHECK_HANDBACK_SOURCE = path.resolve('registry/skills/realize-artifact/scripts/check-handback.mjs');
const CASE_SENSITIVE_ONLY = 'this volume ignores case, so another case names the same folder; the case runs only on a case-sensitive volume (Linux CI is its first run)';

describe('installed realization hand-back postflight', () => {
  let f: FactoryJobFixture;
  let result: ReturnType<typeof newResult>;
  let resultFile: string;
  const newResult = () => ({
    version: 1, jobId: f.job.id, jobDigest: f.digest(), status: 'draft',
    inventory: [] as { path: string; kind: string; bytes: number; sha256: string }[],
    diff: [] as { path: string; before: string | null; after: string | null }[],
    coverage: f.job.inputs.map(input => ({ input: input.path, sections: input.sections, rationale: 'Used these fixed input sections.' })),
    deltas: [{ kind: 'mapped', subject: 'Declared capabilities and floor', rationale: 'Native mapping inspected; quality review pending.' }],
    provenance: { disposition: 'original', evidence: [f.job.inputs.find(input => input.kind === 'core')!.path], findings: [] as string[] },
    checks: [] as { id: string; jobDigest: string; executable: string; argv: string[]; cwd: string; startedAt: string; endedAt: string; exitCode: number | null; classification: string; stdout: { path: string; sha256: string; bytes: number }; stderr: { path: string; sha256: string; bytes: number } }[],
    quality: { status: 'pending', findings: [] as string[] }, live: { status: 'unverified', reason: 'Offline only.' }, openItems: [] as string[],
    upstream: null as null | { base: string; sent: boolean; template: string; body: string },
  });
  const save = async () => { await fs.writeJson(resultFile, result, { spaces: 2 }); };
  const run = () => f.run('check-handback', ['--result', resultFile]);
  const blocked = (reason: RegExp): void => {
    const checked = run();
    expect(checked.exit, checked.raw).toBe(1);
    expect(checked.report?.ok, checked.raw).toBe(false);
    expect(checked.report?.findings.join('\n'), checked.raw).toMatch(reason);
  };
  const addFile = async (rel: string, text: string) => {
    await fs.outputFile(path.join(f.draft, rel), text);
    result.inventory.push({ path: rel, kind: 'file', bytes: Buffer.byteLength(text), sha256: sha256(text) });
    result.diff.push({ path: rel, before: null, after: text });
  };
  beforeEach(async () => {
    f = await factoryJobFixture();
    result = newResult(); resultFile = path.join(f.evidence, 'result.json');
    const check = f.job.checks[0]!;
    const logs = await Promise.all(['stdout', 'stderr'].map(async stream => {
      const file = path.join(f.evidence, `${stream}.txt`);
      const text = stream === 'stdout' ? JSON.stringify({ ok: true, kind: 'deterministic', findings: [], quality: 'pending', live: 'unverified' }) : '';
      await fs.writeFile(file, text); return { path: file, sha256: sha256(text), bytes: Buffer.byteLength(text) };
    }));
    result.checks.push({ ...check, jobDigest: f.digest(), startedAt: '2026-10-28T08:00:00.000Z', endedAt: '2026-10-28T08:00:01.000Z', exitCode: 0, classification: 'passed', stdout: logs[0]!, stderr: logs[1]! });
    // A receipt describes exact execution, not the job's required flag or timeout.
    delete (result.checks[0] as unknown as Record<string, unknown>).required;
    delete (result.checks[0] as unknown as Record<string, unknown>).timeoutSeconds;
    await addFile(f.job.artifact.paths[0]!, 'Example reviewer. bounded draft\n');
    await save();
  });
  afterEach(async () => { await fs.remove(f.root); });

  it('checks actual bytes and claims while keeping independent execution, quality and live proof unverified', () => {
    const checked = run();
    expect(checked.exit, checked.raw).toBe(0);
    expect(checked.report).toMatchObject({ ok: true, digest: f.digest(), quality: 'pending', live: 'unverified' });
    expect(JSON.parse(checked.raw).executionProof).toBe('unverified');
  });
  it('rejects a changed job digest or inventory hash', async () => {
    result.jobDigest = '0'.repeat(64); await save(); blocked(/digest/i);
    result.jobDigest = f.digest(); result.inventory[0]!.sha256 = '0'.repeat(64); await save(); blocked(/hash|inventory/i);
  });
  it('rejects omitted, extra and traversing returned paths', async () => {
    result.inventory = []; await save(); blocked(/inventory/i);
    result.inventory.push({ path: '../escape.md', kind: 'file', bytes: 0, sha256: sha256('') }); await save(); blocked(/traversal|relative/i);
    result.inventory[0]!.path = f.job.artifact.paths[0]!; result.inventory[0]!.bytes = 0; await save(); blocked(/inventory|hash/i);
    await fs.outputFile(path.join(f.draft, 'undeclared.md'), 'extra'); blocked(/scope|undeclared|inventory/i);
  });
  it('rejects duplicate returned paths and an actual linked draft file', async () => {
    result.inventory.push({ ...result.inventory[0]! }); await save(); blocked(/duplicate|case/i);
    result.inventory.pop(); await save();
    const rel = f.job.artifact.paths[0]!;
    const outside = path.join(f.evidence, 'external.md'); await fs.copy(path.join(f.draft, rel), outside);
    await fs.remove(path.join(f.draft, rel)); await fs.symlink(outside, path.join(f.draft, rel), 'file');
    blocked(/link/i);
  });
  it('reconstructs the actual complete before/after diff rather than trusting a worker summary', async () => {
    result.diff[0]!.after = 'different'; await save(); blocked(/diff/i);
    result.diff = []; await save(); blocked(/diff/i);
  });
  it('preserves a complete update baseline and refuses a change to an unrelated note', async () => {
    const rel = f.job.artifact.paths[0]!;
    const original = 'Example reviewer. original description\n';
    const note = 'Keep my note.\n';
    const baseline = async (file: string, text: string) => {
      const snapshot = path.join(f.evidence, 'baseline', file);
      await fs.outputFile(snapshot, text);
      return { path: file, bytes: Buffer.byteLength(text), sha256: sha256(text), snapshot };
    };
    f.job.operation = 'update'; f.job.allowedChanges = { create: [], update: [rel], delete: [] };
    f.job.baseline = await Promise.all([baseline(rel, original), baseline('unrelated.md', note)]);
    await fs.outputFile(path.join(f.draft, 'unrelated.md'), note);
    result.inventory.push({ path: 'unrelated.md', kind: 'file', bytes: Buffer.byteLength(note), sha256: sha256(note) });
    result.diff[0]!.before = original;
    result.jobDigest = f.digest(); result.checks[0]!.jobDigest = f.digest();
    await f.save(); await save();
    expect(run().exit).toBe(0);
    await fs.writeFile(path.join(f.draft, 'unrelated.md'), 'changed');
    result.inventory[1]!.bytes = 7; result.inventory[1]!.sha256 = sha256('changed');
    result.diff.push({ path: 'unrelated.md', before: note, after: 'changed' }); await save();
    blocked(/scope|undeclared/i);
  });
  it('refuses a missing required check and a pass classification with a nonzero actual exit', async () => {
    result.checks[0]!.exitCode = 1; await save(); blocked(/exit|classif/i);
    result.checks = []; await save(); blocked(/required.*check|check.*missing/i);
  });
  it('refuses altered logs, substituted argv, obsolete revision or over-budget receipts', async () => {
    const check = result.checks[0]!;
    check.argv = ['-e', 'throw new Error("must not run")']; await save(); blocked(/command|argv/i);
    check.argv = f.job.checks[0]!.argv; check.jobDigest = '0'.repeat(64); await save(); blocked(/digest|revision/i);
    check.jobDigest = f.digest(); check.endedAt = '2026-10-28T09:00:00.000Z'; await save(); blocked(/time|budget|duration/i);
    check.endedAt = '2026-10-28T08:00:01.000Z'; await save();
    await fs.appendFile(check.stdout.path, 'tampered'); blocked(/log|hash|pin/i);
  });
  it('rejects changed fixed values even with a matching inventory, and altered source pins', async () => {
    await fs.writeFile(path.join(f.draft, f.job.artifact.paths[0]!), 'Wrong role.');
    result.inventory[0]!.bytes = 11; result.inventory[0]!.sha256 = sha256('Wrong role.'); result.diff[0]!.after = 'Wrong role.';
    await save(); blocked(/fixed/i);
    await fs.writeFile(path.join(f.draft, f.job.artifact.paths[0]!), 'Example reviewer. bounded draft\n');
    await fs.appendFile(f.job.inputs[0]!.path, 'changed'); blocked(/hash|pin/i);
  });
  it('keeps worker quality findings visible without claiming an evaluator executed', async () => {
    result.quality = { status: 'findings', findings: ['Medium: the description may be too broad.'] }; await save();
    const checked = run(); expect(checked.exit, checked.raw).toBe(0);
    const report = JSON.parse(checked.raw) as { quality: string; qualityReport: { status: string; findings: string[] }; acceptedDraft: boolean };
    expect(report.qualityReport).toEqual(result.quality);
    expect(report.quality).toBe('pending'); expect(report.acceptedDraft).toBe(false);
  });
  it('accepts an honest partial report without promoting it to a completed draft', async () => {
    result.status = 'partial'; result.checks = []; result.openItems = ['Native checker unavailable.']; await save();
    const checked = run(); expect(checked.exit, checked.raw).toBe(0);
    expect(JSON.parse(checked.raw).acceptedDraft).toBe(false);
  });
  it('requires complete guide/binding coverage and explicit open items for blocked/partial results', async () => {
    result.coverage = []; await save(); blocked(/coverage/i);
    result.status = 'blocked'; result.openItems = []; await save(); blocked(/open.*item|blocked/i);
  });
  it('prepares the existing upstream dev contribution body without publishing', async () => {
    f.job.intent = 'upstream';
    const template = path.join(f.checkout, '.github/PULL_REQUEST_TEMPLATE/artifact-contribution.md');
    const body = '## Artifact contribution\nBase: dev\n'; await fs.outputFile(template, body);
    f.job.inputs.push({ kind: 'template', path: template, sha256: sha256(body), sections: ['whole template'], status: 'clear' });
    result.coverage.push({ input: template, sections: ['whole template'], rationale: 'Prepared the dev contribution body.' });
    result.upstream = { base: 'dev', sent: false, template, body: `${body}\nPrepared evidence: local draft only.\n` };
    result.jobDigest = f.digest(); result.checks[0]!.jobDigest = f.digest();
    await f.save(); await save(); expect(run().exit).toBe(0);
    result.upstream.sent = true; await save(); blocked(/sent|constant/i);
  });

  // P27-A: "inside the evidence root" grants only when the path is inside as a string and physically, in exact case where the volume is
  // case-sensitive. The hand-back has no root refusal of its own; its job's root rules are tested with check-job.
  describe('evidence-root grants compare physical paths as well as strings (P27-A)', () => {
    const logRefusal = 'Raw check log must stay within the fixed evidence root.';
    /** Moves the stdout log of the receipt to this spelling of a file and re-pins it. */
    const stdoutAt = async (file: string, spelled = file): Promise<void> => {
      const text = await fs.readFile(result.checks[0]!.stdout.path);
      await fs.outputFile(file, text);
      result.checks[0]!.stdout = { path: spelled, sha256: sha256(text), bytes: text.length };
      await save();
    };

    it('passes a raw log in an evidence subfolder named by its NTFS short name or other case (two spellings of a folder inside the evidence root)', async ctx => {
      const logs = path.join(f.evidence, 'Check Logs');
      await fs.ensureDir(logs);
      const alt = altLeafOf(logs, false);
      if (!alt) ctx.skip(NO_ALT);
      await stdoutAt(path.join(logs, 'stdout.txt'), path.join(alt!, 'stdout.txt'));
      const checked = run();
      expect(checked.exit, checked.raw).toBe(0);
    });

    it('refuses a raw log under the NTFS short name of the folder holding the evidence root (runs on Windows with short names, skipped otherwise; the string comparison refuses it too: a physical match alone never grants)', async ctx => {
      const short = shortLeafOf(f.root);
      if (!short) ctx.skip(NO_SHORT);
      const rel = path.relative(f.root, path.join(f.evidence, 'stdout.txt'));
      await stdoutAt(path.join(f.root, rel), path.join(short!, rel));
      blocked(new RegExp(`^${logRefusal.replace(/\./g, '\\.')}$`));
    });

    it('accepts a raw log under another case of the evidence root wherever the volume ignores case (detected on the real volume, skipped where it is case-sensitive): the folded strings and the real paths agree, as before P27-A', async ctx => {
      const flipped = otherCaseOf(f.evidence);
      if (!flipped) ctx.skip(NO_CASE);
      await stdoutAt(path.join(f.evidence, 'stdout.txt'), path.join(flipped!, 'stdout.txt'));
      const checked = run();
      expect(checked.exit, checked.raw).toBe(0);
    });

    it('refuses a raw log in a folder that differs from the evidence root only in case (runs only on a case-sensitive volume; Linux CI is its first run)', async ctx => {
      if (otherCaseOf(f.evidence)) ctx.skip(CASE_SENSITIVE_ONLY);
      const upper = path.join(path.dirname(f.evidence), path.basename(f.evidence).toUpperCase());
      // Before P27-A the case-folded string comparison counted …/EVIDENCE/stdout.txt as inside the evidence root …/evidence. The string
      // part still folds; the physical part (exact case off Windows; EVIDENCE exists, so its real path is …/EVIDENCE) refuses it.
      await stdoutAt(path.join(upper, 'stdout.txt'));
      blocked(new RegExp(`^${logRefusal.replace(/\./g, '\\.')}$`));
    });

    it('takes its physical comparison from check-job.mjs, whose real-path function refuses errors other than ENOENT/ENOTDIR (source text)', async () => {
      const text = await fs.readFile(CHECK_HANDBACK_SOURCE, 'utf8');
      expect(text).toMatch(/import \{[^}]*\bphysicallyWithin\b[^}]*\bwithin\b[^}]*\} from '\.\/check-job\.mjs';/);
      // Each evidence-root grant keeps the folded string test and adds the physical one.
      expect(text).toContain('!(within(job.roots.evidence, file) && physicallyWithin(job.roots.evidence, file))');
      expect(text).toContain('if (!physicallyWithin(job.roots.evidence, log.path))');
      const jobText = await fs.readFile(path.resolve('registry/skills/realize-artifact/scripts/check-job.mjs'), 'utf8');
      expect(jobText).toContain('export const physicallyWithin = (parent, child) => withinExact(physical(parent), physical(child));');
      expect(jobText).toContain('const withinBoth = (parent, child) => within(parent, child) && physicallyWithin(parent, child);');
      expect(jobText).toMatch(/error\?\.code !== 'ENOENT' && error\?\.code !== 'ENOTDIR'/);
      expect(jobText).toContain('Cannot resolve the physical path of');
    });
  });
});
