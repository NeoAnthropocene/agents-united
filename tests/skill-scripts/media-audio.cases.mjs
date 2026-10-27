import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, mkdir, writeFile, lstat, symlink } from 'node:fs/promises';
import { writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { synthesizeWav } from '../../registry/skills/audio-generation/scripts/synthesize.mjs';
import { buildStemFilter, parseLoudness, masteringFilter, validateMix, renderMix } from '../../registry/skills/audio-post-production/scripts/mix.mjs';
import { defaultPreferences, timelineFingerprint, validateAudioManifest, validateMediaFiles } from '../../registry/skills/audiovisual-review/scripts/review.mjs';

const timeline = () => ({ schemaVersion: 1, revision: 'r2', fps: 60, totalFrames: 120, width: 1920, height: 1080,
  scenes: [{ id: 'scene', startFrame: 0, endFrame: 120 }],
  cues: [{ id: 'logo', startFrame: 30, endFrame: 90, kind: 'sfx' }] });
const mix = () => ({ timelineRevision: 'r2', tracks: [{ id: 'logo', kind: 'sfx', path: 'audio/tone.wav', startFrame: 30, endFrame: 90, gainDb: -6, provenance: 'Original technical signal; no speech or music quality claim.' }] });

async function fixture(t, preferences) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'media-audio-contract-'));
  assert.equal(path.dirname(path.relative(os.tmpdir(), root)), '.');
  t.after(() => rm(root, { recursive: true, force: true, maxRetries: 3 }));
  await mkdir(path.join(root, 'audio'));
  await mkdir(path.join(root, 'media'));
  await writeFile(path.join(root, 'audio/tone.wav'), 'Supplied source preservation fixture; no decoded media.');
  await writeFile(path.join(root, 'media/timeline.json'), JSON.stringify(timeline()));
  await writeFile(path.join(root, 'media/mix.json'), JSON.stringify(mix()));
  if (preferences !== undefined) await writeFile(path.join(root, 'media/project.json'), typeof preferences === 'string' ? preferences : JSON.stringify(preferences));
  return root;
}

// A process/IO boundary fake exercises the production contract pipeline. It does
// not decode or finish audio; actual FFmpeg measurements belong to the media proof.
function fakeFFmpeg({ finalLufs = -16, finalPeak = -1.2, legacy = false } = {}) {
  const calls = [];
  const run = (_binary, args) => {
    calls.push(args);
    if (args.includes('-h')) return { status: 0, stdout: args.at(-1) === 'filter=amix'
      ? (legacy ? 'amix inputs dropout_transition' : 'amix inputs normalize <boolean> dropout_transition')
      : 'loudnorm I <double> (from -70 to -5) TP <double> (from -9 to 0)', stderr: '' };
    if (args.includes('null')) return { status: 0, stdout: '', stderr: JSON.stringify({ input_i: finalLufs,
      input_tp: finalPeak, input_lra: 2, input_thresh: -30, target_offset: 0 }) };
    assert.ok(args.includes('-n'), 'All audio outputs must be exclusive.');
    writeFileSync(args.at(-1), 'Process boundary output fixture; no actual WAV.', { flag: 'wx' });
    return { status: 0, stdout: '', stderr: '' };
  };
  return { calls, run };
}

async function absent(file) { await assert.rejects(lstat(file), { code: 'ENOENT' }); }

