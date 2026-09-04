import { describe, it, expect, beforeAll } from 'vitest';
import path from 'node:path';
import { RegistryResolver } from '../src/core/registry.js';

describe('RegistryResolver', () => {
  let resolver: RegistryResolver;

  beforeAll(() => {
    resolver = new RegistryResolver(path.resolve(process.cwd(), 'registry'));
  });

  it('should load bundles from registry', async () => {
    const manifest = await resolver.loadBundles();
    expect(manifest.version).toBe(1);
    expect(manifest.bundles['software-engineering']).toBeDefined();
    expect(manifest.bundles['product-design']).toBeDefined();
  });

  it('should resolve software-engineering bundle assets', async () => {
    const resolved = await resolver.resolve('software-engineering');
    expect(resolved.targetBundle).toBe('software-engineering');
    expect(resolved.agents).toContain('orchestrator-engineering.md');
    expect(resolved.agents).toContain('subagent-backend-architect.md');
    expect(resolved.skills).toContain('test-driven-development');
    expect(resolved.workflows).toContain('workflow-implement.md');
  });

  it('should resolve single agent item', async () => {
    const resolved = await resolver.resolve('orchestrator-engineering');
    expect(resolved.agents).toContain('orchestrator-engineering.md');
    expect(resolved.skills.length).toBe(0);
  });

  it('should throw error for non-existent item', async () => {
    await expect(resolver.resolve('invalid-non-existent-bundle')).rejects.toThrow();
  });

  it('should find items matching search query', async () => {
    const results = await resolver.find('engineering');
    expect(results.bundles.some(b => b.name === 'software-engineering')).toBe(true);
    expect(results.agents.some(a => a.includes('engineering'))).toBe(true);
  });

  it('should resolve bundle aliases like software-engineering-essentials', async () => {
    const bundle = await resolver.getBundle('software-engineering-essentials');
    expect(bundle).toBeDefined();
    expect(bundle?.name).toBe('software-engineering');
    expect(bundle?.domain).toBe('engineering');
    expect(bundle?.recommendedAddons).toContain('mobile-development');

    const resolved = await resolver.resolve('software-engineering-essentials');
    expect(resolved.targetBundle).toBe('software-engineering');
    expect(resolved.agents).toContain('orchestrator-engineering.md');
  });

  it('should resolve parentBundle composition properly', async () => {
    const manifest = await resolver.loadBundles();
    // Simulate a child bundle extending software-engineering
    manifest.bundles['mobile-development-test'] = {
      name: 'mobile-development-test',
      description: 'Mobile test extension',
      parentBundle: 'software-engineering',
      skills: ['mobile-first-design'],
    };

    const resolved = await resolver.resolve('mobile-development-test');
    expect(resolved.skills).toContain('mobile-first-design');
    expect(resolved.skills).toContain('test-driven-development');
    expect(resolved.agents).toContain('orchestrator-engineering.md');

    delete manifest.bundles['mobile-development-test'];
  });

  it('should filter search results by domain and type', async () => {
    const engineeringBundles = await resolver.find('', { domain: 'engineering', type: 'bundle' });
    expect(engineeringBundles.bundles.length).toBeGreaterThan(0);
    expect(engineeringBundles.bundles.every(b => b.domain === 'engineering')).toBe(true);
    expect(engineeringBundles.agents.length).toBe(0);

    const skillsOnly = await resolver.find('playwright', { type: 'skill' });
    expect(skillsOnly.skills).toContain('playwright-best-practices');
    expect(skillsOnly.bundles.length).toBe(0);

    const workflows = await resolver.find('audit', { type: 'workflow' });
    expect(workflows.workflows.some(w => w.includes('audit'))).toBe(true);
  });

  it('should resolve entire department domain with domain:<name>', async () => {
    const resolved = await resolver.resolve('domain:engineering');
    expect(resolved.targetBundle).toBe('domain:engineering');
    expect(resolved.agents).toContain('orchestrator-engineering.md');
    expect(resolved.agents).toContain('subagent-ios-architect.md');
    expect(resolved.agents).toContain('subagent-qa-automation-lead.md');
    expect(resolved.skills).toContain('mobile-ios-design');
    expect(resolved.skills).toContain('playwright-best-practices');
    expect(resolved.workflows).toContain('workflow-mobile-build.md');
  });

  it('should resolve domain:marketing with all marketing addons and agents', async () => {
    const resolved = await resolver.resolve('domain:marketing');
    expect(resolved.targetBundle).toBe('domain:marketing');
    expect(resolved.agents).toContain('orchestrator-marketing.md');
    expect(resolved.agents).toContain('subagent-marketing-creative-designer.md');
    expect(resolved.agents).toContain('subagent-seo-specialist.md');
    expect(resolved.agents).toContain('subagent-paid-acquisition-specialist.md');
    expect(resolved.agents).toContain('subagent-plg-strategist.md');
    expect(resolved.agents).toContain('subagent-lifecycle-email-specialist.md');
    expect(resolved.skills).toContain('programmatic-seo');
    expect(resolved.skills).toContain('paid-acquisition-ppc');
    expect(resolved.skills).toContain('onboarding-cro');
    expect(resolved.skills).toContain('email-drip-sequences');
  });

  it('should resolve ai-ml-engineering bundle assets and inherit parent software-engineering', async () => {
    const resolved = await resolver.resolve('ai-ml-engineering');
    expect(resolved.targetBundle).toBe('ai-ml-engineering');
    expect(resolved.agents).toContain('subagent-ml-platform-engineer.md');
    expect(resolved.agents).toContain('subagent-ai-model-architect.md');
    expect(resolved.skills).toContain('modal-serverless-python');
    expect(resolved.skills).toContain('rag-vector-pipeline');
    expect(resolved.workflows).toContain('workflow-ml-eval.md');
    // Inherited from parentBundle software-engineering
    expect(resolved.agents).toContain('orchestrator-engineering.md');
    expect(resolved.skills).toContain('test-driven-development');
  });
});

