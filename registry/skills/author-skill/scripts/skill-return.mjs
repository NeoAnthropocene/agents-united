import { parseArgs } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

// Writes the return record of one Skill task after the fork has run draft.mjs once and saved its job, stdout, stderr and exit code.
// It reads the task, the saved helper files and the draft folder, writes exactly one file (<roots.producer>/skill-return.json) with
// JSON.stringify (so it is valid JSON by construction, Windows backslashes included), never writes inside the draft, executes nothing and
// contacts nothing. The fork supplies only what only it knows: the saved helper files and exit code (or that the helper never ran), an
// optional report file and optional notes. Everything else is computed. Nothing is marked as run or passed unless the fork handed it over;
// the caller's checker (check-skill-return.mjs) stays the authority and still checks every byte.
// The root, name and decoding rules below repeat the coordinator checker's on purpose: one Skill does not import another Skill's script.
const fail = message => { throw new Error(message); };
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
// The task digest rule of the coordinator's checker: SHA-256 of the canonical JSON (keys sorted at every level, no whitespace).
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
// Case folding is sound only where the filesystem ignores case; on every other platform names are compared exactly.
// The physical spelling of a path: the deepest existing ancestor is resolved by the platform (a short name, a junction, another case on an
// ignoring volume all become the one real name) and the not-yet-existing rest is appended. Every comparison of roots and files uses it.
// Only "does not exist" (ENOENT) and "a parent is not a folder" (ENOTDIR) walk up to the parent; any other error (EACCES, EPERM, ...) is
// refused with the path and the code, so the alias check never silently falls back to comparing strings.
function physical(file) {
  const full = path.resolve(file);
  const rest = [];
  for (let current = full; ;) {
    try { return path.join(fs.realpathSync.native(current), ...rest); } catch (error) {
      if (error?.code !== 'ENOENT' && error?.code !== 'ENOTDIR') fail(`Cannot resolve the physical path of ${current}: ${error?.code ?? error}.`);
    }
    const up = path.dirname(current);
    if (up === current) return full;
    rest.unshift(path.basename(current));
    current = up;
  }
}
// Case folding is sound only where the filesystem ignores case; on every other platform names are compared exactly.
const foldName = name => (process.platform === 'win32' ? name.toLowerCase() : name);
const folded = file => foldName(physical(file));
const withinBy = (norm, parent, child) => {
  const rel = path.relative(norm(parent), norm(child));
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel));
};
const within = (parent, child) => withinBy(folded, parent, child);
// The checker's own rule for "under the producer root" compares the spelling recorded in the return as a string.
const lexicalWithin = (parent, child) => withinBy(file => foldName(path.resolve(file)), parent, child);
const overlaps = (a, b) => within(a, b) || within(b, a);
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const byPath = (a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
const HOST_DIRS = ['.agents', '.claude', '.cline', '.cursor', '.codex', '.opencode', '.gemini'];
const NOTES_NAME = 'skill-notes.json';
const RETURN_NAME = 'skill-return.json';
const TASK_NAME = 'skill-task.json';
const ENVELOPE = 262144;
const HELPER_JOB = 4194304;
const HELPER_STDERR = 65536;
const REPORT = 262144;
const CHECK_RAW = 524288;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SHA = /^[0-9a-f]{64}$/;
const NOTES_KEYS = ['openItems', 'unverified', 'claimedChecks', 'externalActions'];
// Opens never follow a final link where the platform offers the flag (win32 has none; links are refused by lstat before the open).
const NOFOLLOW = fs.constants.O_NOFOLLOW ?? 0;

function absolute(value, label) {
  if (typeof value !== 'string' || !path.isAbsolute(value) || value.includes('\0') || value.split(/[\\/]/).some(part => part === '.' || part === '..')) {
    fail(`${label}: expected an absolute path without traversal aliases.`);
  }
  const file = path.resolve(value);
  let current = path.parse(file).root;
  for (const part of file.slice(current.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    if (fs.lstatSync(current, { throwIfNoEntry: false })?.isSymbolicLink()) fail(`${label}: linked path ${current}.`);
  }
  return file;
}
/** The checker's contained relative path rule for a draft entry name. */
function safeName(value) {
  if (!value || /[<>:"\\|?*\x00-\x1f]/.test(value) || value.startsWith('/')
    || value.split('/').some(part => !part || part === '.' || part === '..' || /[. ]$/.test(part) || /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part))) {
    fail(`Invalid draft entry name: ${String(value).slice(0, 200)}.`);
  }
  return value;
}
/** Reads at most `cap` bytes of one ordinary, unlinked file; a larger file is refused while reading, never read whole. */
function readBounded(file, cap, label) {
  const stat = fs.lstatSync(file, { throwIfNoEntry: false });
  if (!stat?.isFile()) fail(`${label}: missing ordinary file ${file}.`);
  if (stat.size > cap) fail(`${label}: over the byte budget.`);
  const fd = fs.openSync(file, fs.constants.O_RDONLY | NOFOLLOW);
  try {
    if (!fs.fstatSync(fd).isFile()) fail(`${label}: not an ordinary file.`);
    const buffer = Buffer.alloc(cap + 1);
    let offset = 0;
    while (offset < buffer.length) {
      const read = fs.readSync(fd, buffer, offset, buffer.length - offset, null);
      if (!read) break;
      offset += read;
    }
    if (offset > cap) fail(`${label}: over the byte budget.`);
    return buffer.subarray(0, offset);
  } finally { fs.closeSync(fd); }
}
// The checker's decoding: strict UTF-8 that keeps a byte-order mark, so JSON with a BOM is refused by both scripts.
const decode = (bytes, label) => {
  try { return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes); }
  catch { return fail(`${label}: not UTF-8 text.`); }
};
function readJson(file, label) {
  const text = decode(readBounded(file, ENVELOPE, label), label);
  try { return JSON.parse(text); } catch (error) { return fail(`${label}: invalid JSON: ${error.message}`); }
}
const integer = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
const textOk = (value, max = 8192) => typeof value === 'string' && value.length >= 1 && value.length <= max;
const exactKeys = (value, keys) => isObject(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const pinOk = (value, maxBytes) => exactKeys(value, ['path', 'bytes', 'sha256']) && textOk(value.path) && integer(value.bytes, 0, maxBytes) && typeof value.sha256 === 'string' && SHA.test(value.sha256);

/**
 * The task fields the helper reads, checked against skill-task.schema.json's constraints for them: version, kind, id, operation,
 * roles, roots (draft, producer, evidence, managed, protected), source (checkout, registry), baseline (path, bytes, sha256), the allowed
 * paths of the draft job template and the candidate budget.
 */
function checkTask(task) {
  if (!isObject(task) || task.version !== 1 || task.kind !== 'skill-task') fail('The task is not a version 1 skill-task record.');
  if (typeof task.id !== 'string' || task.id.length > 80 || !SLUG.test(task.id)) fail('The task id is not a kebab-case identifier of at most 80 characters.');
  if (!['create', 'repair'].includes(task.operation)) fail('The task operation must be create or repair.');
  const { roots, source, budget } = task;
  if (!isObject(roots) || ![roots.draft, roots.producer, roots.evidence].every(value => textOk(value))
    || ![roots.managed, roots.protected].every(list => Array.isArray(list) && list.length <= 32 && list.every(value => textOk(value)))) {
    fail('The task roots need draft, producer, evidence, managed and protected.');
  }
  if (!isObject(source) || !textOk(source.checkout) || !textOk(source.registry)) fail('The task source needs checkout and registry.');
  if (!Array.isArray(task.baseline) || task.baseline.length > 32
    || !task.baseline.every(item => isObject(item) && textOk(item.path, 512) && integer(item.bytes, 0, 262144) && typeof item.sha256 === 'string' && SHA.test(item.sha256))) {
    fail('The task baseline must be a list of { path, bytes, sha256, ... } entries.');
  }
  if (!Array.isArray(task.roles) || task.roles.length > 32 || !task.roles.every(item => isObject(item) && textOk(item.path, 512) && textOk(item.role, 64))) {
    fail('The task roles must be a list of { path, role } entries.');
  }
  if (!isObject(task.draftJobTemplate) || !Array.isArray(task.draftJobTemplate.allowedPaths) || !task.draftJobTemplate.allowedPaths.every(item => textOk(item, 512))) {
    fail('The task draftJobTemplate needs allowedPaths.');
  }
  if (!isObject(budget)) fail('The task lacks its budget.');
  for (const [key, min, max] of [['maxCandidateFiles', 1, 32], ['maxCandidateFileBytes', 1, 262144], ['maxCandidateBytes', 1, 1048576], ['maxHelperStdoutBytes', 1, 4194304]]) {
    if (!integer(budget[key], min, max)) fail(`The task budget ${key} is missing or out of range.`);
  }
}

/** The checker's root rules: absolute and link-free, no managed Host folder, disjoint from each other and from every input root. */
function checkRoots(task, jobFile) {
  const { roots, source } = task;
  const draft = absolute(roots.draft, 'Draft root');
  const producer = absolute(roots.producer, 'Producer root');
  const evidence = absolute(roots.evidence, 'Evidence root');
  if (folded(jobFile) !== folded(path.join(evidence, TASK_NAME))) fail(`The task must be the ${TASK_NAME} in the evidence root it names.`);
  const checkout = absolute(source.checkout, 'Source checkout');
  const registry = absolute(source.registry, 'Source registry');
  const managed = roots.managed.map(root => absolute(root, 'Managed root'));
  const protectedRoots = roots.protected.map(root => absolute(root, 'Protected root'));
  for (const [name, dir] of [['Source checkout', checkout], ['Source registry', registry]]) {
    if (!fs.statSync(dir, { throwIfNoEntry: false })?.isDirectory()) fail(`${name}: required directory unavailable.`);
  }
  const outputs = [['draft', draft], ['producer', producer], ['evidence', evidence]];
  for (const [name, root] of outputs) {
    if ([root, physical(root)].some(spelling => spelling.split(path.sep).some(part => HOST_DIRS.includes(part.toLowerCase())))) fail(`The ${name} root is a managed Host path.`);
  }
  outputs.forEach(([name, root], index) => {
    for (const [other, otherRoot] of outputs.slice(index + 1)) if (overlaps(root, otherRoot)) fail(`The ${name} and ${other} roots overlap.`);
    for (const input of [checkout, registry, ...managed, ...protectedRoots]) if (overlaps(root, input)) fail(`The ${name} root overlaps a source, managed or protected root.`);
  });
  if (!fs.statSync(producer, { throwIfNoEntry: false })?.isDirectory()) fail('The producer root does not exist as a folder.');
  return { draft, producer };
}

/** The draft folder within the task budget; links, unsafe names and files that are not UTF-8 text are refused, never followed; an absent folder is an empty inventory. */
function inventory(draft, budget) {
  const stat = fs.lstatSync(draft, { throwIfNoEntry: false });
  if (!stat) return { items: [], files: new Map() };
  if (!stat.isDirectory()) fail('The draft root is not a folder.');
  const items = [];
  const files = new Map();
  const names = [];
  let total = 0, directories = 0;
  const walk = (directory, prefix) => {
    if (++directories > 128) fail('The draft folder is over the directory budget.');
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const rel = safeName(`${prefix}${entry.name}`), file = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) fail(`The draft folder holds a link: ${rel}.`);
      if (entry.isDirectory()) { walk(file, `${rel}/`); continue; }
      if (!entry.isFile()) fail(`The draft folder holds an unsupported entry: ${rel}.`);
      names.push(rel);
      if (items.length >= budget.maxCandidateFiles) fail('The draft folder is over the candidate file budget.');
      const bytes = readBounded(file, budget.maxCandidateFileBytes, `Draft file ${rel} (task budget)`);
      decode(bytes, `Draft file ${rel}`);
      if ((total += bytes.length) > budget.maxCandidateBytes) fail('The draft folder is over the candidate byte budget.');
      items.push({ path: rel, bytes: bytes.length, sha256: hash(bytes) });
      files.set(rel, bytes);
    }
  };
  walk(draft, '');
  // Two file paths that differ only in case are refused on every platform; the checker compares complete file paths, never directory names.
  if (new Set(names.map(name => name.toLowerCase())).size !== names.length) fail('Two draft file paths differ only in case.');
  return { items: items.sort(byPath), files };
}

