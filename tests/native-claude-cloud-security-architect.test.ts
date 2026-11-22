import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadSemanticCore } from '../src/core/semantic-core.js';
import { attempt, type Call } from './helpers/claude-host-hooks.js';
import { nativeText } from './helpers/native-roles.js';

/**
 * `cloud-security-architect`, brought into the Claude native lane after `security-engineer`: what its authored body must keep saying. The
 * role is for defensive, authorised assessment only. The canonical agent's own guard (deny `rm -rf|DROP|shutdown|sudo`) is NOT part of the
 * guard this role binds. The bound guard stops `az group delete`, `gcloud projects delete` and an AWS account closure where a command
 * starts, and nothing bound stops `terraform apply` or `destroy`, `kubectl apply` or `delete`, `az deployment`, an `aws iam` policy change
 * or network traffic to an external target, so the text says exactly that and leaves the holding back to the role. Every case below fires
 * the real guard script, once for what the text says is blocked (exit 2) and once for what it says is not blocked (exit 0).
 */

const text = (): string => nativeText('cloud-security-architect');
/** A numbered step of the "How to work" section, not the first line of the file that happens to start with the number. */
const step = (n: number): string => {
  const work = /\n## How to work\n([\s\S]*?)(?=\n## )/.exec(text())![1]!;
  return new RegExp(`^${n}\\. .*$`, 'm').exec(work)![0];
};
const peersSection = (body: string): string => /\n## Working with peers\n([\s\S]*?)(?=\n## )/.exec(body)![1]!.trim();
const canonical = (): string => fs.readFileSync(path.resolve('registry/agents/subagent-cloud-security-architect.md'), 'utf8').replace(/\r\n/g, '\n');

