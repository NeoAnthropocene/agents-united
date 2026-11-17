#!/usr/bin/env node
import { parseArgs } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

// Caller-operated consistency checks only. Nothing is written, fetched, or executed from a record;
// the only subprocess is the read-only git HEAD query on the selected checkout.
class Stop extends Error {
  constructor(code, reason, status = 'failed', file = null) { super(reason); this.code = code; this.status = status; this.file = file; }
}
class SchemaError extends Error {
  constructor(at, reason) { super(reason); this.at = at; }
}
const stop = (code, reason, status = 'failed', file = null) => { throw new Stop(code, reason, status, file); };
const fail = message => { throw new Error(message); };
let phase = 'usage';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const canonical = value => Array.isArray(value) ? `[${value.map(canonical).join(',')}]`
  : value !== null && typeof value === 'object' ? `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`
    : JSON.stringify(value);
const same = (a, b) => canonical(a) === canonical(b);
// Case folding is sound only where the filesystem ignores case; on every other platform names are compared exactly.
const foldName = name => process.platform === 'win32' ? name.toLowerCase() : name;
const folded = file => foldName(path.resolve(file));
const relWithin = (parent, child) => {
  const rel = path.relative(parent, child);
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel));
};
const within = (parent, child) => relWithin(folded(parent), folded(child));
// The physical spelling of a path, the rule of the return checkers (copied on purpose, never imported): the deepest existing ancestor is
// resolved by the platform (a short name, another case on an ignoring volume, both become the one real name) and the absent rest is
// appended. Only ENOENT and ENOTDIR walk up to the parent; any other error is refused with the path and the code, so a root check never
// silently falls back to comparing strings. Links are refused on the path as given before a path reaches this function.
function physical(file, code) {
  const full = path.resolve(file);
  const rest = [];
  for (let current = full; ;) {
    try { return path.join(fs.realpathSync.native(current), ...rest); } catch (error) {
      if (error?.code !== 'ENOENT' && error?.code !== 'ENOTDIR') stop(code, `Cannot resolve the physical path of ${current}: ${error?.code ?? error}.`, 'unavailable');
    }
    const up = path.dirname(current);
    if (up === current) return full;
    rest.unshift(path.basename(current));
    current = up;
  }
}
const physicalFolded = (file, code) => foldName(physical(file, code));
const physicallyWithin = (parent, child, code) => relWithin(physicalFolded(parent, code), physicalFolded(child, code));
// Every string comparison stays; a refusal also holds when the paths relate physically, and an acceptance needs both.
const withinEither = (parent, child, code) => within(parent, child) || physicallyWithin(parent, child, code);
const withinBoth = (parent, child, code) => within(parent, child) && physicallyWithin(parent, child, code);
const sameEither = (a, b, code) => folded(a) === folded(b) || physicalFolded(a, code) === physicalFolded(b, code);
const sameBoth = (a, b, code) => folded(a) === folded(b) && physicalFolded(a, code) === physicalFolded(b, code);
const overlaps = (a, b, code) => withinEither(a, b, code) || withinEither(b, a, code);
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const uniquePaths = (values, label, code) => {
  if (new Set(values.map(folded)).size !== values.length) stop(code, `${label}: duplicate/case-colliding paths.`);
};

const skillRoot = fileURLToPath(new URL('../', import.meta.url));
const limits = { envelope: 262144, file: 4194304 };

