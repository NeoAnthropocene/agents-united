import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadSemanticCore } from '../src/core/semantic-core.js';
import { attempt, type Call } from './helpers/claude-host-hooks.js';
import { nativeText } from './helpers/native-roles.js';

/**
 * `appsec-penetration-tester`, brought into the Claude native lane after `cloud-security-architect`: what its authored body must keep saying.
 * The role is for defensive, authorised assessment only. The canonical agent's own guard (deny `rm -rf|DROP|shutdown|sudo`) is NOT part of the
 * guard this role binds. The bound guard stops a recursive delete of a root, home or project folder, privilege escalation, shutdown and
 * reboot, cloud resource-group, project or account deletion and disk formatting where a command starts, and nothing bound stops SQL `DROP`
 * statements, a recursive delete of an ordinary subfolder or scanner, fuzzer and exploit traffic against a host (`curl`, `nmap`, `sqlmap`,
 * `ffuf`), so the text says exactly that and leaves the holding back to the role. Every case below fires the real guard script, once for what
 * the text says is blocked (exit 2) and once for what it says is not blocked (exit 0).
 */

const text = (): string => nativeText('appsec-penetration-tester');
/** A numbered step of the "How to work" section, not the first line of the file that happens to start with the number. */
const step = (n: number): string => {
  const work = /\n## How to work\n([\s\S]*?)(?=\n## )/.exec(text())![1]!;
  return new RegExp(`^${n}\\. .*$`, 'm').exec(work)![0];
};
const peersSection = (body: string): string => /\n## Working with peers\n([\s\S]*?)(?=\n## )/.exec(body)![1]!.trim();
const canonical = (): string => fs.readFileSync(path.resolve('registry/agents/subagent-appsec-penetration-tester.md'), 'utf8').replace(/\r\n/g, '\n');

const DIRECTIVE_1 = 'Never execute payloads that mutate production data, perform denial-of-service, or corrupt state. All penetration testing assertions must execute against local mock fixtures or unit test boundaries.';

