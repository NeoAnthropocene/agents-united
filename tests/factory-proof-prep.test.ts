/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import yaml from 'yaml';
import { loadSemanticCore } from '../src/core/semantic-core.js';
import { loadToolPolicy, resolveGrant } from '../src/core/host-profile.js';
import { readOnlyGuardFileHooks } from '../src/core/readonly-guard.js';
import { FLOOR_END, FLOOR_START, renderFloor } from '../src/core/native-floor.js';
import { getPath, git, gitBytes, inside, makeMiniCheckout, runNode, sha256, stripAnsi, walkFolder } from './helpers/proof-prep.js';
import type { Json } from './helpers/proof-prep.js';

const checkout = path.resolve('.');
const cli = path.join(checkout, 'dist', 'cli.js');
const PREPARE = path.join(checkout, 'scripts', 'prepare-factory-proof.mjs');
const RUN_S0 = path.join(checkout, 'scripts', 'run-factory-proof-s0.mjs');
const TIMEOUT = 120_000;

let workRoot = '';
let destination = '';
let prepared: { status: number | null; stdout: string; stderr: string } | undefined;
let manifest: Json;
let statusBefore = '';
let parentBefore: string[] = [];
let parentAfter: string[] = [];
let statusAfter = '';
/** Set when the checkout under test has no usable earlier host library lock (a shallow clone): then S2 is prepared from a synthetic checkout only. */
let realS2Unavailable = '';
let miniDestination = '';
let miniCheckout = '';
let miniPrepared: { status: number | null; stdout: string; stderr: string } | undefined;
let miniManifest: Json;
const scenarioIds = (): string[] => (realS2Unavailable ? ['s0', 's1'] : ['s0', 's1', 's2']);
const FOLDERS: Record<string, string> = { s0: 's0-launcher', s1: 's1-coord-realize', s2: 's2-sync' };

const scenarioDir = (name: string): string => path.join(destination, name);
const prepare = (args: string[]) => runNode([PREPARE, ...args], { timeout: 300_000 });
const readJson = (file: string): Json => JSON.parse(fs.readFileSync(file, 'utf8'));
const hexOf = (file: string): string => sha256(fs.readFileSync(file));

beforeAll(() => {
  if (!fs.existsSync(cli)) throw new Error('Build the CLI first: dist/cli.js is missing in the checkout under test.');
  workRoot = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'au-proof-prep-')));
  destination = path.join(workRoot, 'proof');
  statusBefore = git(checkout, ['status', '--porcelain']);
  parentBefore = fs.readdirSync(workRoot).sort();
  prepared = prepare(['--destination', destination, '--cli', cli, '--checkout', checkout]);
  if (prepared.status !== 0 && /Cannot prepare S2/.test(prepared.stderr)) {
    // A shallow clone has no earlier library lock. S2 plans before anything is written, so nothing was left behind.
    realS2Unavailable = stripAnsi(prepared.stderr).trim();
    if (fs.existsSync(destination)) throw new Error('A refused S2 plan must leave no destination behind.');
    prepared = prepare(['--destination', destination, '--cli', cli, '--checkout', checkout, '--only', 's0,s1']);
  }
  statusAfter = git(checkout, ['status', '--porcelain']);
  parentAfter = fs.readdirSync(workRoot).sort();
  if (prepared.status === 0) manifest = readJson(path.join(destination, 'manifest.json'));
  // S2 from a synthetic checkout history: it runs everywhere, including a shallow clone, and has no recorded hold.
  miniCheckout = makeMiniCheckout(path.join(workRoot, 'mini-checkout'), cli, 2);
  miniDestination = path.join(workRoot, 'mini-proof');
  miniPrepared = prepare(['--destination', miniDestination, '--cli', cli, '--checkout', miniCheckout, '--only', 's2']);
  if (miniPrepared.status === 0) miniManifest = readJson(path.join(miniDestination, 'manifest.json'));
}, 400_000);

afterAll(() => {
  if (workRoot) fs.rmSync(workRoot, { recursive: true, force: true });
});

