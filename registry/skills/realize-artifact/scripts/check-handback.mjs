import path from 'node:path';
import { absolute, argumentsFor, checkJob, coveragePathFor, fail, fileBytes, hash, jsonFile, physicallyWithin, pinned, relative, runCli, same, schemaFor, unique, validateRecord, within } from './check-job.mjs';

/** Checks the returned record against actual bytes; never executes returned commands. */
export function checkHandback(job, result) {
  const { digest, baseline, current } = checkJob(job, { postflight: true });
  validateRecord(result, schemaFor('handback'), 'handback');
  if (result.jobId !== job.id || result.jobDigest !== digest) fail('Hand-back job identity / digest mismatch.');
  if (result.status !== 'draft' && !result.openItems.length) fail('Blocked / partial reports require explicit open items.');
  result.inventory.forEach(item => relative(item.path));
  unique(result.inventory.map(item => item.path), 'Returned inventory');
  if (result.inventory.length !== current.size) fail('Returned inventory omits actual files or contains extra files.');
  for (const item of result.inventory) {
    const bytes = current.get(item.path);
    if (!bytes || bytes.length !== item.bytes || hash(bytes) !== item.sha256) fail(`Returned inventory hash/length mismatch: ${item.path}`);
  }
  const expectedDiff = [];
  for (const rel of [...new Set([...baseline.keys(), ...current.keys()])].sort()) {
    const before = baseline.get(rel);
    const after = current.get(rel);
    if (before?.equals(after ?? Buffer.alloc(0)) && after !== undefined) continue;
    if (before === undefined && after === undefined) continue;
    const operation = before === undefined ? 'create' : after === undefined ? 'delete' : 'update';
    if (!job.allowedChanges[operation].includes(rel)) fail(`Changed file is outside declared ${operation} scope: ${rel}`);
    const text = bytes => {
      if (bytes === undefined) return null;
      const value = bytes.toString('utf8');
      if (!Buffer.from(value).equals(bytes)) fail(`Binary / invalid UTF-8 diff is unavailable: ${rel}`);
      return value;
    };
    expectedDiff.push({ path: rel, before: text(before), after: text(after) });
  }
  result.diff.forEach(item => relative(item.path));
  unique(result.diff.map(item => item.path), 'Returned diff');
  const byPath = (a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0;
  if (!same([...result.diff].sort(byPath), expectedDiff)) fail('Returned before/after diff differs from actual baseline and final bytes.');
  if (result.status === 'draft') {
    for (const rel of job.artifact.paths) if (!current.has(rel)) fail(`Required artifact missing: ${rel}`);
    for (const rel of job.artifact.paths.map(coveragePathFor)) if (Object.values(job.allowedChanges).flat().includes(rel) && !current.has(rel)) fail(`Declared coverage file missing: ${rel}`);
    for (const fixed of job.constraints.fixedValues) if (!current.get(fixed.path)?.toString('utf8').includes(fixed.contains)) fail(`Fixed task value missing from ${fixed.path}.`);
  }
  unique(result.coverage.map(item => item.input), 'Input coverage');
  const covered = new Map(result.coverage.map(item => [item.input, item]));
  for (const input of job.inputs) {
    const item = covered.get(input.path);
    if (!item || !same([...item.sections].sort(), [...input.sections].sort())) fail(`Required guide/binding coverage missing or changed: ${input.path}`);
  }
  for (const item of result.coverage) if (!job.inputs.some(input => input.path === item.input)) fail(`Coverage cites an unpinned input: ${item.input}`);
  for (const file of result.provenance.evidence) {
    absolute(file, 'Provenance evidence');
    // "Inside the evidence root" grants when the folded strings say so (as before P27) and the physical spellings do too, which compare
    // exact case off Windows: refused on a case-sensitive volume for another case (the link refusal of the path as given ran just above).
    if (!job.inputs.some(input => input.path === file) && !(within(job.roots.evidence, file) && physicallyWithin(job.roots.evidence, file))) fail('Provenance evidence must be a pinned input or within the evidence root.');
    fileBytes(file, 'Provenance evidence');
  }
  unique(result.checks.map(check => check.id), 'Check receipts');
  if (result.checks.length > job.budget.maxChecks) fail('Check receipt count exceeds fixed budget.');
  let elapsed = 0;
  let logBytes = 0;
  for (const receipt of result.checks) {
    const allowed = job.checks.find(check => check.id === receipt.id);
    if (!allowed) fail(`Unallowlisted check receipt: ${receipt.id}`);
    if (receipt.jobDigest !== digest) fail(`Check receipt job digest / revision mismatch: ${receipt.id}`);
    if (receipt.executable !== allowed.executable || receipt.cwd !== allowed.cwd || !same(receipt.argv, allowed.argv)) fail(`Check receipt command / argv / cwd mismatch: ${receipt.id}`);
    const start = Date.parse(receipt.startedAt);
    const end = Date.parse(receipt.endedAt);
    const seconds = (end - start) / 1000;
    if (!Number.isFinite(seconds) || seconds < 0 || seconds > allowed.timeoutSeconds) fail(`Check receipt time / duration budget mismatch: ${receipt.id}`);
    elapsed += seconds;
    const passed = receipt.classification === 'passed';
    if ((passed && receipt.exitCode !== 0) || (receipt.classification === 'failed' && (receipt.exitCode === null || receipt.exitCode === 0)) || (['skipped', 'unavailable'].includes(receipt.classification) && receipt.exitCode !== null)) fail(`Check exit / classification mismatch: ${receipt.id}`);
    for (const log of [receipt.stdout, receipt.stderr]) {
      if (!within(job.roots.evidence, log.path)) fail('Raw check log must stay within the fixed evidence root.');
      if (log.bytes > job.budget.maxLogBytes) fail('Raw check log byte budget exceeded.');
      // The link refusal of the pin read below (same label, same message) comes before the physical comparison; existing refusals keep their order.
      absolute(log.path, 'Raw check log');
      if (!physicallyWithin(job.roots.evidence, log.path)) fail('Raw check log must stay within the fixed evidence root.');
      pinned(log, 'Raw check log');
      logBytes += log.bytes;
    }
    // Catch stale/failed validator payloads presented with a zero exit. A matching
    // worker-written payload still cannot prove that the command actually ran.
    if (passed && allowed.argv[1] === 'factory-check') {
      const output = jsonFile(receipt.stdout.path, 'Native validator stdout');
      if (output.ok !== true || output.kind !== 'deterministic' || !Array.isArray(output.findings) || output.findings.length) fail('Native validator result does not support its passed classification.');
    }
  }
  if (elapsed > job.budget.maxSeconds || logBytes > job.budget.maxLogBytes) fail('Aggregate check time / raw log budget exceeded.');
  if (result.status === 'draft') for (const check of job.checks.filter(check => check.required)) if (!result.checks.some(receipt => receipt.id === check.id && receipt.classification === 'passed')) fail(`Required check missing or not passed: ${check.id}`);
  if (job.intent === 'local' && result.upstream !== null) fail('Local intent cannot silently change to upstream preparation.');
  if (job.intent === 'upstream') {
    const prepared = result.upstream;
    const template = path.join(job.source.checkout, '.github/PULL_REQUEST_TEMPLATE/artifact-contribution.md');
    if (!prepared || prepared.template !== template || !prepared.body.startsWith(fileBytes(template, 'Contribution template').toString('utf8'))) fail('Upstream preparation must retain the selected pinned dev contribution template.');
  }
  return { digest, status: result.status, findings: [], qualityReport: result.quality, openItems: result.openItems, recordValid: true, readyForIndependentChecks: result.status === 'draft', acceptedDraft: false };
}

if (process.argv.slice(2).join(' ') === '--help') process.stdout.write('Usage: node check-handback.mjs --job <absolute-job.json> --result <absolute-result.json>\nRead-only record check; independent caller validation and quality review remain required.\n');
else runCli(() => {
  const args = argumentsFor(process.argv.slice(2), ['--job', '--result']);
  return checkHandback(jsonFile(args['--job'], 'Job record'), jsonFile(args['--result'], 'Hand-back record'));
});
