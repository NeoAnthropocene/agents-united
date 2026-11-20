import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadSemanticCore } from '../src/core/semantic-core.js';
import { attempt } from './helpers/claude-host-hooks.js';
import { nativeText } from './helpers/native-roles.js';

/**
 * The native `system-architect`, brought in the way the factory pilot brought in `devops-engineer`: an editor-only role (its canonical
 * agent has no shell tool), so what its authored body says about the bound guard is the guard's behaviour for the editors, and every
 * "blocked" claim is fired at the real script.
 */

const text = (): string => nativeText('system-architect');
const canonical = (): string => fs.readFileSync(path.resolve('registry/agents/subagent-system-architect.md'), 'utf8').replace(/\r\n/g, '\n');
const toolsOf = (body: string): string[] => /^tools: (.*)$/m.exec(body)![1]!.split(', ');
const section = (body: string, heading: string): string => new RegExp(`\\n## ${heading}\\n([\\s\\S]*?)(?=\\n## |$)`).exec(body)![1]!.trim();
/** A numbered step of the "How to work" section. */
const step = (n: number): string => new RegExp(`^${n}\\. .*$`, 'm').exec(section(text(), 'How to work'))![0];

describe('native system-architect: no shell, as its canonical agent', () => {
  it('holds the editors and the search tools, and no shell, monitor, web or delegation tool', () => {
    const tools = toolsOf(text());
    expect(tools).toEqual(expect.arrayContaining(['Edit', 'Write', 'Glob', 'Grep', 'Read', 'Skill', 'SubagentHandback']));
    for (const absent of ['Bash', 'PowerShell', 'Monitor', 'WebFetch', 'WebSearch', 'Agent', 'EnterWorktree', 'LSP']) expect(tools, absent).not.toContain(absent);
  });

  it("the canonical agent's tools are file tools only, with no command tool", () => {
    const front = /^---\n([\s\S]*?)\n---\n/.exec(canonical())![1]!;
    const tools = [...(/\ntools:\n((?:  - .*\n?)+)/.exec(`\n${front}\n`)?.[1] ?? '').matchAll(/^  - (.+)$/gm)].map(match => match[1]);
    expect(tools).toEqual(['view_file', 'write_to_file', 'replace_file_content', 'grep_search', 'find_by_name', 'list_dir']);
  });

  it('the shared core declares no shell capability and keeps the capabilities the grant needs', async () => {
    const capabilities = (await loadSemanticCore('registry')).get('subagent-system-architect')!.capabilities ?? [];
    expect(capabilities).not.toContain('shell');
    expect(capabilities).toEqual(expect.arrayContaining(['read', 'search', 'edit', 'messaging', 'handback', 'skill', 'task-tracking', 'mcp-discovery']));
  });
});

