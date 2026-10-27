import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { timelineFingerprint, validateTimeline, validateAudioManifest } from '../registry/skills/audiovisual-review/scripts/review.mjs';
import './media-native-http.runtime.mjs';
import './media-native-capture.runtime.mjs';
import './media-native-preferences.runtime.mjs';

const native = await import(pathToFileURL(path.resolve('registry/skills/native-motion-production/scripts/render-native.mjs')));
const timeline = {schemaVersion:1, revision:'r1', fps:60, totalFrames:120, width:1920, height:1080,
  scenes:[{id:'intro',startFrame:0,endFrame:60},{id:'end',startFrame:60,endFrame:120}], cues:[]};
const audioTimeline = { ...timeline, cues: [{ id: 'voice', kind: 'vo', startFrame: 0, endFrame: 60, text: 'Approved words.' }] };
const audioManifest = () => ({
  schemaVersion: 1, timelineRevision: audioTimeline.revision, timelineFingerprint: timelineFingerprint(audioTimeline),
  fps: 60, totalFrames: 120, sampleRate: 48000, channels: 2, master: 'media/audio/master.wav',
  stems: [{ id: 'voice', kind: 'vo', path: 'media/audio/voice.wav' }],
  cues: [{ id: 'voice', path: 'media/audio/voice.wav', startFrame: 0, endFrame: 60 }],
  measurements: { scope: 'master', integratedLufs: -16, truePeakDbtp: -1.2 },
  provenance: [{ cueId: 'voice', source: 'media/audio/source.wav', evidence: 'Illustrative metadata only, no measured or listened audio.' }],
});

function rejectsContract(run, code, expected) {
  assert.throws(run, error => {
    assert.equal(error.code, 'MEDIA_CONTRACT_INVALID');
    assert.ok(error.errors.some(issue => issue.code === code), JSON.stringify(error.errors));
    assert.deepEqual(error.errors, expected, 'Native diagnostics must preserve the shared validator findings.');
    return true;
  });
}

test('capture plan exports exactly N integer frames, never duplicate endpoint', () => {
  const plan = native.planRender(timeline);
  assert.equal(plan.frameCount,120);
  assert.equal(plan.lastFrame,119);
  assert.equal(plan.lastTime,119/60);
  assert.equal(plan.durationSeconds,2);
  assert.equal(plan.loopProbeTime,2);
  assert.equal(plan.timelineFingerprint, timelineFingerprint(timeline));
});

test('native planning and encoding enforce the complete shared timeline contract', () => {
  const cases = [
    ['schema.object', null],
    ['schema.fields', { ...timeline, loop: true }],
    ['timeline.revision', { ...timeline, revision: 'has spaces' }],
    ['timeline.bounds', { ...timeline, fps: '60' }],
    ['timeline.id', { ...timeline, scenes: [{ id: 'has spaces', startFrame: 0, endFrame: 120 }] }],
    ['timeline.speechText', { ...timeline, cues: [{ id: 'voice', kind: 'vo', startFrame: 0, endFrame: 60 }] }],
    ['timeline.cueKind', { ...timeline, cues: [{ id: 'voice', kind: 'speech', startFrame: 0, endFrame: 60 }] }],
  ];
  for (const [code, bad] of cases) {
    const expected = validateTimeline(bad);
    rejectsContract(() => native.planRender(bad), code, expected);
    rejectsContract(() => native.encodeArgs(bad, 'frames', 'output.mp4'), code, expected);
  }
});

test('invalid frame intervals, duplicate IDs and odd H264 dimensions fail before dependencies', () => {
  for (const bad of [ {...timeline,fps:0}, {...timeline,totalFrames:1.2}, {...timeline,width:1919},
    {...timeline,scenes:[{id:'intro',startFrame:60,endFrame:120}]},
    {...timeline,scenes:[{id:'intro',startFrame:0,endFrame:80},{id:'end',startFrame:70,endFrame:120}]},
    {...timeline,cues:[{id:'intro',kind:'sfx',startFrame:0,endFrame:1}]}]) {
    assert.throws(()=>native.planRender(bad));
  }
});

test('FFmpeg arguments preserve spaced Windows paths and exact output length without a shell', () => {
  const args=native.encodeArgs(timeline,'C:\\Test media\\frames','C:\\Test media\\video.mp4','C:\\Test media\\mix.wav');
  assert.ok(args.includes('C:\\Test media\\mix.wav'));
  assert.ok(args.includes('120'));
  assert.ok(args.includes('aac'));
  assert.ok(args.includes('-n'));
  assert.ok(!args.includes('-shortest'));
});

test('shared audio handoff accepts a path-string master without mutating reported metadata', () => {
  const manifest = audioManifest(), before = structuredClone(manifest);
  assert.deepEqual(validateAudioManifest(audioTimeline, manifest), []);
  assert.equal(native.validateAudio(audioTimeline, manifest), 'media/audio/master.wav');
  assert.deepEqual(manifest, before);
  manifest.master = 'media\\audio\\master mix.wav';
  assert.equal(native.validateAudio(audioTimeline, manifest), 'media/audio/master mix.wav');
});

