import { describe, it, expect, beforeAll } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import { RegistryResolver } from '../src/core/registry.js';
import { contributorCatalogFixture } from './helpers/contributor-catalog.js';

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

  it('declares the empty contributor Domain Bundle shell as under construction', async () => {
    const bundle = await resolver.getBundle('agent-factory');
    expect(bundle).toMatchObject({
      name: 'agent-factory',
      domain: 'contributor',
      tier: 'domain',
      status: 'under-construction',
      agents: [],
      skills: [],
      workflows: [],
      rules: [],
    });
    expect(bundle?.orchestrator).toBeUndefined();
    expect(bundle?.parentBundle).toBeUndefined();
  });

  it('refuses resolving the unavailable empty contributor shell', async () => {
    await expect(resolver.resolve('agent-factory')).rejects.toThrow('unavailable empty contributor shell');
  });

  it('should resolve software-engineering bundle assets', async () => {
    const resolved = await resolver.resolve('software-engineering');
    expect(resolved.targetBundle).toBe('software-engineering');
    expect(resolved.agents).toContain('orchestrator-engineering.md');
    expect(resolved.agents).toContain('subagent-backend-architect.md');
    expect(resolved.skills).toContain('test-driven-development');
    expect(resolved.skills).toContain('workflow-implement');
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
    expect(resolved.skills).toContain('workflow-mobile-build');
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
    expect(resolved.skills).toContain('workflow-ml-eval');
    // Inherited from parentBundle software-engineering
    expect(resolved.agents).toContain('orchestrator-engineering.md');
    expect(resolved.skills).toContain('test-driven-development');
  });
});

