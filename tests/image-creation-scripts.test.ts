import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

/**
 * Plan 036 S18, `image-creation`: the skill's one script is for the roles that hold a shell (the lead, the front-end architect), because the creative
 * designer cannot measure a file. It reads the header of each generated image (PNG, JPEG, WebP: dimensions only, never pixels), checks that the
 * provenance file she wrote beside it is complete and agrees with the file, that the ratio she asked for is the ratio she got, and that no asset took
 * more than three calls (one call and two regenerations). `--stamp` writes what it measured into the provenance files, which she cannot do.
 * The images here are header-only files built in a temporary folder: the script never decodes a pixel, so the dimensions are the known quantity.
 */

const SCRIPT = path.resolve('registry/skills/image-creation/scripts/image-check.mjs');
const run = (...args: string[]) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });

const u32 = (n: number): Buffer => {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n);
  return b;
};
const chunk = (type: string, data: Buffer): Buffer => Buffer.concat([u32(data.length), Buffer.from(type), data, u32(zlib.crc32(Buffer.concat([Buffer.from(type), data])))]);
/** A PNG that is only a signature, an IHDR and an IEND: a header reader reads it, a decoder does not. */
const png = (w: number, h: number): Buffer =>
  Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', Buffer.concat([u32(w), u32(h), Buffer.from([8, 2, 0, 0, 0])])), chunk('IEND', Buffer.alloc(0))]);
const u16 = (n: number): Buffer => {
  const b = Buffer.alloc(2);
  b.writeUInt16BE(n);
  return b;
};
/** SOI, one APP0 segment to step over, SOF0 with the size, EOI. */
const jpeg = (w: number, h: number): Buffer =>
  Buffer.concat([Buffer.from([0xff, 0xd8]), Buffer.from([0xff, 0xe0]), u16(6), Buffer.from('JFIF'), Buffer.from([0xff, 0xc0]), u16(11), Buffer.from([8]), u16(h), u16(w), Buffer.from([1, 1, 0x11, 0]), Buffer.from([0xff, 0xd9])]);
const le24 = (n: number): Buffer => Buffer.from([n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff]);
const riff = (fourcc: string, payload: Buffer): Buffer => {
  const body = Buffer.concat([Buffer.from('WEBP'), Buffer.from(fourcc), Buffer.from([payload.length & 0xff, (payload.length >> 8) & 0xff, 0, 0]), payload]);
  return Buffer.concat([Buffer.from('RIFF'), Buffer.from([body.length & 0xff, (body.length >> 8) & 0xff, (body.length >> 16) & 0xff, 0]), body]);
};
const webpExtended = (w: number, h: number): Buffer => riff('VP8X', Buffer.concat([Buffer.from([0, 0, 0, 0]), le24(w - 1), le24(h - 1)]));
const webpLossless = (w: number, h: number): Buffer => {
  const bits = ((w - 1) & 0x3fff) | (((h - 1) & 0x3fff) << 14);
  const b = Buffer.alloc(4);
  b.writeUInt32LE(bits >>> 0);
  return riff('VP8L', Buffer.concat([Buffer.from([0x2f]), b]));
};
const webpLossy = (w: number, h: number): Buffer => {
  const wh = Buffer.alloc(4);
  wh.writeUInt16LE(w, 0);
  wh.writeUInt16LE(h, 2);
  return riff('VP8 ', Buffer.concat([Buffer.from([0x10, 0x02, 0x00]), Buffer.from([0x9d, 0x01, 0x2a]), wh]));
};

type Sidecar = Record<string, unknown>;
const sidecar = (file: string, asset: string, attempt: number, extra: Sidecar = {}, parameters: Sidecar = {}): Sidecar => ({
  file,
  asset,
  attempt,
  createdAt: '2026-10-09T09:12:00Z',
  server: 'image-gen (mcp-image 0.14.0)',
  model: 'gemini-3.1-flash-image',
  prompt: 'A warm morning photograph of a sleepy dog on a cream sofa, soft window light, 50mm lens, shallow depth of field.',
  parameters: { aspectRatio: '4:5', imageSize: '2K', quality: 'fast', ...parameters },
  approvedBy: 'the user, in the brief: "go, two images, 2K"',
  estimatedCostUsd: 0.101,
  disclosure: 'Generated with Gemini; carries an invisible SynthID mark; platform label: none required for this placement, checked 2026-10-09.',
  ...extra,
});

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'au-image-check-'));
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

