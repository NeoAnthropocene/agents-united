import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadSemanticCore } from '../src/core/semantic-core.js';
import { attempt, type Call } from './helpers/claude-host-hooks.js';
import { nativeText } from './helpers/native-roles.js';

/**
 * `security-engineer`, brought into the Claude native lane after `devops-engineer`: what its authored body must keep saying. The role is
 * for defensive, authorised assessment only. The canonical agent's own guard (deny `rm -rf|DROP|shutdown|sudo`) is NOT part of the guard
 * this role binds, and nothing bound stops network traffic to an external target, so the text says exactly that and leaves the holding
 * back to the role. Every case below fires the real guard script, once for what the text says is blocked (exit 2) and once for what it
 * says is not blocked (exit 0).
 */

const text = (): string => nativeText('security-engineer');
/** A numbered step of the "How to work" section, not the first line of the file that happens to start with the number. */
const step = (n: number): string => {
  const work = /\n## How to work\n([\s\S]*?)(?=\n## )/.exec(text())![1]!;
  return new RegExp(`^${n}\\. .*$`, 'm').exec(work)![0];
};
const peersSection = (body: string): string => /\n## Working with peers\n([\s\S]*?)(?=\n## )/.exec(body)![1]!.trim();
const canonical = (): string => fs.readFileSync(path.resolve('registry/agents/subagent-security-engineer.md'), 'utf8').replace(/\r\n/g, '\n');

