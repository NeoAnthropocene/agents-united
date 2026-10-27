import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/** Original deterministic PCM synthesizer: tones, noise and pitch sweeps, never speech. */
export async function synthesizeWav(spec, output) {
  const { fps, totalFrames, waveform = 'sine', frequency = 440, endFrequency = frequency, gainDb = -18, seed = 1 } = spec;
  if (!Number.isFinite(fps) || fps <= 0 || fps > 240 || !Number.isInteger(totalFrames) || totalFrames < 1 || totalFrames / fps > 600) throw new Error('duration must be positive and at most 600 seconds');
  if (!['sine', 'triangle', 'noise'].includes(waveform) || !Number.isFinite(gainDb) || gainDb > 0 || gainDb < -96) throw new Error('invalid waveform or gain');
  if (![frequency, endFrequency].every(n => Number.isFinite(n) && n >= 20 && n <= 20000) || !Number.isInteger(seed)) throw new Error('invalid frequency or seed');
  const sampleRate = 48000;
  const samples = Math.round(totalFrames * sampleRate / fps);
  const bytes = Buffer.alloc(44 + samples * 4);
  bytes.write('RIFF', 0); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(2, 22);
  bytes.writeUInt32LE(sampleRate, 24); bytes.writeUInt32LE(sampleRate * 4, 28);
  bytes.writeUInt16LE(4, 32); bytes.writeUInt16LE(16, 34); bytes.write('data', 36); bytes.writeUInt32LE(samples * 4, 40);
  let state = seed >>> 0, phase = 0;
  const gain = 10 ** (gainDb / 20), fade = Math.min(480, Math.floor(samples / 2));
  for (let i = 0; i < samples; i++) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const f = frequency + (endFrequency - frequency) * i / samples;
    phase = (phase + f / sampleRate) % 1;
    const signal = waveform === 'noise' ? state / 0x80000000 - 1 : waveform === 'triangle' ? 4 * Math.abs(phase - 0.5) - 1 : Math.sin(phase * 2 * Math.PI);
    const envelope = Math.min(1, i / fade, (samples - 1 - i) / fade);
    const value = Math.round(Math.max(-1, Math.min(1, signal * gain * envelope)) * 32767);
    bytes.writeInt16LE(value, 44 + i * 4); bytes.writeInt16LE(value, 46 + i * 4);
  }
  await mkdir(path.dirname(path.resolve(output)), { recursive: true });
  await writeFile(output, bytes, { flag: 'wx' });
  return { sampleRate, channels: 2, samples, durationSeconds: samples / sampleRate, kind: 'original-synthesis', waveform, seed };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [specFile, output] = process.argv.slice(2);
  if (!specFile || specFile === '--help' || !output) console.log('Usage: node synthesize.mjs <spec.json> <new-output.wav>\nSpec: fps,totalFrames,waveform(sine|triangle|noise),frequency,endFrequency,gainDb,seed. Offline stereo48k PCM; no speech or external calls.');
  else try { console.log(JSON.stringify(await synthesizeWav(JSON.parse(await readFile(specFile, 'utf8')), output))); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
