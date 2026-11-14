/* eslint-disable @typescript-eslint/no-explicit-any */
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import type { SpawnSyncReturns } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { evaluationTree } from './factory-evaluation.js';

/**
 * Disposable fixture for the Skill task/return checker. Everything lives under the OS temp directory (never under a
 * `.codex` path, which `draft.mjs` rejects). The producer emulation is a real run of the real `draft.mjs`; the
 * validator pin is the real built `dist/cli.js`. Nothing here starts a Host or a model.
 */
export type Json = Record<string, any>;
export interface Pin { path: string; bytes: number; sha256: string }

export const digest = (bytes: Buffer | string): string => createHash('sha256').update(bytes).digest('hex');
export const canonical = (value: unknown): string => Array.isArray(value) ? `[${value.map(canonical).join(',')}]`
  : value !== null && typeof value === 'object'
    ? `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical((value as Json)[key])}`).join(',')}}`
    : JSON.stringify(value);
export async function pinOf(file: string): Promise<Pin> {
  const bytes = await fs.readFile(file);
  return { path: path.resolve(file), bytes: bytes.length, sha256: digest(bytes) };
}

export const CHECKER = fs.realpathSync(path.resolve('registry/skills/coordinate-artifact/scripts/check-skill-return.mjs'));
export const VALIDATOR = fs.realpathSync(path.resolve('dist/cli.js'));
export const CONTRIBUTION_TEMPLATE = fs.realpathSync(path.resolve('.github/PULL_REQUEST_TEMPLATE/artifact-contribution.md'));
const CORPUS_SOURCE = fs.realpathSync(path.resolve('registry/quality/skill-boilerplate-corpus.txt'));

/** The eight installed `author-skill` files: relative path under the installed root, and the registry source copied there. */
export const INSTALLED_SOURCES: ReadonlyArray<readonly [string, string]> = [
  ['SKILL.md', 'registry/hosts/claude/skills/author-skill/SKILL.md'],
  ['references/job.md', 'registry/skills/author-skill/references/job.md'],
  ['references/provenance.md', 'registry/skills/author-skill/references/provenance.md'],
  ['references/quality.md', 'registry/skills/author-skill/references/quality.md'],
  ['examples/one-draft.md', 'registry/skills/author-skill/examples/one-draft.md'],
  ['assets/report.md', 'registry/skills/author-skill/assets/report.md'],
  ['scripts/draft.mjs', 'registry/skills/author-skill/scripts/draft.mjs'],
  ['references/skill-attribution.md', 'registry/rules/skill-attribution.md'],
];

let executablePin: Promise<Pin> | undefined;
const nodePin = (): Promise<Pin> => (executablePin ??= fs.realpath(process.execPath).then(pinOf));

export const treeOf = (root: string): Promise<Record<string, string>> => evaluationTree(root);

/** Recursive inventory with the canonical key set of the three digest tools. */
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

const entryText = (extra = ''): string => `---
name: incident-actions
description: Use when an on-call engineer must turn an incident timeline into owned follow-up actions. Skip paging and incident declaration.
metadata:
  author: Fixture Author
  version: "1.0.0"
  license: MIT
---

# Incident actions

Read [the worked example](examples/actions.md) before writing actions.