const sameInventory = (items, baseline) => items.length === baseline.length
  && [...baseline].sort(byPath).every((item, index) => item.path === items[index].path && item.bytes === items[index].bytes && item.sha256 === items[index].sha256);

/** Writes every byte or fails: a short write is continued, no progress is an error. */
function writeAll(fd, buffer) {
  let offset = 0;
  while (offset < buffer.length) {
    const written = fs.writeSync(fd, buffer, offset, buffer.length - offset);
    if (!(written > 0)) fail('The return could not be written completely (no progress).');
    offset += written;
  }
}
/** The same physical file under another spelling (a short name, another case): the paths are compared after the platform resolves them. */
function isReturnFile(file, producer) {
  return folded(fs.realpathSync.native(file)) === folded(path.join(fs.realpathSync.native(producer), RETURN_NAME));
}

/** One file under the producer root, pinned from its bytes; never the return itself. */
function pinUnderProducer(value, label, producer, returnFile, cap) {
  const file = absolute(value, label);
  if (!within(producer, file) || folded(file) === folded(returnFile)) fail(`${label} must be a file under the producer root other than the return.`);
  // The path is recorded as given and the checker compares that spelling as a string: both rules must hold.
  if (!lexicalWithin(producer, file)) fail(`${label} names a file under the producer root, but with a different spelling than the task's producer root (${producer}); pass the file with the same spelling as that root.`);
  const bytes = readBounded(file, cap, label);
  if (isReturnFile(file, producer)) fail(`${label} must be a file under the producer root other than the return.`);
  return { file, bytes, pin: { path: file, bytes: bytes.length, sha256: hash(bytes) } };
}

