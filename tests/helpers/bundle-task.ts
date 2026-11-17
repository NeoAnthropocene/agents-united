/* eslint-disable @typescript-eslint/no-explicit-any */
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { execFileSync, spawnSync } from 'node:child_process';
import type { SpawnSyncReturns } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { canonical, digest, inventoryOf, pinOf, treeOf } from './contract-task.js';
import type { Json, Pin } from './contract-task.js';
import { domainProposal, organizationProposal, serialize, writeFixtureRegistry } from './bundle-proposal.js';

export { canonical, digest, inventoryOf, pinOf, treeOf };
export type { Json, Pin };

/**
 * Disposable fixture for the Bundle task/return checker and the `author-bundle` return helper. Everything lives under the OS temp
 * directory. The fork is emulated: the test writes the four proposal files by ordinary file writes and then runs the real installed
 * `scripts/bundle-return.mjs`. The validator pin is the real built `dist/cli.js`; nothing here starts a Host or a model.
 */
export const CHECKER = fs.realpathSync(path.resolve('registry/skills/coordinate-artifact/scripts/check-bundle-return.mjs'));
export const HELPER_SOURCE = path.resolve('registry/skills/author-bundle/scripts/bundle-return.mjs');
export const VALIDATOR = fs.realpathSync(path.resolve('dist/cli.js'));
export const CONTRIBUTION_TEMPLATE = fs.realpathSync(path.resolve('.github/PULL_REQUEST_TEMPLATE/artifact-contribution.md'));
const BINDING_SOURCE = fs.realpathSync(path.resolve('registry/hosts/claude/agent-factory-bundle.binding.json'));
export const AUTHORED = ['bundles.json', 'leader-responsibility.md', 'bindings.json', 'report.json'] as const;
export const SHARED_SKILLS = ['host-agent-router', 'handoff', 'git-guardrails'] as const;

/** The nineteen source-backed installed `author-bundle` files; `assets/claude-binding.json` is generated beside them. */
export const INSTALLED_SOURCES: ReadonlyArray<readonly [string, string]> = [
  ['SKILL.md', 'registry/hosts/claude/skills/author-bundle/SKILL.md'],
  ['references/job.md', 'registry/skills/author-bundle/references/job.md'],
  ['references/verification.md', 'registry/skills/author-bundle/references/verification.md'],
  ['references/bundle-shape.md', 'registry/skills/author-bundle/references/bundle-shape.md'],
  ['references/prerequisites.md', 'registry/skills/author-bundle/references/prerequisites.md'],
  ['assets/domain-bundle.template.json', 'registry/skills/author-bundle/assets/domain-bundle.template.json'],
  ['assets/organization-bundle.template.json', 'registry/skills/author-bundle/assets/organization-bundle.template.json'],
  ['assets/leader-responsibility.template.md', 'registry/skills/author-bundle/assets/leader-responsibility.template.md'],
  ['assets/report.json', 'registry/skills/author-bundle/assets/report.json'],
  ['examples/domain.md', 'registry/skills/author-bundle/examples/domain.md'],
  ['examples/organization.md', 'registry/skills/author-bundle/examples/organization.md'],
  ['scripts/bundle-return.mjs', 'registry/skills/author-bundle/scripts/bundle-return.mjs'],
  ['references/skill-attribution.md', 'registry/rules/skill-attribution.md'],
  ['references/rules/git-guardrails.md', 'registry/rules/git-guardrails.md'],
  ['references/rules/test-driven-development.md', 'registry/rules/test-driven-development.md'],
  ['references/rules/clean-code-and-architecture.md', 'registry/rules/clean-code-and-architecture.md'],
  ['references/rules/domain-modeling-and-adr.md', 'registry/rules/domain-modeling-and-adr.md'],
  ['references/rules/multi-agent-coordination.md', 'registry/rules/multi-agent-coordination.md'],
  ['references/rules/quality-aesthetics-accessibility.md', 'registry/rules/quality-aesthetics-accessibility.md'],
];
export const INSTALLED_RELATIVES: ReadonlyArray<string> = ['SKILL.md', 'assets/claude-binding.json', ...INSTALLED_SOURCES.slice(1).map(([rel]) => rel)];

