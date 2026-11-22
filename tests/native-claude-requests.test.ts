/**
 * ADR 0076 - the "Requests for the lead" block of a native Claude role. A specialist's text lists the request types its own tools leave open;
 * a lead's text says how it acts on them. Both are generated from src/core/native-requests.ts, so this suite checks the committed roster
 * against the generator and the generator's own behaviour on synthetic text.
 */
import { describe, expect, it } from 'vitest';
import { inspectNativeAgent } from '../src/core/native-guard.js';
import {
  REQUESTS_END,
  REQUESTS_EXEMPT_ROLES,
  REQUESTS_START,
  checkRequests,
  openRequestTypes,
  renderRequests,
  syncRequests,
} from '../src/core/native-requests.js';
import { requestsBlockProblems } from '../src/core/native-repository-rules.js';
import { NATIVE_ROLES, nativeText } from './helpers/native-roles.js';

/** The tools a lead must hold for its block to be true (`Workflow` is optional: the block states both paths). */
const LEAD_TOOLS = ['AskUserQuestion', 'Bash', 'PowerShell', 'Monitor', 'TaskStop', 'CronCreate', 'ScheduleWakeup', 'Agent', 'SendMessage', 'Skill', 'ToolSearch'];
const EXEMPT = ['factory-realizer', 'factory-evaluator', 'factory-sync', 'orchestrator-agent-factory'];
const BOUNDARIES = '## Boundaries of this host';
const TRACKING = '## Session task tracking';

const toolNames = (text: string): string[] => inspectNativeAgent(text).tools.map(tool => tool.split('(')[0]!);
const blockOf = (text: string): string => {
  const start = text.indexOf(REQUESTS_START);
  const end = text.indexOf(REQUESTS_END);
  return text.slice(start, end + REQUESTS_END.length);
};
const openLine = (block: string): string => /the types open to you are: (.*)\. Never request/.exec(block)![1]!;

const active = NATIVE_ROLES.filter(entry => !EXEMPT.includes(entry.role));

describe('the exempt roles', () => {
  it('are exactly the four fixed-job roles of the factory', () => {
    expect([...REQUESTS_EXEMPT_ROLES].sort()).toEqual([...EXEMPT].sort());
  });

  it.each(EXEMPT)('%s carries no requests markers', role => {
    const text = nativeText(role);
    expect(text).not.toContain('agents-united:requests:start');
    expect(text).not.toContain('agents-united:requests:end');
    expect(text).not.toContain('## Requests for the lead');
    expect(text).not.toContain('## Requests from specialists');
  });
});

describe.each(active.filter(entry => !entry.coordinator))('specialist $role', ({ role }) => {
  const text = nativeText(role);
  const tools = toolNames(text);

  it('carries the current block', () => {
    expect(checkRequests(text, 'specialist', tools)).toEqual([]);
    expect(requestsBlockProblems(text, { kind: 'specialist', name: role, tools })).toEqual([]);
    expect(blockOf(text)).toContain('## Requests for the lead');
  });

  it('lists the open types computed from its own tools line', () => {
    const computed = openRequestTypes(tools).map(type => `\`${type}\``).join(', ');
    expect(openLine(blockOf(text))).toBe(computed);
  });

  it('never names a type for a tool it holds, and always leaves ask-user or use-server per its tools', () => {
    const open = openRequestTypes(tools);
    expect(open).toContain('use-server');
    if (!tools.includes('AskUserQuestion')) expect(open).toContain('ask-user');
    if (tools.includes('Bash') || tools.includes('PowerShell')) expect(open).not.toContain('run-command');
    if (tools.includes('Monitor')) expect(open).not.toContain('watch');
    if (tools.includes('CronCreate') || tools.includes('ScheduleWakeup')) expect(open).not.toContain('schedule');
    if (tools.includes('Workflow')) expect(open).not.toContain('run-workflow');
    if (tools.includes('Agent')) expect(open).not.toContain('delegate');
  });

  it('sits before the boundaries section, or before the session task tracking section without one', () => {
    const block = text.indexOf(REQUESTS_START);
    const anchor = text.includes(`\n${BOUNDARIES}\n`) ? text.indexOf(`\n${BOUNDARIES}\n`) : text.indexOf(`\n${TRACKING}\n`);
    expect(block).toBeGreaterThan(-1);
    expect(anchor).toBeGreaterThan(block);
  });
});

