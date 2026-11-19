#!/usr/bin/env node
/**
 * system-specs: collect the machine facts an agent plans against (OS, CPU, memory, GPU, free disk, shells, developer tools)
 * into a small Markdown sheet and a JSON twin. Node 20+, built-ins only.
 *
 *   node specs.mjs collect [--out <path>] [--max-age <hours>] [--refresh] [--json]
 *   node specs.mjs help
 *
 * `collect` writes `.agents-united/system-specs.md` and `.json` beside it (relative to the working folder; `--out` names the
 * Markdown file, the JSON goes next to it). A sheet younger than `--max-age` hours (default 24) is reused unless `--refresh`.
 * `--json` prints the JSON to stdout and writes nothing.
 *
 * Exit codes: 0 the sheet was written, reused or printed; 1 the sheet could not be written; 2 a usage error.
 * A tool that is missing, slow or broken never fails the run: it is reported as "absent" or "not determined".
 *
 * Privacy: the sheet is built from an allowlist (see references/sheet-format.md). It never holds the user name, the machine
 * name, the home folder or any absolute path, an environment value, a git remote, or any account or credential state.
 *
 * Every command and every os/fs read of the collector goes through one `deps` object, so tests run it with a fake runner.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';

export const SCHEMA_VERSION = 1;
export const DEFAULT_OUT = path.join('.agents-united', 'system-specs.md');
export const DEFAULT_MAX_AGE_HOURS = 24;
const DEFAULT_TIMEOUT_MS = 5000;
const SLOW_TIMEOUT_MS = 12000;
const DEFAULT_BUDGET_MS = 45000;
const GiB = 1024 ** 3;

/**
 * The fixed table of tools, probed by one version call each (`cmd` may list candidates tried in order). Adding a tool is one line.
 * No entry asks for an account, a login, a remote or a configuration value: only a version.
 */
export const PROBES = [
  { name: 'node', cmd: 'node', args: ['--version'] },
  { name: 'npm', cmd: 'npm', args: ['--version'] },
  { name: 'pnpm', cmd: 'pnpm', args: ['--version'] },
  { name: 'yarn', cmd: 'yarn', args: ['--version'] },
  { name: 'bun', cmd: 'bun', args: ['--version'] },
  { name: 'deno', cmd: 'deno', args: ['--version'] },
  { name: 'python', cmd: ['python', 'python3'], args: ['--version'], needVersion: true },
  { name: 'pip', cmd: ['pip', 'pip3'], args: ['--version'], needVersion: true },
  { name: 'uv', cmd: 'uv', args: ['--version'] },
  { name: 'git', cmd: 'git', args: ['--version'] },
  { name: 'gh', cmd: 'gh', args: ['--version'] },
  { name: 'docker', cmd: 'docker', args: ['--version'] },
  { name: 'docker compose', cmd: 'docker', args: ['compose', 'version'] },
  { name: 'podman', cmd: 'podman', args: ['--version'] },
  { name: 'kubectl', cmd: 'kubectl', args: ['version', '--client'] },
  { name: 'helm', cmd: 'helm', args: ['version', '--short'] },
  { name: 'terraform', cmd: 'terraform', args: ['version'] },
  { name: 'az', cmd: 'az', args: ['version'], timeoutMs: SLOW_TIMEOUT_MS },
  { name: 'aws', cmd: 'aws', args: ['--version'], timeoutMs: SLOW_TIMEOUT_MS },
  { name: 'gcloud', cmd: 'gcloud', args: ['--version'], timeoutMs: SLOW_TIMEOUT_MS },
  { name: 'vercel', cmd: 'vercel', args: ['--version'] },
  { name: 'supabase', cmd: 'supabase', args: ['--version'] },
  { name: 'java', cmd: 'java', args: ['-version'] },
  { name: 'dotnet', cmd: 'dotnet', args: ['--version'] },
  { name: 'go', cmd: 'go', args: ['version'] },
  { name: 'rustc', cmd: 'rustc', args: ['--version'] },
  { name: 'cargo', cmd: 'cargo', args: ['--version'] },
  { name: 'ruby', cmd: 'ruby', args: ['--version'] },
  { name: 'php', cmd: 'php', args: ['--version'] },
  { name: 'ffmpeg', cmd: 'ffmpeg', args: ['-version'] },
  { name: 'claude', cmd: 'claude', args: ['--version'] },
  { name: 'codex', cmd: 'codex', args: ['--version'] },
  { name: 'cline', cmd: 'cline', args: ['--version'] },
  { name: 'agy', cmd: 'agy', args: ['--version'] },
];

