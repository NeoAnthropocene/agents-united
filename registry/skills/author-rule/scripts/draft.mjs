import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomBytes } from 'node:crypto';

// This helper writes one already-authored canonical rule, registry/rules/<name>.md, and appends its
// file name to one bundle's rules[] in registry/bundles.json. It does not author the rule, run
// rule-check or any other validator, contact a host or the network, or use git.
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
class Blocked extends Error {}
const block = reason => { throw new Blocked(reason); };
const MAX_CONTENT_BYTES = 64 * 1024; // the size rule-check accepts
const MAX_JOB_BYTES = 1024 * 1024;
const ALLOWED = ['checkout', 'name', 'bundle', 'content'];
const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;
// The host entry-point names the projectors skip, without .md (rule-check compares them without regard to case).
const ENTRY_POINTS = new Set(['claude', 'gemini', 'agents', 'cursor']);
const DEVICE = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/;
// Test seam. AUTHOR_RULE_TEST_FAULT is a test-only switch (a comma-separated list) that can only force failures: it makes the
// helper behave as if a step had failed or a file had changed. Used only by tests/author-rule-skill.test.ts.
// Faults that write nothing: manifest-changed, fail-before-rename, rule-replaced, temp-replaced, fail-lock-write, fail-lock-removal.
// Faults that cut a write short: partial-rule-write and partial-temp-write write the first half of the intended bytes through the
// real write path, then throw EIO, as a full disk would.
// Faults that replace the rule file just before the rollback looks at it: rule-becomes-directory, rule-becomes-link,
// rule-becomes-oversized, rule-becomes-prefix. These are the only faults that touch a file other than the one this run wrote, and
// they act only when AUTHOR_RULE_TEST_ROOT is set and the rule path lies inside that folder; otherwise they do nothing.
const faults = new Set((process.env.AUTHOR_RULE_TEST_FAULT ?? '').split(',').filter(Boolean));
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
  if (entry.isSymbolicLink()) block(`${label} is a link; use the real path of the contributor's checkout: ${dir}`);
  if (!entry.isDirectory()) block(`${label} is not a folder: ${dir}`);
}

// The checkout and every folder above it must be real: a link or junction anywhere in the path would send the writes elsewhere.
function realCheckout(checkout) {
  const given = path.resolve(checkout);
  let real;
  try { real = fs.realpathSync(given); } catch { block(`The checkout is unavailable: ${given}`); }
  const same = process.platform === 'win32' ? real.toLowerCase() === given.toLowerCase() : real === given;
  if (!same) block(`The checkout path goes through a link or junction (it resolves to ${real}); use the real path of the contributor's checkout: ${given}`);
  return given;
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
  if (typeof job.name !== 'string' || !KEBAB.test(job.name)) block(`name must be lower-case kebab-case without .md (letters, digits and single hyphens): ${JSON.stringify(job.name)}.`);
  if (ENTRY_POINTS.has(job.name)) block(`${job.name} is a host entry-point file name; the projectors skip it, so it never becomes a rule. Pick another name.`);
  if (DEVICE.test(job.name)) block(`${job.name} is a reserved device name on Windows; pick another name.`);
  if (typeof job.bundle !== 'string' || job.bundle === '') block('bundle must be the key of one bundle in registry/bundles.json.');
  if (typeof job.content !== 'string' || job.content.trim() === '') block('content must be the complete authored rule text, not empty.');
  if (Buffer.byteLength(job.content) > MAX_CONTENT_BYTES) block(`content is larger than the ${MAX_CONTENT_BYTES / 1024} KiB limit of rule-check; a rule must be short.`);
  return job;
}

function bundleFile(registry, bundleName, ruleFile) {
  const manifest = path.join(registry, 'bundles.json');
  regularFile(manifest, 'registry/bundles.json');
  const raw = fs.readFileSync(manifest);
  const original = raw.toString('utf8');
  const crlf = original.includes('\r\n');
  // One ending throughout: a file that mixes CRLF and LF would come back all one way, so it is refused instead.
  if (crlf && /(?<!\r)\n/.test(original)) block('registry/bundles.json mixes CRLF and LF line endings; the helper would rewrite them all one way. Make the endings uniform or edit the entry by hand.');
  const text = original.replace(/\r\n/g, '\n');
  let parsed;
  try { parsed = JSON.parse(text); } catch { block('registry/bundles.json is not valid JSON.'); }
  // The helper writes 2-space JSON; refuse a manifest whose bytes it could not reproduce, rather than reformat it.
  if (`${JSON.stringify(parsed, null, 2)}\n` !== text) block('registry/bundles.json formatting would change when written back (the helper writes 2-space JSON, byte for byte the same as the file now); edit the entry by hand.');
  const bundles = parsed?.bundles;
  if (bundles === null || typeof bundles !== 'object' || !Object.hasOwn(bundles, bundleName)) block(`Unknown bundle ${JSON.stringify(bundleName)} in registry/bundles.json.`);
  const bundle = bundles[bundleName];
  if (bundle === null || typeof bundle !== 'object' || Array.isArray(bundle)) block(`Bundle ${bundleName} is not an object.`);
  const rules = bundle.rules === undefined ? [] : bundle.rules;
  if (!Array.isArray(rules) || rules.some(item => typeof item !== 'string')) block(`Bundle ${bundleName} has a rules entry that is not a list of file names.`);
  if (rules.includes(ruleFile)) block(`Bundle ${bundleName} already lists ${ruleFile}.`);
  const next = [...rules, ruleFile];
  let rebuilt;
  if (bundle.rules !== undefined) rebuilt = { ...bundle, rules: next };
  else {
    // A bundle without the key gets it after workflows, else after skills, else last: the order the factory bundle uses.
    const keys = Object.keys(bundle);
    const after = keys.includes('workflows') ? 'workflows' : keys.includes('skills') ? 'skills' : keys[keys.length - 1];
    rebuilt = {};
    for (const key of keys) { rebuilt[key] = bundle[key]; if (key === after) rebuilt.rules = next; }
    if (!('rules' in rebuilt)) rebuilt.rules = next;
  }
  const written = `${JSON.stringify({ ...parsed, bundles: { ...bundles, [bundleName]: rebuilt } }, null, 2)}\n`;
  return { manifest, before: raw, after: Buffer.from(crlf ? written.replace(/\n/g, '\r\n') : written), rules: next };
}