let executablePin: Promise<Pin> | undefined;
const nodePin = (): Promise<Pin> => (executablePin ??= fs.realpath(process.execPath).then(pinOf));

export interface Notes {
  status?: 'draft' | 'blocked';
  openItems?: Array<{ id: string; description: string }>;
  unverified?: string[];
  claimedChecks?: Array<{ name: string; command: string; exitCode: number | null; raw: Pin | null }>;
  externalActions?: string[];
  upstreamEvidence?: string;
  [key: string]: unknown;
}

export interface Produced {
  run: { status: number | null; stdout: string; stderr: string };
  ret: Json | null;
  notesFile: string | null;
  /** Write `ret` back to the fixed return path (after a test edited it). */
  save(): Promise<void>;
}

export interface BundleTaskFixture {
  root: string; workspace: string; installedRoot: string; sourceRegistry: string;
  draft: string; producer: string; evidence: string; pins: string;
  bundleName: string; taskFile: string; returnFile: string; task: Json;
  /** The four proposal files the emulated fork writes (text, keyed by draft-relative path). */
  files: Record<string, string>;
  inst(rel: string): string;
  save(): Promise<void>;
  check(args: string[], options?: { env?: Record<string, string>; preload?: string }): SpawnSyncReturns<string>;
  pre(): SpawnSyncReturns<string>;
  post(file?: string): SpawnSyncReturns<string>;
  /** The installed helper as a child process, with an optional Node preload. */
  helper(args: string[], options?: { env?: Record<string, string>; preload?: string }): SpawnSyncReturns<string>;
  /** Write the given files into the draft root (creating it), as the fork does by ordinary editing. */
  writeDraft(files?: Record<string, string | null>): Promise<void>;
  /** Emulate the fork: write the proposal files (unless `write` is false), an optional notes file, then run the installed helper once. */
  produce(options?: { files?: Record<string, string | null>; notes?: Notes; write?: boolean }): Promise<Produced>;
  repinInstalled(rel: string): Promise<void>;
  /** Turn the current draft into the baseline of an `r1` update task with its own evidence and producer roots. */
  reviseToUpdate(): Promise<void>;
  /** The built `dist/cli.js bundle-check` on the draft root with the task's registry, operation and validation flag. */
  bundleCheck(): SpawnSyncReturns<string>;
  cleanup(): Promise<void>;
}

export interface PrepareBundleTaskOptions {
  operation?: 'create' | 'reuse' | 'update';
  intent?: 'local' | 'upstream';
  tier?: 'domain' | 'organization';
}

const reportOf = (operation: string, bundleName: string, tier: string): Json => ({
  job: { id: 'example-bundle-task', operation, template: tier, bundle: bundleName },
  files: 'Inventory and hashes of the other three files are carried by the caller; this report is listed with its own hash deferred.',
  template: 'Sections used as named in the leader responsibility.',
  bindings: 'Edges as recorded in bindings.json; native edges unavailable.',
  checks: 'No deterministic check was run by the author; unavailable.',
  provenance: 'Original proposal; rights not cleared by this fixture.',
  quality: 'pending',
  openItems: ['Independent review and native realization remain open.'],
  upstream: { intent: 'local', sent: false },
});

