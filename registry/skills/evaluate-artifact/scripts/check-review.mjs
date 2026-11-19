#!/usr/bin/env node
import { parseArgs } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

// Caller-operated consistency checks only. No command in a job/result is executed.
const fail = message => { throw new Error(message); };
// A refusal that also carries a list of details (the refused citations), printed beside its reason.
class Refusal extends Error { constructor(message, details) { super(message); this.details = details; } }
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const canonical = value => Array.isArray(value) ? `[${value.map(canonical).join(',')}]`
  : value !== null && typeof value === 'object' ? `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`
    : JSON.stringify(value);
const same = (a, b) => canonical(a) === canonical(b);
// String comparisons fold case on every platform, as before P27. The physical comparison folds case only on Windows: the native real
// path spells an existing folder as the volume stores it, so two spellings of one folder become one string where the volume ignores
// case, and stay two (another folder) where it is case-sensitive. A grant needs both, so on a case-sensitive volume it needs exact case.
const foldName = name => process.platform === 'win32' ? name.toLowerCase() : name;
const folded = file => path.resolve(file).toLowerCase();
const exact = file => foldName(path.resolve(file));
const relWithin = (parent, child) => {
  const rel = path.relative(parent, child);
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel));
};
const within = (parent, child) => relWithin(folded(parent), folded(child));
const withinExact = (parent, child) => relWithin(exact(parent), exact(child));
const sameExact = (a, b) => exact(a) === exact(b);
const sameString = (a, b) => folded(a) === folded(b);
// The physical spelling of a path, the rule of the return checkers (copied on purpose, never imported): the deepest existing ancestor is
// resolved by the platform (a short name, another case on an ignoring volume, both become the one real name) and the absent rest is
// appended. Only ENOENT and ENOTDIR walk up to the parent; any other error is refused with the path and the code, so a root check never
// silently falls back to comparing strings. Links are refused on the path as given before a path reaches this function.
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
// Every string comparison stays; a refusal also holds when the paths relate physically, and a grant needs both.
const physicallyWithin = (parent, child) => withinExact(physical(parent), physical(child));
const physicallySame = (a, b) => sameExact(physical(a), physical(b));
const withinBoth = (parent, child) => within(parent, child) && physicallyWithin(parent, child);
const sameBoth = (a, b) => sameString(a, b) && physicallySame(a, b);
const overlaps = (a, b) => [[a, b], [physical(a), physical(b)]].some(([x, y]) => within(x, y) || within(y, x));
const HOST_DIRS = ['.agents', '.claude', '.cline', '.cursor', '.codex', '.opencode', '.gemini'];
/** A managed Host folder in the root as given or in its physical spelling. */
const managedHostPath = root => [root, physical(root)].some(spelling => spelling.split(/[\\/]/).some(part => HOST_DIRS.includes(part.toLowerCase())));
const unique = (values, label) => { if (new Set(values.map(value => value.toLowerCase())).size !== values.length) fail(`${label}: duplicate/case-colliding values.`); };
const skillRoot = fileURLToPath(new URL('../', import.meta.url));
const scriptFile = fileURLToPath(import.meta.url);
const limits = { envelope: 262144, executable: 134217728 };
// The citation limits; registry texts and tests read these numbers from here, so they state what the check enforces.
const CITATION_LIMITS = { maxLines: 5, maxQuoteLines: 5, maxQuoteBytes: 1024 };
// A refusal lists this many bad citations and says how many more there are.
const CITATION_LIST_CAP = 10;
// Text the result controls (a path, an id, the start of the file) is echoed in a refusal, and the coordinator quotes that refusal into the next
// evaluator's prompt. So it is echoed short and on one line: the characters that break a line or hide in one are spelled out, and a value over
// ECHO_MAX characters is cut with its original length.
const ECHO_MAX = 120;
const spelled = value => value.replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029\ufeff]/g,
  char => char === '\n' ? '\\n' : char === '\r' ? '\\r' : char === '\t' ? '\\t' : `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`);
const echo = value => {
  const original = String(value), flat = spelled(original);
  return flat.length > ECHO_MAX ? `${flat.slice(0, ECHO_MAX)}... (${original.length} characters)` : flat;
};

