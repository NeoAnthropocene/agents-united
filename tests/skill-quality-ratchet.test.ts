import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  CORPUS_MIN_SKILLS,
  STUB_MAX_LINES,
  TEMPLATED_THRESHOLD,
  contentLines,
  listSkills,
  loadCorpus,
  measureAll,
  measureSkill,
  normaliseLine,
  verdictOf,
} from '../scripts/skill-quality/measure.ts';

/**
 * Plan 035 S1 (ADR 0040): the skill quality ratchet.
 *
 * A skill whose body is mostly lines that other skills carry too (a template with the title
 * swapped), or a stub, fails unless it is on the shrinking allowlist. The allowlist is one marker
 * file per skill in `tests/fixtures/templated-skills/`: a rewrite deletes its own marker, so two
 * rewrites never touch the same line and never conflict. No marker can be added (the initial set
 * is frozen), and a marker of a skill that now passes is itself a failure, so the list only shrinks.
 */

const ROOT = process.cwd();
const SKILLS = path.join(ROOT, 'registry', 'skills');
const FIXTURES = path.join(ROOT, 'tests', 'fixtures');
const MARKERS = path.join(FIXTURES, 'templated-skills');
const CORPUS_FILE = path.join(FIXTURES, 'skill-boilerplate-corpus.txt');
const INITIAL_FILE = path.join(FIXTURES, 'skill-quality-initial.txt');

const roots: string[] = [];
afterEach(() => {
  while (roots.length > 0) fs.rmSync(roots.pop()!, { recursive: true, force: true });
});
function tmpSkills(skills: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-quality-'));
  roots.push(dir);
  for (const [name, body] of Object.entries(skills)) {
    fs.mkdirSync(path.join(dir, name), { recursive: true });
    fs.writeFileSync(path.join(dir, name, 'SKILL.md'), body);
  }
  return dir;
}
const fm = (name: string, extra = ''): string => `---\nname: ${name}\ndescription: test\nmetadata:\n  author: agents-united\n${extra}---\n`;

describe('measure: what counts as a content line', () => {
  it('drops headings, fences, tables rules, blanks and lines under three words', () => {
    expect(normaliseLine('# Ab Test Setup', 'ab-test-setup')).toBeNull();
    expect(normaliseLine('```bash', 'ab-test-setup')).toBeNull();
    expect(normaliseLine('|---|---|---|', 'ab-test-setup')).toBeNull();
    expect(normaliseLine('   ', 'ab-test-setup')).toBeNull();
    expect(normaliseLine('Run it now', 'ab-test-setup')).toBe('run it now');
    expect(normaliseLine('Short one', 'ab-test-setup')).toBeNull();
  });

  it('takes the skill name out in kebab, spaced, title and joined forms, so a title swap is invisible', () => {
    const a = normaliseLine('The Ab Test Setup skill provides a framework for ab-test-setup work.', 'ab-test-setup');
    const b = normaliseLine('The Signup Flow Cro skill provides a framework for signup-flow-cro work.', 'signup-flow-cro');
    expect(a).toBe(b);
    expect(a).toContain('@');
  });

  it('skips fenced code, so an exemplar block is not boilerplate evidence', () => {
    const body = `${fm('x')}\nA real sentence about this thing here.\n\`\`\`ts\nexport function placeholder(): boolean { return true; }\n\`\`\`\nAnother real sentence about that thing.\n`;
    expect(contentLines(body, 'x')).toHaveLength(2);
  });
});

