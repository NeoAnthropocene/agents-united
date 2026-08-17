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
