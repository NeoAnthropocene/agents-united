import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { execFileSync, spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const SCRIPT = path.resolve('registry/skills/audio-generation/scripts/probe-system.mjs');
const probeModule = await import(pathToFileURL(SCRIPT));

const laptop = {
  cpu: { model: '13th Gen Intel(R) Core(TM) i7-1360P', logicalCores: 16 },
  memory: { totalGiB: 15.7, freeGiB: 2.7 },
  disk: { path: 'C:\\', freeGiB: 461.6 },
  gpu: { devices: [{ name: 'Intel(R) Iris(R) Xe Graphics', vramGiB: null, integrated: true, vramReliable: false, source: 'wmi' }] },
  tools: { ffmpeg: false, python: true, uv: true, nvidiaSmi: false },
};
const workstation = {
  cpu: { model: 'Threadripper', logicalCores: 32 },
  memory: { totalGiB: 63.5, freeGiB: 40 },
  disk: { path: '/', freeGiB: 900 },
  gpu: { devices: [{ name: 'NVIDIA GeForce RTX 4090', vramGiB: 24, integrated: false, vramReliable: true, source: 'nvidia-smi' }] },
  tools: { ffmpeg: true, python: true, uv: true, nvidiaSmi: true },
};

test('laptop without a dedicated GPU gets the bundled route and no music model', () => {
  const routes = probeModule.decideRoutes(laptop);
  assert.equal(routes['local-bundled'].state, 'recommended');
  assert.equal(routes['local-tts-small'].state, 'recommended');
  assert.equal(routes['local-music'].state, 'not-recommended');
  assert.match(routes['local-music'].missing.join(' '), /dedicated-vram\(0\.0<12GiB\)/);
  assert.equal(routes['local-tts-large'].state, 'viable-with-caveats');
  assert.match(routes['local-tts-large'].caveats.join(' '), /no dedicated GPU/);
  assert.equal(routes['external-provider'].state, 'available-with-consent');
  assert.match(routes['external-provider'].requires.join(' '), /opt-in/);
});

test('a workstation with a 24 GiB GPU is offered local music and large speech', () => {
  const routes = probeModule.decideRoutes(workstation);
  assert.equal(routes['local-music'].state, 'recommended');
  assert.equal(routes['local-tts-large'].state, 'recommended');
  assert.equal(routes['local-asr-large'].state, 'recommended');
  assert.deepEqual(routes['local-music'].missing, []);
});

test('small machines fall back to the bundled route only', () => {
  const routes = probeModule.decideRoutes({
    cpu: { logicalCores: 2 }, memory: { totalGiB: 3.5 }, disk: { freeGiB: 12 },
    gpu: { devices: [] }, tools: { python: false, uv: false },
  });
  assert.equal(routes['local-bundled'].state, 'recommended');
  assert.equal(routes['local-tts-small'].state, 'not-recommended');
  assert.match(routes['local-tts-small'].missing.join(' '), /memory/);
});

test('integrated graphics never count as dedicated VRAM, whatever AdapterRAM says', () => {
  const routes = probeModule.decideRoutes({
    ...workstation,
    gpu: { devices: [{ name: 'AMD Radeon(TM) Graphics', vramGiB: null, integrated: true, vramReliable: false, source: 'wmi' }] },
  });
  assert.equal(routes['local-music'].state, 'not-recommended');
});

test('OS-reported memory is compared with the documented reservation tolerance', () => {
  assert.equal(probeModule.RAM_TOLERANCE_GIB, 0.5);
  const atFloor = probeModule.decideRoutes({ ...workstation, memory: { totalGiB: 15.7 } });
  assert.equal(atFloor['local-music'].missing.some(entry => entry.startsWith('memory')), false);
  const belowFloor = probeModule.decideRoutes({ ...workstation, memory: { totalGiB: 14.9 } });
  assert.equal(belowFloor['local-music'].missing.some(entry => entry.startsWith('memory')), true);
});

test('measurement never fabricates a GPU or a model run', async () => {
  const report = await probeModule.probe({
    platform: 'win32',
    spawnText: (command) => {
      if (command === 'nvidia-smi') return null;
      if (command === 'powershell') return '{"Name":"Intel(R) Iris(R) Xe Graphics","AdapterRAM":1073741824,"DriverVersion":"31.0.101.4314"}';
      return null;
    },
    statfs: () => ({ bsize: 4096, bavail: 1024 * 1024 }),
  });
  assert.equal(report.schemaVersion, 1);
  assert.equal(report.gpu.devices.length, 1);
  assert.equal(report.gpu.devices[0].integrated, true);
  assert.equal(report.gpu.dedicatedVramGiB, 0);
  assert.match(report.gpu.note, /not reliably reported/);
  assert.deepEqual(report.verified, { modelRuns: false, listening: false, installedModels: false });
  assert.match(report.caveat, /planning floors/i);
  const text = JSON.stringify(report).toLowerCase();
  for (const secret of ['api_key', 'apikey', 'password', 'secret', 'token']) assert.equal(text.includes(secret), false, secret);
});

test('the CLI writes a record once and refuses to overwrite it silently', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'probe-system-'));
  try {
    const target = path.join(dir, 'media/specs/system-capability.json');
    const first = spawnSync(process.execPath, [SCRIPT, '--out', target], { encoding: 'utf8' });
    assert.equal(first.status, 0, first.stderr);
    const written = JSON.parse(fs.readFileSync(target, 'utf8'));
    assert.equal(written.schemaVersion, 1);
    assert.ok(written.routes['local-bundled']);

    const second = spawnSync(process.execPath, [SCRIPT, '--out', target], { encoding: 'utf8' });
    assert.equal(second.status, 2);
    assert.match(second.stderr, /already exists/);

    const forced = spawnSync(process.execPath, [SCRIPT, '--out', target, '--force'], { encoding: 'utf8' });
    assert.equal(forced.status, 0, forced.stderr);

    const unknown = spawnSync(process.execPath, [SCRIPT, '--bogus'], { encoding: 'utf8' });
    assert.equal(unknown.status, 2);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('reports FFmpeg on PATH and in the project separately', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'probe-ffmpeg-'));
  try {
    fs.mkdirSync(path.join(dir, 'node_modules', 'ffmpeg-static'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'node_modules', 'ffmpeg-static', process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'), '');
    const report = await probeModule.probe({
      platform: process.platform,
      project: dir,
      spawnText: () => null,
      statfs: () => ({ bsize: 4096, bavail: 1024 }),
    });
    assert.equal(report.tools.ffmpegOnPath, false);
    assert.equal(report.tools.ffmpegProjectLocal, true);
    const text = fs.readFileSync(path.resolve('registry/skills/audio-generation/references/system-capability.md'), 'utf8');
    assert.match(text, /ffmpegOnPath/);
    assert.match(text, /ffmpegProjectLocal/);
    assert.match(text, /not a missing FFmpeg/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('disk measurement targets the project filesystem rather than the cwd volume root', async () => {
  const project = path.resolve('project-volume');
  let measured;
  const report = await probeModule.probe({
    project, spawnText: () => null,
    statfs: target => { measured = target; return { bsize: 4096, bavail: 1024 }; },
  });
  assert.equal(measured, project);
  assert.equal(report.disk.path, project);
});

test('CLI --out uses cwd as project, supports --project, and measurement is read-only', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'probe-project-cli-'));
  try {
    const bin = path.join(dir, 'node_modules', 'ffmpeg-static', process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
    fs.mkdirSync(path.dirname(bin), { recursive: true });
    fs.writeFileSync(bin, 'detection only; do not execute');
    const before = fs.readdirSync(dir, { recursive: true }).sort();
    const run = args => spawnSync(process.execPath, [SCRIPT, ...args], {
      cwd: dir, encoding: 'utf8', env: { ...process.env, PATH: '' },
    });
    const measured = run([]);
    assert.equal(measured.status, 0, measured.stderr);
    const report = JSON.parse(measured.stdout);
    assert.equal(report.tools.ffmpegProjectLocal, true);
    assert.deepEqual(fs.readdirSync(dir, { recursive: true }).sort(), before);
    assert.equal(fs.readFileSync(bin, 'utf8'), 'detection only; do not execute');

    const recorded = run(['--out', 'media/specs/system-capability.json']);
    assert.equal(recorded.status, 0, recorded.stderr);
    const written = JSON.parse(fs.readFileSync(path.join(dir, 'media/specs/system-capability.json'), 'utf8'));
    assert.equal(written.tools.ffmpegProjectLocal, true);
    assert.equal(written.disk.path, dir);
    assert.deepEqual(fs.readdirSync(dir, { recursive: true }).sort(),
      [...before, 'media', path.join('media', 'specs'), path.join('media', 'specs', 'system-capability.json')].sort());

    const other = path.join(dir, 'elsewhere');
    fs.mkdirSync(other);
    const explicit = run(['--project', other]);
    assert.equal(explicit.status, 0, explicit.stderr);
    assert.equal(JSON.parse(explicit.stdout).disk.path, other);
    assert.equal(JSON.parse(explicit.stdout).tools.ffmpegProjectLocal, false);
    assert.deepEqual(fs.readdirSync(other), []);
    const invalid = run(['--project']);
    assert.equal(invalid.status, 2);
    assert.match(invalid.stderr, /--project needs/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('the documented floor table matches the script', () => {
  const doc = fs.readFileSync(path.resolve('registry/skills/audio-generation/references/system-capability.md'), 'utf8');
  for (const [route, floor] of Object.entries(probeModule.FLOORS)) {
    assert.ok(doc.includes(route), `${route} missing from the reference`);
    assert.ok(doc.includes(String(floor.ramGiB)), `${route} memory floor missing`);
    assert.ok(doc.includes(String(floor.vramGiB)), `${route} vram floor missing`);
  }
  assert.match(doc, /probe-system\.mjs/);
  assert.match(doc, /not proof that any model runs/i);
});

test('the installed script runs standalone without dependencies', () => {
  const output = execFileSync(process.execPath, [SCRIPT], { encoding: 'utf8' });
  const report = JSON.parse(output);
  assert.equal(typeof report.cpu.logicalCores, 'number');
  assert.ok(report.routes['local-bundled'].state);
});
