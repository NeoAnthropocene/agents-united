import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadSemanticCore } from '../src/core/semantic-core.js';
import { attempt } from './helpers/claude-host-hooks.js';
import { nativeText } from './helpers/native-roles.js';

/**
 * The factory pilot's first real member, `devops-engineer`: what its authored body must keep saying. The guard sentence is the
 * maintainer's decision on point (b) ("text now, guard later"); the peers section is the engineering family's form (frontend-architect),
 * not the digital agency's (point a, "Add messaging").
 */

const text = (): string => nativeText('devops-engineer');
/** The shared clause every Claude role carries (ADR 0074, tests/guard-destructive-upgrade.test.ts). */
const COMMON_FORMS = 'the common forms of destructive shell commands (a recursive delete of a root, home or project folder, privilege escalation, shutdown, disk formatting, cloud resource-group, project or account deletion)';
/** A numbered step of the "How to work" section, not the first line of the file that happens to start with the number. */
const step = (n: number): string => {
  const work = /\n## How to work\n([\s\S]*?)(?=\n## )/.exec(text())![1]!;
  return new RegExp(`^${n}\\. .*$`, 'm').exec(work)![0];
};
const peersSection = (body: string): string => /\n## Working with peers\n([\s\S]*?)(?=\n## )/.exec(body)![1]!.trim();

describe('native devops-engineer: the guard and production claims', () => {
  it('step 5 names exactly what the bound guard blocks, and what it does not', () => {
    const five = step(5);
    expect(five).toContain(`blocks forced pushes, \`vercel --prod\`, \`.env\` writes and ${COMMON_FORMS}; it is a seat belt, not a boundary.`);
    expect(five).not.toContain('blocks only');
    expect(five).not.toMatch(/blocks[^.]*production deploys/);
    for (const other of ['az deployment', 'kubectl apply', 'terraform apply', 'gh workflow run']) expect(five, other).toContain(other);
    expect(five).toMatch(/does not stop other deploys/);
    expect(five).toMatch(/does not catch every destructive form/);
    expect(five).toMatch(/your own obligation/);
  });

  describe('against the real guard script', () => {
    const project = fs.mkdtempSync(path.join(os.tmpdir(), 'agents-united-devops-guard-'));
    beforeAll(() => {
      fs.mkdirSync(path.join(project, '.claude/hooks'), { recursive: true });
      for (const file of fs.readdirSync(path.resolve('registry/hosts/claude/hooks'))) fs.copyFileSync(path.resolve('registry/hosts/claude/hooks', file), path.join(project, '.claude/hooks', file));
    });
    afterAll(() => fs.rmSync(project, { recursive: true, force: true }));
    const blocked = (command: string): boolean => attempt(text(), project, { tool: 'Bash', input: { command } }, { agentType: 'devops-engineer' }).blocked;

    it.each(['vercel --prod', 'git push --force origin main', 'rm -rf /', 'sudo ls', 'shutdown now', 'az group delete --name g --yes'])('blocks %s, as step 5 says', command => {
      expect(blocked(command)).toBe(true);
    });

    it.each(['terraform apply', 'kubectl apply -f x.yaml', 'az deployment group create --resource-group g --template-file main.bicep', 'gh workflow run x'])('does not block %s, as step 5 says', command => {
      expect(blocked(command)).toBe(false);
    });
  });

  it('Boundaries say where the guard comes from in both modes', () => {
    expect(text()).toContain(`- A guard blocks forced pushes, \`vercel --prod\`, \`.env\` writes and ${COMMON_FORMS}; it is a seat belt, not a boundary. As a subagent it comes from this file, when the host runs this file's hooks. As a teammate it comes from the settings-level session guard, which is optional and may be off. You cannot verify from inside that a guard is active, so keep its rules as your own obligation in either case.`);
  });

  it('keeps the destructive-command rule in the Safety floor', () => {
    expect(text()).toContain('- Do not run destructive shell commands such as recursive deletes, privilege escalation, shutdown or resource group deletion.');
  });
});