const put = (name: string, bytes: Buffer, card?: Sidecar): void => {
  fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
  fs.writeFileSync(path.join(dir, name), bytes);
  if (card) fs.writeFileSync(path.join(dir, name.replace(/\.\w+$/, '.provenance.json')), `${JSON.stringify(card, null, 2)}\n`);
};

type Row = { file: string; format: string; width: number; height: number; nearestRatio: string; offPercent: number; bytes: number; sha256: string; sidecar: string };
type Finding = { file: string; type: string; detail: string };
type Report = { checked: number; images: Row[]; findings: Finding[]; calls: number; costUsd: number };
const json = (...args: string[]): { status: number | null; report: Report } => {
  const r = run(dir, ...args, '--json');
  return { status: r.status, report: JSON.parse(r.stdout) as Report };
};

describe('the header reader: PNG, JPEG and the three WebP encodings', () => {
  it('reads the dimensions, the format, the nearest ratio the server offers and how far off it is', () => {
    put('a.png', png(1856, 2304), sidecar('a.png', 'a', 1));
    put('b.jpg', jpeg(2752, 1536), sidecar('b.jpg', 'b', 1, {}, { aspectRatio: '16:9' }));
    put('c.webp', webpExtended(768, 1376), sidecar('c.webp', 'c', 1, {}, { aspectRatio: '9:16' }));
    put('d.webp', webpLossless(1024, 1024), sidecar('d.webp', 'd', 1, {}, { aspectRatio: '1:1' }));
    put('e.webp', webpLossy(1376, 768), sidecar('e.webp', 'e', 1, {}, { aspectRatio: '16:9' }));
    const { report } = json();
    expect(report.images.map(r => [r.file, r.format, r.width, r.height, r.nearestRatio])).toEqual([
      ['a.png', 'png', 1856, 2304, '4:5'],
      ['b.jpg', 'jpeg', 2752, 1536, '16:9'],
      ['c.webp', 'webp', 768, 1376, '9:16'],
      ['d.webp', 'webp', 1024, 1024, '1:1'],
      ['e.webp', 'webp', 1376, 768, '16:9'],
    ]);
    expect(report.images[0]!.offPercent).toBeLessThan(0.1);
    expect(report.images[2]!.offPercent).toBeGreaterThan(0.5);
    expect(report.images[2]!.offPercent).toBeLessThan(1);
  });

  it('gives the byte count and the SHA-256 of the file', () => {
    const bytes = png(1024, 1024);
    put('a.png', bytes, sidecar('a.png', 'a', 1, {}, { aspectRatio: '1:1' }));
    const row = json().report.images[0]!;
    expect(row.bytes).toBe(bytes.length);
    expect(row.sha256).toBe(crypto.createHash('sha256').update(bytes).digest('hex'));
  });

  it('reports a file it cannot read as unreadable and carries on', () => {
    put('broken.png', Buffer.from('not an image at all'));
    put('ok.png', png(1024, 1024), sidecar('ok.png', 'ok', 1, {}, { aspectRatio: '1:1' }));
    const { status, report } = json();
    expect(status).toBe(1);
    expect(report.checked).toBe(2);
    expect(report.findings).toEqual([{ file: 'broken.png', type: 'unreadable', detail: expect.stringMatching(/header/i) }]);
  });
});

