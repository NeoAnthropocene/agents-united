/**
 * Plan 035 S8: read a Claude Code session's own records (the lead's `<session>.jsonl` and the
 * `<session>/subagents/*.jsonl` of each teammate with its `.meta.json`) and report what happened:
 * tool calls, the task and message flow, hook and error records, models, cost, and a verdict for each of
 * the seven open items of the live-test protocol (`docs/live-test-protocol.md`).
 *
 * The records are the host's, not the model's answer. Nothing here calls a model or a network; a
 * transcript is read, never changed. `trimSession` writes a small, sanitised copy for use as a test
 * fixture (no account data, no system prompt, no instruction files, strings cut short).
 *
 *   npm run hostlib:session -- <lead.jsonl | session-id> [--project <dir>] [--json]
 *   npm run hostlib:session -- trim <lead.jsonl> --out <dir>
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

type Json = Record<string, unknown>;

export interface ToolCall {
  id: string;
  name: string;
  input: Json;
  at: string;
  isError?: boolean;
  result?: string;
}

export interface Received {
  from: string;
  at: string;
  kind: string;
  text: string;
}

export interface AgentRecord {
  name: string;
  isLead: boolean;
  customAgentType?: string;
  taskKind?: string;
  teamName?: string;
  permissionMode?: string;
  metaModel?: string;
  models: string[];
  calls: ToolCall[];
  received: Received[];
  finalText: string;
  firstPrompt: string;
}

export interface Session {
  sessionId: string;
  cwd?: string;
  version?: string;
  agentSetting?: string;
  permissionMode?: string;
  startedAt?: string;
  endedAt?: string;
  prompts: number;
  cost?: { totalCostUSD: number; totalAPIDurationMs?: number; totalDurationMs?: number; byModel: Record<string, { inputTokens: number; outputTokens: number; cacheReadInputTokens: number; costUSD: number }> };
  agents: AgentRecord[];
}

export type Verdict = 'seen' | 'not seen' | 'violation' | 'not applicable';

export interface Finding {
  id: string;
  title: string;
  verdict: Verdict;
  evidence: string[];
}

export interface Analysis {
  session: Session;
  findings: Finding[];
}

const GUARD_MARK = 'Blocked by agents-united guard';
const WRITE_TOOLS = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit']);
const SHELL_TOOLS = new Set(['Bash', 'PowerShell']);

function readJsonl(file: string): Json[] {
  const out: Json[] = [];
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (line.trim() === '') continue;
    try {
      const value: unknown = JSON.parse(line);
      if (value !== null && typeof value === 'object') out.push(value as Json);
    } catch {
      // a half-written last line of a live session: skip it
    }
  }
  return out;
}

const str = (value: unknown): string => (typeof value === 'string' ? value : '');
const obj = (value: unknown): Json => (value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Json) : {});
const arr = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

function resultText(content: unknown): string {
  if (typeof content === 'string') return content;
  return arr(content)
    .map(block => {
      const b = obj(block);
      return b.type === 'text' ? str(b.text) : b.type === 'tool_reference' ? `[tool_reference ${str(b.tool_name)}]` : '';
    })
    .filter(Boolean)
    .join('\n');
}

/** The messages a teammate receives arrive as user records: `<teammate-message teammate_id="x" ...>body</teammate-message>`. */
export function parseTeammateMessages(content: string): Array<{ from: string; kind: string; text: string }> {
  const out: Array<{ from: string; kind: string; text: string }> = [];
  for (const match of content.matchAll(/<teammate-message([^>]*)>\s*([\s\S]*?)\s*<\/teammate-message>/g)) {
    const from = /teammate_id="([^"]*)"/.exec(match[1] ?? '')?.[1] ?? 'unknown';
    const body = (match[2] ?? '').trim();
    let kind = 'text';
    if (body.startsWith('{')) {
      try {
        kind = str(obj(JSON.parse(body)).type) || 'json';
      } catch {
        kind = 'text';
      }
    }
    out.push({ from, kind, text: body });
  }
  return out;
}

