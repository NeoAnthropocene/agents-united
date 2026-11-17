/* eslint-disable @typescript-eslint/no-explicit-any */
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import type { SpawnSyncReturns } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import YAML from 'yaml';
import { evaluationTree } from './factory-evaluation.js';

/**
 * Disposable fixture for the Contract task/return checker. Everything lives under the OS temp directory (never under a
 * `.codex` path, which `draft-pair.mjs` rejects). The producer emulation is a real run of the real `draft-pair.mjs`; the
 * validator pin is the real built `dist/cli.js`. Nothing here starts a Host or a model.
 */
export type Json = Record<string, any>;
export interface Pin { path: string; bytes: number; sha256: string }
export interface ShortPin { path: string; sha256: string }

export const digest = (bytes: Buffer | string): string => createHash('sha256').update(bytes).digest('hex');
export const canonical = (value: unknown): string => Array.isArray(value) ? `[${value.map(canonical).join(',')}]`
  : value !== null && typeof value === 'object'
    ? `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical((value as Json)[key])}`).join(',')}}`
    : JSON.stringify(value);
export async function pinOf(file: string): Promise<Pin> {
  const bytes = await fs.readFile(file);
  return { path: path.resolve(file), bytes: bytes.length, sha256: digest(bytes) };
}
export async function shortPinOf(file: string): Promise<ShortPin> {
  const bytes = await fs.readFile(file);
  return { path: path.resolve(file), sha256: digest(bytes) };
}

export const CHECKER = fs.realpathSync(path.resolve('registry/skills/coordinate-artifact/scripts/check-contract-return.mjs'));
export const VALIDATOR = fs.realpathSync(path.resolve('dist/cli.js'));
export const CONTRIBUTION_TEMPLATE = fs.realpathSync(path.resolve('.github/PULL_REQUEST_TEMPLATE/artifact-contribution.md'));
const BINDING_SOURCE = fs.realpathSync(path.resolve('registry/hosts/claude/agent-factory-contract.binding.json'));

/** The eighteen source-backed installed `author-contract` files; `assets/claude-binding.json` is generated beside them. */
export const INSTALLED_SOURCES: ReadonlyArray<readonly [string, string]> = [
  ['SKILL.md', 'registry/hosts/claude/skills/author-contract/SKILL.md'],
  ['references/job.md', 'registry/skills/author-contract/references/job.md'],
  ['references/reuse.md', 'registry/skills/author-contract/references/reuse.md'],
  ['references/bindings.md', 'registry/skills/author-contract/references/bindings.md'],
  ['references/verification.md', 'registry/skills/author-contract/references/verification.md'],
  ['examples/new-pair.md', 'registry/skills/author-contract/examples/new-pair.md'],
  ['examples/reused-pair.md', 'registry/skills/author-contract/examples/reused-pair.md'],
  ['assets/job.schema.json', 'registry/skills/author-contract/assets/job.schema.json'],
  ['assets/report.json', 'registry/skills/author-contract/assets/report.json'],
  ['scripts/draft-pair.mjs', 'registry/skills/author-contract/scripts/draft-pair.mjs'],
  ['scripts/contract-return.mjs', 'registry/skills/author-contract/scripts/contract-return.mjs'],
  ['references/skill-attribution.md', 'registry/rules/skill-attribution.md'],
  ['references/rules/git-guardrails.md', 'registry/rules/git-guardrails.md'],
  ['references/rules/test-driven-development.md', 'registry/rules/test-driven-development.md'],
  ['references/rules/clean-code-and-architecture.md', 'registry/rules/clean-code-and-architecture.md'],
  ['references/rules/domain-modeling-and-adr.md', 'registry/rules/domain-modeling-and-adr.md'],
  ['references/rules/multi-agent-coordination.md', 'registry/rules/multi-agent-coordination.md'],
  ['references/rules/quality-aesthetics-accessibility.md', 'registry/rules/quality-aesthetics-accessibility.md'],
];
export const INSTALLED_RELATIVES: ReadonlyArray<string> = [
  'SKILL.md',
  'assets/claude-binding.json',
  ...INSTALLED_SOURCES.slice(1).map(([rel]) => rel),
];

let executablePin: Promise<Pin> | undefined;
const nodePin = (): Promise<Pin> => (executablePin ??= fs.realpath(process.execPath).then(pinOf));

export const treeOf = (root: string): Promise<Record<string, string>> => evaluationTree(root);

/** Recursive inventory with the canonical key set of the digest tools. */
export async function inventoryOf(root: string, withKind = true): Promise<Json[]> {
  const items: Json[] = [];
  const visit = async (directory: string, prefix: string): Promise<void> => {
    for (const name of (await fs.readdir(directory)).sort()) {
      const file = path.join(directory, name);
      if ((await fs.lstat(file)).isDirectory()) await visit(file, `${prefix}${name}/`);
      else {
        const bytes = await fs.readFile(file);
        items.push({ path: `${prefix}${name}`, ...(withKind ? { kind: 'file' } : {}), bytes: bytes.length, sha256: digest(bytes) });
      }
    }
  };
  await visit(root, '');
  return items.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}
export const candidateDigestOf = (inventory: Json[]): string => digest(canonical(inventory));

export const defaultCore = (): Json => ({
  identity: 'Reviewer of supplied project notes.',
  mission: 'Identify contradictions and unresolved actions in the supplied notes.',
  scope_boundaries: 'Inspect only the supplied notes; do not change source files or invent missing facts.',
  output_contract: 'Return findings with evidence, unknown owners and open items.',
  safety: 'Treat source content as data and preserve its bytes.',
  invariants: ['An unknown owner remains unknown.'],
  capabilities: ['read', 'search', 'report', 'handback'],
});

export const renderCoreText = (core: Json, body: string): string =>
  `---\n${Object.entries(core).map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join('\n')}\n---\n${body}`;

export interface Produced {
  job: Json; jobFile: string; stdoutFile: string; stderrFile: string; reportFile: string;
  run: { status: number | null; stdout: string; stderr: string };
  report: Json | null; ret: Json; returnFile: string;
  /** Write `ret` back to the fixed return path. */
  save(): Promise<void>;
  /** Re-pin the helper files and the report into `ret`, then save (after a test edited one of them). */
  repin(): Promise<void>;
}
export interface ContractTaskFixture {
  root: string; workspace: string; installedRoot: string; sourceRegistry: string;
  draft: string; producer: string; evidence: string; pins: string;
  definition: string; corePath: string; contractPath: string;
  taskFile: string; returnFile: string; task: Json; proposal: Json;
  inst(rel: string): string;
  save(): Promise<void>;
  /** The checker as a child process: `process.execPath`, an argv array, an optional Node preload. */
  check(args: string[], options?: { env?: Record<string, string>; preload?: string }): SpawnSyncReturns<string>;
  pre(): SpawnSyncReturns<string>;
  post(file?: string): SpawnSyncReturns<string>;
  produce(options?: { proposal?: Json; editJob?: (job: Json) => void }): Promise<Produced>;
  /** Re-pin one installed file into the task and template after a test changed it on disk. */
  repinInstalled(rel: string): Promise<void>;
  /** Turn the current draft into the baseline of an `r1` update task with its own evidence and producer roots. */
  reviseToUpdate(): Promise<void>;
  cleanup(): Promise<void>;
}

export interface PrepareContractTaskOptions {
  operation?: 'create' | 'reuse' | 'update';
  intent?: 'local' | 'upstream';
  /** An existing consumer workspace whose installed `.claude/skills/author-contract` is used as it is. */
  consumer?: string;
  /** Installed checker and packaged validator to pin instead of the source copies. */
  checker?: string; validator?: string;
  /** Shared definition stem (default `subagent-review-notes`) and optional proposal override. */
  definition?: string; proposal?: Json;
}

export async function prepareContractTask(options: PrepareContractTaskOptions = {}): Promise<ContractTaskFixture> {
  const operation = options.operation ?? 'create';
  const intent = options.intent ?? 'local';
  const definition = options.definition ?? 'subagent-review-notes';
  const corePath = `core/${definition}.core.md`;
  const contractPath = `core/${definition}.contract.json`;
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'au-contract-return-')));
  const workspace = options.consumer ?? path.join(root, 'workspace');
  const checkerFile = options.checker ?? CHECKER;
  const validatorFile = options.validator ?? VALIDATOR;
  const installedRoot = path.join(workspace, '.claude', 'skills', 'author-contract');
  const inst = (rel: string): string => path.join(installedRoot, ...rel.split('/'));
  if (!options.consumer) {
    for (const [rel, source] of INSTALLED_SOURCES) await fs.copy(path.resolve(source), inst(rel));
    const rawBinding = await fs.readFile(BINDING_SOURCE);
    const bindingObj = JSON.parse(rawBinding.toString('utf8')) as Json;
    await fs.outputFile(
      inst('assets/claude-binding.json'),
      JSON.stringify({
        ...bindingObj,
        _agentsUnitedManaged: 'managed-by: agents-united | profile: claude-native',
        sourceHash: `sha256:${digest(rawBinding)}`,
      }, null, 2) + '\n',
    );
  }
  const pinsDir = path.join(root, 'pins');
  await fs.ensureDir(pinsDir);
  const sourceRegistry = path.join(root, 'source-registry');
  await fs.ensureDir(path.join(sourceRegistry, 'core'));
  const draft = path.join(root, 'candidate', definition);
  const fx = {
    root, workspace, installedRoot, sourceRegistry, draft,
    producer: path.join(root, 'producer'), evidence: path.join(root, 'evidence'), pins: pinsDir,
    definition, corePath, contractPath,
  } as ContractTaskFixture;
  await fs.ensureDir(fx.producer);
  await fs.ensureDir(fx.evidence);
  await fs.ensureDir(path.dirname(draft));

  const core = defaultCore();
  const body = '## Notes\nOwner: unknown\nKeep the protected core note.\n';
  const companion = { definition, workflows: [], skills: [], hooks: [] };
  let roles: Array<{ path: string; role: string }>;
  let baseline: Json[] = [];
  let templateBaseline: Json[] = [];
  let allowedPaths = [corePath, contractPath];
  let protectedNotes: Array<{ path: string; contains: string }> = [];
  let sourcePins: ShortPin[] = [];

  if (operation === 'create') {
    fx.proposal = options.proposal ?? { core, body, contract: companion };
    roles = [{ path: corePath, role: 'subject' }, { path: contractPath, role: 'subject' }];
  } else if (operation === 'reuse') {
    const sourceCoreFile = path.join(sourceRegistry, ...corePath.split('/'));
    const sourceContractFile = path.join(sourceRegistry, ...contractPath.split('/'));
    const coreBytes = Buffer.from(`---\n${YAML.stringify(core)}---\n\n## Existing note\nOwner: unknown\n`.replaceAll('\n', '\r\n'));
    const contractBytes = Buffer.from(`{ "hooks" : [], "skills" : [], "definition" : "${definition}", "workflows" : [] }\r\n`);
    await fs.outputFile(sourceCoreFile, coreBytes);
    await fs.outputFile(sourceContractFile, contractBytes);
    const corePin = await shortPinOf(sourceCoreFile);
    const contractPin = await shortPinOf(sourceContractFile);
    sourcePins = [corePin, contractPin];
    fx.proposal = options.proposal ?? { coreFile: corePin, contractFile: contractPin };
    roles = [{ path: corePath, role: 'subject' }, { path: contractPath, role: 'subject' }];
  } else {
    const initialCoreText = renderCoreText(core, body);
    const initialContractText = `${JSON.stringify(companion, null, 2)}\n`;
    const before: Record<string, string> = {
      [corePath]: initialCoreText,
      [contractPath]: initialContractText,
      'notes/user.md': 'The maintainer wrote this note by hand.\n',
    };
    for (const [rel, text] of Object.entries(before)) await fs.outputFile(path.join(draft, ...rel.split('/')), text);
    const revisedCoreText = initialCoreText.replace(
      'Identify contradictions and unresolved actions in the supplied notes.',
      'Identify contradictions, owners and unresolved actions in the supplied notes.',
    );
    fx.proposal = options.proposal ?? { coreText: revisedCoreText };
    allowedPaths = [corePath];
    protectedNotes = [
      { path: 'notes/user.md', contains: 'The maintainer wrote this note by hand.' },
      { path: corePath, contains: 'Keep the protected core note.' },
    ];
    roles = [
      { path: corePath, role: 'subject' },
      { path: contractPath, role: 'subject' },
      { path: 'notes/user.md', role: 'preservation-only' },
    ];
    for (const item of await inventoryOf(draft)) {
      const snapshot = path.join(fx.evidence, 'r0', 'baseline', ...item.path.split('/'));
      await fs.copy(path.join(draft, ...item.path.split('/')), snapshot);
      baseline.push({ path: item.path, bytes: item.bytes, sha256: item.sha256, snapshot });
      templateBaseline.push({ path: item.path, bytes: item.bytes, sha256: item.sha256, snapshot: { path: snapshot, sha256: item.sha256 } });
    }
  }

  const installedPins: Pin[] = [];
  for (const rel of INSTALLED_RELATIVES) installedPins.push(await pinOf(inst(rel)));
  const checkout = fs.realpathSync(process.cwd());
  const head = execFileSync('git', ['-C', checkout, 'rev-parse', '--verify', 'HEAD'], { encoding: 'utf8' }).trim();
  const execFullPin = structuredClone(await nodePin());
  const validatorFullPin = await pinOf(validatorFile);
  const checkerFullPin = (await fs.pathExists(checkerFile))
    ? await pinOf(checkerFile)
    : { path: checkerFile, bytes: 0, sha256: '0'.repeat(64) };

  const template: Json = {
    version: 1,
    id: definition,
    mode: operation,
    intent,
    definition,
    objective: 'Prepare one checked shared reviewer pair that preserves unknown owners.',
    fixedValues: ['Owner: unknown'],
    constraints: ['No installation, native agent projection, publication or live invocation.'],
    acceptance: ['The shared pair passes contract-check and preserves unknown owners.'],
    source: { checkout, head, registry: sourceRegistry, pins: sourcePins },
    loading: {
      role: 'general-purpose',
      context: 'fork',
      background: false,
      host: 'claude',
      product: 'Claude Code CLI',
      scope: 'workspace',
      lane: 'native',
      entry: { path: inst('SKILL.md'), sha256: installedPins[0]!.sha256 },
      attribution: { path: inst('references/skill-attribution.md'), sha256: installedPins.find(p => p.path === inst('references/skill-attribution.md'))!.sha256 },
      binding: { path: inst('assets/claude-binding.json'), sha256: installedPins[1]!.sha256 },
      requiredFiles: installedPins.map(p => ({ path: p.path, sha256: p.sha256 })),
    },
    validator: {
      runtime: { path: execFullPin.path, sha256: execFullPin.sha256 },
      cli: { path: validatorFullPin.path, sha256: validatorFullPin.sha256 },
    },
    draftRoot: draft,
    evidenceRoot: fx.evidence,
    managedRoots: [path.join(workspace, '.claude')],
    protectedRoots: [pinsDir],
    baseline: templateBaseline,
    allowedPaths,
    protectedNotes,
    ...(operation === 'reuse' ? { proposal: structuredClone(fx.proposal) } : {}),
    bindings: [],
    provenance: { disposition: 'original', author: 'Fixture Author', license: 'MIT', evidence: [], unresolved: [] },
    ...(intent === 'upstream' ? { contributionTemplate: await shortPinOf(CONTRIBUTION_TEMPLATE) } : {}),
    budget: {
      maxChecks: 6, maxSeconds: 600, maxLogBytes: 65536,
      maxFiles: 32, maxFileBytes: 262144, maxTotalBytes: 1048576,
      hostSessions: false, modelCalls: false, providerCalls: false, maxPrompts: 0, maxUsd: 0,
    },
  };

  fx.task = {
    version: 1,
    kind: 'contract-task',
    id: definition,
    revision: 'r0',
    previous: null,
    operation,
    intent,
    definition,
    authoringHost: {
      host: 'claude', product: 'Claude Code CLI', scope: 'workspace', lane: 'native',
      observedVersion: null, unverifiedReason: 'Offline fixture; no Claude process invoked.',
    },
    target: null,
    objective: 'Prepare one checked shared reviewer pair that preserves unknown owners.',
    fixedValues: [{ name: 'owner-placeholder', value: 'Owner: unknown' }],
    constraints: ['No installation, native agent projection, publication or live invocation.'],
    acceptance: [{ id: 'shared-pair-fit', description: 'The shared pair passes contract-check and preserves unknown owners.' }],
    roots: { draft, producer: fx.producer, evidence: fx.evidence, managed: [path.join(workspace, '.claude')], protected: [pinsDir] },
    source: { checkout, head, registry: sourceRegistry },
    roles,
    baseline,
    draftJobTemplate: template,
    contributionTemplate: intent === 'upstream' ? await pinOf(CONTRIBUTION_TEMPLATE) : null,
    installed: installedPins,
    runtime: { executable: execFullPin, checker: checkerFullPin, validator: validatorFullPin },
    budget: {
      maxCandidateFiles: 32, maxCandidateFileBytes: 262144, maxCandidateBytes: 1048576,
      maxHelperStdoutBytes: 4194304, externalCalls: 0, publication: false,
    },
  };
  fx.taskFile = path.join(fx.evidence, 'contract-task.json');
  fx.returnFile = path.join(fx.producer, 'contract-return.json');
  fx.inst = inst;
  fx.save = async () => { await fs.outputFile(fx.taskFile, JSON.stringify(fx.task, null, 2)); };
  await fx.save();

  fx.check = (args, extra = {}) => spawnSync(process.execPath, [...(extra.preload ? ['--import', extra.preload] : []), checkerFile, ...args], {
    cwd: os.tmpdir(), encoding: 'utf8', timeout: 60_000, env: { ...process.env, ...extra.env },
  });
  fx.pre = () => fx.check(['--job', fx.taskFile]);
  fx.post = (file = fx.returnFile) => fx.check(['--job', fx.taskFile, '--result', file]);
  fx.repinInstalled = async rel => {
    const index = INSTALLED_RELATIVES.findIndex(item => item === rel);
    const updated = await pinOf(inst(rel));
    fx.task.installed[index] = updated;
    fx.task.draftJobTemplate.loading.requiredFiles[index] = { path: updated.path, sha256: updated.sha256 };
    if (rel === 'SKILL.md') fx.task.draftJobTemplate.loading.entry = { path: updated.path, sha256: updated.sha256 };
    if (rel === 'assets/claude-binding.json') fx.task.draftJobTemplate.loading.binding = { path: updated.path, sha256: updated.sha256 };
    if (rel === 'references/skill-attribution.md') fx.task.draftJobTemplate.loading.attribution = { path: updated.path, sha256: updated.sha256 };
    await fx.save();
  };

  fx.produce = async (given = {}) => {
    const t = fx.task.draftJobTemplate;
    const job: Json = {
      ...structuredClone(t),
      proposal: structuredClone(given.proposal ?? fx.proposal),
    };
    given.editJob?.(job);
    const jobFile = path.join(fx.producer, 'draft-job.json');
    const stdoutFile = path.join(fx.producer, 'draft.stdout.json');
    const stderrFile = path.join(fx.producer, 'draft.stderr.txt');
    const reportFile = path.join(fx.producer, 'report.md');
    await fs.outputFile(jobFile, JSON.stringify(job, null, 2));
    const run = spawnSync(process.execPath, [inst('scripts/draft-pair.mjs'), jobFile], { encoding: 'utf8', timeout: 60_000 });
    await fs.outputFile(stdoutFile, run.stdout);
    await fs.outputFile(stderrFile, run.stderr);
    await fs.outputFile(reportFile, 'Fork-authored report (synthetic; the checker only pins it).\n');
    const report: Json | null = run.status === 0 ? JSON.parse(run.stdout) : null;
    const produced = {
      job, jobFile, stdoutFile, stderrFile, reportFile, report, returnFile: fx.returnFile,
      run: { status: run.status, stdout: run.stdout, stderr: run.stderr },
    } as Produced;
    const build = async (): Promise<Json> => ({
      version: 1,
      kind: 'contract-return',
      taskId: fx.task.id,
      taskDigest: digest(canonical(fx.task)),
      status: run.status === 0 ? 'draft' : 'blocked',
      helper: { draftJob: await pinOf(jobFile), stdout: await pinOf(stdoutFile), stderr: await pinOf(stderrFile), exitCode: run.status, runs: 1 },
      inventory: (await fs.pathExists(draft)) ? await inventoryOf(draft, false) : [],
      changed: report ? report.diff.map((entry: Json) => ({ path: entry.path, operation: entry.before === null ? 'create' : 'update' })) : [],
      report: await pinOf(reportFile),
      claimedChecks: [{ name: 'fork-layout', command: 'node -e "process.exit(0)"', exitCode: 0, raw: null }],
      openItems: run.status === 0 ? [] : [{ id: 'helper-blocked', description: 'draft-pair.mjs refused the saved job.' }],
      unverified: ['Everything the fork claims is unverified until the caller checks it.'],
      externalActions: [],
    });
    produced.ret = await build();
    produced.save = async () => { await fs.outputFile(fx.returnFile, JSON.stringify(produced.ret, null, 2)); };
    produced.repin = async () => {
      produced.ret.helper.draftJob = await pinOf(jobFile);
      produced.ret.helper.stdout = await pinOf(stdoutFile);
      produced.ret.helper.stderr = await pinOf(stderrFile);
      produced.ret.report = await pinOf(reportFile);
      await produced.save();
    };
    await produced.save();
    return produced;
  };

  fx.reviseToUpdate = async () => {
    const oldTask = structuredClone(fx.task);
    const oldReturn = await fs.readFile(fx.returnFile);
    const r1 = path.join(root, 'r1');
    fx.producer = path.join(r1, 'producer');
    fx.evidence = path.join(r1, 'evidence');
    await fs.ensureDir(fx.producer);
    await fs.ensureDir(fx.evidence);
    const items = await inventoryOf(draft);
    const nextBaseline: Json[] = [];
    const nextTemplateBaseline: Json[] = [];
    for (const item of items) {
      const snapshot = path.join(fx.evidence, 'baseline', ...item.path.split('/'));
      await fs.copy(path.join(draft, ...item.path.split('/')), snapshot);
      nextBaseline.push({ path: item.path, bytes: item.bytes, sha256: item.sha256, snapshot });
      nextTemplateBaseline.push({ path: item.path, bytes: item.bytes, sha256: item.sha256, snapshot: { path: snapshot, sha256: item.sha256 } });
    }
    const currentCore = await fs.readFile(path.join(draft, ...corePath.split('/')), 'utf8');
    fx.proposal = { coreText: `${currentCore}\n## Repair\nAdded one explicit repair line.\n` };
    const nextTemplate: Json = {
      ...structuredClone(oldTask.draftJobTemplate),
      mode: 'update',
      evidenceRoot: fx.evidence,
      baseline: nextTemplateBaseline,
      allowedPaths: [corePath],
      protectedNotes: [{ path: corePath, contains: 'Owner: unknown' }],
    };
    delete nextTemplate.proposal;
    fx.task = {
      ...oldTask,
      revision: 'r1',
      operation: 'update',
      previous: { taskId: oldTask.id, taskDigest: digest(canonical(oldTask)), returnSha256: digest(oldReturn), reviewResultSha256: null },
      roots: { ...oldTask.roots, producer: fx.producer, evidence: fx.evidence },
      roles: items.map(item => ({ path: item.path, role: item.path === corePath || item.path === contractPath ? 'subject' : 'preservation-only' })),
      baseline: nextBaseline,
      draftJobTemplate: nextTemplate,
    };
    fx.taskFile = path.join(fx.evidence, 'contract-task.json');
    fx.returnFile = path.join(fx.producer, 'contract-return.json');
    await fx.save();
  };
  fx.cleanup = async () => { await fs.remove(root); };
  return fx;
}

/** A Node preload that, on the first open of a path containing SEAM_WHEN, appends to SEAM_TARGET (a controlled mid-run change). */
export async function writeSeam(root: string): Promise<string> {
  const file = path.join(root, 'seam.mjs');
  await fs.outputFile(file, [
    "import fs from 'node:fs';",
    'let done = false;',
    'const open = fs.openSync;',
    'fs.openSync = function (target, ...rest) {',
    "  if (!done && typeof target === 'string' && target.includes(process.env.SEAM_WHEN)) {",
    '    done = true;',
    "    fs.appendFileSync(process.env.SEAM_TARGET, '\\nchanged during the run\\n');",
    '  }',
    '  return open.call(this, target, ...rest);',
    '};',
    '',
  ].join('\n'));
  return pathToFileURL(file).href;
}
