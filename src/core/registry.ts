import path from 'node:path';
import fs from 'fs-extra';
import yaml from 'yaml';
import { fileURLToPath } from 'node:url';
import type { BundlesManifest, BundleDefinition, ResolvedAssets, SearchOptions, SearchResults, PlanningLoopMode } from './types.js';
import { isEmptyContributorBundle } from './types.js';
import { validateBundleHostAvailability } from './bundle-host-availability.js';
import { inspectNativeAgent } from './native-guard.js';
import { listNativeWorkflows, nativeRoleSource } from './native-package.js';

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

    const manifest: BundlesManifest = await fs.readJson(manifestPath);
    this.validateBundles(manifest);
    this.bundlesManifest = manifest;
    return manifest;
  }

  public async getBundle(bundleName: string): Promise<BundleDefinition | null> {
    const manifest = await this.loadBundles();
    if (manifest.bundles[bundleName]) {
      return RegistryResolver.withInheritedOptionalMcps(manifest.bundles[bundleName], manifest);
    }
    const found = Object.values(manifest.bundles).find(
      b => b.aliases?.includes(bundleName)
    );
    return found ? RegistryResolver.withInheritedOptionalMcps(found, manifest) : null;
  }

  /**
   * ADR 0079 - one rule for the optional MCP servers of a bundle: its own entries marked `optional: true` and those of the bundles it extends through `parentBundle`, the nearest
   * entry of a name winning. A required entry of a parent is never taken. The doctor and the install panel read a bundle through `getBundle`, so a bundle that extends another holds
   * the roles of its parent and no longer warns about a server that the parent lists as an optional extra. Nothing is copied into `bundles.json`.
   */
  private static withInheritedOptionalMcps(bundle: BundleDefinition, manifest: BundlesManifest, seen: ReadonlySet<string> = new Set()): BundleDefinition {
    if (!bundle.parentBundle || seen.has(bundle.name)) return bundle;
    const parentKey = bundle.parentBundle;
    const parent = manifest.bundles[parentKey] ?? Object.values(manifest.bundles).find(candidate => candidate.aliases?.includes(parentKey));
    if (!parent) return bundle;
    const effective = RegistryResolver.withInheritedOptionalMcps(parent, manifest, new Set([...seen, bundle.name]));
    const own = bundle.prerequisites?.requiredMcps ?? [];
    const named = new Set(own.map(mcp => mcp.name.toLowerCase()));
    const inherited = (effective.prerequisites?.requiredMcps ?? []).filter(mcp => mcp.optional === true && !named.has(mcp.name.toLowerCase()));
    if (inherited.length === 0) return bundle;
    return { ...bundle, prerequisites: { ...(bundle.prerequisites ?? {}), requiredMcps: [...own, ...inherited.map(mcp => ({ ...mcp }))] } };
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
      if (domainName === 'contributor') {
        throw new Error('domain:contributor is not an end-user department; inspect and select a named contributor bundle explicitly.');
      }
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
      if (isEmptyContributorBundle(bundle)) {
        throw new Error(`Bundle "${bundle.name}" is an unavailable empty contributor shell; contributor tooling is under construction.`);
      }
      const agents = new Set<string>();
      const skills = new Set<string>(bundle.skills || []);
      const workflows = new Set<string>(bundle.workflows || []);
      const rules = new Set<string>(RegistryResolver.BASELINE_RULES);

      // Bundle rules complement agent-frontmatter bindings. The contributor factory
      // declares its on-demand attribution rule at bundle level.
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
    // Plan 033 P20: the rules moved into collectBundleManifestIssues; the first collected problem is the one thrown here, as before.
    const issues = collectBundleManifestIssues(manifest, this.registryDir);
    if (issues.length > 0) throw new Error(issues[0]);
  }
}

/** What the native role of a lead says about the `Workflow` tool: no native role file, a file that lacks it, or a file that lists it. */
export type NativeLeadState = 'absent' | 'lacks' | 'holds';