function buildAgent(records: Json[], name: string, isLead: boolean, meta: Json): AgentRecord {
  const agent: AgentRecord = {
    name,
    isLead,
    customAgentType: str(meta.customAgentType) || undefined,
    taskKind: str(meta.taskKind) || undefined,
    teamName: str(meta.teamName) || undefined,
    permissionMode: str(meta.permissionMode) || undefined,
    metaModel: str(meta.model) || undefined,
    models: [],
    calls: [],
    received: [],
    finalText: '',
    firstPrompt: '',
  };
  const byId = new Map<string, ToolCall>();
  for (const rec of records) {
    const at = str(rec.timestamp);
    const message = obj(rec.message);
    if (rec.type === 'assistant') {
      const model = str(message.model);
      if (model && !agent.models.includes(model)) agent.models.push(model);
      for (const raw of arr(message.content)) {
        const block = obj(raw);
        if (block.type === 'tool_use') {
          const call: ToolCall = { id: str(block.id), name: str(block.name), input: obj(block.input), at };
          agent.calls.push(call);
          byId.set(call.id, call);
        } else if (block.type === 'text' && str(block.text).trim() !== '') {
          agent.finalText = str(block.text);
        }
      }
    } else if (rec.type === 'user') {
      const content = message.content;
      if (typeof content === 'string') {
        const parsed = parseTeammateMessages(content);
        if (parsed.length > 0) for (const p of parsed) agent.received.push({ from: p.from, at, kind: p.kind, text: p.text });
        else if (agent.firstPrompt === '' && !isLead) agent.firstPrompt = content;
      } else {
        for (const raw of arr(content)) {
          const block = obj(raw);
          if (block.type === 'tool_result') {
            const call = byId.get(str(block.tool_use_id));
            if (call) {
              call.result = resultText(block.content);
              call.isError = block.is_error === true;
            }
          }
        }
      }
    }
  }
  if (!isLead && agent.firstPrompt === '' && agent.received.length > 0) agent.firstPrompt = agent.received[0]?.text ?? '';
  return agent;
}

/** Load the lead's record and every teammate record beside it. */
export function loadSession(leadFile: string): Session {
  const records = readJsonl(leadFile);
  const sessionId = path.basename(leadFile, '.jsonl');
  const lead = buildAgent(records.filter(r => r.isSidechain !== true), 'lead', true, {});
  const session: Session = { sessionId, prompts: 0, agents: [lead] };
  const promptIds = new Set<string>();
  for (const rec of records) {
    const at = str(rec.timestamp);
    if (at !== '') {
      if (!session.startedAt || at < session.startedAt) session.startedAt = at;
      if (!session.endedAt || at > session.endedAt) session.endedAt = at;
    }
    session.cwd ??= str(rec.cwd) || undefined;
    session.version ??= str(rec.version) || undefined;
    if (rec.type === 'agent-setting') session.agentSetting = str(rec.agentSetting);
    if (rec.type === 'permission-mode') session.permissionMode = str(rec.permissionMode);
    if (rec.type === 'user' && rec.isSidechain !== true && typeof obj(rec.message).content === 'string' && !str(obj(rec.message).content).startsWith('<teammate-message') && str(rec.promptId) !== '') promptIds.add(str(rec.promptId));
    if (rec.type === 'cost-state') {
      const byModel: NonNullable<Session['cost']>['byModel'] = {};
      for (const [model, usage] of Object.entries(obj(rec.modelUsage))) {
        const u = obj(usage);
        byModel[model] = { inputTokens: Number(u.inputTokens ?? 0), outputTokens: Number(u.outputTokens ?? 0), cacheReadInputTokens: Number(u.cacheReadInputTokens ?? 0), costUSD: Number(u.costUSD ?? 0) };
      }
      session.cost = { totalCostUSD: Number(rec.totalCostUSD ?? 0), totalAPIDurationMs: Number(rec.totalAPIDuration ?? 0), totalDurationMs: Number(rec.totalDuration ?? 0), byModel };
    }
  }
  session.prompts = promptIds.size;
  const subDir = path.join(path.dirname(leadFile), sessionId, 'subagents');
  if (fs.existsSync(subDir)) {
    for (const file of fs.readdirSync(subDir).filter(f => f.endsWith('.jsonl')).sort()) {
      const metaFile = path.join(subDir, file.replace(/\.jsonl$/, '.meta.json'));
      const meta = fs.existsSync(metaFile) ? obj(JSON.parse(fs.readFileSync(metaFile, 'utf8'))) : {};
      const name = str(meta.name) || file.replace(/^agent-a?/, '').replace(/-[0-9a-f]{8,}\.jsonl$/, '');
      session.agents.push(buildAgent(readJsonl(path.join(subDir, file)), name, false, meta));
    }
  }
  return session;
}

