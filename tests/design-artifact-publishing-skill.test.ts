import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { describe, expect, it } from 'vitest';
import { HOLDER_STEMS } from './helpers/artifact-holders.js';
import { nativeText } from './helpers/native-roles.js';

/**
 * Plan 036 S11, the Design artifact skill (the maintainer's answer to Q8 after probe P3: "we should add skills that teach how to
 * use Design Artifact of Claude", then test again). P3 showed what she gets wrong without it: she skipped the skill that holds the
 * placement rule, read nothing back, wrote a round time she was not given, miscounted her own report and put inferences in a
 * brand book under a sentence that denied them. The skill teaches those rules, not the vendor's format, which she reads live
 * through the type's own instructions. It is a canonical skill whose description says "Claude Code only" (the registry has no
 * host-only skill lane; `mcp-setup` is the precedent), carried by the digital-agency bundle and loaded from her table.
 */

const SKILL = 'design-artifact-publishing';
const DIR = path.resolve('registry/skills', SKILL);
const read = (rel: string): string => fs.readFileSync(path.join(DIR, rel), 'utf8').replace(/\r\n/g, '\n');
const skill = (): string => read('SKILL.md');
const body = (): string => skill().replace(/^---\n[\s\S]*?\n---\n/, '');
const meta = (): { name: string; description: string; metadata: { author: string; version: string }; [k: string]: unknown } =>
  YAML.parse(/^---\n([\s\S]*?)\n---/.exec(skill())![1]!) as ReturnType<typeof meta>;
const section = (heading: string): string => {
  const b = body();
  const start = b.indexOf(`\n## ${heading}\n`);
  expect(start, `## ${heading}`).toBeGreaterThan(-1);
  const next = b.indexOf('\n## ', start + 5);
  return b.slice(start, next === -1 ? undefined : next);
};

