import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import YAML from 'yaml';
import { afterEach, describe, expect, it } from 'vitest';
import { validateRewrittenSkill } from './helpers/skill-contract.js';
import { checkSkillLayout, supportingText } from './helpers/skill-layout.js';
import { lintSkillPortability } from '../src/core/skill-portability-lint.js';
import { lintSkillLicence } from '../src/core/skill-licence-lint.js';
import { loadCorpus, measureSkill, verdictOf } from '../scripts/skill-quality/measure.ts';
import { runWorkflowCheck, workflowCheckExitCode } from '../src/core/workflow-check.js';
import { BOUND_FACTORY_SKILLS, parseClaudeSkillBinding } from '../src/core/claude-skill-binding.js';

/**
 * ADR 0082 slice 5: the `author-workflow` factory Skill, the second route after `author-rule` and in the same shape: a shared entry
 * within the factory budget, selective references, a bounded deterministic helper, evals, a native Claude loader and a binding record
 * from the closed list. Its job is one native Claude workflow, `registry/hosts/claude/workflows/<name>.js`, for a portable Skill of
 * the same name that already exists, checked afterwards by `agents workflow-check`. The helper writes only that file.
 */
const registry = path.resolve('registry');
const skills = path.join(registry, 'skills');
const candidate = path.join(skills, 'author-workflow');
const loaderFile = path.join(registry, 'hosts/claude/skills/author-workflow/SKILL.md');
const helper = path.join(candidate, 'scripts/draft.mjs');
const roots: string[] = [];
const sha = (text: string | Buffer): string => createHash('sha256').update(text).digest('hex');
afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }); });
function files(dir: string, prefix = ''): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(path.join(dir, e.name), `${prefix}${e.name}/`) : [`${prefix}${e.name}`]).sort();
}
const frontMatter = (text: string): { meta: Record<string, any>; body: string } => {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(text)!;
  return { meta: YAML.parse(match[1]!) as Record<string, any>, body: text.slice(match[0].length) };
};
const lines = (text: string): string[] => text.split(/\r?\n/);

