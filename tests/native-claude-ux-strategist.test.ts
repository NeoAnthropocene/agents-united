import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadSemanticCore } from '../src/core/semantic-core.js';
import { attempt } from './helpers/claude-host-hooks.js';
import { nativeText } from './helpers/native-roles.js';

/** The one sentence every Claude role carries about the guard (ADR 0074, tests/guard-destructive-upgrade.test.ts). */
const GUARD_SENTENCE =
  'A guard blocks `git push --force` and `-f` (not `--force-with-lease`), `vercel --prod`, `.env` files (not `.env.example`) written with an editing tool or a `>` or `>>` redirect to an unquoted path without backslashes, and the common forms of destructive shell commands (a recursive delete of a root, home or project folder, privilege escalation, shutdown, disk formatting, cloud resource-group, project or account deletion); it is a seat belt, not a boundary.';

/**
 * The native `ux-strategist` (product-design bundle, Tier 1): what its authored body must keep saying. It holds editors and no shell;
 * every claim about the guard, the tools and the peers has to be true of what is bound.
 */

const text = (): string => nativeText('ux-strategist');
const tools = (): string[] => /^tools: (.*)$/m.exec(text())![1]!.split(', ');
const canonical = (): string => fs.readFileSync(path.resolve('registry/agents/subagent-ux-strategist.md'), 'utf8').replace(/\r\n/g, '\n');
const peersSection = (body: string): string => /\n## Working with peers\n([\s\S]*?)(?=\n## )/.exec(body)![1]!.trim();

describe('native ux-strategist: editors, no shell', () => {
  it('holds exactly this tools set, so a stray tool fails', () => {
    expect([...tools()].sort()).toEqual(['Artifact', 'Edit', 'Glob', 'Grep', 'ListAgents', 'ListMcpResourcesTool', 'NotebookEdit', 'Read', 'ReadMcpResourceTool', 'SendMessage', 'Skill', 'SubagentHandback', 'TaskCreate', 'TaskGet', 'TaskList', 'TaskUpdate', 'TodoWrite', 'ToolSearch', 'Write', 'mcp__figma', 'mcp__plugin_figma_figma'].sort());
  });

  it('holds the posture of a native specialist: sonnet model, medium effort', () => {
    expect(/^model: (.*)$/m.exec(text())![1]).toBe('sonnet');
    expect(/^effort: (.*)$/m.exec(text())![1]).toBe('medium');
  });

  it('holds the editors and no shell', () => {
    expect(tools()).toEqual(expect.arrayContaining(['Edit', 'Write', 'Read', 'Glob', 'Grep', 'Skill', 'SendMessage', 'SubagentHandback']));
    for (const shell of ['Bash', 'PowerShell', 'Monitor']) expect(tools(), shell).not.toContain(shell);
  });

  it('says it has no browser and no analytics access, so an unsupplied funnel number is a hypothesis', () => {
    expect(text()).toContain('- You have no browser and no analytics access: a funnel number you were not given is a hypothesis, and you say so.');
  });
});

