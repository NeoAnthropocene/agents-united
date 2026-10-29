import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const SCRIPT = path.resolve('registry/skills/audiovisual-review/scripts/ffmpeg.mjs');
const ffmpeg = await import(pathToFileURL(SCRIPT));

const FULL_VERSION = 'ffmpeg version 6.1.1-essentials_build-www.gyan.dev Copyright (c) 2000-2024\nconfiguration: --enable-gpl --enable-libx264\n';

function fakeRun(map) {
  return (binary, args) => {
    const key = args.join(' ');
    if (key === '-hide_banner -version') return map.version ?? FULL_VERSION;
    if (key === '-hide_banner -h filter=amix') return map.amix ?? 'Filter amix\n  normalize <boolean> .. default true';
    if (key === '-hide_banner -h filter=loudnorm') return map.loudnorm ?? 'Filter loudnorm\n  I <double>';
    if (key === '-hide_banner -encoders') return map.encoders ?? ' V....D libx264  H.264\n A....D aac  AAC';
    return map.other ?? '';
  };
}

test('resolution prefers explicit, then env, then the project static build, then PATH', () => {
  const exists = candidate => /explicit\.exe$/.test(candidate) || /[\\/]env[\\/]/.test(candidate) || candidate.includes('ffmpeg-static');
  const explicit = ffmpeg.resolveFfmpeg({ explicit: 'explicit.exe', env: { FFMPEG_PATH: 'C:/env/ffmpeg.exe' }, project: 'C:/p', platform: 'win32', exists });
  assert.equal(explicit.source, 'explicit');
  const fromEnv = ffmpeg.resolveFfmpeg({ env: { FFMPEG_PATH: 'C:/env/ffmpeg.exe' }, project: 'C:/p', platform: 'win32', exists });
  assert.equal(fromEnv.source, 'env:FFMPEG_PATH');
  const fromProject = ffmpeg.resolveFfmpeg({ env: {}, project: 'C:/p', platform: 'win32', exists });
  assert.equal(fromProject.source, 'project:ffmpeg-static');
  assert.match(fromProject.path, /ffmpeg\.exe$/);
  const fallback = ffmpeg.resolveFfmpeg({ env: {}, project: null, platform: 'linux', exists: () => false });
  assert.equal(fallback.source, 'path');
  assert.equal(fallback.resolved, false);
});

test('verification accepts a complete build', () => {
  const report = ffmpeg.verifyFfmpeg('ffmpeg', { run: fakeRun({}) });
  assert.equal(report.ok, true);
  assert.equal(report.version, '6.1.1-essentials_build-www.gyan.dev');
  assert.deepEqual(report.missing, []);
});

test('verification rejects a build that can play an MP4 but cannot mix', () => {
  const report = ffmpeg.verifyFfmpeg('ffmpeg', { run: fakeRun({ amix: 'Unknown filter', encoders: ' A....D aac  AAC' }) });
  assert.equal(report.ok, false);
  assert.ok(report.missing.includes('filter:amix'));
  assert.ok(report.missing.includes('encoder:libx264'));
});

test('a missing binary is reported, not assumed', () => {
  const report = ffmpeg.verifyFfmpeg('nope', { run: () => null });
  assert.equal(report.ok, false);
  assert.match(report.missing[0], /did not answer/);
});

test('an amix without normalize is a caveat, not a silent pass', () => {
  const report = ffmpeg.verifyFfmpeg('ffmpeg', { run: fakeRun({ amix: 'Filter amix' }) });
  assert.equal(report.ok, true);
  assert.match(report.notes.join(' '), /no normalize/);
});

test('the plan recommends the project-local install and prints the system alternative', () => {
  const plan = ffmpeg.planInstall({ platform: 'win32', project: 'C:/p' });
  const local = plan.steps.find(step => step.id === 'project-local');
  assert.equal(local.recommended, true);
  assert.match(local.command, /npm install --save-dev ffmpeg-static/);
  const system = plan.steps.find(step => step.id === 'user-wide-winget');
  assert.equal(system.recommended, false);
  assert.equal(plan.verified, false);
});

