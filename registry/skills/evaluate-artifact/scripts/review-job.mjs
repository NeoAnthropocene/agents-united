#!/usr/bin/env node
import { parseArgs } from 'node:util';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';

// Builds the fixed review job of one candidate for the caller (the coordinator), never for the read-only evaluator.
// The caller hands over only its decisions in one spec file; this script computes every pin, writes
// <review>/checks/<id>.raw.txt and <id>.receipt.json for each check the caller ran, the byte-identical copies the evaluator may cite
// into the read folder (a sibling of the review root) and <review>/job.json. It never runs a check command: its only child process is
// `git -C <checkout> rev-parse --verify HEAD`. It never writes inside the candidate. check-review.mjs stays the authority: the caller
// runs it on the written job afterwards. The path, name, decoding and schema rules below repeat that checker's on purpose (one script
// does not import another), so a job this script writes is accepted by the checker at the first call unless bytes drift in between.
// What it verifies: a check's pre-run candidate digest against the current one, its status against its exit code, and that its saved
// output exists. What it only records as the caller's statement: that the command ran, with that exit code and that output.
const fail = message => { throw new Error(message); };
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const canonical = value => Array.isArray(value) ? `[${value.map(canonical).join(',')}]`
  : value !== null && typeof value === 'object' ? `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`
    : JSON.stringify(value);
const same = (a, b) => canonical(a) === canonical(b);
// Containment that grants coverage compares exact case where the filesystem is case-sensitive. A refusal also uses the checker's
// case-folded comparison, so the builder is never laxer than the checker; it may be stricter (see references/job.md).
const CASELESS = process.platform === 'win32';
const exact = file => (CASELESS ? path.resolve(file).toLowerCase() : path.resolve(file));
const folded = file => path.resolve(file).toLowerCase();
const inside = rel => rel === '' || (rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel));
const within = (parent, child) => inside(path.relative(exact(parent), exact(child)));
const withinFolded = (parent, child) => inside(path.relative(folded(parent), folded(child)));
const unique = (values, label) => { if (new Set(values.map(value => value.toLowerCase())).size !== values.length) fail(`${label}: duplicate/case-colliding values.`); };
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const byPath = (a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
/** A Claude agent's invariant coverage file sits beside it: `<agent without .md>.coverage.json` (ADR 0072). */
const coveragePathOf = rel => rel.replace(/\.md$/, '.coverage.json');
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SHA = /^[a-f0-9]{64}$/;
const HOST_DIRS = ['.agents', '.claude', '.cline', '.cursor', '.codex', '.opencode', '.gemini'];
const NOFOLLOW = fs.constants.O_NOFOLLOW ?? 0;
const ENVELOPE = 262144;
const skillRoot = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const workspace = path.resolve(skillRoot, '../../..');
// job.schema.json's bounds of each caller-selectable limit; the default is the maximum. The three fixed flags are not selectable.
const LIMITS = { maxCandidateFiles: [1, 32], maxCandidateFileBytes: [1, 262144], maxCandidateBytes: [1, 1048576],
  maxEvidenceFiles: [1, 64], maxEvidenceFileBytes: [1, 1048576], maxEvidenceBytes: [1, 8388608],
  maxResultBytes: [1, 262144], maxFindings: [0, 32], maxOpenItems: [0, 16], maxChecks: [0, 6], maxSeconds: [1, 600], maxLogBytes: [1, 524288],
  maxExecutableBytes: [1, 134217728] };
const GUIDE_PAGES = { agent: 'agent/sub-agents.md', skill: 'skill/skills.md', hook: 'hook/hooks.md', tools: 'tools/tools-reference.md', orchestration: 'orchestration/workflows.md', rule: 'rule/memory.md' };
// A Skill or Claude agent with a Claude target pins these five; a rule review pins only its own guide and page.
const TARGET_GUIDES = ['agent', 'skill', 'hook', 'tools', 'orchestration'];
// The kinds whose subject is one file, with the checker their route runs on it and the folder of the registry copy it may also name
// (a workflow review pins only the orchestration guide and page, a rule review only the rule ones). candidatePath says whether the check
// may also name the candidate's own file: a rule's may, a workflow's may not, because workflow-check passes only at
// registry/hosts/claude/workflows/<name>.js. exactSpelling says the recorded path must be one expected spelling, compared as written
// (rawSpelling: only the kind of separator may differ, and only on Windows) and in exact case on every platform, and the registry copy must sit
// on a folder chain without a link (a link, a "." or ".." segment, another letter case or a registry folder not named exactly "registry" is
// refused by workflow-check itself, so a path that merely reaches the same file proves nothing); a rule's path is compared by its physical file. check-review.mjs holds the same table.
const SINGLE_FILE_KINDS = {
  rule: { noun: 'rule', check: 'rule-check', extension: '.md', registryFolder: ['rules'], candidatePath: true, exactSpelling: false, guide: 'rule' },
  workflow: { noun: 'workflow', check: 'workflow-check', extension: '.js', registryFolder: ['hosts', 'claude', 'workflows'], candidatePath: false, exactSpelling: true, guide: 'orchestration' },
};
// Input kinds the caller may add as extra evidence; every other kind is computed here.
const EVIDENCE_KINDS = ['provenance', 'validator', 'source', 'baseline', 'diff', 'observation', 'rule'];
const STATUSES = ['passed', 'failed', 'unavailable', 'not-run'];
const ROLES = ['subject', 'support', 'preservation-only'];

function absolute(value, label) {
  if (typeof value !== 'string' || !path.isAbsolute(value) || value.includes('\0') || value.split(/[\\/]/).some(part => part === '.' || part === '..')) fail(`${label}: expected absolute path without traversal aliases.`);
  if (process.platform === 'win32' && !/^[A-Za-z]:[\\/]/.test(value)) fail(`${label}: expected a drive-letter path on Windows.`);
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
function bytesAt(file, cap, label) {
  const stat = fs.lstatSync(file, { throwIfNoEntry: false });
  if (!stat?.isFile()) fail(`${label}: missing ordinary file ${file}.`);
  if (stat.size > cap) fail(`${label}: byte budget exceeded.`);
  const fd = fs.openSync(file, fs.constants.O_RDONLY | NOFOLLOW);
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
const decode = (bytes, label) => {
  try { return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes); }
  catch { return fail(`${label}: not UTF-8 text.`); }
};
const jsonAt = (file, cap, label) => {
  const text = decode(bytesAt(file, cap, label), label);
  try { return JSON.parse(text); } catch (error) { return fail(`${label}: invalid JSON: ${error.message}`); }
};
const pinOf = (file, bytes) => ({ path: file, bytes: bytes.length, sha256: hash(bytes) });

// The checker's schema vocabulary and validation, so a job is refused here before anything is written.
const schemaVocabulary = new Set(['$schema', 'title', 'description', 'type', 'const', 'enum', 'properties', 'required', 'additionalProperties', 'items', 'minItems', 'maxItems', 'minLength', 'maxLength', 'pattern', 'minimum', 'maximum']);
function auditSchema(schema) {
  if (!isObject(schema)) fail('Required executable schema must be an object.');
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
  } else if (isObject(value)) {
    for (const key of schema.required ?? []) if (!Object.hasOwn(value, key)) fail(`${label}: missing ${key}.`);
    for (const [key, child] of Object.entries(value)) {
      if (!Object.hasOwn(schema.properties ?? {}, key)) fail(`${label}: unknown property ${key}.`);
      validate(child, schema.properties[key], `${label}.${key}`);
    }
  }
}
/** The checker's candidate snapshot within the selected budget: sorted path/kind/length/hash entries, links and non-UTF-8 files refused. */
function snapshot(dir, budget) {
  const inventory = [];
  let total = 0, directories = 0;
  const walk = (current, prefix = '') => {
    if (++directories > 128) fail('Candidate directory budget exceeded.');
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const rel = relative(prefix + entry.name), file = path.join(current, entry.name);
      if (entry.isSymbolicLink()) fail(`Linked candidate path: ${rel}.`);
      if (entry.isDirectory()) walk(file, `${rel}/`);
      else if (entry.isFile()) {
        if (inventory.length >= budget.maxCandidateFiles) fail('Candidate file budget exceeded.');
        const bytes = bytesAt(file, budget.maxCandidateFileBytes, 'Candidate');
        decode(bytes, `Candidate ${rel}`);
        total += bytes.length;
        if (total > budget.maxCandidateBytes) fail('Candidate total-byte budget exceeded.');
        inventory.push({ path: rel, kind: 'file', bytes: bytes.length, sha256: hash(bytes) });
      } else fail(`Unsupported candidate path: ${rel}.`);
    }
  };
  if (!fs.statSync(dir, { throwIfNoEntry: false })?.isDirectory()) fail('Candidate root unavailable.');
  walk(dir);
  unique(inventory.map(item => item.path), 'Candidate');
  return inventory.sort(byPath);
}
/** Writes a new file created exclusively beside the destination, then renames it over the destination: an existing inode, hard-linked or not, is never opened for writing. */
// The temporary name is short and random, independent of the destination name. After its exclusive creation one scope covers the
// write, the close and the rename, and every unsuccessful exit removes the temporary file.
function replaceFile(file, bytes) {
  const temp = path.join(path.dirname(file), `.rj-${randomBytes(8).toString('hex')}.tmp`);
  const fd = fs.openSync(temp, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | NOFOLLOW, 0o644);
  let open = true, moved = false;
  try {
    let offset = 0;
    while (offset < bytes.length) {
      const written = fs.writeSync(fd, bytes, offset, bytes.length - offset);
      if (!(written > 0)) fail(`Writing ${file} made no progress.`);
      offset += written;
    }
    fs.closeSync(fd);
    open = false;
    fs.renameSync(temp, file);
    moved = true;
  } finally {
    if (open) { try { fs.closeSync(fd); } catch { /* the original error is reported */ } }
    if (!moved) fs.rmSync(temp, { force: true });
  }
}
/**
 * The physical identity of a path for comparisons: the native real path of its deepest existing ancestor (which spells out every
 * alias that is not a link, such as an NTFS short name, and the volume's own case) with the not-yet-existing rest appended.
 * Links are refused on the path as given before this is called.
 */
