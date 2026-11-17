/** Read-only adapter for the existing shared and Claude-native validation seams. */
import fs from 'node:fs';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import type { FactoryCheckInput, FactoryCheckResult } from './types.js';
import { loadSemanticCore, validateSubagentContract } from './semantic-core.js';
import { checkFloor } from './native-floor.js';
import { inspectNativeAgent, nativeGuardProblem } from './native-guard.js';
import { loadHostProfile, loadToolPolicy, resolveGrant } from './host-profile.js';
import { GUARD_SCRIPT, NATIVE_GUARD_FILES, nativeGuardFileHooks } from './guard.js';
import { READ_ONLY_GUARD_SCRIPT, readOnlyGuardFileHooks } from './readonly-guard.js';
import { RESIDUE_PATTERNS_BY_HOST } from './residue-patterns.js';

const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

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
      if (core.capabilities === undefined) findings.push('Native grant validation needs explicit core capability classes.');
      else {
        const grant = resolveGrant(policy, core.capabilities, { subagent: input.loading !== 'main', background: facts.meta.background === true }).tools;
        if (facts.meta.tools === undefined || !isDeepStrictEqual([...facts.tools].sort(), [...grant].sort())) findings.push('Native tools differ from the class-derived grant.');
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
        const expected = kind === 'read-only' ? readOnlyGuardFileHooks() : nativeGuardFileHooks();
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
