import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadSemanticCore } from '../src/core/semantic-core.js';
import { attempt } from './helpers/claude-host-hooks.js';
import { nativeText } from './helpers/native-roles.js';

/**
 * The native distributed-systems-architect (Bundle `backend-distributed-systems`): what its authored body must keep saying. It holds a shell, so every claim about what
 * the bound guard blocks, and what it does not stop, is fired against the real script. Its canonical agent has `commandExecutionPolicy: ask`
 * and permissionMode acceptEdits; the guard hook of the canonical agent (recursive deletes, privilege escalation, shutdown) is part of the shared core's safety.
 */

const ROLE = 'distributed-systems-architect';
const text = (): string => nativeText(ROLE);
const canonical = (): string => fs.readFileSync(path.resolve('registry/agents/subagent-distributed-systems-architect.md'), 'utf8').replace(/\r\n/g, '\n');
const toolsOf = (body: string): string[] => /^tools: (.*)$/m.exec(body)![1]!.split(', ');
/** The shared clause every Claude role carries (ADR 0074, tests/guard-destructive-upgrade.test.ts). */
const COMMON_FORMS = 'the common forms of destructive shell commands (a recursive delete of a root, home or project folder, privilege escalation, shutdown, disk formatting, cloud resource-group, project or account deletion)';
/** A numbered step of the "How to work" section, not the first line of the file that happens to start with the number. */
const step = (n: number): string => {
  const work = /\n## How to work\n([\s\S]*?)(?=\n## )/.exec(text())![1]!;
  return new RegExp(`^${n}\\. .*$`, 'm').exec(work)![0];
};
const peersSection = (body: string): string => /\n## Working with peers\n([\s\S]*?)(?=\n## )/.exec(body)![1]!.trim();
const sessionSection = (body: string): string => /\n## Session task tracking\n([\s\S]*)$/.exec(body)![1]!.trim();
/** The numbered lines and the "- Never" lines of a block, line endings normalised, so lists can be compared exactly. */
const lf = (block: string): string => block.replace(/\r\n/g, '\n');
const numberedLines = (block: string): string[] => lf(block).split('\n').filter(line => /^\d+\. /.test(line));
const neverLines = (block: string): string[] => lf(block).split('\n').filter(line => line.startsWith('- Never '));
const floorSection = (body: string, heading: string): string => new RegExp('\\n## ' + heading + '\\n([\\s\\S]*?)(?=\\n## )').exec(lf(body))![1]!;

