import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadSemanticCore } from '../src/core/semantic-core.js';
import { attempt } from './helpers/claude-host-hooks.js';
import { nativeText } from './helpers/native-roles.js';

/**
 * The native `sysops-sre-lead`, brought in the way `system-architect` was: an editor-only role (its canonical agent has no shell tool),
 * so what its authored body says about the bound guard is the guard's behaviour for the editors, and every "blocked" claim is fired at
 * the real script. Its canonical task and timer tools are not carried over (a specialist holds no scheduling tool), and the body says so.
 */

const text = (): string => nativeText('sysops-sre-lead');
const canonical = (): string => fs.readFileSync(path.resolve('registry/agents/subagent-sysops-sre-lead.md'), 'utf8').replace(/\r\n/g, '\n');
const toolsOf = (body: string): string[] => /^tools: (.*)$/m.exec(body)![1]!.split(', ');
const section = (body: string, heading: string): string => new RegExp(`\\n## ${heading}\\n([\\s\\S]*?)(?=\\n## |$)`).exec(body)![1]!.trim();
/** A numbered step of the "How to work" section. */
const step = (n: number): string => new RegExp(`^${n}\\. .*$`, 'm').exec(section(text(), 'How to work'))![0];

describe('native sysops-sre-lead: no shell, as its canonical agent', () => {
  it('holds the editors and the search tools, and no shell, monitor, web, delegation or scheduling tool', () => {
    const tools = toolsOf(text());
    expect(tools).toEqual(expect.arrayContaining(['Edit', 'Write', 'Glob', 'Grep', 'Read', 'Skill', 'SubagentHandback']));
    for (const absent of ['Bash', 'PowerShell', 'Monitor', 'WebFetch', 'WebSearch', 'Agent', 'EnterWorktree', 'LSP', 'CronCreate', 'CronDelete', 'CronList']) expect(tools, absent).not.toContain(absent);
  });

  it("the canonical agent's tools are file tools plus the task and timer tools, with no command tool", () => {
    const front = /^---\n([\s\S]*?)\n---\n/.exec(canonical())![1]!;
    const tools = [...(/\ntools:\n((?:  - .*\n?)+)/.exec(`\n${front}\n`)?.[1] ?? '').matchAll(/^  - (.+)$/gm)].map(match => match[1]);
    expect(tools).toEqual(['view_file', 'grep_search', 'list_dir', 'replace_file_content', 'write_to_file', 'manage_task', 'schedule', 'find_by_name']);
    expect(tools).not.toContain('run_command');
  });

  it('the shared core declares no shell and no scheduling capability and keeps the capabilities the grant needs', async () => {
    const capabilities = (await loadSemanticCore('registry')).get('subagent-sysops-sre-lead')!.capabilities ?? [];
    for (const absent of ['shell', 'scheduling', 'background-monitor']) expect(capabilities, absent).not.toContain(absent);
    expect(capabilities).toEqual(expect.arrayContaining(['read', 'search', 'edit', 'messaging', 'handback', 'skill', 'task-tracking', 'mcp-discovery']));
    expect(toolsOf(text())).toEqual(expect.arrayContaining(['TaskCreate', 'TaskGet', 'TaskList', 'TaskUpdate']));
  });

  it('says that a recurring check or timer is a schedule request, not an action', () => {
    expect(section(text(), 'Boundaries of this host')).toContain('a recurring health check or a timer is a `schedule` request, not an action you take.');
  });
});