function absoluteForm(value) {
  return typeof value === 'string' && path.isAbsolute(value) && !value.includes('\0') && !value.split(/[\\/]/).some(part => part === '.' || part === '..');
}
function absolute(value, label, code) {
  if (!absoluteForm(value)) stop(code, `${label}: expected absolute path without traversal aliases.`);
  const file = path.resolve(value);
  let current = path.parse(file).root;
  for (const part of file.slice(current.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    if (fs.lstatSync(current, { throwIfNoEntry: false })?.isSymbolicLink()) stop(code, `${label}: linked path ${current}.`);
  }
  return file;
}
function relative(value, code) {
  if (typeof value !== 'string' || !value || /[<>:"\\|?*\x00-\x1f]/.test(value) || value.startsWith('/')
    || value.split('/').some(part => !part || part === '.' || part === '..' || /[. ]$/.test(part) || /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part))) stop(code, `Invalid contained relative path: ${String(value).slice(0, 200)}.`);
  return value;
}
function bytesAt(value, cap, label, code, overCode = code) {
  const file = absolute(value, label, code);
  const stat = fs.statSync(file, { throwIfNoEntry: false });
  if (!stat?.isFile()) stop(code, `${label}: missing ordinary file ${file}.`, 'unavailable');
  if (stat.size > cap) stop(overCode, `${label}: byte budget exceeded.`, 'unavailable');
  const fd = fs.openSync(file, 'r');
  try {
    const buffer = Buffer.alloc(Math.min(cap, stat.size) + 1);
    let offset = 0;
    while (offset < buffer.length) {
      const read = fs.readSync(fd, buffer, offset, buffer.length - offset, null);
      if (!read) break;
      offset += read;
    }
    if (offset > cap || offset !== stat.size) stop('STALE_INPUT', `${label}: file changed length during bounded read.`, 'unavailable');
    return buffer.subarray(0, offset);
  } finally { fs.closeSync(fd); }
}
const decode = bytes => new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
function parseJson(bytes, label, code) {
  try { return JSON.parse(decode(bytes)); }
  catch (error) { return stop(code, `${label}: invalid UTF-8/JSON: ${error.message}`); }
}

// Every input is remembered at its first read; the final recheck proves none moved while the checks ran.
const watched = [];
const rechecks = [];
function watch(value, cap, label, code, overCode = code) {
  const bytes = bytesAt(value, cap, label, code, overCode);
  watched.push({ value, cap, label, code, overCode, bytes });
  return bytes;
}
function pinned(pin, cap, label, code) {
  if (typeof pin.bytes === 'number' && pin.bytes > cap) stop('LIMIT', `${label}: pin byte budget exceeded.`, 'unavailable');
  const bytes = watch(pin.path, cap, label, code, 'LIMIT');
  if (pin.bytes !== bytes.length || pin.sha256 !== hash(bytes)) stop(code, `${label}: hash/length pin mismatch ${pin.path}.`);
  return bytes;
}
function recheck() {
  for (const item of watched) {
    let again;
    try { again = bytesAt(item.value, item.cap, item.label, item.code, item.overCode); }
    catch { stop('STALE_INPUT', `${item.label}: changed or vanished during the check.`, 'unavailable'); }
    if (!again.equals(item.bytes)) stop('STALE_INPUT', `${item.label}: changed during the check.`, 'unavailable');
  }
  for (const check of rechecks) check();
}

const schemaVocabulary = new Set(['$schema', 'title', 'description', 'type', 'const', 'enum', 'properties', 'required', 'additionalProperties', 'items', 'minItems', 'maxItems', 'minLength', 'maxLength', 'pattern', 'minimum', 'maximum']);
function auditSchema(schema) {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) fail('Required executable schema must be an object.');
  for (const key of Object.keys(schema)) if (!schemaVocabulary.has(key)) fail(`Unsupported schema keyword ${key}.`);
  for (const child of Object.values(schema.properties ?? {})) auditSchema(child);
  if (schema.items) auditSchema(schema.items);
}
function validate(value, schema, label) {
  const bad = (message, status = 'failed') => { const err = new SchemaError(label, `${label}: ${message}`); err.status = status; throw err; };
  if ('const' in schema && !same(value, schema.const)) bad(`expected constant ${JSON.stringify(schema.const)}.`);
  if (schema.enum && !schema.enum.some(item => same(item, value))) bad('unsupported value.');
  const type = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value === 'number' && Number.isInteger(value) ? 'integer' : typeof value;
  if (schema.type && ![].concat(schema.type).includes(type)) bad(`expected ${schema.type}.`);
  if (typeof value === 'number' && (!Number.isFinite(value) || value < (schema.minimum ?? -Infinity) || value > (schema.maximum ?? Infinity))) bad('numeric bound exceeded.');
  if (typeof value === 'string' && (value.length < (schema.minLength ?? 0) || value.length > (schema.maxLength ?? Infinity)
    || (schema.pattern && !new RegExp(schema.pattern).test(value)))) bad('invalid/bounded string.');
  if (Array.isArray(value)) {
    if (value.length < (schema.minItems ?? 0) || value.length > (schema.maxItems ?? Infinity)) bad('array bound exceeded.');
    value.forEach((item, index) => validate(item, schema.items, `${label}[${index}]`));
  } else if (value !== null && typeof value === 'object') {
    for (const key of schema.required ?? []) if (!Object.hasOwn(value, key)) bad(`missing ${key}.`);
    for (const [key, child] of Object.entries(value)) {
      if (!Object.hasOwn(schema.properties ?? {}, key)) bad(`unknown property ${key}.`);
      validate(child, schema.properties[key], `${label}.${key}`);
    }
  }
}
function loadSchema(name, code) {
  const schema = parseJson(watch(path.join(skillRoot, `assets/${name}.schema.json`), limits.envelope, `${name} schema`, code), `${name} schema`, code);
  try { auditSchema(schema); } catch (error) { stop(code, error.message); }
  return schema;
}
function conform(value, schema, label, codeFor) {
  try { validate(value, schema, label); }
  catch (error) { if (error instanceof SchemaError) stop(codeFor(error.at), error.message, error.status ?? 'failed'); throw error; }
}
const pinOut = ({ path: file, bytes, sha256 }) => ({ path: file, bytes, sha256 });

