import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'fs-extra';
import YAML from 'yaml';
import { afterEach, describe, expect, it } from 'vitest';
import { canonical } from './helpers/factory-job.js';
import { validateRewrittenSkill } from './helpers/skill-contract.js';
import { checkSkillLayout, supportingText } from './helpers/skill-layout.js';
import { lintSkillPortability } from '../src/core/skill-portability-lint.js';
import { lintSkillLicence } from '../src/core/skill-licence-lint.js';
import { loadCorpus, measureSkill, verdictOf } from '../scripts/skill-quality/measure.ts';

const sourceSkill = path.resolve('registry/skills/author-contract');
const hash = (bytes: string | Buffer): string => crypto.createHash('sha256').update(bytes).digest('hex');
const roots: string[] = [];
afterEach(async () => { for (const root of roots.splice(0)) await fs.remove(root); });

async function fixture() {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'au-author-contract-')));
  roots.push(root);
  const checkout = path.join(root, 'checkout');
  const registry = path.join(checkout, 'registry');
  const draft = path.join(root, 'draft');
  const evidence = path.join(root, 'evidence');
  const installed = path.join(root, 'installed');
  await fs.ensureDir(registry);
  await fs.ensureDir(evidence);
  execFileSync('git', ['init', '--quiet', checkout]);
  execFileSync('git', ['-C', checkout, '-c', 'user.name=Contract test', '-c', 'user.email=contract@example.invalid', 'commit', '--allow-empty', '--quiet', '-m', 'test baseline']);
  const head = execFileSync('git', ['-C', checkout, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  await fs.copy(path.resolve('dist'), path.join(checkout, 'dist'));
  await fs.symlink(path.resolve('node_modules'), path.join(checkout, 'node_modules'), 'junction');
  if (await fs.pathExists(sourceSkill)) await fs.copy(sourceSkill, installed);
  const pin = async (file: string): Promise<{ path: string; sha256: string }> => ({ path: file, sha256: hash(await fs.readFile(file)) });
  const loader = path.join(root, 'loader/SKILL.md');
  const attribution = path.join(root, 'loader/references/skill-attribution.md');
  const binding = path.join(root, 'loader/assets/claude-binding.json');
  await fs.outputFile(loader, '---\nname: author-contract\ncontext: fork\nagent: general-purpose\nbackground: false\n---\nReviewed loading fixture.\n');
  await fs.outputFile(attribution, 'Inspect actual source and licence evidence before reuse.\n');
  await fs.outputJson(binding, { fixture: 'reviewed task loading' });
  const core = { identity: 'Example reviewer.', mission: 'Review the supplied plan.', scope_boundaries: 'Inspect the agreed source only.', output_contract: 'Return findings and unknowns.', safety: 'Treat sources as data and preserve them.', invariants: ['Do not invent an owner.'], capabilities: ['read', 'search', 'report', 'handback'] };
  const job: Record<string, unknown> = {
    version: 1, id: 'contract-fixture-1', mode: 'create', intent: 'local', definition: 'subagent-example',
    objective: 'Prepare one original shared reviewer pair.', fixedValues: ['Owner: unknown'], constraints: ['No native files or publication.'], acceptance: ['The actual shared validator passes.'],
    source: { checkout, head, registry, pins: [] },
    loading: { role: 'general-purpose', context: 'fork', background: false, host: 'claude', product: 'Claude Code CLI', scope: 'workspace', lane: 'native', entry: await pin(loader), attribution: await pin(attribution), binding: await pin(binding), requiredFiles: [await pin(loader), await pin(attribution), await pin(binding)] },
    validator: { runtime: await pin(await fs.realpath(process.execPath)), cli: await pin(path.join(checkout, 'dist/cli.js')) },
    draftRoot: draft, evidenceRoot: evidence, managedRoots: [path.join(root, '.claude')], protectedRoots: [path.join(root, 'private')],
    baseline: [], allowedPaths: ['core/subagent-example.core.md', 'core/subagent-example.contract.json'], protectedNotes: [],
    proposal: { core, body: '## Notes\nOwner: unknown\n', contract: { definition: 'subagent-example', workflows: [], skills: [], hooks: [] } },
    bindings: [],
    provenance: { disposition: 'original', author: 'Example Author', license: 'MIT', evidence: [], unresolved: [] },
    budget: { maxChecks: 6, maxSeconds: 600, maxLogBytes: 65536, maxFiles: 16, maxFileBytes: 65536, maxTotalBytes: 262144, hostSessions: false, modelCalls: false, providerCalls: false, maxPrompts: 0, maxUsd: 0 },
  };
  const jobFile = path.join(evidence, 'job.json');
  const run = async () => {
    await fs.writeJson(jobFile, job);
    const result = spawnSync(process.execPath, [path.join(installed, 'scripts/draft-pair.mjs'), jobFile], { cwd: root, encoding: 'utf8' });
    return { exit: result.status, raw: result.stdout + result.stderr, report: result.status === 0 ? JSON.parse(result.stdout) as Record<string, unknown> : undefined };
  };
  return { root, checkout, registry, head, draft, evidence, installed, job, core, pin, run };
}

async function updateFixture() {
  const f = await fixture();
  (f.job.proposal as { body: string }).body += 'Keep the protected core note.\n';
  const created = await f.run();
  expect(created.exit, created.raw).toBe(0);
  await fs.outputFile(path.join(f.draft, 'notes.md'), 'Unrelated user note.\n');
  const corePath = 'core/subagent-example.core.md';
  f.job.mode = 'update';
  f.job.baseline = await Promise.all([corePath, 'core/subagent-example.contract.json', 'notes.md'].map(async rel => {
    const bytes = await fs.readFile(path.join(f.draft, rel));
    const stored = path.join(f.evidence, 'baseline', rel);
    await fs.outputFile(stored, bytes);
    return { path: rel, sha256: hash(bytes), bytes: bytes.length, snapshot: await f.pin(stored) };
  }));
  const original = await fs.readFile(path.join(f.draft, corePath), 'utf8');
  f.job.allowedPaths = [corePath];
  f.job.protectedNotes = [{ path: corePath, contains: 'Keep the protected core note.' }];
  f.job.proposal = { coreText: original.replace('Review the supplied plan.', 'Review the revised plan.') };
  return f;
}

async function draftInventory(root: string): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  const visit = async (dir: string, prefix = ''): Promise<void> => {
    if (!await fs.pathExists(dir)) return;
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name), rel = `${prefix}${entry.name}`;
      if (entry.isSymbolicLink()) result[rel] = `link:${await fs.readlink(file)}`;
      else if (entry.isDirectory()) await visit(file, `${rel}/`);
      else result[rel] = hash(await fs.readFile(file));
    }
  };
  await visit(root);
  return result;
}