/** What `registry/hosts/claude/agents/<role>.md` says about the `Workflow` tool. */
export function nativeLeadState(registryDir: string, role: string): NativeLeadState {
  const source = nativeRoleSource(registryDir, 'claude', role);
  if (source === undefined) return 'absent';
  return inspectNativeAgent(fs.readFileSync(source, 'utf8')).tools.includes('Workflow') ? 'holds' : 'lacks';
}

/**
 * The lead a bundle needs when it resolves a skill that has a native Claude workflow, or `undefined` when it needs none (no such skill, or no
 * lead). The skills are the bundle's own and its parent's; the lead file is the bundle's `orchestrator`, else its parent's (truthiness, as
 * `resolve` and the projector read it); the role name is the `nativeRoles` mapping of the bundle when it is a plain object that has the lead
 * file as an own key with a string value, else the default name of the file. The parent is found by name or alias.
 */
export function nativeWorkflowLead(
  bundle: BundleDefinition, bundles: Record<string, BundleDefinition>, nativeWorkflows: ReadonlySet<string>,
): { skills: string[]; leadFile: string; leadRole: string } | undefined {
  if (nativeWorkflows.size === 0) return undefined;
  const parentKey = bundle.parentBundle;
  const parent = typeof parentKey !== 'string' ? undefined
    : Object.hasOwn(bundles, parentKey) ? bundles[parentKey]
      : Object.values(bundles).find(candidate => Array.isArray(candidate.aliases) && candidate.aliases.includes(parentKey));
  const listed = (value: unknown): string[] => (Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []);
  const skills = [...new Set([...listed(bundle.skills), ...listed(parent?.skills)])].filter(skill => nativeWorkflows.has(skill));
  const leadFile = bundle.orchestrator || parent?.orchestrator;
  if (skills.length === 0 || typeof leadFile !== 'string' || leadFile === '') return undefined;
  const roles = bundle.nativeRoles as unknown;
  const mapped = roles !== null && typeof roles === 'object' && !Array.isArray(roles) && Object.hasOwn(roles, leadFile)
    ? (roles as Record<string, unknown>)[leadFile]
    : undefined;
  const leadRole = typeof mapped === 'string' ? mapped : leadFile.replace(/\.md$/i, '').replace(/^subagent-/, '');
  return { skills, leadFile, leadRole };
}

/**
 * ADR 0015 — the manifest rules of `RegistryResolver.validateBundles`, collected instead of thrown at the first problem (Plan 033 P20,
 * so `agents bundle-check` can report every problem of a merged manifest). The problems come in the order the first-throw code met them,
 * so `issues[0]` is exactly the message `validateBundles` has always thrown. A malformed manifest that made the old code crash before any
 * problem was found still throws that same raw error; once a problem has been collected, a crash on a malformed later part is not
 * raised, because the old code would have stopped at the problem already found.
 */
