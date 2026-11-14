import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

// Installed, dependency-free record checking. Never execute a job/result command.
export const fail = message => { throw new Error(message); };
export const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
export const same = (a, b) => canonical(a) === canonical(b);
const folded = file => path.resolve(file).toLowerCase();
export const within = (parent, child) => {
  const relative = path.relative(folded(parent), folded(child));
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
};
export function absolute(value, label = 'Path') {
  if (typeof value !== 'string' || !path.isAbsolute(value)) fail(`${label} must be an absolute path.`);
  const file = path.resolve(value);
  let current = path.parse(file).root;
  for (const part of file.slice(current.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    if (fs.lstatSync(current, { throwIfNoEntry: false })?.isSymbolicLink()) fail(`${label}: linked ancestor needs a location decision: ${current}`);
  }
  return file;
}
export function relative(value) {
  if (typeof value !== 'string' || !value || /[<>:"\\|?*\x00-\x1f]/.test(value) || value.startsWith('/') || value.split('/').some(part => !part || part === '.' || part === '..' || /[. ]$/.test(part) || /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part))) fail(`Invalid relative path / traversal: ${value}`);
  return value;
}
export function fileBytes(value, label = 'File') {
  const file = absolute(value, label);
  if (!fs.statSync(file, { throwIfNoEntry: false })?.isFile()) fail(`${label} missing / unavailable: ${file}`);
  return fs.readFileSync(file);
}
export function pinned(pin, label = 'Input') {
  const bytes = fileBytes(pin.path, label);
  if (hash(bytes) !== pin.sha256 || (pin.bytes !== undefined && pin.bytes !== bytes.length)) fail(`${label} hash/length pin mismatch: ${pin.path}`);
  return bytes;
}
export function unique(values, label) {
  if (new Set(values.map(value => value.toLowerCase())).size !== values.length) fail(`${label}: duplicate / case-colliding paths or identifiers.`);
}
export function inventory(root, limits) {
  const result = new Map();
  let total = 0;
  const walk = (dir, prefix = '') => {
    if (!fs.existsSync(dir)) return;
    if (!fs.statSync(dir).isDirectory()) fail(`Draft root is not a directory: ${dir}`);
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const rel = relative(`${prefix}${entry.name}`);
      const file = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) fail(`Linked draft path: ${rel}`);
      if (entry.isDirectory()) walk(file, `${rel}/`);
      else if (entry.isFile()) {
        const size = fs.statSync(file).size;
        total += size;
        if (size > limits.maxFileBytes || total > limits.maxTotalBytes || result.size >= limits.maxFiles) fail('Draft file/byte budget exceeded.');
        if (!limits.formats.includes(path.extname(rel))) fail(`Draft format unavailable: ${rel}`);
        result.set(rel, fs.readFileSync(file));
      } else fail(`Unsupported draft file: ${rel}`);
    }
  };
  walk(absolute(root, 'Draft'));
  unique([...result.keys()], 'Draft inventory');
  return result;
}

// Only the bundled schemas' small JSON Schema vocabulary is supported. Unknown
// keywords fail closed; this is not a general external schema interpreter.
export function validateRecord(value, schema, label = 'record') {
  const supported = new Set(['$schema', 'title', 'description', 'type', 'const', 'enum', 'properties', 'required', 'additionalProperties', 'items', 'minItems', 'maxItems', 'minLength', 'pattern', 'minimum', 'maximum']);
  for (const key of Object.keys(schema)) if (!supported.has(key)) fail(`Unsupported schema keyword ${key}.`);
  if ('const' in schema && !same(value, schema.const)) fail(`${label}: expected constant ${JSON.stringify(schema.const)}.`);
  if (schema.enum && !schema.enum.some(item => same(value, item))) fail(`${label}: value is not in the allowed enum.`);
  const type = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value === 'number' && Number.isInteger(value) ? 'integer' : typeof value;
  if (schema.type && ![].concat(schema.type).includes(type)) fail(`${label}: expected ${schema.type}, received ${type}.`);
  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) fail(`${label}: required nonempty string.`);
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) fail(`${label}: invalid string pattern.`);
  }
  if (typeof value === 'number' && (value < (schema.minimum ?? -Infinity) || value > (schema.maximum ?? Infinity))) fail(`${label}: numeric budget outside allowed range.`);
  if (Array.isArray(value)) {
    if (value.length < (schema.minItems ?? 0) || value.length > (schema.maxItems ?? Infinity)) fail(`${label}: array budget outside allowed range.`);
    value.forEach((item, index) => validateRecord(item, schema.items, `${label}[${index}]`));
  } else if (value !== null && typeof value === 'object') {
    for (const key of schema.required ?? []) if (!Object.hasOwn(value, key)) fail(`${label}: missing required ${key}.`);
    for (const [key, child] of Object.entries(value)) {
      if (!Object.hasOwn(schema.properties ?? {}, key)) fail(`${label}: unknown / additional property ${key}.`);
      validateRecord(child, schema.properties[key], `${label}.${key}`);
    }
  }
}
export function schemaFor(name) {
  return JSON.parse(fs.readFileSync(new URL(`../assets/${name}.schema.json`, import.meta.url), 'utf8'));
}
export function jsonFile(file, label) {
  const bytes = fileBytes(file, label);
  if (bytes.length > 4194304) fail(`${label}: JSON byte budget exceeded.`);
  return JSON.parse(bytes.toString('utf8'));
}

