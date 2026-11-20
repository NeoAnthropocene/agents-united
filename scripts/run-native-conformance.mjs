#!/usr/bin/env node
/**
 * ADR 0075 - the conformance run of a native-lane batch before its pull request. Contributor tooling, never installed.
 *
 *   node scripts/run-native-conformance.mjs --manifest <file> --checkout <folder> --hold-file <file> --out <report.json> [--plan]
 *
 * It refuses to start while the hold file exists (the coordinator of a full gate creates and removes it). Otherwise it makes a throwaway
 * worktree of the checkout at the manifest's base, copies the batch's files in, installs, builds, writes the wiring (scripts/native-wiring.mjs),
 * regenerates the native blocks and runs the focused test files the batch touches, one at a time in one serial run: never the whole suite and
 * never the addon lifecycle matrix. `--plan` prints the files it would run and does nothing else.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { checkManifest } from './native-wiring.mjs';

/** The repository tests every role's wiring touches (ADR 0072's rules and the wired files), when they exist. */
const COMMON = [
  'tests/native-claude-agents.test.ts', 'tests/native-install-lane.test.ts', 'tests/cli-e2e.test.ts', 'tests/native-claude-own-session.test.ts',
  'tests/native-invariant-coverage.test.ts', 'tests/core-safety-floor.test.ts', 'tests/claude-session-task-policy.test.ts', 'tests/factory-repository-rules.test.ts',
  'tests/native-roster.test.ts', 'tests/native-conformance.test.ts', 'tests/native-claude-lead-pool.test.ts', 'tests/native-claude-tier1-open-items.test.ts',
  'tests/subagent-comms.test.ts', 'tests/registry.test.ts', 'tests/native-wiring.test.ts',
];

/** The focused test files of a batch: the common set and each role's own test file, those present in the checkout. */
export function conformanceFiles(manifest, checkout) {
  const own = manifest.roles.map(role => `tests/native-claude-${role.role}.test.ts`);
  return [...new Set([...COMMON, ...own])].filter(rel => fs.existsSync(path.join(checkout, rel)));
}

/** The files a batch brings: each role's native file, coverage file, pair and own test file, and each lead's native file. */
function batchFiles(manifest, checkout) {
  const files = [];
  for (const role of manifest.roles) {
    files.push(role.native, role.coverage, `registry/core/${role.definition}.core.md`, `registry/core/${role.definition}.contract.json`, `tests/native-claude-${role.role}.test.ts`);
    if (role.canonical) files.push(role.canonical);
  }
  for (const lead of manifest.leads) files.push(`registry/hosts/claude/agents/${lead.lead}.md`);
  return [...new Set(files)].filter(rel => fs.existsSync(path.join(checkout, rel)));
}

const run = (command, args, cwd, env = {}) => {
  // The agent-teams switch changes what some tests see, so it is removed, not set empty.
  const childEnv = { ...process.env, ...env };
  delete childEnv.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS;
  // npm is a script on Windows, so it runs through the shell as one command line (its arguments here are fixed words).
  const viaShell = process.platform === 'win32' && command === 'npm';
  const result = viaShell
    ? spawnSync([command, ...args].join(' '), { cwd, encoding: 'utf8', env: childEnv, shell: true, maxBuffer: 256 * 1024 * 1024 })
    : spawnSync(command, args, { cwd, encoding: 'utf8', env: childEnv, maxBuffer: 256 * 1024 * 1024 });
  return { exit: result.status, output: `${result.stdout ?? ''}${result.stderr ?? ''}` };
};

