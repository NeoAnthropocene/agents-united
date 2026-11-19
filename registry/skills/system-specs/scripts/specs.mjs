#!/usr/bin/env node
/**
 * system-specs: collect the machine facts an agent plans against (OS, CPU, memory, GPU, free disk, shells, developer tools)
 * into a small Markdown sheet and a JSON twin. Node 20+, built-ins only.
 *
 *   node specs.mjs collect [--out <path.md>] [--refresh] [--json]
 *   node specs.mjs check [--out <path.md>]
 *   node specs.mjs help
 *
 * `collect` collects once: it writes `.agents-united/system-specs.md` and `.json` beside it (relative to the working folder;
 * `--out` names the Markdown file, which must end in .md and stay inside the working folder; the JSON goes next to it). A valid
 * sheet of this machine is reused whatever its age (the Markdown is rewritten from the validated JSON); `--refresh` always
 * collects again. `--json` prints the JSON to stdout and writes nothing.
 * `check` is a read-only, tool-free test of whether the environment changed since the sheet was collected: it re-resolves each
 * probed tool on PATH and compares a fingerprint (hashes only) stored in the JSON. It runs no tool and writes nothing.
 *
 * Exit codes: collect 0 written, reused or printed, 1 the sheet could not be written; check 0 unchanged, 3 changed (names of the
 * tools that differ), 1 no usable sheet; both 2 for a usage error or a refused --out.
 * A tool that is missing, slow or broken never fails the run: it is "absent" (not found) or "not determined" (found, but it
 * timed out or failed).
 *
 * Privacy: the sheet is built from an allowlist (see references/sheet-format.md). It never holds the user name, the machine
 * name, the home folder or any absolute path, an environment value, a git remote, or any account or credential state.
 *
 * Every command and every os/fs read of the collector goes through one `deps` object, so tests run it with a fake runner.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';

export const SCHEMA_VERSION = 2;
export const DEFAULT_OUT = path.join('.agents-united', 'system-specs.md');
export const SHEET_HEADER = '# System specs';
const DEFAULT_TIMEOUT_MS = 5000;
const SLOW_TIMEOUT_MS = 12000;
const DEFAULT_BUDGET_MS = 45000;
const OUTPUT_CAP = 65536;
const GiB = 1024 ** 3;

/**
 * The fixed table of tools, probed by one version call each (`cmd` may list candidates tried in order). Adding a tool is one line.
 * No entry asks for an account, a login, a remote or a configuration value: only a version.
 * `parse` is a regular expression with the version in group 1 where the first line is not enough; `needVersion` makes a run that
 * prints no version count as absent (the Windows Store python stub); `macStub` marks a tool whose /usr/bin file on macOS is a stub
 * that opens an install dialog when no developer tools are installed.
 */