describe('native sysops-sre-lead: the guard claims, against the real script', () => {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'agents-united-sysops-guard-'));
  beforeAll(() => {
    fs.mkdirSync(path.join(project, '.claude/hooks'), { recursive: true });
    for (const file of fs.readdirSync(path.resolve('registry/hosts/claude/hooks'))) fs.copyFileSync(path.resolve('registry/hosts/claude/hooks', file), path.join(project, '.claude/hooks', file));
  });
  afterAll(() => fs.rmSync(project, { recursive: true, force: true }));
  const fire = (tool: string, input: Record<string, unknown>): { blocked: boolean; offered: boolean } => {
    const result = attempt(text(), project, { tool, input }, { agentType: 'sysops-sre-lead' });
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
    ['Write', { file_path: '/repo/ops/runbooks/database-failover.md' }],
    ['Edit', { file_path: '/repo/ops/prometheus/alert-rules.yml', old_string: 'a', new_string: 'b' }],
  ])('does not block %s of %j: the guard blocks nothing else on file edits', (tool, input) => {
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

describe('native sysops-sre-lead: the shell-less working method', () => {
  it('step 1 inspects the telemetry with Glob, Grep and Read, and step 5 admits it cannot run, lint or rehearse', () => {
    expect(step(1)).toContain('Read the existing telemetry configuration and SLI metrics with `Glob`, `Grep` and `Read` before you triage or design anything');
    expect(step(5)).toContain('You have no shell, so you cannot run a probe, lint an alert rule, validate a dashboard or rehearse a failover');
    expect(step(5)).toContain('report alert rules, dashboards, runbooks and recovery plans as not validated or exercised');
  });

  it('step 6 hands the report back through SubagentHandback in the plain form', () => {
    expect(step(6)).toBe('6. **Hand back.** Return the report from the Output Contract as your final message through `SubagentHandback`.');
  });

  it('Boundaries send a command the work needs to the lead as a run-command request', () => {
    expect(section(text(), 'Boundaries of this host')).toContain('A command the work needs (a probe, a chaos experiment, a `kubectl` call, an alert-rule linter, a restoration drill) goes to the lead as a `run-command` entry under `Requests for the lead`.');
  });
});

describe('native sysops-sre-lead: the skill table', () => {
  const bundles = (JSON.parse(fs.readFileSync(path.resolve('registry/bundles.json'), 'utf8')) as { bundles?: Record<string, { agents?: string[]; skills?: string[]; parentBundle?: string }> }).bundles ?? {};
  const carrying = Object.entries(bundles).filter(([, bundle]) => (bundle.agents ?? []).includes('subagent-sysops-sre-lead.md'));
  /** What a Bundle installs: its own skills and its parent's (a child inherits the parent's skills). */
  const installs = (name: string): string[] => [...(bundles[name]?.skills ?? []), ...(bundles[bundles[name]?.parentBundle ?? '']?.skills ?? [])];
  const tableSkills = (): string[] => [...section(text(), 'How to work').matchAll(/^\|[^|\n]*\|\s*`([a-z0-9-]+)`\s*\|$/gm)].map(match => match[1]!);

  it('is carried by the sysops-sre bundle and the aggregate full bundle, and by no other', () => {
    expect(carrying.map(([name]) => name).sort()).toEqual(['full', 'sysops-sre']);
  });

  it('names only skills that every carrying bundle installs, and that exist', () => {
    expect(tableSkills().length).toBeGreaterThan(0);
    for (const skill of tableSkills()) {
      expect(fs.existsSync(path.resolve('registry/skills', skill, 'SKILL.md')), skill).toBe(true);
      for (const [name] of carrying) expect(installs(name), `${skill} in ${name}`).toContain(skill);
    }
  });

  it('the contract lists the same skills as the canonical agent, all of which exist, and the table names each of them', () => {
    const contract = JSON.parse(fs.readFileSync(path.resolve('registry/core/subagent-sysops-sre-lead.contract.json'), 'utf8')) as { skills: string[] };
    const front = /^---\n([\s\S]*?)\n---\n/.exec(canonical())![1]!;
    const declared = [...(/\nskills:\n((?:  - .*\n?)+)/.exec(`\n${front}\n`)?.[1] ?? '').matchAll(/^  - (.+)$/gm)].map(match => match[1]);
    expect(contract.skills).toEqual(declared);
    for (const skill of contract.skills) expect(fs.existsSync(path.resolve('registry/skills', skill, 'SKILL.md')), skill).toBe(true);
    expect([...tableSkills()].sort()).toEqual([...declared].sort());
  });
});

describe('native sysops-sre-lead: the peers section of the engineering family', () => {
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

describe('native sysops-sre-lead: the MCP servers and posture of its canonical agent', () => {
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

  it('states the acceptEdits limit: nothing but the role itself keeps its edits to operations documents', () => {
    expect(section(text(), 'Boundaries of this host')).toContain('keeping to runbooks, alert rules, dashboard definitions and post-mortems, and changing application or infrastructure source only when your brief asks, is your own obligation.');
  });
});

describe('native sysops-sre-lead: the shared scope_boundaries and safety', () => {
  const normalize = (value: string): string => value.replace(/\s+/g, ' ').trim();

  it('carries every numbered Primary Directive of the canonical agent, word for word, with no substitution', async () => {
    const directives = [...(/\n## Primary Directives\n([\s\S]*?)(?=\n## )/.exec(canonical())?.[1] ?? '').matchAll(/^(\d+)\. (.+)$/gm)].map(match => normalize(`${match[1]}. ${match[2]}`));
    expect(directives).toHaveLength(5);
    const scope = normalize((await loadSemanticCore('registry')).get('subagent-sysops-sre-lead')!.scope_boundaries);
    for (const directive of directives) expect(scope, directive).toContain(directive);
    expect(canonical()).toContain('plan OS security updates and kernel patch cycles');
    expect(canonical()).not.toContain('schedule OS security updates');
  });

  it('keeps the three protocol phases and the four anti-patterns with their risks and practices', async () => {
    const scope = (await loadSemanticCore('registry')).get('subagent-sysops-sre-lead')!.scope_boundaries;
    for (const part of ['alertmanager definitions', 'error rates (5xx HTTP responses)', 'latency percentiles (p95, p99)', 'P1 Critical Outage vs P3 Minor Degraded State', 'traffic rerouting, pod scaling, database failover', 'Blameless Post-Mortem documents']) expect(scope, part).toContain(part);
    const rows = [...(/\| Anti-Pattern \| Risk \| Recommended Practice \|\n\|[-| ]+\|\n((?:\|.*\n?)+)/.exec(canonical())?.[1] ?? '').matchAll(/^\| (.+?) \| (.+?) \| (.+?) \|$/gm)];
    expect(rows).toHaveLength(4);
    expect(scope.match(/^- Refuse /gm) ?? []).toHaveLength(4);
    for (const line of [
      'Refuse alert fatigue (noisy non-actionable alerts), which risks missed critical outages: alert on symptoms affecting SLOs, not transient blips.',
      'Refuse single point of failure (SPOF) infrastructure, which risks total service downtime: use multi-AZ and multi-region redundancy.',
      'Refuse manual un-documented server changes, which cause configuration drift: use managed infrastructure automation and runbooks.',
      'Refuse untested disaster recovery backups, which risk data loss during a real failure: prove them with automated backup restoration drills.',
    ]) expect(scope, line).toContain(line);
    for (const [, pattern] of rows) expect(canonical(), pattern).toContain(pattern!);
  });

  it('keeps the output requirements of the canonical agent in the output contract', async () => {
    const output = (await loadSemanticCore('registry')).get('subagent-sysops-sre-lead')!.output_contract;
    for (const part of ['runbooks', 'Prometheus alert rules', 'Grafana dashboard', 'Blameless Post-Mortem templates']) expect(output, part).toContain(part);
  });

  it('claims nothing the canonical agent does not say in its safety lines: each follows from an anti-pattern', async () => {
    const safety = (await loadSemanticCore('registry')).get('subagent-sysops-sre-lead')!.safety;
    expect(safety).toContain('Never propose a production change outside managed automation and a documented runbook.');
    expect(safety).toContain('Never report a disaster recovery backup or a runbook as proven before a restoration drill or an exercise has verified it.');
    expect(canonical()).toContain('Manual un-documented server changes');
    expect(canonical()).toContain('Untested disaster recovery backups');
  });
});
