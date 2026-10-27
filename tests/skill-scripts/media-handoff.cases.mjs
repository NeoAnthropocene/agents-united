import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync, existsSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const review = path.resolve('registry/skills/audiovisual-review/scripts/review.mjs');
const project = path.resolve('registry/skills/workflow-agency-motion-production/scripts/project.mjs');
const timeline = () => ({ schemaVersion: 1, revision: 'r1', fps: 60, totalFrames: 120, width: 1920, height: 1080,
  scenes: [{ id: 'intro', startFrame: 0, endFrame: 60 }, { id: 'logo', startFrame: 60, endFrame: 120 }],
  cues: [{ id: 'voice', startFrame: 0, endFrame: 60, kind: 'vo', text: 'Hello world.' }] });
const manifest = () => ({ schemaVersion: 1, timelineRevision: 'r1', timelineFingerprint: '', fps: 60, totalFrames: 120, sampleRate: 48000, channels: 2,
  master: 'audio/master.wav', stems: [{ kind: 'vo', path: 'audio/voice.wav' }],
  cues: [{ id: 'voice', path: 'audio/voice.wav', startFrame: 0, endFrame: 60 }],
  measurements: { scope: 'master', integratedLufs: -16, truePeakDbtp: -1.2 },
  provenance: [{ cueId: 'voice', source: 'audio/voice.wav', evidence: 'Original local synthesis; fixture metadata only.' }] });