describe('the skill: what it is and where it lives', () => {
  it('is an in-house skill with the layout of the others: front matter, the seven headings, links that resolve, evals', () => {
    expect(meta().name).toBe(SKILL);
    expect(meta().metadata.author).toBe('agents-united');
    for (const rel of ['references/claude-design.md', 'references/publish-and-read-back.md', 'examples/worked-example.md', 'evals/evals.json']) {
      expect(fs.existsSync(path.join(DIR, rel)), rel).toBe(true);
    }
    for (const link of body().matchAll(/\]\(((?:examples|references)\/[^)#\s]+)\)/g)) expect(fs.existsSync(path.join(DIR, link[1]!)), link[1]).toBe(true);
    expect(fs.existsSync(path.resolve('tests/fixtures/laid-out-skills', SKILL)), 'listed in laid-out-skills, so skill-layout.test.ts holds it to the layout').toBe(true);
  });

  it('says in its description that it is for Claude Code and the Artifact tool, gives trigger phrases and says when to skip it', () => {
    const d = meta().description.replace(/\s+/g, ' ');
    expect(d).toMatch(/^Use when /);
    expect(d).toMatch(/Claude Design/);
    expect(d).toMatch(/Artifact tool/);
    expect(d).toMatch(/Claude Code only/);
    expect(d).toMatch(/trigger phrases:/);
    expect(d).toMatch(/\bskip\b/i);
    expect(d).toMatch(/Slides/);
    expect(d.length).toBeLessThanOrEqual(1024);
  });

  it('names no tool of another host, and no script: the role that loads it has no shell', () => {
    for (const token of ['write_to_file', 'view_file', 'run_command', 'ArtifactMetadata', 'agent-embed', 'generate_image']) expect(skill(), token).not.toContain(token);
    expect(fs.existsSync(path.join(DIR, 'scripts'))).toBe(false);
  });

  it('is carried by every Bundle that has a holder (ADR 0077) and loaded from the creative designer\'s table, for a Claude Design canvas or brand book', () => {
    const bundles = JSON.parse(fs.readFileSync(path.resolve('registry/bundles.json'), 'utf8')) as { bundles: Record<string, { skills?: string[]; agents?: string[]; orchestrator?: string }> };
    const withHolder = Object.entries(bundles.bundles).filter(([, bundle]) =>
      [...(bundle.agents ?? []), ...(bundle.orchestrator ? [bundle.orchestrator] : [])].some(agent => HOLDER_STEMS.includes(agent.replace(/\.md$/, ''))),
    );
    expect(withHolder.length, 'Bundles that contain a holder role or a holder lead').toBeGreaterThanOrEqual(16);
    for (const [name, bundle] of withHolder) expect(bundle.skills, name).toContain(SKILL);
    const row = nativeText('agency-creative-designer').split('\n').find(l => l.startsWith('|') && l.split('|')[2]?.trim() === `\`${SKILL}\``) ?? '';
    expect(row).not.toBe('');
    expect(row).toMatch(/Claude Design/);
  });
});

describe('the runbook teaches the rules that P3 showed she skips', () => {
  const runbook = (): string => section('Step-by-Step Runbook');

  it('publishes only when asked, keeps the artifact private and never changes sharing', () => {
    expect(section('Execution Triggers')).toMatch(/asks for a Claude Design/);
    expect(runbook()).toMatch(/the user's go-ahead for that page/);
    expect(runbook()).toMatch(/needs no new go-ahead/);
    expect(runbook()).toMatch(/Keep it private and never change sharing/);
    expect(section('Execution Triggers')).toMatch(/Share control/);
    expect(section('Execution Triggers')).not.toMatch(/Share menu/);
    expect(runbook()).toMatch(/the files stand/);
    expect(section('Edge Cases & Error Recovery')).toMatch(/delete or share[\s\S]*not yours/i);
  });

  it('loads the placement and token skills before building, and follows the type\'s own instructions rather than memory', () => {
    const r = runbook();
    expect(r).toMatch(/Load the skills that hold the rules before you build/);
    expect(r).toMatch(/when the page is a design/);
    for (const name of ['ad-creative-design', 'design-system-tokens', 'brand-identity']) expect(r, name).toContain(`\`${name}\``);
    expect(r).toMatch(/type's own instructions/);
    expect(r).toMatch(/not from memory/);
    expect(r).toMatch(/no other design system/i);
  });

  it('builds everything locally and publishes once', () => {
    expect(runbook()).toMatch(/Build everything locally, then publish once/);
    expect(skill()).toMatch(/Publishing after every board/);
  });

  it('keeps to the source: copy verbatim, token colours only, claims to Defne, inferences written as inferred, no time she was not given', () => {
    const r = runbook();
    expect(r).toMatch(/word for word/);
    expect(r).toMatch(/only token colours/);
    expect(r).toMatch(/Defne/);
    expect(r).toMatch(/written as inferred/);
    expect(r).toMatch(/T00:00:00Z/);
    expect(r).toMatch(/placeholder/);
    expect(skill()).toMatch(/`12:00:00Z`/);
  });

  it('reads back what she published, with the list and read calls, and counts instead of estimating', () => {
    const r = runbook();
    expect(r).toMatch(/Read back what you published/);
    expect(r).toMatch(/`list`/);
    expect(r).toMatch(/`read` each one you wrote/);
    expect(r).toMatch(/count/);
    expect(r).toMatch(/recompute any contrast figure/);
    expect(skill()).toMatch(/11 of 12/);
  });

  it('reports what was not checked, and sends the render ask to the lead because she cannot look', () => {
    const r = runbook();
    expect(r).toMatch(/not rendered/);
    expect(r).toMatch(/platform specs/);
    expect(r).toMatch(/render ask to the lead/);
    expect(section('Verification Checklist')).toMatch(/says what was not checked/);
  });

  it('falls back to files when the tool is missing, and reads before editing a canvas the user changed', () => {
    const e = section('Edge Cases & Error Recovery');
    expect(e).toMatch(/tool is missing or denied/);
    expect(e).toMatch(/write the files/);
    expect(e).toMatch(/do not retry in a loop/);
    expect(e).toMatch(/re-saves it; read it back before you change it/);
  });
});

describe('the references, the example and the evals', () => {
  it('keeps the observations dated and sourced, and defers to the vendor\'s own instructions where they differ', () => {
    const r = read('references/claude-design.md');
    expect(r).toMatch(/observations of Claude Code 2\.1\.294/i);
    expect(r).toMatch(/2026-10-08/);
    expect(r).toMatch(/designer-p3-artifact-probe/);
    expect(r).toMatch(/win where they differ/);
    for (const fact of [/Pro or higher plan/, /CLAUDE_CODE_ARTIFACT_AUTO_OPEN=0/, /canvas\.json/, /\.dc\.html/, /tokens\.json/, /Cover\/preview\.html/, /re-serialised/]) expect(r).toMatch(fact);
  });

  it('gives the read-back as a table of checks and the report as a skeleton', () => {
    const r = read('references/publish-and-read-back.md');
    for (const check of ['Files', 'Sizes', 'Boards', 'Colours', 'Copy', 'Tokens', 'Contrast', 'Zones']) expect(r, check).toMatch(new RegExp(`\\| ${check} \\|`));
    expect(r).toMatch(/## The report/);
    expect(r).toMatch(/Private; sharing untouched/);
  });

  it('has a worked example with a read-back table and a report', () => {
    const w = read('examples/worked-example.md');
    expect(w).toMatch(/worked example/i);
    expect(w).toMatch(/\| File \| Bytes \|/);
    expect(w).toMatch(/Not checked/);
  });

  it('has exactly five evals, each with a prompt and an expected output, pinned by a distinctive phrase each (ADR 0077)', () => {
    const e = JSON.parse(read('evals/evals.json')) as { skill_name: string; evals: Array<{ id: number; prompt: string; expected_output: string }> };
    expect(e.skill_name).toBe(SKILL);
    expect(e.evals.map(x => x.id)).toEqual([1, 2, 3, 4, 5]);
    for (const x of e.evals) expect(x.expected_output.length, 'eval ' + x.id).toBeGreaterThan(80);
    const [bundled, canvas, deck, update, declined] = e.evals as [typeof e.evals[number], typeof e.evals[number], typeof e.evals[number], typeof e.evals[number], typeof e.evals[number]];
    // 1: the bundled design skill is in the list and the brief carries the go-ahead (new)
    expect(bundled.prompt).toMatch(/list of (?:available )?skills/i);
    expect(bundled.prompt).toMatch(/go-ahead/i);
    expect(bundled.expected_output).toMatch(/invokes `design` through `Skill`/);
    expect(bundled.expected_output).toContain('writes the files');
    expect(bundled.expected_output).toContain('If the call fails');
    expect(bundled.expected_output).toMatch(/private/);
    // 2: the bundled skill is not in the list: the PetPal canvas through the Design type (old case 1, adapted)
    expect(canvas.prompt).toMatch(/PetPal paid-social set/);
    expect(canvas.prompt).toMatch(/approved publishing it as a private page/);
    expect(canvas.expected_output).toMatch(/Design type/);
    expect(canvas.expected_output).toMatch(/ad-creative-design/);
    expect(canvas.expected_output).toMatch(/list` and `read/);
    // 3: a deck through the Slides type, and a request to share it (new; takes over the old share case)
    expect(deck.prompt).toMatch(/deck/i);
    expect(deck.prompt).toMatch(/share/i);
    expect(deck.prompt).toMatch(/does not show `slides`/);
    expect(deck.expected_output).toMatch(/Slides type/);
    expect(deck.expected_output).toMatch(/does not share|sharing is the user's own act/);
    // 4: an update of the approved design system after a token change (new; takes over the old design-system case)
    expect(update.prompt).toMatch(/design system/i);
    expect(update.prompt).toMatch(/token/i);
    expect(update.expected_output).toMatch(/no new question/i);
    expect(update.expected_output).toMatch(/same link/i);
    expect(update.expected_output).toMatch(/reads the page back/i);
    // 5: no go-ahead: files only (new; replaces the old missing-tool case, whose rule stays pinned in the Edge Cases test above)
    expect(declined.prompt).toMatch(/one-pager/i);
    expect(declined.prompt).toMatch(/Keep it in the project/);
    expect(declined.expected_output).toMatch(/files only/i);
    expect(declined.expected_output).toMatch(/publishes nothing/i);
    expect(declined.expected_output).toMatch(/why there is no page/i);
    expect(declined.expected_output).toContain('`ask-user` entry');
  });
});

describe('the skill for every holder, for decks and for the go-ahead of each page (ADR 0077)', () => {
  const REF = 'references/pages-decks-and-the-design-skill.md';
  const CONDITION = 'If the list of skills available to you shows';

  it('says it is for any role that holds the Artifact tool, and still triggers on a Claude Design ask, a deck and a one-pager', () => {
    expect(section('Overview & Purpose')).toContain('any role that holds the `Artifact` tool');
    expect(section('Execution Triggers')).toMatch(/asks for a Claude Design/);
    expect(section('Execution Triggers')).toMatch(/deck/);
    expect(section('Execution Triggers')).toMatch(/one-pager/);
  });

  it('has a reference file for pages, decks and the bundled design skill, linked from SKILL.md', () => {
    expect(fs.existsSync(path.join(DIR, REF)), REF).toBe(true);
    expect(body()).toContain(REF);
    expect(body()).toMatch(/\]\(references\/pages-decks-and-the-design-skill\.md\)/);
  });

  it('states in that reference the condition for the bundled skill, the fallbacks, the update rule, the limits of what is known and the dated sources', () => {
    const r = read(REF);
    for (const phrase of [
      CONDITION + ' `design`',
      '`slides`',
      'not established',
      '2026-11-21',
      '`/design consent`',
      'Slides type',
      'HTML page',
      'the URL of a page the user already approved',
      'runtime capabilities',
      'v2.1.281',
      'A new artifact is visible only to you',
      'MCP-server contexts',
      'If the call fails',
      'does not offer the type you need',
      'Write the files in the project first',
    ]) {
      expect(r, phrase).toContain(phrase);
    }
    // These two begin a bullet now, so they are pinned without regard to the case of the first letter.
    expect(r.toLowerCase()).toContain('never ask for `/design-login` or `/design-sync`');
    expect(r.toLowerCase()).toContain('never delete or pin');
    expect(r).not.toContain('the URL that your brief names or that you published yourself');
    expect(r.split('\n').slice(0, 4).join('\n')).not.toContain('The host rules below are from the host documentation');
    const sentences = r.split(/(?<=[.!?])\s+/);
    expect(sentences.some(s => s.includes('Slides type') && s.includes('has been observed')), 'a sentence that says nothing about the files of the Slides type has been observed').toBe(true);
  });

  it('names the bundled skill design or slides next to the word invoke only under the condition on the list of skills', () => {
    const lines = (skill() + '\n' + read(REF)).split('\n').filter(line => /\binvoke\b/i.test(line) && /`(?:design|slides)`/.test(line));
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) expect(line, line.slice(0, 80)).toContain(CONDITION);
  });

  it('says in the edge cases that a bundled skill missing from the list is not an error, and in the checklist that the go-ahead for this page is checked', () => {
    expect(section('Edge Cases & Error Recovery')).toMatch(/not in your list/);
    expect(section('Edge Cases & Error Recovery')).toMatch(/not an error/);
    expect(section('Verification Checklist')).toMatch(/go-ahead for this page/);
  });

  it('is at version 1.1.0 or later', () => {
    const [major, minor] = meta().metadata.version.split('.').map(Number) as [number, number];
    expect(major > 1 || (major === 1 && minor >= 1), meta().metadata.version).toBe(true);
  });
});
