import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { measurePcmOnset } from '../../registry/skills/audiovisual-review/scripts/measure-onset.mjs';

function wav({ onset = 0, channels = 1, silent = false, samples = 48000, bits = 16 } = {}) {
  const bytes = bits / 8;
  const data = Buffer.alloc(44 + samples * channels * bytes);
  data.write('RIFF'); data.writeUInt32LE(data.length - 8, 4); data.write('WAVEfmt ', 8);
  data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(channels, 22);
  data.writeUInt32LE(48000, 24); data.writeUInt32LE(48000 * channels * bytes, 28);
  data.writeUInt16LE(channels * bytes, 32); data.writeUInt16LE(bits, 34);
  data.write('data', 36); data.writeUInt32LE(samples * channels * bytes, 40);
  if (!silent) for (let sample = onset; sample < samples; sample++) {
    for (let channel = 0; channel < channels; channel++) data.writeIntLE((channel ? -16000 : 16000) * (bits === 24 ? 256 : 1), 44 + (sample * channels + channel) * bytes, bytes);
  }
  return data;
}

test('CLI works through a linked installed Skill directory from a different cwd', () => {
  const folder = mkdtempSync(path.join(tmpdir(), 'onset linked skill '));
  try {
    const linked = path.join(folder, 'installed-review-skill');
    const target = fileURLToPath(new URL('../../registry/skills/audiovisual-review/', import.meta.url));
    symlinkSync(target, linked, process.platform === 'win32' ? 'junction' : 'dir');
    const file = path.join(folder, 'cue.wav');
    writeFileSync(file, wav({ onset: 9600 }));
    const result = spawnSync(process.execPath, [path.join(linked, 'scripts/measure-onset.mjs'), '--wav', file,
      '--fps', '30', '--expected-frame', '6'], { cwd: tmpdir(), encoding: 'utf8', windowsHide: true });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).onsetSample, 9600);
  } finally { rmSync(folder, { recursive: true, force: true }); }
});

test('module import ignores non-file node -e arguments', () => {
  const source = new URL('../../registry/skills/audiovisual-review/scripts/measure-onset.mjs', import.meta.url).href;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e',
    `import {measurePcmOnset} from ${JSON.stringify(source)}; console.log(typeof measurePcmOnset)`,
    'not-an-entry-file'], { encoding: 'utf8', windowsHide: true });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), 'function');
});

test('measures PCM24 handoff stems including negative full-scale samples and declares format', () => {
  for (const channels of [1, 2]) {
    const source = wav({ bits: 24, channels, silent: true });
    source.writeIntLE(-8388608, 44 + (4800 * channels + channels - 1) * 3, 3);
    const result = measurePcmOnset(source, { fps: 30, expectedFrame: 3 });
    assert.equal(result.onsetSample, 4800);
    assert.equal(result.peakAmplitude, 1);
    assert.equal(result.signedOffsetFrames, 0);
    assert.equal(result.withinTolerance, true);
    assert.equal(result.bitsPerSample, 24);
    assert.equal(result.format, 'pcm_s24le');
    assert.equal(result.method, 'pcm-relative-peak-threshold');
  }
  const pcm16 = measurePcmOnset(wav(), { fps: 30 });
  assert.equal(pcm16.bitsPerSample, 16);
  assert.equal(pcm16.format, 'pcm_s16le');
});

test('detects the internal six-frame lead-in that perfect mux placement cannot catch', () => {
  const result = measurePcmOnset(wav({ onset: 9600 }), { fps: 30 });
  assert.equal(result.onsetSample, 9600);
  assert.equal(result.onsetSeconds, 0.2);
  assert.equal(result.signedOffsetFrames, 6);
  assert.equal(result.withinTolerance, false);
  assert.equal(result.listeningReview, 'unverified');
  assert.equal(result.perceivedSyncReview, 'unverified');
});

test('accepts exact one-frame boundary and a measured expected position in aligned stems', () => {
  assert.equal(measurePcmOnset(wav({ onset: 1600 }), { fps: 30 }).withinTolerance, true);
  assert.equal(measurePcmOnset(wav({ onset: 1601 }), { fps: 30 }).withinTolerance, false);
  assert.equal(measurePcmOnset(wav({ onset: 9600 }), { fps: 30, expectedFrame: 6 }).signedOffsetFrames, 0);
});

test('uses maximum channel magnitude so opposite-polarity stereo is not treated as silence', () => {
  assert.equal(measurePcmOnset(wav({ channels: 2, onset: 4800 }), { fps: 30 }).onsetSample, 4800);
});

test('silence cannot pass as synchronous sound', () => {
  const result = measurePcmOnset(wav({ silent: true }), { fps: 30 });
  assert.equal(result.onsetSample, null);
  assert.equal(result.signedOffsetFrames, null);
  assert.equal(result.withinTolerance, false);
});

