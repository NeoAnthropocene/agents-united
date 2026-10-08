import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Plan 036 S13 (written after S1 and S1b and before any run, so the rules are fixed beforehand): H10j asks whether a prototype
 * brief makes the creative designer load `generative-ui`, the skill written for Antigravity, on a build from before PRs 183 and 184,
 * and what she loads on a build with them. F1 is verified from her skill table and was never seen live. The section also says how
 * H10h and H10i are re-run on a real install once the Design artifact skill (S11) and the grant (S12) are in, and Sitting K carries
 * the proposed ceiling of all four prompts. The maintainer approves the ceiling before the first model call.
 */

const PROTOCOL = fs.readFileSync(path.resolve('docs/live-test-protocol.md'), 'utf8').replace(/\r\n/g, '\n');
const PROMPT =
  'Scratch exercise, no real client. Build an interface prototype of the PetPal booking screen that I can click through: a list of three sitters, each with a Book now button that opens a confirmation. Use `docs/pilot/design-tokens.json`, and write the prototype under `docs/pilot/prototype/`. No photography is supplied.';

const section = (): string => {
  const start = PROTOCOL.indexOf('\n## H10j ');
  expect(start, 'section H10j exists').toBeGreaterThan(-1);
  const next = PROTOCOL.indexOf('\n## ', start + 5);
  return PROTOCOL.slice(start, next === -1 ? undefined : next);
};
const sub = (heading: string): string => {
  const s = section();
  const marker = `\n### ${heading}\n`;
  const start = s.indexOf(marker);
  expect(start, `### ${heading}`).toBeGreaterThan(-1);
  const next = s.indexOf('\n### ', start + marker.length);
  return s.slice(start + marker.length, next === -1 ? undefined : next).trim();
};
const fence = (block: string): string => /```text\n([\s\S]*?)\n```/.exec(block)![1]!;

describe('H10j in the live-test protocol: the prototype brief, before and after S1 and S1b', () => {
  it('says when it was added, which finding it tests and which slice it belongs to', () => {
    expect(section()).toMatch(/added 2026-10-08/);
    expect(section()).toMatch(/F1/);
    expect(section()).toMatch(/S13/);
    expect(section()).toMatch(/never seen live/);
  });

  it('has a setup, the evidence, a prompt, a pass, a fail and a cost with a ceiling', () => {
    for (const heading of ['Setup', 'Evidence', 'Cost']) expect(section(), heading).toContain(`\n### ${heading}\n`);
    for (const part of ['H10j Prompt', 'H10j Pass', 'H10j Fail']) expect(sub(part).length, part).toBeGreaterThan(0);
    expect(sub('Cost')).toMatch(/--max-budget-usd 0\.8/);
    expect(sub('Cost')).toMatch(/not measured/i);
    expect(sub('Cost')).toMatch(/3\.2 USD and 4 prompts/);
    expect(sub('Cost')).toMatch(/proposed/i);
  });

  it('types the prompt exactly, short enough to paste', () => {
    expect(fence(sub('H10j Prompt'))).toBe(PROMPT);
    expect(PROMPT.length).toBeLessThan(2000);
  });

  it('sets up two fresh installs, one built before PRs 183 and 184 and one with them, and checks that generative-ui is there or not before each run', () => {
    const setup = sub('Setup');
    expect(setup).toContain('h10j-before');
    expect(setup).toContain('h10j-after');
    expect(setup).toMatch(/before PR 183 and PR 184/);
    expect(setup).toMatch(/with PR 183 and PR 184/);
    expect(setup).toMatch(/generative-ui/);
    expect(setup).toMatch(/same headless command/i);
    expect(section()).not.toContain('--dangerously-skip-permissions');
  });

  it('marks F1 by a rule fixed before the runs: a Skill call for generative-ui, or one of the three Antigravity names in a file or an answer', () => {
    const e = sub('Evidence');
    expect(e).toMatch(/F1/);
    expect(e).toMatch(/Seen if she loads `generative-ui`/);
    for (const name of ['<agent-embed>', 'ArtifactMetadata', 'write_to_file']) expect(e, name).toContain(name);
    expect(e).toMatch(/not seen otherwise/i);
  });

  it('says what a pass after the change is, and what fails', () => {
    expect(sub('H10j Pass')).toMatch(/`frontend-design`/);
    expect(sub('H10j Pass')).toMatch(/\*\*not\*\* `generative-ui`/);
    expect(sub('H10j Pass')).toMatch(/docs\/pilot\/prototype\//);
    expect(sub('H10j Pass')).toMatch(/only token colours/);
    expect(sub('H10j Fail')).toMatch(/`Skill` call for `generative-ui`/);
    expect(sub('H10j Fail')).toMatch(/tested in a browser/);
  });

  it('describes the re-run of H10h and H10i on a real install, graded by the pass lines fixed after Sitting J, with no manual edit of her tools line', () => {
    const r = sub('The re-run of H10h and H10i');
    expect(r).toMatch(/H10h and H10i/);
    expect(r).toMatch(/fixed after Sitting J/);
    expect(r).toMatch(/no manual edit/i);
    expect(r).toMatch(/explicit yes/i);
    expect(r).toMatch(/design-artifact-publishing/);
  });

  it('is listed among the scenarios and the sittings, with the proposed ceiling, and the old total stays as it was', () => {
    expect(PROTOCOL).toMatch(/\| H10j \|/);
    expect(PROTOCOL).toMatch(/\| Sitting K \|[^\n]*\| 3\.2 USD and 4 prompts/);
    expect(PROTOCOL).toMatch(/Total of all ceilings: 55\.0 USD, and 65\.0 USD with Sitting F\./);
  });

  it('holds no secret, token or key', () => {
    expect(section()).not.toMatch(/\bsk-[A-Za-z0-9]{10,}/);
    expect(section()).not.toMatch(/(api[_-]?key|token|password)\s*[:=]\s*\S{8,}/i);
  });
});
