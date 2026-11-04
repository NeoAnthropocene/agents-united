import { createHash } from 'node:crypto';
import { realpathSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const FORMAT_ERROR = 'Expected mono or stereo PCM16 or PCM24 WAV; float and extensible WAV are unsupported. Decode a separate copy with FFmpeg pcm_s16le (pcm_s24le may still produce extensible WAV).';
const SIZE_ERROR = 'Use a regular PCM16 or PCM24 WAV no larger than 128 MiB.';
const ARGUMENT_ERROR = 'Invalid or duplicate onset arguments.';
const REQUIRED_ERROR = 'Supply --wav and --fps; see --help.';
const SAFE_CLI_ERRORS = new Set([FORMAT_ERROR, SIZE_ERROR, ARGUMENT_ERROR, REQUIRED_ERROR]);

// A reproducible threshold diagnostic, not a perceptual or final-mux sync test.
export function measurePcmOnset(buffer, { fps, expectedFrame = 0, threshold = 0.05, toleranceFrames = 1 } = {}) {
  if (!Number.isInteger(fps) || fps < 1 || fps > 240 || !Number.isFinite(expectedFrame) || expectedFrame < 0
    || !Number.isFinite(threshold) || threshold <= 0 || threshold >= 1
    || !Number.isFinite(toleranceFrames) || toleranceFrames < 0 || toleranceFrames > 240) throw new Error('Invalid onset measurement parameters.');
  if (!Buffer.isBuffer(buffer) || buffer.length < 44 || buffer.toString('ascii', 0, 4) !== 'RIFF'
    || buffer.toString('ascii', 8, 12) !== 'WAVE' || buffer.readUInt32LE(4) + 8 !== buffer.length) throw new Error('Invalid or truncated RIFF WAV.');
  let format, pcm;
  for (let cursor = 12; cursor < buffer.length;) {
    if (cursor + 8 > buffer.length) throw new Error('Truncated WAV chunk.');
    const id = buffer.toString('ascii', cursor, cursor + 4);
    const size = buffer.readUInt32LE(cursor + 4);
    const start = cursor + 8, end = start + size;
    if (end + (size % 2) > buffer.length) throw new Error('Truncated WAV chunk.');
    if (id === 'fmt ') {
      if (format || size < 16) throw new Error('Invalid WAV format chunk.');
      format = { code: buffer.readUInt16LE(start), channels: buffer.readUInt16LE(start + 2), sampleRate: buffer.readUInt32LE(start + 4), byteRate: buffer.readUInt32LE(start + 8), blockAlign: buffer.readUInt16LE(start + 12), bits: buffer.readUInt16LE(start + 14) };
    } else if (id === 'data') {
      if (pcm) throw new Error('Multiple WAV data chunks are unsupported.');
      pcm = buffer.subarray(start, end);
    }
    cursor = end + (size % 2);
  }
  if (!format || !pcm || !pcm.length) throw new Error('WAV requires format and nonempty data.');
  const { channels, sampleRate, blockAlign, byteRate } = format;
  if (format.code !== 1 || ![16, 24].includes(format.bits) || ![1, 2].includes(channels)) throw new Error(FORMAT_ERROR);
  const bytesPerSample = format.bits / 8;
  if (sampleRate < 8000 || sampleRate > 192000 || blockAlign !== channels * bytesPerSample || byteRate !== sampleRate * blockAlign || pcm.length % blockAlign) throw new Error('Invalid sample-aligned PCM WAV.');
  const samples = pcm.length / blockAlign;
  if (expectedFrame / fps >= samples / sampleRate) throw new Error('Expected frame is outside the WAV duration.');
  let peak = 0;
  for (let offset = 0; offset < pcm.length; offset += bytesPerSample) peak = Math.max(peak, Math.abs(pcm.readIntLE(offset, bytesPerSample)));
  let onsetSample = null;
  if (peak) {
    for (let offset = 0; offset < pcm.length; offset += bytesPerSample) {
      if (Math.abs(pcm.readIntLE(offset, bytesPerSample)) > peak * threshold) { onsetSample = Math.floor(offset / blockAlign); break; }
    }
  }
  const onsetSeconds = onsetSample === null ? null : onsetSample / sampleRate;
  const signedOffsetFrames = onsetSeconds === null ? null : onsetSeconds * fps - expectedFrame;
  return {
    schemaVersion: 1, method: 'pcm-relative-peak-threshold', format: `pcm_s${format.bits}le`, bitsPerSample: format.bits, fileSha256: `sha256:${createHash('sha256').update(buffer).digest('hex')}`,
    sampleRate, channels, samples, fps, expectedFrame, threshold, toleranceFrames,
    peakAmplitude: peak / (2 ** (format.bits - 1)), onsetSample, onsetSeconds, signedOffsetFrames,
    withinTolerance: signedOffsetFrames !== null && Math.abs(signedOffsetFrames) <= toleranceFrames,
    listeningReview: 'unverified', perceivedSyncReview: 'unverified',
    limitations: 'First sample above a fraction of file peak; noise, fades and pre-ringing can shift it. Not evidence of audible onset, visual alignment or final-mux sync. Inspect discrete cue stems separately; continuous beds are not onset-gated.',
  };
}

async function main(args) {
  if (args.length === 1 && args[0] === '--help') {
    console.log('measure-onset.mjs --wav file.wav --fps 30 [--expected-frame 0] [--threshold 0.05] [--tolerance-frames 1]. PCM16/24 mono/stereo only; exit 0 within tolerance, 2 failed/invalid. No source mutation.');
    return;
  }
  const flags = new Map();
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index], value = args[index + 1];
    if (!['--wav', '--fps', '--expected-frame', '--threshold', '--tolerance-frames'].includes(flag) || flags.has(flag) || !value || value.startsWith('--')) throw new Error(ARGUMENT_ERROR);
    flags.set(flag, value);
  }
  if (!flags.has('--wav') || !flags.has('--fps')) throw new Error(REQUIRED_ERROR);
  const info = await stat(flags.get('--wav'));
  if (!info.isFile() || info.size > 128 * 1024 * 1024) throw new Error(SIZE_ERROR);
  const result = measurePcmOnset(await readFile(flags.get('--wav')), {
    fps: Number(flags.get('--fps')), expectedFrame: Number(flags.get('--expected-frame') ?? 0),
    threshold: Number(flags.get('--threshold') ?? 0.05), toleranceFrames: Number(flags.get('--tolerance-frames') ?? 1),
  });
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.withinTolerance ? 0 : 2;
}

let isEntry = false;
try { isEntry = Boolean(process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href); }
catch { /* Imported modules may receive non-file node -e arguments. */ }
if (isEntry) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(JSON.stringify({ error: error instanceof Error && SAFE_CLI_ERRORS.has(error.message) ? error.message : 'Cannot measure onset. Check readable PCM16/24 WAV input, RIFF integrity and arguments with --help; human sync remains unverified.' }));
    process.exitCode = 2;
  });
}
