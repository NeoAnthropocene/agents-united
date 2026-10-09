import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import YAML from 'yaml';
import { describe, expect, it } from 'vitest';
import { nativeText } from './helpers/native-roles.js';

/**
 * Plan 036 S16, `brand-consistency-audit` (the maintainer's answer to Q9: write it in-house). The catalog had a checklist of seven
 * lines inside `brand-identity` whose scripts need a shell, and the creative designer has none. This skill is the audit as a
 * procedure a role without a shell can follow: a source of truth with its gaps marked, an inventory that is a list, a scan by script
 * or by `Grep`, the things only eyes see, findings with a rule and its source, counts made from lists (the slip that recurred in
 * Sitting J and Sitting K: "11 of 12", "15 of 18"), and a report that says what was not checked and edits nothing.
 */

const SKILL = 'brand-consistency-audit';
const DIR = path.resolve('registry/skills', SKILL);
const read = (rel: string): string => fs.readFileSync(path.join(DIR, rel), 'utf8').replace(/\r\n/g, '\n');
const skill = (): string => read('SKILL.md');
const body = (): string => skill().replace(/^---\n[\s\S]*?\n---\n/, '');
const meta = (): { name: string; description: string; metadata: { author: string; version: string; source?: string }; [k: string]: unknown } =>
  YAML.parse(/^---\n([\s\S]*?)\n---/.exec(skill())![1]!) as ReturnType<typeof meta>;
const section = (heading: string): string => {
  const b = body();
  const start = b.indexOf(`\n## ${heading}\n`);
  expect(start, `## ${heading}`).toBeGreaterThan(-1);
  const next = b.indexOf('\n## ', start + 5);
  return b.slice(start, next === -1 ? undefined : next);
};
const bundles = (): Record<string, { skills?: string[] }> => (JSON.parse(fs.readFileSync(path.resolve('registry/bundles.json'), 'utf8')) as { bundles: Record<string, { skills?: string[] }> }).bundles;
const tableRow = (role: string): string => nativeText(role).split('\n').find(l => l.startsWith('|') && l.split('|')[2]?.trim() === `\`${SKILL}\``) ?? '';

