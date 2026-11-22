import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadSemanticCore, scanCoreForHostTokens } from '../src/core/semantic-core.js';
import { attempt } from './helpers/claude-host-hooks.js';
import { nativeText } from './helpers/native-roles.js';

/**
 * The native `finops-cost-engineer`, brought in the way `database-administrator` and `cloud-infrastructure-architect` were.
 * Its canonical agent has the same tool set as devops-engineer, run_command included, so it holds a shell and a monitor; its canonical
 * `schedule` is not carried over (a specialist holds no scheduling tool), and its only canonical MCP server is context7 (no github).
 * Every "blocked" and "not blocked" claim of its body is fired at the real guard script.
 */

/** The shared clause every Claude role carries (ADR 0074, tests/guard-destructive-upgrade.test.ts). */
const COMMON_FORMS = 'the common forms of destructive shell commands (a recursive delete of a root, home or project folder, privilege escalation, shutdown, disk formatting, cloud resource-group, project or account deletion)';

const ROLE = 'finops-cost-engineer';
const text = (): string => nativeText(ROLE);
const canonical = (): string => fs.readFileSync(path.resolve('registry/agents/subagent-finops-cost-engineer.md'), 'utf8').replace(/\r\n/g, '\n');
const toolsOf = (body: string): string[] => /^tools: (.*)$/m.exec(body)![1]!.split(', ');
const section = (body: string, heading: string): string => new RegExp(`\\n## ${heading}\\n([\\s\\S]*?)(?=\\n## |$)`).exec(body)![1]!.trim();
/** A numbered step of the "How to work" section. */
const step = (n: number): string => new RegExp(`^${n}\\. .*$`, 'm').exec(section(text(), 'How to work'))![0];

describe('native finops-cost-engineer: the tools its canonical agent has', () => {
  it("the canonical agent's tools are the file tools, the command tool and the task and timer tools", () => {
    const front = /^---\n([\s\S]*?)\n---\n/.exec(canonical())![1]!;
    const tools = [...(/\ntools:\n((?:  - .*\n?)+)/.exec(`\n${front}\n`)?.[1] ?? '').matchAll(/^  - (.+)$/gm)].map(match => match[1]);
    expect(tools).toEqual(['view_file', 'replace_file_content', 'write_to_file', 'run_command', 'grep_search', 'list_dir', 'manage_task', 'schedule', 'find_by_name']);
  });

  it('holds both shells, the editors, the monitor and the task tools, and no web, delegation or scheduling tool', () => {
    const tools = toolsOf(text());
    expect(tools).toEqual(expect.arrayContaining(['Bash', 'PowerShell', 'Edit', 'Write', 'NotebookEdit', 'Monitor', 'Glob', 'Grep', 'Read', 'Skill', 'SendMessage', 'ListAgents', 'SubagentHandback', 'TaskCreate', 'TaskGet', 'TaskList', 'TaskUpdate', 'TodoWrite']));
    for (const absent of ['WebFetch', 'WebSearch', 'Agent', 'EnterWorktree', 'LSP', 'CronCreate', 'CronDelete', 'CronList', 'ScheduleWakeup']) expect(tools, absent).not.toContain(absent);
  });

  it('the shared core declares the shell and the monitor and not scheduling, and keeps the capabilities the grant needs', async () => {
    const capabilities = (await loadSemanticCore('registry')).get('subagent-finops-cost-engineer')!.capabilities ?? [];
    expect(capabilities).toEqual(expect.arrayContaining(['read', 'search', 'edit', 'shell', 'messaging', 'handback', 'skill', 'background-monitor', 'task-tracking', 'mcp-discovery']));
    expect(capabilities).not.toContain('scheduling');
  });

  it('says that a recurring cost review or timer is a recommendation under Open items, not an action', () => {
    expect(section(text(), 'Boundaries of this host')).toContain('a recurring cost review or a timer is a `schedule` request, not an action you take.');
  });

  it('search through Bash is stated for macOS, Linux and WSL', () => {
    expect(step(1)).toContain('On macOS, Linux and WSL this role holds `Bash`, so `Glob` and `Grep` are unavailable there and search runs through `Bash`.');
  });
});

