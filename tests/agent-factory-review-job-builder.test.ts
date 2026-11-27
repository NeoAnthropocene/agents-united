import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { InstallEngine } from '../src/core/installer.js';
import { RegistryResolver } from '../src/core/registry.js';
import { prepareProductionEvaluator } from './helpers/factory-evaluator.js';
import { evaluationTree } from './helpers/factory-evaluation.js';
import { INVOICE_FILES } from './helpers/skill-candidate.js';
import { NO_SHORT, shortLeafOf } from './helpers/path-spellings.js';
import { isolatedTempEnv } from './helpers/isolated-temp.js';

/**
 * The shipped review-job builder (P24-B, finding B-3 of Sitting B): the caller hands it only its decisions, it computes every pin and
 * writes the receipts, the read-folder copies and job.json, and the installed check-review.mjs accepts that job at the first call.
 * The test plays the caller: it runs each check itself and saves the output, as the coordinator does; the builder runs none.
 */
type Json = Record<string, any>;
const BUILDER = '.claude/skills/evaluate-artifact/scripts/review-job.mjs';
const CHECKER = '.claude/skills/evaluate-artifact/scripts/check-review.mjs';
const SOURCE = path.resolve('registry/skills/evaluate-artifact/scripts/review-job.mjs');
const CHECKOUT = process.cwd();
const HEAD = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
// The temp folder of the test runner, resolved as the builder resolves it. The children this suite starts must never write into it.
const RUNNER_TEMP = fs.realpathSync.native(os.tmpdir());
const STEM = 'subagent-factory-evaluator';
const digest = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');

