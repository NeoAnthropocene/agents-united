import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import YAML from 'yaml';
import { describe, expect, it } from 'vitest';
import { nativeText } from './helpers/native-roles.js';

/**
 * Plan 036 S15, `color-theory` (the maintainer's answer to Q9: write it in-house, with the Owl-Listener `color-system` skill as help).
 * Nothing in the catalog decided a palette: `design-system-tokens` writes the file once the colours are fixed, `accessibility-audit`
 * measures the built page, `brand-identity` keeps the guidelines. This skill is the decision before them: roles before hues, a harmony
 * chosen by intent, a tonal scale built by lightness steps, every pair proved with a ratio that says where it came from, and the
 * places colour breaks (a photo, a gradient, dark mode, print). It reuses what the catalog has instead of copying it: the formula and
 * the neutral table stay in `design-system-tokens`, the measuring script in `accessibility-audit`; its own script is the one thing
 * that was missing, the scale. It is written in the project's own words (ADR 0040 decision 6): no `metadata.source`, a credit in the README.
 */

const SKILL = 'color-theory';
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
  it('is an original in-house skill laid out like the others: front matter, the seven headings, every supporting file referenced and present, evals', () => {
    expect(meta().name).toBe(SKILL);
    expect(meta().metadata.author).toBe('agents-united');
    expect(meta().metadata.source, 'original work carries no source').toBeUndefined();
    for (const rel of ['references/contrast.md', 'references/roles-and-harmony.md', 'references/tonal-scales.md', 'references/hue-families.md', 'references/modes-and-media.md', 'assets/palette-worksheet.md', 'examples/worked-example.md', 'scripts/palette.mjs', 'evals/evals.json']) {
      expect(fs.existsSync(path.join(DIR, rel)), rel).toBe(true);
      if (!rel.startsWith('evals/')) expect(body(), `SKILL.md mentions ${rel}`).toContain(rel);
    }
    expect(fs.existsSync(path.resolve('tests/fixtures/laid-out-skills', SKILL)), 'listed in laid-out-skills, so skill-layout.test.ts holds it to the layout').toBe(true);
  });

  it('leads with the use case, gives trigger phrases and says when to skip it', () => {
    const d = meta().description.replace(/\s+/g, ' ');
    expect(d).toMatch(/^Use when /);
    expect(d).toMatch(/trigger phrases:/);
    for (const phrase of ['colour palette', 'contrast ratio', 'tints and shades', 'CTA colour', 'dark mode colours']) expect(d, phrase).toContain(phrase);
    expect(d).toMatch(/\bSkip it when\b/);
    expect(d).toMatch(/design-system-tokens/);
    expect(d.length).toBeLessThanOrEqual(1024);
  });

  it('names no tool of another host and no `!` injection, and runs its one script through CLAUDE_SKILL_DIR, with the formula and the starting scales for the roles that have no shell', () => {
    for (const token of ['write_to_file', 'view_file', 'run_command', 'ArtifactMetadata', 'agent-embed', 'generate_image']) expect(skill(), token).not.toContain(token);
    expect(fs.readdirSync(path.join(DIR, 'scripts'))).toEqual(['palette.mjs']);
    expect(body()).toContain('${CLAUDE_SKILL_DIR}/scripts/palette.mjs');
    expect(read('references/contrast.md')).toMatch(/\(L lighter \+ 0\.05\) \/ \(L darker \+ 0\.05\)/);
    expect(body()).toMatch(/Without one|without one/);
  });

  it('is carried by the digital-agency bundle and the full suite, and loaded from the creative designer\'s and the front-end architect\'s tables', () => {
    expect(bundles()['digital-agency']!.skills).toContain(SKILL);
    expect(bundles().full!.skills).toContain(SKILL);
    expect(tableRow('agency-creative-designer')).toMatch(/palette|colour pair/i);
    expect(tableRow('agency-frontend-architect')).toMatch(/colour|contrast/i);
  });

  it('points only to skills that exist, and does not copy what they hold', () => {
    const named = [...new Set([...body().matchAll(/`([a-z][a-z0-9]*(?:-[a-z0-9]+)+)`/g)].map(m => m[1]!))].filter(n => fs.existsSync(path.resolve('registry/skills', n)) || /^(design|brand|accessibility|ad|frontend)-/.test(n));
    for (const name of ['design-system-tokens', 'accessibility-audit', 'brand-identity']) expect(named, name).toContain(name);
    for (const n of named) expect(fs.existsSync(path.resolve('registry/skills', n, 'SKILL.md')), `${n} exists`).toBe(true);
    expect(fs.existsSync(path.join(DIR, 'scripts', 'contrast.mjs')), 'the measuring script is accessibility-audit\'s, not a second copy').toBe(false);
  });
});