function fixture(run) {
  const dir = mkdtempSync(path.join(tmpdir(), 'media handoff '));
  try { run(dir); } finally { rmSync(dir, { recursive: true, force: true }); }
}
function cli(script, args) {
  const result = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });
  assert.equal(result.error, undefined, 'helper must execute');
  assert.ok(result.stdout.trim(), 'helper must return a structured report, not a missing-module failure');
  const report = JSON.parse(result.stdout);
  assert.equal(report.schemaVersion, 1);
  assert.ok(Array.isArray(report.errors));
  return { ...result, report };
}
function rejected(result, code) {
  assert.equal(result.status, 2, JSON.stringify(result.report));
  assert.equal(result.report.ok, false);
  assert.ok(result.report.errors.some(error => error.code === code && typeof error.path === 'string' && error.message.length > 0), `Expected ${code}: ${JSON.stringify(result.report)}`);
}
function check(dir, t = timeline(), m = manifest(), captions = '1\n00:00:00,000 --> 00:00:01,000\nHello world.\n', extra = []) {
  // Obtain the stable fingerprint through the public command; later mutations retain it.
  if (m && m.timelineFingerprint === '') {
    writeFileSync(path.join(dir, 'fingerprint.json'), JSON.stringify(timeline()));
    const fingerprint = cli(review, ['timeline', '--timeline', path.join(dir, 'fingerprint.json')]);
    assert.equal(fingerprint.status, 0, JSON.stringify(fingerprint.report));
    m.timelineFingerprint = fingerprint.report.timelineFingerprint;
  }
  writeFileSync(path.join(dir, 'timeline.json'), JSON.stringify(t));
  writeFileSync(path.join(dir, 'audio.json'), JSON.stringify(m));
  writeFileSync(path.join(dir, 'captions.srt'), captions);
  return cli(review, ['contract', '--timeline', path.join(dir, 'timeline.json'), '--manifest', path.join(dir, 'audio.json'), '--captions', path.join(dir, 'captions.srt'), ...extra]);
}
test('one common timebase accepts a valid handoff and speech captions with Windows spaces', () => fixture(dir => {
  const result = check(dir);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.report.errors, []);
  assert.equal(result.report.visualListeningReview, 'unverified');
  assert.equal(result.report.verification.measurements, 'reported-only');
  assert.equal(result.report.verification.mediaFiles, 'unverified');
  assert.equal(result.report.verification.muxedAudio, 'unverified');
}));
test('rejects stale audio, gaps, duplicate IDs and noninteger frames', () => fixture(dir => {
  const stale = manifest(); stale.timelineRevision = 'r0';
  rejected(check(dir, timeline(), stale), 'audio.revision');
  for (const [code, change] of [
    ['timeline.coverage', t => { t.scenes[1].startFrame = 61; }],
    ['timeline.duplicateId', t => { t.scenes[1].id = 'intro'; }],
    ['timeline.frameRange', t => { t.cues[0].endFrame = 1.5; }],
    ['timeline.bounds', t => { t.fps = 0; }],
    ['timeline.bounds', t => { t.width = 1919; }],
    ['timeline.cueKind', t => { t.cues[0].kind = 'speech'; }],
    ['timeline.speechText', t => { delete t.cues[0].text; }],
  ]) {
    const t = timeline(); change(t); rejected(check(dir, t), code);
  }
}));
test('rejects misplaced cues, escaping files, missing measurements and unsafe loudness', () => fixture(dir => {
  for (const [code, change] of [
    ['audio.cueAlignment', m => { m.cues[0].startFrame = 5; }],
    ['path.unsafe', m => { m.master = '../secret.wav'; }],
    ['path.unsafe', m => { m.stems[0].path = 'C:\\private\\key.wav'; }],
    ['path.unsafe', m => { m.master = 'audio/file.wav:stream'; }],
    ['path.unsafe', m => { m.provenance[0].source = '.env'; }],
    ['audio.measurements', m => { delete m.measurements; }],
    ['audio.truePeak', m => { m.measurements.truePeakDbtp = 0; }],
    ['audio.loudness', m => { m.measurements.integratedLufs = -11; }],
    ['audio.format', m => { m.sampleRate = 44100; }],
    ['audio.format', m => { m.channels = 1; }],
    ['audio.timebase', m => { m.fps = 30; }],
    ['audio.cueCoverage', m => { m.cues = []; }],
    ['audio.provenance', m => { m.provenance = []; }],
  ]) {
    const m = manifest(); change(m); rejected(check(dir, timeline(), m), code);
  }
}));
test('captions must match speech text and timing and cannot outlast the film', () => fixture(dir => {
  for (const [code, srt] of [
    ['captions.missing', ''],
    ['captions.bounds', '1\n00:00:00,000 --> 00:00:03,000\nHello world.\n'],
    ['captions.alignment', '1\n00:00:00,500 --> 00:00:01,500\nHello world.\n'],
    ['captions.text', '1\n00:00:00,000 --> 00:00:01,000\nInvented claim.\n'],
    ['captions.syntax', '1\n00:99:00,000 --> 00:00:01,000\nHello world.\n'],
  ]) {
    rejected(check(dir, timeline(), manifest(), srt), code);
  }
  assert.equal(check(dir, timeline(), manifest(), '1\r\n00:00:00,000 --> 00:00:00,500\r\nHello\r\n\r\n2\r\n00:00:00,500 --> 00:00:01,000\r\nworld.\r\n').status, 0);
}));
test('timing fingerprint invalidates same-revision edits and ignores JSON key order', () => fixture(dir => {
  const original = check(dir);
  const changed = timeline(); changed.scenes[0].endFrame = 61; changed.scenes[1].startFrame = 61;
  rejected(check(dir, changed), 'audio.fingerprint');
  const reversed = Object.fromEntries(Object.entries(timeline()).reverse());
  assert.equal(check(dir, reversed).report.timelineFingerprint, original.report.timelineFingerprint);
  const speech = timeline(); speech.cues[0].text = 'Different approved words.';
  rejected(check(dir, speech), 'audio.fingerprint');
}));
test('optional project checks distinguish file existence from measurements and reject escaped links', () => fixture(dir => {
  rejected(check(dir, timeline(), manifest(), undefined, ['--project', dir]), 'file.missing');
  mkdirSync(path.join(dir, 'audio'));
  writeFileSync(path.join(dir, 'audio/master.wav'), 'Not real audio: file presence must not claim decoding.');
  writeFileSync(path.join(dir, 'audio/voice.wav'), 'Not real audio.');
  const checked = check(dir, timeline(), manifest(), undefined, ['--project', dir]);
  assert.equal(checked.status, 0);
  assert.equal(checked.report.verification.mediaFiles, 'present-within-project');
  assert.equal(checked.report.verification.audioDecode, 'unverified');
  fixture(outside => {
    symlinkSync(outside, path.join(dir, 'escape'), process.platform === 'win32' ? 'junction' : 'dir');
    const m = manifest(); m.master = 'escape/out.wav'; writeFileSync(path.join(outside, 'out.wav'), 'fixture');
    rejected(check(dir, timeline(), m, undefined, ['--project', dir]), 'file.outsideProject');
  });
}));
test('malformed files and missing arguments return structured errors without echoing content', () => fixture(dir => {
  writeFileSync(path.join(dir, 'broken.json'), '{"privateToken":"DO_NOT_ECHO"');
  const bad = cli(review, ['timeline', '--timeline', path.join(dir, 'broken.json')]);
  rejected(bad, 'input.json'); assert.doesNotMatch(bad.stdout + bad.stderr, /DO_NOT_ECHO/);
  rejected(cli(review, ['timeline', '--timeline', path.join(dir, 'absent.json')]), 'input.read');
  rejected(cli(review, ['contract']), 'cli.arguments');
  rejected(cli(review, ['timeline', '--timeline', path.join(dir, '.env')]), 'input.path');
  for (const value of [null, [], { ...timeline(), fps: '60' }]) {
    writeFileSync(path.join(dir, 'invalid.json'), JSON.stringify(value));
    rejected(cli(review, ['timeline', '--timeline', path.join(dir, 'invalid.json')]), value && !Array.isArray(value) ? 'timeline.bounds' : 'schema.object');
  }
}));
test('private input paths and malformed optional evidence fail before returning any data', async () => {
  const { validateAudioManifest, validatePreferences, timelineFingerprint, defaultPreferences } = await import('../../registry/skills/audiovisual-review/scripts/review.mjs');
  for (const change of [m => { m.review = { numerical: 'yes', listening: {}, muxedAudio: [] }; }, m => { m.stems[0].path = 7; }, m => { m.cues[0] = null; }, m => { m.provenance[0].source = {}; }]) {
    const m = manifest(); m.timelineFingerprint = timelineFingerprint(timeline()); change(m);
    const errors = validateAudioManifest(timeline(), m);
    assert.ok(errors.length > 0);
    assert.ok(errors.every(e => typeof e.code === 'string' && typeof e.path === 'string' && typeof e.message === 'string'));
  }
  const prefs = defaultPreferences('native', 'api', false, 5);
  assert.deepEqual(validatePreferences(prefs), []); // Route choice is valid even before provider setup.
  prefs.spend.ceilingUsd = '5'; assert.ok(validatePreferences(prefs).some(e => e.code === 'preferences.spend'));
  fixture(dir => {
    mkdirSync(path.join(dir, '.env'));
    writeFileSync(path.join(dir, '.env', 'private.json'), JSON.stringify(timeline()));
    rejected(cli(review, ['timeline', '--timeline', path.join(dir, '.env', 'private.json')]), 'input.path');
  });
});
test('Media Requests capture scope and decisions, with actionable route/cost/reference errors', () => fixture(dir => {
  const request = { schemaVersion: 1, id: 'launch-film', requester: 'campaign', placement: 'product page', audience: 'trial users', purpose: 'Show approved workflow', priority: 'optional', assets: ['assets/ui.png'], copyRefs: ['brief/copy.md'], brandRefs: ['brief/brand.json'], durationSeconds: 15, ratio: '16:9', format: 'mp4', accessibility: { captions: true, transcript: true, reducedMotion: true }, dependencies: ['approved-copy'], proposedRoute: { renderer: 'native', audio: 'local', generatedFootage: false }, costCeilingUsd: 0, acceptance: ['Readable final CTA for two seconds'], decision: 'pending' };
  const file = path.join(dir, 'request.json');
  const run = () => { writeFileSync(file, JSON.stringify(request)); return cli(review, ['request', '--request', file]); };
  assert.equal(run().status, 0);
  request.costCeilingUsd = -1; rejected(run(), 'request.cost'); request.costCeilingUsd = 0;
  request.decision = 'auto-approved'; rejected(run(), 'request.decision'); request.decision = 'decline';
  assert.equal(run().status, 0);
  request.assets = ['../private.png']; rejected(run(), 'path.unsafe'); request.assets = [];
  request.proposedRoute.renderer = 'invented'; rejected(run(), 'request.route');
}));
test('project preferences persist explicit routes without overwriting existing choices', () => fixture(dir => {
  const args = [project, 'init', '--project', dir, '--renderer', 'native', '--audio', 'local', '--generated-footage', 'no', '--budget-usd', '0'];
  const first = cli(args[0], args.slice(1));
  assert.equal(first.status, 0, first.stderr);
  const file = path.join(dir, 'media', 'project.json');
  const before = readFileSync(file, 'utf8');
  assert.equal(JSON.parse(before).renderer, 'native');
  args[args.indexOf('native')] = 'remotion';
  rejected(cli(args[0], args.slice(1)), 'project.exists');
  assert.equal(readFileSync(file, 'utf8'), before);
  const status = cli(project, ['status', '--project', dir]);
  assert.equal(status.status, 0);
  assert.deepEqual(status.report.preferences, JSON.parse(before));
  assert.equal(status.report.preferences.output.fps, 60);
  assert.equal(status.report.preferences.output.audioSampleRate, 48000);
  assert.equal(status.report.preferences.spend.ceilingUsd, 0);
  assert.equal(existsSync(path.join(dir, '.env')), false);
}));
test('selected providers and output/spend preferences round-trip; secrets and incompatible choices are rejected', () => fixture(dir => {
  cli(project, ['init', '--project', dir, '--renderer', 'native', '--audio', 'local', '--generated-footage', 'no', '--budget-usd', '0']);
  const prefs = JSON.parse(readFileSync(path.join(dir, 'media/project.json'), 'utf8'));
  prefs.renderer = 'remotion'; prefs.audioRoute = 'hybrid'; prefs.generatedFootage = true;
  prefs.providers = [{ provider: 'fish-audio', model: 's1', modality: 'audio', route: 'api' }, { provider: 'kling', model: 'selected-model', modality: 'video', route: 'mcp' }];
  prefs.output.width = 1080; prefs.output.height = 1920; prefs.spend.ceilingUsd = 8;
  fixture(target => {
    const input = path.join(dir, 'preferences.json');
    const run = () => { writeFileSync(input, JSON.stringify(prefs)); return cli(project, ['init', '--project', target, '--preferences', input]); };
    prefs.apiKey = 'NEVER_ECHO_PRIVATE_VALUE';
    const bad = run(); rejected(bad, 'schema.fields'); assert.doesNotMatch(bad.stdout + bad.stderr, /NEVER_ECHO_PRIVATE_VALUE/);
    assert.equal(existsSync(path.join(target, 'media/project.json')), false); delete prefs.apiKey;
    prefs.audioRoute = 'local'; rejected(run(), 'preferences.providerConsent'); prefs.audioRoute = 'hybrid';
    assert.equal(run().status, 0);
    assert.deepEqual(cli(project, ['status', '--project', target]).report.preferences, prefs);
  });
}));
test('invalid project configuration and symlinked media directory are preserved and refused', () => fixture(dir => {
  mkdirSync(path.join(dir, 'media'));
  writeFileSync(path.join(dir, 'media/project.json'), '{"token":"PRIVATE_DO_NOT_ECHO"');
  const result = cli(project, ['status', '--project', dir]);
  rejected(result, 'input.json'); assert.doesNotMatch(result.stdout + result.stderr, /PRIVATE_DO_NOT_ECHO/);
  rejected(cli(project, ['init', '--project', dir, '--renderer', 'bad', '--audio', 'local', '--generated-footage', 'no', '--budget-usd', '0']), 'preferences.renderer');
  fixture(target => fixture(outside => {
    symlinkSync(outside, path.join(target, 'media'), process.platform === 'win32' ? 'junction' : 'dir');
    rejected(cli(project, ['init', '--project', target, '--renderer', 'native', '--audio', 'local', '--generated-footage', 'no', '--budget-usd', '0']), 'file.outsideProject');
    assert.equal(existsSync(path.join(outside, 'project.json')), false);
  }));
}));