/** The shells; `only` limits an entry to one platform (Windows PowerShell and cmd exist on Windows only). */
export const SHELLS = [
  { name: 'pwsh', cmd: 'pwsh', args: ['--version'] },
  { name: 'powershell', cmd: 'powershell', args: ['-NoProfile', '-NonInteractive', '-Command', '$PSVersionTable.PSVersion.ToString()'], only: 'win32', timeoutMs: 8000 },
  { name: 'bash', cmd: 'bash', args: ['--version'] },
  { name: 'zsh', cmd: 'zsh', args: ['--version'] },
  { name: 'cmd', cmd: 'cmd', args: ['/d', '/c', 'ver'], only: 'win32' },
];

// ------------------------------------------------------------------------------------------------ small helpers

const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The first version number in a tool's output (at most four dotted parts), or null. Only digits are kept, never the rest of the line. */
export function parseVersion(text) {
  const m = /(?<![\w.])v?(\d+(?:\.\d+){1,3})/.exec(String(text ?? ''));
  return m ? m[1] : null;
}

/**
 * Remove private values from a string: the home folder (any separator, any case) becomes `~`, any other absolute path
 * `<path>`, the user name `<user>` and the machine name `<host>`. A name shorter than three characters is matched as a whole word only.
 */
export function scrub(text, ctx = {}) {
  let s = String(text ?? '');
  const home = ctx.home ?? '';
  if (home.length >= 2) {
    const forms = new Set([home, home.replace(/\\/g, '/'), home.replace(/\//g, '\\')]);
    for (const form of forms) s = s.replace(new RegExp(escapeRe(form), 'gi'), '~');
  }
  s = s.replace(/\b[A-Za-z]:[\\/][^\s"')\]]*/g, '<path>');
  s = s.replace(/(?<![\w.:~<-])\/(?:[\w.@+-]+\/)+[\w.@+-]*/g, '<path>');
  for (const [name, mark] of [[ctx.user, '<user>'], [ctx.host, '<host>']]) {
    if (!name) continue;
    const body = escapeRe(name);
    s = s.replace(new RegExp(name.length >= 3 ? body : `\\b${body}\\b`, 'gi'), mark);
  }
  return s;
}

const deepScrub = (value, ctx) => {
  if (typeof value === 'string') return scrub(value, ctx);
  if (Array.isArray(value)) return value.map(v => deepScrub(v, ctx));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, deepScrub(v, ctx)]));
  return value;
};

/** Run `fn` over `items` with at most `cap` in flight; results keep the order of `items`. */
async function pool(items, cap, fn) {
  const results = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(cap, items.length)) }, worker));
  return results;
}

// ------------------------------------------------------------------------------------------------ the collector

/** A command that never throws: the runner's result, or `error` when the runner itself broke. */
async function safeRun(deps, cmd, args, timeoutMs) {
  try {
    const r = await deps.run(cmd, args, { timeoutMs });
    return r && typeof r === 'object' ? r : { status: 'error', code: null, out: '' };
  } catch {
    return { status: 'error', code: null, out: '' };
  }
}

function interpret(result, needVersion) {
  if (result.status === 'missing') return { status: 'absent', version: null };
  if (result.status !== 'ok') return { status: 'not determined', version: null };
  const version = parseVersion(result.out);
  if (result.code === 0 && (version || !needVersion)) return { status: 'present', version };
  return { status: 'absent', version: null };
}

