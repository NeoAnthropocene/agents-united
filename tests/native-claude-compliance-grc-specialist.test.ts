import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadSemanticCore } from '../src/core/semantic-core.js';
import { attempt, type Call } from './helpers/claude-host-hooks.js';
import { nativeText } from './helpers/native-roles.js';

/**
 * `compliance-grc-specialist`, the security copy of the GRC core, brought into the Claude native lane after `appsec-penetration-tester`. The core
 * is persona-free (the digital agency's copy `agency-compliance-grc-specialist` carries Defne in its own body, ADR 0039 decision 4), so this file
 * names no persona, no company, no agency lead and no media planning. The guard bound to the role stops a recursive delete of a root, home or
 * project folder, privilege escalation, shutdown and reboot, cloud resource-group, project or account deletion and disk formatting where a command
 * starts, `git push --force` and `-f` (not `--force-with-lease`), `vercel --prod`, `.env` files (not `.env.example`) written with an editing tool or a `>` or `>>` redirect to a `.env` path the guard recognises in the command text, and a tool call whose input it cannot read. Nothing bound stops SQL `DROP` statements, a
 * recursive delete of an ordinary subfolder or traffic to an external host, so the text says exactly that and leaves the holding back to the role.
 * Every case below fires the real guard script, once for what the text says is blocked (exit 2) and once for what it says is not (exit 0).
 */

const ROLE = 'compliance-grc-specialist';
const text = (): string => nativeText(ROLE);
/** A numbered step of the "How to work" section, not the first line of the file that happens to start with the number. */
const step = (n: number): string => {
  const work = /\n## How to work\n([\s\S]*?)(?=\n## )/.exec(text())![1]!;
  return new RegExp(`^${n}\\. .*$`, 'm').exec(work)![0];
};
const peersSection = (body: string): string => /\n## Working with peers\n([\s\S]*?)(?=\n## )/.exec(body)![1]!.trim();
const floorOf = (body: string): string => /<!-- agents-united:floor:start[^>]*-->([\s\S]*?)<!-- agents-united:floor:end -->/.exec(body)![1]!;
const canonical = (): string => fs.readFileSync(path.resolve('registry/agents/subagent-compliance-grc-specialist.md'), 'utf8').replace(/\r\n/g, '\n');
const toolsOf = (name: string): string[] => /^tools: (.*)$/m.exec(nativeText(name))![1]!.split(', ');

const SAFETY = [
  'Never mark a control satisfied without evidence you have read or run: a file, a configuration or a passing check.',
  'Never copy raw personal data or health data you meet during an audit into a report or a policy: redact it.',
  'Never present the report as legal advice: it is a readiness assessment, and items needing counsel are named as such.',
];

