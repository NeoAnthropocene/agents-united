// Image check: the size of each generated PNG, JPEG or WebP, and whether the provenance file beside it is complete and agrees with it.
// Usage: node image-check.mjs <folder> [--max-attempts N] [--stamp] [--json]
// Exit code: 0 when nothing is wrong, 1 when something is, 2 for a usage error.
// It reads file headers only (never a pixel), walks the folder, and writes nothing unless --stamp is given: then it adds a `measured` block
// (width, height, bytes, SHA-256) to each provenance file that has none, because the role that wrote the file holds no shell and cannot measure.
// It does not judge the picture. Whether the paws are right, the copy zone is empty or the light fits the brief is for eyes (`Read` the file).
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const IMAGE_FORMAT = new Map([['.png', 'png'], ['.jpg', 'jpeg'], ['.jpeg', 'jpeg'], ['.webp', 'webp']]);
const SKIP_DIRS = new Set(['node_modules', '.git']);
/** The ratios the image server offers for `aspectRatio` (mcp-image 0.14.0). */
export const RATIOS = ['1:1', '1:4', '1:8', '2:3', '3:2', '3:4', '4:1', '4:3', '4:5', '5:4', '8:1', '9:16', '16:9', '21:9'];
/** How far (percent) the measured ratio may be from the ratio asked for: the server rounds to the model's pixel grid (928 x 1152 for 4:5 is 0.7 off). */
const RATIO_TOLERANCE = 3;
const DEFAULT_MAX_ATTEMPTS = 3;
const PROVENANCE_SUFFIX = '.provenance.json';
const FINDING_ORDER = ['unreadable', 'no-sidecar', 'incomplete', 'file-mismatch', 'measured-mismatch', 'ratio', 'attempts', 'orphan-sidecar'];
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const posix = p => p.split(path.sep).join('/');

/** `{ format, width, height }` from the first bytes of a PNG, JPEG or WebP file; undefined when the header is not one of those. */
export function readDimensions(buf) {
  if (buf.length >= 24 && buf.subarray(0, 8).equals(PNG_SIGNATURE) && buf.toString('latin1', 12, 16) === 'IHDR') {
    return { format: 'png', width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 4 <= buf.length) {
      if (buf[i] !== 0xff) return undefined;
      while (buf[i + 1] === 0xff) i += 1;
      const marker = buf[i + 1];
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) {
        i += 2;
        continue;
      }
      const length = buf.readUInt16BE(i + 2);
      const isFrame = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isFrame) return i + 9 <= buf.length ? { format: 'jpeg', height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) } : undefined;
      i += 2 + length;
    }
    return undefined;
  }
  if (buf.length >= 25 && buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP') {
    const kind = buf.toString('latin1', 12, 16);
    if (kind === 'VP8X' && buf.length >= 30) return { format: 'webp', width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
    if (kind === 'VP8L' && buf[20] === 0x2f) {
      const bits = buf.readUInt32LE(21);
      return { format: 'webp', width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
    }
    if (kind === 'VP8 ' && buf.length >= 30 && buf[23] === 0x9d && buf[24] === 0x01 && buf[25] === 0x2a) {
      return { format: 'webp', width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
    }
  }
  return undefined;
}

/** The offered ratio closest to width:height, and how far off it is in percent. */
export function nearestRatio(width, height) {
  const measured = width / height;
  let best = { name: RATIOS[0], off: Infinity };
  for (const name of RATIOS) {
    const [a, b] = name.split(':').map(Number);
    const off = (Math.abs(measured - a / b) / (a / b)) * 100;
    if (off < best.off) best = { name, off };
  }
  return { name: best.name, offPercent: Math.round(best.off * 100) / 100 };
}

const isText = v => typeof v === 'string' && v.trim().length > 0;
const get = (o, dotted) => dotted.split('.').reduce((acc, key) => (acc && typeof acc === 'object' ? acc[key] : undefined), o);

/** What is missing or wrong in a parsed provenance file: an empty list when it is complete. */
export function provenanceProblems(card) {
  if (card === null || typeof card !== 'object' || Array.isArray(card)) return ['it is not a JSON object'];
  const problems = [];
  for (const key of ['file', 'asset', 'createdAt', 'server', 'model', 'prompt', 'parameters.aspectRatio', 'parameters.imageSize', 'approvedBy', 'disclosure']) {
    if (!isText(get(card, key))) problems.push(`missing ${key}`);
  }
  if (!Number.isInteger(card.attempt) || card.attempt < 1) problems.push('attempt must be a positive whole number');
  if (typeof card.estimatedCostUsd !== 'number' || !Number.isFinite(card.estimatedCostUsd) || card.estimatedCostUsd < 0) problems.push('estimatedCostUsd must be a number');
  const asked = get(card, 'parameters.aspectRatio');
  if (isText(asked) && !RATIOS.includes(asked)) problems.push(`parameters.aspectRatio ${asked} is not one the server offers`);
  return problems;
}

function walk(root, dir = root, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(root, path.join(dir, entry.name), out);
    } else out.push(posix(path.relative(root, path.join(dir, entry.name))));
  }
  return out;
}

