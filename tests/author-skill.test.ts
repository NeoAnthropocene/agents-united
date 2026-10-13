import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import YAML from 'yaml';
import { afterEach, describe, expect, it } from 'vitest';
import { validateRewrittenSkill } from './helpers/skill-contract.js';
import { checkSkillLayout, supportingText } from './helpers/skill-layout.js';
import { lintSkillPortability } from '../src/core/skill-portability-lint.js';
import { lintSkillLicence } from '../src/core/skill-licence-lint.js';
import { loadCorpus, measureSkill, verdictOf } from '../scripts/skill-quality/measure.ts';
import { ClaudeProjector } from '../src/core/claude-projector.js';
import type { BundleDefinition, ResolvedAssets } from '../src/core/types.js';

const registry = path.resolve('registry');
const skills = path.join(registry, 'skills');
const candidate = path.join(skills, 'author-skill');
const script = path.join(candidate, 'scripts', 'draft.mjs');
const roots: string[] = [];
const sha = (text: string | Buffer): string => createHash('sha256').update(text).digest('hex');
afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }); });
function files(dir: string, prefix = ''): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(path.join(dir, e.name), `${prefix}${e.name}/`) : [`${prefix}${e.name}`]).sort();
}
const entry = `---\nname: incident-actions\ndescription: Use when converting incident notes into action records.\nmetadata:\n  author: Example Author\n  version: "1.0.0"\n  license: MIT\n---\n# Incident actions\nRecord unknown owners without inventing a deadline.\n`;
interface Fixture { root: string; source: string; draft: string; job: Record<string, unknown>; }
function fixture(): Fixture {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'author-skill-'));
  roots.push(root);
  const source = path.join(root, 'checkout');
  const draft = path.join(root, 'draft', 'incident-actions');
  const rule = path.join(root, 'loader', 'skill-attribution.md');
  const loader = path.join(root, 'loader', 'SKILL.md');
  const tool = path.join(source, 'validate.mjs');
  fs.mkdirSync(source, { recursive: true });
  fs.mkdirSync(path.dirname(rule), { recursive: true });
  fs.writeFileSync(rule, 'Original and adapted attribution policy.');
  fs.writeFileSync(loader, 'Reviewed loader entry.');
  fs.writeFileSync(tool, 'export const validator = true;');
  return { root, source, draft, job: {
    mode: 'create', intent: 'local', sourceRoot: source, draftRoot: draft,
    allowedPaths: ['SKILL.md', 'examples/action.md'],
    changes: { 'SKILL.md': entry, 'examples/action.md': 'Retry the import; ask Lina who owns it. Owner: unknown.\n' },
    provenance: { disposition: 'original', owner: 'Example Author', version: '1.0.0', license: 'MIT' },
    loading: { role: 'general-purpose', entryPath: loader, attributionPath: rule, requiredFiles: [rule, loader] },
    requiredTools: [{ name: 'candidate validator', path: tool }],
  } };
}
function run(f: Fixture, executable = script): { exit: number | null; output: string; report: Record<string, unknown> } {
  const jobPath = path.join(f.root, 'job.json');
  fs.writeFileSync(jobPath, JSON.stringify(f.job));
  const result = spawnSync(process.execPath, [executable, jobPath], { cwd: f.root, encoding: 'utf8' });
  const output = `${result.stdout}${result.stderr}`;
  return { exit: result.status, output, report: result.status === 0 ? JSON.parse(result.stdout) as Record<string, unknown> : {} };
}
function expectBlocked(f: Fixture, reason: RegExp): void {
  const result = run(f);
  expect(result.exit, result.output).toBe(1);
  expect(result.output).toMatch(reason);
  expect(fs.existsSync(f.draft)).toBe(false);
}