function absolute(value, label) {
  if (typeof value !== 'string' || !path.isAbsolute(value) || value.includes('\0') || value.split(/[\\/]/).some(part => part === '.' || part === '..')) fail(`${label}: expected absolute path without traversal aliases.`);
  const file = path.resolve(value);
  let current = path.parse(file).root;
  for (const part of file.slice(current.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    if (fs.lstatSync(current, { throwIfNoEntry: false })?.isSymbolicLink()) fail(`${label}: linked path ${current}.`);
  }
  return file;
}
function relative(value) {
  if (typeof value !== 'string' || !value || /[<>:"\\|?*\x00-\x1f]/.test(value) || value.startsWith('/')
    || value.split('/').some(part => !part || part === '.' || part === '..' || /[. ]$/.test(part) || /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part))) fail(`Invalid contained relative path: ${value}.`);
  return value;
}
function bytesAt(value, cap, label) {
  const file = absolute(value, label);
  const stat = fs.statSync(file, { throwIfNoEntry: false });
  if (!stat?.isFile()) fail(`${label}: missing ordinary file ${file}.`);
  if (stat.size > cap) fail(`${label}: byte budget exceeded.`);
  const fd = fs.openSync(file, 'r');
  try {
    const buffer = Buffer.alloc(Math.min(cap, stat.size) + 1);
    let offset = 0;
    while (offset < buffer.length) {
      const read = fs.readSync(fd, buffer, offset, buffer.length - offset, null);
      if (!read) break;
      offset += read;
    }
    if (offset > cap || offset !== stat.size) fail(`${label}: file changed length during bounded read.`);
    return buffer.subarray(0, offset);
  } finally { fs.closeSync(fd); }
}
const decode = bytes => new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
const parseJson = (bytes, label) => {
  try { return JSON.parse(decode(bytes)); }
  catch (error) { return fail(`${label}: invalid UTF-8/JSON: ${error.message}`); }
};
const jsonAt = (file, cap, label) => parseJson(bytesAt(file, cap, label), label);
const pinOf = (file, bytes) => ({ path: absolute(file, 'Pin'), bytes: bytes.length, sha256: hash(bytes) });

// Deliberately limited to the bundled schemas' vocabulary; no external resolution.
const schemaVocabulary = new Set(['$schema', 'title', 'description', 'type', 'const', 'enum', 'properties', 'required', 'additionalProperties', 'items', 'minItems', 'maxItems', 'minLength', 'maxLength', 'pattern', 'minimum', 'maximum']);
function auditSchema(schema) {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) fail('Required executable schema must be an object.');
  for (const key of Object.keys(schema)) if (!schemaVocabulary.has(key)) fail(`Unsupported schema keyword ${key}.`);
  for (const child of Object.values(schema.properties ?? {})) auditSchema(child);
  if (schema.items) auditSchema(schema.items);
}
function validate(value, schema, label = 'job') {
  if ('const' in schema && !same(value, schema.const)) fail(`${label}: expected constant ${JSON.stringify(schema.const)}.`);
  if (schema.enum && !schema.enum.some(item => same(item, value))) fail(`${label}: unsupported value.`);
  const type = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value === 'number' && Number.isInteger(value) ? 'integer' : typeof value;
  if (schema.type && ![].concat(schema.type).includes(type)) fail(`${label}: expected ${schema.type}.`);
  if (typeof value === 'number' && (!Number.isFinite(value) || value < (schema.minimum ?? -Infinity) || value > (schema.maximum ?? Infinity))) fail(`${label}: numeric bound exceeded.`);
  if (typeof value === 'string' && (value.length < (schema.minLength ?? 0) || value.length > (schema.maxLength ?? Infinity)
    || (schema.pattern && !new RegExp(schema.pattern).test(value)))) fail(`${label}: invalid/bounded string.`);
  if (Array.isArray(value)) {
    if (value.length < (schema.minItems ?? 0) || value.length > (schema.maxItems ?? Infinity)) fail(`${label}: array bound exceeded.`);
    value.forEach((item, index) => validate(item, schema.items, `${label}[${index}]`));
  } else if (value !== null && typeof value === 'object') {
    for (const key of schema.required ?? []) if (!Object.hasOwn(value, key)) fail(`${label}: missing ${key}.`);
    for (const [key, child] of Object.entries(value)) {
      if (!Object.hasOwn(schema.properties ?? {}, key)) fail(`${label}: unknown property ${key}.`);
      validate(child, schema.properties[key], `${label}.${key}`);
    }
  }
}
function snapshot(root, budget) {
  const inventory = [];
  let total = 0, directories = 0;
  const walk = (dir, prefix = '') => {
    if (++directories > 128) fail('Candidate directory budget exceeded.');
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const rel = relative(prefix + entry.name), file = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) fail(`Linked candidate path: ${rel}.`);
      if (entry.isDirectory()) walk(file, `${rel}/`);
      else if (entry.isFile()) {
        if (inventory.length >= budget.maxCandidateFiles) fail('Candidate file budget exceeded.');
        const bytes = bytesAt(file, budget.maxCandidateFileBytes, 'Candidate');
        decode(bytes);
        total += bytes.length;
        if (total > budget.maxCandidateBytes) fail('Candidate total-byte budget exceeded.');
        inventory.push({ path: rel, kind: 'file', bytes: bytes.length, sha256: hash(bytes) });
      } else fail(`Unsupported candidate path: ${rel}.`);
    }
  };
  const dir = absolute(root, 'Candidate root');
  if (!fs.statSync(dir, { throwIfNoEntry: false })?.isDirectory()) fail('Candidate root unavailable.');
  walk(dir);
  unique(inventory.map(item => item.path), 'Candidate');
  return inventory.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
}
function checkJob(jobFile) {
  const jobBytes = bytesAt(jobFile, limits.envelope, 'Job');
  const job = parseJson(jobBytes, 'Job');
  const schemas = ['job', 'result'].map(name => {
    const file = path.join(skillRoot, `assets/${name}.schema.json`);
    const bytes = bytesAt(file, limits.envelope, `${name} schema`);
    const schema = parseJson(bytes, `${name} schema`);
    auditSchema(schema);
    return { file, bytes, schema };
  });
  validate(job, schemas[0].schema);
  const { roots, budget } = job;
  const pins = new Map();
  const pinned = (pin, cap, label) => {
    const bytes = bytesAt(pin.path, cap, label);
    if (pin.bytes !== bytes.length || pin.sha256 !== hash(bytes)) fail(`${label}: hash/length pin mismatch ${pin.path}.`);
    pins.set(folded(pin.path), { pin, cap, label });
    return bytes;
  };
  for (const [name, root] of Object.entries({ candidate: roots.candidate, review: roots.review, checkout: job.source.checkout, registry: job.source.registry })) {
    absolute(root, name);
    if (!fs.statSync(root, { throwIfNoEntry: false })?.isDirectory()) fail(`${name}: required directory unavailable.`);
  }
  const readRoots = roots.read.map(root => absolute(root, 'Read root'));
  for (const root of readRoots) if (!fs.existsSync(root)) fail(`Read root unavailable: ${root}.`);
  for (const root of [roots.candidate, job.source.checkout, job.source.registry, ...readRoots, ...roots.managed, ...roots.protected]) {
    if (overlaps(roots.review, absolute(root, 'Protected/read root'))) fail('Review output root overlaps candidate/source/read/managed/protected inputs.');
  }
  if (managedHostPath(roots.review)) fail('Review output root is a managed Host path.');
  if (!sameBoth(jobFile, path.join(roots.review, 'job.json'))) fail('Job must be the caller-owned review-root job.json.');
  const host = job.authoringHost;
  if ((host.observedVersion === null) === (host.unverifiedReason === null)) fail('Authoring Host needs an observed version or an explicit unverified reason.');
  if (job.subject.kind === 'claude-agent' && !job.subject.target) fail('Claude agent review requires its explicit target context.');
  const inventory = snapshot(roots.candidate, budget);
  const declared = job.candidate.files.map(({ role: _role, ...pin }) => ({ ...pin, path: relative(pin.path) }))
    .sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  if (!same(inventory, declared)) fail('Candidate inventory/hash mismatch: missing, changed or unreported files.');
  unique(job.subject.paths.map(relative), 'Subject paths');
  if (!same([...job.subject.paths].sort(), job.candidate.files.filter(item => item.role === 'subject').map(item => item.path).sort())) fail('Subject coverage differs from the fixed candidate role inventory.');
  const candidateDigest = hash(canonical(inventory));
  if (job.inputs.length > budget.maxEvidenceFiles) fail('Evidence file budget exceeded.');
  unique(job.inputs.map(input => input.id), 'Input IDs');
  unique(job.inputs.map(input => folded(input.path)), 'Input paths');
  let evidenceBytes = 0;
  const unavailable = [];
  for (const input of job.inputs) {
    absolute(input.path, 'Input');
    if (!readRoots.some(root => withinBoth(root, input.path))) fail(`Input outside declared read roots: ${input.id}.`);
    if (input.status !== 'clear') {
      if (input.required) fail(`Required ${input.status} input blocks review: ${input.id}.`);
      unavailable.push({ id: input.id, status: input.status, required: false });
      continue;
    }
    const bytes = pinned(input, budget.maxEvidenceFileBytes, `Input ${input.id}`);
    decode(bytes);
    evidenceBytes += bytes.length;
    if (evidenceBytes > budget.maxEvidenceBytes) fail('Evidence total-byte budget exceeded.');
  }
  // Each "this is the required file" test: the string first (as before), then the link refusal of the path as given (the one the pin
  // read below gives, with its label), then the physical identity.
  const runtimeFile = fs.realpathSync(process.execPath);
  if (Number(process.versions.node.split('.')[0]) < 24 || !sameString(job.runtime.executable.path, runtimeFile)) fail('Runtime must be this Node >=24 executable, selected by its physical path.');
  absolute(job.runtime.executable.path, 'Runtime executable');
  if (!physicallySame(job.runtime.executable.path, runtimeFile)) fail('Runtime must be this Node >=24 executable, selected by its physical path.');
  pinned(job.runtime.executable, budget.maxExecutableBytes, 'Runtime executable');
  if (!sameString(job.runtime.checker.path, scriptFile)) fail('Checker must be this actually installed script.');
  absolute(job.runtime.checker.path, 'Installed checker');
  if (!physicallySame(job.runtime.checker.path, scriptFile)) fail('Checker must be this actually installed script.');
  pinned(job.runtime.checker, budget.maxEvidenceFileBytes, 'Installed checker');
  // Every input path passed the link refusal above, so the physical identity is compared together with the string.
  const hasPin = (file, kind) => job.inputs.some(input => input.required && input.status === 'clear' && sameBoth(input.path, file) && (!kind || input.kind === kind));
  const receiptFile = path.join(skillRoot, 'assets/claude-binding.json');
  if (!hasPin(receiptFile, 'loading') || !hasPin(path.join(skillRoot, 'SKILL.md'), 'loading')) fail('Missing required evaluator loading entry/receipt pins.');
  const binding = jsonAt(receiptFile, limits.envelope, 'Installed binding');
  if (binding.skill !== 'evaluate-artifact' || binding.roles?.length !== 1 || binding.roles[0].name !== 'factory-evaluator'
    || binding.roles[0].loading !== 'subagent' || binding.roles[0].guard !== 'read-only') fail('Required evaluator loading mechanism differs.');
  const workspace = path.resolve(skillRoot, '../../..');
  for (const rel of binding.requiredSupport ?? []) if (!hasPin(path.join(skillRoot, relative(rel)), 'loading')) fail(`Missing required loading support pin: ${rel}.`);
  for (const rel of [...(binding.references ?? []).map(ref => ref.installed), ...binding.roles.map(role => role.installed)]) {
    if (!hasPin(path.join(workspace, relative(rel)), 'loading')) fail(`Missing required installed loading pin: ${rel}.`);
  }
  if (!hasPin(path.join(workspace, '.claude/hooks/agents-united-readonly-guard.js'), 'guard')) fail('Missing required read-only guard pin.');
  for (const kind of ['profile', 'tool-policy', 'library-lock', 'validator', 'provenance']) {
    if (!job.inputs.some(input => input.kind === kind && input.required && input.status === 'clear')) fail(`Missing required ${kind} evidence.`);
  }
  for (const [kind, file] of [
    ['profile', path.join(job.source.registry, 'hosts/claude/profile.json')],
    ['tool-policy', path.join(job.source.registry, 'hosts/claude/tool-policy.json')],
    ['library-lock', path.join(job.source.checkout, 'host-library/claude/library.lock.json')],
  ]) if (!hasPin(file, kind)) fail(`Missing required ${kind} pin from the selected registry/checkout.`);
  for (const file of ['profile.json', 'tool-policy.json']) {
    if (jsonAt(path.join(job.source.registry, 'hosts/claude', file), budget.maxEvidenceFileBytes, 'Host prerequisite').host !== 'claude') fail('Selected prerequisite belongs to a different Host.');
  }
  const { subject } = job;
  if (subject.kind === 'skill' && subject.definition !== null) fail('A Skill-only review has no shared definition.');
  if (subject.kind !== 'skill' && !subject.definition) fail('Shared/native review requires its exact shared definition stem.');
  if (subject.kind === 'shared-pair') {
    if (subject.identity !== subject.definition || subject.target !== null) fail('Shared definition must match the host-neutral pair identity.');
    if (!same([...subject.paths].sort(), [`core/${subject.definition}.contract.json`, `core/${subject.definition}.core.md`])) fail('Shared definition pair paths are incomplete or substituted.');
  }
  if (subject.target && ((subject.target.observedVersion === null) === (subject.target.unverifiedReason === null))) fail('Target Host needs an observed version or an explicit unverified reason.');
  if (subject.kind === 'claude-agent') for (const [kind, suffix] of [['shared-core', 'core.md'], ['shared-contract', 'contract.json']]) {
    if (!hasPin(path.join(job.source.registry, 'core', `${subject.definition}.${suffix}`), kind)) fail(`Missing required ${kind} pin for definition ${subject.definition}.`);
  }
  const pages = { agent: 'agent/sub-agents.md', skill: 'skill/skills.md', hook: 'hook/hooks.md', tools: 'tools/tools-reference.md', orchestration: 'orchestration/workflows.md' };
  const guideKinds = subject.target !== null ? ['agent', 'skill', 'hook', 'tools', 'orchestration'] : subject.kind === 'skill' ? ['skill'] : [];
  const library = path.join(job.source.checkout, 'host-library/claude');
  const libraryLock = jsonAt(path.join(library, 'library.lock.json'), budget.maxEvidenceFileBytes, 'Library lock');
  if (libraryLock.host !== 'claude') fail('Selected library lock belongs to a different Host.');
  for (const kind of guideKinds) {
    if (!hasPin(path.join(library, 'guide', `${kind}.md`), 'guide')) fail(`Missing required guide pin: ${kind}.`);
    const rel = `pages/${pages[kind]}`, file = path.join(library, rel);
    if (!hasPin(file, 'snapshot')) fail(`Missing required snapshot pin: ${rel}.`);
    const pin = job.inputs.find(input => folded(input.path) === folded(file));
    if (libraryLock.files?.[rel]?.sha256 !== `sha256:${pin.sha256}`) fail(`Selected snapshot differs from its library lock: ${rel}.`);
  }
  for (const file of ['assets/job.schema.json', 'assets/result.schema.json', 'assets/rubric.json']) if (!hasPin(path.join(skillRoot, file), 'loading')) fail(`Missing executable resource pin: ${file}.`);
  for (const schema of schemas) {
    const pin = job.inputs.find(input => folded(input.path) === folded(schema.file));
    if (pin.sha256 !== hash(schema.bytes) || pin.bytes !== schema.bytes.length) fail('Executable schema changed between use and pin validation.');
  }
  const rubricFile = path.join(skillRoot, 'assets/rubric.json');
  if (!sameString(job.rubric.path, rubricFile)) fail('Review rubric must be this bundled rubric.');
  absolute(job.rubric.path, 'Rubric');
  if (!physicallySame(job.rubric.path, rubricFile)) fail('Review rubric must be this bundled rubric.');
  const rubric = JSON.parse(decode(pinned(job.rubric, budget.maxEvidenceFileBytes, 'Rubric')));
  if (rubric.version !== job.rubric.version || !same([...job.rubric.criteria.map(item => item.id)].sort(), rubric.criteria.map(item => item.id).sort())) fail('Fixed rubric criterion coverage mismatch.');
  const needsShared = job.subject.kind !== 'skill';
  const needsHost = job.subject.target !== null;
  for (const criterion of job.rubric.criteria) {
    const applies = criterion.id === 'shared-semantics' ? needsShared : criterion.id === 'host-fit' ? needsHost : true;
    if (criterion.applicable !== applies || criterion.required !== applies) fail(`Required rubric applicability mismatch: ${criterion.id}.`);
  }
  unique(job.acceptance.map(item => item.id), 'Acceptance IDs');
  unique(job.fixedValues.map(item => item.name), 'Fixed value names');
  unique(job.checks.map(check => check.id), 'Check IDs');
  if (job.checks.length > budget.maxChecks) fail('Check count budget exceeded.');
  let logBytes = 0;
  const checks = job.checks.map(check => {
    if (check.candidateDigest !== candidateDigest) fail(`Check candidate digest mismatch: ${check.id}.`);
    absolute(check.command.cwd, 'Check cwd');
    const executable = absolute(check.command.executable.path, 'Check executable');
    if (!sameBoth(executable, job.runtime.executable.path) && !readRoots.some(root => withinBoth(root, executable))) fail('Check executable is outside the declared read scope.');
    if (check.status === 'passed' || check.status === 'failed') {
      if (check.command.executable.bytes === null || check.command.executable.sha256 === null) fail('Executed check needs an actual executable length/hash pin.');
      pinned(check.command.executable, budget.maxExecutableBytes, 'Check executable declaration');
      if ((check.status === 'passed') !== (check.exit === 0) || check.exit === null || !check.raw || !check.receipt) fail(`Check status/exit/receipt contradiction: ${check.id}.`);
      const outputFile = suffix => path.join(roots.review, 'checks', `${check.id}.${suffix}`);
      for (const [pin, suffix] of [[check.raw, 'raw.txt'], [check.receipt, 'receipt.json']]) {
        if (!sameString(pin.path, outputFile(suffix))) fail(`Check output path substitution: ${check.id}.`);
      }
      // The physical identity of each output follows the link refusal of its own pin read, so the existing refusals keep their order.
      absolute(check.raw.path, 'Raw check log');
      if (!physicallySame(check.raw.path, outputFile('raw.txt'))) fail(`Check output path substitution: ${check.id}.`);
      const raw = pinned(check.raw, budget.maxLogBytes, 'Raw check log');
      logBytes += raw.length;
      if (logBytes > budget.maxLogBytes) fail('Raw check log total-byte budget exceeded.');
      absolute(check.receipt.path, 'Check receipt');
      if (!physicallySame(check.receipt.path, outputFile('receipt.json'))) fail(`Check output path substitution: ${check.id}.`);
      const actual = JSON.parse(decode(pinned(check.receipt, limits.envelope, 'Check receipt')));
      const expected = { version: 1, id: check.id, kind: 'deterministic', command: check.command, candidateDigest, status: check.status, exit: check.exit, raw: check.raw };
      if (!same(actual, expected)) fail(`Check receipt substitution/inconsistency: ${check.id}.`);
    } else if (check.exit !== null || check.raw !== null || check.receipt !== null) fail(`Unperformed check has execution claims: ${check.id}.`);
    if (check.status !== 'passed') unavailable.push({ id: check.id, status: check.status, required: check.required });
    return { id: check.id, status: check.status, exit: check.exit, required: check.required };
  });
  for (const id of job.provenance.evidence) if (!job.inputs.some(input => input.id === id && input.status === 'clear')) fail(`Missing provenance evidence pin: ${id}.`);
  if (job.provenance.disposition !== 'original' && !job.provenance.upstream) fail(`${job.provenance.disposition}: pinned source, licence and comparison evidence is required.`);
  if (job.provenance.upstream) {
    const upstream = job.provenance.upstream;
    for (const id of [upstream.sourceId, upstream.licenceId, upstream.comparisonId, ...upstream.noticeIds]) {
      if (!job.provenance.evidence.includes(id) || !job.inputs.some(input => input.id === id && input.required && input.status === 'clear')) fail(`Missing required upstream provenance evidence pin: ${id}.`);
    }
    unique([upstream.sourceId, upstream.licenceId, upstream.comparisonId], 'Source/licence/comparison evidence IDs');
  }
  for (const notice of job.provenance.notices) if (!inventory.some(item => item.path === relative(notice.path) && item.sha256 === notice.sha256)) fail('Required provenance notice was lost or changed.');
  if (job.intent === 'upstream' && !hasPin(path.join(job.source.checkout, '.github/PULL_REQUEST_TEMPLATE/artifact-contribution.md'), 'template')) fail('Upstream intent needs the selected dev contribution template pin.');
  // A fixed read-only identity query; no executable, argv, shell or env comes from the job.
  const identity = spawnSync('git', ['-C', job.source.checkout, 'rev-parse', '--verify', 'HEAD'], {
    encoding: 'utf8', windowsHide: true, timeout: Math.min(10000, budget.maxSeconds * 1000), maxBuffer: 65536,
  });
  if (identity.status !== 0 || identity.stdout.trim() !== job.source.head) fail('Selected checkout HEAD changed or unavailable.');
  const recheck = () => {
    for (const { pin, cap, label } of pins.values()) pinned(pin, cap, label);
    if (!same(snapshot(roots.candidate, budget), inventory)) fail('Candidate changed during review record checks.');
    if (!bytesAt(jobFile, limits.envelope, 'Job postflight').equals(jobBytes)) fail('Fixed job changed during record checks.');
  };
  recheck();
  return { job, jobPin: pinOf(jobFile, jobBytes), digest: hash(canonical(job)), candidateDigest, inventory, checks, unavailable, recheck, resultSchema: schemas[1].schema };
}