describe('the provenance file beside each image', () => {
  it('is clean and exits 0 when every image has a complete file that agrees with it', () => {
    put('hero-a1.png', png(1856, 2304), sidecar('hero-a1.png', 'hero', 1));
    put('banner-a1.png', png(2752, 1536), sidecar('banner-a1.png', 'banner', 1, {}, { aspectRatio: '16:9' }));
    const { status, report } = json();
    expect(status).toBe(0);
    expect(report.findings).toEqual([]);
    expect(report.calls).toBe(2);
    expect(report.costUsd).toBeCloseTo(0.202, 5);
  });

  it('finds an image with no file, a file that names another image, and a file with missing fields', () => {
    put('bare.png', png(1024, 1024));
    put('moved.png', png(1024, 1024), sidecar('other.png', 'moved', 1, {}, { aspectRatio: '1:1' }));
    const thin = sidecar('thin.png', 'thin', 1, {}, { aspectRatio: '1:1' });
    delete thin.prompt;
    delete thin.approvedBy;
    delete thin.disclosure;
    put('thin.png', png(1024, 1024), thin);
    const { status, report } = json();
    expect(status).toBe(1);
    expect(report.findings.map(f => `${f.file} ${f.type}`)).toEqual(['bare.png no-sidecar', 'moved.png file-mismatch', 'thin.png incomplete']);
    expect(report.findings[2]!.detail).toMatch(/prompt/);
    expect(report.findings[2]!.detail).toMatch(/approvedBy/);
    expect(report.findings[2]!.detail).toMatch(/disclosure/);
  });

  it('rejects a file that is not JSON, an attempt that is not a positive whole number and a cost that is not a number', () => {
    put('junk.png', png(1024, 1024));
    fs.writeFileSync(path.join(dir, 'junk.provenance.json'), '{ not json');
    put('zero.png', png(1024, 1024), sidecar('zero.png', 'zero', 0, {}, { aspectRatio: '1:1' }));
    put('free.png', png(1024, 1024), sidecar('free.png', 'free', 1, { estimatedCostUsd: 'cheap' }, { aspectRatio: '1:1' }));
    const { report } = json();
    expect(report.findings.map(f => `${f.file} ${f.type}`)).toEqual(['free.png incomplete', 'junk.png incomplete', 'zero.png incomplete']);
    expect(report.findings[1]!.detail).toMatch(/not JSON/);
    expect(report.findings[2]!.detail).toMatch(/attempt/);
  });

  it('finds a provenance file with no image beside it', () => {
    fs.writeFileSync(path.join(dir, 'ghost.provenance.json'), `${JSON.stringify(sidecar('ghost.png', 'ghost', 1))}\n`);
    expect(json().report.findings).toEqual([{ file: 'ghost.provenance.json', type: 'orphan-sidecar', detail: expect.stringContaining('ghost.png') }]);
  });
});

describe('the ratio she asked for is the ratio she got', () => {
  it('flags a square delivered for a 16:9 request and accepts the server\'s own rounding (928 x 1152 for 4:5)', () => {
    put('ok-a1.png', png(928, 1152), sidecar('ok-a1.png', 'ok', 1));
    put('wide-a1.png', png(2048, 2048), sidecar('wide-a1.png', 'wide', 1, {}, { aspectRatio: '16:9' }));
    const { report } = json();
    expect(report.findings.map(f => `${f.file} ${f.type}`)).toEqual(['wide-a1.png ratio']);
    expect(report.findings[0]!.detail).toMatch(/asked 16:9.*got 2048 x 2048.*1:1/);
  });
});

describe('the cap of three calls per asset', () => {
  it('finds an asset with a fourth image and names the asset', () => {
    for (const n of [1, 2, 3, 4]) put(`hero-a${n}.png`, png(1856, 2304), sidecar(`hero-a${n}.png`, 'hero', Math.min(n, 3)));
    const { report } = json();
    expect(report.findings).toEqual([{ file: 'hero', type: 'attempts', detail: expect.stringMatching(/4 images.*cap is 3/) }]);
    expect(report.calls).toBe(4);
  });

  it('takes another cap from --max-attempts', () => {
    for (const n of [1, 2]) put(`hero-a${n}.png`, png(1856, 2304), sidecar(`hero-a${n}.png`, 'hero', n));
    expect(json('--max-attempts', '1').report.findings.map(f => f.type)).toEqual(['attempts']);
    expect(json('--max-attempts', '2').report.findings).toEqual([]);
  });
});

