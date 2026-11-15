#!/usr/bin/env node
import { parseArgs } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

// Caller-operated consistency checks only. Nothing is written, no command in a task, return or candidate is executed, and neither
// bundle-return.mjs nor bundle-check is run here: the effect (final bytes) is checked, never the cause. Producer identity stays
// unauthenticated. Content checks are limited to what binds the four proposal files to the task; the rest is `agents bundle-check`.
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
const within = (parent, child) => {
  const rel = path.relative(folded(parent), folded(child));
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel));
};
const overlaps = (a, b) => within(a, b) || within(b, a);
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const byPath = (a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
const unique = (values, label, code) => { if (new Set(values.map(value => value.toLowerCase())).size !== values.length) stop(code, `${label}: duplicate/case-colliding values.`); };

const skillRoot = fileURLToPath(new URL('../', import.meta.url));
const scriptFile = fileURLToPath(import.meta.url);
const limits = { envelope: 262144, executable: 134217728, installed: 262144, small: 1048576 };
const TASK_NAME = 'bundle-task.json';
const RETURN_NAME = 'bundle-return.json';
const HOST_DIRS = ['.agents', '.claude', '.cline', '.cursor', '.codex', '.opencode', '.gemini'];
/** The four files author-bundle returns, at the top level of the draft root, with their fixed roles. */
const AUTHORED = ['bundles.json', 'leader-responsibility.md', 'bindings.json', 'report.json'];
const AUTHORED_ROLES = { 'bundles.json': 'subject', 'leader-responsibility.md': 'subject', 'bindings.json': 'support', 'report.json': 'support' };
const SHARED_SKILLS = ['host-agent-router', 'handoff', 'git-guardrails'];
/** The Bundle fields of bundles.json that must equal the task's literal values. */
const BOUND_FIELDS = ['name', 'version', 'status', 'domain', 'category', 'description', 'tier'];
/** The files in which a fixed value must appear as a whole token. */
const TOKEN_FILES = ['bundles.json', 'leader-responsibility.md', 'bindings.json'];
const SUPPORT = [
  'references/job.md', 'references/verification.md', 'references/bundle-shape.md', 'references/prerequisites.md',
  'assets/domain-bundle.template.json', 'assets/organization-bundle.template.json', 'assets/leader-responsibility.template.md',
  'assets/report.json', 'examples/domain.md', 'examples/organization.md', 'scripts/bundle-return.mjs',
];
const RULES = [
  'skill-attribution.md', 'git-guardrails.md', 'test-driven-development.md', 'clean-code-and-architecture.md',
  'domain-modeling-and-adr.md', 'multi-agent-coordination.md', 'quality-aesthetics-accessibility.md',
];
const INSTALLED = [
  'SKILL.md', 'assets/claude-binding.json', ...SUPPORT,
  ...RULES.map(name => `references/${name === 'skill-attribution.md' ? '' : 'rules/'}${name}`),
];
const JSON_ASSETS = ['assets/domain-bundle.template.json', 'assets/organization-bundle.template.json', 'assets/report.json'];

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
function bytesAt(value, cap, label, code) {
  const file = absolute(value, label, code);
  const stat = fs.statSync(file, { throwIfNoEntry: false });
  if (!stat?.isFile()) stop(code, `${label}: missing ordinary file ${file}.`, 'unavailable');
  if (stat.size > cap) stop(code, `${label}: byte budget exceeded.`, 'unavailable');
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
function watch(value, cap, label, code) {
  const bytes = bytesAt(value, cap, label, code);
  watched.push({ value, cap, label, code, bytes });
  return bytes;
}
function pinned(pin, cap, label, code) {
  const bytes = watch(pin.path, cap, label, code);
  if (pin.bytes !== bytes.length || pin.sha256 !== hash(bytes)) stop(code, `${label}: hash/length pin mismatch ${pin.path}.`);
  return bytes;
}
function recheck() {
  for (const item of watched) {
    let again;
    try { again = bytesAt(item.value, item.cap, item.label, item.code); }
    catch { stop('STALE_INPUT', `${item.label}: changed or vanished during the check.`, 'unavailable'); }
    if (!again.equals(item.bytes)) stop('STALE_INPUT', `${item.label}: changed during the check.`, 'unavailable');
  }
  for (const check of rechecks) check();
}

// Deliberately limited to the bundled schemas' vocabulary; no external resolution.
const schemaVocabulary = new Set(['$schema', 'title', 'description', 'type', 'const', 'enum', 'properties', 'required', 'additionalProperties', 'items', 'minItems', 'maxItems', 'minLength', 'maxLength', 'pattern', 'minimum', 'maximum']);
function auditSchema(schema) {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) fail('Required executable schema must be an object.');
  for (const key of Object.keys(schema)) if (!schemaVocabulary.has(key)) fail(`Unsupported schema keyword ${key}.`);
  for (const child of Object.values(schema.properties ?? {})) auditSchema(child);
  if (schema.items) auditSchema(schema.items);
}
function validate(value, schema, label) {
  const bad = message => { throw new SchemaError(label, `${label}: ${message}`); };
  if ('const' in schema && !same(value, schema.const)) bad(`expected constant ${JSON.stringify(schema.const)}.`);
  if (schema.enum && !schema.enum.some(item => same(item, value))) bad('unsupported value.');
  const type = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value === 'number' && Number.isInteger(value) ? 'integer' : typeof value;
  const accepts = [].concat(schema.type ?? []);
  if (schema.type && !accepts.includes(type) && !(type === 'integer' && accepts.includes('number'))) bad(`expected ${schema.type}.`);
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
function conform(value, schema, label, code) {
  try { validate(value, schema, label); }
  catch (error) { if (error instanceof SchemaError) stop(code, error.message); throw error; }
}

/**
 * Walks a draft folder with the task's budgets; returns null when the folder is absent. Links are never followed. The four proposal
 * files at the top level count against the authored budgets; every other file is preservation-only and counts against those budgets.
 * Bytes are hashed, never decoded here.
 */
function snapshot(root, budget, badCode) {
  const dir = absolute(root, 'Draft root', 'ROOT_CONFLICT');
  const stat = fs.lstatSync(dir, { throwIfNoEntry: false });
  if (!stat) return null;
  if (!stat.isDirectory()) stop(badCode, 'Draft root is not a folder.');
  const inventory = [];
  const files = new Map();
  const dirs = [];
  let authoredBytes = 0, preservedFiles = 0, preservedBytes = 0, directories = 0;
  const walk = (directory, prefix) => {
    if (++directories > 128) stop('LIMIT', 'Draft directory budget exceeded.', 'unavailable');
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const rel = relative(prefix + entry.name, badCode), file = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) stop('ROOT_CONFLICT', `Linked draft path: ${rel}.`, 'failed', rel);
      if (entry.isDirectory()) { dirs.push(rel); walk(file, `${rel}/`); }
      else if (entry.isFile()) {
        const authored = AUTHORED.includes(rel);
        const size = fs.lstatSync(file).size;
        const cap = authored ? budget.maxAuthoredFileBytes : budget.maxPreservedBytes;
        if (!authored && ++preservedFiles > budget.maxPreservedFiles) stop('LIMIT', 'Preserved file budget exceeded.', 'unavailable', rel);
        if (size > cap) stop('LIMIT', `Draft file byte budget exceeded: ${rel}.`, 'unavailable', rel);
        const bytes = bytesAt(file, cap, 'Draft file', badCode);
        if (authored && (authoredBytes += bytes.length) > budget.maxAuthoredBytes) stop('LIMIT', 'Authored total-byte budget exceeded.', 'unavailable');
        if (!authored && (preservedBytes += bytes.length) > budget.maxPreservedBytes) stop('LIMIT', 'Preserved total-byte budget exceeded.', 'unavailable');
        inventory.push({ path: rel, kind: 'file', bytes: bytes.length, sha256: hash(bytes) });
        files.set(rel, bytes);
      } else stop(badCode, `Unsupported draft path: ${rel}.`, 'failed', rel);
    }
  };
  walk(dir, '');
  unique([...inventory.map(item => item.path), ...dirs], 'Draft', badCode);
  return { inventory: inventory.sort(byPath), files, dirs: dirs.sort() };
}
/** After the run, the draft folder must be exactly the one in `live` (or still absent). */
function watchDraft(root, budget, badCode, live) {
  rechecks.push(() => {
    let again;
    try { again = snapshot(root, budget, badCode); }
    catch { stop('STALE_INPUT', 'Draft changed during the check.', 'unavailable'); }
    if (!same(again?.inventory ?? null, live?.inventory ?? null) || !same(again?.dirs ?? null, live?.dirs ?? null)) stop('STALE_INPUT', 'Draft changed during the check.', 'unavailable');
  });
}
const stripKind = ({ path: file, bytes, sha256 }) => ({ path: file, bytes, sha256 });
const pinOut = ({ path: file, bytes, sha256 }) => ({ path: file, bytes, sha256 });

