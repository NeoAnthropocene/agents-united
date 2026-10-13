import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

// This helper applies already-authored, explicitly scoped text changes. It does not author
// guidance, parse arbitrary YAML, run validators, install packages or contact a host.
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const fail = reason => { throw new Error(reason); };
const within = (parent, child) => {
  const relative = path.relative(parent, child);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
};
function noLinks(absolute) {
  let current = path.parse(absolute).root;
  for (const segment of absolute.slice(current.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    if (fs.lstatSync(current, { throwIfNoEntry: false })?.isSymbolicLink()) fail(`Linked paths need an explicit location decision: ${current}`);
  }
  return absolute;
}
function absolute(value, label) {
  if (typeof value !== 'string' || !path.isAbsolute(value)) fail(`${label} must be an absolute path.`);
  return noLinks(path.resolve(value));
}
function existingFile(value, label) {
  const file = absolute(value, label);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) fail(`${label} is unavailable: ${file}`);
  return file;
}
function relativeFile(value) {
  if (typeof value !== 'string' || !value || value.includes('\\') || value.includes(':') || path.isAbsolute(value) || value.split('/').some(p => !p || p === '.' || p === '..')) fail(`Invalid relative path / traversal: ${value}`);
  return value;
}
function snapshot(dir, prefix = '', result = new Map()) {
  if (!fs.existsSync(dir)) return result;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const relative = `${prefix}${entry.name}`;
    const file = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) fail(`Linked draft files need an explicit location decision: ${relative}`);
    if (entry.isDirectory()) snapshot(file, `${relative}/`, result);
    else if (entry.isFile()) result.set(relative, fs.readFileSync(file));
    else fail(`Unsupported draft file type: ${relative}`);
  }
  return result;
}
function sameSnapshot(before, after) {
  return before.size === after.size && [...before].every(([file, bytes]) => after.has(file) && hash(bytes) === hash(after.get(file)));
}
function metadata(content) {
  const frontmatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!frontmatter) fail('SKILL.md must carry frontmatter; format validation still needs the selected validator.');
  const block = frontmatter[1].match(/^metadata:[ \t]*\r?\n((?:^[ \t]+[^\r\n]*\r?\n?)*)/m)?.[1];
  if (!block || /[&*]|^[ \t]+(?:source|adaptedFrom):\s*[>|]/m.test(block)) fail('Use explicit scalar metadata for this bounded helper; arbitrary YAML needs the selected validator.');
  const read = key => block.match(new RegExp(`^[ \\t]+${key}:\\s*(.*?)\\s*$`, 'm'))?.[1]?.replace(/^(["'])(.*)\1$/, '$2');
  return { author: read('author'), version: read('version'), license: read('license'), source: read('source'), adaptedFrom: read('adaptedFrom') };
}
function provenanceOf(provenance, entry, finalFiles) {
  const p = provenance ?? {};
  const owner = typeof p.owner === 'string' && p.owner.trim() ? p.owner : 'task owner';
  const supported = new Set(['MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC', 'CC-BY-4.0', 'CC0-1.0', 'Unlicense', 'MPL-2.0', 'CC-BY-SA-4.0']);
  if (!['original', 'inspired', 'adapted'].includes(p.disposition)) fail(`${owner}: resolve the source disposition before draft edits.`);
  if (p.disposition === 'adapted' && (!p.license || !/^[0-9a-f]{40}$/.test(p.commit ?? '') || !p.licencePath || !p.source || !p.comparisonEvidence)) fail(`${owner}: inspect the actual licence, source at a full 40-character commit and candidate comparison before adapted reuse.`);
  if (!supported.has(p.license) || typeof p.version !== 'string' || !p.version.trim()) fail(`${owner}: supply a real version and supported licence before draft edits.`);
  const meta = metadata(entry);
  if (!meta.author || meta.version !== p.version || meta.license !== p.license) fail(`${owner}: correct final author/version/licence metadata against the declared evidence.`);
  if (p.disposition !== 'adapted' && (meta.source !== undefined || meta.adaptedFrom !== undefined || p.source !== undefined || p.adaptedFrom !== undefined)) fail(`${owner}: original/inspired work carries false adaptation metadata; inspect and correct source/adaptedFrom.`);
  if (p.disposition === 'adapted') {
    if (!p.source.includes(p.commit) || meta.source !== p.source) fail(`${owner}: final adapted source must match the inspected upstream pin.`);
    const licencePath = existingFile(p.licencePath, `${owner}: upstream licence evidence`);
    const licenceTarget = relativeFile(p.licenceTarget ?? 'LICENSE');
    if (!finalFiles.has(licenceTarget) || !finalFiles.get(licenceTarget).equals(fs.readFileSync(licencePath))) fail(`${owner}: retain the inspected upstream licence bytes at ${licenceTarget}.`);
    existingFile(p.comparisonEvidence, `${owner}: candidate comparison evidence`);
    for (const notice of p.requiredNotices ?? []) {
      const upstream = existingFile(notice.sourcePath, `${owner}: required upstream notice`);
      const target = relativeFile(notice.targetPath);
      if (!finalFiles.has(target) || !finalFiles.get(target).equals(fs.readFileSync(upstream))) fail(`${owner}: retain the required upstream notice bytes at ${target}.`);
    }
    if (['MPL-2.0', 'CC-BY-SA-4.0'].includes(p.license) && !finalFiles.has('NOTICE.md')) fail(`${owner}: retain a NOTICE.md changes note for ${p.license}.`);
  }
  return { ...p, owner, evidenceClaim: 'Declared evidence paths exist; provenance/legal review is still required.' };
}
function apply(job) {
  if (!['create', 'repair'].includes(job.mode) || !['local', 'upstream'].includes(job.intent)) fail('Choose create/repair mode and local/upstream intent.');
  const source = absolute(job.sourceRoot, 'Source checkout');
  const draft = absolute(job.draftRoot, 'Draft root');
  if (within(source, draft) || within(draft, source)) fail('Source/output roots overlap; choose a separate draft root.');
  if (!fs.existsSync(source) || !fs.statSync(source).isDirectory()) fail('The selected source checkout is unavailable.');
  if (draft.split(path.sep).some(p => ['.agents', '.claude', '.cline', '.cursor', '.opencode', '.gemini', '.codex'].includes(p.toLowerCase()))) fail('Draft root is a managed host output; choose a source draft directory.');
  const loading = job.loading ?? {};
  if (typeof loading.role !== 'string' || !loading.role.trim()) fail('A loading role is required.');
  existingFile(loading.entryPath, 'Loading entry');
  existingFile(loading.attributionPath, 'Attribution rule');
  if (!Array.isArray(loading.requiredFiles) || !loading.requiredFiles.length) fail('Loading required support files must be declared.');
  for (const file of loading.requiredFiles) existingFile(file, 'Loading required support file');
  if (!Array.isArray(job.requiredTools) || !job.requiredTools.length) fail('Declare the applicable required validation tools.');
  for (const tool of job.requiredTools) existingFile(tool.path, `Required validator ${tool.name ?? 'unnamed'}`);
  if (!Array.isArray(job.allowedPaths) || !job.allowedPaths.length) fail('Declare the authorized file scope.');
  const allowed = new Set(job.allowedPaths.map(relativeFile));
  const changes = Object.entries(job.changes ?? {});
  if (!changes.length) fail('Supply already-authored text changes.');
  const caseFolded = new Set();
  for (const [file, text] of changes) {
    relativeFile(file);
    if (!allowed.has(file)) fail(`Outside authorized scope: ${file}`);
    if (typeof text !== 'string') fail(`Text changes only: ${file}`);
    if (caseFolded.has(file.toLowerCase())) fail(`Case-colliding candidate file: ${file}`);
    caseFolded.add(file.toLowerCase());
  }
  const before = snapshot(draft);
  if (job.mode === 'create' && fs.existsSync(draft)) fail('Create requires an absent draft root; preserve the existing draft and choose repair.');
  if (job.mode === 'repair') {
    if (!before.size || !job.baseline || Object.keys(job.baseline).length !== before.size || [...before].some(([file, bytes]) => job.baseline[file] !== hash(bytes))) fail('Repair baseline has changed or is incomplete; capture the current full inventory before editing.');
  }
  const after = new Map(before);
  for (const [file, text] of changes) after.set(file, Buffer.from(text));
  if (new Set([...after.keys()].map(file => file.toLowerCase())).size !== after.size) fail('Case-colliding final files would overwrite another path on Windows.');
  if (!after.has('SKILL.md')) fail('A complete draft needs SKILL.md.');
  const disposition = provenanceOf(job.provenance, after.get('SKILL.md').toString('utf8'), after);
  let templatePath;
  let template;
  if (job.intent === 'upstream') {
    templatePath = existingFile(job.contributionTemplate, 'Existing contribution template');
    if (!within(source, templatePath)) fail('Use the existing contribution template inside the selected checkout.');
    template = fs.readFileSync(templatePath, 'utf8');
  }
  const inventory = [...after].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([file, bytes]) => ({ path: file, sha256: hash(bytes) }));
  const diff = changes.filter(([file, text]) => !before.has(file) || !before.get(file).equals(Buffer.from(text))).map(([file, text]) => ({ path: file, before: before.has(file) ? before.get(file).toString('utf8') : null, after: text }));
  const report = { status: 'draft-prepared', mode: job.mode, intent: job.intent, sourceRoot: source, draftRoot: draft, provenance: disposition, inventory, diff, externalActions: [], validation: { status: 'unverified', reason: 'Tool presence is checked; validators and live host behavior were not executed.' } };
  if (template !== undefined) report.upstreamPreparation = { base: 'dev', sent: false, templatePath, body: `${template}\n\n## Prepared draft evidence\n\n${JSON.stringify(report, null, 2)}\n` };
  // All dependent prerequisites are checked before touching the draft. Preserve a repair
  // until the fully staged replacement is ready, and reject edits that arrived meanwhile.
  const parent = path.dirname(draft);
  fs.mkdirSync(parent, { recursive: true });
  const staging = fs.mkdtempSync(path.join(parent, '.author-skill-'));
  const backup = `${staging}-baseline`;
  try {
    if (fs.existsSync(draft)) fs.cpSync(draft, staging, { recursive: true });
    for (const [file, bytes] of after) {
      const destination = path.join(staging, ...file.split('/'));
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, bytes);
    }
    noLinks(draft);
    if (!sameSnapshot(before, snapshot(draft))) fail('Repair baseline changed during staging; preserve the new user edits.');
    if (fs.existsSync(draft)) fs.renameSync(draft, backup);
    fs.renameSync(staging, draft);
    if (fs.existsSync(backup)) fs.rmSync(backup, { recursive: true });
  } catch (error) {
    if (fs.existsSync(backup) && !fs.existsSync(draft)) fs.renameSync(backup, draft);
    if (fs.existsSync(staging)) fs.rmSync(staging, { recursive: true });
    throw error;
  }
  return report;
}

try {
  if (process.argv.length !== 3) fail('Usage: node draft.mjs <absolute-job.json>');
  const input = existingFile(process.argv[2], 'Job record');
  process.stdout.write(`${JSON.stringify(apply(JSON.parse(fs.readFileSync(input, 'utf8'))), null, 2)}\n`);
} catch (error) {
  process.stderr.write(`${JSON.stringify({ status: 'blocked', reason: error instanceof Error ? error.message : String(error) })}\n`);
  process.exitCode = 1;
}