describe('native system-architect: the guard claims, against the real script', () => {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'agents-united-sysarch-guard-'));
  beforeAll(() => {
    fs.mkdirSync(path.join(project, '.claude/hooks'), { recursive: true });
    for (const file of fs.readdirSync(path.resolve('registry/hosts/claude/hooks'))) fs.copyFileSync(path.resolve('registry/hosts/claude/hooks', file), path.join(project, '.claude/hooks', file));
  });
  afterAll(() => fs.rmSync(project, { recursive: true, force: true }));
  const fire = (tool: string, input: Record<string, unknown>): { blocked: boolean; offered: boolean } => {
    const result = attempt(text(), project, { tool, input }, { agentType: 'system-architect' });
    return { blocked: result.blocked, offered: result.offered };
  };

  it('states what the guard blocks, and where it comes from in both modes', () => {
    expect(text()).toContain("- A guard blocks writes to `.env` files (not `.env.example`) through `Write`, `Edit` and `NotebookEdit`. As a subagent it comes from this file; as a teammate it comes from the project's settings.");
  });

  it.each([
    ['Write', { file_path: 'C:\\repo\\.env' }],
    ['Write', { file_path: '/repo/.env.production' }],
    ['Edit', { file_path: '/repo/.env.local', old_string: 'a', new_string: 'b' }],
    ['NotebookEdit', { notebook_path: '/repo/.env' }],
  ])('blocks %s of a .env file, as the Boundaries say', (tool, input) => {
    expect(fire(tool as string, input as Record<string, unknown>)).toEqual({ blocked: true, offered: true });
  });

  it.each([
    ['Write', { file_path: '/repo/.env.example' }],
    ['Write', { file_path: '/repo/docs/adr/0007-event-driven-orders.md' }],
    ['Edit', { file_path: '/repo/src/service/orders.ts', old_string: 'a', new_string: 'b' }],
  ])('does not block %s of %j: the guard blocks nothing else on file edits',(tool, input) => {
    expect(fire(tool as string, input as Record<string, unknown>).blocked).toBe(false);
  });

  it('the forced-push and vercel rules are shell rules: the role is offered no shell for them to act on', () => {
    for (const shell of ['Bash', 'PowerShell']) expect(fire(shell, { command: 'git push --force origin main' }).offered, shell).toBe(false);
    expect(text()).toContain("Its forced-push, `vercel --prod` and destructive-shell rules (a recursive delete of a root, home or project folder, privilege escalation, shutdown, disk formatting, cloud resource-group, project or account deletion) apply to shell commands, which you do not hold. It is a seat belt, not a boundary, it blocks nothing else, and `permissionMode: acceptEdits` approves your file edits without asking");
  });

  it('the destructive-shell rules are shell rules too: the role is offered no shell for `rm -rf /` or `sudo` to act on', () => {
    for (const shell of ['Bash', 'PowerShell']) for (const command of ['rm -rf /', 'sudo reboot']) expect(fire(shell, { command }).offered, `${shell} ${command}`).toBe(false);
  });

  it('the guard does not see GitHub MCP calls, so the push, merge and create duty is stated as the role\'s own', () => {
    for (const tool of ['mcp__github__push_files', 'mcp__github__merge_pull_request', 'mcp__github__create_pull_request']) expect(fire(tool, {}).blocked, tool).toBe(false);
    expect(text()).toContain('the guard does not see its calls, so not pushing, merging or creating anything there without being asked is your own obligation.');
  });

  it('names no guard behaviour the script does not have', () => {
    const boundaries = section(text(), 'Boundaries of this host');
    const claims = boundaries.replace(/`\.env(\.example)?`/g, 'ENV');
    expect(claims).not.toMatch(/blocks[^\n]*(production deploys|terraform|kubectl)/);
  });
});

describe('native system-architect: the shell-less working method', () => {
  it('step 1 maps the system with Glob, Grep and Read, and step 5 admits it cannot render or validate', () => {
    expect(step(1)).toContain('with `Glob`, `Grep` and `Read` before you design anything');
    expect(step(5)).toContain('You have no shell, so you cannot render a Mermaid diagram or validate a schema');
    expect(step(5)).toContain('report diagrams and contracts as not rendered or validated');
  });

  it('step 6 hands the report back through SubagentHandback in the plain form', () => {
    expect(step(6)).toBe('6. **Hand back.** Return the report from the Output Contract as your final message through `SubagentHandback`.');
  });

  it('Boundaries put a command the work needs under Open items for the lead', () => {
    expect(section(text(), 'Boundaries of this host')).toContain('A command the work needs (a diagram renderer, a schema validator, a build) goes under `Open items` for the lead.');
  });
});

describe('native system-architect: the skill table', () => {
  const bundles = (JSON.parse(fs.readFileSync(path.resolve('registry/bundles.json'), 'utf8')) as { bundles?: Record<string, { agents?: string[]; skills?: string[] }> }).bundles ?? {};
  const carrying = Object.entries(bundles).filter(([, bundle]) => (bundle.agents ?? []).includes('subagent-system-architect.md'));
  const tableSkills = (): string[] => [...section(text(), 'How to work').matchAll(/^\|[^|\n]*\|\s*`([a-z0-9-]+)`\s*\|$/gm)].map(match => match[1]!);

  it('is carried by the three system-architecture bundles and the aggregate full bundle, and by no other', () => {
    expect(carrying.map(([name]) => name).sort()).toEqual(['full', 'system-architecture', 'system-architecture-cloud', 'system-architecture-finops']);
  });

  it('names only skills that every carrying bundle installs, and that exist', () => {
    expect(tableSkills().length).toBeGreaterThan(0);
    for (const skill of tableSkills()) {
      expect(fs.existsSync(path.resolve('registry/skills', skill, 'SKILL.md')), skill).toBe(true);
      for (const [name, bundle] of carrying) expect(bundle.skills, `${skill} in ${name}`).toContain(skill);
    }
  });

  it('the contract lists the same skills as the canonical agent, all of which exist', () => {
    const contract = JSON.parse(fs.readFileSync(path.resolve('registry/core/subagent-system-architect.contract.json'), 'utf8')) as { skills: string[] };
    const front = /^---\n([\s\S]*?)\n---\n/.exec(canonical())![1]!;
    const declared = [...(/\nskills:\n((?:  - .*\n?)+)/.exec(`\n${front}\n`)?.[1] ?? '').matchAll(/^  - (.+)$/gm)].map(match => match[1]);
    expect(contract.skills).toEqual(declared);
    for (const skill of contract.skills) expect(fs.existsSync(path.resolve('registry/skills', skill, 'SKILL.md')), skill).toBe(true);
  });
});