export async function prepareBundleTask(options: PrepareBundleTaskOptions = {}): Promise<BundleTaskFixture> {
  const operation = options.operation ?? 'create';
  const intent = options.intent ?? 'local';
  const tier = options.tier ?? 'domain';
  const proposal = tier === 'domain' ? domainProposal() : organizationProposal();
  const bundleName = Object.keys(proposal.manifest.bundles)[0]!;
  const bundle = proposal.manifest.bundles[bundleName];
  proposal.report = reportOf(operation, bundleName, tier);
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'au-bundle-return-')));
  const workspace = path.join(root, 'workspace');
  const installedRoot = path.join(workspace, '.claude', 'skills', 'author-bundle');
  const inst = (rel: string): string => path.join(installedRoot, ...rel.split('/'));
  for (const [rel, source] of INSTALLED_SOURCES) await fs.copy(path.resolve(source), inst(rel));
  const rawBinding = await fs.readFile(BINDING_SOURCE);
  await fs.outputFile(inst('assets/claude-binding.json'), JSON.stringify({
    ...JSON.parse(rawBinding.toString('utf8')) as Json,
    _agentsUnitedManaged: 'managed-by: agents-united | profile: claude-native',
    sourceHash: `sha256:${digest(rawBinding)}`,
  }, null, 2) + '\n');
  const pinsDir = path.join(root, 'pins');
  await fs.ensureDir(pinsDir);
  const sourceRegistry = path.join(root, 'source-registry');
  writeFixtureRegistry(sourceRegistry);
  const draft = path.join(root, 'candidate', bundleName);
  const fx = {
    root, workspace, installedRoot, sourceRegistry, draft, bundleName,
    producer: path.join(root, 'producer'), evidence: path.join(root, 'evidence'), pins: pinsDir,
  } as BundleTaskFixture;
  await fs.ensureDir(fx.producer);
  await fs.ensureDir(fx.evidence);
  await fs.ensureDir(path.dirname(draft));

  const authoredRoles = [
    { path: 'bundles.json', role: 'subject' }, { path: 'leader-responsibility.md', role: 'subject' },
    { path: 'bindings.json', role: 'support' }, { path: 'report.json', role: 'support' },
  ];
  let roles = authoredRoles;
  let allowedPaths: string[] = [...AUTHORED];
  let protectedNotes: Array<{ path: string; contains: string }> = [];
  const baseline: Json[] = [];
  const created = serialize(proposal);
  fx.files = { ...created };
  if (operation === 'update') {
    const before: Record<string, string> = { ...created, 'notes/user.md': 'The maintainer wrote this note by hand.\n' };
    for (const [rel, text] of Object.entries(before)) await fs.outputFile(path.join(draft, ...rel.split('/')), text);
    for (const item of await inventoryOf(draft)) {
      const snapshot = path.join(fx.evidence, 'r0', 'baseline', ...item.path.split('/'));
      await fs.copy(path.join(draft, ...item.path.split('/')), snapshot);
      baseline.push({ path: item.path, bytes: item.bytes, sha256: item.sha256, snapshot });
    }
    allowedPaths = ['leader-responsibility.md', 'report.json'];
    protectedNotes = [{ path: 'notes/user.md', contains: 'The maintainer wrote this note by hand.' }];
    roles = [...authoredRoles, { path: 'notes/user.md', role: 'preservation-only' }];
    fx.files = {
      'leader-responsibility.md': `${created['leader-responsibility.md']}\n## Revision\nOne explicit revision line.\n`,
      'report.json': `${JSON.stringify({ ...proposal.report, openItems: ['Revised leader responsibility; review remains open.'] }, null, 2)}\n`,
    };
  }

  const installedPins: Pin[] = [];
  for (const rel of INSTALLED_RELATIVES) installedPins.push(await pinOf(inst(rel)));
  const checkout = fs.realpathSync(process.cwd());
  const head = execFileSync('git', ['-C', checkout, 'rev-parse', '--verify', 'HEAD'], { encoding: 'utf8' }).trim();
  const checkerPin = (await fs.pathExists(CHECKER)) ? await pinOf(CHECKER) : { path: CHECKER, bytes: 0, sha256: '0'.repeat(64) };
  const sourceInput = path.join(pinsDir, 'source-notes.md');
  await fs.outputFile(sourceInput, 'Supplied roster notes for the proposal.\n');

  fx.task = {
    version: 1,
    kind: 'bundle-task',
    id: 'example-bundle-task',
    revision: 'r0',
    previous: null,
    operation,
    intent,
    bundle: {
      name: bundleName, tier, version: bundle.version, status: bundle.status, domain: bundle.domain, category: bundle.category,
      description: bundle.description, parentBundle: null, orchestrator: bundle.orchestrator ?? null,
      agents: [...bundle.agents], skills: [...bundle.skills],
    },
    authoringHost: {
      host: 'claude', product: 'Claude Code CLI', scope: 'workspace', lane: 'native',
      observedVersion: null, unverifiedReason: 'Offline fixture; no Claude process invoked.',
    },
    target: null,
    objective: 'Prepare one checked Bundle proposal for a local review team.',
    fixedValues: [{ name: 'reviewer', value: 'subagent-code-reviewer.md' }],
    constraints: ['No installation, native realization, publication or live invocation.'],
    acceptance: [{ id: 'bundle-check-pass', description: 'The proposal passes agents bundle-check against the source registry.' }],
    roots: { draft, producer: fx.producer, evidence: fx.evidence, managed: [path.join(workspace, '.claude')], protected: [pinsDir] },
    allowedPaths,
    protectedNotes,
    source: { checkout, head, registry: sourceRegistry },
    inputPins: [{ kind: 'source', ...(await pinOf(sourceInput)) }],
    provenance: { disposition: 'original', author: 'Fixture Author', license: 'MIT', evidence: [], unresolved: [] },
    roles,
    baseline,
    selectedChecks: [],
    contributionTemplate: intent === 'upstream' ? await pinOf(CONTRIBUTION_TEMPLATE) : null,
    installed: installedPins,
    runtime: { executable: structuredClone(await nodePin()), checker: checkerPin, validator: await pinOf(VALIDATOR) },
    validation: { allowUnresolved: false },
    budget: {
      maxAuthoredFiles: 4, maxAuthoredFileBytes: 262144, maxAuthoredBytes: 1048576,
      maxPreservedFiles: 32, maxPreservedBytes: 2097152, maxPinnedInputs: 32, maxPinnedInputBytes: 4194304,
      maxChecks: 6, maxCheckSeconds: 600, maxCheckLogBytes: 524288, externalCalls: 0, publication: false,
    },
  };
  fx.taskFile = path.join(fx.evidence, 'bundle-task.json');
  fx.returnFile = path.join(fx.producer, 'bundle-return.json');
  fx.inst = inst;
  fx.save = async () => { await fs.outputFile(fx.taskFile, JSON.stringify(fx.task, null, 2)); };
  await fx.save();

  fx.check = (args, extra = {}) => spawnSync(process.execPath, [...(extra.preload ? ['--import', extra.preload] : []), CHECKER, ...args], {
    cwd: os.tmpdir(), encoding: 'utf8', timeout: 60_000, env: { ...process.env, ...extra.env },
  });
  fx.pre = () => fx.check(['--job', fx.taskFile]);
  fx.post = (file = fx.returnFile) => fx.check(['--job', fx.taskFile, '--result', file]);
  fx.helper = (args, extra = {}) => spawnSync(process.execPath, [...(extra.preload ? ['--import', extra.preload] : []), inst('scripts/bundle-return.mjs'), ...args], {
    cwd: os.tmpdir(), encoding: 'utf8', timeout: 60_000, env: { ...process.env, ...extra.env },
  });
  fx.repinInstalled = async rel => {
    const index = INSTALLED_RELATIVES.findIndex(item => item === rel);
    fx.task.installed[index] = await pinOf(inst(rel));
    await fx.save();
  };
  fx.writeDraft = async (files = fx.files) => {
    await fs.ensureDir(draft);
    for (const [rel, text] of Object.entries(files)) if (text !== null) await fs.outputFile(path.join(draft, ...rel.split('/')), text);
  };
  fx.produce = async (given = {}) => {
    if (given.write !== false) await fx.writeDraft(given.files ?? fx.files);
    let notesFile: string | null = null;
    if (given.notes) {
      notesFile = path.join(fx.producer, 'bundle-notes.json');
      await fs.outputFile(notesFile, JSON.stringify(given.notes, null, 2));
    }
    const run = fx.helper(['--job', fx.taskFile, ...(notesFile ? ['--notes', notesFile] : [])]);
    const ret = run.status === 0 ? await fs.readJson(fx.returnFile) as Json : null;
    const produced: Produced = {
      run: { status: run.status, stdout: run.stdout, stderr: run.stderr }, ret, notesFile,
      save: async () => { await fs.outputFile(fx.returnFile, JSON.stringify(produced.ret, null, 2)); },
    };
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
    for (const item of items) {
      const snapshot = path.join(fx.evidence, 'baseline', ...item.path.split('/'));
      await fs.copy(path.join(draft, ...item.path.split('/')), snapshot);
      nextBaseline.push({ path: item.path, bytes: item.bytes, sha256: item.sha256, snapshot });
    }
    const leader = await fs.readFile(path.join(draft, 'leader-responsibility.md'), 'utf8');
    fx.files = { 'leader-responsibility.md': `${leader}\n## Repair\nAdded one explicit repair line.\n` };
    fx.task = {
      ...oldTask,
      revision: 'r1',
      operation: 'update',
      previous: { taskId: oldTask.id, taskDigest: digest(canonical(oldTask)), returnSha256: digest(oldReturn), reviewResultSha256: null },
      roots: { ...oldTask.roots, producer: fx.producer, evidence: fx.evidence },
      allowedPaths: ['leader-responsibility.md'],
      protectedNotes: [{ path: 'bundles.json', contains: 'subagent-code-reviewer.md' }],
      roles: items.map(item => ({ path: item.path, role: item.path === 'bundles.json' || item.path === 'leader-responsibility.md' ? 'subject' : AUTHORED.includes(item.path as typeof AUTHORED[number]) ? 'support' : 'preservation-only' })),
      baseline: nextBaseline,
    };
    fx.taskFile = path.join(fx.evidence, 'bundle-task.json');
    fx.returnFile = path.join(fx.producer, 'bundle-return.json');
    await fx.save();
  };
  fx.bundleCheck = () => spawnSync(process.execPath, [
    VALIDATOR, 'bundle-check', '--artifact', fx.draft, '--registry', fx.task.source.registry, '--operation', fx.task.operation,
    ...(fx.task.validation.allowUnresolved ? ['--allow-unresolved'] : []),
  ], { cwd: os.tmpdir(), encoding: 'utf8', timeout: 60_000 });
  fx.cleanup = async () => { await fs.remove(root); };
  return fx;
}