describe('usage refusals', () => {
  const ok = (name: string): string => path.join(workRoot, name);
  const refused = (args: string[], message: RegExp, expectNew?: string): void => {
    const result = prepare(args);
    expect(result.status, result.stdout + result.stderr).toBe(1);
    expect(stripAnsi(result.stderr)).toMatch(message);
    if (expectNew) expect(fs.existsSync(expectNew)).toBe(false);
  };

  it('refuses relative paths, one flag at a time', () => {
    refused(['--destination', 'relative-dest', '--cli', cli, '--checkout', checkout], /must be absolute/i);
    refused(['--destination', ok('rel-cli'), '--cli', path.relative(process.cwd(), cli), '--checkout', checkout], /must be absolute/i, ok('rel-cli'));
    refused(['--destination', ok('rel-checkout'), '--cli', cli, '--checkout', '.'], /must be absolute/i, ok('rel-checkout'));
  });

  it('refuses unknown flags, a missing flag and a bad --only value', () => {
    refused(['--destination', ok('u1'), '--cli', cli, '--checkout', checkout, '--surprise', 'x'], /Usage: node scripts\/prepare-factory-proof\.mjs/, ok('u1'));
    refused(['--destination', ok('u2'), '--cli', cli], /Usage: node scripts\/prepare-factory-proof\.mjs/, ok('u2'));
    refused(['--destination', ok('u3'), '--cli', cli, '--checkout', checkout, '--only', 's9'], /--only must be s0, s1 or s2/, ok('u3'));
  });

  it('refuses an existing destination and a destination whose parent is missing', () => {
    const existing = ok('exists');
    fs.mkdirSync(existing);
    refused(['--destination', existing, '--cli', cli, '--checkout', checkout], /Destination must not exist/i);
    expect(fs.readdirSync(existing)).toEqual([]);
    refused(['--destination', path.join(workRoot, 'no-parent', 'dest'), '--cli', cli, '--checkout', checkout], /Destination parent must exist/i, path.join(workRoot, 'no-parent'));
  });

  it('refuses a destination inside the checkout and one under a managed Host folder or .git', () => {
    const inCheckout = path.join(checkout, 'proof-prep-test-must-not-exist');
    refused(['--destination', inCheckout, '--cli', cli, '--checkout', checkout], /inside the checkout/i, inCheckout);
    for (const segment of ['.claude', '.agents', '.cline', '.cursor', '.codex', '.opencode', '.gemini', '.git']) {
      const parent = ok(segment);
      fs.mkdirSync(parent);
      const dest = path.join(parent, 'dest');
      refused(['--destination', dest, '--cli', cli, '--checkout', checkout], /managed Host folder|\.git/i, dest);
    }
  });

  it('refuses a missing CLI, a checkout that is not a git work tree, and a CLI that is not the checkout build', () => {
    refused(['--destination', ok('c1'), '--cli', ok('no-such-cli.js'), '--checkout', checkout], /CLI must be an existing regular file/i, ok('c1'));
    const plain = ok('plain-folder');
    fs.mkdirSync(plain);
    refused(['--destination', ok('c2'), '--cli', cli, '--checkout', plain], /Checkout must be a git work tree/i, ok('c2'));
    const other = ok('other-checkout');
    fs.mkdirSync(path.join(other, 'dist'), { recursive: true });
    fs.writeFileSync(path.join(other, 'dist', 'cli.js'), 'console.log("not the build");\n');
    git(other, ['init', '-q']);
    refused(['--destination', ok('c3'), '--cli', cli, '--checkout', other], /same bytes/i, ok('c3'));
  });

  it('refuses a link on the way to the destination, the CLI or the checkout', (context) => {
    const real = ok('link-target');
    fs.mkdirSync(real);
    const link = ok('link');
    try { fs.symlinkSync(real, link, 'junction'); } catch (error) {
      context.skip(`This system refuses to create links (${(error as NodeJS.ErrnoException).code ?? 'error'}); the link refusal cannot be exercised here.`);
      return;
    }
    refused(['--destination', path.join(link, 'dest'), '--cli', cli, '--checkout', checkout], /link on the way/i, path.join(real, 'dest'));
    const linkedCheckout = ok('link-checkout');
    fs.symlinkSync(checkout, linkedCheckout, 'junction');
    refused(['--destination', ok('l2'), '--cli', cli, '--checkout', linkedCheckout], /link on the way/i, ok('l2'));
  });
});