function parseLock(bytes, label) {
  const lock = parseJson(bytes, label, 'JOB_INVALID');
  if (!isObject(lock) || !isObject(lock.files)) stop('JOB_INVALID', `${label}: missing files object.`);
  const map = new Map();
  for (const [rel, entry] of Object.entries(lock.files)) {
    relative(rel, 'JOB_INVALID');
    if (!isObject(entry) || typeof entry.sha256 !== 'string' || !/^sha256:[0-9a-f]{64}$/.test(entry.sha256)) {
      stop('JOB_INVALID', `${label}: invalid sha256 for ${rel}.`);
    }
    // A key that folds onto an earlier one would silently overwrite it where names are case-insensitive.
    if (map.has(foldName(rel))) stop('JOB_INVALID', `${label}: case-colliding lock key ${rel}.`);
    map.set(foldName(rel), { rel, sha256: entry.sha256.slice(7) });
  }
  return map;
}

function targetFlavour(checkout) {
  if (typeof checkout !== 'string') return null;
  if (/^[A-Za-z]:[\\/]/.test(checkout) || checkout.startsWith('\\\\')) {
    return { name: 'win32', path: path.win32, split: /[\\/]/, ignoreCase: true };
  }
  if (checkout.startsWith('/') && !checkout.startsWith('//')) {
    return { name: 'posix', path: path.posix, split: '/', ignoreCase: process.platform === 'win32' };
  }
  return null;
}
function targetAbsoluteForm(flavour, value) {
  return typeof value === 'string' && flavour.path.isAbsolute(value) && !value.includes('\0')
    && !value.split(flavour.split).some(part => part === '.' || part === '..');
}
function foldTarget(flavour, file) {
  const resolved = flavour.path.resolve(file);
  return flavour.ignoreCase ? resolved.toLowerCase() : resolved;
}

function parseTarget(bytes, label) {
  const target = parseJson(bytes, label, 'TARGET_INVALID');
  if (!isObject(target) || typeof target.id !== 'string' || target.id.length < 1 || target.id.length > 128) {
    stop('TARGET_INVALID', `${label}: invalid target id.`);
  }
  const { artifact, inputs } = target;
  if (!isObject(artifact)
    || typeof artifact.type !== 'string' || artifact.type.length < 1 || artifact.type.length > 128
    || typeof artifact.definition !== 'string' || artifact.definition.length < 1 || artifact.definition.length > 128
    || !Array.isArray(artifact.paths) || artifact.paths.length > 1000
    || artifact.paths.some(p => typeof p !== 'string' || p.length < 1 || p.length > 8192)) {
    stop('TARGET_INVALID', `${label}: invalid artifact descriptor.`);
  }
  const flavour = targetFlavour(target.source?.checkout);
  if (!flavour || !targetAbsoluteForm(flavour, target.source.checkout)) stop('TARGET_INVALID', `${label}: invalid target source.checkout.`);
  if (!Array.isArray(inputs)) stop('TARGET_INVALID', `${label}: inputs must be an array.`);
  if (inputs.length === 0) stop('TARGET_INVALID', `${label}: inputs must be non-empty.`);
  if (inputs.length > 1000) stop('LIMIT', `${label}: target inputs array bound exceeded.`, 'unavailable');
  const seen = new Set();
  for (const item of inputs) {
    // Only the path's form is checked: target inputs are never read, so their locations are not walked.
    if (!isObject(item) || typeof item.kind !== 'string' || item.kind.length < 1 || item.kind.length > 128
      || typeof item.path !== 'string' || !targetAbsoluteForm(flavour, item.path)
      || typeof item.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(item.sha256)) {
      stop('TARGET_INVALID', `${label}: invalid target input entry.`);
    }
    const key = foldTarget(flavour, item.path);
    if (seen.has(key)) stop('TARGET_INVALID', `${label} inputs: duplicate/case-colliding paths.`);
    seen.add(key);
  }
  return target;
}