export { writeSeam } from './contract-task.js';

/**
 * A draft entry with a name the checker refuses, in `directory`. On a case-sensitive POSIX filesystem the file is created for real.
 * On win32, where such names (reserved device names, `:`, a trailing dot, a case variant of an existing file) cannot exist side by
 * side, the name is added to the listing by a Node preload that patches `fs.readdirSync` for that one folder; both scripts validate a
 * name before they read the file, and a case variant reads the existing file. Returns the spawn options to pass to both scripts.
 */
export async function badEntry(root: string, directory: string, name: string): Promise<{ preload?: string; env?: Record<string, string> }> {
  if (process.platform !== 'win32') {
    await fs.outputFile(path.join(directory, name), 'An entry with a refused name.\n');
    return {};
  }
  const file = path.join(root, 'inject.mjs');
  await fs.outputFile(file, [
    "import fs from 'node:fs';",
    "import path from 'node:path';",
    'const fold = target => path.resolve(target).toLowerCase();',
    'const list = fs.readdirSync;',
    'fs.readdirSync = function (target, options, ...rest) {',
    '  const out = list.call(this, target, options, ...rest);',
    "  if (typeof target === 'string' && options && options.withFileTypes && fold(target) === fold(process.env.INJECT_DIR)) {",
    '    out.push({ name: process.env.INJECT_NAME, isFile: () => true, isDirectory: () => false, isSymbolicLink: () => false });',
    '  }',
    '  return out;',
    '};',
    '',
  ].join('\n'));
  return { preload: pathToFileURL(file).href, env: { INJECT_DIR: directory, INJECT_NAME: name } };
}
