#!/usr/bin/env node
import { parseArgs } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

// Caller-operated consistency checks only. Nothing is written, no command in a task, return or candidate is executed,
// and draft-pair.mjs is never run: the effect (final bytes) is checked, never the cause. Producer identity stays unauthenticated.
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
const limits = { envelope: 262144, executable: 134217728, helperJob: 4194304, helperStderr: 65536, installed: 262144, small: 1048576, report: 262144 };
const TASK_NAME = 'contract-task.json';
const RETURN_NAME = 'contract-return.json';
const HOST_DIRS = ['.agents', '.claude', '.cline', '.cursor', '.codex', '.opencode', '.gemini'];
const SUPPORT = [
  'references/job.md', 'references/reuse.md', 'references/bindings.md', 'references/verification.md',
  'examples/new-pair.md', 'examples/reused-pair.md', 'assets/job.schema.json', 'assets/report.json', 'scripts/draft-pair.mjs',
];
const RULES = [
  'skill-attribution.md', 'git-guardrails.md', 'test-driven-development.md', 'clean-code-and-architecture.md',
  'domain-modeling-and-adr.md', 'multi-agent-coordination.md', 'quality-aesthetics-accessibility.md',
];
const INSTALLED = [
  'SKILL.md', 'assets/claude-binding.json', ...SUPPORT,
  ...RULES.map(name => `references/${name === 'skill-attribution.md' ? '' : 'rules/'}${name}`),
];

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
function shortPinned(pin, cap, label, code) {
  const bytes = watch(pin.path, cap, label, code);
  if (pin.sha256 !== hash(bytes)) stop(code, `${label}: hash pin mismatch ${pin.path}.`);
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
function conform(value, schema, label, codeFor) {
  try { validate(value, schema, label); }
  catch (error) { if (error instanceof SchemaError) stop(codeFor(error.at), error.message); throw error; }
}

/** Walks a draft folder with the task's budgets; returns null when the folder is absent. Links are never followed. */
function snapshot(root, budget, badCode) {
  const dir = absolute(root, 'Candidate root', 'ROOT_CONFLICT');
  const stat = fs.lstatSync(dir, { throwIfNoEntry: false });
  if (!stat) return null;
  if (!stat.isDirectory()) stop(badCode, 'Candidate root is not a folder.');
  const inventory = [];
  const files = new Map();
  let total = 0, directories = 0;
  const walk = (directory, prefix) => {
    if (++directories > 128) stop('LIMIT', 'Candidate directory budget exceeded.', 'unavailable');
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const rel = relative(prefix + entry.name, badCode), file = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) stop('ROOT_CONFLICT', `Linked candidate path: ${rel}.`, 'failed', rel);
      if (entry.isDirectory()) walk(file, `${rel}/`);
      else if (entry.isFile()) {
        if (inventory.length >= budget.maxCandidateFiles) stop('LIMIT', 'Candidate file budget exceeded.', 'unavailable');
        if (fs.lstatSync(file).size > budget.maxCandidateFileBytes) stop('LIMIT', `Candidate file byte budget exceeded: ${rel}.`, 'unavailable', rel);
        const bytes = bytesAt(file, budget.maxCandidateFileBytes, 'Candidate', badCode);
        try { decode(bytes); } catch { stop(badCode, `Candidate file is not UTF-8 text: ${rel}.`, 'failed', rel); }
        total += bytes.length;
        if (total > budget.maxCandidateBytes) stop('LIMIT', 'Candidate total-byte budget exceeded.', 'unavailable');
        inventory.push({ path: rel, kind: 'file', bytes: bytes.length, sha256: hash(bytes) });
        files.set(rel, bytes);
      } else stop(badCode, `Unsupported candidate path: ${rel}.`, 'failed', rel);
    }
  };
  walk(dir, '');
  unique(inventory.map(item => item.path), 'Candidate', badCode);
  return { inventory: inventory.sort(byPath), files };
}
/** After the run, the draft folder must be exactly the one in `live` (or still absent). */
function watchDraft(root, budget, badCode, live) {
  rechecks.push(() => {
    let again;
    try { again = snapshot(root, budget, badCode); }
    catch { stop('STALE_INPUT', 'Candidate changed during the check.', 'unavailable'); }
    if (!same(again?.inventory ?? null, live?.inventory ?? null)) stop('STALE_INPUT', 'Candidate changed during the check.', 'unavailable');
  });
}
function strays(draft) {
  const parent = path.dirname(draft);
  if (!fs.existsSync(parent)) return [];
  return fs.readdirSync(parent).filter(name => foldName(name) !== foldName(path.basename(draft)));
}
const stripKind = ({ path: file, bytes, sha256 }) => ({ path: file, bytes, sha256 });
const pinOut = ({ path: file, bytes, sha256 }) => ({ path: file, bytes, sha256 });