describe('native ux-strategist: the guard and acceptEdits claims', () => {
  it('says exactly what the bound guard can stop, and that staying inside the strategy documents is its own obligation', () => {
    const body = text();
    expect(body).toContain('so the guard bound to this role stops a write to a `.env` file (`.env.example` passes), an editor call whose input it cannot read, and every call when it cannot run');
    expect(body).toContain('is your own obligation');
    expect(body).toContain(`- ${GUARD_SENTENCE} As a subagent it comes from this file, when the host runs this file's hooks. As a teammate it comes from the settings-level session guard, which is optional and may be off. You cannot verify from inside that a guard is active, so keep its rules as your own obligation in either case. Never try to get around it.`);
    expect(body.split(GUARD_SENTENCE)).toHaveLength(2);
  });

  describe('against the real guard script', () => {
    const project = fs.mkdtempSync(path.join(os.tmpdir(), 'agents-united-ux-strategist-guard-'));
    beforeAll(() => {
      fs.mkdirSync(path.join(project, '.claude/hooks'), { recursive: true });
      for (const file of fs.readdirSync(path.resolve('registry/hosts/claude/hooks'))) fs.copyFileSync(path.resolve('registry/hosts/claude/hooks', file), path.join(project, '.claude/hooks', file));
    });
    afterAll(() => fs.rmSync(project, { recursive: true, force: true }));
    const blocked = (tool: string, input: Record<string, unknown>): boolean => attempt(text(), project, { tool, input }, { agentType: 'ux-strategist' }).blocked;

    it.each(['Write', 'Edit'])('blocks a %s of .env, as the body says', tool => {
      expect(blocked(tool, { file_path: path.join(project, '.env') })).toBe(true);
    });

    it.each(['.env.example', 'docs/ux/strategy.md'])('does not block a write of %s, as the body says', file => {
      expect(blocked('Write', { file_path: path.join(project, file) })).toBe(false);
    });
  });

  it('equals the permission mode of the canonical registry agent', () => {
    const mode = (source: string): string | undefined => /^permissionMode: (.+)$/m.exec(source)?.[1];
    expect(mode(canonical())).toBe('acceptEdits');
    expect(mode(text())).toBe('acceptEdits');
  });
});

describe('native ux-strategist: the MCP server of its canonical agent', () => {
  it('declares figma, as the canonical registry agent does, and holds it with its plugin route and nothing else', () => {
    expect([...canonical().matchAll(/^  - name: (\S+)$/gm)].map(match => match[1])).toEqual(['figma']);
    expect(tools().filter(tool => tool.startsWith('mcp__')).sort()).toEqual(['mcp__figma', 'mcp__plugin_figma_figma']);
  });
});

describe('native ux-strategist: the peers section of the Tier 1 form', () => {
  it("is devops-engineer's section line for line", () => {
    expect(peersSection(text()).split('\n')).toEqual(peersSection(nativeText('devops-engineer')).split('\n'));
  });

  it('declares messaging, and step 7 hands the report back as the final answer and conditionally through SubagentHandback', async () => {
    expect(tools()).toEqual(expect.arrayContaining(['ListAgents', 'SendMessage']));
    expect((await loadSemanticCore('registry')).get('subagent-ux-strategist')!.capabilities).toContain('messaging');
    expect(text()).toMatch(/^7\. \*\*Hand back\.\*\* Return the report from the Output Contract as your final message: your final answer is the hand-back\. Deliver it through `SubagentHandback` only where the host supplies that tool; where it does not, your ordinary final response is the hand-back\.$/m);
  });
});

describe('native ux-strategist: the shared scope_boundaries and safety', () => {
  it('carries the five canonical directives and both canonical guardrails', async () => {
    const core = (await loadSemanticCore('registry')).get('subagent-ux-strategist')!;
    for (const title of ['User Journey Mapping', 'Task Flow Optimization', 'Onboarding Friction Reduction', 'Progressive Disclosure', 'Conversion Funnel Analysis']) expect(core.scope_boundaries, title).toContain(`**${title}**`);
    for (const obligation of ['awareness through activation, retention, and referral', 'Target <3 steps for any critical action path', 'time-to-value (TTV)', 'micro-conversions, identify leakage points']) expect(core.scope_boundaries, obligation).toContain(obligation);
    expect(core.safety).toContain('- Never recommend dark patterns (forced continuity, roach motel flows, misdirection).');
    expect(core.safety).toContain('- Always distinguish between validated user research and strategic hypotheses.');
  });

  it('keeps the canonical strategy location and the tiers in the mission', async () => {
    const core = (await loadSemanticCore('registry')).get('subagent-ux-strategist')!;
    expect(core.mission).toContain('`docs/ux/`');
    expect(core.mission).toContain('Tier 0 (always visible) to Tier 3 (power user)');
  });
});
