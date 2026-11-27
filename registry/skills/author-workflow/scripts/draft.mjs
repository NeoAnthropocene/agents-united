import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';

// This helper writes one already-authored native Claude workflow, registry/hosts/claude/workflows/<name>.js, for the portable Skill
// registry/skills/<name>/SKILL.md, which must already exist. It does not author the script, run workflow-check or any other validator,
// change registry/bundles.json (it only reads it, to report which Bundles list the Skill) or the Skill, contact a host or the network, or use git.
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
class Blocked extends Error {}
const block = reason => { throw new Blocked(reason); };
const MAX_CONTENT_BYTES = 128 * 1024; // the size workflow-check accepts
const MAX_JOB_BYTES = 1024 * 1024;
const MAX_SKILL_BYTES = 1024 * 1024;
const MAX_BUNDLES_BYTES = 1024 * 1024;
const ALLOWED = ['checkout', 'name', 'content'];
const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const DEVICE = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/;
const WORKFLOWS = 'registry/hosts/claude/workflows';
// Test seam. AUTHOR_WORKFLOW_TEST_FAULT is a test-only switch (a comma-separated list) that can only force failures: it makes the
// helper behave as if a step had failed or a file had changed. Used only by tests/author-workflow-skill.test.ts. It does nothing at all
// unless AUTHOR_WORKFLOW_TEST_ROOT names an existing absolute folder whose real path is under the real path of the temp folder
// (os.tmpdir()), so a stray variable in a contributor's shell cannot change a real run, whatever the fault. Every fault that touches a
// file acts only on a path inside that root.
// Faults that write nothing: fail-after-write, fail-lock-write, fail-lock-removal.
// Faults that swap the workflows folder for a junction, as another process could: workflows-swapped-after-lock and workflows-swapped-before-create.
// A fault that cuts a write short: partial-write writes the first half of the intended bytes through the real write path, then throws
// EIO, as a full disk would.
// Faults that replace the workflow file just before the rollback looks at it: workflow-becomes-directory, workflow-becomes-link,
// workflow-becomes-oversized, workflow-becomes-prefix, and workflow-swapped (another file with the very same bytes, a different file).
// lock-swapped puts another file in the place of this run's lock just before the lock is removed.
function testSwitch() {
  const names = (process.env.AUTHOR_WORKFLOW_TEST_FAULT ?? '').split(',').filter(Boolean);
  const given = process.env.AUTHOR_WORKFLOW_TEST_ROOT;
  const off = { faults: new Set(), root: null };
  if (!names.length || typeof given !== 'string' || !path.isAbsolute(given)) return off;
  try {
    const root = fs.realpathSync(given);
    const rel = path.relative(fs.realpathSync(os.tmpdir()), root);
    if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) return off;
    return { faults: new Set(names), root };
  } catch { return off; }
}
const { faults, root: testRoot } = testSwitch();
// Whether `file` lies inside the test root (a fault may only touch such a path).
const inTestRoot = file => {
  if (testRoot === null) return false;
  const rel = path.relative(testRoot, path.resolve(file));
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
};
const READ_CHUNK = 64 * 1024;

function regularFile(file, label) {
  const entry = fs.lstatSync(file, { throwIfNoEntry: false });
  if (!entry) block(`${label} is unavailable: ${file}`);
  if (entry.isSymbolicLink()) block(`${label} is a link; use the real path of the contributor's checkout: ${file}`);
  if (!entry.isFile()) block(`${label} is not a regular file: ${file}`);
}
function realDirectory(dir, label) {
  const entry = fs.lstatSync(dir, { throwIfNoEntry: false });
  if (!entry) block(`${label} is unavailable: ${dir}`);
  if (entry.isSymbolicLink()) block(`${label} is a link or junction; use the real path of the contributor's checkout: ${dir}`);
  if (!entry.isDirectory()) block(`${label} is not a folder: ${dir}`);
}
const sameDisk = (a, b) => (process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b);

// The checkout and every folder above it must be real: a link or junction anywhere in the path would send the writes elsewhere.
function realCheckout(checkout) {
  const given = path.resolve(checkout);
  let real;
  try { real = fs.realpathSync(given); } catch { block(`The checkout is unavailable: ${given}`); }
  if (!sameDisk(real, given)) block(`The checkout path goes through a link or junction (it resolves to ${real}); use the real path of the contributor's checkout: ${given}`);
  return given;
}