describe('native security-engineer: the guard claims', () => {
  it('step 5 names exactly what the bound guard blocks, and what it does not', () => {
    const five = step(5);
    expect(five).toContain('is a seat belt, not a boundary');
    expect(five).toContain('It blocks `git push --force` and `-f` (not `--force-with-lease`), `vercel --prod`, writes to `.env` files (not `.env.example`) and a tool call whose input it cannot read.');
    expect(five).toContain('a recursive delete of a root, home or project folder (`rm -rf /`, `rm -rf ~`, but not `rm -rf build` of an ordinary subfolder), `sudo` and other privilege escalation, shutdown and reboot, deletion of a cloud resource group, project or account, and disk formatting');
    expect(five).toContain('It does not stop SQL `DROP` statements, a recursive delete of an ordinary subfolder, network traffic to an external or production target, or anything hidden in variables, aliases, interpreters, encoded commands or scripts.');
    expect(five).toMatch(/permissionMode: acceptEdits/);
    expect(five).toMatch(/your own obligation/);
  });

  it('does not claim a guard it does not bind', () => {
    const body = text();
    expect(body).not.toMatch(/blocks[^.\n]*\bDROP\b/);
    expect(body).not.toMatch(/guard (extension|extended)|ADR 0074|ADR 0073|specs sheet/i);
    expect(body).toContain("- A guard blocks forced pushes, `vercel --prod`, `.env` writes and the common forms of destructive shell commands (a recursive delete of a root, home or project folder, privilege escalation, shutdown, disk formatting, cloud resource-group, project or account deletion); it is a seat belt, not a boundary. It also blocks a tool call whose input it cannot read. As a subagent it comes from this file; as a teammate it comes from the project's settings.");
  });

  describe('against the real guard script', () => {
    const project = fs.mkdtempSync(path.join(os.tmpdir(), 'agents-united-security-guard-'));
    beforeAll(() => {
      fs.mkdirSync(path.join(project, '.claude/hooks'), { recursive: true });
      for (const file of fs.readdirSync(path.resolve('registry/hosts/claude/hooks'))) fs.copyFileSync(path.resolve('registry/hosts/claude/hooks', file), path.join(project, '.claude/hooks', file));
    });
    afterAll(() => fs.rmSync(project, { recursive: true, force: true }));
    const fire = (call: Call): { blocked: boolean; statuses: Array<number | null> } => {
      const result = attempt(text(), project, call, { agentType: 'security-engineer' });
      return { blocked: result.blocked, statuses: result.statuses };
    };
    const bash = (command: string): Call => ({ tool: 'Bash', input: { command } });

    it.each([
      'vercel --prod', 'git push --force origin main', 'git push -f origin main',
      'rm -rf /', 'rm -rf ~', 'sudo ls', 'shutdown now', 'az group delete -n x',
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

  it('keeps the destructive-command and exploit rules in the Safety floor, word for word', () => {
    const body = text();
    expect(body).toContain('- Never execute destructive exploit payloads against external or production targets.');
    expect(body).toContain('- Do not output live API keys or production secrets in log files or reports; obscure with `****`.');
    expect(body).toContain('- Refuse to disable TLS verification (`rejectUnauthorized: false`) in generated code.');
    expect(body).toContain('- Assess only code and systems the user has asked you to review; run a proof of concept only against local or test targets.');
    expect(body).toContain('- Do not run destructive shell commands such as recursive deletes, privilege escalation, shutdown or SQL DROP statements.');
  });

  it('the canonical agent states the three guardrails that the floor keeps word for word', () => {
    const source = canonical();
    for (const line of [
      '- Never execute destructive exploit payloads against external or production targets.',
      '- Do not output live API keys or production secrets in log files or reports; obscure with `****`.',
      '- Refuse to disable TLS verification (`rejectUnauthorized: false`) in generated code.',
    ]) {
      expect(source, line).toContain(line);
      expect(text(), line).toContain(line);
    }
  });
});

describe('native security-engineer: the peers section of the engineering family', () => {
  it("is frontend-architect's section line for line, except the one sentence naming the Tier 2 case", () => {
    const family = peersSection(nativeText('frontend-architect'));
    const tier2 = ' or as a teammate of a live Agent Team (Tier 2, the digital agency)';
    expect(family).toContain(tier2);
    expect(peersSection(text()).split('\n')).toEqual(family.replace(tier2, ' or as a teammate of a coordinated team').split('\n'));
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
    expect(step(6)).toBe('6. **Hand back.** Return the report from the Output Contract as your final message through `SubagentHandback`.');
  });

  it('holds the two messaging tools its capability gives, and the core declares the capability', async () => {
    const tools = /^tools: (.*)$/m.exec(text())![1]!.split(', ');
    expect(tools).toEqual(expect.arrayContaining(['ListAgents', 'SendMessage']));
    expect((await loadSemanticCore('registry')).get('subagent-security-engineer')!.capabilities).toContain('messaging');
  });
});

describe('native security-engineer: the MCP servers of its canonical agent', () => {
  it('holds github and context7 in its tools line and says when to use them', () => {
    const tools = /^tools: (.*)$/m.exec(text())![1]!.split(', ');
    expect(tools).toEqual(expect.arrayContaining(['mcp__github', 'mcp__context7']));
    expect(text()).toContain('- Library and framework questions: confirm them with `mcp__context7` before relying on memory. Pull-request and repository reads go through `mcp__github`; do not push, merge or force anything without being asked.');
  });

  it('declares the same servers as the canonical registry agent, and no other', () => {
    expect([...canonical().matchAll(/^  - name: (\S+)$/gm)].map(match => match[1]).sort()).toEqual(['context7', 'github']);
  });
});

describe('native security-engineer: permission mode', () => {
  it('equals the value of the canonical registry agent', () => {
    const mode = (source: string): string | undefined => /^permissionMode: (.+)$/m.exec(source.replace(/\r\n/g, '\n'))?.[1];
    expect(mode(canonical())).toBe('acceptEdits');
    expect(mode(text())).toBe('acceptEdits');
  });

  it('carries the posture of a Tier-1 specialist with the effort the canonical agent declares', () => {
    expect(/^model: (.+)$/m.exec(text())![1]).toBe('sonnet');
    expect(/^effort: (.+)$/m.exec(canonical())![1]).toBe('medium');
    expect(/^effort: (.+)$/m.exec(text())![1]).toBe('medium');
  });
});

describe('native security-engineer: the shared pair', () => {
  it('lists the nine skills of the canonical agent in its contract, and the body names each one', () => {
    const contract = JSON.parse(fs.readFileSync(path.resolve('registry/core/subagent-security-engineer.contract.json'), 'utf8')) as { skills: string[] };
    const frontmatter = /^skills:\n((?:  - .+\n)+)/m.exec(canonical())![1]!;
    const listed = [...frontmatter.matchAll(/^  - (.+)$/gm)].map(match => match[1]);
    expect(contract.skills).toEqual(listed);
    expect(listed).toHaveLength(9);
    for (const skill of listed) expect(text(), skill).toContain(`\`${skill}\``);
  });

  it('carries the five canonical directives in scope_boundaries, each with its title', async () => {
    const scope = (await loadSemanticCore('registry')).get('subagent-security-engineer')!.scope_boundaries;
    const titles = ['OWASP Top 10 Audit', 'Secret Hygiene & Leak Prevention', 'STRIDE Threat Modeling', 'Surgical Remediation Diffs', 'Input Sanitization & Output Encoding'];
    titles.forEach((title, index) => expect(scope, title).toContain(`${index + 1}. **${title}**`));
    for (const duty of ['child_process.exec()', 'CWE ID', 'CVSS v3.1', 'Zod/Joi', 'SECURITY-AUDIT-[DATE].md', 'Content Security Policy (CSP)', 'crypto.randomBytes()', 'Access-Control-Allow-Origin: *']) expect(scope, duty).toContain(duty);
  });

  it('is tool-free: the shared pair names no host tool', async () => {
    const core = (await loadSemanticCore('registry')).get('subagent-security-engineer')!;
    const whole = JSON.stringify(core);
    for (const tool of ['grep_search', 'view_file', 'replace_file_content', 'write_to_file', 'run_command', 'SubagentHandback', 'SendMessage']) expect(whole, tool).not.toContain(tool);
  });
});