function main(argv) {
  const args = { plan: false };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === '--plan') args.plan = true;
    else if (['--manifest', '--checkout', '--hold-file', '--out'].includes(flag)) args[flag.slice(2)] = argv[++i];
    else { process.stderr.write(`Unknown argument ${flag}.\n`); return 2; }
  }
  if (!args['hold-file'] || !args.manifest || !args.checkout || (!args.plan && !args.out)) {
    process.stderr.write('Usage: node scripts/run-native-conformance.mjs --manifest <file> --checkout <folder> --hold-file <file> --out <report.json> [--plan]\n');
    return 2;
  }
  // The hold comes first: while a full gate runs, this run starts nothing at all.
  if (fs.existsSync(path.resolve(args['hold-file']))) {
    process.stderr.write(`Conformance run refused: the hold file ${path.resolve(args['hold-file'])} exists, so a full gate is running. Start again when it is gone.\n`);
    return 3;
  }
  const checkout = path.resolve(args.checkout);
  const manifest = JSON.parse(fs.readFileSync(path.resolve(args.manifest), 'utf8'));
  const problems = checkManifest(manifest, checkout);
  if (problems.length) { process.stderr.write(`The manifest is refused:\n${problems.join('\n')}\n`); return 1; }
  const files = conformanceFiles(manifest, checkout);
  if (args.plan) { process.stdout.write(`${JSON.stringify({ files, batch: batchFiles(manifest, checkout) }, null, 2)}\n`); return 0; }

  const out = path.resolve(args.out);
  const report = { version: 1, manifest: manifest.id, base: manifest.base, steps: [], files: [], promotionCandidates: [] };
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'au-conformance-'));
  const tree = path.join(work, 'tree');
  const step = (name, result) => { report.steps.push({ name, exit: result.exit, output: result.output.slice(-20000) }); return result.exit === 0; };
  try {
    if (!step('worktree', run('git', ['-C', checkout, 'worktree', 'add', '--detach', tree, manifest.base], checkout))) throw new Error('worktree');
    for (const rel of batchFiles(manifest, checkout)) {
      fs.mkdirSync(path.dirname(path.join(tree, rel)), { recursive: true });
      fs.copyFileSync(path.join(checkout, rel), path.join(tree, rel));
    }
    if (!step('npm ci', run('npm', ['ci'], tree))) throw new Error('npm ci');
    if (!step('build', run('npm', ['run', 'build'], tree))) throw new Error('build');
    const manifestCopy = path.join(work, 'manifest.json');
    fs.writeFileSync(manifestCopy, JSON.stringify(manifest));
    // The generator beside this runner, not the base's copy: the base may predate it.
    const generator = path.join(path.dirname(fileURLToPath(import.meta.url)), 'native-wiring.mjs');
    if (!step('wiring', run(process.execPath, [generator, '--manifest', manifestCopy, '--checkout', tree, '--write'], tree))) throw new Error('wiring');
    const vitest = path.join(tree, 'node_modules/vitest/vitest.mjs');
    const env = {};
    if (!step('native blocks', run(process.execPath, [vitest, 'run', 'tests/native-claude-agents.test.ts', '--maxWorkers=1', '--fileParallelism=false'], tree, { ...env, UPDATE_NATIVE: '1' }))) throw new Error('native blocks');
    const own = new Set(manifest.roles.map(role => `tests/native-claude-${role.role}.test.ts`));
    // The files that exist at the base, after the batch's files were copied in.
    for (const rel of conformanceFiles(manifest, tree)) {
      // A gate that starts during the run stops it at the next file.
      if (fs.existsSync(path.resolve(args['hold-file']))) {
        report.files.push({ file: rel, exit: null, failures: ['Not run: the hold file appeared during the run.'] });
        continue;
      }
      const result = run(process.execPath, [vitest, 'run', rel, '--maxWorkers=1', '--fileParallelism=false', '--testTimeout=30000', '--hookTimeout=30000'], tree, env);
      const failures = [...result.output.replace(/\x1b\[[0-9;]*m/g, '').matchAll(/^\s*(?:FAIL|×)\s+(.+)$/gm)].map(match => match[1].trim()).slice(0, 50);
      report.files.push({ file: rel, exit: result.exit, failures });
      // A repository test (not the role's own) that fails after the factory accepted the candidate names a rule the factory does not know yet.
      if (result.exit !== 0 && !own.has(rel)) {
        report.promotionCandidates.push({ file: rel, note: 'A repository test failed that the factory checks did not refuse: a candidate rule for src/core/native-repository-rules.ts (ADR 0072).' });
      }
    }
  } catch {
    // The failed step is in the report.
  } finally {
    run('git', ['-C', checkout, 'worktree', 'remove', '--force', tree], checkout);
    fs.rmSync(work, { recursive: true, force: true });
    fs.writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
  }
  const ok = report.steps.every(item => item.exit === 0) && report.files.every(item => item.exit === 0);
  process.stdout.write(`Conformance run ${ok ? 'passed' : 'failed'}: report ${out}\n`);
  return ok ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2));