describe('the runbook teaches the decisions, not the arithmetic', () => {
  const runbook = (): string => section('Step-by-Step Runbook');

  it('starts from a seed and the job, and never changes the seed', () => {
    expect(runbook()).toMatch(/Fix the seed and the job/);
    expect(runbook()).toMatch(/Never change the seed: build around it/);
    expect(runbook()).toMatch(/ask the lead for a seed rather than guess/);
  });

  it('names the roles before the hues, keeps the palette small, and weights it 60, 30, 10', () => {
    const r = runbook();
    expect(r).toMatch(/Name the roles before the hues/);
    for (const role of ['ground', 'text', 'muted text', 'brand', 'accent', 'semantic', 'overlay']) expect(r, role).toContain(role);
    expect(r).toMatch(/Six to eight colours/);
    expect(r).toMatch(/60 ground, 30 brand, 10 accent/);
  });

  it('picks the harmony by intent and builds the scale by equal lightness steps in OKLCH, not by mixing with white or black', () => {
    const r = runbook();
    expect(r).toMatch(/Pick the harmony by intent/);
    for (const scheme of ['analogous', 'complementary', 'split-complementary']) expect(r, scheme).toContain(scheme);
    expect(r).toMatch(/equal lightness steps in OKLCH/);
    expect(r).toMatch(/not by mixing with white or black/);
  });

  it('proves every pair that will meet, with the thresholds, and says "by hand" when no script ran', () => {
    const r = runbook();
    expect(r).toMatch(/Prove every pair that will meet/);
    expect(r).toMatch(/text 4\.5 to 1/);
    expect(r).toMatch(/large text \(24 px, or 19 px bold\)/);
    expect(r).toMatch(/icons and interface boundaries 3 to 1/);
    expect(r).toMatch(/write "by hand" beside the figure/);
    expect(section('Input/Output Requirements')).toMatch(/how it was computed \(script or by hand\)/);
  });

  it('checks where colour breaks: a photo, a gradient, dark mode, print and colour vision', () => {
    const r = runbook();
    expect(r).toMatch(/Check where colour breaks/);
    for (const place of ['text on a photo', 'a gradient', 'dark mode', 'print', 'red from green']) expect(r, place).toContain(place);
  });

  it('reports with the ratio sources, what was not checked and the hand-offs to the token skill and to Emre', () => {
    const r = runbook();
    expect(r).toMatch(/each ratio with its source/);
    expect(r).toMatch(/what was not checked/);
    expect(r).toMatch(/hand-offs: tokens to `design-system-tokens`, the contrast gate to Emre/);
  });

  it('refuses the habits that cost contrast, meaning and the call to action, each with its reason', () => {
    const s = skill();
    for (const anti of ['Pure `#000` text on pure `#fff`', 'Two high-chroma complements side by side', 'Muted grey text on a coloured ground', 'Meaning by hue alone', 'One accent for the call to action and for decoration', 'A scale made by mixing with white', 'A figure without a source']) expect(s, anti).toContain(anti);
  });

  it('keeps the brand colour, hands token fixes to the token skill, and says what to do without a shell', () => {
    const e = section('Edge Cases & Error Recovery');
    expect(e).toMatch(/do not alter the brand colour/);
    expect(e).toMatch(/hand off to `design-system-tokens`/);
    expect(e).toMatch(/No shell/);
    expect(e).toMatch(/ask for a proof/);
  });
});