/** The fork's saved helper run. The exit code is the fork's statement; the files are pinned from their bytes. */
function readHelper(values, producer, returnFile, budget) {
  const given = ['saved-job', 'stdout', 'stderr', 'exit-code'].filter(flag => values[flag] !== undefined);
  if (values['no-helper']) {
    if (given.length) fail(`--no-helper stands alone; it cannot be combined with --${given[0]}.`);
    return { draftJob: null, stdout: null, stderr: null, exitCode: null, runs: 0, savedJob: null };
  }
  if (given.length !== 4) fail('Name the saved helper run with --saved-job, --stdout, --stderr and --exit-code, or pass --no-helper when draft.mjs never ran.');
  if (!/^[01]$/.test(values['exit-code'])) fail('--exit-code must be 0 or 1, the exit draft.mjs gave.');
  const exitCode = Number(values['exit-code']);
  const saved = pinUnderProducer(values['saved-job'], 'Saved draft job', producer, returnFile, HELPER_JOB);
  const stdout = pinUnderProducer(values.stdout, 'Helper stdout', producer, returnFile, budget.maxHelperStdoutBytes);
  const stderr = pinUnderProducer(values.stderr, 'Helper stderr', producer, returnFile, HELPER_STDERR);
  // The draft.mjs convention: exit 0 prints its report on stdout (stderr is pinned as it is), exit 1 prints nothing on stdout and a blocked record on stderr.
  // The checker pins whatever stderr an exit 0 run printed (a Node warning, say); only the report on stdout is required.
  if (exitCode === 0 && stdout.bytes.length === 0) fail('Exit 0 needs a report on stdout; this file does not match the exit code given.');
  if (exitCode === 1 && (stdout.bytes.length !== 0 || stderr.bytes.length === 0)) fail('Exit 1 needs an empty stdout and a blocked record on stderr; these files do not match the exit code given.');
  // The checker reads the report on stdout (exit 0) or the blocked record on stderr (exit 1) as JSON; a file it would refuse is refused here.
  const record = (bytes, label) => { try { return JSON.parse(decode(bytes, label)); } catch { return fail(`${label} is not JSON.`); } };
  if (exitCode === 0 && record(stdout.bytes, 'Helper stdout')?.status !== 'draft-prepared') fail('Exit 0 needs a draft-prepared report on stdout.');
  if (exitCode === 1) {
    const blocked = record(stderr.bytes, 'Helper stderr');
    if (!isObject(blocked) || blocked.status !== 'blocked' || typeof blocked.reason !== 'string') fail('Exit 1 needs a blocked JSON record on stderr.');
  }
  return { draftJob: saved.pin, stdout: stdout.pin, stderr: stderr.pin, exitCode, runs: 1, savedJob: saved.bytes };
}