describe('native compliance-grc-specialist: the guard claims', () => {
  it('step 9 names exactly what the bound guard blocks, and what it does not', () => {
    const nine = step(9);
    expect(nine).toContain('is a seat belt, not a boundary');
    expect(nine).toContain('It blocks `git push --force` and `-f` (not `--force-with-lease`), `vercel --prod`, `.env` files (not `.env.example`) written with an editing tool or a `>` or `>>` redirect to a `.env` path the guard recognises in the command text, and a tool call whose input it cannot read.');
    expect(nine).toContain('a recursive delete of a root, home or project folder (`rm -rf /`, `rm -rf ~`, but not `rm -rf build` of an ordinary subfolder), `sudo` and other privilege escalation, shutdown and reboot, deletion of a cloud resource group, project or account, and disk formatting');
    expect(nine).toContain('It does not stop SQL `DROP` statements, a recursive delete of an ordinary subfolder, network traffic to an external target (a `curl` or a scanner against a host), or anything hidden in variables, aliases, interpreters, encoded commands or scripts.');
    expect(nine).toMatch(/permissionMode: acceptEdits/);
    expect(nine).toMatch(/your own obligation/);
    expect(nine).toContain('every check that sends traffic to a system you were not asked to audit, every deletion check that runs against real personal data instead of a fixture');
  });

  it('keeps the Safety lines of the floor in force and says so in the body', () => {
    for (const line of SAFETY) expect(floorOf(text()), line).toContain(`- ${line}`);
    expect(step(9)).toContain('The Safety lines of the floor stay in force: no control is marked satisfied without evidence you have read or run, raw personal and health data is redacted, and the report is a readiness assessment, not legal advice.');
  });

  it('names its three callers, as the canonical agent does', async () => {
    const callers = '`orchestrator-digital-agency`), `orchestrator-security` or `orchestrator-business`';
    const identity = (await loadSemanticCore('registry')).get('subagent-compliance-grc-specialist')!.identity;
    expect(canonical()).toContain('`orchestrator-digital-agency` (Campaign Director Chris), `orchestrator-security`, or `orchestrator-business`');
    expect(identity).toContain(callers);
    expect(floorOf(text())).toContain(callers);
  });

  it('does not claim a guard it does not bind', () => {
    const body = text();
    expect(body).not.toMatch(/blocks[^.\n]*\bDROP\b/);
    expect(body).not.toMatch(/blocks[^.\n]*\b(nmap|sqlmap|ffuf|curl)\b/);
    expect(body).not.toMatch(/guard (extension|extended)|ADR 0074|ADR 0073|specs sheet/i);
    expect(body).toContain("- A guard blocks `git push --force` and `-f` (not `--force-with-lease`), `vercel --prod`, `.env` files (not `.env.example`) written with an editing tool or a `>` or `>>` redirect to a `.env` path the guard recognises in the command text, and the common forms of destructive shell commands (a recursive delete of a root, home or project folder, privilege escalation, shutdown, disk formatting, cloud resource-group, project or account deletion); it is a seat belt, not a boundary. It also blocks a tool call whose input it cannot read. As a subagent it comes from this file, when the host runs this file's hooks. As a teammate it comes from the settings-level session guard, which is optional and may be off. You cannot verify from inside that a guard is active, so keep its rules as your own obligation in either case.");
  });

  describe('against the real guard script', () => {
    const project = fs.mkdtempSync(path.join(os.tmpdir(), 'agents-united-grc-guard-'));
    beforeAll(() => {
      fs.mkdirSync(path.join(project, '.claude/hooks'), { recursive: true });
      for (const file of fs.readdirSync(path.resolve('registry/hosts/claude/hooks'))) fs.copyFileSync(path.resolve('registry/hosts/claude/hooks', file), path.join(project, '.claude/hooks', file));
    });
    afterAll(() => fs.rmSync(project, { recursive: true, force: true }));
    const fire = (call: Call): { blocked: boolean; statuses: Array<number | null> } => {
      const result = attempt(text(), project, call, { agentType: ROLE });
      return { blocked: result.blocked, statuses: result.statuses };
    };
    const bash = (command: string): Call => ({ tool: 'Bash', input: { command } });

    it.each([
      'vercel --prod', 'git push --force origin main', 'git push -f origin main',
      'rm -rf /', 'rm -rf ~', 'sudo ls', 'shutdown now',
      'az group delete -n rg', 'gcloud projects delete p', 'aws organizations close-account --account-id 123456789012',
    ])('Bash `%s` exits 2, as step 9 says', command => {
      const result = fire(bash(command));
      expect(result.blocked).toBe(true);
      expect(result.statuses).toContain(2);
    });

    it.each(['.env', 'config/.env.production'])('a Write to %s exits 2, as step 9 says', file_path => {
      const result = fire({ tool: 'Write', input: { file_path, content: 'X=1' } });
      expect(result.blocked).toBe(true);
      expect(result.statuses).toContain(2);
    });

    it.each([
      'git push --force-with-lease origin main',
      'rm -rf build',
      'echo rm -rf /',
      'psql -c "DROP TABLE users"',
      'curl -X POST https://api.example.org/consent -d "x"',
      'nmap -sV example.com',
      'npx vitest run tests/compliance/',
      'npm audit --json',
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

    it('a Write to .env.example exits 0, as step 9 says', () => {
      const result = fire({ tool: 'Write', input: { file_path: '.env.example', content: 'X=' } });
      expect(result.blocked).toBe(false);
      expect(result.statuses).toEqual([0]);
    });

    it('a Write of a policy under docs/compliance/ exits 0: the role writes its policies there', () => {
      const result = fire({ tool: 'Write', input: { file_path: 'docs/compliance/privacy-policy.md', content: '# Policy' } });
      expect(result.blocked).toBe(false);
      expect(result.statuses).toEqual([0]);
    });
  });
});

describe('native compliance-grc-specialist: persona-free and bound to the security lead', () => {
  it('names no persona, no company, no agency lead and no media or 3D section', () => {
    const body = text();
    expect(body).not.toMatch(/Defne|AstrolabsAI|defne-grc|\bChris\b|Jamileh|Jale\b|Yavuz|Deniz/);
    expect(body).not.toMatch(/Media planning consultation|Conditional 3D handoff|Media Request|digital agency/i);
    expect(body).not.toContain('agency-');
  });

  it('shares the floor of the agency copy: one core, two native files', () => {
    const agency = nativeText('agency-compliance-grc-specialist');
    expect(floorOf(text())).toBe(floorOf(agency));
    expect(agency).toContain('In the digital agency you are Defne (`defne-grc`)');
  });

  it('is named compliance-grc-specialist, the plain type the security lead lists, and carries the Tier 1 relay default', () => {
    expect(/^name: (.+)$/m.exec(text())![1]).toBe(ROLE);
    expect(nativeText('orchestrator-security')).toMatch(/Agent\([^)]*\bcompliance-grc-specialist\b[^)]*\)/);
    expect(text()).toContain('- **Relay mode is the default.** You cannot reach a peer by name.');
    expect(text()).toContain('Questions for the user go to the lead as `ask-user` entries under `Requests for the lead`, and the lead returns the answers to you; you never ask the user directly.');
  });

  it('answers a planning consultation with a bounded statement and writes no deliverable', () => {
    expect(step(8)).toContain('When the lead consults you before the plan is accepted, answer with a bounded scope-of-work statement (your scope, the inputs you depend on, your deliverable, at most two open questions) and write no deliverable file.');
  });
});