describe('a full preparation', () => {
  it('exits 0 and prints one JSON line with the destination, the scenarios and the manifest path', () => {
    expect(prepared?.status, `${prepared?.stdout}\n${prepared?.stderr}`).toBe(0);
    const lines = prepared!.stdout.trim().split(/\r?\n/);
    const summary = JSON.parse(lines[lines.length - 1]!) as Json;
    expect(summary.destination).toBe(destination);
    expect(summary.scenarios).toEqual(scenarioIds());
    expect(summary.manifest).toBe(path.join(destination, 'manifest.json'));
    expect(summary.hostLaunched).toBe(false);
  });

  it('makes each scenario folder its own git repository with one commit, the factory installed and a clean dry run', () => {
    for (const id of scenarioIds()) {
      const name = FOLDERS[id]!;
      const dir = scenarioDir(name);
      expect(fs.statSync(path.join(dir, '.git')).isDirectory(), id).toBe(true);
      expect(git(dir, ['rev-list', '--count', 'HEAD']).trim(), id).toBe('1');
      expect(git(dir, ['show', '--stat', '--format=%an', 'HEAD']), id).toMatch(/README\.md/);
      expect(git(dir, ['config', '--local', 'user.email']).trim(), id).toMatch(/@example\.invalid$/);
      expect(git(dir, ['config', '--local', 'user.name']).trim(), id).not.toBe('');
      for (const rel of ['.claude/agents/orchestrator-agent-factory.md', '.claude/agents/factory-realizer.md', '.claude/agents/factory-evaluator.md', '.claude/agents/factory-sync.md',
        '.claude/skills/coordinate-artifact/SKILL.md', '.claude/hooks/agents-united-guard.js', '.claude/skills/sync-host/scripts/check-sync.mjs', '.claude/skills/realize-artifact/scripts/check-job.mjs']) {
        expect(fs.statSync(path.join(dir, rel)).isFile(), `${id} ${rel}`).toBe(true);
      }
      const dry = runNode([cli, 'start', 'agent-factory', '--host', 'claude', '--dry-run'], { cwd: dir });
      const out = stripAnsi(dry.stdout);
      expect(dry.status, `${id}\n${out}\n${dry.stderr}`).toBe(0);
      expect(out).toContain('orchestrator-agent-factory');
      expect(out).toContain(`--add-dir=${dir}`);
      expect(out).toMatch(/Capability probe: installed=no/);
    }
  }, TIMEOUT);

  it('records every command with an exit code and every install and doctor run ended 0', () => {
    const commands = manifest.commands as Json[];
    expect(commands.length).toBeGreaterThan(12);
    for (const command of commands) {
      expect(Array.isArray(command.argv)).toBe(true);
      expect(typeof command.exitCode).toBe('number');
      expect(command.exitCode, JSON.stringify(command)).toBe(0);
    }
    for (const id of scenarioIds()) {
      const labels = commands.filter(command => command.scenario === id).map(command => command.label);
      expect(labels).toEqual(expect.arrayContaining(['git-init', 'git-commit', 'install', 'doctor', 'start-dry-run']));
    }
  });

  it('writes a manifest whose hashes match the files, the head and the CLI, with hostLaunched false', () => {
    expect(manifest.hostLaunched).toBe(false);
    expect(manifest.checkout.path).toBe(checkout);
    expect(manifest.checkout.head).toBe(git(checkout, ['rev-parse', '--verify', 'HEAD']).trim());
    expect(manifest.cli.sha256).toBe(hexOf(cli));
    expect(Object.keys(manifest.scenarios)).toEqual(scenarioIds());
    for (const id of scenarioIds()) {
      const name = FOLDERS[id]!;
      const walked = walkFolder(scenarioDir(name));
      expect(manifest.scenarios[id].folder).toBe(scenarioDir(name));
      expect(manifest.scenarios[id].files, id).toEqual(walked.files);
      expect(manifest.scenarios[id].emptyDirectories, id).toEqual(walked.emptyDirectories);
      expect(Object.keys(walked.files).some(rel => rel.startsWith('.git/')), id).toBe(false);
    }
    expect(Object.keys(manifest.prompts)).toEqual(scenarioIds().filter(id => id !== 's0').map(id => `prompts/${id}.txt`));
    for (const file of Object.keys(manifest.prompts)) expect(manifest.prompts[file]).toBe(hexOf(path.join(destination, file)));
  });

  it('leaves the checkout unchanged and creates nothing outside the destination', () => {
    expect(statusAfter).toBe(statusBefore);
    expect(parentAfter).toEqual([...parentBefore, 'proof'].sort());
  });

  it('supports --only for one scenario or several', () => {
    expect(miniPrepared?.status, `${miniPrepared?.stdout}\n${miniPrepared?.stderr}`).toBe(0);
    expect(fs.readdirSync(miniDestination).sort()).toEqual(['manifest.json', 'prompts', 's2-sync']);
    expect(fs.readdirSync(path.join(miniDestination, 'prompts'))).toEqual(['s2.txt']);
    expect(Object.keys(miniManifest.scenarios)).toEqual(['s2']);
    const two = path.join(workRoot, 'only-s1-s0');
    const result = prepare(['--destination', two, '--cli', cli, '--checkout', checkout, '--only', 's1,s0']);
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(fs.readdirSync(two).sort()).toEqual(['manifest.json', 'prompts', 's0-launcher', 's1-coord-realize']);
    expect(Object.keys(readJson(path.join(two, 'manifest.json')).scenarios)).toEqual(['s0', 's1']);
  }, TIMEOUT);

  it('plans S2 before writing anything: a checkout whose lock has no earlier version is refused with a clear message', () => {
    const lone = makeMiniCheckout(path.join(workRoot, 'lone-checkout'), cli, 1);
    const dest = path.join(workRoot, 'lone-proof');
    const result = prepare(['--destination', dest, '--cli', cli, '--checkout', lone]);
    expect(result.status, result.stdout + result.stderr).toBe(1);
    expect(stripAnsi(result.stderr)).toMatch(/Cannot prepare S2: no commit in the history of host-library\/claude\/library\.lock\.json/);
    expect(fs.existsSync(dest)).toBe(false);
    // The scenarios that need no history are still available from the same checkout.
    expect(prepare(['--destination', dest, '--cli', cli, '--checkout', lone, '--only', 's0']).status).toBe(0);
  }, TIMEOUT);

  it('never starts a Claude executable, even when one is on PATH and named by CLAUDE_BIN_PATH', () => {
    const bin = path.join(workRoot, 'fake-claude-bin');
    const marker = path.join(workRoot, 'fake-claude-was-started.txt');
    fs.mkdirSync(bin);
    const fake = path.join(bin, process.platform === 'win32' ? 'claude.cmd' : 'claude');
    if (process.platform === 'win32') fs.writeFileSync(fake, `@echo off\r\necho started> "${marker}"\r\nexit /b 0\r\n`);
    else fs.writeFileSync(fake, `#!/bin/sh\necho started > '${marker}'\nexit 0\n`, { mode: 0o755 });
    const pathKey = Object.keys(process.env).find(name => name.toLowerCase() === 'path') ?? 'PATH';
    const env: NodeJS.ProcessEnv = { ...process.env, [pathKey]: `${bin}${path.delimiter}${process.env[pathKey] ?? ''}`, CLAUDE_BIN_PATH: fake, CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: '1' };
    const dest = path.join(workRoot, 'no-host');
    const made = runNode([PREPARE, '--destination', dest, '--cli', cli, '--checkout', checkout, '--only', 's0'], { env, timeout: 300_000 });
    expect(made.status, made.stdout + made.stderr).toBe(0);
    const ran = runNode([RUN_S0, '--workspace', path.join(dest, 's0-launcher'), '--cli', cli, '--out', path.join(workRoot, 'no-host-result.json')], { env, timeout: 300_000 });
    expect(ran.status, ran.stdout + ran.stderr).toBe(0);
    expect(fs.existsSync(marker), 'the fake Claude executable was started').toBe(false);
    expect(readJson(path.join(dest, 'manifest.json')).hostLaunched).toBe(false);
    expect(readJson(path.join(workRoot, 'no-host-result.json')).hostLaunched).toBe(false);
  }, 300_000);
});

/** The phrases the coordinator's job reference lists, in its order, each with the brief keys that carry the value. */
const CALLER_SUPPLIES: Array<[RegExp, string[]]> = [
  [/^objective, literal fixed values and explicit unknowns$/, ['objective', 'fixedValues', 'unknowns']],
  [/^create\/update and local\/upstream intent$/, ['operation', 'intent']],
  [/^shared pair and target identity$/, ['pair.definition', 'pair.core.sha256', 'pair.contract.sha256', 'target.type', 'target.paths']],
  [/^allowed changes$/, ['allowedChanges.create', 'allowedChanges.update', 'allowedChanges.delete']],
  [/^separate authoring\/target Host contexts$/, ['authoringHost.host', 'authoringHost.observedVersion', 'targetHost.host', 'targetHost.minimum', 'targetHost.reviewedAgainst']],
  [/^actual validation checkout HEAD, selected source registry, Node>=24 and built CLI pins$/, ['validation.checkout', 'validation.head', 'validation.registry', 'validation.node.sha256', 'validation.node.version', 'validation.cli.sha256']],
  [/^reviewed guides\/locked citations\/observations\/profile\/policy\/loading\/guard evidence$/, ['inputs']],
  [/^clear provenance\/notices and unresolved holds$/, ['provenance.disposition', 'provenance.notices', 'provenance.unresolvedHolds']],
  [/^exact executable\/argv\/cwd\/time\/log checks$/, ['checks', 'jobBudget.maxLogBytes']],
  [/^acceptance\/rubric and complete immutable baseline including preservation-only notes$/, ['acceptance', 'rubric', 'baseline', 'preserved', 'preservationNotes']],
];