/** The notes the fork writes, checked against the limits and patterns of skill-return.schema.json before anything is written. */
function readNotes(file, producer, returnFile) {
  const empty = { openItems: [], unverified: [], claimedChecks: [], externalActions: [] };
  if (file === undefined) return empty;
  const notesFile = absolute(file, 'Notes');
  if (!within(producer, notesFile) || folded(notesFile) === folded(returnFile)) fail(`The notes file must be a file under the producer root other than the return (by convention ${NOTES_NAME}).`);
  const notes = readJson(notesFile, 'Notes');
  if (isReturnFile(notesFile, producer)) fail(`The notes file must be a file under the producer root other than the return (by convention ${NOTES_NAME}).`);
  if (!isObject(notes)) fail('The notes file must hold one JSON object.');
  for (const key of Object.keys(notes)) if (!NOTES_KEYS.includes(key)) fail(`Unknown notes key ${key}; the status is computed from the helper exit code and is not a note.`);
  const texts = (value, label, max) => {
    if (value === undefined) return [];
    if (!Array.isArray(value) || value.length > max || !value.every(item => textOk(item))) fail(`Notes ${label} must be at most ${max} texts of 1 to 8192 characters.`);
    return value;
  };
  const openItems = notes.openItems ?? [];
  if (!Array.isArray(openItems) || openItems.length > 16
    || !openItems.every(item => exactKeys(item, ['id', 'description']) && typeof item.id === 'string' && item.id.length <= 80 && SLUG.test(item.id) && textOk(item.description))) {
    fail('Notes openItems must be at most 16 { id, description } entries with a kebab-case id of at most 80 characters and a description of 1 to 8192 characters.');
  }
  if (new Set(openItems.map(item => item.id.toLowerCase())).size !== openItems.length) fail('Notes openItems repeat an id.');
  const claimedChecks = notes.claimedChecks ?? [];
  if (!Array.isArray(claimedChecks) || claimedChecks.length > 16
    || !claimedChecks.every(item => exactKeys(item, ['name', 'command', 'exitCode', 'raw']) && textOk(item.name, 512) && textOk(item.command)
      && (item.exitCode === null || integer(item.exitCode, 0, 255)) && (item.raw === null || pinOk(item.raw, CHECK_RAW)))) {
    fail('Notes claimedChecks must be at most 16 { name, command, exitCode, raw } entries within the return schema limits.');
  }
  return { openItems, claimedChecks, unverified: texts(notes.unverified, 'unverified', 32), externalActions: texts(notes.externalActions, 'externalActions', 16) };
}

