import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'yaml';
import { RegistryResolver } from '../src/core/registry.js';
import { ClaudeProjector } from '../src/core/claude-projector.js';
import type { BundleDefinition, BundlesManifest } from '../src/core/types.js';

/**
 * Plan 022 H1 — iteration limits, NARROWED BY OWNER DECISION (2026-09-25): caps are
 * Tier-2-only (organization-bundle coordinators via `planningLoop.budget.maxIterations`,
 * rendered as Claude `maxTurns` — field verified against the Claude Code sub-agents
 * reference). Tier-1 domain agents and every specialist stay uncapped. digital-agency's
 * `maxIterations: 100` is an unvalidated experiment for bigger projects.
 */
const REGISTRY = path.resolve(process.cwd(), 'registry');
const manifest = JSON.parse(fs.readFileSync(path.join(REGISTRY, 'bundles.json'), 'utf8')) as BundlesManifest;

function frontmatter(content: string): Record<string, unknown> {
  return yaml.parse(content.match(/^---\n([\s\S]*?)\n---/)![1]) as Record<string, unknown>;
}

async function roles(bundleName: string): Promise<Map<string, Record<string, unknown>>> {
  const bundle = manifest.bundles[bundleName] as BundleDefinition;
  const agents: string[] = [bundle.orchestrator!, ...(bundle.agents ?? []).slice(0, 3)];
  const plan = await ClaudeProjector.planCompoundProjection(
    bundle,
    'project',
    { targetBundle: bundleName, agents, skills: [], workflows: [], rules: [] },
    REGISTRY,
  );
  const out = new Map<string, Record<string, unknown>>();
  for (const artifact of plan) {
    if (artifact.kind === 'role' && typeof artifact.content === 'string') out.set(artifact.canonical ?? artifact.relPath, frontmatter(artifact.content));
  }
  return out;
}

function withBundle(bundle: Partial<BundleDefinition>): BundlesManifest {
  return { ...manifest, bundles: { probe: { name: 'probe', agents: [], skills: [], ...bundle } as BundleDefinition } };
}

describe('Plan 022 H1 — Tier-2-only iteration caps', () => {
  it('only organization-tier bundles declare a Consultation Budget (maxIterations)', () => {
    const offenders = Object.entries(manifest.bundles)
      .filter(([, b]) => b.planningLoop?.budget !== undefined && b.tier !== 'organization')
      .map(([name]) => name);
    expect(offenders).toEqual([]);
    expect(manifest.bundles['digital-agency'].planningLoop?.budget?.maxIterations).toBe(100);
  });

  it('registry validation rejects a budget on a non-organization bundle', () => {
    const r = new RegistryResolver(REGISTRY) as unknown as { validateBundles(m: BundlesManifest): void };
    const budget = { maxPlanningRounds: 2, maxPeerExchangesPerPair: 2, summaryWordCap: 300, maxIterations: 50 };
    expect(() => r.validateBundles(withBundle({ tier: 'domain', planningLoop: { enabled: true, mode: 'subagent-first', budget } })))
      .toThrow(/Tier-2-only/);
    expect(() => r.validateBundles(withBundle({ tier: 'organization', planningLoop: { enabled: true, mode: 'subagent-first', budget } })))
      .not.toThrow();
  });

  it('registry validation rejects a non-positive or non-integer maxIterations', () => {
    const r = new RegistryResolver(REGISTRY) as unknown as { validateBundles(m: BundlesManifest): void };
    for (const maxIterations of [0, -1, 2.5]) {
      const budget = { maxPlanningRounds: 2, maxPeerExchangesPerPair: 2, summaryWordCap: 300, maxIterations };
      expect(() => r.validateBundles(withBundle({ tier: 'organization', planningLoop: { enabled: true, mode: 'subagent-first', budget } })))
        .toThrow(/maxIterations/);
    }
  });

  it('the Tier-2 coordinator renders maxTurns; its specialists stay uncapped', async () => {
    const rendered = await roles('digital-agency');
    expect(rendered.get('agents/orchestrator-digital-agency.md')?.maxTurns).toBe(100);
    for (const [canonical, meta] of rendered) {
      if (canonical !== 'agents/orchestrator-digital-agency.md') expect(meta.maxTurns, canonical).toBeUndefined();
    }
  });

  it('Tier-1 coordinators and specialists render no maxTurns', async () => {
    for (const bundleName of ['software-engineering', 'product-design', 'business-strategy']) {
      for (const [canonical, meta] of await roles(bundleName)) {
        expect(meta.maxTurns, `${bundleName}: ${canonical}`).toBeUndefined();
      }
    }
  });
});
