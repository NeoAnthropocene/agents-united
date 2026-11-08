import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test, after } from 'node:test';
import { pathToFileURL } from 'node:url';

const script = path.resolve('registry/skills/remotion-production/scripts/diagnose.mjs');
const { diagnose } = await import(pathToFileURL(script));
const project = fs.mkdtempSync(path.join(os.tmpdir(), 'diagnostic-'));
const sentinel = path.join(project, 'sentinel');
fs.writeFileSync(sentinel, 'unchanged');
after(() => fs.rmSync(project, { recursive: true, force: true }));
const deps = {
  resolveFfmpeg: () => ({ source: 'path', path: 'ffmpeg', resolved: false, exists: false }),
  verifyFfmpeg: () => ({ ok: false, missing: ['binary did not answer -version'] }),
  probe: async () => ({ cpu: { logicalCores: 4 }, memory: {}, disk: {}, gpu: {}, tools: { python: false } }),
  fetchLatestVersions: async () => { throw new Error('unexpected fetch'); },
};

test('offline default reports findings, unverified boundaries, and preserves project', async () => {
  const report = await diagnose({ project }, deps);
  assert.equal(report.productionReady, false);
  assert.equal(report.checks.ffmpeg.status, 'missing');
  assert.equal(report.checks.release.status, 'unverified');
  assert.equal(report.checks.hostSkillInvocation.status, 'unverified');
  assert.equal(report.checks.browser.status, 'unverified');
  assert.equal(report.checks.system.facts.tools.python, false);
  assert.equal(fs.readFileSync(sentinel, 'utf8'), 'unchanged');
  assert.deepEqual(fs.readdirSync(project), ['sentinel']);
});

test('reports failed FFmpeg capability without suppressing other checks', async () => {
  const report = await diagnose({ project, browser: path.join(project, 'absent') }, {
    ...deps, resolveFfmpeg: () => ({ source: 'explicit', path: sentinel, resolved: true, exists: true }),
    verifyFfmpeg: () => ({ ok: false, missing: ['encoder:aac'] }),
  });
  assert.equal(report.checks.ffmpeg.status, 'failed');
  assert.deepEqual(report.checks.ffmpeg.capability.missing, ['encoder:aac']);
  assert.equal(report.checks.browser.status, 'missing');
  assert.equal(report.checks.system.status, 'passed');
});

test('release fetch is opt-in and reports drift or registry failure', async () => {
  const drift = await diagnose({ project, checkRelease: true, browser: sentinel }, {
    ...deps, fetchLatestVersions: async () => ({ remotion: '0.0.1' }),
  });
  assert.equal(drift.checks.release.status, 'failed');
  assert.ok(drift.checks.release.comparison.mismatches.includes('remotion'));
  assert.equal(drift.checks.browser.status, 'passed');
  assert.equal(drift.checks.browser.launchVerified, false);
  const failed = await diagnose({ project, checkRelease: true }, deps);
  assert.equal(failed.checks.release.status, 'failed');
  assert.equal(failed.checks.system.status, 'passed');
});

test('invalid CLI inputs fail before diagnostics', () => {
  for (const args of [[], ['--project', 'relative'], ['--project', project, '--ffmpeg', 'relative'], ['--project', project, '--browser', 'relative'], ['--project', project, '--unknown']]) {
    const result = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });
    assert.equal(result.status, 2, result.stderr);
    assert.equal(result.stdout, '');
  }
});

test('isolates probe exceptions and follows a browser file symlink when supported', async () => {
  const link = path.join(project, 'browser-link');
  let browser = sentinel;
  try { fs.symlinkSync(sentinel, link, 'file'); browser = link; } catch { /* Windows may deny symlink creation. */ }
  const report = await diagnose({ project, browser }, {
    ...deps, resolveFfmpeg: () => { throw new Error('private detail'); },
    probe: async () => { throw new Error('private detail'); },
  });
  assert.equal(report.checks.browser.status, 'passed');
  assert.equal(report.checks.browser.launchVerified, false);
  assert.equal(report.checks.ffmpeg.status, 'failed');
  assert.equal(report.checks.system.status, 'failed');
  assert.ok(!JSON.stringify(report).includes('private detail'));
  if (browser === link) fs.unlinkSync(link);
});


test('partial installed layout reports other checks when audio-generation is absent', () => {
  const install = fs.mkdtempSync(path.join(os.tmpdir(), 'partial-skills-'));
  try {
    const remotion = path.join(install, 'remotion-production', 'scripts');
    const av = path.join(install, 'audiovisual-review', 'scripts');
    fs.mkdirSync(remotion, { recursive: true });
    fs.mkdirSync(av, { recursive: true });
    fs.copyFileSync(script, path.join(remotion, 'diagnose.mjs'));
    fs.writeFileSync(path.join(remotion, 'project.mjs'), "export const REMOTION_VERSION = '1.0.0';\n");
    fs.writeFileSync(path.join(remotion, 'check-release.mjs'), 'export const compareReleaseVersions = () => ({}); export const fetchLatestVersions = async () => ({});\n');
    fs.writeFileSync(path.join(av, 'ffmpeg.mjs'), "export const resolveFfmpeg = () => ({path: null, exists: false}); export const verifyFfmpeg = () => ({});\n");
    const result = spawnSync(process.execPath, [path.join(remotion, 'diagnose.mjs'), '--project', project, '--browser', sentinel], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.checks.system.status, 'unverified');
    assert.equal(report.checks.browser.status, 'passed');
    assert.equal(report.checks.ffmpeg.status, 'missing');
    assert.equal(report.checks.release.status, 'unverified');
    assert.ok(Number.isFinite(Date.parse(report.recordedAt)));
  } finally { fs.rmSync(install, { recursive: true, force: true }); }
});
