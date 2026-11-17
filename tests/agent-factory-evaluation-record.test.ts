import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { spawnSync } from 'node:child_process';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { InstallEngine } from '../src/core/installer.js';
import { RegistryResolver } from '../src/core/registry.js';
import { prepareProductionEvaluator } from './helpers/factory-evaluator.js';
import { evaluationResult, evaluationTree, prepareEvaluationJob, prepareEvaluationKind, reviewPin } from './helpers/factory-evaluation.js';
import { NO_ALT, NO_CASE, NO_SHORT, altLeafOf, otherCaseOf, shortLeafOf } from './helpers/path-spellings.js';

const CHECK_REVIEW_SOURCE = path.resolve('registry/skills/evaluate-artifact/scripts/check-review.mjs');
const CASE_SENSITIVE_ONLY = 'this volume ignores case, so another case names the same folder; the case runs only on a case-sensitive volume (Linux CI is its first run)';

describe('caller-only review records through the installed evaluator CLI', () => {
  let fixture: Awaited<ReturnType<typeof prepareProductionEvaluator>>;
  beforeEach(async () => {
    fixture = await prepareProductionEvaluator(await fs.mkdtemp(path.join(os.tmpdir(), 'au-review-record-')));
    await new InstallEngine(new RegistryResolver(fixture.registry)).install('agent-factory', fixture.options);
  });
  afterEach(async () => { await fs.remove(fixture.root); });
  const run = (args: string[]) => spawnSync(process.execPath, [fixture.installed('.claude/skills/evaluate-artifact/scripts/check-review.mjs'), ...args], {
    cwd: fixture.workspace, encoding: 'utf8', timeout: 10_000,
  });

  it('ships an executable help route requiring no model, network or source checkout', () => {
    const result = run(['--help']);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('--job <absolute-job.json> [--result <absolute-result.json>]');
    expect(result.stdout).toContain('does not run validators or a reviewer');
  });

  it('checks a complete pinned review job and an actual caller-run receipt while preserving all inputs', async () => {
    const selected = await prepareEvaluationJob(fixture);
    const before = await fs.readFile(path.join(selected.candidate, 'SKILL.md'));
    const result = run(['--job', selected.jobFile]);
    expect(result.status, result.stderr).toBe(0);
    const record = JSON.parse(result.stdout);
    expect(record).toMatchObject({ version: 1, kind: 'deterministic', recordValid: true, ready: true,
      candidateDigest: selected.candidateDigest, inventory: selected.inventory,
      quality: 'pending', executionProof: 'unverified', live: 'unverified', acceptedDraft: false });
    expect(record.checks).toMatchObject([{ id: 'skill-layout', status: 'passed', exit: 0 }]);
    expect(await fs.readFile(path.join(selected.candidate, 'SKILL.md'))).toEqual(before);
  });

  it('refuses an adaptation claim without pinned source, licence and comparison evidence', async () => {
    const selected = await prepareEvaluationJob(fixture);
    selected.job.provenance.disposition = 'adapted';
    await fs.writeJson(selected.jobFile, selected.job);
    const result = run(['--job', selected.jobFile]);
    expect(result.status).toBe(1);
    expect(JSON.parse(result.stderr).reason).toMatch(/adapted.*source.*licence.*comparison/i);
  });

  it('checks a caller-saved synthetic quality record and actual returned path/hash without accepting the draft', async () => {
    const selected = await prepareEvaluationJob(fixture);
    const preflight = run(['--job', selected.jobFile]);
    expect(preflight.status, preflight.stderr).toBe(0);
    const resultFile = path.join(selected.evidence, 'result.json');
    await fs.writeJson(resultFile, evaluationResult(selected, JSON.parse(preflight.stdout)));
    const actual = run(['--job', selected.jobFile, '--result', resultFile]);
    expect(actual.status, actual.stderr).toBe(0);
    expect(JSON.parse(actual.stdout)).toMatchObject({ kind: 'deterministic', recordValid: true, candidateMatch: true,
      result: await reviewPin(resultFile), opinion: 'no-blocking-findings', quality: 'pending',
      executionProof: 'unverified', live: 'unverified', acceptedDraft: false });
  });

  it('refuses a fabricated quotation in a returned criterion finding', async () => {
    const selected = await prepareEvaluationJob(fixture);
    const preflight = run(['--job', selected.jobFile]);
    expect(preflight.status, preflight.stderr).toBe(0);
    const result = evaluationResult(selected, JSON.parse(preflight.stdout));
    result.criteria[0]!.citations[0]!.quote = 'An invented promise absent from the file.';
    const file = path.join(selected.evidence, 'result.json');
    await fs.writeJson(file, result);
    const actual = run(['--job', selected.jobFile, '--result', file]);
    expect(actual.status).toBe(1);
    expect(JSON.parse(actual.stderr).reason).toMatch(/citation.*quote/i);
  });

  // Fix 1 (finding S1-B of the 2026-11-15 headless factory runs): the coordinator saved the check output and told the evaluator to read it, but the
  // review job gave that file no input id, so the evaluator's citation of it was refused. The schema and the checker already allow the pin: an input of
  // kind `validator` whose path sits under a declared read root and outside the review root (the review root's own checks/<id>.raw.txt belongs to `checks[]`).
  it('lets a result cite a saved check output that the job pins as an input, and refuses the same citation when the job does not pin it', async () => {
    const selected = await prepareEvaluationJob(fixture);
    const saved = path.join(fixture.root, 'saved-checks');
    const copy = path.join(saved, 'native-check.raw.txt');
    await fs.ensureDir(saved);
    await fs.copy(selected.rawFile, copy);
    const withoutPin = selected.job.inputs.length;
    selected.job.roots.read.push(saved);
    selected.job.inputs.push({ id: 'native-check-raw', kind: 'validator', ...await reviewPin(copy), sections: [], status: 'clear', required: true });
    await fs.writeJson(selected.jobFile, selected.job);
    const preflight = run(['--job', selected.jobFile]);
    expect(preflight.status, preflight.stderr).toBe(0);
    const citeLog = (result: ReturnType<typeof evaluationResult>, sourceId: string) => {
      result.criteria[0]!.citations = [{ sourceId, path: 'native-check.raw.txt', sha256: selected.job.inputs.at(-1)!.sha256,
        startLine: 1, endLine: 1, quote: 'selected fixture layout checked' }];
      return result;
    };
    const file = path.join(selected.evidence, 'result.json');
    await fs.writeJson(file, citeLog(evaluationResult(selected, JSON.parse(preflight.stdout)), 'native-check-raw'));
    const pinned = run(['--job', selected.jobFile, '--result', file]);
    expect(pinned.status, pinned.stderr).toBe(0);
    expect(JSON.parse(pinned.stdout)).toMatchObject({ recordValid: true, candidateMatch: true, acceptedDraft: false });

    // The same result against a job that carries no such input (the observed run): the id is not a pinned input.
    selected.job.inputs = selected.job.inputs.slice(0, withoutPin);
    await fs.writeJson(selected.jobFile, selected.job);
    const bare = run(['--job', selected.jobFile]);
    expect(bare.status, bare.stderr).toBe(0);
    await fs.writeJson(file, citeLog(evaluationResult(selected, JSON.parse(bare.stdout)), 'native-check-raw'));
    const refused = run(['--job', selected.jobFile, '--result', file]);
    expect(refused.status).toBe(1);
    expect(JSON.parse(refused.stderr).reason).toBe('Citation selects an unavailable/unpinned input or substituted path.');
  });

  it('cannot pin the review root\'s own check output as an input, which is why the pin is a copy outside the review root', async () => {
    const selected = await prepareEvaluationJob(fixture);
    selected.job.roots.read.push(path.join(selected.evidence, 'checks'));
    selected.job.inputs.push({ id: 'native-check-raw', kind: 'validator', ...await reviewPin(selected.rawFile), sections: [], status: 'clear', required: true });
    await fs.writeJson(selected.jobFile, selected.job);
    const actual = run(['--job', selected.jobFile]);
    expect(actual.status, actual.stderr).toBe(1);
    expect(JSON.parse(actual.stderr).reason).toMatch(/review output root overlaps/i);
  });

  it('refuses a read root that is the parent of the review root, so the pinned copy must sit in a sibling folder', async () => {
    const selected = await prepareEvaluationJob(fixture);
    const saved = path.join(fixture.root, 'saved-checks', 'native-check.raw.txt');
    await fs.outputFile(saved, await fs.readFile(selected.rawFile));
    selected.job.roots.read.push(fixture.root);
    selected.job.inputs.push({ id: 'native-check-raw', kind: 'validator', ...await reviewPin(saved), sections: [], status: 'clear', required: true });
    await fs.writeJson(selected.jobFile, selected.job);
    const actual = run(['--job', selected.jobFile]);
    expect(actual.status, actual.stderr).toBe(1);
    expect(JSON.parse(actual.stderr).reason).toMatch(/review output root overlaps/i);
  });

  it('refuses a citation of a pinned input that is not clear, so the pin the citation names must be status clear', async () => {
    const selected = await prepareEvaluationJob(fixture);
    const saved = path.join(fixture.root, 'saved-checks');
    await fs.outputFile(path.join(saved, 'native-check.raw.txt'), await fs.readFile(selected.rawFile));
    const pin = await reviewPin(path.join(saved, 'native-check.raw.txt'));
    selected.job.roots.read.push(saved);
    selected.job.inputs.push({ id: 'native-check-raw', kind: 'validator', ...pin, sections: [], status: 'held', required: false });
    await fs.writeJson(selected.jobFile, selected.job);
    const preflight = run(['--job', selected.jobFile]);
    expect(preflight.status, preflight.stderr).toBe(0);
    const result = evaluationResult(selected, JSON.parse(preflight.stdout));
    result.criteria[0]!.citations = [{ sourceId: 'native-check-raw', path: 'native-check.raw.txt', sha256: pin.sha256, startLine: 1, endLine: 1, quote: 'selected fixture layout checked' }];
    const file = path.join(selected.evidence, 'result.json');
    await fs.writeJson(file, result);
    const refused = run(['--job', selected.jobFile, '--result', file]);
    expect(refused.status).toBe(1);
    expect(JSON.parse(refused.stderr).reason).toBe('Citation selects an unavailable/unpinned input or substituted path.');
  });

  // The coordinator's instruction is enough to build a job the checker accepts: the test takes the field list out of the reference text itself
  // (the eight fields of an input, and the fixed value the text gives to each), builds the input from it and checks the job and a citing result.
  it('accepts a review job whose saved check output is pinned by following the coordinator\'s instruction literally, and a result citing it', async () => {
    const text = (await fs.readFile(path.resolve('registry/skills/coordinate-artifact/references/verification.md'), 'utf8')).replace(/\r\n/g, '\n');
    const from = text.indexOf('with all eight fields of `assets/job.schema.json`:');
    expect(from).toBeGreaterThan(0);
    const span = text.slice(from + 'with all eight fields of `assets/job.schema.json`:'.length, text.indexOf('. Keep that copy', from));
    const tokens = [...span.matchAll(/`([^`]+)`/g)].map(match => match[1]!);
    const schema = await fs.readJson(path.resolve('registry/skills/evaluate-artifact/assets/job.schema.json')) as { properties: { inputs: { items: { required: string[] } } } };
    const fields = schema.properties.inputs.items.required;
    const grouped = new Map<string, string[]>();
    for (const token of tokens) { if (fields.includes(token)) grouped.set(token, []); else [...grouped.values()].at(-1)!.push(token); }
    expect([...grouped.keys()].sort()).toEqual([...fields].sort());

    const selected = await prepareEvaluationJob(fixture);
    const saved = path.join(fixture.root, 'saved-checks');
    const copy = path.join(saved, 'native-check.raw.txt');
    await fs.outputFile(copy, await fs.readFile(selected.rawFile));
    const pin = await reviewPin(copy);
    const input: Record<string, unknown> = {};
    for (const [field, values] of grouped) {
      if (field === 'path' || field === 'bytes' || field === 'sha256') input[field] = pin[field];
      else { const last = values.at(-1)!; try { input[field] = JSON.parse(last); } catch { input[field] = last; } }
    }
    expect(input).toMatchObject({ id: 'native-check-raw', kind: 'validator', sections: [], status: 'clear', required: true });
    // Where the copy lives: a folder of its own beside the review root, declared alone as a read root.
    expect(path.dirname(path.dirname(copy))).toBe(path.dirname(selected.evidence));
    selected.job.roots.read.push(saved);
    selected.job.inputs.push(input as typeof selected.job.inputs[number]);
    await fs.writeJson(selected.jobFile, selected.job);
    const preflight = run(['--job', selected.jobFile]);
    expect(preflight.status, preflight.stderr).toBe(0);
    const result = evaluationResult(selected, JSON.parse(preflight.stdout));
    result.criteria[0]!.citations = [{ sourceId: input.id as string, path: 'native-check.raw.txt', sha256: pin.sha256, startLine: 1, endLine: 1, quote: 'selected fixture layout checked' }];
    const file = path.join(selected.evidence, 'result.json');
    await fs.writeJson(file, result);
    const actual = run(['--job', selected.jobFile, '--result', file]);
    expect(actual.status, actual.stderr).toBe(0);
    expect(JSON.parse(actual.stdout)).toMatchObject({ recordValid: true, candidateMatch: true, acceptedDraft: false });
  });

  it.each<[string, (result: ReturnType<typeof evaluationResult>) => unknown]>([
    ['duplicate file coverage', result => ({ ...result, coverage: [...result.coverage, ...result.coverage] })],
    ['duplicate/omitted criterion', result => ({ ...result, criteria: result.criteria.map((item, index) => index === 0 ? { ...item, id: 'host-fit' } : item) })],
    ['unverified required criterion in a complete report', result => ({ ...result, criteria: result.criteria.map((item, index) => index === 0 ? { ...item, outcome: 'unverified' } : item) })],
    ['uncited required opinion', result => ({ ...result, criteria: result.criteria.map((item, index) => index === 0 ? { ...item, citations: [] } : item) })],
    ['no-blocking opinion with a HIGH finding', result => ({ ...result, findings: [{ id: 'fixed-brief-gap', criterionId: 'task-fit',
      severity: 'HIGH', confidence: 'high', citations: result.criteria[0]!.citations, rationale: 'Synthetic blocking finding.', correction: 'Resolve the fixed brief gap.' }] })],
    ['no-blocking opinion on a partial review', result => ({ ...result, status: 'partial' })],
    ['omitted deterministic evidence', result => ({ ...result, deterministicEvidence: [] })],
    ['substituted deterministic evidence', result => ({ ...result, deterministicEvidence: result.deterministicEvidence.map(item => ({ ...item, status: 'failed' })) })],
  ])('refuses %s rather than accepting a contradictory quality record', async (_label, change) => {
    const selected = await prepareEvaluationJob(fixture);
    const preflight = run(['--job', selected.jobFile]);
    expect(preflight.status, preflight.stderr).toBe(0);
    const file = path.join(selected.evidence, 'result.json');
    await fs.writeJson(file, change(evaluationResult(selected, JSON.parse(preflight.stdout))));
    const actual = run(['--job', selected.jobFile, '--result', file]);
    expect(actual.status, actual.stderr).toBe(1);
    expect(JSON.parse(actual.stderr)).toMatchObject({ kind: 'deterministic', status: 'unavailable', acceptedDraft: false });
  });

  it('refuses a different file merely labeled as the selected registry profile', async () => {
    const selected = await prepareEvaluationJob(fixture);
    const alternate = fixture.source('unreviewed-profile.json');
    await fs.outputJson(alternate, { host: 'claude', claim: 'not the selected profile' });
    const input = selected.job.inputs.find(item => item.kind === 'profile')!;
    Object.assign(input, await reviewPin(alternate));
    await fs.writeJson(selected.jobFile, selected.job);
    const actual = run(['--job', selected.jobFile]);
    expect(actual.status, actual.stderr).toBe(1);
    expect(JSON.parse(actual.stderr).reason).toMatch(/required.*profile.*pin/i);
  });

  it.each<[string, (selected: Awaited<ReturnType<typeof prepareEvaluationJob>>) => Promise<void>, RegExp]>([
    ['unknown job properties', async selected => { Object.assign(selected.job, { unreviewed: true }); }, /unknown property/],
    ['changed final bytes', async selected => { await fs.appendFile(path.join(selected.candidate, 'SKILL.md'), 'Changed after pinning.\n'); }, /candidate.*mismatch/i],
    ['an unreported final file', async selected => { await fs.writeFile(path.join(selected.candidate, 'extra.md'), 'Not in review scope.\n'); }, /candidate.*mismatch/i],
    ['a held required source', async selected => { selected.job.inputs.find(input => input.kind === 'provenance')!.status = 'held'; }, /required held/i],
    ['an unavailable required source', async selected => { selected.job.inputs.find(input => input.kind === 'provenance')!.status = 'unavailable'; }, /required unavailable/i],
    ['overlapping output and candidate roots', async selected => { selected.job.roots.review = selected.candidate; }, /root overlaps/i],
    ['a changed source HEAD', async selected => { selected.job.source.head = '0'.repeat(40); }, /HEAD.*changed/i],
    ['a raw-log hash mismatch', async selected => { await fs.appendFile(selected.rawFile, 'Unreported output.\n'); }, /raw check log.*mismatch/i],
    ['a pass with nonzero exit', async selected => { selected.job.checks[0]!.exit = 9; }, /status\/exit\/receipt contradiction/i],
    ['a substituted but rehashed receipt', async selected => {
      const receipt = await fs.readJson(selected.receiptFile); receipt.command.argv = ['unreviewed-command'];
      await fs.writeJson(selected.receiptFile, receipt); selected.job.checks[0]!.receipt = await reviewPin(selected.receiptFile);
    }, /receipt substitution\/inconsistency/i],
  ])('refuses %s without mutating the complete fixture', async (_label, change, reason) => {
    const selected = await prepareEvaluationJob(fixture);
    await change(selected); await fs.writeJson(selected.jobFile, selected.job);
    const before = await evaluationTree(fixture.root);
    const actual = run(['--job', selected.jobFile]);
    expect(actual.status, actual.stderr).toBe(1);
    expect(JSON.parse(actual.stderr).reason).toMatch(reason);
    expect(await evaluationTree(fixture.root)).toEqual(before);
  });

  it('reports an explicitly unavailable optional input without reading or inventing it', async () => {
    const selected = await prepareEvaluationJob(fixture);
    selected.job.inputs.push({ id: 'optional-observation', kind: 'observation', path: fixture.source('absent-observation.md'),
      bytes: 0, sha256: '0'.repeat(64), sections: [], status: 'unavailable', required: false });
    await fs.writeJson(selected.jobFile, selected.job);
    const before = await evaluationTree(fixture.root);
    const actual = run(['--job', selected.jobFile]);
    expect(actual.status, actual.stderr).toBe(0);
    expect(JSON.parse(actual.stdout)).toMatchObject({ ready: true, unavailable: [{ id: 'optional-observation', status: 'unavailable', required: false }] });
    expect(await evaluationTree(fixture.root)).toEqual(before);
  });

  it('consumes the actual copied executable schema after its pin is updated', async () => {
    const selected = await prepareEvaluationJob(fixture);
    const file = fixture.installed('.claude/skills/evaluate-artifact/assets/job.schema.json');
    const schema = await fs.readJson(file); schema.properties.id.pattern = '^different-job$'; await fs.writeJson(file, schema);
    Object.assign(selected.job.inputs.find(input => input.path === file)!, await reviewPin(file));
    await fs.writeJson(selected.jobFile, selected.job);
    const actual = run(['--job', selected.jobFile]);
    expect(actual.status).toBe(1);
    expect(JSON.parse(actual.stderr).reason).toMatch(/job\.id.*invalid/i);
  });

  it('does not execute a command recorded by the caller, even when the receipt repeats it consistently', async () => {
    const selected = await prepareEvaluationJob(fixture);
    const marker = path.join(fixture.root, 'should-not-exist.txt');
    selected.job.checks[0]!.command.argv = ['-e', `require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'executed')`];
    const receipt = await fs.readJson(selected.receiptFile); receipt.command = selected.job.checks[0]!.command;
    await fs.writeJson(selected.receiptFile, receipt); selected.job.checks[0]!.receipt = await reviewPin(selected.receiptFile);
    await fs.writeJson(selected.jobFile, selected.job);
    const before = await evaluationTree(fixture.root);
    const actual = run(['--job', selected.jobFile]);
    expect(actual.status, actual.stderr).toBe(0);
    expect(JSON.parse(actual.stdout).executionProof).toBe('unverified');
    expect(await fs.pathExists(marker)).toBe(false);
    expect(await evaluationTree(fixture.root)).toEqual(before);
  });

  it('refuses duplicate --job selectors instead of silently choosing one', async () => {
    const selected = await prepareEvaluationJob(fixture);
    const actual = run(['--job', selected.jobFile, '--job', selected.jobFile]);
    expect(actual.status, actual.stderr).toBe(1);
    expect(JSON.parse(actual.stderr).reason).toMatch(/duplicate.*job/i);
  });

  it.each(['shared-pair', 'claude-agent'] as const)('checks a %s scope using an actual existing caller-run validator', async kind => {
    const selected = await prepareEvaluationKind(fixture, kind);
    const before = await evaluationTree(fixture.root);
    const actual = run(['--job', selected.jobFile]);
    expect(actual.status, actual.stderr).toBe(0);
    expect(JSON.parse(actual.stdout)).toMatchObject({ recordValid: true, ready: true, candidateDigest: selected.candidateDigest,
      checks: [{ id: kind === 'shared-pair' ? 'contract-check' : 'factory-check', status: 'passed', exit: 0 }], live: 'unverified' });
    expect(await evaluationTree(fixture.root)).toEqual(before);
  });

  it('refuses a native subject lacking its required selected agent guide', async () => {
    const selected = await prepareEvaluationKind(fixture, 'claude-agent');
    selected.job.inputs = selected.job.inputs.filter(input => input.id !== 'agent-guide');
    await fs.writeJson(selected.jobFile, selected.job);
    const actual = run(['--job', selected.jobFile]);
    expect(actual.status, actual.stderr).toBe(1);
    expect(JSON.parse(actual.stderr).reason).toMatch(/required.*guide.*agent/i);
  });

  it.each(['shared-pair', 'claude-agent'] as const)('refuses a %s job substituting a different shared definition stem', async kind => {
    const selected = await prepareEvaluationKind(fixture, kind);
    selected.job.subject.definition = 'subagent-unreviewed';
    await fs.writeJson(selected.jobFile, selected.job);
    const actual = run(['--job', selected.jobFile]);
    expect(actual.status, actual.stderr).toBe(1);
    expect(JSON.parse(actual.stderr).reason).toMatch(/definition|shared.*pin/i);
  });

  it('refuses a completed quality review when a required check was not run, even with changes requested', async () => {
    const selected = await prepareEvaluationJob(fixture);
    const pending = { ...selected.job.checks[0]!, id: 'required-next-check', status: 'not-run', exit: null, raw: null, receipt: null };
    await fs.writeJson(selected.jobFile, { ...selected.job, checks: [pending] });
    const preflight = run(['--job', selected.jobFile]);
    expect(preflight.status).toBe(1);
    expect(JSON.parse(preflight.stdout)).toMatchObject({ recordValid: true, ready: false });
    const file = path.join(selected.evidence, 'result.json');
    await fs.writeJson(file, { ...evaluationResult(selected, JSON.parse(preflight.stdout)), opinion: 'changes-requested',
      deterministicEvidence: [{ id: pending.id, status: pending.status, exit: null, rawSha256: null, receiptSha256: null,
        observation: 'The caller did not execute this required next check.' }] });
    const actual = run(['--job', selected.jobFile, '--result', file]);
    expect(actual.status, actual.stderr).toBe(1);
    expect(JSON.parse(actual.stderr).reason).toMatch(/complete.*required.*check/i);
  });

  it.each(['partial', 'blocked'])('checks a truthful %s record while keeping an unperformed required check unavailable', async status => {
    const selected = await prepareEvaluationJob(fixture);
    const pending = { ...selected.job.checks[0]!, id: 'required-next-check', status: 'not-run', exit: null, raw: null, receipt: null };
    await fs.writeJson(selected.jobFile, { ...selected.job, checks: [pending] });
    const preflight = run(['--job', selected.jobFile]);
    expect(preflight.status).toBe(1);
    const base = evaluationResult(selected, JSON.parse(preflight.stdout));
    const file = path.join(selected.evidence, 'result.json');
    await fs.writeJson(file, { ...base, status, opinion: 'inconclusive',
      criteria: base.criteria.map(item => item.outcome === 'not-applicable' ? item : { ...item, outcome: 'unverified', citations: [], rationale: 'Required next-check evidence is not available.' }),
      deterministicEvidence: [{ id: pending.id, status: pending.status, exit: null, rawSha256: null, receiptSha256: null, observation: 'Required next check was not run.' }],
      openItems: [{ id: 'required-next-check', description: 'Caller must supply independently checked execution evidence.', dependentAcceptance: ['task-fit'], provider: 'caller' }] });
    const before = await evaluationTree(fixture.root);
    const actual = run(['--job', selected.jobFile, '--result', file]);
    expect(actual.status, actual.stderr).toBe(0);
    expect(JSON.parse(actual.stdout)).toMatchObject({ recordValid: true, ready: false, reviewStatus: status, opinion: 'inconclusive',
      quality: 'pending', executionProof: 'unverified', live: 'unverified', acceptedDraft: false });
    expect(await evaluationTree(fixture.root)).toEqual(before);
  });

  it('requires the returned inventory to identify its hashes as caller-provided pins', async () => {
    const selected = await prepareEvaluationJob(fixture);
    const preflight = run(['--job', selected.jobFile]);
    expect(preflight.status, preflight.stderr).toBe(0);
    const result = Object.fromEntries(Object.entries(evaluationResult(selected, JSON.parse(preflight.stdout)))
      .filter(([key]) => key !== 'inventorySource'));
    const file = path.join(selected.evidence, 'result.json');
    await fs.writeJson(file, result);
    const actual = run(['--job', selected.jobFile, '--result', file]);
    expect(actual.status, actual.stderr).toBe(1);
    expect(JSON.parse(actual.stderr).reason).toMatch(/inventorySource/i);
  });

  it.each<[string, (selected: Awaited<ReturnType<typeof prepareEvaluationJob>>) => Promise<void>, RegExp]>([
    ['candidate traversal', async selected => { selected.job.candidate.files[0]!.path = '../SKILL.md'; }, /contained relative path/i],
    ['source traversal alias', async selected => { selected.job.source.registry += `${path.sep}..${path.sep}registry`; }, /absolute path.*traversal/i],
    ['case-colliding declared paths', async selected => { selected.job.candidate.files.push({ ...selected.job.candidate.files[0]!, path: 'skill.md' }); }, /inventory.*mismatch|duplicate|case-colliding/i],
    ['linked candidate child', async selected => { await fs.symlink(fixture.registry, path.join(selected.candidate, 'linked-source'), 'junction'); }, /linked candidate/i],
    ['linked candidate ancestor', async selected => {
      const alias = path.join(fixture.root, 'linked-parent'); await fs.symlink(fixture.root, alias, 'junction');
      selected.job.roots.candidate = path.join(alias, 'candidate');
    }, /linked path/i],
    ['candidate byte cap', async selected => { selected.job.budget.maxCandidateFileBytes = 1; }, /candidate.*byte budget/i],
    ['evidence file cap', async selected => { selected.job.budget.maxEvidenceFiles = 1; }, /evidence file budget/i],
    ['evidence byte cap', async selected => { selected.job.budget.maxEvidenceBytes = 1; }, /evidence total-byte budget/i],
    ['runtime binary cap', async selected => { selected.job.budget.maxExecutableBytes = 1; }, /runtime executable.*byte budget/i],
  ])('refuses %s and preserves the entire workspace and evidence', async (_label, change, reason) => {
    const selected = await prepareEvaluationJob(fixture);
    await change(selected); await fs.writeJson(selected.jobFile, selected.job);
    const before = await evaluationTree(fixture.root);
    const actual = run(['--job', selected.jobFile]);
    expect(actual.status, actual.stderr).toBe(1);
    expect(JSON.parse(actual.stderr).reason).toMatch(reason);
    expect(await evaluationTree(fixture.root)).toEqual(before);
  });

  it('refuses result bytes beyond the fixed caller budget', async () => {
    const selected = await prepareEvaluationJob(fixture); selected.job.budget.maxResultBytes = 20;
    await fs.writeJson(selected.jobFile, selected.job);
    const preflight = run(['--job', selected.jobFile]); expect(preflight.status, preflight.stderr).toBe(0);
    const file = path.join(selected.evidence, 'result.json'); await fs.writeJson(file, evaluationResult(selected, JSON.parse(preflight.stdout)));
    const before = await evaluationTree(fixture.root);
    const actual = run(['--job', selected.jobFile, '--result', file]);
    expect(actual.status).toBe(1); expect(JSON.parse(actual.stderr).reason).toMatch(/result.*byte budget/i);
    expect(await evaluationTree(fixture.root)).toEqual(before);
  });

  it('keeps an optional unavailable executable explicit without blocking unrelated required checks', async () => {
    const selected = await prepareEvaluationJob(fixture);
    const tools = path.join(fixture.root, 'optional-tools'); await fs.ensureDir(tools);
    selected.job.roots.read.push(tools);
    await fs.writeJson(selected.jobFile, { ...selected.job, checks: [...selected.job.checks, {
      id: 'optional-tool', required: false, status: 'unavailable', candidateDigest: selected.candidateDigest,
      command: { executable: { path: path.join(tools, 'not-installed.exe'), bytes: null, sha256: null }, argv: [], cwd: fixture.root },
      exit: null, raw: null, receipt: null,
    }] });
    const before = await evaluationTree(fixture.root);
    const actual = run(['--job', selected.jobFile]);
    expect(actual.status, actual.stderr).toBe(0);
    expect(JSON.parse(actual.stdout)).toMatchObject({ ready: true, checks: [
      { id: 'skill-layout', status: 'passed', required: true }, { id: 'optional-tool', status: 'unavailable', required: false },
    ] });
    expect(await evaluationTree(fixture.root)).toEqual(before);
  });

  it('refuses a recorded executable outside the declared read scope before inspecting it', async () => {
    const selected = await prepareEvaluationJob(fixture);
    const unselected = path.join(fixture.root, 'not-selected-as-input.txt'); await fs.writeFile(unselected, 'Unselected fixture bytes.\n');
    selected.job.checks[0]!.command.executable = await reviewPin(unselected);
    const receipt = await fs.readJson(selected.receiptFile); receipt.command = selected.job.checks[0]!.command;
    await fs.writeJson(selected.receiptFile, receipt); selected.job.checks[0]!.receipt = await reviewPin(selected.receiptFile);
    await fs.writeJson(selected.jobFile, selected.job);
    const before = await evaluationTree(fixture.root);
    const actual = run(['--job', selected.jobFile]);
    expect(actual.status, actual.stderr).toBe(1);
    expect(JSON.parse(actual.stderr).reason).toMatch(/executable.*declared read scope/i);
    expect(await evaluationTree(fixture.root)).toEqual(before);
  });

  it('refuses unsupported schema keywords even in an unused optional branch', async () => {
    const selected = await prepareEvaluationJob(fixture);
    const file = fixture.installed('.claude/skills/evaluate-artifact/assets/job.schema.json');
    const schema = await fs.readJson(file); schema.properties.provenance.properties.upstream.oneOf = [];
    await fs.writeJson(file, schema);
    Object.assign(selected.job.inputs.find(input => input.path === file)!, await reviewPin(file));
    await fs.writeJson(selected.jobFile, selected.job);
    const actual = run(['--job', selected.jobFile]);
    expect(actual.status, actual.stderr).toBe(1);
    expect(JSON.parse(actual.stderr).reason).toMatch(/unsupported schema keyword oneOf/i);
  });

  it('refuses an unusable required result schema at preflight before a reviewer could be dispatched', async () => {
    const selected = await prepareEvaluationJob(fixture);
    const file = fixture.installed('.claude/skills/evaluate-artifact/assets/result.schema.json');
    await fs.writeFile(file, 'Not a JSON result schema.\n');
    Object.assign(selected.job.inputs.find(input => input.path === file)!, await reviewPin(file));
    await fs.writeJson(selected.jobFile, selected.job);
    const actual = run(['--job', selected.jobFile]);
    expect(actual.status, actual.stderr).toBe(1);
    expect(JSON.parse(actual.stderr).reason).toMatch(/result schema.*JSON/i);
  });

  // P27-A: the root rules compare physical paths as well as strings. A refusal holds when the paths overlap as strings or physically;
  // a grant (coverage by a read root, "this is the required file") needs both, in exact case where the volume is case-sensitive.
  // Each alias case looks its spelling up on the real volume and skips with the reason when there is none.
  describe('root rules compare physical paths as well as strings (P27-A)', () => {
    const overlap = /^Review output root overlaps candidate\/source\/read\/managed\/protected inputs\.$/;
    const refused = (selected: { jobFile: string }) => {
      const actual = run(['--job', selected.jobFile]);
      expect(actual.status, actual.stderr).toBe(1);
      return JSON.parse(actual.stderr).reason as string;
    };
    /** Names the review root (already moved there) by this spelling in the job, its raw log and its receipt, and re-pins them. */
    const respellReview = async (selected: Awaited<ReturnType<typeof prepareEvaluationJob>>, spelled: string) => {
      selected.evidence = spelled;
      selected.jobFile = path.join(spelled, 'job.json');
      selected.rawFile = path.join(spelled, 'checks', 'skill-layout.raw.txt');
      selected.receiptFile = path.join(spelled, 'checks', 'skill-layout.receipt.json');
      selected.job.roots.review = spelled;
      const check = selected.job.checks[0]!;
      check.raw = await reviewPin(selected.rawFile);
      const receipt = await fs.readJson(selected.receiptFile); receipt.raw = check.raw;
      await fs.writeJson(selected.receiptFile, receipt);
      check.receipt = await reviewPin(selected.receiptFile);
      await fs.writeJson(selected.jobFile, selected.job);
    };

    it('refuses a review root inside a protected root given by its NTFS short name (runs on Windows with short names, skipped otherwise)', async ctx => {
      const selected = await prepareEvaluationJob(fixture);
      const short = shortLeafOf(fixture.root);
      if (!short) ctx.skip(NO_SHORT);
      // Accepted before P27-A: as strings the short spelling of the fixture folder does not contain the review root.
      Object.assign(selected.job.roots, { protected: [short!] });
      await fs.writeJson(selected.jobFile, selected.job);
      const before = await evaluationTree(fixture.root);
      expect(refused(selected)).toMatch(overlap);
      expect(await evaluationTree(fixture.root)).toEqual(before);
    });

    it('refuses a review root that is a .claude folder only in its physical spelling as a managed Host path (runs on Windows with short names, skipped otherwise)', async ctx => {
      const selected = await prepareEvaluationJob(fixture);
      const host = path.join(fixture.root, 'hosted', '.claude');
      await fs.ensureDir(host);
      const short = shortLeafOf(host);
      if (!short) ctx.skip(NO_SHORT);
      await fs.move(selected.evidence, path.join(host, 'review'));
      // Accepted before P27-A: the string names no .claude segment.
      await respellReview(selected, path.join(short!, 'review'));
      expect(refused(selected)).toBe('Review output root is a managed Host path.');
    });

    it('refuses a review root inside another case of a protected root (runs where the volume ignores case, skipped otherwise; a compatibility case that the case-folded string comparison refuses too)', async ctx => {
      const selected = await prepareEvaluationJob(fixture);
      const flipped = otherCaseOf(fixture.root);
      if (!flipped) ctx.skip(NO_CASE);
      Object.assign(selected.job.roots, { protected: [flipped!] });
      await fs.writeJson(selected.jobFile, selected.job);
      expect(refused(selected)).toMatch(overlap);
    });

    /** Adds a read root and a clear pinned input beneath it, each in the spelling given; the file itself lies in the long-named folder. */
    const coveredInput = async (selected: Awaited<ReturnType<typeof prepareEvaluationJob>>, folder: string, root: string, inputFolder: string) => {
      await fs.outputFile(path.join(folder, 'note.md'), 'A note the evaluator may read.\n');
      selected.job.roots.read.push(root);
      selected.job.inputs.push({ id: 'tool-note', kind: 'observation', ...await reviewPin(path.join(folder, 'note.md')),
        path: path.join(inputFolder, 'note.md'), sections: [], status: 'clear', required: false });
      await fs.writeJson(selected.jobFile, selected.job);
    };

    it('passes a legal job whose disjoint roots are given in two spellings, with a pinned input beneath the alternate-spelled read root in the same spelling (short name or other case)', async ctx => {
      const selected = await prepareEvaluationJob(fixture);
      const prot = path.join(fixture.root, 'Protected Folder');
      const tools = path.join(fixture.root, 'Optional Tools');
      await fs.ensureDir(prot); await fs.ensureDir(tools);
      const altProt = altLeafOf(prot, false), altTools = altLeafOf(tools, false);
      if (!altProt || !altTools) ctx.skip(NO_ALT);
      Object.assign(selected.job.roots, { protected: [altProt!] });
      await coveredInput(selected, tools, altTools!, altTools!);
      const actual = run(['--job', selected.jobFile]);
      expect(actual.status, actual.stderr).toBe(0);
      expect(JSON.parse(actual.stdout)).toMatchObject({ recordValid: true, ready: true });
    });

    it('covers an input given in another case of its read root\'s folder (runs where the volume ignores case, skipped otherwise): the folded strings and the real paths agree, as before P27-A', async ctx => {
      const selected = await prepareEvaluationJob(fixture);
      const tools = path.join(fixture.root, 'optional-tools');
      await fs.ensureDir(tools);
      const flipped = otherCaseOf(tools);
      if (!flipped) ctx.skip(NO_CASE);
      await coveredInput(selected, tools, tools, flipped!);
      const actual = run(['--job', selected.jobFile]);
      expect(actual.status, actual.stderr).toBe(0);
    });

    it('does not cover an input given under the short name of its read root\'s folder (runs on Windows with short names, skipped otherwise): the strings differ, refused as before P27-A; a physical match alone never grants', async ctx => {
      const selected = await prepareEvaluationJob(fixture);
      const tools = path.join(fixture.root, 'Optional Tools');
      await fs.ensureDir(tools);
      const short = shortLeafOf(tools);
      if (!short) ctx.skip(NO_SHORT);
      await coveredInput(selected, tools, tools, short!);
      expect(refused(selected)).toBe('Input outside declared read roots: tool-note.');
    });

    it('passes a legal job whose review root is spelled by its short name throughout (runs on Windows with short names, skipped otherwise)', async ctx => {
      const selected = await prepareEvaluationJob(fixture);
      const long = path.join(fixture.root, 'Review Output');
      await fs.move(selected.evidence, long);
      const short = shortLeafOf(long);
      if (!short) ctx.skip(NO_SHORT);
      await respellReview(selected, short!);
      const actual = run(['--job', selected.jobFile]);
      expect(actual.status, actual.stderr).toBe(0);
      expect(JSON.parse(actual.stdout)).toMatchObject({ recordValid: true, ready: true });
    });

    it('refuses an executable in a folder that differs from a read root only in case (runs only on a case-sensitive volume; Linux CI is its first run)', async ctx => {
      const selected = await prepareEvaluationJob(fixture);
      const tools = path.join(fixture.root, 'read');
      const upper = path.join(fixture.root, 'READ');
      await fs.ensureDir(tools);
      if (otherCaseOf(tools)) ctx.skip(CASE_SENSITIVE_ONLY);
      await fs.ensureDir(upper);
      selected.job.roots.read.push(tools);
      await fs.writeJson(selected.jobFile, { ...selected.job, checks: [...selected.job.checks, {
        id: 'optional-tool', required: false, status: 'unavailable', candidateDigest: selected.candidateDigest,
        command: { executable: { path: path.join(upper, 'tool'), bytes: null, sha256: null }, argv: [], cwd: fixture.root },
        exit: null, raw: null, receipt: null,
      }] });
      // Before P27-A the case-folded string comparison counted /…/READ/tool as covered by the read root /…/read. The string part still folds;
      // the physical part (exact case off Windows; READ exists, so its real path is …/READ) refuses it.
      expect(refused(selected)).toBe('Check executable is outside the declared read scope.');
    });

    it('resolves physical paths by walking up only on ENOENT or ENOTDIR and refuses any other real-path error (source text; EACCES cannot be produced portably)', async () => {
      const text = await fs.readFile(CHECK_REVIEW_SOURCE, 'utf8');
      expect(text).toMatch(/error\?\.code !== 'ENOENT' && error\?\.code !== 'ENOTDIR'/);
      expect(text).toContain('Cannot resolve the physical path of');
      expect(text).toContain('fs.realpathSync.native(current)');
      expect(text).toContain('const overlaps = (a, b) => [[a, b], [physical(a), physical(b)]].some(([x, y]) => within(x, y) || within(y, x));');
      expect(text).toContain('const managedHostPath = root => [root, physical(root)]');
      // A grant keeps the case-folded string test of before P27-A and adds the physical one, exact case off Windows.
      expect(text).toContain('const withinBoth = (parent, child) => within(parent, child) && physicallyWithin(parent, child);');
      expect(text).toContain('const physicallyWithin = (parent, child) => withinExact(physical(parent), physical(child));');
    });
  });
});