function computePlan(job, targets) {
  const staleChangedPaths = new Set();
  // A target recorded in another checkout joins by library-relative path, never by absolute path:
  // an input pins a changed or held source only inside that target's own library.
  const jobLibrary = path.join(job.source.checkout, 'host-library', job.host);
  const libraryRel = (library, file) => path.relative(library, path.resolve(file)).split(path.sep).join('/');
  const changedEntries = job.changedInputs.map(changed => {
    const relExact = libraryRel(jobLibrary, changed.path);
    return { changed, relExact, relLower: relExact.toLowerCase(), foldedPath: folded(changed.path) };
  });
  const heldEntries = job.heldSources.map(held => {
    const relExact = libraryRel(jobLibrary, held.path);
    return { held, relExact, relLower: relExact.toLowerCase() };
  });
  const artifacts = job.targets.map((targetPin, index) => {
    const target = targets[index];
    const flavour = targetFlavour(target.source.checkout);
    const mod = flavour.path;
    const targetLibrary = mod.join(target.source.checkout, 'host-library', job.host);
    const libBase = foldTarget(flavour, targetLibrary);
    const byRel = new Map();
    for (const inp of target.inputs) {
      const rel = mod.relative(libBase, foldTarget(flavour, inp.path));
      const inside = rel === '' || (rel !== '..' && !rel.startsWith(`..${mod.sep}`) && !mod.isAbsolute(rel));
      if (!inside) continue;
      const key = rel.split(mod.sep).join('/');
      if (byRel.has(key)) stop('TARGET_INVALID', `Target ${targetPin.path} inputs: duplicate/case-colliding paths.`);
      byRel.set(key, inp);
    }
    const changedPins = [];
    for (const { changed, relExact, relLower, foldedPath } of changedEntries) {
      const match = byRel.get(flavour.ignoreCase ? relLower : relExact);
      if (match && (changed.newSha256 === null || match.sha256 !== changed.newSha256)) {
        staleChangedPaths.add(foldedPath);
        changedPins.push({
          kind: match.kind,
          path: changed.path,
          pinnedSha256: match.sha256,
          oldSha256: changed.oldSha256,
          newSha256: changed.newSha256,
          pinnedAtPrevious: match.sha256 === changed.oldSha256,
        });
      }
    }
    const heldPins = [];
    for (const { held, relExact, relLower } of heldEntries) {
      const match = byRel.get(flavour.ignoreCase ? relLower : relExact);
      if (match) heldPins.push({ path: held.path, pinnedSha256: match.sha256 });
    }
    return {
      job: { path: targetPin.path, sha256: targetPin.sha256 },
      jobId: target.id,
      artifact: { type: target.artifact.type, definition: target.artifact.definition, paths: target.artifact.paths },
      affected: changedPins.length > 0,
      changedPins,
      heldPins,
    };
  });
  const unpinnedChanges = job.changedInputs
    .filter(changed => !staleChangedPaths.has(folded(changed.path)))
    .map(changed => changed.path);
  const heldSources = job.heldSources.map(held => ({
    path: held.path,
    lockedSha256: held.lockedSha256,
    candidateSha256: held.candidateSha256,
    disposition: 'not advanced, no action',
  }));
  return { artifacts, unpinnedChanges, heldSources };
}