/** Find a lead record from a path, or from a session id under `~/.claude/projects/<project>/`. */
export function resolveSessionFile(arg: string, projectDir?: string): string {
  if (fs.existsSync(arg) && fs.statSync(arg).isFile()) return path.resolve(arg);
  const roots = projectDir ? [projectDir] : fs.existsSync(path.join(os.homedir(), '.claude', 'projects')) ? fs.readdirSync(path.join(os.homedir(), '.claude', 'projects')).map(d => path.join(os.homedir(), '.claude', 'projects', d)) : [];
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    const hit = fs.readdirSync(root).find(f => f.endsWith('.jsonl') && f.startsWith(arg));
    if (hit) return path.join(root, hit);
  }
  throw new Error(`No session record found for "${arg}"${projectDir ? ` in ${projectDir}` : ''}`);
}

const norm = (p: string): string => p.replace(/\\/g, '/').toLowerCase();
const short = (text: string, n = 140): string => (text.length > n ? `${text.slice(0, n)}...` : text).replace(/\s+/g, ' ');
const filePathOf = (call: ToolCall): string => str(call.input.file_path) || str(call.input.notebook_path) || str(call.input.path);
// The last segment of a recorded path, whichever separator it uses: the records hold the paths of the machine that ran the session (Windows here),
// and `path.basename` splits only on this platform's separator, so on Linux a Windows path came back whole.
const baseName = (p: string): string => p.replace(/\\/g, '/').split('/').pop() ?? p;

function jsonOf(text: string): Json | undefined {
  const t = text.trim();
  if (!t.startsWith('{')) return undefined;
  try {
    return obj(JSON.parse(t));
  } catch {
    return undefined;
  }
}

/** What a structured message says (`{"type": ...}`), whether the call carried it as an object or as JSON text. */
const structuredOf = (message: unknown): Json | undefined => (typeof message === 'string' ? jsonOf(message) : typeof message === 'object' && message !== null ? obj(message) : undefined);

/**
 * The `tools:` line of a Claude role: from the copy installed in the session's own project, else from this repository's native file (read from
 * the working directory, as the other hostlib commands read `registry/`). `'*'` when the file has no `tools:` key (the role holds every tool);
 * undefined when the role is unknown here, and the caller then goes by what the session shows.
 */
function roleTools(type: string | undefined, cwd: string | undefined): string | undefined {
  if (!type) return undefined;
  for (const file of [cwd ? path.join(cwd, '.claude', 'agents', `${type}.md`) : '', path.resolve('registry/hosts/claude/agents', `${type}.md`)]) {
    if (file === '' || !fs.existsSync(file)) continue;
    const front = /^---\r?\n([\s\S]*?)\r?\n---/.exec(fs.readFileSync(file, 'utf8'));
    if (!front) continue;
    const line = /^tools:[ \t]*(.*?)\r?$/m.exec(front[1]!);
    return line ? line[1] || undefined : '*';
  }
  return undefined;
}

const grantsShell = (tools: string): boolean => tools === '*' || /(^|[\s,])(Bash|PowerShell)(?=[\s,]|$)/.test(tools.replace(/\([^)]*\)/g, ''));