describe('contributor catalog isolation (Plan 033 slice 2)', () => {
  it('keeps populated contributor content discoverable and explicitly resolvable while preserving shared end-user assets', async () => {
    const fixture = await contributorCatalogFixture();
    try {
      await expect(fixture.resolver.loadBundles()).resolves.toBeDefined();
      expect((await fixture.resolver.getBundlesByDomain('contributor')).map(bundle => bundle.name)).toEqual(['fixture-factory']);
      expect((await fixture.resolver.find('', { domain: 'contributor', type: 'bundle' })).bundles.map(bundle => bundle.name)).toEqual(['fixture-factory']);
      const contributor = await fixture.resolver.resolve('fixture-authoring');
      expect(contributor.skills).toContain('fixture-contribute');
      expect(contributor.agents).toContain('fixture-contributor-lead.md');
      for (const identifier of ['full', 'domain:engineering']) {
        const ordinary = await fixture.resolver.resolve(identifier);
        expect(ordinary.agents).not.toContain('fixture-contributor-lead.md');
        expect(ordinary.agents).not.toContain('fixture-contributor.md');
        expect(ordinary.skills).not.toContain('fixture-contribute');
        expect(ordinary.workflows).not.toContain('fixture-contribute.md');
        expect(ordinary.rules).not.toContain('contributor-rule.md');
        expect(ordinary.agents).toContain('fixture-engineer.md');
        expect(ordinary.workflows).toContain('fixture-build.md');
        expect(ordinary.rules).toContain('shared-rule.md');
        expect(ordinary.skills).toEqual(expect.arrayContaining(['color-theory', 'image-creation', 'brand-consistency-audit']));
      }
    } finally {
      await fixture.remove();
    }
  });

  it.each([
    ['agents', 'fixture-contributor.md'],
    ['workflows', 'fixture-contribute.md'],
    ['rules', 'contributor-rule.md'],
  ] as const)('rejects contributor-only %s in full', async (kind, asset) => {
    const fixture = await contributorCatalogFixture(manifest => {
      manifest.bundles.full[kind]!.push(asset);
    });
    try {
      await expect(fixture.resolver.loadBundles()).rejects.toThrow(`full includes contributor-only ${kind} "${asset}"`);
    } finally {
      await fixture.remove();
    }
  });

  it('rejects a contributor-only orchestrator declared as the full leader', async () => {
    const fixture = await contributorCatalogFixture(manifest => {
      manifest.bundles.full.orchestrator = 'fixture-contributor-lead.md';
    });
    try {
      await expect(fixture.resolver.loadBundles()).rejects.toThrow('full includes contributor-only agents "fixture-contributor-lead.md"');
    } finally {
      await fixture.remove();
    }
  });

  it('does not make an empty contributor bundle available through a status change or alias', async () => {
    const fixture = await contributorCatalogFixture(manifest => {
      manifest.bundles['fixture-factory'] = {
        name: 'fixture-factory',
        domain: 'contributor',
        description: 'Empty shell',
        status: 'stable',
        aliases: ['fixture-authoring'],
      };
    });
    try {
      await expect(fixture.resolver.resolve('fixture-authoring')).rejects.toThrow('unavailable empty contributor shell');
    } finally {
      await fixture.remove();
    }
  });

  it('rejects ordinary bundle inheritance from a contributor alias', async () => {
    const fixture = await contributorCatalogFixture(manifest => {
      manifest.bundles['fixture-engineering'].parentBundle = 'fixture-authoring';
    });
    try {
      await expect(fixture.resolver.loadBundles()).rejects.toThrow('cannot inherit contributor bundle "fixture-factory"');
    } finally {
      await fixture.remove();
    }
  });

  it('rejects contributor-only skills in the explicit full inventory', async () => {
    const fixture = await contributorCatalogFixture(manifest => {
      manifest.bundles.full.skills!.push('fixture-contribute');
    });
    try {
      await expect(fixture.resolver.loadBundles()).rejects.toThrow('full includes contributor-only skills "fixture-contribute"');
    } finally {
      await fixture.remove();
    }
  });

  it('keeps a rejected contributor catalog unavailable on subsequent public reads', async () => {
    const fixture = await contributorCatalogFixture(manifest => {
      manifest.bundles.full.skills!.push('fixture-contribute');
    });
    try {
      await expect(fixture.resolver.loadBundles()).rejects.toThrow('contributor-only skills');
      await expect(fixture.resolver.loadBundles()).rejects.toThrow('contributor-only skills');
      await expect(fixture.resolver.getBundle('full')).rejects.toThrow('contributor-only skills');
      await expect(fixture.resolver.resolve('full')).rejects.toThrow('contributor-only skills');
    } finally {
      await fixture.remove();
    }
  });

  it('refuses installing a populated contributor domain as an ordinary department', async () => {
    const fixture = await contributorCatalogFixture();
    try {
      await expect(fixture.resolver.resolve('domain:contributor')).rejects.toThrow('contributor is not an end-user department');
    } finally {
      await fixture.remove();
    }
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
    expect(budget?.summaryWordCap).toBe(1000); // owner decision 2026-09-27 (Plan 024 S3/E1): 300 -> 1000
    expect(budget?.maxIterations).toBe(100); // owner decision 2026-09-25: Tier-2-only cap, 8 -> 100 experiment

    expect(bundle?.planningLoop?.sidekicks?.max).toBe(5);
  });

  it('should map every AstrolabsAI persona to a role present in the digital-agency roster', async () => {
    const bundle = await resolver.getBundle('digital-agency');
    expect(bundle).toBeDefined();

    const personas = bundle?.personaAliases ?? {};
    // The six personas referenced by the workflow-agency-*.md files, and the four the maintainer named on 2026-10-04 (ADR 0039).
    for (const persona of [
      'chris-director',
      'ava-manager',
      'kaan-copy',
      'jamileh-design',
      'yavuz-content',
      'jale-social',
      'selin-seo',
      'emre-qa',
      'defne-grc',
      'deniz-frontend',
    ]) {
      expect(personas[persona], `missing persona alias: ${persona}`).toBeDefined();
    }

    // Each of the four new aliases points at the canonical role it plays.
    expect(personas).toMatchObject({
      'selin-seo': 'subagent-seo-specialist',
      'emre-qa': 'subagent-qa-automation-lead',
      'defne-grc': 'subagent-compliance-grc-specialist',
      'deniz-frontend': 'subagent-frontend-architect',
    });

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

  it('should keep planningLoop opt-in: 30 Tier-1 bundles declare planner-orchestrator, digital-agency declares subagent-first', async () => {
    const manifest = await resolver.loadBundles();
    const enabled = Object.values(manifest.bundles).filter((b) => b.planningLoop?.enabled === true);

    // digital-agency: subagent-first with budget/sidekicks
    const da = enabled.find((b) => b.name === 'digital-agency');
    expect(da).toBeDefined();
    expect(da!.planningLoop?.mode).toBe('subagent-first');
    expect(da!.planningLoop?.budget).toBeDefined();
    expect(da!.planningLoop?.sidekicks).toBeDefined();

    // 30 Tier-1 bundles: planner-orchestrator without budget/sidekicks
    const tier1 = enabled.filter((b) => b.name !== 'digital-agency');
    expect(tier1.length).toBe(30);
    for (const b of tier1) {
      expect(b.planningLoop?.mode).toBe('planner-orchestrator');
      expect(b.planningLoop?.budget).toBeUndefined();
      expect(b.planningLoop?.sidekicks).toBeUndefined();
    }

    // The contributor shell has no planning or runtime entry points.
    const excluded = Object.values(manifest.bundles).filter((b) => b.planningLoop?.enabled !== true);
    expect(excluded.map(b => b.name).sort()).toEqual([
      'agent-factory',
      'full',
      'mock-organization-under-construction',
      'universal-orchestration',
      'universal-skills',
    ]);
  });

  it('should reject planner-orchestrator bundle with budget', () => {
    const bad = {
      version: 1,
      bundles: {
        'bad-bundle': {
          name: 'bad-bundle',
          description: 'bad',
          planningLoop: { enabled: true, mode: 'planner-orchestrator', budget: { maxPlanningRounds: 2, maxPeerExchangesPerPair: 2, summaryWordCap: 150, maxIterations: 8 } },
        },
      },
    };
    const r = new RegistryResolver(path.resolve(process.cwd(), 'registry'));
    // Override the internal manifest with the bad data
    (r as any).bundlesManifest = bad;
    expect(() => (r as any).validateBundles(bad)).toThrow('budget');
  });

  it('should reject planner-orchestrator bundle with sidekicks', () => {
    const bad = {
      version: 1,
      bundles: {
        'bad-bundle': {
          name: 'bad-bundle',
          description: 'bad',
          planningLoop: { enabled: true, mode: 'planner-orchestrator', sidekicks: { max: 2 } },
        },
      },
    };
    const r = new RegistryResolver(path.resolve(process.cwd(), 'registry'));
    (r as any).bundlesManifest = bad;
    expect(() => (r as any).validateBundles(bad)).toThrow('sidekicks');
  });

  it('should reject unknown planningLoop mode', async () => {
    const bad = {
      version: 1,
      bundles: {
        'bad-bundle': {
          name: 'bad-bundle',
          description: 'bad',
          planningLoop: { enabled: true, mode: 'bogus' },
        },
      },
    };
    const r = new RegistryResolver(path.resolve(process.cwd(), 'registry'));
    (r as any).bundlesManifest = bad;
    expect(() => (r as any).validateBundles(bad)).toThrow('unknown');
  });

  it('should accept planner-orchestrator without budget/sidekicks', () => {
    const good = {
      version: 1,
      bundles: {
        'good-bundle': {
          name: 'good-bundle',
          description: 'good',
          planningLoop: { enabled: true, mode: 'planner-orchestrator' },
        },
      },
    };
    const r = new RegistryResolver(path.resolve(process.cwd(), 'registry'));
    (r as any).bundlesManifest = good;
    expect(() => (r as any).validateBundles(good)).not.toThrow();
  });

  // ── Plan 015 Step 1 / §0/C6 + §0/D2: dynamic rule resolution ──────────────
  describe('dynamic rule resolution (Plan 015)', () => {
    const EXPECTED_RULES = [
      'GEMINI.md',
      'clean-code-and-architecture.md',
      'domain-modeling-and-adr.md',
      'git-guardrails.md',
      'multi-agent-coordination.md',
      'quality-aesthetics-accessibility.md',
      'test-driven-development.md',
    ];

    it('resolves baseline + agent-declared rules for a bundle', async () => {
      const resolved = await resolver.resolve('software-engineering');
      expect(resolved.rules).toContain('GEMINI.md');
      expect(resolved.rules).toContain('git-guardrails.md');
      expect(resolved.rules).toContain('test-driven-development.md');
      expect(resolved.rules).toContain('clean-code-and-architecture.md');
      expect(resolved.rules).toContain('multi-agent-coordination.md');
    });

    it('deduplicates rules and returns them in a deterministic sorted order', async () => {
      const first = await resolver.resolve('software-engineering');
      const second = await resolver.resolve('software-engineering');

      expect(new Set(first.rules).size).toBe(first.rules.length);
      expect(first.rules).toEqual([...first.rules].sort());
      expect(second.rules).toEqual(first.rules);
    });

    it('collects rules from inherited parent-bundle agents (ADR child bundles)', async () => {
      const child = await resolver.resolve('ai-ml-engineering');
      // ai-ml-engineering inherits software-engineering's orchestrator + subagents
      expect(child.agents).toContain('orchestrator-engineering.md');
      expect(child.rules).toContain('git-guardrails.md');
      expect(child.rules).toContain('test-driven-development.md');
    });

    it('unions member-bundle rules in the domain: resolution branch', async () => {
      const domain = await resolver.resolve('domain:engineering');
      expect(domain.rules).toContain('GEMINI.md');
      expect(domain.rules).toContain('git-guardrails.md');
      expect(domain.rules).toEqual([...domain.rules].sort());
    });

    it('returns every rule referenced by agent frontmatter and no unknown rule', async () => {
      const resolved = await resolver.resolve('software-engineering');
      for (const rule of resolved.rules) {
        expect(EXPECTED_RULES).toContain(rule);
      }
      expect(resolved.rules).toEqual(expect.arrayContaining(EXPECTED_RULES));
    });

    it('does not attach rules to standalone single-item resolutions', async () => {
      const agent = await resolver.resolve('orchestrator-engineering');
      expect(agent.rules).toEqual([]);
      const skill = await resolver.resolve('test-driven-development');
      expect(skill.rules).toEqual([]);
    });

    it('reads the rules block sequence only (never an inline array)', () => {
      // Guard against regressing to a `rules: [a, b]` regex assumption.
      const content = fs.readFileSync(
        path.resolve(process.cwd(), 'registry/agents/orchestrator-engineering.md'),
        'utf8'
      );
      expect(content).toMatch(/^rules:\r?\n\s+- git-guardrails\.md/m);
      expect(content).not.toMatch(/^rules:\s*\[/m);
    });

    it('fails fast when a bundle declares a rule file that does not exist (§0/D2)', () => {
      const bad = {
        version: 1,
        bundles: {
          'bad-rules-bundle': {
            name: 'bad-rules-bundle',
            description: 'bad',
            rules: ['definitely-not-a-rule.md'],
          },
        },
      };
      const r = new RegistryResolver(path.resolve(process.cwd(), 'registry'));
      (r as any).bundlesManifest = bad;
      expect(() => (r as any).validateBundles(bad)).toThrow('does not exist in registry/rules/');
    });

    it('accepts a bundle whose declared rules all exist', () => {
      const good = {
        version: 1,
        bundles: {
          'good-rules-bundle': {
            name: 'good-rules-bundle',
            description: 'good',
            rules: ['git-guardrails.md', 'test-driven-development.md'],
          },
        },
      };
      const r = new RegistryResolver(path.resolve(process.cwd(), 'registry'));
      (r as any).bundlesManifest = good;
      expect(() => (r as any).validateBundles(good)).not.toThrow();
    });

    it('confirms the real manifest declares no nonempty bundle-level rules yet (inert branch)', async () => {
      const manifest = await resolver.loadBundles();
      const declaring = Object.values(manifest.bundles).filter(
        (b) => Array.isArray(b.rules) && b.rules.length > 0
      );
      expect(declaring).toEqual([]);
    });
  });
});
