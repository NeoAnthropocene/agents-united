import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadSemanticCore } from '../src/core/semantic-core.js';
import { attempt } from './helpers/claude-host-hooks.js';
import { nativeText } from './helpers/native-roles.js';

/** The one sentence every Claude role carries about the guard (ADR 0074, tests/guard-destructive-upgrade.test.ts). */
const GUARD_SENTENCE =
  'A guard blocks forced pushes, `vercel --prod`, `.env` writes and the common forms of destructive shell commands (a recursive delete of a root, home or project folder, privilege escalation, shutdown, disk formatting, cloud resource-group, project or account deletion); it is a seat belt, not a boundary.';

/**
 * The native `interaction-designer` (product-design bundle, Tier 1): what its authored body must keep saying. It holds editors and no
 * shell, so it cannot profile an animation; every claim about the guard, the tools and the peers has to be true of what is bound.
 */

const text = (): string => nativeText('interaction-designer');
const tools = (): string[] => /^tools: (.*)$/m.exec(text())![1]!.split(', ');
const canonical = (): string => fs.readFileSync(path.resolve('registry/agents/subagent-interaction-designer.md'), 'utf8').replace(/\r\n/g, '\n');
const peersSection = (body: string): string => /\n## Working with peers\n([\s\S]*?)(?=\n## )/.exec(body)![1]!.trim();

