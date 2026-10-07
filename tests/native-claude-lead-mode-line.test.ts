import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The mode report first, as a literal line (Plan 035 N2 slice b, 2026-10-07).
 *
 * #166 put the rule in prose ("Your first answer in a session reports the operating mode, before you ask the user anything") and the lead did not keep it in seven of
 * seven runs since. The records of the N1 runs (Claude Code 2.1.292) show where it is lost: the lead wrote "I'll check which integrations are connected first", ran
 * `ToolSearch`, and went on to its next tool call (`Skill`, `AskUserQuestion`) with no mode text; in two of four runs the mode was never named, in the manual run
 * although the prompt asked for it. A prose rule has no shape to check, so the rule is now a line with fixed fields, the one message that carries it is named, and the
 * calls that may precede it are limited to the integration check.
 * The text sits after the generated Contract Floor, which belongs to the shared core and is compared byte for byte elsewhere.
 */

const LEAD = fs.readFileSync(path.resolve('registry/hosts/claude/agents/orchestrator-digital-agency.md'), 'utf8').replace(/\r\n/g, '\n');
const AFTER_FLOOR = LEAD.split('<!-- agents-united:floor:end -->')[1] ?? '';
const RUNS = AFTER_FLOOR.slice(AFTER_FLOOR.indexOf('## How this agent runs'), AFTER_FLOOR.indexOf('## Step 0:'));
const BULLET = RUNS.split('\n').filter(line => /Your first answer in a session reports the operating mode/.test(line)).join('\n');
const EXAMPLE_LINE = /`(Mode: (?:Fully|Limited) Operational\. Callable: [^`]*?\. Missing: [^`]*?\. Extras: [^`]*?\.)`/;
const REQUIRED = ['GitHub', 'Firecrawl', 'Context7', 'Playwright', 'Chrome DevTools', 'Figma'];

describe('the mode line of the Claude lead', () => {
  it('finds the rule, so that no test below passes on an empty match', () => {
    expect(RUNS).not.toBe('');
    expect(BULLET).not.toBe('');
  });

  it('gives the line a fixed shape with four fields: the mode, what is callable, what is missing, the extras', () => {
    expect(BULLET).toContain('`Mode: <Fully Operational or Limited Operational>. Callable: <the required integrations you can call, or none>. Missing: <the required integrations you cannot call, or none>. Extras: <MarkItDown and Stitch, only those you can call, or none>.`');
  });

  it('shows one filled example whose Callable and Missing fields together are exactly the six required integrations', () => {
    const example = BULLET.match(EXAMPLE_LINE)?.[1] ?? '';
    expect(example).not.toBe('');
    const field = (name: string, next: string): string[] =>
      (example.split(`${name}: `)[1] ?? '').split(`. ${next}:`)[0].split(', ').map(item => item.trim()).filter(item => item !== 'none' && item !== '');
    const callable = field('Callable', 'Missing');
    const missing = field('Missing', 'Extras');
    expect([...callable, ...missing].sort()).toEqual([...REQUIRED].sort());
    expect(example).toMatch(/^Mode: Limited Operational\./);
  });

  it('limits the calls that may come before the line to the integration check, run together in one message', () => {
    expect(BULLET).toMatch(/The only calls you make before it are `ToolSearch` calls that check the six required integrations/);
    expect(BULLET).toMatch(/in one message/);
  });

  it('puts the line at the start of the very next message, before any other call or question', () => {
    expect(BULLET).toMatch(/The next message you write starts, as the first line of its first text block, with this line/);
    expect(BULLET).toMatch(/`Skill`, `AskUserQuestion`, `Agent`, `TaskCreate`/);
  });

  it('says the user does not have to ask for it, and what the lead did instead in the runs that failed', () => {
    expect(BULLET).toMatch(/The user does not have to ask for the line/);
    expect(BULLET).toMatch(/I'll check which integrations are connected first/);
    expect(BULLET).toMatch(/seven of seven runs/);
  });

  it('still introduces Chris and names the team, under the line', () => {
    expect(BULLET).toMatch(/Under the line, introduce yourself as Chris and name your team/);
  });
});
