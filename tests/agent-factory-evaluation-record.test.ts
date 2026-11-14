import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { spawnSync } from 'node:child_process';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { InstallEngine } from '../src/core/installer.js';
import { RegistryResolver } from '../src/core/registry.js';
import { prepareProductionEvaluator } from './helpers/factory-evaluator.js';
import { evaluationResult, evaluationTree, prepareEvaluationJob, prepareEvaluationKind, reviewPin } from './helpers/factory-evaluation.js';

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
});
