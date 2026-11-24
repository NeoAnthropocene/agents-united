/** Read-only adapter for the existing shared and Claude-native validation seams. */
import fs from 'node:fs';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import type { FactoryCheckInput, FactoryCheckResult } from './types.js';
import { loadSemanticCore, validateSubagentContract } from './semantic-core.js';
import { checkFloor } from './native-floor.js';
import { inspectNativeAgent, nativeGuardProblem } from './native-guard.js';
import { loadHostProfile, loadToolPolicy, resolveGrant } from './host-profile.js';
import { GUARD_SCRIPT, NATIVE_GUARD_FILES } from './guard.js';
import { READ_ONLY_GUARD_SCRIPT } from './readonly-guard.js';
import { expectedWorkerHooks } from './handback-check.js';
import { connectorToolsOf, delegateNamesOf, loadPageTypesIfPresent, roleStemResolver, typesOfRole, unknownRosterNames } from './page-types.js';
import { RESIDUE_PATTERNS_BY_HOST } from './residue-patterns.js';
import { normalizeClaudeFactoryCoordinatorTools } from './claude-factory-declaration.js';
import { canonicalFloorProblems, canonicalServerTools, coverageFileProblems, isLeadRole, nativeToolOrder, nativeToolsWanted, postureProblems, publishingBlockProblems, requestsBlockProblems, serverEntryProblems, sessionTrackingProblems, type NativeKind } from './native-repository-rules.js';