describe('native distributed-systems-architect: the exact tool set, model and effort', () => {
  it('holds exactly this tool set', () => {
    expect([...toolsOf(text())].sort()).toEqual([
      'Bash', 'Edit', 'Glob', 'Grep', 'ListAgents', 'ListMcpResourcesTool', 'NotebookEdit', 'PowerShell', 'Read', 'ReadMcpResourceTool', 'SendMessage', 'Skill',
      'SubagentHandback', 'TaskCreate', 'TaskGet', 'TaskList', 'TaskUpdate', 'TodoWrite', 'ToolSearch', 'Write',
      'mcp__context7', 'mcp__github',
    ]);
  });

  it('is the tool set of devops-engineer and e2e-tester without their Monitor and TaskStop, whose canonical agents have the same tool list, with the servers of its own canonical agent', () => {
    // The siblings keep `Monitor` and `TaskStop` (their cores declare background-monitor); this canonical agent has no task-management tool, so its core does not.
    const shared = (body: string): string[] => toolsOf(body).filter(tool => !tool.startsWith('mcp__')).sort();
    const withoutMonitor = (body: string): string[] => shared(body).filter(tool => tool !== 'Monitor' && tool !== 'TaskStop');
    expect(shared(nativeText('devops-engineer'))).toContain('Monitor');
    expect(shared(nativeText('e2e-tester'))).toContain('Monitor');
    expect(shared(nativeText('devops-engineer'))).toContain('TaskStop');
    expect(shared(text())).toEqual(withoutMonitor(nativeText('devops-engineer')));
    expect(shared(text())).toEqual(withoutMonitor(nativeText('e2e-tester')));
    const canonicalTools = /^tools:\n((?:  - .+\n)+)/m.exec(canonical())![1]!.split('\n').filter(Boolean).map(line => line.replace(/^  - /, ''));
    expect(canonicalTools).toEqual(['view_file', 'grep_search', 'list_dir', 'replace_file_content', 'write_to_file', 'find_by_name', 'run_command']);
  });

  it('pins model sonnet and effort medium (ADR 0018 decision 7)', () => {
    expect(/^model: (.+)$/m.exec(text())![1]).toBe('sonnet');
    expect(/^effort: (.+)$/m.exec(text())![1]).toBe('medium');
  });

  it('holds no delegation, workflow, scheduling or user-question tool, and says they are not available', () => {
    for (const forbidden of ['Agent', 'Workflow', 'CronCreate', 'CronDelete', 'CronList', 'AskUserQuestion', 'WebFetch', 'WebSearch']) expect(toolsOf(text()), forbidden).not.toContain(forbidden);
    expect(text()).toContain('- Running workflows, scheduling and spawning teammates or subagents are not available to you. Request them from the lead as `run-workflow`, `schedule` or `delegate` entries under `Requests for the lead`.');
  });

  it('holds the messaging and task tools its capabilities give, no Monitor, and the core declares exactly those capabilities', async () => {
    expect(toolsOf(text())).toEqual(expect.arrayContaining(['ListAgents', 'SendMessage', 'TaskCreate', 'TaskGet', 'TaskList', 'TaskUpdate', 'TodoWrite']));
    expect(toolsOf(text())).not.toContain('Monitor');
    expect(text()).not.toContain('Monitor');
    const capabilities = (await loadSemanticCore('registry')).get('subagent-distributed-systems-architect')!.capabilities;
    expect(capabilities).toEqual(expect.arrayContaining(['messaging', 'task-tracking']));
    expect(capabilities).not.toContain('background-monitor');
  });
});

describe('native distributed-systems-architect: the MCP servers, skills and permission mode of its canonical agent', () => {
  it('holds github and context7, and nothing beyond them', () => {
    const servers = toolsOf(text()).filter(tool => tool.startsWith('mcp__')).sort();
    expect(servers).toEqual(['mcp__context7', 'mcp__github']);
    expect([...canonical().matchAll(/^  - name: (.+)$/gm)].map(match => `mcp__${match[1]}`).sort()).toEqual(servers);
  });

  it('names the same six skills as the canonical agent and the contract, in its skill table', () => {
    const listed = /^skills:\n((?:  - .+\n)+)/m.exec(canonical())![1]!.split('\n').filter(Boolean).map(line => line.replace(/^  - /, '')).sort();
    expect(listed).toHaveLength(6);
    const contract = JSON.parse(fs.readFileSync(path.resolve('registry/core/subagent-distributed-systems-architect.contract.json'), 'utf8')) as { skills: string[] };
    expect([...contract.skills].sort()).toEqual(listed);
    const table = [...text().matchAll(/^\|[^|\n]*\|\s*`([a-z0-9-]+)`\s*\|/gm)].map(match => match[1]).sort();
    expect(table).toEqual(listed);
  });

  it('keeps permissionMode acceptEdits, as the canonical agent has it, and states its limit in step 5', () => {
    const mode = (source: string): string | undefined => /^permissionMode: (.+)$/m.exec(source.replace(/\r\n/g, '\n'))?.[1];
    expect(mode(canonical())).toBe('acceptEdits');
    expect(mode(text())).toBe('acceptEdits');
    expect(step(5)).toContain('`permissionMode: acceptEdits` approves your file edits and common file commands such as `mkdir`, `mv` and `cp` in the working folder without asking.');
  });
});

