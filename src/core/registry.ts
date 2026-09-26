import path from 'node:path';
import fs from 'fs-extra';
import yaml from 'yaml';
import { fileURLToPath } from 'node:url';
import type { BundlesManifest, BundleDefinition, ResolvedAssets, SearchOptions, SearchResults, PlanningLoopMode } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class RegistryResolver {
  /**
   * Host entrypoint rules (Plan 015 §0/C7). `GEMINI.md` is always resolved so
   * Antigravity-family hosts keep their entrypoint; it is never declared in an
   * agent's frontmatter.
   */
  private static readonly BASELINE_RULES = ['GEMINI.md'];

  private registryDir: string;
  private bundlesManifest: BundlesManifest | null = null;
  /** Memoized agent file -> declared rules (Plan 015 §0/C6). */
  private agentRuleCache = new Map<string, string[]>();

  constructor(customRegistryDir?: string) {
    if (customRegistryDir) {
      this.registryDir = path.resolve(customRegistryDir);
    } else {
      // Check candidate paths for registry folder
      const candidatePaths = [
        path.resolve(__dirname, '../registry'),
        path.resolve(__dirname, '../../registry'),
        path.resolve(process.cwd(), 'registry'),
      ];

      const found = candidatePaths.find(p => fs.existsSync(path.join(p, 'bundles.json')));
      this.registryDir = found || candidatePaths[0];
    }
  }

  public getRegistryDir(): string {
    return this.registryDir;
  }

  public async loadBundles(): Promise<BundlesManifest> {
    if (this.bundlesManifest) {
      return this.bundlesManifest;
    }

    const manifestPath = path.join(this.registryDir, 'bundles.json');
    if (!await fs.pathExists(manifestPath)) {
      throw new Error(`Registry bundles.json not found at ${manifestPath}`);
    }

    this.bundlesManifest = await fs.readJson(manifestPath);
    this.validateBundles(this.bundlesManifest!);
    return this.bundlesManifest!;
  }

  public async getBundle(bundleName: string): Promise<BundleDefinition | null> {
    const manifest = await this.loadBundles();
    if (manifest.bundles[bundleName]) {
      return manifest.bundles[bundleName];
    }
    const found = Object.values(manifest.bundles).find(
      b => b.aliases?.includes(bundleName)
    );
    return found || null;
  }

  public async listBundles(): Promise<BundleDefinition[]> {
    const manifest = await this.loadBundles();
    return Object.values(manifest.bundles);
  }

  public async getBundlesByDomain(domain: string): Promise<BundleDefinition[]> {
    const manifest = await this.loadBundles();
    const d = domain.toLowerCase();
    return Object.values(manifest.bundles).filter(b => b.domain?.toLowerCase() === d);
  }

  public async resolve(identifier: string): Promise<ResolvedAssets> {
    // Check if identifier refers to an entire department domain (e.g. "domain:engineering")
    if (identifier.startsWith('domain:')) {
      const domainName = identifier.replace(/^domain:/, '').toLowerCase();
      const domainBundles = await this.getBundlesByDomain(domainName);
      if (domainBundles.length > 0) {
        const agents = new Set<string>();
        const skills = new Set<string>();
        const workflows = new Set<string>();
        const rules = new Set<string>(RegistryResolver.BASELINE_RULES);

        for (const b of domainBundles) {
          const resolved = await this.resolve(b.name);
          resolved.agents.forEach(a => agents.add(a));
          resolved.skills.forEach(s => skills.add(s));
          resolved.workflows.forEach(w => workflows.add(w));
          resolved.rules.forEach(r => rules.add(r));
        }

        return {
          targetBundle: `domain:${domainName}`,
          agents: Array.from(agents),
          skills: Array.from(skills),
          workflows: Array.from(workflows),
          rules: Array.from(rules).sort(),
        };
      }
    }

    const bundle = await this.getBundle(identifier);

    if (bundle) {
      const agents = new Set<string>();
      const skills = new Set<string>(bundle.skills || []);
      const workflows = new Set<string>(bundle.workflows || []);
      const rules = new Set<string>(RegistryResolver.BASELINE_RULES);

      // Forward-compatible only: no bundle in registry/bundles.json declares
      // `rules` today (verified: 0 occurrences); the type allows it (types.ts:369).
      (bundle.rules || []).forEach(r => rules.add(r));

      if (bundle.parentBundle) {
        const parent = await this.getBundle(bundle.parentBundle);
        if (parent) {
          if (parent.orchestrator) agents.add(parent.orchestrator);
          if (parent.agents) parent.agents.forEach(a => agents.add(a));
          if (parent.skills) parent.skills.forEach(s => skills.add(s));
          if (parent.workflows) parent.workflows.forEach(w => workflows.add(w));
          (parent.rules || []).forEach(r => rules.add(r));
        }
      }

      if (bundle.orchestrator) agents.add(bundle.orchestrator);
      if (bundle.agents) bundle.agents.forEach(a => agents.add(a));

      // Plan 015 §0/C6 — agent frontmatter `rules:` bindings are the single
      // source of truth and were previously ignored entirely. Collect them from
      // the orchestrator, every subagent, and the inherited parent's agents so
      // `resolved.agents` and `resolved.rules` can never disagree.
      for (const agentFile of agents) {
        for (const rule of await this.extractRulesFromAgent(agentFile)) {
          rules.add(rule);
        }
      }

      // Plan 015 §0/D2 — fail fast instead of letting installer.ts silently skip
      // a rule file that does not exist under registry/rules/.
      const sortedRules = Array.from(rules).sort();
      this.assertRulesExist(sortedRules, `bundle "${bundle.name}"`);

      return {
        targetBundle: bundle.name,
        agents: Array.from(agents),
        skills: Array.from(skills),
        workflows: Array.from(workflows),
        rules: sortedRules,
      };
    }

    // Check if identifier refers to a specific single item (agent, skill, or workflow)
    const agentPath = path.join(this.registryDir, 'agents', identifier.endsWith('.md') ? identifier : `${identifier}.md`);
    if (await fs.pathExists(agentPath)) {
      return {
        agents: [path.basename(agentPath)],
        skills: [],
        workflows: [],
        rules: [],
      };
    }

    const sanitizedSkillId = identifier.replace(/\.md$/, '').replace(/--/g, '-');
    const skillPath = path.join(this.registryDir, 'skills', identifier);
    const sanitizedSkillPath = path.join(this.registryDir, 'skills', sanitizedSkillId);
    if (await fs.pathExists(skillPath)) {
      return {
        agents: [],
        skills: [identifier],
        workflows: [],
        rules: [],
      };
    } else if (await fs.pathExists(sanitizedSkillPath)) {
      return {
        agents: [],
        skills: [sanitizedSkillId],
        workflows: [],
        rules: [],
      };
    }

    const workflowSkillPath = path.join(this.registryDir, 'skills', `workflow-${sanitizedSkillId}`);
    if (await fs.pathExists(workflowSkillPath)) {
      return {
        agents: [],
        skills: [`workflow-${sanitizedSkillId}`],
        workflows: [],
        rules: [],
      };
    }

    // Legacy fallback check for standalone workflow file if present
    const workflowFileName = identifier.startsWith('workflow-') ? `${identifier}.md` : `workflow-${identifier}.md`;
    const workflowPath = path.join(this.registryDir, 'workflows', workflowFileName);
    if (await fs.pathExists(workflowPath)) {
      return {
        agents: [],
        skills: [],
        workflows: [path.basename(workflowPath)],
        rules: [],
      };
    }

    throw new Error(`Item or bundle "${identifier}" not found in registry.`);
  }

  public async find(query: string = '', options?: SearchOptions): Promise<SearchResults> {
    const manifest = await this.loadBundles();
    const q = query.trim().toLowerCase();

    let matchedBundles: BundleDefinition[] = [];
    if (!options?.type || options.type === 'bundle') {
      matchedBundles = Object.values(manifest.bundles).filter(b => {
        if (options?.domain && b.domain?.toLowerCase() !== options.domain.toLowerCase()) {
          return false;
        }
        if (!q) return true;
        return (
          b.name.toLowerCase().includes(q) ||
          b.description.toLowerCase().includes(q) ||
          b.category?.toLowerCase().includes(q) ||
          b.domain?.toLowerCase().includes(q) ||
          b.aliases?.some(a => a.toLowerCase().includes(q))
        );
      });
    }

    const agentsDir = path.join(this.registryDir, 'agents');
    let matchedAgents: string[] = [];
    if (!options?.type || options.type === 'agent') {
      if (await fs.pathExists(agentsDir)) {
        const files = await fs.readdir(agentsDir);
        matchedAgents = files.filter(f => {
          if (!q) return true;
          return f.toLowerCase().includes(q);
        });
      }
    }

    const skillsDir = path.join(this.registryDir, 'skills');
    let matchedSkills: string[] = [];
    if (!options?.type || options.type === 'skill' || options.type === 'workflow') {
      if (await fs.pathExists(skillsDir)) {
        const dirs = await fs.readdir(skillsDir);
        matchedSkills = dirs.filter(d => {
          if (!q) return true;
          return d.toLowerCase().includes(q);
        });
      }
    }

    // Support workflow search: matches skills with workflow- prefix or any legacy workflows folder
    let matchedWorkflows: string[] = [];
    if (!options?.type || options.type === 'workflow') {
      matchedWorkflows = matchedSkills.filter(s => s.startsWith('workflow-'));
      const workflowsDir = path.join(this.registryDir, 'workflows');
      if (await fs.pathExists(workflowsDir)) {
        const files = await fs.readdir(workflowsDir);
        const legacyMatches = files.filter(f => f.endsWith('.md')).filter(f => {
          if (!q) return true;
          return f.toLowerCase().includes(q);
        });
        legacyMatches.forEach(f => {
          if (!matchedWorkflows.includes(f)) matchedWorkflows.push(f);
        });
      }
    }

    return {
      bundles: matchedBundles,
      agents: matchedAgents,
      skills: matchedSkills,
      workflows: matchedWorkflows,
    };
  }

  /**
   * Plan 015 Step 1 / §0/C6 — extract the `rules:` binding from an agent's YAML
   * frontmatter. Rules are declared as a BLOCK SEQUENCE:
   *   rules:
   *     - git-guardrails.md
   * Never regex for an inline `rules: [a, b]`. Returns `[]` (never throws) when
   * the file is missing, has no frontmatter, or the YAML is unparsable so that
   * resolution stays resilient; existence of the referenced rule files is
   * enforced separately by `assertRulesExist`.
   */
  private async extractRulesFromAgent(agentFileName: string): Promise<string[]> {
    const cached = this.agentRuleCache.get(agentFileName);
    if (cached) {
      return cached;
    }

    let declared: string[] = [];
    const agentPath = path.join(this.registryDir, 'agents', agentFileName);
    if (await fs.pathExists(agentPath)) {
      const content = await fs.readFile(agentPath, 'utf8');
      const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      if (match) {
        try {
          const meta = (yaml.parse(match[1]) as { rules?: unknown } | null) ?? {};
          if (Array.isArray(meta.rules)) {
            declared = meta.rules.filter((r): r is string => typeof r === 'string');
          }
        } catch {
          declared = [];
        }
      }
    }

    this.agentRuleCache.set(agentFileName, declared);
    return declared;
  }

  /**
   * Plan 015 §0/D2 — a declared rule binding that cannot be satisfied is a
   * configuration defect, not something to skip silently: installer.ts guards
   * its copy loop with `pathExists`, so a typo would otherwise deploy no rule at
   * all with no error surfaced anywhere.
   */
  private assertRulesExist(rules: string[], context: string): void {
    for (const rule of rules) {
      if (!fs.existsSync(path.join(this.registryDir, 'rules', rule))) {
        throw new Error(
          `Registry validation error: ${context} references rule "${rule}" which does not exist in registry/rules/.`
        );
      }
    }
  }

  /**
   * ADR 0015 — fail-fast validation of planningLoop configuration.
   * @throws if any bundle violates planner-orchestrator invariants.
   */
  private validateBundles(manifest: BundlesManifest): void {
    const validModes: string[] = ['subagent-first', 'planner-orchestrator'];

    for (const [name, bundle] of Object.entries(manifest.bundles)) {
      // Plan 015 §0/D2 — declared rule bindings must resolve on disk.
      if (Array.isArray(bundle.rules)) {
        for (const rule of bundle.rules) {
          if (!fs.existsSync(path.join(this.registryDir, 'rules', rule))) {
            throw new Error(
              `Registry validation error: bundle "${name}" references rule "${rule}" which does not exist in registry/rules/.`
            );
          }
        }
      }

      const pl = bundle.planningLoop;
      if (!pl || !pl.enabled) continue;               // no planning → skip

      // resolve mode: absent → subagent-first (ADR 0014 backward compat)
      const mode: string = pl.mode ?? 'subagent-first';

      if (!validModes.includes(mode)) {
        throw new Error(
          `Registry validation error: bundle "${name}" has unknown planningLoop.mode "${mode}". ` +
          `Valid modes: ${validModes.join(', ')}`
        );
      }

      // Plan 022 H1 (owner decision 2026-09-25): iteration caps are Tier-2-only. Only an
      // organization-tier coordinator may carry a Consultation Budget (rendered as maxTurns);
      // Tier-1 domain agents stay uncapped.
      if (pl.budget) {
        if (bundle.tier !== 'organization') {
          throw new Error(
            `Registry validation error: bundle "${name}" declares a Consultation Budget but is not an organization-tier bundle. ` +
            'Iteration caps (planningLoop.budget.maxIterations) are Tier-2-only.'
          );
        }
        const cap = pl.budget.maxIterations;
        if (!Number.isInteger(cap) || cap < 1) {
          throw new Error(
            `Registry validation error: bundle "${name}" has planningLoop.budget.maxIterations ${String(cap)}; expected a positive integer.`
          );
        }
      }

      if (mode === 'planner-orchestrator') {
        if (pl.budget) {
          throw new Error(
            `Registry validation error: bundle "${name}" has planningLoop.mode "planner-orchestrator" ` +
            'but also declares a Consultation Budget (budget). Planner-orchestrator bundles must not declare budget.'
          );
        }
        if (pl.sidekicks) {
          throw new Error(
            `Registry validation error: bundle "${name}" has planningLoop.mode "planner-orchestrator" ` +
            'but also declares sidekicks. Planner-orchestrator bundles must not declare sidekicks.'
          );
        }
      }
    }
  }
}