function jobFromBrief(brief: Json, suffix: string): Json {
  return {
    version: 1, id: `${brief.jobIdPrefix}-${suffix}`, operation: brief.operation, intent: brief.intent,
    artifact: { type: brief.target.type, definition: brief.pair.definition, paths: brief.target.paths, loading: brief.target.loading, requiredSkills: brief.target.requiredSkills },
    authoringHost: brief.authoringHost, targetHost: brief.targetHost,
    source: { checkout: brief.validation.checkout, head: brief.validation.head, registry: brief.validation.registry },
    roots: brief.roots, inputs: brief.inputs, baseline: brief.baseline, preserved: brief.preserved, allowedChanges: brief.allowedChanges,
    constraints: { ...brief.constraints, fixedValues: brief.fixedValues },
    acceptance: brief.acceptance, checks: brief.checks, budget: brief.jobBudget,
  };
}

describe('S1 is solvable offline', () => {
  const s1 = (): string => scenarioDir('s1-coord-realize');
  const brief = (): Json => readJson(path.join(s1(), 'work', 'brief.json'));

  it('has a synthetic pair that passes contract-check, and a registry folder that factory-check can read', () => {
    const b = brief();
    expect(b.pair.registry).toBe(path.join(s1(), 'work', 'registry'));
    const contract = runNode([cli, 'contract-check', '--registry', b.pair.registry, '--definition', b.pair.definition]);
    expect(contract.status, contract.stdout + contract.stderr).toBe(0);
    expect(JSON.parse(contract.stdout)).toMatchObject({ valid: true, definition: b.pair.definition });
    const pair = runNode([cli, 'factory-check', '--registry', b.pair.registry, '--definition', b.pair.definition, '--host', 'claude']);
    expect(pair.status, pair.stdout + pair.stderr).toBe(0);
    expect(fs.readFileSync(path.join(b.pair.registry, 'core', `${b.pair.definition}.contract.json`), 'utf8')).toMatch(/"definition"/);
    expect(b.pair.core.sha256).toBe(hexOf(b.pair.core.path));
    expect(b.pair.contract.sha256).toBe(hexOf(b.pair.contract.path));
  });

  it('can be realized: a native agent built from the pair by hand passes factory-check against the synthetic registry', async () => {
    const b = brief();
    const cores = await loadSemanticCore(b.pair.registry);
    const core = cores.get(b.pair.definition)!;
    const tools = resolveGrant(loadToolPolicy(b.pair.registry, 'claude'), core.capabilities!, { subagent: true, background: false }).tools;
    const meta = { name: 'note-checker', description: 'Read-only checker for one supplied plain-text note.', model: 'inherit', effort: 'medium', background: false, tools: tools.join(', '), hooks: readOnlyGuardFileHooks() };
    const body = `${FLOOR_START}\n${renderFloor(core)}\n${FLOOR_END}\n\n# Note checker\n\nRead the one supplied note and answer the three checklist points.`;
    const draft = path.join(workRoot, 'hand-draft', 'hosts', 'claude', 'agents', 'note-checker.md');
    fs.mkdirSync(path.dirname(draft), { recursive: true });
    fs.writeFileSync(draft, `---\n${yaml.stringify(meta)}---\n${body}\n`);
    const native = b.checks.find((check: Json) => check.id === 'native');
    const argv = (native.argv as string[]).map((arg, index, all) => (all[index - 1] === '--artifact' ? draft : arg));
    const result = runNode(argv.slice(0), { cwd: checkout });
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ ok: true });
    expect(b.fixedValues.every((fixed: Json) => fs.readFileSync(draft, 'utf8').includes(fixed.contains))).toBe(true);
  });

  it('names every input the coordinator reference says the caller supplies', () => {
    const b = brief();
    const reference = fs.readFileSync(path.join(s1(), '.claude', 'skills', 'coordinate-artifact', 'references', 'job.md'), 'utf8').replace(/\r\n/g, '\n');
    expect(reference).toBe(fs.readFileSync(path.join(checkout, 'registry', 'skills', 'coordinate-artifact', 'references', 'job.md'), 'utf8').replace(/\r\n/g, '\n'));
    const sentence = /The caller supplies (.+?)\.\s/s.exec(reference);
    expect(sentence, 'job.md no longer has the sentence "The caller supplies ..."').not.toBeNull();
    const items = sentence![1]!.split(';').map(item => item.trim());
    expect(items).toHaveLength(CALLER_SUPPLIES.length);
    items.forEach((item, index) => expect(item, `item ${index + 1}`).toMatch(CALLER_SUPPLIES[index]![0]));
    for (const [, keys] of CALLER_SUPPLIES) {
      for (const key of keys) {
        const value = getPath(b, key);
        expect(value, key).toBeDefined();
        expect(value, key).not.toBeNull();
        if (typeof value === 'string') expect(value.length, key).toBeGreaterThan(0);
      }
    }
    for (const kind of ['guide', 'snapshot', 'observation', 'profile', 'tool-policy', 'loading', 'guard']) expect((b.inputs as Json[]).some(input => input.kind === kind), kind).toBe(true);
    expect(Number.parseInt(String(b.validation.node.version).replace(/^v/, ''), 10)).toBeGreaterThanOrEqual(24);
    // The next paragraph of the reference: fixed absolute roots, the repair count and the aggregate budget.
    expect(reference).toMatch(/Require fixed absolute draftRoot\/evidenceRoot/);
    for (const root of [b.roots.draft, b.roots.evidence]) expect(path.isAbsolute(root)).toBe(true);
    expect(inside(b.roots.draft, b.roots.evidence) || inside(b.roots.evidence, b.roots.draft)).toBe(false);
    expect(reference).toMatch(/repair count \(default zero, maximum one\)/);
    expect(b.repair.maximum).toBe(1);
    expect(reference).toMatch(/aggregate process\/time\/output budget/);
    expect(b.aggregateBudget).toMatchObject({ maxProcesses: 24, maxSeconds: 1800, maxOutputBytes: 8388608 });
    expect(b.intent).toBe('upstream');
    expect(b.operation).toBe('create');
  });

  it('pins the contribution template and guide of the checkout by path and hash', () => {
    const b = brief();
    expect(b.upstream.template.path).toBe(path.join(checkout, '.github', 'PULL_REQUEST_TEMPLATE', 'artifact-contribution.md'));
    expect(b.upstream.template.sha256).toBe(hexOf(b.upstream.template.path));
    expect(b.upstream.guide.path).toBe(path.join(checkout, 'docs', 'artifact-contribution.md'));
    expect(b.upstream.guide.sha256).toBe(hexOf(b.upstream.guide.path));
    expect(b.upstream).toMatchObject({ base: 'dev', sent: false });
    expect((b.inputs as Json[]).find(input => input.kind === 'template')).toMatchObject({ path: b.upstream.template.path, sha256: b.upstream.template.sha256 });
    expect(b.upstream.bodyPath.startsWith(b.roots.evidence)).toBe(true);
  });

  it('gives the empty evidence and draft-parent folders and no draft root yet', () => {
    const b = brief();
    expect(fs.readdirSync(b.roots.evidence)).toEqual([]);
    expect(fs.readdirSync(path.dirname(b.roots.draft))).toEqual([]);
    expect(fs.existsSync(b.roots.draft)).toBe(false);
    expect(manifest.scenarios.s1.emptyDirectories).toEqual(expect.arrayContaining(['work/evidence', 'work/draft-parent']));
  });

  it('lets the installed realizer checker accept a job assembled from the brief', () => {
    const b = brief();
    const jobFile = path.join(workRoot, 'job-from-brief.json');
    fs.writeFileSync(jobFile, JSON.stringify(jobFromBrief(b, 'r0'), null, 2));
    const result = runNode([path.join(s1(), '.claude', 'skills', 'realize-artifact', 'scripts', 'check-job.mjs'), '--job', jobFile], { cwd: workRoot });
    expect(result.status, result.stdout + result.stderr).toBe(0);
    const report = JSON.parse(result.stdout) as Json;
    expect(report.ok).toBe(true);
    expect(report.digest).toMatch(/^[0-9a-f]{64}$/);
    // The brief leaves the job record to the coordinator: it holds no job-only fields such as a job id.
    expect(b.id).toBeUndefined();
    // And the brief's own checks include the exact native check the job checker demands.
    expect((b.checks as Json[]).map(check => check.id).sort()).toEqual(['contract', 'native', 'pair']);
  });
});

