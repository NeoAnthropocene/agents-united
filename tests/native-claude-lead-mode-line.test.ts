import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The mode report first, as a literal line (Plan 035 N2 slice b, 2026-10-07).
 *
 * #166 put the rule in prose ("Your first answer in a session reports the operating mode, before you ask the user anything") and the lead did not keep it in seven of
 * seven runs since. The records of the N1 runs (Claude Code 2.1.292) show where it is lost: the lead wrote "I'll check which integrations are connected first", ran
 * `ToolSearch`, and went on to its next tool call (`Skill`, `AskUserQuestion`) with no mode text; in two of four runs the mode was never named, in the manual run
 * although the prompt asked for it. A prose rule has no shape to check, so the rule is a line with fixed fields.
 *
 * The first version of the rule (a bullet in "How this agent runs": "the next message you write starts with the line") was tried in three headless first-answer
 * checks on a build of this branch (Sonnet, low effort, 2026-10-07): the line came first in one, after five `ToolSearch` calls in another with Context7 listed as
 * missing although it was connected (four of the six names had been searched), and not at all in the third, a task prompt that named a specialist: seven
 * `ToolSearch` calls, then the `Agent` call for the consultation, in a message with no text. So the rule now sits in a section of its own right after the floor, is
 * tied to the message that holds the first call other than `ToolSearch` (the line goes into that same message), and asks for a search of every one of the six.
 * The text sits after the generated Contract Floor, which belongs to the shared core and is compared byte for byte elsewhere.
 */

const LEAD = fs.readFileSync(path.resolve('registry/hosts/claude/agents/orchestrator-digital-agency.md'), 'utf8').replace(/\r\n/g, '\n');
const AFTER_FLOOR = LEAD.split('<!-- agents-united:floor:end -->')[1] ?? '';
const HEADING = '## The first message: the mode line';
const RUNS_AT = AFTER_FLOOR.indexOf('## How this agent runs');
const SECTION = AFTER_FLOOR.slice(AFTER_FLOOR.indexOf(HEADING), RUNS_AT);
const RUNS = AFTER_FLOOR.slice(RUNS_AT, AFTER_FLOOR.indexOf('## Step 0:'));
const EXAMPLE_LINE = /`(Mode: (?:Fully|Limited) Operational\. Callable: [^`]*?\. Missing: [^`]*?\. Extras: [^`]*?\.)`/;
const REQUIRED = ['GitHub', 'Firecrawl', 'Context7', 'Playwright', 'Chrome DevTools', 'Figma'];

describe('the mode line of the Claude lead', () => {
  it('finds the section, right after the floor and before "How this agent runs", so that no test below passes on an empty match', () => {
    const at = AFTER_FLOOR.indexOf(HEADING);
    expect(at).toBeGreaterThan(-1);
    expect(at).toBeLessThan(RUNS_AT);
    expect(SECTION).not.toBe('');
    expect(AFTER_FLOOR.slice(0, at).trim()).toBe('');
  });

  it('gives the line a fixed shape with four fields: the mode, what is callable, what is missing, the extras', () => {
    expect(SECTION).toContain('`Mode: <Fully Operational or Limited Operational>. Callable: <the required integrations you can call, or none>. Missing: <the required integrations you cannot call, or none>. Extras: <MarkItDown and Stitch, only those you can call, or none>.`');
    expect(SECTION).toContain('the Extras field holds names only, with no remark');
  });

  it('shows one filled example whose Callable and Missing fields together are exactly the six required integrations', () => {
    const example = SECTION.match(EXAMPLE_LINE)?.[1] ?? '';
    expect(example).not.toBe('');
    const field = (name: string, next: string): string[] =>
      (example.split(`${name}: `)[1] ?? '').split(`. ${next}:`)[0].split(', ').map(item => item.trim()).filter(item => item !== 'none' && item !== '');
    const callable = field('Callable', 'Missing');
    const missing = field('Missing', 'Extras');
    expect([...callable, ...missing].sort()).toEqual([...REQUIRED].sort());
    expect(example).toMatch(/^Mode: Limited Operational\./);
  });

  it('asks for a search of every one of the six, since a name that was not searched for is not missing', () => {
    expect(SECTION).toContain('Search for each of the six: a name you did not search for is not missing');
    expect(SECTION).toMatch(/searched four of the six, listed Context7 as missing/);
  });

  it('limits the calls that may come before the line to ToolSearch', () => {
    expect(SECTION).toContain('The only calls you may make before the line are `ToolSearch` calls');
  });

  it('ties the line to the message that holds the first other call, and says to write it in that same message', () => {
    expect(SECTION).toMatch(/The first message that holds any other call, such as `Skill`, `AskUserQuestion`, `Agent`, `TaskCreate`, `Bash` or `Read`, opens with the line as the first line of its first text block/);
    expect(SECTION).toContain('if you are about to make such a call and have not written the line, write it in that same message');
  });

  // Second set of headless checks (2026-10-07): the two prompts that gave the lead an order about the work ("Consult emre read-only first", "Have defne list ...")
  // were followed with no mode text, in one run each (an `Agent` call in a message with no text); the prompt that asked nothing, and the one that asked for the mode,
  // got the line. The lead put the user's explicit order above the line, so the line says that an order does not displace it.
  it('says that a prompt that orders a consultation or a hand-off does not move the line', () => {
    expect(SECTION).toContain('A prompt that tells you to consult a specialist or to hand work to one does not move the line: write the line first, then do what the prompt says');
  });

  it('says the user does not have to ask for it, and what the lead did instead in the runs that failed', () => {
    expect(SECTION).toMatch(/The user does not have to ask for the line/);
    expect(SECTION).toMatch(/I'll check which integrations are connected first/);
    expect(SECTION).toMatch(/seven of seven runs/);
  });

  it('still introduces Chris and names the team, under the line', () => {
    expect(SECTION).toMatch(/Under the line, introduce yourself as Chris and name your team/);
  });

  // Slice (e): a PreToolUse gate holds the first call once (registry/hosts/claude/hooks/agents-united-mode-line-gate.js). The lead has to know that it will meet it and
  // what to do, since in live test 6 it answered the first message of the gate with a false claim that the line was written.
  it('tells the lead about the gate: the first call is held once, whatever it wrote, and the line goes in the same message as the repeated call', () => {
    expect(SECTION).toContain('A hook holds your first call other than `ToolSearch` once, with the message "Mode line first"');
    expect(SECTION).toContain('write the line, even if you believe you wrote it, in the same message as the call you repeat');
    expect(SECTION).toContain('the host cannot see the message you are writing');
  });

  it('leaves a pointer in "How this agent runs", where the rule used to be a bullet', () => {
    expect(RUNS).toContain('Your first message is the mode line: see the section above');
  });
});
