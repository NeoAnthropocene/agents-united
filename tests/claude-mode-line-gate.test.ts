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
 * R2 (`75b89b2c`) disproved the two-second release window: a held Bash call and an allowed Agent call shared one assistant response 3.433 seconds apart,
 * and the lead never wrote its mode line. A readable transcript must show the line before lead calls pass, even if the host saves the current response late.
 * ToolSearch and teammate calls stay outside the gate. I/O errors fail open; readable but delayed evidence keeps the call held.
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
  fs.writeFileSync(transcript, '');
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

  it('blocks a lead call without a saved mode line and says what to write', () => {
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
  // Changed after Sitting R (2026-10-12, ADR 0051) and changed back, in part, after Sitting S. After Sitting R the message dropped "Do this even if you believe you wrote it already" and told a lead
  // that had written the line as a text block to repeat the call alone. In Sitting S (H10k2 `a7acda03`, G1 `7c3e1121`) both leads had the line only in their reasoning ("Running in Limited Operational
  // mode ... As Chris, lead of the digital agency team ...") and believed that they had written it: one repeated the call alone 11 times and stopped ("Writing the line again would go against my own rule"),
  // the other was held 13 times, told the user that the hook was broken and that they could disable it, and asked the choice in prose. A way out that depends on what the lead says it wrote cannot
  // work for a lead whose failure is a false report. So the FIRST hold asks for the line whatever the lead believes, and the message depends on the round of holds, not on the lead's report.
  it('holds the call whatever the lead believes it wrote, and asks for the line at the first hold even if the lead believes it wrote it: a lead that never wrote it believes that it did', () => {
    const { stderr } = run(call());

    expect(stderr).toContain('the host cannot see the message you are writing');
    expect(stderr).toContain('until the mode line is visible in the saved transcript');
    expect(stderr).toContain('Write the line as the first line of a text block in the same message as the call you repeat, even if you believe you wrote it already.');
    expect(stderr).not.toMatch(/already began with that line, repeat the call/);
    expect(stderr).not.toMatch(/if your last message/i);
    expect(stderr).not.toContain('If you have, the host has not saved it yet');
    expect(stderr).not.toContain('(hold ');
  });

  // Sitting Q (H10k2, 2026-10-12, Claude Code 2.1.296, session `314be482`): the gate held six calls in four messages. Three of the messages had no text block: the lead wrote the line only in its
  // reasoning ("I'll now retry the two held calls using this message's line") and was held each time. The fourth had the line in a text block and was held anyway, because the host had not saved it yet.
  // The lead then ended its turn: "I've paused ... the host hasn't saved the line to the transcript yet. That line is now the first thing in this finished message", and waited for the user to reply.
  // The message said that the host cannot see the message the lead is writing, and only "make the call again" about what to do, so the lead read it as "finish the message". It has to say not to stop,
  // that reasoning is not text, and to repeat the call in the next message, again if need be. (In Sitting P, h10k1, the third message was released: the line of the second had been saved by then.)
  it('tells the lead that a hold is not a reason to stop and that its reasoning is not text', () => {
    const { stderr } = run(call());

    expect(stderr).toContain('A hold is not a reason to stop: do not end your turn, do not ask the user and do not wait for a reply.');
    expect(stderr).toContain('The line must be a text block of your reply: your reasoning is not text, and neither the hook nor the user sees it.');
    expect(stderr.split('\n')[0]).toContain('not a failure');
  });

  // Sitting S: the message of a hold depends on the ROUND of holds of the session, which the hook counts (the calls of one message reach it within milliseconds of each other, and a new message needs a model
  // round trip), and never on what the lead says it wrote. Round 1 asks for the line; round 2 lets a lead that wrote a text block repeat the call alone (the usual case of the host's save lagging, with no
  // second line for the user to read); round 3 and later ask for the line again and say what the hook sees in the saved transcript. The count changes the message and never the release (ADR 0044).
  describe('the message of a hold by the round of holds (Sitting S)', () => {
    const newRound = { AGENTS_UNITED_MODE_LINE_ROUND_MS: '0' };
    const sameRound = { AGENTS_UNITED_MODE_LINE_ROUND_MS: '600000' };

    it('round 2: repeat the call alone, with no text, if the last message opened a text block with the line; write the line if it did not', () => {
      expect(run(call(), newRound).status).toBe(2);
      const second = run(call({ tool_use_id: 'toolu_2' }), newRound);

      expect(second.status).toBe(2);
      expect(second.stderr.split('\n')[0]).toBe('Mode line first. This is an expected hold, not a failure (hold 2).');
      expect(second.stderr).toContain('If your last message opened a text block with the mode line, the host has not saved it yet: repeat the call alone, with no text.');
      expect(second.stderr).toContain('If it did not (your reasoning is not text), write the line as the first line of a text block in the same message as the call you repeat, filled in:');
      expect(second.stderr).toContain('Mode: <Fully Operational or Limited Operational>. Callable:');
      expect(second.stderr).toContain('Do not stop, do not ask the user and do not wait for a reply.');
    });

    it('round 3 and later: the saved transcript has no text block of the lead that opens with the line, and the line is asked for again, even if the lead believes it wrote it', () => {
      writeTranscript(assistantText('Still waiting on the host to save my mode line.'), assistantText('I am retrying the call.'));
      for (let round = 1; round <= 2; round += 1) expect(run(call({ tool_use_id: `t${round}` }), newRound).status).toBe(2);
      const third = run(call({ tool_use_id: 't3' }), newRound);

      expect(third.status).toBe(2);
      expect(third.stderr.split('\n')[0]).toBe('Mode line first. This is an expected hold, not a failure (hold 3).');
      expect(third.stderr).toContain('The saved transcript has 2 text block(s) of yours and none opens with the mode line; your reasoning is not text.');
      expect(third.stderr).toContain('Write the line now as the first line of a text block in the same message as the call you repeat, even if you believe you wrote it already, filled in:');
      expect(third.stderr).toContain('Mode: <Fully Operational or Limited Operational>. Callable:');
      const later = run(call({ tool_use_id: 't4' }), newRound);
      expect(later.stderr.split('\n')[0]).toBe('Mode line first. This is an expected hold, not a failure (hold 4).');
      expect(later.stderr).toContain('even if you believe you wrote it already');
    });

    it('does not tell the user that the hook is broken, and asks the lead not to: the hook reads text blocks only', () => {
      for (let round = 1; round <= 3; round += 1) run(call({ tool_use_id: `t${round}` }), newRound);
      const { stderr } = run(call({ tool_use_id: 't4' }), newRound);

      expect(stderr).toContain('do not tell the user that the hook is broken: it reads text blocks only.');
      expect(stderr).not.toMatch(/disable/i);
    });

    it('counts the calls of one message as one round, and the next message as the next round', () => {
      const first = run(call({ tool_use_id: 'a', tool_name: 'Glob' }), sameRound);
      const parallel = run(call({ tool_use_id: 'b', tool_name: 'Skill' }), sameRound);

      expect(parallel.stderr).toBe(first.stderr);
      expect(JSON.parse(fs.readFileSync(markerOf('sess-1'), 'utf8')).round).toBe(1);
      const next = run(call({ tool_use_id: 'c', tool_name: 'Glob' }), newRound);
      expect(next.stderr.split('\n')[0]).toContain('(hold 2)');
      expect(JSON.parse(fs.readFileSync(markerOf('sess-1'), 'utf8')).round).toBe(2);
    });

    it('never releases a call on the count of rounds, whatever it is; a saved line releases it', () => {
      for (let round = 1; round <= 14; round += 1) expect(run(call({ tool_use_id: `t${round}` }), newRound).status, `round ${round}`).toBe(2);
      writeTranscript(assistantText(`${LINE}\nI am Chris.`));

      expect(run(call({ tool_use_id: 'saved' }), newRound).status).toBe(0);
    });

    it('starts at round 1 from a marker of an earlier build, which holds no round', () => {
      fs.mkdirSync(path.dirname(markerOf('sess-1')), { recursive: true });
      fs.writeFileSync(markerOf('sess-1'), JSON.stringify({ pending: true, version: 2 }));

      expect(run(call(), newRound).stderr.split('\n')[0]).toMatch(/^Mode line first\. This is an expected hold, not a failure\. Before this call, write the mode line/);
      expect(JSON.parse(fs.readFileSync(markerOf('sess-1'), 'utf8')).round).toBe(1);
    });
  });

  // N3 regression run (session `8e2c3d9e`): the host prints a held call to the user as "Error: PreToolUse:Agent hook error: [node ...]: <this message>", at the start of every
  // session, and the maintainer read the held spawn as a failure of the spawned agent (it was the lead's first call, held once by design; the spawned agent had no hook error).
  // The host's own prefix cannot be changed, so the first line of the message says in plain words that the hold is expected and happens once, and it keeps "Mode line first"
  // because the lead's definition and a test name it.
  it('says in its first line that the hold is expected, because the host shows it to the user as an error', () => {
    const first = run(call()).stderr.split('\n')[0]!;

    expect(first).toMatch(/^Mode line first\./);
    expect(first).toContain('expected hold');
    expect(first).toContain('not a failure');
  });

  it('does not release a call on elapsed time alone; a saved mode line releases later calls', () => {
    expect(run(call()).status).toBe(2);
    const marker = markerOf('sess-1');
    fs.writeFileSync(marker, JSON.stringify({ at: Date.now() - 10_000 }));

    expect(run(call({ tool_use_id: 'toolu_2' })).status).toBe(2);
    writeTranscript(assistantText(`${LINE}\nI am Chris.`));
    expect(run(call({ tool_use_id: 'toolu_2' })).status).toBe(0);
    expect(run(call({ tool_use_id: 'toolu_3', tool_name: 'Bash' })).status).toBe(0);
  });

  it('holds streamed calls even beyond the old two-second window (R2: Bash then Agent in one response)', () => {
    expect(run(call({ tool_use_id: 'a' })).status).toBe(2);
    fs.writeFileSync(markerOf('sess-1'), JSON.stringify({ at: Date.now() - 3_433 }));
    expect(run(call({ tool_use_id: 'b' })).status).toBe(2);
    expect(run(call({ tool_use_id: 'c', tool_name: 'Skill' })).status).toBe(2);
  });

  it('does not trust a done marker from the old timed-release gate when the mode line is absent', () => {
    fs.mkdirSync(path.dirname(markerOf('sess-1')), { recursive: true });
    fs.writeFileSync(markerOf('sess-1'), JSON.stringify({ done: true }));
    expect(run(call()).status).toBe(2);
  });

  it('keeps holding while the current response is missing from disk, then releases after it is saved', () => {
    writeTranscript(assistantText("I'll check the integrations."));
    expect(run(call()).status).toBe(2);
    expect(run(call({ tool_use_id: 'retry' })).status).toBe(2);
    writeTranscript(assistantText(`${LINE}\nRepeating the held call.`));
    expect(run(call({ tool_use_id: 'saved-retry' })).status).toBe(0);
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
    expect(run(call({ transcript_path: path.join(tmp, 'missing.jsonl') })).status).toBe(0);
    expect(run(call({ transcript_path: tmp })).status).toBe(0);
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
