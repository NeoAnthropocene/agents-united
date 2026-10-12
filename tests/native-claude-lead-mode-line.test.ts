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

  // Changed after Sitting R (2026-10-12, ADR 0051): the line used to open "the first message that holds any other call", which the host holds once by design (it saves a message a moment
  // after it ends) and which made the user see the hook's error and the line twice. The line now comes one message earlier, with an allowed call, and the same sentence is the fallback.
  it('puts the line before every message that holds another call, and keeps the rule for a lead that is about to make such a call without it: write it in that same message, and expect a hold', () => {
    expect(SECTION).toMatch(/No message that holds any other call, such as `Skill`, `AskUserQuestion`, `Agent`, `TaskCreate`, `Bash` or `Read`, comes before the message that holds the line/);
    expect(SECTION).toContain('if you are about to make such a call and have not written the line, write it in that same message, and expect a hold');
    expect(SECTION).not.toMatch(/opens with the line as the first line of its first text block/);
    expect(SECTION).not.toContain('(loading the task tools in the same message is fine)');
  });

  // Sitting R (H10k2, 2026-10-12, session `1269c24c`): after the corrections of Sitting Q the lead held two calls, repeated the call each time with the line written again, and so wrote the line twice
  // before its first call, and a third time in its last message; the user saw the hook's error twice and the mode three times. The fix is to avoid the hold (the line goes with an allowed call, one
  // message before the first other call) and to write the line once.
  it('says in which order the first messages go: the searches, then the line with the introduction and the ToolSearch that loads the task tools, then the first other call', () => {
    expect(SECTION).toContain('**In order.** Your first message holds `ToolSearch` calls and nothing else: one for each of the six integrations, MarkItDown and Stitch.');
    expect(SECTION).toContain('Your second message opens with the mode line, as a text block, then the introduction, and holds one `ToolSearch` that checks for and loads the task tools and `SendMessage` (`select:TaskCreate,TaskList,TaskUpdate,SendMessage`, see "The shared task list") and no other call.');
    expect(SECTION).toContain('Your first other call is in the third message: the host has saved the line by then, so the hook holds nothing and the user sees no error (ADR 0051).');
    expect(SECTION.indexOf('**In order.**')).toBeLessThan(SECTION.indexOf('Your first answer in a session reports the operating mode'));
  });

  it('says to write the line once: no repeat of the mode or of what is callable in a later message, unless the user asks or the plan depends on a missing integration', () => {
    expect(SECTION).toContain('Write the line once. Do not state the mode or list what is callable again in a later message, unless the user asks or the plan depends on an integration that is missing; then say which one, and what it changes');
    expect(SECTION).toMatch(/observed on 2\.1\.296: a lead wrote the line twice while it repeated a held call and a third time in its last message/);
  });

  it('records the decision in ADR 0051, which keeps the gate of ADRs 0042 and 0044 and changes only where the lead writes the line', () => {
    const adr = fs.readFileSync(path.resolve('docs/adr/0051-the-lead-writes-its-mode-line-before-its-first-gated-call.md'), 'utf8').replace(/\r\n/g, '\n');
    expect(adr).toMatch(/^# ADR 0051: The lead writes its mode line before its first gated call/);
    expect(adr).toMatch(/\*\*Status\*\*: Accepted, 2026-10-12/);
    expect(adr).toContain('yes, we should do that I think');
    for (const ref of ['ADR 0042', 'ADR 0044', 'Sitting Q', 'Sitting R', '314be482', '1269c24c']) expect(adr, ref).toContain(ref);
    expect(adr).toMatch(/The gate is not changed/);
    expect(adr).toMatch(/repeat the call alone, with no text/);
    expect(adr).toMatch(/unverified live \(Sitting S\)/);
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

  it('still introduces Chris and names the team, under the line (Sitting R: the lead never did, the line having come with a call that was being repeated)', () => {
    expect(SECTION).toMatch(/Under the line, introduce yourself as Chris and name your team/);
  });

  // Slice (e): a PreToolUse gate holds the first call once (registry/hosts/claude/hooks/agents-united-mode-line-gate.js). The lead has to know that it will meet it and
  // what to do, since in live test 6 it answered the first message of the gate with a false claim that the line was written.
  it('tells the lead that calls are held until its mode line is saved, including retries while the transcript lags', () => {
    expect(SECTION).toContain('A hook holds your calls other than `ToolSearch` until the mode line is visible in the saved transcript');
    expect(SECTION).toContain('A retry can be held again while the transcript lags');
    expect(SECTION).toContain('the host cannot see the message you are writing');
  });

  // Changed after Sitting R: "write the line, even if you believe you wrote it, in the same message as the call you repeat" made every retry write the line again (twice in Sitting R). The false claim that
  // it was the reason for (live test 6: "my last message already began with the mode line", after a message with no text; Sitting Q: three times, in the reasoning) is now met by saying what counts as
  // written: a text block. A lead that has written one repeats the call alone; a lead that has not, writes it.
  it('says what to do with a hold by what the lead has written: no text block, write the line and repeat the call there; a text block, repeat the call alone and never write the line a second time', () => {
    expect(SECTION).toContain('If you have not written the line as a text block, write it in your next message and repeat the call there. If you have, the host has not saved it yet: repeat the call alone, with no text, and again if it is held again; never write the line a second time.');
    expect(SECTION).toContain('When you meet it, look at your last message: a line that you thought but did not write as a text block is not written');
    expect(SECTION).toMatch(/observed on 2\.1\.292: a lead claimed "my last message already began with the mode line" after a message with no text, and repeated its call/);
    expect(SECTION).not.toContain('write the line, even if you believe you wrote it');
  });

  // Sitting Q (H10k2, 2026-10-12, Claude Code 2.1.296, session `314be482`): six calls held in four messages. The line was in the lead's reasoning in the first three, which the hook cannot read; the fourth
  // had it in a text block and was held by the lag of the host's save; the lead then ended its turn and asked the user to reply ("I've paused ... when you reply with anything, such as 'continue'").
  // The section said that a retry can be held again, but not what to do about it: it has to say not to stop, that the line is a text block, and to repeat the call.
  it('says that a hold is not a reason to stop: no end of turn, no question, no wait; and that the line is a text block and not reasoning', () => {
    expect(SECTION).toContain('A hold is not a failure and not a reason to stop: do not end your turn to get the line saved, do not ask the user and do not wait for a reply.');
    expect(SECTION).toContain('The line must be a text block of your reply, since your reasoning is not text and the hook reads only text');
    expect(SECTION).toMatch(/observed on 2\.1\.296: a lead wrote the line in its reasoning three times and was held each time; after a fourth hold, with the line in a text block, it ended its turn and asked the user to reply/);
  });

  it('leaves a pointer in "How this agent runs", where the rule used to be a bullet', () => {
    expect(RUNS).toContain('Your first message is the mode line: see the section above');
  });
});