// Reads at most `limit` bytes of a regular file through one descriptor, so a huge file is never read whole. Returns null for
// anything that is not a regular file (a link, a folder, a device), and undefined for a file that is gone.
function boundedRead(file, limit) {
  let entry;
  try { entry = fs.lstatSync(file); } catch (error) { if (error?.code === 'ENOENT') return undefined; throw error; }
  if (!entry.isFile()) return null;
  const descriptor = fs.openSync(file, 'r');
  try {
    if (!fs.fstatSync(descriptor).isFile()) return null;
    const buffer = Buffer.alloc(limit);
    let count = 0;
    while (count < limit) {
      const got = fs.readSync(descriptor, buffer, count, Math.min(READ_CHUNK, limit - count), count);
      if (got === 0) break;
      count += got;
    }
    return buffer.subarray(0, count);
  } finally { fs.closeSync(descriptor); }
}

// Rollback removes a file only while it is still the file this run wrote: a pathname alone could now name a replacement
// that someone else created. Gone is fine. A file that is not a regular file, or whose bytes are not the intended ones, is left in
// place and named. When this run's own write of the file threw, a prefix of the intended bytes is this run's truncated write and
// is removed too. At most the intended length plus one byte is read.
function removeIfMine(file, expected, replacedFault, writeThrew, stuck, left) {
  try {
    const found = boundedRead(file, expected.length + 1);
    if (found === undefined) return;
    const mine = !faults.has(replacedFault) && found !== null && (found.equals(expected) || (writeThrew && found.length < expected.length + 1 && expected.subarray(0, found.length).equals(found)));
    if (!mine) { left.push(file); return; }
    fs.rmSync(file, { force: true });
  } catch { stuck.push(file); }
}

// Test seam only (see `faults`): replaces the rule file, inside the test's own folder, just before the rollback inspects it.
function replaceRuleForTest(rulePath, body) {
  const root = process.env.AUTHOR_RULE_TEST_ROOT;
  const kind = ['directory', 'link', 'oversized', 'prefix'].find(name => faults.has(`rule-becomes-${name}`));
  if (!kind || !root) return;
  const inside = path.relative(path.resolve(root), rulePath);
  if (inside === '' || inside.startsWith('..') || path.isAbsolute(inside)) return;
  fs.rmSync(rulePath, { force: true });
  if (kind === 'directory') fs.mkdirSync(rulePath);
  else if (kind === 'link') {
    const target = path.join(path.resolve(root), 'link-target');
    fs.mkdirSync(target, { recursive: true });
    fs.writeFileSync(path.join(target, 'keep.txt'), 'keep\n');
    fs.symlinkSync(target, rulePath, 'junction');
  } else if (kind === 'oversized') fs.writeFileSync(rulePath, Buffer.concat([body, Buffer.alloc(2 * 1024 * 1024, 'x')]));
  else fs.writeFileSync(rulePath, body.subarray(0, 20));
}

