import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadSemanticCore, scanCoreForHostTokens } from '../src/core/semantic-core.js';
import { attempt } from './helpers/claude-host-hooks.js';
import { nativeText } from './helpers/native-roles.js';

/**
 * The native `cloud-infrastructure-architect`, brought in the way `devops-engineer` (shell parts) and `sysops-sre-lead` (the family form) were.
 * Its canonical agent has the same tool set as devops-engineer, run_command included, so it holds a shell and a monitor; its canonical
 * `schedule` is not carried over (a specialist holds no scheduling tool). Every "blocked" claim of its body is fired at the real guard script.
 */

/** The shared clause every Claude role carries (ADR 0074, tests/guard-destructive-upgrade.test.ts). */
const COMMON_FORMS = 'the common forms of destructive shell commands (a recursive delete of a root, home or project folder, privilege escalation, shutdown, disk formatting, cloud resource-group, project or account deletion)';

const ROLE = 'cloud-infrastructure-architect';
const text = (): string => nativeText(ROLE);
const canonical = (): string => fs.readFileSync(path.resolve('registry/agents/subagent-cloud-infrastructure-architect.md'), 'utf8').replace(/\r\n/g, '\n');
const toolsOf = (body: string): string[] => /^tools: (.*)$/m.exec(body)![1]!.split(', ');
const section = (body: string, heading: string): string => new RegExp(`\\n## ${heading}\\n([\\s\\S]*?)(?=\\n## |$)`).exec(body)![1]!.trim();
/** A numbered step of the "How to work" section. */
const step = (n: number): string => new RegExp(`^${n}\\. .*$`, 'm').exec(section(text(), 'How to work'))![0];

describe('native cloud-infrastructure-architect: the tools its canonical agent has', () => {
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
    const capabilities = (await loadSemanticCore('registry')).get('subagent-cloud-infrastructure-architect')!.capabilities ?? [];
    expect(capabilities).toEqual(expect.arrayContaining(['read', 'search', 'edit', 'shell', 'messaging', 'handback', 'skill', 'background-monitor', 'task-tracking', 'mcp-discovery']));
    expect(capabilities).not.toContain('scheduling');
  });

  it('says that a recurring check or timer is a recommendation under Open items, not an action', () => {
    expect(section(text(), 'Boundaries of this host')).toContain('a recurring health check or a timer is a `schedule` request, not an action you take.');
  });

  it('search through Bash is stated for macOS, Linux and WSL', () => {
    expect(step(1)).toContain('On macOS, Linux and WSL this role holds `Bash`, so `Glob` and `Grep` are unavailable there and search runs through `Bash`.');
  });
});

