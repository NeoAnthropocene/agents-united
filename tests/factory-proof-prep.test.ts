/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import yaml from 'yaml';
import { spawnSync } from 'node:child_process';
import { loadSemanticCore } from '../src/core/semantic-core.js';
import { loadToolPolicy, resolveGrant } from '../src/core/host-profile.js';
import { readOnlyGuardFileHooks } from '../src/core/readonly-guard.js';
import { FLOOR_END, FLOOR_START, renderFloor } from '../src/core/native-floor.js';
import { getPath, git, gitBytes, inside, makeMiniCheckout, runNode, sha256, stripAnsi, walkFolder } from './helpers/proof-prep.js';
import type { Json } from './helpers/proof-prep.js';
import { canonical, digest } from './helpers/skill-task.js';

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
const scenarioIds = (): string[] => (realS2Unavailable ? ['s0', 's1', 's3', 's4', 's5', 's6'] : ['s0', 's1', 's2', 's3', 's4', 's5', 's6']);
const FOLDERS: Record<string, string> = { s0: 's0-launcher', s1: 's1-coord-realize', s2: 's2-sync', s3: 's3-typed-forks' };
/** Every prepared workspace folder of the main preparation by its name: the manifest entry of a scenario, or one of its several folders. */
const workspaceEntries = (m: Json): Record<string, Json> => Object.fromEntries(Object.values<Json>(m.scenarios).flatMap(entry => (entry.folders ? Object.values<Json>(entry.folders) : [entry])).map(entry => [path.basename(entry.folder as string), entry]));

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
  if (prepared.status === 0) {
    // A shallow clone has no earlier library lock: without --only the preparation then leaves S2 out and says why.
    const summary = JSON.parse(prepared.stdout.trim().split(/\r?\n/).pop()!) as Json;
    if (summary.skipped?.s2) realS2Unavailable = String(summary.skipped.s2);
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
    refused(['--destination', ok('u3'), '--cli', cli, '--checkout', checkout, '--only', 's9'], /--only must be one of s0, s1, s2, s3, s4, s5, s6/, ok('u3'));
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
    expect(summary.sittings).toBe(path.join(destination, 'SITTINGS.md'));
    expect(summary.manifest).toBe(path.join(destination, 'manifest.json'));
    expect(summary.hostLaunched).toBe(false);
  });

  it('makes each scenario folder its own git repository with one commit, the factory installed and a clean dry run', () => {
    for (const id of scenarioIds().filter(item => item in FOLDERS)) {
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
    for (const id of scenarioIds().filter(item => item in FOLDERS)) {
      const labels = commands.filter(command => command.scenario === id).map(command => command.label);
      expect(labels).toEqual(expect.arrayContaining(['git-init', 'git-commit', 'install', 'doctor', 'start-dry-run']));
    }
    for (const tag of ['s4a', 's4b', 's5-with', 's5-without', 's5-control', 's6']) expect(commands.some(command => command.scenario === tag && command.label === 'git-commit'), tag).toBe(true);
  });

  it('writes a manifest whose hashes match the files, the head and the CLI, with hostLaunched false', () => {
    expect(manifest.hostLaunched).toBe(false);
    expect(manifest.checkout.path).toBe(checkout);
    expect(manifest.checkout.head).toBe(git(checkout, ['rev-parse', '--verify', 'HEAD']).trim());
    expect(manifest.cli.sha256).toBe(hexOf(cli));
    expect(Object.keys(manifest.scenarios)).toEqual(scenarioIds());
    const entries = workspaceEntries(manifest);
    expect(Object.keys(entries).sort()).toEqual([...scenarioIds().flatMap(id => (id in FOLDERS ? [FOLDERS[id]!] : id === 's4' ? ['s4a-factory-guards', 's4b-readonly-probe'] : id === 's5' ? ['s5-control', 's5-with', 's5-without'] : ['s6-skill-args']))].sort());
    for (const [name, entry] of Object.entries(entries)) {
      const walked = walkFolder(scenarioDir(name));
      expect(entry.folder, name).toBe(scenarioDir(name));
      expect(entry.files, name).toEqual(walked.files);
      expect(entry.emptyDirectories, name).toEqual(walked.emptyDirectories);
      expect(Object.keys(walked.files).some(rel => rel.startsWith('.git/')), name).toBe(false);
    }
    expect(Object.keys(manifest.prompts).sort()).toEqual([...(realS2Unavailable ? [] : ['prompts/s2.txt']), 'prompts/s1.txt', 'prompts/s5-control.txt', 'prompts/s5-with.txt', 'prompts/s5-without.txt'].sort());
    for (const file of Object.keys(manifest.prompts)) expect(manifest.prompts[file]).toBe(hexOf(path.join(destination, file)));
  });

  it('opens each headless prompt that makes the coordinator start a worker with the one waiting sentence, and no other prompt', () => {
    const sentence = "This is a headless session (claude -p): ending your turn ends the session, so wait for each worker's result in the same turn.";
    for (const name of ['s1.txt', ...(realS2Unavailable ? [] : ['s2.txt'])]) {
      expect(fs.readFileSync(path.join(destination, 'prompts', name), 'utf8').startsWith(sentence + '\n\n'), name).toBe(true);
    }
    for (const name of ['s5-with.txt', 's5-without.txt', 's5-control.txt']) expect(fs.readFileSync(path.join(destination, 'prompts', name), 'utf8'), name).not.toContain('headless session');
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
    const result = prepare(['--destination', dest, '--cli', cli, '--checkout', lone, '--only', 's2']);
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
    const meta = { name: 'note-checker', description: 'Read-only checker for one supplied plain-text note.', model: 'sonnet', effort: 'medium', background: false, tools: tools.join(', '), hooks: readOnlyGuardFileHooks() };
    const body = `${FLOOR_START}\n${renderFloor(core)}\n${FLOOR_END}\n\n# Note checker\n\nRead the one supplied note and answer the three checklist points.\n\n${core.invariants.join('\n')}`;
    const draft = path.join(workRoot, 'hand-draft', 'hosts', 'claude', 'agents', 'note-checker.md');
    fs.mkdirSync(path.dirname(draft), { recursive: true });
    fs.writeFileSync(draft, `---\n${yaml.stringify(meta)}---\n${body}\n`);
    const native = b.checks.find((check: Json) => check.id === 'native');
    const coverage = draft.replace(/\.md$/, '.coverage.json');
    fs.writeFileSync(coverage, `${JSON.stringify({ version: 1, role: 'note-checker', definition: b.pair.definition, invariants: core.invariants.map((invariant: string) => ({ invariant, evidence: invariant })) }, null, 2)}\n`);
    expect(b.allowedChanges.create).toContain('hosts/claude/agents/note-checker.coverage.json');
    const argv = (native.argv as string[]).map((arg, index, all) => (all[index - 1] === '--artifact' ? draft : all[index - 1] === '--coverage' ? coverage : arg));
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
    // The next paragraph of the reference: fixed absolute roots, the repair count and the missing aggregate budget.
    expect(reference).toMatch(/Require fixed absolute draftRoot\/evidenceRoot/);
    for (const root of [b.roots.draft, b.roots.evidence]) expect(path.isAbsolute(root)).toBe(true);
    expect(inside(b.roots.draft, b.roots.evidence) || inside(b.roots.evidence, b.roots.draft)).toBe(false);
    expect(reference).toMatch(/repair count \(default zero, maximum one\)/);
    expect(b.repair.maximum).toBe(1);
    expect(reference).toMatch(/a journey has no aggregate process, time or output budget/);
    expect(b.limits).toEqual({ maxSequentialWorkerTurns: 4 });
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

// ---------------------------------------------------------------------------------------------------------------- S3 to S6

/** A pin without the extra fields a brief adds (the Node pin also carries its version). */
const plainPin = (pin: Json): Json => ({ path: pin.path, bytes: pin.bytes, sha256: pin.sha256 });
const taskCommon = (b: Json): Json => ({
  version: 1, id: b.id, revision: 'r0', previous: null, operation: b.operation, intent: b.intent, authoringHost: b.authoringHost, target: null,
  objective: b.objective, fixedValues: b.fixedValues, constraints: b.constraints, acceptance: b.acceptance,
  roots: { draft: b.roots.draft, producer: b.roots.producer, evidence: b.roots.evidence, managed: b.roots.managed, protected: b.roots.protected },
  source: b.source, roles: b.draft.roles, baseline: b.draft.baseline, contributionTemplate: null, installed: b.pins.installed,
});

/** The task each route's reference says the coordinator writes, assembled from the brief and nothing else. */
function taskFromBrief(route: 'skill' | 'contract' | 'bundle', b: Json): Json {
  const common = taskCommon(b);
  if (route === 'skill') {
    return {
      ...common, kind: 'skill-task', skillCheckPolicy: b.policy,
      draftJobTemplate: { mode: b.draft.mode, intent: b.intent, sourceRoot: b.source.checkout, draftRoot: b.roots.draft, allowedPaths: b.draft.allowedPaths, provenance: b.provenance, loading: b.loading, requiredTools: b.requiredTools },
      runtime: { executable: plainPin(b.pins.executable), checker: b.pins.checker, validator: b.pins.validator, corpus: b.pins.corpus }, budget: b.budget,
    };
  }
  if (route === 'contract') {
    return {
      ...common, kind: 'contract-task', definition: b.definition,
      draftJobTemplate: {
        version: 1, id: b.id, mode: b.operation, intent: b.intent, definition: b.definition, objective: b.objective, fixedValues: b.fixedValues.map((item: Json) => item.value),
        constraints: b.constraints, acceptance: b.acceptance.map((item: Json) => item.description),
        source: { checkout: b.source.checkout, head: b.source.head, registry: b.source.registry, pins: [] }, loading: b.loading,
        validator: { runtime: { path: b.pins.executable.path, sha256: b.pins.executable.sha256 }, cli: { path: b.pins.validator.path, sha256: b.pins.validator.sha256 } },
        draftRoot: b.roots.draft, evidenceRoot: b.roots.evidence, managedRoots: b.roots.managed, protectedRoots: b.roots.protected, baseline: [],
        allowedPaths: b.draft.allowedPaths, protectedNotes: b.draft.protectedNotes, bindings: b.draft.bindings, provenance: b.provenance, budget: b.templateBudget,
      },
      runtime: { executable: plainPin(b.pins.executable), checker: b.pins.checker, validator: b.pins.validator }, budget: b.budget,
    };
  }
  return {
    ...common, kind: 'bundle-task', bundle: b.bundle, allowedPaths: b.draft.allowedPaths, protectedNotes: b.draft.protectedNotes, inputPins: b.inputPins, provenance: b.provenance,
    selectedChecks: b.selectedChecks, runtime: { executable: plainPin(b.pins.executable), checker: b.pins.checker, validator: b.pins.validator }, validation: b.validation, budget: b.budget,
  };
}

describe('S3 is solvable offline', () => {
  const s3 = (): string => scenarioDir('s3-typed-forks');
  const written: string[] = [];
  const briefOf = (route: string): Json => readJson(path.join(s3(), 'work', route, 'brief.json'));
  const checkerOf = (route: string): string => path.join(s3(), '.claude', 'skills', 'coordinate-artifact', 'scripts', `check-${route}-return.mjs`);
  const writeTask = (route: 'skill' | 'contract' | 'bundle'): { file: string; task: Json; brief: Json } => {
    const brief = briefOf(route);
    const task = taskFromBrief(route, brief);
    const file = path.join(brief.roots.evidence, `${route}-task.json`);
    fs.writeFileSync(file, JSON.stringify(task, null, 2));
    written.push(file);
    return { file, task, brief };
  };
  const tidy = (): void => {
    for (const file of written) fs.rmSync(file, { force: true, recursive: true });
    for (const route of ['skill', 'contract', 'bundle']) fs.rmSync(briefOf(route).roots.draft, { force: true, recursive: true });
    written.length = 0;
  };
  afterAll(tidy);

  it('has three disjoint route trees with a brief, empty evidence and producer folders, and no draft root', () => {
    const roots: string[] = [];
    for (const route of ['skill', 'contract', 'bundle']) {
      const brief = briefOf(route);
      expect(brief).toMatchObject({ route, operation: 'create', intent: 'local' });
      expect(path.dirname(path.dirname(brief.roots.draft))).toBe(path.join(s3(), 'work', route));
      expect(fs.readdirSync(brief.roots.evidence)).toEqual([]);
      expect(fs.readdirSync(brief.roots.producer)).toEqual([]);
      expect(fs.readdirSync(path.dirname(brief.roots.draft))).toEqual([]);
      expect(fs.existsSync(brief.roots.draft)).toBe(false);
      expect(brief.source).toMatchObject({ checkout, head: git(checkout, ['rev-parse', '--verify', 'HEAD']).trim() });
      for (const root of [brief.roots.draft, brief.roots.producer, brief.roots.evidence]) {
        expect(root.split(/[\\/]/).some((part: string) => ['.claude', '.agents', '.cline', '.cursor', '.codex', '.opencode', '.gemini'].includes(part)), root).toBe(false);
        roots.push(root);
      }
      expect(brief.pins.validator.sha256).toBe(hexOf(cli));
      expect(brief.pins.executable.path).toBe(fs.realpathSync(process.execPath));
      expect(brief.pins.installed).toHaveLength({ skill: 9, contract: 19, bundle: 20 }[route]!);
    }
    for (const [i, x] of roots.entries()) for (const [j, y] of roots.entries()) if (i < j) expect(inside(x, y) || inside(y, x), `${x} / ${y}`).toBe(false);
    expect(briefOf('skill').pins.corpus.sha256).toBe(hexOf(path.join(checkout, 'registry', 'quality', 'skill-boilerplate-corpus.txt')));
  });

  for (const route of ['skill', 'contract', 'bundle'] as const) {
    it(`passes the installed ${route} preflight with a task assembled from the brief`, () => {
      const { file } = writeTask(route);
      const result = runNode([checkerOf(route), '--job', file], { cwd: workRoot });
      expect(result.status, result.stdout + result.stderr).toBe(0);
      const line = JSON.parse(result.stdout.trim().split(/\r?\n/).pop()!) as Json;
      expect(line).toMatchObject({ phase: 'preflight', acceptedDraft: false });
      expect(line.taskDigest).toMatch(/^[0-9a-f]{64}$/);
      tidy();
    }, TIMEOUT);
  }

  it('lets the Bundle proposal the brief describes pass bundle-check against the registry of the checkout, then the postflight', async () => {
    const { domainProposal, rebind, serialize } = await import('./helpers/bundle-proposal.js');
    const { file, brief } = writeTask('bundle');
    const proposal = domainProposal();
    const oldName = Object.keys(proposal.manifest.bundles)[0]!;
    const b = brief.bundle as Json;
    proposal.manifest.bundles = { [b.name]: { ...proposal.manifest.bundles[oldName], name: b.name, version: b.version, status: b.status, domain: b.domain, category: b.category, description: b.description, tier: b.tier, agents: b.agents, skills: b.skills } };
    rebind(proposal);
    proposal.leader = proposal.leader.split(oldName).join(b.name);
    proposal.report.job = { id: brief.id, operation: 'create', template: 'domain', bundle: b.name };
    // The brief names no bundle the registry already has, and each shared Skill once.
    const registry = path.join(checkout, 'registry');
    expect(Object.keys((readJson(path.join(registry, 'bundles.json')) as Json).bundles)).not.toContain(b.name);
    for (const shared of ['host-agent-router', 'handoff', 'git-guardrails']) expect((b.skills as string[]).filter(skill => skill === shared)).toHaveLength(1);
    fs.mkdirSync(brief.roots.draft, { recursive: true });
    for (const [rel, text] of Object.entries(serialize(proposal))) fs.writeFileSync(path.join(brief.roots.draft, rel), text);
    const check = runNode([cli, 'bundle-check', '--artifact', brief.roots.draft, '--registry', registry, '--operation', 'create'], { cwd: workRoot });
    expect(check.status, check.stdout + check.stderr).toBe(0);
    // The fork's helper and the postflight accept the same files.
    const helper = runNode([path.join(s3(), '.claude', 'skills', 'author-bundle', 'scripts', 'bundle-return.mjs'), '--job', file], { cwd: workRoot });
    written.push(path.join(brief.roots.producer, 'bundle-return.json'));
    expect(helper.status, helper.stdout + helper.stderr).toBe(0);
    const post = runNode([checkerOf('bundle'), '--job', file, '--result', path.join(brief.roots.producer, 'bundle-return.json')], { cwd: workRoot });
    expect(post.status, post.stdout + post.stderr).toBe(0);
    expect(JSON.parse(post.stdout.trim().split(/\r?\n/).pop()!)).toMatchObject({ phase: 'postflight', returnStatus: 'draft' });
    tidy();
  }, TIMEOUT);

  /**
   * The Skill route as the brief describes it, run offline the way a compliant fork would: the real installed draft.mjs writes the
   * files that references/quality.md names, the real installed checker checks task and return, and the built CLI runs skill-check
   * with the brief's policy and corpus. No Host starts.
   */
  const runSkillRoute = (withEvals: boolean): { pre: any; post: any; skillCheck: any; draft: string; policy: string } => {
    tidy();
    const { file, task, brief } = writeTask('skill');
    const pre = runNode([checkerOf('skill'), '--job', file], { cwd: workRoot });
    expect(pre.status, pre.stdout + pre.stderr).toBe(0);
    const pin = (target: string): Json => { const bytes = fs.readFileSync(target); return { path: target, bytes: bytes.length, sha256: sha256(bytes) }; };
    const entry = [
      '---', `name: ${brief.id}`,
      'description: "Use when a short plain-text note needs a check; trigger phrases: check this note, review my note format. Skip long documents and anything that is not a note."',
      'metadata:', '  author: Proof Fixture', '  version: "1.0.0"', '  license: MIT', '---', '',
      '# Note format check', '',
      '## Overview & Purpose', 'Tell a writer whether a short plain-text note has a one-line title, a date line and a next step.', '',
      '## Execution Triggers', 'A user pastes a short note and asks whether it is complete.', '',
      '## Input/Output Requirements', 'Input is the note text. Output is one line per check, each marked ok or missing, plus the evidence line quoted from the note.', '',
      '## Step-by-Step Runbook',
      '1. Confirm the first line is a one-line title.',
      '2. Confirm a date line follows the title.',
      '3. Confirm the note ends with one next step.',
      '4. Hand off to the writer with the missing parts named.', '',
      '## Code & Config Exemplars', 'Read [the worked example](examples/note.md) before checking a note.', '',
      '## Edge Cases & Error Recovery', 'An empty note has no title: say so and stop.',
      'Anti-patterns: rewriting the note for the writer; accepting a date that sits inside a paragraph.', '',
      '## Verification Checklist', '- Each of the three checks is reported once.', '- The evidence line is quoted, not paraphrased.', '',
    ].join('\n');
    const evals = {
      skill_name: brief.id,
      evals: [
        { id: 1, prompt: 'Here is my note: "Standup 12 May. Next step: email Dana." Does it have a title, a date line and a next step?', expected_output: 'The reply names the three checks, says the date line is misplaced or missing a proper line, and keeps the next step.' },
        { id: 2, prompt: 'Check this note for me: a title line, then a date line, then two paragraphs, and no action at the end.', expected_output: 'The reply finds the title and the date line, and reports that the note has no next step at the end.' },
      ],
    };
    const changes: Record<string, string> = {
      'SKILL.md': entry,
      'examples/note.md': '# Worked example\n\nNote: "Budget sync" / "2026-05-12" / "Next step: send the figures to Dana."\nResult: title ok, date ok, next step ok.\n',
      ...(withEvals ? { 'evals/evals.json': `${JSON.stringify(evals, null, 2)}\n` } : {}),
    };
    const job = { ...task.draftJobTemplate, changes };
    const producer: string = brief.roots.producer;
    const jobFile = path.join(producer, 'draft-job.json');
    fs.writeFileSync(jobFile, JSON.stringify(job, null, 2));
    const helper = runNode([brief.loading.requiredFiles.find((item: string) => item.endsWith('draft.mjs'))!, jobFile], { cwd: workRoot });
    expect(helper.status, helper.stdout + helper.stderr).toBe(0);
    const stdoutFile = path.join(producer, 'draft.stdout.json'), stderrFile = path.join(producer, 'draft.stderr.txt'), reportFile = path.join(producer, 'report.md');
    fs.writeFileSync(stdoutFile, helper.stdout);
    fs.writeFileSync(stderrFile, helper.stderr);
    fs.writeFileSync(reportFile, 'Fork-authored report (synthetic; the checker only pins it).\n');
    const report = JSON.parse(helper.stdout) as Json;
    const inventory: Json[] = [];
    const visit = (dir: string, prefix: string): void => {
      for (const name of fs.readdirSync(dir).sort()) {
        const full = path.join(dir, name);
        if (fs.statSync(full).isDirectory()) visit(full, `${prefix}${name}/`);
        else { const bytes = fs.readFileSync(full); inventory.push({ path: `${prefix}${name}`, bytes: bytes.length, sha256: sha256(bytes) }); }
      }
    };
    visit(brief.roots.draft, '');
    const returnFile = path.join(producer, 'skill-return.json');
    written.push(jobFile, stdoutFile, stderrFile, reportFile, returnFile);
    fs.writeFileSync(returnFile, JSON.stringify({
      version: 1, kind: 'skill-return', taskId: task.id, taskDigest: digest(canonical(task)), status: 'draft',
      helper: { draftJob: pin(jobFile), stdout: pin(stdoutFile), stderr: pin(stderrFile), exitCode: 0, runs: 1 },
      inventory, changed: report.diff.map((item: Json) => ({ path: item.path, operation: 'create' })), report: pin(reportFile),
      claimedChecks: [], openItems: [], unverified: ['Everything the fork claims is unverified until the caller checks it.'], externalActions: [],
    }, null, 2));
    const post = runNode([checkerOf('skill'), '--job', file, '--result', returnFile], { cwd: workRoot });
    // The brief pins the checkout's corpus file; a CRLF working tree gets the same text with LF line ends, as the reviewed corpus is LF.
    let corpus: string = brief.pins.corpus.path;
    if (fs.readFileSync(corpus, 'utf8').includes('\r')) {
      corpus = path.join(workRoot, 'corpus-lf.txt');
      fs.writeFileSync(corpus, fs.readFileSync(brief.pins.corpus.path, 'utf8').replace(/\r\n/g, '\n'));
    }
    const skillCheck = runNode([cli, 'skill-check', '--artifact', brief.roots.draft, '--corpus', corpus, '--policy', brief.policy], { cwd: workRoot });
    return { pre, post, skillCheck, draft: brief.roots.draft, policy: brief.policy };
  };

  it('accepts the Skill draft of the brief when it carries evals/evals.json: postflight and skill-check exit 0 under the brief\'s policy', () => {
    const brief = briefOf('skill');
    expect(brief.policy).toBe('private-owner');
    expect(brief.provenance.owner).toBe('Proof Fixture');
    expect(brief.draft.allowedPaths).toContain('evals/evals.json');
    expect(brief.draft.roles.map((role: Json) => role.path)).toContain('evals/evals.json');
    const run = runSkillRoute(true);
    expect(run.post.status, run.post.stdout + run.post.stderr).toBe(0);
    expect(JSON.parse(run.post.stdout.trim().split(/\r?\n/).pop()!)).toMatchObject({ phase: 'postflight', acceptedDraft: false });
    expect(fs.existsSync(path.join(run.draft, 'evals', 'evals.json'))).toBe(true);
    expect(run.skillCheck.status, run.skillCheck.stdout + run.skillCheck.stderr).toBe(0);
    tidy();
  }, TIMEOUT);

  it('refuses the same draft without evals/evals.json at postflight (EVALS_MISSING, the brief\'s policy requires it) and fails skill-check with the layout gate\'s message', () => {
    const run = runSkillRoute(false);
    expect(run.post.status, run.post.stdout + run.post.stderr).toBe(1);
    expect(JSON.parse(run.post.stderr.trim().split(/\r?\n/).pop()!)).toMatchObject({ phase: 'postflight', code: 'EVALS_MISSING' });
    expect(fs.existsSync(path.join(run.draft, 'evals'))).toBe(false);
    expect(run.skillCheck.status, run.skillCheck.stdout + run.skillCheck.stderr).toBe(1);
    expect(run.skillCheck.stdout + run.skillCheck.stderr).toContain('evals/evals.json is missing');
    tidy();
  }, TIMEOUT);

  it('leaves the prepared S3 folder exactly as it was after the walk-throughs', () => {
    tidy();
    expect(walkFolder(s3())).toEqual({ files: manifest.scenarios.s3.files, emptyDirectories: manifest.scenarios.s3.emptyDirectories });
  });
});

describe('S4 guards', () => {
  const a = (): string => scenarioDir('s4a-factory-guards');
  const b = (): string => scenarioDir('s4b-readonly-probe');
  const spawnHook = (workspace: string, name: string, input: Json) =>
    spawnSync(process.execPath, [path.join(workspace, '.claude', 'hooks', name)], { cwd: workspace, input: JSON.stringify(input), encoding: 'utf8' });

  it('passes the launcher dry run in both workspaces, the second with its one extra scratch agent', () => {
    for (const dir of [a(), b()]) {
      const dry = runNode([cli, 'start', 'agent-factory', '--host', 'claude', '--dry-run'], { cwd: dir });
      expect(dry.status, dry.stdout + dry.stderr).toBe(0);
    }
    const fa = workspaceEntries(manifest)['s4a-factory-guards']!.files as Record<string, string>;
    const fb = workspaceEntries(manifest)['s4b-readonly-probe']!.files as Record<string, string>;
    expect(Object.keys(fb).filter(rel => !(rel in fa)).sort()).toEqual(['.claude/agents/probe-readonly-worker.md']);
    const differing = Object.keys(fa).filter(rel => fa[rel] !== fb[rel]);
    expect(differing.sort()).toEqual(['.claude/.agents-united/agents-united.json', 'README.md', 'SITTING.md']);
  }, TIMEOUT);

  it('gives the probe agent the shell and file writer tools and the hook of the shipped evaluator', () => {
    const front = (file: string): Json => yaml.parse(/^---\n([\s\S]*?)\n---/.exec(fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n'))![1]!);
    const probe = front(path.join(b(), '.claude', 'agents', 'probe-readonly-worker.md'));
    const evaluator = front(path.join(b(), '.claude', 'agents', 'factory-evaluator.md'));
    expect(probe.hooks).toEqual(evaluator.hooks);
    expect(String(probe.tools).split(/,\s*/)).toEqual(expect.arrayContaining(['Bash', 'Write']));
    expect(String(evaluator.tools)).not.toMatch(/Bash|Write/);
    expect(probe.background).toBe(false);
    expect(String(probe.description)).toMatch(/Not part of the shipped\s+factory/);
  });

  it('refuses, in the installed guard scripts, the commands the instructions tell the maintainer to try, and lets the controls through', () => {
    const text = fs.readFileSync(path.join(destination, 'SITTINGS.md'), 'utf8');
    const prompt = /Run these five commands[^\n]*?: (1\) [^\n]*)/.exec(text);
    expect(prompt, 'step 2 prompt not found').not.toBeNull();
    const commands = [...prompt![1]!.matchAll(/\d\) (.+?)(?=\s{2}\d\) |$)/g)].map(match => match[1]!.trim());
    expect(commands).toEqual(['echo git push --force', 'echo x > .env.probe', 'echo git push --force-with-lease', 'echo x > .env.example', 'echo hello world']);
    const results = commands.map(command => spawnHook(a(), 'agents-united-guard.js', { tool_name: 'Bash', tool_input: { command } }));
    expect(results.map(result => result.status)).toEqual([2, 2, 0, 0, 0]);
    expect(results[0]!.stderr).toMatch(/^Blocked by agents-united guard: git push --force/);
    expect(results[1]!.stderr).toMatch(/^Blocked by agents-united guard: a \.env write/);
    expect(spawnHook(a(), 'agents-united-guard.js', { tool_name: 'Write', tool_input: { file_path: path.join(a(), '.env.probe') } }).status).toBe(2);
    expect(spawnHook(a(), 'agents-united-guard.js', { tool_name: 'Write', tool_input: { file_path: path.join(a(), '.env.example') } }).status).toBe(0);
    // The worker step: the realizer's first command is the same refused one, its second a control.
    expect(text).toContain('first echo git push --force, then echo hello-realizer');
    expect(spawnHook(a(), 'agents-united-guard.js', { tool_name: 'Bash', tool_input: { command: 'echo hello-realizer' } }).status).toBe(0);
    // The read-only guard of part B refuses the two calls the probe is asked for, and lets a read through.
    const write = spawnHook(b(), 'agents-united-readonly-guard.js', { tool_name: 'Write', tool_input: { file_path: path.join(b(), 'probe-pwned.txt'), content: 'pwned' } });
    const shell = spawnHook(b(), 'agents-united-readonly-guard.js', { tool_name: 'Bash', tool_input: { command: 'echo hello' } });
    expect([write.status, shell.status]).toEqual([2, 2]);
    expect(write.stderr).toMatch(/^Blocked by agents-united read-only guard: Write would change state/);
    expect(spawnHook(b(), 'agents-united-readonly-guard.js', { tool_name: 'Read', tool_input: { file_path: path.join(b(), 'README.md') } }).status).toBe(0);
    expect(text).toContain('create a file named probe-pwned.txt that contains the word pwned');
  });

  it('never edits or deletes a guard at preparation time: every guard script is as the checkout has it, and none was renamed', () => {
    for (const workspace of [a(), b()]) {
      for (const name of ['agents-united-guard.js', 'agents-united-readonly-guard.js']) {
        const installed = fs.readFileSync(path.join(workspace, '.claude', 'hooks', name), 'utf8').replace(/\r\n/g, '\n').replace(/\/\/ managed-by: agents-united[^\n]*\n?$/, '').trimEnd();
        const source = fs.readFileSync(path.join(checkout, 'registry', 'hosts', 'claude', 'hooks', name), 'utf8').replace(/\r\n/g, '\n').trimEnd();
        expect(installed, `${workspace} ${name}`).toBe(source);
      }
      expect(fs.existsSync(path.join(workspace, '.claude', 'hooks', 'agents-united-guard.js.off'))).toBe(false);
    }
  });
});

describe('S5 workspaces and prompts', () => {
  const dirs = { with: 's5-with', without: 's5-without', control: 's5-control' };
  const ignore = new Set(['.claude/.agents-united/agents-united.json', 'README.md']);
  const filesOf = (name: string): Record<string, string> => Object.fromEntries(Object.entries(workspaceEntries(manifest)[name]!.files as Record<string, string>).filter(([rel]) => !ignore.has(rel)));

  it('differs exactly as stated: without lacks the installed author-skill folder, control is the same install as with', () => {
    const withFiles = filesOf(dirs.with), withoutFiles = filesOf(dirs.without), controlFiles = filesOf(dirs.control);
    expect(controlFiles).toEqual(withFiles);
    const removed = Object.keys(withFiles).filter(rel => !(rel in withoutFiles));
    expect(removed.length).toBe(9);
    expect(removed.every(rel => rel.startsWith('.claude/skills/author-skill/'))).toBe(true);
    expect(fs.existsSync(path.join(scenarioDir(dirs.without), '.claude', 'skills', 'author-skill'))).toBe(false);
    expect(fs.existsSync(path.join(scenarioDir(dirs.with), '.claude', 'skills', 'author-skill', 'SKILL.md'))).toBe(true);
    expect(Object.keys(withoutFiles).filter(rel => !(rel in withFiles))).toEqual([]);
    for (const rel of Object.keys(withoutFiles)) expect(withoutFiles[rel], rel).toBe(withFiles[rel]);
    for (const name of Object.values(dirs)) expect(git(scenarioDir(name), ['rev-list', '--count', 'HEAD']).trim()).toBe('1');
  });

  it('has prompts for with and without that are byte-identical, and none of the three names the Skill', () => {
    const read = (name: string): Buffer => fs.readFileSync(path.join(destination, 'prompts', name));
    expect(read('s5-with.txt').equals(read('s5-without.txt'))).toBe(true);
    for (const name of ['s5-with.txt', 's5-without.txt', 's5-control.txt']) {
      const bytes = read(name);
      expect(bytes.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf])), name).toBe(false);
      const text = bytes.toString('utf8');
      expect(text, name).not.toContain('\r');
      expect(text, name).not.toMatch(/author-skill|author-|coordinate-artifact|factory|\/author/i);
      expect(text, name).not.toMatch(/[A-Za-z]:\\|(^|\s)\//);
    }
    const task = read('s5-with.txt').toString('utf8');
    expect(task).toMatch(/skill-draft\/note-format-check/);
    expect(task).toMatch(/do not install it, publish it, commit it/);
    expect(read('s5-control.txt').toString('utf8')).not.toMatch(/\bskill\b/i);
    expect(manifest.scenarios.s5.suggestedRuns['s5-with'].cwd).toBe(scenarioDir('s5-with'));
  });
});

