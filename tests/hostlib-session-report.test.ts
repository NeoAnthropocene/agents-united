import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { analyse, loadSession, parseTeammateMessages, renderReport, resolveSessionFile, trimRecord, trimSession } from '../scripts/hostlib/session-report.ts';
import type { Analysis } from '../scripts/hostlib/session-report.ts';

/**
 * Plan 035 S8: the session-report helper reads a Claude session's own records and reports the tool calls,
 * the task and message flow, hook and error records, models, cost and a verdict for each of the seven open
 * items of the live-test protocol. The fixtures are trimmed, sanitised copies of two real sessions
 * (`123266e9`, the PetPal re-run with three teammates, and `d2f784af`, the full-roster run with nine); the
 * helper must reproduce what those runs showed (ADR 0039: the three defects of the full-roster run). What
 * the real sessions do not contain (a guard block, an MCP call, an Opus lead, a refused blocked start, a
 * fixed read-only consultation) is covered by synthetic sessions built here.
 */

const FIXTURES = path.resolve('tests/fixtures/session-report');
const FULL = path.join(FIXTURES, 'd2f784af-3f9f-4859-81f5-0d2ae2f1435b.jsonl');
const PETPAL = path.join(FIXTURES, '123266e9-317f-46da-a335-c9c8f14584f2.jsonl');
// Sitting A of Plan 035 M3 (2026-10-05, Claude Code 2.1.289): the first live sessions of the protocol, trimmed with `trim`.
const GUARD = path.join(FIXTURES, 'aa5e73e8-a428-461d-87b8-d03f8c38472f.jsonl'); // H5
const EARLY = path.join(FIXTURES, '2d33c6dd-43fa-4c1b-91f8-9c05c03d2492.jsonl'); // H4
const PEERS = path.join(FIXTURES, 'fec45100-a1e9-45b3-a53c-628ea1fc591b.jsonl'); // H3

const dirs: string[] = [];
afterEach(() => {
  while (dirs.length > 0) fs.rmSync(dirs.pop()!, { recursive: true, force: true });
});
const tmp = (): string => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'session-report-'));
  dirs.push(d);
  return d;
};
const finding = (a: Analysis, id: string) => a.findings.find(f => f.id === id)!;