// Every folder from the registry down to the workflows folder is inspected without following links; none is created. Run once before the
// lock and again after it, because the folders can change in between. Returns the folder as the checkout spells it and its real path.
function workflowsFolder(checkout) {
  let workflowsDir = checkout;
  for (const part of ['registry', 'hosts', 'claude', 'workflows']) {
    workflowsDir = path.join(workflowsDir, part);
    realDirectory(workflowsDir, path.relative(checkout, workflowsDir).split(path.sep).join('/'));
  }
  let realWorkflows;
  try { realWorkflows = fs.realpathSync(workflowsDir); } catch { block(`${WORKFLOWS} is unavailable: ${workflowsDir}`); }
  if (!sameDisk(realWorkflows, workflowsDir)) block(`${WORKFLOWS} resolves to ${realWorkflows}, not to ${workflowsDir}; a link or junction is in the path.`);
  return { workflowsDir, realWorkflows };
}

// A created file's identity: the device and file number its descriptor reports, as bigints (a Windows file number does not fit a double).
const fileId = stat => ({ dev: stat.dev, ino: stat.ino });
const sameFile = (stat, id) => stat.dev === id.dev && stat.ino === id.ino;
// Removes `file` only while it is still the file with identity `id` (an ordinary file). Returns 'removed', 'gone', 'other' (something else is
// there now) or 'failed' (it is the file, but could not be removed).
function removeIfSameFile(file, id) {
  try {
    const entry = fs.lstatSync(file, { bigint: true, throwIfNoEntry: false });
    if (!entry) return 'gone';
    if (!entry.isFile() || !sameFile(entry, id)) return 'other';
    fs.rmSync(file, { force: true });
    return 'removed';
  } catch { return 'failed'; }
}

function readJob(argument) {
  if (typeof argument !== 'string' || !path.isAbsolute(argument)) block('The one argument must be the absolute path of the job JSON file.');
  regularFile(argument, 'The job file');
  if (fs.statSync(argument).size > MAX_JOB_BYTES) block('The job file is larger than 1 MiB.');
  let job;
  try { job = JSON.parse(fs.readFileSync(argument, 'utf8')); } catch { block('The job file is not valid JSON.'); }
  if (job === null || typeof job !== 'object' || Array.isArray(job)) block('The job must be one JSON object.');
  const unknown = Object.keys(job).filter(key => !ALLOWED.includes(key));
  if (unknown.length) block(`Unknown job key(s): ${unknown.join(', ')}; allowed: ${ALLOWED.join(', ')}.`);
  if (typeof job.checkout !== 'string' || !path.isAbsolute(job.checkout)) block('checkout must be the absolute path of the contributor\'s source checkout.');
  if (typeof job.name !== 'string' || !KEBAB.test(job.name)) block(`name must be lower-case kebab-case without .js (letters, digits and single hyphens): ${JSON.stringify(job.name)}.`);
  if (DEVICE.test(job.name)) block(`${job.name} is a reserved device name on Windows; pick another name.`);
  if (typeof job.content !== 'string' || job.content.trim() === '') block('content must be the complete authored workflow script, not empty.');
  if (Buffer.byteLength(job.content) > MAX_CONTENT_BYTES) block(`content is larger than the ${MAX_CONTENT_BYTES / 1024} KiB limit of workflow-check.`);
  return job;
}