describe('native compliance-grc-specialist: the peers section of the security family', () => {
  it("is frontend-architect's section line for line, except the one sentence naming the Tier 2 case", () => {
    const family = peersSection(nativeText('frontend-architect'));
    const tier2 = ' or as a teammate of a live Agent Team (Tier 2, the digital agency)';
    expect(family).toContain(tier2);
    expect(peersSection(text()).split('\n')).toEqual(family.replace(tier2, ' or as a teammate of a coordinated team').split('\n'));
  });

  it("is security-engineer's, cloud-security-architect's and appsec-penetration-tester's section line for line", () => {
    for (const sibling of ['security-engineer', 'cloud-security-architect', 'appsec-penetration-tester']) {
      expect(peersSection(text()).split('\n'), sibling).toEqual(peersSection(nativeText(sibling)).split('\n'));
    }
  });

  it('is the Tier 1 form: a lead-spawned subagent first, no agency, no shutdown frame, no teammate-reality paragraph', () => {
    const body = text();
    expect(body).toContain('You run as a subagent that a lead spawns (Tier 1, the usual case) or as a teammate of a coordinated team. Follow the mode your brief names.');
    expect(body).not.toContain('shutdown_request');
    expect(body).not.toContain('a brief cannot make you a teammate');
    expect(body).not.toContain('Do not message a peer');
  });

  it('step 10 hands the report back through SubagentHandback in the plain form', () => {
    expect(step(10)).toBe('10. **Hand back.** Return the report from the Output Contract as your final message: your final answer is the hand-back. Deliver it through `SubagentHandback` only where the host supplies that tool; where it does not, your ordinary final response is the hand-back.');
  });

  it('holds the two messaging tools its capability gives, and the core declares the capability', async () => {
    expect(toolsOf(ROLE)).toEqual(expect.arrayContaining(['ListAgents', 'SendMessage']));
    expect((await loadSemanticCore('registry')).get('subagent-compliance-grc-specialist')!.capabilities).toContain('messaging');
  });
});