describe('measure: verdicts', () => {
  const corpus = new Set(['shared line about the framework we use', 'another shared line from the template body']);

  it('flags a skill made of corpus lines as templated and a hand-written one as ok', () => {
    const lines = (n: number, prefix: string): string => Array.from({ length: n }, (_, i) => `${prefix} sentence number ${i} adds something real`).join('\n');
    const dir = tmpSkills({
      templated: `${fm('templated')}\nshared line about the framework we use\nanother shared line from the template body\n${lines(1, 'unique')}\n`,
      written: `${fm('written')}\n${lines(40, 'unique')}\n`,
    });
    expect(verdictOf(measureSkill(dir, 'templated', corpus))).toBe('templated');
    expect(verdictOf(measureSkill(dir, 'written', corpus))).toBe('ok');
  });

  it('flags a short in-house skill without extra files as a stub, but not a third-party or documented one', () => {
    const short = Array.from({ length: STUB_MAX_LINES - 5 }, (_, i) => `distinct sentence number ${i} says so`).join('\n');
    const dir = tmpSkills({
      stubby: `${fm('stubby')}\n${short}\n`,
      adapted: `${fm('adapted', '  source: https://github.com/example/skills\n')}\n${short}\n`,
      documented: `${fm('documented')}\n${short}\n`,
    });
    fs.mkdirSync(path.join(dir, 'documented', 'references'));
    fs.writeFileSync(path.join(dir, 'documented', 'references', 'detail.md'), 'detail\n');
    expect(verdictOf(measureSkill(dir, 'stubby', corpus))).toBe('stub');
    expect(verdictOf(measureSkill(dir, 'adapted', corpus))).toBe('ok');
    expect(verdictOf(measureSkill(dir, 'documented', corpus))).toBe('ok');
  });

  it('does not call a short workflow skill a stub: workflow skills are phase scripts (ADR 0016)', () => {
    const short = Array.from({ length: STUB_MAX_LINES - 5 }, (_, i) => `distinct sentence number ${i} says so`).join('\n');
    const dir = tmpSkills({ 'workflow-demo': `${fm('workflow-demo')}\n${short}\n` });
    expect(verdictOf(measureSkill(dir, 'workflow-demo', corpus))).toBe('ok');
  });

  it('counts a source that points at this repository as in-house', () => {
    const short = Array.from({ length: STUB_MAX_LINES - 5 }, (_, i) => `distinct sentence number ${i} says so`).join('\n');
    const dir = tmpSkills({ own: `${fm('own', '  source: https://github.com/NeoAnthropocene/agents-united\n')}\n${short}\n` });
    expect(measureSkill(dir, 'own', corpus).thirdParty).toBe(false);
  });

  it('the frozen thresholds are the ones ADR 0040 states', () => {
    expect(TEMPLATED_THRESHOLD).toBe(0.3);
    expect(STUB_MAX_LINES).toBe(30);
    expect(CORPUS_MIN_SKILLS).toBe(3);
  });
});

describe('the catalog ratchet', () => {
  const corpus = loadCorpus(CORPUS_FILE);
  const measures = measureAll(SKILLS, corpus);
  const failing = measures.filter((m) => verdictOf(m) !== 'ok').map((m) => m.name);
  const markers = fs.existsSync(MARKERS) ? fs.readdirSync(MARKERS).filter((f) => !f.startsWith('.')).sort() : [];
  const initial = new Set(fs.readFileSync(INITIAL_FILE, 'utf8').split(/\r?\n/).filter(Boolean));

  it('has a frozen corpus of boilerplate lines', () => {
    expect(corpus.size).toBeGreaterThan(50);
  });

  it('rejects a templated or stub skill that is not on the allowlist (rewrite it, do not add a marker)', () => {
    const unlisted = failing.filter((n) => !markers.includes(n));
    expect(unlisted, `Templated or stub skills with no marker: ${unlisted.join(', ')}. Rewrite them with real, role-specific content (ADR 0040); markers cannot be added.`).toEqual([]);
  });

  it('keeps no marker for a skill that now passes or no longer exists (delete the marker with the rewrite)', () => {
    const stale = markers.filter((n) => !failing.includes(n));
    expect(stale, `Delete tests/fixtures/templated-skills/<name> for: ${stale.join(', ')}`).toEqual([]);
  });

  it('only ever shrinks: every marker belongs to the frozen initial set', () => {
    const added = markers.filter((n) => !initial.has(n));
    expect(added, `Markers added after the audit: ${added.join(', ')}`).toEqual([]);
    expect(initial.size).toBeGreaterThan(0);
  });

  it('measures every skill folder of the catalog', () => {
    expect(measures.map((m) => m.name)).toEqual(listSkills(SKILLS));
  });

  it('has an audit row for every skill of the digital-agency bundle (docs/skill-quality/digital-agency-audit.md)', () => {
    const bundles = JSON.parse(fs.readFileSync(path.join(ROOT, 'registry', 'bundles.json'), 'utf8')).bundles;
    const audit = fs.readFileSync(path.join(ROOT, 'docs', 'skill-quality', 'digital-agency-audit.md'), 'utf8');
    const rows = new Set([...audit.matchAll(/^\| `([a-z0-9-]+)` \|/gm)].map((m) => m[1]));
    const missing = (bundles['digital-agency'].skills as string[]).filter((s) => !rows.has(s));
    expect(missing, `Skills of the bundle with no audit row: ${missing.join(', ')}`).toEqual([]);
  });
});