async function probeOne(deps, entry, gate) {
  let last = { status: 'absent', version: null };
  for (const cmd of [].concat(entry.cmd)) {
    const timeoutMs = gate.timeoutFor(entry.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    if (timeoutMs === 0) return { status: 'not determined', version: null };
    const res = interpret(await safeRun(deps, cmd, entry.args, timeoutMs), entry.needVersion);
    if (res.status !== 'absent') return res;
    last = res;
  }
  return last;
}

function parseNvidia(out) {
  const gpus = [];
  for (const line of String(out).split(/\r?\n/)) {
    const m = /^(.+?),\s*(\d+)\s*$/.exec(line.trim());
    if (m) gpus.push({ name: m[1].trim(), vramGiB: Math.round(Number(m[2]) / 1024) });
  }
  return gpus;
}

function parseLspci(out) {
  return String(out).split(/\r?\n/)
    .map(l => /(?:VGA compatible controller|3D controller|Display controller):\s*(.+)$/.exec(l))
    .filter(Boolean).map(m => ({ name: m[1].replace(/\s*\(rev [^)]*\)\s*$/, '').trim(), vramGiB: null }));
}

function parseProfiler(out) {
  const gpus = [];
  for (const line of String(out).split(/\r?\n/)) {
    const chip = /Chipset Model:\s*(.+)$/.exec(line);
    if (chip) gpus.push({ name: chip[1].trim(), vramGiB: null });
    const vram = /VRAM[^:]*:\s*(\d+)\s*(GB|MB)/i.exec(line);
    if (vram && gpus.length) gpus[gpus.length - 1].vramGiB = vram[2].toUpperCase() === 'GB' ? Number(vram[1]) : Math.round(Number(vram[1]) / 1024);
  }
  return gpus;
}

const lines = out => String(out).split(/\r?\n/).map(l => l.trim()).filter(Boolean);

async function readGpus(deps, gate) {
  const attempts = [
    ['nvidia-smi', ['--query-gpu=name,memory.total', '--format=csv,noheader,nounits'], parseNvidia],
  ];
  if (deps.platform === 'win32') {
    attempts.push(['powershell', ['-NoProfile', '-NonInteractive', '-Command', 'Get-CimInstance Win32_VideoController | ForEach-Object { $_.Name }'],
      out => lines(out).map(name => ({ name, vramGiB: null }))]);
  } else if (deps.platform === 'darwin') {
    attempts.push(['system_profiler', ['SPDisplaysDataType'], parseProfiler]);
  } else {
    attempts.push(['lspci', [], parseLspci]);
  }
  for (const [cmd, args, parse] of attempts) {
    const timeoutMs = gate.timeoutFor(8000);
    if (timeoutMs === 0) break;
    const r = await safeRun(deps, cmd, args, timeoutMs);
    if (r.status === 'ok' && r.code === 0) {
      const gpus = parse(r.out).slice(0, 4);
      if (gpus.length) return gpus;
    }
  }
  return [{ name: 'not determined', vramGiB: null }];
}

async function readWsl(deps, gate) {
  if (deps.platform !== 'win32') return 'not applicable';
  const timeoutMs = gate.timeoutFor(5000);
  if (timeoutMs === 0) return 'not determined';
  const r = await safeRun(deps, 'wsl', ['--list', '--quiet'], timeoutMs);
  if (r.status === 'missing') return 'absent';
  if (r.status !== 'ok') return 'not determined';
  return r.code === 0 ? 'present' : 'absent';
}

function safely(fn, fallback) {
  try { return fn(); } catch { return fallback; }
}

function readOs(deps) {
  const family = { win32: 'windows', darwin: 'macos', linux: 'linux' }[deps.platform] ?? 'other';
  let environment = family;
  let distribution = null;
  if (family === 'linux') {
    const procVersion = safely(() => String(deps.readFile('/proc/version')), '');
    if (deps.env?.WSL_DISTRO_NAME || /microsoft/i.test(deps.release) || /microsoft/i.test(procVersion)) environment = 'wsl';
    const m = /^PRETTY_NAME="?([^"\n]+)"?/m.exec(safely(() => String(deps.readFile('/etc/os-release')), ''));
    distribution = m ? m[1].trim() : null;
  }
  const name = family === 'windows' ? (deps.osVersion || 'Windows') : family === 'linux' ? (distribution || 'Linux') : family === 'macos' ? 'macOS' : String(deps.platform);
  return { family, environment, name, distribution, release: String(deps.release), architecture: String(deps.arch) };
}

/**
 * Collect the sheet. `opts.budgetMs` bounds the whole collect: a probe that would start after the budget is "not determined",
 * and a running probe is given no more than the time left.
 */
