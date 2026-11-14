#!/usr/bin/env node
import { parseArgs } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

// Caller-operated consistency checks only. No command in a job/result is executed.
const fail = message => { throw new Error(message); };
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const canonical = value => Array.isArray(value) ? `[${value.map(canonical).join(',')}]`
  : value !== null && typeof value === 'object' ? `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`
    : JSON.stringify(value);
const same = (a, b) => canonical(a) === canonical(b);
const folded = file => path.resolve(file).toLowerCase();
const within = (parent, child) => {
  const rel = path.relative(folded(parent), folded(child));
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel));
};
const overlaps = (a, b) => within(a, b) || within(b, a);
const unique = (values, label) => { if (new Set(values.map(value => value.toLowerCase())).size !== values.length) fail(`${label}: duplicate/case-colliding values.`); };
const skillRoot = fileURLToPath(new URL('../', import.meta.url));
const scriptFile = fileURLToPath(import.meta.url);
const limits = { envelope: 262144, executable: 134217728 };

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
  if (roots.review.split(/[\\/]/).some(part => ['.agents', '.claude', '.cline', '.cursor', '.codex', '.opencode', '.gemini'].includes(part.toLowerCase()))) fail('Review output root is a managed Host path.');
  if (folded(jobFile) !== folded(path.join(roots.review, 'job.json'))) fail('Job must be the caller-owned review-root job.json.');
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
    if (!readRoots.some(root => within(root, input.path))) fail(`Input outside declared read roots: ${input.id}.`);
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
  if (Number(process.versions.node.split('.')[0]) < 24 || folded(job.runtime.executable.path) !== folded(fs.realpathSync(process.execPath))) fail('Runtime must be this Node >=24 executable, selected by its physical path.');
  pinned(job.runtime.executable, budget.maxExecutableBytes, 'Runtime executable');
  if (folded(job.runtime.checker.path) !== folded(scriptFile)) fail('Checker must be this actually installed script.');
  pinned(job.runtime.checker, budget.maxEvidenceFileBytes, 'Installed checker');
  const hasPin = (file, kind) => job.inputs.some(input => input.required && input.status === 'clear' && folded(input.path) === folded(file) && (!kind || input.kind === kind));
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
  if (folded(job.rubric.path) !== folded(path.join(skillRoot, 'assets/rubric.json'))) fail('Review rubric must be this bundled rubric.');
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
    if (folded(executable) !== folded(job.runtime.executable.path) && !readRoots.some(root => within(root, executable))) fail('Check executable is outside the declared read scope.');
    if (check.status === 'passed' || check.status === 'failed') {
      if (check.command.executable.bytes === null || check.command.executable.sha256 === null) fail('Executed check needs an actual executable length/hash pin.');
      pinned(check.command.executable, budget.maxExecutableBytes, 'Check executable declaration');
      if ((check.status === 'passed') !== (check.exit === 0) || check.exit === null || !check.raw || !check.receipt) fail(`Check status/exit/receipt contradiction: ${check.id}.`);
      for (const [pin, suffix] of [[check.raw, 'raw.txt'], [check.receipt, 'receipt.json']]) {
        if (folded(pin.path) !== folded(path.join(roots.review, 'checks', `${check.id}.${suffix}`))) fail(`Check output path substitution: ${check.id}.`);
      }
      const raw = pinned(check.raw, budget.maxLogBytes, 'Raw check log');
      logBytes += raw.length;
      if (logBytes > budget.maxLogBytes) fail('Raw check log total-byte budget exceeded.');
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

function checkResult(record, resultFile) {
  const { job } = record;
  if (folded(absolute(resultFile, 'Result')) !== folded(path.join(job.roots.review, 'result.json'))) fail('Result must be the caller-owned review-root result.json.');
  const bytes = bytesAt(resultFile, job.budget.maxResultBytes, 'Result');
  const result = JSON.parse(decode(bytes));
  validate(result, record.resultSchema, 'result');
  if (!job.inputs.some(input => input.required && input.status === 'clear' && input.kind === 'loading'
    && folded(input.path) === folded(path.join(skillRoot, 'assets/result.schema.json')))) fail('Missing result-schema loading pin.');
  if (result.jobId !== job.id || result.jobDigest !== record.digest || result.candidateDigest !== record.candidateDigest) fail('Result fixed job/candidate digest mismatch.');
  if (!same(result.subject, job.subject) || !same(result.inventory, record.inventory)) fail('Result subject/inventory substitution.');
  const citation = cite => {
    const rel = relative(cite.path);
    let file, pin, cap;
    if (cite.sourceId === 'candidate') {
      pin = record.inventory.find(item => item.path === rel);
      if (!pin) fail(`Citation selects an unreported candidate path: ${rel}.`);
      file = path.join(job.roots.candidate, rel);
      cap = job.budget.maxCandidateFileBytes;
    } else {
      pin = job.inputs.find(input => input.id === cite.sourceId && input.status === 'clear');
      if (!pin || rel !== path.basename(pin.path)) fail('Citation selects an unavailable/unpinned input or substituted path.');
      file = pin.path;
      cap = job.budget.maxEvidenceFileBytes;
    }
    const actual = bytesAt(file, cap, 'Citation source');
    if (cite.sha256 !== pin.sha256 || hash(actual) !== pin.sha256) fail('Citation source hash mismatch.');
    const lines = decode(actual).replace(/\r\n?/g, '\n').split('\n');
    if (cite.startLine > cite.endLine || cite.endLine > lines.length || cite.endLine - cite.startLine >= 5) fail('Citation logical line range is invalid or over budget.');
    const quote = cite.quote.replace(/\r\n?/g, '\n');
    if (Buffer.byteLength(quote, 'utf8') > 1024 || quote.split('\n').length > 5
      || !lines.slice(cite.startLine - 1, cite.endLine).join('\n').includes(quote)) fail('Citation quote is absent from the pinned logical lines or over budget.');
  };
  for (const criterion of result.criteria) criterion.citations.forEach(citation);
  for (const finding of result.findings) finding.citations.forEach(citation);
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
  record.recheck();
  if (!bytesAt(resultFile, job.budget.maxResultBytes, 'Result postflight').equals(bytes)) fail('Result changed during postflight.');
  return { result: pinOf(resultFile, bytes), candidateMatch: true, opinion: result.opinion, reviewStatus: result.status };
}

try {
  for (const flag of ['job', 'result', 'help']) {
    if (process.argv.slice(2).filter(arg => arg === `--${flag}` || arg.startsWith(`--${flag}=`)).length > 1) fail(`Duplicate --${flag} selector.`);
  }
  const { values, positionals } = parseArgs({ options: { job: { type: 'string' }, result: { type: 'string' }, help: { type: 'boolean' } }, strict: true, allowPositionals: true });
  if (values.help && !values.job && !values.result && !positionals.length) {
    process.stdout.write('check-review --job <absolute-job.json> [--result <absolute-result.json>]\nChecks fixed review records; does not run validators or a reviewer.\n');
  } else if (values.job && !values.help && !positionals.length) {
    const record = checkJob(absolute(values.job, 'Job argument'));
    const result = values.result ? checkResult(record, values.result) : {};
    process.stdout.write(JSON.stringify({ version: 1, kind: 'deterministic', recordValid: true, ready: !record.unavailable.some(item => item.required),
      job: record.jobPin, jobDigest: record.digest, candidateDigest: record.candidateDigest, inventory: record.inventory,
      checks: record.checks, unavailable: record.unavailable, inputPins: record.job.inputs,
      ...result, quality: 'pending', executionProof: 'unverified', live: 'unverified', acceptedDraft: false }) + '\n');
    if (!values.result && record.unavailable.some(item => item.required)) process.exitCode = 1;
  } else throw new Error('A supported absolute --job review record is required.');
} catch (error) {
  process.stderr.write(JSON.stringify({ version: 1, kind: 'deterministic', status: 'unavailable', reason: error.message, quality: 'pending', executionProof: 'unverified', live: 'unverified', acceptedDraft: false }) + '\n');
  process.exitCode = 1;
}
