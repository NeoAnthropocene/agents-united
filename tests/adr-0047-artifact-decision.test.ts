import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { nativeText } from './helpers/native-roles.js';

/**
 * ADR 0047 and Plan 036 after probe P3 (2026-10-08): the maintainer decided that the creative designer keeps the `Artifact` tool
 * (option O3 of the Claude Design exploration), taught first by a skill (S11) and granted next (S12), with the evidence in S13.
 * This pins the decision where it is written: the ADR has the four parts and says what is decided and what is not built, the
 * plan records Q8 and Q9, the new findings and the slices, the plan index agrees, and the statement that the grant is not built yet
 * is true of the registry today. **S12 flips the last assertion**: it grants the tool, so it must also change the ADR's status
 * line and the plan's state, and this test with them.
 */

const read = (file: string): string => fs.readFileSync(path.resolve(file), 'utf8').replace(/\r\n/g, '\n');
const ADR_FILE = fs.readdirSync(path.resolve('docs/adr')).find(f => /^0047-.*\.md$/.test(f));
const adr = (): string => read(`docs/adr/${ADR_FILE ?? '0047-missing.md'}`);
const PLAN = (): string => read('plans/036-claude-creative-designer-improvement.md');
const row = (id: string): string => PLAN().split('\n').find(l => new RegExp(`^\\| ${id} \\|`).test(l)) ?? '';

describe('ADR 0047: the creative designer may publish to Claude Design', () => {
  it('exists under its number, with the four parts of an ADR in the repo\'s form', () => {
    expect(ADR_FILE, 'docs/adr/0047-<slug>.md').toBeDefined();
    const a = adr();
    expect(a.split('\n')[0]).toMatch(/^# ADR 0047: /);
    for (const part of ['Status', 'Context', 'Decision', 'Consequences']) expect(a, part).toMatch(new RegExp(`^- \\*\\*${part}\\*\\*:`, 'm'));
  });

  it('records the maintainer\'s words and the date, and says that the grant is not built yet and which slices build it', () => {
    const a = adr();
    expect(a).toMatch(/Accepted, 2026-10-08/);
    expect(a).toMatch(/I want to keep the Artifact for agency-creative-designer/);
    expect(a).toMatch(/The grant is not built yet/);
    expect(a).toMatch(/S11/);
    expect(a).toMatch(/S12/);
    expect(a).toMatch(/ADR 0021/);
  });

  it('decides the seven things: one role, opt-in, private and reported, the how in a skill, one floor line, no guard yet, availability', () => {
    const a = adr();
    for (const piece of [/One role holds the tool/, /Publishing is opt-in/, /Private and reported/, /The how lives in a skill/, /The floor says what leaves the project/, /No guard script yet/, /Availability is stated/]) expect(a).toMatch(piece);
    expect(a).toMatch(/agency-creative-designer/);
    expect(a).toMatch(/`design-artifact-publishing`/);
    expect(a).toMatch(/go-ahead for each publish/);
  });

  it('states what P3 showed and what it did not, so the decision is not read as more than the evidence', () => {
    const a = adr();
    expect(a).toMatch(/2 of 2 headless runs/);
    expect(a).toMatch(/Not established \(P3 did not test\)/);
    expect(a).toMatch(/unrequested publish/);
    expect(a).toMatch(/Pro or higher plan/);
  });
});

describe('Plan 036 after P3', () => {
  it('records the maintainer\'s answer to Q8 in his words, and leaves Q9 open', () => {
    expect(row('Q8')).toMatch(/\*\*Yes\.\*\*/);
    expect(row('Q8')).toMatch(/I want to keep the Artifact for agency-creative-designer/);
    expect(row('Q8')).toMatch(/ADR 0047/);
    expect(row('Q9')).toMatch(/\*\*Open\.\*\*/);
    expect(row('Q7')).toMatch(/After P3/);
  });

  it('adds the findings F11 and F12 and the slices S11 to S16, and marks S1, S1b, S9 and S10 as they stand', () => {
    expect(row('F11')).toMatch(/S11, S12/);
    expect(row('F12')).toMatch(/S14 to S16/);
    for (const slice of ['S11', 'S12', 'S13', 'S14', 'S15', 'S16']) expect(row(slice), slice).toMatch(/\| M5 \|/);
    expect(row('S1')).toMatch(/in review/);
    expect(row('S9')).toMatch(/\*\*done\*\* \(PR 180\)/);
    expect(row('S10')).toMatch(/\*\*done\*\* \(PR 181\)/);
    expect(PLAN()).toMatch(/\*\*M5\*\*/);
    for (const heading of ['### S11 ', '### S12 ', '### S13 ', '### S14 to S16 ']) expect(PLAN(), heading).toContain(`\n${heading}`);
  });

  it('keeps the floor edit of S12 as the maintainer\'s to approve, and puts the ceilings of S13 in his hands', () => {
    const p = PLAN();
    expect(p).toMatch(/needs the maintainer's yes in the pull request/);
    expect(p).toMatch(/ceiling proposal 1\.6 USD and 2 prompts/i);
    expect(p).toMatch(/H10j/);
  });

  it('is agreed with by the plans index: the answers to Q8, the slices to S16, S1 and S1b in review, and ADR 0047', () => {
    const line = read('plans/README.md').split('\n').find(l => l.startsWith('| [036]')) ?? '';
    expect(line).toMatch(/ACCEPTED, IN PROGRESS — 2026-10-08/);
    expect(line).toMatch(/Q1 to Q8/);
    expect(line).toMatch(/S0 to S16/);
    expect(line).toMatch(/S1 and S1b in review/);
    expect(line).toMatch(/ADR 0047/);
  });
});

describe('what is built today', () => {
  it('is not the grant: her tools line has no Artifact yet, which is what the ADR says (S12 flips this with the ADR; the skill of S11 may already exist)', () => {
    const tools = /^tools: (.*)$/m.exec(nativeText('agency-creative-designer'))![1]!.split(',').map(t => t.trim());
    expect(tools).not.toContain('Artifact');
  });
});