describe('the full-roster session d2f784af (nine teammates)', () => {
  const session = loadSession(FULL);
  const analysis = analyse(session);

  it('reads the header, the cost record and the roster', () => {
    expect(session.sessionId).toBe('d2f784af-3f9f-4859-81f5-0d2ae2f1435b');
    expect(session.agentSetting).toBe('orchestrator-digital-agency');
    expect(session.version).toBe('2.1.289');
    expect(session.prompts).toBe(1);
    expect(session.cost?.totalCostUSD).toBeCloseTo(3.0194, 3);
    expect(session.cost?.byModel['claude-sonnet-5-5']?.outputTokens).toBe(52848);
    const names = session.agents.filter(a => !a.isLead).map(a => a.name).sort();
    expect(names).toEqual(['ava', 'defne', 'deniz', 'emre', 'jale', 'jamileh', 'kaan', 'selin', 'yavuz']);
    expect(session.agents.find(a => a.name === 'selin')?.customAgentType).toBe('agency-seo-specialist');
    expect(session.agents.find(a => a.name === 'ava')?.taskKind).toBe('in_process_teammate');
  });

  it('pairs tool calls with their results, and counts the lead calls', () => {
    const lead = session.agents.find(a => a.isLead)!;
    expect(lead.calls.filter(c => c.name === 'Agent')).toHaveLength(9);
    expect(lead.calls.filter(c => c.name === 'TaskCreate')).toHaveLength(9);
    const create = lead.calls.find(c => c.name === 'TaskCreate')!;
    expect(create.result).toMatch(/Task #1 created/);
  });

  it('reproduces defect 4 of ADR 0039: Ava wrote inside a read-only consultation after a task assignment', () => {
    const f = finding(analysis, 'H1a');
    expect(f.verdict).toBe('violation');
    expect(f.evidence.join('\n')).toMatch(/ava: a task_assignment arrived/);
  });

  it('reproduces defect 5: one plain-text shutdown request, then nine structured ones', () => {
    const f = finding(analysis, 'H1b');
    expect(f.verdict).toBe('violation');
    expect(f.evidence[0]).toMatch(/structured shutdown_request: 9, plain-text shutdown requests: 1/);
    expect(f.evidence.join('\n')).toMatch(/plain-text shutdown request to ava/);
  });

  it('reproduces defect 6: shell-less roles that did not re-read the file they wrote', () => {
    const f = finding(analysis, 'H1c');
    expect(f.verdict).toBe('violation');
    const text = f.evidence.join('\n');
    expect(text).toMatch(/ava: wrote 1 file\(s\) with no shell, re-read before reporting all$/m);
    for (const name of ['jale', 'jamileh', 'kaan', 'yavuz']) expect(text).toMatch(new RegExp(`${name}: .* all but `));
    // Emre holds Bash and PowerShell in his role's tools, so the re-read rule is not his (his spec was written and not run: no shell call). The
    // first version of the helper judged him shell-less from that, and this test pinned it; Sitting A (session fec45100, Deniz) showed the same.
    expect(text).not.toMatch(/emre/);
  });

  it('shows the host ACCEPTED a task started while its blocker was open (the lead had reopened task 1)', () => {
    const f = finding(analysis, 'H4');
    expect(f.verdict).toBe('violation');
    const text = f.evidence.join('\n');
    expect(text).toMatch(/refused 0, accepted 1/);
    expect(text).toMatch(/kaan set task 2 .* ACCEPTED/);
    expect(text).toMatch(/lead moved task 1 from completed back to in_progress/);
  });

  it('says what the run did not show: no peer message, no guard block, no MCP call, a Sonnet lead', () => {
    expect(finding(analysis, 'H3').verdict).toBe('not seen');
    expect(finding(analysis, 'H5').verdict).toBe('not seen');
    expect(finding(analysis, 'H6').verdict).toBe('not seen');
    expect(finding(analysis, 'H2/H7').verdict).toBe('not seen');
    expect(finding(analysis, 'H2/H7').evidence[0]).toContain('claude-sonnet-5-5');
  });

  it('renders one readable report with the findings, the agents and the lead flow', () => {
    const text = renderReport(analysis);
    expect(text).toContain('# Session d2f784af');
    expect(text).toContain('cost 3.0194 USD');
    expect(text).toContain('## Findings (the seven open items)');
    expect(text).toContain('## Lead: team flow');
    expect(text).toMatch(/spawn ava as agency-growth-strategist/);
    expect(text).toMatch(/message to ava:/);
  });
});

describe('the PetPal re-run 123266e9 (three teammates, a peer exchange)', () => {
  const analysis = analyse(loadSession(PETPAL));

  it('reads three teammates and the cost record', () => {
    expect(analysis.session.agents.filter(a => !a.isLead).map(a => a.name).sort()).toEqual(['ava', 'jamileh', 'kaan']);
    expect(analysis.session.cost?.totalCostUSD).toBeCloseTo(1.0368, 3);
  });

  it('sees the peer exchange between Kaan and Jamileh and no guard block', () => {
    const f = finding(analysis, 'H3');
    expect(f.verdict).toBe('seen');
    expect(f.evidence[0]).toMatch(/peer messages sent: 2 across 1 pair/);
    expect(finding(analysis, 'H5').verdict).toBe('not seen');
  });

  it('flags the reports without the two sections the comms law asks for', () => {
    const text = renderReport(analysis);
    expect(text).toMatch(/- kaan .*\n.*final report has Peer messages received and Open items: yes/);
  });
});

describe('the three Sitting A sessions of Plan 035 M3 (Claude Code 2.1.289, 2026-10-05)', () => {
  const guard = analyse(loadSession(GUARD));
  const early = analyse(loadSession(EARLY));
  const peers = analyse(loadSession(PEERS));

  it('H5 (aa5e73e8): the settings-level guard refused exactly the two commands it names, for a teammate, and the three controls ran', () => {
    const f = finding(guard, 'H5');
    expect(f.verdict).toBe('seen');
    expect(f.evidence).toEqual(['probe: Bash refused by the guard (is_error): echo git push --force', 'probe: Bash refused by the guard (is_error): echo x > .env.test']);
    const probe = guard.session.agents.find(a => a.name === 'probe')!;
    expect(probe.calls.filter(c => c.name === 'Bash')).toHaveLength(5);
    expect(probe.calls.filter(c => c.isError).map(c => String(c.input.command))).toEqual(['echo git push --force', 'echo x > .env.test']);
  });

  it('H4 (2d33c6dd): the host ACCEPTED kaan\'s start of a task whose blocker was open, with the answer "Updated task #2 status"', () => {
    const f = finding(early, 'H4');
    expect(f.verdict).toBe('violation');
    expect(f.evidence.join('\n')).toMatch(/kaan set task 2 .* ACCEPTED it \("Updated task #2 status"\)/);
  });

  it('H1c (2d33c6dd): Ava and Kaan hold editors and no shell, and completed their tasks without a re-read of notes.md', () => {
    const f = finding(early, 'H1c');
    expect(f.verdict).toBe('violation');
    expect(f.evidence.join('\n')).toMatch(/ava: wrote 1 file\(s\) with no shell, re-read before reporting all but notes\.md/);
    expect(f.evidence.join('\n')).toMatch(/kaan: wrote 1 file\(s\) with no shell, re-read before reporting all but notes\.md/);
  });

  it('names a written file by its last path segment on any platform (the records hold Windows paths and CI reads them on Linux, where path.basename does not split on a backslash)', () => {
    const session = loadSession(EARLY); // loaded first: loading wants this platform's own path.basename
    const posixBasename = vi.spyOn(path, 'basename').mockImplementation(path.posix.basename);
    try {
      const f = finding(analyse(session), 'H1c');
      expect(f.evidence.join('\n')).toMatch(/ava: wrote 1 file\(s\) with no shell, re-read before reporting all but notes\.md$/m);
      expect(f.evidence.join('\n')).not.toMatch(/\\/);
    } finally {
      posixBasename.mockRestore();
    }
  });

  it('H3 (fec45100): the two proposals crossed, three messages in one pair, one from Deniz and two from Kaan', () => {
    const f = finding(peers, 'H3');
    expect(f.verdict).toBe('seen');
    const sent = f.evidence.filter(e => / -> /.test(e));
    expect(sent).toHaveLength(3);
    expect(sent.filter(e => e.startsWith('deniz -> kaan'))).toHaveLength(1);
    expect(sent.filter(e => e.startsWith('kaan -> deniz'))).toHaveLength(2);
  });

  it('H1c (fec45100): only Kaan is judged shell-less; Deniz holds a shell by his role\'s tools, whether or not he used it', () => {
    const f = finding(peers, 'H1c');
    expect(f.verdict).toBe('violation');
    expect(f.evidence.join('\n')).toMatch(/kaan: wrote 1 file\(s\) with no shell/);
    expect(f.evidence.join('\n')).not.toMatch(/deniz/);
  });

  it('H1b: every teammate that was asked to shut down answered, counted from the teammates\' own replies (the lead\'s record does not always carry them)', () => {
    expect(finding(guard, 'H1b').evidence.join('\n')).toContain('shutdown responses sent by teammates: 1 of 1 requested (approved 1)');
    expect(finding(early, 'H1b').evidence.join('\n')).toContain('shutdown responses sent by teammates: 2 of 2 requested (approved 2)');
    expect(finding(peers, 'H1b').evidence.join('\n')).toContain('shutdown responses sent by teammates: 2 of 2 requested (approved 2)');
  });
});

/* -------------------- synthetic sessions for what the real ones lack -------------------- */

type Rec = Record<string, unknown>;
const T = (s: number): string => new Date(Date.UTC(2026, 9, 5, 9, 0, s)).toISOString();
const call = (id: string, name: string, input: Rec, s: number, messageId?: string): Rec => ({ type: 'assistant', timestamp: T(s), isSidechain: false, message: { role: 'assistant', model: 'claude-sonnet-5-5', ...(messageId ? { id: messageId } : {}), content: [{ type: 'tool_use', id, name, input }] } });
const result = (id: string, content: string, s: number, isError = false): Rec => ({ type: 'user', timestamp: T(s), isSidechain: false, message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content, is_error: isError }] } });
const mail = (from: string, body: unknown, s: number): Rec => ({ type: 'user', timestamp: T(s), isSidechain: true, message: { role: 'user', content: `<teammate-message teammate_id="${from}">\n${typeof body === 'string' ? body : JSON.stringify(body)}\n</teammate-message>` } });