describe('the references, the template, the example and the evals', () => {
  it('gives the contrast thresholds with their criteria, the exemptions, the formula and the cases with no single ratio', () => {
    const c = read('references/contrast.md');
    for (const fact of [/1\.4\.3/, /1\.4\.11/, /1\.4\.6/, /1\.4\.1/, /logotype/i, /4\.499 fails 4\.5/, /#767676/, /0\.04045/, /text on a photo/i, /gradient/i, /translucent/i]) expect(c).toMatch(fact);
  });

  it('gives the roles, the harmony table with hue offsets, the temperature caveat and what an ad needs', () => {
    const r = read('references/roles-and-harmony.md');
    for (const fact of [/\| Role \|/, /\| Scheme \|/, /\+180/, /\+150/, /\+120/, /60.*30.*10/s, /vary by culture/i, /call to action/i]) expect(r).toMatch(fact);
  });

  it('gives the lightness curve of the scale and the rule for the text steps', () => {
    const t = read('references/tonal-scales.md');
    for (const fact of [/\| 50 \| 0\.97 \|/, /\| 950 \| 0\.22 \|/, /relative saturation/i, /600/, /tinted neutral/i]) expect(t).toMatch(fact);
  });

  it('has a worksheet to fill in and a worked example in which every ratio is the computed one', async () => {
    expect(read('assets/palette-worksheet.md')).toMatch(/## Pairs/);
    const w = read('examples/worked-example.md');
    expect(w).toMatch(/worked example/i);
    expect(w).toMatch(/Not checked/);
    const lib = (await import(pathToFileURL(path.join(DIR, 'scripts/palette.mjs')).href)) as { contrastRatio: (a: string, b: string) => number };
    const rows = [...w.matchAll(/\|\s*(#[0-9A-Fa-f]{6})\s*\|\s*(#[0-9A-Fa-f]{6})\s*\|\s*(\d+\.\d\d)\s*\|/g)];
    expect(rows.length, 'the example has pairs with ratios').toBeGreaterThanOrEqual(8);
    for (const [, fg, bg, ratio] of rows) expect(lib.contrastRatio(fg!, bg!).toFixed(2), `${fg} on ${bg}`).toBe(ratio);
  });

  it('has evals for a palette from a seed, a failing pair, a dark variant and text over a photo', () => {
    const e = JSON.parse(read('evals/evals.json')) as { skill_name: string; evals: Array<{ id: number; prompt: string; expected_output: string }> };
    expect(e.skill_name).toBe(SKILL);
    expect(e.evals.length).toBeGreaterThanOrEqual(4);
    const prompts = e.evals.map(x => x.prompt).join('\n');
    expect(prompts).toMatch(/palette/i);
    expect(prompts).toMatch(/fail|pass/i);
    expect(prompts).toMatch(/dark/i);
    expect(prompts).toMatch(/photo/i);
    for (const x of e.evals) expect(x.expected_output.length, `eval ${x.id}`).toBeGreaterThan(80);
  });
});

describe('the catalog records', () => {
  it('records the skill as in-house, credits the Owl-Listener skill as inspiration with the commit read, and counts it', () => {
    const prov = JSON.parse(fs.readFileSync(path.resolve('host-library/_upstream/skills.json'), 'utf8')) as { skills: Record<string, { provenance: string }> };
    expect(prov.skills[SKILL]?.provenance).toBe('in-house');
    const readme = fs.readFileSync(path.resolve('README.md'), 'utf8').replace(/\r\n/g, '\n');
    expect(readme).toMatch(/Owl-Listener\/designer-skills/);
    expect(readme).toMatch(/9a6930c/);
    expect(readme).toMatch(/color-system/);
    const audit = fs.readFileSync(path.resolve('docs/skill-quality/digital-agency-audit.md'), 'utf8');
    expect(audit).toMatch(/\| `color-theory` \| Jamileh/);
  });
});