// The hand-back must be exactly one JSON object. A prose, fenced, byte-order-marked or trailing-text answer is refused plainly, with the start of the
// file, so the next evaluator is told what went wrong. The start is quoted with its odd characters (a byte order mark, a line separator) spelled out.
function parseResult(bytes) {
  let text;
  try { text = decode(bytes); } catch (error) { return fail(`Result is not valid UTF-8 text: ${error.message}`); }
  try { return JSON.parse(text); } catch (error) {
    const notes = [];
    if (text.charCodeAt(0) === 0xfeff) notes.push('It starts with a byte order mark (BOM); save the file as plain UTF-8 without one.');
    if (/^\s*```/.test(text)) notes.push('It starts with a code fence; return the bare JSON object.');
    const after = /after JSON at position (\d+)/.exec(error.message);
    if (after) notes.push(`Parsing stopped because text follows the JSON object, starting at character ${after[1]}: ${spelled(JSON.stringify(text.slice(Number(after[1]), Number(after[1]) + 40)))}; return the JSON object alone.`);
    return fail(`Result is not valid JSON: the hand-back must be exactly ONE JSON object, with no text before or after it, no code fence and no headings. The file starts with ${spelled(JSON.stringify(text.slice(0, 40)))}.${notes.map(note => ` ${note}`).join('')} Parser message: ${echo(error.message)}`);
  }
}

// One implementation for two entry points. The saved-file mode (`--job --result`) is the caller's check of the review root's result.json. With `precheck`
// (`--job --precheck <file>`, ADR 0070) the same parsing, schema, digest, citation, coverage, criteria, finding and evidence checks run on a result file anywhere, with the same
// reasons. Skipped in pre-check mode, because they only make sense for the saved file: (1) the rule that the file is the review root's own result.json; (2) the
// postflight that the saved file did not change while it was checked; (3) the second `record.recheck()` of the job's pins, the candidate and the job bytes after the
// result checks (`checkJob` has just made the first, and a hook has no caller to protect from a swap in between). Nothing else is skipped.
function checkResult(record, resultFile, precheck = false) {
  const { job } = record;
  const file = absolute(resultFile, 'Result');
  if (!precheck && !sameBoth(file, path.join(job.roots.review, 'result.json'))) fail('Result must be the caller-owned review-root result.json.');
  const bytes = bytesAt(resultFile, job.budget.maxResultBytes, 'Result');
  const result = parseResult(bytes);
  validate(result, record.resultSchema, 'result');
  if (!job.inputs.some(input => input.required && input.status === 'clear' && input.kind === 'loading'
    && sameBoth(input.path, path.join(skillRoot, 'assets/result.schema.json')))) fail('Missing result-schema loading pin.');
  if (result.jobId !== job.id || result.jobDigest !== record.digest || result.candidateDigest !== record.candidateDigest) fail('Result fixed job/candidate digest mismatch.');
  if (!same(result.subject, job.subject) || !same(result.inventory, record.inventory)) fail('Result subject/inventory substitution.');
  // Every citation is inspected and every failure is collected, so one refusal names them all: where the citation is, its source, its range, the
  // file's length (as the Read tool counts it), every limit it breaks and, for a quote that stands elsewhere in the file, the line it stands on.
  const failures = [];
  let citationTotal = 0;
  const inspect = (cite, where) => {
    citationTotal += 1;
    // Everything the result controls (an id, a path) is echoed through echo(): one short line, never a line break.
    const base = { where: echo(where), sourceId: echo(cite.sourceId), path: echo(cite.path), startLine: cite.startLine, endLine: cite.endLine, fileLines: null, problems: [], quoteFoundAtLine: null, endLineIsPastLastShown: false };
    const refuse = (lead, extra = {}) => failures.push({ ...base, lead, ...extra, problems: extra.problems ?? [lead] });
    let rel;
    try { rel = relative(cite.path); } catch { return refuse(`Invalid contained relative path: ${echo(cite.path)}.`); }
    let file, pin, cap;
    if (cite.sourceId === 'candidate') {
      pin = record.inventory.find(item => item.path === rel);
      if (!pin) return refuse(`Citation selects an unreported candidate path: ${echo(rel)}.`);
      file = path.join(job.roots.candidate, rel);
      cap = job.budget.maxCandidateFileBytes;
    } else {
      pin = job.inputs.find(input => input.id === cite.sourceId && input.status === 'clear');
      if (!pin || rel !== path.basename(pin.path)) return refuse('Citation selects an unavailable/unpinned input or substituted path.');
      file = pin.path;
      cap = job.budget.maxEvidenceFileBytes;
    }
    const actual = bytesAt(file, cap, 'Citation source');
    if (cite.sha256 !== pin.sha256 || hash(actual) !== pin.sha256) return refuse('Citation source hash mismatch.', { problems: ['the cited sha256 is not the pinned sha256 of this source'] });
    const lines = decode(actual).replace(/\r\n?/g, '\n').split('\n');
    // The checker accepts the empty string after a final newline as a last line, as before; the Read tool does not show it, so the count told to the
    // evaluator is the Read tool's, and an end line on that phantom line is named.
    const phantom = lines.length > 1 && lines.at(-1) === '';
    const shown = phantom ? lines.length - 1 : lines.length;
    const text = lines.join('\n');
    const quote = cite.quote.replace(/\r\n?/g, '\n');
    const quoteLines = quote.split('\n').length;
    const at = text.indexOf(quote);
    const quoteFoundAtLine = at < 0 ? null : text.slice(0, at).split('\n').length;
    const standsOn = quoteFoundAtLine === null ? 'the quote is not found anywhere in the file'
      : `the quote stands on line${quoteLines > 1 ? 's' : ''} ${quoteFoundAtLine}${quoteLines > 1 ? `-${quoteFoundAtLine + quoteLines - 1}` : ''} of the file`;
    const { maxLines, maxQuoteLines, maxQuoteBytes } = CITATION_LIMITS;
    // Every limit this citation breaks is listed, whether or not another one is broken too; the decision to refuse is the same as with one.
    const problems = [];
    if (cite.startLine > cite.endLine) problems.push(`the start line ${cite.startLine} is after the end line ${cite.endLine}`);
    if (cite.endLine > lines.length) problems.push(`the end line ${cite.endLine} is past the end of the file (the Read tool shows ${shown} lines)`);
    if (cite.startLine <= cite.endLine && cite.endLine - cite.startLine >= maxLines) {
      problems.push(`the citation spans ${cite.endLine - cite.startLine + 1} lines, at most ${maxLines} are allowed (its end line at most ${maxLines - 1} after its start line)`);
    }
    const rangeBad = problems.length > 0;
    const quoteBytes = Buffer.byteLength(quote, 'utf8');
    if (quoteBytes > maxQuoteBytes) problems.push(`the quote is ${quoteBytes} bytes, at most ${maxQuoteBytes} are allowed`);
    if (quoteLines > maxQuoteLines) problems.push(`the quote has ${quoteLines} lines, at most ${maxQuoteLines} are allowed`);
    if (!lines.slice(cite.startLine - 1, cite.endLine).join('\n').includes(quote)) problems.push('the quote is not inside the cited lines', standsOn);
    if (!problems.length) return;
    const onPhantom = phantom && cite.endLine === lines.length;
    if (onPhantom) problems.push(`line ${lines.length} is the empty line after the final newline, which the Read tool does not show`);
    refuse(rangeBad ? 'Citation logical line range is invalid or over budget.' : 'Citation quote is absent from the pinned logical lines or over budget.',
      { fileLines: shown, problems, quoteFoundAtLine, endLineIsPastLastShown: onPhantom });
  };
  result.criteria.forEach(criterion => criterion.citations.forEach((cite, index) => inspect(cite, `criterion ${criterion.id}, citation ${index + 1}`)));
  result.findings.forEach(finding => finding.citations.forEach((cite, index) => inspect(cite, `finding ${finding.id}, citation ${index + 1}`)));
  if (failures.length) {
    const shown = failures.slice(0, CITATION_LIST_CAP);
    const sentence = problems => problems.join('; ').replace(/\.?$/, '.');
    const listed = shown.map((item, index) => `${index + 1}. ${item.where}: source ${item.sourceId} (${item.path}), lines ${item.startLine}-${item.endLine}${item.fileLines === null ? '' : `, the file has ${item.fileLines} lines`}: ${sentence(item.problems)}`);
    const more = failures.length - shown.length;
    throw new Refusal([`${failures[0].lead} ${failures.length} of ${citationTotal} citations ${failures.length === 1 ? 'is' : 'are'} refused, and one bad citation refuses the whole result; correct every one listed and hand back the complete result again as ONE JSON object.`,
      ...listed, ...(more ? [`...and ${more} more not listed.`] : [])].join('\n'),
    shown.map(({ lead: _lead, ...detail }) => detail));
  }
  if (result.findings.length > job.budget.maxFindings || result.openItems.length > job.budget.maxOpenItems) fail('Returned finding/open-item budget exceeded.');
  unique(result.coverage.map(item => item.path), 'Returned coverage');
  if (!same(result.coverage.map(item => item.path).sort(), record.inventory.map(item => item.path).sort())) fail('Returned file coverage is incomplete or substituted.');
  for (const item of result.coverage) {
    const original = job.candidate.files.find(file => file.path === item.path);
    if ((original.role === 'preservation-only') !== (item.status === 'preservation-only')) fail('Returned coverage mislabels preservation-only content.');
    if (item.status === 'unavailable' && result.status === 'reviewed') fail('Complete review has unavailable file coverage.');
  }
  unique(result.criteria.map(item => item.id), 'Returned criterion IDs');
  if (!same(result.criteria.map(item => item.id).sort(), job.rubric.criteria.map(item => item.id).sort())) fail('Returned required criterion coverage is incomplete.');
  for (const criterion of result.criteria) {
    const required = job.rubric.criteria.find(item => item.id === criterion.id);
    if ((!required.applicable) !== (criterion.outcome === 'not-applicable')) fail(`Returned criterion applicability contradiction: ${criterion.id}.`);
    if (required.required && result.status === 'reviewed' && criterion.outcome === 'unverified') fail(`Complete review leaves required criterion unverified: ${criterion.id}.`);
    if (required.applicable && ['satisfactory', 'needs-work'].includes(criterion.outcome) && !criterion.citations.length) fail(`Required criterion opinion has no pinned citation: ${criterion.id}.`);
  }
  unique(result.findings.map(item => item.id), 'Finding IDs');
  if (result.status === 'reviewed' && record.unavailable.some(item => item.required)) fail('Complete review has an unavailable/unperformed required check.');
  unique(result.openItems.map(item => item.id), 'Open-item IDs');
  for (const item of result.openItems) for (const acceptance of item.dependentAcceptance) {
    if (!job.acceptance.some(required => required.id === acceptance)) fail('Open item substitutes the fixed acceptance scope.');
  }
  if (result.status === 'blocked' && (result.opinion !== 'inconclusive' || !result.openItems.length)) fail('Blocked review requires an inconclusive opinion and a named open item.');
  if (result.opinion === 'no-blocking-findings' && (result.status !== 'reviewed'
    || result.findings.some(item => ['CRITICAL', 'HIGH'].includes(item.severity))
    || job.rubric.criteria.some(item => item.required && result.criteria.find(actual => actual.id === item.id).outcome !== 'satisfactory')
    || record.unavailable.some(item => item.required) || job.provenance.unresolved.length)) fail('No-blocking opinion contradicts review status, required evidence/criteria or CRITICAL/HIGH findings.');
  unique(result.deterministicEvidence.map(item => item.id), 'Returned deterministic check IDs');
  if (!same(result.deterministicEvidence.map(item => item.id).sort(), job.checks.map(item => item.id).sort())) fail('Returned deterministic evidence is incomplete or substituted.');
  for (const item of result.deterministicEvidence) {
    const check = job.checks.find(actual => actual.id === item.id);
    if (item.status !== check.status || item.exit !== check.exit || item.rawSha256 !== (check.raw?.sha256 ?? null)
      || item.receiptSha256 !== (check.receipt?.sha256 ?? null)) fail(`Returned deterministic evidence contradicts pinned receipts: ${item.id}.`);
  }
  if (precheck) return { precheck: true, candidateMatch: true, opinion: result.opinion, reviewStatus: result.status };
  record.recheck();
  if (!bytesAt(resultFile, job.budget.maxResultBytes, 'Result postflight').equals(bytes)) fail('Result changed during postflight.');
  return { result: pinOf(resultFile, bytes), candidateMatch: true, opinion: result.opinion, reviewStatus: result.status };
}

const deterministic = { quality: 'pending', executionProof: 'unverified', live: 'unverified', acceptedDraft: false };
/** The record fields printed on acceptance, in both entry points, then what the result check added. */
const recordOutput = (record, result) => JSON.stringify({ version: 1, kind: 'deterministic', recordValid: true, ready: !record.unavailable.some(item => item.required),
  job: record.jobPin, jobDigest: record.digest, candidateDigest: record.candidateDigest, inventory: record.inventory,
  checks: record.checks, unavailable: record.unavailable, inputPins: record.job.inputs,
  ...result, ...deterministic }) + '\n';
const refusal = error => process.stderr.write(JSON.stringify({ version: 1, kind: 'deterministic', status: 'unavailable', reason: error.message, ...(error.details ? { details: error.details } : {}), ...deterministic }) + '\n');

// The pre-check entry point (ADR 0070): `--precheck <result-file> [--job <absolute-job.json>]`. It is the hook's way to ask "would the caller's check refuse this
// result?" before the evaluator hands it back. It runs the SAME checks as `--job --result` (one implementation, `checkJob` and `checkResult`), on a result file
// anywhere, with the same reasons and details. Exit codes: 0 accepted; 1 refused for what the result says (the hook blocks); 3 the fault is the job's or the
// input's (a missing file, a job that no longer checks): the hook lets the hand-back through, because the evaluator cannot repair that and the caller's check
// decides. Without `--job` it only checks that the file is exactly one JSON object, which needs no job. The saved-file mode keeps its exit code 1 for everything.
function precheck(values) {
  let stage = 'input';
  try {
    const file = absolute(values.precheck, 'Pre-check result');
    if (!values.job) {
      const bytes = bytesAt(file, limits.envelope, 'Result');
      stage = 'result';
      parseResult(bytes);
      process.stdout.write(JSON.stringify({ version: 1, kind: 'deterministic', precheck: 'json-only', ...deterministic }) + '\n');
      return;
    }
    const record = checkJob(absolute(values.job, 'Job argument'));
    stage = 'result';
    process.stdout.write(recordOutput(record, checkResult(record, file, true)));
  } catch (error) {
    refusal(error);
    process.exitCode = stage === 'result' ? 1 : 3;
  }
}

try {
  for (const flag of ['job', 'result', 'precheck', 'help']) {
    if (process.argv.slice(2).filter(arg => arg === `--${flag}` || arg.startsWith(`--${flag}=`)).length > 1) fail(`Duplicate --${flag} selector.`);
  }
  const { values, positionals } = parseArgs({ options: { job: { type: 'string' }, result: { type: 'string' }, precheck: { type: 'string' }, help: { type: 'boolean' } }, strict: true, allowPositionals: true });
  if (values.precheck !== undefined) {
    if (values.result || values.help || positionals.length) throw new Error('--precheck takes a result file and optionally --job, nothing else.');
    precheck(values);
  } else if (values.help && !values.job && !values.result && !positionals.length) {
    process.stdout.write('check-review --job <absolute-job.json> [--result <absolute-result.json>]\nChecks fixed review records; does not run validators or a reviewer.\ncheck-review --precheck <result-file> [--job <absolute-job.json>]\nThe same checks on a result file anywhere, for the hand-back hook; exit 0 accepted, 1 refused, 3 the job or the input is at fault.\n');
  } else if (values.job && !values.help && !positionals.length) {
    const record = checkJob(absolute(values.job, 'Job argument'));
    const result = values.result ? checkResult(record, values.result) : {};
    process.stdout.write(recordOutput(record, result));
    if (!values.result && record.unavailable.some(item => item.required)) process.exitCode = 1;
  } else throw new Error('A supported absolute --job review record is required.');
} catch (error) {
  refusal(error);
  process.exitCode = 1;
}