test('validates RIFF boundaries and supported PCM format before reading samples', () => {
  assert.throws(() => measurePcmOnset(wav().subarray(0, 45), { fps: 30 }), /WAV|RIFF/);
  for (const code of [3, 65534]) {
    const unsupported = wav(); unsupported.writeUInt16LE(code, 20);
    assert.throws(() => measurePcmOnset(unsupported, { fps: 30 }), /PCM16.*PCM24/);
  }
  const bad24 = wav({ bits: 24 }); bad24.writeUInt16LE(2, 32);
  assert.throws(() => measurePcmOnset(bad24, { fps: 30 }), /aligned/);
  const incomplete = wav(); incomplete.writeUInt32LE(95999, 40);
  assert.throws(() => measurePcmOnset(incomplete, { fps: 30 }), /WAV|aligned/);
});

test('rejects invalid measurement parameters instead of returning a misleading pass', () => {
  for (const options of [{ fps: 0 }, { fps: 30, threshold: 0 }, { fps: 30, threshold: 1 }, { fps: 30, expectedFrame: -1 }, { fps: 30, expectedFrame: 30 }, { fps: 30, toleranceFrames: NaN }]) {
    assert.throws(() => measurePcmOnset(wav(), options));
  }
});

test('accepts padded unknown metadata chunks but rejects missing padding and duplicate format/data', () => {
  const source = wav();
  const metadata = Buffer.from([74, 85, 78, 75, 1, 0, 0, 0, 42, 0]);
  const withChunk = Buffer.concat([source.subarray(0, 12), metadata, source.subarray(12)]);
  withChunk.writeUInt32LE(withChunk.length - 8, 4);
  assert.equal(measurePcmOnset(withChunk, { fps: 30 }).onsetSample, 0);
  const noPadding = Buffer.concat([source.subarray(0, 12), metadata.subarray(0, 9), source.subarray(12)]);
  noPadding.writeUInt32LE(noPadding.length - 8, 4);
  assert.throws(() => measurePcmOnset(noPadding, { fps: 30 }), /WAV/);
  for (const duplicate of [source.subarray(12, 36), source.subarray(36)]) {
    const invalid = Buffer.concat([source, duplicate]);
    invalid.writeUInt32LE(invalid.length - 8, 4);
    assert.throws(() => measurePcmOnset(invalid, { fps: 30 }), /format|data/);
  }
});

test('uses strict relative threshold, either channel, and preserves negative timing offsets', () => {
  const source = wav({ channels: 2, silent: true });
  source.writeInt16LE(800, 44); // Exactly 5% of the later 16000 peak is excluded.
  source.writeInt16LE(-801, 44 + 1600 * 4 + 2); // Right channel alone crosses it.
  source.writeInt16LE(16000, 44 + 10000 * 4);
  const result = measurePcmOnset(source, { fps: 30, expectedFrame: 3 });
  assert.equal(result.onsetSample, 1600);
  assert.equal(result.signedOffsetFrames, -2);
  assert.equal(result.withinTolerance, false);
});

test('CLI emits machine-readable measurement, correct failure status and preserves source bytes', () => {
  const folder = mkdtempSync(path.join(tmpdir(), 'onset proof '));
  try {
    const file = path.join(folder, 'cue with spaces.wav');
    const source = wav({ onset: 9600 });
    writeFileSync(file, source);
    const script = new URL('../../registry/skills/audiovisual-review/scripts/measure-onset.mjs', import.meta.url);
    const run = (extra) => spawnSync(process.execPath, [fileURLToPath(script), '--wav', file, '--fps', '30', ...extra], { encoding: 'utf8', windowsHide: true, timeout: 10000 });
    const failed = run([]);
    assert.equal(failed.status, 2, failed.stderr);
    assert.equal(JSON.parse(failed.stdout).signedOffsetFrames, 6);
    const passed = run(['--expected-frame', '6']);
    assert.equal(passed.status, 0, passed.stderr);
    assert.equal(JSON.parse(passed.stdout).withinTolerance, true);
    const duplicate = run(['--fps', '30']);
    assert.equal(duplicate.status, 2);
    assert.equal(duplicate.stdout, '');
    assert.ok(JSON.parse(duplicate.stderr).error);
    assert.deepEqual(readFileSync(file), source);
    writeFileSync(file, wav({ bits: 24, onset: 9600 }));
    const pcm24 = run(['--expected-frame', '6']);
    assert.equal(pcm24.status, 0, pcm24.stderr);
    assert.equal(JSON.parse(pcm24.stdout).format, 'pcm_s24le');
    const float = wav(); float.writeUInt16LE(3, 20);
    writeFileSync(file, float);
    const unsupported = run([]);
    assert.equal(unsupported.status, 2);
    assert.match(JSON.parse(unsupported.stderr).error, /float and extensible.*Decode a separate copy/);
    assert.equal(unsupported.stderr.includes(file), false);
    rmSync(file);
    const missing = run([]);
    assert.equal(missing.status, 2);
    assert.equal(missing.stderr.includes(file), false);
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});
