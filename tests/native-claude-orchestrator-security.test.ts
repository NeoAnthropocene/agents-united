import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadSemanticCore } from '../src/core/semantic-core.js';
import { attempt, type Call } from './helpers/claude-host-hooks.js';
import { allowlist } from './helpers/native-coordinator.js';
import { nativeText } from './helpers/native-roles.js';

/**
 * `orchestrator-security`, the lead of the security domain, brought into the Claude native lane after the `security-engineer`: what its authored
 * body must keep saying. It is a Tier-1 domain lead (bundle tier `domain`), so it carries no mode line and no first-message section (ADR 0053
 * applies to the organization tier only). Its guard is the destructive one: it blocks forced pushes, `vercel --prod` and `.env` writes, and nothing else,
 * so the text says exactly that and leaves the holding back to the lead. Every case below fires the real guard script, once for what the text says is
 * blocked (exit 2) and once for what it says is not blocked (exit 0).
 */

const text = (): string => nativeText('orchestrator-security');
const frontmatter = (): string => /^---\n([\s\S]*?)\n---\n/.exec(text())![1]!;
const tools = (): string[] => /^tools: (.*)$/m.exec(text())![1]!.split(/, (?![^()]*\))/);
const section = (heading: string): string => new RegExp(`\\n## ${heading}\\n([\\s\\S]*?)(?=\\n## |$)`).exec(text())![1]!;
const canonical = (): string => fs.readFileSync(path.resolve('registry/agents/orchestrator-security.md'), 'utf8').replace(/\r\n/g, '\n');
const modeOf = (source: string): string | undefined => /^permissionMode: (.+)$/m.exec(source.replace(/\r\n/g, '\n'))?.[1];

describe('native orchestrator-security: its delegation grant', () => {
  it('spawns exactly the security domain, as the bundles derive it', () => {
    const agent = tools().find(tool => tool.startsWith('Agent('));
    expect(agent).toBe(allowlist('security-operations'));
    expect(agent).toBe('Agent(appsec-penetration-tester, cloud-security-architect, compliance-grc-specialist, security-engineer)');
  });

  it('holds no workflow, web or findings tool, and says in its body why it has no saved workflow', () => {
    for (const absent of ['Workflow', 'WebFetch', 'WebSearch', 'ReportFindings']) {
      expect(tools(), absent).not.toContain(absent);
      expect(text().split('<!-- agents-united:floor:end -->')[1], absent).not.toContain(`\`${absent}\``);
    }
    expect(section('No saved workflows')).toContain('the only one they can install, `workflow-test`, repairs a red run by spawning a backend type that no security Bundle installs');
  });

  it('holds the three servers of its canonical agent, and no other', () => {
    expect(tools().filter(tool => tool.startsWith('mcp__'))).toEqual(['mcp__github', 'mcp__context7', 'mcp__firecrawl']);
    expect([...canonical().matchAll(/^  - name: (\S+)$/gm)].map(match => match[1]).sort()).toEqual(['context7', 'firecrawl', 'github']);
  });
});

describe('native orchestrator-security: the code-reviewer deviation', () => {
  it('routes logic-flaw, race-condition and memory-safety review to the security engineer, and says it is a deviation from the canonical agent', () => {
    const body = text();
    expect(body).toContain('**Deviation from the canonical agent on this host.** The canonical orchestrator-security agent sends the review for logic flaws, race conditions and memory safety to `subagent-code-reviewer`. No security Bundle installs a code reviewer, and your allowlist does not include one, so here you send that review to `security-engineer`, with a brief that names those three classes, and you say so in the delegation map.');
  });

  it('is a real deviation: the canonical agent names the code reviewer, and the allowlist has none', () => {
    expect(canonical()).toContain('Delegate code review for logic flaws, race conditions, and memory safety to **`subagent-code-reviewer`**.');
    expect(tools().find(tool => tool.startsWith('Agent('))).not.toContain('code-reviewer');
  });

  it('keeps the duty in the shared core, stated without naming the type', async () => {
    const scope = (await loadSemanticCore('registry')).get('orchestrator-security')!.scope_boundaries;
    expect(scope).toContain('Delegate code review for logic flaws, race conditions and memory safety to a code-review specialist.');
    expect(scope).not.toContain('code-reviewer');
  });
});