describe('native devops-engineer: the peers section of the engineering family', () => {
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

  it('step 6 hands the report back as the final answer and conditionally through SubagentHandback', () => {
    expect(step(6)).toBe('6. **Hand back.** Return the report from the Output Contract as your final message: your final answer is the hand-back. Deliver it through `SubagentHandback` only where the host supplies that tool; where it does not, your ordinary final response is the hand-back.');
  });

  it('holds the two messaging tools its capability gives, and the core declares the capability', async () => {
    const tools = /^tools: (.*)$/m.exec(text())![1]!.split(', ');
    expect(tools).toEqual(expect.arrayContaining(['ListAgents', 'SendMessage']));
    expect((await loadSemanticCore('registry')).get('subagent-devops-engineer')!.capabilities).toContain('messaging');
  });
});

describe('native devops-engineer: the MCP servers of its canonical agent', () => {
  it('holds github and context7 in its tools line and says when to use them', () => {
    const tools = /^tools: (.*)$/m.exec(text())![1]!.split(', ');
    expect(tools).toEqual(expect.arrayContaining(['mcp__github', 'mcp__context7']));
    expect(text()).toContain(`- Library and framework questions: confirm them with \`mcp__context7\` before relying on memory. Pull-request and repository reads go through \`mcp__github\`; do not push, merge or force anything without being asked.`);
    expect(text().split('A guard blocks')).toHaveLength(2);
  });

  it('declares the same servers as the canonical registry agent', () => {
    const canonical = fs.readFileSync(path.resolve('registry/agents/subagent-devops-engineer.md'), 'utf8').replace(/\r\n/g, '\n');
    expect([...canonical.matchAll(/^  - name: (github|context7)$/gm)].map(match => match[1]).sort()).toEqual(['context7', 'github']);
  });
});

describe('native devops-engineer: permission mode', () => {
  it('equals the value of the canonical registry agent', () => {
    const mode = (source: string): string | undefined => /^permissionMode: (.+)$/m.exec(source.replace(/\r\n/g, '\n'))?.[1];
    const canonical = mode(fs.readFileSync(path.resolve('registry/agents/subagent-devops-engineer.md'), 'utf8'));
    expect(canonical).toBe('acceptEdits');
    expect(mode(text())).toBe(canonical);
  });
});

describe('native devops-engineer: the shared scope_boundaries', () => {
  it('names the four canonical directives, each with its own obligations beside the pilot sentences', async () => {
    const scope = (await loadSemanticCore('registry')).get('subagent-devops-engineer')!.scope_boundaries;
    for (const title of ['Infrastructure as Code (IaC) Standardization', 'Automated CI/CD & Edge Preview Pipelines', 'Containerization & Optimization', 'Environment Parity & Zero Credential Leaks']) expect(scope, title).toContain(`**${title}.**`);
    for (const obligation of ['az bicep lint', 'managed identities', 'GitHub Actions workflows', 'ephemeral preview URLs', 'multi-stage Dockerfiles', 'non-root execution', 'parity', 'zero plaintext secrets']) expect(scope, obligation).toContain(obligation);
    expect(scope).toContain('Audit first:');
    expect(scope).toContain('reported as a gap in the handoff');
    expect(scope).toContain('hand the production command to the orchestrator for explicit user approval');
  });

  it('keeps the Azure-specific obligations conditional on the target platform, so Terraform or AWS work is covered by the generic sentence', async () => {
    const scope = (await loadSemanticCore('registry')).get('subagent-devops-engineer')!.scope_boundaries;
    expect(scope).toContain("validate syntax with the target platform's linter or dry run");
    expect(scope).toContain('on Azure author Bicep templates and lint them with `az bicep lint`');
    expect(scope).toContain('(on Azure, Key Vault) where the target platform supports them');
    expect(scope).toContain('Where the target platform supports them, configure KEDA scale rules');
  });
});
