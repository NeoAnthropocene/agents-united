import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { resolveFfmpeg, verifyFfmpeg } from '../../audiovisual-review/scripts/ffmpeg.mjs';
import { compareReleaseVersions, fetchLatestVersions } from './check-release.mjs';
import { REMOTION_VERSION } from './project.mjs';

function absolute(value, name) {
  if (typeof value !== 'string' || !path.isAbsolute(value)) throw new Error(`${name} must be an absolute path`);
  return path.normalize(value);
}
function regularFile(file) {
  try { return fs.statSync(file).isFile(); } catch { return false; }
}
function validate(options) {
  const project = absolute(options.project, 'project');
  try { if (!fs.statSync(project).isDirectory()) throw new Error(); }
  catch { throw new Error('project must be an existing directory'); }
  const ffmpeg = options.ffmpeg === undefined ? undefined : absolute(options.ffmpeg, 'ffmpeg');
  if (ffmpeg && !regularFile(ffmpeg)) throw new Error('ffmpeg must be an existing regular file');
  const browser = options.browser === undefined ? undefined : absolute(options.browser, 'browser');
  return { project, ffmpeg, browser, checkRelease: options.checkRelease === true };
}

/** One read-only report. Dependencies can be substituted for deterministic local tests. */
export async function diagnose(options, dependencies = {}) {
  const input = validate(options);
  const resolve = dependencies.resolveFfmpeg ?? resolveFfmpeg;
  const verify = dependencies.verifyFfmpeg ?? verifyFfmpeg;
  let systemProbe = dependencies.probe;
  const fetchVersions = dependencies.fetchLatestVersions ?? fetchLatestVersions;
  const checks = {
    browser: input.browser
      ? { status: regularFile(input.browser) ? 'passed' : 'missing', path: input.browser, launchVerified: false }
      : { status: 'unverified', launchVerified: false },
    hostSkillInvocation: { status: 'unverified' },
    release: { status: 'unverified', networkFreshness: 'unverified' },
  };
  try {
    const resolution = resolve({ project: input.project, explicit: input.ffmpeg });
    const capability = resolution.path ? verify(resolution.path) : null;
    checks.ffmpeg = { status: capability?.ok ? 'passed' : !resolution.exists && !capability?.version ? 'missing' : 'failed', resolution, capability };
  } catch { checks.ffmpeg = { status: 'failed', error: 'FFmpeg check failed' }; }
  if (!systemProbe) {
    try { ({ probe: systemProbe } = await import('../../audio-generation/scripts/probe-system.mjs')); }
    catch { checks.system = { status: 'unverified', error: 'system probe unavailable' }; }
  }
  if (systemProbe) {
    try {
      const facts = await systemProbe({ project: input.project });
      checks.system = { status: 'passed', facts, modelRunsVerified: false };
    } catch { checks.system = { status: 'failed', error: 'system probe failed' }; }
  }
  if (input.checkRelease) {
    try {
      const latest = await fetchVersions();
      const comparison = compareReleaseVersions(REMOTION_VERSION, latest);
      checks.release = { status: comparison.upToDate ? 'passed' : 'failed', networkFreshness: 'checked', comparison };
    } catch { checks.release = { status: 'failed', networkFreshness: 'unverified', error: 'release lookup failed' }; }
  }
  return { schemaVersion: 1, recordedAt: new Date().toISOString(), project: input.project, productionReady: false, checks };
}

function parse(args) {
  const result = {};
  const names = { '--project': 'project', '--ffmpeg': 'ffmpeg', '--browser': 'browser' };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--check-release' && result.checkRelease === undefined) { result.checkRelease = true; continue; }
    const key = names[arg];
    if (!key || result[key] !== undefined || !args[i + 1] || args[i + 1].startsWith('--')) throw new Error('invalid arguments');
    result[key] = args[++i];
  }
  return result;
}

let isEntry = false;
try { isEntry = Boolean(process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href); } catch { /* imported */ }
if (isEntry) {
  try { process.stdout.write(`${JSON.stringify(await diagnose(parse(process.argv.slice(2))), null, 2)}\n`); }
  catch { process.stderr.write('diagnose: invalid arguments or fatal diagnostic error\n'); process.exitCode = 2; }
}