function consultationFinding(session: Session): Finding {
  const evidence: string[] = [];
  let violation = false;
  let applicable = false;
  for (const a of session.agents.filter(x => !x.isLead)) {
    if (!/read-only consultation|write no files/i.test(a.firstPrompt)) continue;
    applicable = true;
    const assignment = a.received.find(r => r.kind === 'task_assignment');
    const firstWrite = a.calls.find(c => WRITE_TOOLS.has(c.name));
    if (!assignment) {
      evidence.push(`${a.name}: consulted read-only, no task assignment was delivered during the consultation`);
      continue;
    }
    const accepting = a.received.slice(1).find(r => r.kind === 'text' && /accepted|deliver (task|now)|go ahead|now (write|deliver)/i.test(r.text));
    if (firstWrite && assignment.at <= firstWrite.at && !(accepting && accepting.at <= firstWrite.at)) {
      violation = true;
      evidence.push(`${a.name}: a task_assignment arrived at ${assignment.at} and the first ${firstWrite.name} (${short(filePathOf(firstWrite), 60)}) came at ${firstWrite.at} before any accepting message: the read-only consultation was lifted`);
    } else {
      evidence.push(`${a.name}: ${firstWrite ? `wrote only after an accepting message (${firstWrite.at})` : 'received an assignment during the consultation and wrote nothing'}`);
    }
  }
  if (!applicable) return { id: 'H1a', title: 'A task owner set on a running teammate lifts a read-only consultation', verdict: 'not applicable', evidence: ['no teammate was briefed as a read-only consultation'] };
  return { id: 'H1a', title: 'A task owner set on a running teammate lifts a read-only consultation', verdict: violation ? 'violation' : 'seen', evidence };
}

function shutdownFinding(session: Session): Finding {
  const lead = session.agents.find(a => a.isLead);
  const sends = lead ? lead.calls.filter(c => c.name === 'SendMessage') : [];
  let structured = 0;
  let plain = 0;
  const evidence: string[] = [];
  for (const call of sends) {
    const message = call.input.message;
    const m = typeof message === 'string' ? jsonOf(message) : obj(message);
    const type = m ? str(m.type) : '';
    if (type === 'shutdown_request') structured += 1;
    else if (typeof message === 'string' && /shut ?down|stand down|wrap up/i.test(message) && !m) {
      plain += 1;
      evidence.push(`plain-text shutdown request to ${str(call.input.to)} at ${call.at}: "${short(message, 80)}"`);
    }
  }
  const responses = session.agents.flatMap(a => a.received.filter(r => r.kind === 'shutdown_response' || r.kind === 'shutdown_approved'));
  const refusals = (lead ? lead.received : []).filter(r => /request_id/i.test(r.text) && /shut ?down/i.test(r.text));
  evidence.unshift(`structured shutdown_request: ${structured}, plain-text shutdown requests: ${plain}, shutdown responses received by the lead: ${responses.length}`);
  // The teammates' own replies, from their own records: the lead's record carries one only if the lead was still reading when it arrived
  // (session aa5e73e8: the probe answered, the lead's record shows none).
  const replies = session.agents.filter(a => !a.isLead).flatMap(a => a.calls.filter(c => c.name === 'SendMessage').map(c => structuredOf(c.input.message)).filter((m): m is Json => m !== undefined && str(m.type) === 'shutdown_response'));
  evidence.splice(1, 0, `shutdown responses sent by teammates: ${replies.length} of ${structured} requested (approved ${replies.filter(m => m.approve === true).length})`);
  if (refusals.length > 0) evidence.push(`${refusals.length} reply(ies) mention a missing request_id`);
  const verdict: Verdict = structured + plain === 0 ? 'not seen' : plain > 0 ? 'violation' : 'seen';
  return { id: 'H1b', title: 'Shutdown is asked with a structured shutdown_request', verdict, evidence };
}

