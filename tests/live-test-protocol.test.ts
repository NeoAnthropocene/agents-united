import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Plan 035 S7: the live-test protocol (`docs/live-test-protocol.md`) for the seven items still not established
 * after the full-roster live run (ADR 0039). It is a document the maintainer follows, so this suite pins what
 * makes it usable: every scenario has the exact prompt, the setup, the evidence to read, what a pass and a fail
 * look like, and a cost with a ceiling; the order is cheapest first; the ceilings add up; the guard probe uses
 * the model-proof commands; MCP servers are confirmed before any install; and nothing in it is a secret.
 */

const DOC = fs.readFileSync(path.resolve('docs/live-test-protocol.md'), 'utf8').replace(/\r\n/g, '\n');
const SCENARIOS = ['H5', 'H4', 'H3', 'H6', 'H1', 'H8', 'H2'] as const; // execution order, cheapest ceiling first (H2 also covers H7)

function section(id: string): string {
  const start = DOC.indexOf(`\n## ${id} `);
  expect(start, `section ${id} exists`).toBeGreaterThan(-1);
  const next = DOC.indexOf('\n## ', start + 5);
  return DOC.slice(start, next === -1 ? undefined : next);
}

describe('the live-test protocol: structure', () => {
  it('says plainly that it is a protocol, that nothing in it has been run, and that the maintainer types', () => {
    expect(DOC).toMatch(/not run/i);
    expect(DOC).toMatch(/the maintainer types/i);
    expect(DOC).toMatch(/never use `--dangerously-skip-permissions`/i);
  });

  for (const id of SCENARIOS) {
    it(`${id} has a prompt, a setup, the evidence, a pass, a fail, and a cost with a ceiling`, () => {
      const s = section(id);
      for (const heading of ['### Prompt', '### Setup', '### Evidence', '### Pass', '### Fail', '### Cost']) expect(s, `${id} ${heading}`).toContain(heading);
      expect(s).toMatch(/Ceiling: \d+(\.\d+)? USD/);
      expect(s).toMatch(/\d+ prompts?/);
      expect(s).toMatch(/```text\n[\s\S]+?\n```/);
    });
  }

  it('covers all seven open items, H7 together with H2, and H8 the skill against no skill', () => {
    expect(DOC).toMatch(/H2 and H7/);
    for (const n of ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'H7', 'H8']) expect(DOC).toContain(n);
  });

  it('runs the scenarios cheapest ceiling first, and the ceilings add up to the stated total', () => {
    const ceilings = SCENARIOS.map(id => Number(/Ceiling: (\d+(?:\.\d+)?) USD/.exec(section(id))![1]));
    expect(ceilings).toEqual([...ceilings].sort((a, b) => a - b));
    const total = Number(/Total of all ceilings: (\d+(?:\.\d+)?) USD/.exec(DOC)![1]);
    expect(ceilings.reduce((s, n) => s + n, 0)).toBeCloseTo(total, 5);
  });

  it('groups the scenarios into sittings the maintainer can approve one at a time', () => {
    expect(DOC).toMatch(/Sitting A/);
    expect(DOC).toMatch(/Sitting E/);
    expect(DOC).toMatch(/doubled/i);
    expect(DOC).toMatch(/approve a ceiling per sitting/i);
  });
});

