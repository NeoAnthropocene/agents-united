import { parseArgs } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

// Writes the return record of one Bundle proposal task after the fork has written the four proposal files by ordinary editing.
// It reads the task and the draft folder, writes exactly one file (<roots.producer>/bundle-return.json), never writes inside the draft,
// executes nothing and contacts nothing. Validation, the caller's checks and quality review remain the caller's work.
// The root, name and decoding rules below repeat the coordinator checker's on purpose: one Skill does not import another Skill's
// script, and tests feed the same bad inputs to both scripts.
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
const within = (parent, child) => {
  const rel = path.relative(folded(parent), folded(child));
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel));
};
const overlaps = (a, b) => within(a, b) || within(b, a);
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const byPath = (a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
const AUTHORED = ['bundles.json', 'leader-responsibility.md', 'bindings.json', 'report.json'];
const HOST_DIRS = ['.agents', '.claude', '.cline', '.cursor', '.codex', '.opencode', '.gemini'];
const NOTES_NAME = 'bundle-notes.json';
const ENVELOPE = 262144;
const BODY = 1048576;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SHA = /^[0-9a-f]{64}$/;
const NOTES_KEYS = ['status', 'openItems', 'unverified', 'claimedChecks', 'externalActions', 'upstreamEvidence'];
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
 * The task fields the helper reads, checked against bundle-task.schema.json's constraints for them: version, kind, id, intent, roots
 * (draft, producer, evidence, managed, protected), source (checkout, registry), baseline (path, sha256), budget (the authored,
 * preserved and check limits) and contributionTemplate (null for local intent, a pin for upstream intent).
 */
function checkTask(task) {
  if (!isObject(task) || task.version !== 1 || task.kind !== 'bundle-task') fail('The task is not a version 1 bundle-task record.');
  if (typeof task.id !== 'string' || task.id.length > 80 || !SLUG.test(task.id)) fail('The task id is not a kebab-case identifier of at most 80 characters.');
  if (task.intent !== 'local' && task.intent !== 'upstream') fail('The task intent must be local or upstream.');
  const { roots, source, budget } = task;
  if (!isObject(roots) || ![roots.draft, roots.producer, roots.evidence].every(value => textOk(value))
    || ![roots.managed, roots.protected].every(list => Array.isArray(list) && list.length <= 32 && list.every(value => textOk(value)))) {
    fail('The task roots need draft, producer, evidence, managed and protected.');
  }
  if (!isObject(source) || !textOk(source.checkout) || !textOk(source.registry)) fail('The task source needs checkout and registry.');
  if (!Array.isArray(task.baseline) || task.baseline.length > 36
    || !task.baseline.every(item => isObject(item) && textOk(item.path, 512) && typeof item.sha256 === 'string' && SHA.test(item.sha256))) {
    fail('The task baseline must be a list of { path, sha256, ... } entries.');
  }
  if (!isObject(budget)) fail('The task lacks its budget.');
  for (const [key, min, max] of [['maxAuthoredFileBytes', 1, 262144], ['maxAuthoredBytes', 1, 1048576], ['maxPreservedFiles', 0, 32], ['maxPreservedBytes', 0, 2097152], ['maxChecks', 0, 6], ['maxCheckLogBytes', 1, 524288]]) {
    if (!integer(budget[key], min, max)) fail(`The task budget ${key} is missing or out of range.`);
  }
  if (task.intent === 'upstream' ? !pinOk(task.contributionTemplate, ENVELOPE) : task.contributionTemplate !== null) {
    fail(task.intent === 'upstream' ? 'An upstream task needs its pinned contribution template.' : 'A local task carries no contribution template.');
  }
}

/** The checker's root rules: absolute and link-free, no managed Host folder, disjoint from each other and from every input root. */
function checkRoots(task, jobFile) {
  const { roots, source } = task;
  const draft = absolute(roots.draft, 'Draft root');
  const producer = absolute(roots.producer, 'Producer root');
  const evidence = absolute(roots.evidence, 'Evidence root');
  if (folded(jobFile) !== folded(path.join(evidence, 'bundle-task.json'))) fail('The task must be the bundle-task.json in the evidence root it names.');
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
  return { draft, producer, checkout };
}

/** The draft folder within the task budget; links and unsafe names are refused, never followed; null when the folder is absent. */
function inventory(draft, budget) {
  const stat = fs.lstatSync(draft, { throwIfNoEntry: false });
  if (!stat) return null;
  if (!stat.isDirectory()) fail('The draft root is not a folder.');
  const items = [];
  const names = [];
  let authoredBytes = 0, preservedFiles = 0, preservedBytes = 0, directories = 0;
  const walk = (directory, prefix) => {
    if (++directories > 128) fail('The draft folder is over the directory budget.');
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const rel = safeName(`${prefix}${entry.name}`), file = path.join(directory, entry.name);
      names.push(rel);
      if (entry.isSymbolicLink()) fail(`The draft folder holds a link: ${rel}.`);
      if (entry.isDirectory()) { walk(file, `${rel}/`); continue; }
      if (!entry.isFile()) fail(`The draft folder holds an unsupported entry: ${rel}.`);
      const authored = AUTHORED.includes(rel);
      if (!authored && ++preservedFiles > budget.maxPreservedFiles) fail('The draft folder is over the preserved-file budget.');
      const bytes = readBounded(file, authored ? budget.maxAuthoredFileBytes : budget.maxPreservedBytes, `Draft file ${rel} (task budget)`);
      if (authored && (authoredBytes += bytes.length) > budget.maxAuthoredBytes) fail('The proposal files are over the authored byte budget.');
      if (!authored && (preservedBytes += bytes.length) > budget.maxPreservedBytes) fail('The preserved files are over the preserved byte budget.');
      items.push({ path: rel, bytes: bytes.length, sha256: hash(bytes) });
    }
  };
  walk(draft, '');
  // Two names that differ only in case are refused on every platform, as the checker does.
  if (new Set(names.map(name => name.toLowerCase())).size !== names.length) fail('Two draft entry names differ only in case.');
  return items.sort(byPath);
}

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
  return folded(fs.realpathSync.native(file)) === folded(path.join(fs.realpathSync.native(producer), 'bundle-return.json'));
}

