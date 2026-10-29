import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

/**
 * FFmpeg capability resolution for the media pipeline.
 *
 * Order of preference: an explicit path, `FFMPEG_PATH`, the project's own `ffmpeg-static`,
 * a platform-static default inside the project, then `ffmpeg` on PATH.
 *
 * `verify` checks the capabilities this repository actually needs (amix with normalize,
 * loudnorm, libx264, aac). A build that plays MP4 can still be unusable for the mix.
 *
 * Nothing here installs or changes the machine by default: `plan` only prints the commands, and
 * `install` refuses to act without explicit consent. A PATH edit is a separate, opt-in flag that
 * prints the exact change and how to undo it.
 */

export const SCHEMA_VERSION = 1;
export const REQUIRED_FILTERS = Object.freeze(['amix', 'loudnorm']);
export const REQUIRED_ENCODERS = Object.freeze(['libx264', 'aac']);

const EXE = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';

function candidateList({ project, explicit, env, platform }) {
  const exe = platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
  const list = [];
  if (explicit) list.push({ source: 'explicit', path: path.resolve(explicit) });
  if (env?.FFMPEG_PATH) list.push({ source: 'env:FFMPEG_PATH', path: path.resolve(env.FFMPEG_PATH) });
  if (project) {
    list.push({ source: 'project:ffmpeg-static', path: path.join(project, 'node_modules', 'ffmpeg-static', exe) });
    list.push({ source: 'project:bin', path: path.join(project, 'media', 'native', 'node_modules', 'ffmpeg-static', exe) });
  }
  list.push({ source: 'path', path: 'ffmpeg' });
  return list;
}

/** Pure resolution: the first candidate that exists on disk, or the PATH fallback. */
export function resolveFfmpeg(options = {}) {
  const { project = null, explicit = null, env = process.env, platform = process.platform } = options;
  const exists = options.exists ?? (candidate => fs.existsSync(candidate));
  const candidates = candidateList({ project, explicit, env, platform });
  for (const candidate of candidates) {
    if (candidate.path === 'ffmpeg') return { ...candidate, resolved: false, exists: true };
    if (exists(candidate.path)) return { ...candidate, resolved: true, exists: true };
  }
  return { source: 'none', path: null, resolved: false, exists: false };
}

function spawnText(command, args, timeout = 8000) {
  const result = spawnSync(command, args, {
    encoding: 'utf8', timeout, windowsHide: true, shell: false, stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.error) return null;
  return `${result.stdout ?? ''}${result.stderr ?? ''}`;
}

/** Check the binary really is a usable FFmpeg for this pipeline. */
export function verifyFfmpeg(binary, options = {}) {
  const run = options.run ?? spawnText;
  const versionOut = run(binary, ['-hide_banner', '-version']);
  if (!versionOut) {
    return { ok: false, binary, version: null, build: null, missing: ['binary did not answer -version'], notes: [] };
  }
  const version = /ffmpeg version (\S+)/i.exec(versionOut)?.[1] ?? null;
  const build = /^configuration:.*$/m.exec(versionOut)?.[0]?.slice(0, 200) ?? null;

  const missing = [];
  const notes = [];
  for (const filter of REQUIRED_FILTERS) {
    const help = run(binary, ['-hide_banner', '-h', `filter=${filter}`]);
    if (!help || /Unknown filter/i.test(help)) missing.push(`filter:${filter}`);
    else if (filter === 'amix' && !/normalize/i.test(help)) notes.push('amix has no normalize option; the mix must not rely on it');
  }
  const encoders = run(binary, ['-hide_banner', '-encoders']) ?? '';
  for (const encoder of REQUIRED_ENCODERS) {
    if (!new RegExp(`\\b${encoder}\\b`).test(encoders)) missing.push(`encoder:${encoder}`);
  }
  return { ok: missing.length === 0, binary, version, build, missing, notes };
}

/** The install options for this platform. Printing them is free; running them is not. */
export function planInstall(options = {}) {
  const { platform = process.platform, project = null } = options;
  const steps = [];
  if (project) {
    steps.push({
      id: 'project-local',
      recommended: true,
      reason: 'no admin rights, reproducible per project, stays inside the project folder',
      command: 'npm install --save-dev ffmpeg-static',
      cwd: project,
      verifies: ['binary exists at node_modules/ffmpeg-static', 'verify reports ok'],
    });
  }
  if (platform === 'win32') {
    steps.push({
      id: 'user-wide-winget',
      recommended: false,
      reason: 'machine-wide tool; needs consent and an explicit PATH decision',
      command: 'winget install --id Gyan.FFmpeg --exact --accept-package-agreements --accept-source-agreements',
      note: 'then reopen the shell so the new PATH is visible, or add the bin folder explicitly',
    });
  } else if (platform === 'darwin') {
    steps.push({ id: 'user-wide-brew', recommended: false, command: 'brew install ffmpeg', note: 'Homebrew installs into /opt/homebrew/bin or /usr/local/bin' });
  } else {
    steps.push({ id: 'user-wide-apt', recommended: false, command: 'sudo apt-get install -y ffmpeg', note: 'distribution builds vary: verify filters and encoders afterwards' });
  }
  return { platform, steps, verified: false };
}

/** Runs an install step only with explicit consent. Never edits PATH here. */
export function installFfmpeg(mode, options = {}) {
  if (options.consent !== true) {
    throw new Error('ffmpeg install requires explicit consent (--consent) from the user or the orchestrator.');
  }
  const plan = planInstall(options);
  const step = plan.steps.find(entry => entry.id === mode);
  if (!step) throw new Error(`unknown install mode "${mode}"; use ${plan.steps.map(s => s.id).join(', ')}`);
  if (!step.recommended && options.allowSystemInstall !== true) {
    throw new Error(`${mode} changes the machine beyond this project; pass --allow-system-install as well.`);
  }
  const run = options.run ?? ((command, args, cwd) => spawnSync(command, args, {
    cwd, encoding: 'utf8', windowsHide: true, shell: true, stdio: 'pipe',
  }));
  const [command, ...args] = step.command.split(' ');
  const result = run(command, args, step.cwd ?? options.project ?? process.cwd());
  return { mode, command: step.command, exit: result?.status ?? null, stdout: result?.stdout ?? '', stderr: result?.stderr ?? '' };
}

/**
 * Add a directory to the user PATH, idempotently. Windows writes the user-scope variable; other
 * platforms only print the line for the user's shell profile. Returns the undo instruction.
 */
export function addToUserPath(directory, options = {}) {
  if (options.consent !== true) throw new Error('editing PATH requires explicit consent (--consent).');
  const { platform = process.platform } = options;
  const dir = path.resolve(directory);
  const read = options.readPath ?? (() => spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command',
    "[Environment]::GetEnvironmentVariable('Path','User')"], { encoding: 'utf8', windowsHide: true }).stdout?.trim() ?? '');
  const write = options.writePath ?? (value => spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command',
    `[Environment]::SetEnvironmentVariable('Path', ${JSON.stringify(value)}, 'User')`], { encoding: 'utf8', windowsHide: true }));

  if (platform !== 'win32') {
    return {
      changed: false,
      directory: dir,
      instruction: `Add this line to your shell profile: export PATH="${dir}:$PATH"`,
      undo: 'remove that line',
    };
  }
  const current = read() ?? '';
  const parts = current.split(';').map(part => part.trim()).filter(Boolean);
  if (parts.some(part => part.toLowerCase() === dir.toLowerCase())) {
    return { changed: false, directory: dir, instruction: 'already present on the user PATH', undo: 'none needed' };
  }
  const next = [...parts, dir].join(';');
  write(next);
  return {
    changed: true,
    directory: dir,
    previousLength: current.length,
    nextLength: next.length,
    undo: `[Environment]::SetEnvironmentVariable('Path', ${JSON.stringify(current)}, 'User')`,
  };
}