describe('native cloud-infrastructure-architect: the guard and provisioning claims, against the real script', () => {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'agents-united-cloud-guard-'));
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
    expect(six).toContain(`blocks \`git push --force\` and \`-f\` (not \`--force-with-lease\`), \`vercel --prod\`, \`.env\` files (not \`.env.example\`) written with an editing tool or a \`>\` or \`>>\` redirect to a \`.env\` path the guard recognises in the command text, and ${COMMON_FORMS}; it is a seat belt, not a boundary.`);
    expect(six).not.toContain('blocks only');
    expect(six).not.toContain('does not enforce the Safety rule');
    // The blocking clause alone: what follows "it is a seat belt" names the commands the guard does NOT stop.
    const blocking = six.slice(six.indexOf('blocks forced'), six.indexOf('it is a seat belt'));
    expect(blocking).not.toMatch(/production deploys|terraform|kubectl|az deployment|gh workflow/);
    expect(six).toContain('Of the cloud commands it stops only `az ... group delete` forms, `gcloud projects delete` and AWS account closure or organization deletion.');
    for (const other of ['terraform apply', 'terraform destroy', 'az deployment group create', 'kubectl apply', 'kubectl delete', 'gh workflow run']) expect(six.slice(six.indexOf('It does not stop')), other).toContain(other);
    expect(six).toMatch(/your own obligation/);
  });

  it.each(['Bash', 'PowerShell'] as const)('%s: blocks a forced push, vercel --prod, a redirect into .env and the destructive forms step 6 lists, as the Boundaries say', tool => {
    for (const command of [
      'git push --force origin main', 'git push -f origin main', 'vercel --prod', 'echo KEY=1 > .env', 'echo KEY=1 > config/.env.production',
      'rm -rf /', 'sudo ls', 'shutdown now', 'az group delete --name g --yes', 'gcloud projects delete my-project',
      'aws organizations close-account --account-id 1', 'az deployment group delete --name d --resource-group g',
    ]) expect(shell(tool, command), command).toBe(true);
  });

  it.each(['Bash', 'PowerShell'] as const)('%s: does not block provisioning, other deletes or force-with-lease commands, as step 6 says', tool => {
    for (const command of [
      'terraform apply -auto-approve',
      'terraform destroy -auto-approve',
      'az deployment group create --resource-group g --template-file main.bicep',
      'kubectl apply -f x.yaml',
      'kubectl delete -f x.yaml',
      'gh workflow run x',
      'git push --force-with-lease origin feature/x',
      'rm -rf ./build',
      'echo KEY=1 > .env.example',
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

  it.each([
    ['Write', { file_path: '/repo/.env.example' }],
    ['Write', { file_path: '/repo/infra/modules/network/main.tf' }],
    ['Edit', { file_path: '/repo/infra/main.bicep', old_string: 'a', new_string: 'b' }],
  ])('does not block %s of %j', (tool, input) => {
    expect(fire(tool as string, input as Record<string, unknown>).blocked).toBe(false);
  });

  it('states what the guard blocks, where it comes from in both modes, and that acceptEdits leaves the limit to the role', () => {
    const boundaries = section(text(), 'Boundaries of this host');
    expect(boundaries).toContain(`- A guard blocks \`git push --force\` and \`-f\` (not \`--force-with-lease\`), \`vercel --prod\`, \`.env\` files (not \`.env.example\`) written with an editing tool or a \`>\` or \`>>\` redirect to a \`.env\` path the guard recognises in the command text, and ${COMMON_FORMS}; it is a seat belt, not a boundary. As a subagent it comes from this file, when the host runs this file's hooks. As a teammate it comes from the settings-level session guard, which is optional and may be off. You cannot verify from inside that a guard is active, so keep its rules as your own obligation in either case.`);
    expect(boundaries).toContain('`permissionMode: acceptEdits` approves your file edits without asking');
    expect(boundaries).toContain('keeping to infrastructure code, topology documents and ADRs, and changing application source only when your brief asks, is your own obligation.');
    expect(boundaries).not.toContain('It blocks nothing else');
    expect(boundaries).not.toContain('It does not block `git push --force-with-lease`');
    // `.env` tokens stripped, so the match runs to the end of the line instead of stopping at their dot.
    const claims = boundaries.replace(/`\.env(\.example)?`/g, 'ENV');
    expect(claims).not.toMatch(/blocks[^\n]*(production deploys|terraform|kubectl|az deployment)/);
    expect(text().split('A guard blocks')).toHaveLength(2);
  });

  it('the guard does not see GitHub MCP calls, so the push, merge and create duty is stated as the role\'s own', () => {
    for (const tool of ['mcp__github__push_files', 'mcp__github__merge_pull_request', 'mcp__github__create_pull_request']) expect(fire(tool, {}).blocked, tool).toBe(false);
    expect(text()).toContain('the guard does not see its calls, so pushing or merging only on the user\'s explicit word, never forcing a push, and creating nothing there unasked, is your own obligation.');
  });

  it('step 5 validates without a cloud account, says the validators need network access, and a plan or dry run against an account needs the brief', () => {
    const five = step(5);
    for (const command of ['terraform fmt -check', 'terraform init -backend=false', 'terraform validate', 'az bicep lint']) expect(five, command).toContain(command);
    expect(five).toContain('`terraform init` still downloads providers and modules from their registries, and `az bicep lint` may fetch the Bicep CLI on first use, so these need network access but no cloud account.');
    expect(five).toContain('run it only when your brief authorises it');
    expect(five).toContain('A validator success is not a deployment');
  });

  it('keeps the provisioning handback and the destructive-command rule in the Safety floor', () => {
    expect(text()).toContain('- Never apply, provision or change a resource in a real cloud account yourself; hand the exact command to the orchestrator for explicit user approval unless your brief authorises it.');
    expect(text()).toContain('- Do not run destructive shell commands such as recursive deletes, privilege escalation, shutdown or resource group deletion.');
  });
});

describe('native cloud-infrastructure-architect: the skill table', () => {
  const bundles = (JSON.parse(fs.readFileSync(path.resolve('registry/bundles.json'), 'utf8')) as { bundles?: Record<string, { agents?: string[]; skills?: string[]; parentBundle?: string }> }).bundles ?? {};
  const carrying = Object.entries(bundles).filter(([, bundle]) => (bundle.agents ?? []).includes('subagent-cloud-infrastructure-architect.md'));
  /** What a Bundle installs: its own skills and its parent's (a child inherits the parent's skills). */
  const installs = (name: string): string[] => [...(bundles[name]?.skills ?? []), ...(bundles[bundles[name]?.parentBundle ?? '']?.skills ?? [])];
  const tableSkills = (): string[] => [...section(text(), 'How to work').matchAll(/^\|[^|\n]*\|\s*`([a-z0-9-]+)`\s*\|$/gm)].map(match => match[1]!);

  it('is carried by the system-architecture-cloud bundle and the aggregate full bundle, and by no other', () => {
    expect(carrying.map(([name]) => name).sort()).toEqual(['full', 'system-architecture-cloud']);
  });

  it('names only skills that every carrying bundle installs, and that exist', () => {
    expect(tableSkills().length).toBeGreaterThan(0);
    for (const skill of tableSkills()) {
      expect(fs.existsSync(path.resolve('registry/skills', skill, 'SKILL.md')), skill).toBe(true);
      for (const [name] of carrying) expect(installs(name), `${skill} in ${name}`).toContain(skill);
    }
  });

  it('the contract lists the same skills as the canonical agent, all of which exist, and the table names each of them', () => {
    const contract = JSON.parse(fs.readFileSync(path.resolve('registry/core/subagent-cloud-infrastructure-architect.contract.json'), 'utf8')) as { skills: string[] };
    const front = /^---\n([\s\S]*?)\n---\n/.exec(canonical())![1]!;
    const declared = [...(/\nskills:\n((?:  - .*\n?)+)/.exec(`\n${front}\n`)?.[1] ?? '').matchAll(/^  - (.+)$/gm)].map(match => match[1]);
    expect(declared).toHaveLength(5);
    expect(contract.skills).toEqual(declared);
    for (const skill of contract.skills) expect(fs.existsSync(path.resolve('registry/skills', skill, 'SKILL.md')), skill).toBe(true);
    expect([...tableSkills()].sort()).toEqual([...declared].sort());
  });
});

describe('native cloud-infrastructure-architect: the peers section of the engineering family', () => {
  it("is devops-engineer's section line for line", () => {
    expect(section(text(), 'Working with peers').split('\n')).toEqual(section(nativeText('devops-engineer'), 'Working with peers').split('\n'));
  });

  it('is the Tier 1 form: a lead-spawned subagent first, no agency, no shutdown frame', () => {
    expect(text()).toContain('You run as a subagent that a lead spawns (Tier 1, the usual case) or as a teammate of a coordinated team. Follow the mode your brief names.');
    expect(text()).not.toMatch(/digital agency/i);
    expect(text()).not.toContain('shutdown_request');
  });

  it('step 7 hands the report back as the final answer and conditionally through SubagentHandback', () => {
    expect(step(7)).toBe('7. **Hand back.** Return the report from the Output Contract as your final message: your final answer is the hand-back. Deliver it through `SubagentHandback` only where the host supplies that tool; where it does not, your ordinary final response is the hand-back.');
  });

  it('carries the session task tracking section of backend-architect verbatim', () => {
    const tail = (body: string): string => body.slice(body.indexOf('\n## Session task tracking\n'));
    expect(tail(text())).toBe(tail(nativeText('backend-architect')));
  });
});

describe('native cloud-infrastructure-architect: the MCP servers and posture of its canonical agent', () => {
  it('holds github and context7 and says when to use them', () => {
    expect(toolsOf(text())).toEqual(expect.arrayContaining(['mcp__github', 'mcp__context7']));
    expect(text()).toContain('- Library and framework questions: confirm them with `mcp__context7` before relying on memory.');
    expect([...canonical().matchAll(/^  - name: (github|context7)$/gm)].map(match => match[1]).sort()).toEqual(['context7', 'github']);
  });

  it('permission mode equals the canonical value; model and effort are the native specialist pin, not the canonical `high`', () => {
    const value = (source: string, key: string): string | undefined => new RegExp(`^${key}: (.+)$`, 'm').exec(source)?.[1];
    expect(value(canonical(), 'permissionMode')).toBe('acceptEdits');
    expect(value(text(), 'permissionMode')).toBe('acceptEdits');
    expect(value(canonical(), 'effort')).toBe('high');
    expect([value(text(), 'model'), value(text(), 'effort')]).toEqual(['sonnet', 'medium']);
  });
});

describe('native cloud-infrastructure-architect: the shared scope_boundaries and safety', () => {
  const normalize = (value: string): string => value.replace(/\s+/g, ' ').trim();

  it('carries every numbered Primary Directive of the canonical agent, word for word, with no forbidden host token to reword', async () => {
    const directives = [...(/\n## Primary Directives\n([\s\S]*?)(?=\n---\n|\n## )/.exec(canonical())?.[1] ?? '').matchAll(/^(\d+)\. (.+)$/gm)].map(match => normalize(`${match[1]}. ${match[2]}`));
    expect(directives).toHaveLength(4);
    for (const directive of directives) expect(scanCoreForHostTokens(directive), directive).toEqual([]);
    const scope = normalize((await loadSemanticCore('registry')).get('subagent-cloud-infrastructure-architect')!.scope_boundaries);
    for (const directive of directives) expect(scope, directive).toContain(directive);
  });

  it('keeps the core competencies, the report format and the review sign-off of the canonical agent', async () => {
    const core = (await loadSemanticCore('registry')).get('subagent-cloud-infrastructure-architect')!;
    for (const part of ['AWS Transit Gateway', 'GCP Cloud Interconnect', 'Azure Virtual WAN', 'Anycast BGP', 'Cilium eBPF', 'Karpenter', 'ArgoCD or Flux', 'RTO under 15 minutes', 'Terragrunt', 'Pulumi', 'redundant NAT per AZ', 'zero public database endpoints (PrivateLink enforced)']) {
      expect(core.scope_boundaries, part).toContain(part);
    }
    for (const part of ['topology overview', 'network and compute topology matrix', 'subnet CIDR', 'interconnect mechanism', 'architecture review sign-off']) expect(core.output_contract, part).toContain(part);
  });

  it('pins the added safety lines as additions to the canonical text: the provisioning handback follows from its sign-off and the shell it holds', async () => {
    const core = (await loadSemanticCore('registry')).get('subagent-cloud-infrastructure-architect')!;
    expect(core.safety).toContain('Never apply, provision or change a resource in a real cloud account yourself');
    expect(core.safety).toContain('Never expose an internal database or microservice to the public internet in a design');
    expect(canonical()).toContain('avoid exposing internal databases or microservices to the public internet');
    expect(canonical()).toContain('Zero public database endpoints');
  });
});
