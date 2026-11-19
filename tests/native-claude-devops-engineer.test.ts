import { describe, expect, it } from 'vitest';
import { loadSemanticCore } from '../src/core/semantic-core.js';
import { nativeText } from './helpers/native-roles.js';

/**
 * The factory pilot's first real member, `devops-engineer`: what its authored body must keep saying. The guard sentence is the
 * maintainer's decision on point (b) ("text now, guard later"); the peers section is the engineering family's form (frontend-architect),
 * not the digital agency's (point a, "Add messaging").
 */

const text = (): string => nativeText('devops-engineer');
const step = (n: number): string => new RegExp(`^${n}\\. .*$`, 'm').exec(text())![0];

describe('native devops-engineer: the guard and production claims', () => {
  it('step 5 names exactly what the bound guard blocks, and what it does not', () => {
    const five = step(5);
    expect(five).toContain('blocks only forced pushes, `vercel --prod` and `.env` writes');
    expect(five).not.toMatch(/blocks[^.]*production deploys/);
    for (const other of ['az deployment', 'kubectl apply', 'terraform apply', 'gh workflow run']) expect(five, other).toContain(other);
    expect(five).toMatch(/does not enforce the Safety rule against destructive shell commands/);
    expect(five).toMatch(/your own obligation/);
  });

  it('Boundaries say where the guard comes from in both modes', () => {
    expect(text()).toContain("- A guard blocks forced pushes, `vercel --prod` and `.env` writes. As a subagent it comes from this file; as a teammate it comes from the project's settings.");
  });

  it('keeps the destructive-command rule in the Safety floor', () => {
    expect(text()).toContain('- Do not run destructive shell commands such as recursive deletes, privilege escalation, shutdown or resource group deletion.');
  });
});

describe('native devops-engineer: the peers section of the engineering family', () => {
  it('is the Tier 1 form: a lead-spawned subagent first, no agency, no shutdown frame, no teammate-reality paragraph', () => {
    const body = text();
    expect(body).toContain('You run as a subagent that a lead spawns (Tier 1, the usual case) or as a teammate of a coordinated team. Follow the mode your brief names.');
    expect(body).not.toMatch(/digital agency/i);
    expect(body).not.toContain('shutdown_request');
    expect(body).not.toContain('a brief cannot make you a teammate');
    expect(body).not.toContain('Do not message a peer');
    expect(body).toContain('- **Relay mode is the default.** You cannot reach a peer by name. Put every question for a peer under `Open items`, and the lead relays it.');
  });

  it('step 6 hands the report back through SubagentHandback in the plain form', () => {
    expect(step(6)).toBe('6. **Hand back.** Return the report from the Output Contract as your final message through `SubagentHandback`.');
  });

  it('holds exactly the messaging tools its capability gives, and the core declares the capability', async () => {
    const tools = /^tools: (.*)$/m.exec(text())![1]!.split(', ');
    expect(tools).toEqual(expect.arrayContaining(['ListAgents', 'SendMessage']));
    expect((await loadSemanticCore('registry')).get('subagent-devops-engineer')!.capabilities).toContain('messaging');
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
});