describe('native orchestrator-security: the guard claims', () => {
  const guardParagraph = (): string => /^4\. \*\*Hold back what no guard stops\.\*\*.*$/m.exec(section('Verify before delivering'))![0];

  it('names exactly what the bound guard blocks, and what it does not', () => {
    const paragraph = guardParagraph();
    expect(paragraph).toContain('blocks only `git push --force` and `-f` (not `--force-with-lease`), `vercel --prod`, and writes to `.env` files (not `.env.example`)');
    expect(paragraph).toContain('and it blocks a tool call whose input it cannot read');
    for (const other of ['rm -rf', 'sudo', 'shutdown', '`DROP`']) expect(paragraph, other).toContain(other);
    expect(paragraph).toMatch(/does not enforce the Safety rule against destructive shell commands/);
    expect(paragraph).toMatch(/nothing bound to you or to your specialists stops network traffic to an external or production target/);
    expect(paragraph).toMatch(/permissionMode: acceptEdits/);
    expect(paragraph).toMatch(/Holding these back, and briefing every specialist to hold them back, is your own obligation/);
  });

  it('does not claim a guard it does not bind, and briefs the specialists on it', () => {
    const body = text();
    expect(body).not.toMatch(/blocks[^.\n]*(rm -rf|DROP|sudo|shutdown)/);
    expect(body).not.toMatch(/guard (extension|extended)|ADR 0074|ADR 0073|specs sheet/i);
    expect(body).toContain('- A guard blocks forced pushes, `vercel --prod` and `.env` writes, and nothing else. As the main agent it comes from this file; a specialist carries its own copy.');
    expect(section('Delegate')).toContain('**Brief every specialist on what no guard stops**');
  });

  describe('against the real guard script', () => {
    const project = fs.mkdtempSync(path.join(os.tmpdir(), 'agents-united-security-lead-guard-'));
    beforeAll(() => {
      fs.mkdirSync(path.join(project, '.claude/hooks'), { recursive: true });
      for (const file of fs.readdirSync(path.resolve('registry/hosts/claude/hooks'))) fs.copyFileSync(path.resolve('registry/hosts/claude/hooks', file), path.join(project, '.claude/hooks', file));
    });
    afterAll(() => fs.rmSync(project, { recursive: true, force: true }));
    const fire = (call: Call): { blocked: boolean; statuses: Array<number | null> } => {
      const result = attempt(text(), project, call, { agentType: 'orchestrator-security' });
      return { blocked: result.blocked, statuses: result.statuses };
    };
    const bash = (command: string): Call => ({ tool: 'Bash', input: { command } });

    it.each(['vercel --prod', 'git push --force origin main', 'git push -f origin main'])('Bash `%s` exits 2, as the text says', command => {
      const result = fire(bash(command));
      expect(result.blocked).toBe(true);
      expect(result.statuses).toContain(2);
    });

    it.each(['.env', 'config/.env.production'])('a Write to %s exits 2, as the text says', file_path => {
      const result = fire({ tool: 'Write', input: { file_path, content: 'X=1' } });
      expect(result.blocked).toBe(true);
      expect(result.statuses).toContain(2);
    });

    it.each([
      'git push --force-with-lease origin main',
      'rm -rf build',
      'sudo ls',
      'shutdown now',
      'psql -c "DROP TABLE users"',
      'curl -s https://example.com/login',
      'curl -X POST https://api.example.org/v1/users -d "x=1"',
    ])('Bash `%s` exits 0: the text says the guard does not stop it', command => {
      const result = fire(bash(command));
      expect(result.blocked).toBe(false);
      expect(result.statuses.length).toBeGreaterThan(0);
      expect(result.statuses.every(status => status === 0)).toBe(true);
    });

    it('a Write to .env.example exits 0, as the text says', () => {
      const result = fire({ tool: 'Write', input: { file_path: '.env.example', content: 'X=' } });
      expect(result.blocked).toBe(false);
      expect(result.statuses.every(status => status === 0)).toBe(true);
    });
  });
});

