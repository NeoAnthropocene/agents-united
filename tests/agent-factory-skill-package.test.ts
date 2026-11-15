import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import type { SpawnSyncReturns } from 'node:child_process';
import fs from 'fs-extra';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { LockfileManifest } from '../src/core/types.js';
import { INVOICE_FILES } from './helpers/skill-candidate.js';
import { candidateDigestOf, digest, inventoryOf, prepareSkillTask } from './helpers/skill-task.js';
import type { Json, SkillTaskFixture } from './helpers/skill-task.js';
import { prepareEvaluationJob, reviewPin } from './helpers/factory-evaluation.js';
import { COORDINATOR_SUPPORT, cleanFactoryEnv } from './helpers/factory-coordinator.js';

/**
 * P8b stage 1, from the actual offline npm package: the installed checker, the installed `draft.mjs` as the producer
 * emulation (one run per revision, never rerun by the caller), the packaged `skill-check` with the packaged frozen corpus and
 * the installed `check-review.mjs`. No source-registry overlay and no Host, model or provider session. Fixture roots live under
 * the OS temp directory (never under `.codex`, which `draft.mjs` rejects). Reviewer JSON below is labelled synthetic.
 */
const NEW_SUPPORT = ['references/skill-authoring.md', 'scripts/check-skill-return.mjs', 'assets/skill-task.schema.json', 'assets/skill-return.schema.json'] as const;
const AUTHOR_SKILL_FILES = ['SKILL.md', 'references/job.md', 'references/provenance.md', 'references/quality.md', 'examples/one-draft.md', 'assets/report.md', 'scripts/draft.mjs', 'references/skill-attribution.md'] as const;
const sha = (bytes: Buffer): string => digest(bytes);
const parse = (result: SpawnSyncReturns<string>, stream: 'stdout' | 'stderr' = 'stdout'): Json => JSON.parse(result[stream]) as Json;

