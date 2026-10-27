import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { test } from 'node:test';
import * as native from '../registry/skills/native-motion-production/scripts/render-native.mjs';
import { defaultPreferences, timelineFingerprint, validatePreferences } from '../registry/skills/audiovisual-review/scripts/review.mjs';

const timeline = { schemaVersion: 1, revision: 'prefs-r1', fps: 60, totalFrames: 60, width: 1920, height: 1080,
  scenes: [{ id: 'scene', startFrame: 0, endFrame: 60 }],
  cues: [{ id: 'voice', kind: 'vo', startFrame: 0, endFrame: 60, text: 'Approved fixture copy.' }] };
const preferences = () => defaultPreferences('native', 'local', false, 0);
const manifest = integratedLufs => ({ schemaVersion: 1, timelineRevision: timeline.revision,
  timelineFingerprint: timelineFingerprint(timeline), fps: 60, totalFrames: 60,
  sampleRate: 48000, channels: 2, master: 'media/audio/master.wav',
  stems: [{ id: 'voice', kind: 'vo', path: 'media/audio/voice.wav' }],
  cues: [{ id: 'voice', path: 'media/audio/voice.wav', startFrame: 0, endFrame: 60 }],
  measurements: { scope: 'master', integratedLufs, truePeakDbtp: -1.2 },
  provenance: [{ cueId: 'voice', source: 'media/audio/source.wav', evidence: 'Harmless reported-metadata fixture; no audio decoding or quality claim.' }] });

async function fixture(t, prefs) {
  const project = await fs.mkdtemp(path.join(os.tmpdir(), 'native-preferences-'));
  const relative = path.relative(os.tmpdir(), project);
  assert.ok(relative.startsWith('native-preferences-') && path.dirname(relative) === '.');
  t.after(() => fs.rm(project, { recursive: true, force: true, maxRetries: 3 }));
  await fs.mkdir(path.join(project, 'media/audio'), { recursive: true });
  await fs.writeFile(path.join(project, 'media/timeline.json'), JSON.stringify(timeline));
  if (prefs !== undefined) await fs.writeFile(path.join(project, 'media/project.json'), JSON.stringify(prefs));
  await fs.writeFile(path.join(project, 'media/audio/master.wav'), 'Harmless path fixture, not decoded audio');
  return project;
}

async function preflight(project, audioLufs) {
  const calls = [], reached = new Error('Expected external-runtime boundary');
  const options = {};
  if (audioLufs !== undefined) {
    await fs.writeFile(path.join(project, 'media/audio/manifest.json'), JSON.stringify(manifest(audioLufs)));
    options.audioManifest = 'media/audio/manifest.json';
  }
  // Run render's exact body, reading real fixture preferences/manifests with production
  // validators. Stop at the first external executable boundary: no browser or encoder runs.
  const context = vm.createContext({ project, options, fs,
    readTimeline: async root => JSON.parse(await fs.readFile(path.join(root, 'media/timeline.json'), 'utf8')),
    planRender: native.planRender, readRenderPreferences: native.readRenderPreferences,
    validateAudio: native.validateAudio,
    containedFile: (root, relative) => fs.realpath(path.join(root, relative)),
    run: (_executable, args) => { calls.push(Array.from(args)); throw reached; },
  });
  let error;
  try { await vm.runInContext(`(${native.render.toString()})(project, options)`, context); }
  catch (failure) { error = failure; }
  return { error, calls, reached };
}

function accepted(result) {
  assert.equal(result.error, result.reached, 'Valid preferences should reach the stopped runtime boundary.');
  assert.deepEqual(result.calls, [['-version']]);
}
function refused(result, code) {
  assert.equal(result.error?.code, 'MEDIA_CONTRACT_INVALID');
  assert.ok(result.error.errors.some(issue => issue.code === code), JSON.stringify(result.error.errors));
  assert.deepEqual(result.calls, [], 'Preferences must fail before any executable, capture or encoding.');
}

test('Native render honors the selected non-default loudness preset without rewriting preferences', async t => {
  const prefs = preferences();
  prefs.output.loudness = { integratedLufs: -18, toleranceLu: .25, truePeakDbtp: -1 };
  const project = await fixture(t, prefs);
  const before = await fs.readFile(path.join(project, 'media/project.json'), 'utf8');
  accepted(await preflight(project, -18));
  refused(await preflight(project, -16), 'audio.loudness');
  assert.equal(await fs.readFile(path.join(project, 'media/project.json'), 'utf8'), before);
});

test('Native render rejects invalid or stale preference schemas through J1 diagnostics', async t => {
  const cases = [preferences(), preferences(), preferences()];
  cases[0].schemaVersion = 2;
  cases[1].output.loudness.toleranceLu = -1;
  cases[2].output.videoCodec = 'vp9';
  for (const prefs of cases) {
    const project = await fixture(t, prefs);
    const expected = validatePreferences(prefs);
    assert.ok(expected.length > 0);
    const result = await preflight(project);
    refused(result, expected[0].code);
    assert.deepEqual(result.error.errors, expected);
  }
});

test('Native render refuses a remembered Remotion choice even for a silent render', async t => {
  const prefs = preferences();
  prefs.renderer = 'remotion';
  assert.deepEqual(validatePreferences(prefs), []);
  const project = await fixture(t, prefs);
  refused(await preflight(project), 'preferences.rendererMismatch');
  assert.equal(JSON.parse(await fs.readFile(path.join(project, 'media/project.json'), 'utf8')).renderer, 'remotion');
});

test('Native render rejects stale project timebase and dimensions before capture', async t => {
  for (const [field, value] of [['fps', 30], ['width', 1280], ['height', 720]]) {
    const prefs = preferences();
    prefs.output[field] = value;
    assert.deepEqual(validatePreferences(prefs), []);
    const result = await preflight(await fixture(t, prefs));
    refused(result, 'preferences.timelineMismatch');
    assert.ok(result.error.errors.some(issue => issue.path === `preferences.output.${field}`));
  }
});

test('Malformed recorded preferences fail safely instead of falling back or echoing input', async t => {
  const project = await fixture(t);
  const malformed = '{"HARMLESS_UNPARSED_FIXTURE":';
  await fs.writeFile(path.join(project, 'media/project.json'), malformed);
  const result = await preflight(project);
  refused(result, 'input.json');
  assert.ok(!String(result.error).includes('HARMLESS_UNPARSED_FIXTURE'));
  assert.equal(await fs.readFile(path.join(project, 'media/project.json'), 'utf8'), malformed);
});

test('Absent preferences preserve standalone timeline use and shared default loudness without creating a file', async t => {
  const project = await fixture(t);
  accepted(await preflight(project));
  accepted(await preflight(project, -16));
  refused(await preflight(project, -18), 'audio.loudness');
  await assert.rejects(fs.stat(path.join(project, 'media/project.json')), { code: 'ENOENT' });
});