function run(argument) {
  const job = readJob(argument);
  const ruleFile = `${job.name}.md`;
  const registry = path.join(realCheckout(job.checkout), 'registry');
  if (!fs.existsSync(registry)) block(`The checkout has no registry folder: ${registry}`);
  realDirectory(registry, 'The registry folder');
  const rulesDir = path.join(registry, 'rules');
  realDirectory(rulesDir, 'registry/rules');
  const clash = fs.readdirSync(rulesDir).find(entry => entry.toLowerCase() === ruleFile);
  if (clash) block(`registry/rules/${clash} already exists; it collides with ${ruleFile}. Repair it by hand or pick another name.`);
  const body = Buffer.from(/\n$/.test(job.content) ? job.content : `${job.content}\n`);
  const rulePath = path.join(rulesDir, ruleFile);
  const lock = path.join(registry, '.bundles.json.lock');
  const temporary = path.join(registry, `.bundles-${randomBytes(6).toString('hex')}.tmp`);
  // Only what this run created is ever removed: each flag is set just before the create, and cleared again when the create finds the file already there.
  // A *WriteThrew flag means this run's own write of that file threw, so a truncated file under that name is this run's.
  let lockHeld = false, ruleWritten = false, temporaryWritten = false, ruleWriteThrew = false, temporaryWriteThrew = false;
  let target, failure;
  // Creates the file exclusively. The partial faults (test seam) write the first half through this same call, then fail as a full disk would.
  const writeFile = (file, bytes, partialFault) => {
    if (!faults.has(partialFault)) { fs.writeFileSync(file, bytes, { flag: 'wx' }); return; }
    fs.writeFileSync(file, bytes.subarray(0, Math.floor(bytes.length / 2)), { flag: 'wx' });
    throw Object.assign(new Error('injected failure'), { code: 'EIO' });
  };
  try {
    // The flag is set as soon as the exclusive open succeeds, before the process id is written, so a failed write still removes the lock.
    let descriptor;
    try { descriptor = fs.openSync(lock, 'wx'); lockHeld = true; } catch (error) {
      if (error?.code === 'EEXIST') block(`Another run holds ${lock}; wait for it to finish, or delete the file if no run is active. Nothing was changed.`);
      throw error;
    }
    try {
      if (faults.has('fail-lock-write')) throw Object.assign(new Error('injected failure'), { code: 'EIO' });
      fs.writeSync(descriptor, `${process.pid}\n`);
    } finally { fs.closeSync(descriptor); }
    target = bundleFile(registry, job.bundle, ruleFile);
    try { ruleWritten = true; writeFile(rulePath, body, 'partial-rule-write'); } catch (error) { if (error?.code === 'EEXIST') ruleWritten = false; else ruleWriteThrew = true; throw error; }
    try { temporaryWritten = true; writeFile(temporary, target.after, 'partial-temp-write'); } catch (error) { if (error?.code === 'EEXIST') temporaryWritten = false; else temporaryWriteThrew = true; throw error; }
    // Test seam (see `faults` above), inert unless AUTHOR_RULE_TEST_FAULT is set: 'fail-before-rename' fails between the two writes
    // and 'manifest-changed' makes the re-read below count as different. Neither writes a byte.
    if (faults.has('fail-before-rename')) throw Object.assign(new Error('injected failure'), { code: 'EIO' });
    // The lock only keeps other runs of this helper out; an editor can still change the file, so compare the bytes once more.
    // The 'manifest-changed' fault treats the re-read bytes as different, in memory: it writes nothing.
    if (faults.has('manifest-changed') || !fs.readFileSync(target.manifest).equals(target.before)) block('registry/bundles.json changed while the helper was working; nothing was written. Run it again.');
    fs.renameSync(temporary, target.manifest);
    temporaryWritten = false;
  } catch (error) {
    // Zero orphaned files: a failure removes what this run created. Each removal has its own try, so one failing does not stop the next.
    const stuck = [], left = [];
    if (temporaryWritten) removeIfMine(temporary, target?.after, 'temp-replaced', temporaryWriteThrew, stuck, left);
    if (ruleWritten) {
      try { replaceRuleForTest(rulePath, body); } catch { /* test seam only */ }
      removeIfMine(rulePath, body, 'rule-replaced', ruleWriteThrew, stuck, left);
    }
    if (stuck.length || left.length) {
      let why = error instanceof Blocked ? error.message : `The helper could not finish (${error?.code ?? 'unexpected error'}).`;
      if (left.length) why += ` Left in place, because it is no longer the file this run wrote (other bytes, or not a regular file): ${left.join(', ')}. Check it and remove it by hand if it is not yours.`;
      if (stuck.length) why += ` It could not remove: ${stuck.join(', ')}. Remove ${stuck.length === 1 ? 'it' : 'them'} by hand.`;
      failure = new Blocked(why);
    } else failure = error;
  }
  // The lock goes last. A removal that fails is reported (a stale lock would otherwise only surface as the next run's refusal).
  let lockProblem;
  if (lockHeld) {
    try {
      if (faults.has('fail-lock-removal')) throw Object.assign(new Error('injected failure'), { code: 'EPERM' });
      fs.rmSync(lock, { force: true });
    } catch { lockProblem = `The lock file ${lock} could not be removed; delete it by hand before the next run.`; }
  }
  if (failure) {
    if (!lockProblem) throw failure;
    throw new Blocked(`${failure instanceof Blocked ? failure.message : `The helper could not finish (${failure?.code ?? 'unexpected error'}).`} ${lockProblem}`);
  }
  return {
    version: 1, status: 'written',
    rule: { path: `registry/rules/${ruleFile}`, bytes: body.length, sha256: hash(body) },
    bundle: { name: job.bundle, file: 'registry/bundles.json', rules: target.rules, sha256Before: hash(target.before), sha256After: hash(target.after) },
    validation: { status: 'unverified', reason: 'This helper runs no rule-check; run it on the written rule file.' },
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
