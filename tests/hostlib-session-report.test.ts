import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
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
    for (const name of ['emre', 'jale', 'jamileh', 'kaan', 'yavuz']) expect(text).toMatch(new RegExp(`${name}: .* all but `));
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

/* -------------------- synthetic sessions for what the real ones lack -------------------- */

type Rec = Record<string, unknown>;
const T = (s: number): string => new Date(Date.UTC(2026, 9, 5, 9, 0, s)).toISOString();
const call = (id: string, name: string, input: Rec, s: number): Rec => ({ type: 'assistant', timestamp: T(s), isSidechain: false, message: { role: 'assistant', model: 'claude-sonnet-5-5', content: [{ type: 'tool_use', id, name, input }] } });
const result = (id: string, content: string, s: number, isError = false): Rec => ({ type: 'user', timestamp: T(s), isSidechain: false, message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content, is_error: isError }] } });
const mail = (from: string, body: unknown, s: number): Rec => ({ type: 'user', timestamp: T(s), isSidechain: true, message: { role: 'user', content: `<teammate-message teammate_id="${from}">\n${typeof body === 'string' ? body : JSON.stringify(body)}\n</teammate-message>` } });

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
    const all = [FULL, PETPAL].flatMap(f => {
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