describe('author-skill final source gates', () => {
  it('passes the existing skill contract and compact layout without an exception marker', () => {
    const raw = fs.readFileSync(path.join(candidate, 'SKILL.md'), 'utf8');
    expect(validateRewrittenSkill('author-skill', raw, supportingText(candidate))).toEqual([]);
    expect(checkSkillLayout(skills, 'author-skill')).toEqual([]);
    expect(fs.existsSync(path.resolve('tests/fixtures/templated-skills/author-skill'))).toBe(false);
  });
  it('passes portability and original MIT licence checks for the actual final files', () => {
    const raw = fs.readFileSync(path.join(candidate, 'SKILL.md'), 'utf8');
    const fm = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/)![1]!;
    const meta = YAML.parse(fm) as { name: string; metadata: { author: string; version: string; license: string; source?: string; adaptedFrom?: string } };
    expect(meta.metadata).toEqual({ author: 'agents-united', version: '1.0.0', license: 'MIT' });
    expect(lintSkillPortability({ dirName: 'author-skill', name: meta.name, body: raw.slice(fm.length), scripts: files(candidate).filter(f => f.startsWith('scripts/')).map(relPath => ({ relPath, content: fs.readFileSync(path.join(candidate, relPath), 'utf8') })) })).toEqual([]);
    expect(lintSkillLicence({ dirName: 'author-skill', license: meta.metadata.license, source: meta.metadata.source, files: files(candidate) })).toEqual([]);
  });
  it('passes the frozen quality corpus with no stub or changed corpus', () => {
    const corpus = loadCorpus(path.resolve('tests/fixtures/skill-boilerplate-corpus.txt'));
    const measure = measureSkill(skills, 'author-skill', corpus);
    expect(measure.share).toBeLessThan(0.30);
    expect(verdictOf(measure)).toBe('ok');
  });
  it('prepares an explicit same-prompt eval pair and unrelated control without recording runs or thresholds', () => {
    const evals = JSON.parse(fs.readFileSync(path.join(candidate, 'evals/evals.json'), 'utf8')) as { status: string; evals: Array<{ id: number; prompt: string; kind?: string; runs?: Array<{ condition: string; prompt: string }> }>; results?: unknown; success_threshold?: unknown };
    expect(evals.status).toBe('prepared-not-run');
    const pair = evals.evals.find(e => e.kind !== 'unrelated-control')!;
    expect(pair.runs?.map(r => r.condition)).toEqual(['with-skill', 'without-skill']);
    expect(pair.runs?.map(r => r.prompt)).toEqual([pair.prompt, pair.prompt]);
    expect(evals.evals.filter(e => e.kind === 'unrelated-control')).toHaveLength(1);
    expect(evals.results).toBeUndefined();
    expect(evals.success_threshold).toBeUndefined();
  });
  it('keeps the report asset and executable support in projection plans but excludes maintainer evals', async () => {
    const bundle: BundleDefinition = { name: 'author-skill-fixture', description: 'Author skill source resources', orchestrator: 'none.md', agents: [], skills: ['author-skill'] };
    const resolved: ResolvedAssets = { targetBundle: bundle.name, agents: [], skills: ['author-skill'], workflows: [], rules: [] };
    resolved.rules = ['skill-attribution.md'];
    const artifacts = await ClaudeProjector.planCompoundProjection(bundle, 'project', resolved, registry, undefined, true);
    expect(artifacts.some(a => a.relPath.endsWith('/author-skill/assets/report.md'))).toBe(true);
    expect(artifacts.some(a => a.relPath.endsWith('/author-skill/scripts/draft.mjs'))).toBe(true);
    expect(artifacts.some(a => a.relPath.includes('/author-skill/evals/'))).toBe(false);
  });
});