describe('--stamp writes what was measured into the provenance file, and nothing else', () => {
  it('adds measured size and hash once, leaves the other fields alone, and later runs compare against it', () => {
    const bytes = png(1856, 2304);
    put('hero-a1.png', bytes, sidecar('hero-a1.png', 'hero', 1));
    const before = JSON.parse(fs.readFileSync(path.join(dir, 'hero-a1.provenance.json'), 'utf8')) as Sidecar;
    expect(run(dir, '--stamp').status).toBe(0);
    const after = JSON.parse(fs.readFileSync(path.join(dir, 'hero-a1.provenance.json'), 'utf8')) as Sidecar;
    expect(after.measured).toEqual({ width: 1856, height: 2304, bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') });
    const { measured: _measured, ...rest } = after;
    expect(rest).toEqual(before);
    expect(json().report.findings).toEqual([]);
    // the file changes after it was recorded: the next run says so, and stamping again does not rewrite the record to hide it
    fs.writeFileSync(path.join(dir, 'hero-a1.png'), png(1856, 2305));
    expect(json().report.findings.map(f => f.type)).toEqual(['measured-mismatch']);
    run(dir, '--stamp');
    expect(JSON.parse(fs.readFileSync(path.join(dir, 'hero-a1.provenance.json'), 'utf8'))).toEqual(after);
    expect(json().report.findings.map(f => f.type)).toEqual(['measured-mismatch']);
  });

  it('does not stamp without the flag, and does not touch an image that has no file or an unreadable one', () => {
    put('hero-a1.png', png(1856, 2304), sidecar('hero-a1.png', 'hero', 1));
    json();
    expect(JSON.parse(fs.readFileSync(path.join(dir, 'hero-a1.provenance.json'), 'utf8'))).not.toHaveProperty('measured');
    put('bare.png', png(1024, 1024));
    run(dir, '--stamp');
    expect(fs.existsSync(path.join(dir, 'bare.provenance.json'))).toBe(false);
  });
});

describe('the command line', () => {
  it('prints one line per image, the findings, and a summary with the recorded cost', () => {
    put('hero-a1.png', png(1856, 2304), sidecar('hero-a1.png', 'hero', 1));
    put('wide-a1.png', png(2048, 2048), sidecar('wide-a1.png', 'wide', 1, {}, { aspectRatio: '16:9' }));
    const r = run(dir);
    expect(r.status).toBe(1);
    expect(r.stdout).toMatch(/^hero-a1\.png +png +1856 x 2304 +4:5 +\d+ B +sha256:[0-9a-f]{12} +provenance ok$/m);
    expect(r.stdout).toMatch(/^wide-a1\.png +png +2048 x 2048 +1:1 +\d+ B +sha256:[0-9a-f]{12} +provenance ok$/m);
    expect(r.stdout).toMatch(/^wide-a1\.png +ratio +asked 16:9, got 2048 x 2048 \(1:1\)/m);
    expect(r.stdout).toMatch(/checked 2 images; 1 finding \(ratio 1\); 2 calls recorded, estimated cost 0\.20 USD/);
  });

  it('walks sub-folders and lists files in name order', () => {
    put('b/two.png', png(1024, 1024), sidecar('two.png', 'two', 1, {}, { aspectRatio: '1:1' }));
    put('a/one.png', png(1024, 1024), sidecar('one.png', 'one', 1, {}, { aspectRatio: '1:1' }));
    expect(json().report.images.map(r => r.file)).toEqual(['a/one.png', 'b/two.png']);
  });

  it('says so, and exits 0, for a folder with no images', () => {
    const r = run(dir);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/checked 0 images; no findings/);
  });

  it('exits 2 with a usage line for no folder, a folder that is not there, an unknown option and a bad cap', () => {
    for (const args of [[], [path.join(dir, 'nope')], [dir, '--frobnicate'], [dir, '--max-attempts', 'x']]) {
      const r = run(...args);
      expect(r.status, JSON.stringify(args)).toBe(2);
      expect(r.stderr, JSON.stringify(args)).toMatch(/usage: node image-check\.mjs|cannot read/);
    }
  });
});