export async function collectSpecs(deps, opts = {}) {
  const budgetMs = opts.budgetMs ?? DEFAULT_BUDGET_MS;
  const t0 = deps.monotonic();
  const gate = {
    timeoutFor(wanted) {
      const left = budgetMs - (deps.monotonic() - t0);
      return left <= 0 ? 0 : Math.max(500, Math.min(wanted, left));
    },
  };
  const cap = Math.max(1, deps.concurrency ?? 6);

  const tasks = [
    ...PROBES.map(p => ({ kind: 'tool', entry: p })),
    ...SHELLS.filter(s => !s.only || s.only === deps.platform).map(s => ({ kind: 'shell', entry: s })),
    { kind: 'wsl' },
    { kind: 'gpu' },
  ];
  const results = await pool(tasks, cap, async task => {
    if (task.kind === 'wsl') return readWsl(deps, gate);
    if (task.kind === 'gpu') return readGpus(deps, gate);
    return { name: task.entry.name, ...(await probeOne(deps, task.entry, gate)) };
  });

  const tools = results.filter((_, i) => tasks[i].kind === 'tool');
  const shells = results.filter((_, i) => tasks[i].kind === 'shell');
  const wsl = results[tasks.findIndex(t => t.kind === 'wsl')];
  const gpus = results[tasks.findIndex(t => t.kind === 'gpu')];

  const cpus = safely(() => deps.cpus(), []);
  const free = safely(() => deps.freeBytes(deps.cwd()), null);
  const osFacts = readOs(deps);
  osFacts.wsl = wsl;

  const sheet = {
    schemaVersion: SCHEMA_VERSION,
    collectedAt: new Date(deps.now()).toISOString().replace(/\.\d{3}Z$/, 'Z'),
    os: osFacts,
    cpu: { model: String(cpus[0]?.model ?? 'not determined').replace(/\s+/g, ' ').trim(), logicalCores: cpus.length },
    memoryGiB: Math.round(safely(() => deps.totalmem(), 0) / GiB),
    gpus,
    freeDiskGiB: typeof free === 'number' && Number.isFinite(free) ? Math.round(free / GiB) : null,
    shells,
    tools,
  };
  const ctx = { home: safely(() => deps.homedir(), ''), user: safely(() => deps.username(), ''), host: safely(() => deps.hostname(), '') };
  return deepScrub(sheet, ctx);
}

// ------------------------------------------------------------------------------------------------ the Markdown sheet

const showVersion = t => `${t.name}${t.version ? ` ${t.version}` : ''}`;

export function renderMarkdown(sheet) {
  const o = sheet.os;
  const wsl = o.wsl && o.wsl !== 'not applicable' ? `, WSL ${o.wsl}` : '';
  const env = o.environment === 'wsl' ? ', running inside WSL' : '';
  const gpu = sheet.gpus.map(g => (g.vramGiB ? `${g.name} (${g.vramGiB} GiB VRAM)` : g.name)).join('; ');
  const group = (list, status) => list.filter(t => t.status === status);
  const present = list => group(list, 'present').map(showVersion);
  const names = (list, status) => group(list, status).map(t => t.name).join(', ');
  const out = [
    '# System specs',
    '',
    `Machine facts, not project facts. Collected ${sheet.collectedAt} (schema ${sheet.schemaVersion}). Re-collect when stale; a tool listed as absent was not found, never guessed.`,
    '',
    `- OS: ${o.name}, release ${o.release}, ${o.architecture} (${o.family}${env}${wsl})`,
    `- CPU: ${sheet.cpu.model}, ${sheet.cpu.logicalCores} logical cores`,
    `- Memory: ${sheet.memoryGiB} GiB`,
    `- GPU: ${gpu}`,
    `- Free disk (workspace volume): ${sheet.freeDiskGiB === null ? 'not determined' : `${sheet.freeDiskGiB} GiB`}`,
    `- Shells: ${present(sheet.shells).join(', ') || 'none found'}${names(sheet.shells, 'absent') ? `; absent: ${names(sheet.shells, 'absent')}` : ''}`,
    '',
    '## Tools',
    '',
    ...present(sheet.tools).map(t => `- ${t}`),
    '',
    `Absent: ${names(sheet.tools, 'absent') || 'none'}`,
  ];
  const unknown = [...group(sheet.tools, 'not determined'), ...group(sheet.shells, 'not determined')].map(t => t.name).join(', ');
  if (unknown) out.push(`Not determined (timed out or unreadable): ${unknown}`);
  return `${out.join('\n')}\n`;
}

