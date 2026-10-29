import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test, mock } from 'node:test';
import childProcess, { spawnSync } from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { pathToFileURL } from 'node:url';

const SCRIPT = path.resolve('registry/skills/audiovisual-review/scripts/ffmpeg.mjs');
const ffmpeg = await import(pathToFileURL(SCRIPT));

function withSpawn(fake, check) {
  mock.method(childProcess, 'spawnSync', fake);
  syncBuiltinESMExports();
  try { return check(); }
  finally { mock.restoreAll(); syncBuiltinESMExports(); }
}

const FULL_VERSION = 'ffmpeg version 6.1.1-essentials_build-www.gyan.dev Copyright (c) 2000-2024\nconfiguration: --enable-gpl --enable-libx264\n';

const FULL_ENCODERS = ' V....D libx264  H.264\n A....D aac  AAC\n A....D pcm_f32le PCM float\n A....D pcm_s24le PCM 24-bit';

function fakeRun(map) {
  return (binary, args) => {
    const key = args.join(' ');
    if (key === '-hide_banner -version') return map.version ?? FULL_VERSION;
    if (key === '-hide_banner -h filter=amix') return map.amix ?? 'Filter amix\n  normalize <boolean> .. default true';
    if (key === '-hide_banner -h filter=loudnorm') return map.loudnorm ?? 'Filter loudnorm\n  I <double>';
    if (key === '-hide_banner -encoders') return map.encoders ?? FULL_ENCODERS;
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
  assert.equal(fallback.exists, false);
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

test('an amix without normalize is rejected', () => {
  const report = ffmpeg.verifyFfmpeg('ffmpeg', { run: fakeRun({ amix: 'Filter amix' }) });
  assert.equal(report.ok, false);
  assert.ok(report.missing.includes('filter:amix:normalize'));
});

for (const encoder of ['pcm_f32le', 'pcm_s24le']) {
  test(`verification requires mixer encoder ${encoder}`, () => {
    const encoders = FULL_ENCODERS.split('\n').filter(line => !line.includes(encoder)).join('\n');
    const report = ffmpeg.verifyFfmpeg('ffmpeg', { run: fakeRun({ encoders }) });
    assert.equal(report.ok, false);
    assert.ok(report.missing.includes(`encoder:${encoder}`));
  });
}

test('verification rejects output without an FFmpeg version', () => {
  assert.equal(ffmpeg.verifyFfmpeg('ffmpeg', { run: fakeRun({ version: 'not FFmpeg' }) }).ok, false);
});

for (const failedArgs of ['-version', 'filter=amix', 'filter=loudnorm', '-encoders']) {
  test(`verification rejects a nonzero process result for ${failedArgs}`, () => {
    const run = fakeRun({});
    // Inject at the process boundary: realistic-looking output must not override failure.
    const report = withSpawn(
      (binary, args) => ({ status: args.includes(failedArgs) ? 1 : 0, stdout: run(binary, args), stderr: '' }),
      () => ffmpeg.verifyFfmpeg('ffmpeg'),
    );
    assert.equal(report.ok, false);
  });
}

test('project-relative FFmpeg resolution returns an absolute path', () => {
  const result = ffmpeg.resolveFfmpeg({ project: 'relative-project', env: {}, exists: () => true });
  assert.equal(result.path, path.resolve('relative-project', 'node_modules', 'ffmpeg-static', process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'));
  assert.equal(path.isAbsolute(result.path), true);
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
  // winget exists only in the win32 plan: pin the platform so this case does not depend on the host OS (it failed on Linux CI).
  assert.throws(() => ffmpeg.installFfmpeg('user-wide-winget', { project: 'C:/p', consent: true, platform: 'win32' }), /allow-system-install/i);
  let ran = null;
  const result = ffmpeg.installFfmpeg('project-local', {
    project: 'C:/p', consent: true, run: (command, args, cwd) => { ran = { command, args, cwd }; return { status: 0, stdout: 'ok', stderr: '' }; },
  });
  assert.equal(result.exit, 0);
  assert.equal(ran.command, 'npm');
});

test('PATH editing preserves the exact previous value, verifies, and is idempotent', () => {
  const dir = 'C:\\tools\\ffmpeg\\bin';
  assert.throws(() => ffmpeg.addToUserPath(dir), /consent/i);
  const previous = ' C:\\Windows ;;C:\\Tools; ';
  let stored = previous;
  let reads = 0;
  const first = ffmpeg.addToUserPath(dir, {
    consent: true, platform: 'win32', exists: () => true,
    readPath: () => { reads += 1; return stored; },
    writePath: value => { stored = value; },
  });
  assert.equal(first.changed, true);
  assert.equal(stored, `${previous};${dir}`);
  assert.equal(reads, 2);
  assert.match(first.undo, /SetEnvironmentVariable/);
  const encoded = /FromBase64String\('([A-Za-z0-9+/=]*)'\)/.exec(first.undo);
  assert.ok(encoded, 'undo must carry the previous PATH as data, not interpolated code');
  assert.equal(Buffer.from(encoded[1], 'base64').toString('utf8'), previous);
  const second = ffmpeg.addToUserPath(dir.toUpperCase(), {
    consent: true, platform: 'win32', exists: () => true,
    readPath: () => stored, writePath: () => { throw new Error('must not write twice'); },
  });
  assert.equal(second.changed, false);
});

test('PATH rejects empty, relative, missing and non-directory targets before any I/O', () => {
  const options = {
    consent: true, platform: 'win32', exists: () => false,
    readPath: () => assert.fail('must not read'), writePath: () => assert.fail('must not write'),
  };
  for (const dir of ['', '  ', 'relative', 'C:relative', 'C:\\missing']) {
    assert.throws(() => ffmpeg.addToUserPath(dir, options), /absolute|directory/i);
  }
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'path-directory-'));
  try {
    const file = path.join(temp, 'file');
    fs.writeFileSync(file, 'not a directory');
    assert.throws(() => ffmpeg.addToUserPath(file, { ...options, platform: process.platform, exists: undefined }), /directory/i);
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});

test('PATH fails closed on read, write and read-back failures', () => {
  const base = { consent: true, platform: 'win32', exists: () => true };
  const dir = 'C:\\ffmpeg';
  for (const readPath of [() => undefined, () => { throw new Error('read failed'); }]) {
    assert.throws(() => ffmpeg.addToUserPath(dir, { ...base, readPath, writePath: () => assert.fail('must not write') }), /read/i);
  }
  for (const writePath of [() => ({ status: 1 }), () => ({ error: new Error('denied') }), () => { throw new Error('write failed'); }]) {
    assert.throws(() => ffmpeg.addToUserPath(dir, { ...base, readPath: () => 'old', writePath }), /write|denied/i);
  }
  assert.throws(() => ffmpeg.addToUserPath(dir, { ...base, readPath: () => 'old', writePath: () => {} }), /verif|read.back/i);
});

test('PATH preserves empty entries and distinguishes an absent value from a failed read', () => {
  for (const previous of [null, '', 'old;', ' old ;; ']) {
    let stored = previous;
    const result = ffmpeg.addToUserPath('C:\\ffmpeg', {
      consent: true, platform: 'win32', exists: () => true,
      readPath: () => stored, writePath: value => { stored = value; },
    });
    const prefix = previous ?? '';
    assert.equal(stored, `${prefix}${prefix && !prefix.endsWith(';') ? ';' : ''}C:\\ffmpeg`);
    if (previous === null) assert.match(result.undo, /SetEnvironmentVariable\('Path', \$null, 'User'\)/);
    else {
      const encoded = /FromBase64String\('([A-Za-z0-9+/=]*)'\)/.exec(result.undo);
      assert.ok(encoded);
      assert.equal(Buffer.from(encoded[1], 'base64').toString('utf8'), previous);
    }
  }
});

test('a failed read-back reports failure and provides the safe undo command', () => {
  let reads = 0;
  assert.throws(() => ffmpeg.addToUserPath('C:\\ffmpeg', {
    consent: true, platform: 'win32', exists: () => true,
    readPath: () => { if (++reads === 1) return 'old'; throw new Error('read failed'); },
    writePath: () => {},
  }), /read-back verification failed; restore with:.*FromBase64String/);
});

test('PowerShell PATH failures are checked and values are only base64 UTF8 data', () => {
  const dir = 'C:\\tools\\$(throw 1)`雪';
  const previous = '  C:\\old;$(throw 2)`"\'\n雪  ';
  const next = `${previous};${dir}`;
  const output = value => `value:${Buffer.from(value, 'utf8').toString('base64')}`;
  const scripts = [];
  const options = { consent: true, platform: 'win32', exists: () => true };
  const result = withSpawn((command, args) => {
    assert.equal(command, 'powershell');
    scripts.push(args.at(-1));
    return { status: 0, stdout: scripts.length === 1 ? output(previous) : scripts.length === 3 ? output(next) : '', stderr: '' };
  }, () => ffmpeg.addToUserPath(dir, options));
  assert.equal(scripts.length, 3);
  assert.match(scripts[0], /ToBase64String/);
  assert.match(scripts[0], /UTF8/);
  assert.match(scripts[0], /ErrorActionPreference\s*=\s*'Stop'/);
  assert.equal(scripts[0], scripts[2]);
  for (const code of [scripts[1], result.undo]) {
    assert.doesNotMatch(code, /\$\(throw/);
    assert.match(code, /FromBase64String/);
    assert.match(code, /UTF8/);
    assert.match(code, /ErrorActionPreference\s*=\s*'Stop'/);
  }
  assert.ok(scripts[1].includes(Buffer.from(next, 'utf8').toString('base64')));
  for (const failure of [{ status: 1, stdout: '' }, { status: 0, error: new Error('failed'), stdout: '' }, { status: null, signal: 'SIGTERM', stdout: '' }]) {
    withSpawn(() => failure, () => assert.throws(() => ffmpeg.addToUserPath(dir, options), /read/i));
    let calls = 0;
    withSpawn(() => ++calls === 1 ? { status: 0, stdout: output(previous) } : failure,
      () => assert.throws(() => ffmpeg.addToUserPath(dir, options), /write/i));
  }
});

test('PowerShell PATH reads reject missing or malformed output instead of using an empty PATH', () => {
  for (const stdout of [undefined, '', 'old PATH', 'value:%%%']) {
    let calls = 0;
    withSpawn(() => { calls += 1; return { status: 0, stdout }; }, () => {
      assert.throws(() => ffmpeg.addToUserPath('C:\\ffmpeg', {
        consent: true, platform: 'win32', exists: () => true,
      }), /read/i);
    });
    assert.equal(calls, 1, 'failed reads must never reach the write');
  }
});

test('POSIX PATH instructions single-quote shell metacharacters', () => {
  const dir = "/tmp/ffmpeg'$(touch nope)`whoami`";
  const result = ffmpeg.addToUserPath(dir, {
    consent: true, platform: 'linux', exists: () => true,
    readPath: () => assert.fail('must not read'), writePath: () => assert.fail('must not write'),
  });
  assert.equal(result.changed, false);
  assert.equal(result.instruction, `Add this line to your shell profile: export PATH='/tmp/ffmpeg'"'"'$(touch nope)\`whoami\`':"$PATH"`);
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
      encoding: 'utf8', env: { ...process.env, FFMPEG_PATH: '', PATH: '' },
    });
    const parsed = JSON.parse(result.stdout);
    assert.equal(result.status, 2);
    assert.equal(parsed.schemaVersion, 1);
    assert.equal(parsed.exists, false);
    assert.equal(parsed.resolved, false);
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
