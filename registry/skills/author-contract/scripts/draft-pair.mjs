import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

// Applies already-authored data. Validation and quality review remain the caller's work.
const fail = message => { throw new Error(message); };
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
function validate(value, schema, label = 'job') {
  const supported = new Set(['title', 'description', 'type', 'const', 'enum', 'properties', 'required', 'additionalProperties', 'items', 'minItems', 'maxItems', 'minLength', 'pattern', 'minimum', 'maximum']);
  for (const key of Object.keys(schema)) if (!supported.has(key)) fail(`Unsupported schema keyword: ${key}.`);
  if ('const' in schema && canonical(value) !== canonical(schema.const)) fail(`${label}: expected constant ${JSON.stringify(schema.const)}.`);
  if (schema.enum && !schema.enum.includes(value)) fail(`${label}: unavailable value.`);
  const type = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
  if (schema.type && schema.type !== type) fail(`${label}: expected ${schema.type}.`);
  if (type === 'string') {
    if (value.length < (schema.minLength ?? 0) || (schema.pattern && !new RegExp(schema.pattern).test(value))) fail(`${label}: invalid string.`);
  } else if (type === 'number') {
    if (!Number.isInteger(value) || value < (schema.minimum ?? -Infinity) || value > (schema.maximum ?? Infinity)) fail(`${label}: budget outside allowed range.`);
  } else if (type === 'array') {
    if (value.length < (schema.minItems ?? 0) || value.length > (schema.maxItems ?? Infinity)) fail(`${label}: unavailable array size.`);
    value.forEach((child, index) => validate(child, schema.items, `${label}[${index}]`));
  } else if (type === 'object') {
    for (const key of schema.required ?? []) if (!Object.hasOwn(value, key)) fail(`${label}: missing ${key}.`);
    for (const [key, child] of Object.entries(value)) {
      if (schema.additionalProperties === false && !Object.hasOwn(schema.properties ?? {}, key)) fail(`${label}: unknown field ${key}.`);
      if (schema.properties?.[key]) validate(child, schema.properties[key], `${label}.${key}`);
    }
  }
}
function absolute(value, label) {
  if (typeof value !== 'string' || !path.isAbsolute(value) || value.split(/[\\/]/).some(part => part === '.' || part === '..')) fail(`${label}: expected absolute path without traversal aliases.`);
  const file = path.resolve(value);
  let current = path.parse(file).root;
  for (const part of file.slice(current.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    if (fs.lstatSync(current, { throwIfNoEntry: false })?.isSymbolicLink()) fail(`${label}: linked ancestor ${current}.`);
  }
  return file;
}
const lexicalWithin = (parent, child) => {
  const relative = path.relative(parent.toLowerCase(), child.toLowerCase());
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
};
// The physical spelling of a path, the rule of contract-return.mjs and the coordinator's checker: the deepest existing ancestor is resolved
// by the platform (a short name, another case on an ignoring volume, both become the one real name) and the absent rest is appended. Only
// ENOENT and ENOTDIR walk up to the parent; any other error is refused with the path and the code, never a fallback to the string.
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
const physicallyWithin = (parent, child) => {
  const relative = path.relative(foldName(physical(parent)), foldName(physical(child)));
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
};
// A refusal holds when the paths relate as strings OR physically (another spelling of one folder is the same folder); an acceptance
// ("inside the evidence root") needs both.
const within = (parent, child) => lexicalWithin(parent, child) || physicallyWithin(parent, child);
const withinBoth = (parent, child) => lexicalWithin(parent, child) && physicallyWithin(parent, child);
const overlaps = (a, b) => within(a, b) || within(b, a);
const HOST_DIRS = ['.agents', '.claude', '.cline', '.cursor', '.codex', '.opencode', '.gemini'];
function pinned(pin, label) {
  const file = absolute(pin.path, label);
  if (!fs.statSync(file, { throwIfNoEntry: false })?.isFile()) fail(`${label}: missing file ${file}.`);
  const bytes = fs.readFileSync(file);
  if (hash(bytes) !== pin.sha256) fail(`${label}: changed hash ${file}.`);
  return bytes;
}
function relative(value) {
  if (typeof value !== 'string' || !value || /[<>:"\\|?*\x00-\x1f]/.test(value) || value.startsWith('/') || value.split('/').some(part => !part || part === '.' || part === '..' || /[. ]$/.test(part) || /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part))) fail(`Invalid relative path: ${value}.`);
  return value;
}
function snapshot(root, budget) {
  const files = new Map();
  let total = 0;
  const walk = (dir, prefix = '') => {
    if (!fs.existsSync(dir)) return;
    if (!fs.statSync(dir).isDirectory()) fail('Draft root must be a directory.');
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const rel = relative(`${prefix}${entry.name}`), file = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) fail(`Linked draft file: ${rel}.`);
      if (entry.isDirectory()) walk(file, `${rel}/`);
      else if (entry.isFile()) {
        const size = fs.statSync(file).size;
        total += size;
        if (files.size >= budget.maxFiles || size > budget.maxFileBytes || total > budget.maxTotalBytes) fail('Baseline file/byte budget exceeded.');
        files.set(rel, fs.readFileSync(file));
      } else fail(`Unsupported draft file: ${rel}.`);
    }
  };
  walk(absolute(root, 'Draft'));
  if (new Set([...files.keys()].map(file => file.toLowerCase())).size !== files.size) fail('Case-colliding baseline paths.');
  return files;
}
const sameSnapshot = (a, b) => a.size === b.size && [...a].every(([file, bytes]) => b.has(file) && hash(bytes) === hash(b.get(file)));
function apply(job) {
  const schema = JSON.parse(fs.readFileSync(new URL('../assets/job.schema.json', import.meta.url), 'utf8'));
  validate(job, schema);
  const proposalKeys = job.mode === 'create' ? ['core', 'body', 'contract'] : job.mode === 'reuse' ? ['coreFile', 'contractFile'] : ['coreText', 'contract'];
  if (job.mode === 'update') {
    if (!Object.keys(job.proposal).length || Object.keys(job.proposal).some(key => !proposalKeys.includes(key))) fail('Update proposal must contain coreText and/or contract.');
  } else if (Object.keys(job.proposal).length !== proposalKeys.length || proposalKeys.some(key => !Object.hasOwn(job.proposal, key))) fail(`${job.mode}: supply exactly ${proposalKeys.join(', ')} in the proposal.`);
  const source = absolute(job.source.checkout, 'Checkout');
  const registry = absolute(job.source.registry, 'Input registry');
  const draft = absolute(job.draftRoot, 'Draft');
  const evidence = absolute(job.evidenceRoot, 'Evidence');
  if (!fs.statSync(source, { throwIfNoEntry: false })?.isDirectory() || !fs.statSync(registry, { throwIfNoEntry: false })?.isDirectory()) fail('Required source directory unavailable.');
  if (overlaps(source, draft) || overlaps(registry, draft) || overlaps(evidence, draft) || overlaps(source, evidence) || overlaps(registry, evidence)) fail('Source/output/evidence roots overlap.');
  for (const [label, file] of [['Draft', draft], ['Evidence', evidence]]) {
    if ([file, physical(file)].some(spelling => spelling.split(path.sep).some(part => HOST_DIRS.includes(part.toLowerCase())))) fail(`${label} is a managed Host output.`);
    for (const root of [...job.managedRoots, ...job.protectedRoots]) if (overlaps(absolute(root, 'Protected root'), file)) fail(`${label} overlaps a managed/protected root.`);
  }
  if (job.mode !== 'update' && fs.existsSync(draft)) fail('Create/reuse require an absent draft; preserve the existing source.');
  if (job.mode !== 'update' && job.baseline.length) fail('Create/reuse require an empty baseline.');
  for (const pin of [...job.source.pins, job.loading.entry, job.loading.attribution, job.loading.binding, ...job.loading.requiredFiles, job.validator.runtime, job.validator.cli, ...job.provenance.evidence]) {
    if (within(draft, absolute(pin.path, 'Input'))) fail('Writable draft contains a required input.');
    pinned(pin, 'Required input');
  }
  if (path.resolve(job.validator.cli.path).toLowerCase() !== path.join(source, 'dist/cli.js').toLowerCase()) fail('Validator must be the selected checkout dist/cli.js.');
  const identity = spawnSync('git', ['-C', source, 'rev-parse', 'HEAD'], { encoding: 'utf8', timeout: Math.min(job.budget.maxSeconds * 1000, 10000), maxBuffer: job.budget.maxLogBytes });
  if (identity.status !== 0 || identity.stdout.trim() !== job.source.head) fail('Checkout HEAD mismatch or unavailable.');
  if (job.provenance.unresolved.length) fail('Required provenance remains unresolved.');
  if (job.provenance.disposition === 'adapted' && !job.provenance.upstream) fail('Adapted work needs the inspected upstream source, licence and comparison record.');
  const upstream = job.provenance.upstream;
  let licenseBytes;
  if (upstream) {
    if (job.provenance.disposition !== 'adapted') fail('Original/inspired work must not carry false upstream adaptation metadata.');
    relative(upstream.path);
    for (const pin of [upstream.source, upstream.license, upstream.comparison, ...upstream.notices.map(notice => notice.source)]) {
      if (within(draft, absolute(pin.path, 'Upstream evidence'))) fail('Upstream evidence is inside the writable draft.');
      pinned(pin, 'Upstream evidence');
    }
    licenseBytes = pinned(upstream.license, 'Upstream licence');
  }
  let template;
  if (job.intent === 'upstream') {
    if (!job.contributionTemplate) fail('Upstream intent needs the pinned existing contribution template.');
    if (absolute(job.contributionTemplate.path, 'Contribution template').toLowerCase() !== path.join(source, '.github/PULL_REQUEST_TEMPLATE/artifact-contribution.md').toLowerCase()) fail('Use the existing artifact-contribution template inside the selected checkout.');
    template = pinned(job.contributionTemplate, 'Contribution template').toString('utf8');
  } else if (job.contributionTemplate !== undefined) fail('Local intent must not supply an upstream template.');
  const corePath = `core/${job.definition}.core.md`, contractPath = `core/${job.definition}.contract.json`;
  if (new Set(job.allowedPaths).size !== job.allowedPaths.length || job.allowedPaths.some(file => ![corePath, contractPath].includes(file)) || (job.mode !== 'update' && job.allowedPaths.length !== 2)) fail('Only the derived pair paths are permitted.');
  const before = snapshot(draft, job.budget);
  if (job.mode === 'update') {
    if (!before.has(corePath) || !before.has(contractPath) || before.size !== job.baseline.length || new Set(job.baseline.map(item => item.path.toLowerCase())).size !== job.baseline.length) fail('Update needs a complete pair and baseline.');
    for (const entry of job.baseline) {
      const rel = relative(entry.path), bytes = before.get(rel);
      const stored = absolute(entry.snapshot.path, 'Immutable baseline');
      if (!withinBoth(evidence, stored) || within(draft, stored)) fail('Immutable snapshots must be in the separate evidence root.');
      const original = pinned(entry.snapshot, 'Immutable baseline');
      if (!bytes || bytes.length !== entry.bytes || hash(bytes) !== entry.sha256 || !bytes.equals(original)) fail(`Stale/incomplete baseline: ${rel}.`);
    }
  }
  let files;
  const reusedFiles = [];
  if (job.mode === 'create') {
    if (job.proposal.contract.definition !== job.definition) fail('Companion definition must match the fixed job.');
    const coreText = `---\n${Object.entries(job.proposal.core).map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join('\n')}\n---\n${job.proposal.body}`;
    files = new Map([[corePath, Buffer.from(coreText)], [contractPath, Buffer.from(`${JSON.stringify(job.proposal.contract, null, 2)}\n`)]]);
  } else if (job.mode === 'reuse') {
    for (const [rel, pin] of [[corePath, job.proposal.coreFile], [contractPath, job.proposal.contractFile]]) {
      if (absolute(pin.path, 'Reused pair').toLowerCase() !== path.join(registry, ...rel.split('/')).toLowerCase()) fail('Reused pair must match the selected input registry and definition.');
      reusedFiles.push({ path: pin.path, sha256: pin.sha256 });
    }
    const coreBytes = pinned(job.proposal.coreFile, 'Reused core');
    const contractBytes = pinned(job.proposal.contractFile, 'Reused contract');
    const contract = JSON.parse(contractBytes.toString('utf8'));
    validate(contract, schema.properties.proposal.properties.contract, 'Reused contract');
    if (contract.definition !== job.definition) fail('Reused companion definition must match the fixed job.');
    files = new Map([[corePath, coreBytes], [contractPath, contractBytes]]);
  } else {
    files = new Map(before);
    for (const [key, value] of Object.entries(job.proposal)) {
      const rel = key === 'coreText' ? corePath : contractPath;
      if (!job.allowedPaths.includes(rel)) fail(`Update outside the allowed scope: ${rel}.`);
      files.set(rel, Buffer.from(key === 'coreText' ? value : `${JSON.stringify(value, null, 2)}\n`));
    }
    const contract = JSON.parse(files.get(contractPath).toString('utf8'));
    validate(contract, schema.properties.proposal.properties.contract, 'Final contract');
    if (contract.definition !== job.definition) fail('Final companion definition must match the fixed job.');
  }
  for (const value of job.fixedValues) if (![corePath, contractPath].some(file => files.get(file).toString('utf8').includes(value))) fail(`Missing fixed value: ${value}.`);
  const finalContract = JSON.parse(files.get(contractPath).toString('utf8'));
  const declaredBindings = new Map();
  for (const binding of job.bindings) {
    const key = `${binding.kind}:${binding.id}`;
    if (declaredBindings.has(key)) fail(`Duplicate binding declaration: ${key}.`);
    if (!finalContract[`${binding.kind}s`].includes(binding.id)) fail(`Binding is not permitted by the final contract: ${key}.`);
    declaredBindings.set(key, binding);
  }
  const bindingFindings = [];
  for (const kind of ['skill', 'workflow', 'hook']) for (const id of finalContract[`${kind}s`]) {
    const binding = declaredBindings.get(`${kind}:${id}`);
    const finding = { kind, id, required: binding?.required ?? false, source: 'unavailable', execution: 'unverified', evidence: [] };
    if (binding?.evidence.length) {
      try {
        for (const pin of binding.evidence) {
          if (within(draft, absolute(pin.path, 'Binding source'))) fail('Binding source is inside the writable draft.');
          pinned(pin, 'Binding source');
          finding.evidence.push(pin);
        }
        finding.source = 'checked';
      } catch (error) {
        finding.reason = error instanceof Error ? error.message : String(error);
      }
    }
    if (finding.required && finding.source !== 'checked') fail(`Required ${kind} binding unavailable: ${id}. ${finding.reason ?? 'No source evidence supplied.'}`);
    bindingFindings.push(finding);
  }
  const protectedNotes = job.protectedNotes.map(note => {
    const rel = relative(note.path);
    if (!before.get(rel)?.toString('utf8').includes(note.contains) || !files.get(rel)?.toString('utf8').includes(note.contains)) fail(`Protected note changed/missing: ${rel}.`);
    return { ...note, preserved: true };
  });
  const retainedNotices = [];
  let retainedLicense = false;
  for (const notice of upstream?.notices ?? []) {
    const rel = relative(notice.targetPath), bytes = pinned(notice.source, 'Required notice'), target = files.get(rel);
    if (!target || !(notice.mode === 'file' ? target.equals(bytes) : target.includes(bytes))) fail(`Required upstream notice bytes not retained: ${rel}.`);
    if (bytes.equals(licenseBytes)) retainedLicense = true;
    retainedNotices.push({ sourcePath: notice.source.path, targetPath: rel, sha256: hash(bytes), mode: notice.mode });
  }
  if (upstream && !retainedLicense) fail('The inspected licence bytes must be retained in the final pair or unchanged baseline.');
  const inventory = [...files].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([file, bytes]) => ({ path: file, sha256: hash(bytes), bytes: bytes.length }));
  if (inventory.length > job.budget.maxFiles || inventory.some(file => file.bytes > job.budget.maxFileBytes) || inventory.reduce((sum, file) => sum + file.bytes, 0) > job.budget.maxTotalBytes) fail('Draft file/byte budget exceeded.');
  const parent = path.dirname(draft);
  fs.mkdirSync(parent, { recursive: true });
  const staging = fs.mkdtempSync(path.join(parent, '.author-contract-'));
  const backup = `${staging}-baseline`;
  try {
    if (job.mode === 'update') fs.cpSync(draft, staging, { recursive: true });
    for (const [file, bytes] of files) {
      const destination = path.join(staging, ...file.split('/'));
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, bytes);
    }
    absolute(draft, 'Draft');
    if (!sameSnapshot(before, snapshot(draft, job.budget)) || (job.mode !== 'update' && fs.existsSync(draft))) fail('Draft/baseline changed during staging; preserve it.');
    if (path.dirname(staging) !== parent || path.dirname(backup) !== parent || fs.existsSync(backup)) fail('Unexpected staging/backup location.');
    if (fs.existsSync(draft)) fs.renameSync(draft, backup);
    fs.renameSync(staging, draft);
    if (fs.existsSync(backup)) fs.rmSync(backup, { recursive: true });
  } catch (error) {
    if (fs.existsSync(backup) && !fs.existsSync(draft)) fs.renameSync(backup, draft);
    throw error;
  } finally {
    if (path.dirname(staging) !== parent) fail('Unexpected staging location.');
    if (fs.existsSync(staging)) fs.rmSync(staging, { recursive: true });
  }
  const changed = [...files].filter(([file, bytes]) => !before.has(file) || !before.get(file).equals(bytes));
  const diff = changed.map(([file, bytes]) => ({ path: file, before: before.has(file) ? before.get(file).toString('utf8') : null, after: bytes.toString('utf8') }));
  const unchanged = inventory.filter(file => !changed.some(([rel]) => rel === file.path));
  const report = { status: 'draft-prepared', mode: job.mode, intent: job.intent, acceptedDraft: false, digest: hash(canonical(job)), inventory, diff, unchanged, protectedNotes, reusedFiles, bindingFindings, retainedNotices, provenance: { ...job.provenance, review: 'pending' }, sourceHead: identity.stdout.trim(), checksExecuted: ['git rev-parse HEAD'], externalActions: [], validation: 'unverified', quality: 'pending', live: 'unverified' };
  if (template !== undefined) report.upstreamPreparation = { base: 'dev', sent: false, templatePath: job.contributionTemplate.path, body: `${template}\n\n## Prepared shared pair evidence\n\n${JSON.stringify(report, null, 2)}\n` };
  return report;
}
try {
  if (Number(process.versions.node.split('.')[0]) < 24) fail('Node >=24 required.');
  if (process.argv.length !== 3) fail('Usage: node draft-pair.mjs <absolute-job.json>');
  const file = absolute(process.argv[2], 'Job');
  process.stdout.write(`${JSON.stringify(apply(JSON.parse(fs.readFileSync(file, 'utf8'))), null, 2)}\n`);
} catch (error) {
  process.stderr.write(`${JSON.stringify({ status: 'blocked', reason: error instanceof Error ? error.message : String(error) })}\n`);
  process.exitCode = 1;
}