function rereadFinding(session: Session): Finding {
  const evidence: string[] = [];
  let anyShellLess = false;
  let violation = false;
  for (const a of session.agents.filter(x => !x.isLead)) {
    // A role is shell-less by the tools of its manifest, not by the calls it happened to make (session fec45100: Deniz holds a shell and made
    // none); a role this repository does not know is judged by what the session shows.
    const tools = roleTools(a.customAgentType, session.cwd);
    const hasShell = tools !== undefined ? grantsShell(tools) : a.calls.some(c => SHELL_TOOLS.has(c.name));
    const writes = a.calls.filter(c => WRITE_TOOLS.has(c.name));
    if (hasShell || writes.length === 0) continue;
    anyShellLess = true;
    const missed: string[] = [];
    for (const w of writes) {
      const p = norm(filePathOf(w));
      if (!a.calls.some(c => c.name === 'Read' && norm(filePathOf(c)) === p && c.at >= w.at)) missed.push(baseName(filePathOf(w)));
    }
    const unique = [...new Set(missed)];
    if (unique.length > 0) violation = true;
    evidence.push(`${a.name}: wrote ${new Set(writes.map(w => norm(filePathOf(w)))).size} file(s) with no shell, re-read before reporting ${unique.length === 0 ? 'all' : `all but ${unique.join(', ')}`}`);
  }
  if (!anyShellLess) return { id: 'H1c', title: 'Shell-less roles re-read their files before reporting', verdict: 'not applicable', evidence: ['no shell-less teammate wrote a file'] };
  return { id: 'H1c', title: 'Shell-less roles re-read their files before reporting', verdict: violation ? 'violation' : 'seen', evidence };
}

function peerFinding(session: Session): Finding {
  const names = new Set(session.agents.filter(a => !a.isLead).map(a => a.name));
  const pairs = new Map<string, number>();
  const evidence: string[] = [];
  for (const a of session.agents.filter(x => !x.isLead)) {
    for (const c of a.calls.filter(x => x.name === 'SendMessage')) {
      const to = str(c.input.to);
      if (names.has(to)) {
        const key = [a.name, to].sort().join(' <-> ');
        pairs.set(key, (pairs.get(key) ?? 0) + 1);
        evidence.push(`${a.name} -> ${to} at ${c.at}: ${short(str(c.input.summary) || (typeof c.input.message === 'string' ? c.input.message : ''), 90)}`);
      }
    }
  }
  const received = session.agents.filter(a => !a.isLead).flatMap(a => a.received.filter(r => names.has(r.from)));
  evidence.unshift(`peer messages sent: ${[...pairs.values()].reduce((s, n) => s + n, 0)} across ${pairs.size} pair(s); received from a peer: ${received.length}`);
  for (const [pair, n] of pairs) {
    if (n > 4) evidence.push(`${pair}: ${n} messages, more than two exchanges`);
  }
  return { id: 'H3', title: 'A peer exchange between teammates without a fixed contract', verdict: pairs.size > 0 ? 'seen' : 'not seen', evidence };
}

interface TaskState {
  subject: string;
  status: string;
  blockedBy: string[];
}