describe('the skill: what it is and where it lives', () => {
  it('is an original in-house skill laid out like the others: the seven headings, every supporting file referenced and present, evals', () => {
    expect(meta().name).toBe(SKILL);
    expect(meta().metadata.author).toBe('agents-united');
    expect(meta().metadata.source, 'original work carries no source').toBeUndefined();
    for (const rel of ['references/dimensions.md', 'references/severity.md', 'references/scanning-without-a-shell.md', 'assets/audit-report-template.md', 'examples/worked-example.md', 'scripts/audit-assets.mjs', 'evals/evals.json']) {
      expect(fs.existsSync(path.join(DIR, rel)), rel).toBe(true);
      if (!rel.startsWith('evals/')) expect(body(), `SKILL.md mentions ${rel}`).toContain(rel);
    }
    expect(fs.existsSync(path.resolve('tests/fixtures/laid-out-skills', SKILL))).toBe(true);
  });

  it('leads with the use case, gives trigger phrases, says it reports and never edits, and says when to skip it', () => {
    const d = meta().description.replace(/\s+/g, ' ');
    expect(d).toMatch(/^Use when /);
    expect(d).toMatch(/trigger phrases:/);
    for (const phrase of ['is this on brand', 'brand audit', 'brand drift', 'wrong logo usage']) expect(d, phrase).toContain(phrase);
    expect(d).toMatch(/reports and never edits/);
    expect(d).toMatch(/\bSkip it when\b/);
    for (const other of ['brand-identity', 'accessibility-audit', 'Defne']) expect(d, other).toContain(other);
    expect(d.length).toBeLessThanOrEqual(1024);
  });

  it('names no tool of another host, runs its one script through CLAUDE_SKILL_DIR, and gives the roles without a shell the Grep recipes', () => {
    for (const token of ['write_to_file', 'view_file', 'run_command', 'ArtifactMetadata', 'agent-embed', 'generate_image']) expect(skill(), token).not.toContain(token);
    expect(fs.readdirSync(path.join(DIR, 'scripts'))).toEqual(['audit-assets.mjs']);
    expect(body()).toContain('${CLAUDE_SKILL_DIR}/scripts/audit-assets.mjs');
    expect(read('references/scanning-without-a-shell.md')).toMatch(/#\[0-9a-fA-F\]\{3,8\}\\b/);
  });

  it('is carried by the digital-agency bundle and the full suite, and loaded from the creative designer\'s and the front-end architect\'s tables', () => {
    expect(bundles()['digital-agency']!.skills).toContain(SKILL);
    expect(bundles().full!.skills).toContain(SKILL);
    expect(tableRow('agency-creative-designer')).toMatch(/on brand|brand/i);
    expect(tableRow('agency-frontend-architect')).toMatch(/brand|tokens/i);
  });

  it('points only to skills that exist', () => {
    const named = [...new Set([...body().matchAll(/`([a-z][a-z0-9]*(?:-[a-z0-9]+)+)`/g)].map(m => m[1]!))];
    for (const name of ['brand-identity', 'design-system-tokens', 'accessibility-audit', 'color-theory']) expect(named, name).toContain(name);
    for (const n of named.filter(x => !/^(audit-assets|mjs)/.test(x))) expect(fs.existsSync(path.resolve('registry/skills', n, 'SKILL.md')), `${n} exists`).toBe(true);
  });
});

describe('the runbook teaches an audit that can be trusted', () => {
  const runbook = (): string => section('Step-by-Step Runbook');

  it('audits against what the brand states, marks the gaps, and stops when nothing is stated', () => {
    const r = runbook();
    expect(r).toMatch(/Fix the source of truth and mark its gaps/);
    expect(r).toMatch(/"not stated": audit nothing against it/);
    expect(r).toMatch(/Nothing stated at all: stop and hand off to `brand-identity`/);
  });

  it('counts by listing: the inventory is a list and the counts come from the table, never from memory', () => {
    const r = runbook();
    expect(r).toMatch(/write the list, then count it/);
    expect(r).toMatch(/Count by listing/);
    expect(r).toMatch(/never from memory/);
    expect(skill()).toMatch(/A count from memory \("about ten"\): list the items, then count them/);
  });

  it('scans what a scan can see with the script or with Grep, and looks at what it cannot see, saying what a downscaled copy hid', () => {
    const r = runbook();
    expect(r).toMatch(/Scan what a scan can see/);
    expect(r).toMatch(/--copy <copy file>/);
    expect(r).toMatch(/Look at what a scan cannot see/);
    expect(r).toMatch(/downscaled copy/);
  });

  it('writes each finding with its rule and the rule\'s source, keeps suggestions apart, and fixes nothing', () => {
    const r = runbook();
    expect(r).toMatch(/the rule and its source/);
    expect(r).toMatch(/A finding with no stated rule is a suggestion: list it apart/);
    expect(r).toMatch(/Fix nothing yourself/);
    expect(skill()).toMatch(/Fixing while auditing/);
  });

  it('hands off: claims to Defne, copy to Kaan, token drift to the token skill, contrast to the colour skill and Emre', () => {
    const r = runbook();
    for (const target of ['Defne', 'Kaan', '`design-system-tokens`', '`color-theory`', 'Emre']) expect(r, target).toContain(target);
  });

  it('keeps a conflict between sources, an approved exception and a sample honest', () => {
    const e = section('Edge Cases & Error Recovery');
    expect(e).toMatch(/report the conflict with both sources; do not pick one/);
    expect(e).toMatch(/record who approved it; it is not a finding/);
    expect(e).toMatch(/never call the sample the set/);
  });
});

describe('the references, the template, the example and the evals', () => {
  it('has a dimension table, a severity table with owners, and a rule that one blocker decides', () => {
    expect(read('references/dimensions.md')).toMatch(/\| Dimension \| The rule lives in \|/);
    const s = read('references/severity.md');
    for (const sev of ['Blocker', 'Major', 'Minor', 'Suggestion']) expect(s, sev).toContain(`| ${sev} |`);
    expect(s).toMatch(/never average severities/);
    expect(s).toMatch(/## Owners/);
  });

  it('has a report template with the counts and the not-checked sections', () => {
    const t = read('assets/audit-report-template.md');
    for (const h of ['## Findings', '## Suggestions', '## Approved exceptions', '## Counts', '## Not checked', '## Hand-offs']) expect(t, h).toContain(h);
  });

  it('has a worked example whose findings are the ones the script finds on the fixture set, and whose counts are right', async () => {
    const w = read('examples/worked-example.md');
    expect(w).toMatch(/worked example/i);
    const lib = (await import(pathToFileURL(path.join(DIR, 'scripts/audit-assets.mjs')).href)) as {
      audit: (o: { tokensFile: string; folder: string; copyFile?: string }) => { scanned: string[]; checked: { colours: number; fonts: number; strings: number }; findings: Array<{ file: string; line: number; type: string; value: string }> };
    };
    const report = lib.audit({ tokensFile: path.resolve('tests/fixtures/designer/design-tokens.json'), folder: path.resolve('tests/fixtures/brand-audit/flawed-set'), copyFile: path.resolve('tests/fixtures/designer/hero.ts') });
    const rows = [...w.matchAll(/^\| \d+ \| ([\w.]+:\d+) \| (\w+) \| `([^`]+)`.*?\| (blocker|major|minor) \|/gm)].map(m => ({ where: m[1]!, dim: m[2]!, found: m[3]!, severity: m[4]! }));
    const expected = report.findings.map(f => ({ where: `${f.file}:${f.line}`, found: f.value }));
    expect(rows.map(r => ({ where: r.where, found: r.found })).sort((a, b) => a.where.localeCompare(b.where) || a.found.localeCompare(b.found)))
      .toEqual(expected.sort((a, b) => a.where.localeCompare(b.where) || a.found.localeCompare(b.found)));
    const count = (sev: string): number => rows.filter(r => r.severity === sev).length;
    expect(count('major')).toBe(4);
    expect(count('minor')).toBe(2);
    expect(w).toContain(`read ${report.checked.colours} colours, ${report.checked.fonts} fonts and ${report.checked.strings} strings`);
    expect(w).toContain(`Findings: ${report.findings.length} (major 4, minor 2); by dimension: colour 4, type 1, copy 1`);
    expect(w).toContain(`Assets checked: ${report.scanned.length}`);
  });

  it('has evals for a set to audit, no source of truth, an approved exception with a request to fix, and two sources that disagree', () => {
    const e = JSON.parse(read('evals/evals.json')) as { skill_name: string; evals: Array<{ id: number; prompt: string; expected_output: string }> };
    expect(e.skill_name).toBe(SKILL);
    expect(e.evals.length).toBeGreaterThanOrEqual(4);
    const prompts = e.evals.map(x => x.prompt).join('\n');
    expect(prompts).toMatch(/on brand/i);
    expect(prompts).toMatch(/no brand guidelines/i);
    expect(prompts).toMatch(/fix whatever is off-brand/i);
    expect(prompts).toMatch(/guidelines PDF/i);
    for (const x of e.evals) expect(x.expected_output.length, `eval ${x.id}`).toBeGreaterThan(80);
  });
});

describe('the catalog records', () => {
  it('records the skill as in-house and in the audit table', () => {
    const prov = JSON.parse(fs.readFileSync(path.resolve('host-library/_upstream/skills.json'), 'utf8')) as { skills: Record<string, { provenance: string }> };
    expect(prov.skills[SKILL]?.provenance).toBe('in-house');
    expect(fs.readFileSync(path.resolve('docs/skill-quality/digital-agency-audit.md'), 'utf8')).toMatch(/\| `brand-consistency-audit` \| Jamileh/);
  });
});