describe('author-workflow source gates', () => {
  it('passes the Skill contract and the compact layout, within the factory entry budget', () => {
    const raw = fs.readFileSync(path.join(candidate, 'SKILL.md'), 'utf8');
    expect(validateRewrittenSkill('author-workflow', raw, supportingText(candidate))).toEqual([]);
    expect(checkSkillLayout(skills, 'author-workflow')).toEqual([]);
    expect(lines(raw).length).toBeLessThanOrEqual(90);
    expect(raw.replace(/\r\n/g, '\n').length).toBeLessThanOrEqual(6000);
    expect(fs.existsSync(path.resolve('tests/fixtures/templated-skills/author-workflow'))).toBe(false);
  });

  it('has a trigger-first description within 1,024 characters, and original in-house metadata', () => {
    const { meta } = frontMatter(fs.readFileSync(path.join(candidate, 'SKILL.md'), 'utf8'));
    expect(meta.name).toBe('author-workflow');
    expect(String(meta.description).length).toBeLessThanOrEqual(1024);
    expect(String(meta.description)).toMatch(/^Use when asked to create or repair one native Claude workflow/);
    expect(meta.metadata).toEqual({ author: 'agents-united', version: '1.0.0', license: 'MIT' });
  });

  it('passes portability, the original MIT licence check and the frozen quality corpus', () => {
    const raw = fs.readFileSync(path.join(candidate, 'SKILL.md'), 'utf8');
    const { meta } = frontMatter(raw);
    const fm = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/)![1]!;
    expect(lintSkillPortability({ dirName: 'author-workflow', name: meta.name, body: raw.slice(fm.length), scripts: files(candidate).filter(f => f.startsWith('scripts/')).map(relPath => ({ relPath, content: fs.readFileSync(path.join(candidate, relPath), 'utf8') })) })).toEqual([]);
    expect(lintSkillLicence({ dirName: 'author-workflow', license: meta.metadata.license, source: meta.metadata.source, files: files(candidate) })).toEqual([]);
    const measure = measureSkill(skills, 'author-workflow', loadCorpus(path.resolve('tests/fixtures/skill-boilerplate-corpus.txt')));
    expect(measure.share).toBeLessThan(0.30);
    expect(verdictOf(measure)).toBe('ok');
  });

  it('carries the workflow route vocabulary, the paired-Skill rule and the scope limits', () => {
    const raw = fs.readFileSync(path.join(candidate, 'SKILL.md'), 'utf8');
    const text = `${raw}\n${supportingText(candidate)}`;
    expect(raw).toMatch(/registry\/hosts\/claude\/workflows\//);
    expect(raw).toMatch(/workflow-check/);
    expect(raw).toMatch(/author-skill/);
    expect(raw).toMatch(/unresolvedAgentTypes/);
    expect(raw).toMatch(/not verified/);
    expect(text).toMatch(/scripts\/draft\.mjs/);
    expect(text).toMatch(/bundles\.json/);
    expect(text).toMatch(/Antigravity/);
    expect(text).toMatch(/Cline/);
    expect(text).toMatch(/never pushes|no commit, push/i);
  });

  it('names the Bundle membership note in the entry, the native loader, the report and the job contract, and says how repair mode states it', () => {
    for (const file of [path.join(candidate, 'SKILL.md'), loaderFile]) {
      const text = fs.readFileSync(file, 'utf8');
      const step = lines(text).find(line => line.startsWith('7. ')) ?? '';
      expect(step, file).toMatch(/whether a Bundle lists the paired Skill/);
      expect(step, file).toMatch(/Create mode/);
      expect(step, file).toMatch(/`bundleMembership`/);
      expect(step, file).toMatch(/Repair mode/);
      expect(step, file).toMatch(/registry\/bundles\.json/);
      expect(lines(text).length, file).toBeLessThanOrEqual(90);
      // The repository measures the cap on the source with normalised line endings, so a CRLF checkout does not fail it.
      expect(text.replace(/\r\n/g, '\n').length, file).toBeLessThanOrEqual(6000);
    }
    const report = fs.readFileSync(path.join(candidate, 'assets/report.md'), 'utf8');
    expect(report).toMatch(/yes or no/i);
    expect(report).toMatch(/which Bundles/);
    const job = fs.readFileSync(path.join(candidate, 'references/job.md'), 'utf8');
    expect(job).toMatch(/`bundleMembership`/);
    expect(job).toMatch(/never refuses/i);
    expect(job).toMatch(/never installed/);
    expect(job).toMatch(/Repair mode[^\n]*registry\/bundles\.json|registry\/bundles\.json[^\n]*Repair mode/);
    expect(job).toMatch(/unreadable/);
    expect(fs.readFileSync(path.join(candidate, 'examples/one-draft.md'), 'utf8')).toMatch(/bundleMembership/);
  });

  it('words the checker as the checkout\'s built CLI and never as a workspace-relative dist path', () => {
    for (const file of [path.join(candidate, 'SKILL.md'), loaderFile, path.join(candidate, 'references/quality.md'), path.join(candidate, 'examples/one-draft.md')]) {
      const text = fs.readFileSync(file, 'utf8');
      expect(text, file).not.toContain('dist/cli.js');
      expect(text, file).not.toContain('dist\\cli.js');
      expect(text, file).toMatch(/built CLI/);
      expect(text, file).toMatch(/the `cli\.js` file in its `dist` folder/);
      expect(text, file).toMatch(/workflow-check --artifact <absolute workflow path>/);
    }
  });

  it('separates create from repair in the shared entry and the native loader: only create needs a free name and the helper', () => {
    const shared = fs.readFileSync(path.join(candidate, 'SKILL.md'), 'utf8');
    const native = fs.readFileSync(loaderFile, 'utf8');
    for (const [label, text] of [['shared', shared], ['native', native]] as const) {
      const all = lines(text);
      const step = (n: number): string => all.find(line => line.startsWith(`${n}. `)) ?? '';
      const [check, apply] = [step(2), step(5)];
      for (const line of [check, apply]) { expect(line, label).toMatch(/Create mode/); expect(line, label).toMatch(/Repair mode/); }
      const [createCheck = '', repairCheck = ''] = check.split('Repair mode');
      expect(createCheck, label).toMatch(/free/);
      expect(createCheck, label).toMatch(/registry\/skills\/<name>\/SKILL\.md/);
      expect(repairCheck, label).not.toMatch(/free/);
      expect(repairCheck, label).toMatch(/exists/);
      expect(repairCheck, label).toMatch(/baseline/);
      const [createApply = '', repairApply = ''] = apply.split('Repair mode');
      expect(createApply, label).toMatch(/draft\.mjs/);
      expect(repairApply, label).not.toMatch(/draft\.mjs/);
      expect(repairApply, label).toMatch(/do not run the helper/i);
      expect(repairApply, label).toMatch(/in place/);
      // Repair edits by pathname, so the script itself must first be shown to be a regular, unlinked file; the how is in the job contract.
      expect(repairApply, label).toMatch(/regular, unlinked file/);
      expect(repairApply, label).toMatch(/job contract/);
      expect(all.find(line => /^Stop the dependent action/.test(line)) ?? '', label).toMatch(/when creating/);
    }
    const job = fs.readFileSync(path.join(candidate, 'references/job.md'), 'utf8');
    expect(job).toMatch(/Repair mode/);
    expect(job).toMatch(/regular, unlinked file/);
    expect(job).toMatch(/fs\.lstatSync\(p\)\.isFile\(\)/);
    expect(job).toMatch(/isSymbolicLink\(\)/);
    expect(job).toMatch(/One window stays open and is accepted/);
    expect(job).toMatch(/killed during the write can leave a partial workflow file and a stale lock/);
    expect(job).toMatch(/check that no helper is running, then delete the lock file/);
    expect(job).toMatch(/same device and file number/);
    expect(job).toMatch(/swapped for a link or junction between the final check and the create/);
    expect(job).toMatch(/author-skill/);
    expect(job).toMatch(/never touches `?bundles\.json`?|does not touch `?bundles\.json`?/);
    expect(job).toMatch(/Bundle membership|bundle membership/);
    expect(fs.readFileSync(path.join(candidate, 'examples/one-draft.md'), 'utf8')).toMatch(/Repair mode|repair mode/);
  });

  it('refuses a missing paired Skill and sends the contributor to author-skill first, in the entry and the job contract', () => {
    for (const file of [path.join(candidate, 'SKILL.md'), loaderFile]) {
      const step = lines(fs.readFileSync(file, 'utf8')).find(line => line.startsWith('2. ')) ?? '';
      expect(step, file).toMatch(/paired Skill/);
      expect(step, file).toMatch(/author-skill/);
    }
    const job = fs.readFileSync(path.join(candidate, 'references/job.md'), 'utf8');
    expect(job).toMatch(/refuses.*paired Skill|paired Skill.*refus/is);
    expect(job).toMatch(/writes only the workflow file|writes only `registry\/hosts\/claude\/workflows/i);
  });

  it('prepares an explicit same-prompt eval pair and one unrelated control without runs or thresholds', () => {
    const evals = JSON.parse(fs.readFileSync(path.join(candidate, 'evals/evals.json'), 'utf8')) as { skill_name: string; status: string; evals: Array<{ id: number; prompt: string; expected_output: string; kind?: string; runs?: Array<{ condition: string; prompt: string }> }>; results?: unknown; success_threshold?: unknown };
    expect(evals.skill_name).toBe('author-workflow');
    expect(evals.status).toBe('prepared-not-run');
    expect(evals.evals).toHaveLength(3);
    for (const item of evals.evals) { expect(item.prompt.length).toBeGreaterThanOrEqual(40); expect(item.expected_output.length).toBeGreaterThanOrEqual(40); }
    const pair = evals.evals.filter(e => e.kind !== 'unrelated-control');
    expect(pair).toHaveLength(2);
    for (const item of pair) {
      expect(item.runs?.map(r => r.condition)).toEqual(['with-skill', 'without-skill']);
      expect(item.runs?.map(r => r.prompt)).toEqual([item.prompt, item.prompt]);
    }
    expect(evals.evals.filter(e => e.kind === 'unrelated-control')).toHaveLength(1);
    expect(evals.results).toBeUndefined();
    expect(evals.success_threshold).toBeUndefined();
  });

  it('ships exactly the files the route needs, evals only in the source', () => {
    expect(files(candidate)).toEqual([
      'SKILL.md', 'assets/report.md', 'evals/evals.json', 'examples/one-draft.md',
      'references/job.md', 'references/provenance.md', 'references/quality.md', 'scripts/draft.mjs',
    ]);
  });
});

describe('author-workflow native Claude loader and binding', () => {
  const loader = (): string => fs.readFileSync(loaderFile, 'utf8');
  const entry = (): { skill: string; file: string } => BOUND_FACTORY_SKILLS.find(item => item.skill === 'author-workflow')!;

  it('is the third entry of the closed reviewed list, after author-skill and author-rule', () => {
    expect(BOUND_FACTORY_SKILLS.map(item => item.skill)).toEqual(['author-skill', 'author-rule', 'author-workflow']);
    expect(entry().file).toBe('hosts/claude/agent-factory-workflow.binding.json');
  });

  it('forks into the built-in general-purpose role, off the background, and links the installed attribution rule', () => {
    const { meta, body } = frontMatter(loader());
    expect(meta).toMatchObject({ name: 'author-workflow', context: 'fork', agent: 'general-purpose', background: false });
    expect(meta.metadata).toEqual({ author: 'agents-united', version: '1.0.0', license: 'MIT' });
    expect(body).toContain('](references/skill-attribution.md)');
    expect(loader()).toContain('scripts/draft.mjs');
  });

  it('has a binding record the per-entry schema accepts, declaring every support file the loader and the Skill need', () => {
    const declaration = JSON.parse(fs.readFileSync(path.join(registry, entry().file), 'utf8')) as Record<string, unknown>;
    const binding = parseClaudeSkillBinding(entry(), declaration);
    expect(binding).toMatchObject({ skill: 'author-workflow', bundle: 'agent-factory', invocation: '/author-workflow', source: 'hosts/claude/skills/author-workflow/SKILL.md', installed: '.claude/skills/author-workflow/SKILL.md' });
    expect(binding.rule.installed).toBe('.claude/skills/author-workflow/references/skill-attribution.md');
    expect([...binding.requiredSupport].sort()).toEqual(['assets/report.md', 'examples/one-draft.md', 'references/job.md', 'references/provenance.md', 'references/quality.md', 'scripts/draft.mjs']);
    for (const rel of binding.requiredSupport) expect(fs.existsSync(path.join(candidate, rel)), rel).toBe(true);
  });

  it('keeps the native loader sections the shared entry has, and the runbook steps after the first word for word', () => {
    const sharedText = fs.readFileSync(path.join(candidate, 'SKILL.md'), 'utf8');
    const shared = frontMatter(sharedText).body;
    const native = frontMatter(loader()).body;
    const headings = (text: string): string[] => lines(text).filter(line => /^## /.test(line));
    expect(headings(native)).toEqual(headings(shared));
    expect(frontMatter(loader()).meta.description).toBe(frontMatter(sharedText).meta.description);
    const steps = (text: string): string[] => lines(text).filter(line => /^[2-7]\. /.test(line));
    expect(steps(native)).toHaveLength(6);
    expect(steps(native)).toEqual(steps(shared));
  });

  it('does not shadow the bound Skill with a native workflow of the same name', () => {
    expect(fs.existsSync(path.join(registry, 'hosts/claude/workflows/author-workflow.js'))).toBe(false);
  });

  it('is declared by the agent-factory bundle right after author-rule, and by no other bundle', () => {
    const bundles = (JSON.parse(fs.readFileSync(path.join(registry, 'bundles.json'), 'utf8')) as { bundles: Record<string, { skills: string[] }> }).bundles;
    const list = bundles['agent-factory']!.skills;
    expect(list.indexOf('author-workflow')).toBe(list.indexOf('author-rule') + 1);
    for (const [name, bundle] of Object.entries(bundles)) if (name !== 'agent-factory') expect(bundle.skills, name).not.toContain('author-workflow');
  });
});

/** True when this machine lets a test make a junction (Windows) or a directory symlink (elsewhere). */
function canMakeJunction(): boolean {
  const base = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'author-workflow-probe-'));
  try {
    fs.mkdirSync(path.join(base, 'target'));
    fs.symlinkSync(path.join(base, 'target'), path.join(base, 'link'), 'junction');
    return true;
  } catch { return false; } finally { fs.rmSync(base, { recursive: true, force: true }); }
}
const JUNCTIONS = canMakeJunction();
/** True when this machine lets a test make a symbolic link to a file (Windows needs a privilege for it). */
function canMakeFileLink(): boolean {
  const base = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'author-workflow-probe-'));
  try {
    fs.writeFileSync(path.join(base, 'target.txt'), 'x');
    fs.symlinkSync(path.join(base, 'target.txt'), path.join(base, 'link.txt'), 'file');
    return true;
  } catch { return false; } finally { fs.rmSync(base, { recursive: true, force: true }); }
}
const FILE_LINKS = canMakeFileLink();

describe('author-workflow bounded draft helper', () => {
  const NAME = 'release-flow';
  const WORKFLOW = [
    'export const meta = {',
    `  name: '${NAME}',`,
    "  description: 'Draft release notes from the merged pull requests.',",
    "  phases: [{ title: 'Collect', detail: 'list the merged pull requests' }, { title: 'Draft' }],",
    '}',
    '',
    "phase('Collect')",
    "const merged = await agent('List the merged pull requests', { schema: { type: 'object', properties: {} }, agentType: 'code-reviewer' })",
    "const drafts = await pipeline([1, 2], n => agent('Draft note ' + n, { phase: 'Draft' }))",
    'return { merged, drafts: drafts.filter(Boolean) }',
    '',
  ].join('\n');
  const SKILL_TEXT = `---\nname: ${NAME}\ndescription: Draft release notes.\n---\n# ${NAME}\n`;
  const OTHER = "export const meta = { name: 'other-flow', description: 'Another workflow.' }\nreturn 1\n";
  const WORKFLOWS = 'registry/hosts/claude/workflows';
  interface Fixture { root: string; checkout: string; job: Record<string, unknown> }
  function fixture(): Fixture {
    // The real path of the temp folder: the helper refuses a checkout path that goes through a link (macOS /var is one).
    const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'author-workflow-'));
    roots.push(root);
    const checkout = path.join(root, 'checkout');
    for (const dir of [WORKFLOWS, 'registry/hosts/claude/agents', `registry/skills/${NAME}`]) fs.mkdirSync(path.join(checkout, dir), { recursive: true });
    fs.writeFileSync(path.join(checkout, `registry/skills/${NAME}/SKILL.md`), SKILL_TEXT);
    fs.writeFileSync(path.join(checkout, 'registry/hosts/claude/agents/code-reviewer.md'), '---\nname: code-reviewer\ndescription: An agent.\n---\nBody.\n');
    fs.writeFileSync(path.join(checkout, `${WORKFLOWS}/other-flow.js`), OTHER);
    return { root, checkout, job: { checkout, name: NAME, content: WORKFLOW } };
  }
  /** Every file under the checkout with its hash, and every folder, so a refusal can be shown to have changed nothing. */
  function tree(dir: string, prefix = ''): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
      const full = path.join(dir, e.name);
      const stat = fs.lstatSync(full);
      if (stat.isSymbolicLink()) return [`${prefix}${e.name} -> link`];
      return e.isDirectory() ? [`${prefix}${e.name}/`, ...tree(full, `${prefix}${e.name}/`)] : [`${prefix}${e.name}:${sha(fs.readFileSync(full))}`];
    }).sort();
  }
  function run(f: Fixture, executable = helper, given: Record<string, string | undefined> = {}): { exit: number | null; stdout: string; stderr: string; report: Record<string, any>; blocked: Record<string, any> } {
    const jobPath = path.join(f.root, 'job.json');
    fs.writeFileSync(jobPath, JSON.stringify(f.job));
    // A fault acts only with a test root under the temp folder (the helper's own rule), so a test that names a fault gets its own temp
    // folder as the root unless it passes another one (or an explicit undefined, for no root at all).
    const env = 'AUTHOR_WORKFLOW_TEST_FAULT' in given && !('AUTHOR_WORKFLOW_TEST_ROOT' in given) ? { ...given, AUTHOR_WORKFLOW_TEST_ROOT: f.root } : given;
    const result = spawnSync(process.execPath, [executable, jobPath], { cwd: f.root, encoding: 'utf8', env: { ...process.env, ...env } });
    return { exit: result.status, stdout: result.stdout, stderr: result.stderr,
      report: result.status === 0 ? JSON.parse(result.stdout) as Record<string, any> : {},
      blocked: result.status === 1 ? JSON.parse(result.stderr) as Record<string, any> : {} };
  }
  const written = (f: Fixture): string => path.join(f.checkout, WORKFLOWS, `${NAME}.js`);
  function expectBlocked(f: Fixture, reason: RegExp, env: Record<string, string> = {}): void {
    const before = tree(f.checkout);
    const result = run(f, helper, env);
    expect(result.exit, result.stdout + result.stderr).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.blocked.status).toBe('blocked');
    expect(result.blocked.reason).toMatch(reason);
    expect(tree(f.checkout)).toEqual(before);
  }

  it('runs a copy of the helper outside the checkout with no dependency or relative import', () => {
    const f = fixture();
    const installed = path.join(f.root, 'installed-skill', 'scripts', 'draft.mjs');
    fs.mkdirSync(path.dirname(installed), { recursive: true });
    fs.copyFileSync(helper, installed);
    const result = run(f, installed);
    expect(result.exit, result.stdout + result.stderr).toBe(0);
    expect(fs.existsSync(path.join(f.root, 'node_modules'))).toBe(false);
    expect(fs.readFileSync(path.join(helper), 'utf8')).not.toMatch(/from '\.\.?\//);
  });

  it('writes the workflow file only, with the hashes it wrote, and leaves the Skill, the other workflow and every other byte alone', () => {
    const f = fixture();
    const before = tree(f.checkout);
    const result = run(f);
    expect(result.exit, result.stdout + result.stderr).toBe(0);
    expect(fs.readFileSync(written(f), 'utf8')).toBe(WORKFLOW);
    expect(result.report).toEqual({
      version: 1, status: 'written',
      workflow: { path: `${WORKFLOWS}/${NAME}.js`, bytes: Buffer.byteLength(WORKFLOW), sha256: sha(WORKFLOW) },
      skill: { path: `registry/skills/${NAME}/SKILL.md`, sha256: sha(SKILL_TEXT) },
      bundleMembership: { listed: null, bundles: [], unreadable: expect.stringMatching(/registry\/bundles\.json is unavailable/), note: expect.stringMatching(/could not be read/) },
      validation: { status: 'unverified', reason: 'This helper runs no workflow-check; run it on the written workflow file.' },
      externalActions: [],
    });
    expect(tree(f.checkout)).toEqual([...before, `${WORKFLOWS}/${NAME}.js:${sha(WORKFLOW)}`].sort());
  });

  it('writes no bundles.json and needs none', () => {
    const f = fixture();
    expect(fs.existsSync(path.join(f.checkout, 'registry/bundles.json'))).toBe(false);
    expect(run(f).exit).toBe(0);
    expect(fs.existsSync(path.join(f.checkout, 'registry/bundles.json'))).toBe(false);
  });

  /** A registry/bundles.json in the shape of the shipped one: each Bundle names its Skills. */
  function writeBundles(f: Fixture, bundles: Record<string, string[]>): Buffer {
    const bytes = Buffer.from(`${JSON.stringify({ version: 1, bundles: Object.fromEntries(Object.entries(bundles).map(([name, list]) => [name, { name, skills: list }])) }, null, 2)}\n`);
    fs.writeFileSync(path.join(f.checkout, 'registry/bundles.json'), bytes);
    return bytes;
  }
  const bundlesFile = (f: Fixture): string => path.join(f.checkout, 'registry/bundles.json');

  it('reports the one Bundle that lists the paired Skill, and leaves bundles.json as it was', () => {
    const f = fixture();
    const bytes = writeBundles(f, { 'agent-factory': ['author-skill', NAME], 'software-engineering': ['author-skill'] });
    const result = run(f);
    expect(result.exit, result.stdout + result.stderr).toBe(0);
    expect(result.report.bundleMembership).toEqual({ listed: true, bundles: ['agent-factory'] });
    expect(fs.readFileSync(bundlesFile(f)).equals(bytes)).toBe(true);
    expect(fs.existsSync(written(f))).toBe(true);
  });

  it('reports every Bundle that lists the paired Skill, in the order of the file', () => {
    const f = fixture();
    writeBundles(f, { 'software-engineering': [NAME, 'author-skill'], 'agent-factory': ['author-rule'], 'release-ops': [NAME] });
    const result = run(f);
    expect(result.exit, result.stdout + result.stderr).toBe(0);
    expect(result.report.bundleMembership).toEqual({ listed: true, bundles: ['software-engineering', 'release-ops'] });
  });

  it('writes the workflow and reports that no Bundle lists the paired Skill, never refusing on it, and matches the exact name only', () => {
    const f = fixture();
    const bytes = writeBundles(f, { 'agent-factory': [`${NAME}-extra`, `pre-${NAME}`, 'author-skill'], empty: [] });
    const result = run(f);
    expect(result.exit, result.stdout + result.stderr).toBe(0);
    expect(fs.readFileSync(written(f), 'utf8')).toBe(WORKFLOW);
    expect(result.report.status).toBe('written');
    expect(result.report.bundleMembership.listed).toBe(false);
    expect(result.report.bundleMembership.bundles).toEqual([]);
    expect(result.report.bundleMembership.note).toMatch(/No Bundle lists the paired Skill/);
    expect(result.report.bundleMembership.note).toMatch(/never installed/);
    expect(fs.readFileSync(bundlesFile(f)).equals(bytes)).toBe(true);
  });

  it('reports bundles.json as unreadable instead of failing the write: invalid JSON, a missing bundles map, a folder, or a file past the bound', () => {
    const cases: Array<[string, (f: Fixture) => void, RegExp]> = [
      ['invalid JSON', f => fs.writeFileSync(bundlesFile(f), '{ not json'), /not valid JSON/],
      ['no bundles map', f => fs.writeFileSync(bundlesFile(f), '{"version":1}\n'), /no bundles map/],
      ['a folder', f => fs.mkdirSync(bundlesFile(f)), /not a regular file/],
      ['past the bound', f => fs.writeFileSync(bundlesFile(f), Buffer.alloc(2 * 1024 * 1024, ' ')), /larger than 1 MiB/],
    ];
    for (const [label, arrange, reason] of cases) {
      const f = fixture();
      arrange(f);
      const before = fs.lstatSync(bundlesFile(f)).isFile() ? sha(fs.readFileSync(bundlesFile(f))) : null;
      const result = run(f);
      expect(result.exit, `${label}: ${result.stdout}${result.stderr}`).toBe(0);
      expect(fs.readFileSync(written(f), 'utf8'), label).toBe(WORKFLOW);
      expect(result.report.bundleMembership.listed, label).toBeNull();
      expect(result.report.bundleMembership.bundles, label).toEqual([]);
      expect(result.report.bundleMembership.unreadable, label).toMatch(reason);
      expect(result.report.bundleMembership.note, label).toMatch(/could not be read/);
      if (before !== null) expect(sha(fs.readFileSync(bundlesFile(f))), label).toBe(before);
    }
  });

  it('reports a bundles.json that is a link as unreadable and does not follow it', () => {
    if (!JUNCTIONS) return;
    const f = fixture();
    const target = path.join(f.root, 'elsewhere');
    fs.mkdirSync(target);
    fs.symlinkSync(target, bundlesFile(f), 'junction');
    const result = run(f);
    expect(result.exit, result.stdout + result.stderr).toBe(0);
    expect(result.report.bundleMembership.listed).toBeNull();
    expect(result.report.bundleMembership.unreadable).toMatch(/link/);
  });

  it('writes a workflow that workflow-check passes, the check the runbook runs next', () => {
    const f = fixture();
    expect(run(f).exit).toBe(0);
    const result = runWorkflowCheck({ artifact: written(f) });
    expect(result.findings).toEqual([]);
    expect(workflowCheckExitCode(result)).toBe(0);
    expect(result.unresolvedAgentTypes).toEqual([]);
  });

  it('adds a trailing newline when the authored text lacks one, and keeps CRLF text as it is', () => {
    const f = fixture();
    f.job.content = WORKFLOW.replace(/\n$/, '');
    expect(run(f).exit).toBe(0);
    expect(fs.readFileSync(written(f), 'utf8')).toBe(WORKFLOW);
    const g = fixture();
    g.job.content = WORKFLOW.replace(/\n/g, '\r\n');
    expect(run(g).exit).toBe(0);
    expect(fs.readFileSync(written(g), 'utf8')).toBe(WORKFLOW.replace(/\n/g, '\r\n'));
    expect(workflowCheckExitCode(runWorkflowCheck({ artifact: written(g) }))).toBe(0);
  });

  it('reads meta.name from the top level of meta, not from text inside a string or a nested object', () => {
    const f = fixture();
    f.job.content = WORKFLOW.replace("name: 'release-flow',\n  description: 'Draft release notes from the merged pull requests.'", "description: \"name: 'other'\",\n  name: 'release-flow'");
    expect(run(f).exit).toBe(0);
    const g = fixture();
    g.job.content = WORKFLOW.replace("  name: 'release-flow',\n", "  name: 'other-flow',\n  extra: { name: 'release-flow' },\n");
    expectBlocked(g, /meta\.name/);
    const h = fixture();
    h.job.content = WORKFLOW.replace("  name: 'release-flow',\n", "  // name: 'release-flow'\n  name: 'release-flow',\n");
    expect(run(h).exit).toBe(0);
  });

  it.each([
    ['an upper-case name', 'Release-Flow', /kebab-case/i],
    ['a name with an extension', 'release-flow.js', /kebab-case/i],
    ['a name with a path', '../release-flow', /kebab-case/i],
    ['an empty name', '', /kebab-case/i],
    ['a name with a doubled hyphen', 'release--flow', /kebab-case/i],
    ['a reserved device name', 'con', /reserved|device/i],
    ['a numbered device name', 'com1', /reserved|device/i],
    ['another device name', 'nul', /reserved|device/i],
  ])('refuses %s before writing anything', (_label, name, reason) => {
    const f = fixture();
    f.job.name = name;
    expectBlocked(f, reason);
  });

  it('refuses a name that collides with an existing workflow, in another letter case too', () => {
    const f = fixture();
    fs.mkdirSync(path.join(f.checkout, 'registry/skills/other-flow'));
    fs.writeFileSync(path.join(f.checkout, 'registry/skills/other-flow/SKILL.md'), SKILL_TEXT.replaceAll(NAME, 'other-flow'));
    f.job.name = 'other-flow';
    f.job.content = WORKFLOW.replace(`name: '${NAME}'`, "name: 'other-flow'");
    expectBlocked(f, /already exists|collides/i);
    // A differently-cased file: a real second file on a case-sensitive disk, the same file on Windows; both must be refused.
    const g = fixture();
    fs.writeFileSync(path.join(g.checkout, WORKFLOWS, 'Release-Flow.js'), '// existing\n');
    const result = run(g);
    expect(result.exit).toBe(1);
    expect(result.blocked.reason).toMatch(/already exists|collides/i);
    expect(fs.readFileSync(path.join(g.checkout, WORKFLOWS, 'Release-Flow.js'), 'utf8')).toBe('// existing\n');
    expect(fs.readdirSync(path.join(g.checkout, WORKFLOWS)).filter(name => name.toLowerCase() === `${NAME}.js`)).toHaveLength(1);
  });

  it('refuses when the paired Skill is missing, and tells the contributor to author the Skill first through author-skill', () => {
    const f = fixture();
    fs.rmSync(path.join(f.checkout, `registry/skills/${NAME}`), { recursive: true });
    const result = run(f);
    expect(result.exit, result.stdout + result.stderr).toBe(1);
    expect(result.blocked.reason).toMatch(/paired Skill/);
    expect(result.blocked.reason).toMatch(/author-skill/);
    expect(result.blocked.reason).toContain(`registry/skills/${NAME}/SKILL.md`);
    expect(fs.existsSync(written(f))).toBe(false);
    const g = fixture();
    fs.rmSync(path.join(g.checkout, `registry/skills/${NAME}/SKILL.md`));
    expectBlocked(g, /paired Skill/);
    const h = fixture();
    fs.rmSync(path.join(h.checkout, 'registry/skills'), { recursive: true });
    expectBlocked(h, /paired Skill|skills/);
  });

  it('refuses a paired Skill that is a folder, not a file', () => {
    const f = fixture();
    fs.rmSync(path.join(f.checkout, `registry/skills/${NAME}/SKILL.md`));
    fs.mkdirSync(path.join(f.checkout, `registry/skills/${NAME}/SKILL.md`));
    expectBlocked(f, /paired Skill|regular file/i);
  });

  it('refuses a name whose Skill has a native Claude loader, which a workflow of that name would replace', () => {
    const f = fixture();
    fs.mkdirSync(path.join(f.checkout, `registry/hosts/claude/skills/${NAME}`), { recursive: true });
    fs.writeFileSync(path.join(f.checkout, `registry/hosts/claude/skills/${NAME}/SKILL.md`), SKILL_TEXT);
    expectBlocked(f, /native/i);
  });

  it('refuses a workflow whose meta.name is not the name, whose meta is missing, or whose name is not a literal', () => {
    const f = fixture();
    f.job.content = WORKFLOW.replace(`name: '${NAME}'`, "name: 'other-flow'");
    expectBlocked(f, /meta\.name/);
    const g = fixture();
    g.job.content = 'return 1\n';
    expectBlocked(g, /export const meta/);
    const h = fixture();
    h.job.content = WORKFLOW.replace(`name: '${NAME}'`, 'name: someName');
    expectBlocked(h, /meta\.name/);
    const i = fixture();
    i.job.content = WORKFLOW.replace("  name: 'release-flow',\n", '');
    expectBlocked(i, /meta\.name/);
  });

  it.each([
    ['no content', undefined, /content/i],
    ['empty content', '   \n', /content/i],
    ['content that is not text', 7, /content/i],
    ['content over the size limit', `${WORKFLOW}// ${'x'.repeat(130 * 1024)}\n`, /larger than|too large|limit/i],
  ])('refuses %s', (_label, content, reason) => {
    const f = fixture();
    f.job.content = content;
    if (content === undefined) delete f.job.content;
    expectBlocked(f, reason);
  });

  // workflow-check accepts a script of exactly 128 KiB and refuses one byte more, and the helper adds a final newline when there is none, so
  // the limit is measured on the final draft: the authored text may be one byte shorter than the limit when it has no final newline.
  describe('the 128 KiB limit, measured on the final draft', () => {
    const LIMIT = 128 * 1024;
    /** A valid script of exactly `bytes` bytes as authored, with or without the final newline. */
    function sized(bytes: number, finalNewline: boolean): string {
      const filler = bytes - Buffer.byteLength(WORKFLOW) - 3 - (finalNewline ? 1 : 0);
      const text = `${WORKFLOW}// ${'x'.repeat(filler)}${finalNewline ? '\n' : ''}`;
      expect(Buffer.byteLength(text)).toBe(bytes);
      return text;
    }
    it('writes a script of exactly 128 KiB that ends with a newline, and workflow-check passes it', () => {
      const f = fixture();
      f.job.content = sized(LIMIT, true);
      const result = run(f);
      expect(result.exit, result.stdout + result.stderr).toBe(0);
      expect(fs.statSync(written(f)).size).toBe(LIMIT);
      expect(result.report.workflow.bytes).toBe(LIMIT);
      expect(workflowCheckExitCode(runWorkflowCheck({ artifact: written(f) }))).toBe(0);
    });
    it('writes a script one byte under 128 KiB with no final newline, which becomes exactly 128 KiB', () => {
      const f = fixture();
      f.job.content = sized(LIMIT - 1, false);
      const result = run(f);
      expect(result.exit, result.stdout + result.stderr).toBe(0);
      expect(fs.statSync(written(f)).size).toBe(LIMIT);
      expect(workflowCheckExitCode(runWorkflowCheck({ artifact: written(f) }))).toBe(0);
    });
    it('refuses a script of exactly 128 KiB with no final newline, because the appended newline pushes it over, and writes nothing', () => {
      const f = fixture();
      f.job.content = sized(LIMIT, false);
      expectBlocked(f, /128 KiB|limit/i);
    });
    it('refuses a script one byte over 128 KiB that ends with a newline, and one whose multi-byte text is under 128 KiB in characters only', () => {
      const f = fixture();
      f.job.content = sized(LIMIT + 1, true);
      expectBlocked(f, /128 KiB|limit/i);
      const g = fixture();
      const accented = `${WORKFLOW}// ${'\u00e9'.repeat(LIMIT / 2)}\n`;
      g.job.content = accented;
      expect(accented.length).toBeLessThan(LIMIT);
      expectBlocked(g, /128 KiB|limit/i);
    });
  });

  it.each([
    ['an extra key', { extra: 1 }, /unknown|extra|allowed/i],
    ['a bundle key, which this route never uses', { bundle: 'agent-factory' }, /unknown|allowed/i],
    ['a relative checkout', { checkout: 'registry' }, /absolute/i],
    ['a checkout without a registry', { checkout: os.tmpdir() }, /registry/i],
  ])('refuses a job with %s', (_label, patch, reason) => {
    const f = fixture();
    const before = tree(f.checkout);
    Object.assign(f.job, patch);
    const result = run(f);
    expect(result.exit, result.stdout + result.stderr).toBe(1);
    expect(result.blocked.reason).toMatch(reason);
    expect(tree(f.checkout)).toEqual(before);
  });

  it('refuses a checkout with no workflows folder rather than create one', () => {
    const f = fixture();
    fs.rmSync(path.join(f.checkout, WORKFLOWS), { recursive: true });
    expectBlocked(f, /workflows/);
    expect(fs.existsSync(path.join(f.checkout, WORKFLOWS))).toBe(false);
  });

  // A junction on Windows (no privilege needed), a directory symlink elsewhere. These skip only where the machine cannot make one.
  const linked = it.skipIf(!JUNCTIONS);
  const link = (target: string, at: string): void => { fs.symlinkSync(target, at, 'junction'); };

  linked.each(['registry', 'registry/hosts', 'registry/hosts/claude', 'registry/hosts/claude/workflows', 'registry/skills', `registry/skills/${NAME}`])(
    'refuses a link or junction at %s, leaving the real target untouched (skipped only where a junction cannot be created)',
    folder => {
      const f = fixture();
      const target = path.join(f.root, 'elsewhere');
      fs.renameSync(path.join(f.checkout, folder), target);
      link(target, path.join(f.checkout, folder));
      const before = tree(target);
      const result = run(f);
      expect(result.exit, result.stdout + result.stderr).toBe(1);
      expect(result.blocked.reason).toMatch(/link|junction|real path/i);
      expect(tree(target)).toEqual(before);
      expect(fs.readdirSync(target).includes(`${NAME}.js`)).toBe(false);
    });

  linked('refuses a paired Skill folder that is a link, found without following links (skipped only where a junction cannot be created)', () => {
    const f = fixture();
    const target = path.join(f.root, 'skill-target');
    fs.mkdirSync(target);
    fs.writeFileSync(path.join(target, 'SKILL.md'), SKILL_TEXT);
    fs.rmSync(path.join(f.checkout, `registry/skills/${NAME}`), { recursive: true });
    link(target, path.join(f.checkout, `registry/skills/${NAME}`));
    const result = run(f);
    expect(result.exit, result.stdout + result.stderr).toBe(1);
    expect(result.blocked.reason).toMatch(/link|junction|paired Skill/i);
    expect(fs.existsSync(written(f))).toBe(false);
  });

  const fileLinks = it.skipIf(!FILE_LINKS);
  fileLinks('refuses a paired SKILL.md that is itself a file link, even to a real SKILL.md, and writes nothing (skipped only where a file link cannot be created)', () => {
    const f = fixture();
    const target = path.join(f.root, 'SKILL-target.md');
    fs.writeFileSync(target, SKILL_TEXT);
    const skillFile = path.join(f.checkout, `registry/skills/${NAME}/SKILL.md`);
    fs.rmSync(skillFile);
    fs.symlinkSync(target, skillFile, 'file');
    const before = tree(f.checkout);
    const result = run(f);
    expect(result.exit, result.stdout + result.stderr).toBe(1);
    expect(result.blocked.reason).toMatch(/link|junction/i);
    expect(result.blocked.reason).toContain(`registry/skills/${NAME}`);
    expect(fs.existsSync(written(f))).toBe(false);
    expect(tree(f.checkout)).toEqual(before);
    expect(fs.readFileSync(target, 'utf8')).toBe(SKILL_TEXT);
  });

  linked('refuses a checkout path that is a link to the real checkout, writing nothing in the real folder (skipped only where a junction cannot be created)', () => {
    const f = fixture();
    const alias = path.join(f.root, 'alias');
    link(f.checkout, alias);
    f.job.checkout = alias;
    const before = tree(f.checkout);
    const result = run(f);
    expect(result.exit, result.stdout + result.stderr).toBe(1);
    expect(result.blocked.reason).toMatch(/link|real path/i);
    expect(tree(f.checkout)).toEqual(before);
  });

  linked('refuses a checkout whose parent folder is a link, writing nothing in the real folder (skipped only where a junction cannot be created)', () => {
    const f = fixture();
    const parent = path.join(f.root, 'linked-parent');
    link(f.root, parent);
    f.job.checkout = path.join(parent, 'checkout');
    const before = tree(f.checkout);
    const result = run(f);
    expect(result.exit, result.stdout + result.stderr).toBe(1);
    expect(result.blocked.reason).toMatch(/link|real path/i);
    expect(tree(f.checkout)).toEqual(before);
  });

  linked('refuses to write when the workflow path itself is a link, and never writes through it (skipped only where a junction cannot be created)', () => {
    const f = fixture();
    fs.mkdirSync(path.join(f.root, 'nowhere'));
    link(path.join(f.root, 'nowhere'), written(f));
    const before = tree(f.checkout);
    const result = run(f);
    expect(result.exit, result.stdout + result.stderr).toBe(1);
    expect(result.blocked.reason).toMatch(/already exists|collides|link/i);
    expect(tree(f.checkout)).toEqual(before);
  });

  // The swap faults put a junction in the place of the workflows folder (the real folder moves to <root>/moved-workflows, the junction points at
  // <root>/elsewhere), as another process could between the helper's checks and its create. They act only inside the test root.
  const swapped = (f: Fixture, fault: string) => run(f, helper, { AUTHOR_WORKFLOW_TEST_FAULT: fault, AUTHOR_WORKFLOW_TEST_ROOT: f.root });
  function expectNothingWrittenThroughTheSwap(f: Fixture): void {
    expect(fs.readdirSync(path.join(f.root, 'elsewhere'))).toEqual([]);
    expect(fs.readdirSync(path.join(f.root, 'moved-workflows'))).toEqual(['other-flow.js']);
    expect(fs.readdirSync(path.join(f.checkout, 'registry')).sort()).toEqual(['hosts', 'skills']);
  }

  linked('walks the folders again after taking the lock: a workflows folder swapped for a link then is refused, and nothing is written through it (skipped only where a junction cannot be created)', () => {
    const f = fixture();
    const result = swapped(f, 'workflows-swapped-after-lock');
    expect(result.exit, result.stdout + result.stderr).toBe(1);
    expect(result.blocked.reason).toMatch(/link or junction/i);
    expectNothingWrittenThroughTheSwap(f);
  });

  linked('removes the file it created when its path resolves elsewhere because the folder was swapped for a link just before the create, and refuses (skipped only where a junction cannot be created)', () => {
    const f = fixture();
    const result = swapped(f, 'workflows-swapped-before-create');
    expect(result.exit, result.stdout + result.stderr).toBe(1);
    expect(result.blocked.reason).toMatch(/created at/i);
    expect(result.blocked.reason).toMatch(/link or junction/i);
    expectNothingWrittenThroughTheSwap(f);
  });

  it('leaves no lock or temporary file behind after a successful run', () => {
    const f = fixture();
    expect(run(f).exit).toBe(0);
    expect(fs.readdirSync(path.join(f.checkout, 'registry')).sort()).toEqual(['hosts', 'skills']);
    expect(fs.readdirSync(path.join(f.checkout, WORKFLOWS)).sort()).toEqual(['other-flow.js', `${NAME}.js`]);
  });

  it('refuses to run while another run holds the lock, changes nothing and leaves the other run its lock', () => {
    const f = fixture();
    const lock = path.join(f.checkout, 'registry/.author-workflow.lock');
    fs.writeFileSync(lock, 'another run\n');
    expectBlocked(f, /lock/i);
    // The refusal says how to clear a stale lock safely: check that no helper is running, then delete the named file.
    expect(run(f).blocked.reason).toContain(lock);
    expect(run(f).blocked.reason).toMatch(/check that no helper is running, then delete/i);
    expect(fs.readFileSync(lock, 'utf8')).toBe('another run\n');
    expect(fs.existsSync(written(f))).toBe(false);
  });

  // Two helpers started at the same moment with the same job: the lock lets exactly one write. The other is refused before it writes anything,
  // either at the lock ("Another run holds") or, when it takes the lock after the first has finished, at the collision check ("already exists").
  // No other outcome is acceptable: not a second write, not a generic failure, and the winner's file and lock are never touched by the loser.
  function startHelper(f: Fixture): Promise<{ exit: number | null; stdout: string; stderr: string }> {
    return new Promise(resolve => {
      const child = spawn(process.execPath, [helper, path.join(f.root, 'job.json')], { cwd: f.root });
      let stdout = '', stderr = '';
      child.stdout.on('data', chunk => { stdout += String(chunk); });
      child.stderr.on('data', chunk => { stderr += String(chunk); });
      child.on('close', exit => resolve({ exit, stdout, stderr }));
    });
  }
  it('lets exactly one of two helpers started together write the workflow, and refuses the other at the lock or the collision check', async () => {
    for (let round = 0; round < 3; round++) {
      const f = fixture();
      fs.writeFileSync(path.join(f.root, 'job.json'), JSON.stringify(f.job));
      const [first, second] = await Promise.all([startHelper(f), startHelper(f)]);
      const label = `round ${round}: ${first.stdout}${first.stderr} | ${second.stdout}${second.stderr}`;
      expect([first.exit, second.exit].sort(), label).toEqual([0, 1]);
      const [winner, loser] = first.exit === 0 ? [first, second] : [second, first];
      expect(JSON.parse(winner.stdout).workflow, label).toEqual({ path: `${WORKFLOWS}/${NAME}.js`, bytes: Buffer.byteLength(WORKFLOW), sha256: sha(WORKFLOW) });
      expect(loser.stdout, label).toBe('');
      expect(JSON.parse(loser.stderr).reason, label).toMatch(/^Another run holds |already exists; it collides with /);
      expect(fs.readFileSync(written(f), 'utf8'), label).toBe(WORKFLOW);
      expect(fs.readdirSync(path.join(f.checkout, 'registry')).sort(), label).toEqual(['hosts', 'skills']);
      expect(fs.readdirSync(path.join(f.checkout, WORKFLOWS)).sort(), label).toEqual(['other-flow.js', `${NAME}.js`]);
    }
  });

  // The helper's only test seam: AUTHOR_WORKFLOW_TEST_FAULT, read once, inert unless set. A fault can only force a failure.
  it('removes the workflow file and the lock when a failure comes after the write, and a retry then succeeds', () => {
    const f = fixture();
    const before = tree(f.checkout);
    const result = run(f, helper, { AUTHOR_WORKFLOW_TEST_FAULT: 'fail-after-write' });
    expect(result.exit, result.stdout + result.stderr).toBe(1);
    expect(result.blocked.reason).toMatch(/could not finish/i);
    expect(result.blocked.reason).not.toMatch(/left in place/i);
    expect(tree(f.checkout)).toEqual(before);
    const retry = run(f);
    expect(retry.exit, retry.stdout + retry.stderr).toBe(0);
    expect(fs.readFileSync(written(f), 'utf8')).toBe(WORKFLOW);
  });

  it('removes a truncated workflow file that this run wrote when its own write threw, leaves no lock, and a retry then succeeds', () => {
    const f = fixture();
    const before = tree(f.checkout);
    const result = run(f, helper, { AUTHOR_WORKFLOW_TEST_FAULT: 'partial-write' });
    expect(result.exit, result.stdout + result.stderr).toBe(1);
    expect(result.blocked.reason).toMatch(/could not finish/i);
    expect(result.blocked.reason).not.toMatch(/left in place/i);
    expect(tree(f.checkout)).toEqual(before);
    expect(run(f).exit).toBe(0);
    expect(fs.readFileSync(written(f), 'utf8')).toBe(WORKFLOW);
  });

  // The replacement faults act only inside AUTHOR_WORKFLOW_TEST_ROOT, which the test sets to its own temp folder.
  const replaced = (f: Fixture, fault: string, root = f.root) => run(f, helper, { AUTHOR_WORKFLOW_TEST_FAULT: `fail-after-write,${fault}`, AUTHOR_WORKFLOW_TEST_ROOT: root });

  it('leaves a workflow path that has become a folder in place and names it', () => {
    const f = fixture();
    const result = replaced(f, 'workflow-becomes-directory');
    expect(result.exit, result.stdout + result.stderr).toBe(1);
    expect(result.blocked.reason).toMatch(/left in place/i);
    expect(result.blocked.reason).toContain(`${NAME}.js`);
    expect(fs.lstatSync(written(f)).isDirectory()).toBe(true);
  });

  linked('leaves a workflow path that has become a link in place, names it, and never touches what it points at (skipped only where a junction cannot be created)', () => {
    const f = fixture();
    const result = replaced(f, 'workflow-becomes-link');
    expect(result.exit, result.stdout + result.stderr).toBe(1);
    expect(result.blocked.reason).toMatch(/left in place/i);
    expect(result.blocked.reason).toContain(`${NAME}.js`);
    expect(fs.lstatSync(written(f)).isSymbolicLink()).toBe(true);
    expect(fs.readFileSync(path.join(f.root, 'link-target', 'keep.txt'), 'utf8')).toBe('keep\n');
  });

  it('leaves a workflow file that grew far past what this run wrote in place and names it, without needing to read it whole', () => {
    const f = fixture();
    const result = replaced(f, 'workflow-becomes-oversized');
    expect(result.exit, result.stdout + result.stderr).toBe(1);
    expect(result.blocked.reason).toMatch(/left in place/i);
    expect(result.blocked.reason).toContain(`${NAME}.js`);
    expect(fs.statSync(written(f)).size).toBeGreaterThan(1024 * 1024);
    expect(fs.readFileSync(written(f)).subarray(0, Buffer.byteLength(WORKFLOW)).toString('utf8')).toBe(WORKFLOW);
  });

  it('removes a prefix of the intended bytes only when this run\'s own write threw: a shorter file after a later failure is left', () => {
    const f = fixture();
    const result = replaced(f, 'workflow-becomes-prefix');
    expect(result.exit, result.stdout + result.stderr).toBe(1);
    expect(result.blocked.reason).toMatch(/left in place/i);
    expect(fs.readFileSync(written(f), 'utf8')).toBe(WORKFLOW.slice(0, 20));
  });

  // Every fault needs a test root whose real path is under the real path of the temp folder; without one the switch does nothing at all.
  const everyFault = 'fail-after-write,fail-lock-removal,partial-write,workflow-becomes-directory,workflow-becomes-link,workflow-swapped,lock-swapped';
  it('is inert with no test root, an empty one, a missing one, or one outside the temp folder: no fault acts, not even a plain failure', () => {
    const realTmp = fs.realpathSync(os.tmpdir());
    for (const root of [undefined, '', path.dirname(realTmp), path.join(realTmp, 'author-workflow-absent-folder')]) {
      const f = fixture();
      const result = run(f, helper, { AUTHOR_WORKFLOW_TEST_FAULT: everyFault, AUTHOR_WORKFLOW_TEST_ROOT: root });
      expect(result.exit, `${String(root)}: ${result.stdout}${result.stderr}`).toBe(0);
      expect(result.report.warnings, String(root)).toBeUndefined();
      expect(fs.readFileSync(written(f), 'utf8')).toBe(WORKFLOW);
      expect(fs.existsSync(path.join(f.checkout, 'registry/.author-workflow.lock'))).toBe(false);
    }
  });

  linked('is inert with a test root that is a link from the temp folder to a folder outside it, since the real path decides (skipped only where a junction cannot be created)', () => {
    const realTmp = fs.realpathSync(os.tmpdir());
    const f = fixture();
    const alias = path.join(f.root, 'alias-of-outside');
    link(path.dirname(realTmp), alias);
    const result = run(f, helper, { AUTHOR_WORKFLOW_TEST_FAULT: 'fail-after-write', AUTHOR_WORKFLOW_TEST_ROOT: alias });
    expect(result.exit, result.stdout + result.stderr).toBe(0);
    expect(fs.readFileSync(written(f), 'utf8')).toBe(WORKFLOW);
  });

  it('leaves a workflow file that another file with the very same bytes has replaced, and names it: the identity is checked, not only the bytes', () => {
    const f = fixture();
    const result = replaced(f, 'workflow-swapped');
    expect(result.exit, result.stdout + result.stderr).toBe(1);
    expect(result.blocked.reason).toMatch(/left in place/i);
    expect(result.blocked.reason).toContain(`${NAME}.js`);
    expect(fs.readFileSync(written(f), 'utf8')).toBe(WORKFLOW);
    expect(fs.readdirSync(path.join(f.checkout, WORKFLOWS)).sort()).toEqual(['other-flow.js', `${NAME}.js`]);
  });

  it('leaves a lock file that another file has replaced, names it in a warning, and still succeeds', () => {
    const f = fixture();
    const lock = path.join(f.checkout, 'registry/.author-workflow.lock');
    const result = run(f, helper, { AUTHOR_WORKFLOW_TEST_FAULT: 'lock-swapped' });
    expect(result.exit, result.stdout + result.stderr).toBe(0);
    expect(result.report.warnings).toHaveLength(1);
    expect(result.report.warnings[0]).toContain('.author-workflow.lock');
    expect(result.report.warnings[0]).toMatch(/no longer/i);
    expect(fs.readFileSync(lock, 'utf8')).toBe('another run\n');
    const g = fixture();
    const failed = run(g, helper, { AUTHOR_WORKFLOW_TEST_FAULT: 'fail-after-write,lock-swapped' });
    expect(failed.exit, failed.stdout + failed.stderr).toBe(1);
    expect(failed.blocked.reason).toContain('.author-workflow.lock');
    expect(failed.blocked.reason).toMatch(/no longer/i);
    expect(fs.existsSync(written(g))).toBe(false);
  });

  it('makes the link fault\'s keep.txt by an exclusive create: an existing keep.txt is left as it is and the fault does not act', () => {
    const f = fixture();
    fs.mkdirSync(path.join(f.root, 'link-target'));
    fs.writeFileSync(path.join(f.root, 'link-target', 'keep.txt'), 'mine\n');
    const result = replaced(f, 'workflow-becomes-link');
    expect(result.exit, result.stdout + result.stderr).toBe(1);
    expect(fs.readFileSync(path.join(f.root, 'link-target', 'keep.txt'), 'utf8')).toBe('mine\n');
    expect(fs.existsSync(written(f))).toBe(false);
  });

  linked('does not let the link fault write through a link-target that is itself a link (skipped only where a junction cannot be created)', () => {
    const f = fixture();
    const other = path.join(f.root, 'other-folder');
    fs.mkdirSync(other);
    link(other, path.join(f.root, 'link-target'));
    const result = replaced(f, 'workflow-becomes-link');
    expect(result.exit, result.stdout + result.stderr).toBe(1);
    expect(fs.readdirSync(other)).toEqual([]);
  });

  it('lets a fault force failures only: a replacement fault with no failure changes nothing, and the report is the documented one', () => {
    const f = fixture();
    const result = run(f, helper, { AUTHOR_WORKFLOW_TEST_FAULT: 'workflow-becomes-directory,workflow-swapped', AUTHOR_WORKFLOW_TEST_ROOT: f.root });
    expect(result.exit, result.stdout + result.stderr).toBe(0);
    expect(fs.readFileSync(written(f), 'utf8')).toBe(WORKFLOW);
    expect(result.report.status).toBe('written');
    const g = fixture();
    const unknown = run(g, helper, { AUTHOR_WORKFLOW_TEST_FAULT: 'make-it-pass,succeed' });
    expect(unknown.exit, unknown.stdout + unknown.stderr).toBe(0);
  });

  it('removes the lock when writing the process id into it fails, and writes nothing else', () => {
    const f = fixture();
    const before = tree(f.checkout);
    const result = run(f, helper, { AUTHOR_WORKFLOW_TEST_FAULT: 'fail-lock-write' });
    expect(result.exit, result.stdout + result.stderr).toBe(1);
    expect(result.blocked.reason).toMatch(/could not finish/i);
    expect(tree(f.checkout)).toEqual(before);
  });

  it('reports a lock it could not remove after a successful run as a warning, and still succeeds', () => {
    const f = fixture();
    const result = run(f, helper, { AUTHOR_WORKFLOW_TEST_FAULT: 'fail-lock-removal' });
    expect(result.exit, result.stdout + result.stderr).toBe(0);
    expect(result.report.status).toBe('written');
    expect(result.report.warnings).toHaveLength(1);
    expect(result.report.warnings[0]).toContain('.author-workflow.lock');
    expect(fs.readFileSync(written(f), 'utf8')).toBe(WORKFLOW);
    // The seam only forces the failure, so the lock is still there, as it would be after a real one.
    expect(fs.existsSync(path.join(f.checkout, 'registry/.author-workflow.lock'))).toBe(true);
  });

  it('appends the lock warning to a refusal when both the run and the lock removal fail', () => {
    const f = fixture();
    const result = run(f, helper, { AUTHOR_WORKFLOW_TEST_FAULT: 'fail-after-write,fail-lock-removal' });
    expect(result.exit, result.stdout + result.stderr).toBe(1);
    expect(result.blocked.reason).toMatch(/could not finish/i);
    expect(result.blocked.reason).toContain('.author-workflow.lock');
    expect(fs.existsSync(written(f))).toBe(false);
  });

  it('adds a warning only when something went wrong, so the documented report stays as it is', () => {
    const f = fixture();
    expect('warnings' in run(f).report).toBe(false);
  });

  it('prints its usage for a missing or unreadable job argument and writes nothing', () => {
    const f = fixture();
    const before = tree(f.checkout);
    const none = spawnSync(process.execPath, [helper], { cwd: f.root, encoding: 'utf8' });
    expect(none.status).toBe(1);
    expect(JSON.parse(none.stderr).reason).toMatch(/absolute.*job/i);
    const missing = spawnSync(process.execPath, [helper, path.join(f.root, 'absent.json')], { cwd: f.root, encoding: 'utf8' });
    expect(missing.status).toBe(1);
    expect(JSON.parse(missing.stderr).status).toBe('blocked');
    expect(tree(f.checkout)).toEqual(before);
  });

  it('documents a job record and report that the helper reproduces (the checked input/output example)', () => {
    const doc = fs.readFileSync(path.join(candidate, 'references/job.md'), 'utf8');
    const blocks = [...doc.matchAll(/```json\r?\n([\s\S]*?)```/g)].map(match => JSON.parse(match[1]!) as Record<string, any>);
    const input = blocks.find(block => 'checkout' in block)!;
    const output = blocks.find(block => block.status === 'written')!;
    expect(input).toBeDefined();
    expect(output).toBeDefined();
    const f = fixture();
    // The documented example names its own workflow; give the fixture that Skill and keep the example's content.
    const name = String(input.name);
    fs.mkdirSync(path.join(f.checkout, `registry/skills/${name}`), { recursive: true });
    fs.writeFileSync(path.join(f.checkout, `registry/skills/${name}/SKILL.md`), SKILL_TEXT.replaceAll(NAME, name));
    f.job = { ...input, checkout: f.checkout };
    // The documented report shows a listed Skill: the example's Skill sits in one Bundle, named agent-factory.
    writeBundles(f, { 'agent-factory': ['author-skill', name] });
    const result = run(f);
    expect(result.exit, result.stdout + result.stderr).toBe(0);
    const expected = JSON.parse(JSON.stringify(output)) as Record<string, any>;
    expected.skill.sha256 = result.report.skill.sha256;
    expect(result.report).toEqual(expected);
    expect(workflowCheckExitCode(runWorkflowCheck({ artifact: path.join(f.checkout, WORKFLOWS, `${name}.js`) }))).toBe(0);
  });
});