describe('native cloud-security-architect: the guard claims', () => {
  it('step 5 names exactly what the bound guard blocks, and what it does not', () => {
    const five = step(5);
    expect(five).toContain('is a seat belt, not a boundary');
    expect(five).toContain('It blocks `git push --force` and `-f` (not `--force-with-lease`), `vercel --prod`, writes to `.env` files (not `.env.example`) and a tool call whose input it cannot read.');
    expect(five).toContain('deletion of a cloud resource group, project or account (`az group delete`, `gcloud projects delete`, an AWS account closure)');
    expect(five).toContain('a recursive delete of a root, home or project folder (`rm -rf /`, `rm -rf ~`, but not `rm -rf build` of an ordinary subfolder), `sudo` and other privilege escalation, shutdown and reboot');
    expect(five).toContain('It does not stop `terraform apply` or `terraform destroy`, `kubectl apply` or `kubectl delete`, SQL `DROP` statements, an `az deployment` create, `aws iam` policy changes or any other change to a live cloud account, network traffic to an external target, or anything hidden in variables, aliases, interpreters, encoded commands or scripts.');
    expect(five).toMatch(/permissionMode: acceptEdits/);
    expect(five).toMatch(/hand the exact command to the lead for explicit user approval/);
    expect(five).toMatch(/your own obligation/);
  });

  it('names its two callers, as the canonical agent does', async () => {
    const mission = (await loadSemanticCore('registry')).get('subagent-cloud-security-architect')!.mission;
    expect(canonical()).toContain('`orchestrator-security` or `orchestrator-system-architecture`');
    expect(mission).toContain('`orchestrator-security` or `orchestrator-system-architecture`');
  });

  it('does not claim a guard it does not bind', () => {
    const body = text();
    expect(body).not.toMatch(/blocks[^.\n]*\bDROP\b/);
    expect(body).not.toMatch(/blocks[^.\n]*\b(terraform|kubectl)\b/);
    expect(body).not.toMatch(/guard (extension|extended)|ADR 0074|ADR 0073|specs sheet/i);
    expect(body).toContain("- A guard blocks forced pushes, `vercel --prod`, `.env` writes and the common forms of destructive shell commands (a recursive delete of a root, home or project folder, privilege escalation, shutdown, disk formatting, cloud resource-group, project or account deletion); it is a seat belt, not a boundary. It also blocks a tool call whose input it cannot read. As a subagent it comes from this file. As a teammate it comes from the settings-level session guard, which exists only if it was switched on at install (it is optional); when you cannot tell, rely on no guard and keep its rules as your own obligation.");
  });

  describe('against the real guard script', () => {
    const project = fs.mkdtempSync(path.join(os.tmpdir(), 'agents-united-cloud-guard-'));
    beforeAll(() => {
      fs.mkdirSync(path.join(project, '.claude/hooks'), { recursive: true });
      for (const file of fs.readdirSync(path.resolve('registry/hosts/claude/hooks'))) fs.copyFileSync(path.resolve('registry/hosts/claude/hooks', file), path.join(project, '.claude/hooks', file));
    });
    afterAll(() => fs.rmSync(project, { recursive: true, force: true }));
    const fire = (call: Call): { blocked: boolean; statuses: Array<number | null> } => {
      const result = attempt(text(), project, call, { agentType: 'cloud-security-architect' });
      return { blocked: result.blocked, statuses: result.statuses };
    };
    const bash = (command: string): Call => ({ tool: 'Bash', input: { command } });

    it.each([
      'vercel --prod', 'git push --force origin main', 'git push -f origin main',
      'rm -rf /', 'rm -rf ~', 'sudo ls', 'shutdown now',
      'az group delete -n rg', 'gcloud projects delete p', 'aws organizations close-account --account-id 123456789012',
    ])('Bash `%s` exits 2, as step 5 says', command => {
      const result = fire(bash(command));
      expect(result.blocked).toBe(true);
      expect(result.statuses).toContain(2);
    });

    it.each(['.env', 'config/.env.production'])('a Write to %s exits 2, as step 5 says', file_path => {
      const result = fire({ tool: 'Write', input: { file_path, content: 'X=1' } });
      expect(result.blocked).toBe(true);
      expect(result.statuses).toContain(2);
    });

    it.each([
      'git push --force-with-lease origin main',
      'rm -rf build',
      'echo rm -rf /',
      'terraform apply -auto-approve',
      'terraform destroy -auto-approve',
      'kubectl apply -f deploy.yaml',
      'kubectl delete ns prod',
      'az deployment group create -g rg --template-file main.bicep',
      'aws iam put-role-policy --role-name deployer --policy-name p --policy-document file://policy.json',
      'psql -c "DROP TABLE users"',
      'curl -s https://example.com/login',
      'curl -X POST https://api.example.org/v1/users -d "x=1"',
    ])('Bash `%s` exits 0: the text says the guard does not stop it', command => {
      const result = fire(bash(command));
      expect(result.blocked).toBe(false);
      expect(result.statuses.length).toBeGreaterThan(0);
      expect(result.statuses.every(status => status === 0)).toBe(true);
    });

    it.each([['empty stdin', ''], ['non-JSON stdin', 'not json {']])('the guard exits 2 on %s: a tool call whose input it cannot read', (_name, stdin) => {
      const result = spawnSync(process.execPath, [path.join(project, '.claude/hooks/agents-united-guard.js')], { input: stdin, encoding: 'utf8', cwd: project });
      expect(result.status).toBe(2);
    });

    it('a Write to .env.example exits 0, as step 5 says', () => {
      const result = fire({ tool: 'Write', input: { file_path: '.env.example', content: 'X=' } });
      expect(result.blocked).toBe(false);
      expect(result.statuses.every(status => status === 0)).toBe(true);
    });
  });

  it('keeps the canonical directive and edge-case rules in the Safety floor, word for word, and the canonical states each', () => {
    const body = text();
    const source = canonical();
    for (const line of [
      'Never hard-code or permit static cloud credentials.',
      'Wildcard permissions (`*` on `*`) are strictly prohibited.',
      'Never create a KMS key policy without delegating key administration permissions to the root account or dedicated Break-Glass IAM role (`kms:*` with `Principal: "arn:aws:iam::ACCOUNT_ID:root"`).',
    ]) {
      expect(source, line).toContain(line);
      expect(body, `- ${line}`).toContain(`- ${line}`);
    }
    expect(body).toContain('- Assess only the cloud accounts, code and systems the user has asked you to assess.');
    expect(body).toContain('- Never apply, destroy or change a live cloud resource or account yourself; hand the exact command to the orchestrator for explicit user approval.');
    expect(body).toContain('- Do not run destructive shell commands such as recursive deletes, privilege escalation, shutdown, SQL DROP statements or resource group deletion.');
  });
});

