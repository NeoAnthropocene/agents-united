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
    expect(fs.existsSync(markerOf('sess-1'))).toBe(true);
  });

  // Live test 6 (session `1aa049c5`, `agents start`, Opus): the gate held the first Bash call, and the lead answered "My last message already began with the mode line,
  // so I'm running the check again as the hook says". It had written no text at all before that call. The first version of the message ended "If your last message
  // already began with that line, repeat the call now", and the lead took that way out falsely. The gate cannot see the message that is being written (the transcript
  // never holds the current call), so it says so, holds the call once whatever the lead believes, and asks for the line to be written again if need be.
  it('holds the call whatever the lead believes it wrote, and says why, so that there is no way out to claim', () => {
    const { stderr } = run(call());

    expect(stderr).toContain('Do this even if you believe you wrote it already');
    expect(stderr).toContain('the host cannot see the message you are writing, so this call is held once');
    expect(stderr).toContain('write the line in the same message as the call you repeat');
    expect(stderr).not.toMatch(/already began with that line, repeat the call/);
    expect(stderr).not.toMatch(/if your last message/i);
  });

  // N3 regression run (session `8e2c3d9e`): the host prints a held call to the user as "Error: PreToolUse:Agent hook error: [node ...]: <this message>", at the start of every
  // session, and the maintainer read the held spawn as a failure of the spawned agent (it was the lead's first call, held once by design; the spawned agent had no hook error).
  // The host's own prefix cannot be changed, so the first line of the message says in plain words that the hold is expected and happens once, and it keeps "Mode line first"
  // because the lead's definition and a test name it.
  it('says in its first line, in plain words, that the hold is expected and happens once, because the host shows it to the user as an error', () => {
    const first = run(call()).stderr.split('\n')[0]!;

    expect(first).toMatch(/^Mode line first\./);
    expect(first).toContain('expected one-time hold');
    expect(first).toContain('not a failure');
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

  // The script is installed into a user's project, whose package.json may say "type": "module" (this repository's does): a `.js` file is then an ES module and a
  // `require` call would crash it, which the host reads as a hook that could not start, and lets the call through. The guards avoid `require` for the same reason.
  it('blocks the first call in a CommonJS project and in an ES-module project alike', () => {
    for (const scope of ['commonjs', 'module']) {
      const dir = path.join(tmp, scope);
      fs.mkdirSync(dir, { recursive: true });
      fs.copyFileSync(SCRIPT, path.join(dir, 'gate.js'));
      fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ type: scope }));
      const result = spawnSync('node', [path.join(dir, 'gate.js')], {
        input: JSON.stringify(call({ session_id: `scope-${scope}` })),
        encoding: 'utf8',
        env: { ...process.env, TEMP: tmp, TMP: tmp, TMPDIR: tmp },
      });

      expect([scope, result.status, result.stderr.includes('Mode line first')]).toEqual([scope, 2, true]);
    }
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

    expect(fs.readFileSync(SCRIPT, 'utf8').replace(/\r\n/g, '\n')).toBe(`${MODE_LINE_GATE_SCRIPT}\n`);
  });
});