describe('native finops-cost-engineer: the guard and spend-changing claims, against the real script', () => {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'agents-united-finops-guard-'));
  beforeAll(() => {
    fs.mkdirSync(path.join(project, '.claude/hooks'), { recursive: true });
    for (const file of fs.readdirSync(path.resolve('registry/hosts/claude/hooks'))) fs.copyFileSync(path.resolve('registry/hosts/claude/hooks', file), path.join(project, '.claude/hooks', file));
  });
  afterAll(() => fs.rmSync(project, { recursive: true, force: true }));
  const fire = (tool: string, input: Record<string, unknown>): { blocked: boolean; offered: boolean } => {
    const result = attempt(text(), project, { tool, input }, { agentType: ROLE });
    return { blocked: result.blocked, offered: result.offered };
  };
  const shell = (tool: 'Bash' | 'PowerShell', command: string): boolean => fire(tool, { command }).blocked;

  it('step 6 names exactly what the bound guard blocks, and what it does not', () => {
    const six = step(6);
    expect(six).toContain(`blocks forced pushes, \`vercel --prod\`, \`.env\` writes and ${COMMON_FORMS}; it is a seat belt, not a boundary.`);
    expect(six).not.toContain('blocks only');
    expect(six).not.toContain('does not enforce the Safety rule');
    // The blocking clause alone: what follows "it is a seat belt" names the commands the guard does or does NOT stop.
    const blocking = six.slice(six.indexOf('blocks forced'), six.indexOf('it is a seat belt'));
    expect(blocking).not.toMatch(/ec2|savingsplans|reserved|az vm|terraform/i);
    const stopped = six.slice(six.indexOf('It does stop'), six.indexOf('but it does not stop'));
    for (const other of ['`az group delete`', '`gcloud projects delete`', 'AWS account closure']) expect(stopped, other).toContain(other);
    const notStopped = six.slice(six.indexOf('but it does not stop'));
    for (const other of ['`aws ec2 modify-instance-attribute`', '`aws ec2 terminate-instances`', '`aws ec2 purchase-reserved-instances-offering`', '`aws savingsplans create-savings-plan`', '`az vm resize`', '`terraform apply`', 'does not catch every destructive form']) {
      expect(notStopped, other).toContain(other);
    }
    expect(six).toMatch(/your own obligation/);
  });

  it.each(['Bash', 'PowerShell'] as const)('%s: blocks a forced push, vercel --prod, a redirect into .env, the destructive shell forms and a resource-group, project or account deletion, as the Boundaries and step 6 say', tool => {
    for (const command of [
      'git push --force origin main', 'git push -f origin main', 'vercel --prod', 'echo TOKEN=x > .env', 'echo TOKEN=x > config/.env.production',
      'rm -rf /', 'sudo ls', 'shutdown now',
      'az group delete --name rg-prod --yes', 'gcloud projects delete my-project', 'aws organizations close-account --account-id 123456789012',
    ]) expect(shell(tool, command), command).toBe(true);
  });

  it.each(['Bash', 'PowerShell'] as const)('%s: does not block the read-only billing queries or the spend-changing commands step 6 lists, nor a delete of a build folder', tool => {
    for (const command of [
      'aws ce get-cost-and-usage --time-period Start=2026-10-01,End=2026-11-01 --granularity MONTHLY --metrics UnblendedCost',
      'az consumption usage list --start-date 2026-10-01 --end-date 2026-10-31',
      'bq query --use_legacy_sql=false "SELECT service.description, SUM(cost) FROM billing.export GROUP BY 1"',
      'aws ec2 modify-instance-attribute --instance-id i-0abc --instance-type t3.small',
      'aws ec2 terminate-instances --instance-ids i-0abc',
      'aws ec2 purchase-reserved-instances-offering --reserved-instances-offering-id abc --instance-count 4',
      'aws savingsplans create-savings-plan --savings-plan-offering-id abc --commitment 10',
      'az vm resize --resource-group rg-prod --name vm1 --size Standard_D2s_v3',
      'terraform apply -auto-approve',
      'git push --force-with-lease origin feature/x',
      'rm -rf ./build',
      'echo TOKEN=x > .env.example',
    ]) expect(shell(tool, command), command).toBe(false);
  });

  it.each([
    ['Write', { file_path: 'C:\\repo\\.env' }],
    ['Write', { file_path: '/repo/.env.production' }],
    ['Edit', { file_path: '/repo/.env.local', old_string: 'a', new_string: 'b' }],
    ['NotebookEdit', { notebook_path: '/repo/.env' }],
  ])('blocks %s of a .env file', (tool, input) => {
    expect(fire(tool as string, input as Record<string, unknown>)).toEqual({ blocked: true, offered: true });
  });

  it('blocks MultiEdit of a .env file as well, although the role is not granted that tool (the guard names it as a matcher, which is why the Boundaries sentence lists it)', () => {
    expect(toolsOf(text())).not.toContain('MultiEdit');
    expect(fire('MultiEdit', { file_path: '/repo/.env', edits: [] })).toEqual({ blocked: true, offered: false });
    expect(fire('MultiEdit', { file_path: '/repo/.env.example', edits: [] }).blocked).toBe(false);
  });

  it.each([
    ['Write', { file_path: '/repo/.env.example' }],
    ['Write', { file_path: '/repo/docs/cost/2026-11-savings-report.md' }],
    ['Edit', { file_path: '/repo/infra/budgets.tf', old_string: 'a', new_string: 'b' }],
  ])('does not block %s of %j', (tool, input) => {
    expect(fire(tool as string, input as Record<string, unknown>).blocked).toBe(false);
  });

  it('states what the guard blocks, where it comes from in both modes, and that acceptEdits leaves the limit to the role', () => {
    const boundaries = section(text(), 'Boundaries of this host');
    expect(boundaries).toContain(`- A guard blocks forced pushes, \`vercel --prod\`, \`.env\` writes and ${COMMON_FORMS}; it is a seat belt, not a boundary. As a subagent it comes from this file. As a teammate it comes from the settings-level session guard, which exists only if it was switched on at install (it is optional); when you cannot tell, rely on no guard and keep its rules as your own obligation.`);
    expect(boundaries).toContain('`permissionMode: acceptEdits` approves your file edits without asking');
    expect(boundaries).not.toContain('It blocks nothing else');
    expect(text().split('A guard blocks')).toHaveLength(2);
    expect(boundaries).toContain('keeping to cost reports, infrastructure-as-code recommendations, alert and budget definitions and ADRs, and changing application source only when your brief asks, is your own obligation.');
    expect(boundaries).toContain('`.env` files (not `.env.example`) in `Write`, `Edit`, `MultiEdit` and `NotebookEdit`');
    // `.env` tokens stripped, so the match runs to the end of the line instead of stopping at their dot.
    const claims = boundaries.replace(/`\.env(\.example)?`/g, 'ENV');
    expect(claims).not.toMatch(/blocks[^\n]*(ec2|savingsplans|reserved|terraform|billing)/i);
  });

  it('holds no GitHub tool, so the push, merge and create duty is not stated', () => {
    expect(toolsOf(text()).some(tool => tool.startsWith('mcp__github'))).toBe(false);
    expect(text()).toContain('This role holds no GitHub tool.');
    expect(text()).not.toContain('the guard does not see its calls');
  });

  it('step 3 says a billing query needs credentials and network access and runs only when the brief authorises it', () => {
    const three = step(3);
    expect(three).toContain('only reads, but it needs credentials and network access: run it only when your brief authorises it.');
    for (const command of ['`aws ce get-cost-and-usage`', '`az consumption usage list`', '`bq query`']) expect(three, command).toContain(command);
    expect(three).toContain('put the exact command under `Open items`');
    expect(three).toContain('Say which figures you read from billing data and which are your estimates.');
  });

  it('step 4 keeps single-node stateful workloads out of rightsizing and spot proposals and states the unit terms and the saving fields', () => {
    const four = step(4);
    for (const part of ['unit economics terms', 'monthly and annual saving', 'implementation effort', 'risk level', 'single-node stateful workloads such as a primary database']) expect(four, part).toContain(part);
  });

  it('step 5 names the 20 percent daily-delta alert, keeps credentials out of files and says which validators need an account', () => {
    const five = step(5);
    expect(five).toContain('an automated threshold alert on a daily billing delta above 20 percent');
    expect(five).toContain('`terraform fmt`, `terraform validate`');
    expect(five).toContain('one that reads a real account (`terraform plan`) needs credentials and network access and follows step 3');
    expect(five).toContain('never inline a value');
  });

  it('step 6 hands every spend or capacity change back to the lead for explicit user approval', () => {
    const six = step(6);
    for (const action of ['buy Reserved Instances or Savings Plans', 'resize or stop instances', 'move workloads to spot capacity', 'change lifecycle or retention rules', 'delete resources']) expect(six, action).toContain(action);
    expect(six).toContain('Hand the exact command back to the lead for explicit user approval.');
  });

  it('keeps the spend-changing handback and the destructive-command rule in the Safety floor', () => {
    expect(text()).toContain('- Never run a command that changes spend or capacity (buying Reserved Instances or Savings Plans, resizing, moving workloads to spot capacity, deleting resources) yourself; hand the exact command to the orchestrator for explicit user approval.');
    expect(text()).toContain('- Run read-only billing and usage queries against a real cloud account only when your brief authorises them; they need credentials and network access.');
    expect(text()).toContain('- Do not run destructive shell commands such as recursive deletes, privilege escalation, shutdown or deleting cloud resources.');
  });
});