function blockedFinding(session: Session): Finding {
  const events: Array<{ at: string; agent: string; call: ToolCall }> = [];
  for (const a of session.agents) for (const c of a.calls) if (c.name === 'TaskCreate' || c.name === 'TaskUpdate') events.push({ at: c.at, agent: a.name, call: c });
  events.sort((x, y) => x.at.localeCompare(y.at));
  const tasks = new Map<string, TaskState>();
  let nextId = 1;
  const evidence: string[] = [];
  let early = 0;
  let refused = 0;
  let accepted = 0;
  for (const e of events) {
    const input = e.call.input;
    if (e.call.name === 'TaskCreate') {
      const idFromResult = /#?(\d+)/.exec(e.call.result ?? '')?.[1];
      const id = idFromResult ?? String(nextId);
      nextId = Number(id) + 1;
      tasks.set(id, { subject: str(input.subject), status: 'pending', blockedBy: [] });
      continue;
    }
    const id = String(input.taskId ?? '');
    const task = tasks.get(id) ?? { subject: `#${id}`, status: 'pending', blockedBy: [] };
    tasks.set(id, task);
    for (const b of arr(input.addBlockedBy)) task.blockedBy.push(String(b));
    const status = str(input.status);
    if (status === 'in_progress') {
      const open = task.blockedBy.filter(b => tasks.get(b)?.status !== 'completed');
      if (open.length > 0) {
        early += 1;
        if (e.call.isError) refused += 1;
        else accepted += 1;
        evidence.push(`${e.agent} set task ${id} (${short(task.subject, 50)}) to in_progress at ${e.at} while blocked by ${open.join(', ')}: the host ${e.call.isError ? 'REFUSED' : 'ACCEPTED'} it ("${short(e.call.result ?? '', 100)}")`);
      }
    }
    if (status !== '' && !e.call.isError) {
      if (task.status === 'completed' && status !== 'completed') evidence.push(`${e.agent} moved task ${id} from completed back to ${status} at ${e.at}`);
      task.status = status;
    }
  }
  evidence.unshift(`${events.length} task call(s), ${tasks.size} task(s); starts while blocked: ${early} (refused ${refused}, accepted ${accepted})`);
  return { id: 'H4', title: 'The host refuses a blocked task started early', verdict: refused > 0 ? 'seen' : accepted > 0 ? 'violation' : 'not seen', evidence };
}

function guardFinding(session: Session): Finding {
  const evidence: string[] = [];
  for (const a of session.agents) {
    for (const c of a.calls) {
      if ((c.result ?? '').includes(GUARD_MARK)) evidence.push(`${a.name}: ${c.name} refused by the guard (${c.isError ? 'is_error' : 'not flagged as an error'}): ${short(str(c.input.command) || filePathOf(c), 70)}`);
    }
  }
  const verdict: Verdict = evidence.length > 0 ? 'seen' : 'not seen';
  if (verdict === 'not seen') evidence.push('no tool result carries the guard block message');
  return { id: 'H5', title: 'The settings-level guard refuses a command it names, in a team', verdict, evidence };
}

function mcpFinding(session: Session): Finding {
  const per = new Map<string, number>();
  for (const a of session.agents) for (const c of a.calls) if (c.name.startsWith('mcp__')) per.set(`${a.name}: ${c.name.split('__')[1] ?? c.name}`, (per.get(`${a.name}: ${c.name.split('__')[1] ?? c.name}`) ?? 0) + 1);
  const evidence = [...per].map(([k, n]) => `${k}: ${n} call(s)`);
  return { id: 'H6', title: 'MCP-backed tools are called', verdict: per.size > 0 ? 'seen' : 'not seen', evidence: evidence.length > 0 ? evidence : ['no tool call has an mcp__ name'] };
}

function modelFinding(session: Session): Finding {
  const lead = session.agents.find(a => a.isLead);
  const evidence = [`lead models: ${lead && lead.models.length > 0 ? lead.models.join(', ') : 'none recorded'}`, `agent setting: ${session.agentSetting ?? 'none'}, permission mode: ${session.permissionMode ?? 'unknown'}`];
  for (const a of session.agents.filter(x => !x.isLead)) evidence.push(`${a.name}: model ${a.metaModel ?? 'unknown'} (messages: ${a.models.join(', ') || 'none'}), type ${a.customAgentType ?? 'unknown'}, ${a.taskKind ?? 'unknown'}`);
  const opus = (lead?.models ?? []).some(m => /opus/i.test(m));
  return { id: 'H2/H7', title: 'The lead runs on its pinned Opus', verdict: opus ? 'seen' : 'not seen', evidence };
}

export function analyse(session: Session): Analysis {
  return { session, findings: [consultationFinding(session), shutdownFinding(session), rereadFinding(session), modelFinding(session), peerFinding(session), blockedFinding(session), guardFinding(session), mcpFinding(session)] };
}