describe('native appsec-penetration-tester: the guard claims', () => {
  it('step 5 names exactly what the bound guard blocks, and what it does not', () => {
    const five = step(5);
    expect(five).toContain('is a seat belt, not a boundary');
    expect(five).toContain('It blocks `git push --force` and `-f` (not `--force-with-lease`), `vercel --prod`, `.env` files (not `.env.example`) written with an editing tool or a `>` or `>>` redirect to an unquoted path without backslashes, and a tool call whose input it cannot read.');
    expect(five).toContain('a recursive delete of a root, home or project folder (`rm -rf /`, `rm -rf ~`, but not `rm -rf build` of an ordinary subfolder), `sudo` and other privilege escalation, shutdown and reboot, deletion of a cloud resource group, project or account, and disk formatting');
    expect(five).toContain('It does not stop SQL `DROP` statements, a recursive delete of an ordinary subfolder, network traffic to an external or production target (scanners, fuzzers and exploit payloads such as `curl`, `nmap`, `sqlmap` or `ffuf` against a host), or anything hidden in variables, aliases, interpreters, encoded commands or scripts.');
    expect(five).toMatch(/permissionMode: acceptEdits/);
    expect(five).toMatch(/your own obligation/);
    expect(five).toContain('every proof of concept that reaches anything but a local mock fixture or a unit test boundary');
  });

  it('names its two callers, as the canonical agent does', async () => {
    const mission = (await loadSemanticCore('registry')).get('subagent-appsec-penetration-tester')!.mission;
    expect(canonical()).toContain('`orchestrator-security` or `orchestrator-engineering`');
    expect(mission).toContain('`orchestrator-security` or `orchestrator-engineering`');
  });

  it('does not claim a guard it does not bind', () => {
    const body = text();
    expect(body).not.toMatch(/blocks[^.\n]*\bDROP\b/);
    expect(body).not.toMatch(/blocks[^.\n]*\b(nmap|sqlmap|ffuf|curl)\b/);
    expect(body).not.toMatch(/guard (extension|extended)|ADR 0074|ADR 0073|specs sheet/i);
    expect(body).toContain("- A guard blocks `git push --force` and `-f` (not `--force-with-lease`), `vercel --prod`, `.env` files (not `.env.example`) written with an editing tool or a `>` or `>>` redirect to an unquoted path without backslashes, and the common forms of destructive shell commands (a recursive delete of a root, home or project folder, privilege escalation, shutdown, disk formatting, cloud resource-group, project or account deletion); it is a seat belt, not a boundary. It also blocks a tool call whose input it cannot read. As a subagent it comes from this file, when the host runs this file's hooks. As a teammate it comes from the settings-level session guard, which is optional and may be off. You cannot verify from inside that a guard is active, so keep its rules as your own obligation in either case.");
  });

  describe('against the real guard script', () => {
    const project = fs.mkdtempSync(path.join(os.tmpdir(), 'agents-united-appsec-guard-'));
    beforeAll(() => {
      fs.mkdirSync(path.join(project, '.claude/hooks'), { recursive: true });
      for (const file of fs.readdirSync(path.resolve('registry/hosts/claude/hooks'))) fs.copyFileSync(path.resolve('registry/hosts/claude/hooks', file), path.join(project, '.claude/hooks', file));
    });
    afterAll(() => fs.rmSync(project, { recursive: true, force: true }));
    const fire = (call: Call): { blocked: boolean; statuses: Array<number | null> } => {
      const result = attempt(text(), project, call, { agentType: 'appsec-penetration-tester' });
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
      'psql -c "DROP TABLE users"',
      'curl -X POST https://api.example.org/login -d "x"',
      'nmap -sV example.com',
      'sqlmap -u https://example.com/?id=1',
      'ffuf -u https://example.com/FUZZ -w words.txt',
      'npx semgrep --config=p/owasp-top-ten src/',
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

    it('a Write to .env.example exits 0, as step 5 says', () => {
      const result = fire({ tool: 'Write', input: { file_path: '.env.example', content: 'X=' } });
      expect(result.blocked).toBe(false);
      expect(result.statuses.every(status => status === 0)).toBe(true);
    });
  });

  it('keeps the canonical directives in the Safety floor, word for word, and the canonical states each', () => {
    const body = text();
    const source = canonical();
    expect(source).toContain(DIRECTIVE_1);
    expect(body).toContain(`- ${DIRECTIVE_1}`);
    expect(source).toContain('Every vulnerability identified MUST be accompanied by a failing unit/integration test (reproducing the flaw) followed by a code patch that passes the test (strict TDD).');
    expect(body).toContain('- Every vulnerability identified MUST be accompanied by a failing unit/integration test (reproducing the flaw) followed by a code patch that passes the test (strict TDD).');
    expect(body).toContain('- Assess only code and systems the user has asked you to review; run proofs of concept only within local mock fixtures or unit test boundaries.');
    expect(body).toContain('- Do not run destructive shell commands such as recursive deletes, privilege escalation, shutdown or SQL DROP statements.');
  });

  it('keeps proofs of concept within local mock fixtures or unit test boundaries, never an external or production target', () => {
    const body = text();
    expect(step(4)).toContain('A proof of concept runs only within local mock fixtures or unit test boundaries; never execute a payload that mutates production data, performs denial of service or corrupts state.');
    expect(body).not.toMatch(/against (an? )?(external|production) (host|target|system)s? (is|are) (fine|allowed)/i);
  });
});

describe('native appsec-penetration-tester: the peers section of the engineering family', () => {
  it("is frontend-architect's section line for line, except the one sentence naming the Tier 2 case", () => {
    const family = peersSection(nativeText('frontend-architect'));
    const tier2 = ' or as a teammate of a live Agent Team (Tier 2, the digital agency)';
    expect(family).toContain(tier2);
    expect(peersSection(text()).split('\n')).toEqual(family.replace(tier2, ' or as a teammate of a coordinated team').split('\n'));
  });

  it("is security-engineer's and cloud-security-architect's section line for line", () => {
    expect(peersSection(text()).split('\n')).toEqual(peersSection(nativeText('security-engineer')).split('\n'));
    expect(peersSection(text()).split('\n')).toEqual(peersSection(nativeText('cloud-security-architect')).split('\n'));
  });

  it('is the Tier 1 form: a lead-spawned subagent first, no agency, no shutdown frame, no teammate-reality paragraph', () => {
    const body = text();
    expect(body).toContain('You run as a subagent that a lead spawns (Tier 1, the usual case) or as a teammate of a coordinated team. Follow the mode your brief names.');
    expect(body).not.toMatch(/digital agency/i);
    expect(body).not.toContain('shutdown_request');
    expect(body).not.toContain('a brief cannot make you a teammate');
    expect(body).not.toContain('Do not message a peer');
  });

  it('step 6 hands the report back through SubagentHandback in the plain form', () => {
    expect(step(6)).toBe('6. **Hand back.** Return the report from the Output Contract as your final message: your final answer is the hand-back. Deliver it through `SubagentHandback` only where the host supplies that tool; where it does not, your ordinary final response is the hand-back.');
  });

  it('holds the two messaging tools its capability gives, and the core declares the capability', async () => {
    const tools = /^tools: (.*)$/m.exec(text())![1]!.split(', ');
    expect(tools).toEqual(expect.arrayContaining(['ListAgents', 'SendMessage']));
    expect((await loadSemanticCore('registry')).get('subagent-appsec-penetration-tester')!.capabilities).toContain('messaging');
  });

  it("has the sibling's tools line, so the same tools and no scheduling tool", () => {
    const tools = (name: string): string => /^tools: (.*)$/m.exec(nativeText(name))![1]!;
    expect(tools('appsec-penetration-tester')).toBe(tools('cloud-security-architect'));
  });
});

describe('native appsec-penetration-tester: the dropped schedule tool', () => {
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

describe('native appsec-penetration-tester: the MCP servers of its canonical agent', () => {
  it('holds github and context7 in its tools line and says when to use them', () => {
    const tools = /^tools: (.*)$/m.exec(text())![1]!.split(', ');
    expect(tools).toEqual(expect.arrayContaining(['mcp__github', 'mcp__context7']));
    expect(text()).toContain('- Library and framework questions: confirm them with `mcp__context7` before relying on memory. Pull-request and repository reads go through `mcp__github`; push or merge only on the user\'s explicit word, and never force a push.');
  });

  it('declares the same servers as the canonical registry agent, and no other', () => {
    expect([...canonical().matchAll(/^  - name: (\S+)$/gm)].map(match => match[1]).sort()).toEqual(['context7', 'github']);
  });
});

describe('native appsec-penetration-tester: permission mode and posture', () => {
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

describe('native appsec-penetration-tester: the skills and the shared pair', () => {
  const WHEN: Record<string, string> = {
    'security-audit': 'Every engagement: the OWASP and API Top 10 checklist and the SAST sinks',
    'systematic-debugging': 'A proof of concept does not behave as expected',
    'git-guardrails': 'Every remediation commit',
    'threat-modeling': 'Engagement kickoff, or when the task asks for a threat model',
    'sarif-triage': 'Semgrep, CodeQL or other SARIF output is in hand',
    'variant-analysis': 'Right after a finding is confirmed, to find its siblings',
  };

  it('lists the six skills of the canonical agent in its contract, and the skill table gives each one its row with when to load it', () => {
    const contract = JSON.parse(fs.readFileSync(path.resolve('registry/core/subagent-appsec-penetration-tester.contract.json'), 'utf8')) as { skills: string[] };
    const frontmatter = /^skills:\n((?:  - .+\n)+)/m.exec(canonical())![1]!;
    const listed = [...frontmatter.matchAll(/^  - (.+)$/gm)].map(match => match[1]);
    expect(contract.skills).toEqual(listed);
    expect(listed).toHaveLength(6);
    expect(Object.keys(WHEN).sort()).toEqual([...listed].sort());
    for (const skill of listed) expect(text(), skill).toContain(`| ${WHEN[skill!]} | \`${skill}\` |`);
  });

  it('says a skill that is not installed is a gap to report', () => {
    expect(text()).toContain('A skill that is not installed is a gap to report in your handoff, not something to improvise from memory.');
  });

  it('carries the four canonical directives, the five phases and the exemplar rules in scope_boundaries, each with its title', async () => {
    const scope = (await loadSemanticCore('registry')).get('subagent-appsec-penetration-tester')!.scope_boundaries;
    const titles = [
      'Non-Destructive Proof-of-Concept Only', 'Deterministic Remediation with Tests', 'No Blind Dependency Bumping', 'Defense in Depth',
    ];
    titles.forEach((title, index) => expect(scope, title).toContain(`${index + 1}. **${title}.**`));
    expect(scope).toContain(DIRECTIVE_1);
    expect(canonical()).toContain(DIRECTIVE_1);
    for (const duty of ['npm audit --json', 'npx semgrep --config=p/owasp-top-ten --config=p/javascript --json src/', 'tests/security/', 'crypto.timingSafeEqual', 'never poll in a busy loop']) expect(scope, duty).toContain(duty);
  });

  it('is tool-free: the shared pair names no host tool', async () => {
    const core = (await loadSemanticCore('registry')).get('subagent-appsec-penetration-tester')!;
    const whole = JSON.stringify(core);
    for (const tool of ['grep_search', 'view_file', 'list_dir', 'find_by_name', 'manage_task', 'replace_file_content', 'write_to_file', 'run_command', 'SubagentHandback', 'SendMessage']) expect(whole, tool).not.toContain(tool);
  });
});