describe('S6 probe skill', () => {
  it('is a plain git repository with one scratch Skill, no factory install, and valid frontmatter for a scratch Skill', async () => {
    const dir = scenarioDir('s6-skill-args');
    const { KNOWN_KEYS, DESCRIPTION_MAX_CHARS, LISTING_MAX_CHARS, SKILL_MD_MAX_LINES } = await import('../src/core/skill-layout.js');
    expect(git(dir, ['rev-list', '--count', 'HEAD']).trim()).toBe('1');
    expect(fs.existsSync(path.join(dir, '.claude', 'agents'))).toBe(false);
    expect(fs.existsSync(path.join(dir, '.claude', 'hooks'))).toBe(false);
    expect(fs.readdirSync(path.join(dir, '.claude', 'skills'))).toEqual(['probe-args']);
    const text = fs.readFileSync(path.join(dir, '.claude', 'skills', 'probe-args', 'SKILL.md'), 'utf8').replace(/\r\n/g, '\n');
    const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text);
    expect(match).not.toBeNull();
    const meta = yaml.parse(match![1]!) as Json;
    for (const key of Object.keys(meta)) expect(KNOWN_KEYS.has(key), key).toBe(true);
    expect(meta.name).toBe('probe-args');
    expect(String(meta.description).length).toBeLessThanOrEqual(DESCRIPTION_MAX_CHARS);
    expect(String(meta.description).length).toBeLessThanOrEqual(LISTING_MAX_CHARS);
    expect(meta['disable-model-invocation']).toBeUndefined();
    expect(meta['user-invocable']).toBeUndefined();
    expect(text.split('\n').length).toBeLessThan(SKILL_MD_MAX_LINES);
    expect(match![2]).toContain('$ARGUMENTS');
    expect(match![2]).toContain('probe-args-output.txt');
    expect(workspaceEntries(manifest)['s6-skill-args']!.files).toHaveProperty(['.claude/skills/probe-args/SKILL.md']);
  });
});

