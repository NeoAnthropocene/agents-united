/**
 * ADR 0072 - the repository's rules for a native Claude role, in one place. They used to exist only as test code (model posture, the
 * "Session task tracking" section, the generator's tools line, the canonical floor, invariant coverage), so a candidate could pass every
 * factory check and still fail the repository's tests. The repository's conformance tests and the factory's checks (factory-check,
 * contract-check) both call these functions. Pure: no I/O, no clock.
 */
import { ClaudeProjector } from './claude-projector.js';
import { validateDeclaredDeltas } from './semantic-core.js';
import type { DeclaredDelta, SemanticCore } from './types.js';

/** What kind of role a native file is: a specialist, a coordinator (it can delegate), or a worker of the agent factory. */
export type NativeKind = 'specialist' | 'coordinator' | 'factory-worker';

export interface NativePosture { model: string; effort: string; }

const normalize = (text: string): string => text.replace(/\s+/g, ' ').trim();
const lf = (text: string): string => text.replace(/\r\n/g, '\n');

/** The model and effort a native role of this kind must declare. */
export function nativePosture(kind: NativeKind): NativePosture {
  if (kind === 'factory-worker') return { model: 'inherit', effort: 'medium' };
  return {
    model: ClaudeProjector.CLAUDE_DIALECT.roleModelDefaults![kind],
    effort: ClaudeProjector.CLAUDE_DIALECT.roleEffortDefaults![kind],
  };
}

export function postureProblems(meta: Record<string, unknown>, kind: NativeKind): string[] {
  const p = nativePosture(kind);
  const model = typeof meta.model === 'string' ? meta.model : undefined;
  const effort = typeof meta.effort === 'string' ? meta.effort : undefined;
  if (model === p.model && effort === p.effort) return [];
  return [`Model posture ${model ?? '(none)'}/${effort ?? '(none)'} differs from the ${kind} posture ${p.model}/${p.effort}.`];
}

const SESSION_TRACKING_COMMON: ReadonlyArray<readonly [string, RegExp]> = [
  ['says the tools must be actually available', /actually available/i],
  ['names TodoWrite', /TodoWrite/],
  ['names the neither case', /neither/i],
  ['reopens a task as `in_progress` for a revision', /reopen[^\n]*`in_progress`[^\n]*revision/i],
  ['invalidates the dependent acceptance', /dependent[^\n]*acceptance[^\n]*invalid/i],
  ['links a fix task with the returned ID to its owner', /linked fix task[^\n]*returned ID[^\n]*owner/i],
  ['forbids unresolved fixes marked complete', /Do not leave unresolved fixes marked complete/i],
  ['reads back the changed outputs before closing', /Read back the changed outputs[^\n]*rechecks before closing/i],
  ['hands the task ID to the lead when it cannot update', /cannot update[^\n]*when delegated[^\n]*task ID[^\n]*lead/i],
  ['records the revision in the existing fallback', /otherwise record the revision and status in the existing fallback/i],
];
const SESSION_TRACKING_SPECIALIST: ReadonlyArray<readonly [string, RegExp]> = [
  ['names ordinary background subagents', /ordinary background subagents/i],
  ['names TaskGet', /TaskGet/],
  ['verifies blockers before `in_progress`', /verify blockers are completed before `in_progress`/i],
  ['tracks its own task without an assigned ID', /without an assigned ID, track your own/i],
  ['records `completed` only after evidence and readback', /record `completed` only after evidence and readback/i],
];
const SESSION_TRACKING_COORDINATOR: ReadonlyArray<readonly [string, RegExp]> = [
  ['takes the ID from the actual tool result', /take its ID from the actual tool result/i],
  ['keeps consultation ownership from authorizing a deliverable', /consultation ownership does not authorize a deliverable/i],
  ['names the already accepted map', /already accepted map/i],
];

/** The "## Session task tracking" section of an end-user role (the checks of tests/claude-session-task-policy.test.ts). */
export function sessionTrackingProblems(text: string, options: { coordinator: boolean }): string[] {
  const body = lf(text);
  const problems: string[] = [];
  if (!body.includes('## Session task tracking')) problems.push('Session task tracking: the "## Session task tracking" section is missing.');
  const wording = options.coordinator ? SESSION_TRACKING_COORDINATOR : SESSION_TRACKING_SPECIALIST;
  for (const [label, rule] of [...SESSION_TRACKING_COMMON, ...wording]) {
    if (!rule.test(body)) problems.push(`Session task tracking: the ${options.coordinator ? 'coordinator' : 'specialist'} wording does not ${label}.`);
  }
  return problems;
}

/** The tools line the generator writes: the class tools sorted, then the server tools in the canonical agent's order. */
export function nativeToolOrder(classTools: readonly string[], serverTools: readonly string[]): string[] {
  return [...[...classTools].sort(), ...serverTools];
}

/** The server tools a canonical agent's frontmatter yields, with the projector's own rule (shared code, not a copy). */
export function canonicalServerTools(canonicalText: string): string[] {
  return ClaudeProjector.serverToolsOfAgent(lf(canonicalText), 'canonical agent');
}