function counts(calls: ToolCall[]): string {
  const m = new Map<string, number>();
  for (const c of calls) m.set(c.name, (m.get(c.name) ?? 0) + 1);
  return [...m].sort((a, b) => b[1] - a[1]).map(([n, k]) => `${n} ${k}`).join(', ') || 'none';
}

export function renderReport(analysis: Analysis): string {
  const { session, findings } = analysis;
  const out: string[] = [];
  out.push(`# Session ${session.sessionId}`);
  out.push(`cwd ${session.cwd ?? 'unknown'} · Claude Code ${session.version ?? 'unknown'} · agent ${session.agentSetting ?? 'none'} · permission mode ${session.permissionMode ?? 'unknown'}`);
  out.push(`from ${session.startedAt ?? '?'} to ${session.endedAt ?? '?'} · ${session.prompts} prompt(s) · ${session.agents.length - 1} teammate record(s)`);
  if (session.cost) {
    out.push(`cost ${session.cost.totalCostUSD.toFixed(4)} USD (the session's own record) · API ${Math.round((session.cost.totalAPIDurationMs ?? 0) / 1000)} s · wall ${Math.round((session.cost.totalDurationMs ?? 0) / 1000)} s`);
    for (const [model, u] of Object.entries(session.cost.byModel)) out.push(`  ${model}: ${u.inputTokens} in, ${u.outputTokens} out, ${u.cacheReadInputTokens} cache-read, ${u.costUSD.toFixed(4)} USD`);
  } else {
    out.push('cost: no cost-state record (the session did not end cleanly, or this host build does not write one)');
  }
  out.push('', '## Findings (the seven open items)');
  for (const f of findings) {
    out.push(`- ${f.id} ${f.title}: **${f.verdict}**`);
    for (const e of f.evidence) out.push(`    ${e}`);
  }
  out.push('', '## Agents');
  for (const a of session.agents) {
    out.push(`- ${a.name}${a.customAgentType ? ` (${a.customAgentType})` : ''}: ${counts(a.calls)}`);
    const errors = a.calls.filter(c => c.isError);
    for (const e of errors) out.push(`    error in ${e.name} at ${e.at}: ${short(e.result ?? '', 110)}`);
    const reported = /peer messages received/i.test(a.finalText) && /open items/i.test(a.finalText);
    if (!a.isLead) out.push(`    final report has Peer messages received and Open items: ${reported ? 'yes' : 'no'}`);
  }
  const lead = session.agents.find(a => a.isLead);
  if (lead) {
    out.push('', '## Lead: team flow');
    for (const c of lead.calls.filter(x => ['Agent', 'TaskCreate', 'TaskUpdate', 'SendMessage'].includes(x.name))) {
      const i = c.input;
      const what = c.name === 'Agent' ? `spawn ${str(i.name)} as ${str(i.subagent_type)}` : c.name === 'TaskCreate' ? `task "${short(str(i.subject), 60)}"` : c.name === 'TaskUpdate' ? `task ${str(i.taskId)} ${[str(i.status), i.owner ? `owner ${str(i.owner)}` : '', arr(i.addBlockedBy).length ? `blockedBy ${arr(i.addBlockedBy).join(',')}` : ''].filter(Boolean).join(' ')}` : `message to ${str(i.to)}: ${short(typeof i.message === 'string' ? i.message : JSON.stringify(i.message), 70)}`;
      out.push(`  ${c.at.slice(11, 19)} ${c.name} ${what}${c.isError ? ' [error]' : ''}`);
    }
  }
  return out.join('\n');
}

/* ----------------------------- fixtures: trim a session ----------------------------- */

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z.]+/g;