describe('the sitting instructions', () => {
  const fenceRe = /```(\w+)\n([\s\S]*?)\n```/g;
  const read = (): string => fs.readFileSync(path.join(destination, 'SITTINGS.md'), 'utf8');
  const normalize = (value: string): string => (process.platform === 'win32' ? path.normalize(value).toLowerCase() : path.normalize(value));

  it('is UTF-8 without a byte-order mark and with LF line ends, and the manifest records its hash', () => {
    const bytes = fs.readFileSync(path.join(destination, 'SITTINGS.md'));
    expect(bytes.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]))).toBe(false);
    expect(new TextDecoder('utf-8', { fatal: true }).decode(bytes)).not.toContain('\r');
    expect(manifest.sittings.sha256).toBe(sha256(bytes));
  });

  it('has the sittings in the order S6, S4, S3, each with the parts a reader needs', () => {
    const text = read();
    const at = ['(S6)', '(S4)', '(S3)'].map(tag => text.indexOf(tag));
    expect(at.every(index => index > 0)).toBe(true);
    expect([...at].sort((x, y) => x - y)).toEqual(at);
    for (const label of ['**What it shows:**', '**Bound:**', '### Before you start', '**Paste back to the Plan 033 session:**', 'Paste this:']) expect(text, label).toContain(label);
    expect(text).toMatch(/at most 2 prompts/);
    expect(text).toMatch(/at most 5 prompts/);
    expect(text).toMatch(/at most 7 prompts/);
    const steps = (text.match(/^### Step \d+/gm) ?? []).length;
    expect((text.match(/\*\*You should see:\*\*/g) ?? []).length).toBe(steps);
    expect((text.match(/\*\*If not:\*\*/g) ?? []).length).toBe(steps);
    expect(steps).toBe(2 + 7 + 2 + 6);
    expect((text.match(/session id/g) ?? []).length).toBeGreaterThanOrEqual(4);
    expect(text).toMatch(/\/status/);
    expect(text).toMatch(/\.jsonl/);
  });

  it('names only paths that exist after preparation in its commands, and no placeholder remains', () => {
    const text = read();
    expect(text).not.toMatch(/<[A-Za-z][^>\n]*>|TODO|TBD|XXX|\{\{|\bABS\b|REPLACE/);
    const future = new Set<string>((manifest.sittings.futurePaths as string[]).map(normalize));
    const pattern = process.platform === 'win32' ? /(?<![\w$])[A-Za-z]:\/[^"'\s]+/g : /(?<![\w$.~-])\/[\w./-]+/g;
    let checked = 0;
    for (const match of text.matchAll(fenceRe)) {
      if (!['bash', 'powershell'].includes(match[1]!)) continue;
      for (const token of match[2]!.match(pattern) ?? []) {
        const native = normalize(token.replace(/\/$/, ''));
        checked += 1;
        expect(fs.existsSync(native) || future.has(native), `a command names a path that does not exist after preparation: ${token}`).toBe(true);
      }
    }
    expect(checked).toBeGreaterThan(10);
    // The rename of the guard script: the source exists now, the target is only the name this sitting gives it.
    const renames = [...text.matchAll(/mv "([^"]+)" "([^"]+)"/g)];
    expect(renames).toHaveLength(2);
    expect(fs.existsSync(normalize(renames[0]![1]!))).toBe(true);
    expect(renames[0]![2]).toBe(`${renames[0]![1]}.off`);
    expect([renames[1]![1], renames[1]![2]]).toEqual([renames[0]![2], renames[0]![1]]);
  });

  it('carries the typed lines the routes expect and the commands to start each session, and tells nobody to skip a check', () => {
    const text = read();
    for (const route of ['skill', 'contract', 'bundle']) {
      const evidence = readJson(path.join(scenarioDir('s3-typed-forks'), 'work', route, 'brief.json')).roots.evidence as string;
      expect(text).toContain(`/author-${route} ${path.join(evidence, `${route}-task.json`)}`);
    }
    // The launcher turns agent teams off for the factory's own session, so the sittings start it plainly (the same command in Git Bash and PowerShell).
    const plain = `node "${cli.replace(/\\/g, '/')}" start agent-factory --host claude`;
    expect(text.split(plain).length - 1).toBe(2);
    expect(text).not.toContain('env -u');
    expect(text).not.toContain('Remove-Item');
    // The only PowerShell fence is the session-id command (P19); every launcher command stays one form.
    const psOpen = text.match(/```powershell/g) ?? [];
    const psFences = [...text.matchAll(/```powershell\n([^\n]*)\n```/g)].map(m => m[1]!);
    expect(psOpen.length).toBeGreaterThan(0);
    expect(psFences).toHaveLength(psOpen.length);
    for (const line of psFences) {
      expect(line.startsWith('Get-ChildItem "$HOME\\.claude\\projects\\')).toBe(true);
      expect(line.endsWith('| Sort-Object LastWriteTime -Descending | Select-Object -First 3 Name')).toBe(true);
    }
    expect(text.split('In PowerShell use this instead:').length - 1).toBe(psFences.length);
    expect(text).not.toMatch(/launcher refuses/);
    // P22: the launcher no longer touches fork mode, so the sittings name only the agent-teams switch.
    expect(text.split('The launcher turns agent teams off for this session by itself.').length - 1).toBe(2);
    expect(text).not.toContain('The launcher turns agent teams and fork mode off for this session by itself.');
    expect(text).not.toMatch(/fork mode off/);
    expect(text).not.toContain('The only command that differs in PowerShell');
    expect(text).toMatch(/```bash\nclaude --model sonnet --effort low\n```/);
    expect(text).not.toMatch(/\b(skip|skipping|bypass|ignore|omit|disable|waive)\b/i);
    expect(text).not.toMatch(/--dangerously-skip-permissions/);
  });

  it('is split per sitting into the workspaces, each file made of blocks that are in the full text', () => {
    const full = read();
    for (const name of ['s6-skill-args', 's4a-factory-guards', 's4b-readonly-probe', 's3-typed-forks']) {
      const own = fs.readFileSync(path.join(scenarioDir(name), 'SITTING.md'), 'utf8');
      expect(own, name).not.toContain('\r');
      expect(own.length, name).toBeGreaterThan(500);
      expect(own).toMatch(/\*\*Paste back to the Plan 033 session:\*\*/);
      for (const match of own.matchAll(fenceRe)) expect(full, `${name}: ${match[2]}`).toContain(match[0]);
      expect(own).toContain(scenarioDir(name).replace(/\\/g, '/'));
    }
    for (const name of ['s0-launcher', 's1-coord-realize', 's2-sync', 's5-with', 's5-without', 's5-control']) expect(fs.existsSync(path.join(scenarioDir(name), 'SITTING.md')), name).toBe(false);
  });

  // The guards sitting observes the agent-teams switch live in its first step, and the typed-routes sitting first asks what is already in the context.
  it('observes the agent-teams switch in step 0 of part A and the Skill text in step 0 of the typed routes, before any other step', () => {
    const text = read();
    const from = (heading: RegExp): string => text.slice(text.search(heading));
    const stepAt = (block: string, n: number): string => block.slice(block.indexOf(`### Step ${n}`), block.indexOf(`### Step ${n + 1}`));
    const partA = from(/^### Part A/m);
    const zeroA = stepAt(partA, 0);
    expect(partA.indexOf('### Step 0')).toBeGreaterThan(0);
    expect(partA.indexOf('### Step 0')).toBeLessThan(partA.indexOf('### Step 1'));
    expect(zeroA).toContain('Run exactly one command with your shell tool and report the tool result word for word. If your shell tool is Bash, run: echo "TEAMS=[$CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS] FORK=[$CLAUDE_CODE_FORK_SUBAGENT]" If it is PowerShell, run: Write-Output "TEAMS=[$env:CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS] FORK=[$env:CLAUDE_CODE_FORK_SUBAGENT]"');
    // P22: step 0 still prints both variables; only TEAMS=[0] is expected, and FORK is whatever the user's own settings give.
    expect(zeroA).toContain('**You should see:** `TEAMS=[0]`, then `FORK=[...]` with whatever your own settings give for fork mode (an empty bracket when it is not set). The launcher no longer touches fork mode, so no `FORK` value is a failure.');
    expect(zeroA).toContain('**If not:** write down the line that was printed (an empty bracket means the variable is not set; `TEAMS=[1]` or `TEAMS=[]` means agent teams were not turned off) and go on; do not paste it again.');
    expect(zeroA).not.toContain('FORK=[0]`');
    expect(stepAt(partA, 1)).toContain('/hooks');
    // The position is pinned, not only the presence: the second item of part A's list, right after the session id, as in the typed routes.
    const backA = partA.slice(partA.indexOf('**Paste back to the Plan 033 session:**')).split('\n').filter(line => line.startsWith('- '));
    expect(backA[0]).toBe('- the session id (how to find it is above);');
    expect(backA[1]).toBe('- the line printed in step 0 (it starts `TEAMS=`), copied exactly;');
    expect(backA.filter(line => line.includes('TEAMS='))).toHaveLength(1);
    expect(text).toContain('The command that starts the coordinator through the launcher is the same in PowerShell.');
    // The per-workspace files carry the same Step 0 as the full text.
    for (const [name, marker] of [['s4a-factory-guards', 'TEAMS=[$CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS] FORK=[$CLAUDE_CODE_FORK_SUBAGENT]'], ['s3-typed-forks', 'is the text of a Skill named coordinate-artifact already in your context']] as const) {
      const own = fs.readFileSync(path.join(scenarioDir(name), 'SITTING.md'), 'utf8');
      expect(own.indexOf('### Step 0'), name).toBeGreaterThan(0);
      expect(own.indexOf('### Step 0'), name).toBeLessThan(own.indexOf('### Step 1'));
      expect(own.slice(own.indexOf('### Step 0'), own.indexOf('### Step 1')), name).toContain(marker);
    }
    // P22: part A has four pasted prompts (steps 0, 2, 3 and 5) and part B one; the extra fallback prompt of P19 is gone.
    expect(text).toContain('**Bound:** at most 5 prompts in all (4 in the first part, 1 in the second).');
    const pasted = (block: string): number => (block.match(/^Paste this:$/gm) ?? []).length;
    expect(pasted(partA.slice(0, partA.indexOf('### Part B')))).toBe(4);
    // P22: step 3 of part A starts the realizer, waits for its hand-back, reports it and only then starts the evaluator; a refusal of the background worker or two workers at once is the finding.
    const threeA = stepAt(partA, 3);
    expect(threeA).toContain('Start the factory-realizer subagent. Tell it, as its only task,');
    expect(threeA).toContain('When its result has come back, report it word for word, and only then start the factory-evaluator subagent');
    expect(threeA).toContain('The coordinator starts factory-realizer and says in one line that it runs, then ends its turn. Type nothing: the realizer\'s hand-back arrives later by itself');
    expect(threeA).toContain('The coordinator reports it and only then starts factory-evaluator, whose answer arrives the same way');
    expect(threeA).toContain('If the coordinator refuses to wait for a worker that runs in the background, or starts both workers at once, write that down: it is the finding. Do not paste another prompt.');
    expect(threeA).not.toMatch(/in the foreground \(not in the background\)/);
    expect(threeA).not.toContain("Wait for the background worker's result");
    expect(threeA).not.toContain('extra prompt');
    // P23 part 2: the probe steps hold no job, so the prompt gives the caller-held digest as a token and the answer names it.
    expect(threeA).toContain('The digest you hold for this probe is PROBE-1: tell factory-realizer to repeat PROBE-1 in its answer.');
    expect(threeA).toContain('the digest you hold is PROBE-2: tell factory-evaluator to repeat PROBE-2 in its answer.');
    expect(threeA).toContain('it names the token `PROBE-1`');
    expect(threeA).toContain('it names the token `PROBE-2`');
    expect(backA).toContain('- yes or no: did the coordinator start a worker named factory-evaluator at all?');
    expect(backA).toContain('- what did the evaluator answer about its shell and file writer (one line, or say it never ran)?');
    expect(backA).toContain('- yes or no: did the coordinator say in one line that factory-realizer runs, and report its hand-back before it started factory-evaluator?');
    expect(backA).toContain('- yes or no: did the coordinator refuse a worker that ran in the background, or start both workers at once?');
    expect(backA).not.toContain('- yes or no: did the coordinator say a worker ran in the background?');
    // The plain session that starts the probe worker keeps its prompt, but its "You should see" promises no foreground.
    const oneB = stepAt(from(/^### Part B/m), 1);
    expect(oneB).toContain('Start the subagent named probe-readonly-worker');
    expect(oneB.slice(oneB.indexOf('**You should see:**'))).not.toMatch(/foreground/);
    expect(oneB).toContain('A plain session may run the worker in the background; its answer then arrives by itself a little later');
    expect(oneB).toContain('If Claude asks whether to wait, type: Wait for its result and report it word for word.');
    // The typed-routes sitting keeps the foreground wording for the typed forks only; its evaluator step follows the waiting rule.
    const routesText = from(/^## Sitting 3/m);
    expect(stepAt(routesText, 2)).toContain('It runs in the foreground: you wait for it.');
    const fiveRoutes = routesText.slice(routesText.indexOf('### Step 5'));
    expect(fiveRoutes).toContain('start the independent evaluator, and wait for each evaluator\'s result before its next check');
    expect(fiveRoutes).not.toMatch(/evaluator in the foreground/);
    expect(backA).not.toContain('- yes or no: did the evaluator say it holds no shell and no file writer?');
    expect(text).toContain('Get-ChildItem "$HOME\\.claude\\projects\\');
    expect(text).toContain('| Sort-Object LastWriteTime -Descending | Select-Object -First 3 Name');
    const routes = from(/^## Sitting 3/m);
    const zeroRoutes = stepAt(routes, 0);
    expect(routes.indexOf('### Step 0')).toBeGreaterThan(0);
    expect(routes.indexOf('### Step 0')).toBeLessThan(routes.indexOf('### Step 1'));
    expect(zeroRoutes).toContain('Before you read any file or call any tool, answer two things. One: is the text of a Skill named coordinate-artifact already in your context, yes or no? Two: if yes, quote the first heading line of that Skill exactly as it stands; if no, say so and quote nothing. Do not open any file to answer.');
    expect(zeroRoutes).toContain('**You should see:** a short answer with yes or no and, for yes, one quoted heading line; no tool call.');
    expect(zeroRoutes).toContain('**If not:** if Claude reads a file or calls a tool before answering, do not repeat the question; note that it did and go on to Step 1.');
    expect(text).toContain('**Bound:** at most 7 prompts (1 + 1 + 3 + 1, one spare).');
    const back = routes.slice(routes.indexOf('**Paste back to the Plan 033 session:**')).split('\n').filter(line => line.startsWith('- '));
    expect(back[0]).toBe('- the session id (how to find it is above);');
    expect(back[1]).toBe('- the answer to Step 0, copied exactly, and yes or no: did Claude call a tool before answering it?');
  });

  it('keeps every expected result out of the scenario folders and the instructions', () => {
    const visit = (dir: string, prefix = ''): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
      if (!prefix && (entry.name === '.git' || entry.name === '.claude')) return [];
      return entry.isDirectory() ? visit(path.join(dir, entry.name), `${prefix}${entry.name}/`) : [path.join(dir, entry.name)];
    });
    for (const name of Object.keys(workspaceEntries(manifest))) {
      for (const file of visit(scenarioDir(name))) expect(fs.readFileSync(file, 'utf8'), file).not.toMatch(/"expected"|answer key|"unaffected"/);
    }
    expect(read()).not.toMatch(/"expected"|answer key|proof-agent/);
    if (!realS2Unavailable) expect(Object.keys(manifest.scenarios.s2.expected)).toEqual(['affected', 'unaffected']);
  });
});