/** The "## Safety Guardrails" bullets of a canonical agent, whitespace-normalized. */
export function canonicalGuardrails(canonicalText: string): string[] {
  const section = /\n## Safety Guardrails\n([\s\S]*?)(?=\n---\n|\n## )/.exec(lf(canonicalText))?.[1];
  if (section === undefined) return [];
  return section.split('\n').filter(line => line.startsWith('- ')).map(line => normalize(line.slice(2)));
}

/** The numbered "## Primary Directives" titles of a canonical agent ("1. Title"), whitespace-normalized. */
export function canonicalDirectives(canonicalText: string): string[] {
  const section = /\n## Primary Directives\n([\s\S]*?)(?=\n---\n|\n## )/.exec(lf(canonicalText))?.[1];
  if (section === undefined) return [];
  return [...section.matchAll(/^(\d+)\. (.+)$/gm)].map(match => normalize(`${match[1]}. ${match[2]}`));
}

/** The core must carry every canonical guardrail in `safety` and every numbered directive in `scope_boundaries`. */
export function canonicalFloorProblems(core: SemanticCore, canonicalText: string): string[] {
  const problems: string[] = [];
  const safety = normalize(core.safety);
  for (const bullet of canonicalGuardrails(canonicalText)) {
    if (!safety.includes(bullet)) problems.push(`The core's safety drops the canonical guardrail: ${bullet}`);
  }
  const scope = normalize(core.scope_boundaries);
  for (const title of canonicalDirectives(canonicalText)) {
    if (!scope.includes(title)) problems.push(`The core's scope_boundaries drops the canonical directive: ${title}`);
  }
  return problems;
}

/** Every core invariant is bound by evidence in the native file or declared as a delta (ADR 0021 decision 6, ADR 0037). */
export function invariantCoverageProblems(core: SemanticCore, isBound: (invariant: string) => boolean, deltas: DeclaredDelta[]): string[] {
  const bound = core.invariants.filter(invariant => isBound(invariant));
  return validateDeclaredDeltas({ realization: { boundInvariants: bound, aboveFloorScope: [] }, core, deltas });
}

const DISPOSITIONS: ReadonlySet<string> = new Set(['mapped', 'approximated', 'degraded', 'unsupported']);
const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * A candidate's coverage file: `{version:1, role, definition, invariants:[{invariant, evidence} | {invariant, delta:{disposition, rationale}}]}`.
 * Every core invariant appears once; evidence is a sentence found verbatim in the agent; a delta has a disposition and a rationale. Never throws.
 */
export function coverageFileProblems(core: SemanticCore, agentText: string, coverage: unknown): string[] {
  if (!isRecord(coverage)) return ['Invariant coverage: the coverage file is not a JSON object.'];
  const problems: string[] = [];
  if (coverage.version !== 1) problems.push('Invariant coverage: the coverage file version must be 1.');
  if (!Array.isArray(coverage.invariants)) return [...problems, 'Invariant coverage: the coverage file has no invariants list.'];
  const agent = lf(agentText);
  const seen = new Map<string, number>();
  coverage.invariants.forEach((entry: unknown, index: number) => {
    if (!isRecord(entry) || typeof entry.invariant !== 'string' || entry.invariant.trim() === '') {
      problems.push(`Invariant coverage: entry ${index + 1} names no invariant.`);
      return;
    }
    const name = entry.invariant;
    seen.set(name, (seen.get(name) ?? 0) + 1);
    if (!core.invariants.includes(name)) problems.push(`Invariant coverage: "${name}" is not an invariant of the core.`);
    const hasEvidence = entry.evidence !== undefined;
    const hasDelta = entry.delta !== undefined;
    if (hasEvidence === hasDelta) {
      problems.push(`Invariant coverage: "${name}" needs exactly one of evidence or delta.`);
    } else if (hasEvidence) {
      if (typeof entry.evidence !== 'string' || entry.evidence.trim() === '') problems.push(`Invariant coverage: the evidence for "${name}" must be a non-empty string.`);
      else if (!agent.includes(lf(entry.evidence))) problems.push(`Invariant coverage: the evidence for "${name}" was not found in the agent.`);
    } else if (!isRecord(entry.delta)) {
      problems.push(`Invariant coverage: the delta for "${name}" must be an object with a disposition and a rationale.`);
    } else {
      if (typeof entry.delta.disposition !== 'string' || !DISPOSITIONS.has(entry.delta.disposition)) problems.push(`Invariant coverage: the delta for "${name}" needs a disposition of mapped, approximated, degraded or unsupported.`);
      if (typeof entry.delta.rationale !== 'string' || entry.delta.rationale.trim() === '') problems.push(`Invariant coverage: the delta for "${name}" needs a rationale.`);
    }
  });
  for (const invariant of core.invariants) {
    const count = seen.get(invariant) ?? 0;
    if (count === 0) problems.push(`Invariant coverage: the core invariant "${invariant}" is neither evidenced nor declared as a delta.`);
    else if (count > 1) problems.push(`Invariant coverage: the core invariant "${invariant}" appears more than once.`);
  }
  return problems;
}