interface S2Case { label: string; dest: string; checkoutDir: string; manifest: Json }
/** The prepared S2 workspaces: always the one built from the synthetic history, and the one from the checkout under test when its history allows. */
const s2Cases = (): S2Case[] => [
  { label: 'synthetic checkout history', dest: miniDestination, checkoutDir: miniCheckout, manifest: miniManifest },
  ...(realS2Unavailable ? [] : [{ label: 'the checkout under test', dest: destination, checkoutDir: checkout, manifest }]),
];

describe('S2 is solvable offline', () => {
  const written: string[] = [];
  afterAll(() => { for (const file of written) fs.rmSync(file, { force: true }); });
  const pin = (file: string) => { const bytes = fs.readFileSync(file); return { path: file, sha256: sha256(bytes), bytes: bytes.length }; };

  /** Follows host-sync.md by hand against the prepared workspace, with the installed checker and without the preparation script's code. */
  function walkThrough(kase: S2Case): void {
    const s2 = path.join(kase.dest, 's2-sync');
    const lib = path.join(kase.checkoutDir, 'host-library', 'claude');
    const brief = readJson(path.join(s2, 'work', 'sync-brief.json'));
    const reference = fs.readFileSync(path.join(s2, '.claude', 'skills', 'coordinate-artifact', 'references', 'host-sync.md'), 'utf8');
    for (const heading of ['## What the maintainer supplies', '## Assemble the sync job', '## Sequence']) expect(reference, kase.label).toContain(heading);
    // What the maintainer supplies (host-sync.md, items 1 to 6): each one is in the brief.
    expect(brief, kase.label).toMatchObject({ host: 'claude', checkout: kase.checkoutDir, currentHead: git(kase.checkoutDir, ['rev-parse', '--verify', 'HEAD']).trim() });
    expect(brief.earlierCommit).toMatch(/^[0-9a-f]{40}$/);
    expect(brief.earlierCommit).not.toBe(brief.currentHead);
    expect(brief.targets).toHaveLength(2);
    expect(Array.isArray(brief.heldSources)).toBe(true);
    expect(Array.isArray(brief.changedOutsideLock)).toBe(true);
    expect(brief.evidence).toBe(path.join(s2, 'work', 'sync-evidence'));
    expect(fs.readdirSync(brief.evidence)).toEqual([]);
    expect(inside(brief.workspace, brief.evidence) && !inside(kase.checkoutDir, brief.evidence)).toBe(true);

    // Assemble the sync job as the reference says.
    const previousLock = path.join(brief.evidence, 'previous-library.lock.json');
    fs.writeFileSync(previousLock, gitBytes(kase.checkoutDir, ['show', `${brief.earlierCommit}:host-library/claude/library.lock.json`]));
    written.push(previousLock);
    const lockFile = path.join(lib, 'library.lock.json');
    const current = readJson(lockFile).files as Json;
    const previous = readJson(previousLock).files as Json;
    const changedInputs: Json[] = [];
    for (const key of [...new Set([...Object.keys(previous), ...Object.keys(current)])].sort()) {
      const oldSha = previous[key] ? String(previous[key].sha256).slice(7) : null;
      const newSha = current[key] ? String(current[key].sha256).slice(7) : null;
      if (oldSha !== newSha) changedInputs.push({ path: path.join(lib, ...key.split('/')), oldSha256: oldSha, newSha256: newSha });
    }
    expect(changedInputs.length).toBeGreaterThan(0);
    const job = {
      version: 1, kind: 'host-update-sync-job', id: 'proof-host-sync-claude', host: brief.host,
      source: { checkout: kase.checkoutDir, head: brief.currentHead }, roots: { workspace: brief.workspace, evidence: brief.evidence },
      library: { lock: pin(lockFile), previousLock: pin(previousLock) },
      changedInputs, heldSources: brief.heldSources, targets: (brief.targets as string[]).map(pin),
    };
    const jobFile = path.join(brief.evidence, 'sync-job.json');
    fs.writeFileSync(jobFile, JSON.stringify(job, null, 2));
    written.push(jobFile);
    const checker = path.join(s2, '.claude', 'skills', 'sync-host', 'scripts', 'check-sync.mjs');
    const pre = runNode([checker, '--job', jobFile], { cwd: workRoot });
    expect(pre.status, `${kase.label}\n${pre.stdout}${pre.stderr}`).toBe(0);
    const preflight = JSON.parse(pre.stdout) as Json;
    expect(preflight).toMatchObject({ phase: 'preflight', recordValid: true, host: 'claude' });
    expect(preflight.counts).toMatchObject({ targets: 2, affected: 1, heldSources: brief.heldSources.length });
    expect(preflight.counts.changedInputs).toBe(changedInputs.length);
    expect(preflight.counts.unpinnedChanges).toBe(changedInputs.length - 1);

    // A correct plan, written by the test from the rules of the plan reference (not by the preparation script).
    const fold = (value: string): string => (process.platform === 'win32' ? value.toLowerCase() : value);
    const relOf = (file: string): string => fold(path.relative(lib, file).split(path.sep).join('/'));
    const records = (job.targets as Json[]).map(target => readJson(target.path));
    const stale = new Set<string>();
    const artifacts = records.map((record, index) => {
      const byRel = new Map<string, Json>(record.inputs.map((input: Json) => [relOf(input.path), input]));
      const changedPins = changedInputs.filter(changed => { const match = byRel.get(relOf(changed.path)); return match && (changed.newSha256 === null || match.sha256 !== changed.newSha256); })
        .map(changed => {
          const match = byRel.get(relOf(changed.path))!;
          stale.add(changed.path);
          return { kind: match.kind, path: changed.path, pinnedSha256: match.sha256, oldSha256: changed.oldSha256, newSha256: changed.newSha256, pinnedAtPrevious: match.sha256 === changed.oldSha256 };
        });
      const heldPins = (job.heldSources as Json[]).filter(held => byRel.has(relOf(held.path))).map(held => ({ path: held.path, pinnedSha256: byRel.get(relOf(held.path))!.sha256 }));
      return { job: { path: job.targets[index]!.path, sha256: job.targets[index]!.sha256 }, jobId: record.id, artifact: record.artifact, affected: changedPins.length > 0, changedPins, heldPins,
        reason: changedPins.length > 0 ? 'Pins a changed library page at its earlier hash.' : 'Pins only pages that did not change.' };
    });
    expect(artifacts.map(artifact => artifact.affected), kase.label).toEqual([false, true]);
    expect(artifacts[1]!.changedPins[0]).toMatchObject({ pinnedAtPrevious: true });
    const plan = {
      version: 1, kind: 'host-update-sync-plan', jobId: job.id, host: job.host, jobDigest: preflight.jobDigest,
      proposalOnly: true, implemented: false, heldSourcesAdvanced: false, quality: 'pending', live: 'unverified',
      artifacts, unpinnedChanges: changedInputs.filter(changed => !stale.has(changed.path)).map(changed => changed.path),
      heldSources: (job.heldSources as Json[]).map(held => ({ path: held.path, lockedSha256: held.lockedSha256, candidateSha256: held.candidateSha256, disposition: 'not advanced, no action' })),
    };
    const planFile = path.join(brief.evidence, 'sync-plan.json');
    fs.writeFileSync(planFile, JSON.stringify(plan, null, 2));
    written.push(planFile);
    const post = runNode([checker, '--job', jobFile, '--result', planFile], { cwd: workRoot });
    expect(post.status, `${kase.label}\n${post.stdout}${post.stderr}`).toBe(0);
    expect(JSON.parse(post.stdout)).toMatchObject({ phase: 'postflight', heldSourcesAdvanced: false, implemented: false });

    // The same plan with the unaffected target marked affected must fail.
    const wrong = structuredClone(plan) as Json;
    wrong.artifacts[0].affected = true;
    wrong.artifacts[0].changedPins = [{ ...wrong.artifacts[1].changedPins[0] }];
    const wrongFile = path.join(brief.evidence, 'wrong-plan.json');
    fs.writeFileSync(wrongFile, JSON.stringify(wrong, null, 2));
    written.push(wrongFile);
    const bad = runNode([checker, '--job', jobFile, '--result', wrongFile], { cwd: workRoot });
    expect(bad.status, bad.stdout + bad.stderr).toBe(1);
    expect(JSON.parse(bad.stderr.trim().split(/\r?\n/).pop()!)).toMatchObject({ phase: 'postflight', code: 'AFFECTED_MISMATCH' });

    // The recorded expectation agrees with what the test derived.
    expect(kase.manifest.scenarios.s2.expected.affected).toEqual([records[1]!.id]);
    expect(kase.manifest.scenarios.s2.expected.unaffected).toEqual([records[0]!.id]);
    expect(kase.manifest.scenarios.s2.earlierCommit).toBe(brief.earlierCommit);

    // Clean up and show the prepared folder is as the manifest has it.
    for (const file of written) fs.rmSync(file, { force: true });
    expect(walkFolder(s2).files, kase.label).toEqual(kase.manifest.scenarios.s2.files);
  }

  it('follows host-sync.md by hand on a synthetic checkout history: the checker accepts the job and the right plan and refuses a wrong one', () => {
    expect(miniPrepared?.status, `${miniPrepared?.stdout}\n${miniPrepared?.stderr}`).toBe(0);
    walkThrough(s2Cases()[0]!);
    const brief = readJson(path.join(miniDestination, 's2-sync', 'work', 'sync-brief.json'));
    expect(brief.heldSources).toEqual([]);
    expect(miniManifest.scenarios.s2.heldSource).toMatchObject({ found: false });
    expect(miniManifest.scenarios.s2.changedEntries).toBe(2);
  }, TIMEOUT);

  it('follows host-sync.md by hand on the checkout under test', (context) => {
    if (realS2Unavailable) { context.skip(`The checkout under test has no usable earlier host library lock (${realS2Unavailable}); S2 ran on the synthetic history only.`); return; }
    walkThrough(s2Cases()[1]!);
  }, TIMEOUT);

  it('records which held source was used, or that none fits, and uses it consistently in the brief', (context) => {
    if (realS2Unavailable) { context.skip('The checkout under test has no usable earlier host library lock; there is no S2 record of it.'); return; }
    const brief = readJson(path.join(destination, 's2-sync', 'work', 'sync-brief.json'));
    const held = manifest.scenarios.s2.heldSource as Json;
    expect(typeof held.found).toBe('boolean');
    expect(brief.heldSources).toHaveLength(held.found ? 1 : 0);
    if (held.found) {
      expect(brief.heldSources[0]).toMatchObject({ path: held.path, lockedSha256: held.lockedSha256, candidateSha256: held.candidateSha256 });
      expect(hexOf(held.path)).toBe(held.lockedSha256);
      expect(held.lockedSha256).not.toBe(held.candidateSha256);
      expect(held.source).toBe(path.join(checkout, 'docs', 'skill-quality', '2026-11-07-host-source-holds.md'));
    } else {
      expect(String(held.reason).length).toBeGreaterThan(0);
    }
  });
});