// The text of meta.name, read from the top level of the object literal `export const meta = { ... }`, without running or evaluating
// anything. A convenience check only: workflow-check is the authority on the script. Returns { missing } when there is no such
// literal, { literal: false } when the key is there with a value that is not one plain string, else { literal: true, value }.
const isSpace = char => char === ' ' || char === '\t' || char === '\n' || char === '\r' || char === '\v' || char === '\f';
function skipTrivia(text, from) {
  let at = from;
  while (at < text.length) {
    if (isSpace(text[at])) at++;
    else if (text[at] === '/' && text[at + 1] === '/') { while (at < text.length && text[at] !== '\n' && text[at] !== '\r') at++; }
    else if (text[at] === '/' && text[at + 1] === '*') { const end = text.indexOf('*/', at + 2); at = end < 0 ? text.length : end + 2; }
    else break;
  }
  return at;
}
// Past a quoted string or template that starts at `at`; the position after its closing quote, or -1 when it never closes.
function skipQuoted(text, at) {
  const quote = text[at];
  for (let i = at + 1; i < text.length; i++) {
    if (text[i] === '\\') { i++; continue; }
    if (text[i] === quote) return i + 1;
    if (quote === '`' && text[i] === '$' && text[i + 1] === '{') {
      const after = skipValue(text, i + 2, true);
      if (after < 0) return -1;
      i = after - 1;
    }
  }
  return -1;
}
// Past one value at `at`: to the top-level `,` or `}` that ends it (not consumed), or, inside `${ }`, past its closing brace.
function skipValue(text, at, inTemplate = false) {
  let depth = 0;
  for (let i = at; i < text.length; i++) {
    const char = text[i];
    if (char === '"' || char === '\'' || char === '`') { i = skipQuoted(text, i) - 1; if (i < 0) return -1; continue; }
    if (char === '/' && (text[i + 1] === '/' || text[i + 1] === '*')) { i = skipTrivia(text, i) - 1; continue; }
    if (char === '(' || char === '[' || char === '{') depth++;
    else if (char === ')' || char === ']' || char === '}') {
      if (depth === 0) return inTemplate && char === '}' ? i + 1 : i;
      depth--;
    } else if (char === ',' && depth === 0 && !inTemplate) return i;
  }
  return -1;
}
function metaName(text) {
  const start = skipTrivia(text, 0);
  const opener = /export\s+const\s+meta\s*=\s*\{/y;
  opener.lastIndex = start;
  const found = opener.exec(text);
  if (!found) return { missing: true };
  let at = start + found[0].length;
  for (;;) {
    at = skipTrivia(text, at);
    if (at >= text.length || text[at] === '}') return { missing: true };
    if (text[at] === ',') { at++; continue; }
    let key;
    if (text[at] === '"' || text[at] === '\'') {
      const end = skipQuoted(text, at);
      if (end < 0) return { missing: true };
      key = text.slice(at + 1, end - 1);
      at = end;
    } else {
      const word = /[A-Za-z_$][\w$]*/y;
      word.lastIndex = at;
      const read = word.exec(text);
      if (!read) return { missing: true };
      key = read[0];
      at += key.length;
    }
    at = skipTrivia(text, at);
    if (text[at] !== ':') return { missing: true };
    at = skipTrivia(text, at + 1);
    if (key === 'name') {
      if (text[at] !== '"' && text[at] !== '\'') return { literal: false };
      const end = skipQuoted(text, at);
      if (end < 0) return { literal: false };
      const after = skipTrivia(text, end);
      const raw = text.slice(at + 1, end - 1);
      if (raw.includes('\\') || (text[after] !== ',' && text[after] !== '}')) return { literal: false };
      return { literal: true, value: raw };
    }
    const next = skipValue(text, at);
    if (next < 0) return { missing: true };
    at = next;
  }
}
function checkMeta(content, name) {
  const found = metaName(content);
  if (found.missing && !/export\s+const\s+meta\b/.test(content)) block('content must start with `export const meta = { ... }`, as workflow-check requires.');
  if (found.missing) block('meta.name could not be read: write `export const meta = { name: \'<name>\', ... }` as an object literal with a plain string name.');
  if (!found.literal) block(`meta.name must be one plain string literal equal to ${JSON.stringify(name)} (the file name without .js), written without escapes.`);
  if (found.value !== name) block(`meta.name is ${JSON.stringify(found.value)}, but the file is ${name}.js; the host runs a saved workflow as /<name>, so they must match.`);
}

// The paired Skill, found without following a link: skills, skills/<name> and SKILL.md are each inspected with lstat. Returns the
// SHA-256 of SKILL.md. A missing Skill is the contributor's cue to author it first through author-skill.
function pairedSkill(registry, name) {
  const rel = `registry/skills/${name}/SKILL.md`;
  const missing = `The paired Skill ${rel} is missing. Author the Skill first through author-skill, then run this route again; this helper writes only the workflow file.`;
  const skills = path.join(registry, 'skills');
  const folder = path.join(skills, name);
  const file = path.join(folder, 'SKILL.md');
  for (const [entryPath, label, kind] of [[skills, 'registry/skills', 'folder'], [folder, `registry/skills/${name}`, 'folder'], [file, rel, 'file']]) {
    const entry = fs.lstatSync(entryPath, { throwIfNoEntry: false });
    if (!entry) block(missing);
    if (entry.isSymbolicLink()) block(`${label} is a link or junction, so the paired Skill cannot be confirmed: ${entryPath}`);
    if (kind === 'folder' ? !entry.isDirectory() : !entry.isFile()) block(`The paired Skill ${rel} is not a regular file (${label} is not a ${kind === 'folder' ? 'folder' : 'regular file'}): ${entryPath}`);
  }
  const bytes = boundedRead(file, MAX_SKILL_BYTES + 1);
  if (!bytes) block(`The paired Skill ${rel} is not a regular file.`);
  if (bytes.length > MAX_SKILL_BYTES) block(`The paired Skill ${rel} is larger than 1 MiB.`);
  return { path: rel, sha256: hash(bytes) };
}

// Reads at most `limit` bytes of a regular file through one descriptor, so a huge file is never read whole. Returns null for
// anything that is not a regular file (a link, a folder, a device) or, when `id` is given, not the file with that identity, and
// undefined for a file that is gone.
function boundedRead(file, limit, id) {
  let entry;
  try { entry = fs.lstatSync(file); } catch (error) { if (error?.code === 'ENOENT') return undefined; throw error; }
  if (!entry.isFile()) return null;
  const descriptor = fs.openSync(file, 'r');
  try {
    // With an identity given, the file that was opened must be that one (null otherwise, as for any file that is not the expected one).
    const opened = fs.fstatSync(descriptor, { bigint: true });
    if (!opened.isFile() || (id !== undefined && !sameFile(opened, id))) return null;
    return readDescriptor(descriptor, limit);
  } finally { fs.closeSync(descriptor); }
}
// The first `limit` bytes (at most) of an open descriptor, from position 0.
function readDescriptor(descriptor, limit) {
  const buffer = Buffer.alloc(limit);
  let count = 0;
  while (count < limit) {
    const got = fs.readSync(descriptor, buffer, count, Math.min(READ_CHUNK, limit - count), count);
    if (got === 0) break;
    count += got;
  }
  return buffer.subarray(0, count);
}

// Which Bundles of registry/bundles.json list the paired Skill by exact name, for the hand-off. A report only: it never refuses and never
// changes the file, and a workflow whose Skill no Bundle lists is never installed. A file that cannot be read as the one regular
// file it should be (missing, a link, a folder, over the bound, not JSON, no bundles map) is reported as unreadable, with listed null
// (not false, which would claim the Skill is in no Bundle), so it never fails the write.
function bundleMembership(registry, name) {
  const rel = 'registry/bundles.json';
  const unreadable = reason => ({ listed: null, bundles: [], unreadable: reason,
    note: `Bundle membership could not be read, so whether this workflow is ever installed is not known; read ${rel} by hand.` });
  try {
    const file = path.join(registry, 'bundles.json');
    const entry = fs.lstatSync(file, { throwIfNoEntry: false });
    if (!entry) return unreadable(`${rel} is unavailable.`);
    if (entry.isSymbolicLink()) return unreadable(`${rel} is a link, so it was not followed.`);
    if (!entry.isFile()) return unreadable(`${rel} is not a regular file.`);
    const bytes = boundedRead(file, MAX_BUNDLES_BYTES + 1);
    if (!bytes) return unreadable(`${rel} is not a regular file.`);
    if (bytes.length > MAX_BUNDLES_BYTES) return unreadable(`${rel} is larger than 1 MiB.`);
    let parsed;
    try { parsed = JSON.parse(bytes.toString('utf8')); } catch { return unreadable(`${rel} is not valid JSON.`); }
    const map = parsed?.bundles;
    if (map === null || typeof map !== 'object' || Array.isArray(map)) return unreadable(`${rel} has no bundles map.`);
    const bundles = Object.entries(map).filter(([, bundle]) => Array.isArray(bundle?.skills) && bundle.skills.includes(name)).map(([key]) => key);
    if (bundles.length) return { listed: true, bundles };
    return { listed: false, bundles: [], note: 'No Bundle lists the paired Skill, so this workflow is never installed until one does; this helper does not change a Bundle.' };
  } catch (error) { return unreadable(`${rel} could not be read (${error?.code ?? 'unexpected error'}).`); }
}

// Rollback removes the file only while it is still the file this run created: a pathname alone could now name a replacement that someone
// else created, even one with the very same bytes. So the file must have the device and file number recorded when the exclusive create
// succeeded (and the same on the descriptor that reads it), and then also the intended bytes. Gone is fine. Anything else is left in
// place and named. When this run's own write of the file threw, a prefix of the intended bytes is this run's truncated write and is
// removed too. At most the intended length plus one byte is read. The window between that check and the removal is the one a pathname
// cannot close; it is documented in references/job.md.
function removeIfMine(file, expected, writeThrew, id, stuck, left) {
  try {
    const entry = fs.lstatSync(file, { bigint: true, throwIfNoEntry: false });
    if (!entry) return;
    if (!entry.isFile() || id === undefined || !sameFile(entry, id)) { left.push(file); return; }
    const found = boundedRead(file, expected.length + 1, id);
    if (found === undefined) return;
    const mine = found !== null && (found.equals(expected) || (writeThrew && found.length < expected.length + 1 && expected.subarray(0, found.length).equals(found)));
    if (!mine) { left.push(file); return; }
    fs.rmSync(file, { force: true });
  } catch { stuck.push(file); }
}

// Test seam only (see `faults`): replaces the workflow file, inside the test root, just before the rollback inspects it. An existing keep.txt
// or a linked link-target stops the link fault before anything is touched, so it never writes through a link or over a file.
function replaceWorkflowForTest(file, body) {
  const kind = ['directory', 'link', 'oversized', 'prefix'].find(name => faults.has(`workflow-becomes-${name}`));
  const swap = faults.has('workflow-swapped');
  if ((!kind && !swap) || !inTestRoot(file)) return;
  if (swap) {
    // Another file with the very same bytes takes the place: a copy made first, then renamed over, so it is a different file.
    fs.writeFileSync(`${file}.swap`, body, { flag: 'wx' });
    fs.renameSync(`${file}.swap`, file);
    return;
  }
  if (kind === 'link') {
    const target = path.join(testRoot, 'link-target');
    if (fs.lstatSync(target, { throwIfNoEntry: false })?.isSymbolicLink()) return;
    fs.mkdirSync(target, { recursive: true });
    fs.writeFileSync(path.join(target, 'keep.txt'), 'keep\n', { flag: 'wx' });
    fs.rmSync(file, { force: true });
    fs.symlinkSync(target, file, 'junction');
    return;
  }
  fs.rmSync(file, { force: true });
  if (kind === 'directory') fs.mkdirSync(file);
  else if (kind === 'oversized') fs.writeFileSync(file, Buffer.concat([body, Buffer.alloc(2 * 1024 * 1024, 'x')]));
  else fs.writeFileSync(file, body.subarray(0, 20));
}

// Test seam only (see `faults`): swaps the workflows folder for a junction to <root>/elsewhere, as another process could, after moving the real
// folder to <root>/moved-workflows. Used by workflows-swapped-after-lock and workflows-swapped-before-create. It acts only inside the test root.
function swapWorkflowsForTest(dir) {
  if (!inTestRoot(dir)) return;
  const elsewhere = path.join(testRoot, 'elsewhere');
  fs.mkdirSync(elsewhere, { recursive: true });
  fs.renameSync(dir, path.join(testRoot, 'moved-workflows'));
  fs.symlinkSync(elsewhere, dir, 'junction');
}

// Test seam only (see `faults`): another run's lock file takes the place of this run's, as a copy renamed over it (so it is a different file).
// Used by lock-swapped. It acts only inside the test root.
function swapLockForTest(lock) {
  if (!inTestRoot(lock)) return;
  fs.writeFileSync(`${lock}.swap`, 'another run\n', { flag: 'wx' });
  fs.renameSync(`${lock}.swap`, lock);
}

function run(argument) {
  const job = readJob(argument);
  const workflowFile = `${job.name}.js`;
  const checkout = realCheckout(job.checkout);
  const registry = path.join(checkout, 'registry');
  if (!fs.existsSync(registry)) block(`The checkout has no registry folder: ${registry}`);
  const { workflowsDir, realWorkflows } = workflowsFolder(checkout);
  const collision = () => {
    const clash = fs.readdirSync(workflowsDir).find(entry => entry.toLowerCase() === workflowFile);
    if (clash) block(`${WORKFLOWS}/${clash} already exists; it collides with ${workflowFile}. Repair it by hand or pick another name.`);
  };
  collision();
  // A native Claude loader of the same name would be replaced by the workflow at install time, and the factory binding refuses that.
  const loader = path.join(registry, 'hosts', 'claude', 'skills', job.name);
  if (fs.lstatSync(loader, { throwIfNoEntry: false })) block(`registry/hosts/claude/skills/${job.name} already holds a native Claude loader for this Skill; a workflow of the same name would replace it at install time. Pick another name.`);
  const skill = pairedSkill(registry, job.name);
  checkMeta(job.content, job.name);
  const body = Buffer.from(/\n$/.test(job.content) ? job.content : `${job.content}\n`);
  // The limit is workflow-check's, and it counts the file as written: the final newline this helper adds counts too.
  if (body.length > MAX_CONTENT_BYTES) block(`content is ${body.length} bytes as it will be written (a final newline is added when there is none), over the ${MAX_CONTENT_BYTES / 1024} KiB limit of workflow-check.`);
  const workflowPath = path.join(workflowsDir, workflowFile);
  const lock = path.join(registry, '.author-workflow.lock');
  // Only what this run created is ever removed: the flag is set once the exclusive create has succeeded, so a create that finds the file already there owns nothing.
  // workflowWriteThrew means this run's own write threw, so a truncated file under that name is this run's. workflowId is the identity of the created file.
  // lockId is the identity of the lock this run created: the lock is removed only while the path still names that file.
  let lockHeld = false, workflowWritten = false, workflowWriteThrew = false, workflowId, lockId;
  let failure;
  try {
    // The flag is set as soon as the exclusive open succeeds, before the process id is written, so a failed write still removes the lock.
    let descriptor;
    try { descriptor = fs.openSync(lock, 'wx'); lockHeld = true; } catch (error) {
      if (error?.code === 'EEXIST') block(`Another run holds ${lock}. A run that was killed leaves its lock behind, so if no run is active the lock is stale: check that no helper is running, then delete the lock file named here and run again. Nothing was changed.`);
      throw error;
    }
    try {
      lockId = fileId(fs.fstatSync(descriptor, { bigint: true }));
      if (faults.has('fail-lock-write')) throw Object.assign(new Error('injected failure'), { code: 'EIO' });
      fs.writeSync(descriptor, `${process.pid}\n`);
    } finally { fs.closeSync(descriptor); }
    if (faults.has('workflows-swapped-after-lock')) swapWorkflowsForTest(workflowsDir);
    // The lock only keeps other runs of this helper out, so what the checks above read is read again before the write: the checkout and
    // every folder down to the workflows folder (a link or junction put there since is refused), the collision and the paired Skill.
    if (realCheckout(job.checkout) !== checkout) block('The checkout path changed while the helper was working; nothing was written. Run it again.');
    if (workflowsFolder(checkout).workflowsDir !== workflowsDir) block(`${WORKFLOWS} changed while the helper was working; nothing was written. Run it again.`);
    collision();
    if (pairedSkill(registry, job.name).sha256 !== skill.sha256) block('The paired Skill changed while the helper was working; nothing was written. Run it again.');
    if (faults.has('workflows-swapped-before-create')) swapWorkflowsForTest(workflowsDir);
    // The create is exclusive and the file stays open until it is checked: its path must still resolve to the real workflows folder (a
    // folder swapped for a link since the walk would have sent the create elsewhere), and the bytes are read back from the same descriptor.
    let file;
    try { file = fs.openSync(workflowPath, 'wx+'); } catch (error) {
      if (error?.code === 'EEXIST') block(`${WORKFLOWS}/${workflowFile} appeared while the helper was working; nothing was written.`);
      throw error;
    }
    try {
      workflowWritten = true;
      workflowId = fileId(fs.fstatSync(file, { bigint: true }));
      const confirmPlace = () => {
        let actual = null;
        try { actual = fs.realpathSync(workflowPath); } catch { /* reported below */ }
        if (actual !== null && sameDisk(actual, path.join(realWorkflows, workflowFile))) return;
        const at = actual ?? workflowPath;
        const outcome = removeIfSameFile(at, workflowId);
        if (outcome === 'removed' || outcome === 'gone') workflowWritten = false;
        block(`${WORKFLOWS}/${workflowFile} was created at ${actual ?? 'a path that cannot be resolved'}, not in the checkout's workflows folder: a link or junction is in the path.${outcome === 'removed' ? ' The file this run created there was removed.' : ` The file this run created could not be removed from ${at} (${outcome === 'other' ? 'something else is there now' : 'removal failed'}); check it and remove it by hand if it is not yours.`}`);
      };
      confirmPlace();
      try {
        // The partial fault (test seam) writes the first half, then fails as a full disk would.
        if (faults.has('partial-write')) { fs.writeFileSync(file, body.subarray(0, Math.floor(body.length / 2))); throw Object.assign(new Error('injected failure'), { code: 'EIO' }); }
        fs.writeFileSync(file, body);
      } catch (error) { workflowWriteThrew = true; throw error; }
      // Read the file back: the bytes on disk must be the bytes this run meant to write.
      const back = readDescriptor(file, body.length + 1);
      if (!back.equals(body)) block(`${WORKFLOWS}/${workflowFile} does not hold the bytes this run wrote.`);
      confirmPlace();
    } finally { fs.closeSync(file); }
    // Test seam (see `faults` above), inert unless AUTHOR_WORKFLOW_TEST_FAULT is set: fails after a complete, verified write.
    if (faults.has('fail-after-write')) throw Object.assign(new Error('injected failure'), { code: 'EIO' });
  } catch (error) {
    // Zero orphaned files: a failure removes what this run created, only while it is still what this run wrote.
    const stuck = [], left = [];
    if (workflowWritten) {
      try { replaceWorkflowForTest(workflowPath, body); } catch { /* test seam only */ }
      removeIfMine(workflowPath, body, workflowWriteThrew, workflowId, stuck, left);
    }
    if (stuck.length || left.length) {
      let why = error instanceof Blocked ? error.message : `The helper could not finish (${error?.code ?? 'unexpected error'}).`;
      if (left.length) why += ` Left in place, because it is no longer the file this run created (another file, other bytes, or not a regular file): ${left.join(', ')}. Check it and remove it by hand if it is not yours.`;
      if (stuck.length) why += ` It could not remove: ${stuck.join(', ')}. Remove ${stuck.length === 1 ? 'it' : 'them'} by hand.`;
      failure = new Blocked(why);
    } else failure = error;
  }
  // The lock goes last. A removal that fails is reported (a stale lock would otherwise only surface as the next run's refusal).
  let lockProblem;
  if (lockHeld) {
    try {
      if (faults.has('fail-lock-removal')) throw Object.assign(new Error('injected failure'), { code: 'EPERM' });
      if (faults.has('lock-swapped')) swapLockForTest(lock);
      const held = fs.lstatSync(lock, { bigint: true, throwIfNoEntry: false });
      if (held === undefined) { /* already gone: nothing to remove */ }
      else if (lockId === undefined || !held.isFile() || !sameFile(held, lockId)) lockProblem = `The lock file ${lock} is no longer the one this run created, so it was left in place. Check that no helper is running, then delete it by hand before the next run.`;
      else fs.rmSync(lock, { force: true });
    } catch { lockProblem = `The lock file ${lock} could not be removed; delete it by hand before the next run.`; }
  }
  if (failure) {
    if (!lockProblem) throw failure;
    throw new Blocked(`${failure instanceof Blocked ? failure.message : `The helper could not finish (${failure?.code ?? 'unexpected error'}).`} ${lockProblem}`);
  }
  return {
    version: 1, status: 'written',
    workflow: { path: `${WORKFLOWS}/${workflowFile}`, bytes: body.length, sha256: hash(body) },
    skill,
    bundleMembership: bundleMembership(registry, job.name),
    validation: { status: 'unverified', reason: 'This helper runs no workflow-check; run it on the written workflow file.' },
    externalActions: [],
    ...(lockProblem ? { warnings: [lockProblem] } : {}),
  };
}

try {
  process.stdout.write(`${JSON.stringify(run(process.argv[2]), null, 2)}\n`);
} catch (error) {
  const reason = error instanceof Blocked ? error.message : `The helper could not finish (${error?.code ?? 'unexpected error'}).`;
  process.stderr.write(`${JSON.stringify({ status: 'blocked', reason })}\n`);
  process.exitCode = 1;
}