describe('one Skill draft, checked return and review records from the actual offline npm package', () => {
  let root: string, packageRoot: string, registry: string, consumer: string, cli: string, corpus: string, checker: string;
  const fixtures: SkillTaskFixture[] = [];
  const cleanups: Array<() => Promise<void>> = [];

  beforeAll(async () => {
    root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'au-skill-pack-')));
    const npmCli = path.join(path.dirname(process.env.npm_execpath ?? ''), 'npm-cli.js');
    if (!await fs.pathExists(npmCli)) throw new Error('Use npm to supply its offline packaging CLI.');
    const packed = JSON.parse(execFileSync(process.execPath, [npmCli, 'pack', '--offline', '--ignore-scripts', '--json', '--pack-destination', root], {
      cwd: process.cwd(), encoding: 'utf8',
    })) as Array<{ filename: string }>;
    const runtime = path.join(root, 'runtime');
    execFileSync(process.execPath, [npmCli, 'install', '--offline', '--ignore-scripts', '--no-audit', '--no-fund', '--prefix', runtime,
      path.join(root, packed[0]!.filename)], { encoding: 'utf8' });
    packageRoot = path.join(runtime, 'node_modules/agents-united');
    registry = path.join(packageRoot, 'registry');
    consumer = path.join(root, 'consumer');
    await fs.ensureDir(consumer);
    cli = path.join(packageRoot, 'dist/cli.js');
    corpus = path.join(registry, 'quality/skill-boilerplate-corpus.txt');
    const installed = spawnSync(process.execPath, [cli, 'add', 'agent-factory', '-t', 'claude', '--native', '--copy', '--allow-under-construction', '-y'], {
      cwd: consumer, encoding: 'utf8', env: cleanFactoryEnv({ CI: 'true' }), timeout: 60_000,
    });
    expect(installed.status, installed.stdout + installed.stderr).toBe(0);
    checker = path.join(consumer, '.claude/skills/coordinate-artifact/scripts/check-skill-return.mjs');
  }, 240_000);
  afterAll(async () => { if (root) await fs.remove(root); });
  afterEach(async () => {
    while (fixtures.length) await fixtures.pop()!.cleanup();
    while (cleanups.length) await cleanups.pop()!();
  });

  /** A fixture whose installed tools, packaged validator and corpus are the consumer's and the package's own bytes. */
  const make = async (options: { operation?: 'create' | 'repair'; name?: string; changes?: Record<string, string> } = {}): Promise<SkillTaskFixture> => {
    const fx = await prepareSkillTask({ ...options, consumer, checker, validator: cli, corpus });
    fixtures.push(fx);
    return fx;
  };
  const skillCheck = (draft: string): SpawnSyncReturns<string> => spawnSync(process.execPath,
    [cli, 'skill-check', '--artifact', draft, '--corpus', corpus, '--policy', 'agents-united-original'], { cwd: consumer, encoding: 'utf8', timeout: 60_000 });
  const failureOf = (result: SpawnSyncReturns<string>, code: string, phase: string): Json => {
    expect(result.status, result.stdout).toBe(1);
    expect(result.stdout).toBe('');
    const body = parse(result, 'stderr');
    expect(body).toMatchObject({ version: 1, kind: 'deterministic', code, phase, quality: 'pending', executionProof: 'unverified', live: 'unverified', acceptedDraft: false });
    return body;
  };
  /** Rewrite the helper stdout (the report) the way a forging producer could, then re-pin it into the return. */
  const forgeReport = async (produced: Awaited<ReturnType<SkillTaskFixture['produce']>>, edit: (report: Json) => void): Promise<void> => {
    const report = JSON.parse(await fs.readFile(produced.stdoutFile, 'utf8')) as Json;
    edit(report);
    await fs.writeFile(produced.stdoutFile, JSON.stringify(report, null, 2));
    await produced.repin();
  };

  it('delivers the four coordinator files, owned and hashed by the installed lock, with the author-skill closure and no evals', async () => {
    const lock = await fs.readJson(path.join(consumer, '.claude/.agents-united/agents-united.json')) as LockfileManifest;
    const receipt = await fs.readJson(path.join(consumer, '.claude/skills/coordinate-artifact/assets/claude-binding.json')) as { requiredSupport: string[] };
    expect(receipt.requiredSupport).toHaveLength(COORDINATOR_SUPPORT.length);
    for (const rel of NEW_SUPPORT) {
      expect(receipt.requiredSupport, rel).toContain(rel);
      const installedRel = `.claude/skills/coordinate-artifact/${rel}`;
      const bytes = await fs.readFile(path.join(consumer, installedRel));
      expect(lock.projections?.[installedRel]?.owners, rel).toContain('agent-factory');
      expect(lock.projections?.[installedRel]?.hash, rel).toBe(`sha256:${sha(bytes)}`);
      expect(bytes, rel).toEqual(await fs.readFile(path.join(registry, 'skills/coordinate-artifact', ...rel.split('/'))));
    }
    for (const rel of AUTHOR_SKILL_FILES) expect((await fs.stat(path.join(consumer, '.claude/skills/author-skill', ...rel.split('/')))).isFile(), rel).toBe(true);
    for (const skill of ['coordinate-artifact', 'author-skill', 'realize-artifact', 'evaluate-artifact']) {
      expect(await fs.pathExists(path.join(consumer, '.claude/skills', skill, 'evals')), skill).toBe(false);
    }
    const help = spawnSync(process.execPath, [checker, '--help'], { cwd: consumer, encoding: 'utf8' });
    expect(help.status, help.stderr).toBe(0);
    expect(help.stdout).toContain('check-skill-return');
    expect(parse(spawnSync(process.execPath, [checker, '--job', 'relative.json'], { cwd: consumer, encoding: 'utf8' }), 'stderr').code).toBe('USAGE');
  });

  it('keeps source-independent startup healthy with the complete package registry moved away, and refuses a missing new file', async () => {
    const away = path.join(packageRoot, 'registry-unavailable');
    const preview = (): SpawnSyncReturns<string> => spawnSync(process.execPath, [cli, 'start', 'agent-factory', '--host', 'claude', '--dry-run'], {
      cwd: consumer, encoding: 'utf8', env: cleanFactoryEnv({ CLAUDE_BIN_PATH: process.execPath, PATH: '', CI: 'true' }), timeout: 20_000,
    });
    await fs.move(registry, away);
    cleanups.push(async () => { if (!await fs.pathExists(registry)) await fs.move(away, registry); });
    const bytes = await fs.readFile(checker);
    cleanups.push(async () => { await fs.writeFile(checker, bytes); });
    const healthy = preview();
    expect(healthy.status, healthy.stdout + healthy.stderr).toBe(0);
    expect(healthy.stdout).toContain('orchestrator-agent-factory');
    expect(healthy.stdout).not.toContain('orchestrator-engineering');
    await fs.remove(checker);
    const missing = preview();
    expect(missing.status, missing.stdout).not.toBe(0);
    expect(missing.stdout + missing.stderr).toContain('check-skill-return.mjs');
    await fs.writeFile(checker, bytes);
    const restored = preview();
    expect(restored.status, restored.stdout + restored.stderr).toBe(0);
  }, 60_000);

  it('checks a created draft with the installed tools: one producer run, one digest across the checker, skill-check and check-review', async () => {
    const fx = await make({ name: 'invoice-action-csv', changes: INVOICE_FILES });
    const pre = fx.pre();
    expect(pre.status, pre.stderr).toBe(0);
    expect(parse(pre)).toMatchObject({
      phase: 'preflight', recordValid: true, operation: 'create', revision: 'r0', taskDigest: digest(JSON.stringify(sortedDeep(fx.task))),
      pins: { checker: { path: checker }, validator: { path: cli }, corpus: { path: corpus } },
      quality: 'pending', executionProof: 'unverified', live: 'unverified', acceptedDraft: false,
    });
    expect(parse(pre).pins.installed.map((pin: Json) => path.relative(path.join(consumer, '.claude/skills/author-skill'), pin.path).replaceAll('\\', '/')).sort()).toEqual([...AUTHOR_SKILL_FILES].sort());

    // Producer emulation: the INSTALLED draft.mjs, once. The caller never runs it again.
    const produced = await fx.produce();
    expect(produced.run.status, produced.run.stderr).toBe(0);
    expect(produced.job.draftRoot).toBe(fx.draft);
    const post = fx.post();
    expect(post.status, post.stderr).toBe(0);
    const checked = parse(post);
    const inventory = await inventoryOf(fx.draft);
    expect(checked).toMatchObject({ phase: 'postflight', recordValid: true, helper: { exitCode: 0, reportStatus: 'draft-prepared' },
      claimsNotAccepted: ['inventory', 'changed', 'claimedChecks'], producerIdentity: 'unauthenticated', acceptedDraft: false });
    expect(checked.candidate.inventory).toEqual(inventory);
    expect(checked.candidate.changed.map((item: Json) => item.path).sort()).toEqual(Object.keys(INVOICE_FILES).sort());
    expect(checked.candidate.preserved).toEqual([]);

    // The packaged validator and the packaged frozen corpus, on the very same bytes.
    const validated = skillCheck(fx.draft);
    expect(validated.status, validated.stdout + validated.stderr).toBe(0);
    const validatedJson = parse(validated);
    expect(validatedJson).toMatchObject({ status: 'passed', inventoryComplete: true, acceptedDraft: false });
    expect(validatedJson.checks.map((item: Json) => item.status)).toEqual(validatedJson.checks.map(() => 'passed'));
    expect(validatedJson.candidateDigest).toBe(checked.candidate.candidateDigest);

    // The installed review checker, on a P5 skill job built from the task and the real skill-check receipt.
    const reviewRoot = path.join(root, `review-${fx.task.id}`);
    await fs.ensureDir(reviewRoot);
    const selected = await prepareEvaluationJob({ root: reviewRoot, registry, source: rel => path.join(registry, ...rel.split('/')),
      installed: rel => path.join(consumer, ...rel.split('/')) });
    const { job } = selected;
    job.id = 'invoice-action-review';
    job.subject = { kind: 'skill', identity: 'invoice-action-csv', definition: null, target: null, paths: ['SKILL.md'] };
    job.roots.candidate = fx.draft;
    job.candidate.files = inventory.map(item => ({ path: item.path as string, kind: item.kind as string, bytes: item.bytes as number, sha256: item.sha256 as string,
      role: item.path === 'SKILL.md' ? 'subject' : 'support' }));
    job.objective = fx.task.objective;
    job.fixedValues = fx.task.fixedValues;
    job.acceptance = fx.task.acceptance;
    Object.assign(job.inputs.find(input => input.kind === 'validator')!, await reviewPin(cli));
    job.roots.read.push(cli);
    const checkDigest = checked.candidate.candidateDigest as string;
    const command = { executable: job.runtime.executable, argv: [cli, 'skill-check', '--artifact', fx.draft, '--corpus', corpus, '--policy', 'agents-united-original'], cwd: consumer };
    const rawFile = path.join(selected.evidence, 'checks/skill-check.raw.txt'), receiptFile = path.join(selected.evidence, 'checks/skill-check.receipt.json');
    await fs.writeFile(rawFile, validated.stdout + validated.stderr);
    const raw = await reviewPin(rawFile);
    await fs.writeJson(receiptFile, { version: 1, id: 'skill-check', kind: 'deterministic', command, candidateDigest: checkDigest, status: 'passed', exit: 0, raw });
    job.checks = [{ id: 'skill-check', required: true, status: 'passed', command, candidateDigest: checkDigest, exit: 0, raw, receipt: await reviewPin(receiptFile) }];
    await fs.writeJson(selected.jobFile, job);
    const reviewChecker = path.join(consumer, '.claude/skills/evaluate-artifact/scripts/check-review.mjs');
    const review = (...args: string[]): SpawnSyncReturns<string> => spawnSync(process.execPath, [reviewChecker, '--job', selected.jobFile, ...args], { cwd: consumer, encoding: 'utf8', timeout: 30_000 });
    const reviewPre = review();
    expect(reviewPre.status, reviewPre.stderr).toBe(0);
    const reviewed = parse(reviewPre);
    expect(reviewed).toMatchObject({ recordValid: true, ready: true, checks: [{ id: 'skill-check', status: 'passed', exit: 0 }] });
    expect(reviewed.candidateDigest).toBe(checkDigest);
    expect(candidateDigestOf(inventory)).toBe(checkDigest);

    // A synthetic reviewer opinion (no model, no Host): it only exercises the record plumbing on the same candidate digest.
    const skillText = (await fs.readFile(path.join(fx.draft, 'SKILL.md'), 'utf8')).replace(/\r\n/g, '\n').split('\n');
    const citation = { sourceId: 'candidate', path: 'SKILL.md', sha256: inventory.find(item => item.path === 'SKILL.md')!.sha256, startLine: 2, endLine: 2, quote: skillText[1]! };
    const resultFile = path.join(selected.evidence, 'result.json');
    await fs.writeJson(resultFile, { version: 1, jobId: job.id, jobDigest: reviewed.jobDigest, candidateDigest: checkDigest,
      status: 'reviewed', opinion: 'no-blocking-findings', subject: job.subject, inventory, inventorySource: 'caller-provided',
      coverage: inventory.map(item => ({ path: item.path, status: 'reviewed', rationale: 'Synthetic package-proof coverage; no model was invoked.' })),
      criteria: job.rubric.criteria.map(item => ({ id: item.id, outcome: item.applicable ? 'satisfactory' : 'not-applicable',
        rationale: 'Synthetic record exercises the fixed criterion protocol, not an actual quality judgment.', citations: item.applicable ? [citation] : [] })),
      findings: [], deterministicEvidence: job.checks.map(check => ({ id: check.id, status: check.status, exit: check.exit,
        rawSha256: check.raw.sha256, receiptSha256: check.receipt.sha256, observation: 'Caller executed the actual packaged skill-check on the draft.' })),
      limitations: ['Synthetic reviewer JSON. No reviewer, Host, model, provider or private session was invoked.'], live: 'unverified', openItems: [], acceptedDraft: false });
    const reviewPost = review('--result', resultFile);
    expect(reviewPost.status, reviewPost.stderr).toBe(0);
    expect(parse(reviewPost)).toMatchObject({ recordValid: true, candidateMatch: true, quality: 'pending', executionProof: 'unverified', live: 'unverified', acceptedDraft: false });

    // The caller read every file; the draft is exactly what the producer left and the producer wrote nothing else.
    expect(await inventoryOf(fx.draft)).toEqual(inventory);
    expect(await fs.readdir(path.dirname(fx.draft))).toEqual(['invoice-action-csv']);
  }, 120_000);

  describe('mutations on the installed copy, one fault each', () => {
    it('refuses a stale task digest echoed by the return', async () => {
      const fx = await make();
      const produced = await fx.produce();
      produced.ret.taskDigest = '0'.repeat(64);
      await produced.save();
      failureOf(fx.post(), 'DIGEST_MISMATCH', 'postflight');
    });

    it('refuses an extra path left in the draft, an edited maintainer note and a false report diff', async () => {
      const extra = await make();
      await extra.produce();
      await fs.outputFile(path.join(extra.draft, 'extra.md'), 'An unlisted file.\n');
      failureOf(extra.post(), 'SCOPE_VIOLATION', 'postflight');

      const repair = await make({ operation: 'repair' });
      await repair.produce();
      expect(repair.post().status).toBe(0);
      await fs.writeFile(path.join(repair.draft, 'notes/user.md'), 'Changed after the run.\n');
      failureOf(repair.post(), 'PRESERVATION', 'postflight');

      const diff = await make();
      const produced = await diff.produce();
      await forgeReport(produced, report => { report.diff[0].after = 'A different text than the saved changes.\n'; });
      failureOf(diff.post(), 'DIFF_MISMATCH', 'postflight');
    });

    it('refuses a report with missing provenance or forged validation text', async () => {
      const missing = await make();
      await forgeReport(await missing.produce(), report => { delete report.provenance; });
      failureOf(missing.post(), 'PROVENANCE_MISMATCH', 'postflight');

      const forged = await make();
      await forgeReport(await forged.produce(), report => { report.validation = { status: 'passed', reason: 'skill-check passed (forged).' }; });
      failureOf(forged.post(), 'HELPER_RECORD', 'postflight');
    });

    it('does not accept a forged claimed check: the packaged skill-check still fails the draft the return calls validated', async () => {
      const fx = await make();
      const produced = await fx.produce();
      produced.ret.claimedChecks = [{ name: 'skill-check', command: 'agents skill-check --artifact draft', exitCode: 0, raw: null }];
      await produced.save();
      const post = fx.post();
      expect(post.status, post.stderr).toBe(0);
      const checked = parse(post);
      expect(checked.claimsNotAccepted).toContain('claimedChecks');
      expect(checked.acceptedDraft).toBe(false);
      const actual = skillCheck(fx.draft);
      expect(actual.status).not.toBe(0);
      expect(parse(actual)).toMatchObject({ acceptedDraft: false });
      expect(parse(actual).status).not.toBe('passed');
      expect(parse(actual).candidateDigest).toBe(checked.candidate.candidateDigest);
    });

    it('refuses an installed author-skill file or the installed checker edited after the task pinned it', async () => {
      const fx = await make();
      const draftScript = fx.inst('scripts/draft.mjs'), original = await fs.readFile(draftScript);
      cleanups.push(async () => { await fs.writeFile(draftScript, original); });
      await fs.appendFile(draftScript, '\n// edited after the pin\n');
      failureOf(fx.pre(), 'CLOSURE_MISSING', 'preflight');
      await fs.writeFile(draftScript, original);
      expect(fx.pre().status).toBe(0);
      const checkerBytes = await fs.readFile(checker);
      cleanups.push(async () => { await fs.writeFile(checker, checkerBytes); });
      await fs.appendFile(checker, '\n// edited after the pin\n');
      failureOf(fx.pre(), 'RUNTIME_MISMATCH', 'preflight');
      await fs.writeFile(checker, checkerBytes);
      expect(fx.pre().status).toBe(0);
      const entry = fx.inst('SKILL.md'), entryBytes = await fs.readFile(entry);
      cleanups.push(async () => { await fs.writeFile(entry, entryBytes); });
      await fs.writeFile(entry, entryBytes.toString('utf8').replace(/^context: fork\r?\n/m, ''));
      await fx.repinInstalled('SKILL.md');
      failureOf(fx.pre(), 'LOADER_MECHANISM', 'preflight');
    });
  });
});

/** Recursively sorted-key copy, so `JSON.stringify` equals the checker's canonical form. */
function sortedDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortedDeep);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value as Json).sort().map(key => [key, sortedDeep((value as Json)[key])]));
  }
  return value;
}