describe('the S0 runner', () => {
  const s0 = (): string => scenarioDir('s0-launcher');

  it('runs the four steps on a prepared workspace, passes, and leaves every hash as the manifest has it', () => {
    const out = path.join(workRoot, 's0-result.json');
    const before = walkFolder(s0());
    expect(before.files).toEqual(manifest.scenarios.s0.files);
    const result = runNode([RUN_S0, '--workspace', s0(), '--cli', cli, '--out', out], { timeout: 300_000 });
    expect(result.status, result.stdout + result.stderr).toBe(0);
    const record = readJson(out);
    expect(record).toMatchObject({ pass: true, hostLaunched: false });
    expect(record.steps).toHaveLength(4);
    for (const step of record.steps as Json[]) {
      expect(step.pass, step.id).toBe(true);
      expect(step.restored, step.id).toBe(true);
      for (const run of step.runs as Json[]) {
        expect(Array.isArray(run.argv)).toBe(true);
        expect(typeof run.exitCode).toBe('number');
        expect(run.pass, JSON.stringify(run)).toBe(true);
        expect(String(run.matched).length).toBeGreaterThan(0);
      }
    }
    const [clean, flags, guard, support] = record.steps as Json[];
    expect(clean.runs[0].exitCode).toBe(0);
    expect(flags.runs.map((run: Json) => run.argv.filter((arg: string) => arg.startsWith('--') && !['--host', '--dry-run'].includes(arg))[0])).toEqual(['--bg', '--global', '--plugin', '--teams']);
    expect(flags.runs.every((run: Json) => run.exitCode !== 0)).toBe(true);
    expect(guard.runs[0].exitCode).not.toBe(0);
    expect(guard.runs[0].matched).toMatch(/edited required file \.claude\/hooks\/agents-united-guard\.js/);
    expect(support.runs[0].exitCode).not.toBe(0);
    expect(support.runs[0].matched).toMatch(/missing or case-colliding required file \.claude\/skills\/coordinate-artifact\//);
    expect(walkFolder(s0())).toEqual({ files: manifest.scenarios.s0.files, emptyDirectories: manifest.scenarios.s0.emptyDirectories });
    expect(git(s0(), ['status', '--porcelain']).trim()).toBe('?? .claude/');
    expect(runNode([RUN_S0, '--workspace', s0(), '--cli', cli, '--out', out]).status).toBe(1);
  }, 300_000);

  it('refuses a relative path, an existing result file and a result file inside the workspace', () => {
    const rel = runNode([RUN_S0, '--workspace', 'relative', '--cli', cli, '--out', path.join(workRoot, 'x.json')]);
    expect(rel.status).toBe(1);
    expect(rel.stderr).toMatch(/must be absolute/i);
    const existing = path.join(workRoot, 'existing.json');
    fs.writeFileSync(existing, '{}');
    const again = runNode([RUN_S0, '--workspace', s0(), '--cli', cli, '--out', existing]);
    expect(again.status).toBe(1);
    expect(again.stderr).toMatch(/must not exist/i);
    const inWorkspace = runNode([RUN_S0, '--workspace', s0(), '--cli', cli, '--out', path.join(s0(), 'result.json')]);
    expect(inWorkspace.status).toBe(1);
    expect(inWorkspace.stderr).toMatch(/outside the workspace/i);
    expect(fs.existsSync(path.join(s0(), 'result.json'))).toBe(false);
  });

  it('fails and says so when the guard was already tampered before the run, with and without the manifest', () => {
    const dest = path.join(workRoot, 'tampered');
    const made = prepare(['--destination', dest, '--cli', cli, '--checkout', checkout, '--only', 's0']);
    expect(made.status, made.stdout + made.stderr).toBe(0);
    const workspace = path.join(dest, 's0-launcher');
    const guard = path.join(workspace, '.claude', 'hooks', 'agents-united-guard.js');
    fs.appendFileSync(guard, '\n');
    const tamperedTree = walkFolder(workspace);

    const withManifest = path.join(workRoot, 'tampered-1.json');
    const first = runNode([RUN_S0, '--workspace', workspace, '--cli', cli, '--out', withManifest], { timeout: 300_000 });
    expect(first.status, first.stdout + first.stderr).toBe(1);
    expect(stripAnsi(first.stderr)).toMatch(/differs from the manifest/i);
    expect(readJson(withManifest)).toMatchObject({ pass: false });
    expect(walkFolder(workspace)).toEqual(tamperedTree);

    fs.rmSync(path.join(dest, 'manifest.json'));
    const withoutManifest = path.join(workRoot, 'tampered-2.json');
    const second = runNode([RUN_S0, '--workspace', workspace, '--cli', cli, '--out', withoutManifest], { timeout: 300_000 });
    expect(second.status, second.stdout + second.stderr).toBe(1);
    const record = readJson(withoutManifest);
    expect(record.pass).toBe(false);
    expect(record.steps[0]).toMatchObject({ id: 'clean-dry-run', pass: false });
    expect(record.steps[0].runs[0].exitCode).not.toBe(0);
    expect(stripAnsi(second.stderr)).toMatch(/step .* failed/i);
    // Whatever the outcome, the workspace is left as the runner found it.
    expect(walkFolder(workspace)).toEqual(tamperedTree);
  }, 400_000);
});

describe('the prompt files', () => {
  const read = (dest: string, name: string): { bytes: Buffer; text: string } => {
    const bytes = fs.readFileSync(path.join(dest, 'prompts', name));
    return { bytes, text: new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes) };
  };
  const absolutePaths = (text: string): string[] => {
    const pattern = process.platform === 'win32' ? /[A-Za-z]:\\[^\s"'`<>|*?]+/g : /(?<![\w.\-/:])\/(?:[\w.-]+\/)*[\w.-]+/g;
    return (text.match(pattern) ?? []).map(found => found.replace(/[.,;:)\]]+$/, ''));
  };
  const everyPrompt = (): Array<{ label: string; dest: string; checkoutDir: string; name: string }> => [
    { label: 's1', dest: destination, checkoutDir: checkout, name: 's1.txt' },
    ...s2Cases().map(kase => ({ label: `s2 (${kase.label})`, dest: kase.dest, checkoutDir: kase.checkoutDir, name: 's2.txt' })),
  ];

  it('are UTF-8 with no byte-order mark and LF line ends', () => {
    for (const prompt of everyPrompt()) {
      const { bytes, text } = read(prompt.dest, prompt.name);
      expect(bytes.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf])), prompt.label).toBe(false);
      expect(text, prompt.label).not.toContain('\r');
      expect(text.length, prompt.label).toBeGreaterThan(400);
    }
  });

  it('give every absolute path the coordinator needs and no path outside the destination and the checkout', () => {
    const s1 = path.join(destination, 's1-coord-realize');
    const b1 = readJson(path.join(s1, 'work', 'brief.json'));
    const one = read(destination, 's1.txt').text;
    for (const needed of [s1, path.join(s1, 'work', 'brief.json'), b1.roots.evidence, b1.roots.draft, b1.pair.registry, b1.upstream.bodyPath, checkout, path.join(checkout, 'dist', 'cli.js'), b1.upstream.template.path, b1.validation.head]) expect(one, needed).toContain(needed);
    for (const kase of s2Cases()) {
      const s2 = path.join(kase.dest, 's2-sync');
      const b2 = readJson(path.join(s2, 'work', 'sync-brief.json'));
      const two = read(kase.dest, 's2.txt').text;
      for (const needed of [s2, path.join(s2, 'work', 'sync-brief.json'), b2.evidence, kase.checkoutDir, ...(b2.targets as string[]), b2.earlierCommit, b2.currentHead, path.join(s2, '.claude', 'skills', 'sync-host', 'scripts', 'check-sync.mjs')]) expect(two, needed).toContain(needed);
    }
    for (const prompt of everyPrompt()) {
      const found = absolutePaths(read(prompt.dest, prompt.name).text);
      expect(found.length, prompt.label).toBeGreaterThan(3);
      for (const file of found) expect(inside(prompt.dest, file) || inside(prompt.checkoutDir, file), `${prompt.label}: ${file}`).toBe(true);
    }
  });

  it('state the task in the words of the runbook and carry no instruction to skip a check', () => {
    const one = read(destination, 's1.txt').text;
    expect(one).toMatch(/create/);
    expect(one).toMatch(/independent/i);
    expect(one).toMatch(/repair/i);
    expect(one).toMatch(/sent: false/);
    expect(one).toMatch(/base `?dev`?/);
    expect(one).toMatch(/no commit|not commit|never commit/i);
    for (const prompt of everyPrompt().filter(item => item.name === 's2.txt')) {
      const two = read(prompt.dest, prompt.name).text;
      expect(two).toMatch(/host-update sync/i);
      expect(two).toMatch(/host-sync/i);
      expect(two).toMatch(/hold/i);
    }
    for (const prompt of everyPrompt()) {
      const text = read(prompt.dest, prompt.name).text;
      expect(text, prompt.label).toMatch(/exit code/i);
      expect(text, prompt.label).toMatch(/evidence folder/i);
      expect(text, prompt.label).toMatch(/could not|cannot do/i);
      expect(text, prompt.label).not.toMatch(/\b(skip|skipping|bypass|ignore|omit|disable|waive)\b/i);
      expect(text, prompt.label).not.toMatch(/\bno need to (run|check|verify)\b/i);
      expect(text, prompt.label).not.toMatch(/\b(call|use|invoke) the (Agent|Bash|Task|Skill|Read|Write) tool\b/i);
    }
  });
});