describe('native distributed-systems-architect: the guard claims', () => {
  it('step 5 names what the guard reads, and what it does not stop', () => {
    const five = step(5);
    expect(five).toContain('reads command text and file paths: it does not stop an ordinary, non-forced `git push`');
    expect(five).toContain('a `protoc` or code-generation run, or a broker administration command such as deleting a Kafka topic');
    expect(five).toContain('keeping a boundary change additive and versioned is your own obligation');
    expect(five).toMatch(/your own obligation/);
    expect(five).toContain('report it as not run instead of asserting success.');
  });

  it('Boundaries carry the one guard sentence, and say where the guard comes from in both modes', () => {
    const sentence = `A guard blocks \`git push --force\` and \`-f\` (not \`--force-with-lease\`), \`vercel --prod\`, \`.env\` files (not \`.env.example\`) written with an editing tool or a \`>\` redirect, and ${COMMON_FORMS}; it is a seat belt, not a boundary.`;
    expect(text().split(sentence)).toHaveLength(2);
    expect(text().split('A guard blocks')).toHaveLength(2);
    expect(text()).toContain(`${sentence} As a subagent it comes from this file, when the host runs this file's hooks. As a teammate it comes from the settings-level session guard, which is optional and may be off. You cannot verify from inside that a guard is active, so keep its rules as your own obligation in either case. Never try to get around it.`);
  });

  describe('against the real guard script', () => {
    const project = fs.mkdtempSync(path.join(os.tmpdir(), 'agents-united-distributed-systems-architect-guard-'));
    beforeAll(() => {
      fs.mkdirSync(path.join(project, '.claude/hooks'), { recursive: true });
      for (const file of fs.readdirSync(path.resolve('registry/hosts/claude/hooks'))) fs.copyFileSync(path.resolve('registry/hosts/claude/hooks', file), path.join(project, '.claude/hooks', file));
    });
    afterAll(() => fs.rmSync(project, { recursive: true, force: true }));
    const run = (tool: string, command: string): boolean => attempt(text(), project, { tool, input: { command } }, { agentType: ROLE }).blocked;
    /** NotebookEdit names its target in `notebook_path`, the other editors in `file_path`. */
    const write = (tool: string, file: string): boolean => attempt(text(), project, { tool, input: tool === 'NotebookEdit' ? { notebook_path: file } : { file_path: file } }, { agentType: ROLE }).blocked;
    /** The hook must have fired and exited 2: an absent hook cannot satisfy a block case. */
    const blockedByHook = (tool: string, command: string): { blocked: boolean; fired: number; statuses: Array<number | null> } => {
      const result = attempt(text(), project, { tool, input: { command } }, { agentType: ROLE });
      return { blocked: result.blocked, fired: result.fired, statuses: result.statuses };
    };

    it.each(['Bash', 'PowerShell'])('blocks the forms of the canonical agent\'s own guard (rm -rf, sudo, shutdown) and the named forms through %s', tool => {
      for (const command of ['rm -rf /', 'rm -rf ~', 'sudo ls', 'shutdown now', 'git push --force origin main', 'git push -f origin main', 'vercel --prod']) expect(run(tool, command), `${tool}: ${command}`).toBe(true);
    });

    it.each(['Bash', 'PowerShell'])('blocks a shell redirect to .env, disk formatting, a recursive delete of a project folder, a short-flag forced push and a cloud resource-group, project or account deletion through %s, and the hook fired with status 2', tool => {
      for (const command of ['echo X > .env', 'mkfs.ext4 /dev/sda1', 'rm -Rf .', 'env FOO=1 rm -rf .git', 'az group delete --name rg-prod --yes', 'gcloud projects delete my-project', 'aws organizations close-account --account-id 1', 'git push -f origin main']) {
        const result = blockedByHook(tool, command);
        expect(result, `${tool}: ${command}`).toEqual({ blocked: true, fired: 1, statuses: [2] });
      }
    });

    it.each(['Write', 'Edit', 'NotebookEdit'])('blocks a %s of .env and .env.local, and lets .env.example and a protobuf file through', tool => {
      expect(write(tool, path.join(project, '.env'))).toBe(true);
      expect(write(tool, path.join(project, '.env.local'))).toBe(true);
      expect(write(tool, path.join(project, '.env.example'))).toBe(false);
      expect(write(tool, path.join(project, 'proto/orders/v1/orders.proto'))).toBe(false);
    });

    it.each([
      'git push origin feature/orders-events',
      'protoc --proto_path=proto --go_out=gen proto/orders/v1/orders.proto',
      'kafka-topics.sh --bootstrap-server localhost:9092 --delete --topic orders',
    ])('does not stop %s, as step 5 says', command => {
      expect(run('Bash', command)).toBe(false);
    });

    it.each(['Bash', 'PowerShell'])('does not stop a recursive delete of a build folder such as rm -rf node_modules through %s', tool => {
      expect(run(tool, 'rm -rf node_modules'), `${tool}: rm -rf node_modules`).toBe(false);
    });
  });
});