describe('the live-test protocol: content that must be exact', () => {
  it('H5 uses the model-proof commands of docs/guard-testing.md and the controls that must not be blocked', () => {
    const s = section('H5');
    for (const cmd of ['echo git push --force', 'echo x > .env.test', 'echo git push --force-with-lease', 'echo x > .env.example', 'echo hello world']) expect(s).toContain(cmd);
    expect(s).toMatch(/Blocked by agents-united guard/);
    expect(s).toMatch(/\.env\.test/);
  });

  it('H4 asks for the host answer word for word and says what each outcome means for the package', () => {
    const s = section('H4');
    expect(s).toMatch(/word for word/i);
    expect(s).toMatch(/REFUSED/);
    expect(s).toMatch(/ACCEPTED/);
    expect(s).toMatch(/defect/i);
  });

  it('H3 leaves the contract out of the briefs and uses a plain session as the lead, with the budget of two exchanges', () => {
    const s = section('H3');
    expect(s).toMatch(/plain `claude` session/i);
    expect(s).toMatch(/DO NOT tell them/);
    expect(s).toMatch(/two exchanges/i);
  });

  it('H6 names the four no-secret servers, asks the maintainer to confirm before any install, and plants known defects in a local page', () => {
    const s = section('H6');
    for (const server of ['playwright', 'chrome-devtools-mcp', 'context7', 'markitdown']) expect(s).toContain(server);
    expect(s).toMatch(/confirm/i);
    expect(s).toMatch(/before any install/i);
    expect(s).toMatch(/localhost:4173/);
    expect(s).toMatch(/Limited Operational/);
    expect(s).toMatch(/no secret|no API key|needs no key/i);
    for (const d of ['D1', 'D2', 'D3', 'D4']) expect(s).toContain(d);
  });

  it('H1 reuses the full-roster brief and reads the three fixes from the session-report helper', () => {
    const s = section('H1');
    expect(s).toMatch(/PetPal/);
    expect(s).toMatch(/H1a/);
    expect(s).toMatch(/H1b/);
    expect(s).toMatch(/H1c/);
  });

  it('H2 starts through `agents start`, checks the argv first for free, and warns about the plan limit and the unmeasured Opus cost', () => {
    const s = section('H2');
    expect(s).toMatch(/agents start digital-agency --host claude/);
    expect(s).toMatch(/--dry-run/);
    expect(s).toMatch(/get_usage|plan limit/i);
    expect(s).toMatch(/not measured/i);
  });

  it('points at the session-report helper that exists in package.json, and at where the records live', () => {
    expect(DOC).toContain('npm run hostlib:session');
    const scripts = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf8')).scripts as Record<string, string>;
    expect(scripts['hostlib:session']).toBeDefined();
    expect(DOC).toMatch(/\.claude\/projects\/<cwd/);
  });

  it('says what happens after a sitting: defects are fixed test first, one pull request per defect cluster, and the observation is recorded', () => {
    expect(DOC).toMatch(/test first/i);
    expect(DOC).toMatch(/one pull request per defect cluster/i);
    expect(DOC).toMatch(/host-library\/claude\/observations/);
  });
});

describe('the live-test protocol: H8, the skill baseline', () => {
  it('compares the same prompt with and without the skill, from the skill evals, and says what a fail means for the skill', () => {
    const s = section('H8');
    expect(s).toMatch(/evals\/evals\.json/);
    expect(s).toMatch(/skillOverrides/);
    expect(s).toMatch(/without/i);
    expect(s).toMatch(/pass rate/i);
    expect(s).toMatch(/revise the skill/i);
    expect(s).toMatch(/Skill` call|description problem/);
  });
});

describe('the live-test protocol: safety', () => {
  it('contains no secret, token or key', () => {
    expect(DOC).not.toMatch(/\bsk-[A-Za-z0-9]{10,}/);
    expect(DOC).not.toMatch(/\bghp_[A-Za-z0-9]{10,}/);
    expect(DOC).not.toMatch(/(api[_-]?key|token|password)\s*[:=]\s*\S{8,}/i);
  });

  it('never tells the reader to run `agy mcp list` or to read provider settings', () => {
    expect(DOC).not.toMatch(/agy mcp list/);
    expect(DOC).not.toMatch(/providers\.json/);
  });

  it('keeps every prompt short enough to type or paste (under 2,000 characters)', () => {
    for (const block of DOC.matchAll(/### Prompt[\s\S]*?```text\n([\s\S]*?)\n```/g)) expect(block[1]!.length).toBeLessThan(2000);
  });
});