1. List each contributing factor from the timeline.
2. Give every factor one owner and one due date.
${extra}`;

export interface Produced {
  job: Json; jobFile: string; stdoutFile: string; stderrFile: string; reportFile: string;
  run: { status: number | null; stdout: string; stderr: string };
  report: Json | null; ret: Json; returnFile: string;
  /** Write `ret` back to the fixed return path. */
  save(): Promise<void>;
  /** Re-pin the helper files and the report into `ret`, then save (after a test edited one of them). */
  repin(): Promise<void>;
}
export interface SkillTaskFixture {
  root: string; workspace: string; installedRoot: string; draft: string; producer: string; evidence: string; pins: string;
  taskFile: string; returnFile: string; task: Json; changes: Record<string, string>;
  inst(rel: string): string;
  save(): Promise<void>;
  /** The checker as a child process: `process.execPath`, an argv array, an optional Node preload. */
  check(args: string[], options?: { env?: Record<string, string>; preload?: string }): SpawnSyncReturns<string>;
  pre(): SpawnSyncReturns<string>;
  post(file?: string): SpawnSyncReturns<string>;
  produce(options?: { changes?: Record<string, string>; editJob?: (job: Json) => void }): Promise<Produced>;
  /** Re-pin one installed file into the task after a test changed it on disk. */
  repinInstalled(rel: string): Promise<void>;
  /** Turn the current draft into the baseline of an `r1` repair task with its own evidence and producer roots. */
  reviseToRepair(): Promise<void>;
  cleanup(): Promise<void>;
}

export interface PrepareSkillTaskOptions {
  operation?: 'create' | 'repair'; intent?: 'local' | 'upstream';
  /** An existing consumer workspace whose installed `.claude/skills/author-skill` is used as it is (nothing is copied from the registry). */
  consumer?: string;
  /** Installed checker, packaged validator and frozen corpus to pin instead of the source copies. */
  checker?: string; validator?: string; corpus?: string;
  /** Skill folder name (default `incident-actions`) and, for a create, the complete files the producer will author. */
  name?: string; changes?: Record<string, string>;
}

export async function prepareSkillTask(options: PrepareSkillTaskOptions = {}): Promise<SkillTaskFixture> {
  const operation = options.operation ?? 'create';
  const intent = options.intent ?? 'local';
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'au-skill-return-')));
  const workspace = options.consumer ?? path.join(root, 'workspace');
  const checkerFile = options.checker ?? CHECKER, validatorFile = options.validator ?? VALIDATOR, skillName = options.name ?? 'incident-actions';
  const installedRoot = path.join(workspace, '.claude', 'skills', 'author-skill');
  const inst = (rel: string): string => path.join(installedRoot, ...rel.split('/'));
  if (!options.consumer) for (const [rel, source] of INSTALLED_SOURCES) await fs.copy(path.resolve(source), inst(rel));
  const pinsDir = path.join(root, 'pins');
  const corpus = options.corpus ?? path.join(pinsDir, 'skill-boilerplate-corpus.txt');
  // The reviewed corpus is LF text; a CRLF working tree is normalised so skill-check accepts the same bytes everywhere.
  if (!options.corpus) await fs.outputFile(corpus, (await fs.readFile(CORPUS_SOURCE, 'utf8')).replace(/\r\n/g, '\n'));
  const draft = path.join(root, 'candidate', skillName);
  const fx = { root, workspace, installedRoot, draft, producer: path.join(root, 'producer'), evidence: path.join(root, 'evidence'), pins: pinsDir } as SkillTaskFixture;
  await fs.ensureDir(fx.producer);
  await fs.ensureDir(fx.evidence);
  await fs.ensureDir(path.dirname(draft));

  const create = operation === 'create';
  let roles: Array<{ path: string; role: string }>;
  let baseline: Json[] = [];
  if (create) {
    fx.changes = options.changes ?? { 'SKILL.md': entryText(), 'examples/actions.md': '# Worked example\n\nTimeline: the cache filled at 09:10. Action: add an alert (owner: infra, due: Friday).\n' };
    roles = Object.keys(fx.changes).sort().map(file => ({ path: file, role: file === 'SKILL.md' ? 'subject' : 'support' }));
  } else {
    const before: Record<string, string> = { 'SKILL.md': entryText('3. Close the review.\n'), 'references/usage.md': 'Old usage note.\n', 'notes/user.md': 'The maintainer wrote this note by hand.\n' };
    for (const [rel, text] of Object.entries(before)) await fs.outputFile(path.join(draft, ...rel.split('/')), text);
    fx.changes = { 'SKILL.md': entryText('3. Review the actions every week.\n'), 'references/usage.md': 'Updated usage note.\n' };
    roles = [{ path: 'SKILL.md', role: 'subject' }, { path: 'references/usage.md', role: 'support' }, { path: 'notes/user.md', role: 'preservation-only' }];
    for (const item of await inventoryOf(draft)) {
      const snapshot = path.join(fx.evidence, 'r0', 'baseline', ...item.path.split('/'));
      await fs.copy(path.join(draft, ...item.path.split('/')), snapshot);
      baseline.push({ path: item.path, bytes: item.bytes, sha256: item.sha256, snapshot });
    }
  }
  const installedPins: Pin[] = [];
  for (const [rel] of INSTALLED_SOURCES) installedPins.push(await pinOf(inst(rel)));
  const checkout = fs.realpathSync(process.cwd());
  const head = execFileSync('git', ['-C', checkout, 'rev-parse', '--verify', 'HEAD'], { encoding: 'utf8' }).trim();
  const template: Json = {
    mode: operation, intent, sourceRoot: checkout, draftRoot: draft,
    allowedPaths: Object.keys(fx.changes),
    provenance: { disposition: 'original', owner: 'Fixture Author', version: '1.0.0', license: 'MIT' },
    loading: {
      role: 'general-purpose', entryPath: inst('SKILL.md'), attributionPath: inst('references/skill-attribution.md'),
      requiredFiles: ['references/job.md', 'references/provenance.md', 'references/quality.md', 'examples/one-draft.md', 'assets/report.md', 'scripts/draft.mjs'].map(inst),
    },
    requiredTools: [{ name: 'skill-check', path: validatorFile }],
    ...(intent === 'upstream' ? { contributionTemplate: CONTRIBUTION_TEMPLATE } : {}),
  };
  fx.task = {
    version: 1, kind: 'skill-task', id: 'incident-actions', revision: 'r0', previous: null, operation, intent,
    authoringHost: { host: 'claude', product: 'Claude Code CLI', scope: 'workspace', lane: 'native', observedVersion: null, unverifiedReason: 'Offline fixture; no Claude process invoked.' },
    target: null,
    objective: 'Draft one Skill that turns an incident timeline into owned follow-up actions.',
    fixedValues: [{ name: 'skill-name', value: skillName }],
    constraints: ['No installation, publication or live invocation.'],
    acceptance: [{ id: 'task-fit', description: 'The Skill names an owner and a due date for every action.' }],
    roots: { draft, producer: fx.producer, evidence: fx.evidence, managed: [path.join(workspace, '.claude')], protected: [] },
    source: { checkout, head, registry: path.join(checkout, 'registry') },
    roles, baseline, draftJobTemplate: template,
    contributionTemplate: intent === 'upstream' ? await pinOf(CONTRIBUTION_TEMPLATE) : null,
    installed: installedPins,
    runtime: { executable: structuredClone(await nodePin()), checker: await pinOf(checkerFile), validator: await pinOf(validatorFile), corpus: await pinOf(corpus) },
    budget: { maxCandidateFiles: 32, maxCandidateFileBytes: 262144, maxCandidateBytes: 1048576, maxHelperStdoutBytes: 4194304, externalCalls: 0, publication: false },
  };
  fx.taskFile = path.join(fx.evidence, 'skill-task.json');
  fx.returnFile = path.join(fx.producer, 'skill-return.json');
  fx.inst = inst;
  fx.save = async () => { await fs.outputFile(fx.taskFile, JSON.stringify(fx.task, null, 2)); };
  await fx.save();

  fx.check = (args, extra = {}) => spawnSync(process.execPath, [...(extra.preload ? ['--import', extra.preload] : []), checkerFile, ...args], {
    cwd: os.tmpdir(), encoding: 'utf8', timeout: 60_000, env: { ...process.env, ...extra.env },
  });
  fx.pre = () => fx.check(['--job', fx.taskFile]);
  fx.post = (file = fx.returnFile) => fx.check(['--job', fx.taskFile, '--result', file]);
  fx.repinInstalled = async rel => {
    const index = INSTALLED_SOURCES.findIndex(([item]) => item === rel);
    fx.task.installed[index] = await pinOf(inst(rel));
    await fx.save();
  };

  fx.produce = async (given = {}) => {
    const t = fx.task.draftJobTemplate;
    const job: Json = {
      ...structuredClone(t),
      ...(t.mode === 'repair' ? { baseline: Object.fromEntries(fx.task.baseline.map((entry: Json) => [entry.path, entry.sha256])) } : {}),
      changes: given.changes ?? fx.changes,
    };
    given.editJob?.(job);
    const jobFile = path.join(fx.producer, 'draft-job.json');
    const stdoutFile = path.join(fx.producer, 'draft.stdout.json');
    const stderrFile = path.join(fx.producer, 'draft.stderr.txt');
    const reportFile = path.join(fx.producer, 'report.md');
    await fs.outputFile(jobFile, JSON.stringify(job, null, 2));
    const run = spawnSync(process.execPath, [inst('scripts/draft.mjs'), jobFile], { encoding: 'utf8', timeout: 60_000 });
    await fs.outputFile(stdoutFile, run.stdout);
    await fs.outputFile(stderrFile, run.stderr);
    await fs.outputFile(reportFile, 'Fork-authored report (synthetic; the checker only pins it).\n');
    const report: Json | null = run.status === 0 ? JSON.parse(run.stdout) : null;
    const produced = { job, jobFile, stdoutFile, stderrFile, reportFile, report, returnFile: fx.returnFile,
      run: { status: run.status, stdout: run.stdout, stderr: run.stderr } } as Produced;
    const build = async (): Promise<Json> => ({
      version: 1, kind: 'skill-return', taskId: fx.task.id, taskDigest: digest(canonical(fx.task)),
      status: run.status === 0 ? 'draft' : 'blocked',
      helper: { draftJob: await pinOf(jobFile), stdout: await pinOf(stdoutFile), stderr: await pinOf(stderrFile), exitCode: run.status, runs: 1 },
      inventory: (await fs.pathExists(draft)) ? await inventoryOf(draft, false) : [],
      changed: report ? report.diff.map((entry: Json) => ({ path: entry.path, operation: entry.before === null ? 'create' : 'update' })) : [],
      report: await pinOf(reportFile),
      claimedChecks: [{ name: 'fork-layout', command: 'node -e "process.exit(0)"', exitCode: 0, raw: null }],
      openItems: run.status === 0 ? [] : [{ id: 'helper-blocked', description: 'draft.mjs refused the saved job.' }],
      unverified: ['Everything the fork claims is unverified until the caller checks it.'], externalActions: [],
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

  fx.reviseToRepair = async () => {
    const oldTask = structuredClone(fx.task);
    const oldReturn = await fs.readFile(fx.returnFile);
    const r1 = path.join(root, 'r1');
    fx.producer = path.join(r1, 'producer');
    fx.evidence = path.join(r1, 'evidence');
    await fs.ensureDir(fx.producer);
    const items = await inventoryOf(draft);
    const next: Json[] = [];
    for (const item of items) {
      const snapshot = path.join(fx.evidence, 'baseline', ...item.path.split('/'));
      await fs.copy(path.join(draft, ...item.path.split('/')), snapshot);
      next.push({ path: item.path, bytes: item.bytes, sha256: item.sha256, snapshot });
    }
    fx.changes = { 'SKILL.md': entryText('3. Review the actions every week.\n4. Archive closed actions.\n') };
    fx.task = {
      ...oldTask, revision: 'r1', operation: 'repair',
      previous: { taskId: oldTask.id, taskDigest: digest(canonical(oldTask)), returnSha256: digest(oldReturn), reviewResultSha256: null },
      roots: { ...oldTask.roots, producer: fx.producer, evidence: fx.evidence },
      roles: items.map(item => ({ path: item.path, role: item.path === 'SKILL.md' ? 'subject' : 'support' })),
      baseline: next,
      draftJobTemplate: { ...oldTask.draftJobTemplate, mode: 'repair', allowedPaths: ['SKILL.md'] },
    };
    fx.taskFile = path.join(fx.evidence, 'skill-task.json');
    fx.returnFile = path.join(fx.producer, 'skill-return.json');
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