describe('native finops-cost-engineer: the skill table', () => {
  const bundles = (JSON.parse(fs.readFileSync(path.resolve('registry/bundles.json'), 'utf8')) as { bundles?: Record<string, { agents?: string[]; skills?: string[]; parentBundle?: string }> }).bundles ?? {};
  const carrying = Object.entries(bundles).filter(([, bundle]) => (bundle.agents ?? []).includes('subagent-finops-cost-engineer.md'));
  /** What a Bundle installs: its own skills and its parent's (a child inherits the parent's skills). */
  const installs = (name: string): string[] => [...(bundles[name]?.skills ?? []), ...(bundles[bundles[name]?.parentBundle ?? '']?.skills ?? [])];
  const tableSkills = (): string[] => [...section(text(), 'How to work').matchAll(/^\|[^|\n]*\|\s*`([a-z0-9-]+)`\s*\|$/gm)].map(match => match[1]!);

  it('is carried by the system-architecture-finops bundle and the aggregate full bundle, and by no other', () => {
    expect(carrying.map(([name]) => name).sort()).toEqual(['full', 'system-architecture-finops']);
  });

  it('names only skills that every carrying bundle installs, and that exist', () => {
    expect(tableSkills().length).toBeGreaterThan(0);
    for (const skill of tableSkills()) {
      expect(fs.existsSync(path.resolve('registry/skills', skill, 'SKILL.md')), skill).toBe(true);
      for (const [name] of carrying) expect(installs(name), `${skill} in ${name}`).toContain(skill);
    }
  });

  it('the contract lists the same skills as the canonical agent, all of which exist, and the table names each of them', () => {
    const contract = JSON.parse(fs.readFileSync(path.resolve('registry/core/subagent-finops-cost-engineer.contract.json'), 'utf8')) as { skills: string[] };
    const front = /^---\n([\s\S]*?)\n---\n/.exec(canonical())![1]!;
    const declared = [...(/\nskills:\n((?:  - .*\n?)+)/.exec(`\n${front}\n`)?.[1] ?? '').matchAll(/^  - (.+)$/gm)].map(match => match[1]);
    expect(declared).toHaveLength(3);
    expect(contract.skills).toEqual(declared);
    for (const skill of contract.skills) expect(fs.existsSync(path.resolve('registry/skills', skill, 'SKILL.md')), skill).toBe(true);
    expect([...tableSkills()].sort()).toEqual([...declared].sort());
  });

  it('the Bundle carries system-architect, whose native agent is reused unchanged, and is a child of system-architecture', () => {
    expect(bundles['system-architecture-finops']!.agents).toEqual(['subagent-finops-cost-engineer.md', 'subagent-system-architect.md']);
    expect(bundles['system-architecture-finops']!.parentBundle).toBe('system-architecture');
  });
});