/**
 * Plan 021 (ADR 0021 decision 9) — loads the Declared-Delta Registry
 * (`registry/translation-ledger.json`, the Translation Ledger repurposed: dispositions now
 * classify host-native deltas above the Contract Floor). Fail-fast: an entry without a valid
 * classification (`mapped|approximated|degraded|unsupported`) or without a rationale throws.
 */
export function loadTranslationLedger(
  registryDir = 'registry',
): import('./types.js').TranslationLedgerEntry[] {
  const ledgerPath = path.join(registryDir, 'translation-ledger.json');
  const parsed: unknown = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));
  // Accept both the seed shape ({ semantics, entries }) and a bare entries array (fixtures).
  const entries = Array.isArray(parsed) ? parsed : (parsed as { entries?: unknown }).entries;
  if (!Array.isArray(entries)) {
    throw new Error(`Declared-Delta Registry error: ${ledgerPath} must be a JSON array of entries or carry an "entries" array.`);
  }
  const validDispositions = new Set(['mapped', 'approximated', 'degraded', 'unsupported']);
  return entries.map((raw, index) => {
    const entry = raw as Record<string, unknown>;
    const feature = entry.feature;
    const host = entry.host;
    const disposition = entry.disposition;
    const rationale = entry.rationale;
    if (typeof feature !== 'string' || feature.trim() === '') {
      throw new Error(`Declared-Delta Registry error: entries[${index}] needs a non-empty feature.`);
    }
    if (typeof host !== 'string' || host.trim() === '') {
      throw new Error(`Declared-Delta Registry error: entries[${index}] ("${feature}") needs a non-empty host.`);
    }
    if (typeof disposition !== 'string' || !validDispositions.has(disposition)) {
      throw new Error(
        `Declared-Delta Registry error: entries[${index}] ("${feature}") needs disposition mapped|approximated|degraded|unsupported.`,
      );
    }
    if (typeof rationale !== 'string' || rationale.trim() === '') {
      throw new Error(`Declared-Delta Registry error: entries[${index}] ("${feature}") needs a rationale.`);
    }
    return { feature, host, disposition, rationale } as import('./types.js').TranslationLedgerEntry;
  });
}