test('local synthesis is deterministic stereo48k PCM with exact frame-derived duration', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'media audio '));
  try {
    const spec = { fps: 60, totalFrames: 120, waveform: 'sine', frequency: 440, gainDb: -18, seed: 9 };
    await synthesizeWav(spec, path.join(root, 'tone.wav'));
    await synthesizeWav(spec, path.join(root, 'repeat.wav'));
    const wav = await readFile(path.join(root, 'tone.wav'));
    assert.deepEqual(wav, await readFile(path.join(root, 'repeat.wav')));
    assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
    assert.equal(wav.readUInt16LE(22), 2);
    assert.equal(wav.readUInt32LE(24), 48000);
    assert.equal(wav.length, 44 + 96000 * 4);
    assert.equal(wav.readInt16LE(44), 0);
    assert.equal(wav.readInt16LE(wav.length - 2), 0);
    assert.ok(wav.subarray(44).some(byte => byte !== 0));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('synthesis refuses invalid/unbounded parameters before allocating', async () => {
  for (const spec of [{fps:0,totalFrames:30},{fps:60,totalFrames:0},{fps:60,totalFrames:60,gainDb:2},{fps:60,totalFrames:60,waveform:'voice'},{fps:60,totalFrames:1e9}]) {
    await assert.rejects(synthesizeWav(spec, 'must-not-exist.wav'));
  }
});

test('stem placement uses sample-accurate half-open frame ranges and no independent normalization', () => {
  const filter = buildStemFilter({startFrame:30,endFrame:90,gainDb:-6,trimStartSeconds:0.25}, 60, 96000);
  assert.match(filter, /atrim=start_sample=12000:end_sample=60000/);
  assert.match(filter, /adelay=24000S:all=1/);
  assert.match(filter, /apad=whole_len=96000,atrim=end_sample=96000/);
  assert.doesNotMatch(filter, /loudnorm|normalize/);
});

test('59fps adjacent cues meet rounded endpoints without one-sample overlap, including source trim', () => {
  // Approved boundaries at frames 0,1,2,3 are 0,814,1627,2441 sample frames.
  for (const [startFrame, endFrame, expectedLength, expectedDelay] of [[0,1,814,0],[1,2,813,814],[2,3,814,1627]]) {
    const filter = buildStemFilter({ startFrame, endFrame, trimStartSeconds: 0.25 }, 59, 48000);
    const trim = /atrim=start_sample=(\d+):end_sample=(\d+)/.exec(filter);
    assert.equal(Number(trim[1]), 12000);
    assert.equal(Number(trim[2]) - Number(trim[1]), expectedLength, `cue [${startFrame},${endFrame})`);
    assert.match(filter, new RegExp(`adelay=${expectedDelay}S:all=1`));
    assert.match(filter, /apad=whole_len=48000,atrim=end_sample=48000/);
  }
});

test('loudness parser accepts finite measurements and refuses silent/invalid mixes', () => {
  const measured = parseLoudness('log\n'+JSON.stringify({input_i:'-20',input_tp:'-3',input_lra:'2',input_thresh:'-30',target_offset:'0.1'}));
  assert.equal(measured.integratedLufs,-20);
  assert.match(masteringFilter(measured), /measured_I=-20/);
  assert.match(masteringFilter(measured), /TP=-1/);
  assert.throws(() => parseLoudness('{"input_i":"-inf"}'), /finite/);
});

test('mix validation rejects stale timelines, escaped files, duplicate cue ids and overrun', () => {
  const approved = timeline(), valid = mix();
  assert.doesNotThrow(() => validateMix(approved, valid));
  assert.throws(() => validateMix(approved, {...valid,timelineRevision:'r1'}), /revision/);
  assert.throws(() => validateMix(approved, {...valid,tracks:[{...valid.tracks[0],path:'../secret.wav'}]}), /relative/);
  assert.throws(() => validateMix(approved, {...valid,tracks:[valid.tracks[0],valid.tracks[0]]}), /duplicate/);
  assert.throws(() => validateMix(approved, {...valid,tracks:[{...valid.tracks[0],endFrame:121}]}), /range|cue/);
});

test('mix requires the complete shared timeline and exact cue coverage/provenance', () => {
  const approved = timeline(), valid = mix();
  const { width: _width, scenes: _scenes, ...incomplete } = approved;
  assert.throws(() => validateMix(incomplete, valid), /timeline/);
  const twoCues = { ...approved, cues: [...approved.cues, { id: 'bed', kind: 'music', startFrame: 0, endFrame: 120 }] };
  assert.throws(() => validateMix(twoCues, valid), /missing|every approved cue/);
  for (const provenance of ['', '  ', {}, 9]) assert.throws(() => validateMix(approved, { ...valid, tracks: [{ ...valid.tracks[0], provenance }] }), /provenance/);
  assert.throws(() => validateMix(approved, { ...valid, timelineFingerprint: 'sha256:stale' }), /fingerprint/);
  assert.doesNotThrow(() => validateMix(approved, { ...valid, timelineFingerprint: timelineFingerprint(approved) }));
  for (const unsafe of ['audio/.env.wav', 'audio/tone.wav:private', 'audio/NUL.wav', 'https://example.test/a.wav']) {
    assert.throws(() => validateMix(approved, { ...valid, tracks: [{ ...valid.tracks[0], path: unsafe }] }), /relative/);
  }
});

test('mastering supports modern local loudnorm limits and clearly rejects unsupported J1 peaks', () => {
  const measured = { integratedLufs: -20, truePeakDbtp: -3, loudnessRange: 2, threshold: -30, offset: 0 };
  for (const target of [-70, -30, -5]) assert.match(masteringFilter(measured, target, -9), new RegExp(`I=${target}:TP=-9`));
  assert.match(masteringFilter(measured, -16, 0), /TP=0/);
  assert.throws(() => masteringFilter(measured, -16, -10), /FFmpeg.*-9.*0/);
});

test('mix emits a shared-valid handoff and preserves supplied audio and aligned relative gains', async t => {
  const root = await fixture(t), process = fakeFFmpeg();
  const before = await readFile(path.join(root, 'audio/tone.wav'));
  const approved = timeline(), settings = mix();
  // Stable J1 identifiers may include dots and need not be safe output basenames.
  approved.cues[0].id = 'master'; settings.tracks[0].id = 'master';
  const result = await renderMix(root, approved, settings, 'media/audio-r2', 'fixture-ffmpeg', { run: process.run });
  assert.deepEqual(validateAudioManifest(approved, result), []);
  assert.deepEqual(await validateMediaFiles(root, result), []);
  assert.equal(result.timelineFingerprint, timelineFingerprint(approved));
  assert.equal(result.channels, 2);
  assert.equal(result.measurements.scope, 'master');
  assert.equal(result.review.numerical, true);
  assert.equal(result.review.listening, 'unverified');
  assert.equal(result.review.muxedAudio, 'unverified');
  assert.notEqual(result.master, result.stems[0].path);
  assert.equal(result.cues[0].path, result.stems[0].path);
  assert.deepEqual(await readFile(path.join(root, 'audio/tone.wav')), before);
  const stemCall = process.calls.find(args => args.includes('-af') && args.some(arg => arg.includes('adelay=')));
  assert.match(stemCall[stemCall.indexOf('-af') + 1], /volume=-6dB/);
  assert.doesNotMatch(stemCall[stemCall.indexOf('-af') + 1], /loudnorm/);
  const sumCall = process.calls.find(args => args.includes('-filter_complex'));
  assert.match(sumCall[sumCall.indexOf('-filter_complex') + 1], /amix=inputs=1:normalize=0/);
  assert.deepEqual(JSON.parse(await readFile(path.join(root, 'media/audio-r2/audio-manifest.json'), 'utf8')), result);
  await absent(path.join(root, 'media/project.json'));
  const callCount = process.calls.length;
  await assert.rejects(renderMix(root, approved, settings, 'media/audio-r2', 'fixture-ffmpeg', { run: process.run }), /already exists/);
  assert.equal(process.calls.length, callCount);
});

test('saved project loudness controls both measurement passes, mastering and acceptance without rewrite', async t => {
  const preferences = defaultPreferences('remotion', 'local', false, 0);
  preferences.output.loudness = { integratedLufs: -30, toleranceLu: .25, truePeakDbtp: -8 };
  const root = await fixture(t, preferences), process = fakeFFmpeg({ finalLufs: -30.1, finalPeak: -8.2 });
  const before = await readFile(path.join(root, 'media/project.json'));
  const result = await renderMix(root, timeline(), mix(), 'media/final', 'fixture-ffmpeg', { run: process.run });
  assert.deepEqual(validateAudioManifest(timeline(), result, preferences.output.loudness), []);
  const filters = process.calls.filter(args => args.includes('-af')).map(args => args[args.indexOf('-af') + 1]).filter(filter => filter.startsWith('loudnorm='));
  assert.equal(filters.length, 3);
  for (const filter of filters) assert.match(filter, /loudnorm=I=-30:TP=-8:/);
  assert.deepEqual(await readFile(path.join(root, 'media/project.json')), before);
});

test('a stricter codec-headroom peak honors the saved ceiling without rewriting approved inputs', async t => {
  for (const renderer of ['native', 'remotion']) {
    const preferences = defaultPreferences(renderer, 'local', false, 0);
    const root = await fixture(t, preferences), process = fakeFFmpeg({ finalPeak: -1.6 });
    const settings = { ...mix(), truePeakDbtp: -1.5 };
    const protectedPaths = ['media/project.json', 'media/timeline.json', 'media/mix.json', 'audio/tone.wav'];
    const before = await Promise.all(protectedPaths.map(file => readFile(path.join(root, file))));
    const settingsBefore = JSON.stringify(settings);
    const result = await renderMix(root, timeline(), settings, 'media/headroom', 'fixture-ffmpeg', { run: process.run });
    assert.deepEqual(validateAudioManifest(timeline(), result, preferences.output.loudness), []);
    const filters = process.calls.filter(args => args.includes('-af')).map(args => args[args.indexOf('-af') + 1]).filter(filter => filter.startsWith('loudnorm='));
    assert.equal(filters.length, 3);
    for (const filter of filters) assert.match(filter, /loudnorm=I=-16:TP=-1\.5:/);
    assert.equal(result.measurements.truePeakDbtp, -1.6);
    assert.equal(JSON.stringify(settings), settingsBefore);
    assert.deepEqual(await Promise.all(protectedPaths.map(file => readFile(path.join(root, file)))), before);
  }
});

test('invalid/conflicting/malformed preferences and unsupported local presets fail before processing or output changes', async t => {
  const cases = [];
  const invalid = defaultPreferences('native', 'local', false, 0); invalid.spend.ceilingUsd = -1; cases.push([invalid, {}, /preferences/]);
  const mismatched = defaultPreferences('native', 'local', false, 0); mismatched.output.width = 1280; cases.push([mismatched, {}, /timeline/]);
  cases.push(['{malformed', {}, /JSON/]);
  const unsupported = defaultPreferences('native', 'local', false, 0); unsupported.output.loudness.truePeakDbtp = -12; cases.push([unsupported, {}, /FFmpeg.*-9.*0/]);
  cases.push([defaultPreferences('native', 'local', false, 0), { targetLufs: -18 }, /conflict/]);
  cases.push([defaultPreferences('native', 'local', false, 0), { truePeakDbtp: -0.5 }, /conflict/]);
  cases.push([defaultPreferences('native', 'local', false, 0), { truePeakDbtp: -10 }, /FFmpeg.*-9.*0/]);
  cases.push([undefined, { truePeakDbtp: -10 }, /FFmpeg.*-9.*0/]);
  for (const [preferences, overrides, reason] of cases) {
    const root = await fixture(t, preferences), process = fakeFFmpeg();
    await assert.rejects(renderMix(root, timeline(), { ...mix(), ...overrides }, 'new/nested/revision', 'fixture-ffmpeg', { run: process.run }), reason);
    assert.deepEqual(process.calls, []);
    await absent(path.join(root, 'new'));
  }
});

test('missing and nonregular source files fail before any processing/output mutation', async t => {
  for (const source of ['audio/missing.wav', 'audio']) {
    const root = await fixture(t), process = fakeFFmpeg(), settings = mix(); settings.tracks[0].path = source;
    await assert.rejects(renderMix(root, timeline(), settings, 'new/revision', 'fixture-ffmpeg', { run: process.run }), /missing|regular|ENOENT/);
    assert.deepEqual(process.calls, []);
    await absent(path.join(root, 'new'));
  }
});

test('resolved input/output links and preference links cannot escape the selected project', async t => {
  const root = await fixture(t), outside = await fixture(t), process = fakeFFmpeg();
  await symlink(outside, path.join(root, 'escape'), 'junction');
  const settings = mix(); settings.tracks[0].path = 'escape/audio/tone.wav';
  await assert.rejects(renderMix(root, timeline(), settings, 'media/final', 'fixture-ffmpeg', { run: process.run }), /outside|escape/);
  await assert.rejects(renderMix(root, timeline(), mix(), 'escape/new/revision', 'fixture-ffmpeg', { run: process.run }), /outside|escape/);
  await absent(path.join(outside, 'new'));
  await writeFile(path.join(outside, 'media/project.json'), JSON.stringify(defaultPreferences('native', 'local', false, 0)));
  await rm(path.join(root, 'media'), { recursive: true });
  await symlink(path.join(outside, 'media'), path.join(root, 'media'), 'junction');
  await assert.rejects(renderMix(root, timeline(), mix(), 'new/revision', 'fixture-ffmpeg', { run: process.run }), /outside|escape/);
  assert.deepEqual(process.calls, []);
});

test('unsupported FFmpeg capabilities fail actionably before creating output revision', async t => {
  const root = await fixture(t), process = fakeFFmpeg({ legacy: true });
  await assert.rejects(renderMix(root, timeline(), mix(), 'new/revision', 'fixture-ffmpeg', { run: process.run }), /FFmpeg.*normalize/);
  await absent(path.join(root, 'new'));
  assert.ok(process.calls.every(args => args.includes('-h')));
});

test('measured results outside the selected preset are refused by shared manifest validation', async t => {
  const prefs = defaultPreferences('native', 'local', false, 0); prefs.output.loudness.toleranceLu = .1;
  const root = await fixture(t, prefs), process = fakeFFmpeg({ finalLufs: -16.5 });
  await assert.rejects(renderMix(root, timeline(), mix(), 'media/rejected', 'fixture-ffmpeg', { run: process.run }), /audio.loudness/);
  await absent(path.join(root, 'media/rejected/audio-manifest.json'));
});

test('CLI reads only confined explicit JSON contracts and reports malformed input safely', async t => {
  const root = await fixture(t);
  const cli = path.resolve('registry/skills/audio-post-production/scripts/mix.mjs');
  for (const file of ['../outside.json', 'media/missing.json', 'media/.env.json']) {
    const result = spawnSync(process.execPath, [cli, root, file, 'media/mix.json'], { encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /relative|outside|missing|nonprivate/);
  }
  await writeFile(path.join(root, 'media/mix.json'), '{"private-marker-never-echo":');
  const result = spawnSync(process.execPath, [cli, root, 'media/timeline.json', 'media/mix.json'], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /JSON/);
  assert.doesNotMatch(result.stderr, /private-marker-never-echo/);
});