test('install refuses without consent, and a system install needs both flags', () => {
  assert.throws(() => ffmpeg.installFfmpeg('project-local', { project: 'C:/p' }), /consent/i);
  assert.throws(() => ffmpeg.installFfmpeg('user-wide-winget', { project: 'C:/p', consent: true }), /allow-system-install/i);
  let ran = null;
  const result = ffmpeg.installFfmpeg('project-local', {
    project: 'C:/p', consent: true, run: (command, args, cwd) => { ran = { command, args, cwd }; return { status: 0, stdout: 'ok', stderr: '' }; },
  });
  assert.equal(result.exit, 0);
  assert.equal(ran.command, 'npm');
});

test('PATH editing is idempotent, prints an undo, and refuses without consent', () => {
  assert.throws(() => ffmpeg.addToUserPath('C:/tools/ffmpeg/bin'), /consent/i);
  let written = null;
  const first = ffmpeg.addToUserPath('C:/tools/ffmpeg/bin', {
    consent: true, platform: 'win32',
    readPath: () => 'C:\\Windows;C:\\Tools',
    writePath: value => { written = value; },
  });
  assert.equal(first.changed, true);
  assert.equal(written, 'C:\\Windows;C:\\Tools;C:\\tools\\ffmpeg\\bin');
  assert.match(first.undo, /SetEnvironmentVariable/);
  const second = ffmpeg.addToUserPath('C:\\tools\\ffmpeg\\bin', {
    consent: true, platform: 'win32', readPath: () => written, writePath: () => { throw new Error('must not write twice'); },
  });
  assert.equal(second.changed, false);
  const posix = ffmpeg.addToUserPath('/usr/local/bin', { consent: true, platform: 'linux' });
  assert.equal(posix.changed, false);
  assert.match(posix.instruction, /export PATH/);
});

test('the roles and skills that must check FFmpeg actually reference the resolver', () => {
  const files = [
    'registry/skills/audiovisual-review/SKILL.md',
    'registry/skills/audiovisual-review/references/ffmpeg.md',
    'registry/skills/native-motion-production/references/runtime.md',
    'registry/agents/subagent-motion-designer.md',
    'registry/hosts/claude/agents/agency-motion-designer.md',
    'registry/agents/orchestrator-digital-agency.md',
    'registry/hosts/claude/agents/orchestrator-digital-agency.md',
  ];
  for (const file of files) {
    const text = fs.readFileSync(path.resolve(file), 'utf8');
    assert.match(text, /ffmpeg/i, `${file} does not mention ffmpeg`);
  }
  for (const file of files.slice(0, 3)) {
    const text = fs.readFileSync(path.resolve(file), 'utf8');
    assert.match(text, /ffmpeg\.mjs|FFmpeg provisioning/, `${file} does not reference the shared resolver`);
  }
  for (const file of files.slice(3)) {
    const text = fs.readFileSync(path.resolve(file), 'utf8');
    assert.match(text, /ffmpeg\.mjs/, `${file} does not reference the shared resolver`);
    assert.match(text, /consent/i, `${file} does not gate the machine-wide change on consent`);
  }
  const doc = fs.readFileSync(path.resolve('registry/skills/audiovisual-review/references/ffmpeg.md'), 'utf8');
  assert.match(doc, /project-local/);
  assert.match(doc, /--allow-system-install/);
  assert.match(doc, /undo/i);
  assert.match(doc, /amix normalize/);
});

test('the CLI prints a resolve report for a missing project without inventing a path', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ffmpeg-resolve-'));
  try {
    const result = spawnSync(process.execPath, [SCRIPT, 'resolve', '--project', dir], {
      encoding: 'utf8', env: { ...process.env, FFMPEG_PATH: '' },
    });
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.schemaVersion, 1);
    assert.ok(['path', 'none'].includes(parsed.source));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('the CLI refuses an unconsented install and prints a plan without side effects', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ffmpeg-plan-'));
  try {
    const noConsent = spawnSync(process.execPath, [SCRIPT, 'install', '--project', dir], { encoding: 'utf8' });
    assert.equal(noConsent.status, 2);
    assert.match(noConsent.stderr, /consent/i);
    const plan = spawnSync(process.execPath, [SCRIPT, 'plan', '--project', dir], { encoding: 'utf8' });
    assert.equal(plan.status, 0);
    const parsed = JSON.parse(plan.stdout);
    assert.ok(parsed.steps.length >= 1);
    assert.deepEqual(fs.readdirSync(dir), []);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
