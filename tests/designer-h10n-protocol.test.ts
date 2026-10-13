import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Plan 036 S19, 2026-10-13 (ROADMAP Milestone 4, the Gemini chain). The maintainer holds a Gemini key only, and the route that their key can show was never run as one chain since the fixes: the lead's
 * offer (Sittings R and T), the printed command run by the user (T), the tool in the pool of the lead and of Jamileh (U), the images (L to N). H10n runs it once, in one session, with the user's own key
 * typed only into the user's own terminal. This suite keeps the protocol's definition of that sitting: its prompt, the answers that are part of it, what is read, what passes and what fails.
 */

const PROTOCOL = fs.readFileSync(path.resolve('docs/live-test-protocol.md'), 'utf8').replace(/\r\n/g, '\n');
const ROADMAP = fs.readFileSync(path.resolve('ROADMAP.md'), 'utf8').replace(/\r\n/g, '\n');
const section = (): string => {
  const start = PROTOCOL.indexOf('\n## H10n ');
  expect(start, 'the section H10n exists').toBeGreaterThan(-1);
  const next = PROTOCOL.indexOf('\n## ', start + 5);
  return PROTOCOL.slice(start, next === -1 ? undefined : next);
};

describe('H10n: the Gemini route end to end (protocol)', () => {
  it('asks the question: the whole route in one session, with the command the lead prints and the user\'s own key', () => {
    const h = section();
    expect(h).toMatch(/^\n## H10n The Gemini route end to end[^\n]*\(added 2026-10-13, Plan 036 S19, ROADMAP Milestone 4\)/);
    expect(h).toMatch(/\*\*Question\.\*\*/);
    expect(h).toMatch(/in one session/);
    expect(h).toMatch(/The chain has not been run since the fixes/);
    for (const adr of ['ADR 0049', 'ADR 0051', 'ADR 0053', 'ADR 0054']) expect(h, adr).toContain(adr);
  });

  it('gives the prompt as a fence of one photograph and a team that waits for the choice', () => {
    const h = section();
    const fence = /### H10n Prompt\n```text\n([\s\S]*?)\n```/.exec(h);
    expect(fence).not.toBeNull();
    expect(fence![1]).toBe('Scratch exercise, no real client. I need one photograph for the PetPal feed ad (4:5): a warm, natural photo of a sitter and a dog on a sofa. No photography is supplied. Do not start any teammate until I have chosen how the picture is made.');
  });

  it('scripts the answers: Gemini, the go for one image, the command in a second terminal, the check with `claude mcp list` only, the restart script, and the stop', () => {
    const h = section();
    expect(h).toContain('**Generate with Gemini**');
    expect(h).toContain('go: one image, Gemini, 2K, no more than your estimate');
    expect(h).toMatch(/second terminal/);
    expect(h).toMatch(/project folder/);
    expect(h).toMatch(/`claude mcp list`/);
    expect(h).toMatch(/never the output of `claude mcp get`/);
    expect(h).toContain('scripts\\resume-h10k.ps1 -Scenario e2e');
    expect(h).toContain('scripts\\start-h10k.ps1 -Scenario e2e');
    expect(h).toMatch(/typed only into the maintainer's own terminal/);
  });

  it('reads the right evidence: the options and the figures, the printed command, both pools, the call, the file and its record, a scan for a key, the hook\'s log', () => {
    const h = section();
    for (const item of ['`ToolSearch`', '`ListAgents`', '`call-check.mjs`', '`image-check.mjs`', 'a scan of every record', 'the hook\'s log']) expect(h, item).toContain(item);
    expect(h).toMatch(/counts only/);
  });

  it('passes on the whole chain and fails on a key, a command the lead ran, a promised approval prompt, a missing tool, a second image or a pool with ListAgents', () => {
    const h = section();
    const pass = /### H10n Pass\n([^\n]*)/.exec(h)![1]!;
    expect(pass).toMatch(/The opening is the line alone/);
    expect(pass).toMatch(/one `AskUserQuestion` with the four options/);
    expect(pass).toMatch(/`call-check\.mjs --images 1`/);
    expect(pass).toMatch(/`<your-ai-studio-key>`/);
    expect(pass).toMatch(/needs no approval prompt/);
    expect(pass).toMatch(/lists `mcp__image-gen__generate_image` and so does Jamileh's/);
    expect(pass).toMatch(/neither pool lists `ListAgents`/);
    expect(pass).toMatch(/\*\*one\*\* call/);
    expect(pass).toMatch(/no key anywhere in the records/);
    const fail = /### H10n Fail\n([^\n]*)/.exec(h)![1]!;
    for (const item of ['A key asked for, written or printed', 'the printed command run by the lead', 'an approval prompt promised for a local server', 'the tool not listed after the restart', 'more than one image', 'a red hook error', 'a pool that lists `ListAgents`']) expect(fail, item).toContain(item);
  });

  it('has the sitting in the ledger as proposed and then run, without a ceiling (the total of ceilings does not move), and the ROADMAP task points to it (run 2026-10-13: see the observation of the same day)', () => {
    const x = PROTOCOL.split('\n').find(l => l.startsWith('| Sitting X |')) ?? '';
    expect(x).toMatch(/H10n, the Gemini route end to end/);
    expect(x).toMatch(/one interactive session/);
    expect(x).toMatch(/no ceiling was set/);
    expect(x).toMatch(/proposed 2026-10-13/);
    expect(x).toMatch(/; run 2026-10-13;/);
    expect(PROTOCOL).toMatch(/Total of all ceilings: 55\.0 USD, and 65\.0 USD with Sitting F\./);
    expect(ROADMAP).toMatch(/- \[x\] Gemini end to end in one session[^\n]*H10n/);
  });
});