describe('author-workflow records', () => {
  const read = (rel: string): string => fs.readFileSync(path.resolve(rel), 'utf8');

  it('is named in the contributor lists of README.md and CONTEXT.md', () => {
    expect(read('README.md')).toMatch(/`author-workflow` for one native Claude workflow/);
    expect(read('CONTEXT.md')).toMatch(/contributor-only `author-skill`, `author-rule`, `author-workflow`,/);
    // The evaluator summary names every kind the evaluator reviews, workflows included.
    expect(read('README.md')).toMatch(/opinion protocol for shared pairs, Skills, Claude agents, rules and workflows\./);
  });

  it('has an in-house provenance record that copies the one of author-rule, with its own name and date', () => {
    const upstream = JSON.parse(read('host-library/_upstream/skills.json')) as { skills?: Record<string, Record<string, string>>; [key: string]: unknown };
    const records = (upstream.skills ?? upstream) as Record<string, Record<string, string>>;
    const rule = records['author-rule']!;
    const mine = records['author-workflow']!;
    expect(mine).toBeDefined();
    expect({ ...mine, recoveredAt: '', skill: '' }).toEqual({ ...rule, recoveredAt: '', skill: '' });
    expect(mine.skill).toBe('author-workflow');
    expect(mine.recoveredAt).toMatch(/^2026-11-\d\d$/);
    const keys = Object.keys(records);
    expect(keys.indexOf('author-workflow')).toBe(keys.indexOf('author-skill') + 1);
  });
});