describe('native cloud-security-architect: the peers section of the engineering family', () => {
  it("is frontend-architect's section line for line, except the one sentence naming the Tier 2 case", () => {
    const family = peersSection(nativeText('frontend-architect'));
    const tier2 = ' or as a teammate of a live Agent Team (Tier 2, the digital agency)';
    expect(family).toContain(tier2);
    expect(peersSection(text()).split('\n')).toEqual(family.replace(tier2, ' or as a teammate of a coordinated team').split('\n'));
  });

  it("is security-engineer's section line for line", () => {
    expect(peersSection(text()).split('\n')).toEqual(peersSection(nativeText('security-engineer')).split('\n'));
  });

  it('is the Tier 1 form: a lead-spawned subagent first, no agency, no shutdown frame, no teammate-reality paragraph', () => {
    const body = text();
    expect(body).toContain('You run as a subagent that a lead spawns (Tier 1, the usual case) or as a teammate of a coordinated team. Follow the mode your brief names.');
    expect(body).not.toMatch(/digital agency/i);
    expect(body).not.toContain('shutdown_request');
    expect(body).not.toContain('a brief cannot make you a teammate');
    expect(body).not.toContain('Do not message a peer');
  });

  it('step 6 hands the report back as the final answer and conditionally through SubagentHandback', () => {
    expect(step(6)).toBe('6. **Hand back.** Return the report from the Output Contract as your final message: your final answer is the hand-back. Deliver it through `SubagentHandback` only where the host supplies that tool (to a subagent, and only in auto mode); where it does not, your ordinary final response is the hand-back.');
  });

  it('holds the two messaging tools its capability gives, and the core declares the capability', async () => {
    const tools = /^tools: (.*)$/m.exec(text())![1]!.split(', ');
    expect(tools).toEqual(expect.arrayContaining(['ListAgents', 'SendMessage']));
    expect((await loadSemanticCore('registry')).get('subagent-cloud-security-architect')!.capabilities).toContain('messaging');
  });
});

describe('native cloud-security-architect: the dropped schedule tool', () => {
  it('the canonical agent declares schedule, and the native role holds no scheduling tool and keeps no timer section', () => {
    expect(canonical()).toMatch(/^  - schedule$/m);
    expect(canonical()).toContain('Reactive Wakeup Timers');
    const tools = /^tools: (.*)$/m.exec(text())![1]!.split(', ');
    for (const forbidden of ['CronCreate', 'CronDelete', 'CronList', 'RemoteTrigger']) expect(tools, forbidden).not.toContain(forbidden);
    expect(text()).not.toContain('Reactive Wakeup Timers');
    expect(text()).toContain('- Running workflows, scheduling and spawning subagents are not available to you. Request them from the lead as `run-workflow`, `schedule` or `delegate` entries under `Requests for the lead`.');
    expect(text()).toContain('`Monitor` streams their output instead of polling.');
  });
});

describe('native cloud-security-architect: the MCP servers of its canonical agent', () => {
  it('holds github and context7 in its tools line and says when to use them', () => {
    const tools = /^tools: (.*)$/m.exec(text())![1]!.split(', ');
    expect(tools).toEqual(expect.arrayContaining(['mcp__github', 'mcp__context7']));
    expect(text()).toContain('- Library and framework questions: confirm them with `mcp__context7` before relying on memory. Pull-request and repository reads go through `mcp__github`; do not push, merge or force anything without being asked.');
  });

  it('declares the same servers as the canonical registry agent, and no other', () => {
    expect([...canonical().matchAll(/^  - name: (\S+)$/gm)].map(match => match[1]).sort()).toEqual(['context7', 'github']);
  });
});

describe('native cloud-security-architect: permission mode and posture', () => {
  it('permission mode equals the value of the canonical registry agent', () => {
    const mode = (source: string): string | undefined => /^permissionMode: (.+)$/m.exec(source.replace(/\r\n/g, '\n'))?.[1];
    expect(mode(canonical())).toBe('acceptEdits');
    expect(mode(text())).toBe('acceptEdits');
  });

  it('carries the Tier-1 specialist posture of the native ceiling although the canonical agent declares effort high', () => {
    expect(/^model: (.+)$/m.exec(text())![1]).toBe('sonnet');
    expect(/^effort: (.+)$/m.exec(canonical())![1]).toBe('high');
    expect(/^effort: (.+)$/m.exec(text())![1]).toBe('medium');
  });
});