describe('native interaction-designer: editors, no shell, no measuring', () => {
  it('holds exactly this tools set, so a stray tool fails', () => {
    expect([...tools()].sort()).toEqual(['Artifact', 'Edit', 'Glob', 'Grep', 'ListAgents', 'ListMcpResourcesTool', 'NotebookEdit', 'Read', 'ReadMcpResourceTool', 'SendMessage', 'Skill', 'SubagentHandback', 'TaskCreate', 'TaskGet', 'TaskList', 'TaskUpdate', 'TodoWrite', 'ToolSearch', 'Write', 'mcp__figma', 'mcp__plugin_figma_figma', 'mcp__stitch'].sort());
  });

  it('holds the posture of a native specialist: sonnet model, medium effort', () => {
    expect(/^model: (.*)$/m.exec(text())![1]).toBe('sonnet');
    expect(/^effort: (.*)$/m.exec(text())![1]).toBe('medium');
  });

  it('holds the editors and no shell', () => {
    expect(tools()).toEqual(expect.arrayContaining(['Edit', 'Write', 'Read', 'Glob', 'Grep', 'Skill', 'SendMessage', 'SubagentHandback']));
    for (const shell of ['Bash', 'PowerShell', 'Monitor']) expect(tools(), shell).not.toContain(shell);
  });

  it('step 4 runs the checklist but reports compositor and layout cost as estimates, with the profiling as a run-command request', () => {
    const four = /^4\. .*$/m.exec(/\n## How to work\n([\s\S]*?)(?=\n## )/.exec(text())![1]!)![0];
    expect(four).toContain('You have no browser and no shell, so compositor and layout cost are judged from the code, not profiled: report them as estimates and put the profiling step as a `run-command` entry under `Requests for the lead`.');
  });
});

describe('native interaction-designer: the guard and acceptEdits claims', () => {
  it('says exactly what the bound guard can stop, and that staying inside the motion files is its own obligation', () => {
    const body = text();
    expect(body).toContain('so the only thing the guard bound to this role can stop is a write to a `.env` file (`.env.example` passes)');
    expect(body).toContain('is your own obligation');
    expect(body).toContain(`- ${GUARD_SENTENCE} As a subagent it comes from this file, when the host runs this file's hooks. As a teammate it comes from the settings-level session guard, which is optional and may be off. You cannot verify from inside that a guard is active, so keep its rules as your own obligation in either case. Never try to get around it.`);
    expect(body.split(GUARD_SENTENCE)).toHaveLength(2);
  });

  describe('against the real guard script', () => {
    const project = fs.mkdtempSync(path.join(os.tmpdir(), 'agents-united-interaction-designer-guard-'));
    beforeAll(() => {
      fs.mkdirSync(path.join(project, '.claude/hooks'), { recursive: true });
      for (const file of fs.readdirSync(path.resolve('registry/hosts/claude/hooks'))) fs.copyFileSync(path.resolve('registry/hosts/claude/hooks', file), path.join(project, '.claude/hooks', file));
    });
    afterAll(() => fs.rmSync(project, { recursive: true, force: true }));
    const blocked = (tool: string, input: Record<string, unknown>): boolean => attempt(text(), project, { tool, input }, { agentType: 'interaction-designer' }).blocked;

    it.each(['Write', 'Edit'])('blocks a %s of .env, as the body says', tool => {
      expect(blocked(tool, { file_path: path.join(project, '.env') })).toBe(true);
    });

    it.each(['.env.example', 'src/motion-tokens.css'])('does not block a write of %s, as the body says', file => {
      expect(blocked('Write', { file_path: path.join(project, file) })).toBe(false);
    });
  });

  it('equals the permission mode of the canonical registry agent', () => {
    const mode = (source: string): string | undefined => /^permissionMode: (.+)$/m.exec(source)?.[1];
    expect(mode(canonical())).toBe('acceptEdits');
    expect(mode(text())).toBe('acceptEdits');
  });
});

describe('native interaction-designer: the canonical scroll and View Transition directives are not tightened', () => {
  it('feature-detects View Transitions with a CSS-only fallback, and flags a scroll listener instead of forbidding it', () => {
    const body = text();
    expect(body).toContain('Feature-detect View Transitions (`document.startViewTransition`) before using one');
    expect(body).toContain('flag any animation driven by a `scroll` event listener as a performance concern and recommend the scroll-driven animation API instead');
    expect(body).not.toMatch(/never a scroll event listener|only behind `if \(!document\.startViewTransition\)`/);
  });
});

describe('native interaction-designer: the MCP servers of its canonical agent', () => {
  it('declares the same servers as the canonical registry agent, and holds both with their plugin route', () => {
    expect([...canonical().matchAll(/^  - name: (\S+)$/gm)].map(match => match[1]).sort()).toEqual(['figma', 'stitch']);
    expect(tools().filter(tool => tool.startsWith('mcp__')).sort()).toEqual(['mcp__figma', 'mcp__plugin_figma_figma', 'mcp__stitch']);
  });
});

describe('native interaction-designer: the peers section of the Tier 1 form', () => {
  it("is devops-engineer's section line for line", () => {
    expect(peersSection(text()).split('\n')).toEqual(peersSection(nativeText('devops-engineer')).split('\n'));
  });

  it('declares messaging, and step 7 hands the report back as the final answer and conditionally through SubagentHandback', async () => {
    expect(tools()).toEqual(expect.arrayContaining(['ListAgents', 'SendMessage']));
    expect((await loadSemanticCore('registry')).get('subagent-interaction-designer')!.capabilities).toContain('messaging');
    expect(text()).toMatch(/^7\. \*\*Hand back\.\*\* Return the report from the Output Contract as your final message: your final answer is the hand-back\. Deliver it through `SubagentHandback` only where the host supplies that tool; where it does not, your ordinary final response is the hand-back\.$/m);
  });
});

describe('native interaction-designer: the shared scope_boundaries and safety', () => {
  it('carries the five canonical directives and the performance checklist, item by item', async () => {
    const core = (await loadSemanticCore('registry')).get('subagent-interaction-designer')!;
    for (const title of ['Motion as Communication', 'Performance Discipline', 'Spring Physics', 'Reduced Motion First', 'View Transitions API']) expect(core.scope_boundaries, title).toContain(`**${title}**`);
    for (const item of ['only `transform` and `opacity` are animated', '`will-change` is removed after the animation completes', 'unique and namespaced', 'zeroes all durations', 'an exit animation exists if an enter animation exists', 'stagger delays do not exceed 50ms per item', 'does not exceed 600ms']) expect(core.scope_boundaries, item).toContain(item);
    expect(core.scope_boundaries).toContain('`cubic-bezier(0.34, 1.56, 0.64, 1)`');
  });

  it('carries all four canonical guardrails', async () => {
    const { safety } = (await loadSemanticCore('registry')).get('subagent-interaction-designer')!;
    for (const bullet of ['Refuse to implement blinking or flashing animations (WCAG 2.3.1 — seizure risk).', 'Never use `animation-iteration-count: infinite` without an accessible pause control.', 'Flag any animation triggered by `scroll` event (not scroll-timeline) as a performance concern — recommend scroll-driven animation API instead.', 'All View Transitions implementations must include a feature-detection guard.']) expect(safety, bullet).toContain(`- ${bullet}`);
  });
});