export function checkJob(job, { postflight = false } = {}) {
  validateRecord(job, schemaFor('job'), 'job');
  const { roots, source, constraints, budget } = job;
  for (const [key, value] of Object.entries({ workspace: roots.workspace, draft: roots.draft, evidence: roots.evidence, checkout: source.checkout, registry: source.registry })) absolute(value, key);
  if (!fs.statSync(source.checkout, { throwIfNoEntry: false })?.isDirectory() || !fs.statSync(source.registry, { throwIfNoEntry: false })?.isDirectory()) fail('Selected source checkout/registry is unavailable.');
  if (!within(roots.workspace, roots.draft) || !within(roots.workspace, roots.evidence)) fail('Draft/evidence must be within the selected workspace.');
  const writable = [roots.draft, roots.evidence];
  const protectedRoots = [source.checkout, source.registry, ...roots.managed, ...roots.protected].map(root => absolute(root, 'Protected root'));
  for (const root of writable) for (const other of [...writable.filter(item => item !== root), ...protectedRoots]) if (within(root, other) || within(other, root)) fail(`Writable/source/managed/protected roots overlap: ${root} / ${other}`);
  if (roots.draft === roots.evidence) fail('Draft and evidence roots overlap.');
  // A fixed, read-only Git query. Never use an executable, argv, shell or env from the job.
  const head = spawnSync('git', ['-C', source.checkout, 'rev-parse', '--verify', 'HEAD'], { encoding: 'utf8', timeout: 10000, windowsHide: true });
  if (head.status !== 0 || head.stdout.trim() !== source.head) fail('Selected checkout HEAD baseline is unavailable or changed.');
  unique(job.inputs.map(input => input.path), 'Input pins');
  const requiredKinds = ['guide', 'snapshot', 'profile', 'tool-policy', 'core', 'contract', 'loading', 'guard', 'validator', 'runtime'];
  for (const kind of requiredKinds) if (!job.inputs.some(input => input.kind === kind)) fail(`Missing required ${kind} input pin.`);
  for (const input of job.inputs) {
    if (input.status !== 'clear') fail(`Held input blocks realization: ${input.kind} ${input.path}`);
    if (within(roots.draft, input.path)) fail(`Input pin overlaps writable draft: ${input.path}`);
    pinned(input, `Required ${input.kind}`);
  }
  const pinAt = (kind, file) => job.inputs.some(input => input.kind === kind && folded(input.path) === folded(file));
  const nativeGuide = path.join(source.checkout, 'host-library/claude/guide/agent.md');
  for (const [kind, file] of [
    ['guide', nativeGuide], ['profile', path.join(source.registry, 'hosts/claude/profile.json')],
    ['tool-policy', path.join(source.registry, 'hosts/claude/tool-policy.json')],
    ['core', path.join(source.registry, `core/${job.artifact.definition}.core.md`)],
    ['contract', path.join(source.registry, `core/${job.artifact.definition}.contract.json`)],
    ['validator', path.join(source.checkout, 'dist/cli.js')],
  ]) if (!pinAt(kind, file)) fail(`Required ${kind} input must pin its selected source path: ${file}`);
  const library = path.join(source.checkout, 'host-library/claude');
  const lockPath = path.join(library, 'library.lock.json');
  if (!pinAt('support', lockPath)) fail('Missing required pinned host library lock support input.');
  const lock = jsonFile(lockPath, 'Host library lock');
  for (const snapshot of job.inputs.filter(input => input.kind === 'snapshot')) {
    if (!within(library, snapshot.path)) fail('Snapshot is outside the selected target library.');
    const rel = path.relative(library, snapshot.path).split(path.sep).join('/');
    if (lock.files?.[rel]?.sha256 !== `sha256:${snapshot.sha256}`) fail(`Snapshot hash disagrees with the pinned library lock: ${rel}`);
  }
  for (const guide of job.inputs.filter(input => input.kind === 'guide')) {
    const text = fileBytes(guide.path, 'Guide').toString('utf8');
    for (const match of text.matchAll(/\]\((\.\.\/pages\/[^)#\s]+)(?:#[^)]*)?\)/g)) {
      const file = path.resolve(path.dirname(guide.path), match[1]);
      if (!pinAt('snapshot', file)) fail(`Guide citation requires a pinned snapshot input: ${match[1]}`);
    }
  }
  if (job.intent === 'upstream' && !pinAt('template', path.join(source.checkout, '.github/PULL_REQUEST_TEMPLATE/artifact-contribution.md'))) fail('Upstream intent requires the selected checkout artifact-contribution template pin (base dev).');
  unique(job.preserved.map(pin => pin.path), 'Preserved pins');
  for (const pin of job.preserved) {
    if (within(roots.draft, pin.path)) fail('Preserved external pin overlaps draft; use complete baseline for untouched draft files.');
    pinned(pin, 'Preserved input');
  }
  const allChanges = Object.values(job.allowedChanges).flat();
  allChanges.forEach(relative); unique(allChanges, 'Allowed changes overlap');
  job.artifact.paths.forEach(relative); unique(job.artifact.paths, 'Artifact paths');
  for (const rel of job.artifact.paths) if (!/^hosts\/claude\/agents\/[a-z0-9-]+\.md$/.test(rel)) fail(`Unavailable artifact path / type: ${rel}`);
  const baseline = new Map();
  unique(job.baseline.map(item => item.path), 'Baseline');
  for (const item of job.baseline) {
    relative(item.path);
    if (!within(roots.evidence, item.snapshot)) fail('Baseline snapshot must be within fixed evidence root.');
    baseline.set(item.path, pinned({ path: item.snapshot, sha256: item.sha256, bytes: item.bytes }, 'Immutable baseline snapshot'));
  }
  if (job.operation === 'create' && baseline.size) fail('Create requires empty baseline.');
  if (job.operation === 'update' && !baseline.size) fail('Update requires a complete nonempty baseline.');
  for (const rel of job.allowedChanges.create) if (baseline.has(rel)) fail(`Create path already in baseline: ${rel}`);
  for (const rel of [...job.allowedChanges.update, ...job.allowedChanges.delete]) if (!baseline.has(rel)) fail(`Update/delete path missing from baseline: ${rel}`);
  const current = inventory(roots.draft, constraints);
  if (!postflight && (current.size !== baseline.size || [...baseline].some(([rel, bytes]) => !current.get(rel)?.equals(bytes)))) fail('Create/update draft baseline inventory has changed or is incomplete.');
  unique(job.checks.map(check => check.id), 'Check ids');
  unique(job.acceptance.map(item => item.id), 'Acceptance ids');
  if (job.checks.length > budget.maxChecks || job.checks.reduce((total, check) => total + check.timeoutSeconds, 0) > budget.maxSeconds) fail('Offline checks exceed fixed budget.');
  for (const check of job.checks) {
    if (!pinAt('runtime', absolute(check.executable, 'Check executable'))) fail(`Check runtime is not pinned: ${check.id}`);
    absolute(check.cwd, 'Check cwd');
    if (!within(source.checkout, check.cwd)) fail('Check cwd must be within selected validation checkout.');
  }
  for (const item of job.acceptance) for (const id of item.requiredChecks) if (!job.checks.some(check => check.id === id && check.required)) fail(`Acceptance requires unavailable required check ${id}.`);
  unique(job.artifact.requiredSkills, 'Required preloads');
  const expected = [path.join(source.checkout, 'dist/cli.js'), 'factory-check', '--registry', source.registry, '--definition', job.artifact.definition, '--host', 'claude', '--artifact', path.join(roots.draft, job.artifact.paths[0]), '--loading', job.artifact.loading, '--required-skills', JSON.stringify(job.artifact.requiredSkills)];
  if (job.artifact.paths.length !== 1 || !job.checks.some(check => check.required && same(check.argv, expected))) fail('Required native-validation checker command is missing or changed.');
  for (const fixed of constraints.fixedValues) relative(fixed.path);
  return { digest: hash(canonical(job)), baseline, current };
}

export function argumentsFor(argv, allowed) {
  const result = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    if (!allowed.includes(key) || result[key] !== undefined || !argv[index + 1]) fail(`Usage: expected ${allowed.join(' ')} with absolute file paths.`);
    result[key] = argv[index + 1];
  }
  for (const key of allowed) if (!result[key]) fail(`Usage: missing ${key}.`);
  return result;
}
export function runCli(action) {
  try { process.stdout.write(`${JSON.stringify({ ok: true, ...action(), kind: 'deterministic', quality: 'pending', live: 'unverified', executionProof: 'unverified' }, null, 2)}\n`); }
  catch (error) {
    process.stdout.write(`${JSON.stringify({ ok: false, findings: [error instanceof Error ? error.message : String(error)], kind: 'deterministic', quality: 'pending', live: 'unverified', executionProof: 'unverified' })}\n`);
    process.exitCode = 1;
  }
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  if (process.argv.slice(2).join(' ') === '--help') process.stdout.write('Usage: node check-job.mjs --job <absolute-job.json>\nRead-only preflight. Does not run supplied commands or a Host.\n');
  else runCli(() => {
    const args = argumentsFor(process.argv.slice(2), ['--job']);
    const result = checkJob(jsonFile(args['--job'], 'Job record'));
    return { digest: result.digest, findings: [] };
  });
}