/**
 * The saved draft job, as the checker reads it for every helper run: the template plus changes (and the baseline map for a repair), nothing
 * else; one to 32 text changes, every key an allowed path. Returns the changes.
 */
function checkSavedJob(task, savedJob) {
  let saved;
  try { saved = JSON.parse(decode(savedJob, 'Saved draft job')); } catch { return fail('Saved draft job is not JSON.'); }
  const template = task.draftJobTemplate;
  if (!isObject(saved)) fail('The saved draft job is not an object.');
  const expectedKeys = [...Object.keys(template), 'changes', ...(task.operation === 'repair' ? ['baseline'] : [])].sort();
  if (canonical(Object.keys(saved).sort()) !== canonical(expectedKeys)) fail('The saved draft job keys differ from the template plus changes.');
  for (const key of Object.keys(template)) if (canonical(saved[key]) !== canonical(template[key])) fail(`The saved draft job differs from the template at ${key}.`);
  if (task.operation === 'repair' && canonical(saved.baseline) !== canonical(Object.fromEntries(task.baseline.map(item => [item.path, item.sha256])))) fail('The saved draft job baseline differs from the task baseline.');
  if (!isObject(saved.changes) || Object.keys(saved.changes).length === 0 || Object.keys(saved.changes).length > 32) fail('The saved draft job needs one to 32 changes.');
  const changes = new Map(Object.entries(saved.changes));
  if (new Set([...changes.keys()].map(name => name.toLowerCase())).size !== changes.size) fail('Changes paths repeat or collide in case.');
  for (const [file, text] of changes) {
    safeName(file);
    if (!template.allowedPaths.includes(file)) fail(`A changes key is outside the allowed paths: ${file}.`);
    if (typeof text !== 'string') fail(`Text changes only: ${file}.`);
  }
  return changes;
}

