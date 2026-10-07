import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The shutdown reply, a wrong and a right example side by side (Plan 035 N2 slice c, 2026-10-07).
 *
 * #163 told the nine teammates in prose that the reply is an object and that a string of JSON is refused. Emre still passed a string twice in the second H9 retest
 * (session `11611f74`, 14:27:49 and 14:27:52, "message text must not be a teammate protocol frame"), and was accepted on the third call. Four refused calls in
 * eighteen replies before #163, two in the retest after it, so the sentence is read and not followed. The refused call is always the same shape, a `message` that
 * holds the frame inside quotation marks; two lines that differ only in those quotation marks are what the teammate can compare with its own call. The lead's
 * request is where the teammate has to answer, so the template of the reply goes there too, in words (a frame written into the request's reason would be a second
 * protocol frame to parse).
 * Both sit after the generated Contract Floor, which belongs to the shared core and is compared byte for byte elsewhere.
 *
 * Live test 3 (2026-10-07, session `6c86e269`) showed that the pair and the template were not enough: Emre, a consultant, sent the string twice (10:02:03 and
 * 10:02:05) although the host's own text under the request gave the exact object, and was accepted on the third call, after `ToolSearch select:SendMessage`.
 * The same sequence is in the second H9 retest (Emre, 14:27:49 to 14:27:57). A teammate that loaded `SendMessage` early replied with the object at once (Yavuz in
 * the H1 rerun, Emre in the first H9 retest). The bodies already say "load `SendMessage` before first use" under the task list, and a consultant never reaches
 * that rule, since a plain answer needs no task. So the load is now tied to the reply itself, to the brief every teammate gets and to the request's reason.
 */

const AGENTS = path.resolve('registry/hosts/claude/agents');
const afterFloor = (name: string): string =>
  (fs.readFileSync(path.join(AGENTS, `${name}.md`), 'utf8').replace(/\r\n/g, '\n').split('<!-- agents-united:floor:end -->')[1] ?? '');

const RIGHT = '  - Right, `message` is an object: `SendMessage {"to":"team-lead","message":{"type":"shutdown_response","request_id":"<the request_id of the request>","approve":true}}`';
const WRONG = '  - Wrong, `message` is a string of JSON, and the host refuses it: `SendMessage {"to":"team-lead","message":"{\\"type\\":\\"shutdown_response\\",\\"request_id\\":\\"<the request_id of the request>\\",\\"approve\\":true}"}`';

describe.each([
  'agency-growth-strategist', 'agency-conversion-specialist', 'agency-creative-designer', 'agency-content-strategist', 'agency-campaign-specialist',
  'agency-frontend-architect', 'agency-seo-specialist', 'agency-qa-automation-lead', 'agency-compliance-grc-specialist',
])('teammate %s: the right and the wrong shutdown reply', name => {
  it('shows the object and the string of JSON on two lines under the rule, right first', () => {
    const lines = afterFloor(name).split('\n');
    const rule = lines.findIndex(line => line.startsWith('- **Answer a shutdown request with the structured object.**'));
    expect(rule).toBeGreaterThan(-1);
    expect(lines[rule + 1]).toBe(RIGHT);
    expect(lines[rule + 2]).toBe(WRONG);
  });

  it('tells the teammate to load SendMessage with ToolSearch before it sends the reply, on the rule line itself', () => {
    const rule = afterFloor(name).split('\n').find(line => line.startsWith('- **Answer a shutdown request with the structured object.**')) ?? '';
    expect(rule).toContain('Load `SendMessage` first: run `ToolSearch` with `select:SendMessage` before you send the reply');
    expect(rule).toMatch(/sent the string twice/);
  });

  it('keeps the rule sentence that the earlier test pins, and the next rule after the pair', () => {
    const body = afterFloor(name);
    expect(body).toContain('`SendMessage` to `team-lead` whose `message` is an object, not a string');
    expect(body).toMatch(/\n- \*\*Report sections, always present:\*\*/);
  });
});

describe('the lead: the template of the shutdown request', () => {
  const lead = afterFloor('orchestrator-digital-agency');

  it('puts the reply instruction in the request, in words, where the teammate has to answer', () => {
    expect(lead).toContain('Put the reply instruction in the reason, in words, and write no frame in it:');
    expect(lead).toContain('`Delivered, thank you. First run ToolSearch with select:SendMessage, then reply with one SendMessage to team-lead whose message is an object, not a string of JSON: type shutdown_response, the request_id of this request, approve true.`');
  });

  it('puts the load of SendMessage into the brief every teammate gets, so that a consultant has it before its first reply', () => {
    const brief = lead.slice(lead.indexOf('You are the teammate "<name>"'), lead.indexOf('**Team mode and relay mode.**'));
    expect(brief).not.toBe('');
    expect(brief).toContain('Tools: before your first reply, load `SendMessage` with `ToolSearch` (`select:SendMessage`)');
  });

  it('keeps the request itself structured, as an earlier test pins', () => {
    expect(lead).toContain('`SendMessage` with the message `{"type":"shutdown_request","reason":"<why>"}`');
  });

  it('says what a refused reply looks like, so that the lead can tell the teammate', () => {
    expect(lead).toMatch(/refused as "message text must not be a teammate protocol frame"[^.]*send the object/);
  });
});
