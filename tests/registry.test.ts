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
});
