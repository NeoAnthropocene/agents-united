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
import { RESIDUE_PATTERNS_BY_HOST } from './residue-patterns.js';
import { normalizeClaudeFactoryCoordinatorTools } from './claude-factory-declaration.js';
import { canonicalFloorProblems, canonicalServerTools, coverageFileProblems, isLeadRole, nativeToolOrder, nativeToolsWanted, postureProblems, publishingBlockProblems, requestsBlockProblems, sessionTrackingProblems, type NativeKind } from './native-repository-rules.js';

const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

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
      findings.push(...publishingBlockProblems(text, { kind, name: String(facts.meta.name), tools: facts.tools }));
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
        // The generator's own form (ADR 0072): the class grant sorted, then the canonical agent's server tools in its order. The factory's own
        // coordinator must hold exactly its fixed delegate list (the same function as tests/helpers/native-delta.ts); any other delegating role's
        // one well-formed `Agent(...)` allowlist stands for `Agent`.
        const expected = nativeToolOrder(grant, canonicalText === undefined ? [] : canonicalServerTools(canonicalText));
        let wanted = nativeToolsWanted(expected, facts.tools, { coordinator: delegates });
        if (factorySkill === 'coordinate-artifact') {
          try {
            normalizeClaudeFactoryCoordinatorTools(facts.tools);
            wanted = nativeToolsWanted(expected, facts.tools, { coordinator: true });
          } catch (error) { findings.push(error instanceof Error ? error.message : String(error)); }
        }
        if (facts.meta.tools === undefined || !isDeepStrictEqual(facts.tools, wanted)) findings.push(`Native tools differ from the generator's form: expected ${wanted.join(', ')}.`);
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