test('stale revisions, fingerprints and same-revision timing changes invalidate native audio', () => {
  for (const [code, change] of [
    ['audio.revision', m => { m.timelineRevision = 'r0'; }],
    ['audio.fingerprint', m => { delete m.timelineFingerprint; }],
    ['audio.timebase', m => { m.totalFrames = 119; }],
  ]) {
    const m = audioManifest(); change(m);
    rejectsContract(() => native.validateAudio(audioTimeline, m), code, validateAudioManifest(audioTimeline, m));
  }
  const changed = structuredClone(audioTimeline);
  changed.scenes[0].endFrame = 61; changed.scenes[1].startFrame = 61;
  const m = audioManifest();
  rejectsContract(() => native.validateAudio(changed, m), 'audio.fingerprint', validateAudioManifest(changed, m));
});

test('native audio rejects invalid format, scope, cue, provenance and path fields using shared diagnostics', () => {
  for (const [code, change] of [
    ['audio.format', m => { m.master = { file: 'media/audio/master.wav', sampleRate: 48000, channels: 2 }; }],
    ['audio.format', m => { m.sampleRate = 44100; }],
    ['audio.format', m => { m.channels = 1; }],
    ['audio.measurements', m => { delete m.measurements.scope; }],
    ['audio.loudness', m => { m.measurements.integratedLufs = -10; }],
    ['audio.truePeak', m => { m.measurements.truePeakDbtp = 0; }],
    ['audio.cueAlignment', m => { m.cues[0].startFrame = 1; }],
    ['audio.cueCoverage', m => { m.cues = []; }],
    ['audio.provenance', m => { m.provenance = []; }],
    ['path.unsafe', m => { m.master = '../private.wav'; }],
    ['path.unsafe', m => { m.master = 'C:\\private\\master.wav'; }],
    ['path.unsafe', m => { m.stems[0].path = 'media/audio/stem.wav:stream'; }],
    ['path.unsafe', m => { m.provenance[0].source = '.env'; }],
  ]) {
    const m = audioManifest(); change(m);
    rejectsContract(() => native.validateAudio(audioTimeline, m), code, validateAudioManifest(audioTimeline, m));
  }
  const badTimeline = { ...audioTimeline, fps: 0 }, m = audioManifest();
  rejectsContract(() => native.validateAudio(badTimeline, m), 'timeline.bounds', validateAudioManifest(badTimeline, m));
});

test('native audio honors an explicit shared preset and never prints rejected content values', () => {
  const m = audioManifest(); m.measurements.integratedLufs = -18;
  rejectsContract(() => native.validateAudio(audioTimeline, m), 'audio.loudness', validateAudioManifest(audioTimeline, m));
  assert.equal(native.validateAudio(audioTimeline, m, { integratedLufs: -18, toleranceLu: 1, truePeakDbtp: -1 }), m.master);
  m.master = '../NEVER_PRINT_PRIVATE_VALUE.wav';
  assert.throws(() => native.validateAudio(audioTimeline, m), error => {
    assert.equal(error.code, 'MEDIA_CONTRACT_INVALID');
    assert.doesNotMatch(error.message + JSON.stringify(error.errors), /NEVER_PRINT_PRIVATE_VALUE/);
    return true;
  });
});

test('scaffold is standalone and preserves user source on repeated invocation', async () => {
  const project=await fs.mkdtemp(path.join(os.tmpdir(),'media motion '));
  try {
    await fs.mkdir(path.join(project,'media'),{recursive:true});
    await fs.writeFile(path.join(project,'media/timeline.json'),JSON.stringify(timeline));
    await native.scaffold(project);
    const html=await fs.readFile(path.join(project,'media/native/index.html'),'utf8');
    assert.match(html,/window\.motion/);
    assert.doesNotMatch(html,/remotion/);
    await fs.writeFile(path.join(project,'media/native/index.html'),'USER SOURCE');
    await assert.rejects(native.scaffold(project),/exists/i);
    assert.equal(await fs.readFile(path.join(project,'media/native/index.html'),'utf8'),'USER SOURCE');
  } finally { await fs.rm(project,{recursive:true,force:true}); }
});

test('capture awaits readiness and each seek, then writes ordered frames', async () => {
  const calls=[];
  const page={evaluate: async (fn,arg)=>{calls.push(['evaluate',arg]);},
    screenshot: async ({path:output})=>calls.push(['shot',path.basename(output)]),
    waitForFunction: async()=>calls.push(['ready'])};
  await native.captureFrames(page,{...timeline,totalFrames:3,scenes:[{id:'scene',startFrame:0,endFrame:3}]},'frames');
  assert.deepEqual(calls.filter(c=>c[0]==='shot').map(c=>c[1]),['frame-000000.png','frame-000001.png','frame-000002.png']);
  assert.deepEqual(calls.filter(c=>c[0]==='evaluate' && typeof c[1]==='number').map(c=>c[1]),[0,1/60,2/60]);
});

test('readiness and seek failures abort capture rather than exporting partial media', async () => {
  const page={waitForFunction:async()=>{},evaluate:async()=>{throw new Error('missing font');},screenshot:async()=>assert.fail('must not capture')};
  await assert.rejects(native.captureFrames(page,timeline,'frames'),/missing font/);
});
