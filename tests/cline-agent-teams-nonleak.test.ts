import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'fs-extra';
import { ClineLauncher } from '../src/core/cline-launcher.js';
import type { ClineCapabilityReport } from '../src/core/types.js';

/**
 * Plan 016 post-gate — Tier 2 (organization) is a *Claude-runtime* posture.
 *
 * Agent Teams is a Claude Code feature behind `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`; the live docs say
 * "Without that variable, no team is set up at session start". The Cline lane therefore must not pretend to
 * honour `--teams`: its own strategy is capability-driven (named-team vs adaptive-session) and the tier
 * can only ever be *reported* there. These assertions pin that no teams scaffolding leaks across hosts.
 */
describe('Plan 016 — the Cline lane never applies the Agent-Teams scaffold (Tier 2 non-leakage)', () => {
  const testWorkspace = path.resolve(process.cwd(), 'scratch/test-cline-launcher-teams');
  const TEAMS_ENV = 'CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS';

  const report: ClineCapabilityReport = {
    installed: true,
    version: 'v3.0.62',
    namedTeams: true,
    rolePresetConsumer: 'unknown',
    command: { executable: 'cline', prefixArgs: [], source: 'path-executable' },
    diagnostics: [],
  };

  const plan = (overrides: Partial<Parameters<ClineLauncher['planActivation']>[0]> = {}) =>
    new ClineLauncher().planActivation({
      bundleName: 'digital-agency',
      workspace: testWorkspace,
      scope: 'project',
      report,
      orchestrator: 'orchestrator-digital-agency.md',
      ...overrides,
    });

  beforeEach(async () => {
    await fs.remove(testWorkspace);
    await fs.ensureDir(testWorkspace);
  });

  afterEach(async () => {
    await fs.remove(testWorkspace);
  });

  it('never injects the opt-in variable, never passes --teams, and carries no env at all', () => {
    const activation = plan();

    expect(activation.argv.join(' ')).not.toContain(TEAMS_ENV);
    expect(activation.argv).not.toContain('--teams');
    // `ClineActivationPlan` has no `env` field: the ephemeral env is a Claude-lane-only mechanism.
    expect(Object.keys(activation)).not.toContain('env');
  });

  it('keeps the capability-driven strategy for an organization-tier bundle', () => {
    expect(plan().strategy).toBe('named-team');
    expect(plan({ report: { ...report, namedTeams: false } }).strategy).toBe('adaptive-session');
  });

  it('keeps the host-neutral manifest as the bootstrap surface and stays silent about teams', () => {
    const activation = plan();

    // The Cline prompt points at the host-neutral team manifest and the coordinator definition; the
    // projected `.cline/agents/*.yml` roster is named by the coordinator *rule*, not by this prompt.
    expect(activation.bootstrapPrompt).toContain(
      '.agents/plugins/digital-agency/agents-united/teams/digital-agency.yaml'
    );
    expect(activation.bootstrapPrompt).toContain('.agents/agents/orchestrator-digital-agency.md');
    expect(activation.bootstrapPrompt).not.toContain(TEAMS_ENV);
  });
});