describe('native system-architect: the peers section of the engineering family', () => {
  it("is devops-engineer's section line for line", () => {
    expect(section(text(), 'Working with peers').split('\n')).toEqual(section(nativeText('devops-engineer'), 'Working with peers').split('\n'));
  });

  it('is the Tier 1 form: a lead-spawned subagent first, no agency, no shutdown frame', () => {
    expect(text()).toContain('You run as a subagent that a lead spawns (Tier 1, the usual case) or as a teammate of a coordinated team. Follow the mode your brief names.');
    expect(text()).not.toMatch(/digital agency/i);
    expect(text()).not.toContain('shutdown_request');
  });

  it('holds the two messaging tools its capability gives', () => {
    expect(toolsOf(text())).toEqual(expect.arrayContaining(['ListAgents', 'SendMessage']));
  });

  it('carries the session task tracking section of backend-architect verbatim', () => {
    const tail = (body: string): string => body.slice(body.indexOf('\n## Session task tracking\n'));
    expect(tail(text())).toBe(tail(nativeText('backend-architect')));
  });
});

describe('native system-architect: the MCP servers and posture of its canonical agent', () => {
  it('holds github and context7 and says when to use them', () => {
    expect(toolsOf(text())).toEqual(expect.arrayContaining(['mcp__github', 'mcp__context7']));
    expect(text()).toContain('- Library and framework questions: confirm them with `mcp__context7` before relying on memory.');
    expect([...canonical().matchAll(/^  - name: (github|context7)$/gm)].map(match => match[1]).sort()).toEqual(['context7', 'github']);
  });

  it('permission mode equals the canonical value and effort is the same', () => {
    const value = (source: string, key: string): string | undefined => new RegExp(`^${key}: (.+)$`, 'm').exec(source)?.[1];
    expect(value(canonical(), 'permissionMode')).toBe('acceptEdits');
    expect(value(text(), 'permissionMode')).toBe('acceptEdits');
    expect(value(text(), 'effort')).toBe(value(canonical(), 'effort'));
    expect(value(text(), 'model')).toBe('sonnet');
  });

  it('states the acceptEdits limit: nothing but the role itself keeps its edits to architecture documents', () => {
    expect(section(text(), 'Boundaries of this host')).toContain('keeping to architecture documents, specs and diagrams, and changing application source only when your brief asks, is your own obligation.');
  });
});

describe('native system-architect: the shared scope_boundaries and safety', () => {
  const normalize = (value: string): string => value.replace(/\s+/g, ' ').trim();

  it('carries every numbered Primary Directive of the canonical agent, word for word', async () => {
    const directives = [...(/\n## Primary Directives\n([\s\S]*?)(?=\n## )/.exec(canonical())?.[1] ?? '').matchAll(/^(\d+)\. (.+)$/gm)].map(match => normalize(`${match[1]}. ${match[2]}`));
    expect(directives).toHaveLength(5);
    const scope = normalize((await loadSemanticCore('registry')).get('subagent-system-architect')!.scope_boundaries);
    for (const directive of directives) expect(scope, directive).toContain(directive);
  });

  it('keeps the rest of the directive text, the four anti-patterns and the protocol phases', async () => {
    const scope = (await loadSemanticCore('registry')).get('subagent-system-architect')!.scope_boundaries;
    for (const part of ['aggregate roots', 'Mermaid graph syntax', 'Retry with Exponential Backoff', 'Nygard / MADR', 'availability (99.99%)', 'docs/adr/XXXX-title.md', 'OpenAPI, gRPC or AsyncAPI']) expect(scope, part).toContain(part);
    for (const pattern of ['distributed monolith', 'anemic domain model', 'synchronous chains', 'big ball of mud']) expect(scope.toLowerCase(), pattern).toContain(pattern);
  });

  it('carries both safety guardrails of the canonical agent', async () => {
    const safety = (await loadSemanticCore('registry')).get('subagent-system-architect')!.safety;
    const guardrails = [...(/\n## Safety Guardrails\n([\s\S]*?)(?=\n## )/.exec(canonical())?.[1] ?? '').matchAll(/^- (.+)$/gm)].map(match => match[1]!);
    expect(guardrails).toHaveLength(2);
    for (const guardrail of guardrails) expect(safety).toContain(guardrail);
  });
});