export const PROBES = [
  { name: 'node', cmd: 'node', args: ['--version'] },
  { name: 'npm', cmd: 'npm', args: ['--version'] },
  { name: 'pnpm', cmd: 'pnpm', args: ['--version'] },
  { name: 'yarn', cmd: 'yarn', args: ['--version'] },
  { name: 'bun', cmd: 'bun', args: ['--version'] },
  { name: 'deno', cmd: 'deno', args: ['--version'] },
  { name: 'python', cmd: ['python', 'python3'], args: ['--version'], needVersion: true, macStub: true },
  { name: 'pip', cmd: ['pip', 'pip3'], args: ['--version'], needVersion: true, macStub: true },
  { name: 'uv', cmd: 'uv', args: ['--version'] },
  { name: 'git', cmd: 'git', args: ['--version'], macStub: true },
  { name: 'gh', cmd: 'gh', args: ['--version'] },
  { name: 'docker', cmd: 'docker', args: ['--version'] },
  { name: 'docker compose', cmd: 'docker', args: ['compose', 'version'] },
  { name: 'podman', cmd: 'podman', args: ['--version'] },
  { name: 'kubectl', cmd: 'kubectl', args: ['version', '--client'] },
  { name: 'helm', cmd: 'helm', args: ['version', '--short'] },
  { name: 'terraform', cmd: 'terraform', args: ['version'] },
  { name: 'az', cmd: 'az', args: ['version'], timeoutMs: SLOW_TIMEOUT_MS, parse: /"azure-cli"\s*:\s*"(\d+(?:\.\d+){1,3})"/ },
  { name: 'aws', cmd: 'aws', args: ['--version'], timeoutMs: SLOW_TIMEOUT_MS },
  { name: 'gcloud', cmd: 'gcloud', args: ['--version'], timeoutMs: SLOW_TIMEOUT_MS },
  { name: 'vercel', cmd: 'vercel', args: ['--version'] },
  { name: 'supabase', cmd: 'supabase', args: ['--version'] },
  { name: 'java', cmd: 'java', args: ['-version'], macStub: true, parse: /\bversion\s+"(\d+(?:\.\d+){0,3})/ },
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

const SHELL_NAMES = new Set([...SHELLS.map(s => s.name), 'bash (WSL launcher)', 'bash (Git Bash/MSYS)']);
const STATUSES = new Set(['present', 'absent', 'not determined']);
const FAMILIES = new Set(['windows', 'linux', 'macos', 'other']);
const ENVIRONMENTS = new Set(['windows', 'wsl', 'linux', 'macos', 'other']);
const WSL_STATES = new Set(['present', 'absent', 'installed, no distribution', 'not determined', 'not applicable']);

// ------------------------------------------------------------------------------------------------ small helpers

const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function safely(fn, fallback) {
  try { return fn(); } catch { return fallback; }
}

/**
 * The version in a tool's output: with no `pattern`, the first dotted number (at most four parts) of the first non-empty line,
 * else a bare integer after the word "version" ("openjdk version "21""), else null. Only digits are kept, never the rest of the line;
 * a build id such as ffmpeg's `N-12345-g...` is not a version.
 */
export function parseVersion(text, pattern) {
  const all = String(text ?? '');
  if (pattern) return pattern.exec(all)?.[1] ?? null;
  const line = all.split(/\r?\n/).map(l => l.trim()).find(Boolean) ?? '';
  const dotted = /(?<![\d.])(?:v|go)?(\d+(?:\.\d+){1,3})(?!\d)/.exec(line);
  if (dotted) return dotted[1];
  return /\bversion\s+"?(\d+)"?(?![\w.-])/i.exec(line)?.[1] ?? null;
}

/** Free text as the sheet keeps it: one line, a small safe character set, at most 100 characters. */
export function cleanText(text) {
  return String(text ?? '')
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')
    .replace(/[^\p{L}\p{N} .()@+,/:_#'&%[\]\u00ae\u2122-]/gu, '')
    .replace(/\s+/g, ' ').trim().slice(0, 100);
}

/** The private values to scrub, from the same `deps` the collector reads. Environment values are matched, never emitted. */
export function scrubContext(deps) {
  const env = deps.env ?? {};
  const home = safely(() => deps.homedir(), '');
  const host = safely(() => deps.hostname(), '');
  const user = safely(() => deps.username(), '');
  const homeBase = home ? home.replace(/[\\/]+$/, '').split(/[\\/]/).pop() : '';
  const tokens = [
    [homeBase, '<user>'],
    [String(host).split('.')[0], '<host>'],
    [env.USERNAME, '<user>'], [env.USER, '<user>'], [env.LOGNAME, '<user>'],
    [env.COMPUTERNAME, '<host>'], [env.USERDOMAIN, '<host>'],
  ].filter(([v]) => typeof v === 'string' && v !== '').map(([value, mark]) => ({ value, mark }));
  return { home, user, host, tokens };
}

/**
 * Remove private values from a free-text string: the home folder (any separator, any case) becomes `~`, UNC and drive paths and
 * other absolute paths `<path>`, then the user name, machine name and the extra tokens `<user>` / `<host>`. A token shorter than
 * three characters is ignored inside text and replaced only when it is the whole string.
 */
export function scrub(text, ctx = {}) {
  let s = String(text ?? '');
  const home = ctx.home ?? '';
  if (home.length >= 2) {
    const forms = new Set([home, home.replace(/\\/g, '/'), home.replace(/\//g, '\\')]);
    for (const form of forms) s = s.replace(new RegExp(escapeRe(form), 'gi'), '~');
  }
  s = s.replace(/\\\\[^\s\\/]+(?:\\[^\s\\/]*)*/g, '<path>');
  s = s.replace(/\b[A-Za-z]:[\\/][^"'\r\n]*/g, '<path>');
  s = s.replace(/(?<![\w.:~<-])\/(?:[\w.@+-]+\/)+[\w.@+-]*/g, '<path>');
  const tokens = [
    ...(ctx.tokens ?? []),
    ...(ctx.user ? [{ value: ctx.user, mark: '<user>' }] : []),
    ...(ctx.host ? [{ value: ctx.host, mark: '<host>' }] : []),
  ].sort((a, b) => b.value.length - a.value.length);
  for (const { value, mark } of tokens) {
    if (s.trim().toLowerCase() === value.toLowerCase()) return mark;
    if (value.length >= 3) s = s.replace(new RegExp(escapeRe(value), 'gi'), mark);
  }
  return s;
}

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

const positiveInt = n => (Number.isFinite(n) && Math.round(n) > 0 ? Math.round(n) : null);

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

/** absent = not found on PATH; not determined = found but timed out or failed. A `needVersion` tool that prints no version is a stub: absent. */
function interpret(result, entry) {
  if (result.status === 'missing') return { status: 'absent', version: null };
  if (result.status !== 'ok') return { status: 'not determined', version: null };
  const version = parseVersion(result.out, entry.parse);
  if (result.code === 0) return entry.needVersion && !version ? { status: 'absent', version: null } : { status: 'present', version };
  return entry.needVersion ? { status: 'absent', version: null } : { status: 'not determined', version: null };
}

const resolveCmd = (deps, cmd) => (typeof deps.resolve === 'function' ? safely(() => deps.resolve(cmd), null) : null);

/** On macOS, true when a /usr/bin stub for this tool would open an install dialog (so it must not be run). */
async function isMacStub(deps, gate, entry, cmd) {
  if (deps.platform !== 'darwin' || !entry.macStub) return false;
  const file = resolveCmd(deps, cmd);
  if (!file || !file.replace(/\\/g, '/').startsWith('/usr/bin/')) return false;
  if (entry.name === 'java') {
    const r = await safeRun(deps, '/usr/libexec/java_home', [], gate.timeoutFor(3000) || 500);
    return !(r.status === 'ok' && r.code === 0);
  }
  gate.devTools ??= safeRun(deps, 'xcode-select', ['-p'], gate.timeoutFor(3000) || 500).then(r => r.status === 'ok' && r.code === 0);
  return !(await gate.devTools);
}

async function probeOne(deps, entry, gate) {
  let last = { status: 'absent', version: null };
  for (const cmd of [].concat(entry.cmd)) {
    if (await isMacStub(deps, gate, entry, cmd)) continue;
    const timeoutMs = gate.timeoutFor(entry.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    if (timeoutMs === 0) return { status: 'not determined', version: null };
    const res = interpret(await safeRun(deps, cmd, entry.args, timeoutMs), entry);
    if (res.status !== 'absent') return res;
    last = res;
  }
  return last;
}

async function probeShell(deps, entry, gate) {
  let name = entry.name;
  if (entry.name === 'bash' && deps.platform === 'win32') {
    const file = (resolveCmd(deps, 'bash') ?? '').replace(/\\/g, '/');
    if (/\/windows\/system32\/bash(\.exe)?$/i.test(file)) return { name: 'bash (WSL launcher)', status: 'present', version: null };
    if (/\/(git|msys\d*|mingw\d*)\//i.test(file)) name = 'bash (Git Bash/MSYS)';
  }
  return { name, ...(await probeOne(deps, entry, gate)) };
}

function parseNvidia(out) {
  const gpus = [];
  for (const line of String(out).split(/\r?\n/)) {
    const m = /^(.+?),\s*(\d+)\s*$/.exec(line.trim());
    if (m) gpus.push({ name: m[1].trim(), vramGiB: positiveInt(Number(m[2]) / 1024) });
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
    if (vram && gpus.length) gpus[gpus.length - 1].vramGiB = positiveInt(vram[2].toUpperCase() === 'GB' ? Number(vram[1]) : Number(vram[1]) / 1024);
  }
  return gpus;
}

const lines = out => String(out).split(/\r?\n/).map(l => l.trim()).filter(Boolean);

async function readGpus(deps, gate) {
  const attempts = [['nvidia-smi', ['--query-gpu=name,memory.total', '--format=csv,noheader,nounits'], parseNvidia]];
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
      const gpus = parse(r.stdout ?? r.out).slice(0, 4);
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
  if (r.code !== 0) return 'absent';
  return String(r.stdout ?? r.out).replace(/[\0\s]/g, '') ? 'present' : 'installed, no distribution';
}

async function readOs(deps, gate) {
  const family = { win32: 'windows', darwin: 'macos', linux: 'linux' }[deps.platform] ?? 'other';
  let environment = family;
  let distribution = null;
  let release = String(deps.release);
  let name = family === 'windows' ? (deps.osVersion || 'Windows') : family === 'linux' ? 'Linux' : String(deps.platform);
  if (family === 'linux') {
    const procVersion = safely(() => String(deps.readFile('/proc/version')), '');
    if (deps.env?.WSL_DISTRO_NAME || /microsoft/i.test(deps.release) || /microsoft/i.test(procVersion)) environment = 'wsl';
    const m = /^PRETTY_NAME="?([^"\n]+)"?/m.exec(safely(() => String(deps.readFile('/etc/os-release')), ''));
    distribution = m ? m[1].trim() : null;
    if (distribution) name = distribution;
  }
  if (family === 'macos') {
    const timeoutMs = gate.timeoutFor(3000);
    const r = timeoutMs ? await safeRun(deps, 'sw_vers', ['-productVersion'], timeoutMs) : { status: 'error' };
    const product = r.status === 'ok' && r.code === 0 ? String(r.stdout ?? r.out).trim() : '';
    if (/^\d+(\.\d+){0,2}$/.test(product)) { release = product; name = `macOS ${product}`; } else { release = `Darwin kernel ${deps.release}`; name = 'macOS'; }
  }
  return { family, environment, name, distribution, release, architecture: String(deps.arch) };
}

const shortHash = text => crypto.createHash('sha256').update(text).digest('hex').slice(0, 8);

/**
 * A fingerprint of the environment, with no tool run: per probed tool, whether it resolves on PATH and, when it does, the size and
 * modification time of the resolved file; plus OS release, architecture and memory. Only hashes are kept (one short hash per part,
 * one SHA-256 over all), never a path, so a changed part can be named and nothing private is stored.
 */
export function computeFingerprint(deps) {
  const parts = {};
  for (const entry of PROBES) {
    let state = 'absent';
    for (const cmd of [].concat(entry.cmd)) {
      const file = resolveCmd(deps, cmd);
      if (!file) continue;
      const st = typeof deps.statFile === 'function' ? safely(() => deps.statFile(file), null) : null;
      state = st ? `found:${st.size}:${Math.round(st.mtimeMs)}` : 'found:?';
      break;
    }
    parts[entry.name] = shortHash(`${entry.name}|${state}`);
  }
  parts['os release'] = shortHash(`os release|${deps.release}`);
  parts.architecture = shortHash(`architecture|${deps.arch}`);
  parts.memory = shortHash(`memory|${positiveInt(safely(() => deps.totalmem(), 0) / GiB)}`);
  const hash = crypto.createHash('sha256').update(JSON.stringify(Object.entries(parts))).digest('hex');
  return { hash, parts };
}

/**
 * Collect the sheet. `opts.budgetMs` bounds the whole collect: a probe that would start after the budget is "not determined",
 * and a running probe is given no more than the time left.
 */
export async function collectSpecs(deps, opts = {}) {
  const budgetMs = opts.budgetMs ?? DEFAULT_BUDGET_MS;
  const t0 = deps.monotonic();
  const gate = {
    devTools: null,
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
    { kind: 'os' },
  ];
  const results = await pool(tasks, cap, async task => {
    if (task.kind === 'wsl') return readWsl(deps, gate);
    if (task.kind === 'gpu') return readGpus(deps, gate);
    if (task.kind === 'os') return readOs(deps, gate);
    if (task.kind === 'shell') return probeShell(deps, task.entry, gate);
    return { name: task.entry.name, ...(await probeOne(deps, task.entry, gate)) };
  });
  const of = kind => results.filter((_, i) => tasks[i].kind === kind);
  const one = kind => results[tasks.findIndex(t => t.kind === kind)];

  const ctx = scrubContext(deps);
  const free = text => cleanText(scrub(text, ctx));
  const cpus = safely(() => deps.cpus(), []);
  const parallel = deps.parallelism ? safely(() => deps.parallelism(), 0) : cpus.length;
  const freeBytes = safely(() => deps.freeBytes(deps.cwd()), null);
  const osFacts = one('os');

  return {
    schemaVersion: SCHEMA_VERSION,
    collectedAt: new Date(deps.now()).toISOString().replace(/\.\d{3}Z$/, 'Z'),
    os: {
      family: osFacts.family,
      environment: osFacts.environment,
      name: free(osFacts.name) || 'not determined',
      distribution: osFacts.distribution ? free(osFacts.distribution) || null : null,
      release: free(osFacts.release) || 'not determined',
      architecture: cleanText(osFacts.architecture) || 'not determined',
      wsl: one('wsl'),
    },
    cpu: { model: free(cpus[0]?.model) || 'not determined', logicalCores: positiveInt(parallel) },
    memoryGiB: positiveInt(safely(() => deps.totalmem(), 0) / GiB),
    gpus: one('gpu').map(g => ({ name: free(g.name) || 'not determined', vramGiB: g.vramGiB ?? null })),
    freeDiskGiB: typeof freeBytes === 'number' ? positiveInt(freeBytes / GiB) : null,
    shells: of('shell'),
    tools: of('tool'),
    fingerprint: computeFingerprint(deps),
  };
}

// ------------------------------------------------------------------------------------------------ validation of a cached sheet

const isObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const sameKeys = (v, keys) => isObject(v) && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const isClean = v => typeof v === 'string' && v !== '' && v === cleanText(v);
const nullOrInt = (v, max) => v === null || (Number.isInteger(v) && v >= 1 && v <= max);
const validVersion = v => v === null || (typeof v === 'string' && /^\d+(\.\d+){0,3}$/.test(v));

function validEntry(e, names) {
  return sameKeys(e, ['name', 'status', 'version']) && names.has(e.name) && STATUSES.has(e.status) && validVersion(e.version);
}

/**
 * A cached sheet is untrusted input. Returns a rebuilt copy when every key, enum, number and text matches what the collector
 * writes, else null. Nothing is copied from the input except validated values.
 */
export function validateSheet(x) {
  if (!sameKeys(x, ['schemaVersion', 'collectedAt', 'os', 'cpu', 'memoryGiB', 'gpus', 'freeDiskGiB', 'shells', 'tools', 'fingerprint'])) return null;
  const fp = x.fingerprint;
  const partNames = [...PROBES.map(p => p.name), 'os release', 'architecture', 'memory'];
  if (!sameKeys(fp, ['hash', 'parts']) || !/^[0-9a-f]{64}$/.test(fp.hash) || !sameKeys(fp.parts, partNames) || !partNames.every(n => /^[0-9a-f]{8}$/.test(fp.parts[n]))) return null;
  if (x.schemaVersion !== SCHEMA_VERSION) return null;
  if (typeof x.collectedAt !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(x.collectedAt) || !Number.isFinite(Date.parse(x.collectedAt))) return null;
  const o = x.os;
  if (!sameKeys(o, ['family', 'environment', 'name', 'distribution', 'release', 'architecture', 'wsl'])) return null;
  if (!FAMILIES.has(o.family) || !ENVIRONMENTS.has(o.environment) || !WSL_STATES.has(o.wsl)) return null;
  if (!isClean(o.name) || !isClean(o.release) || !isClean(o.architecture) || !(o.distribution === null || isClean(o.distribution))) return null;
  if (!sameKeys(x.cpu, ['model', 'logicalCores']) || !isClean(x.cpu.model) || !nullOrInt(x.cpu.logicalCores, 4096)) return null;
  if (!nullOrInt(x.memoryGiB, 1 << 20) || !nullOrInt(x.freeDiskGiB, 1 << 30)) return null;
  if (!Array.isArray(x.gpus) || x.gpus.length < 1 || x.gpus.length > 4) return null;
  if (!x.gpus.every(g => sameKeys(g, ['name', 'vramGiB']) && isClean(g.name) && nullOrInt(g.vramGiB, 4096))) return null;
  if (!Array.isArray(x.shells) || x.shells.length > SHELL_NAMES.size || !x.shells.every(s => validEntry(s, SHELL_NAMES))) return null;
  if (!Array.isArray(x.tools) || x.tools.length !== PROBES.length) return null;
  if (!x.tools.every((t, i) => validEntry(t, new Set([PROBES[i].name])))) return null;
  const entry = e => ({ name: e.name, status: e.status, version: e.version });
  return {
    schemaVersion: SCHEMA_VERSION,
    collectedAt: x.collectedAt,
    os: { family: o.family, environment: o.environment, name: o.name, distribution: o.distribution, release: o.release, architecture: o.architecture, wsl: o.wsl },
    cpu: { model: x.cpu.model, logicalCores: x.cpu.logicalCores },
    memoryGiB: x.memoryGiB,
    gpus: x.gpus.map(g => ({ name: g.name, vramGiB: g.vramGiB })),
    freeDiskGiB: x.freeDiskGiB,
    shells: x.shells.map(entry),
    tools: x.tools.map(entry),
    fingerprint: { hash: fp.hash, parts: Object.fromEntries(partNames.map(n => [n, fp.parts[n]])) },
  };
}

// ------------------------------------------------------------------------------------------------ the Markdown sheet

const showVersion = t => (t.version ? `${t.name} ${t.version}` : `${t.name} (version not determined)`);
const orUnknown = (v, unit) => (v === null || v === undefined ? 'not determined' : `${v}${unit}`);

export function renderMarkdown(sheet) {
  const o = sheet.os;
  const wsl = o.wsl && o.wsl !== 'not applicable' ? `, WSL ${o.wsl}` : '';
  const env = o.environment === 'wsl' ? ', running inside WSL' : '';
  const gpu = sheet.gpus.map(g => (g.vramGiB ? `${g.name} (${g.vramGiB} GiB VRAM)` : g.name)).join('; ');
  const group = (list, status) => list.filter(t => t.status === status);
  const present = list => group(list, 'present').map(showVersion);
  const names = (list, status) => group(list, status).map(t => t.name).join(', ');
  const out = [
    SHEET_HEADER,
    '',
    `Machine facts, not project facts. Collected ${sheet.collectedAt} (schema ${sheet.schemaVersion}). Absent means not found on the path; not determined means found but unreadable. Neither is ever guessed.`,
    '',
    `- OS: ${o.name}, release ${o.release}, ${o.architecture} (${o.family}${env}${wsl})`,
    `- CPU: ${sheet.cpu.model}, ${orUnknown(sheet.cpu.logicalCores, '')} logical cores`,
    `- Memory: ${orUnknown(sheet.memoryGiB, ' GiB')}`,
    `- GPU: ${gpu}`,
    `- Free disk (workspace volume): ${orUnknown(sheet.freeDiskGiB, ' GiB')}`,
    `- Shells: ${present(sheet.shells).join(', ') || 'none found'}${names(sheet.shells, 'absent') ? `; absent: ${names(sheet.shells, 'absent')}` : ''}`,
    '',
    '## Tools',
    '',
    ...present(sheet.tools).map(t => `- ${t}`),
    '',
    `Absent: ${names(sheet.tools, 'absent') || 'none'}`,
  ];
  const unknown = [...group(sheet.tools, 'not determined'), ...group(sheet.shells, 'not determined')].map(t => t.name).join(', ');
  if (unknown) out.push(`Not determined (found, but timed out or failed): ${unknown}`);
  return `${out.join('\n')}\n`;
}

// ------------------------------------------------------------------------------------------------ real dependencies

function pathKey(env) {
  return Object.keys(env).find(k => k.toLowerCase() === 'path') ?? 'PATH';
}

/**
 * The file a command resolves to: an absolute path as given, else a search of the absolute entries of PATH (with PATHEXT on
 * Windows). The working folder is never searched; a relative PATH entry is skipped.
 */
export function resolveOnPath(cmd, env, platform) {
  const win = platform === 'win32';
  const flavor = win ? path.win32 : path.posix;
  const isFile = file => { try { return fs.statSync(file).isFile(); } catch { return false; } };
  if (flavor.isAbsolute(cmd)) return isFile(cmd) ? cmd : null;
  if (/[\\/]/.test(cmd)) return null;
  const exts = win ? (env.PATHEXT || '.COM;.EXE;.BAT;.CMD').split(';').filter(Boolean) : [''];
  const hasExt = win && flavor.extname(cmd) !== '';
  for (const raw of String(env[pathKey(env)] ?? '').split(win ? ';' : ':')) {
    const dir = raw.replace(/^"|"$/g, '');
    if (!dir || !flavor.isAbsolute(dir)) continue;
    for (const ext of hasExt ? [''] : exts) {
      const file = flavor.join(dir, cmd + ext);
      if (isFile(file)) return file;
    }
  }
  return null;
}

/** The command interpreter, found by a case-insensitive key (Windows spells it COMSPEC or ComSpec) with a fixed fallback. */
function comSpec(env) {
  const key = Object.keys(env).find(k => k.toLowerCase() === 'comspec');
  const root = Object.keys(env).find(k => k.toLowerCase() === 'systemroot');
  return (key && env[key]) || path.win32.join((root && env[root]) || 'C:\Windows', 'System32', 'cmd.exe');
}

/** Bytes to text: UTF-16LE when the stream holds NUL bytes (wsl.exe), else UTF-8. */
function decode(buffer) {
  if (buffer.includes(0)) return buffer.toString('utf16le').replace(/^\ufeff/, '');
  return buffer.toString('utf8');
}

/** End a child and everything it started. Resolves when the process is gone or after a short grace period. */
function killTree(child, platform) {
  return new Promise(resolve => {
    const finish = () => { clearTimeout(grace); resolve(); };
    const grace = setTimeout(resolve, 2000);
    child.once('close', finish);
    try {
      if (platform === 'win32') {
        const t = spawn('taskkill', ['/T', '/F', '/PID', String(child.pid)], { stdio: 'ignore', windowsHide: true });
        t.on('error', () => { try { child.kill('SIGKILL'); } catch { /* gone */ } });
      } else {
        try { process.kill(-child.pid, 'SIGKILL'); } catch { child.kill('SIGKILL'); }
      }
    } catch { try { child.kill('SIGKILL'); } catch { /* gone */ } }
  });
}

/**
 * Run a command with no shell string: an argument array, a hard timeout that ends the whole process tree, a capped output.
 * Never throws. Result: `{ status: 'ok'|'missing'|'timeout'|'error', code, out, stdout }` (`out` is stdout then stderr).
 */
export function realRunner(env, platform) {
  const childEnv = {
    ...env,
    NO_COLOR: '1',
    // Corepack (documented: github.com/nodejs/corepack, configuration) blocks every network fetch with COREPACK_ENABLE_NETWORK=0, so a
    // pnpm or yarn shim that is not cached fails instead of downloading. COREPACK_ENABLE_DOWNLOAD_PROMPT=0 would only hide the URL.
    COREPACK_ENABLE_NETWORK: '0',
    DOTNET_NOLOGO: '1',
    DOTNET_CLI_TELEMETRY_OPTOUT: '1',
  };
  return (cmd, args, { timeoutMs }) => new Promise(resolve => {
    const file = resolveOnPath(cmd, env, platform);
    if (!file) { resolve({ status: 'missing', code: null, out: '', stdout: '' }); return; }
    let command = file;
    let argv = args;
    let verbatim = false;
    if (platform === 'win32' && /\.(cmd|bat)$/i.test(file)) {
      // Node cannot start a batch shim directly. The arguments are the fixed constants of the probe table, never user input.
      command = comSpec(env);
      argv = ['/d', '/s', '/c', `"${file}" ${args.join(' ')}`];
      verbatim = true;
    }
    const chunks = { out: [], err: [] };
    const sizes = { out: 0, err: 0 };
    let settled = false;
    let timer;
    const text = () => {
      const stdout = decode(Buffer.concat(chunks.out));
      return { stdout, out: `${stdout}\n${decode(Buffer.concat(chunks.err))}`.slice(0, OUTPUT_CAP) };
    };
    const done = result => { if (!settled) { settled = true; clearTimeout(timer); resolve(result); } };
    let child;
    try {
      child = spawn(command, argv, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true, windowsVerbatimArguments: verbatim, env: childEnv, cwd: os.tmpdir(), detached: platform !== 'win32' });
    } catch (error) {
      resolve({ status: error?.code === 'ENOENT' ? 'missing' : 'error', code: null, out: '', stdout: '' });
      return;
    }
    const take = which => chunk => {
      if (sizes[which] < OUTPUT_CAP) { chunks[which].push(chunk.subarray(0, OUTPUT_CAP - sizes[which])); sizes[which] += chunk.length; }
    };
    child.stdout.on('data', take('out'));
    child.stderr.on('data', take('err'));
    timer = setTimeout(async () => {
      settled = true;
      await killTree(child, platform);
      child.stdout.destroy();
      child.stderr.destroy();
      child.unref();
      resolve({ status: 'timeout', code: null, out: '', stdout: '' });
    }, timeoutMs);
    child.on('error', error => done({ status: error?.code === 'ENOENT' ? 'missing' : 'error', code: null, out: '', stdout: '' }));
    child.on('close', code => done({ status: 'ok', code, ...text() }));
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
    parallelism: () => (typeof os.availableParallelism === 'function' ? os.availableParallelism() : os.cpus().length),
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
    resolve: cmd => resolveOnPath(cmd, env, process.platform),
    statFile: file => { const st = fs.statSync(file); return { size: st.size, mtimeMs: st.mtimeMs }; },
    concurrency: 6,
    run: realRunner(env, process.platform),
  };
}

// ------------------------------------------------------------------------------------------------ the command line

const HELP = `system-specs: collect the machine facts of this computer into a small sheet.

  node specs.mjs collect [--out <path.md>] [--refresh] [--json]
  node specs.mjs check [--out <path.md>]
  node specs.mjs help

  --out <path.md>     the Markdown file (default ${DEFAULT_OUT.replace(/\\/g, '/')}); must end in .md and stay inside the working folder;
                      the JSON sheet is written beside it
  --refresh           collect again even when a valid sheet of this machine exists (collect reuses one whatever its age)
  --json              print the JSON to stdout and write nothing

check runs no tool and writes nothing: it compares what is on the PATH now with the fingerprint stored in the sheet.

Exit codes: collect 0 written, reused or printed, 1 the sheet could not be written; check 0 unchanged, 3 changed (the names of the
tools that differ), 1 no usable sheet; both 2 for a usage error or a refused --out.
`;

const usage = message => ({ code: 2, out: '', err: `${message}\n\n${HELP}` });
const refuse = message => ({ code: 2, out: '', err: `${message}\n` });

function parseArgs(argv) {
  const [command, ...rest] = argv;
  if (command === undefined) return { error: 'missing command' };
  if (['help', '--help', '-h'].includes(command)) return { command: 'help' };
  if (command !== 'collect' && command !== 'check') return { error: `unknown command "${command}"` };
  const opts = { out: DEFAULT_OUT, refresh: false, json: false };
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === '--refresh' && command === 'collect') opts.refresh = true;
    else if (a === '--json' && command === 'collect') opts.json = true;
    else if (a === '--out') {
      const value = rest[++i];
      if (value === undefined) return { error: `${a} needs a value` };
      opts.out = value;
        } else return { error: `unknown option "${a}"` };
  }
  return { command, opts };
}

const readText = file => { try { return fs.readFileSync(file, 'utf8'); } catch { return null; } };
const isSheetMarkdown = text => typeof text === 'string' && text.replace(/^\ufeff/, '').split(/\r?\n/, 1)[0].trim() === SHEET_HEADER;

/** Where the sheet goes, or why not: inside the working folder, a .md file, never over a file that is not a sheet. */
function planOutput(out, cwd) {
  if (!/\.md$/i.test(out)) return { error: 'the --out file must end in .md' };
  const mdFile = path.resolve(cwd, out);
  const rel = path.relative(cwd, mdFile);
  if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) return { error: 'the --out file must stay inside the working folder' };
  const jsonFile = path.join(path.dirname(mdFile), `${path.basename(mdFile, path.extname(mdFile))}.json`);
  const md = readText(mdFile);
  if (md !== null && md.trim() !== '' && !isSheetMarkdown(md)) return { error: `refusing to overwrite ${path.basename(mdFile)}: its first line is not "${SHEET_HEADER}"${out === DEFAULT_OUT ? '. Delete that file (it is not a sheet) and run collect again.' : ''}` };
  const json = readText(jsonFile);
  if (json !== null && json.trim() !== '') {
    const parsed = safely(() => JSON.parse(json), null);
    const ours = isObject(parsed) ? typeof parsed.schemaVersion === 'number' : parsed === null && isSheetMarkdown(md);
    if (!ours) return { error: `refusing to overwrite ${path.basename(jsonFile)}: the .json file beside the sheet is not a system-specs sheet` };
  }
  const shown = path.isAbsolute(out) ? rel.replace(/\\/g, '/') : out.replace(/\\/g, '/');
  return { mdFile, jsonFile, shown };
}

/** Write through a temporary file in the same folder, then rename, so a reader never sees half a file. */
function writeAtomic(file, text) {
  const tmp = path.join(path.dirname(file), `.${path.basename(file)}.${crypto.randomBytes(4).toString('hex')}.tmp`);
  try {
    fs.writeFileSync(tmp, text, { flag: 'wx' });
    fs.renameSync(tmp, file);
  } catch (error) {
    try { fs.unlinkSync(tmp); } catch { /* not created */ }
    throw error;
  }
}

/** The cached sheet when it is valid and from this machine, else null. Its age does not matter: collection happens once. */
function usableSheet(plan, deps) {
  const raw = readText(plan.jsonFile);
  if (raw === null || !isSheetMarkdown(readText(plan.mdFile))) return null;
  const sheet = validateSheet(safely(() => JSON.parse(raw), null));
  if (!sheet) return null;
  const here = { family: { win32: 'windows', darwin: 'macos', linux: 'linux' }[deps.platform] ?? 'other', architecture: String(deps.arch), memoryGiB: positiveInt(safely(() => deps.totalmem(), 0) / GiB) };
  if (sheet.os.family !== here.family || sheet.os.architecture !== here.architecture || sheet.memoryGiB !== here.memoryGiB) return null;
  return sheet;
}

/** Reuse a usable sheet; its Markdown is rewritten from the validated JSON, never trusted from disk. Null means: collect. */
function reuse(plan, deps) {
  const sheet = usableSheet(plan, deps);
  if (!sheet) return null;
  try { writeAtomic(plan.mdFile, renderMarkdown(sheet)); } catch { return null; }
  return sheet;
}

/** Read-only: compare the PATH now with the fingerprint in the sheet. No tool is run and nothing is written. */
function checkSheet(plan, deps) {
  const sheet = usableSheet(plan, deps);
  if (!sheet) return { code: 1, out: '', err: 'no usable sheet: run collect first (it is missing, damaged, edited, or from another machine)\n' };
  const now = computeFingerprint(deps);
  if (now.hash === sheet.fingerprint.hash) return { code: 0, out: `unchanged (sheet collected ${sheet.collectedAt})\n`, err: '' };
  const changed = Object.keys(now.parts).filter(name => now.parts[name] !== sheet.fingerprint.parts[name]);
  return { code: 3, out: `changed: ${changed.join(', ')}\n`, err: '' };
}

/** The default folder keeps its own files out of git: a `.gitignore` with `*`. Returns a note when one exists with other content. */
function ignoreOwnFolder(plan, cwd) {
  if (path.relative(cwd, path.dirname(plan.mdFile)) !== path.dirname(DEFAULT_OUT)) return '';
  const file = path.join(path.dirname(plan.mdFile), '.gitignore');
  const existing = readText(file);
  if (existing === null) { fs.writeFileSync(file, '*\n', { flag: 'wx' }); return ''; }
  return existing.trim() === '*' || existing.trim() === '' ? '' : ` Note: ${path.dirname(DEFAULT_OUT).replace(/\\/g, '/')}/.gitignore already has other content and was left alone, so check that the sheet is ignored.`;
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

  const cwd = deps.cwd();
  const plan = planOutput(opts.out, cwd);
  if (plan.error) return refuse(plan.error);
  if (parsed.command === 'check') return checkSheet(plan, deps);

  if (!opts.refresh) {
    const fresh = reuse(plan, deps);
    if (fresh) return { code: 0, out: `System specs reused (collected ${fresh.collectedAt}): ${plan.shown}\n`, err: '' };
  }

  const sheet = await collectSpecs(deps);
  let note = '';
  try {
    fs.mkdirSync(path.dirname(plan.mdFile), { recursive: true });
    note = ignoreOwnFolder(plan, cwd);
    writeAtomic(plan.mdFile, renderMarkdown(sheet));
    writeAtomic(plan.jsonFile, `${JSON.stringify(sheet, null, 2)}\n`);
  } catch (error) {
    return { code: 1, out: '', err: `could not write the sheet (${error?.code ?? 'error'}); use --json to print it instead\n` };
  }
  return { code: 0, out: `System specs written: ${plan.shown} (and the .json beside it)${note}\n`, err: '' };
}

const isMain = (() => {
  try { return !!process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url)); } catch { return false; }
})();

if (isMain) {
  runCli(process.argv.slice(2), defaultDeps()).then(r => {
    // Exit explicitly once the output is flushed: a probe that outlived its timeout must never keep the process alive.
    const finish = () => process.exit(r.code);
    const writeErr = () => (r.err ? process.stderr.write(r.err, finish) : finish());
    if (r.out) process.stdout.write(r.out, writeErr); else writeErr();
  });
}