function loaderFrontmatter(entryBytes, bindingBytes) {
  let text;
  try { text = decode(entryBytes); } catch { return stop('LOADER_MECHANISM', 'Installed author-contract entry is not UTF-8.'); }
  const front = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
  if (!front) stop('LOADER_MECHANISM', 'Installed author-contract entry has no frontmatter.');
  const top = new Map();
  for (const line of front[1].split(/\r?\n|[\u2028\u2029]/)) {
    const match = /^([A-Za-z][A-Za-z0-9_-]*):/.exec(line);
    if (!match) continue;
    if (top.has(match[1])) stop('LOADER_MECHANISM', `Installed author-contract entry repeats ${match[1]}.`);
    const value = line.slice(match[0].length).replace(/^[ \t]+|[ \t]+$/g, '');
    top.set(match[1], value.replace(/^(["'])(.*)\1$/, '$2'));
  }
  if (top.get('name') !== 'author-contract' || top.get('context') !== 'fork' || top.get('agent') !== 'general-purpose'
    || top.get('background') !== 'false' || top.has('disable-model-invocation')) {
    stop('LOADER_MECHANISM', 'Installed author-contract entry must select context: fork, agent: general-purpose, background: false and stay model-invocable.');
  }
  const binding = parseJson(bindingBytes, 'Installed author-contract binding', 'LOADER_MECHANISM');
  if (!isObject(binding) || binding.version !== 1 || binding.bundle !== 'agent-factory' || binding.skill !== 'author-contract'
    || binding.source !== 'hosts/claude/skills/author-contract/SKILL.md' || binding.installed !== '.claude/skills/author-contract/SKILL.md'
    || binding.invocation !== '/author-contract'
    || !same(binding.loadingRole, { kind: 'built-in', name: 'general-purpose', context: 'fork', background: false })
    || !same(binding.surface, { host: 'claude', product: 'Claude Code CLI', scope: 'workspace', lane: 'native' })
    || !Array.isArray(binding.requiredSupport) || !same([...binding.requiredSupport].sort(), [...SUPPORT].sort())
    || !Array.isArray(binding.references) || binding.references.length !== RULES.length) {
    stop('LOADER_MECHANISM', 'Installed author-contract binding receipt differs from the reviewed fork declaration.');
  }
}

function checkTask(taskFile, withResult) {
  phase = 'preflight';
  const taskBytes = watch(taskFile, limits.envelope, 'Task', 'JOB_INVALID');
  const task = parseJson(taskBytes, 'Task', 'JOB_INVALID');
  conform(task, loadSchema('contract-task', 'JOB_INVALID'), 'task', at => (at.startsWith('task.draftJobTemplate') ? 'TEMPLATE_INVALID' : 'JOB_INVALID'));
  const { roots, source, budget, runtime, draftJobTemplate: template, definition } = task;
  const corePath = `core/${definition}.core.md`, contractPath = `core/${definition}.contract.json`;
  const pairPaths = { core: corePath, contract: contractPath };

  // Task-internal consistency.
  if ((task.revision === 'r0') !== (task.previous === null)) stop('JOB_INVALID', 'Revision r0 has no previous link and revision r1 needs one.');
  if (task.revision === 'r1' && task.operation !== 'update') stop('JOB_INVALID', 'Revision r1 repair must use update operation.');
  if ((task.authoringHost.observedVersion === null) === (task.authoringHost.unverifiedReason === null)) stop('JOB_INVALID', 'Authoring Host needs an observed version or an explicit unverified reason.');
  unique(task.fixedValues.map(item => item.name), 'Fixed value names', 'JOB_INVALID');
  unique(task.acceptance.map(item => item.id), 'Acceptance IDs', 'JOB_INVALID');
  if (folded(taskFile) !== folded(path.join(roots.evidence, TASK_NAME))) stop('JOB_INVALID', `Task must be the caller-owned evidence-root ${TASK_NAME}.`);

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
  if (overlaps(checkout, evidence) || overlaps(registry, evidence)) stop('ROOT_CONFLICT', 'Source checkout/registry overlaps the evidence root.');
  const outputs = [['draft', draft], ['producer', producer], ['evidence', evidence]];
  for (const [name, root] of outputs) {
    if (root.split(path.sep).some(part => HOST_DIRS.includes(part.toLowerCase()))) stop('ROOT_CONFLICT', `The ${name} root is a managed Host path.`);
  }
  outputs.forEach(([name, root], index) => {
    for (const [other, otherRoot] of outputs.slice(index + 1)) if (overlaps(root, otherRoot)) stop('ROOT_CONFLICT', `The ${name} and ${other} roots overlap.`);
    for (const input of [checkout, registry, ...managed, ...protectedRoots]) if (overlaps(root, input)) stop('ROOT_CONFLICT', `The ${name} root overlaps a source, managed or protected root.`);
  });

  // The installed author-contract closure: exactly the eighteen reviewed files, byte-pinned, with the fork loader mechanism.
  const entryPin = task.installed.filter(pin => path.basename(pin.path) === 'SKILL.md');
  if (entryPin.length !== 1) stop('CLOSURE_MISSING', 'The installed pins must name exactly one author-contract SKILL.md.');
  const installedRoot = path.dirname(path.resolve(entryPin[0].path));
  if (path.basename(installedRoot) !== 'author-contract') stop('CLOSURE_MISSING', 'The installed folder must be named author-contract.');
  const installedPaths = new Map();
  for (const rel of INSTALLED) {
    const expected = path.join(installedRoot, ...rel.split('/'));
    const matches = task.installed.filter(pin => folded(pin.path) === folded(expected));
    if (matches.length !== 1) stop('CLOSURE_MISSING', `The installed author-contract closure lacks a pin for ${rel}.`, 'failed', rel);
    installedPaths.set(folded(expected), { rel, pin: matches[0] });
  }
  if (installedPaths.size !== task.installed.length) stop('CLOSURE_MISSING', 'The installed pins are not exactly the eighteen reviewed author-contract files.');
  let entryBytes, bindingBytes, jobSchemaBytes;
  for (const rel of INSTALLED) {
    const pin = task.installed.find(item => folded(item.path) === folded(path.join(installedRoot, ...rel.split('/'))));
    const bytes = pinned(pin, limits.installed, `Installed author-contract ${rel}`, 'CLOSURE_MISSING');
    if (rel === 'SKILL.md') entryBytes = bytes;
    if (rel === 'assets/claude-binding.json') bindingBytes = bytes;
    if (rel === 'assets/job.schema.json') jobSchemaBytes = bytes;
  }
  loaderFrontmatter(entryBytes, bindingBytes);
  const helperSchema = parseJson(jobSchemaBytes, 'Installed author-contract job schema', 'CLOSURE_MISSING');
  try { auditSchema(helperSchema); } catch (error) { stop('CLOSURE_MISSING', error.message); }

  // Runtime: the running Node by physical path, this installed script and the packaged validator.
  if (Number(process.versions.node.split('.')[0]) < 24) stop('RUNTIME_MISMATCH', 'Runtime must be Node >=24.');
  if (folded(runtime.executable.path) !== folded(fs.realpathSync(process.execPath))) stop('RUNTIME_MISMATCH', 'Runtime must be this Node executable, selected by its physical path.');
  pinned(runtime.executable, limits.executable, 'Runtime executable', 'RUNTIME_MISMATCH');
  if (folded(runtime.checker.path) !== folded(scriptFile)) stop('RUNTIME_MISMATCH', 'Checker must be this actually installed script.');
  pinned(runtime.checker, limits.small, 'Installed checker', 'RUNTIME_MISMATCH');
  pinned(runtime.validator, limits.executable, 'Packaged validator', 'RUNTIME_MISMATCH');
  if (folded(runtime.validator.path) !== folded(path.join(checkout, 'dist', 'cli.js'))) stop('RUNTIME_MISMATCH', 'Validator must be the selected checkout dist/cli.js.');

  // The draft job template: only the rules draft-pair.mjs enforces itself, plus agreement with the task.
  const bad = reason => stop('TEMPLATE_INVALID', reason);
  if (template.mode !== task.operation || template.intent !== task.intent || template.definition !== definition) {
    bad('The template mode/intent/definition differ from the task operation/intent/definition.');
  }
  if (!template.id.trim() || !template.objective.trim()) bad('The template needs a non-empty id and objective.');
  if (folded(absolute(template.source.checkout, 'Template source checkout', 'TEMPLATE_INVALID')) !== folded(checkout)) bad('The template source checkout differs from the task checkout.');
  if (folded(absolute(template.source.registry, 'Template source registry', 'TEMPLATE_INVALID')) !== folded(registry)) bad('The template source registry differs from the task registry.');
  if (template.source.head !== source.head) bad('The template source head differs from the task head.');
  if (folded(absolute(template.draftRoot, 'Template draft root', 'TEMPLATE_INVALID')) !== folded(draft)) bad('The template draft root differs from the task draft root.');
  if (folded(absolute(template.evidenceRoot, 'Template evidence root', 'TEMPLATE_INVALID')) !== folded(evidence)) bad('The template evidence root differs from the task evidence root.');
  if (!same(template.managedRoots.map(r => folded(absolute(r, 'Template managed root', 'TEMPLATE_INVALID'))).sort(), managed.map(folded).sort())) bad('The template managedRoots differ from the task managed roots.');
  if (!same(template.protectedRoots.map(r => folded(absolute(r, 'Template protected root', 'TEMPLATE_INVALID'))).sort(), protectedRoots.map(folded).sort())) bad('The template protectedRoots differ from the task protected roots.');
  if (!same([...template.fixedValues].sort(), task.fixedValues.map(item => item.value).sort())) bad('The template fixedValues differ from the task fixedValues.');

  const allowed = template.allowedPaths.map(file => relative(file, 'TEMPLATE_INVALID'));
  unique(allowed, 'Allowed paths', 'TEMPLATE_INVALID');
  if (allowed.some(file => file !== corePath && file !== contractPath) || (task.operation !== 'update' && allowed.length !== 2)) {
    bad('Only the derived pair paths are permitted in allowedPaths (both are required for create and reuse).');
  }

  const installedFile = rel => path.join(installedRoot, ...rel.split('/'));
  const checkInstalledShortPin = (pin, expectedRel, label) => {
    const file = absolute(pin.path, label, 'TEMPLATE_INVALID');
    if (folded(file) !== folded(installedFile(expectedRel))) bad(`${label} is not the pinned installed ${expectedRel}.`);
    const instEntry = installedPaths.get(folded(file));
    if (!instEntry || pin.sha256 !== instEntry.pin.sha256) bad(`${label} hash differs from the installed pin.`);
  };
  checkInstalledShortPin(template.loading.entry, 'SKILL.md', 'Loading entry');
  checkInstalledShortPin(template.loading.attribution, 'references/skill-attribution.md', 'Loading attribution');
  checkInstalledShortPin(template.loading.binding, 'assets/claude-binding.json', 'Loading binding');
  unique(template.loading.requiredFiles.map(item => item.path), 'Loading required files', 'TEMPLATE_INVALID');
  if (template.loading.requiredFiles.length !== INSTALLED.length) bad('Loading requiredFiles must cover all eighteen installed author-contract files.');
  for (const item of template.loading.requiredFiles) {
    const file = absolute(item.path, 'Loading required file', 'TEMPLATE_INVALID');
    const instEntry = installedPaths.get(folded(file));
    if (!instEntry || item.sha256 !== instEntry.pin.sha256) bad('A loading required file is not one of the pinned installed files.');
  }

  if (folded(absolute(template.validator.runtime.path, 'Template validator runtime', 'TEMPLATE_INVALID')) !== folded(runtime.executable.path)
    || template.validator.runtime.sha256 !== runtime.executable.sha256) bad('Template validator.runtime differs from the task runtime executable pin.');
  if (folded(absolute(template.validator.cli.path, 'Template validator cli', 'TEMPLATE_INVALID')) !== folded(runtime.validator.path)
    || template.validator.cli.sha256 !== runtime.validator.sha256) bad('Template validator.cli differs from the task runtime validator pin.');

  for (const pin of [...template.source.pins, ...template.provenance.evidence]) {
    const file = absolute(pin.path, 'Template input pin', 'TEMPLATE_INVALID');
    if (within(draft, file)) bad('Writable draft contains a required input.');
    shortPinned(pin, limits.small, 'Template input pin', 'TEMPLATE_INVALID');
  }
  if (!template.provenance.author.trim() || !template.provenance.license.trim()) bad('Provenance needs a real author and licence.');
  if (template.provenance.unresolved.length) bad('Required provenance remains unresolved.');
  if ((template.provenance.disposition === 'adapted') !== Boolean(template.provenance.upstream)) {
    bad('Adapted work needs upstream metadata and original/inspired work must not carry it.');
  }
  let upstreamLicenseBytes = null;
  if (template.provenance.upstream) {
    const up = template.provenance.upstream;
    relative(up.path, 'TEMPLATE_INVALID');
    for (const pin of [up.source, up.license, up.comparison, ...up.notices.map(notice => notice.source)]) {
      const file = absolute(pin.path, 'Upstream evidence', 'TEMPLATE_INVALID');
      if (within(draft, file)) bad('Upstream evidence is inside the writable draft.');
      shortPinned(pin, limits.small, 'Upstream evidence', 'TEMPLATE_INVALID');
    }
    for (const notice of up.notices) relative(notice.targetPath, 'TEMPLATE_INVALID');
    upstreamLicenseBytes = shortPinned(up.license, limits.small, 'Upstream licence', 'TEMPLATE_INVALID');
  }

  const seenBindings = new Set();
  for (const binding of template.bindings) {
    const key = `${binding.kind}:${binding.id}`;
    if (seenBindings.has(key)) bad(`Duplicate binding declaration: ${key}.`);
    seenBindings.add(key);
    if (binding.required && !binding.evidence.length) bad(`Required binding lacks evidence: ${key}.`);
    for (const pin of binding.evidence) {
      const file = absolute(pin.path, 'Binding evidence', 'TEMPLATE_INVALID');
      if (within(draft, file)) bad('Binding source is inside the writable draft.');
      if (binding.required) shortPinned(pin, limits.small, 'Binding evidence', 'TEMPLATE_INVALID');
    }
  }

  if (task.operation === 'reuse') {
    if (!isObject(template.proposal)) bad('A reuse task template must carry proposal.coreFile and proposal.contractFile.');
    for (const [rel, pin] of [[corePath, template.proposal.coreFile], [contractPath, template.proposal.contractFile]]) {
      const file = absolute(pin.path, 'Reuse pair file', 'TEMPLATE_INVALID');
      if (folded(file) !== folded(path.join(registry, ...rel.split('/')))) bad('Reused pair must match the selected input registry and definition.');
      const bytes = shortPinned(pin, budget.maxCandidateFileBytes, 'Reuse pair file', 'TEMPLATE_INVALID');
      if (rel === contractPath) {
        const parsed = parseJson(bytes, 'Reuse companion contract', 'TEMPLATE_INVALID');
        try { validate(parsed, helperSchema.properties.proposal.properties.contract, 'reuseContract'); } catch (error) { bad(error.message); }
        if (parsed.definition !== definition) bad('Reused companion definition must match the fixed task definition.');
      }
    }
  } else if (Object.hasOwn(template, 'proposal')) {
    bad('A create or update task template must not pre-fill proposal.');
  }

  let templateText = null;
  if (task.intent === 'upstream') {
    if (!isObject(template.contributionTemplate) || task.contributionTemplate === null) bad('Upstream intent needs the pinned contribution template.');
    const file = absolute(template.contributionTemplate.path, 'Contribution template', 'TEMPLATE_INVALID');
    if (folded(file) !== folded(path.join(checkout, '.github', 'PULL_REQUEST_TEMPLATE', 'artifact-contribution.md'))) {
      bad('Use the existing artifact-contribution template inside the selected checkout.');
    }
    if (folded(task.contributionTemplate.path) !== folded(file) || template.contributionTemplate.sha256 !== task.contributionTemplate.sha256) {
      bad('The contribution template pin names a different file or hash.');
    }
    templateText = decode(pinned(task.contributionTemplate, limits.installed, 'Contribution template', 'TEMPLATE_INVALID'));
  } else if (Object.hasOwn(template, 'contributionTemplate') || task.contributionTemplate !== null) {
    bad('A local task carries no contribution template.');
  }

  // Roles and baseline (the pinned immutable copies); state checks against the live draft follow below.
  const roleOf = new Map();
  for (const item of task.roles) { relative(item.path, 'JOB_INVALID'); roleOf.set(item.path, item.role); }
  unique(task.roles.map(item => item.path), 'Role paths', 'JOB_INVALID');
  if (roleOf.get(corePath) !== 'subject' || roleOf.get(contractPath) !== 'subject') stop('JOB_INVALID', `${corePath} and ${contractPath} must both have role subject.`);
  if (task.operation !== 'update' ? task.baseline.length > 0 || template.baseline.length > 0 : task.baseline.length === 0) {
    stop('BASELINE_MISMATCH', task.operation !== 'update' ? 'A create or reuse task has no baseline.' : 'An update task needs the full baseline inventory.');
  }
  for (const file of [...allowed, ...task.baseline.map(item => item.path)]) if (!roleOf.has(file)) stop('JOB_INVALID', `The roles do not cover ${file}.`);
  if (task.baseline.length > budget.maxCandidateFiles || task.baseline.some(item => item.bytes > budget.maxCandidateFileBytes)
    || task.baseline.reduce((sum, item) => sum + item.bytes, 0) > budget.maxCandidateBytes) stop('LIMIT', 'The baseline is over the task candidate budget.', 'unavailable');
  unique(task.baseline.map(item => relative(item.path, 'BASELINE_MISMATCH')), 'Baseline paths', 'BASELINE_MISMATCH');
  const baselineBytes = new Map();
  for (const item of task.baseline) {
    const snapshotFile = absolute(item.snapshot, 'Baseline snapshot', 'BASELINE_MISMATCH');
    if (!within(evidence, snapshotFile) || folded(snapshotFile) === folded(taskFile)) stop('BASELINE_MISMATCH', `Baseline snapshot is outside the evidence root: ${item.path}.`, 'failed', item.path);
    const bytes = pinned({ path: item.snapshot, bytes: item.bytes, sha256: item.sha256 }, budget.maxCandidateFileBytes, `Baseline snapshot ${item.path}`, 'BASELINE_MISMATCH');
    try { decode(bytes); } catch { stop('BASELINE_MISMATCH', `Baseline snapshot is not UTF-8 text: ${item.path}.`, 'failed', item.path); }
    baselineBytes.set(item.path, bytes);
  }
  unique(task.baseline.map(item => item.snapshot), 'Baseline snapshots', 'BASELINE_MISMATCH');
  const expectedTemplateBaseline = task.baseline.map(item => ({ path: item.path, bytes: item.bytes, sha256: item.sha256, snapshot: { path: item.snapshot, sha256: item.sha256 } }));
  if (!same([...template.baseline].sort(byPath), [...expectedTemplateBaseline].sort(byPath))) {
    stop('BASELINE_MISMATCH', 'The template baseline differs from the task baseline.');
  }
  if (task.operation === 'update' && (!baselineBytes.has(corePath) || !baselineBytes.has(contractPath))) {
    stop('BASELINE_MISMATCH', 'An update baseline must include both pair files.');
  }
  for (const note of template.protectedNotes) {
    const rel = relative(note.path, 'TEMPLATE_INVALID');
    if (task.operation !== 'update') bad('protectedNotes apply only when updating an existing baseline.');
    if (!baselineBytes.has(rel) || !decode(baselineBytes.get(rel)).includes(note.contains)) {
      bad(`Protected note fragment is absent from the baseline: ${rel}.`);
    }
  }
  const baselineInventory = task.baseline.map(item => ({ path: item.path, kind: 'file', bytes: item.bytes, sha256: item.sha256 })).sort(byPath);

  // A fixed read-only identity query; no executable, argv, shell or env comes from the task.
  const identity = spawnSync('git', ['-C', checkout, 'rev-parse', '--verify', 'HEAD'], {
    encoding: 'utf8', windowsHide: true, timeout: 10000, maxBuffer: 65536,
  });
  if (identity.status !== 0 || identity.stdout.trim() !== source.head) stop('CHECKOUT_HEAD', 'Selected checkout HEAD changed or unavailable.');

  // The live state is a preflight question; once a return is checked, the draft is the run's output instead.
  if (!withResult) {
    const extra = strays(draft);
    if (extra.length) stop('ROOT_CONFLICT', `The draft parent holds entries besides the draft folder: ${extra[0]}.`, 'failed', extra[0]);
    const live = snapshot(draft, budget, 'BASELINE_MISMATCH');
    if (task.operation !== 'update' && live !== null) stop('BASELINE_MISMATCH', 'Create and reuse require an absent draft root.');
    if (task.operation === 'update' && (live === null || !same(live.inventory, baselineInventory))) {
      stop('BASELINE_MISMATCH', 'The live draft is not the pinned baseline (stale, edited, missing or incomplete).');
    }
    watchDraft(draft, budget, 'BASELINE_MISMATCH', live);
  }

  return {
    task, template, allowed, roleOf, draft, producer, budget, templateText, baselineBytes, baselineInventory,
    definition, corePath, contractPath, pairPaths, helperSchema, upstreamLicenseBytes,
    taskPin: pinOut({ path: path.resolve(taskFile), bytes: taskBytes.length, sha256: hash(taskBytes) }), taskDigest: hash(canonical(task)),
    baselineDigest: task.operation === 'update' ? hash(canonical(baselineInventory)) : null,
    pins: { runtime: pinOut(runtime.executable), checker: pinOut(runtime.checker), validator: pinOut(runtime.validator), installed: task.installed.map(pinOut) },
  };
}

function checkReturn(ctx, resultArg) {
  phase = 'postflight';
  const {
    task, template, allowed, roleOf, draft, producer, budget, baselineBytes, baselineInventory,
    definition, corePath, contractPath, pairPaths, helperSchema, upstreamLicenseBytes,
  } = ctx;
  const returnFile = path.join(producer, RETURN_NAME);
  const resultFile = absolute(resultArg, 'Result', 'RESULT_PATH');
  if (folded(resultFile) !== folded(returnFile)) stop('RESULT_PATH', `The return must be the producer-root ${RETURN_NAME}.`);
  const returnBytes = watch(resultFile, limits.envelope, 'Return', 'RESULT_INVALID');
  const ret = parseJson(returnBytes, 'Return', 'RESULT_INVALID');
  conform(ret, loadSchema('contract-return', 'RESULT_INVALID'), 'return', () => 'RESULT_INVALID');
  const { helper } = ret;
  const helperParts = [helper.draftJob, helper.stdout, helper.stderr, helper.exitCode];
  if (helper.runs === 0 ? helperParts.some(part => part !== null) || ret.status !== 'blocked' : helperParts.some(part => part === null)) {
    stop('RESULT_INVALID', 'helper.runs, the helper pins/exit code and the status contradict each other.');
  }
  if (ret.status === 'blocked' && ret.openItems.length === 0) stop('RESULT_INVALID', 'A blocked return needs a named open item.');
  unique(ret.inventory.map(item => item.path), 'Return inventory', 'RESULT_INVALID');
  unique(ret.changed.map(item => item.path), 'Return changed paths', 'RESULT_INVALID');
  unique(ret.openItems.map(item => item.id), 'Return open items', 'RESULT_INVALID');
  if (ret.taskId !== task.id || ret.taskDigest !== ctx.taskDigest) stop('DIGEST_MISMATCH', 'The return echoes a different task id or task digest.');

  // The pinned helper files, all under the producer root.
  const underProducer = (pin, label) => {
    const file = absolute(pin.path, label, 'HELPER_RECORD');
    if (!within(producer, file) || folded(file) === folded(returnFile)) stop('HELPER_RECORD', `${label}: not a file under the producer root.`);
  };
  let jobBytes = null, stdoutBytes = null, stderrBytes = null;
  if (helper.runs === 1) {
    [[helper.draftJob, 'Saved draft job', limits.helperJob], [helper.stdout, 'Helper stdout', budget.maxHelperStdoutBytes], [helper.stderr, 'Helper stderr', limits.helperStderr]]
      .forEach(([pin, label, cap], index) => {
        underProducer(pin, label);
        const bytes = pinned(pin, cap, label, 'HELPER_RECORD');
        if (index === 0) jobBytes = bytes; else if (index === 1) stdoutBytes = bytes; else stderrBytes = bytes;
      });
  }
  if (ret.report !== null) { underProducer(ret.report, 'Return report'); pinned(ret.report, limits.report, 'Return report', 'HELPER_RECORD'); }
  let report = null;
  if (helper.runs === 1) {
    if (helper.exitCode === 0) {
      report = parseJson(stdoutBytes, 'Helper stdout', 'HELPER_RECORD');
      if (!isObject(report) || report.status !== 'draft-prepared' || stderrBytes.length !== 0) {
        stop('HELPER_RECORD', 'Exit 0 needs a draft-prepared report on stdout and an empty stderr.');
      }
    } else {
      const blocked = parseJson(stderrBytes, 'Helper stderr', 'HELPER_RECORD');
      if (stdoutBytes.length !== 0 || !isObject(blocked) || blocked.status !== 'blocked' || typeof blocked.reason !== 'string') {
        stop('HELPER_RECORD', 'Exit 1 needs an empty stdout and a blocked JSON record on stderr.');
      }
    }
    if ((ret.status === 'draft') !== (helper.exitCode === 0)) stop('BLOCKED_STATE', `A ${ret.status} return cannot rest on helper exit ${helper.exitCode}.`);
  }

  // The saved draft job equals the template plus proposal, nothing else, and satisfies the installed job schema.
  let saved = null;
  const expectedFiles = new Map();
  const reusedFiles = [];
  if (helper.runs === 1) {
    saved = parseJson(jobBytes, 'Saved draft job', 'DRAFT_JOB_MISMATCH');
    const mismatch = reason => stop('DRAFT_JOB_MISMATCH', reason);
    if (!isObject(saved)) mismatch('The saved draft job is not an object.');
    conform(saved, helperSchema, 'savedJob', () => 'DRAFT_JOB_MISMATCH');
    const expectedKeys = [...new Set([...Object.keys(template), 'proposal'])].sort();
    if (!same(Object.keys(saved).sort(), expectedKeys)) mismatch('The saved draft job keys differ from the template plus proposal.');
    for (const key of Object.keys(template)) {
      if (!same(saved[key], template[key])) mismatch(`The saved draft job differs from the template at ${key}.`);
    }
    const proposal = saved.proposal;
    if (!isObject(proposal)) mismatch('The saved draft job proposal must be an object.');
    const proposalKeys = task.operation === 'create' ? ['core', 'body', 'contract'] : task.operation === 'reuse' ? ['coreFile', 'contractFile'] : ['coreText', 'contract'];
    if (task.operation === 'update') {
      if (!Object.keys(proposal).length || Object.keys(proposal).some(key => !proposalKeys.includes(key))) {
        mismatch('Update proposal must contain coreText and/or contract.');
      }
    } else if (Object.keys(proposal).length !== proposalKeys.length || proposalKeys.some(key => !Object.hasOwn(proposal, key))) {
      mismatch(`${task.operation}: proposal must supply exactly ${proposalKeys.join(', ')}.`);
    }

    if (ret.status === 'draft') {
      if (task.operation === 'create') {
        if (proposal.contract.definition !== definition) mismatch('Companion definition in proposal must match the task definition.');
        const coreText = `---\n${Object.entries(proposal.core).map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join('\n')}\n---\n${proposal.body}`;
        expectedFiles.set(corePath, Buffer.from(coreText));
        expectedFiles.set(contractPath, Buffer.from(`${JSON.stringify(proposal.contract, null, 2)}\n`));
      } else if (task.operation === 'reuse') {
        for (const [rel, pin] of [[corePath, proposal.coreFile], [contractPath, proposal.contractFile]]) {
          reusedFiles.push({ path: pin.path, sha256: pin.sha256 });
          expectedFiles.set(rel, shortPinned(pin, budget.maxCandidateFileBytes, 'Reused source file', 'DRAFT_JOB_MISMATCH'));
        }
      } else {
        for (const [rel, bytes] of baselineBytes) expectedFiles.set(rel, bytes);
        for (const [key, value] of Object.entries(proposal)) {
          const rel = key === 'coreText' ? corePath : contractPath;
          if (!allowed.includes(rel)) stop('DRAFT_JOB_MISMATCH', `Update outside the allowed scope: ${rel}.`, 'failed', rel);
          expectedFiles.set(rel, Buffer.from(key === 'coreText' ? value : `${JSON.stringify(value, null, 2)}\n`));
        }
        const finalContract = parseJson(expectedFiles.get(contractPath), 'Final companion contract', 'DRAFT_JOB_MISMATCH');
        try { validate(finalContract, helperSchema.properties.proposal.properties.contract, 'finalContract'); } catch (error) { mismatch(error.message); }
        if (finalContract.definition !== definition) mismatch('Final companion definition must match the task definition.');
      }
      for (const value of template.fixedValues) {
        if (![corePath, contractPath].some(file => expectedFiles.get(file).toString('utf8').includes(value))) {
          mismatch(`Missing fixed value in proposed pair: ${value}.`);
        }
      }
    }
  }

  // The draft folder itself.
  const extra = strays(draft);
  if (extra.length) stop('BLOCKED_STATE', `A staging or foreign entry is left in the draft parent: ${extra[0]}.`, 'failed', extra[0]);
  const live = snapshot(draft, budget, 'INVENTORY_MISMATCH');
  watchDraft(draft, budget, 'INVENTORY_MISMATCH', live);
  const result = { path: resultFile, bytes: returnBytes.length, sha256: hash(returnBytes) };
  if (ret.status === 'blocked') {
    if (task.operation !== 'update' ? live !== null : live === null || !same(live.inventory, baselineInventory)) {
      stop('BLOCKED_STATE', 'A blocked return needs the draft root exactly as before the run.');
    }
    if (ret.changed.length) stop('BLOCKED_STATE', 'A blocked return cannot claim changed files.');
    if (!same([...ret.inventory].sort(byPath), live ? live.inventory.map(stripKind) : [])) {
      stop('INVENTORY_MISMATCH', 'The returned inventory differs from the untouched draft state.');
    }
    if (ret.externalActions.length) stop('EXTERNAL_ACTION', 'externalActions must be empty in the report and the return.');
    return { result, helper: { exitCode: helper.exitCode, reportStatus: 'blocked' }, candidate: null };
  }
  if (live === null) stop('INVENTORY_MISMATCH', 'A draft return needs a draft folder.');

  const final = live.files;
  for (const file of baselineBytes.keys()) {
    if (!final.has(file)) stop('SCOPE_VIOLATION', `A baseline file is gone (draft-pair.mjs never deletes): ${file}.`, 'failed', file);
  }
  for (const file of final.keys()) {
    if (!baselineBytes.has(file) && !allowed.includes(file)) {
      stop('SCOPE_VIOLATION', `A new file is neither an allowed pair path nor baseline: ${file}.`, 'failed', file);
    }
  }
  const updatedPaths = new Set(
    task.operation === 'update'
      ? Object.keys(saved.proposal).map(key => (key === 'coreText' ? corePath : contractPath))
      : [corePath, contractPath],
  );
  for (const [file, before] of baselineBytes) {
    const unchanged = final.get(file).equals(before);
    if (!unchanged && (roleOf.get(file) === 'preservation-only' || !updatedPaths.has(file) || !allowed.includes(file))) {
      stop('PRESERVATION', `A preserved baseline file differs from its baseline bytes: ${file}.`, 'failed', file);
    }
  }
  for (const note of template.protectedNotes) {
    const rel = relative(note.path, 'PRESERVATION');
    if (!final.has(rel) || !decode(final.get(rel)).includes(note.contains)) {
      stop('PRESERVATION', `Protected note changed or missing: ${rel}.`, 'failed', rel);
    }
  }
  if (!final.has(corePath) || !final.has(contractPath)) stop('BYTES_MISMATCH', 'A complete contract draft needs both pair files.');
  for (const [file, expected] of expectedFiles) {
    if (!final.has(file) || !final.get(file).equals(expected)) {
      stop('BYTES_MISMATCH', `Final bytes differ from the saved proposal: ${file}.`, 'failed', file);
    }
  }

  // Reconstruct the helper report components and compare against the return and the helper's stdout report.
  const strippedInventory = live.inventory.map(stripKind);
  if (!same([...ret.inventory].sort(byPath), strippedInventory)) stop('INVENTORY_MISMATCH', 'The returned inventory differs from the recomputed one.');
  const helperInventory = live.inventory.map(({ path: file, sha256, bytes }) => ({ path: file, sha256, bytes }));
  if (!Array.isArray(report.inventory) || !same(report.inventory, helperInventory)) {
    stop('INVENTORY_MISMATCH', 'The helper report inventory differs from the recomputed one.');
  }
  const changedEntries = [...expectedFiles]
    .filter(([file, bytes]) => !baselineBytes.has(file) || !baselineBytes.get(file).equals(bytes));
  const diff = changedEntries.map(([file, bytes]) => ({
    path: file,
    before: baselineBytes.has(file) ? baselineBytes.get(file).toString('utf8') : null,
    after: bytes.toString('utf8'),
  })).sort(byPath);
  const unchanged = helperInventory.filter(item => !changedEntries.some(([rel]) => rel === item.path));
  if (!same(report.unchanged, unchanged)) stop('INVENTORY_MISMATCH', 'The helper report unchanged list differs from the recomputed one.');
  if (!Array.isArray(report.diff) || !same([...report.diff].sort(byPath), diff)) stop('DIFF_MISMATCH', 'The helper report diff differs from the diff rebuilt from the baseline and the saved proposal.');
  const changed = diff.map(item => ({ path: item.path, operation: item.before === null ? 'create' : 'update' }));
  if (!same([...ret.changed].sort(byPath), changed)) stop('DIFF_MISMATCH', 'The returned changed list differs from the rebuilt diff.');

  // Provenance and upstream notice retention.
  const retainedNotices = [];
  let retainedLicense = false;
  for (const notice of template.provenance.upstream?.notices ?? []) {
    const rel = relative(notice.targetPath, 'PROVENANCE_MISMATCH');
    const bytes = shortPinned(notice.source, limits.small, 'Required notice', 'PROVENANCE_MISMATCH');
    const target = final.get(rel);
    if (!target || !(notice.mode === 'file' ? target.equals(bytes) : target.includes(bytes))) {
      stop('PROVENANCE_MISMATCH', `Required upstream notice bytes not retained: ${rel}.`, 'failed', rel);
    }
    if (upstreamLicenseBytes && bytes.equals(upstreamLicenseBytes)) retainedLicense = true;
    retainedNotices.push({ sourcePath: notice.source.path, targetPath: rel, sha256: hash(bytes), mode: notice.mode });
  }
  if (template.provenance.upstream && !retainedLicense) {
    stop('PROVENANCE_MISMATCH', 'The inspected upstream licence bytes must be retained in the final pair or unchanged baseline.');
  }
  if (!same(report.provenance, { ...template.provenance, review: 'pending' }) || !same(report.retainedNotices, retainedNotices)) {
    stop('PROVENANCE_MISMATCH', 'The helper report provenance or retainedNotices differ from the template provenance.');
  }

  // Bindings against final contract.
  const finalContract = parseJson(final.get(contractPath), 'Final companion contract', 'HELPER_RECORD');
  const declaredBindings = new Map();
  for (const binding of template.bindings) {
    const key = `${binding.kind}:${binding.id}`;
    if (!finalContract[`${binding.kind}s`].includes(binding.id)) stop('DRAFT_JOB_MISMATCH', `Binding is not permitted by the final contract: ${key}.`);
    declaredBindings.set(key, binding);
  }
  const bindingFindings = [];
  for (const kind of ['skill', 'workflow', 'hook']) {
    for (const id of finalContract[`${kind}s`]) {
      const binding = declaredBindings.get(`${kind}:${id}`);
      const finding = { kind, id, required: binding?.required ?? false, source: 'unavailable', execution: 'unverified', evidence: [] };
      if (binding?.evidence.length) {
        try {
          for (const pin of binding.evidence) {
            const file = absolute(pin.path, 'Binding source', 'HELPER_RECORD');
            if (within(draft, file)) stop('HELPER_RECORD', 'Binding source is inside the writable draft.');
            shortPinned(pin, limits.small, 'Binding source', 'HELPER_RECORD');
            finding.evidence.push(pin);
          }
          finding.source = 'checked';
        } catch (error) {
          finding.reason = error instanceof Error ? error.message : String(error);
        }
      }
      if (finding.required && finding.source !== 'checked') stop('HELPER_RECORD', `Required ${kind} binding unavailable: ${id}.`);
      bindingFindings.push(finding);
    }
  }
  const sameBindingFindings = (actualList, expectedList) => Array.isArray(actualList) && actualList.length === expectedList.length
    && expectedList.every((expected, index) => {
      const actual = actualList[index];
      if (!isObject(actual)) return false;
      const hasReason = Object.hasOwn(expected, 'reason');
      const expectedKeys = ['evidence', 'execution', 'id', 'kind', ...(hasReason ? ['reason'] : []), 'required', 'source'];
      if (!same(Object.keys(actual).sort(), expectedKeys)) return false;
      if (hasReason && (typeof actual.reason !== 'string' || !actual.reason.trim())) return false;
      const { reason: _actualReason, ...actualRest } = actual;
      const { reason: _expectedReason, ...expectedRest } = expected;
      return same(actualRest, expectedRest);
    });

  if (!same(report.externalActions, []) || ret.externalActions.length) stop('EXTERNAL_ACTION', 'externalActions must be empty in the report and the return.');
  const protectedNotesOut = template.protectedNotes.map(note => ({ ...note, preserved: true }));
  const keys = [
    'acceptedDraft', 'bindingFindings', 'checksExecuted', 'diff', 'digest', 'externalActions', 'intent', 'inventory',
    'live', 'mode', 'protectedNotes', 'provenance', 'quality', 'retainedNotices', 'reusedFiles', 'sourceHead',
    'status', 'unchanged', 'validation', ...(task.intent === 'upstream' ? ['upstreamPreparation'] : []),
  ].sort();
  if (!same(Object.keys(report).sort(), keys)
    || report.mode !== task.operation || report.intent !== task.intent || report.acceptedDraft !== false
    || report.digest !== hash(canonical(saved)) || !same(report.protectedNotes, protectedNotesOut)
    || !same(report.reusedFiles, reusedFiles) || !sameBindingFindings(report.bindingFindings, bindingFindings)
    || report.sourceHead !== task.source.head || !same(report.checksExecuted, ['git rev-parse HEAD'])
    || report.validation !== 'unverified' || report.quality !== 'pending' || report.live !== 'unverified') {
    stop('HELPER_RECORD', 'The helper report differs from the report rebuilt from the saved job and final files.');
  }
  if (task.intent === 'upstream') {
    const up = report.upstreamPreparation;
    if (!isObject(up) || !same(Object.keys(up).sort(), ['base', 'body', 'sent', 'templatePath'])) {
      stop('HELPER_RECORD', 'The upstream preparation record has unexpected keys.');
    }
    if (up.sent !== false || up.base !== 'dev' || typeof up.body !== 'string' || !up.body.startsWith(ctx.templateText)) {
      stop('EXTERNAL_ACTION', 'An upstream preparation must be unsent, based on dev and begin with the pinned template.');
    }
    const { upstreamPreparation: _prepared, ...rest } = report;
    if (up.templatePath !== template.contributionTemplate.path
      || up.body !== `${ctx.templateText}\n\n## Prepared shared pair evidence\n\n${JSON.stringify(rest, null, 2)}\n`) {
      stop('HELPER_RECORD', 'The upstream preparation differs from the pinned template plus the prepared shared pair evidence.');
    }
  }
  const preserved = [...baselineBytes.keys()].filter(file => final.get(file).equals(baselineBytes.get(file))).sort();
  return {
    result,
    helper: { exitCode: helper.exitCode, reportStatus: 'draft-prepared' },
    candidate: {
      draftRoot: draft, definition, pairPaths, inventory: live.inventory,
      candidateDigest: hash(canonical(live.inventory)), changed, preserved,
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
      'check-contract-return --job <absolute-contract-task.json> [--result <absolute-contract-return.json>]\n'
      + 'Checks fixed shared definition-and-contract task and return records; does not run draft-pair.mjs, validators or a fork.\n'
      + 'Does not prove who ran the helper, that it ran exactly once, or semantic usefulness.\n',
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
      definition: ctx.definition, pairPaths: ctx.pairPaths,
      taskDigest: ctx.taskDigest, baselineDigest: ctx.baselineDigest, pins: ctx.pins, ...post,
      ...(values.result ? { claimsNotAccepted: ['inventory', 'changed', 'claimedChecks'], producerIdentity: 'unauthenticated' } : {}),
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