/** The notes the fork writes, checked against the limits and patterns of bundle-return.schema.json before anything is written. */
function readNotes(file, producer, returnFile, budget) {
  if (file === undefined) return { status: 'draft', openItems: [], unverified: [], claimedChecks: [], externalActions: [], upstreamEvidence: undefined };
  const notesFile = absolute(file, 'Notes');
  if (!within(producer, notesFile) || folded(notesFile) === folded(returnFile)) fail(`The notes file must be a file under the producer root other than the return (by convention ${NOTES_NAME}).`);
  const notes = readJson(notesFile, 'Notes');
  if (isReturnFile(notesFile, producer)) fail(`The notes file must be a file under the producer root other than the return (by convention ${NOTES_NAME}).`);
  if (!isObject(notes)) fail('The notes file must hold one JSON object.');
  for (const key of Object.keys(notes)) if (!NOTES_KEYS.includes(key)) fail(`Unknown notes key ${key}.`);
  const status = notes.status ?? 'draft';
  if (status !== 'draft' && status !== 'blocked') fail('Notes status must be draft or blocked.');
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
  if (!Array.isArray(claimedChecks) || claimedChecks.length > Math.min(6, budget.maxChecks)
    || !claimedChecks.every(item => exactKeys(item, ['name', 'command', 'exitCode', 'raw']) && textOk(item.name, 512) && textOk(item.command)
      && (item.exitCode === null || integer(item.exitCode, 0, 255)) && (item.raw === null || pinOk(item.raw, Math.min(524288, budget.maxCheckLogBytes))))) {
    fail('Notes claimedChecks must be at most the task check budget of { name, command, exitCode, raw } entries within the return schema limits.');
  }
  if (notes.upstreamEvidence !== undefined && !textOk(notes.upstreamEvidence, BODY)) fail('Notes upstreamEvidence must be a non-empty text.');
  if (status === 'blocked' && openItems.length === 0) fail('A blocked return needs a named open item.');
  return { status, openItems, claimedChecks, unverified: texts(notes.unverified, 'unverified', 32), externalActions: texts(notes.externalActions, 'externalActions', 16), upstreamEvidence: notes.upstreamEvidence };
}

