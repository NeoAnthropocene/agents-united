/**
 * Plan 021 (ADR 0021) / Step 2 — Semantic Core: schema validation, forbidden-token corpus
 * scanning, `registry/core/*.core.md` loading, Contract Floor validation, and declared-delta
 * conformance. The Semantic Core is tool-free (ADR 0021 decision 1): nothing in a core file
 * may name a host tool, host command, or host caveat — enforced here at load and in CI.
 */
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'yaml';
import type { DeclaredDelta, SemanticCore, ValidateDeclaredDeltasInput } from './types.js';

/**
 * Gate 2's corpus: the 18 canonical tool tokens + the 3 command tokens (Plan 020 note 7) +
 * the 4 Plan-019 residue patterns. Exactly 25 entries; matching is case-sensitive substring
 * containment (conservative lint: a false positive is a reword, never a leak).
 */
export const FORBIDDEN_TOKEN_CORPUS: readonly string[] = [
  'view_file',
  'write_to_file',
  'replace_file_content',
  'multi_replace_file_content',
  'run_command',
  'grep_search',
  'find_by_name',
  'list_dir',
  'ask_question',
  'invoke_subagent',
  'define_subagent',
  'manage_subagents',
  'send_message',
  'schedule',
  'manage_task',
  'search_web',
  'read_url_content',
  'generate_image',
  'team_command',
  'deep_planning_command',
  'interview_command',
  'Nested Subagent Delegation',
  'Host Routing',
  'language_server',
  'Cline & CLI',
];

const VALID_DISPOSITIONS: ReadonlySet<string> = new Set(['mapped', 'approximated', 'degraded', 'unsupported']);

const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;
const CORE_STRING_FIELDS = ['identity', 'mission', 'scope_boundaries', 'output_contract', 'safety'] as const;
/** ADR 0021 decision 6 — the floor is identity, scope boundaries, output contract, safety. */
const FLOOR_FIELDS = ['identity', 'scope_boundaries', 'output_contract', 'safety'] as const;

export function scanCoreForHostTokens(text: string): string[] {
  return FORBIDDEN_TOKEN_CORPUS.filter(token => text.includes(token));
}

function requireNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Semantic Core schema violation: ${field} must be a non-empty string.`);
  }
  return value;
}

/** Throws on malformed schema or on any forbidden host token in any core field (gate 2). */
export function validateCoreSchema(core: unknown): SemanticCore {
  if (core === null || typeof core !== 'object' || Array.isArray(core)) {
    throw new Error('Semantic Core schema violation: core must be an object with the six core fields.');
  }
  const record = core as Record<string, unknown>;
  const validated: Record<string, unknown> = {};
  for (const field of CORE_STRING_FIELDS) {
    validated[field] = requireNonEmptyString(record[field], field);
  }
  const rawInvariants = record.invariants;
  if (!Array.isArray(rawInvariants)) {
    throw new Error('Semantic Core schema violation: invariants must be an array of non-empty strings.');
  }
  const invariants = rawInvariants.map((entry, index) => requireNonEmptyString(entry, `invariants[${index}]`));

  const pieces = [...CORE_STRING_FIELDS.map(field => validated[field] as string), ...invariants];
  const hits = pieces.flatMap(piece => scanCoreForHostTokens(piece));
  if (hits.length > 0) {
    throw new Error(`Semantic Core purity violation: host tokens found in core fields — ${hits.join(', ')}.`);
  }
  return {
    identity: validated.identity as string,
    mission: validated.mission as string,
    scope_boundaries: validated.scope_boundaries as string,
    output_contract: validated.output_contract as string,
    safety: validated.safety as string,
    invariants,
  };
}

/**
 * Loads `<registryDir>/core/*.core.md` (default `registry`) into a stem-keyed map. Fail-fast:
 * a malformed file, missing frontmatter, or any forbidden token anywhere in the file rejects.
 */
export async function loadSemanticCore(registryDir = 'registry'): Promise<Map<string, SemanticCore>> {
  const coreDir = path.join(registryDir, 'core');
  const names = fs
    .readdirSync(coreDir)
    .filter(name => name.endsWith('.core.md'))
    .sort();
  const cores = new Map<string, SemanticCore>();
  for (const name of names) {
    const raw = fs.readFileSync(path.join(coreDir, name), 'utf8');
    const match = raw.match(FRONTMATTER_REGEX);
    if (!match) {
      throw new Error(`Semantic Core load error: ${name} must carry YAML frontmatter.`);
    }
    const tokenHits = scanCoreForHostTokens(raw);
    if (tokenHits.length > 0) {
      throw new Error(`Semantic Core purity violation in ${name}: host tokens found — ${tokenHits.join(', ')}.`);
    }
    let parsed: unknown;
    try {
      parsed = yaml.parse(match[1]);
    } catch (cause) {
      throw new Error(
        `Semantic Core load error: ${name} has invalid YAML (${cause instanceof Error ? cause.message : String(cause)}).`,
      );
    }
    cores.set(name.slice(0, -'.core.md'.length), validateCoreSchema(parsed));
  }
  return cores;
}

const normalize = (text: string): string => text.replace(/\s+/g, ' ').trim();

/**
 * Gate 3 — every realization honors the floor VERBATIM (whitespace-normalized). One violation
 * message per divergent floor field, each naming the field.
 */
export function validateContractFloor(realizationContent: string, core: SemanticCore): string[] {
  const realization = normalize(realizationContent);
  const violations: string[] = [];
  for (const field of FLOOR_FIELDS) {
    if (!realization.includes(normalize(core[field]))) {
      violations.push(`Contract Floor violation: ${field} diverges from the Semantic Core (not emitted verbatim).`);
    }
  }
  return violations;
}

/**
 * Gate 4 — every divergence above the floor must be declared (`mapped|approximated|degraded|
 * unsupported` + rationale). Violations: unbound-and-undeclared invariants, undeclared
 * above-floor scope, invalid disposition, missing rationale.
 */
export function validateDeclaredDeltas(input: ValidateDeclaredDeltasInput): string[] {
  const violations: string[] = [];
  const declared = new Map<string, DeclaredDelta>();
  for (const delta of input.deltas) {
    if (!VALID_DISPOSITIONS.has(delta.disposition)) {
      violations.push(
        `Declared-delta violation: feature "${delta.feature}" carries invalid disposition "${String(delta.disposition)}" (expected mapped|approximated|degraded|unsupported).`,
      );
    }
    if (typeof delta.rationale !== 'string' || delta.rationale.trim() === '') {
      violations.push(`Declared-delta violation: feature "${delta.feature}" is declared without a rationale.`);
    }
    declared.set(delta.feature, delta);
  }
  for (const invariant of input.core.invariants) {
    if (!input.realization.boundInvariants.includes(invariant) && !declared.has(invariant)) {
      violations.push(`Undeclared divergence: core invariant "${invariant}" is neither bound nor delta-declared.`);
    }
  }
  for (const item of input.realization.aboveFloorScope) {
    if (!declared.has(item)) {
      violations.push(`Undeclared divergence: above-floor scope "${item}" has no declared delta.`);
    }
  }
  return violations;
}