function checkJob(jobArg) {
  phase = 'preflight';
  const jobFile = absolute(jobArg, 'Job', 'JOB_INVALID');
  const jobBytes = watch(jobFile, limits.envelope, 'Job', 'JOB_INVALID');
  const job = parseJson(jobBytes, 'Job', 'JOB_INVALID');
  conform(job, loadSchema('sync-job', 'JOB_INVALID'), 'job', () => 'JOB_INVALID');

  const workspace = absolute(job.roots.workspace, 'Workspace root', 'ROOT_CONFLICT');
  const evidence = absolute(job.roots.evidence, 'Evidence root', 'ROOT_CONFLICT');
  const checkout = absolute(job.source.checkout, 'Source checkout', 'ROOT_CONFLICT');

  // Every path compared here passed the link refusal of absolute() above, on the path as given.
  if (!sameBoth(path.dirname(jobFile), evidence, 'JOB_INVALID')) stop('JOB_INVALID', 'Job must sit directly in roots.evidence.');
  if (!withinBoth(workspace, evidence, 'ROOT_CONFLICT') || overlaps(evidence, checkout, 'ROOT_CONFLICT')) stop('ROOT_CONFLICT', 'Evidence root must be inside workspace and disjoint from checkout.');
  if (!fs.statSync(checkout, { throwIfNoEntry: false })?.isDirectory()) stop('ROOT_CONFLICT', 'Source checkout: required directory unavailable.', 'unavailable');

  const hostLib = path.join(checkout, 'host-library', job.host);
  const expectedLock = path.join(hostLib, 'library.lock.json');
  const lockPath = absolute(job.library.lock.path, 'Library lock', 'JOB_INVALID');
  const prevLockPath = absolute(job.library.previousLock.path, 'Previous library lock', 'JOB_INVALID');
  if (!sameBoth(lockPath, expectedLock, 'JOB_INVALID')) stop('JOB_INVALID', 'library.lock.path must be <checkout>/host-library/<host>/library.lock.json.');
  if (!withinBoth(evidence, prevLockPath, 'JOB_INVALID') || sameEither(prevLockPath, jobFile, 'JOB_INVALID')) stop('JOB_INVALID', 'library.previousLock.path must be a file inside roots.evidence.');

  for (const item of job.changedInputs) {
    const file = absolute(item.path, 'Changed input', 'JOB_INVALID');
    if (!withinBoth(hostLib, file, 'JOB_INVALID') || sameEither(file, hostLib, 'JOB_INVALID')) stop('JOB_INVALID', `Changed input outside host library: ${item.path}.`);
    if (item.oldSha256 === null && item.newSha256 === null) stop('JOB_INVALID', `Changed input has both hashes null: ${item.path}.`);
    if (item.oldSha256 === item.newSha256) stop('JOB_INVALID', `Changed input has identical old and new hashes: ${item.path}.`);
  }
  uniquePaths(job.changedInputs.map(item => item.path), 'Changed inputs', 'JOB_INVALID');

  for (const item of job.heldSources) {
    const file = absolute(item.path, 'Held source', 'JOB_INVALID');
    if (!withinBoth(hostLib, file, 'JOB_INVALID') || sameEither(file, hostLib, 'JOB_INVALID')) stop('JOB_INVALID', `Held source outside host library: ${item.path}.`);
  }
  uniquePaths(job.heldSources.map(item => item.path), 'Held sources', 'JOB_INVALID');

  for (const item of job.targets) absolute(item.path, 'Target', 'JOB_INVALID');
  uniquePaths(job.targets.map(item => item.path), 'Targets', 'JOB_INVALID');

  // Checkout HEAD check.
  const identity = spawnSync('git', ['-C', checkout, 'rev-parse', '--verify', 'HEAD'], {
    encoding: 'utf8', windowsHide: true, timeout: 10000, maxBuffer: 65536,
  });
  if (identity.status !== 0 || identity.stdout.trim() !== job.source.head) stop('CHECKOUT_HEAD', 'Selected checkout HEAD changed or unavailable.');

  // Pins: library.lock, library.previousLock, and every target.
  const lockBytes = pinned(job.library.lock, limits.file, 'Library lock', 'PIN_MISMATCH');
  const prevLockBytes = pinned(job.library.previousLock, limits.file, 'Previous library lock', 'PIN_MISMATCH');
  const targetBytesList = job.targets.map((pin, idx) => pinned(pin, limits.file, `Target ${idx}`, 'PIN_MISMATCH'));

  const currentLock = parseLock(lockBytes, 'Library lock');
  const previousLock = parseLock(prevLockBytes, 'Previous library lock');

  // A held path may never appear in changedInputs, whatever the locks say about it; this test runs before the lock-delta check.
  const changedFolded = new Set(job.changedInputs.map(item => folded(item.path)));
  // Physically too: a held file named in another spelling (a short name, another case on an ignoring volume) is still the held file.
  for (const hold of job.heldSources) {
    if (changedFolded.has(folded(hold.path))
      || job.changedInputs.some(item => physicalFolded(item.path, 'HOLD_VIOLATION') === physicalFolded(hold.path, 'HOLD_VIOLATION'))) stop('HOLD_VIOLATION', `Hold violation for ${hold.path}.`);
  }

  // Lock delta check.
  const relOf = file => path.relative(hostLib, path.resolve(file)).split(path.sep).join('/');
  const allLockKeys = new Set([...currentLock.keys(), ...previousLock.keys()]);
  const heldRelKeys = new Set(job.heldSources.map(item => foldName(relOf(item.path))));
  const expectedDiffs = new Map();
  for (const key of allLockKeys) {
    const oldVal = previousLock.get(key)?.sha256 ?? null;
    const newVal = currentLock.get(key)?.sha256 ?? null;
    if (oldVal !== newVal) {
      if (heldRelKeys.has(key)) stop('HOLD_VIOLATION', `Held source advanced between locks: ${key}.`);
      expectedDiffs.set(key, { oldSha256: oldVal, newSha256: newVal });
    }
  }

  const seenLockDiffs = new Set();
  for (const item of job.changedInputs) {
    const relKey = foldName(relOf(item.path));
    if (allLockKeys.has(relKey)) {
      const diff = expectedDiffs.get(relKey);
      if (!diff || diff.oldSha256 !== item.oldSha256 || diff.newSha256 !== item.newSha256) {
        stop('LOCK_DELTA_MISMATCH', `Lock-tracked changed input disagrees with lock delta: ${item.path}.`);
      }
      seenLockDiffs.add(relKey);
    }
  }
  if (seenLockDiffs.size !== expectedDiffs.size) {
    stop('LOCK_DELTA_MISMATCH', 'Lock difference missing from changedInputs.');
  }

  for (const item of job.changedInputs) {
    const file = path.resolve(item.path);
    if (item.newSha256 !== null) {
      const bytes = watch(file, limits.file, `Changed input ${item.path}`, 'PIN_MISMATCH', 'LIMIT');
      if (hash(bytes) !== item.newSha256) stop('PIN_MISMATCH', `Changed input disk hash mismatch: ${item.path}.`);
    } else {
      if (fs.lstatSync(file, { throwIfNoEntry: false })) stop('PIN_MISMATCH', `Removed changed input still exists on disk: ${item.path}.`);
      rechecks.push(() => {
        if (fs.lstatSync(file, { throwIfNoEntry: false })) stop('STALE_INPUT', `Removed input appeared during the check: ${item.path}.`, 'unavailable');
      });
    }
  }

  // Holds check.
  for (const hold of job.heldSources) {
    const relKey = foldName(relOf(hold.path));
    const curVal = currentLock.get(relKey)?.sha256 ?? null;
    const prevVal = previousLock.get(relKey)?.sha256 ?? null;
    if (curVal !== hold.lockedSha256 || prevVal !== curVal || hold.candidateSha256 === hold.lockedSha256) {
      stop('HOLD_VIOLATION', `Hold violation for ${hold.path}.`);
    }
    if (hold.lockedSha256 !== null) {
      const bytes = watch(hold.path, limits.file, `Held source ${hold.path}`, 'HOLD_VIOLATION', 'LIMIT');
      if (hash(bytes) !== hold.lockedSha256) stop('HOLD_VIOLATION', `Held source on-disk hash mismatch: ${hold.path}.`);
    }
  }

  // Targets check.
  const targets = targetBytesList.map((bytes, idx) => parseTarget(bytes, `Target ${job.targets[idx].path}`));
  const computed = computePlan(job, targets);
  const jobDigest = hash(canonical(job));

  return {
    job,
    jobFile,
    evidence,
    jobPin: pinOut({ path: jobFile, bytes: jobBytes.length, sha256: hash(jobBytes) }),
    jobDigest,
    computed,
    counts: {
      targets: job.targets.length,
      affected: computed.artifacts.filter(a => a.affected).length,
      changedInputs: job.changedInputs.length,
      unpinnedChanges: computed.unpinnedChanges.length,
      heldSources: job.heldSources.length,
    },
  };
}

