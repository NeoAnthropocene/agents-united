import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { describe, expect, it } from 'vitest';
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
    expect(d.length).toBeLessThanOrEqual(1024);
  });

  it('names no tool of another host, and no script: the role that loads it has no shell', () => {
    for (const token of ['write_to_file', 'view_file', 'run_command', 'ArtifactMetadata', 'agent-embed', 'generate_image']) expect(skill(), token).not.toContain(token);
    expect(fs.existsSync(path.join(DIR, 'scripts'))).toBe(false);
  });

  it('is carried by the digital-agency bundle and loaded from the creative designer\'s table, for a Claude Design canvas or brand book', () => {
    const bundles = JSON.parse(fs.readFileSync(path.resolve('registry/bundles.json'), 'utf8')) as { bundles: Record<string, { skills?: string[] }> };
    expect(bundles.bundles['digital-agency']!.skills).toContain(SKILL);
    const row = nativeText('agency-creative-designer').split('\n').find(l => l.startsWith('|') && l.split('|')[2]?.trim() === `\`${SKILL}\``) ?? '';
    expect(row).not.toBe('');
    expect(row).toMatch(/Claude Design/);
  });
});

describe('the runbook teaches the rules that P3 showed she skips', () => {
  const runbook = (): string => section('Step-by-Step Runbook');

  it('publishes only when asked, keeps the artifact private and never changes sharing', () => {
    expect(section('Execution Triggers')).toMatch(/asks for a Claude Design/);
    expect(runbook()).toMatch(/must have asked for a Claude Design artifact/);
    expect(runbook()).toMatch(/Keep it private and never change sharing/);
    expect(section('Execution Triggers')).toMatch(/Share menu/);
    expect(section('Edge Cases & Error Recovery')).toMatch(/delete or share[\s\S]*not yours/i);
  });

  it('loads the placement and token skills before building, and follows the type\'s own instructions rather than memory', () => {
    const r = runbook();
    expect(r).toMatch(/Load the skills that hold the rules before you build/);
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
    expect(r).toMatch(/`read`/);
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

  it('has evals for a canvas, a design system, a request to share and a missing tool, each with a prompt and an expected output', () => {
    const e = JSON.parse(read('evals/evals.json')) as { skill_name: string; evals: Array<{ id: number; prompt: string; expected_output: string }> };
    expect(e.skill_name).toBe(SKILL);
    expect(e.evals.length).toBeGreaterThanOrEqual(4);
    const prompts = e.evals.map(x => x.prompt).join('\n');
    expect(prompts).toMatch(/canvas/i);
    expect(prompts).toMatch(/design system/i);
    expect(prompts).toMatch(/share/i);
    expect(prompts).toMatch(/no Artifact tool|without the Artifact tool|Artifact tool is not/i);
    for (const x of e.evals) expect(x.expected_output.length, `eval ${x.id}`).toBeGreaterThan(80);
  });
});
