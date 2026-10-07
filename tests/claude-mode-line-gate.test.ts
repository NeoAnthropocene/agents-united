import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import yaml from 'yaml';
import { ClaudeProjector } from '../src/core/claude-projector.js';
import { NATIVE_GUARD_FILES } from '../src/core/guard.js';
import { inspectNativeAgent } from '../src/core/native-guard.js';

/**
 * The mode-line gate (Plan 035 N2 slice e, 2026-10-07).
 *
 * Text did not make the lead write its mode line first: it held in one of eight checks, including two live runs whose prompt asked for the mode in so many words
 * (the lead obeys the user turn and its own plan over a section of its definition). The host's own agent guide says "Prose is not enforcement; a PreToolUse hook is".
 * The probe of 2026-10-07 (session `b164b3d5`, a logging-only hook on a scratch copy of the lead) settled the design:
 * - the transcript does NOT yet hold the current call when PreToolUse fires (0 of 12), and it lags seconds behind (it stayed at 29 lines across eight calls in two
 *   seconds), so a gate that waits for the line to show up would block a lead that did comply. The gate therefore blocks the first call once, and says what to do
 *   when the line was already written ("repeat the call");
 * - the lead's frontmatter hooks also fire for its teammates' calls, which carry an `agent_id`: the gate leaves those alone;
 * - the host runs every matching handler for parallel calls at once: a call that comes within the window of the first block is blocked too, so a message with
 *   three `Agent` calls is held as a whole.
 * Everything that can go wrong inside the gate lets the call through: a gate that wedges the session is worse than a lead that forgets a line.
 */

const SCRIPT = path.resolve('registry/hosts/claude/hooks/agents-united-mode-line-gate.js');
const LEAD = path.resolve('registry/hosts/claude/agents/orchestrator-digital-agency.md');
const LINE = 'Mode: Limited Operational. Callable: Context7, Firecrawl. Missing: GitHub, Playwright, Chrome DevTools, Figma. Extras: Stitch.';

const roots: string[] = [];
const scratch = (): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agents-united-gate-'));
  roots.push(dir);
  return dir;
};
afterAll(() => { for (const dir of roots) fs.rmSync(dir, { recursive: true, force: true }); });

let tmp = '';
let transcript = '';
beforeEach(() => {
  tmp = scratch();
  transcript = path.join(tmp, 'transcript.jsonl');
});

const markerOf = (session: string): string => path.join(tmp, 'agents-united', `mode-line-${session}`);

interface Run { status: number | null; stderr: string; stdout: string }
const run = (payload: object | string, env: Record<string, string> = {}): Run => {
  const result = spawnSync('node', [SCRIPT], {
    input: typeof payload === 'string' ? payload : JSON.stringify(payload),
    encoding: 'utf8',
    env: { ...process.env, TEMP: tmp, TMP: tmp, TMPDIR: tmp, ...env },
  });
  return { status: result.status, stderr: result.stderr, stdout: result.stdout };
};

const call = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  session_id: 'sess-1', transcript_path: transcript, cwd: tmp, hook_event_name: 'PreToolUse', tool_name: 'Agent', tool_input: {}, tool_use_id: 'toolu_1', ...over,
});

const writeTranscript = (...records: object[]): void => fs.writeFileSync(transcript, records.map(record => JSON.stringify(record)).join('\n') + '\n');
const assistantText = (text: string): object => ({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text }] } });

describe('the mode-line gate script', () => {
  it('exists as a committed file, so that no test below passes on a missing script', () => {
    expect(fs.existsSync(SCRIPT)).toBe(true);
  });

  it('blocks the first call of the lead other than ToolSearch, once, and says what to write and what to do if it was written', () => {
    const first = run(call());

    expect(first.status).toBe(2);
    expect(first.stderr).toContain('Mode: <Fully Operational or Limited Operational>. Callable:');
    expect(first.stderr).toContain('"The first message"');
    expect(first.stderr).toMatch(/already began with that line, repeat the call/);
    expect(fs.existsSync(markerOf('sess-1'))).toBe(true);
  });

  it('lets the same session through once the window of the first block has passed', () => {
    expect(run(call()).status).toBe(2);
    const marker = markerOf('sess-1');
    fs.writeFileSync(marker, JSON.stringify({ at: Date.now() - 10_000 }));

    expect(run(call({ tool_use_id: 'toolu_2' })).status).toBe(0);
    expect(run(call({ tool_use_id: 'toolu_3', tool_name: 'Bash' })).status).toBe(0);
  });

  it('holds a parallel call that comes inside the window, so that a message of three Agent calls is held as a whole', () => {
    expect(run(call({ tool_use_id: 'a' })).status).toBe(2);
    expect(run(call({ tool_use_id: 'b' })).status).toBe(2);
    expect(run(call({ tool_use_id: 'c', tool_name: 'Skill' })).status).toBe(2);
  });

  it('never blocks ToolSearch, which the lead needs for the integration check the line reports', () => {
    expect(run(call({ tool_name: 'ToolSearch' })).status).toBe(0);
    expect(fs.existsSync(markerOf('sess-1'))).toBe(false);
  });

  it('leaves the calls of teammates and subagents alone (they carry an agent_id), and keeps no state for them', () => {
    expect(run(call({ agent_id: 'aava-1', agent_type: 'ava' })).status).toBe(0);
    expect(fs.existsSync(markerOf('sess-1'))).toBe(false);
  });

  it('lets the call through when an earlier message of the transcript already opens with the line, and remembers it', () => {
    writeTranscript({ type: 'user', message: { content: 'hello' } }, assistantText(`${LINE}\n\nI am Chris, the lead of the team.`));

    expect(run(call()).status).toBe(0);
    expect(JSON.parse(fs.readFileSync(markerOf('sess-1'), 'utf8')).done).toBe(true);
    expect(run(call({ tool_use_id: 'toolu_2' })).status).toBe(0);
  });

  it('does not take a user message, a mention in the middle of a text or a different mode word for the line', () => {
    writeTranscript(
      { type: 'user', message: { content: LINE } },
      assistantText(`I will begin with ${LINE}`),
      assistantText('Mode: Brainstorming. Callable: none. Missing: all. Extras: none.'),
    );

    expect(run(call()).status).toBe(2);
  });

  it('accepts the line from a transcript whose lines have Windows endings', () => {
    fs.writeFileSync(transcript, `${JSON.stringify(assistantText(`${LINE}\nIntro.`))}\r\n`);

    expect(run(call()).status).toBe(0);
  });

  it('lets everything through when it cannot keep its state: an unusable temp directory, no session id, a bad payload, another event', () => {
    const blocker = path.join(tmp, 'a-file');
    fs.writeFileSync(blocker, 'x');

    expect(run(call(), { TEMP: blocker, TMP: blocker, TMPDIR: blocker }).status).toBe(0);
    expect(run(call({ session_id: undefined })).status).toBe(0);
    expect(run('this is not json').status).toBe(0);
    expect(run(call({ hook_event_name: 'UserPromptSubmit' })).status).toBe(0);
    expect(run(call({ session_id: '../../escape' })).status).toBe(2);
    expect(fs.existsSync(path.join(tmp, 'escape'))).toBe(false);
  });
});