export function collectBundleManifestIssues(manifest: BundlesManifest, registryDir: string, options: { unresolvedLeadsAllowedFor?: ReadonlySet<string> } = {}): string[] {
  const issues: string[] = [];
  const validModes: string[] = ['subagent-first', 'planner-orchestrator'];

  // Plan 033: full is an explicit end-user inventory. A contributor declaration
  // does not remove an asset also declared by an ordinary bundle.
  const bundles = Object.values(manifest.bundles);
  const contributors = bundles.filter(bundle => bundle.domain?.toLowerCase() === 'contributor');
  const ordinary = bundles.filter(bundle => bundle.domain?.toLowerCase() !== 'contributor' && bundle.name !== 'full');
  const full = manifest.bundles.full;
  try {
    if (full) {
      const assetKinds = ['agents', 'skills', 'workflows', 'rules'] as const;
      for (const kind of assetKinds) {
        const declared = (bundle: BundleDefinition): string[] => kind === 'agents'
          ? [...(bundle.orchestrator ? [bundle.orchestrator] : []), ...(bundle.agents ?? [])]
          : bundle[kind] ?? [];
        const exclusive = new Set(contributors.flatMap(declared));
        for (const asset of ordinary.flatMap(declared)) exclusive.delete(asset);
        for (const asset of declared(full)) {
          if (exclusive.has(asset)) {
            issues.push(`Registry validation error: full includes contributor-only ${kind} "${asset}".`);
          }
        }
      }
    }
  } catch (error) {
    if (issues.length === 0) throw error;
  }

  const nativeClaudeWorkflows = new Set(listNativeWorkflows(registryDir, 'claude'));
  const leadStates = new Map<string, NativeLeadState>();
  const inspect = (name: string, bundle: BundleDefinition): void => {
    try {
      validateBundleHostAvailability(bundle);
    } catch (error) {
      // Only the rule's own message is a collected problem; any other error is a crash and keeps today's behaviour.
      if (!(error instanceof Error) || !error.message.startsWith('Registry validation error: ')) throw error;
      issues.push(error.message);
    }
    if (bundle.name === 'agent-factory' && !isEmptyContributorBundle(bundle) && bundle.hostAvailability === undefined) {
      issues.push('Registry validation error: populated agent-factory requires hostAvailability for its reviewed delivery.');
    }
    if (bundle.domain?.toLowerCase() !== 'contributor') {
      const referencedBundle = (identifier: string): BundleDefinition | undefined => manifest.bundles[identifier]
        ?? bundles.find(candidate => candidate.aliases?.includes(identifier));
      const parent = bundle.parentBundle ? referencedBundle(bundle.parentBundle) : undefined;
      if (parent?.domain?.toLowerCase() === 'contributor') {
        issues.push(`Registry validation error: ordinary bundle "${name}" cannot inherit contributor bundle "${parent.name}".`);
      }
      for (const identifier of bundle.recommendedAddons ?? []) {
        if (identifier.startsWith('domain:') && identifier.slice('domain:'.length).toLowerCase() === 'contributor') {
          issues.push(`Registry validation error: ordinary bundle "${name}" cannot recommend contributor department "${identifier}".`);
        }
        const addon = referencedBundle(identifier);
        if (addon?.domain?.toLowerCase() === 'contributor') {
          issues.push(`Registry validation error: ordinary bundle "${name}" cannot recommend contributor bundle "${addon.name}".`);
        }
      }
    }
    // Plan 015 §0/D2 — declared rule bindings must resolve on disk.
    if (Array.isArray(bundle.rules)) {
      for (const rule of bundle.rules) {
        if (!fs.existsSync(path.join(registryDir, 'rules', rule))) {
          issues.push(`Registry validation error: bundle "${name}" references rule "${rule}" which does not exist in registry/rules/.`);
        }
      }
    }

    // ADR 0036 — a bundle-scoped native role name must name one of the bundle's own agents, be a role name, and be unique.
    if (bundle.nativeRoles !== undefined) {
      const roles = bundle.nativeRoles as unknown;
      if (roles === null || typeof roles !== 'object' || Array.isArray(roles)) {
        issues.push(`Registry validation error: bundle "${name}" nativeRoles must be an object mapping an agent file to a native role name.`);
      } else {
        const defaults = new Map((bundle.agents ?? []).map(file => [file, file.replace(/\.md$/i, '').replace(/^subagent-/, '')]));
        const seen = new Set<string>();
        for (const [file, role] of Object.entries(roles as Record<string, unknown>)) {
          if (!defaults.has(file)) {
            issues.push(`Registry validation error: bundle "${name}" nativeRoles key "${file}" is not one of its agents.`);
          }
          if (typeof role !== 'string' || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(role)) {
            issues.push(`Registry validation error: bundle "${name}" nativeRoles value ${JSON.stringify(role)} for "${file}" is not a valid role name (lowercase letters, digits and hyphens).`);
            continue;
          }
          if (seen.has(role)) {
            issues.push(`Registry validation error: bundle "${name}" maps more than one agent to the native role "${role}".`);
          }
          seen.add(role);
          const clash = [...defaults.entries()].find(([other, otherRole]) => other !== file && otherRole === role);
          if (clash) {
            issues.push(`Registry validation error: bundle "${name}" native role "${role}" for "${file}" collides with the default role name of "${clash[0]}".`);
          }
        }
      }
    }

    // A native Claude workflow stands in for the skill of the same name, and a saved workflow runs only through the `Workflow` tool, which
    // the host gives to the main session alone and only when its role lists it. So a bundle that resolves such a skill needs a lead that is
    // a native role listing `Workflow`. A bundle with no lead at all (no orchestrator of its own or of its parent) is exempt: it is used from
    // a plain session, which holds `Workflow`, and the user runs `/<name>` there.
    const lead = nativeWorkflowLead(bundle, manifest.bundles, nativeClaudeWorkflows);
    // `agents bundle-check --allow-unresolved` passes the proposal's own Bundles: a lead one of them names but the registry does not have yet is
    // not judged. Every other Bundle, including an existing one that inherits a workflow skill from the proposal, is judged as always.
    const unresolvedLead = lead !== undefined && options.unresolvedLeadsAllowedFor?.has(name) === true && !fs.existsSync(path.join(registryDir, 'agents', lead.leadFile));
    if (lead !== undefined && !unresolvedLead) {
      if (leadStates.get(lead.leadRole) === undefined) leadStates.set(lead.leadRole, nativeLeadState(registryDir, lead.leadRole));
      if (leadStates.get(lead.leadRole) !== 'holds') {
        const many = lead.skills.length > 1;
        issues.push(
          `Registry validation error: bundle "${name}" resolves the skill${many ? 's' : ''} ${lead.skills.map(skill => `"${skill}"`).join(', ')}, which ${many ? 'native Claude workflows replace' : 'a native Claude workflow replaces'}, ` +
          `so its lead "${lead.leadRole}" must be a native role (registry/hosts/claude/agents/${lead.leadRole}.md) that lists the Workflow tool.`
        );
      }
    }

    const pl = bundle.planningLoop;
    if (!pl || !pl.enabled) return;               // no planning → skip

    // resolve mode: absent → subagent-first (ADR 0014 backward compat)
    const mode: string = pl.mode ?? 'subagent-first';

    if (!validModes.includes(mode)) {
      issues.push(
        `Registry validation error: bundle "${name}" has unknown planningLoop.mode "${mode}". ` +
        `Valid modes: ${validModes.join(', ')}`
      );
    }

    // Plan 022 H1 (owner decision 2026-09-25): iteration caps are Tier-2-only. Only an
    // organization-tier coordinator may carry a Consultation Budget (rendered as maxTurns);
    // Tier-1 domain agents stay uncapped.
    if (pl.budget) {
      if (bundle.tier !== 'organization') {
        issues.push(
          `Registry validation error: bundle "${name}" declares a Consultation Budget but is not an organization-tier bundle. ` +
          'Iteration caps (planningLoop.budget.maxIterations) are Tier-2-only.'
        );
      }
      const cap = pl.budget.maxIterations;
      if (!Number.isInteger(cap) || cap < 1) {
        issues.push(
          `Registry validation error: bundle "${name}" has planningLoop.budget.maxIterations ${String(cap)}; expected a positive integer.`
        );
      }
    }

    if (mode === 'planner-orchestrator') {
      if (pl.budget) {
        issues.push(
          `Registry validation error: bundle "${name}" has planningLoop.mode "planner-orchestrator" ` +
          'but also declares a Consultation Budget (budget). Planner-orchestrator bundles must not declare budget.'
        );
      }
      if (pl.sidekicks) {
        issues.push(
          `Registry validation error: bundle "${name}" has planningLoop.mode "planner-orchestrator" ` +
          'but also declares sidekicks. Planner-orchestrator bundles must not declare sidekicks.'
        );
      }
    }
  };

  for (const [name, bundle] of Object.entries(manifest.bundles)) {
    try {
      inspect(name, bundle);
    } catch (error) {
      if (issues.length === 0) throw error;
    }
  }
  return issues;
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