describe('use-server stays open, and ask-user is open when the tools line has no AskUserQuestion', () => {
  it('keeps use-server open even for a specialist with every other tool', () => {
    expect(openRequestTypes(['Read', 'Bash', 'Monitor', 'CronCreate', 'Workflow', 'Agent', 'AskUserQuestion'])).toContain('use-server');
    expect(openRequestTypes(['Read'])).toEqual(['ask-user', 'run-command', 'watch', 'schedule', 'run-workflow', 'delegate', 'use-server']);
  });

  it('does not leave ask-user open for a tools list that holds AskUserQuestion', () => {
    expect(openRequestTypes(['Read', 'AskUserQuestion'])).not.toContain('ask-user');
    expect(openRequestTypes(['Read', 'AskUserQuestion'])).toEqual(['run-command', 'watch', 'schedule', 'run-workflow', 'delegate', 'use-server']);
  });
});

describe('the leads', () => {
  const leads = active.filter(entry => entry.coordinator);

  it.each(leads)('$role carries the current block', ({ role }) => {
    const text = nativeText(role);
    expect(checkRequests(text, 'coordinator', toolNames(text))).toEqual([]);
    expect(requestsBlockProblems(text, { kind: 'coordinator', name: role, tools: toolNames(text) })).toEqual([]);
    expect(blockOf(text)).toContain('## Requests from specialists');
  });

  it('carry a byte-identical block', () => {
    const blocks = new Set(leads.map(({ role }) => blockOf(nativeText(role))));
    expect(blocks.size).toBe(1);
  });

  it.each(leads)('$role holds every tool its block names', ({ role }) => {
    const names = toolNames(nativeText(role));
    expect(LEAD_TOOLS.filter(tool => !names.includes(tool))).toEqual([]);
  });

  it.each(leads)('$role sits before the boundaries section, or before the session task tracking section without one', ({ role }) => {
    const text = nativeText(role);
    const block = text.indexOf(REQUESTS_START);
    const anchor = text.includes(`\n${BOUNDARIES}\n`) ? text.indexOf(`\n${BOUNDARIES}\n`) : text.indexOf(`\n${TRACKING}\n`);
    expect(block).toBeGreaterThan(-1);
    expect(anchor).toBeGreaterThan(block);
  });
});