describe('author-skill installed-safe bounded draft seam', () => {
  it('runs a copy of the helper outside the checkout without dependencies or relative imports', () => {
    const f = fixture();
    const installedHelper = path.join(f.root, 'installed-skill', 'scripts', 'draft.mjs');
    fs.mkdirSync(path.dirname(installedHelper), { recursive: true });
    fs.copyFileSync(script, installedHelper);
    const result = run(f, installedHelper);
    expect(result.exit, result.output).toBe(0);
    expect(result.report.inventory).toEqual(expect.arrayContaining([expect.objectContaining({ path: 'SKILL.md', sha256: sha(entry) })]));
    expect(fs.existsSync(path.join(f.root, 'node_modules'))).toBe(false);
  });
  it('creates a complete explicit local draft with actual hashes, diff and no installed files', () => {
    const f = fixture();
    const result = run(f);
    expect(result.exit, result.output).toBe(0);
    expect(files(f.draft)).toEqual(['SKILL.md', 'examples/action.md']);
    expect(result.report.inventory).toEqual([{ path: 'SKILL.md', sha256: sha(entry) }, { path: 'examples/action.md', sha256: sha('Retry the import; ask Lina who owns it. Owner: unknown.\n') }]);
    expect(result.report.diff).toEqual(expect.arrayContaining([expect.objectContaining({ path: 'SKILL.md', before: null, after: entry })]));
    expect(result.report.externalActions).toEqual([]);
    expect(fs.existsSync(path.join(f.root, '.agents'))).toBe(false);
    expect(result.report.validation).toEqual({ status: 'unverified', reason: 'Tool presence is checked; validators and live host behavior were not executed.' });
  });
  it('repairs only the supplied allowed path and preserves the user example byte for byte', () => {
    const f = fixture();
    fs.mkdirSync(path.join(f.draft, 'examples'), { recursive: true });
    fs.writeFileSync(path.join(f.draft, 'SKILL.md'), entry);
    const notes = 'User edit: Lina is a reviewer, not the owner.\r\n';
    fs.writeFileSync(path.join(f.draft, 'examples/user-notes.md'), notes);
    const binary = Buffer.from([0, 255, 128, 1]);
    fs.mkdirSync(path.join(f.draft, 'assets/empty'), { recursive: true });
    fs.writeFileSync(path.join(f.draft, 'assets/user.bin'), binary);
    f.job.mode = 'repair';
    f.job.allowedPaths = ['SKILL.md'];
    f.job.baseline = { 'SKILL.md': sha(entry), 'examples/user-notes.md': sha(notes), 'assets/user.bin': sha(binary) };
    f.job.changes = { 'SKILL.md': entry.replace('converting incident notes', 'extracting unknown ownership from incident notes') };
    const result = run(f);
    expect(result.exit, result.output).toBe(0);
    expect(fs.readFileSync(path.join(f.draft, 'examples/user-notes.md'), 'utf8')).toBe(notes);
    expect(fs.readFileSync(path.join(f.draft, 'assets/user.bin'))).toEqual(binary);
    expect(fs.statSync(path.join(f.draft, 'assets/empty')).isDirectory()).toBe(true);
    expect(result.report.diff).toEqual([expect.objectContaining({ path: 'SKILL.md', before: entry })]);
  });
  it.each(['stale', 'incomplete'])('blocks %s repair baselines before altering any draft bytes', (kind) => {
    const f = fixture();
    fs.mkdirSync(f.draft, { recursive: true });
    fs.writeFileSync(path.join(f.draft, 'SKILL.md'), entry);
    f.job.mode = 'repair';
    f.job.baseline = kind === 'stale' ? { 'SKILL.md': sha('older draft') } : {};
    const result = run(f);
    expect(result.exit).toBe(1);
    expect(result.output).toMatch(/baseline.*changed/i);
    expect(fs.readFileSync(path.join(f.draft, 'SKILL.md'), 'utf8')).toBe(entry);
  });
  it('blocks adapted material with a missing licence and pin, naming the owner and remedy', () => {
    const f = fixture();
    f.job.provenance = { disposition: 'adapted', owner: 'Source maintainer', version: '1.0.0' };
    expectBlocked(f, /Source maintainer.*licence.*40-character.*commit/i);
  });
  it('requires retained upstream licence bytes before preparing an adapted draft', () => {
    const f = fixture();
    const commit = 'a'.repeat(40);
    const source = `https://github.com/example/source/tree/${commit}/skills/actions`;
    const licence = path.join(f.root, 'upstream-LICENSE');
    const comparison = path.join(f.root, 'comparison.json');
    fs.writeFileSync(licence, 'MIT licence\nCopyright upstream author\n');
    fs.writeFileSync(comparison, '{"candidate":"incident-actions","upstreamCommit":"' + commit + '"}');
    f.job.provenance = { disposition: 'adapted', owner: 'Source maintainer', version: '1.0.0', license: 'MIT', commit, source, licencePath: licence, comparisonEvidence: comparison, licenceTarget: 'LICENSE' };
    f.job.changes = { 'SKILL.md': entry.replace('  license: MIT', `  license: MIT\n  source: ${source}`) };
    const blocked = run(f);
    expect(blocked.exit).toBe(1);
    expect(blocked.output).toMatch(/retain.*licence/i);
    expect(fs.existsSync(f.draft)).toBe(false);
    f.job.allowedPaths = ['SKILL.md', 'LICENSE'];
    f.job.changes = { ...(f.job.changes as Record<string, string>), LICENSE: fs.readFileSync(licence, 'utf8') };
    const prepared = run(f);
    expect(prepared.exit, prepared.output).toBe(0);
    expect(fs.readFileSync(path.join(f.draft, 'LICENSE'), 'utf8')).toBe(fs.readFileSync(licence, 'utf8'));
    expect(prepared.report.provenance).toEqual(expect.objectContaining({ disposition: 'adapted', commit, evidenceClaim: 'Declared evidence paths exist; provenance/legal review is still required.' }));
  });
  it('rejects an output reached through a filesystem link without altering its target', () => {
    const f = fixture();
    const actual = path.join(f.root, 'other-drafts');
    const linked = path.join(f.root, 'linked-drafts');
    fs.mkdirSync(actual);
    fs.symlinkSync(actual, linked, 'junction');
    f.job.draftRoot = path.join(linked, 'incident-actions');
    expectBlocked(f, /linked.*location/i);
    expect(fs.readdirSync(actual)).toEqual([]);
  });
  it.each(['source', 'adaptedFrom'])('blocks original work carrying false %s metadata', (field) => {
    const f = fixture();
    f.job.changes = { 'SKILL.md': entry.replace('  license: MIT', `  license: MIT\n  ${field}: https://github.com/example/uninspected`) };
    expectBlocked(f, /original.*source|false.*adaptation/i);
  });
  it('blocks unavailable required validation tools without claiming a clean result', () => {
    const f = fixture();
    f.job.requiredTools = [{ name: 'candidate quality validator', path: path.join(f.source, 'missing.mjs') }];
    expectBlocked(f, /candidate quality validator.*unavailable/i);
  });
  it.each(['role', 'entryPath', 'attributionPath', 'requiredFiles'])('blocks a missing loading %s prerequisite', (edge) => {
    const f = fixture();
    const loading = f.job.loading as Record<string, unknown>;
    if (edge === 'role') delete loading.role;
    else if (edge === 'entryPath') loading.entryPath = path.join(f.root, 'missing-entry.md');
    else if (edge === 'attributionPath') loading.attributionPath = path.join(f.root, 'missing-rule.md');
    else loading.requiredFiles = [path.join(f.root, 'missing-support.md')];
    expectBlocked(f, /loading|attribution|required support/i);
  });
  it.each(['equal', 'inside', 'contains'])('rejects %s source/output overlap before writes', (overlap) => {
    const f = fixture();
    f.job.draftRoot = overlap === 'equal' ? f.source : overlap === 'inside' ? path.join(f.source, 'draft') : f.root;
    const before = files(f.source);
    const result = run(f);
    expect(result.exit).toBe(1);
    expect(result.output).toMatch(/overlap/i);
    expect(files(f.source)).toEqual(before);
    expect(fs.existsSync(f.draft)).toBe(false);
  });
  it('rejects managed output roots and path traversal before writes', () => {
    const managed = fixture();
    managed.job.draftRoot = path.join(managed.root, '.claude', 'skills', 'incident-actions');
    expectBlocked(managed, /managed/i);
    const traversal = fixture();
    traversal.job.allowedPaths = ['../escape.md'];
    traversal.job.changes = { '../escape.md': 'unsafe' };
    expectBlocked(traversal, /relative|traversal/i);
    expect(fs.existsSync(path.join(traversal.root, 'draft', 'escape.md'))).toBe(false);
  });
  it.each(['.gemini', '.codex'])('rejects the known %s host output root before creating files', (hostRoot) => {
    const f = fixture();
    const managedDraft = path.join(f.root, hostRoot, 'skills', 'incident-actions');
    f.job.draftRoot = managedDraft;
    expectBlocked(f, /managed/i);
    expect(fs.existsSync(managedDraft)).toBe(false);
  });
  it('rejects out-of-scope file edits before writes', () => {
    const f = fixture();
    f.job.allowedPaths = ['SKILL.md'];
    expectBlocked(f, /scope.*examples\/action.md/i);
  });
  it('rejects case-colliding edits and final files before touching the draft', () => {
    const f = fixture();
    f.job.allowedPaths = ['SKILL.md', 'skill.md'];
    f.job.changes = { 'SKILL.md': entry, 'skill.md': entry };
    expectBlocked(f, /case-colliding/i);
    fs.mkdirSync(f.draft, { recursive: true });
    fs.writeFileSync(path.join(f.draft, 'SKILL.md'), entry);
    f.job.mode = 'repair';
    f.job.baseline = { 'SKILL.md': sha(entry) };
    f.job.changes = { 'skill.md': entry };
    const result = run(f);
    expect(result.exit).toBe(1);
    expect(result.output).toMatch(/case-colliding/i);
    expect(fs.readFileSync(path.join(f.draft, 'SKILL.md'), 'utf8')).toBe(entry);
  });
  it('prepares the existing upstream template and evidence locally without sending a PR', () => {
    const f = fixture();
    const templatePath = path.join(f.source, '.github/PULL_REQUEST_TEMPLATE/artifact-contribution.md');
    fs.mkdirSync(path.dirname(templatePath), { recursive: true });
    fs.writeFileSync(templatePath, '# Artifact contribution\nHost binding and provenance review\n');
    f.job.intent = 'upstream';
    f.job.contributionTemplate = templatePath;
    const result = run(f);
    expect(result.exit, result.output).toBe(0);
    expect(result.report.upstreamPreparation).toEqual(expect.objectContaining({ base: 'dev', sent: false, templatePath, body: expect.stringContaining('# Artifact contribution') }));
    expect(result.report.externalActions).toEqual([]);
    expect(fs.readFileSync(templatePath, 'utf8')).toBe('# Artifact contribution\nHost binding and provenance review\n');
  });
});