describe('native finops-cost-engineer: the peers section of the engineering family', () => {
  it("is devops-engineer's section line for line", () => {
    expect(section(text(), 'Working with peers').split('\n')).toEqual(section(nativeText('devops-engineer'), 'Working with peers').split('\n'));
  });

  it('is the Tier 1 form: a lead-spawned subagent first, no agency, no shutdown frame', () => {
    expect(text()).toContain('You run as a subagent that a lead spawns (Tier 1, the usual case) or as a teammate of a coordinated team. Follow the mode your brief names.');
    expect(text()).not.toMatch(/digital agency/i);
    expect(text()).not.toContain('shutdown_request');
  });

  it('step 7 hands the report back as the final answer and conditionally through SubagentHandback', () => {
    expect(step(7)).toBe('7. **Hand back.** Return the report from the Output Contract as your final message: your final answer is the hand-back. Deliver it through `SubagentHandback` only where the host supplies that tool (to a subagent, and only in auto mode); where it does not, your ordinary final response is the hand-back.');
  });

  it('carries the session task tracking section of backend-architect verbatim', () => {
    const tail = (body: string): string => body.slice(body.indexOf('\n## Session task tracking\n'));
    expect(tail(text())).toBe(tail(nativeText('backend-architect')));
  });
});

describe('native finops-cost-engineer: the MCP servers and posture of its canonical agent', () => {
  it('holds context7 only, as its canonical agent lists, and says when to use it', () => {
    expect(toolsOf(text())).toContain('mcp__context7');
    expect(text()).toContain('- Library and framework questions: confirm them with `mcp__context7` before relying on memory.');
    expect([...canonical().matchAll(/^  - name: (\S+)$/gm)].map(match => match[1])).toEqual(['context7']);
  });

  it('permission mode and effort equal the canonical values; the model is the native specialist pin', () => {
    const value = (source: string, key: string): string | undefined => new RegExp(`^${key}: (.+)$`, 'm').exec(source)?.[1];
    expect(value(canonical(), 'permissionMode')).toBe('acceptEdits');
    expect(value(text(), 'permissionMode')).toBe('acceptEdits');
    expect(value(canonical(), 'effort')).toBe('medium');
    expect([value(text(), 'model'), value(text(), 'effort')]).toEqual(['sonnet', 'medium']);
  });
});

