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
  const crlf = raw.includes('\r\n');
  const text = raw.toString('utf8').replace(/\r\n/g, '\n');
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
  const target = bundleFile(registry, job.bundle, ruleFile);
  const body = Buffer.from(/\n$/.test(job.content) ? job.content : `${job.content}\n`);
  const rulePath = path.join(rulesDir, ruleFile);
  const temporary = path.join(registry, `.bundles-${randomBytes(6).toString('hex')}.tmp`);
  let ruleWritten = false;
  try {
    fs.writeFileSync(rulePath, body, { flag: 'wx' });
    ruleWritten = true;
    fs.writeFileSync(temporary, target.after, { flag: 'wx' });
    fs.renameSync(temporary, target.manifest);
  } catch (error) {
    // Zero orphaned files: a failure after the first write removes what this run created.
    fs.rmSync(temporary, { force: true });
    if (ruleWritten) fs.rmSync(rulePath, { force: true });
    throw error;
  }
  return {
    version: 1, status: 'written',
    rule: { path: `registry/rules/${ruleFile}`, bytes: body.length, sha256: hash(body) },
    bundle: { name: job.bundle, file: 'registry/bundles.json', rules: target.rules, sha256Before: hash(target.before), sha256After: hash(target.after) },
    validation: { status: 'unverified', reason: 'This helper runs no rule-check; run it on the written rule file.' },
    externalActions: [],
  };
}

try {
  process.stdout.write(`${JSON.stringify(run(process.argv[2]), null, 2)}\n`);
} catch (error) {
  const reason = error instanceof Blocked ? error.message : `The helper could not finish (${error?.code ?? 'unexpected error'}).`;
  process.stderr.write(`${JSON.stringify({ status: 'blocked', reason })}\n`);
  process.exitCode = 1;
}
