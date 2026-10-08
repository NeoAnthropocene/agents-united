import zlib from 'node:zlib';

/**
 * Plan 036 S0: a small PNG reader for the designer fixtures. It reads 8-bit, non-interlaced PNGs (what Chromium
 * writes) and answers two questions: how big is the image, and which rows are blank. A render can write a file of
 * the right size whose last rows were never painted (evaluation, "Checks run": 87 blank rows under `--headless=new`
 * on one build), so the size alone proves nothing. Test support only: nothing under `src/` reads an image.
 */

export interface DecodedPng {
  width: number;
  height: number;
  colorType: number;
  channels: number;
  rows: Uint8Array[];
  palette: Uint8Array | null;
}

export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface PixelBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const SIGNATURE = '89504e470d0a1a0a';
const CHANNELS: Readonly<Record<number, number>> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/** Decode an 8-bit, non-interlaced PNG into unfiltered scanlines. Throws on anything else, with the reason. */
export function decodePng(bytes: Uint8Array): DecodedPng {
  const buf = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (buf.length < 8 || buf.subarray(0, 8).toString('hex') !== SIGNATURE) throw new Error('not a PNG: the signature is wrong');
  let width = 0;
  let height = 0;
  let depth = 0;
  let colorType = -1;
  let interlace = 0;
  let palette: Uint8Array | null = null;
  const idat: Buffer[] = [];
  let pos = 8;
  while (pos + 8 <= buf.length) {
    const length = buf.readUInt32BE(pos);
    const type = buf.toString('latin1', pos + 4, pos + 8);
    const body = buf.subarray(pos + 8, pos + 8 + length);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      depth = body[8]!;
      colorType = body[9]!;
      interlace = body[12]!;
    } else if (type === 'PLTE') palette = new Uint8Array(body);
    else if (type === 'IDAT') idat.push(body);
    else if (type === 'IEND') break;
    pos += 12 + length;
  }
  if (colorType < 0) throw new Error('not a PNG: there is no IHDR chunk');
  if (depth !== 8 || interlace !== 0) throw new Error(`unsupported PNG: bit depth ${depth}, interlace ${interlace} (only 8-bit, non-interlaced is read)`);
  const channels = CHANNELS[colorType];
  if (channels === undefined) throw new Error(`unsupported PNG colour type ${colorType}`);
  const stride = width * channels;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  if (raw.length !== height * (stride + 1)) throw new Error(`corrupt PNG: ${raw.length} bytes of pixel data for ${width}x${height}`);
  const rows: Uint8Array[] = [];
  let prev: Uint8Array = new Uint8Array(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]!;
    const line = new Uint8Array(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? line[i - channels]! : 0;
      const b = prev[i]!;
      const c = i >= channels ? prev[i - channels]! : 0;
      let add = 0;
      if (filter === 1) add = a;
      else if (filter === 2) add = b;
      else if (filter === 3) add = (a + b) >> 1;
      else if (filter === 4) add = paeth(a, b, c);
      else if (filter !== 0) throw new Error(`corrupt PNG: filter type ${filter} in row ${y}`);
      line[i] = (line[i]! + add) & 255;
    }
    rows.push(line);
    prev = line;
  }
  return { width, height, colorType, channels, rows, palette };
}

export function pixelAt(png: DecodedPng, x: number, y: number): Rgba {
  const row = png.rows[y]!;
  const o = x * png.channels;
  switch (png.colorType) {
    case 6:
      return { r: row[o]!, g: row[o + 1]!, b: row[o + 2]!, a: row[o + 3]! };
    case 2:
      return { r: row[o]!, g: row[o + 1]!, b: row[o + 2]!, a: 255 };
    case 0:
      return { r: row[o]!, g: row[o]!, b: row[o]!, a: 255 };
    case 4:
      return { r: row[o]!, g: row[o]!, b: row[o]!, a: row[o + 1]! };
    default: {
      if (!png.palette) throw new Error('corrupt PNG: a palette image without a PLTE chunk');
      const i = row[o]! * 3;
      return { r: png.palette[i]!, g: png.palette[i + 1]!, b: png.palette[i + 2]!, a: 255 };
    }
  }
}

export function toHex(p: Rgba): string {
  return '#' + [p.r, p.g, p.b].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
}

/** A row is blank when every pixel is fully transparent or pure white: nothing was painted there. */
export function blankRows(png: DecodedPng): number[] {
  const blank: number[] = [];
  for (let y = 0; y < png.height; y++) {
    let isBlank = true;
    for (let x = 0; x < png.width && isBlank; x++) {
      const p = pixelAt(png, x, y);
      isBlank = p.a === 0 || (p.r === 255 && p.g === 255 && p.b === 255);
    }
    if (isBlank) blank.push(y);
  }
  return blank;
}

/** How many blank rows end the image, counted from the bottom row upwards. */
export function trailingBlankRows(png: DecodedPng): number {
  const blank = new Set(blankRows(png));
  let n = 0;
  for (let y = png.height - 1; y >= 0 && blank.has(y); y--) n++;
  return n;
}

/** The smallest box that holds every pixel where two same-sized images differ, or null when they are identical. */
export function diffBounds(a: DecodedPng, b: DecodedPng): PixelBox | null {
  if (a.width !== b.width || a.height !== b.height) throw new Error(`size mismatch: ${a.width}x${a.height} against ${b.width}x${b.height}`);
  let box: PixelBox | null = null;
  for (let y = 0; y < a.height; y++) {
    const ra = a.rows[y]!;
    const rb = b.rows[y]!;
    if (a.colorType === b.colorType && ra.length === rb.length && ra.every((v, i) => v === rb[i])) continue;
    for (let x = 0; x < a.width; x++) {
      const pa = pixelAt(a, x, y);
      const pb = pixelAt(b, x, y);
      if (pa.r === pb.r && pa.g === pb.g && pa.b === pb.b && pa.a === pb.a) continue;
      box = box ? { x0: Math.min(box.x0, x), y0: Math.min(box.y0, y), x1: Math.max(box.x1, x), y1: Math.max(box.y1, y) } : { x0: x, y0: y, x1: x, y1: y };
    }
  }
  return box;
}

/** Encode an 8-bit RGB PNG (filter 0). For negative controls only: it makes a file of any size with any blank rows. */
export function encodeRgbPng(width: number, height: number, paint: (x: number, y: number) => readonly [number, number, number]): Buffer {
  const stride = width * 3;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    for (let x = 0; x < width; x++) {
      const [r, g, b] = paint(x, y);
      const o = y * (stride + 1) + 1 + x * 3;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
    }
  }
  const chunk = (type: string, body: Buffer): Buffer => {
    const head = Buffer.alloc(8);
    head.writeUInt32BE(body.length, 0);
    head.write(type, 4, 'latin1');
    const tail = Buffer.alloc(4);
    tail.writeUInt32BE(zlib.crc32(Buffer.concat([head.subarray(4), body])), 0);
    return Buffer.concat([head, body, tail]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([Buffer.from(SIGNATURE, 'hex'), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