describe('native finops-cost-engineer: the shared scope_boundaries and safety', () => {
  const normalize = (value: string): string => value.replace(/\s+/g, ' ').trim();

  it('carries every numbered Primary Directive of the canonical agent, word for word, with no forbidden host token to reword', async () => {
    const directives = [...(/\n## Primary Directives\n([\s\S]*?)(?=\n---\n|\n## )/.exec(canonical())?.[1] ?? '').matchAll(/^(\d+)\. (.+)$/gm)].map(match => normalize(`${match[1]}. ${match[2]}`));
    expect(directives).toHaveLength(4);
    for (const directive of directives) expect(scanCoreForHostTokens(directive), directive).toEqual([]);
    const scope = normalize((await loadSemanticCore('registry')).get('subagent-finops-cost-engineer')!.scope_boundaries);
    for (const directive of directives) expect(scope, directive).toContain(directive);
  });

  it('keeps the core competencies and the report format of the canonical agent', async () => {
    const core = (await loadSemanticCore('registry')).get('subagent-finops-cost-engineer')!;
    for (const part of ['AWS Cost Explorer', 'Cost and Usage Report', 'BigQuery', 'Azure Cost Management', 'Karpenter consolidation', 'Graviton', 'Compute Savings Plans', 'Convertible Reserved Instances', 'committed use discounts (CUD)', 'graceful termination handlers', 'S3 Intelligent-Tiering', 'VPC endpoints', 'Modal and RunPod']) {
      expect(core.scope_boundaries, part).toContain(part);
    }
    for (const part of ['monthly spend and opportunity overview', 'cost reduction opportunity breakdown table', 'implementation effort', 'risk level', 'implementation action plan']) expect(core.output_contract, part).toContain(part);
  });

  it('pins the added safety lines as additions to the canonical text: the spend-changing handback is the maintainer\'s decision, and the rest follows from the shell it holds', async () => {
    const core = (await loadSemanticCore('registry')).get('subagent-finops-cost-engineer')!;
    expect(core.safety).toContain('Never run a command that changes spend or capacity');
    expect(core.safety).toContain('Run read-only billing and usage queries against a real cloud account only when your brief authorises them');
    expect(canonical()).toContain('escalate billing anomaly context or performance-vs-cost trade-offs to the calling orchestrator');
  });
});
