import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/** Original deterministic procedural music bed: harmony, bass, arpeggio, percussion and motif.
 *  Offline only; never samples a recording, never speech. Exclusive new-output WAV. */
const SEMITONE = n => Math.pow(2, n / 12);

export async function composeBed(spec, output) {
  const { fps, totalFrames, bpm = 96, rootHz = 220, style = 'uplift', seed = 1, gainDb = -14 } = spec;
  if (!Number.isFinite(fps) || fps <= 0 || fps > 240) throw new Error('fps must be positive and at most 240');
  if (!Number.isInteger(totalFrames) || totalFrames < 1 || totalFrames / fps > 600) throw new Error('duration must be positive and at most 600 seconds');
  if (!Number.isFinite(bpm) || bpm < 40 || bpm > 220) throw new Error('bpm out of range');
  if (!Number.isFinite(rootHz) || rootHz < 40 || rootHz > 2000) throw new Error('rootHz out of range');
  if (!['uplift', 'calm'].includes(style)) throw new Error('style must be uplift or calm');
  if (!Number.isInteger(seed)) throw new Error('seed must be an integer');
  if (!Number.isFinite(gainDb) || gainDb > 0 || gainDb < -96) throw new Error('gainDb out of range');

  const sampleRate = 48000;
  const total = Math.round(totalFrames * sampleRate / fps);
  const beat = 60 / bpm, bar = 4 * beat;
  const bars = Math.max(1, Math.ceil(total / sampleRate / bar));
  const progression = style === 'uplift'
    ? [[0, 4, 7], [7, 11, 14], [9, 12, 16], [5, 9, 12]]
    : [[0, 4, 7], [5, 9, 12], [9, 12, 16], [7, 11, 14]];
  const chords = Array.from({ length: bars }, (_, i) => progression[i % progression.length]);
  const L = new Float64Array(total), R = new Float64Array(total);
  let state = seed >>> 0;
  const noise = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 0x80000000 - 1; };
  const tone = (i, f, type = 'sine') => {
    const ph = (i * f / sampleRate) % 1;
    return type === 'tri' ? 4 * Math.abs(ph - 0.5) - 1 : Math.sin(ph * 2 * Math.PI);
  };
  const add = (startSec, endSec, f, gain, type, pan = 0, attack = 0.005, decay = 0.35) => {
    const a = Math.max(0, Math.round(startSec * sampleRate));
    const b = Math.min(total, Math.round(endSec * sampleRate));
    for (let i = a; i < b; i++) {
      const u = (i - a) / Math.max(1, b - a);
      const env = Math.min(1, u / attack) * Math.exp(-u * decay * 6);
      const v = tone(i, f, type) * env * gain;
      L[i] += v * (1 - Math.max(0, pan));
      R[i] += v * (1 + Math.min(0, pan));
    }
  };
  const pad = (startSec, chord, dur) => {
    for (const n of chord) {
      const f = rootHz * SEMITONE(n);
      const a = Math.round(startSec * sampleRate);
      const b = Math.min(total, Math.round((startSec + dur) * sampleRate));
      for (let i = a; i < b; i++) {
        const u = (i - a) / Math.max(1, b - a);
        const env = Math.min(1, u / 0.25, (1 - u) / 0.2);
        const v = (tone(i, f) * 0.6 + tone(i, f * 2) * 0.15 + tone(i, f * 0.5) * 0.25) * env * 0.16;
        L[i] += v; R[i] += v * 0.95;
      }
    }
  };
  const kick = t => {
    const a = Math.round(t * sampleRate), b = Math.min(total, a + Math.round(0.16 * sampleRate));
    for (let i = a; i < b; i++) {
      const u = (i - a) / (b - a), f = 110 - 60 * u;
      const v = Math.sin(2 * Math.PI * ((i - a) * f / sampleRate)) * Math.exp(-u * 9) * 0.5;
      L[i] += v; R[i] += v;
    }
  };
  const hat = (t, amp) => {
    const a = Math.round(t * sampleRate), b = Math.min(total, a + Math.round(0.035 * sampleRate));
    for (let i = a; i < b; i++) {
      const u = (i - a) / (b - a);
      const v = noise() * Math.exp(-u * 14) * amp * 0.12;
      L[i] += v; R[i] += v;
    }
  };

  for (let barIdx = 0; barIdx < bars; barIdx++) {
    const t0 = barIdx * bar, chord = chords[barIdx];
    pad(t0, chord, bar + 0.15);
    const bass = rootHz * SEMITONE(chord[0]) / 2;
    for (let b = 0; b < 4; b++) {
      const t = t0 + b * beat;
      add(t, t + beat * 0.95, bass, 0.30, 'tri', 0, 0.004, 0.5);
      if (style === 'uplift' && (b === 0 || b === 2)) kick(t);
      if (style === 'uplift' && (b === 1 || b === 3)) hat(t, 0.9);
      for (let s = 0; s < 2; s++) {
        hat(t + s * beat / 2, style === 'uplift' ? 0.35 : 0.15);
        const n = chord[(b * 2 + s) % chord.length] + 12;
        add(t + s * beat / 2, t + s * beat / 2 + beat * 0.45,
          rootHz * SEMITONE(n) * 2, 0.12, 'sine', (s ? 1 : -1) * 0.4, 0.004, 0.4);
      }
    }
    const motif = [0, 2, 4, 7, 9, 7, 4, 2];
    for (let k = 0; k < motif.length; k++) {
      const n = motif[k] + (style === 'uplift' ? 12 : 0);
      const t = t0 + k * beat / 2;
      add(t, t + beat * 0.48, rootHz * SEMITONE(chord[0] + n) * 2,
        style === 'uplift' ? 0.10 : 0.06, 'sine', 0.2, 0.02, 0.5);
    }
  }

  const gain = Math.pow(10, gainDb / 20);
  const fade = Math.min(Math.round(sampleRate * 0.4), Math.floor(total / 2));
  const bytes = Buffer.alloc(44 + total * 4);
  bytes.write('RIFF', 0); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(2, 22);
  bytes.writeUInt32LE(sampleRate, 24); bytes.writeUInt32LE(sampleRate * 4, 28);
  bytes.writeUInt16LE(4, 32); bytes.writeUInt16LE(16, 34); bytes.write('data', 36); bytes.writeUInt32LE(total * 4, 40);
  for (let i = 0; i < total; i++) {
    const env = Math.min(1, i / fade, (total - 1 - i) / fade);
    const l = Math.tanh(L[i] * gain * env), r = Math.tanh(R[i] * gain * env);
    bytes.writeInt16LE(Math.round(l * 32767), 44 + i * 4);
    bytes.writeInt16LE(Math.round(r * 32767), 46 + i * 4);
  }
  await mkdir(path.dirname(path.resolve(output)), { recursive: true });
  await writeFile(output, bytes, { flag: 'wx' });
  return { sampleRate, channels: 2, samples: total, durationSeconds: total / sampleRate,
    kind: 'procedural-music-bed', bpm, rootHz, style, seed, bars };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [specFile, output] = process.argv.slice(2);
  if (!specFile || specFile === '--help' || !output) console.log('Usage: node compose-bed.mjs <spec.json> <new-output.wav>\nSpec: fps,totalFrames,bpm(40-220),rootHz(40-2000),style(uplift|calm),seed,gainDb. Offline stereo48k PCM; no samples or external calls.');
  else try { console.log(JSON.stringify(await composeBed(JSON.parse(await readFile(specFile, 'utf8')), output))); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