/** A message that reaches the lead: the lead's own record holds it, so it is not a sidechain record. */
const leadMail = (from: string, body: unknown, s: number): Rec => ({ ...mail(from, body, s), isSidechain: false });

function writeSession(lead: Rec[], subs: Record<string, { meta: Rec; records: Rec[] }>): string {
  const dir = tmp();
  const id = 'aaaaaaaa-0000-0000-0000-000000000001';
  fs.mkdirSync(path.join(dir, id, 'subagents'), { recursive: true });
  fs.writeFileSync(path.join(dir, `${id}.jsonl`), lead.map(r => JSON.stringify(r)).join('\n') + '\n{"type":"assistant","half written');
  for (const [name, s] of Object.entries(subs)) {
    fs.writeFileSync(path.join(dir, id, 'subagents', `agent-a${name}-0123456789abcdef.jsonl`), s.records.map(r => JSON.stringify(r)).join('\n') + '\n');
    fs.writeFileSync(path.join(dir, id, 'subagents', `agent-a${name}-0123456789abcdef.meta.json`), JSON.stringify({ name, taskKind: 'in_process_teammate', ...s.meta }));
  }
  return path.join(dir, `${id}.jsonl`);
}

/** A user record the way the host writes one: a prompt id shared by everything that one prompt caused. */
const typed = (promptId: string, content: string, s: number, isMeta?: boolean): Rec => ({ type: 'user', timestamp: T(s), isSidechain: false, promptId, ...(isMeta ? { isMeta } : {}), message: { role: 'user', content } });

