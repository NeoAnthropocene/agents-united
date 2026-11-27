import { describe, expect, it } from 'vitest';
import path from 'node:path';
import fs from 'fs-extra';
import { ClaudeProjector } from '../src/core/claude-projector.js';
import { RegistryResolver } from '../src/core/registry.js';
import {
  BOUND_FACTORY_SKILLS,
  assertClaudeSkillBindings,
  isBoundFactorySkill,
  parseClaudeSkillBinding,
} from '../src/core/claude-skill-binding.js';
import type { BundleDefinition } from '../src/core/types.js';

const registryDir = path.resolve('registry');

async function factoryBundle(): Promise<BundleDefinition> {
  const registry = await fs.readJson(path.join(registryDir, 'bundles.json')) as { bundles: Record<string, BundleDefinition> };
  return registry.bundles['agent-factory']!;
}

describe('general Claude factory skill binding (ADR 0082 slice S0b)', () => {
  it('lists author-skill and author-rule with their binding files in the closed reviewed list', () => {
    expect(BOUND_FACTORY_SKILLS).toEqual([
      { skill: 'author-skill', file: 'hosts/claude/agent-factory.binding.json' },
      { skill: 'author-rule', file: 'hosts/claude/agent-factory-rule.binding.json' },
    ]);
    expect(isBoundFactorySkill('author-skill')).toBe(true);
    expect(isBoundFactorySkill('author-rule')).toBe(true);
    expect(isBoundFactorySkill('realize-artifact')).toBe(false);
    expect(isBoundFactorySkill('author-x')).toBe(false);
  });

  it('validates a second, test-only entry through the same per-entry schema', async () => {
    const entry = { skill: 'author-x', file: 'hosts/claude/agent-factory-x.binding.json' };
    const base = await fs.readJson(path.join(registryDir, BOUND_FACTORY_SKILLS[0]!.file)) as Record<string, unknown>;
    const synthetic = JSON.parse(JSON.stringify(base).replaceAll('author-skill', 'author-x')) as Record<string, unknown>;
    const parsed = parseClaudeSkillBinding(entry, synthetic);
    expect(parsed.skill).toBe('author-x');
    expect(parsed.source).toBe('hosts/claude/skills/author-x/SKILL.md');
    expect(parsed.installed).toBe('.claude/skills/author-x/SKILL.md');
    expect(parsed.invocation).toBe('/author-x');
    expect(parsed.rule.installed).toBe('.claude/skills/author-x/references/skill-attribution.md');
  });

  it('refuses a declaration whose skill name or paths belong to another entry', async () => {
    const entry = { skill: 'author-x', file: 'hosts/claude/agent-factory-x.binding.json' };
    const base = await fs.readJson(path.join(registryDir, BOUND_FACTORY_SKILLS[0]!.file)) as Record<string, unknown>;
    // The author-skill declaration does not satisfy the author-x entry.
    expect(() => parseClaudeSkillBinding(entry, base)).toThrow(/binding/i);
    const synthetic = JSON.parse(JSON.stringify(base).replaceAll('author-skill', 'author-x')) as Record<string, unknown>;
    expect(() => parseClaudeSkillBinding(entry, { ...synthetic, skill: 'author-skill' })).toThrow(/binding/i);
    expect(() => parseClaudeSkillBinding(entry, { ...synthetic, rule: { ...(synthetic.rule as object), installed: '.claude/rules/skill-attribution.md' } })).toThrow(/binding/i);
    expect(() => parseClaudeSkillBinding(entry, { ...synthetic, rule: { ...(synthetic.rule as object), installed: '.claude/skills/author-skill/references/skill-attribution.md' } })).toThrow(/binding/i);
    expect(() => parseClaudeSkillBinding(entry, { ...synthetic, invocation: '/author-skill' })).toThrow(/binding/i);
  });

  it('returns the list of applicable bindings: one per bound Skill for the agent-factory bundle, none otherwise', async () => {
    const bundle = await factoryBundle();
    const resolved = await new RegistryResolver(registryDir).resolve('agent-factory');
    const bindings = assertClaudeSkillBindings(bundle, resolved, registryDir, 'project', true);
    expect(Array.isArray(bindings)).toBe(true);
    expect(bindings).toHaveLength(2);
    expect(bindings[0]).toMatchObject({ skill: 'author-skill', bundle: 'agent-factory', invocation: '/author-skill' });
    expect(bindings[1]).toMatchObject({ skill: 'author-rule', bundle: 'agent-factory', invocation: '/author-rule' });

    const ordinary: BundleDefinition = { name: 'ordinary', description: 'Existing bundle', skills: ['ordinary-skill'] };
    const none = assertClaudeSkillBindings(ordinary, { agents: [], skills: ['ordinary-skill'], rules: [], workflows: [] }, registryDir, 'project', true);
    expect(none).toEqual([]);
  });

  it('applies a binding only to the bundle it declares or a bundle whose parent chain reaches it', async () => {
    const resolved = await new RegistryResolver(registryDir).resolve('agent-factory');
    // A foreign bundle that merely lists a bound Skill does not take the binding of agent-factory.
    const foreign: BundleDefinition = { name: 'author-skill-fixture', description: 'Lists a bound Skill', skills: ['author-skill', 'author-rule'] };
    expect(assertClaudeSkillBindings(foreign, resolved, registryDir, 'project', true)).toEqual([]);
    const unrelatedParent: BundleDefinition = { ...foreign, name: 'unrelated-child', parentBundle: 'software-engineering' };
    expect(assertClaudeSkillBindings(unrelatedParent, resolved, registryDir, 'project', true)).toEqual([]);
    const unknownParent: BundleDefinition = { ...foreign, name: 'orphan-child', parentBundle: 'no-such-bundle' };
    expect(assertClaudeSkillBindings(unknownParent, resolved, registryDir, 'project', true)).toEqual([]);
    // A bundle that extends agent-factory takes both bindings.
    const child: BundleDefinition = { ...foreign, name: 'factory-child', parentBundle: 'agent-factory' };
    expect(assertClaudeSkillBindings(child, resolved, registryDir, 'project', true).map(binding => binding.skill)).toEqual(['author-skill', 'author-rule']);
  });

  // The registry and the installer resolve a parentBundle that names an alias of a bundle (registry.ts withInheritedOptionalMcps, installer.ts
  // parent lookup). The binding's parent walk resolves it the same way, so an aliased link does not hide a bundle that reaches agent-factory.
  it('follows a parentBundle that names an alias, at any link of the chain', async () => {
    const copy = path.resolve('scratch/test-binding-alias-registry');
    await fs.remove(copy);
    try {
      await fs.copy(registryDir, copy);
      const manifestFile = path.join(copy, 'bundles.json');
      const manifest = await fs.readJson(manifestFile) as { bundles: Record<string, BundleDefinition> };
      manifest.bundles['agent-factory'] = { ...manifest.bundles['agent-factory']!, aliases: [...(manifest.bundles['agent-factory']!.aliases ?? []), 'factory-alias'] };
      manifest.bundles['aliased-mid'] = { name: 'aliased-mid', domain: 'contributor', description: 'Extends the factory through its alias', aliases: ['mid-alias'], parentBundle: 'factory-alias' };
      manifest.bundles['aliased-unrelated'] = { name: 'aliased-unrelated', description: 'Extends another bundle', aliases: ['unrelated-alias'], parentBundle: 'software-engineering' };
      await fs.writeJson(manifestFile, manifest);

      const resolved = await new RegistryResolver(copy).resolve('agent-factory');
      const lists: BundleDefinition = { name: 'child', description: 'Lists the bound Skills', skills: ['author-skill', 'author-rule'] };
      const skills = (bundle: BundleDefinition) => assertClaudeSkillBindings(bundle, resolved, copy, 'project', true).map(binding => binding.skill);
      // Through an alias of agent-factory itself, through an aliased intermediate, and through both.
      expect(skills({ ...lists, name: 'via-factory-alias', parentBundle: 'factory-alias' })).toEqual(['author-skill', 'author-rule']);
      expect(skills({ ...lists, name: 'via-mid-alias', parentBundle: 'mid-alias' })).toEqual(['author-skill', 'author-rule']);
      // An alias of an unrelated bundle still takes nothing.
      expect(skills({ ...lists, name: 'via-unrelated-alias', parentBundle: 'unrelated-alias' })).toEqual([]);
    } finally {
      await fs.remove(copy);
    }
  });

  it('installs the attribution rule only under each bound skill for the agent-factory bundle', async () => {
    const bundle = await factoryBundle();
    const resolved = await new RegistryResolver(registryDir).resolve('agent-factory');
    const artifacts = await ClaudeProjector.planCompoundProjection(bundle, 'project', resolved, registryDir, undefined, true);
    const rules = artifacts.filter(artifact => artifact.kind === 'rule' && artifact.canonical === 'rules/skill-attribution.md');
    expect(rules.map(rule => rule.relPath).sort()).toEqual(['.claude/skills/author-rule/references/skill-attribution.md', '.claude/skills/author-skill/references/skill-attribution.md']);
    expect(artifacts.some(artifact => artifact.relPath === '.claude/rules/skill-attribution.md')).toBe(false);
  });
});