describe('native distributed-systems-architect: the peers section of the engineering family', () => {
  it("is devops-engineer's section line for line", () => {
    expect(peersSection(text()).split('\n')).toEqual(peersSection(nativeText('devops-engineer')).split('\n'));
  });

  it('is the Tier 1 form: a lead-spawned subagent first, no agency, no shutdown frame, no teammate-reality paragraph', () => {
    const body = text();
    expect(body).toContain('You run as a subagent that a lead spawns (Tier 1, the usual case) or as a teammate of a coordinated team. Follow the mode your brief names.');
    expect(body).not.toMatch(/digital agency/i);
    expect(body).not.toContain('shutdown_request');
    expect(body).not.toContain('a brief cannot make you a teammate');
  });

  it('step 6 hands the report back through SubagentHandback', () => {
    expect(step(6)).toContain('as your final message: your final answer is the hand-back. Deliver it through `SubagentHandback` only where the host supplies that tool; where it does not, your ordinary final response is the hand-back.');
  });

  it("carries the siblings' Session task tracking section text-identical (trimmed, same line endings), as the last section", () => {
    expect(sessionSection(text())).toBe(sessionSection(nativeText('e2e-tester')));
    expect(sessionSection(text())).toBe(sessionSection(nativeText('devops-engineer')));
    expect(sessionSection(text())).toBe(sessionSection(nativeText('accessibility-lead')));
    expect(text().trimEnd().endsWith(sessionSection(text()))).toBe(true);
  });
});

describe('native distributed-systems-architect: the shared scope_boundaries and safety', () => {
  it('carries the numbered directives of the canonical agent, the core and the native floor as identical lists, and the protocol', async () => {
    const scope = (await loadSemanticCore('registry')).get('subagent-distributed-systems-architect')!.scope_boundaries.replace(/\s+/g, ' ');
    const section = /\n## Primary Directives\n([\s\S]*?)(?=\n---\n|\n## )/.exec(canonical())![1]!;
    const directives = numberedLines(section);
    expect(directives).toHaveLength(5);
    expect(numberedLines((await loadSemanticCore('registry')).get('subagent-distributed-systems-architect')!.scope_boundaries)).toEqual(directives);
    expect(numberedLines(floorSection(text(), 'Scope Boundaries'))).toEqual(directives);
    for (const phase of ['Audit', 'Design', 'Verification', 'say so explicitly instead of asserting success']) expect(scope, phase).toContain(phase);
  });

  it('carries the Never guardrails of the canonical agent, the core and the native floor as identical lists, and its destructive-command guard', async () => {
    const safety = (await loadSemanticCore('registry')).get('subagent-distributed-systems-architect')!.safety;
    const guardrails = neverLines(/\n## Safety Guardrails\n([\s\S]*?)(?=\n---\n|\n## )/.exec(canonical())![1]!);
    expect(guardrails).toHaveLength(3);
    expect(neverLines(safety)).toEqual(guardrails);
    expect(neverLines(floorSection(text(), 'Safety'))).toEqual(guardrails);
    expect(safety).toContain('- Do not run destructive shell commands such as recursive deletes, privilege escalation or shutdown.');
    expect(canonical()).toContain('Deny run_command if CommandLine matches /(rm -rf|sudo|shutdown)/i');
  });

  it('names no tool and no host in the core', async () => {
    const core = (await loadSemanticCore('registry')).get('subagent-distributed-systems-architect')!;
    const all = [core.identity, core.mission, core.scope_boundaries, core.output_contract, core.safety, ...core.invariants].join('\n');
    for (const token of ['run_command', 'view_file', 'send_message', 'manage_task', 'Bash', 'SubagentHandback', 'Claude']) expect(all, token).not.toContain(token);
  });
});