describe('native orchestrator-security: the canonical boundaries', () => {
  const boundaries = [
    '- **Zero Secret Exposure**: NEVER output unmasked secret values, tokens, or private keys in terminal output, logs, or reports.',
    '- **Zero Breaking Fixes**: Verify that security patches do not break functional application contracts.',
    '- **Fail-Closed Security**: Enforce fail-closed error handling for all security authentication and authorization checks.',
    '- **Sanitized Parameterization**: Forbid string concatenation in database queries or shell command strings.',
  ];

  it.each(boundaries)('the canonical agent and the native Safety floor both state, word for word: %s', line => {
    expect(canonical()).toContain(line);
    expect(text()).toContain(line);
  });

  it('keeps the defensive, authorised-work-only boundary and the host-agent-router sentence in the Safety floor', () => {
    const safety = /\n## Safety\n([\s\S]*?)<!-- agents-united:floor:end -->/.exec(text())![1]!;
    expect(safety).toContain('- **Defensive and authorised work only.** Assess only code and systems the user has asked you to assess, and run no exploit or proof of concept against an external or production target.');
    expect(safety).toContain('Only when the user explicitly asks to run work on another host CLI, use host-agent-router if installed.');
  });
});

describe('native orchestrator-security: posture, mode and first message', () => {
  it('is opus at medium effort, with the permission mode of the canonical agent', () => {
    const meta = frontmatter();
    expect(/^model: (.+)$/m.exec(meta)![1]).toBe('opus');
    expect(/^effort: (.+)$/m.exec(meta)![1]).toBe('medium');
    expect(modeOf(canonical())).toBe('acceptEdits');
    expect(modeOf(text())).toBe('acceptEdits');
  });

  it('is a domain-tier lead: no mode line, no first-message section, no mode-line gate, no introduction', () => {
    const body = text();
    expect(body).not.toMatch(/first message|mode line|Operation Mode|agents-united-mode-line-gate/i);
    expect(body).not.toMatch(/introduce yourself|name your team|welcome/i);
    expect(frontmatter()).not.toContain('mode-line-gate');
    expect(frontmatter()).toContain('agents-united-guard.js');
  });

  it('declares the five skills of the canonical agent in its contract, and the body names the ones that fit', () => {
    const contract = JSON.parse(fs.readFileSync(path.resolve('registry/core/orchestrator-security.contract.json'), 'utf8')) as { skills: string[] };
    const listed = [...(/^skills:\n((?:  - .+\n)+)/m.exec(canonical())![1]!).matchAll(/^  - (.+)$/gm)].map(match => match[1]);
    expect(contract.skills).toEqual(listed);
    expect(listed).toHaveLength(5);
    for (const skill of ['grill-with-docs', 'grill-me', 'threat-modeling', 'security-audit', 'handoff', 'git-guardrails', 'domain-modeling']) expect(text(), skill).toContain(`/${skill}`);
  });

  it('carries every numbered duty and phase of the canonical agent in scope_boundaries, and is tool-free', async () => {
    const core = (await loadSemanticCore('registry')).get('orchestrator-security')!;
    for (const phase of ['Phase 1: Automated Vulnerability & Secrets Reconnaissance', 'Phase 2: Static Security Analysis (SAST) & Boundary Inspection', 'Phase 3: Subagent Delegation & Threat Modeling', 'Phase 4: Remediation, Patching & Verification Gate']) expect(core.scope_boundaries, phase).toContain(`**${phase}**`);
    for (const duty of ['`npm audit`', 'path traversal', '`SECURITY.md`', 'agents add domain:security', '`sysops-sre`', '`qa-automation`']) expect(core.scope_boundaries, duty).toContain(duty);
    const whole = JSON.stringify(core);
    for (const tool of ['ask_question', 'run_command', 'grep_search', 'view_file', 'invoke_subagent', 'SendMessage', 'AskUserQuestion']) expect(whole, tool).not.toContain(tool);
  });
});