function checkPlan(ctx, resultArg) {
  phase = 'postflight';
  const { job, jobFile, evidence, jobDigest, computed } = ctx;
  const resultFile = absolute(resultArg, 'Result', 'RESULT_INVALID');
  if (!sameBoth(path.dirname(resultFile), evidence, 'RESULT_INVALID') || sameEither(resultFile, jobFile, 'RESULT_INVALID')) {
    stop('RESULT_INVALID', 'Plan must sit directly in roots.evidence and not be the job file.');
  }
  const planBytes = watch(resultFile, limits.envelope, 'Plan', 'RESULT_INVALID');
  const plan = parseJson(planBytes, 'Plan', 'RESULT_INVALID');
  conform(plan, loadSchema('sync-plan', 'RESULT_INVALID'), 'plan', () => 'RESULT_INVALID');

  if (plan.jobId !== job.id || plan.host !== job.host || plan.jobDigest !== jobDigest) {
    stop('DIGEST_MISMATCH', 'Plan jobId, host or jobDigest differs from the job.');
  }

  const heldFolded = new Set(job.heldSources.map(item => folded(item.path)));
  for (const artifact of plan.artifacts) {
    for (const pin of artifact.changedPins) {
      if (heldFolded.has(folded(pin.path))) stop('HOLD_VIOLATION', `Held source path appears in changedPins: ${pin.path}.`);
    }
  }
  if (!same(plan.heldSources, computed.heldSources)) {
    stop('HOLD_VIOLATION', 'Plan heldSources differ from the job held sources.');
  }

  const strippedArtifacts = plan.artifacts.map(({ reason: _reason, ...rest }) => rest);
  if (!same(strippedArtifacts, computed.artifacts) || !same(plan.unpinnedChanges, computed.unpinnedChanges)) {
    stop('AFFECTED_MISMATCH', 'Plan artifacts or unpinnedChanges differ from the computed plan.');
  }

  return { result: pinOut({ path: resultFile, bytes: planBytes.length, sha256: hash(planBytes) }) };
}