describe('digital-agency planning loop registry contract (Plan 012 / ADR 0014)', () => {
  let resolver: RegistryResolver;

  beforeAll(() => {
    resolver = new RegistryResolver(path.resolve(process.cwd(), 'registry'));
  });

  it('should declare planningLoop enabled on digital-agency with the approved Consultation Budget defaults', async () => {
    const bundle = await resolver.getBundle('digital-agency');
    expect(bundle).toBeDefined();
    expect(bundle?.planningLoop?.enabled).toBe(true);

    const budget = bundle?.planningLoop?.budget;
    expect(budget).toBeDefined();
    expect(budget?.maxPlanningRounds).toBe(2);
    expect(budget?.maxPeerExchangesPerPair).toBe(2);
    expect(budget?.summaryWordCap).toBe(150);
    expect(budget?.maxIterations).toBe(8);

    expect(bundle?.planningLoop?.sidekicks?.max).toBe(2);
  });

  it('should map every AstrolabsAI persona to a role present in the digital-agency roster', async () => {
    const bundle = await resolver.getBundle('digital-agency');
    expect(bundle).toBeDefined();

    const personas = bundle?.personaAliases ?? {};
    // The six personas referenced by the workflow-agency-*.md files.
    for (const persona of [
      'chris-director',
      'ava-manager',
      'kaan-copy',
      'jamileh-design',
      'yavuz-content',
      'jale-social',
    ]) {
      expect(personas[persona], `missing persona alias: ${persona}`).toBeDefined();
    }

    // Every alias target must exist in the bundle roster (orchestrator or agent, .md stripped).
    const roster = new Set(
      [bundle?.orchestrator, ...(bundle?.agents ?? [])]
        .filter((f): f is string => typeof f === 'string')
        .map((f) => f.replace(/\.md$/i, ''))
    );
    for (const [persona, role] of Object.entries(personas)) {
      expect(roster.has(role), `persona ${persona} maps to unknown role ${role}`).toBe(true);
    }
  });

  it('should keep planningLoop opt-in: no bundle other than digital-agency declares it', async () => {
    const manifest = await resolver.loadBundles();
    const enabled = Object.values(manifest.bundles).filter((b) => b.planningLoop?.enabled === true);
    expect(enabled.map((b) => b.name)).toEqual(['digital-agency']);
  });
});