// Observed in H6 (session a2e814d1, 2026-10-06): the maintainer typed `/mcp reconnect chrome-devtools-mcp`, a local command that sends nothing to the model.
// The host wrote three records under a prompt id of their own (a caveat, the command, its stdout) and the helper counted it as a second prompt.
describe('the prompt count', () => {
  const caveat = (id: string, s: number): Rec => typed(id, '<local-command-caveat>The command below was run directly in Claude Code, not sent to you as a request.</local-command-caveat>', s, true);
  const command = (id: string, name: string, s: number): Rec => typed(id, `<command-name>/${name}</command-name>\n            <command-message>${name}</command-message>\n            <command-args>reconnect</command-args>`, s);
  const stdout = (id: string, s: number): Rec => typed(id, '<local-command-stdout>Reconnected to chrome-devtools-mcp.</local-command-stdout>', s);

  it('does not count a local command such as /mcp reconnect, which sends nothing to the model', () => {
    const file = writeSession([typed('p1', 'Scratch exercise.', 1), caveat('p2', 30), command('p2', 'mcp', 31), stdout('p2', 32)], {});
    expect(loadSession(file).prompts).toBe(1);
  });

  it('counts a typed prompt after a local command, and a skill invocation (a command with no local-command record)', () => {
    const file = writeSession([
      typed('p1', 'Scratch exercise.', 1),
      caveat('p2', 30), command('p2', 'mcp', 31), stdout('p2', 32),
      typed('p3', 'resume', 40),
      typed('p4', '<command-message>grill-me</command-message>\n<command-name>/grill-me</command-name>', 50),
    ], {});
    expect(loadSession(file).prompts).toBe(3);
  });

  it('still counts every record of one prompt once, teammate messages included', () => {
    const file = writeSession([typed('p1', 'Scratch exercise.', 1), { ...leadMail('ava', 'done', 5), promptId: 'p1' }, { ...leadMail('kaan', 'done', 6), promptId: 'p1' }], {});
    expect(loadSession(file).prompts).toBe(1);
  });
});