describe('native cloud-security-architect: the shared pair', () => {
  it('lists the five skills of the canonical agent in its contract, and the body names each one', () => {
    const contract = JSON.parse(fs.readFileSync(path.resolve('registry/core/subagent-cloud-security-architect.contract.json'), 'utf8')) as { skills: string[] };
    const frontmatter = /^skills:\n((?:  - .+\n)+)/m.exec(canonical())![1]!;
    const listed = [...frontmatter.matchAll(/^  - (.+)$/gm)].map(match => match[1]);
    expect(contract.skills).toEqual(listed);
    expect(listed).toHaveLength(5);
    for (const skill of listed) expect(text(), skill).toContain(`\`${skill}\``);
  });

  it('carries the five canonical directives, the four phases and the edge cases in scope_boundaries, each with its title', async () => {
    const scope = (await loadSemanticCore('registry')).get('subagent-cloud-security-architect')!.scope_boundaries;
    const titles = [
      'Zero Long-Lived Access Keys', 'Default-Deny IAM Architecture', 'Automated IaC Security Gate', 'Data-at-Rest & In-Transit Encryption', 'Structured Audit Reporting',
      'Phase 1, Cloud Infrastructure & Policy Audit', 'Phase 2, Threat Modeling & IaC Security Scan', 'Phase 3, Hardening & Policy Remediation', 'Phase 4, Verification & Compliance Check', 'Edge Cases & Error Recovery',
    ];
    titles.forEach((title, index) => expect(scope, title).toContain(index < 5 ? `${index + 1}. **${title}.**` : `${index + 1}. **${title}**`));
    const source = canonical();
    for (const sentence of [
      'Mandate ephemeral OIDC / Workload Identity Federation for all CI/CD pipelines (GitHub Actions, GitLab CI) and services. Never hard-code or permit static cloud credentials.',
      'All IAM policies must be tightly scoped to explicit resources and actions with specific condition keys (`aws:PrincipalTag`, `aws:SecureTransport`, `gcp:condition`). Wildcard permissions (`*` on `*`) are strictly prohibited.',
      'Scan every Terraform module or Bicep template with Checkov/Trivy before deployment, failing on high or critical severity findings.',
      'All storage buckets (S3, GCS, Azure Blob), relational databases, and disk volumes must enforce customer-managed KMS encryption and TLS 1.3 in-transit.',
      'Output all findings and recommendations in a standardized markdown report formatted for orchestrator ingestion.',
      'AWS IAM managed policies have a 6,144-character limit. If policies exceed this, decompose permissions into focused functional roles rather than bundling permissions.',
      'Never create a KMS key policy without delegating key administration permissions to the root account or dedicated Break-Glass IAM role',
      'verify that S3 bucket policies do not inadvertently block cross-account authorized principals when using `aws:PrincipalArn` conditions.',
    ]) {
      expect(source, sentence).toContain(sentence);
      expect(scope, sentence).toContain(sentence);
    }
    for (const duty of ['sts:AssumeRoleWithWebIdentity', 'npx checkov -d ./infra --framework terraform bicep arm --compact', 'CIS Cloud Benchmarks', 'envelope encryption', 'plain-text secrets', 'KMS Key Lockout Prevention', 'Public Access S3 False Positives', 'never poll in a busy loop', 'automatic KMS key rotation', 'automatic secret rotation (Secrets Manager, HashiCorp Vault integration)', 'secure VPC peering with private endpoints, security groups, network ACLs and egress filtering', 'Checkov, tfsec, Trivy and Kics', 'AWS Security Hub, GCP Security Command Center and Microsoft Defender for Cloud', 'Pod Security Standards at the Restricted level', 'Cilium or Calico eBPF network policies that default to deny', 'distroless images and Cosign container signing', 'check its health endpoint on demand', 'AWS IAM policy evaluation, GCP Workload Identity Federation and Azure Managed Identities', 'inspect their status and logs or send input without blocking the session']) expect(scope, duty).toContain(duty);
  });

  it('is tool-free: the shared pair names no host tool', async () => {
    const core = (await loadSemanticCore('registry')).get('subagent-cloud-security-architect')!;
    const whole = JSON.stringify(core);
    for (const tool of ['grep_search', 'view_file', 'list_dir', 'find_by_name', 'manage_task', 'replace_file_content', 'write_to_file', 'run_command', 'SubagentHandback', 'SendMessage']) expect(whole, tool).not.toContain(tool);
  });
});