describe('the module on synthetic text', () => {
  const frontmatter = '---\nname: x\n---\n';
  const withBoundaries = `${frontmatter}# X\n\nBody.\n\n${BOUNDARIES}\n\nBounds.\n\n${TRACKING}\n\nTracking.\n`;
  const withTrackingOnly = `${frontmatter}# X\n\nBody.\n\n${TRACKING}\n\nTracking.\n`;

  it('renders a specialist without a shell and without Monitor with the matching open types', () => {
    const block = renderRequests('specialist', ['Read', 'Grep']);
    expect(block).toContain('## Requests for the lead');
    expect(block).toContain('`ask-user`, `run-command`, `watch`, `schedule`, `run-workflow`, `delegate`, `use-server`');
    expect(block).not.toContain('{{OPEN_TYPES}}');
  });

  it('closes run-command with a shell and watch with Monitor', () => {
    const line = (block: string): string => /the types open to you are: (.*)\. Never request/.exec(block)![1]!;
    const withShell = renderRequests('specialist', ['Bash']);
    expect(line(withShell)).not.toContain('`run-command`');
    expect(line(withShell)).toContain('`watch`');
    const withMonitor = renderRequests('specialist', ['PowerShell', 'Monitor']);
    expect(line(withMonitor)).not.toContain('`run-command`');
    expect(line(withMonitor)).not.toContain('`watch`');
  });

  it('reduces an Agent allowlist to Agent', () => {
    expect(openRequestTypes(['Agent(code-reviewer, repo-index)'])).not.toContain('delegate');
  });

  it('closes run-command with PowerShell alone and schedule with ScheduleWakeup alone', () => {
    expect(openRequestTypes(['PowerShell'])).not.toContain('run-command');
    expect(openRequestTypes(['ScheduleWakeup'])).not.toContain('schedule');
  });

  it('renders the lead text without a computed line', () => {
    const block = renderRequests('coordinator', ['Read']);
    expect(block).toContain('## Requests from specialists');
    expect(block).not.toContain('{{OPEN_TYPES}}');
    expect(renderRequests('coordinator', ['Bash'])).toBe(block);
  });

  it('inserts the block before the boundaries section, then is idempotent', () => {
    const synced = syncRequests(withBoundaries, 'specialist', ['Read']);
    expect(synced.indexOf(REQUESTS_START)).toBeGreaterThan(-1);
    expect(synced.indexOf(REQUESTS_START)).toBeLessThan(synced.indexOf(BOUNDARIES));
    expect(synced).toContain(`${REQUESTS_END}\n\n${BOUNDARIES}`);
    expect(syncRequests(synced, 'specialist', ['Read'])).toBe(synced);
  });

  it('falls back to the session task tracking section', () => {
    const synced = syncRequests(withTrackingOnly, 'coordinator', ['Read']);
    expect(synced).toContain(`${REQUESTS_END}\n\n${TRACKING}`);
  });

  it('throws when neither anchor exists and names both headings', () => {
    expect(() => syncRequests(`${frontmatter}# X\n\nBody.\n`, 'specialist', ['Read'])).toThrow(/Boundaries of this host[\s\S]*Session task tracking/);
  });

  it('replaces a stale block', () => {
    const synced = syncRequests(withBoundaries, 'specialist', ['Read']);
    const stale = synced.replace('Do not drop that part', 'Drop that part');
    expect(stale).not.toBe(synced);
    expect(checkRequests(stale, 'specialist', ['Read'])).toHaveLength(1);
    expect(syncRequests(stale, 'specialist', ['Read'])).toBe(synced);
  });

  it('re-renders the computed line when the tools change', () => {
    const synced = syncRequests(withBoundaries, 'specialist', ['Read']);
    const again = syncRequests(synced, 'specialist', ['Read', 'Bash']);
    expect(again).not.toBe(synced);
    expect(checkRequests(again, 'specialist', ['Read', 'Bash'])).toEqual([]);
  });

  it('accepts CRLF input and writes LF', () => {
    const synced = syncRequests(withBoundaries.replace(/\n/g, '\r\n'), 'specialist', ['Read']);
    expect(synced).not.toContain('\r');
    expect(checkRequests(synced.replace(/\n/g, '\r\n'), 'specialist', ['Read'])).toEqual([]);
  });

  it('throws on two start markers', () => {
    const synced = syncRequests(withBoundaries, 'specialist', ['Read']);
    expect(() => syncRequests(`${synced}\n${REQUESTS_START}\n`, 'specialist', ['Read'])).toThrow(/exactly one pair/);
  });

  it('throws on two end markers, an end marker before start, or an orphan start marker in syncRequests and checkRequests', () => {
    const synced = syncRequests(withBoundaries, 'specialist', ['Read']);
    const twoEnds = `${synced}\n${REQUESTS_END}\n`;
    const endBeforeStart = `${frontmatter}# X\n\n${REQUESTS_END}\n${REQUESTS_START}\n`;
    const orphanStart = `${frontmatter}# X\n\n${REQUESTS_START}\n`;
    for (const malformed of [twoEnds, endBeforeStart, orphanStart]) {
      expect(() => syncRequests(malformed, 'specialist', ['Read'])).toThrow(/exactly one pair/);
      expect(() => checkRequests(malformed, 'specialist', ['Read'])).toThrow(/exactly one pair/);
    }
  });

  it('reports a missing block and a stale block', () => {
    expect(checkRequests(withBoundaries, 'specialist', ['Read'])).toEqual([expect.stringMatching(/^Native requests block missing: /)]);
    const synced = syncRequests(withBoundaries, 'specialist', ['Read']);
    const [stale] = checkRequests(synced.replace('Do not drop', 'Drop'), 'specialist', ['Read']);
    expect(stale).toMatch(/^Native requests block stale: .*\(regenerate with UPDATE_NATIVE=1\)\.$/);
  });
});

describe('requestsBlockProblems', () => {
  const base = '---\nname: x\n---\n# X\n\n## Boundaries of this host\n\nB.\n';
  const current = syncRequests(base, 'specialist', ['Read']);

  it('returns a problem for a non-exempt role without the block', () => {
    expect(requestsBlockProblems(base, { kind: 'specialist', name: 'x', tools: ['Read'] })).toEqual([expect.stringContaining('missing')]);
  });

  it('returns a problem for a stale block', () => {
    expect(requestsBlockProblems(current.replace('Do not drop', 'Drop'), { kind: 'specialist', name: 'x', tools: ['Read'] })).toEqual([expect.stringContaining('stale')]);
  });

  it('returns a problem for an exempt role that carries the markers', () => {
    expect(requestsBlockProblems(current, { kind: 'factory-worker', name: 'factory-sync', tools: ['Read'] })).toEqual([expect.stringContaining('exempt')]);
    expect(requestsBlockProblems(current, { kind: 'coordinator', name: 'orchestrator-agent-factory', tools: ['Read'] })).toEqual([expect.stringContaining('exempt')]);
  });

  it('returns nothing for a current block and for an exempt role without markers', () => {
    expect(requestsBlockProblems(current, { kind: 'specialist', name: 'x', tools: ['Read'] })).toEqual([]);
    expect(requestsBlockProblems(base, { kind: 'factory-worker', name: 'factory-sync', tools: ['Read'] })).toEqual([]);
  });

  it('returns a problem and does not throw on two start markers', () => {
    expect(requestsBlockProblems(`${current}\n${REQUESTS_START}\n`, { kind: 'specialist', name: 'x', tools: ['Read'] })).toEqual([
      expect.stringContaining('exactly one pair'),
    ]);
  });
});