describe('synthetic sessions', () => {
  it('ignores a half-written last line and still reads the rest', () => {
    const file = writeSession([call('t1', 'Bash', { command: 'echo hi' }, 1), result('t1', 'hi', 2)], {});
    const s = loadSession(file);
    expect(s.agents[0]!.calls[0]!.result).toBe('hi');
  });

  it('H5: a guard block in a teammate is reported with the command and the agent', () => {
    const file = writeSession([], {
      writer: {
        meta: { customAgentType: 'agency-qa-automation-lead' },
        records: [call('b1', 'Bash', { command: 'echo git push --force' }, 3), result('b1', 'Blocked by agents-united guard: git push --force requires explicit human approval outside the agent session.', 4, true), call('b2', 'Bash', { command: 'echo hello world' }, 5), result('b2', 'hello world', 6)],
      },
    });
    const f = finding(analyse(loadSession(file)), 'H5');
    expect(f.verdict).toBe('seen');
    expect(f.evidence).toHaveLength(1);
    expect(f.evidence[0]).toMatch(/writer: Bash refused by the guard \(is_error\): echo git push --force/);
  });

  it('H6 and H2/H7: MCP calls are grouped by server and an Opus lead is recognised', () => {
    const leadRec = call('m1', 'ToolSearch', { query: 'x' }, 1);
    (leadRec.message as Rec).model = 'claude-opus-5-5';
    const file = writeSession([leadRec], { emre: { meta: { customAgentType: 'agency-qa-automation-lead' }, records: [call('p1', 'mcp__playwright__browser_navigate', { url: 'http://localhost:4173' }, 2), call('p2', 'mcp__playwright__browser_snapshot', {}, 3), call('p3', 'mcp__chrome-devtools-mcp__list_console_messages', {}, 4)] } });
    const a = analyse(loadSession(file));
    expect(finding(a, 'H6').verdict).toBe('seen');
    expect(finding(a, 'H6').evidence).toEqual(['emre: playwright: 2 call(s)', 'emre: chrome-devtools-mcp: 1 call(s)']);
    expect(finding(a, 'H2/H7').verdict).toBe('seen');
  });

  it('H1a: an assignment that arrives after an accepting message, or none at all, is not a violation', () => {
    const consult = mail('team-lead', 'READ-ONLY CONSULTATION. Write NO files.', 1);
    const file = writeSession([], {
      ava: { meta: {}, records: [consult, mail('team-lead', 'Consultation accepted. Now deliver task 1.', 5), mail('team-lead', { type: 'task_assignment', taskId: '1' }, 6), call('w1', 'Write', { file_path: '/x/a.md' }, 8)] },
      kaan: { meta: {}, records: [mail('team-lead', 'read-only consultation, write no files', 1), call('r1', 'Read', { file_path: '/x/b.md' }, 2)] },
    });
    const f = finding(analyse(loadSession(file)), 'H1a');
    expect(f.verdict).toBe('seen');
    expect(f.evidence.join('\n')).toMatch(/ava: wrote only after an accepting message/);
    expect(f.evidence.join('\n')).toMatch(/kaan: consulted read-only, no task assignment/);
  });

  it('H1a is not applicable when nobody was consulted read-only', () => {
    const file = writeSession([], { ava: { meta: {}, records: [mail('team-lead', 'Write strategy.md', 1)] } });
    expect(finding(analyse(loadSession(file)), 'H1a').verdict).toBe('not applicable');
  });

  it('H1b: only structured shutdown requests is a pass; a plain request is a violation', () => {
    const structured = writeSession([call('s1', 'SendMessage', { to: 'ava', message: { type: 'shutdown_request', reason: 'done' } }, 1)], {});
    expect(finding(analyse(loadSession(structured)), 'H1b').verdict).toBe('seen');
    const plain = writeSession([call('s1', 'SendMessage', { to: 'ava', message: 'You are done, please shut down now.' }, 1)], {});
    expect(finding(analyse(loadSession(plain)), 'H1b').verdict).toBe('violation');
  });

  it('H1c: a shell-less role that re-reads is a pass; one with a shell is not judged', () => {
    const file = writeSession([], {
      ava: { meta: {}, records: [call('w', 'Write', { file_path: 'D:\\x\\a.md' }, 1), call('r', 'Read', { file_path: 'd:/x/a.md' }, 2)] },
      selin: { meta: {}, records: [call('w', 'Write', { file_path: '/x/s.md' }, 1), call('b', 'Bash', { command: 'wc -l /x/s.md' }, 2)] },
    });
    const f = finding(analyse(loadSession(file)), 'H1c');
    expect(f.verdict).toBe('seen');
    expect(f.evidence).toHaveLength(1);
  });

  it('H1c: a role is shell-less by the tools of its manifest, not by the shell calls it happened to make (found in session fec45100: Deniz was flagged)', () => {
    const wrote = (name: string, customAgentType: string): string => writeSession([], { [name]: { meta: { customAgentType }, records: [call('w', 'Write', { file_path: '/x/a.md' }, 1)] } });
    // Deniz's role lists Bash and PowerShell; he made no shell call, and is still not judged.
    expect(finding(analyse(loadSession(wrote('deniz', 'agency-frontend-architect'))), 'H1c').verdict).toBe('not applicable');
    // Ava's role holds editors and no shell: judged, and she did not re-read.
    expect(finding(analyse(loadSession(wrote('ava', 'agency-growth-strategist'))), 'H1c').verdict).toBe('violation');
    // A type this repository does not know falls back to what the session shows (no shell call: judged).
    expect(finding(analyse(loadSession(wrote('zed', 'no-such-role'))), 'H1c').verdict).toBe('violation');
  });

  it('H1b: the replies teammates sent are counted against the requests the lead sent, and a missing reply shows', () => {
    const lead = [call('s1', 'SendMessage', { to: 'ava', message: { type: 'shutdown_request', reason: 'done' } }, 1), call('s2', 'SendMessage', { to: 'kaan', message: { type: 'shutdown_request', reason: 'done' } }, 1.5)];
    const reply = (approve: boolean): Rec => call('r', 'SendMessage', { to: 'team-lead', message: { type: 'shutdown_response', request_id: 'x@ava', approve } }, 2);
    const one = writeSession(lead, { ava: { meta: {}, records: [reply(true)] }, kaan: { meta: {}, records: [] } });
    expect(finding(analyse(loadSession(one)), 'H1b').evidence.join('\n')).toContain('shutdown responses sent by teammates: 1 of 2 requested (approved 1)');
    const refused = writeSession(lead, { ava: { meta: {}, records: [reply(false)] }, kaan: { meta: {}, records: [reply(true)] } });
    expect(finding(analyse(loadSession(refused)), 'H1b').evidence.join('\n')).toContain('shutdown responses sent by teammates: 2 of 2 requested (approved 1)');
  });

  it('H1b: a reply the host refused is not counted as sent, and the refusals are listed with who made them (session 4b08fd11: Deniz passed the JSON as text twice)', () => {
    const refusal = 'message text must not be a teammate protocol frame (permission/mode/plan/shutdown JSON)';
    const reply = { type: 'shutdown_response', request_id: 'x@deniz', approve: true };
    const lead = [call('s1', 'SendMessage', { to: 'deniz', message: { type: 'shutdown_request', reason: 'done' } }, 1)];
    const refusedTwice = [
      call('a', 'SendMessage', { to: 'team-lead', message: JSON.stringify(reply) }, 2),
      result('a', refusal, 2.1, true),
      call('b', 'SendMessage', { to: 'team-lead', message: JSON.stringify(reply) }, 3),
      result('b', refusal, 3.1, true),
    ];
    const accepted = [call('c', 'SendMessage', { to: 'team-lead', message: reply }, 4), result('c', '{"success":true,"message":"Shutdown approved."}', 4.1)];
    const third = finding(analyse(loadSession(writeSession(lead, { deniz: { meta: {}, records: [...refusedTwice, ...accepted] } }))), 'H1b');
    expect(third.verdict).toBe('seen');
    expect(third.evidence.join('\n')).toContain('shutdown responses sent by teammates: 1 of 1 requested (approved 1)');
    expect(third.evidence.join('\n')).toMatch(/2 reply\(ies\) refused by the host: deniz x2 \("message text must not be a teammate protocol frame/);
    // A teammate whose only replies were refused has sent none.
    const never = finding(analyse(loadSession(writeSession(lead, { deniz: { meta: {}, records: refusedTwice } }))), 'H1b');
    expect(never.evidence.join('\n')).toContain('shutdown responses sent by teammates: 0 of 1 requested (approved 0)');
  });

  it('H1b: the line about the lead\'s record names who sent no shutdown reply (session 4b08fd11: eight of nine, none from Defne)', () => {
    const request = (id: string, to: string, s: number): Rec => call(id, 'SendMessage', { to, message: { type: 'shutdown_request', reason: 'done' } }, s);
    const approved = (from: string, s: number): Rec => leadMail(from, { type: 'shutdown_approved', requestId: `x@${from}`, from }, s);
    const lead = [request('s1', 'ava', 1), request('s2', 'defne', 2), approved('ava', 3)];
    const partial = finding(analyse(loadSession(writeSession(lead, {}))), 'H1b').evidence.join('\n');
    expect(partial).toContain('shutdown responses received by the lead: 1 (none from defne)');
    const complete = finding(analyse(loadSession(writeSession([...lead, approved('defne', 4)], {}))), 'H1b').evidence.join('\n');
    expect(complete).toContain('shutdown responses received by the lead: 2');
    expect(complete).not.toContain('none from');
  });

  it('H1c: a re-read issued in the same response as the completion is named, and the verdict stays seen (session 4b08fd11: Jamileh)', () => {
    const wrote = (readResponse: string): string =>
      writeSession([], {
        ava: {
          meta: {},
          records: [
            call('w', 'Write', { file_path: '/x/a.md' }, 1, 'msg_write'),
            call('r', 'Read', { file_path: '/x/a.md' }, 2, readResponse),
            call('u', 'TaskUpdate', { taskId: '1', status: 'completed' }, 2.1, 'msg_done'),
          ],
        },
      });
    const same = finding(analyse(loadSession(wrote('msg_done'))), 'H1c');
    expect(same.verdict).toBe('seen');
    expect(same.evidence.join('\n')).toMatch(/ava: wrote 1 file\(s\) with no shell, re-read before reporting all; the re-read of a\.md was issued in the same response as the task's completion/);
    const later = finding(analyse(loadSession(wrote('msg_read'))), 'H1c');
    expect(later.verdict).toBe('seen');
    expect(later.evidence.join('\n')).not.toMatch(/same response/);
  });

  it('H4: a blocked task started early and refused by the host is a pass, and a normal order is not seen', () => {
    const create = (id: string, n: number, s: number): Rec[] => [call(`c${id}`, 'TaskCreate', { subject: `T${id}` }, s), result(`c${id}`, `Task #${n} created successfully: T${id}`, s + 0.1)];
    const lead = [...create('1', 1, 1), ...create('2', 2, 2), call('u', 'TaskUpdate', { taskId: '2', addBlockedBy: ['1'] }, 3)];
    const early = writeSession(lead, { kaan: { meta: {}, records: [call('k', 'TaskUpdate', { taskId: '2', status: 'in_progress' }, 4), result('k', 'Task #2 is blocked by #1', 5, true)] } });
    const f = finding(analyse(loadSession(early)), 'H4');
    expect(f.verdict).toBe('seen');
    expect(f.evidence.join('\n')).toMatch(/kaan set task 2 .* REFUSED/);
    const ordered = writeSession(lead, { ava: { meta: {}, records: [call('a', 'TaskUpdate', { taskId: '1', status: 'completed' }, 4)] }, kaan: { meta: {}, records: [call('k', 'TaskUpdate', { taskId: '2', status: 'in_progress' }, 5)] } });
    expect(finding(analyse(loadSession(ordered)), 'H4').verdict).toBe('not seen');
  });

  it('H3: more than two exchanges between a pair is called out', () => {
    const send = (i: number, to: string): Rec => call(`m${i}`, 'SendMessage', { to, message: `m${i}` }, i);
    const file = writeSession([], { kaan: { meta: {}, records: [send(1, 'deniz'), send(3, 'deniz'), send(5, 'deniz')] }, deniz: { meta: {}, records: [send(2, 'kaan'), send(4, 'kaan')] } });
    const f = finding(analyse(loadSession(file)), 'H3');
    expect(f.verdict).toBe('seen');
    expect(f.evidence.join('\n')).toMatch(/deniz <-> kaan: 5 messages, more than two exchanges/);
  });

  it('resolves a session by id prefix inside a project directory, and fails clearly when there is none', () => {
    const file = writeSession([], {});
    expect(resolveSessionFile('aaaaaaaa', path.dirname(file))).toBe(file);
    expect(() => resolveSessionFile('zzzz', path.dirname(file))).toThrow(/No session record found/);
  });

  it('parses teammate messages and their structured kind', () => {
    const parsed = parseTeammateMessages('<teammate-message teammate_id="team-lead" summary="x">\n{"type":"shutdown_request","requestId":"a"}\n</teammate-message><teammate-message teammate_id="kaan">hello</teammate-message>');
    expect(parsed.map(p => [p.from, p.kind])).toEqual([['team-lead', 'shutdown_request'], ['kaan', 'text']]);
  });
});

/* ------------------------------------- trimming ------------------------------------- */

describe('trimming a session for a fixture', () => {
  it('drops the system prompt, instruction files, account attachments and thinking, and cuts strings', () => {
    expect(trimRecord({ type: 'attachment', attachment: { type: 'session_context', context: { userEmail: 'someone@example.com' } } })).toBeNull();
    expect(trimRecord({ type: 'attachment', attachment: { type: 'credential_org', organizationUuid: 'x' } })).toBeNull();
    expect(trimRecord({ type: 'attachment', attachment: { type: 'prompt_snapshot', systemPrompt: ['secret'] } })).toBeNull();
    const trimmed = trimRecord({ type: 'assistant', message: { model: 'm', content: [{ type: 'thinking', thinking: 'x', signature: 'y' }, { type: 'tool_use', id: 'i', name: 'Bash', input: { command: 'a'.repeat(1000) } }] } })!;
    const content = (trimmed.message as { content: Array<{ type: string; input?: { command: string } }> }).content;
    expect(content).toHaveLength(1);
    expect(content[0]!.input!.command.length).toBeLessThan(260);
  });

  it('keeps structured teammate messages parseable and masks emails and user names in paths', () => {
    const body = JSON.stringify({ type: 'task_assignment', taskId: '1', description: 'd'.repeat(500) });
    const t = trimRecord({ type: 'user', isSidechain: true, message: { role: 'user', content: `<teammate-message teammate_id="team-lead">\n${body}\n</teammate-message>` } })!;
    const parsed = parseTeammateMessages((t.message as { content: string }).content);
    expect(parsed[0]!.kind).toBe('task_assignment');
    const tool = trimRecord({ type: 'assistant', message: { content: [{ type: 'tool_use', id: 'i', name: 'Bash', input: { command: 'cat C:/Users/alice/x mail me@corp.example' } }] } })!;
    const json = JSON.stringify(tool);
    expect(json).not.toContain('alice');
    expect(json).not.toContain('me@corp.example');
  });

  it('trimSession writes a lead record and its teammates, and the report on the copy equals the report on the original', () => {
    const file = writeSession([call('x', 'Bash', { command: 'echo hi' }, 1), result('x', 'hi', 2), { type: 'cost-state', totalCostUSD: 0.5, modelUsage: {} }], { ava: { meta: { customAgentType: 'agency-growth-strategist' }, records: [call('w', 'Write', { file_path: '/a.md' }, 3)] } });
    const out = tmp();
    const trimmed = trimSession(file, out);
    expect(renderReport(analyse(loadSession(trimmed)))).toBe(renderReport(analyse(loadSession(file))));
  });

  it('the committed fixtures carry no account data', () => {
    const all = [FULL, PETPAL, GUARD, EARLY, PEERS].flatMap(f => {
      const sub = path.join(path.dirname(f), path.basename(f, '.jsonl'), 'subagents');
      return [f, ...fs.readdirSync(sub).map(n => path.join(sub, n))];
    });
    for (const file of all) {
      const text = fs.readFileSync(file, 'utf8');
      expect(text, file).not.toMatch(/altay/i);
      expect(text, file).not.toMatch(/organizationUuid|userEmail|systemPrompt/);
      const emails = [...text.matchAll(/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z.]+/g)].map(m => m[0]).filter(e => e !== 'noreply@anthropic.com' && !/^(team-lead|[a-z]+)@[a-z]+$/.test(e) && !/@(ava|kaan|yavuz|jamileh|jale|selin|deniz|emre|defne)\b/.test(e));
      expect(emails, file).toEqual([]);
    }
  });
});
