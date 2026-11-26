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
import { runRuleCheck, ruleCheckExitCode } from '../src/core/rule-check.js';
import { BOUND_FACTORY_SKILLS, parseClaudeSkillBinding } from '../src/core/claude-skill-binding.js';

/**
 * ADR 0082 slice S1: the `author-rule` factory Skill. It is the third factory route after author-skill, and follows its shape: a
 * shared entry within the factory budget, selective references, a bounded deterministic helper, evals, a native Claude loader and a
 * binding record from the closed list. Its job is one canonical rule file plus the rule's entry in one bundle's `rules[]`, in the
 * contributor's own branch, checked afterwards by `agents rule-check`.
 */
const registry = path.resolve('registry');
const skills = path.join(registry, 'skills');
const candidate = path.join(skills, 'author-rule');
const loaderFile = path.join(registry, 'hosts/claude/skills/author-rule/SKILL.md');
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

describe('author-rule source gates', () => {
  it('passes the Skill contract and the compact layout, within the factory entry budget', () => {
    const raw = fs.readFileSync(path.join(candidate, 'SKILL.md'), 'utf8');
    expect(validateRewrittenSkill('author-rule', raw, supportingText(candidate))).toEqual([]);
    expect(checkSkillLayout(skills, 'author-rule')).toEqual([]);
    expect(raw.split(/\r?\n/).length).toBeLessThanOrEqual(90);
    expect(raw.length).toBeLessThanOrEqual(6000);
    expect(fs.existsSync(path.resolve('tests/fixtures/templated-skills/author-rule'))).toBe(false);
  });

  it('has a trigger-first description within 1,024 characters, and original in-house metadata', () => {
    const { meta } = frontMatter(fs.readFileSync(path.join(candidate, 'SKILL.md'), 'utf8'));
    expect(meta.name).toBe('author-rule');
    expect(String(meta.description).length).toBeLessThanOrEqual(1024);
    expect(String(meta.description)).toMatch(/^Use when asked to create or repair one rule/);
    expect(meta.metadata).toEqual({ author: 'agents-united', version: '1.0.0', license: 'MIT' });
  });

  it('passes portability, the original MIT licence check and the frozen quality corpus', () => {
    const raw = fs.readFileSync(path.join(candidate, 'SKILL.md'), 'utf8');
    const { meta } = frontMatter(raw);
    const fm = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/)![1]!;
    expect(lintSkillPortability({ dirName: 'author-rule', name: meta.name, body: raw.slice(fm.length), scripts: files(candidate).filter(f => f.startsWith('scripts/')).map(relPath => ({ relPath, content: fs.readFileSync(path.join(candidate, relPath), 'utf8') })) })).toEqual([]);
    expect(lintSkillLicence({ dirName: 'author-rule', license: meta.metadata.license, source: meta.metadata.source, files: files(candidate) })).toEqual([]);
    const measure = measureSkill(skills, 'author-rule', loadCorpus(path.resolve('tests/fixtures/skill-boilerplate-corpus.txt')));
    expect(measure.share).toBeLessThan(0.30);
    expect(verdictOf(measure)).toBe('ok');
  });

  it('carries the seven sections, the rule route vocabulary and the scope limits', () => {
    const raw = fs.readFileSync(path.join(candidate, 'SKILL.md'), 'utf8');
    const text = `${raw}\n${supportingText(candidate)}`;
    expect(raw).toMatch(/registry\/rules\//);
    expect(raw).toMatch(/rules\[\]/);
    expect(raw).toMatch(/rule-check/);
    expect(text).toMatch(/scripts\/draft\.mjs/);
    expect(text).toMatch(/front matter/i);
    expect(text).toMatch(/Antigravity/);
    expect(text).toMatch(/200 lines|line budget|Claude budget/i);
    expect(text).toMatch(/never pushes|no commit, push/i);
  });

  it('separates create from repair in the shared entry and the native loader: only create needs a free name and the helper', () => {
    const shared = fs.readFileSync(path.join(candidate, 'SKILL.md'), 'utf8');
    const native = fs.readFileSync(loaderFile, 'utf8');
    for (const [label, text] of [['shared', shared], ['native', native]] as const) {
      const lines = text.split(/\r?\n/);
      const step = (n: number): string => lines.find(line => line.startsWith(`${n}. `)) ?? '';
      const [check, apply] = [step(2), step(5)];
      for (const line of [check, apply]) { expect(line, label).toMatch(/Create mode/); expect(line, label).toMatch(/Repair mode/); }
      const [createCheck = '', repairCheck = ''] = check.split('Repair mode');
      expect(createCheck, label).toMatch(/free/);
      expect(repairCheck, label).not.toMatch(/free/);
      expect(repairCheck, label).toMatch(/exists/);
      expect(repairCheck, label).toMatch(/baseline/);
      const [createApply = '', repairApply = ''] = apply.split('Repair mode');
      expect(createApply, label).toMatch(/draft\.mjs/);
      expect(repairApply, label).not.toMatch(/draft\.mjs/);
      expect(repairApply, label).toMatch(/do not run the helper/i);
      expect(repairApply, label).toMatch(/by hand/);
      expect(repairApply, label).toMatch(/bundles\.json/);
      // The stop list names the collision and the existing bundle entry as create-only stops.
      expect(lines.find(line => /^Stop the dependent action/.test(line)) ?? '', label).toMatch(/when creating/);
    }
    const job = fs.readFileSync(path.join(candidate, 'references/job.md'), 'utf8');
    expect(job).toMatch(/Repair mode/);
    expect(job).toMatch(/by hand/);
    expect(fs.readFileSync(path.join(candidate, 'examples/one-draft.md'), 'utf8')).toMatch(/Repair mode|repair mode/);
  });

  it('prepares an explicit same-prompt eval pair and one unrelated control without runs or thresholds', () => {
    const evals = JSON.parse(fs.readFileSync(path.join(candidate, 'evals/evals.json'), 'utf8')) as { skill_name: string; status: string; evals: Array<{ id: number; prompt: string; expected_output: string; kind?: string; runs?: Array<{ condition: string; prompt: string }> }>; results?: unknown; success_threshold?: unknown };
    expect(evals.skill_name).toBe('author-rule');
    expect(evals.status).toBe('prepared-not-run');
    expect(evals.evals.length).toBeGreaterThanOrEqual(2);
    expect(evals.evals.length).toBeLessThanOrEqual(5);
    for (const item of evals.evals) { expect(item.prompt.length).toBeGreaterThanOrEqual(40); expect(item.expected_output.length).toBeGreaterThanOrEqual(40); }
    const pair = evals.evals.filter(e => e.kind !== 'unrelated-control');
    expect(pair.length).toBeGreaterThanOrEqual(2);
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

describe('author-rule native Claude loader and binding', () => {
  const loader = (): string => fs.readFileSync(loaderFile, 'utf8');
  const entry = (): { skill: string; file: string } => BOUND_FACTORY_SKILLS.find(item => item.skill === 'author-rule')!;

  it('is the second entry of the closed reviewed list, after author-skill', () => {
    expect(BOUND_FACTORY_SKILLS.map(item => item.skill)).toEqual(['author-skill', 'author-rule']);
    expect(entry().file).toBe('hosts/claude/agent-factory-rule.binding.json');
  });

  it('forks into the built-in general-purpose role, off the background, and links the installed attribution rule', () => {
    const { meta, body } = frontMatter(loader());
    expect(meta).toMatchObject({ name: 'author-rule', context: 'fork', agent: 'general-purpose', background: false });
    expect(meta.metadata).toEqual({ author: 'agents-united', version: '1.0.0', license: 'MIT' });
    expect(body).toContain('](references/skill-attribution.md)');
    expect(loader()).toContain('scripts/draft.mjs');
  });

  it('has a binding record the per-entry schema accepts, declaring every support file the loader and the Skill need', () => {
    const declaration = JSON.parse(fs.readFileSync(path.join(registry, entry().file), 'utf8')) as Record<string, unknown>;
    const binding = parseClaudeSkillBinding(entry(), declaration);
    expect(binding).toMatchObject({ skill: 'author-rule', bundle: 'agent-factory', invocation: '/author-rule', source: 'hosts/claude/skills/author-rule/SKILL.md', installed: '.claude/skills/author-rule/SKILL.md' });
    expect(binding.rule.installed).toBe('.claude/skills/author-rule/references/skill-attribution.md');
    expect([...binding.requiredSupport].sort()).toEqual(['assets/report.md', 'examples/one-draft.md', 'references/job.md', 'references/provenance.md', 'references/quality.md', 'scripts/draft.mjs']);
    for (const rel of binding.requiredSupport) expect(fs.existsSync(path.join(candidate, rel)), rel).toBe(true);
  });

  it('keeps the native loader sections the shared entry has, so one job reads the same in both', () => {
    const shared = frontMatter(fs.readFileSync(path.join(candidate, 'SKILL.md'), 'utf8')).body;
    const native = frontMatter(loader()).body;
    const headings = (text: string): string[] => text.split(/\r?\n/).filter(line => /^## /.test(line));
    expect(headings(native)).toEqual(headings(shared));
    expect(frontMatter(loader()).meta.description).toBe(frontMatter(fs.readFileSync(path.join(candidate, 'SKILL.md'), 'utf8')).meta.description);
  });

  it('is declared by the agent-factory bundle right after author-skill', () => {
    const bundles = (JSON.parse(fs.readFileSync(path.join(registry, 'bundles.json'), 'utf8')) as { bundles: Record<string, { skills: string[] }> }).bundles;
    const list = bundles['agent-factory']!.skills;
    expect(list.indexOf('author-rule')).toBe(list.indexOf('author-skill') + 1);
    for (const [name, bundle] of Object.entries(bundles)) if (name !== 'agent-factory') expect(bundle.skills, name).not.toContain('author-rule');
  });
});

describe('author-rule bounded draft helper', () => {
  const RULE = '# Release notes\n\n- Name the user-visible change before the internal cause.\n- Link the issue or the pull request for every item.\n';
  interface Fixture { root: string; checkout: string; job: Record<string, unknown>; bundles: string }
  function fixture(): Fixture {
    // The real path of the temp folder: the helper refuses a checkout path that goes through a link (macOS /var is one).
    const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'author-rule-'));
    roots.push(root);
    const checkout = path.join(root, 'checkout');
    fs.mkdirSync(path.join(checkout, 'registry/rules'), { recursive: true });
    fs.writeFileSync(path.join(checkout, 'registry/rules/skill-attribution.md'), '# Attribution\n\n- Credit the source.\n');
    fs.writeFileSync(path.join(checkout, 'registry/rules/CLAUDE.md'), '# Entry point\n');
    const bundles = { $schema: 'x', version: '1', bundles: {
      'agent-factory': { name: 'agent-factory', domain: 'contributor', agents: [], skills: ['author-skill'], workflows: [], rules: ['skill-attribution.md'], hostAvailability: { claude: { lane: 'native' } } },
      'plain': { name: 'plain', domain: 'contributor', agents: [], skills: ['author-skill'], workflows: [] },
      'bare': { name: 'bare', domain: 'contributor', agents: [] },
    } };
    const text = `${JSON.stringify(bundles, null, 2)}\n`;
    fs.writeFileSync(path.join(checkout, 'registry/bundles.json'), text);
    return { root, checkout, bundles: text, job: { checkout, name: 'release-notes', bundle: 'agent-factory', content: RULE } };
  }
  function run(f: Fixture, executable = helper, env: Record<string, string> = {}): { exit: number | null; stdout: string; stderr: string; report: Record<string, any>; blocked: Record<string, any> } {
    const jobPath = path.join(f.root, 'job.json');
    fs.writeFileSync(jobPath, JSON.stringify(f.job));
    const result = spawnSync(process.execPath, [executable, jobPath], { cwd: f.root, encoding: 'utf8', env: { ...process.env, ...env } });
    return { exit: result.status, stdout: result.stdout, stderr: result.stderr,
      report: result.status === 0 ? JSON.parse(result.stdout) as Record<string, any> : {},
      blocked: result.status === 1 ? JSON.parse(result.stderr) as Record<string, any> : {} };
  }
  const bundlesOf = (f: Fixture): any => JSON.parse(fs.readFileSync(path.join(f.checkout, 'registry/bundles.json'), 'utf8')).bundles;
  function expectBlocked(f: Fixture, reason: RegExp): void {
    const result = run(f);
    expect(result.exit, result.stdout + result.stderr).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.blocked.status).toBe('blocked');
    expect(result.blocked.reason).toMatch(reason);
    expect(fs.readFileSync(path.join(f.checkout, 'registry/bundles.json'), 'utf8')).toBe(f.bundles);
    expect(fs.readdirSync(path.join(f.checkout, 'registry/rules')).sort()).toEqual(['CLAUDE.md', 'skill-attribution.md']);
    expect(fs.readdirSync(path.join(f.checkout, 'registry')).sort()).toEqual(['bundles.json', 'rules']);
  }

  it('runs a copy of the helper outside the checkout with no dependency or relative import', () => {
    const f = fixture();
    const installed = path.join(f.root, 'installed-skill', 'scripts', 'draft.mjs');
    fs.mkdirSync(path.dirname(installed), { recursive: true });
    fs.copyFileSync(helper, installed);
    const result = run(f, installed);
    expect(result.exit, result.stdout + result.stderr).toBe(0);
    expect(fs.existsSync(path.join(f.root, 'node_modules'))).toBe(false);
  });

  it('writes the rule file and appends its entry to the chosen bundle, with the hashes it wrote', () => {
    const f = fixture();
    const result = run(f);
    expect(result.exit, result.stdout + result.stderr).toBe(0);
    const written = fs.readFileSync(path.join(f.checkout, 'registry/rules/release-notes.md'), 'utf8');
    expect(written).toBe(RULE);
    expect(bundlesOf(f)['agent-factory'].rules).toEqual(['skill-attribution.md', 'release-notes.md']);
    const after = fs.readFileSync(path.join(f.checkout, 'registry/bundles.json'), 'utf8');
    expect(after).toBe(`${JSON.stringify(JSON.parse(after), null, 2)}\n`);
    expect(result.report).toEqual({
      version: 1, status: 'written',
      rule: { path: 'registry/rules/release-notes.md', bytes: Buffer.byteLength(RULE), sha256: sha(RULE) },
      bundle: { name: 'agent-factory', file: 'registry/bundles.json', rules: ['skill-attribution.md', 'release-notes.md'], sha256Before: sha(f.bundles), sha256After: sha(after) },
      validation: { status: 'unverified', reason: 'This helper runs no rule-check; run it on the written rule file.' },
      externalActions: [],
    });
  });

  it('leaves every other bundle and every other byte of bundles.json as it was', () => {
    const f = fixture();
    expect(run(f).exit).toBe(0);
    const before = JSON.parse(f.bundles).bundles;
    const after = bundlesOf(f);
    expect(after.plain).toEqual(before.plain);
    expect(after.bare).toEqual(before.bare);
    expect(Object.keys(after['agent-factory'])).toEqual(Object.keys(before['agent-factory']));
  });

  it('adds a missing rules key after workflows, or after skills, in the order the other bundles use', () => {
    const f = fixture();
    f.job.bundle = 'plain';
    expect(run(f).exit).toBe(0);
    expect(Object.keys(bundlesOf(f).plain)).toEqual(['name', 'domain', 'agents', 'skills', 'workflows', 'rules']);
    expect(bundlesOf(f).plain.rules).toEqual(['release-notes.md']);
    const g = fixture();
    g.job.bundle = 'bare';
    expect(run(g).exit).toBe(0);
    expect(Object.keys(bundlesOf(g).bare)).toEqual(['name', 'domain', 'agents', 'rules']);
  });

  it('writes a rule that rule-check passes, the check the runbook runs next', () => {
    const f = fixture();
    expect(run(f).exit).toBe(0);
    const result = runRuleCheck({ artifact: path.join(f.checkout, 'registry/rules/release-notes.md') });
    expect(result.findings).toEqual([]);
    expect(ruleCheckExitCode(result)).toBe(0);
  });

  it('adds a trailing newline when the authored text lacks one, and keeps CRLF text as it is', () => {
    const f = fixture();
    f.job.content = '# No newline\n\n- One instruction.';
    expect(run(f).exit).toBe(0);
    expect(fs.readFileSync(path.join(f.checkout, 'registry/rules/release-notes.md'), 'utf8')).toBe('# No newline\n\n- One instruction.\n');
    const g = fixture();
    g.job.content = '# Crlf\r\n\r\n- One instruction.\r\n';
    expect(run(g).exit).toBe(0);
    expect(fs.readFileSync(path.join(g.checkout, 'registry/rules/release-notes.md'), 'utf8')).toBe('# Crlf\r\n\r\n- One instruction.\r\n');
  });

  it('keeps CRLF line endings in a bundles.json that has them', () => {
    const f = fixture();
    fs.writeFileSync(path.join(f.checkout, 'registry/bundles.json'), f.bundles.replace(/\n/g, '\r\n'));
    f.bundles = f.bundles.replace(/\n/g, '\r\n');
    expect(run(f).exit).toBe(0);
    const after = fs.readFileSync(path.join(f.checkout, 'registry/bundles.json'), 'utf8');
    expect(after.includes('\r\n')).toBe(true);
    expect(after.replace(/\r\n/g, '\n').includes('\r')).toBe(false);
    expect(after.match(/(?<!\r)\n/g)).toBeNull(); // every newline is CRLF, none is a lone LF
    expect(after.split('\r\n').length - 1).toBe(after.split('\n').length - 1);
    expect(bundlesOf(f)['agent-factory'].rules).toContain('release-notes.md');
  });

  it('refuses a bundles.json with mixed line endings rather than rewrite it all one way', () => {
    const f = fixture();
    f.bundles = f.bundles.replace('\n', '\r\n'); // the first newline only: CRLF and LF in one file
    expect(f.bundles).toMatch(/\r\n/);
    expect(f.bundles).toMatch(/(?<!\r)\n/);
    fs.writeFileSync(path.join(f.checkout, 'registry/bundles.json'), f.bundles);
    expectBlocked(f, /mixed|line ending/i);
  });

  it.each([
    ['an upper-case name', 'Release-Notes', /kebab-case/i],
    ['a name with an extension', 'release-notes.md', /kebab-case/i],
    ['a name with a path', '../release-notes', /kebab-case/i],
    ['an empty name', '', /kebab-case/i],
    ['a host entry-point name', 'claude', /entry-point/i],
    ['another host entry-point name', 'gemini', /entry-point/i],
    ['a reserved device name', 'con', /reserved|device/i],
    ['a numbered device name', 'com1', /reserved|device/i],
  ])('refuses %s before writing anything', (_label, name, reason) => {
    const f = fixture();
    f.job.name = name;
    expectBlocked(f, reason);
  });

  it('refuses a name that collides with an existing rule, including the attribution rule and another case', () => {
    const f = fixture();
    f.job.name = 'skill-attribution';
    expectBlocked(f, /already exists|collides/i);
    // A differently-cased file: a real second file on a case-sensitive disk, the same file on Windows; both must be refused.
    const g = fixture();
    fs.writeFileSync(path.join(g.checkout, 'registry/rules/Release-Notes.md'), '# Existing\n');
    const result = run(g);
    expect(result.exit).toBe(1);
    expect(result.blocked.reason).toMatch(/already exists|collides/i);
    expect(fs.readFileSync(path.join(g.checkout, 'registry/rules/Release-Notes.md'), 'utf8')).toBe('# Existing\n');
    expect(fs.readdirSync(path.join(g.checkout, 'registry/rules')).filter(name => name.toLowerCase() === 'release-notes.md')).toHaveLength(1);
    expect(fs.readFileSync(path.join(g.checkout, 'registry/bundles.json'), 'utf8')).toBe(g.bundles);
  });

  it('refuses an unknown bundle, and a bundle that already lists the rule file', () => {
    const f = fixture();
    f.job.bundle = 'no-such-bundle';
    expectBlocked(f, /bundle.*no-such-bundle|unknown bundle/i);
    const g = fixture();
    g.job.name = 'ghost-rule';
    const bundles = JSON.parse(g.bundles);
    bundles.bundles['agent-factory'].rules.push('ghost-rule.md');
    g.bundles = `${JSON.stringify(bundles, null, 2)}\n`;
    fs.writeFileSync(path.join(g.checkout, 'registry/bundles.json'), g.bundles);
    expectBlocked(g, /already lists/i);
  });

  it('refuses a bundles.json it could not write back byte for byte, naming the reason', () => {
    const f = fixture();
    f.bundles = `${JSON.stringify(JSON.parse(f.bundles))}\n`;
    fs.writeFileSync(path.join(f.checkout, 'registry/bundles.json'), f.bundles);
    expectBlocked(f, /formatting|byte for byte/i);
  });

  it.each([
    ['no content', undefined, /content/i],
    ['empty content', '   \n', /content/i],
    ['content that is not text', 7, /content/i],
    ['content over the size limit', `# Big\n${'x'.repeat(70 * 1024)}\n`, /larger than|too large|limit/i],
  ])('refuses %s', (_label, content, reason) => {
    const f = fixture();
    f.job.content = content;
    if (content === undefined) delete f.job.content;
    expectBlocked(f, reason);
  });

  it.each([
    ['an extra key', { extra: 1 }, /unknown|extra|allowed/i],
    ['a relative checkout', { checkout: 'registry' }, /absolute/i],
    ['a checkout without a registry', { checkout: os.tmpdir() }, /registry/i],
  ])('refuses a job with %s', (_label, patch, reason) => {
    const f = fixture();
    Object.assign(f.job, patch);
    const result = run(f);
    expect(result.exit, result.stdout + result.stderr).toBe(1);
    expect(result.blocked.reason).toMatch(reason);
    expect(fs.readFileSync(path.join(f.checkout, 'registry/bundles.json'), 'utf8')).toBe(f.bundles);
  });

  it('refuses to write through a link in the rules folder, leaving the target untouched', () => {
    const f = fixture();
    const elsewhere = path.join(f.root, 'elsewhere');
    fs.mkdirSync(elsewhere);
    fs.rmSync(path.join(f.checkout, 'registry/rules'), { recursive: true });
    fs.symlinkSync(elsewhere, path.join(f.checkout, 'registry/rules'), 'junction');
    const result = run(f);
    expect(result.exit).toBe(1);
    expect(result.blocked.reason).toMatch(/link/i);
    expect(fs.readdirSync(elsewhere)).toEqual([]);
    expect(fs.readFileSync(path.join(f.checkout, 'registry/bundles.json'), 'utf8')).toBe(f.bundles);
  });

  // A junction on Windows (no privilege needed), a directory symlink elsewhere; skipped only when the machine refuses to make one.
  function link(target: string, at: string): boolean {
    try { fs.symlinkSync(target, at, 'junction'); return true; } catch (error) {
      if (['EPERM', 'EACCES'].includes((error as NodeJS.ErrnoException).code ?? '')) return false;
      throw error;
    }
  }
  function expectRealFolderUntouched(f: Fixture): void {
    expect(fs.readFileSync(path.join(f.checkout, 'registry/bundles.json'), 'utf8')).toBe(f.bundles);
    expect(fs.readdirSync(path.join(f.checkout, 'registry/rules')).sort()).toEqual(['CLAUDE.md', 'skill-attribution.md']);
    expect(fs.readdirSync(path.join(f.checkout, 'registry')).sort()).toEqual(['bundles.json', 'rules']);
  }

  it('refuses a checkout path that is a link to the real checkout, writing nothing in the real folder', () => {
    const f = fixture();
    const alias = path.join(f.root, 'alias');
    if (!link(f.checkout, alias)) return;
    f.job.checkout = alias;
    const result = run(f);
    expect(result.exit, result.stdout + result.stderr).toBe(1);
    expect(result.blocked.reason).toMatch(/link|real path/i);
    expectRealFolderUntouched(f);
  });

  it('refuses a checkout whose parent folder is a link, writing nothing in the real folder', () => {
    const f = fixture();
    const parent = path.join(f.root, 'linked-parent');
    if (!link(f.root, parent)) return;
    f.job.checkout = path.join(parent, 'checkout');
    const result = run(f);
    expect(result.exit, result.stdout + result.stderr).toBe(1);
    expect(result.blocked.reason).toMatch(/link|real path/i);
    expectRealFolderUntouched(f);
  });

  it('refuses a registry folder that is a link to another registry, writing nothing in the target', () => {
    const f = fixture();
    const other = path.join(f.root, 'other-registry');
    fs.renameSync(path.join(f.checkout, 'registry'), other);
    if (!link(other, path.join(f.checkout, 'registry'))) return;
    const result = run(f);
    expect(result.exit, result.stdout + result.stderr).toBe(1);
    expect(result.blocked.reason).toMatch(/link/i);
    expect(fs.readdirSync(other).sort()).toEqual(['bundles.json', 'rules']);
    expect(fs.readdirSync(path.join(other, 'rules')).sort()).toEqual(['CLAUDE.md', 'skill-attribution.md']);
    expect(fs.readFileSync(path.join(other, 'bundles.json'), 'utf8')).toBe(f.bundles);
  });

  it('leaves no lock or temporary file behind after a successful run', () => {
    const f = fixture();
    expect(run(f).exit).toBe(0);
    expect(fs.readdirSync(path.join(f.checkout, 'registry')).sort()).toEqual(['bundles.json', 'rules']);
  });

  it('refuses to run while another run holds the lock, changes nothing and leaves the other run its lock', () => {
    const f = fixture();
    const lock = path.join(f.checkout, 'registry/.bundles.json.lock');
    fs.writeFileSync(lock, 'another run\n');
    const result = run(f);
    expect(result.exit, result.stdout + result.stderr).toBe(1);
    expect(result.blocked.reason).toMatch(/lock/i);
    expect(fs.readFileSync(lock, 'utf8')).toBe('another run\n');
    expect(fs.readdirSync(path.join(f.checkout, 'registry')).sort()).toEqual(['.bundles.json.lock', 'bundles.json', 'rules']);
    expect(fs.readdirSync(path.join(f.checkout, 'registry/rules')).sort()).toEqual(['CLAUDE.md', 'skill-attribution.md']);
    expect(fs.readFileSync(path.join(f.checkout, 'registry/bundles.json'), 'utf8')).toBe(f.bundles);
  });

  // The helper's only test seam: AUTHOR_RULE_TEST_FAULT, read once, inert unless set; every fault only simulates, none writes.
  it('refuses a manifest that changed between the read and the rename, leaving nothing behind', () => {
    const f = fixture();
    const result = run(f, helper, { AUTHOR_RULE_TEST_FAULT: 'manifest-changed' });
    expect(result.exit, result.stdout + result.stderr).toBe(1);
    expect(result.blocked.reason).toMatch(/changed/i);
    // The seam only simulates the change: the test checkout's manifest bytes are exactly what they were.
    expect(fs.readFileSync(path.join(f.checkout, 'registry/bundles.json'))).toEqual(Buffer.from(f.bundles));
    expect(fs.readdirSync(path.join(f.checkout, 'registry')).sort()).toEqual(['bundles.json', 'rules']);
    expect(fs.readdirSync(path.join(f.checkout, 'registry/rules')).sort()).toEqual(['CLAUDE.md', 'skill-attribution.md']);
  });

  it('removes the rule file, the temporary file and the lock when a failure comes between the two writes', () => {
    const f = fixture();
    const result = run(f, helper, { AUTHOR_RULE_TEST_FAULT: 'fail-before-rename' });
    expect(result.exit, result.stdout + result.stderr).toBe(1);
    expect(result.blocked.reason).toMatch(/could not finish/i);
    expect(fs.readFileSync(path.join(f.checkout, 'registry/bundles.json'), 'utf8')).toBe(f.bundles);
    expect(fs.readdirSync(path.join(f.checkout, 'registry')).sort()).toEqual(['bundles.json', 'rules']);
    expect(fs.readdirSync(path.join(f.checkout, 'registry/rules')).sort()).toEqual(['CLAUDE.md', 'skill-attribution.md']);
  });

  it('leaves a rule file whose bytes are not the ones this run wrote, and names it as left in place', () => {
    const f = fixture();
    // The seam makes the helper see different bytes in the rule at rollback time; no file is touched.
    const result = run(f, helper, { AUTHOR_RULE_TEST_FAULT: 'fail-before-rename,rule-replaced' });
    expect(result.exit, result.stdout + result.stderr).toBe(1);
    expect(result.blocked.reason).toMatch(/left in place/i);
    expect(result.blocked.reason).toContain('release-notes.md');
    expect(fs.readFileSync(path.join(f.checkout, 'registry/rules/release-notes.md'), 'utf8')).toBe(RULE);
    expect(fs.readFileSync(path.join(f.checkout, 'registry/bundles.json'), 'utf8')).toBe(f.bundles);
    expect(fs.readdirSync(path.join(f.checkout, 'registry')).sort()).toEqual(['bundles.json', 'rules']);
  });

  it('leaves a temporary file whose bytes are not the ones this run wrote, and removes the rule it did write', () => {
    const f = fixture();
    const result = run(f, helper, { AUTHOR_RULE_TEST_FAULT: 'fail-before-rename,temp-replaced' });
    expect(result.exit, result.stdout + result.stderr).toBe(1);
    expect(result.blocked.reason).toMatch(/left in place/i);
    expect(result.blocked.reason).toMatch(/\.bundles-[0-9a-f]+\.tmp/);
    expect(fs.readdirSync(path.join(f.checkout, 'registry/rules')).sort()).toEqual(['CLAUDE.md', 'skill-attribution.md']);
    expect(fs.readdirSync(path.join(f.checkout, 'registry')).filter(entry => entry.endsWith('.tmp'))).toHaveLength(1);
  });

  // Round 3: a write that this run started and that threw leaves a truncated file, which is this run's own and is removed;
  // anything else that is not the exact bytes, or not a regular file, is left in place and named.
  it('removes a truncated rule file that this run wrote when its own write threw, leaves no lock or temp, and a retry then succeeds', () => {
    const f = fixture();
    const result = run(f, helper, { AUTHOR_RULE_TEST_FAULT: 'partial-rule-write' });
    expect(result.exit, result.stdout + result.stderr).toBe(1);
    expect(result.blocked.reason).toMatch(/could not finish/i);
    expect(result.blocked.reason).not.toMatch(/left in place/i);
    expect(fs.readFileSync(path.join(f.checkout, 'registry/bundles.json'), 'utf8')).toBe(f.bundles);
    expect(fs.readdirSync(path.join(f.checkout, 'registry')).sort()).toEqual(['bundles.json', 'rules']);
    expect(fs.readdirSync(path.join(f.checkout, 'registry/rules')).sort()).toEqual(['CLAUDE.md', 'skill-attribution.md']);
    const retry = run(f);
    expect(retry.exit, retry.stdout + retry.stderr).toBe(0);
    expect(fs.readFileSync(path.join(f.checkout, 'registry/rules/release-notes.md'), 'utf8')).toBe(RULE);
    expect(bundlesOf(f)['agent-factory'].rules).toEqual(['skill-attribution.md', 'release-notes.md']);
    expect(fs.readdirSync(path.join(f.checkout, 'registry')).sort()).toEqual(['bundles.json', 'rules']);
  });

  it('removes a truncated temporary file that this run wrote when its own write threw, and the rule it wrote before it', () => {
    const f = fixture();
    const result = run(f, helper, { AUTHOR_RULE_TEST_FAULT: 'partial-temp-write' });
    expect(result.exit, result.stdout + result.stderr).toBe(1);
    expect(result.blocked.reason).toMatch(/could not finish/i);
    expect(result.blocked.reason).not.toMatch(/left in place/i);
    expect(fs.readFileSync(path.join(f.checkout, 'registry/bundles.json'), 'utf8')).toBe(f.bundles);
    expect(fs.readdirSync(path.join(f.checkout, 'registry')).sort()).toEqual(['bundles.json', 'rules']);
    expect(fs.readdirSync(path.join(f.checkout, 'registry/rules')).sort()).toEqual(['CLAUDE.md', 'skill-attribution.md']);
  });

  // The replacement faults act only inside AUTHOR_RULE_TEST_ROOT, which the test sets to its own temp folder.
  const replaced = (f: Fixture, fault: string) => run(f, helper, { AUTHOR_RULE_TEST_FAULT: `fail-before-rename,${fault}`, AUTHOR_RULE_TEST_ROOT: f.root });

  it('leaves a rule path that has become a folder in place and names it', () => {
    const f = fixture();
    const result = replaced(f, 'rule-becomes-directory');
    expect(result.exit, result.stdout + result.stderr).toBe(1);
    expect(result.blocked.reason).toMatch(/left in place/i);
    expect(result.blocked.reason).toContain('release-notes.md');
    expect(fs.lstatSync(path.join(f.checkout, 'registry/rules/release-notes.md')).isDirectory()).toBe(true);
    expect(fs.readFileSync(path.join(f.checkout, 'registry/bundles.json'), 'utf8')).toBe(f.bundles);
  });

  it('leaves a rule path that has become a link in place, names it, and never touches what it points at', () => {
    const f = fixture();
    const result = replaced(f, 'rule-becomes-link');
    expect(result.exit, result.stdout + result.stderr).toBe(1);
    expect(result.blocked.reason).toMatch(/left in place/i);
    expect(result.blocked.reason).toContain('release-notes.md');
    expect(fs.lstatSync(path.join(f.checkout, 'registry/rules/release-notes.md')).isSymbolicLink()).toBe(true);
    expect(fs.readFileSync(path.join(f.root, 'link-target', 'keep.txt'), 'utf8')).toBe('keep\n');
  });

  it('leaves a rule file that grew far past what this run wrote in place and names it, without needing to read it whole', () => {
    const f = fixture();
    const result = replaced(f, 'rule-becomes-oversized');
    expect(result.exit, result.stdout + result.stderr).toBe(1);
    expect(result.blocked.reason).toMatch(/left in place/i);
    expect(result.blocked.reason).toContain('release-notes.md');
    const file = path.join(f.checkout, 'registry/rules/release-notes.md');
    expect(fs.statSync(file).size).toBeGreaterThan(1024 * 1024);
    expect(fs.readFileSync(file).subarray(0, Buffer.byteLength(RULE)).toString('utf8')).toBe(RULE); // it starts with the intended bytes, yet is not them
  });

  it('removes a prefix of the intended bytes only when this run\'s own write threw: a shorter file after a later failure is left', () => {
    const f = fixture();
    const result = replaced(f, 'rule-becomes-prefix');
    expect(result.exit, result.stdout + result.stderr).toBe(1);
    expect(result.blocked.reason).toMatch(/left in place/i);
    expect(result.blocked.reason).toContain('release-notes.md');
    expect(fs.readFileSync(path.join(f.checkout, 'registry/rules/release-notes.md'), 'utf8')).toBe(RULE.slice(0, 20));
  });

  it('removes the lock when writing the process id into it fails, and writes nothing else', () => {
    const f = fixture();
    const result = run(f, helper, { AUTHOR_RULE_TEST_FAULT: 'fail-lock-write' });
    expect(result.exit, result.stdout + result.stderr).toBe(1);
    expect(result.blocked.reason).toMatch(/could not finish/i);
    expect(fs.readdirSync(path.join(f.checkout, 'registry')).sort()).toEqual(['bundles.json', 'rules']);
    expect(fs.readdirSync(path.join(f.checkout, 'registry/rules')).sort()).toEqual(['CLAUDE.md', 'skill-attribution.md']);
    expect(fs.readFileSync(path.join(f.checkout, 'registry/bundles.json'), 'utf8')).toBe(f.bundles);
  });

  it('reports a lock it could not remove after a successful run as a warning, and still succeeds', () => {
    const f = fixture();
    const result = run(f, helper, { AUTHOR_RULE_TEST_FAULT: 'fail-lock-removal' });
    expect(result.exit, result.stdout + result.stderr).toBe(0);
    expect(result.report.status).toBe('written');
    expect(result.report.warnings).toHaveLength(1);
    expect(result.report.warnings[0]).toContain('.bundles.json.lock');
    expect(bundlesOf(f)['agent-factory'].rules).toEqual(['skill-attribution.md', 'release-notes.md']);
    // The seam only forces the failure, so the lock is still there, as it would be after a real one.
    expect(fs.existsSync(path.join(f.checkout, 'registry/.bundles.json.lock'))).toBe(true);
  });

  it('adds a warning only when something went wrong, so the documented report stays as it is', () => {
    const f = fixture();
    expect('warnings' in run(f).report).toBe(false);
  });

  it('prints its usage for a missing or unreadable job argument and writes nothing', () => {
    const f = fixture();
    const none = spawnSync(process.execPath, [helper], { cwd: f.root, encoding: 'utf8' });
    expect(none.status).toBe(1);
    expect(JSON.parse(none.stderr).reason).toMatch(/absolute.*job/i);
    const missing = spawnSync(process.execPath, [helper, path.join(f.root, 'absent.json')], { cwd: f.root, encoding: 'utf8' });
    expect(missing.status).toBe(1);
    expect(JSON.parse(missing.stderr).status).toBe('blocked');
    expect(fs.readFileSync(path.join(f.checkout, 'registry/bundles.json'), 'utf8')).toBe(f.bundles);
  });

  it('documents a job record and report that the helper reproduces (the checked input/output example)', () => {
    const doc = fs.readFileSync(path.join(candidate, 'references/job.md'), 'utf8');
    const blocks = [...doc.matchAll(/```json\r?\n([\s\S]*?)```/g)].map(match => JSON.parse(match[1]!) as Record<string, any>);
    const input = blocks.find(block => 'checkout' in block)!;
    const output = blocks.find(block => block.status === 'written')!;
    expect(input).toBeDefined();
    expect(output).toBeDefined();
    const f = fixture();
    f.job = { ...input, checkout: f.checkout };
    f.job.bundle = 'agent-factory';
    const result = run(f);
    expect(result.exit, result.stdout + result.stderr).toBe(0);
    const expected = JSON.parse(JSON.stringify(output)) as Record<string, any>;
    expected.bundle.sha256Before = result.report.bundle.sha256Before;
    expected.bundle.sha256After = result.report.bundle.sha256After;
    expect(result.report).toEqual(expected);
    expect(ruleCheckExitCode(runRuleCheck({ artifact: path.join(f.checkout, 'registry/rules', `${input.name}.md`) }))).toBe(0);
  });
});