function write(jobArg, notesArg) {
  const jobFile = absolute(jobArg, 'Task');
  const task = readJson(jobFile, 'Task');
  checkTask(task);
  const { draft, producer, checkout } = checkRoots(task, jobFile);
  const { budget } = task;
  const returnFile = path.join(producer, 'bundle-return.json');
  const existing = fs.lstatSync(returnFile, { throwIfNoEntry: false });
  if (existing && (existing.isSymbolicLink() || !existing.isFile())) fail('The return path holds a link or something other than a regular file.');
  const notes = readNotes(notesArg, producer, returnFile, budget);

  let templateText = null;
  if (task.intent === 'upstream') {
    const pin = task.contributionTemplate;
    const templateFile = absolute(pin.path, 'Contribution template');
    if (folded(templateFile) !== folded(path.join(checkout, '.github', 'PULL_REQUEST_TEMPLATE', 'artifact-contribution.md'))) {
      fail('Use the existing artifact-contribution template inside the selected checkout.');
    }
    const bytes = readBounded(templateFile, ENVELOPE, 'Contribution template');
    if (bytes.length !== pin.bytes || hash(bytes) !== pin.sha256) fail('The contribution template differs from its pin.');
    templateText = decode(bytes, 'Contribution template');
  }

  const items = inventory(draft, budget) ?? [];
  const before = new Map(task.baseline.map(item => [item.path, item.sha256]));
  const changed = items.filter(item => before.get(item.path) !== item.sha256)
    .map(item => ({ path: item.path, operation: before.has(item.path) ? 'update' : 'create' }));
  const reportItem = items.find(item => item.path === 'report.json');
  const report = reportItem ? { path: path.join(draft, 'report.json'), bytes: reportItem.bytes, sha256: reportItem.sha256 } : null;

  let upstreamPreparation = null;
  if (templateText !== null && notes.status !== 'blocked') {
    const evidenceText = notes.upstreamEvidence ?? JSON.stringify({ inventory: items, changed }, null, 2);
    const body = `${templateText}\n\n## Prepared Bundle proposal evidence\n\n${evidenceText}\n`;
    if (body.length > BODY) fail('The upstream preparation body would be over 1 MiB.');
    upstreamPreparation = { templatePath: task.contributionTemplate.path, base: 'dev', sent: false, body };
  }

  const ret = {
    version: 1, kind: 'bundle-return', taskId: task.id, taskDigest: hash(canonical(task)), status: notes.status,
    inventory: items, changed, report,
    claimedChecks: notes.claimedChecks, openItems: notes.openItems, unverified: notes.unverified, externalActions: notes.externalActions,
    upstreamPreparation,
  };
  const text = Buffer.from(`${JSON.stringify(ret, null, 2)}\n`);
  if (text.length > ENVELOPE) fail('The return record would be over 256 KiB.');
  // A new file created exclusively beside the destination, then moved over it: a rename replaces the directory entry and never
  // writes through an existing destination, so a hard-linked bundle-return.json leaves the other name's bytes untouched.
  const temp = path.join(producer, `.bundle-return.json.${process.pid}.tmp`);
  const fd = fs.openSync(temp, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | NOFOLLOW, 0o644);
  // One cleanup scope from the exclusive creation on: the whole write, the successful close and the rename; the destination stays as it was on failure.
  try {
    try { writeAll(fd, text); } finally { fs.closeSync(fd); }
    fs.renameSync(temp, returnFile);
  } catch (error) { fs.rmSync(temp, { force: true }); throw error; }
  const bytes = readBounded(returnFile, ENVELOPE, 'Return');
  if (!bytes.equals(text)) fail('The return read back differs from the bytes written.');
  return { status: 'return-written', returnStatus: ret.status, taskDigest: ret.taskDigest, return: { path: returnFile, bytes: bytes.length, sha256: hash(bytes) } };
}

const USAGE = `Usage: node bundle-return.mjs --job <absolute bundle-task.json> [--notes <absolute <producer>/${NOTES_NAME}>].`;
try {
  if (Number(process.versions.node.split('.')[0]) < 24) fail('Node >=24 required.');
  const argv = process.argv.slice(2);
  for (const flag of ['job', 'notes']) if (argv.filter(arg => arg === `--${flag}` || arg.startsWith(`--${flag}=`)).length > 1) fail(`Duplicate --${flag}.`);
  let parsed;
  try { parsed = parseArgs({ args: argv, options: { job: { type: 'string' }, notes: { type: 'string' } }, strict: true, allowPositionals: false }); }
  catch (error) { fail(`${USAGE} ${error.message}`); }
  if (!parsed.values.job) fail(USAGE);
  process.stdout.write(`${JSON.stringify(write(parsed.values.job, parsed.values.notes))}\n`);
} catch (error) {
  process.stderr.write(`${JSON.stringify({ status: 'blocked', reason: error instanceof Error ? error.message : String(error) })}\n`);
  process.exitCode = 1;
}