const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * The `mcp__` entries that the native files of a lead's roster hold (registry/hosts/claude/agents/<role>.md). A lead's tool pool is cut to its own
 * `tools:` line and a role it starts inherits that pool, so a lead holds the servers of the roles it may start. This is the rule that
 * tests/native-claude-lead-pool.test.ts pins for the committed leads (every server entry of a role a lead may spawn is on the lead's line), applied here
 * to a candidate: the entries of its roster are accepted on its line. A roster name without a native file adds nothing.
 */
function rosterServerEntries(registry: string, roster: readonly string[]): string[] {
  const entries: string[] = [];
  for (const name of roster) {
    const file = path.join(registry, 'hosts', 'claude', 'agents', `${name}.md`);
    if (!ID.test(name) || !fs.existsSync(file)) continue;
    try { for (const tool of inspectNativeAgent(fs.readFileSync(file, 'utf8')).tools) if (tool.startsWith('mcp__') && !entries.includes(tool)) entries.push(tool); } catch { /* an unreadable file adds nothing */ }
  }
  return entries;
}

/** The skill of the agent-factory binding that names `definition` as one of its roles (a worker or the coordinator of the factory), else undefined. */
function factoryBindingSkill(registry: string, definition: string): string | undefined {
  const dir = path.join(registry, 'hosts', 'claude');
  if (!fs.existsSync(dir)) return undefined;
  for (const name of fs.readdirSync(dir).filter(file => /^agent-factory-.*\.binding\.json$/.test(file))) {
    try {
      const binding = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')) as { skill?: string; roles?: Array<{ definition?: string }> };
      if (binding.roles?.some(role => role.definition === definition)) return binding.skill ?? '';
    } catch { /* an unreadable binding names no role */ }
  }
  return undefined;
}

export async function checkFactoryArtifact(input: FactoryCheckInput): Promise<FactoryCheckResult> {
  const findings: string[] = [];
  try {
    if (!path.isAbsolute(input.registryDir)) throw new Error('Source registry must be an absolute path.');
    if (!ID.test(input.definition)) throw new Error('Definition must be a semantic identifier.');
    if (input.host !== 'claude') throw new Error(`Native factory-check adapter unavailable for host ${input.host}.`);
    if (input.loading !== undefined && !['subagent', 'main'].includes(input.loading)) throw new Error('Loading must be subagent or main.');
    const registry = path.resolve(input.registryDir);
    const sourceFile = (rel: string): string => {
      const file = path.resolve(registry, rel);
      const relative = path.relative(registry, file);
      if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new Error(`Source path escapes registry: ${rel}.`);
      if (!fs.existsSync(file) || !fs.statSync(file).isFile()) throw new Error(`Missing required source ${rel}.`);
      for (let current = file; current !== registry; current = path.dirname(current)) {
        if (fs.lstatSync(current).isSymbolicLink()) throw new Error(`Linked source needs a location decision: ${rel}.`);
      }
      return file;
    };
    sourceFile(`core/${input.definition}.core.md`);
    const contractFile = sourceFile(`core/${input.definition}.contract.json`);
    const cores = await loadSemanticCore(registry);
    const contract = validateSubagentContract(JSON.parse(fs.readFileSync(contractFile, 'utf8')) as unknown, cores);
    if (contract.definition !== input.definition) throw new Error('Companion contract definition does not match the requested definition.');
    const core = cores.get(input.definition)!;
    const profile = loadHostProfile(registry, 'claude');
    const policy = loadToolPolicy(registry, 'claude');
    const required = input.requiredSkills ?? [];
    if (!Array.isArray(required) || required.some(id => typeof id !== 'string' || !ID.test(id))) throw new Error('requiredSkills must be an array of semantic identifiers.');
    if (new Set(required).size !== required.length) throw new Error('Duplicate required Skill identifiers.');
    for (const id of required) {
      if (!contract.skills.includes(id)) throw new Error(`Task-required Skill ${id} is not permitted by the contract.`);
      sourceFile(`skills/${id}/SKILL.md`);
    }
    if (input.artifactPath !== undefined) {
      if (!path.isAbsolute(input.artifactPath)) throw new Error('Native artifact must be an absolute path.');
      const text = fs.readFileSync(input.artifactPath, 'utf8');
      const facts = inspectNativeAgent(text);
      for (const key of profile.artifacts.agent.requiredKeys ?? []) {
        if (typeof facts.meta[key] !== 'string' || !String(facts.meta[key]).trim()) findings.push(`Missing required native ${key}.`);
      }
      for (const key of Object.keys(facts.meta)) if (!profile.artifacts.agent.allowedKeys.includes(key)) findings.push(`Unknown native key ${key}.`);
      if (facts.meta.memory !== undefined) findings.push('Implicit memory write grants are unavailable in this bounded native adapter.');
      if (facts.meta.disallowedTools !== undefined) findings.push('Native deny overlays change the class-derived grant; disallowedTools needs a separately reviewed binding.');
      if (facts.meta.name !== path.basename(input.artifactPath, '.md')) findings.push('Native name must match the artifact filename.');
      findings.push(...checkFloor(text, core));
      // The repository's own rules for a native role (ADR 0072): the same functions its conformance tests call.
      let canonicalText: string | undefined;
      const defaultCanonical = path.join(registry, 'agents', `${input.definition}.md`);
      if (input.canonicalFile !== undefined) {
        if (!path.isAbsolute(input.canonicalFile)) findings.push('Canonical agent must be an absolute path.');
        else if (!fs.existsSync(input.canonicalFile) || !fs.statSync(input.canonicalFile).isFile()) findings.push(`Missing canonical agent ${input.canonicalFile}.`);
        else canonicalText = fs.readFileSync(input.canonicalFile, 'utf8');
      } else if (fs.existsSync(defaultCanonical) && fs.statSync(defaultCanonical).isFile()) canonicalText = fs.readFileSync(defaultCanonical, 'utf8');
      // A lead is the coordinator kind (posture, wording of the generated blocks); `delegates` is only whether its tools line may hold an `Agent` allowlist.
      const coordinator = isLeadRole(core, canonicalText);
      const delegates = core.capabilities?.includes('delegate') ?? false;
      const factorySkill = factoryBindingSkill(registry, input.definition);
      const kind: NativeKind = factorySkill !== undefined ? 'factory-worker' : coordinator ? 'coordinator' : 'specialist';
      findings.push(...postureProblems(facts.meta, kind));
      if (core.capabilities?.includes('task-tracking')) findings.push(...sessionTrackingProblems(text, { coordinator }));
      findings.push(...requestsBlockProblems(text, { kind, name: String(facts.meta.name), tools: facts.tools }));
      // ADR 0078: the page types of the role. `coordinator` is the lead kind; the roster check runs for a role that holds an `Agent(...)` roster.
      const pageTypes = loadPageTypesIfPresent(registry, 'claude');
      const stemOfRole = roleStemResolver(registry);
      if (delegates) {
        for (const name of unknownRosterNames(delegateNamesOf(facts.tools), stemOfRole, stem => fs.existsSync(path.join(registry, 'core', `${stem}.core.md`)))) {
          findings.push(`Native page types: the Agent roster of ${String(facts.meta.name)} names ${name}, which stands on no core in the registry.`);
        }
      }
      const types = typesOfRole(pageTypes, { stem: input.definition, coordinator, tools: facts.tools }, stemOfRole);
      findings.push(...publishingBlockProblems(text, { kind, name: String(facts.meta.name), tools: facts.tools, types, catalogue: pageTypes.types }));
      if (canonicalText !== undefined) findings.push(...canonicalFloorProblems(core, canonicalText));
      if (input.coverageFile !== undefined) {
        if (!path.isAbsolute(input.coverageFile)) findings.push('Invariant coverage: the coverage file must be an absolute path.');
        else if (!fs.existsSync(input.coverageFile) || !fs.statSync(input.coverageFile).isFile()) findings.push(`Invariant coverage: missing coverage file ${input.coverageFile}.`);
        else {
          let coverage: unknown;
          try { coverage = JSON.parse(fs.readFileSync(input.coverageFile, 'utf8')) as unknown; } catch { coverage = null; }
          findings.push(...coverageFileProblems(core, text, coverage, { role: path.basename(input.artifactPath, '.md'), definition: input.definition }));
        }
      } else if (kind !== 'factory-worker') findings.push("Invariant coverage needs the candidate's coverage file (--coverage).");
      if (core.capabilities === undefined) findings.push('Native grant validation needs explicit core capability classes.');
      else {
        const grant = resolveGrant(policy, core.capabilities, { subagent: input.loading !== 'main', background: facts.meta.background === true }).tools;
        // The generator's own form (ADR 0072) for what is not a server: the class grant sorted. The factory's own coordinator must hold exactly its
        // fixed delegate list (the same function as tests/helpers/native-delta.ts); any other delegating role's one well-formed `Agent(...)` allowlist
        // stands for `Agent`. The server entries are compared as the repository's tests do, without regard to order (serverEntryProblems): the canonical
        // servers whole or per read-only tool, alone or with their routes; the connector tools of the page types (ADR 0078); and, for a lead, the entries of
        // the roles of its roster.
        const servers = canonicalText === undefined ? [] : canonicalServerTools(canonicalText);
        const expected = nativeToolOrder(grant, []);
        const held = facts.tools.filter(tool => !tool.startsWith('mcp__'));
        let wanted = nativeToolsWanted(expected, held, { coordinator: delegates });
        if (factorySkill === 'coordinate-artifact') {
          try {
            normalizeClaudeFactoryCoordinatorTools(facts.tools);
            wanted = nativeToolsWanted(expected, held, { coordinator: true });
          } catch (error) { findings.push(error instanceof Error ? error.message : String(error)); }
        }
        const required = connectorToolsOf(types);
        if (facts.meta.tools === undefined || !isDeepStrictEqual(held, wanted)) findings.push(`Native tools differ from the generator's form: expected ${[...wanted, ...servers, ...required].join(', ')}.`);
        for (const problem of serverEntryProblems(facts.tools, servers, { required, allowed: coordinator ? rosterServerEntries(registry, delegateNamesOf(facts.tools)) : [] })) findings.push(`Native tools differ from the generator's form: ${problem}.`);
      }
      const preloads: unknown = facts.meta.skills ?? [];
      if (!Array.isArray(preloads) || preloads.some(id => typeof id !== 'string' || !ID.test(id))) findings.push('Native Skill preloads must be semantic identifiers.');
      else {
        if (new Set(preloads).size !== preloads.length) findings.push('Duplicate native Skill preloads.');
        for (const id of preloads as string[]) {
          if (!contract.skills.includes(id)) findings.push(`Native preload ${id} is not permitted by the contract.`);
          else sourceFile(`skills/${id}/SKILL.md`);
        }
        for (const id of required) if (!preloads.includes(id)) findings.push(`Missing task-required Skill preload ${id}.`);
      }
      const guardProblem = nativeGuardProblem(facts);
      if (guardProblem) findings.push(`Native guard ${guardProblem}.`);
      if (facts.guard !== 'none') {
        const kind = facts.guard;
        // The guard, and for the factory evaluator (by name) the hand-back entry after it (ADR 0070); any other role with an extra entry is refused.
        const expected = expectedWorkerHooks(String(facts.meta.name), kind);
        if (!isDeepStrictEqual(facts.meta.hooks, expected)) findings.push('Native guard registration differs from its reviewed binding; additional hook registrations are unavailable in this adapter.');
        const script = sourceFile(`hosts/claude/hooks/${NATIVE_GUARD_FILES[kind].name}.js`);
        const reviewed = kind === 'read-only' ? READ_ONLY_GUARD_SCRIPT : GUARD_SCRIPT;
        if (fs.readFileSync(script, 'utf8').replace(/\r\n/g, '\n').trimEnd() !== reviewed.trimEnd()) findings.push('Native guard source differs from its reviewed script.');
      }
      for (const pattern of RESIDUE_PATTERNS_BY_HOST.claude ?? []) if (pattern.test(text)) findings.push(`Native residue: ${String(pattern)}.`);
    }
  } catch (error) {
    findings.push(error instanceof Error ? error.message : String(error));
  }
  return { ok: findings.length === 0, kind: 'deterministic', findings, quality: 'pending', live: 'unverified' };
}