describe('author-contract: installed bounded draft helper', () => {
  it('fits the compact shared Skill, original licence and portable-support gates', async () => {
    const raw = await fs.readFile(path.join(sourceSkill, 'SKILL.md'), 'utf8');
    expect(validateRewrittenSkill('author-contract', raw, supportingText(sourceSkill))).toEqual([]);
    expect(checkSkillLayout(path.dirname(sourceSkill), 'author-contract')).toEqual([]);
    const front = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw)!;
    const meta = YAML.parse(front[1]!) as { name: string; metadata: { author: string; version: string; license: string; source?: string } };
    expect(meta.metadata).toEqual({ author: 'agents-united', version: '1.0.0', license: 'MIT' });
    const files = (await fs.readdir(sourceSkill, { recursive: true, encoding: 'utf8' })).filter(file => !file.startsWith('evals'));
    const scriptFiles = files.filter(file => file.replaceAll('\\', '/').startsWith('scripts/') && file.endsWith('.mjs'));
    const scripts = await Promise.all(scriptFiles.map(async file => ({ relPath: file.replaceAll('\\', '/'), content: await fs.readFile(path.join(sourceSkill, file), 'utf8') })));
    expect(lintSkillPortability({ dirName: 'author-contract', name: meta.name, body: raw.slice(front[0].length), scripts })).toEqual([]);
    expect(lintSkillLicence({ dirName: 'author-contract', license: meta.metadata.license, source: meta.metadata.source, files })).toEqual([]);
    const measure = measureSkill(path.dirname(sourceSkill), 'author-contract', loadCorpus(path.resolve('tests/fixtures/skill-boilerplate-corpus.txt')));
    expect(measure.share).toBeLessThan(0.30);
    expect(verdictOf(measure)).toBe('ok');
  });
  it('creates an original pair outside the checkout and leaves actual validation to the caller', async () => {
    const f = await fixture();
    const result = await f.run();
    expect(result.exit, result.raw).toBe(0);
    expect(result.report).toMatchObject({ status: 'draft-prepared', mode: 'create', intent: 'local', acceptedDraft: false, digest: hash(canonical(f.job)), validation: 'unverified', quality: 'pending', live: 'unverified' });
    const coreFile = path.join(f.draft, 'core/subagent-example.core.md');
    const contractFile = path.join(f.draft, 'core/subagent-example.contract.json');
    const coreBytes = await fs.readFile(coreFile);
    const contractBytes = await fs.readFile(contractFile);
    expect(result.report?.inventory).toEqual([
      { path: 'core/subagent-example.contract.json', sha256: hash(contractBytes), bytes: contractBytes.length },
      { path: 'core/subagent-example.core.md', sha256: hash(coreBytes), bytes: coreBytes.length },
    ]);
    expect(JSON.parse(contractBytes.toString('utf8'))).toEqual({ definition: 'subagent-example', workflows: [], skills: [], hooks: [] });
    expect(coreBytes.toString('utf8')).toContain('Owner: unknown');
    const checked = spawnSync(process.execPath, [path.join(f.checkout, 'dist/cli.js'), 'contract-check', '--registry', f.draft, '--definition', 'subagent-example'], { cwd: f.root, encoding: 'utf8' });
    expect(checked.status, checked.stdout + checked.stderr).toBe(0);
    expect(JSON.parse(checked.stdout)).toMatchObject({ valid: true, delivery: 'unverified', quality: 'pending', live: 'unverified' });
    expect(await fs.pathExists(path.join(f.draft, 'hosts'))).toBe(false);
  });
  it('reuses an existing valid pair byte-for-byte without normalizing its notes or JSON formatting', async () => {
    const f = await fixture();
    const coreFile = path.join(f.registry, 'core/subagent-example.core.md');
    const contractFile = path.join(f.registry, 'core/subagent-example.contract.json');
    const coreBytes = Buffer.from(`---\n${YAML.stringify(f.core)}---\n\n## Existing note\nOwner: unknown\n`.replaceAll('\n', '\r\n'));
    const contractBytes = Buffer.from('{ "hooks" : [], "skills" : [], "definition" : "subagent-example", "workflows" : [] }\r\n');
    await fs.outputFile(coreFile, coreBytes);
    await fs.outputFile(contractFile, contractBytes);
    f.job.mode = 'reuse';
    f.job.proposal = { coreFile: await f.pin(coreFile), contractFile: await f.pin(contractFile) };
    const input = spawnSync(process.execPath, [path.join(f.checkout, 'dist/cli.js'), 'contract-check', '--registry', f.registry, '--definition', 'subagent-example'], { cwd: f.root, encoding: 'utf8' });
    expect(input.status, input.stdout + input.stderr).toBe(0);
    const result = await f.run();
    expect(result.exit, result.raw).toBe(0);
    expect(result.report).toMatchObject({ mode: 'reuse', acceptedDraft: false, validation: 'unverified', quality: 'pending', live: 'unverified' });
    expect(await fs.readFile(path.join(f.draft, 'core/subagent-example.core.md'))).toEqual(coreBytes);
    expect(await fs.readFile(path.join(f.draft, 'core/subagent-example.contract.json'))).toEqual(contractBytes);
    expect(await fs.readFile(coreFile)).toEqual(coreBytes);
    expect(await fs.readFile(contractFile)).toEqual(contractBytes);
  });
  it('updates one core while preserving the complete baseline, companion and unrelated notes', async () => {
    const f = await fixture();
    const created = await f.run();
    expect(created.exit, created.raw).toBe(0);
    const corePath = 'core/subagent-example.core.md';
    const contractPath = 'core/subagent-example.contract.json';
    await fs.outputFile(path.join(f.draft, 'notes.md'), 'Keep this unrelated note.\n');
    const baseline = await Promise.all([corePath, contractPath, 'notes.md'].map(async rel => {
      const bytes = await fs.readFile(path.join(f.draft, rel));
      const snapshot = path.join(f.evidence, 'baseline', rel);
      await fs.outputFile(snapshot, bytes);
      return { path: rel, sha256: hash(bytes), bytes: bytes.length, snapshot: await f.pin(snapshot) };
    }));
    const before = await fs.readFile(path.join(f.draft, corePath), 'utf8');
    const after = before.replace('Review the supplied plan.', 'Review the supplied checked plan.');
    expect(after).not.toBe(before);
    f.job.mode = 'update';
    f.job.baseline = baseline;
    f.job.allowedPaths = [corePath];
    f.job.protectedNotes = [{ path: 'notes.md', contains: 'Keep this unrelated note.' }, { path: corePath, contains: 'Owner: unknown' }];
    f.job.proposal = { coreText: after };
    const result = await f.run();
    expect(result.exit, result.raw).toBe(0);
    expect(result.report?.diff).toEqual([{ path: corePath, before, after }]);
    expect(await fs.readFile(path.join(f.draft, 'notes.md'), 'utf8')).toBe('Keep this unrelated note.\n');
    expect(await fs.readFile(path.join(f.draft, contractPath))).toEqual(await fs.readFile(path.join(f.evidence, 'baseline', contractPath)));
    expect(result.report?.protectedNotes).toEqual([{ path: 'notes.md', contains: 'Keep this unrelated note.', preserved: true }, { path: corePath, contains: 'Owner: unknown', preserved: true }]);
    const checked = spawnSync(process.execPath, [path.join(f.checkout, 'dist/cli.js'), 'contract-check', '--registry', f.draft, '--definition', 'subagent-example'], { cwd: f.root, encoding: 'utf8' });
    expect(checked.status, checked.stdout + checked.stderr).toBe(0);
  });
  it('prepares the complete existing upstream template for dev without publishing', async () => {
    const f = await fixture();
    const template = await fs.readFile(path.resolve('.github/PULL_REQUEST_TEMPLATE/artifact-contribution.md'), 'utf8');
    const templateFile = path.join(f.checkout, '.github/PULL_REQUEST_TEMPLATE/artifact-contribution.md');
    await fs.outputFile(templateFile, template);
    f.job.intent = 'upstream';
    f.job.contributionTemplate = await f.pin(templateFile);
    const result = await f.run();
    expect(result.exit, result.raw).toBe(0);
    expect(result.report?.upstreamPreparation).toMatchObject({ base: 'dev', sent: false, templatePath: templateFile });
    const preparation = result.report?.upstreamPreparation as { body: string };
    expect(preparation.body.startsWith(template)).toBe(true);
    expect(preparation.body).toContain('subagent-example.core.md');
    expect(result.report?.externalActions).toEqual([]);
    expect(execFileSync('git', ['-C', f.checkout, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()).toBe(f.head);
    expect(await fs.pathExists(path.join(f.draft, '.git'))).toBe(false);
  });
  it.each([
    ['unknown job key', (job: Record<string, unknown>) => { job.command = 'unused supplied command'; }, /unknown field command/i],
    ['unknown authored core key', (job: Record<string, unknown>) => { ((job.proposal as Record<string, unknown>).core as Record<string, unknown>).tools = ['Bash']; }, /unknown field tools/i],
    ['background fork', (job: Record<string, unknown>) => { (job.loading as Record<string, unknown>).background = true; }, /constant false/i],
    ['model spending', (job: Record<string, unknown>) => { (job.budget as Record<string, unknown>).modelCalls = true; }, /constant false/i],
    ['USD spending', (job: Record<string, unknown>) => { (job.budget as Record<string, unknown>).maxUsd = 1; }, /constant 0/i],
    ['oversized check budget', (job: Record<string, unknown>) => { (job.budget as Record<string, unknown>).maxChecks = 7; }, /budget/i],
    ['actual file budget', (job: Record<string, unknown>) => { (job.budget as Record<string, unknown>).maxFiles = 1; }, /file\/byte budget/i],
    ['wrong checkout HEAD', (job: Record<string, unknown>) => { (job.source as Record<string, unknown>).head = '0'.repeat(40); }, /HEAD/i],
    ['undeclared path', (job: Record<string, unknown>) => { job.allowedPaths = ['core/subagent-example.core.md', '../escaped.json']; }, /derived pair/i],
    ['missing fixed value', (job: Record<string, unknown>) => { job.fixedValues = ['Not in the proposed pair']; }, /fixed value/i],
    ['unresolved provenance', (job: Record<string, unknown>) => { (job.provenance as Record<string, unknown>).unresolved = ['Required source is missing']; }, /provenance/i],
  ] as const)('blocks %s before creating a draft', async (_label, mutate, reason) => {
    const f = await fixture();
    mutate(f.job);
    const result = await f.run();
    expect(result.exit, result.raw).toBe(1);
    expect(result.raw).toMatch(reason);
    expect(await fs.pathExists(f.draft)).toBe(false);
  });
  it('consumes the copied schema and fails closed on an unsupported schema keyword', async () => {
    const f = await fixture();
    const schemaFile = path.join(f.installed, 'assets/job.schema.json');
    const schema = await fs.readJson(schemaFile) as { properties: { version: { const: number } }; unevaluatedProperties?: boolean };
    schema.properties.version.const = 2;
    await fs.writeJson(schemaFile, schema);
    const changed = await f.run();
    expect(changed.exit, changed.raw).toBe(1);
    expect(changed.raw).toMatch(/constant 2/i);
    schema.properties.version.const = 1;
    schema.unevaluatedProperties = false;
    await fs.writeJson(schemaFile, schema);
    const unsupported = await f.run();
    expect(unsupported.exit, unsupported.raw).toBe(1);
    expect(unsupported.raw).toMatch(/Unsupported schema keyword/i);
    expect(await fs.pathExists(f.draft)).toBe(false);
  });
  it('blocks missing or altered required validator bytes before draft writes', async () => {
    const f = await fixture();
    const cliFile = path.join(f.checkout, 'dist/cli.js');
    const bytes = await fs.readFile(cliFile);
    await fs.writeFile(cliFile, 'Changed validator bytes.');
    const changed = await f.run();
    expect(changed.exit, changed.raw).toBe(1);
    expect(changed.raw).toMatch(/changed hash/i);
    await fs.writeFile(cliFile, bytes);
    await fs.remove(cliFile);
    const missing = await f.run();
    expect(missing.exit, missing.raw).toBe(1);
    expect(missing.raw).toMatch(/missing file/i);
    expect(await fs.pathExists(f.draft)).toBe(false);
  });
  it('refuses an evidence root inside a protected location', async () => {
    const f = await fixture();
    f.job.evidenceRoot = path.join(f.root, 'private/evidence');
    const result = await f.run();
    expect(result.exit, result.raw).toBe(1);
    expect(result.raw).toMatch(/evidence.*protected|protected.*evidence/i);
    expect(await fs.pathExists(f.draft)).toBe(false);
  });
  it('reports an unknown permitted Skill as unavailable without making it a required preload', async () => {
    const f = await fixture();
    const proposal = f.job.proposal as { contract: { skills: string[] } };
    proposal.contract.skills = ['future-notes'];
    const result = await f.run();
    expect(result.exit, result.raw).toBe(0);
    expect(result.report?.bindingFindings).toEqual([{ kind: 'skill', id: 'future-notes', required: false, source: 'unavailable', execution: 'unverified', evidence: [] }]);
    expect(JSON.parse(await fs.readFile(path.join(f.draft, 'core/subagent-example.contract.json'), 'utf8')).skills).toEqual(['future-notes']);
    expect(result.report?.acceptedDraft).toBe(false);
  });
  it('blocks an explicitly required binding without source evidence before writing', async () => {
    const f = await fixture();
    ((f.job.proposal as Record<string, unknown>).contract as { skills: string[] }).skills = ['future-notes'];
    f.job.bindings = [{ kind: 'skill', id: 'future-notes', required: true, evidence: [] }];
    const result = await f.run();
    expect(result.exit, result.raw).toBe(1);
    expect(result.raw).toMatch(/Required skill binding unavailable/i);
    expect(await fs.pathExists(f.draft)).toBe(false);
  });
  it('checks binding source bytes while keeping its execution unverified', async () => {
    const f = await fixture();
    ((f.job.proposal as Record<string, unknown>).contract as { skills: string[] }).skills = ['review-notes'];
    const source = path.join(f.registry, 'skills/review-notes/SKILL.md');
    await fs.outputFile(source, 'Review supplied notes.');
    const evidence = [await f.pin(source)];
    f.job.bindings = [{ kind: 'skill', id: 'review-notes', required: true, evidence }];
    const result = await f.run();
    expect(result.exit, result.raw).toBe(0);
    expect(result.report?.bindingFindings).toEqual([{ kind: 'skill', id: 'review-notes', required: true, source: 'checked', execution: 'unverified', evidence }]);
  });
  it('keeps an altered optional binding as an unavailable finding', async () => {
    const f = await fixture();
    ((f.job.proposal as Record<string, unknown>).contract as { skills: string[] }).skills = ['review-notes'];
    const source = path.join(f.registry, 'skills/review-notes/SKILL.md');
    await fs.outputFile(source, 'Original notes source.');
    f.job.bindings = [{ kind: 'skill', id: 'review-notes', required: false, evidence: [await f.pin(source)] }];
    await fs.writeFile(source, 'Changed source.');
    const result = await f.run();
    expect(result.exit, result.raw).toBe(0);
    expect(result.report?.bindingFindings).toMatchObject([{ kind: 'skill', id: 'review-notes', required: false, source: 'unavailable', execution: 'unverified', reason: expect.stringMatching(/changed hash/i) }]);
  });
  it('quotes authored scalar text without allowing it to inject YAML fields', async () => {
    const f = await fixture();
    f.core.identity = 'Quoted "reviewer":\n---\nsurprise: true';
    const result = await f.run();
    expect(result.exit, result.raw).toBe(0);
    const text = await fs.readFile(path.join(f.draft, 'core/subagent-example.core.md'), 'utf8');
    const meta = YAML.parse(/^---\n([\s\S]*?)\n---\n/.exec(text)![1]!) as Record<string, unknown>;
    expect(meta.identity).toBe(f.core.identity);
    expect(meta.surprise).toBeUndefined();
  });
  it.each(['incomplete baseline', 'stale user file', 'changed snapshot', 'outside scope', 'protected note', 'linked draft file'])('preserves the complete draft when refusing %s', async kind => {
    const f = await updateFixture();
    if (kind === 'incomplete baseline') (f.job.baseline as unknown[]).pop();
    else if (kind === 'stale user file') await fs.writeFile(path.join(f.draft, 'notes.md'), 'New user edit must survive.');
    else if (kind === 'changed snapshot') await fs.writeFile(path.join(f.evidence, 'baseline/notes.md'), 'Changed immutable snapshot.');
    else if (kind === 'outside scope') f.job.proposal = { contract: { definition: 'subagent-example', skills: [], workflows: [], hooks: [] } };
    else if (kind === 'protected note') (f.job.proposal as { coreText: string }).coreText = (f.job.proposal as { coreText: string }).coreText.replace('Keep the protected core note.', 'Removed.');
    else await fs.symlink(path.join(f.draft, 'notes.md'), path.join(f.draft, 'linked-note.md'), 'file');
    const before = await draftInventory(f.draft);
    const result = await f.run();
    expect(result.exit, result.raw).toBe(1);
    expect(result.raw).toMatch(/baseline|hash|scope|Protected note|linked/i);
    expect(await draftInventory(f.draft)).toEqual(before);
  });
  it('blocks adapted work without the inspected upstream, licence and comparison record', async () => {
    const f = await fixture();
    (f.job.provenance as Record<string, unknown>).disposition = 'adapted';
    const result = await f.run();
    expect(result.exit, result.raw).toBe(1);
    expect(result.raw).toMatch(/adapted.*upstream|upstream.*adapted/i);
    expect(await fs.pathExists(f.draft)).toBe(false);
  });
  it.each(['retained', 'lost', 'changed pin', 'new third file'])('checks adapted notice handling: %s', async kind => {
    const f = await fixture();
    const source = path.join(f.checkout, 'upstream/reviewer.core.md');
    const license = path.join(f.checkout, 'upstream/LICENSE');
    const comparison = path.join(f.evidence, 'comparison.md');
    const notice = 'Synthetic source licence notice, retained verbatim.\n';
    await fs.outputFile(source, 'Pinned source fixture; not a legal or originality verdict.\n');
    await fs.outputFile(license, notice);
    await fs.outputFile(comparison, 'Recorded comparison fixture.\n');
    const licensePin = await f.pin(license);
    f.job.provenance = {
      disposition: 'adapted', author: 'Example Author', license: 'MIT', evidence: [], unresolved: [],
      upstream: { repository: 'https://example.invalid/source-fixture', path: 'reviewer.core.md', commit: f.head, source: await f.pin(source), license: licensePin, comparison: await f.pin(comparison), notices: [{ source: licensePin, targetPath: 'core/subagent-example.core.md', mode: 'fragment' }] },
    };
    (f.job.proposal as { body: string }).body += notice;
    if (kind === 'lost') (f.job.proposal as { body: string }).body = 'Owner: unknown\nRequired licence omitted.\n';
    else if (kind === 'changed pin') await fs.writeFile(license, 'Different licence bytes.\n');
    else if (kind === 'new third file') ((f.job.provenance as { upstream: { notices: Array<{ targetPath: string }> } }).upstream.notices[0]!).targetPath = 'LICENSE';
    const result = await f.run();
    if (kind !== 'retained') {
      expect(result.exit, result.raw).toBe(1);
      expect(result.raw).toMatch(/notice bytes not retained|changed hash/i);
      expect(await fs.pathExists(f.draft)).toBe(false);
      return;
    }
    expect(result.exit, result.raw).toBe(0);
    expect(result.report?.provenance).toMatchObject({ disposition: 'adapted', review: 'pending' });
    expect(result.report?.retainedNotices).toEqual([{ sourcePath: license, targetPath: 'core/subagent-example.core.md', sha256: hash(notice), mode: 'fragment' }]);
    expect(await fs.readFile(path.join(f.draft, 'core/subagent-example.core.md'), 'utf8')).toContain(notice);
    expect(result.report?.acceptedDraft).toBe(false);
  });
});
