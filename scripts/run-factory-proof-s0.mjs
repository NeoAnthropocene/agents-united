// Original agents-united helper; MIT licensed. Runs proof scenario S0 on a prepared s0-launcher workspace: the Claude start dry run of the
// installed agent factory, its refused flags and two tampered installs. It never starts Claude or any other Host and never uses the network.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';

const USAGE = 'Usage: node scripts/run-factory-proof-s0.mjs --workspace ABS --cli ABS --out ABS';
const GUARD = '.claude/hooks/agents-united-guard.js';
const COORDINATOR = '.claude/skills/coordinate-artifact';
// The wording below is the launcher's own: src/cli.ts (runClaudeStart) and src/core/claude-factory-start.ts.
const FLAG_REFUSAL = ['Claude factory startup supports only foreground project native sessions', '--bg, --global, --plugin and --teams are unavailable, including dry-run'];
const DRY_RUN_DONE = 'Dry run complete. No processes launched.';

class Refusal extends Error {}
const refuse = message => { throw new Refusal(message); };
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const fold = value => (process.platform === 'win32' ? path.resolve(value).toLowerCase() : path.resolve(value));
const inside = (parent, child) => {
  const rel = path.relative(fold(parent), fold(child));
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel));
};
const stripAnsi = text => String(text ?? '').replace(/\x1b\[[0-9;]*[A-Za-z]/g, '');

/** No Claude executable on PATH (a start dry run would run `claude --version`), no teams opt-in, no colour. */
function cleanEnv() {
  const env = { ...process.env };
  const key = Object.keys(env).find(name => name.toLowerCase() === 'path') ?? 'PATH';
  const names = process.platform === 'win32' ? ['claude', 'claude.cmd', 'claude.bat', 'claude.exe', 'claude.ps1'] : ['claude'];
  env[key] = (env[key] ?? '').split(path.delimiter).filter(dir => !dir || !names.some(name => fs.existsSync(path.join(dir, name)))).join(path.delimiter);
  delete env.CLAUDE_BIN_PATH;
  delete env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS;
  env.NO_COLOR = '1';
  return env;
}

function assertNoLinks(target, label) {
  let current = path.parse(target).root;
  for (const part of target.slice(current.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    const stat = fs.lstatSync(current, { throwIfNoEntry: false });
    if (!stat) return;
    if (stat.isSymbolicLink()) refuse(`${label} has a link on the way: ${current}`);
  }
}

function parseArguments() {
  const argv = process.argv.slice(2);
  for (const flag of ['workspace', 'cli', 'out']) {
    if (argv.filter(arg => arg === `--${flag}` || arg.startsWith(`--${flag}=`)).length > 1) refuse(`Duplicate --${flag}.\n${USAGE}`);
  }
  let values;
  try {
    ({ values } = parseArgs({ args: argv, options: { workspace: { type: 'string' }, cli: { type: 'string' }, out: { type: 'string' } }, strict: true, allowPositionals: false }));
  } catch (error) { refuse(`${error.message}\n${USAGE}`); }
  if (!values.workspace || !values.cli || !values.out) refuse(USAGE);
  for (const [label, value] of [['--workspace', values.workspace], ['--cli', values.cli], ['--out', values.out]]) {
    if (!path.isAbsolute(value)) refuse(`All supplied paths must be absolute (${label}).`);
  }
  const workspace = path.resolve(values.workspace), cli = path.resolve(values.cli), out = path.resolve(values.out);
  assertNoLinks(workspace, 'Workspace');
  if (!fs.statSync(workspace, { throwIfNoEntry: false })?.isDirectory()) refuse('Workspace must be an existing folder.');
  if (fs.realpathSync(workspace) !== workspace) refuse(`Workspace is not a physical path; use ${fs.realpathSync(workspace)}.`);
  assertNoLinks(cli, 'CLI');
  if (!fs.lstatSync(cli, { throwIfNoEntry: false })?.isFile()) refuse('CLI must be an existing regular file.');
  if (fs.lstatSync(out, { throwIfNoEntry: false })) refuse('Result file must not exist.');
  if (inside(workspace, out)) refuse('Result file must be outside the workspace.');
  assertNoLinks(path.dirname(out), 'Result folder');
  if (!fs.statSync(path.dirname(out), { throwIfNoEntry: false })?.isDirectory()) refuse('The folder of the result file must exist.');
  return { workspace, cli, out };
}

/** SHA-256 of every regular file under a folder except the top-level .git; the type is read before any read. */
function walk(root) {
  const files = {}, emptyDirectories = [];
  const visit = (dir, prefix) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    if (entries.length === 0 && prefix) emptyDirectories.push(prefix.slice(0, -1));
    for (const entry of entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
      if (!prefix && entry.name === '.git') continue;
      const rel = `${prefix}${entry.name}`, file = path.join(dir, entry.name), stat = fs.lstatSync(file);
      if (stat.isSymbolicLink()) refuse(`A link is in the workspace: ${rel}`);
      if (stat.isDirectory()) visit(file, `${rel}/`);
      else if (stat.isFile()) files[rel] = sha256(fs.readFileSync(file));
      else refuse(`A special file is in the workspace: ${rel}`);
    }
  };
  visit(root, '');
  return { files, emptyDirectories };
}
const sameTree = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const treeDifferences = (expected, actual) => {
  const names = [...new Set([...Object.keys(expected.files), ...Object.keys(actual.files)])].sort();
  return names.filter(name => expected.files[name] !== actual.files[name]);
};

function gitStatus(workspace) {
  const result = spawnSync('git', ['-C', workspace, 'status', '--porcelain'], { encoding: 'utf8', windowsHide: true, env: cleanEnv() });
  return result.status === 0 ? result.stdout : null;
}

function startDryRun(ctx, extra = []) {
  const argv = [process.execPath, ctx.cli, 'start', 'agent-factory', '--host', 'claude', ...extra, '--dry-run'];
  const result = spawnSync(argv[0], argv.slice(1), { cwd: ctx.workspace, env: cleanEnv(), encoding: 'utf8', windowsHide: true, timeout: 120_000, maxBuffer: 16 * 1024 * 1024 });
  const stdout = stripAnsi(result.stdout), stderr = stripAnsi(result.stderr);
  return { argv, exitCode: typeof result.status === 'number' ? result.status : -1, stdout, stderr, text: `${stdout}\n${stderr}`.replace(/\r\n/g, '\n') };
}

/** The line of the output that carries the expected text, without the box-drawing prefix of the prompt library. */
function matchedLine(text, needle) {
  const line = text.split('\n').find(candidate => candidate.includes(needle));
  return line ? line.replace(/^[\s│└├┌◇─╮╯╭╰]+/u, '').replace(/[\s│]+$/u, '') : null;
}
const cut = text => (text.length > 8000 ? `${text.slice(0, 8000)}\n[cut at 8000 characters]` : text);

function runRecord(ctx, extra, expectations, expectNonZero) {
  const run = startDryRun(ctx, extra);
  const matches = expectations.map(needle => ({ needle, line: matchedLine(run.text, needle) }));
  const found = matches.every(match => match.line !== null) || (process.platform === 'win32' && expectations.every(needle => run.text.toLowerCase().includes(needle.toLowerCase())));
  const exitOk = expectNonZero ? run.exitCode !== 0 : run.exitCode === 0;
  return {
    argv: run.argv, cwd: ctx.workspace, exitCode: run.exitCode, expected: expectations, matched: [...new Set(matches.map(match => match.line).filter(Boolean))].join(' | '),
    pass: exitOk && found, stdout: cut(run.stdout), stderr: cut(run.stderr),
  };
}

function runStep(ctx, id, title, body) {
  const step = { id, title, runs: [], restored: false, pass: false };
  try { body(step); } catch (error) { step.error = error instanceof Error ? error.message : String(error); } finally {
    // The body restores in its own finally blocks; the proof is the hash of every file against the state before the run.
    step.restored = sameTree(walk(ctx.workspace), ctx.before);
  }
  step.pass = step.restored && !step.error && step.runs.length > 0 && step.runs.every(run => run.pass);
  return step;
}

function main() {
  const ctx = { ...parseArguments() };
  ctx.before = walk(ctx.workspace);
  const result = {
    version: 1, kind: 'factory-proof-s0-result', ranAt: new Date().toISOString(), hostLaunched: false, workspace: ctx.workspace,
    cli: { path: ctx.cli, sha256: sha256(fs.readFileSync(ctx.cli)) }, node: process.version,
    preflight: { manifestFound: false, matchesManifest: null }, treeSha256: sha256(JSON.stringify(ctx.before)),
    gitStatus: { before: gitStatus(ctx.workspace), after: null }, steps: [], pass: false,
  };
  const finish = (message) => {
    fs.writeFileSync(ctx.out, `${JSON.stringify(result, null, 2)}\n`, { flag: 'wx' });
    console.log(JSON.stringify({ out: ctx.out, pass: result.pass, steps: result.steps.map(step => ({ id: step.id, pass: step.pass })) }));
    if (!result.pass) { console.error(message); process.exitCode = 1; }
  };

  // The prepared state: when the destination holds the manifest of the preparation, the workspace must still match it.
  const manifestPath = path.join(path.dirname(ctx.workspace), 'manifest.json');
  if (fs.lstatSync(manifestPath, { throwIfNoEntry: false })?.isFile()) {
    result.preflight.manifestFound = true;
    let entry;
    try { entry = Object.values(JSON.parse(fs.readFileSync(manifestPath, 'utf8')).scenarios ?? {}).find(item => item.folder && fold(item.folder) === fold(ctx.workspace)); } catch { entry = undefined; }
    if (entry) {
      const differing = treeDifferences(entry, ctx.before);
      result.preflight.matchesManifest = differing.length === 0 && sameTree(entry.emptyDirectories, ctx.before.emptyDirectories);
      if (!result.preflight.matchesManifest) {
        result.preflight.differingFiles = differing.slice(0, 20);
        return finish(`The workspace differs from the manifest of its preparation before any step ran (${differing.slice(0, 5).join(', ') || 'folders'}). It is not the prepared state; prepare a fresh one.`);
      }
    }
  }

  const clean = runStep(ctx, 'clean-dry-run', 'Clean start --dry-run of the installed factory', step => {
    step.runs.push(runRecord(ctx, [], ['[0] --agent', '[1] orchestrator-agent-factory', `[2] --add-dir=${ctx.workspace}`, DRY_RUN_DONE], false));
  });
  result.steps.push(clean);

  const flags = runStep(ctx, 'refused-flags', 'Each flag the launcher refuses for the factory', step => {
    for (const flag of ['--bg', '--global', '--plugin', '--teams']) step.runs.push(runRecord(ctx, [flag], FLAG_REFUSAL, true));
  });
  result.steps.push(flags);

  const guardFile = path.join(ctx.workspace, ...GUARD.split('/'));
  const guard = runStep(ctx, 'tampered-guard', 'One byte appended to the installed guard script', step => {
    const original = fs.readFileSync(guardFile);
    try {
      fs.appendFileSync(guardFile, Buffer.from([0x0a]));
      step.runs.push(runRecord(ctx, [], [`Claude factory startup: edited required file ${GUARD}`], true));
    } finally { fs.writeFileSync(guardFile, original); }
  });
  result.steps.push(guard);

  const support = runStep(ctx, 'deleted-support-file', 'One required support file of the coordinator Skill deleted', step => {
    const receipt = JSON.parse(fs.readFileSync(path.join(ctx.workspace, ...COORDINATOR.split('/'), 'assets', 'claude-binding.json'), 'utf8'));
    const required = Array.isArray(receipt.requiredSupport) ? receipt.requiredSupport.filter(item => typeof item === 'string') : [];
    const chosen = required.includes('references/bundle-authoring.md') ? 'references/bundle-authoring.md' : required.find(item => item.startsWith('references/')) ?? required[0];
    if (!chosen) refuse('The installed coordinator receipt lists no required support file.');
    const rel = `${COORDINATOR}/${chosen}`, file = path.join(ctx.workspace, ...rel.split('/'));
    const original = fs.readFileSync(file);
    try {
      fs.unlinkSync(file);
      step.runs.push(runRecord(ctx, [], [`Claude factory startup: missing or case-colliding required file ${rel}`], true));
    } finally { fs.writeFileSync(file, original); }
  });
  result.steps.push(support);

  result.gitStatus.after = gitStatus(ctx.workspace);
  const gitSame = result.gitStatus.before === result.gitStatus.after;
  result.pass = result.steps.length === 4 && result.steps.every(step => step.pass) && gitSame;
  const failed = result.steps.filter(step => !step.pass).map(step => `Step ${step.id} failed${step.restored ? '' : ' and the workspace was not restored'}: ${step.error ? `error ${step.error}` : step.runs.map(run => `exit ${run.exitCode}, expected ${run.expected.join(' + ')}`).join('; ')}`);
  if (!gitSame) failed.push('git status --porcelain differs before and after.');
  finish(failed.join('\n'));
}

try { main(); } catch (error) {
  console.error(error instanceof Refusal ? error.message : `${error instanceof Error ? error.stack : error}`);
  process.exitCode = 1;
}