function main(args) {
  const command = args[0];
  const flag = name => args.includes(name);
  const value = name => { const index = args.indexOf(name); return index === -1 ? undefined : args[index + 1]; };
  const project = value('--project') ?? process.cwd();

  if (command === 'resolve') {
    const resolved = resolveFfmpeg({ project, explicit: value('--ffmpeg') });
    console.log(JSON.stringify({ schemaVersion: SCHEMA_VERSION, ...resolved }, null, 2));
    return resolved.path ? 0 : 2;
  }
  if (command === 'verify') {
    const resolved = resolveFfmpeg({ project, explicit: value('--ffmpeg') });
    if (!resolved.path) { console.error('ffmpeg: no binary found; run plan'); return 2; }
    const report = verifyFfmpeg(resolved.path);
    console.log(JSON.stringify({ schemaVersion: SCHEMA_VERSION, source: resolved.source, ...report }, null, 2));
    return report.ok ? 0 : 1;
  }
  if (command === 'plan') {
    console.log(JSON.stringify({ schemaVersion: SCHEMA_VERSION, ...planInstall({ project }) }, null, 2));
    return 0;
  }
  if (command === 'install') {
    try {
      const result = installFfmpeg(value('--mode') ?? 'project-local', {
        consent: flag('--consent'), allowSystemInstall: flag('--allow-system-install'), project,
      });
      console.log(JSON.stringify({ schemaVersion: SCHEMA_VERSION, ...result }, null, 2));
      return result.exit === 0 ? 0 : 1;
    } catch (error) {
      console.error(`ffmpeg: ${error.message}`);
      return 2;
    }
  }
  if (command === 'path') {
    try {
      const result = addToUserPath(value('--add') ?? '', { consent: flag('--consent') });
      console.log(JSON.stringify({ schemaVersion: SCHEMA_VERSION, ...result }, null, 2));
      return 0;
    } catch (error) {
      console.error(`ffmpeg: ${error.message}`);
      return 2;
    }
  }
  console.error('usage: ffmpeg.mjs resolve|verify|plan|install|path [--project <dir>] [--ffmpeg <binary>] [--mode project-local|user-wide-winget|user-wide-brew|user-wide-apt] [--add <dir>] [--consent] [--allow-system-install]');
  return 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main(process.argv.slice(2));
}