function physical(file) {
  const resolved = path.resolve(file);
  const rest = [];
  for (let current = resolved; ;) {
    // Only ENOENT and ENOTDIR walk up; any other error (EACCES, EPERM, ...) is refused, never read as "absent".
    try { return path.join(fs.realpathSync.native(current), ...rest); } catch (error) {
      if (error?.code !== 'ENOENT' && error?.code !== 'ENOTDIR') fail(`Cannot resolve the physical path of ${current}: ${error?.code ?? error}.`);
    }
    const parent = path.dirname(current);
    if (parent === current) return resolved;
    rest.unshift(path.basename(current));
    current = parent;
  }
}
// The recorded spelling of a workflow's registry copy is compared as written: only the kind of separator may differ, and only on Windows, where
// workflow-check takes either. A "." or ".." segment, a doubled separator or another letter case is another spelling (workflow-check refuses it).
const separators = value => (process.platform === 'win32' ? value.replace(/\\/g, '/') : value);
const rawSpelling = (file, given) => typeof given === 'string'
  && !given.split(process.platform === 'win32' ? /[\\/]/ : '/').some(part => part === '.' || part === '..') && separators(file) === separators(given);
// True when no folder from the root down to the file, and not the file, is a link or junction (check-review.mjs refuses the same through its bytesAt).
const unlinked = file => {
  let current = path.parse(path.resolve(file)).root;
  for (const part of path.resolve(file).slice(current.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    if (fs.lstatSync(current, { throwIfNoEntry: false })?.isSymbolicLink()) return false;
  }
  return true;
};
// A refusal holds when the paths overlap as the checker compares them (case-folded strings) or physically (case-folded real paths).
const overlaps = (a, b) => [[a, b], [physical(a), physical(b)]].some(([x, y]) => withinFolded(x, y) || withinFolded(y, x));
const insideAny = (parent, child) => withinFolded(parent, child) || withinFolded(physical(parent), physical(child));
const sameFile = (a, b) => folded(a) === folded(b) || folded(physical(a)) === folded(physical(b));

// ---- The spec: only the caller's decisions. ----
function keys(value, required, optional, label) {
  if (!isObject(value)) fail(`${label}: expected an object.`);
  for (const key of required) if (!Object.hasOwn(value, key)) fail(`${label}: missing ${key}.`);
  for (const key of Object.keys(value)) if (!required.includes(key) && !optional.includes(key)) fail(`${label}: unknown property ${key}.`);
  return value;
}
const text = (value, label, max = 8192) => { if (typeof value !== 'string' || !value.length || value.length > max) fail(`${label}: expected a text of 1 to ${max} characters.`); return value; };
const slug = (value, label) => { if (typeof value !== 'string' || value.length > 80 || !SLUG.test(value)) fail(`${label}: expected a kebab-case identifier of at most 80 characters.`); return value; };
/** An observed version or an explicit reason it is not known: exactly one of the two. */
function hostRecord(value, label) {
  keys(value, [], ['observedVersion', 'unverifiedReason'], label);
  const observedVersion = value.observedVersion ?? null, unverifiedReason = value.unverifiedReason ?? null;
  if ((observedVersion === null) === (unverifiedReason === null)) fail(`${label} needs an observed version or an explicit unverified reason.`);
  if (observedVersion !== null) text(observedVersion, `${label} observedVersion`);
  if (unverifiedReason !== null) text(unverifiedReason, `${label} unverifiedReason`);
  return { host: 'claude', product: 'Claude Code CLI', scope: 'workspace', lane: 'native', observedVersion, unverifiedReason };
}
/** The caller may only lower a limit; every limit not given is the schema maximum. */
function budgetOf(value) {
  const budget = Object.fromEntries(Object.entries(LIMITS).map(([key, [, max]]) => [key, max]));
  if (value !== undefined) {
    keys(value, [], Object.keys(LIMITS), 'Spec budget');
    for (const [key, limit] of Object.entries(value)) {
      const [min, max] = LIMITS[key];
      if (!Number.isInteger(limit) || limit < min || limit > max) fail(`Spec budget ${key} must be an integer from ${min} to ${max}.`);
      budget[key] = limit;
    }
  }
  return { ...budget, externalCalls: 0, publication: false, repair: false };
}

function readSpec(specFile) {
  const spec = jsonAt(specFile, ENVELOPE, 'Spec');
  keys(spec, ['version', 'id', 'intent', 'authoringHost', 'subject', 'objective', 'constraints', 'acceptance', 'source', 'roots', 'provenance'],
    ['fixedValues', 'roles', 'checks', 'evidence', 'rubricReasons', 'budget'], 'Spec');
  if (spec.version !== 1) fail('Spec: version must be 1.');
  slug(spec.id, 'Spec id');
  if (spec.intent !== 'local' && spec.intent !== 'upstream') fail('Spec intent must be local or upstream.');
  const budget = budgetOf(spec.budget);
  const subject = keys(spec.subject, ['kind', 'identity'], ['definition', 'target'], 'Spec subject');
  if (!['skill', 'shared-pair', 'claude-agent', 'rule', 'workflow'].includes(subject.kind)) fail('Spec subject kind must be skill, shared-pair, claude-agent, rule or workflow.');
  slug(subject.identity, 'Spec subject identity');
  const definition = subject.definition ?? (subject.kind === 'shared-pair' ? subject.identity : null);
  if (subject.kind === 'skill' && definition !== null) fail('A Skill-only review has no shared definition.');
  if (subject.kind === 'rule' && definition !== null) fail('A rule review has no shared definition.');
  if (subject.kind === 'workflow' && definition !== null) fail('A workflow review has no shared definition.');
  if (!(subject.kind in SINGLE_FILE_KINDS) && subject.kind !== 'skill') slug(definition, 'Spec subject definition');
  if (subject.kind === 'shared-pair' && definition !== subject.identity) fail('Shared definition must match the host-neutral pair identity.');
  const target = subject.target === undefined || subject.target === null ? null : hostRecord(subject.target, 'Target Host');
  if (subject.kind === 'claude-agent' && !target) fail('Claude agent review requires its explicit target context.');
  if (subject.kind === 'rule' && !target) fail('Rule review requires its explicit target context.');
  if (subject.kind === 'workflow' && !target) fail('Workflow review requires its explicit target context.');
  if (subject.kind === 'shared-pair' && target) fail('Shared definition must match the host-neutral pair identity.');
  const source = keys(spec.source, ['checkout', 'head', 'registry'], [], 'Spec source');
  if (typeof source.head !== 'string' || !/^[a-f0-9]{40}$/.test(source.head)) fail('Spec source head must be a full 40-character commit id.');
  keys(spec.roots, ['candidate', 'review', 'readFolder'], ['managed', 'protected'], 'Spec roots');
  for (const name of ['managed', 'protected']) if (spec.roots[name] !== undefined && !Array.isArray(spec.roots[name])) fail(`Spec roots ${name} must be a list.`);
  const roles = spec.roles ?? {};
  if (!isObject(roles)) fail('Spec roles must map candidate paths to roles.');
  for (const [rel, role] of Object.entries(roles)) { relative(rel); if (!ROLES.includes(role)) fail(`Spec role for ${rel} must be subject, support or preservation-only.`); }
  const checks = spec.checks ?? [];
  if (!Array.isArray(checks) || checks.length > budget.maxChecks) fail(`Spec checks must be a list of at most ${budget.maxChecks} (the budget's maxChecks).`);
  for (const check of checks) {
    keys(check, ['id', 'required', 'status', 'command'], ['candidateDigest', 'exit', 'output'], 'Spec check');
    slug(check.id, 'Spec check id');
    if (typeof check.required !== 'boolean') fail(`Spec check ${check.id}: required must be true or false.`);
    if (!STATUSES.includes(check.status)) fail(`Spec check ${check.id}: status must be passed, failed, unavailable or not-run.`);
    keys(check.command, ['argv', 'cwd'], ['executable'], `Spec check ${check.id} command`);
    if (!Array.isArray(check.command.argv) || check.command.argv.length > 24) fail(`Spec check ${check.id}: argv must be a list of at most 24 texts.`);
    check.command.argv.forEach((arg, index) => text(arg, `Spec check ${check.id} argv[${index}]`));
    if (check.candidateDigest !== undefined && (typeof check.candidateDigest !== 'string' || !SHA.test(check.candidateDigest))) fail(`Spec check ${check.id}: candidateDigest must be the 64-character digest printed by --digest.`);
  }
  unique(checks.map(check => check.id), 'Check IDs');
  const evidence = spec.evidence ?? [];
  if (!Array.isArray(evidence)) fail('Spec evidence must be a list.');
  for (const item of evidence) {
    keys(item, ['id', 'kind', 'path'], ['required', 'sections'], 'Spec evidence');
    slug(item.id, 'Spec evidence id');
    if (!EVIDENCE_KINDS.includes(item.kind)) fail(`Spec evidence ${item.id}: kind must be one of ${EVIDENCE_KINDS.join(', ')}; every other input kind is computed.`);
    if (item.required !== undefined && typeof item.required !== 'boolean') fail(`Spec evidence ${item.id}: required must be true or false.`);
    if (item.sections !== undefined && (!Array.isArray(item.sections) || item.sections.length > 24)) fail(`Spec evidence ${item.id}: sections must be a list of at most 24 texts.`);
    (item.sections ?? []).forEach((section, index) => text(section, `Spec evidence ${item.id} sections[${index}]`));
  }
  const provenance = keys(spec.provenance, ['disposition', 'author'], ['unresolved', 'notices', 'upstream'], 'Spec provenance');
  if (provenance.notices !== undefined && (!Array.isArray(provenance.notices) || provenance.notices.length > 32)) fail('Spec provenance notices must be a list of at most 32 candidate paths.');
  if (provenance.upstream !== undefined && provenance.upstream !== null) keys(provenance.upstream, ['sourceId', 'licenceId', 'comparisonId'], ['noticeIds'], 'Spec provenance upstream');
  const reasons = spec.rubricReasons ?? {};
  if (!isObject(reasons)) fail('Spec rubricReasons must map criterion ids to reasons.');
  for (const [id, reason] of Object.entries(reasons)) {
    if (typeof reason !== 'string') fail(`Spec rubricReasons ${id}: a reason is a text; applicability is computed and cannot be set.`);
    text(reason, `Spec rubricReasons ${id}`);
  }
  return { spec, budget, subject: { kind: subject.kind, identity: subject.identity, definition, target } };
}

/** The current candidate digest, exactly as the job will compute it; reads the spec and the candidate and writes nothing. */
function digestOnly(specArg) {
  if (Number(process.versions.node.split('.')[0]) < 24) fail('Node >=24 required.');
  const { spec, budget } = readSpec(absolute(specArg, 'Spec argument'));
  const inventory = snapshot(absolute(spec.roots.candidate, 'Candidate root'), budget);
  return { version: 1, status: 'candidate-digest', candidateDigest: hash(canonical(inventory)), files: inventory.length };
}

function build(specArg) {
  if (Number(process.versions.node.split('.')[0]) < 24) fail('Node >=24 required.');
  const specFile = absolute(specArg, 'Spec argument');
  const { spec, budget, subject } = readSpec(specFile);

  // Roots: absolute, link-free; the review root and the read folder are output roots, disjoint from every input.
  const candidate = absolute(spec.roots.candidate, 'Candidate root');
  const review = absolute(spec.roots.review, 'Review root');
  const readFolder = absolute(spec.roots.readFolder, 'Read folder');
  const checkout = absolute(spec.source.checkout, 'Source checkout');
  const registry = absolute(spec.source.registry, 'Source registry');
  const managed = (spec.roots.managed ?? []).map(root => absolute(root, 'Managed root'));
  const protectedRoots = (spec.roots.protected ?? []).map(root => absolute(root, 'Protected root'));
  for (const [name, dir] of [['candidate', candidate], ['checkout', checkout], ['registry', registry]]) {
    if (!fs.statSync(dir, { throwIfNoEntry: false })?.isDirectory()) fail(`${name}: required directory unavailable.`);
  }
  // The checker's order and wording: the review root's overlap with every input first, then its managed Host segment; the read
  // folder follows the same order. A checkout inside a folder named like a Host folder therefore still yields the overlap reason.
  // A managed Host folder in the root as given or in its physical spelling (a short name such as CLAUDE~1 hides `.claude` from the
  // string): check-review.mjs refuses both, so the builder does too and never writes a job the checker refuses.
  const managedSegment = root => [root, physical(root)].some(spelling => spelling.split(path.sep).some(part => HOST_DIRS.includes(part.toLowerCase())));
  for (const root of [candidate, checkout, registry, readFolder, ...managed, ...protectedRoots]) {
    if (overlaps(review, root)) fail('Review output root overlaps candidate/source/read/managed/protected inputs.');
  }
  if (managedSegment(review)) fail('Review output root is a managed Host path.');
  for (const root of [candidate, checkout, registry, ...managed, ...protectedRoots]) {
    if (overlaps(readFolder, root)) fail('Read folder overlaps candidate/source/managed/protected inputs.');
  }
  if (managedSegment(readFolder)) fail('Read folder is a managed Host path.');
  if (exact(path.dirname(readFolder)) !== exact(path.dirname(review))) fail('Read folder must be a sibling of the review root.');
  for (const [name, root] of [['Review root', review], ['Read folder', readFolder]]) {
    const stat = fs.lstatSync(root, { throwIfNoEntry: false });
    if (stat && !stat.isDirectory()) fail(`${name} exists and is not a folder.`);
    if (!fs.statSync(path.dirname(root), { throwIfNoEntry: false })?.isDirectory()) fail(`${name}: its parent folder does not exist.`);
  }

  // This installed Skill: its receipt names this script and the checker, so both are pinned as loading inputs.
  const receiptFile = path.join(skillRoot, 'assets/claude-binding.json');
  if (!fs.existsSync(receiptFile)) fail('Run the installed review-job.mjs under <workspace>/.claude/skills/evaluate-artifact/scripts; the binding receipt beside it is missing.');
  const binding = jsonAt(receiptFile, ENVELOPE, 'Installed binding');
  if (binding.skill !== 'evaluate-artifact' || binding.roles?.length !== 1 || binding.roles[0].name !== 'factory-evaluator'
    || binding.roles[0].loading !== 'subagent' || binding.roles[0].guard !== 'read-only') fail('Required evaluator loading mechanism differs.');
  for (const rel of ['scripts/check-review.mjs', 'scripts/review-job.mjs']) if (!binding.requiredSupport?.includes(rel)) fail(`The installed binding does not declare ${rel}.`);

  // Candidate inventory, roles and digest. The kind fixes some roles; the spec gives every other one.
  const inventory = snapshot(candidate, budget);
  const fixed = subject.kind === 'skill' ? { 'SKILL.md': 'subject' }
    : subject.kind === 'shared-pair' ? { [`core/${subject.definition}.contract.json`]: 'subject', [`core/${subject.definition}.core.md`]: 'subject' }
      : subject.kind in SINGLE_FILE_KINDS ? { [`${subject.identity}${SINGLE_FILE_KINDS[subject.kind].extension}`]: 'subject' } : {};
  for (const rel of Object.keys(fixed)) if (!inventory.some(item => item.path === rel)) fail(`The ${subject.kind} candidate lacks its fixed subject file ${rel}.`);
  for (const rel of Object.keys(spec.roles ?? {})) if (!inventory.some(item => item.path === rel)) fail(`Spec role names a path absent from the candidate: ${rel}.`);
  const files = inventory.map(item => {
    const given = spec.roles?.[item.path], kindRole = fixed[item.path];
    if (kindRole && given && given !== kindRole) fail(`The ${subject.kind} kind fixes the role of ${item.path} as ${kindRole}.`);
    if (!kindRole && given === 'subject' && subject.kind === 'shared-pair') fail('Shared definition pair paths are incomplete or substituted.');
    const role = kindRole ?? given;
    if (!role) fail(`Spec roles lack the role of candidate file ${item.path}.`);
    return { ...item, role };
  });
  const paths = files.filter(item => item.role === 'subject').map(item => item.path);
  if (!paths.length) fail('The candidate needs at least one subject file.');
  // A rule or a workflow is one file: exactly one subject, at <identity>.md or <identity>.js (check-review.mjs refuses the same job).
  const single = SINGLE_FILE_KINDS[subject.kind];
  if (single && (paths.length !== 1 || paths[0] !== `${subject.identity}${single.extension}`)) fail(`A ${single.noun} review has exactly one subject file, ${subject.identity}${single.extension}.`);
  // The route's checker ran: such a job records an executed, required check of its route (check-review.mjs requires its validator inputs).
  if (single && !(spec.checks ?? []).some(check => check.id === single.check && check.required === true && (check.status === 'passed' || check.status === 'failed'))) {
    fail(`A ${single.noun} review needs its executed ${single.check}: record a required check with the id ${single.check} that was run.`);
  }
  const candidateDigest = hash(canonical(inventory));

  // Computed inputs: [id, kind, absolute file].
  const computed = [['evaluator-entry', 'loading', path.join(skillRoot, 'SKILL.md')], ['evaluator-receipt', 'loading', receiptFile]];
  const idOf = rel => `evaluator-${rel.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}`.slice(0, 80).replace(/-+$/, '');
  for (const rel of binding.requiredSupport) computed.push([idOf(relative(rel)), 'loading', path.join(skillRoot, rel)]);
  for (const ref of binding.references ?? []) computed.push([idOf(relative(ref.installed).split('/').slice(3).join('/')), 'loading', path.join(workspace, ref.installed)]);
  for (const role of binding.roles) computed.push([`evaluator-role-${role.name}`, 'loading', path.join(workspace, relative(role.installed))]);
  computed.push(['evaluator-guard', 'guard', path.join(workspace, '.claude/hooks/agents-united-readonly-guard.js')]);
  const hostDir = path.join(registry, 'hosts/claude'), library = path.join(checkout, 'host-library/claude');
  computed.push(['host-profile', 'profile', path.join(hostDir, 'profile.json')], ['host-tool-policy', 'tool-policy', path.join(hostDir, 'tool-policy.json')],
    ['host-library-lock', 'library-lock', path.join(library, 'library.lock.json')]);
  for (const file of ['profile.json', 'tool-policy.json']) if (jsonAt(path.join(hostDir, file), budget.maxEvidenceFileBytes, 'Host prerequisite').host !== 'claude') fail('Selected prerequisite belongs to a different Host.');
  const libraryLock = jsonAt(path.join(library, 'library.lock.json'), budget.maxEvidenceFileBytes, 'Library lock');
  if (libraryLock.host !== 'claude') fail('Selected library lock belongs to a different Host.');
  const guideKinds = single ? [single.guide] : subject.target !== null ? TARGET_GUIDES : subject.kind === 'skill' ? ['skill'] : [];
  for (const kind of guideKinds) {
    computed.push([`${kind}-guide`, 'guide', path.join(library, 'guide', `${kind}.md`)]);
    const rel = `pages/${GUIDE_PAGES[kind]}`, file = path.join(library, rel);
    if (libraryLock.files?.[rel]?.sha256 !== `sha256:${hash(bytesAt(file, budget.maxEvidenceFileBytes, `Snapshot ${rel}`))}`) fail(`Selected snapshot differs from its library lock: ${rel}.`);
    computed.push([`${kind}-page`, 'snapshot', file]);
  }
  if (subject.kind === 'claude-agent') {
    computed.push(['shared-core', 'shared-core', path.join(registry, 'core', `${subject.definition}.core.md`)],
      ['shared-contract', 'shared-contract', path.join(registry, 'core', `${subject.definition}.contract.json`)]);
  }
  if (spec.intent === 'upstream') computed.push(['contribution-template', 'template', path.join(checkout, '.github/PULL_REQUEST_TEMPLATE/artifact-contribution.md')]);
  const runtimeFile = fs.realpathSync(process.execPath);
  const runtime = pinOf(runtimeFile, bytesAt(runtimeFile, budget.maxExecutableBytes, 'Runtime executable'));
  const checker = path.join(skillRoot, 'scripts/check-review.mjs');
  const sources = [specFile, runtimeFile, ...computed.map(([, , file]) => file)];

  // Checks: the caller ran them; this script records what the caller states and refuses what it can see is wrong.
  const copies = []; // [name in the read folder, bytes, input id, kind, required, sections]
  const writes = []; // [absolute file, bytes]
  const extraRoots = [];
  let logBytes = 0;
  const checks = (spec.checks ?? []).map(check => {
    const cwd = absolute(check.command.cwd, `Check ${check.id} cwd`);
    const executableFile = check.command.executable === undefined ? runtimeFile : absolute(check.command.executable, `Check ${check.id} executable`);
    const executed = check.status === 'passed' || check.status === 'failed';
    const exit = check.exit ?? null;
    if (exit !== null && !(Number.isInteger(exit) && exit >= -2147483648 && exit <= 2147483647)) fail(`Check ${check.id}: exit must be an integer.`);
    if (!executed) {
      if (exit !== null || check.output !== undefined || check.candidateDigest !== undefined) fail(`Unperformed check has execution claims: ${check.id}.`);
    } else {
      if (exit === null) fail(`Check ${check.id}: a ${check.status} check needs the exit code the caller saw.`);
      if ((check.status === 'passed') !== (exit === 0)) fail(`Check status contradicts its exit code: ${check.id} is ${check.status} with exit ${exit}.`);
      if (check.output === undefined) fail(`Check ${check.id}: a ${check.status} check needs its saved output file.`);
      if (check.candidateDigest === undefined) fail(`Check ${check.id}: a ${check.status} check needs the candidate digest printed by --digest before the check ran.`);
      if (check.candidateDigest !== candidateDigest) fail(`Check ${check.id}: the candidate changed after the check ran (its pre-run digest ${check.candidateDigest} differs from the current ${candidateDigest}).`);
    }
    const exeStat = fs.lstatSync(executableFile, { throwIfNoEntry: false });
    if (executed && !exeStat?.isFile()) fail(`Check ${check.id}: executable unavailable.`);
    const executable = exeStat?.isFile() ? pinOf(executableFile, bytesAt(executableFile, budget.maxExecutableBytes, `Check ${check.id} executable`)) : { path: executableFile, bytes: null, sha256: null };
    if (exeStat?.isFile()) sources.push(executableFile);
    if (exact(executableFile) !== exact(runtimeFile)) {
      if (exeStat?.isFile()) extraRoots.push(executableFile);
      else {
        // A missing executable of an unperformed check: its existing parent folder is declared, never a filesystem root.
        const parent = path.dirname(executableFile);
        if (!fs.lstatSync(parent, { throwIfNoEntry: false })?.isDirectory() || path.parse(parent).root === parent) fail(`Check ${check.id}: its executable is missing and its parent folder cannot be declared as a read root.`);
        extraRoots.push(parent);
      }
    }
    const command = { executable, argv: check.command.argv, cwd };
    if (!executed) return { id: check.id, required: check.required, status: check.status, command, candidateDigest, exit: null, raw: null, receipt: null };
    const outputFile = absolute(check.output, `Check ${check.id} output`);
    if (insideAny(candidate, outputFile)) fail(`Check ${check.id}: the saved output lies inside the candidate.`);
    sources.push(outputFile);
    const rawBytes = bytesAt(outputFile, Math.min(budget.maxLogBytes, budget.maxEvidenceFileBytes), `Check ${check.id} output`);
    decode(rawBytes, `Check ${check.id} output`);
    if ((logBytes += rawBytes.length) > budget.maxLogBytes) fail('Raw check log total-byte budget exceeded.');
    const raw = pinOf(path.join(review, 'checks', `${check.id}.raw.txt`), rawBytes);
    const receiptBytes = Buffer.from(`${JSON.stringify({ version: 1, id: check.id, kind: 'deterministic', command, candidateDigest, status: check.status, exit, raw }, null, 2)}\n`);
    const receipt = pinOf(path.join(review, 'checks', `${check.id}.receipt.json`), receiptBytes);
    writes.push([raw.path, rawBytes], [receipt.path, receiptBytes]);
    copies.push([`${check.id}.raw.txt`, rawBytes, `${check.id}-raw`, 'validator', true, []], [`${check.id}.receipt.json`, receiptBytes, `${check.id}-receipt`, 'validator', true, []]);
    return { id: check.id, required: check.required, status: check.status, command, candidateDigest, exit, raw, receipt };
  });
  // A rule or workflow job's check records the documented command on the file under review. Only the record is compared: the command
  // is the caller's statement (this script never runs it), and check-review.mjs refuses the same job with the same reasons.
  if (single) {
    const recorded = checks.find(item => item.id === single.check);
    const cli = path.join(checkout, 'dist/cli.js');
    const [first, verb, flag, artifact, ...rest] = recorded.command.argv;
    if (exact(physical(recorded.command.executable.path)) !== exact(physical(runtimeFile)) || rest.length > 0
      || typeof first !== 'string' || !path.isAbsolute(first) || exact(physical(first)) !== exact(physical(cli)) || verb !== single.check || flag !== '--artifact' || artifact === undefined) {
      fail(`The ${single.check} must record the command node <checkout>/dist/cli.js ${single.check} --artifact <the ${single.noun} file>.`);
    }
    const reviewed = `${subject.identity}${single.extension}`;
    // A rule's own candidate file may be the one under review; a workflow's never (candidatePath). A registry spelling counts only when that file exists as an ordinary
    // file with the pinned bytes of the candidate's file: a path alone says nothing about which file the check read.
    const pinned = inventory.find(item => item.path === reviewed)?.sha256;
    const sameBytes = file => {
      const stat = fs.lstatSync(file, { throwIfNoEntry: false });
      return stat?.isFile() === true && (!single.exactSpelling || unlinked(file)) && stat.size <= budget.maxEvidenceFileBytes && hash(bytesAt(file, budget.maxEvidenceFileBytes, `Registry ${single.noun}`)) === pinned;
    };
    // The declared registry spelling counts only where the folder is named exactly "registry", as workflow-check requires; the checkout's own is always so named.
    const registryNamed = !single.exactSpelling || path.basename(registry) === 'registry';
    const own = [...(single.candidatePath ? [[path.join(candidate, reviewed), true]] : []), ...(registryNamed ? [[path.join(registry, ...single.registryFolder, reviewed), false]] : []), [path.join(checkout, 'registry', ...single.registryFolder, reviewed), false]];
    const sameSpelling = (file, given) => (single.exactSpelling ? rawSpelling(file, given) : exact(physical(file)) === exact(physical(given)));
    if (typeof artifact !== 'string' || !path.isAbsolute(artifact) || !own.some(([file, isCandidate]) => sameSpelling(file, artifact) && (isCandidate || sameBytes(file)))) {
      const folder = single.registryFolder.join('/');
      fail(single.candidatePath
        ? `The ${single.check} must check this review's own ${single.noun} file: the candidate's <identity>${single.extension} or <registry>/${folder}/<identity>${single.extension}.`
        : `The ${single.check} must check the registry copy of this review's own ${single.noun}: <registry>/${folder}/<identity>${single.extension} or <checkout>/registry/${folder}/<identity>${single.extension}, a regular file with the candidate's bytes. A candidate path can never pass: ${single.check} passes only at registry/${folder}/<name>${single.extension}.`);
    }
  }

  // Extra evidence the caller exposes: copied byte-identically into the read folder; candidate bytes are never copied.
  for (const item of spec.evidence ?? []) {
    const file = absolute(item.path, `Evidence ${item.id}`);
    if (insideAny(candidate, file)) fail(`Evidence ${item.id} lies inside the candidate; the candidate is reviewed in place, never copied.`);
    sources.push(file);
    const bytes = bytesAt(file, budget.maxEvidenceFileBytes, `Evidence ${item.id}`);
    decode(bytes, `Evidence ${item.id}`);
    // The copy is named `evidence-<id><source extension>`: unique as the id, never a reserved device name such as `con`, and equal
    // basenames in different folders never collide. The input id itself is unchanged.
    copies.push([relative(`evidence-${item.id}${path.extname(file)}`), bytes, item.id, item.kind, item.required ?? true, item.sections ?? []]);
  }
  unique(copies.map(([name]) => name), 'Read-folder file names');

  const inputs = [];
  const seen = new Map();
  let evidenceBytes = 0;
  const add = (id, kind, file, bytes, required = true, sections = []) => {
    // The same file twice is one input; two names differing only in case are refused, as the checker refuses them.
    if (seen.has(exact(file))) return;
    if ([...seen.keys()].some(key => key.toLowerCase() === exact(file).toLowerCase())) fail('Input paths: duplicate/case-colliding values.');
    seen.set(exact(file), true);
    if (bytes.length > budget.maxEvidenceFileBytes) fail(`Input ${id}: byte budget exceeded.`);
    decode(bytes, `Input ${id}`);
    if ((evidenceBytes += bytes.length) > budget.maxEvidenceBytes) fail('Evidence total-byte budget exceeded.');
    inputs.push({ id, kind, ...pinOf(file, bytes), sections, status: 'clear', required });
  };
  for (const [id, kind, file] of computed) add(id, kind, file, bytesAt(file, budget.maxEvidenceFileBytes, `Input ${id}`));
  for (const [name, bytes, id, kind, required, sections] of copies) {
    const file = path.join(readFolder, name);
    add(id, kind, file, bytes, required, sections);
    writes.push([file, bytes]);
  }
  unique(inputs.map(input => input.id), 'Input IDs');
  if (inputs.length > budget.maxEvidenceFiles) fail('Evidence file budget exceeded.');
  // The checker's prerequisite predicates: a required, clear input of each kind (every input written here is clear).
  if (!inputs.some(input => input.kind === 'validator' && input.required)) fail('Missing required validator evidence: record an executed check or add a required evidence file of kind validator.');
  if (!inputs.some(input => input.kind === 'provenance' && input.required)) fail('Missing required provenance evidence: add a required evidence file of kind provenance.');

  // Provenance: the evidence list is every provenance file plus the upstream source, licence, comparison and notice files.
  const { provenance } = spec;
  if (!['original', 'inspired', 'adapted'].includes(provenance.disposition)) fail('Spec provenance disposition must be original, inspired or adapted.');
  const upstream = provenance.upstream ? { sourceId: provenance.upstream.sourceId, licenceId: provenance.upstream.licenceId,
    comparisonId: provenance.upstream.comparisonId, noticeIds: provenance.upstream.noticeIds ?? [] } : null;
  if (provenance.disposition !== 'original' && !upstream) fail(`${provenance.disposition}: pinned source, licence and comparison evidence is required.`);
  const evidenceIds = inputs.filter(input => input.kind === 'provenance').map(input => input.id);
  if (upstream) {
    for (const id of [upstream.sourceId, upstream.licenceId, upstream.comparisonId, ...upstream.noticeIds]) {
      const input = inputs.find(item => item.id === id);
      if (!input || !input.required || !(spec.evidence ?? []).some(item => item.id === id)) fail(`Missing required upstream provenance evidence pin: ${id}.`);
      if (!evidenceIds.includes(id)) evidenceIds.push(id);
    }
    unique([upstream.sourceId, upstream.licenceId, upstream.comparisonId], 'Source/licence/comparison evidence IDs');
  }
  const notices = (provenance.notices ?? []).map(rel => {
    const item = inventory.find(entry => entry.path === relative(rel));
    if (!item) fail('Required provenance notice was lost or changed.');
    return { path: item.path, sha256: item.sha256 };
  });

  // Read roots: the read folder, this Skill's folder and the selected library and Host folders; any other input or executable alone.
  const areas = [readFolder, skillRoot, library, hostDir];
  const readRoots = [];
  const addRoot = file => {
    const root = areas.find(area => within(area, file)) ?? file;
    if (!readRoots.some(existing => exact(existing) === exact(root))) readRoots.push(root);
  };
  inputs.forEach(input => addRoot(input.path));
  extraRoots.forEach(addRoot);
  for (const root of readRoots) if (overlaps(review, root)) fail('Review output root overlaps candidate/source/read/managed/protected inputs.');

  // Rubric: applicability follows the kind, the target and (for coverage evidence) whether the candidate holds a Claude agent's coverage
  // file; the caller may word the reasons.
  const rubricFile = path.join(skillRoot, 'assets/rubric.json');
  const rubricBytes = bytesAt(rubricFile, budget.maxEvidenceFileBytes, 'Rubric');
  const rubric = JSON.parse(decode(rubricBytes, 'Rubric'));
  const reasons = spec.rubricReasons ?? {};
  for (const id of Object.keys(reasons)) if (!rubric.criteria.some(item => item.id === id)) fail(`Spec rubricReasons names an unknown criterion: ${id}.`);
  // The same rule as check-review.mjs: a subject agent file (ending in .md) with its coverage file beside it in the candidate.
  const hasCoverage = subject.kind === 'claude-agent' && paths.some(rel => rel.endsWith('.md') && files.some(item => item.path === coveragePathOf(rel)));
  const criteria = rubric.criteria.map(({ id }) => {
    const applicable = id === 'shared-semantics' ? subject.kind !== 'skill' && !single : id === 'host-fit' ? subject.target !== null : id === 'coverage-evidence' ? hasCoverage : true;
    const reason = reasons[id] ?? (applicable ? `Applies to this ${subject.kind} review.`
      : id === 'shared-semantics' ? (single ? `A ${single.noun} review has no shared definition.` : 'A Skill-only review has no shared definition.')
        : id === 'coverage-evidence' ? 'The candidate holds no Claude agent coverage file.' : 'No native target is declared for this subject.');
    return { id, required: applicable, applicable, reason };
  });

  const job = {
    version: 1, id: spec.id, operation: 'review', intent: spec.intent,
    authoringHost: hostRecord(spec.authoringHost, 'Authoring Host'),
    subject: { kind: subject.kind, identity: subject.identity, target: subject.target, paths, definition: subject.definition },
    objective: spec.objective, fixedValues: spec.fixedValues ?? [], constraints: spec.constraints, acceptance: spec.acceptance,
    source: { checkout, head: spec.source.head, registry },
    roots: { candidate, read: readRoots, review, managed, protected: protectedRoots },
    candidate: { files }, inputs,
    runtime: { executable: runtime, checker: pinOf(checker, bytesAt(checker, budget.maxEvidenceFileBytes, 'Installed checker')) },
    rubric: { ...pinOf(rubricFile, rubricBytes), version: rubric.version, criteria },
    checks,
    provenance: { disposition: provenance.disposition, author: provenance.author, evidence: evidenceIds, unresolved: provenance.unresolved ?? [], notices, ...(upstream ? { upstream } : {}) },
    budget,
  };
  const schema = jsonAt(path.join(skillRoot, 'assets/job.schema.json'), ENVELOPE, 'job schema');
  auditSchema(schema);
  validate(job, schema);
  unique(job.acceptance.map(item => item.id), 'Acceptance IDs');
  unique(job.fixedValues.map(item => item.name), 'Fixed value names');
  // The selected checkout must still be at the HEAD the caller decided on; the checker tests this last, and so does the builder before
  // its output preflight. This is the only child process.
  const identity = spawnSync('git', ['-C', checkout, 'rev-parse', '--verify', 'HEAD'], { encoding: 'utf8', windowsHide: true, timeout: Math.min(10000, budget.maxSeconds * 1000), maxBuffer: 65536, shell: false });
  if (identity.status !== 0 || identity.stdout.trim() !== spec.source.head) fail('Selected checkout HEAD changed or unavailable.');

  const jobFile = path.join(review, 'job.json');
  const jobBytes = Buffer.from(`${JSON.stringify(job, null, 2)}\n`);
  if (jobBytes.length > ENVELOPE) fail('The job would be over 256 KiB.');
  writes.push([jobFile, jobBytes]);

  // Preflight every destination before the first write: no source is a destination, and no destination is a link, a folder or a non-file.
  const folders = [review, path.join(review, 'checks'), readFolder];
  for (const dir of folders) {
    const stat = fs.lstatSync(dir, { throwIfNoEntry: false });
    if (stat && (stat.isSymbolicLink() || !stat.isDirectory())) fail(`Output folder is a link or not a folder: ${dir}.`);
  }
  for (const [file] of writes) {
    if (sources.some(source => sameFile(source, file))) fail(`An input file would be overwritten by an output of this job: ${file}.`);
    const stat = fs.lstatSync(file, { throwIfNoEntry: false });
    if (stat && (stat.isSymbolicLink() || !stat.isFile())) fail(`Output path holds a link or something other than a regular file: ${file}.`);
  }
  unique(writes.map(([file]) => path.resolve(file)), 'Output paths');

  // Writes come last; each output is a new file renamed into place; the job is written after its receipts and copies.
  // A failure after the first output was moved into place says so and names the roots; job.json, written last, is then absent or stale.
  const replaced = [];
  const partly = error => fail(`Outputs were ${replaced.length === writes.length ? 'all' : 'partly'} written under the review root ${review} and the read folder ${readFolder} (${replaced.length} of ${writes.length} replaced, job.json last); do not use the job there: ${error instanceof Error ? error.message : String(error)}`);
  for (const dir of folders) if (!fs.lstatSync(dir, { throwIfNoEntry: false })) fs.mkdirSync(dir);
  for (const [file, bytes] of writes) {
    try { replaceFile(file, bytes); } catch (error) { if (replaced.length) partly(error); throw error; }
    replaced.push(file);
  }
  for (const [file, bytes] of writes) {
    let actual;
    try { actual = bytesAt(file, Math.max(ENVELOPE, budget.maxEvidenceFileBytes, budget.maxLogBytes), 'Written file'); } catch (error) { partly(error); }
    if (!actual.equals(bytes)) partly(new Error(`Written file changed after writing: ${file}.`));
  }
  // Every output, job.json included, is in place by now: a changed or vanished candidate file is reported with that fact.
  let after;
  try { after = snapshot(candidate, budget); } catch (error) { partly(error); }
  if (!same(after, inventory)) partly(new Error('Candidate changed while the job was built.'));
  // The hand-back hook (precheck-handback.mjs, ADR 0070) finds the job of a result by its digest. This pointer, in the operating system's temp folder, holds the absolute path of
  // the job file and nothing else. It is a locator only, never evidence: the checker still verifies the job's own digest against the result's. It is best effort: a job is valid without it.
  try {
    // The temp folder is resolved to its real path (on macOS /var is a link), as the hook resolves it, so that the hook finds the pointer where it is written.
    const pointers = path.join(fs.realpathSync.native(os.tmpdir()), 'agents-united', 'review-jobs');
    fs.mkdirSync(pointers, { recursive: true });
    fs.writeFileSync(path.join(pointers, `${hash(canonical(job))}.txt`), path.resolve(jobFile));
  } catch { /* no pointer, no hand-back check; the caller's check is the judge */ }
  return { version: 1, status: 'job-written', job: pinOf(jobFile, jobBytes), jobDigest: hash(canonical(job)), candidateDigest,
    counts: { files: files.length, inputs: inputs.length, checks: checks.length, copies: copies.length, readRoots: readRoots.length } };
}

const USAGE = 'review-job --spec <absolute review-spec.json> | --digest --spec <absolute review-spec.json>\nBuilds <review>/job.json, check receipts and read-folder copies from the caller\'s decisions; runs no check, writes nothing in the candidate. With --digest it only prints the current candidate digest and writes nothing; take it before each check runs. Run check-review.mjs --job on the result.\n';
try {
  const argv = process.argv.slice(2);
  for (const flag of ['spec', 'help', 'digest']) if (argv.filter(arg => arg === `--${flag}` || arg.startsWith(`--${flag}=`)).length > 1) fail(`Duplicate --${flag} selector.`);
  let parsed;
  try { parsed = parseArgs({ args: argv, options: { spec: { type: 'string' }, help: { type: 'boolean' }, digest: { type: 'boolean' } }, strict: true, allowPositionals: false }); }
  catch (error) { fail(`${USAGE.split('\n')[0]}: ${error.message}`); }
  const { help, spec, digest } = parsed.values;
  if (help && !spec && !digest) process.stdout.write(USAGE);
  else if (spec && !help) process.stdout.write(`${JSON.stringify(digest ? digestOnly(spec) : build(spec))}\n`);
  else fail('A supported absolute --spec review spec is required.');
} catch (error) {
  process.stderr.write(`${JSON.stringify({ version: 1, status: 'refused', reason: error instanceof Error ? error.message : String(error) })}\n`);
  process.exitCode = 1;
}