function clean(text: string, max: number): string {
  const cleaned = text.replace(EMAIL, m => (m === 'noreply@anthropic.com' ? m : 'user@example.invalid')).replace(/(Users[\\/])[^\\/"\s]+/gi, '$1user');
  return cleaned.length > max ? `${cleaned.slice(0, max)}...` : cleaned;
}

function cutStrings(value: unknown, max: number): unknown {
  if (typeof value === 'string') return clean(value, max);
  if (Array.isArray(value)) return value.map(v => cutStrings(v, max));
  if (value !== null && typeof value === 'object') return Object.fromEntries(Object.entries(value as Json).map(([k, v]) => [k, cutStrings(v, max)]));
  return value;
}

function trimTeammateText(text: string): string {
  return text.replace(/(<teammate-message[^>]*>)\s*([\s\S]*?)\s*(<\/teammate-message>)/g, (_all, open: string, body: string, close: string) => {
    const j = jsonOf(body);
    return `${open}\n${j ? JSON.stringify(cutStrings(j, 160)) : clean(body, 400)}\n${close}`;
  });
}

/** One trimmed record, or null when the record type carries nothing the report reads. */
export function trimRecord(rec: Json): Json | null {
  const keep: Json = { type: rec.type, timestamp: rec.timestamp, isSidechain: rec.isSidechain, sessionId: rec.sessionId };
  switch (rec.type) {
    case 'user': {
      const message = obj(rec.message);
      const content = message.content;
      keep.promptId = rec.promptId;
      keep.agentId = rec.agentId;
      if (typeof content === 'string') {
        keep.message = { role: 'user', content: content.includes('<teammate-message') ? trimTeammateText(content) : clean(content, 400) };
      } else {
        keep.message = {
          role: 'user',
          content: arr(content).map(raw => {
            const b = obj(raw);
            if (b.type === 'tool_result') return { type: 'tool_result', tool_use_id: b.tool_use_id, is_error: b.is_error, content: clean(resultText(b.content), 300) };
            return { type: 'text', text: clean(str(b.text), 300) };
          }),
        };
      }
      keep.cwd = rec.cwd;
      keep.version = rec.version;
      return keep;
    }
    case 'assistant': {
      const message = obj(rec.message);
      keep.agentId = rec.agentId;
      keep.message = {
        role: 'assistant',
        model: message.model,
        content: arr(message.content).flatMap((raw): Json[] => {
          const b = obj(raw);
          if (b.type === 'tool_use') return [{ type: 'tool_use', id: b.id, name: b.name, input: cutStrings(b.input, 240) }];
          if (b.type === 'text') return [{ type: 'text', text: clean(str(b.text), 1500) }];
          return [];
        }),
      };
      return keep;
    }
    case 'attachment': {
      const a = obj(rec.attachment);
      if (/^hook_|hook$/.test(str(a.type))) {
        keep.attachment = cutStrings(a, 300);
        return keep;
      }
      return null;
    }
    case 'system':
      keep.subtype = rec.subtype;
      keep.durationMs = rec.durationMs;
      return keep;
    case 'cost-state':
    case 'agent-setting':
    case 'permission-mode':
      return { ...obj(cutStrings(rec, 120)) };
    default:
      return null;
  }
}

/** Write a sanitised, shortened copy of a session (lead and teammates) under `outDir`. Returns the lead file. */
export function trimSession(leadFile: string, outDir: string): string {
  const id = path.basename(leadFile, '.jsonl');
  fs.mkdirSync(path.join(outDir, id, 'subagents'), { recursive: true });
  const write = (from: string, to: string): void => {
    const lines = readJsonl(from).map(trimRecord).filter((r): r is Json => r !== null).map(r => JSON.stringify(r));
    fs.writeFileSync(to, lines.join('\n') + '\n');
  };
  const leadOut = path.join(outDir, `${id}.jsonl`);
  write(leadFile, leadOut);
  const subDir = path.join(path.dirname(leadFile), id, 'subagents');
  if (fs.existsSync(subDir)) {
    for (const file of fs.readdirSync(subDir)) {
      const to = path.join(outDir, id, 'subagents', file);
      if (file.endsWith('.jsonl')) write(path.join(subDir, file), to);
      else if (file.endsWith('.meta.json')) fs.writeFileSync(to, JSON.stringify(cutStrings(JSON.parse(fs.readFileSync(path.join(subDir, file), 'utf8')), 120)));
    }
  }
  return leadOut;
}