try {
  const argv = process.argv.slice(2);
  for (const flag of ['job', 'result', 'help']) {
    if (argv.filter(arg => arg === `--${flag}` || arg.startsWith(`--${flag}=`)).length > 1) stop('USAGE', `Duplicate --${flag} selector.`);
  }
  let parsed;
  try { parsed = parseArgs({ args: argv, options: { job: { type: 'string' }, result: { type: 'string' }, help: { type: 'boolean' } }, strict: true, allowPositionals: true }); }
  catch (error) { stop('USAGE', error.message); }
  const { values, positionals } = parsed;
  if (values.help && !values.job && !values.result && !positionals.length) {
    process.stdout.write('check-sync --job <absolute-sync-job.json> [--result <absolute-sync-plan.json>]\nChecks host-update sync job and adaptation plan records; executes no plans or targets.\n');
  } else {
    if (!values.job || values.help || positionals.length) stop('USAGE', 'A supported absolute --job sync record is required (--result is optional; --help stands alone).');
    for (const [name, value] of [['--job', values.job], ['--result', values.result]]) {
      if (value !== undefined && !absoluteForm(value)) stop('USAGE', `${name}: expected an absolute path without traversal aliases.`);
    }
    const ctx = checkJob(path.resolve(values.job));
    const post = values.result ? checkPlan(ctx, path.resolve(values.result)) : {};
    recheck();
    process.stdout.write(JSON.stringify({
      version: 1, kind: 'deterministic', phase: values.result ? 'postflight' : 'preflight', recordValid: true,
      job: ctx.jobPin, jobId: ctx.job.id, host: ctx.job.host, jobDigest: ctx.jobDigest, counts: ctx.counts, ...post,
      claimsNotAccepted: ['targets-complete', 'untracked-old-hash', 'held-candidate', 'reason'],
      proposalOnly: true, implemented: false, heldSourcesAdvanced: false, quality: 'pending', executionProof: 'unverified', live: 'unverified',
    }) + '\n');
  }
} catch (error) {
  const known = error instanceof Stop;
  const code = known ? error.code : phase === 'postflight' ? 'RESULT_INVALID' : phase === 'usage' ? 'USAGE' : 'JOB_INVALID';
  process.stderr.write(JSON.stringify({
    version: 1, kind: 'deterministic', status: known ? error.status : 'unavailable', phase: code === 'USAGE' ? 'usage' : phase, code,
    reason: error instanceof Error ? error.message : String(error), path: known ? error.file : null,
    proposalOnly: true, implemented: false, quality: 'pending', executionProof: 'unverified', live: 'unverified',
  }) + '\n');
  process.exitCode = 1;
}