/**
 * What the checker compares between the saved changes and the final draft folder, for a draft return: every changed or new file of the
 * draft is a change with exactly its bytes, every baseline file is still there, and a preservation-only file is untouched.
 */
function checkDraftAgainstJob(task, changes, files, baseline) {
  const roleOf = new Map(task.roles.map(item => [item.path, item.role]));
  for (const file of baseline.keys()) if (!files.has(file)) fail(`A baseline file is gone (draft.mjs never deletes): ${file}.`);
  for (const file of files.keys()) if (!baseline.has(file) && !changes.has(file)) fail(`A new file is neither a change nor baseline: ${file}.`);
  for (const [file, before] of baseline) {
    if (!files.get(file).equals(before) && (roleOf.get(file) === 'preservation-only' || !changes.has(file))) fail(`A preserved baseline file differs from its baseline bytes: ${file}.`);
  }
  for (const [file, text] of changes) if (!files.has(file) || !files.get(file).equals(Buffer.from(text))) fail(`Final bytes differ from the saved changes text: ${file}.`);
  if (!files.has('SKILL.md')) fail('A complete draft needs SKILL.md.');
}

function write(values) {
  const jobFile = absolute(values.job, 'Task');
  const task = readJson(jobFile, 'Task');
  checkTask(task);
  const { draft, producer } = checkRoots(task, jobFile);
  const returnFile = path.join(producer, RETURN_NAME);
  const existing = fs.lstatSync(returnFile, { throwIfNoEntry: false });
  if (existing && (existing.isSymbolicLink() || !existing.isFile())) fail('The return path holds a link or something other than a regular file.');
  const helper = readHelper(values, producer, returnFile, task.budget);
  const changes = helper.runs === 1 ? checkSavedJob(task, helper.savedJob) : null;
  const reportPin = values.report === undefined ? null : pinUnderProducer(values.report, 'Report', producer, returnFile, REPORT).pin;
  const notes = readNotes(values.notes, producer, returnFile);

  // A draft rests on a helper run that exited 0; a helper that exited 1 or never ran can only block, and a block names its open item.
  const status = helper.exitCode === 0 ? 'draft' : 'blocked';
  if (status === 'blocked' && notes.openItems.length === 0) fail('A blocked return needs a named open item in the notes file.');
  const { items, files } = inventory(draft, task.budget);
  const draftExists = fs.lstatSync(draft, { throwIfNoEntry: false }) !== undefined;
  const before = new Map(task.baseline.map(item => [item.path, item.sha256]));
  // What the checker checks for the draft folder: nothing else beside it, and the state the status needs.
  const parent = path.dirname(draft);
  if (fs.existsSync(parent)) {
    const stray = fs.readdirSync(parent).find(name => foldName(name) !== foldName(path.basename(draft)));
    if (stray !== undefined) fail(`The draft parent holds an entry besides the draft folder: ${stray}.`);
  }
  if (notes.externalActions.length) fail('externalActions must be empty; the return records no external action.');
  if (status === 'draft' && !draftExists) fail('A draft return needs a draft folder.');
  if (status === 'blocked') {
    if (task.operation === 'create' ? draftExists : !draftExists || !sameInventory(items, task.baseline)) {
      fail(task.operation === 'create' ? 'A blocked return needs an absent draft root for create.' : 'A blocked repair return needs the draft root exactly as the pinned baseline.');
    }
  } else {
    // The pre-run bytes of a baseline file are in the evidence snapshot the task names; the checker compares against them, so this script does too.
    checkDraftAgainstJob(task, changes, files, new Map(task.baseline.map(item => [item.path, pinUnderEvidence(item, task)])));
  }
  const changed = status === 'blocked' ? [] : items.filter(item => before.get(item.path) !== item.sha256)
    .map(item => ({ path: item.path, operation: before.has(item.path) ? 'update' : 'create' }));

  const { savedJob: _savedJob, ...helperRecord } = helper;
  const ret = {
    version: 1, kind: 'skill-return', taskId: task.id, taskDigest: hash(canonical(task)), status, helper: helperRecord,
    inventory: items, changed, report: reportPin,
    claimedChecks: notes.claimedChecks, openItems: notes.openItems, unverified: notes.unverified, externalActions: notes.externalActions,
  };
  const text = Buffer.from(`${JSON.stringify(ret, null, 2)}\n`);
  if (text.length > ENVELOPE) fail('The return record would be over 256 KiB.');
  // A new file created exclusively beside the destination, then moved over it: a rename replaces the directory entry and never
  // writes through an existing destination, so a hard-linked skill-return.json leaves the other name's bytes untouched.
  const temp = path.join(producer, `.${RETURN_NAME}.${process.pid}.tmp`);
  const fd = fs.openSync(temp, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | NOFOLLOW, 0o644);
  // One cleanup scope from the exclusive creation on: the whole write, the successful close and the rename; the destination stays as it was on failure.
  try {
    try { writeAll(fd, text); } finally { fs.closeSync(fd); }
    fs.renameSync(temp, returnFile);
  } catch (error) { fs.rmSync(temp, { force: true }); throw error; }
  const bytes = readBounded(returnFile, ENVELOPE, 'Return');
  if (!bytes.equals(text)) fail('The return read back differs from the bytes written.');
  return { status: 'return-written', returnStatus: status, taskDigest: ret.taskDigest, helperRuns: helper.runs, return: { path: returnFile, bytes: bytes.length, sha256: hash(bytes) } };
}