describe('the shipped review-job builder', () => {
  let fixture: Awaited<ReturnType<typeof prepareProductionEvaluator>>;
  let work: string;
  beforeEach(async () => {
    fixture = await prepareProductionEvaluator(await fs.mkdtemp(path.join(os.tmpdir(), 'au-review-job-')));
    await new InstallEngine(new RegistryResolver(fixture.registry)).install('agent-factory', fixture.options);
    work = path.join(fixture.root, 'work');
    await fs.ensureDir(path.join(work, 'saved'));
    // The builder writes the hand-back hook's pointer into the temp folder (ADR 0070); here that is a folder of the fixture, removed with it.
    await fs.ensureDir(path.join(fixture.root, 'tmp'));
  });
  afterEach(async () => { await fs.remove(fixture.root); });

  const fixtureTemp = () => path.join(fixture.root, 'tmp');
  const node = (script: string, args: string[], cwd = fixture.workspace, temp = fixtureTemp()) => spawnSync(process.execPath, [script, ...args], { cwd, encoding: 'utf8', timeout: 60_000, env: isolatedTempEnv(temp) });
  const build = (specFile: string, temp = fixtureTemp()) => node(fixture.installed(BUILDER), ['--spec', specFile], fixture.workspace, temp);
  const check = (args: string[]) => node(fixture.installed(CHECKER), args);
  // Named as the Skill, as skill-check requires of a Skill folder.
  const candidate = () => path.join(work, 'invoice-action-csv');
  const review = () => path.join(work, 'review');
  const readFolder = () => path.join(work, 'review-read');

  /** The caller runs its own check and saves the combined output; the builder later only records it. */
  async function callerRun(id: string, argv: string[]): Promise<{ output: string; exit: number }> {
    const run = spawnSync(process.execPath, argv, { cwd: work, encoding: 'utf8', timeout: 60_000 });
    const output = path.join(work, 'saved', `${id}.out.txt`);
    await fs.writeFile(output, `${run.stdout}${run.stderr}`);
    return { output, exit: run.status! };
  }
  async function validator(): Promise<string> {
    const file = path.join(work, 'tools', 'contains.mjs');
    await fs.outputFile(file, 'import fs from "node:fs"; const t=fs.readFileSync(process.argv[2],"utf8"); if(!t.includes(process.argv[3]))process.exit(1); console.log("selected fixture text checked");\n');
    return file;
  }
  async function writeCandidate(files: Record<string, string | Buffer>) {
    for (const [rel, body] of Object.entries(files)) await fs.outputFile(path.join(candidate(), rel), body);
  }
  async function taskFile(): Promise<string> {
    const file = path.join(work, 'saved', 'skill-task.json');
    await fs.writeJson(file, { version: 1, kind: 'skill-task', id: 'invoice-action-csv', objective: 'Draft one small original Skill.' }, { spaces: 2 });
    return file;
  }
  /** The caller's pre-run step: the builder's --digest mode prints the current candidate digest and writes nothing. */
  async function digestOf(spec: Json): Promise<string> {
    const file = path.join(work, 'saved', 'digest-spec.json');
    await fs.writeJson(file, { ...spec, checks: [] }, { spaces: 2 });
    const result = node(fixture.installed(BUILDER), ['--digest', '--spec', file]);
    expect(result.status, result.stderr).toBe(0);
    return JSON.parse(result.stdout).candidateDigest as string;
  }
  async function skillSpec(overrides: Json = {}): Promise<Json> {
    await writeCandidate(INVOICE_FILES);
    const tool = await validator();
    const base = await baseSpec();
    const candidateDigest = await digestOf(base);
    const ran = await callerRun('skill-layout', [tool, path.join(candidate(), 'SKILL.md'), 'name: invoice-action-csv']);
    expect(ran.exit).toBe(0);
    return { ...base,
      checks: [{ id: 'skill-layout', required: true, status: 'passed', command: { argv: [tool, path.join(candidate(), 'SKILL.md'), 'name: invoice-action-csv'], cwd: work }, candidateDigest, exit: ran.exit, output: ran.output }],
      ...overrides };
  }
  async function baseSpec(): Promise<Json> {
    return {
      version: 1, id: 'invoice-action-csv-review', intent: 'local',
      authoringHost: { unverifiedReason: 'Offline fixture; no Claude process invoked.' },
      subject: { kind: 'skill', identity: 'invoice-action-csv' },
      objective: 'Review the fixed Skill without changing it.', fixedValues: [{ name: 'skill-name', value: 'invoice-action-csv' }],
      constraints: ['No repair, installation, publication or live invocation.'], acceptance: [{ id: 'task-fit', description: 'The Skill names its CSV columns.' }],
      source: { checkout: CHECKOUT, head: HEAD, registry: fixture.registry },
      roots: { candidate: candidate(), review: review(), readFolder: readFolder(), managed: [fixture.installed('.claude')], protected: [] },
      roles: { 'references/csv.md': 'support', 'examples/invoice.md': 'support', 'evals/evals.json': 'support' },
      evidence: [{ id: 'skill-task', kind: 'provenance', path: await taskFile() }],
      provenance: { disposition: 'original', author: 'Fixture author' },
    };
  }
  async function writeSpec(spec: Json): Promise<string> {
    const file = path.join(work, 'saved', 'review-spec.json');
    await fs.writeJson(file, spec, { spaces: 2 });
    return file;
  }
  /** Builds, then checks the job; both must exit 0 at the first call. */
  async function roundTrip(spec: Json) {
    const built = build(await writeSpec(spec));
    expect(built.status, built.stderr).toBe(0);
    const out = JSON.parse(built.stdout);
    const jobFile = path.join(review(), 'job.json');
    const checked = check(['--job', jobFile]);
    expect(checked.status, checked.stderr).toBe(0);
    const record = JSON.parse(checked.stdout);
    expect(record).toMatchObject({ recordValid: true, ready: true, jobDigest: out.jobDigest, candidateDigest: out.candidateDigest, job: out.job });
    return { out, record, job: await fs.readJson(jobFile) as Json, jobFile };
  }
  const refusal = (result: ReturnType<typeof build>) => {
    expect(result.status, result.stdout).toBe(1);
    expect(result.stdout).toBe('');
    return JSON.parse(result.stderr) as { status: string; reason: string };
  };

  it('prints its usage and exits 0 for --help', () => {
    const result = node(fixture.installed(BUILDER), ['--help']);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('--spec <absolute review-spec.json>');
    expect(result.stdout).toContain('runs no check');
  });

  it('writes its pointer into the test\'s own temp folder and never into the temp folder of the test runner', async () => {
    const built = build(await writeSpec(await skillSpec()));
    expect(built.status, built.stderr).toBe(0);
    const { jobDigest } = JSON.parse(built.stdout) as { jobDigest: string };
    expect(await fs.pathExists(path.join(RUNNER_TEMP, 'agents-united', 'review-jobs', `${jobDigest}.txt`))).toBe(false);
    expect(await fs.readdir(path.join(fixture.root, 'tmp', 'agents-united', 'review-jobs'))).toEqual([`${jobDigest}.txt`]);
  });

  it('writes the hand-back hook\'s pointer in the temp folder: named by the job digest, holding the job path and nothing else, and never needed by the checker (ADR 0070)', async () => {
    const temp = fixtureTemp();
    const specFile = await writeSpec(await skillSpec());
    const built = build(specFile);
    expect(built.status, built.stderr).toBe(0);
    const out = JSON.parse(built.stdout);
    const pointers = path.join(temp, 'agents-united', 'review-jobs');
    expect(await fs.readdir(pointers)).toEqual([`${out.jobDigest}.txt`]);
    expect(await fs.readFile(path.join(pointers, `${out.jobDigest}.txt`), 'utf8')).toBe(path.join(review(), 'job.json'));
    // A temp folder whose path passes a link (macOS /var) is resolved once: the pointer sits in the real folder, where the hook looks for it.
    const real = path.join(work, 'real-tmp');
    const link = path.join(work, 'linked-tmp');
    await fs.ensureDir(real);
    let linked = true;
    try { fs.symlinkSync(real, link, process.platform === 'win32' ? 'junction' : 'dir'); } catch { linked = false; }
    if (linked) {
      const throughLink = build(specFile, link);
      expect(throughLink.status, throughLink.stderr).toBe(0);
      expect(await fs.readFile(path.join(real, 'agents-united', 'review-jobs', `${JSON.parse(throughLink.stdout).jobDigest}.txt`), 'utf8')).toBe(path.join(review(), 'job.json'));
    }
    // The pointer is a locator, not evidence: the job checks without it, and the build does not depend on a usable temp folder.
    await fs.remove(pointers);
    const checked = check(['--job', path.join(review(), 'job.json')]);
    expect(checked.status, checked.stderr).toBe(0);
    const file = path.join(work, 'not-a-folder');
    await fs.writeFile(file, 'x');
    const again = build(specFile, file);
    expect(again.status, again.stderr).toBe(0);
  });

  it('builds a portable Skill job the checker accepts, and a result citing a copied check output passes --result', async () => {
    const { out, job, jobFile, record } = await roundTrip(await skillSpec());
    expect(out).toMatchObject({ version: 1, status: 'job-written', counts: { files: 4, checks: 1, copies: 3 } });
    expect(job.subject).toEqual({ kind: 'skill', identity: 'invoice-action-csv', target: null, paths: ['SKILL.md'], definition: null });
    expect(job.rubric.criteria.filter((item: Json) => !item.applicable).map((item: Json) => item.id).sort()).toEqual(['coverage-evidence', 'host-fit', 'shared-semantics']);
    expect(job.inputs.filter((item: Json) => item.kind === 'guide').map((item: Json) => item.id)).toEqual(['skill-guide']);
    // The receipt carries exactly the eight keys the checker compares.
    const receipt = await fs.readJson(path.join(review(), 'checks', 'skill-layout.receipt.json'));
    expect(Object.keys(receipt).sort()).toEqual(['candidateDigest', 'command', 'exit', 'id', 'kind', 'raw', 'status', 'version']);
    expect((await fs.readdir(readFolder())).sort()).toEqual(['evidence-skill-task.json', 'skill-layout.raw.txt', 'skill-layout.receipt.json']);

    const raw = job.inputs.find((item: Json) => item.id === 'skill-layout-raw');
    const skill = record.inventory.find((item: Json) => item.path === 'SKILL.md');
    const cites = [{ sourceId: 'candidate', path: 'SKILL.md', sha256: skill.sha256, quote: '# Invoice action CSV' },
      { sourceId: 'skill-layout-raw', path: 'skill-layout.raw.txt', sha256: raw.sha256, quote: 'selected fixture text checked' }];
    const result = {
      version: 2, jobId: job.id, jobDigest: out.jobDigest, candidateDigest: out.candidateDigest, status: 'reviewed', opinion: 'no-blocking-findings',
      subject: job.subject, inventory: record.inventory, inventorySource: 'caller-provided',
      coverage: record.inventory.map((item: Json) => ({ path: item.path, status: 'reviewed', rationale: 'Read in full.' })),
      criteria: job.rubric.criteria.map((item: Json) => ({ id: item.id, outcome: item.applicable ? 'satisfactory' : 'not-applicable', rationale: item.reason, citations: item.applicable ? cites : [] })),
      findings: [], deterministicEvidence: job.checks.map((item: Json) => ({ id: item.id, status: item.status, exit: item.exit, rawSha256: item.raw.sha256, receiptSha256: item.receipt.sha256, observation: 'Caller-run fixture check.' })),
      limitations: ['Synthetic result; no reviewer was invoked.'], live: 'unverified', openItems: [], acceptedDraft: false,
    };
    const resultFile = path.join(review(), 'result.json');
    await fs.writeJson(resultFile, result);
    const cited = check(['--job', jobFile, '--result', resultFile]);
    expect(cited.status, cited.stderr).toBe(0);
    expect(JSON.parse(cited.stdout)).toMatchObject({ candidateMatch: true, opinion: 'no-blocking-findings', acceptedDraft: false });
  });

  it('builds a Skill job with a Claude target and upstream intent: all five guides, the template pin and host-fit applicable', async () => {
    const { job } = await roundTrip(await skillSpec({ intent: 'upstream', subject: { kind: 'skill', identity: 'invoice-action-csv', target: { observedVersion: '2.1.301' } } }));
    expect(job.inputs.filter((item: Json) => item.kind === 'guide')).toHaveLength(5);
    expect(job.inputs.filter((item: Json) => item.kind === 'snapshot')).toHaveLength(5);
    expect(job.inputs.find((item: Json) => item.kind === 'template').path).toBe(path.join(CHECKOUT, '.github/PULL_REQUEST_TEMPLATE/artifact-contribution.md'));
    expect(job.subject.target).toEqual({ host: 'claude', product: 'Claude Code CLI', scope: 'workspace', lane: 'native', observedVersion: '2.1.301', unverifiedReason: null });
    expect(job.rubric.criteria.find((item: Json) => item.id === 'host-fit')).toMatchObject({ applicable: true, required: true });
  });

  it('builds a shared-pair job with the pair fixed as subject, no guide pins and an optional unperformed check', async () => {
    const spec = await skillSpec();
    await fs.emptyDir(candidate());
    await writeCandidate({ [`core/${STEM}.core.md`]: await fs.readFile(fixture.source(`core/${STEM}.core.md`)),
      [`core/${STEM}.contract.json`]: await fs.readFile(fixture.source(`core/${STEM}.contract.json`)), 'notes/keep.md': 'Unchanged note.\n' });
    const tool = await validator();
    const candidateDigest = await digestOf(spec);
    const ran = await callerRun('pair-text', [tool, path.join(candidate(), `core/${STEM}.contract.json`), STEM]);
    const pairChecks = [{ id: 'pair-text', required: true, status: 'passed', command: { argv: [tool], cwd: work }, candidateDigest, exit: ran.exit, output: ran.output }];
    // The kind fixes the pair as the only subject: a third subject file is refused.
    expect(refusal(build(await writeSpec({ ...spec, id: 'pair-review', subject: { kind: 'shared-pair', identity: STEM }, roles: { 'notes/keep.md': 'subject' }, checks: pairChecks }))).reason)
      .toBe('Shared definition pair paths are incomplete or substituted.');
    const { job } = await roundTrip({ ...spec, id: 'pair-review', subject: { kind: 'shared-pair', identity: STEM }, roles: { 'notes/keep.md': 'preservation-only' },
      checks: [...pairChecks,
        { id: 'contract-check', required: false, status: 'not-run', command: { argv: [path.join(CHECKOUT, 'dist/cli.js'), 'contract-check'], cwd: work } }] });
    expect(job.subject).toMatchObject({ kind: 'shared-pair', definition: STEM, target: null, paths: [`core/${STEM}.contract.json`, `core/${STEM}.core.md`] });
    expect(job.inputs.filter((item: Json) => ['guide', 'snapshot'].includes(item.kind))).toEqual([]);
    expect(job.candidate.files.find((item: Json) => item.path === 'notes/keep.md').role).toBe('preservation-only');
    expect(job.checks[1]).toMatchObject({ id: 'contract-check', status: 'not-run', exit: null, raw: null, receipt: null });
    expect(job.rubric.criteria.find((item: Json) => item.id === 'shared-semantics')).toMatchObject({ applicable: true, required: true });
  });

  it('builds a claude-agent job with its shared core and contract pins and all five guides', async () => {
    const spec = await skillSpec();
    await fs.emptyDir(candidate());
    await writeCandidate({ 'hosts/claude/agents/factory-evaluator.md': await fs.readFile(fixture.source('hosts/claude/agents/factory-evaluator.md')) });
    const tool = await validator();
    const candidateDigest = await digestOf(spec);
    const ran = await callerRun('agent-text', [tool, path.join(candidate(), 'hosts/claude/agents/factory-evaluator.md'), 'name: factory-evaluator']);
    const { job } = await roundTrip({ ...spec, id: 'agent-review',
      subject: { kind: 'claude-agent', identity: 'factory-evaluator', definition: STEM, target: { unverifiedReason: 'No Claude process invoked.' } },
      roles: { 'hosts/claude/agents/factory-evaluator.md': 'subject' },
      checks: [{ id: 'agent-text', required: true, status: 'passed', command: { argv: [tool], cwd: work }, candidateDigest, exit: ran.exit, output: ran.output }] });
    expect(job.inputs.find((item: Json) => item.kind === 'shared-core').path).toBe(path.join(fixture.registry, 'core', `${STEM}.core.md`));
    expect(job.inputs.find((item: Json) => item.kind === 'shared-contract').path).toBe(path.join(fixture.registry, 'core', `${STEM}.contract.json`));
    expect(job.inputs.filter((item: Json) => item.kind === 'guide')).toHaveLength(5);
    // ADR 0072: no coverage file in the candidate, so coverage evidence does not apply.
    expect(job.rubric.criteria.find((item: Json) => item.id === 'coverage-evidence')).toMatchObject({ applicable: false, required: false, reason: 'The candidate holds no Claude agent coverage file.' });
  });

  it('makes coverage evidence applicable for a claude-agent job whose candidate holds the agent\'s coverage file (ADR 0072)', async () => {
    const spec = await skillSpec();
    await fs.emptyDir(candidate());
    await writeCandidate({ 'hosts/claude/agents/factory-evaluator.md': await fs.readFile(fixture.source('hosts/claude/agents/factory-evaluator.md')),
      'hosts/claude/agents/factory-evaluator.coverage.json': '{"version":1,"role":"factory-evaluator","definition":"subagent-factory-evaluator","invariants":[]}\n' });
    const tool = await validator();
    const candidateDigest = await digestOf(spec);
    const ran = await callerRun('agent-text', [tool, path.join(candidate(), 'hosts/claude/agents/factory-evaluator.md'), 'name: factory-evaluator']);
    const { job } = await roundTrip({ ...spec, id: 'agent-review',
      subject: { kind: 'claude-agent', identity: 'factory-evaluator', definition: STEM, target: { unverifiedReason: 'No Claude process invoked.' } },
      roles: { 'hosts/claude/agents/factory-evaluator.md': 'subject', 'hosts/claude/agents/factory-evaluator.coverage.json': 'support' },
      checks: [{ id: 'agent-text', required: true, status: 'passed', command: { argv: [tool], cwd: work }, candidateDigest, exit: ran.exit, output: ran.output }] });
    expect(job.rubric.criteria.find((item: Json) => item.id === 'coverage-evidence')).toMatchObject({ applicable: true, required: true });
  });

  describe('rule kind (ADR 0082 decision 3, slice S1)', () => {
    const RULE_NAME = 'release-notes';
    const RULE_TEXT = '# Release notes\n\n- Name the user-visible change before the internal cause.\n- Link the issue or the pull request for every item.\n';
    const TARGET = { unverifiedReason: 'No Claude process invoked.' };
    /** A rule candidate: the one rule file `<identity>.md`, checked by the caller with the built rule-check. */
    async function ruleSpec(overrides: Json = {}): Promise<Json> {
      const spec = await skillSpec();
      await fs.emptyDir(candidate());
      await writeCandidate({ [`${RULE_NAME}.md`]: RULE_TEXT });
      const argv = [path.join(CHECKOUT, 'dist/cli.js'), 'rule-check', '--artifact', path.join(candidate(), `${RULE_NAME}.md`)];
      const candidateDigest = await digestOf(spec);
      const ran = await callerRun('rule-check', argv);
      expect(ran.exit, await fs.readFile(ran.output, 'utf8')).toBe(0);
      return { ...spec, id: 'rule-review', subject: { kind: 'rule', identity: RULE_NAME, target: TARGET }, roles: {},
        fixedValues: [{ name: 'rule-name', value: RULE_NAME }], acceptance: [{ id: 'task-fit', description: 'The rule names its two instructions.' }],
        checks: [{ id: 'rule-check', required: true, status: 'passed', command: { argv, cwd: fixture.workspace }, candidateDigest, exit: ran.exit, output: ran.output }],
        ...overrides };
    }

    it('builds a rule job: the rule file fixed as the one subject, the rule guide and page pinned, host fit applicable and shared semantics not', async () => {
      const { job, out } = await roundTrip(await ruleSpec());
      expect(out).toMatchObject({ status: 'job-written', counts: { files: 1, checks: 1 } });
      expect(job.subject).toEqual({ kind: 'rule', identity: RULE_NAME, target: { host: 'claude', product: 'Claude Code CLI', scope: 'workspace', lane: 'native', observedVersion: null, unverifiedReason: TARGET.unverifiedReason }, paths: [`${RULE_NAME}.md`], definition: null });
      expect(job.candidate.files.map((item: Json) => item.role)).toEqual(['subject']);
      expect(job.inputs.filter((item: Json) => item.kind === 'guide').map((item: Json) => item.id)).toEqual(['rule-guide']);
      expect(job.inputs.find((item: Json) => item.id === 'rule-guide').path).toBe(path.join(CHECKOUT, 'host-library/claude/guide/rule.md'));
      expect(job.inputs.filter((item: Json) => item.kind === 'snapshot').map((item: Json) => item.id)).toEqual(['rule-page']);
      expect(job.inputs.find((item: Json) => item.id === 'rule-page').path).toBe(path.join(CHECKOUT, 'host-library/claude/pages/rule/memory.md'));
      expect(job.inputs.some((item: Json) => ['shared-core', 'shared-contract'].includes(item.kind))).toBe(false);
      expect(job.rubric.criteria.filter((item: Json) => !item.applicable).map((item: Json) => item.id).sort()).toEqual(['coverage-evidence', 'shared-semantics']);
      expect(job.rubric.criteria.find((item: Json) => item.id === 'host-fit')).toMatchObject({ applicable: true, required: true });
      expect(job.rubric.criteria.find((item: Json) => item.id === 'shared-semantics').reason).toBe('A rule review has no shared definition.');
    });

    it('pins the template for upstream intent, as for any kind', async () => {
      const { job } = await roundTrip(await ruleSpec({ intent: 'upstream' }));
      expect(job.inputs.find((item: Json) => item.kind === 'template').path).toBe(path.join(CHECKOUT, '.github/PULL_REQUEST_TEMPLATE/artifact-contribution.md'));
    });

    it('accepts a result for the rule job that cites the rule file and the saved check output', async () => {
      const { out, job, jobFile, record } = await roundTrip(await ruleSpec());
      const raw = job.inputs.find((item: Json) => item.id === 'rule-check-raw');
      const rule = record.inventory.find((item: Json) => item.path === `${RULE_NAME}.md`);
      const cites = [{ sourceId: 'candidate', path: `${RULE_NAME}.md`, sha256: rule.sha256, quote: '# Release notes' },
        { sourceId: 'rule-check-raw', path: 'rule-check.raw.txt', sha256: raw.sha256, quote: '"quality": "pending"' }];
      const result = {
        version: 2, jobId: job.id, jobDigest: out.jobDigest, candidateDigest: out.candidateDigest, status: 'reviewed', opinion: 'no-blocking-findings',
        subject: job.subject, inventory: record.inventory, inventorySource: 'caller-provided',
        coverage: record.inventory.map((item: Json) => ({ path: item.path, status: 'reviewed', rationale: 'Read in full.' })),
        criteria: job.rubric.criteria.map((item: Json) => ({ id: item.id, outcome: item.applicable ? 'satisfactory' : 'not-applicable', rationale: item.reason, citations: item.applicable ? cites : [] })),
        findings: [], deterministicEvidence: job.checks.map((item: Json) => ({ id: item.id, status: item.status, exit: item.exit, rawSha256: item.raw.sha256, receiptSha256: item.receipt.sha256, observation: 'Caller-run rule-check.' })),
        limitations: ['Synthetic result; no reviewer was invoked. Antigravity delivery is not covered.'], live: 'unverified', openItems: [], acceptedDraft: false,
      };
      const resultFile = path.join(review(), 'result.json');
      await fs.writeJson(resultFile, result);
      const cited = check(['--job', jobFile, '--result', resultFile]);
      expect(cited.status, cited.stderr).toBe(0);
      expect(JSON.parse(cited.stdout)).toMatchObject({ candidateMatch: true, opinion: 'no-blocking-findings', acceptedDraft: false });
    });

    it('refuses a rule review that names a shared definition, lacks its target, lacks its rule file or reassigns its role', async () => {
      const spec = await ruleSpec();
      const subject = (extra: Json) => ({ kind: 'rule', identity: RULE_NAME, target: TARGET, ...extra });
      expect(refusal(build(await writeSpec({ ...spec, subject: subject({ definition: STEM }) }))).reason).toBe('A rule review has no shared definition.');
      expect(refusal(build(await writeSpec({ ...spec, subject: { kind: 'rule', identity: RULE_NAME } }))).reason).toBe('Rule review requires its explicit target context.');
      expect(refusal(build(await writeSpec({ ...spec, subject: subject({ identity: 'other-rule' }) }))).reason).toBe('The rule candidate lacks its fixed subject file other-rule.md.');
      await writeCandidate({ 'notes/keep.md': 'Unchanged note.\n' });
      expect(refusal(build(await writeSpec({ ...spec, roles: { [`${RULE_NAME}.md`]: 'support', 'notes/keep.md': 'preservation-only' } }))).reason).toBe(`The rule kind fixes the role of ${RULE_NAME}.md as subject.`);
    });

    it('refuses a rule candidate with a second subject file or a subject at another path, in the builder', async () => {
      const spec = await ruleSpec();
      await writeCandidate({ 'extra.md': 'A second file.\n' });
      const extra = refusal(build(await writeSpec({ ...spec, roles: { 'extra.md': 'subject' } })));
      expect(extra.reason).toBe(`A rule review has exactly one subject file, ${RULE_NAME}.md.`);
      const other = refusal(build(await writeSpec({ ...spec, subject: { kind: 'rule', identity: 'extra', target: TARGET }, roles: { [`${RULE_NAME}.md`]: 'subject' } })));
      expect(other.reason).toBe(`A rule review has exactly one subject file, extra.md.`);
    });

    it('refuses a rule review without an executed rule-check, in the builder', async () => {
      const spec = await ruleSpec();
      const check = spec.checks[0] as Json;
      const renamed = refusal(build(await writeSpec({ ...spec, checks: [{ ...check, id: 'other-check' }] })));
      expect(renamed.reason).toBe('A rule review needs its executed rule-check: record a required check with the id rule-check that was run.');
      const notRun = refusal(build(await writeSpec({ ...spec, checks: [{ id: 'rule-check', required: true, status: 'not-run', command: check.command }] })));
      expect(notRun.reason).toBe('A rule review needs its executed rule-check: record a required check with the id rule-check that was run.');
      const optional = refusal(build(await writeSpec({ ...spec, checks: [{ ...check, required: false }] })));
      expect(optional.reason).toBe('A rule review needs its executed rule-check: record a required check with the id rule-check that was run.');
    });

    const RULE_COMMAND = 'The rule-check must record the command node <checkout>/dist/cli.js rule-check --artifact <the rule file>.';
    const RULE_ARTIFACT = 'The rule-check must check this review\'s own rule file: the candidate\'s <identity>.md or <registry>/rules/<identity>.md.';

    it('refuses a rule-check whose recorded command is not the rule-check CLI on the subject file, in the builder', async () => {
      const spec = await ruleSpec();
      const check = spec.checks[0] as Json;
      const cli = path.join(CHECKOUT, 'dist/cli.js');
      const subject = path.join(candidate(), `${RULE_NAME}.md`);
      const withArgv = (argv: string[]) => ({ ...spec, checks: [{ ...check, command: { ...check.command, argv } }] });
      for (const argv of [
        [cli, 'skill-check', '--artifact', subject],
        [path.join(CHECKOUT, 'dist/other.js'), 'rule-check', '--artifact', subject],
        [cli, 'rule-check', '--artifact', subject, '--extra'],
        [cli, 'rule-check', subject],
        [],
      ]) expect(refusal(build(await writeSpec(withArgv(argv)))).reason, JSON.stringify(argv)).toBe(RULE_COMMAND);
      for (const artifact of [path.join(candidate(), 'other.md'), `${RULE_NAME}.md`, path.join(CHECKOUT, 'registry/rules/other.md')]) {
        expect(refusal(build(await writeSpec(withArgv([cli, 'rule-check', '--artifact', artifact])))).reason, artifact).toBe(RULE_ARTIFACT);
      }
      // A registry spelling of the rule file is refused while that file does not exist (round 3: the path alone proves nothing).
      for (const artifact of [path.join(fixture.registry, 'rules', `${RULE_NAME}.md`), path.join(CHECKOUT, 'registry/rules', `${RULE_NAME}.md`)]) {
        expect(refusal(build(await writeSpec(withArgv([cli, 'rule-check', '--artifact', artifact])))).reason, artifact).toBe(RULE_ARTIFACT);
      }
      // The candidate spelling is recorded as given.
      const built = build(await writeSpec(withArgv([cli, 'rule-check', '--artifact', subject])));
      expect(built.status, built.stderr).toBe(0);
      await fs.remove(review()); await fs.remove(readFolder());
    });

    it('accepts a registry spelling of the rule file only when that file has the candidate\'s bytes, in the builder', async () => {
      const spec = await ruleSpec();
      const check = spec.checks[0] as Json;
      const registryRule = path.join(fixture.registry, 'rules', `${RULE_NAME}.md`);
      const withArgv = (artifact: string) => ({ ...spec, checks: [{ ...check, command: { ...check.command, argv: [path.join(CHECKOUT, 'dist/cli.js'), 'rule-check', '--artifact', artifact] } }] });
      try {
        // A registry copy with identical bytes is the same rule: recorded as given.
        await fs.outputFile(registryRule, RULE_TEXT);
        const same = build(await writeSpec(withArgv(registryRule)));
        expect(same.status, same.stderr).toBe(0);
        await fs.remove(review()); await fs.remove(readFolder());
        // A registry copy with other bytes is another rule: the check on it says nothing about this candidate.
        await fs.outputFile(registryRule, `${RULE_TEXT}\n- A line the candidate does not have.\n`);
        expect(refusal(build(await writeSpec(withArgv(registryRule)))).reason).toBe(RULE_ARTIFACT);
        // A directory in the place of the file is no rule file.
        await fs.remove(registryRule); await fs.ensureDir(registryRule);
        expect(refusal(build(await writeSpec(withArgv(registryRule)))).reason).toBe(RULE_ARTIFACT);
      } finally { await fs.remove(registryRule); }
    });

    it('refuses, in the installed checker, a rule job whose rule-check command or recorded hashes differ', async () => {
      const { jobFile } = await roundTrip(await ruleSpec());
      const job = await fs.readJson(jobFile) as Json;
      const tamper = async (change: (copy: Json) => void) => {
        const copy = JSON.parse(JSON.stringify(job)) as Json;
        change(copy);
        await fs.writeJson(jobFile, copy);
        return check(['--job', jobFile]);
      };
      const text = (run: { stderr: string; stdout: string }) => run.stderr + run.stdout;
      const wrongCommand = await tamper(copy => { copy.checks[0].command.argv[1] = 'skill-check'; });
      expect(wrongCommand.status).not.toBe(0);
      expect(text(wrongCommand)).toContain(RULE_COMMAND);
      const wrongArtifact = await tamper(copy => { copy.checks[0].command.argv[3] = path.join(candidate(), 'other.md'); });
      expect(wrongArtifact.status).not.toBe(0);
      expect(text(wrongArtifact)).toContain(RULE_ARTIFACT);
      const wrongRaw = await tamper(copy => { copy.checks[0].raw.sha256 = 'f'.repeat(64); });
      expect(wrongRaw.status).not.toBe(0);
      expect(text(wrongRaw)).toContain('The rule-check evidence differs from the check record: rule-check-raw.');
      const wrongReceipt = await tamper(copy => { copy.checks[0].receipt.sha256 = 'e'.repeat(64); });
      expect(wrongReceipt.status).not.toBe(0);
      expect(text(wrongReceipt)).toContain('The rule-check evidence differs from the check record: rule-check-receipt.');
    });

    it('accepts, in the installed checker, a registry spelling of the rule file only while that file has the recorded bytes of the subject', async () => {
      const spec = await ruleSpec();
      const registryRule = path.join(fixture.registry, 'rules', `${RULE_NAME}.md`);
      const argv = [path.join(CHECKOUT, 'dist/cli.js'), 'rule-check', '--artifact', registryRule];
      const text = (run: { stderr: string; stdout: string }) => run.stderr + run.stdout;
      try {
        await fs.outputFile(registryRule, RULE_TEXT);
        const { jobFile } = await roundTrip({ ...spec, checks: [{ ...spec.checks[0], command: { ...spec.checks[0].command, argv } }] });
        // The registry copy changed after the job was built: its path no longer names the rule the job pins.
        await fs.outputFile(registryRule, `${RULE_TEXT}\n- A line the candidate does not have.\n`);
        const other = check(['--job', jobFile]);
        expect(other.status).not.toBe(0);
        expect(text(other)).toContain(RULE_ARTIFACT);
        await fs.remove(registryRule);
        const absent = check(['--job', jobFile]);
        expect(absent.status).not.toBe(0);
        expect(text(absent)).toContain(RULE_ARTIFACT);
      } finally { await fs.remove(registryRule); }
    });

    it('refuses, in the installed checker, a rule job with a second subject file, a foreign subject path or no rule-check evidence', async () => {
      const { jobFile } = await roundTrip(await ruleSpec());
      const job = await fs.readJson(jobFile) as Json;
      const tamper = async (change: (copy: Json) => void) => {
        const copy = JSON.parse(JSON.stringify(job)) as Json;
        change(copy);
        await fs.writeJson(jobFile, copy);
        return check(['--job', jobFile]);
      };
      const identity = await tamper(copy => { copy.subject.identity = 'other-rule'; });
      expect(identity.status).not.toBe(0);
      expect(identity.stderr + identity.stdout).toContain(`A rule review has exactly one subject file, other-rule.md.`);
      // The second file really exists, so the candidate inventory matches and only the one-subject rule can refuse the job.
      const extraBytes = Buffer.from('A second file.\n');
      await writeCandidate({ 'extra.md': extraBytes });
      const second = await tamper(copy => {
        copy.candidate.files.push({ path: 'extra.md', kind: 'file', bytes: extraBytes.length, sha256: digest(extraBytes), role: 'subject' });
        copy.subject.paths.push('extra.md');
      });
      await fs.remove(path.join(candidate(), 'extra.md'));
      expect(second.status).not.toBe(0);
      expect(second.stderr + second.stdout).toContain(`A rule review has exactly one subject file, ${RULE_NAME}.md.`);
      const renamed = await tamper(copy => { copy.checks[0].id = 'other-check'; });
      expect(renamed.status).not.toBe(0);
      expect(renamed.stderr + renamed.stdout).toContain('A rule review needs its executed rule-check');
      const noInput = await tamper(copy => { copy.inputs = copy.inputs.filter((item: Json) => !item.id.startsWith('rule-check')); });
      expect(noInput.status).not.toBe(0);
      expect(noInput.stderr + noInput.stdout).toContain('A rule review needs its executed rule-check');
    });

    it('names the rule kind in its refusal for an unknown subject kind', async () => {
      const spec = await ruleSpec();
      expect(refusal(build(await writeSpec({ ...spec, subject: { kind: 'hook', identity: RULE_NAME, target: TARGET } }))).reason).toBe('Spec subject kind must be skill, shared-pair, claude-agent, rule or workflow.');
    });

    it('is refused by the installed checker when the job lacks its rule guide pin or claims a shared definition', async () => {
      const { jobFile } = await roundTrip(await ruleSpec());
      const job = await fs.readJson(jobFile) as Json;
      const tamper = async (change: (copy: Json) => void) => {
        const copy = JSON.parse(JSON.stringify(job)) as Json;
        change(copy);
        await fs.writeJson(jobFile, copy);
        return check(['--job', jobFile]);
      };
      const noGuide = await tamper(copy => { copy.inputs = copy.inputs.filter((item: Json) => item.id !== 'rule-guide'); });
      expect(noGuide.status).not.toBe(0);
      expect(noGuide.stderr + noGuide.stdout).toMatch(/guide/i);
      const shared = await tamper(copy => { copy.subject.definition = STEM; });
      expect(shared.status).not.toBe(0);
      expect(shared.stderr + shared.stdout).toMatch(/shared definition/i);
    });
  });

  describe('workflow kind (ADR 0082 decision 3, slice 5)', () => {
    const WF_NAME = 'release-flow';
    const WF_TEXT = [
      'export const meta = {', `  name: '${WF_NAME}',`, "  description: 'Draft release notes from the merged pull requests.',", '}', '',
      "const merged = await agent('List the merged pull requests')", 'return { merged }', '',
    ].join('\n');
    const TARGET = { unverifiedReason: 'No Claude process invoked.' };
    const registryWorkflow = () => path.join(fixture.registry, 'hosts/claude/workflows', `${WF_NAME}.js`);
    const checkoutWorkflow = () => path.join(CHECKOUT, 'registry/hosts/claude/workflows', `${WF_NAME}.js`);
    /** The registry copy the caller checks: the workflow-check reads only <registry>/hosts/claude/workflows/<name>.js, and wants the paired Skill. */
    async function registryCopy(text: string = WF_TEXT): Promise<string> {
      await fs.outputFile(registryWorkflow(), text);
      await fs.outputFile(path.join(fixture.registry, 'skills', WF_NAME, 'SKILL.md'), `---\nname: ${WF_NAME}\ndescription: Draft release notes.\n---\n# ${WF_NAME}\n`);
      return registryWorkflow();
    }
    /** A workflow candidate: the one script `<identity>.js`; the caller ran the built workflow-check on its identical registry copy. */
    async function workflowSpec(overrides: Json = {}): Promise<Json> {
      const spec = await skillSpec();
      await fs.emptyDir(candidate());
      await writeCandidate({ [`${WF_NAME}.js`]: WF_TEXT });
      const argv = [path.join(CHECKOUT, 'dist/cli.js'), 'workflow-check', '--artifact', await registryCopy()];
      const candidateDigest = await digestOf(spec);
      const ran = await callerRun('workflow-check', argv);
      expect(ran.exit, await fs.readFile(ran.output, 'utf8')).toBe(0);
      return { ...spec, id: 'workflow-review', subject: { kind: 'workflow', identity: WF_NAME, target: TARGET }, roles: {},
        fixedValues: [{ name: 'workflow-name', value: WF_NAME }], acceptance: [{ id: 'task-fit', description: 'The workflow lists the merged pull requests.' }],
        checks: [{ id: 'workflow-check', required: true, status: 'passed', command: { argv, cwd: fixture.workspace }, candidateDigest, exit: ran.exit, output: ran.output }],
        ...overrides };
    }

    it('builds a workflow job: the script fixed as the one subject, the orchestration guide and page pinned, host fit applicable and shared semantics not', async () => {
      const { job, out } = await roundTrip(await workflowSpec());
      expect(out).toMatchObject({ status: 'job-written', counts: { files: 1, checks: 1 } });
      expect(job.subject).toEqual({ kind: 'workflow', identity: WF_NAME, target: { host: 'claude', product: 'Claude Code CLI', scope: 'workspace', lane: 'native', observedVersion: null, unverifiedReason: TARGET.unverifiedReason }, paths: [`${WF_NAME}.js`], definition: null });
      expect(job.candidate.files.map((item: Json) => item.role)).toEqual(['subject']);
      expect(job.inputs.filter((item: Json) => item.kind === 'guide').map((item: Json) => item.id)).toEqual(['orchestration-guide']);
      expect(job.inputs.find((item: Json) => item.id === 'orchestration-guide').path).toBe(path.join(CHECKOUT, 'host-library/claude/guide/orchestration.md'));
      expect(job.inputs.filter((item: Json) => item.kind === 'snapshot').map((item: Json) => item.id)).toEqual(['orchestration-page']);
      expect(job.inputs.find((item: Json) => item.id === 'orchestration-page').path).toBe(path.join(CHECKOUT, 'host-library/claude/pages/orchestration/workflows.md'));
      expect(job.inputs.some((item: Json) => ['shared-core', 'shared-contract'].includes(item.kind))).toBe(false);
      expect(job.rubric.criteria.filter((item: Json) => !item.applicable).map((item: Json) => item.id).sort()).toEqual(['coverage-evidence', 'shared-semantics']);
      expect(job.rubric.criteria.find((item: Json) => item.id === 'host-fit')).toMatchObject({ applicable: true, required: true });
      expect(job.rubric.criteria.find((item: Json) => item.id === 'shared-semantics').reason).toBe('A workflow review has no shared definition.');
    });

    it('pins the template for upstream intent, as for any kind', async () => {
      const { job } = await roundTrip(await workflowSpec({ intent: 'upstream' }));
      expect(job.inputs.find((item: Json) => item.kind === 'template').path).toBe(path.join(CHECKOUT, '.github/PULL_REQUEST_TEMPLATE/artifact-contribution.md'));
    });

    it('accepts a result for the workflow job that cites the script and the saved check output', async () => {
      const { out, job, jobFile, record } = await roundTrip(await workflowSpec());
      const raw = job.inputs.find((item: Json) => item.id === 'workflow-check-raw');
      const script = record.inventory.find((item: Json) => item.path === `${WF_NAME}.js`);
      const cites = [{ sourceId: 'candidate', path: `${WF_NAME}.js`, sha256: script.sha256, quote: 'export const meta' },
        { sourceId: 'workflow-check-raw', path: 'workflow-check.raw.txt', sha256: raw.sha256, quote: '"quality": "pending"' }];
      const result = {
        version: 2, jobId: job.id, jobDigest: out.jobDigest, candidateDigest: out.candidateDigest, status: 'reviewed', opinion: 'no-blocking-findings',
        subject: job.subject, inventory: record.inventory, inventorySource: 'caller-provided',
        coverage: record.inventory.map((item: Json) => ({ path: item.path, status: 'reviewed', rationale: 'Read in full.' })),
        criteria: job.rubric.criteria.map((item: Json) => ({ id: item.id, outcome: item.applicable ? 'satisfactory' : 'not-applicable', rationale: item.reason, citations: item.applicable ? cites : [] })),
        findings: [], deterministicEvidence: job.checks.map((item: Json) => ({ id: item.id, status: item.status, exit: item.exit, rawSha256: item.raw.sha256, receiptSha256: item.receipt.sha256, observation: 'Caller-run workflow-check.' })),
        limitations: ['Synthetic result; no reviewer was invoked. Antigravity and Cline delivery are not covered; agent types the check could not resolve are not verified.'], live: 'unverified', openItems: [], acceptedDraft: false,
      };
      const resultFile = path.join(review(), 'result.json');
      await fs.writeJson(resultFile, result);
      const cited = check(['--job', jobFile, '--result', resultFile]);
      expect(cited.status, cited.stderr).toBe(0);
      expect(JSON.parse(cited.stdout)).toMatchObject({ candidateMatch: true, opinion: 'no-blocking-findings', acceptedDraft: false });
    });

    it('refuses a workflow review that names a shared definition, lacks its target, lacks its script or reassigns its role', async () => {
      const spec = await workflowSpec();
      const subject = (extra: Json) => ({ kind: 'workflow', identity: WF_NAME, target: TARGET, ...extra });
      expect(refusal(build(await writeSpec({ ...spec, subject: subject({ definition: STEM }) }))).reason).toBe('A workflow review has no shared definition.');
      expect(refusal(build(await writeSpec({ ...spec, subject: { kind: 'workflow', identity: WF_NAME } }))).reason).toBe('Workflow review requires its explicit target context.');
      expect(refusal(build(await writeSpec({ ...spec, subject: subject({ identity: 'other-flow' }) }))).reason).toBe('The workflow candidate lacks its fixed subject file other-flow.js.');
      await writeCandidate({ 'notes/keep.md': 'Unchanged note.\n' });
      expect(refusal(build(await writeSpec({ ...spec, roles: { [`${WF_NAME}.js`]: 'support', 'notes/keep.md': 'preservation-only' } }))).reason).toBe(`The workflow kind fixes the role of ${WF_NAME}.js as subject.`);
    });

    it('refuses a workflow candidate with a second subject file or a subject at another path, in the builder', async () => {
      const spec = await workflowSpec();
      await writeCandidate({ 'extra.js': 'return 1\n' });
      const extra = refusal(build(await writeSpec({ ...spec, roles: { 'extra.js': 'subject' } })));
      expect(extra.reason).toBe(`A workflow review has exactly one subject file, ${WF_NAME}.js.`);
      const other = refusal(build(await writeSpec({ ...spec, subject: { kind: 'workflow', identity: 'extra', target: TARGET }, roles: { [`${WF_NAME}.js`]: 'subject' } })));
      expect(other.reason).toBe('A workflow review has exactly one subject file, extra.js.');
    });

    const WF_NEEDS = 'A workflow review needs its executed workflow-check: record a required check with the id workflow-check that was run.';
    const WF_COMMAND = 'The workflow-check must record the command node <checkout>/dist/cli.js workflow-check --artifact <the workflow file>.';
    const WF_ARTIFACT = 'The workflow-check must check this review\'s own workflow file: the candidate\'s <identity>.js or <registry>/hosts/claude/workflows/<identity>.js.';

    it('refuses a workflow review without an executed workflow-check, in the builder', async () => {
      const spec = await workflowSpec();
      const recorded = spec.checks[0] as Json;
      expect(refusal(build(await writeSpec({ ...spec, checks: [{ ...recorded, id: 'other-check' }] }))).reason).toBe(WF_NEEDS);
      expect(refusal(build(await writeSpec({ ...spec, checks: [{ id: 'workflow-check', required: true, status: 'not-run', command: recorded.command }] }))).reason).toBe(WF_NEEDS);
      expect(refusal(build(await writeSpec({ ...spec, checks: [{ ...recorded, required: false }] }))).reason).toBe(WF_NEEDS);
      // A rule-check is not a workflow-check, even when it is the only check recorded.
      expect(refusal(build(await writeSpec({ ...spec, checks: [{ ...recorded, id: 'rule-check' }] }))).reason).toBe(WF_NEEDS);
    });

    it('refuses a workflow-check whose recorded command is not the workflow-check CLI on the subject file, in the builder', async () => {
      const spec = await workflowSpec();
      const recorded = spec.checks[0] as Json;
      const cli = path.join(CHECKOUT, 'dist/cli.js');
      const subject = path.join(candidate(), `${WF_NAME}.js`);
      const withArgv = (argv: string[]) => ({ ...spec, checks: [{ ...recorded, command: { ...recorded.command, argv } }] });
      for (const argv of [
        [cli, 'rule-check', '--artifact', subject],
        [cli, 'skill-check', '--artifact', subject],
        [path.join(CHECKOUT, 'dist/other.js'), 'workflow-check', '--artifact', subject],
        [cli, 'workflow-check', '--artifact', subject, '--extra'],
        [cli, 'workflow-check', subject],
        [],
      ]) expect(refusal(build(await writeSpec(withArgv(argv)))).reason, JSON.stringify(argv)).toBe(WF_COMMAND);
      for (const artifact of [path.join(candidate(), 'other.js'), `${WF_NAME}.js`, path.join(CHECKOUT, 'registry/hosts/claude/workflows/other.js')]) {
        expect(refusal(build(await writeSpec(withArgv([cli, 'workflow-check', '--artifact', artifact])))).reason, artifact).toBe(WF_ARTIFACT);
      }
      // The checkout's own registry spelling is refused while that file does not exist (a path alone proves nothing).
      if (!(await fs.pathExists(checkoutWorkflow()))) {
        expect(refusal(build(await writeSpec(withArgv([cli, 'workflow-check', '--artifact', checkoutWorkflow()])))).reason).toBe(WF_ARTIFACT);
      }
      // The candidate spelling is recorded as given.
      const built = build(await writeSpec(withArgv([cli, 'workflow-check', '--artifact', subject])));
      expect(built.status, built.stderr).toBe(0);
      await fs.remove(review()); await fs.remove(readFolder());
    });

    it('accepts a registry spelling of the workflow only when that file has the candidate\'s bytes, in the builder', async () => {
      const spec = await workflowSpec();
      const recorded = spec.checks[0] as Json;
      const withArgv = (artifact: string) => ({ ...spec, checks: [{ ...recorded, command: { ...recorded.command, argv: [path.join(CHECKOUT, 'dist/cli.js'), 'workflow-check', '--artifact', artifact] } }] });
      // A registry copy with identical bytes is the same workflow: recorded as given.
      const same = build(await writeSpec(withArgv(registryWorkflow())));
      expect(same.status, same.stderr).toBe(0);
      await fs.remove(review()); await fs.remove(readFolder());
      // A registry copy with other bytes is another workflow: the check on it says nothing about this candidate.
      await fs.outputFile(registryWorkflow(), `${WF_TEXT}// a line the candidate does not have\n`);
      expect(refusal(build(await writeSpec(withArgv(registryWorkflow())))).reason).toBe(WF_ARTIFACT);
      // A directory in the place of the file is no workflow file.
      await fs.remove(registryWorkflow()); await fs.ensureDir(registryWorkflow());
      expect(refusal(build(await writeSpec(withArgv(registryWorkflow())))).reason).toBe(WF_ARTIFACT);
    });

    it('refuses, in the installed checker, a workflow job whose workflow-check command or recorded hashes differ', async () => {
      const { jobFile } = await roundTrip(await workflowSpec());
      const job = await fs.readJson(jobFile) as Json;
      const tamper = async (change: (copy: Json) => void) => {
        const copy = JSON.parse(JSON.stringify(job)) as Json;
        change(copy);
        await fs.writeJson(jobFile, copy);
        return check(['--job', jobFile]);
      };
      const text = (run: { stderr: string; stdout: string }) => run.stderr + run.stdout;
      const wrongCommand = await tamper(copy => { copy.checks[0].command.argv[1] = 'rule-check'; });
      expect(wrongCommand.status).not.toBe(0);
      expect(text(wrongCommand)).toContain(WF_COMMAND);
      const wrongArtifact = await tamper(copy => { copy.checks[0].command.argv[3] = path.join(candidate(), 'other.js'); });
      expect(wrongArtifact.status).not.toBe(0);
      expect(text(wrongArtifact)).toContain(WF_ARTIFACT);
      const wrongRaw = await tamper(copy => { copy.checks[0].raw.sha256 = 'f'.repeat(64); });
      expect(wrongRaw.status).not.toBe(0);
      expect(text(wrongRaw)).toContain('The workflow-check evidence differs from the check record: workflow-check-raw.');
      const wrongReceipt = await tamper(copy => { copy.checks[0].receipt.sha256 = 'e'.repeat(64); });
      expect(wrongReceipt.status).not.toBe(0);
      expect(text(wrongReceipt)).toContain('The workflow-check evidence differs from the check record: workflow-check-receipt.');
    });

    it('accepts, in the installed checker, a registry spelling of the workflow only while that file has the recorded bytes of the subject', async () => {
      const { jobFile } = await roundTrip(await workflowSpec());
      const text = (run: { stderr: string; stdout: string }) => run.stderr + run.stdout;
      // The registry copy changed after the job was built: its path no longer names the workflow the job pins.
      await fs.outputFile(registryWorkflow(), `${WF_TEXT}// a line the candidate does not have\n`);
      const other = check(['--job', jobFile]);
      expect(other.status).not.toBe(0);
      expect(text(other)).toContain(WF_ARTIFACT);
      await fs.remove(registryWorkflow());
      const absent = check(['--job', jobFile]);
      expect(absent.status).not.toBe(0);
      expect(text(absent)).toContain(WF_ARTIFACT);
    });

    it('refuses, in the installed checker, a workflow job with a second subject file, a foreign subject path or no workflow-check evidence', async () => {
      const { jobFile } = await roundTrip(await workflowSpec());
      const job = await fs.readJson(jobFile) as Json;
      const tamper = async (change: (copy: Json) => void) => {
        const copy = JSON.parse(JSON.stringify(job)) as Json;
        change(copy);
        await fs.writeJson(jobFile, copy);
        return check(['--job', jobFile]);
      };
      const identity = await tamper(copy => { copy.subject.identity = 'other-flow'; });
      expect(identity.status).not.toBe(0);
      expect(identity.stderr + identity.stdout).toContain('A workflow review has exactly one subject file, other-flow.js.');
      // The second file really exists, so the candidate inventory matches and only the one-subject rule can refuse the job.
      const extraBytes = Buffer.from('return 1\n');
      await writeCandidate({ 'extra.js': extraBytes });
      const second = await tamper(copy => {
        copy.candidate.files.push({ path: 'extra.js', kind: 'file', bytes: extraBytes.length, sha256: digest(extraBytes), role: 'subject' });
        copy.subject.paths.push('extra.js');
      });
      await fs.remove(path.join(candidate(), 'extra.js'));
      expect(second.status).not.toBe(0);
      expect(second.stderr + second.stdout).toContain(`A workflow review has exactly one subject file, ${WF_NAME}.js.`);
      const renamed = await tamper(copy => { copy.checks[0].id = 'other-check'; });
      expect(renamed.status).not.toBe(0);
      expect(renamed.stderr + renamed.stdout).toContain('A workflow review needs its executed workflow-check');
      const noInput = await tamper(copy => { copy.inputs = copy.inputs.filter((item: Json) => !item.id.startsWith('workflow-check')); });
      expect(noInput.status).not.toBe(0);
      expect(noInput.stderr + noInput.stdout).toContain('A workflow review needs its executed workflow-check');
    });

    it('names the workflow kind in its refusal for an unknown subject kind', async () => {
      const spec = await workflowSpec();
      expect(refusal(build(await writeSpec({ ...spec, subject: { kind: 'hook', identity: WF_NAME, target: TARGET } }))).reason).toBe('Spec subject kind must be skill, shared-pair, claude-agent, rule or workflow.');
    });

    it('is refused by the installed checker when the job lacks its orchestration guide pin or claims a shared definition', async () => {
      const { jobFile } = await roundTrip(await workflowSpec());
      const job = await fs.readJson(jobFile) as Json;
      const tamper = async (change: (copy: Json) => void) => {
        const copy = JSON.parse(JSON.stringify(job)) as Json;
        change(copy);
        await fs.writeJson(jobFile, copy);
        return check(['--job', jobFile]);
      };
      const noGuide = await tamper(copy => { copy.inputs = copy.inputs.filter((item: Json) => item.id !== 'orchestration-guide'); });
      expect(noGuide.status).not.toBe(0);
      expect(noGuide.stderr + noGuide.stdout).toMatch(/guide/i);
      const shared = await tamper(copy => { copy.subject.definition = STEM; });
      expect(shared.status).not.toBe(0);
      expect(shared.stderr + shared.stdout).toMatch(/shared definition/i);
    });
  });

  it('builds the live session shape: a portable Skill, one passed skill-check and the task file as extra evidence, accepted at the first call', async () => {
    await writeCandidate(INVOICE_FILES);
    const cli = path.join(CHECKOUT, 'dist/cli.js');
    const argv = [cli, 'skill-check', '--artifact', candidate(), '--corpus', path.join(CHECKOUT, 'registry/quality/skill-boilerplate-corpus.txt'), '--policy', 'agents-united-original'];
    const candidateDigest = await digestOf(await baseSpec());
    const ran = await callerRun('skill-check', argv);
    expect(ran.exit, await fs.readFile(ran.output, 'utf8')).toBe(0);
    const spec = {
      version: 1, id: 'invoice-action-csv-review', intent: 'local',
      authoringHost: { unverifiedReason: 'Prepared offline; the lead records the Claude Code version of the sitting.' },
      subject: { kind: 'skill', identity: 'invoice-action-csv' },
      objective: 'Draft one small original Skill.', fixedValues: [{ name: 'skill-name', value: 'invoice-action-csv' }],
      constraints: ['No installation, publication or live invocation.'], acceptance: [{ id: 'task-fit', description: 'The Skill names its columns.' }],
      source: { checkout: CHECKOUT, head: HEAD, registry: fixture.registry },
      roots: { candidate: candidate(), review: review(), readFolder: readFolder(), managed: [fixture.installed('.claude'), fixture.installed('.agents')] },
      roles: { 'references/csv.md': 'support', 'examples/invoice.md': 'support', 'evals/evals.json': 'support' },
      checks: [{ id: 'skill-check', required: true, status: 'passed', command: { argv, cwd: fixture.workspace }, candidateDigest, exit: 0, output: ran.output }],
      evidence: [{ id: 'skill-task', kind: 'provenance', path: await taskFile() }],
      provenance: { disposition: 'original', author: 'Proof Fixture' },
    };
    const { job, record } = await roundTrip(spec);
    // The digest taken before the run, the one skill-check itself reported and the job's are one digest.
    expect(job.checks[0].candidateDigest).toBe(candidateDigest);
    expect(JSON.parse(await fs.readFile(ran.output, 'utf8')).candidateDigest).toBe(candidateDigest);
    expect(record.checks).toEqual([{ id: 'skill-check', status: 'passed', exit: 0, required: true }]);
    expect(await fs.readFile(path.join(readFolder(), 'skill-check.raw.txt'))).toEqual(await fs.readFile(ran.output));
    const folded = job.roots.read.map((root: string) => root.toLowerCase());
    expect(new Set(folded).size).toBe(folded.length);
    for (const root of job.roots.read) expect(path.relative(root, review()).startsWith('..') || path.isAbsolute(path.relative(root, review()))).toBe(true);
    expect(job.provenance.evidence).toEqual(['skill-task']);
  });

  describe('honesty rules', () => {
    // The command, exit code and output are the caller's statement: neither the builder nor the checker runs or authenticates them.
    // Here the stated command (a script that would leave a sentinel) is not the one that produced the output; the job is still
    // accepted, because the digest binding holds, and the checker's own record says execution is unverified.
    it('runs no check command: a stated command is recorded as the caller\'s claim and the checker reports execution unverified', async () => {
      const sentinel = path.join(work, 'sentinel.txt');
      const script = path.join(work, 'tools', 'leave-sentinel.mjs');
      await fs.outputFile(script, `import fs from "node:fs"; fs.writeFileSync(${JSON.stringify(sentinel)}, "ran");\n`);
      const spec = await skillSpec();
      spec.checks[0].command.argv = [script];
      const { record } = await roundTrip(spec);
      expect(await fs.pathExists(sentinel)).toBe(false);
      expect(record).toMatchObject({ executionProof: 'unverified', live: 'unverified', quality: 'pending' });
    });

    it('prints the current candidate digest with --digest, writes nothing, and the job carries the same digest', async () => {
      const spec = await skillSpec();
      const specFile = await writeSpec(spec);
      const result = node(fixture.installed(BUILDER), ['--digest', '--spec', specFile]);
      expect(result.status, result.stderr).toBe(0);
      const printed = JSON.parse(result.stdout);
      expect(printed).toMatchObject({ version: 1, status: 'candidate-digest', files: 4 });
      expect(await fs.pathExists(review())).toBe(false);
      expect(await fs.pathExists(readFolder())).toBe(false);
      const { job } = await roundTrip(spec);
      expect(job.checks[0].candidateDigest).toBe(printed.candidateDigest);
    });

    it('refuses a check whose pre-run digest differs: the candidate changed after the check ran', async () => {
      const spec = await skillSpec();
      await fs.appendFile(path.join(candidate(), 'references/csv.md'), 'Edited after the check.\n');
      expect(refusal(build(await writeSpec(spec))).reason).toMatch(/the candidate changed after the check ran/);
      expect(await fs.pathExists(review())).toBe(false);
    });

    it('refuses an executed check without its pre-run digest and an unperformed check that carries one', async () => {
      const spec = await skillSpec();
      const missing = structuredClone(spec); delete missing.checks[0].candidateDigest;
      expect(refusal(build(await writeSpec(missing))).reason).toMatch(/needs the candidate digest printed by --digest/);
      const unperformed = structuredClone(spec);
      unperformed.checks[0] = { id: 'skill-layout', required: false, status: 'not-run', command: spec.checks[0].command, candidateDigest: spec.checks[0].candidateDigest };
      unperformed.evidence.push({ id: 'validator-note', kind: 'validator', path: spec.checks[0].output });
      expect(refusal(build(await writeSpec(unperformed))).reason).toMatch(/Unperformed check has execution claims/);
    });

    it('writes each output as a new file renamed into place: a hard-linked existing destination keeps its bytes', async () => {
      const spec = await skillSpec();
      const keep = path.join(work, 'protected-keep.txt');
      await fs.writeFile(keep, 'protected bytes\n');
      await fs.ensureDir(path.join(review(), 'checks')); await fs.ensureDir(readFolder());
      const targets = [path.join(review(), 'job.json'), path.join(review(), 'checks', 'skill-layout.raw.txt'), path.join(review(), 'checks', 'skill-layout.receipt.json'), path.join(readFolder(), 'evidence-skill-task.json')];
      for (const target of targets) fs.linkSync(keep, target);
      expect(fs.statSync(keep).nlink).toBe(targets.length + 1);
      await roundTrip(spec);
      expect(await fs.readFile(keep, 'utf8')).toBe('protected bytes\n');
      expect(fs.statSync(keep).nlink).toBe(1);
      for (const target of targets) expect(await fs.readFile(target, 'utf8')).not.toBe('protected bytes\n');
    });

    it('refuses before any write when a source would be overwritten: the spec at <review>/job.json, a saved output under a read-folder name', async () => {
      const spec = await skillSpec();
      await fs.ensureDir(review());
      const specAtJob = path.join(review(), 'job.json');
      await fs.writeJson(specAtJob, spec);
      const specBytes = await fs.readFile(specAtJob);
      expect(refusal(build(specAtJob)).reason).toMatch(/input file would be overwritten/);
      expect(await fs.readFile(specAtJob)).toEqual(specBytes);
      expect(await fs.pathExists(readFolder())).toBe(false);
      await fs.remove(review());
      await fs.ensureDir(readFolder());
      const savedInRead = path.join(readFolder(), 'skill-layout.raw.txt');
      await fs.copy(spec.checks[0].output, savedInRead);
      const savedBytes = await fs.readFile(savedInRead);
      const moved = structuredClone(spec); moved.checks[0].output = savedInRead;
      expect(refusal(build(await writeSpec(moved))).reason).toMatch(/input file would be overwritten/);
      expect(await fs.readFile(savedInRead)).toEqual(savedBytes);
      expect(await fs.pathExists(review())).toBe(false);
    });

    // An NTFS short name is a second spelling of one folder that is not a link: the comparison must use the physical path.
    it.runIf(process.platform === 'win32')('refuses the spec addressed through an NTFS short-name alias of the review root (skipped where the volume has no short names)', async ctx => {
      const spec = await skillSpec();
      const longReview = path.join(work, 'review-output-folder');
      await fs.ensureDir(longReview);
      const probe = spawnSync('cmd.exe', ['/d', '/s', '/c', `for %I in ("${longReview}") do @echo %~sI`], { encoding: 'utf8', windowsVerbatimArguments: true });
      const shortReview = probe.stdout.trim();
      // No short name on this volume (8.3 creation disabled): the alias cannot exist here, so the case is not applicable.
      if (probe.status !== 0 || !shortReview || shortReview.toLowerCase() === longReview.toLowerCase()) { ctx.skip(); return; }
      const roots = { ...spec.roots, review: longReview, readFolder: path.join(work, 'review-output-folder-read') };
      await fs.writeJson(path.join(longReview, 'job.json'), { ...spec, roots });
      const before = await fs.readFile(path.join(longReview, 'job.json'));
      expect(refusal(build(path.join(shortReview, 'job.json'))).reason).toMatch(/input file would be overwritten/);
      expect(await fs.readFile(path.join(longReview, 'job.json'))).toEqual(before);
      expect(await fs.pathExists(roots.readFolder)).toBe(false);
    });

    // The same comparison without short names: on a case-insensitive volume another case of the review root is the same folder.
    // (On a case-sensitive Linux volume no alias other than a link exists, and links are refused before this comparison.)
    it.runIf(process.platform === 'win32' || process.platform === 'darwin')('refuses the spec addressed through another case of the review root on a case-insensitive volume', async () => {
      const spec = await skillSpec();
      await fs.ensureDir(review());
      await fs.writeJson(path.join(review(), 'job.json'), spec);
      const before = await fs.readFile(path.join(review(), 'job.json'));
      expect(refusal(build(path.join(work, 'REVIEW', 'JOB.JSON'))).reason).toMatch(/input file would be overwritten/);
      expect(await fs.readFile(path.join(review(), 'job.json'))).toEqual(before);
    });

    it('names each evidence copy from its evidence id: two evidence files with the same basename pass the checker', async () => {
      const spec = await skillSpec();
      const before = path.join(work, 'saved', 'before', 'report.json'), after = path.join(work, 'saved', 'after', 'report.json');
      await fs.outputJson(before, { side: 'before' }); await fs.outputJson(after, { side: 'after' });
      const { job } = await roundTrip({ ...spec, evidence: [...spec.evidence, { id: 'before-report', kind: 'baseline', path: before }, { id: 'after-report', kind: 'diff', path: after }] });
      expect(job.inputs.find((item: Json) => item.id === 'before-report').path).toBe(path.join(readFolder(), 'evidence-before-report.json'));
      expect(job.inputs.find((item: Json) => item.id === 'after-report').path).toBe(path.join(readFolder(), 'evidence-after-report.json'));
      expect(await fs.readJson(path.join(readFolder(), 'evidence-after-report.json'))).toEqual({ side: 'after' });
    });

    it('names the copy of an evidence file with a reserved device-name id and no extension evidence-con, and the checker accepts it', async () => {
      const spec = await skillSpec();
      const plain = path.join(work, 'saved', 'plain-notes');
      await fs.outputFile(plain, 'Validator notes without an extension.\n');
      const { job } = await roundTrip({ ...spec, evidence: [...spec.evidence, { id: 'con', kind: 'validator', path: plain }] });
      const input = job.inputs.find((item: Json) => item.id === 'con');
      expect(input.path).toBe(path.join(readFolder(), 'evidence-con'));
      expect(await fs.readFile(path.join(readFolder(), 'evidence-con'), 'utf8')).toBe('Validator notes without an extension.\n');
    });

    it('leaves no temporary file after a successful build or a refused one', async () => {
      const temps = async (): Promise<string[]> => Object.keys(await evaluationTree(work)).filter(rel => /\.tmp$/.test(rel));
      const spec = await skillSpec();
      await roundTrip(spec);
      expect(await temps()).toEqual([]);
      await fs.appendFile(path.join(candidate(), 'references/csv.md'), 'Edited after the check.\n');
      expect(refusal(build(await writeSpec(spec))).reason).toMatch(/candidate changed after the check ran/);
      expect(await temps()).toEqual([]);
    });

    it('refuses a destination problem before the first write: a folder where a read-folder copy goes leaves the review root unwritten', async () => {
      const spec = await skillSpec();
      await fs.ensureDir(path.join(readFolder(), 'evidence-skill-task.json'));
      expect(refusal(build(await writeSpec(spec))).reason).toMatch(/link or something other than a regular file/);
      expect(await fs.pathExists(review())).toBe(false);
    });

    it('declares the existing parent folder of a missing executable of an unperformed check, and the checker accepts the job', async () => {
      const spec = await skillSpec();
      const missing = path.join(work, 'tools', 'missing-validator.mjs');
      spec.checks.push({ id: 'missing-tool', required: false, status: 'not-run', command: { executable: missing, argv: [], cwd: work } });
      const { job } = await roundTrip(spec);
      expect(job.roots.read).toContain(path.join(work, 'tools'));
      expect(job.checks[1].command.executable).toEqual({ path: missing, bytes: null, sha256: null });
      await fs.remove(review()); await fs.remove(readFolder());
      spec.checks[1].command.executable = path.join(work, 'absent-folder', 'tool.mjs');
      expect(refusal(build(await writeSpec(spec))).reason).toMatch(/parent folder cannot be declared as a read root/);
    });

    it('refuses optional-only provenance evidence and optional-only validator evidence, as the checker would', async () => {
      const spec = await skillSpec();
      expect(refusal(build(await writeSpec({ ...spec, evidence: [{ ...spec.evidence[0], required: false }] }))).reason).toMatch(/Missing required provenance evidence/);
      const noCheck = { ...spec, checks: [], evidence: [...spec.evidence, { id: 'validator-note', kind: 'validator', path: spec.checks[0].output, required: false }] };
      expect(refusal(build(await writeSpec(noCheck))).reason).toMatch(/Missing required validator evidence/);
    });

    it('takes a smaller budget, enforces it and writes it into the job; refuses a larger or unknown limit', async () => {
      const spec = await skillSpec();
      const { job } = await roundTrip({ ...spec, budget: { maxChecks: 1, maxSeconds: 60, maxFindings: 4 } });
      expect(job.budget).toMatchObject({ maxChecks: 1, maxSeconds: 60, maxFindings: 4, maxCandidateFiles: 32, externalCalls: 0, publication: false, repair: false });
      await fs.remove(review()); await fs.remove(readFolder());
      expect(refusal(build(await writeSpec({ ...spec, budget: { maxChecks: 7 } }))).reason).toMatch(/maxChecks must be an integer from 0 to 6/);
      expect(refusal(build(await writeSpec({ ...spec, budget: { publication: true } }))).reason).toMatch(/unknown property publication/);
      expect(refusal(build(await writeSpec({ ...spec, budget: { maxCandidateFiles: 2 } }))).reason).toMatch(/Candidate file budget exceeded/);
      expect(refusal(build(await writeSpec({ ...spec, budget: { maxChecks: 0 } }))).reason).toMatch(/at most 0/);
      expect(refusal(build(await writeSpec({ ...spec, budget: { maxEvidenceFileBytes: 64 } }))).reason).toMatch(/byte budget exceeded/);
    });

    // On a case-sensitive filesystem a folder differing only in case is another folder: it is never treated as covered.
    it.skipIf(process.platform === 'win32' || process.platform === 'darwin')('declares an executable in a case-variant folder as its own read root on a case-sensitive filesystem', async () => {
      const spec = await skillSpec();
      const variant = path.join(work, 'REVIEW-READ', 'tool.mjs');
      await fs.outputFile(variant, 'console.log("tool");\n');
      spec.checks.push({ id: 'variant-tool', required: false, status: 'not-run', command: { executable: variant, argv: [], cwd: work } });
      const { job } = await roundTrip(spec);
      expect(job.roots.read).toContain(variant);
    });

    it('has one child process only, the fixed git HEAD query, and imports only Node standard modules', async () => {
      const text = await fs.readFile(SOURCE, 'utf8');
      const imports = [...text.matchAll(/^import .* from '([^']+)';/gm)].map(match => match[1]!);
      expect(imports.length).toBeGreaterThan(0);
      for (const name of imports) expect(name, name).toMatch(/^node:/);
      expect(text).not.toMatch(/import\(|require\(|execSync|execFile|\bexec\(|\bfork\(|\bspawn\(/);
      expect(text.match(/spawnSync\(/g)).toHaveLength(1);
      expect(text).toContain("spawnSync('git', ['-C', checkout, 'rev-parse', '--verify', 'HEAD']");
      for (const word of ['foreground', 'run_in_background']) expect(text).not.toContain(word);
    });

    it.each<[string, Json, RegExp]>([
      ['passed with a nonzero exit', { exit: 1 }, /contradicts its exit code/],
      ['passed without an exit code', { exit: undefined }, /needs the exit code/],
      ['passed without a saved output', { output: undefined }, /needs its saved output file/],
      ['failed with exit 0', { status: 'failed', exit: 0 }, /contradicts its exit code/],
      ['not-run with an exit code', { status: 'not-run', exit: 0, output: undefined }, /Unperformed check has execution claims/],
      ['not-run with a saved output', { status: 'not-run', exit: undefined }, /Unperformed check has execution claims/],
    ])('refuses a check %s and writes nothing', async (_name, change, reason) => {
      const spec = await skillSpec();
      for (const [key, value] of Object.entries(change)) { if (value === undefined) delete spec.checks[0][key]; else spec.checks[0][key] = value; }
      expect(refusal(build(await writeSpec(spec))).reason).toMatch(reason);
      expect(await fs.pathExists(review())).toBe(false);
      expect(await fs.pathExists(readFolder())).toBe(false);
    });

    it('refuses passed when the saved output file does not exist', async () => {
      const spec = await skillSpec();
      spec.checks[0].output = path.join(work, 'saved', 'absent.txt');
      expect(refusal(build(await writeSpec(spec))).reason).toMatch(/missing ordinary file/);
    });

    it('records a failed check with its nonzero exit, and the checker accepts the job when the check is optional', async () => {
      const spec = await skillSpec();
      const tool = await validator();
      const ran = await callerRun('wrong-name', [tool, path.join(candidate(), 'SKILL.md'), 'name: other']);
      expect(ran.exit).toBe(1);
      spec.checks.push({ id: 'wrong-name', required: false, status: 'failed', command: { argv: [tool], cwd: work }, candidateDigest: spec.checks[0].candidateDigest, exit: 1, output: ran.output });
      const { record } = await roundTrip(spec);
      expect(record.checks).toContainEqual({ id: 'wrong-name', status: 'failed', exit: 1, required: false });
    });

    it('never changes or copies candidate bytes, and refuses evidence or a check output inside the candidate', async () => {
      const spec = await skillSpec();
      const before = await evaluationTree(candidate());
      await roundTrip(spec);
      expect(await evaluationTree(candidate())).toEqual(before);
      for (const name of await fs.readdir(readFolder())) expect(Object.values(before)).not.toContain(digest(await fs.readFile(path.join(readFolder(), name))));
      await fs.remove(review()); await fs.remove(readFolder());
      const inCandidate = { ...spec, evidence: [...spec.evidence, { id: 'own-file', kind: 'source', path: path.join(candidate(), 'SKILL.md') }] };
      expect(refusal(build(await writeSpec(inCandidate))).reason).toMatch(/inside the candidate/);
      const outputInCandidate = structuredClone(spec);
      outputInCandidate.checks[0].output = path.join(candidate(), 'references/csv.md');
      expect(refusal(build(await writeSpec(outputInCandidate))).reason).toMatch(/inside the candidate/);
      expect(await evaluationTree(candidate())).toEqual(before);
    });

    it('computes rubric applicability: the caller words reasons but cannot set applicability', async () => {
      const spec = await skillSpec();
      expect(refusal(build(await writeSpec({ ...spec, rubricReasons: { 'shared-semantics': { applicable: true } } }))).reason).toMatch(/applicability is computed/);
      expect(refusal(build(await writeSpec({ ...spec, rubric: { criteria: [] } }))).reason).toMatch(/unknown property rubric/);
      const { job } = await roundTrip({ ...spec, rubricReasons: { 'host-fit': 'The caller would like host fit judged.' } });
      expect(job.rubric.criteria.find((item: Json) => item.id === 'host-fit')).toEqual({ id: 'host-fit', required: false, applicable: false, reason: 'The caller would like host fit judged.' });
    });

    it('refuses relative paths', async () => {
      const spec = await skillSpec();
      expect(refusal(build(await writeSpec({ ...spec, roots: { ...spec.roots, candidate: 'work/candidate' } }))).reason).toMatch(/absolute/);
      expect(refusal(build(await writeSpec({ ...spec, evidence: [{ id: 'skill-task', kind: 'provenance', path: 'saved/skill-task.json' }] }))).reason).toMatch(/absolute/);
      expect(refusal(node(fixture.installed(BUILDER), ['--spec', 'saved/review-spec.json'])).reason).toMatch(/absolute/);
    });

    it('refuses a linked candidate root and a link inside the candidate', async () => {
      const spec = await skillSpec();
      const linked = path.join(work, 'linked-candidate');
      await fs.symlink(candidate(), linked, 'junction');
      expect(refusal(build(await writeSpec({ ...spec, roots: { ...spec.roots, candidate: linked } }))).reason).toMatch(/linked/i);
      const outside = path.join(work, 'outside');
      await fs.ensureDir(outside);
      await fs.symlink(outside, path.join(candidate(), 'linked-folder'), 'junction');
      expect(refusal(build(await writeSpec(spec))).reason).toMatch(/Linked candidate path/);
    });

    it('refuses a review root overlapping the candidate, the source, the read folder, a managed or a protected path', async () => {
      const spec = await skillSpec();
      await fs.ensureDir(path.join(work, 'managed-root')); await fs.ensureDir(path.join(work, 'protected-root'));
      const cases: Array<[Json, RegExp]> = [
        [{ review: path.join(candidate(), 'review'), readFolder: path.join(candidate(), 'review-read') }, /Review output root overlaps/],
        [{ review: path.join(CHECKOUT, 'p67-review-x'), readFolder: path.join(CHECKOUT, 'p67-review-x-read') }, /Review output root overlaps/],
        [{ readFolder: path.join(review(), 'read') }, /Review output root overlaps/],
        [{ review: path.join(work, 'managed-root', 'review'), readFolder: path.join(work, 'managed-root', 'read'), managed: [path.join(work, 'managed-root')] }, /Review output root overlaps/],
        [{ review: path.join(work, 'protected-root', 'review'), readFolder: path.join(work, 'protected-root', 'read'), protected: [path.join(work, 'protected-root')] }, /Review output root overlaps/],
        // The checker's order: the overlap with a managed input is reported before the managed Host segment of the same path.
        [{ review: path.join(fixture.workspace, '.claude', 'review'), readFolder: path.join(fixture.workspace, '.claude', 'read') }, /Review output root overlaps/],
        // A Host-named folder inside a protected root: still the overlap reason, as for a checkout that lives under such a folder.
        [{ review: path.join(work, '.codex', 'review'), readFolder: path.join(work, '.codex', 'read'), protected: [path.join(work, '.codex')] }, /Review output root overlaps/],
        // Only a review root that overlaps nothing reaches the managed-segment rule, in the checker's wording.
        [{ review: path.join(work, '.codex', 'review'), readFolder: path.join(work, '.codex', 'read'), managed: [] }, /^Review output root is a managed Host path\.$/],
        [{ readFolder: path.join(work, '.codex'), managed: [] }, /^Read folder is a managed Host path\.$/],
        [{ readFolder: candidate() }, /Read folder overlaps/],
        [{ readFolder: path.join(work, 'saved', 'read') }, /sibling of the review root/],
      ];
      for (const [roots, reason] of cases) {
        expect(refusal(build(await writeSpec({ ...spec, roots: { ...spec.roots, ...roots } }))).reason, JSON.stringify(roots)).toMatch(reason);
      }
      expect(await fs.pathExists(path.join(CHECKOUT, 'p67-review-x'))).toBe(false);
      expect(await fs.pathExists(review())).toBe(false);
    });

    // P27-A: check-review.mjs refuses a review root whose physical spelling names a managed Host folder; the builder must not write a job
    // the checker refuses, so it reads the physical spelling too (here a .claude folder named by its NTFS short name).
    it('refuses a review root that is a .claude folder only in its physical spelling, in the checker\'s wording (runs on Windows with short names, skipped otherwise)', async ctx => {
      const spec = await skillSpec();
      const host = path.join(work, 'hosted', '.claude');
      await fs.ensureDir(host);
      const short = shortLeafOf(host);
      if (!short) ctx.skip(NO_SHORT);
      const roots = { review: path.join(short!, 'review'), readFolder: path.join(short!, 'review-read'), managed: [] };
      expect(refusal(build(await writeSpec({ ...spec, roots: { ...spec.roots, ...roots } }))).reason).toBe('Review output root is a managed Host path.');
      expect(await fs.readdir(host)).toEqual([]);
    });

    it('refuses a HEAD that differs from the spec', async () => {
      const spec = await skillSpec();
      expect(refusal(build(await writeSpec({ ...spec, source: { ...spec.source, head: '0'.repeat(40) } }))).reason).toBe('Selected checkout HEAD changed or unavailable.');
    });

    it('refuses a candidate file with no role, an unknown spec field and an adaptation without upstream evidence', async () => {
      const spec = await skillSpec();
      expect(refusal(build(await writeSpec({ ...spec, roles: { 'references/csv.md': 'support' } }))).reason).toMatch(/lack the role of candidate file/);
      expect(refusal(build(await writeSpec({ ...spec, inputs: [] }))).reason).toMatch(/unknown property inputs/);
      expect(refusal(build(await writeSpec({ ...spec, provenance: { disposition: 'adapted', author: 'Fixture author' } }))).reason).toMatch(/adapted.*source.*licence.*comparison/);
    });

    it('refuses to run from the source registry, where its installed binding receipt is absent', async () => {
      const spec = await skillSpec();
      expect(refusal(node(SOURCE, ['--spec', await writeSpec(spec)])).reason).toMatch(/installed review-job\.mjs/);
    });
  });
});

describe('the review-job builder resolves physical paths without failing open', () => {
  it('walks up only on ENOENT or ENOTDIR and refuses any other real-path error (source text; EACCES cannot be produced portably)', async () => {
    const text = await fs.readFile(SOURCE, 'utf8');
    expect(text).toMatch(/error\?\.code !== 'ENOENT' && error\?\.code !== 'ENOTDIR'/);
    expect(text).toContain('Cannot resolve the physical path of');
    expect(text).not.toContain('while (!fs.existsSync(existing))');
  });
});