// ------------------------------------------------------------------------------------------------ real dependencies

function pathKey(env) {
  return Object.keys(env).find(k => k.toLowerCase() === 'path') ?? 'PATH';
}

/** The file a bare command name resolves to on PATH (with PATHEXT on Windows), or null. */
function resolveOnPath(cmd, env, platform) {
  const win = platform === 'win32';
  const exts = win ? (env.PATHEXT || '.COM;.EXE;.BAT;.CMD').split(';').filter(Boolean) : [''];
  const hasExt = win && path.extname(cmd) !== '';
  for (const dir of String(env[pathKey(env)] ?? '').split(win ? ';' : ':').filter(Boolean)) {
    for (const ext of hasExt ? [''] : exts) {
      const file = path.join(dir.replace(/^"|"$/g, ''), cmd + ext);
      try {
        if (fs.statSync(file).isFile()) return file;
      } catch { /* not here */ }
    }
  }
  return null;
}

/** Run a command with no shell string: an argument array, a hard timeout, a capped output. Never throws. */
function realRunner(env, platform) {
  const childEnv = { ...env, NO_COLOR: '1', COREPACK_ENABLE_DOWNLOAD_PROMPT: '0', DOTNET_NOLOGO: '1', DOTNET_CLI_TELEMETRY_OPTOUT: '1' };
  return (cmd, args, { timeoutMs }) => new Promise(resolve => {
    const file = resolveOnPath(cmd, env, platform);
    if (!file) { resolve({ status: 'missing', code: null, out: '' }); return; }
    let command = file;
    let argv = args;
    let verbatim = false;
    if (platform === 'win32' && /\.(cmd|bat)$/i.test(file)) {
      // Node cannot start a batch shim directly. The arguments are the fixed constants of the probe table, never user input.
      command = env.ComSpec || 'cmd.exe';
      argv = ['/d', '/s', '/c', `"${file}" ${args.join(' ')}`];
      verbatim = true;
    }
    let out = '';
    let settled = false;
    const done = result => { if (!settled) { settled = true; clearTimeout(timer); resolve(result); } };
    let child;
    try {
      child = spawn(command, argv, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true, windowsVerbatimArguments: verbatim, env: childEnv, cwd: os.tmpdir() });
    } catch (error) {
      resolve({ status: error?.code === 'ENOENT' ? 'missing' : 'error', code: null, out: '' });
      return;
    }
    const timer = setTimeout(() => { try { child.kill(); } catch { /* gone */ } done({ status: 'timeout', code: null, out: '' }); }, timeoutMs);
    const take = chunk => { if (out.length < 65536) out += chunk.toString('utf8'); };
    child.stdout.on('data', take);
    child.stderr.on('data', take);
    child.on('error', error => done({ status: error?.code === 'ENOENT' ? 'missing' : 'error', code: null, out: '' }));
    child.on('close', code => done({ status: 'ok', code, out }));
  });
}

export function defaultDeps() {
  const env = process.env;
  return {
    platform: process.platform,
    arch: os.arch(),
    release: os.release(),
    osVersion: safely(() => os.version(), ''),
    cpus: () => os.cpus(),
    totalmem: () => os.totalmem(),
    freeBytes: dir => { const s = fs.statfsSync(dir); return s.bavail * s.bsize; },
    homedir: () => os.homedir(),
    hostname: () => os.hostname(),
    username: () => os.userInfo().username,
    env,
    cwd: () => process.cwd(),
    now: () => Date.now(),
    monotonic: () => performance.now(),
    readFile: file => fs.readFileSync(file, 'utf8'),
    concurrency: 6,
    run: realRunner(env, process.platform),
  };
}

// ------------------------------------------------------------------------------------------------ the command line