describe('native compliance-grc-specialist: tools and servers', () => {
  it("has the agency copy's tools line: the same classes, the same servers, web included", () => {
    expect(toolsOf(ROLE)).toEqual(toolsOf('agency-compliance-grc-specialist'));
    expect(toolsOf(ROLE)).toEqual(expect.arrayContaining(['WebFetch', 'WebSearch']));
  });

  it('holds no scheduling, monitor or delegation tool', () => {
    for (const forbidden of ['CronCreate', 'CronDelete', 'CronList', 'RemoteTrigger', 'Monitor', 'TaskStop', 'Agent', 'Workflow']) expect(toolsOf(ROLE), forbidden).not.toContain(forbidden);
    expect(text()).toContain('- Running workflows, scheduling and spawning subagents are not available to you. Request them from the lead as `run-workflow`, `schedule` or `delegate` entries under `Requests for the lead`.');
  });

  it('declares the same servers as the canonical registry agent, and no other', () => {
    expect([...canonical().matchAll(/^  - name: (\S+)$/gm)].map(match => match[1]).sort()).toEqual(['context7', 'github', 'markitdown']);
    const tools = toolsOf(ROLE);
    expect(tools).toEqual(expect.arrayContaining(['mcp__markitdown', 'mcp__context7', 'mcp__github__search_code', 'mcp__github__get_file_contents']));
    expect(tools.filter(tool => tool.startsWith('mcp__github'))).not.toContain('mcp__github');
  });

  it('reads GitHub and does not write to it, and says when to use each server', () => {
    const body = text();
    expect(body).toContain('you read GitHub and do not write to it');
    expect(body).toContain('A client\'s policy documents are read with `mcp__markitdown`, and library and framework questions are confirmed with `mcp__context7` before you rely on memory.');
    expect(body).toContain('`WebFetch` and `WebSearch` read regulations, standards and regulator guidance');
  });
});

describe('native compliance-grc-specialist: permission mode and posture', () => {
  it('permission mode equals the value of the canonical registry agent', () => {
    const mode = (source: string): string | undefined => /^permissionMode: (.+)$/m.exec(source.replace(/\r\n/g, '\n'))?.[1];
    expect(mode(canonical())).toBe('acceptEdits');
    expect(mode(text())).toBe('acceptEdits');
  });

  it('carries the Tier-1 specialist posture of the native ceiling: sonnet at medium effort', () => {
    expect(/^model: (.+)$/m.exec(text())![1]).toBe('sonnet');
    expect(/^effort: (.+)$/m.exec(canonical())![1]).toBe('medium');
    expect(/^effort: (.+)$/m.exec(text())![1]).toBe('medium');
  });
});

describe('native compliance-grc-specialist: the skills and the shared pair', () => {
  const WHEN: Record<string, string> = {
    'security-audit': 'A security or privacy control audit: you evaluate controls against a framework',
    'domain-modeling': 'The vocabulary of the data or the policy terms is unsettled',
    'technical-documentation': 'You author a policy or a runbook',
  };

  it('lists the three skills of the canonical agent in its contract, and the skill table gives each one its row with when to load it', () => {
    const contract = JSON.parse(fs.readFileSync(path.resolve('registry/core/subagent-compliance-grc-specialist.contract.json'), 'utf8')) as { definition: string; skills: string[] };
    const frontmatter = /^skills:\n((?:  - .+\n)+)/m.exec(canonical())![1]!;
    const listed = [...frontmatter.matchAll(/^  - (.+)$/gm)].map(match => match[1]);
    expect(contract.definition).toBe('subagent-compliance-grc-specialist');
    expect(contract.skills).toEqual(listed);
    expect(listed).toHaveLength(3);
    expect(Object.keys(WHEN).sort()).toEqual([...listed].sort());
    for (const skill of listed) expect(text(), skill).toContain(`| ${WHEN[skill!]} | \`${skill}\` |`);
  });

  it('says a skill that is not installed is a gap to report', () => {
    expect(text()).toContain('A skill that is not installed is a gap to report in your handoff, not something to improvise from memory.');
  });

  it('keeps the canonical duties in the shared core: the five directives, the output sections and the evidence rule', async () => {
    const core = (await loadSemanticCore('registry')).get('subagent-compliance-grc-specialist')!;
    for (const title of ['Automated Evidence Collection', 'Data Minimization & Privacy by Design', 'Structured Policy Artifacts', 'Actionable Remediation Roadmaps', 'Campaign & Marketing Funnel Compliance']) {
      expect(core.scope_boundaries, title).toContain(`**${title}.**`);
      expect(canonical(), title).toContain(`**${title}.**`);
    }
    for (const section of ['Framework Readiness Summary', 'Control Evaluation Matrix', 'Gap Register', 'Required Action Items', 'Policy Artifacts and Validation Tests']) expect(floorOf(text()), section).toContain(section);
  });

  it('is tool-free: the shared pair names no host tool', async () => {
    const core = (await loadSemanticCore('registry')).get('subagent-compliance-grc-specialist')!;
    const whole = JSON.stringify(core);
    for (const tool of ['grep_search', 'view_file', 'list_dir', 'find_by_name', 'manage_task', 'replace_file_content', 'write_to_file', 'run_command', 'SubagentHandback', 'SendMessage']) expect(whole, tool).not.toContain(tool);
  });
});