describe('the mode-line gate, wired into the lead', () => {
  const frontmatter = (): Record<string, any> => yaml.parse(/^---\n([\s\S]*?)\n---\n/.exec(fs.readFileSync(LEAD, 'utf8').replace(/\r\n/g, '\n'))![1]);

  it('has a guard kind of its own, named like the other guard scripts', () => {
    expect(NATIVE_GUARD_FILES['mode-line']).toEqual({
      name: 'agents-united-mode-line-gate',
      rel: '.claude/hooks/agents-united-mode-line-gate.js',
      reference: '${CLAUDE_PROJECT_DIR}/.claude/hooks/agents-united-mode-line-gate.js',
    });
  });

  it('is a PreToolUse group of the lead that matches every tool and runs the script file, after the destructive guard', () => {
    const groups = frontmatter().hooks.PreToolUse as Array<{ matcher: string; hooks: Array<{ command: string; args: string[] }> }>;
    const gate = groups.filter(group => group.hooks.some(hook => hook.args.includes(NATIVE_GUARD_FILES['mode-line'].reference)));

    expect(gate).toHaveLength(1);
    expect(gate[0].matcher).toBe('*');
    expect(gate[0].hooks).toEqual([{ type: 'command', command: 'node', args: [NATIVE_GUARD_FILES['mode-line'].reference] }]);
    expect(groups.indexOf(gate[0])).toBe(groups.length - 1);
    expect(groups.length).toBeGreaterThan(1);
  });

  it('is read by the inspection as a guard file of the lead, which keeps its destructive guard', () => {
    const facts = inspectNativeAgent(fs.readFileSync(LEAD, 'utf8'));

    expect(facts.guard).toBe('destructive');
    expect(facts.guardFiles).toEqual(expect.arrayContaining(['destructive', 'mode-line']));
  });

  it('is carried by no other role', () => {
    const dir = path.resolve('registry/hosts/claude/agents');
    for (const file of fs.readdirSync(dir).filter(name => name.endsWith('.md') && name !== 'orchestrator-digital-agency.md')) {
      expect(fs.readFileSync(path.join(dir, file), 'utf8'), file).not.toContain('agents-united-mode-line-gate');
    }
  });

  it('is installed with the lead as a tracked script, and a global install keeps the inline guard without it', () => {
    const registry = path.resolve('registry');
    const kinds = ClaudeProjector.nativeGuardKinds(registry, ['orchestrator-digital-agency', 'agency-seo-specialist']);
    const artifacts = ClaudeProjector.nativeGuardArtifacts(registry, kinds);

    expect(kinds).toEqual(expect.arrayContaining(['destructive', 'mode-line']));
    expect(artifacts.map(artifact => artifact.relPath)).toContain('.claude/hooks/agents-united-mode-line-gate.js');
    expect(artifacts.every(artifact => artifact.managedMarker === true)).toBe(true);

    const global = ClaudeProjector.nativeRoleContent(registry, 'orchestrator-digital-agency', '.agents/agents/orchestrator-digital-agency.md', 'inline') ?? '';
    expect(global).not.toContain('agents-united-mode-line-gate');
    expect(global).toContain('PreToolUse');
  });

  it('is the script that the generated constant says it is', async () => {
    const { MODE_LINE_GATE_SCRIPT } = await import('../src/core/mode-line-gate.js');

    expect(fs.readFileSync(SCRIPT, 'utf8')).toBe(`${MODE_LINE_GATE_SCRIPT}\n`);
  });
});