function loaderFrontmatter(entryBytes, bindingBytes) {
  let text;
  try { text = decode(entryBytes); } catch { return stop('LOADER_MECHANISM', 'Installed author-bundle entry is not UTF-8.'); }
  const front = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
  if (!front) stop('LOADER_MECHANISM', 'Installed author-bundle entry has no frontmatter.');
  const top = new Map();
  for (const line of front[1].split(/\r?\n|[\u2028\u2029]/)) {
    const match = /^([A-Za-z][A-Za-z0-9_-]*):/.exec(line);
    if (!match) continue;
    if (top.has(match[1])) stop('LOADER_MECHANISM', `Installed author-bundle entry repeats ${match[1]}.`);
    const value = line.slice(match[0].length).replace(/^[ \t]+|[ \t]+$/g, '');
    top.set(match[1], value.replace(/^(["'])(.*)\1$/, '$2'));
  }
  if (top.get('name') !== 'author-bundle' || top.get('context') !== 'fork' || top.get('agent') !== 'general-purpose'
    || top.get('background') !== 'false' || top.has('disable-model-invocation')) {
    stop('LOADER_MECHANISM', 'Installed author-bundle entry must select context: fork, agent: general-purpose, background: false and stay model-invocable.');
  }
  const binding = parseJson(bindingBytes, 'Installed author-bundle binding', 'LOADER_MECHANISM');
  if (!isObject(binding) || binding.version !== 1 || binding.bundle !== 'agent-factory' || binding.skill !== 'author-bundle'
    || binding.source !== 'hosts/claude/skills/author-bundle/SKILL.md' || binding.installed !== '.claude/skills/author-bundle/SKILL.md'
    || binding.invocation !== '/author-bundle'
    || !same(binding.loadingRole, { kind: 'built-in', name: 'general-purpose', context: 'fork', background: false })
    || !same(binding.surface, { host: 'claude', product: 'Claude Code CLI', scope: 'workspace', lane: 'native' })
    || !Array.isArray(binding.requiredSupport) || !same([...binding.requiredSupport].sort(), [...SUPPORT].sort())
    || !Array.isArray(binding.references) || binding.references.length !== RULES.length) {
    stop('LOADER_MECHANISM', 'Installed author-bundle binding receipt differs from the reviewed fork declaration.');
  }
}

function checkTask(taskFile, withResult) {
  phase = 'preflight';
  const taskBytes = watch(taskFile, limits.envelope, 'Task', 'JOB_INVALID');
  const task = parseJson(taskBytes, 'Task', 'JOB_INVALID');
  conform(task, loadSchema('bundle-task', 'JOB_INVALID'), 'task', 'JOB_INVALID');
  const { roots, source, budget, runtime, bundle } = task;
  const bad = reason => stop('JOB_INVALID', reason);

  // Task-internal consistency.
  if ((task.revision === 'r0') !== (task.previous === null)) bad('Revision r0 has no previous link and revision r1 needs one.');
  if (task.revision === 'r1' && task.operation !== 'update') bad('Revision r1 repair must use update operation.');
  if ((task.authoringHost.observedVersion === null) === (task.authoringHost.unverifiedReason === null)) bad('Authoring Host needs an observed version or an explicit unverified reason.');
  unique(task.fixedValues.map(item => item.name), 'Fixed value names', 'JOB_INVALID');
  unique(task.acceptance.map(item => item.id), 'Acceptance IDs', 'JOB_INVALID');
  unique(task.selectedChecks.map(item => item.id), 'Selected check IDs', 'JOB_INVALID');
  if (task.selectedChecks.length > budget.maxChecks) bad('More selected checks than the check budget.');
  for (const skill of SHARED_SKILLS) {
    if (bundle.skills.filter(item => item === skill).length !== 1) bad(`The task Bundle must declare ${skill} exactly once.`);
  }
  if (folded(taskFile) !== folded(path.join(roots.evidence, TASK_NAME))) bad(`Task must be the caller-owned evidence-root ${TASK_NAME}.`);

  // Roots: absolute, link-free, outside managed Host paths, mutually disjoint from the inputs and each other.
  const draft = absolute(roots.draft, 'Draft root', 'ROOT_CONFLICT');
  const producer = absolute(roots.producer, 'Producer root', 'ROOT_CONFLICT');
  const evidence = absolute(roots.evidence, 'Evidence root', 'ROOT_CONFLICT');
  const checkout = absolute(source.checkout, 'Source checkout', 'ROOT_CONFLICT');
  const registry = absolute(source.registry, 'Source registry', 'ROOT_CONFLICT');
  const managed = roots.managed.map(root => absolute(root, 'Managed root', 'ROOT_CONFLICT'));
  const protectedRoots = roots.protected.map(root => absolute(root, 'Protected root', 'ROOT_CONFLICT'));
  for (const [name, dir] of [['Source checkout', checkout], ['Source registry', registry]]) {
    if (!fs.statSync(dir, { throwIfNoEntry: false })?.isDirectory()) stop('ROOT_CONFLICT', `${name}: required directory unavailable.`, 'unavailable');
  }
  const outputs = [['draft', draft], ['producer', producer], ['evidence', evidence]];
  for (const [name, root] of outputs) {
    if (root.split(path.sep).some(part => HOST_DIRS.includes(part.toLowerCase()))) stop('ROOT_CONFLICT', `The ${name} root is a managed Host path.`);
  }
  outputs.forEach(([name, root], index) => {
    for (const [other, otherRoot] of outputs.slice(index + 1)) if (overlaps(root, otherRoot)) stop('ROOT_CONFLICT', `The ${name} and ${other} roots overlap.`);
    for (const input of [checkout, registry, ...managed, ...protectedRoots]) if (overlaps(root, input)) stop('ROOT_CONFLICT', `The ${name} root overlaps a source, managed or protected root.`);
  });

  // The installed author-bundle closure: exactly the twenty reviewed files, byte-pinned, with the fork loader mechanism.
  const entryPin = task.installed.filter(pin => path.basename(pin.path) === 'SKILL.md');
  if (entryPin.length !== 1) stop('CLOSURE_MISSING', 'The installed pins must name exactly one author-bundle SKILL.md.');
  const installedRoot = path.dirname(path.resolve(entryPin[0].path));
  if (path.basename(installedRoot) !== 'author-bundle') stop('CLOSURE_MISSING', 'The installed folder must be named author-bundle.');
  const seen = new Set();
  for (const rel of INSTALLED) {
    const expected = path.join(installedRoot, ...rel.split('/'));
    const matches = task.installed.filter(pin => folded(pin.path) === folded(expected));
    if (matches.length !== 1) stop('CLOSURE_MISSING', `The installed author-bundle closure lacks a pin for ${rel}.`, 'failed', rel);
    seen.add(folded(expected));
  }
  if (seen.size !== task.installed.length) stop('CLOSURE_MISSING', 'The installed pins are not exactly the twenty reviewed author-bundle files.');
  const installedBytes = new Map();
  for (const rel of INSTALLED) {
    const pin = task.installed.find(item => folded(item.path) === folded(path.join(installedRoot, ...rel.split('/'))));
    installedBytes.set(rel, pinned(pin, limits.installed, `Installed author-bundle ${rel}`, 'CLOSURE_MISSING'));
  }
  loaderFrontmatter(installedBytes.get('SKILL.md'), installedBytes.get('assets/claude-binding.json'));
  for (const rel of JSON_ASSETS) parseJson(installedBytes.get(rel), `Installed author-bundle ${rel}`, 'CLOSURE_MISSING');

  // Runtime: the running Node by physical path, this installed script and the checkout's built validator.
  if (Number(process.versions.node.split('.')[0]) < 24) stop('RUNTIME_MISMATCH', 'Runtime must be Node >=24.');
  if (folded(runtime.executable.path) !== folded(fs.realpathSync(process.execPath))) stop('RUNTIME_MISMATCH', 'Runtime must be this Node executable, selected by its physical path.');
  pinned(runtime.executable, limits.executable, 'Runtime executable', 'RUNTIME_MISMATCH');
  if (folded(runtime.checker.path) !== folded(scriptFile)) stop('RUNTIME_MISMATCH', 'Checker must be this actually installed script.');
  pinned(runtime.checker, limits.small, 'Installed checker', 'RUNTIME_MISMATCH');
  pinned(runtime.validator, limits.executable, 'Packaged validator', 'RUNTIME_MISMATCH');
  if (folded(runtime.validator.path) !== folded(path.join(checkout, 'dist', 'cli.js'))) stop('RUNTIME_MISMATCH', 'Validator must be the selected checkout dist/cli.js.');

  // Pinned inputs and provenance evidence: outside the writable draft, within the pin budget, byte-pinned.
  const inputs = [...task.inputPins, ...task.provenance.evidence];
  if (inputs.length > budget.maxPinnedInputs || inputs.reduce((sum, pin) => sum + pin.bytes, 0) > budget.maxPinnedInputBytes) {
    stop('LIMIT', 'The pinned inputs are over the task pin budget.', 'unavailable');
  }
  for (const pin of inputs) {
    if (within(draft, absolute(pin.path, 'Input pin', 'JOB_INVALID'))) bad('Writable draft contains a required input.');
    pinned(pin, budget.maxPinnedInputBytes, 'Input pin', 'JOB_INVALID');
  }
  if (!task.provenance.author.trim() || !task.provenance.license.trim()) bad('Provenance needs a real author and licence.');
  if (task.provenance.unresolved.length) bad('Required provenance remains unresolved.');
  if (task.provenance.disposition === 'adapted' && task.provenance.evidence.length === 0) bad('Adapted work needs pinned licence and source evidence.');
  let templateText = null;
  if (task.intent === 'upstream') {
    if (task.contributionTemplate === null) bad('Upstream intent needs the pinned contribution template.');
    const file = absolute(task.contributionTemplate.path, 'Contribution template', 'JOB_INVALID');
    if (folded(file) !== folded(path.join(checkout, '.github', 'PULL_REQUEST_TEMPLATE', 'artifact-contribution.md'))) {
      bad('Use the existing artifact-contribution template inside the selected checkout.');
    }
    try { templateText = decode(pinned(task.contributionTemplate, limits.installed, 'Contribution template', 'JOB_INVALID')); }
    catch (error) { if (error instanceof Stop) throw error; bad('The contribution template is not UTF-8 text.'); }
  } else if (task.contributionTemplate !== null) bad('A local task carries no contribution template.');

  // Allowed paths and roles: the four proposal files with their fixed roles; create and reuse allow all four.
  const allowed = task.allowedPaths;
  unique(allowed, 'Allowed paths', 'JOB_INVALID');
  if (task.operation !== 'update' && allowed.length !== AUTHORED.length) bad('Create and reuse allow all four proposal files.');
  const roleOf = new Map();
  for (const item of task.roles) { relative(item.path, 'JOB_INVALID'); roleOf.set(item.path, item.role); }
  unique(task.roles.map(item => item.path), 'Role paths', 'JOB_INVALID');
  for (const [file, role] of Object.entries(AUTHORED_ROLES)) if (roleOf.get(file) !== role) bad(`${file} must have role ${role}.`);
  for (const [file, role] of roleOf) if (!AUTHORED.includes(file) && role !== 'preservation-only') bad(`${file} is not a proposal file and must be preservation-only.`);

  // Baseline (the pinned immutable copies); state checks against the live draft follow below.
  if (task.operation !== 'update' ? task.baseline.length > 0 : task.baseline.length === 0) {
    stop('BASELINE_MISMATCH', task.operation !== 'update' ? 'A create or reuse task has no baseline.' : 'An update task needs the full baseline inventory.');
  }
  unique(task.baseline.map(item => relative(item.path, 'BASELINE_MISMATCH')), 'Baseline paths', 'BASELINE_MISMATCH');
  unique(task.baseline.map(item => item.snapshot), 'Baseline snapshots', 'BASELINE_MISMATCH');
  for (const file of task.baseline.map(item => item.path)) if (!roleOf.has(file)) bad(`The roles do not cover ${file}.`);
  const preservedBaseline = task.baseline.filter(item => !AUTHORED.includes(item.path));
  if (task.baseline.some(item => AUTHORED.includes(item.path) && item.bytes > budget.maxAuthoredFileBytes)
    || preservedBaseline.length > budget.maxPreservedFiles || preservedBaseline.reduce((sum, item) => sum + item.bytes, 0) > budget.maxPreservedBytes) {
    stop('LIMIT', 'The baseline is over the task budget.', 'unavailable');
  }
  const baselineBytes = new Map();
  for (const item of task.baseline) {
    const snapshotFile = absolute(item.snapshot, 'Baseline snapshot', 'BASELINE_MISMATCH');
    if (!within(evidence, snapshotFile) || folded(snapshotFile) === folded(taskFile)) stop('BASELINE_MISMATCH', `Baseline snapshot is outside the evidence root: ${item.path}.`, 'failed', item.path);
    baselineBytes.set(item.path, pinned({ path: item.snapshot, bytes: item.bytes, sha256: item.sha256 }, Math.max(budget.maxAuthoredFileBytes, budget.maxPreservedBytes), `Baseline snapshot ${item.path}`, 'BASELINE_MISMATCH'));
  }
  if (task.operation === 'update' && AUTHORED.some(file => !baselineBytes.has(file))) stop('BASELINE_MISMATCH', 'An update baseline must include all four proposal files.');
  for (const note of task.protectedNotes) {
    const rel = relative(note.path, 'BASELINE_MISMATCH');
    if (task.operation !== 'update') stop('BASELINE_MISMATCH', 'protectedNotes apply only when updating an existing baseline.');
    let text = null;
    try { text = baselineBytes.has(rel) ? decode(baselineBytes.get(rel)) : null; } catch { text = null; }
    if (text === null || !text.includes(note.contains)) stop('BASELINE_MISMATCH', `Protected note fragment is absent from the baseline: ${rel}.`, 'failed', rel);
  }
  const baselineDirs = [...new Set(task.baseline.flatMap(item => item.path.split('/').slice(0, -1).map((_, index, parts) => parts.slice(0, index + 1).join('/'))))].sort();
  const baselineInventory = task.baseline.map(item => ({ path: item.path, kind: 'file', bytes: item.bytes, sha256: item.sha256 })).sort(byPath);

  // A fixed read-only identity query; no executable, argv, shell or env comes from the task.
  const identity = spawnSync('git', ['-C', checkout, 'rev-parse', '--verify', 'HEAD'], {
    encoding: 'utf8', windowsHide: true, timeout: 10000, maxBuffer: 65536,
  });
  if (identity.status !== 0 || identity.stdout.trim() !== source.head) stop('CHECKOUT_HEAD', 'Selected checkout HEAD changed or unavailable.');

  // The live state is a preflight question; once a return is checked, the draft is the run's output instead.
  if (!withResult) {
    const live = snapshot(draft, budget, 'BASELINE_MISMATCH');
    if (task.operation !== 'update' && live !== null) stop('BASELINE_MISMATCH', 'Create and reuse require an absent draft root.');
    if (task.operation === 'update' && (live === null || !same(live.inventory, baselineInventory) || !same(live.dirs, baselineDirs))) {
      stop('BASELINE_MISMATCH', 'The live draft is not the pinned baseline (stale, edited, missing or incomplete).');
    }
    watchDraft(draft, budget, 'BASELINE_MISMATCH', live);
  }

  return {
    task, allowed, roleOf, draft, producer, registry, budget, templateText, baselineBytes, baselineInventory, baselineDirs,
    taskPin: pinOut({ path: path.resolve(taskFile), bytes: taskBytes.length, sha256: hash(taskBytes) }), taskDigest: hash(canonical(task)),
    baselineDigest: task.operation === 'update' ? hash(canonical(baselineInventory)) : null,
    pins: { runtime: pinOut(runtime.executable), checker: pinOut(runtime.checker), validator: pinOut(runtime.validator), installed: task.installed.map(pinOut) },
  };
}

function checkReturn(ctx, resultArg) {
  phase = 'postflight';
  const { task, allowed, roleOf, draft, producer, registry, budget, baselineBytes, baselineInventory, baselineDirs } = ctx;
  const returnFile = path.join(producer, RETURN_NAME);
  const resultFile = absolute(resultArg, 'Result', 'RESULT_PATH');
  if (folded(resultFile) !== folded(returnFile)) stop('RESULT_PATH', `The return must be the producer-root ${RETURN_NAME}.`);
  const returnBytes = watch(resultFile, limits.envelope, 'Return', 'RESULT_INVALID');
  const ret = parseJson(returnBytes, 'Return', 'RESULT_INVALID');
  conform(ret, loadSchema('bundle-return', 'RESULT_INVALID'), 'return', 'RESULT_INVALID');
  const invalid = reason => stop('RESULT_INVALID', reason);
  if (ret.status === 'blocked' && ret.openItems.length === 0) invalid('A blocked return needs a named open item.');
  unique(ret.inventory.map(item => item.path), 'Return inventory', 'RESULT_INVALID');
  unique(ret.changed.map(item => item.path), 'Return changed paths', 'RESULT_INVALID');
  unique(ret.openItems.map(item => item.id), 'Return open items', 'RESULT_INVALID');
  if (ret.claimedChecks.length > budget.maxChecks || ret.claimedChecks.some(check => check.raw && check.raw.bytes > budget.maxCheckLogBytes)) {
    invalid('The claimed checks are over the task check budget.');
  }
  if (task.intent === 'local' && ret.upstreamPreparation !== null) invalid('A local task carries no upstream preparation.');
  if (ret.taskId !== task.id || ret.taskDigest !== ctx.taskDigest) stop('DIGEST_MISMATCH', 'The return echoes a different task id or task digest.');
  if (ret.externalActions.length) stop('EXTERNAL_ACTION', 'externalActions must be empty.');

  const live = snapshot(draft, budget, 'INVENTORY_MISMATCH');
  watchDraft(draft, budget, 'INVENTORY_MISMATCH', live);
  const result = { path: resultFile, bytes: returnBytes.length, sha256: hash(returnBytes) };
  const reportFile = path.join(draft, 'report.json');
  const checkReportPin = () => {
    const actual = live?.files.get('report.json');
    const expected = actual ? { path: reportFile, bytes: actual.length, sha256: hash(actual) } : null;
    const claimed = ret.report;
    if (claimed && !absoluteForm(claimed.path)) stop('HELPER_RECORD', 'The report pin path must be absolute without traversal aliases.');
    if ((claimed === null) !== (expected === null)
      || (claimed && (folded(claimed.path) !== folded(expected.path) || claimed.bytes !== expected.bytes || claimed.sha256 !== expected.sha256))) {
      stop('INVENTORY_MISMATCH', 'The report pin is not the draft report.json as it is now.');
    }
  };

  if (ret.status === 'blocked') {
    if (task.operation !== 'update' ? live !== null : live === null || !same(live.inventory, baselineInventory) || !same(live.dirs, baselineDirs)) {
      stop('BLOCKED_STATE', 'A blocked return needs the draft root exactly as before the run.');
    }
    if (ret.changed.length) stop('BLOCKED_STATE', 'A blocked return cannot claim changed files.');
    if (ret.upstreamPreparation !== null) stop('BLOCKED_STATE', 'A blocked return prepares nothing upstream.');
    if (!same([...ret.inventory].sort(byPath), live ? live.inventory.map(stripKind) : [])) {
      stop('INVENTORY_MISMATCH', 'The returned inventory differs from the untouched draft state.');
    }
    checkReportPin();
    return { result, returnStatus: 'blocked', candidate: null, bundleCheck: null };
  }
  if (live === null) stop('SCOPE_VIOLATION', 'A draft return needs a draft folder.');

  // Scope and preservation.
  const final = live.files;
  for (const file of baselineBytes.keys()) {
    if (!final.has(file)) stop('SCOPE_VIOLATION', `A baseline file is gone: ${file}.`, 'failed', file);
  }
  for (const file of final.keys()) {
    if (!baselineBytes.has(file) && !allowed.includes(file)) stop('SCOPE_VIOLATION', `A new file is neither an allowed proposal file nor baseline: ${file}.`, 'failed', file);
  }
  for (const dir of live.dirs) if (!baselineDirs.includes(dir)) stop('SCOPE_VIOLATION', `A folder the baseline did not have: ${dir}/.`, 'failed', `${dir}/`);
  for (const file of AUTHORED) if (!final.has(file)) stop('SCOPE_VIOLATION', `A draft return needs all four proposal files; ${file} is missing.`, 'failed', file);
  for (const [file, before] of baselineBytes) {
    if (!final.get(file).equals(before) && (roleOf.get(file) === 'preservation-only' || !allowed.includes(file))) {
      stop('PRESERVATION', `A preserved baseline file differs from its baseline bytes: ${file}.`, 'failed', file);
    }
  }
  for (const note of task.protectedNotes) {
    let text = null;
    try { text = final.has(note.path) ? decode(final.get(note.path)) : null; } catch { text = null; }
    if (text === null || !text.includes(note.contains)) stop('PRESERVATION', `Protected note changed or missing: ${note.path}.`, 'failed', note.path);
  }

  // The bytes bound to the task: UTF-8, parseable JSON, the task's literal Bundle fields and fixed values. Everything else about the
  // content is the job of `agents bundle-check`.
  const texts = new Map();
  for (const file of AUTHORED) {
    try { texts.set(file, decode(final.get(file))); } catch { stop('BYTES_MISMATCH', `${file} is not UTF-8 text.`, 'failed', file); }
  }
  const parsed = {};
  for (const file of ['bundles.json', 'bindings.json', 'report.json']) {
    try { parsed[file] = JSON.parse(texts.get(file)); } catch (error) { stop('BYTES_MISMATCH', `${file} is not JSON: ${error.message}`, 'failed', file); }
  }
  const manifest = parsed['bundles.json'];
  const proposed = isObject(manifest) && isObject(manifest.bundles) && Object.hasOwn(manifest.bundles, task.bundle.name) ? manifest.bundles[task.bundle.name] : null;
  if (!isObject(proposed)) stop('BYTES_MISMATCH', `bundles.json has no bundles[${JSON.stringify(task.bundle.name)}] record.`, 'failed', 'bundles.json');
  for (const field of BOUND_FIELDS) {
    if (proposed[field] !== task.bundle[field]) stop('BYTES_MISMATCH', `bundles.json ${field} differs from the task's literal value.`, 'failed', 'bundles.json');
  }
  for (const field of ['agents', 'skills']) {
    if (!same(proposed[field], task.bundle[field])) stop('BYTES_MISMATCH', `bundles.json ${field} differ from the task roster (same entries, same order).`, 'failed', 'bundles.json');
  }
  for (const field of ['orchestrator', 'parentBundle']) {
    if ((proposed[field] ?? null) !== task.bundle[field]) stop('BYTES_MISMATCH', `bundles.json ${field} differs from the task roster.`, 'failed', 'bundles.json');
  }
  // A fixed value counts only as a whole token in the three authored proposal files; report.json does not count.
  for (const value of task.fixedValues) {
    const token = new RegExp(`(?<![A-Za-z0-9_-])${value.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-z0-9_-])`);
    if (!TOKEN_FILES.some(file => token.test(texts.get(file)))) stop('BYTES_MISMATCH', `Missing fixed value in the proposal: ${value.name}.`);
  }
  if (!isObject(parsed['report.json'])) stop('BYTES_MISMATCH', 'report.json must be a JSON object.', 'failed', 'report.json');

  // The claimed inventory, report pin and changed list against the recomputed ones.
  if (!same([...ret.inventory].sort(byPath), live.inventory.map(stripKind))) stop('INVENTORY_MISMATCH', 'The returned inventory differs from the recomputed one.');
  checkReportPin();
  const changed = live.inventory
    .filter(item => !baselineBytes.has(item.path) || !baselineBytes.get(item.path).equals(final.get(item.path)))
    .map(item => ({ path: item.path, operation: baselineBytes.has(item.path) ? 'update' : 'create' }));
  if (!same([...ret.changed].sort(byPath), changed)) stop('DIFF_MISMATCH', 'The returned changed list differs from the one rebuilt from the baseline.');

  if (task.intent === 'upstream') {
    const up = ret.upstreamPreparation;
    if (up !== null && (!absoluteForm(up.templatePath) || up.templatePath !== task.contributionTemplate.path)) {
      stop('HELPER_RECORD', 'The upstream template path must be exactly the task contributionTemplate path.');
    }
    if (up === null || !up.body.startsWith(ctx.templateText)) {
      stop('EXTERNAL_ACTION', 'An upstream draft needs an unsent dev preparation of the pinned template whose body begins with that template.');
    }
  }
  const preserved = [...baselineBytes.keys()].filter(file => final.get(file).equals(baselineBytes.get(file))).sort();
  return {
    result,
    returnStatus: 'draft',
    candidate: {
      draftRoot: draft, bundleName: task.bundle.name, tier: task.bundle.tier, bundlePaths: AUTHORED, inventory: live.inventory,
      candidateDigest: hash(canonical(live.inventory)), changed, preserved,
    },
    bundleCheck: {
      validator: task.runtime.validator.path,
      args: ['bundle-check', '--artifact', draft, '--registry', registry, '--operation', task.operation, ...(task.validation.allowUnresolved ? ['--allow-unresolved'] : [])],
    },
  };
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
    process.stdout.write(
      'check-bundle-return --job <absolute-bundle-task.json> [--result <absolute-bundle-return.json>]\n'
      + 'Checks fixed Bundle proposal task and return records and the bytes bound to the task; does not run bundle-return.mjs, bundle-check or a fork.\n'
      + 'Run agents bundle-check on the draft after a passing postflight. Does not prove who wrote the files or the return, or semantic usefulness.\n',
    );
  } else {
    if (!values.job || values.help || positionals.length) stop('USAGE', 'A supported absolute --job task record is required (--result is optional; --help stands alone).');
    for (const [name, value] of [['--job', values.job], ['--result', values.result]]) {
      if (value !== undefined && !absoluteForm(value)) stop('USAGE', `${name}: expected an absolute path without traversal aliases.`);
    }
    const ctx = checkTask(path.resolve(values.job), Boolean(values.result));
    const post = values.result ? checkReturn(ctx, values.result) : {};
    recheck();
    process.stdout.write(JSON.stringify({
      version: 1, kind: 'deterministic', phase: values.result ? 'postflight' : 'preflight', recordValid: true,
      task: ctx.taskPin, taskId: ctx.task.id, revision: ctx.task.revision, operation: ctx.task.operation, intent: ctx.task.intent,
      bundleName: ctx.task.bundle.name, tier: ctx.task.bundle.tier, bundlePaths: AUTHORED,
      taskDigest: ctx.taskDigest, baselineDigest: ctx.baselineDigest, pins: ctx.pins, validation: ctx.task.validation, ...post,
      ...(values.result ? {
        claimsNotAccepted: ['inventory', 'changed', 'report', 'claimedChecks', 'openItems', 'unverified', 'upstreamPreparation'],
        producerIdentity: 'unauthenticated',
      } : {}),
      quality: 'pending', executionProof: 'unverified', live: 'unverified', acceptedDraft: false,
    }) + '\n');
  }
} catch (error) {
  const known = error instanceof Stop;
  const code = known ? error.code : phase === 'postflight' ? 'RESULT_INVALID' : phase === 'usage' ? 'USAGE' : 'JOB_INVALID';
  process.stderr.write(JSON.stringify({
    version: 1, kind: 'deterministic', status: known ? error.status : 'unavailable', phase: code === 'USAGE' ? 'usage' : phase, code,
    reason: error instanceof Error ? error.message : String(error), path: known ? error.file : null,
    quality: 'pending', executionProof: 'unverified', live: 'unverified', acceptedDraft: false,
  }) + '\n');
  process.exitCode = 1;
}