describe('native compliance-grc-specialist: the shared core keeps every duty of the canonical agent', () => {
  const rawCore = (): string => fs.readFileSync(path.resolve('registry/core/subagent-compliance-grc-specialist.core.md'), 'utf8').replace(/\r\n/g, '\n');
  const directives = (source: string): string[] => [...source.matchAll(/^\s*[1-5]\. (\*\*(?:Automated Evidence Collection|Data Minimization & Privacy by Design|Structured Policy Artifacts|Actionable Remediation Roadmaps|Campaign & Marketing Funnel Compliance)\.\*\*.*)$/gm)].map(match => match[1]!);

  it('carries the five canonical directives in full and in order', async () => {
    const fromCanonical = directives(canonical());
    expect(fromCanonical).toHaveLength(5);
    const scope = (await loadSemanticCore('registry')).get('subagent-compliance-grc-specialist')!.scope_boundaries;
    expect(directives(scope)).toEqual(fromCanonical);
  });

  it('names no persona and no company anywhere in the raw core', () => {
    expect(rawCore()).not.toMatch(/Defne|defne-grc|AstrolabsAI/);
  });

  it('keeps the consumer protection, framework, protocol and erasure duties of the canonical agent', async () => {
    const core = (await loadSemanticCore('registry')).get('subagent-compliance-grc-specialist')!;
    const duties = core.mission + '\n' + core.scope_boundaries;
    for (const duty of [
      'clear and conspicuous', 'substantiated product-efficacy claims', 'consent tracking records',
      'Security, Availability, Confidentiality, Processing Integrity and Privacy', 'Annex A controls, asset registers, access control matrices and cryptographic policies', 'audit logging and Business Associate Agreement (BAA) mapping',
      '(`docs/`, `.github/`, `prisma/`, `src/`)', '(`email`, `ssn`, `dob`, `phone`, `ip_address`)', 'the logging middleware and the privacy policies',
      'immutable audit logs for authentication events, unencrypted backup snapshots, or missing data deletion cascades',
      '`SECURITY.md`, `INCIDENT_RESPONSE.md`, `DATA_RETENTION.md`', 'removes the personal data across every database table, using fixtures and never real personal data',
      'validates the subject identifier first', 'In one transaction it anonymizes the personal fields of financial records the law requires to be retained',
      'cascades the deletion through the session, activity, profile and account records', 'only the minimum necessary subject reference, a timestamp and the outcome',
    ]) expect(duties, duty).toContain(duty);
    expect(JSON.stringify(core)).not.toMatch(/\bschedule\b/i);
  });

  it('keeps the media and 3D duties in the agency copy only', () => {
    expect(text()).not.toMatch(/Media Request|Motion Designer|Sound Designer|\b3D\b|asset ledger/i);
    const agency = nativeText('agency-compliance-grc-specialist');
    expect(agency).toContain('## Media planning consultation');
    expect(agency).toContain('## Conditional 3D handoff');
  });

  it('gives the agency paragraph its role and its peers', () => {
    const paragraph = /^In the digital agency you are Defne .*$/m.exec(nativeText('agency-compliance-grc-specialist'))![0];
    expect(paragraph).toContain('the compliance specialist of the AstrolabsAI team');
    expect(paragraph).toContain('from Chris, the Campaign Director');
    for (const peer of ['Jamileh', 'Jale', 'Yavuz']) expect(paragraph, peer).toContain(peer);
    expect(paragraph).toContain('back to him');
  });
});