/** A repair baseline file's pre-run bytes: the evidence snapshot the task names, pinned by the task's bytes and sha256. */
function pinUnderEvidence(item, task) {
  const evidence = absolute(task.roots.evidence, 'Evidence root');
  if (typeof item.snapshot !== 'string') fail(`Baseline snapshot is missing: ${item.path}.`);
  const snapshot = absolute(item.snapshot, 'Baseline snapshot');
  if (!within(evidence, snapshot)) fail(`Baseline snapshot is outside the evidence root: ${item.path}.`);
  const bytes = readBounded(snapshot, task.budget.maxCandidateFileBytes, `Baseline snapshot ${item.path}`);
  if (bytes.length !== item.bytes || hash(bytes) !== item.sha256) fail(`Baseline snapshot differs from its pin: ${item.path}.`);
  return bytes;
}

const USAGE = `Usage: node skill-return.mjs --job <absolute ${TASK_NAME}> (--saved-job <absolute file> --stdout <absolute file> --stderr <absolute file> --exit-code <0|1> | --no-helper) [--report <absolute file>] [--notes <absolute <producer>/${NOTES_NAME}>]. Every file except the task lies under the producer root.`;
const OPTIONS = {
  job: { type: 'string' }, 'saved-job': { type: 'string' }, stdout: { type: 'string' }, stderr: { type: 'string' }, 'exit-code': { type: 'string' },
  'no-helper': { type: 'boolean' }, report: { type: 'string' }, notes: { type: 'string' },
};
try {
  if (Number(process.versions.node.split('.')[0]) < 24) fail('Node >=24 required.');
  const argv = process.argv.slice(2);
  for (const flag of Object.keys(OPTIONS)) if (argv.filter(arg => arg === `--${flag}` || arg.startsWith(`--${flag}=`)).length > 1) fail(`Duplicate --${flag}.`);
  let parsed;
  try { parsed = parseArgs({ args: argv, options: OPTIONS, strict: true, allowPositionals: false }); }
  catch (error) { fail(`${USAGE} ${error.message}`); }
  if (!parsed.values.job) fail(USAGE);
  process.stdout.write(`${JSON.stringify(write(parsed.values))}\n`);
} catch (error) {
  process.stderr.write(`${JSON.stringify({ status: 'blocked', reason: error instanceof Error ? error.message : String(error) })}\n`);
  process.exitCode = 1;
}