/** Check every image under `folder`. With `stamp`, add the `measured` block to provenance files that lack one. */
export function checkFolder({ folder, maxAttempts = DEFAULT_MAX_ATTEMPTS, stamp = false }) {
  const files = walk(folder).sort(compare);
  const images = [];
  const findings = [];
  const cards = [];
  let stamped = 0;
  const imageStems = new Set();

  for (const rel of files) {
    const ext = path.extname(rel).toLowerCase();
    if (!IMAGE_FORMAT.has(ext)) continue;
    imageStems.add(rel.slice(0, -ext.length));
    const bytes = fs.readFileSync(path.join(folder, rel));
    const dims = readDimensions(bytes);
    const row = { file: rel, format: dims?.format ?? null, width: dims?.width ?? null, height: dims?.height ?? null, nearestRatio: null, offPercent: null, bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex'), sidecar: 'ok' };
    images.push(row);
    if (!dims) {
      findings.push({ file: rel, type: 'unreadable', detail: 'cannot read an image header (not a PNG, JPEG or WebP)' });
      row.sidecar = 'unchecked';
      continue;
    }
    const near = nearestRatio(dims.width, dims.height);
    row.nearestRatio = near.name;
    row.offPercent = near.offPercent;

    const cardPath = path.join(folder, `${rel.slice(0, -ext.length)}${PROVENANCE_SUFFIX}`);
    if (!fs.existsSync(cardPath)) {
      row.sidecar = 'missing';
      findings.push({ file: rel, type: 'no-sidecar', detail: `no ${path.basename(cardPath)} beside it` });
      continue;
    }
    let card;
    try {
      card = JSON.parse(fs.readFileSync(cardPath, 'utf8'));
    } catch (e) {
      row.sidecar = 'incomplete';
      findings.push({ file: rel, type: 'incomplete', detail: `the provenance file is not JSON (${e.message})` });
      continue;
    }
    cards.push({ rel, card });
    const problems = provenanceProblems(card);
    if (problems.length > 0) {
      row.sidecar = 'incomplete';
      findings.push({ file: rel, type: 'incomplete', detail: `the provenance file is incomplete: ${problems.join(', ')}` });
    }
    if (card && typeof card === 'object' && isText(card.file) && card.file !== path.basename(rel)) {
      if (row.sidecar === 'ok') row.sidecar = 'mismatch';
      findings.push({ file: rel, type: 'file-mismatch', detail: `the provenance file names ${card.file}, the image is ${path.basename(rel)}` });
    }
    const asked = get(card, 'parameters.aspectRatio');
    if (isText(asked) && RATIOS.includes(asked)) {
      const [a, b] = asked.split(':').map(Number);
      const off = (Math.abs(dims.width / dims.height - a / b) / (a / b)) * 100;
      if (off > RATIO_TOLERANCE) findings.push({ file: rel, type: 'ratio', detail: `asked ${asked}, got ${dims.width} x ${dims.height} (${near.name})` });
    }
    const measured = { width: dims.width, height: dims.height, bytes: bytes.length, sha256: row.sha256 };
    if (card && typeof card === 'object' && !Array.isArray(card)) {
      if (card.measured && typeof card.measured === 'object') {
        const differs = Object.keys(measured).filter(key => card.measured[key] !== measured[key]);
        if (differs.length > 0) {
          if (row.sidecar === 'ok') row.sidecar = 'mismatch';
          findings.push({ file: rel, type: 'measured-mismatch', detail: `the file changed after it was recorded (${differs.join(', ')} differ from the measured block)` });
        }
      } else if (stamp) {
        fs.writeFileSync(cardPath, `${JSON.stringify({ ...card, measured }, null, 2)}\n`);
        stamped += 1;
      }
    }
  }

  const byAsset = new Map();
  for (const { rel, card } of cards) {
    if (card && typeof card === 'object' && isText(card.asset)) byAsset.set(card.asset, [...(byAsset.get(card.asset) ?? []), rel]);
  }
  for (const [asset, list] of byAsset) {
    if (list.length > maxAttempts) findings.push({ file: asset, type: 'attempts', detail: `${list.length} images for the asset ${asset}; the cap is ${maxAttempts} (one call and ${maxAttempts - 1} regenerations)` });
  }

  for (const rel of files) {
    if (!rel.endsWith(PROVENANCE_SUFFIX) || imageStems.has(rel.slice(0, -PROVENANCE_SUFFIX.length))) continue;
    let named = 'no image';
    try {
      const card = JSON.parse(fs.readFileSync(path.join(folder, rel), 'utf8'));
      if (card && isText(card.file)) named = card.file;
    } catch {
      // not JSON: it still has no image beside it
    }
    findings.push({ file: rel, type: 'orphan-sidecar', detail: `the provenance file names ${named}, but no image sits beside it` });
  }

  findings.sort((a, b) => compare(a.file, b.file) || FINDING_ORDER.indexOf(a.type) - FINDING_ORDER.indexOf(b.type));
  const costUsd = Math.round(cards.reduce((sum, { card }) => sum + (typeof card?.estimatedCostUsd === 'number' && Number.isFinite(card.estimatedCostUsd) ? card.estimatedCostUsd : 0), 0) * 1e6) / 1e6;
  return { checked: images.length, images, findings, calls: cards.length, costUsd, stamped };
}

function usage(message) {
  if (message) console.error(message);
  console.error('usage: node image-check.mjs <folder> [--max-attempts N] [--stamp] [--json]');
  process.exit(2);
}

function main(argv) {
  const positional = [];
  let maxAttempts = DEFAULT_MAX_ATTEMPTS;
  let stamp = false;
  let asJson = false;
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--json') asJson = true;
    else if (a === '--stamp') stamp = true;
    else if (a === '--max-attempts') {
      maxAttempts = Number(argv[++i]);
      if (!Number.isInteger(maxAttempts) || maxAttempts < 1) usage('--max-attempts needs a positive whole number');
    } else if (a.startsWith('--')) usage(`unknown option ${a}`);
    else positional.push(a);
  }
  if (positional.length !== 1) usage();
  const folder = positional[0];
  let report;
  try {
    if (!fs.statSync(folder).isDirectory()) throw new Error(`${folder} is not a folder`);
    report = checkFolder({ folder, maxAttempts, stamp });
  } catch (e) {
    usage(`cannot read: ${e.message}`);
  }
  const code = report.findings.length > 0 ? 1 : 0;
  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
    process.exit(code);
  }
  const wFile = Math.max(0, ...report.images.map(r => r.file.length), ...report.findings.map(f => f.file.length));
  const wFormat = Math.max(0, ...report.images.map(r => (r.format ?? 'unreadable').length));
  const wDims = Math.max(0, ...report.images.map(r => (r.width === null ? 0 : `${r.width} x ${r.height}`.length)));
  const wRatio = Math.max(0, ...report.images.map(r => (r.nearestRatio ?? '').length));
  for (const r of report.images) {
    if (r.width === null) console.log(`${r.file.padEnd(wFile)}  unreadable`);
    else console.log(`${r.file.padEnd(wFile)}  ${r.format.padEnd(wFormat)}  ${`${r.width} x ${r.height}`.padEnd(wDims)}  ${r.nearestRatio.padEnd(wRatio)}  ${r.bytes} B  sha256:${r.sha256.slice(0, 12)}  provenance ${r.sidecar}`);
  }
  const wType = Math.max(0, ...report.findings.map(f => f.type.length));
  for (const f of report.findings) console.log(`${f.file.padEnd(wFile)}  ${f.type.padEnd(wType)}  ${f.detail}`);
  const counts = FINDING_ORDER.map(type => [type, report.findings.filter(f => f.type === type).length]).filter(([, n]) => n > 0);
  const found = report.findings.length === 0 ? 'no findings' : `${report.findings.length} finding${report.findings.length === 1 ? '' : 's'} (${counts.map(([type, n]) => `${type} ${n}`).join(', ')})`;
  const recorded = report.calls > 0 ? `; ${report.calls} call${report.calls === 1 ? '' : 's'} recorded, estimated cost ${report.costUsd.toFixed(2)} USD` : '';
  console.log(`checked ${report.checked} image${report.checked === 1 ? '' : 's'}; ${found}${recorded}`);
  if (stamp) console.log(`stamped ${report.stamped} provenance file${report.stamped === 1 ? '' : 's'} with the measured size and hash`);
  process.exit(code);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2));
