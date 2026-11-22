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
 * The native `ui-designer` (product-design bundle, Tier 1): what its authored body must keep saying. It holds editors and no shell,
 * and no image tool on this host; every claim about the guard, the tools and the peers has to be true of what is bound.
 */

const text = (): string => nativeText('ui-designer');
const tools = (): string[] => /^tools: (.*)$/m.exec(text())![1]!.split(', ');
const canonical = (): string => fs.readFileSync(path.resolve('registry/agents/subagent-ui-designer.md'), 'utf8').replace(/\r\n/g, '\n');
const peersSection = (body: string): string => /\n## Working with peers\n([\s\S]*?)(?=\n## )/.exec(body)![1]!.trim();

describe('native ui-designer: editors, no shell, no image tool', () => {
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

  it('binds no image tool and says so in one place, with the fallback', () => {
    expect(tools().filter(tool => /image/i.test(tool))).toEqual([]);
    const sentence = '- You have no image-generation tool on this host. Where a mock-up, a palette swatch or a hero image is needed, write an image brief (subject, size, palette, mood, where it goes) or an SVG or CSS placeholder in its place, and name the gap under `Open items`. Never describe a placeholder as a generated image.';
    expect(text().split(sentence)).toHaveLength(2);
    expect(text()).not.toMatch(/generate_image|mcp__image-gen/);
  });
});

describe('native ui-designer: the guard and acceptEdits claims', () => {
  it('says exactly what the bound guard can stop, and that staying inside the design surface is its own obligation', () => {
    const body = text();
    expect(body).toContain('so the only thing the guard bound to this role can stop is a write to a `.env` file (`.env.example` passes)');
    expect(body).toContain('is your own obligation');
    expect(body).toContain(`- ${GUARD_SENTENCE} As a subagent it comes from this file; as a teammate it comes from the project's settings. Never try to get around it.`);
    expect(body.split(GUARD_SENTENCE)).toHaveLength(2);
  });

  describe('against the real guard script', () => {
    const project = fs.mkdtempSync(path.join(os.tmpdir(), 'agents-united-ui-designer-guard-'));
    beforeAll(() => {
      fs.mkdirSync(path.join(project, '.claude/hooks'), { recursive: true });
      for (const file of fs.readdirSync(path.resolve('registry/hosts/claude/hooks'))) fs.copyFileSync(path.resolve('registry/hosts/claude/hooks', file), path.join(project, '.claude/hooks', file));
    });
    afterAll(() => fs.rmSync(project, { recursive: true, force: true }));
    const blocked = (tool: string, input: Record<string, unknown>): boolean => attempt(text(), project, { tool, input }, { agentType: 'ui-designer' }).blocked;

    it.each(['Write', 'Edit'])('blocks a %s of .env, as the body says', tool => {
      expect(blocked(tool, { file_path: path.join(project, '.env') })).toBe(true);
    });

    it.each(['.env.example', 'src/styles/tokens.css'])('does not block a write of %s, as the body says', file => {
      expect(blocked('Write', { file_path: path.join(project, file) })).toBe(false);
    });
  });

  it('equals the permission mode of the canonical registry agent', () => {
    const mode = (source: string): string | undefined => /^permissionMode: (.+)$/m.exec(source)?.[1];
    expect(mode(canonical())).toBe('acceptEdits');
    expect(mode(text())).toBe('acceptEdits');
  });
});

describe('native ui-designer: the MCP servers of its canonical agent', () => {
  it('declares the same servers as the canonical registry agent, and holds both with their plugin route', () => {
    expect([...canonical().matchAll(/^  - name: (\S+)$/gm)].map(match => match[1]).sort()).toEqual(['figma', 'stitch']);
    expect(tools()).toEqual(expect.arrayContaining(['mcp__figma', 'mcp__plugin_figma_figma', 'mcp__stitch']));
    expect(tools().filter(tool => tool.startsWith('mcp__')).sort()).toEqual(['mcp__figma', 'mcp__plugin_figma_figma', 'mcp__stitch']);
  });
});

describe('native ui-designer: the peers section of the Tier 1 form', () => {
  it("is devops-engineer's section line for line", () => {
    expect(peersSection(text()).split('\n')).toEqual(peersSection(nativeText('devops-engineer')).split('\n'));
  });

  it('declares messaging, and step 7 hands the report back through SubagentHandback in the plain form', async () => {
    expect(tools()).toEqual(expect.arrayContaining(['ListAgents', 'SendMessage']));
    expect((await loadSemanticCore('registry')).get('subagent-ui-designer')!.capabilities).toContain('messaging');
    expect(text()).toMatch(/^7\. \*\*Hand back\.\*\* Return the report from the Output Contract as your final message through `SubagentHandback`\.$/m);
  });
});

describe('native ui-designer: the shared scope_boundaries and safety', () => {
  it('carries the five canonical directives and the canonical guardrail', async () => {
    const core = (await loadSemanticCore('registry')).get('subagent-ui-designer')!;
    for (const title of ['Color System First', 'Typography as Structure', 'CSS Variable Architecture', 'Micro-Animations', 'Responsive Layouts']) expect(core.scope_boundaries, title).toContain(`**${title}**`);
    for (const obligation of ['5 stops: 50/300/500/700/900', 'a neutral scale (11 stops: 0–1000)', 'Never use system-ui as the sole font stack', 'Never hard-code hex values in component CSS', 'respect `prefers-reduced-motion`', 'Prefer `fr` units and `minmax()`']) expect(core.scope_boundaries, obligation).toContain(obligation);
    expect(core.safety).toContain('- If a colour combination fails WCAG AA contrast (4.5:1 for text), refuse to implement and propose a corrected alternative.');
  });
});