const HELP = `system-specs: collect the machine facts of this computer into a small sheet.

  node specs.mjs collect [--out <path>] [--max-age <hours>] [--refresh] [--json]
  node specs.mjs help

  --out <path>        the Markdown file (default ${DEFAULT_OUT.replace(/\\/g, '/')}); the JSON sheet is written beside it
  --max-age <hours>   reuse a sheet younger than this (default ${DEFAULT_MAX_AGE_HOURS})
  --refresh           collect again even when the sheet is fresh
  --json              print the JSON to stdout and write nothing

Exit codes: 0 written, reused or printed; 1 the sheet could not be written; 2 usage error.
`;

const usage = message => ({ code: 2, out: '', err: `${message}\n\n${HELP}` });

function parseArgs(argv) {
  const [command, ...rest] = argv;
  if (command === undefined) return { error: 'missing command' };
  if (['help', '--help', '-h'].includes(command)) return { command: 'help' };
  if (command !== 'collect') return { error: `unknown command "${command}"` };
  const opts = { out: DEFAULT_OUT, maxAge: DEFAULT_MAX_AGE_HOURS, refresh: false, json: false };
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === '--refresh') opts.refresh = true;
    else if (a === '--json') opts.json = true;
    else if (a === '--out' || a === '--max-age') {
      const value = rest[++i];
      if (value === undefined) return { error: `${a} needs a value` };
      if (a === '--out') opts.out = value;
      else {
        const hours = Number(value);
        if (value.trim() === '' || !Number.isFinite(hours) || hours < 0) return { error: `--max-age needs a number of hours, 0 or more (got "${value}")` };
        opts.maxAge = hours;
      }
    } else return { error: `unknown option "${a}"` };
  }
  return { command, opts };
}

function readFresh(jsonFile, mdFile, deps, maxAgeHours) {
  try {
    const sheet = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
    if (sheet?.schemaVersion !== SCHEMA_VERSION || !fs.existsSync(mdFile)) return null;
    const ageMs = deps.now() - Date.parse(sheet.collectedAt);
    return Number.isFinite(ageMs) && ageMs >= 0 && ageMs < maxAgeHours * 3600 * 1000 ? { sheet, ageHours: ageMs / 3600000 } : null;
  } catch {
    return null;
  }
}

/** Run the command line against `deps`; returns `{ code, out, err }` and prints nothing itself. */
export async function runCli(argv, deps) {
  const parsed = parseArgs(argv);
  if (parsed.error) return usage(parsed.error);
  if (parsed.command === 'help') return { code: 0, out: HELP, err: '' };
  const { opts } = parsed;

  if (opts.json) {
    const sheet = await collectSpecs(deps);
    return { code: 0, out: `${JSON.stringify(sheet, null, 2)}\n`, err: '' };
  }

  const mdFile = path.resolve(deps.cwd(), opts.out);
  const jsonFile = path.join(path.dirname(mdFile), `${path.basename(mdFile, path.extname(mdFile))}.json`);
  const shown = path.isAbsolute(opts.out) ? path.basename(opts.out) : opts.out.replace(/\\/g, '/');

  if (!opts.refresh) {
    const fresh = readFresh(jsonFile, mdFile, deps, opts.maxAge);
    if (fresh) return { code: 0, out: `System specs reused (collected ${fresh.sheet.collectedAt}, ${fresh.ageHours.toFixed(1)} h old): ${shown}\n`, err: '' };
  }

  const sheet = await collectSpecs(deps);
  try {
    fs.mkdirSync(path.dirname(mdFile), { recursive: true });
    fs.writeFileSync(mdFile, renderMarkdown(sheet));
    fs.writeFileSync(jsonFile, `${JSON.stringify(sheet, null, 2)}\n`);
  } catch (error) {
    return { code: 1, out: '', err: `could not write the sheet (${error?.code ?? 'error'}); nothing was collected into a file\n` };
  }
  return { code: 0, out: `System specs written: ${shown} (and the .json beside it)\n`, err: '' };
}

const isMain = (() => {
  try { return !!process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url)); } catch { return false; }
})();

if (isMain) {
  runCli(process.argv.slice(2), defaultDeps()).then(r => {
    if (r.out) process.stdout.write(r.out);
    if (r.err) process.stderr.write(r.err);
    process.exitCode = r.code;
  });
}
