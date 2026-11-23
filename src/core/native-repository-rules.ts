/**
 * ADR 0072 - the repository's rules for a native Claude role, in one place. They used to exist only as test code (model posture, the
 * "Session task tracking" section, the generator's tools line, the canonical floor, invariant coverage), so a candidate could pass every
 * factory check and still fail the repository's tests. The repository's conformance tests and the factory's checks (factory-check,
 * contract-check) both call these functions. Pure: no I/O, no clock.
 */
import yaml from 'yaml';
import { ClaudeProjector } from './claude-projector.js';
import { checkPublishing } from './native-publishing.js';
import { REQUESTS_EXEMPT_ROLES, checkRequests } from './native-requests.js';
import { validateDeclaredDeltas } from './semantic-core.js';
import type { DeclaredDelta, SemanticCore } from './types.js';

/** What kind of role a native file is: a specialist, a coordinator (it can delegate), or a worker of the agent factory. */
export type NativeKind = 'specialist' | 'coordinator' | 'factory-worker';

export interface NativePosture { model: string; effort: string; }

/**
 * Whether a native role is a lead (the coordinator kind: coordinator posture, coordinator wording of its generated blocks). A role whose core can
 * `delegate` is one. So is a lead that routes and holds no `delegate` class, the front door: its canonical agent is `type: orchestrator`, and
 * the repository's tests list it among the leads. A lead's tools line may still hold no `Agent` allowlist; that is `delegates`, not this.
 */
export function isLeadRole(core: SemanticCore, canonicalText?: string): boolean {
  if (core.capabilities?.includes('delegate')) return true;
  if (canonicalText === undefined) return false;
  const frontmatter = /^---\n([\s\S]*?)\n---/.exec(lf(canonicalText).replace(/^﻿/, ''))?.[1];
  if (frontmatter === undefined) return false;
  try {
    const meta = yaml.parse(frontmatter) as unknown;
    return typeof meta === 'object' && meta !== null && (meta as Record<string, unknown>).type === 'orchestrator';
  } catch { return false; }
}

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

/**
 * ADR 0076 - the generated requests block. A specialist or lead carries the current block; the factory's fixed-job roles (named in
 * `REQUESTS_EXEMPT_ROLES`, or any `factory-worker` kind) carry none, and a marker in one of them is a problem. Never throws.
 */
export function requestsBlockProblems(text: string, role: { kind: NativeKind; name: string; tools: readonly string[] }): string[] {
  const body = lf(text);
  const marked = body.includes('agents-united:requests:start') || body.includes('agents-united:requests:end');
  if (role.kind === 'factory-worker' || REQUESTS_EXEMPT_ROLES.includes(role.name)) {
    return marked ? [`Native requests block: ${role.name} is exempt from the requests protocol and must carry no requests markers.`] : [];
  }
  try {
    return checkRequests(body, role.kind === 'coordinator' ? 'coordinator' : 'specialist', role.tools);
  } catch (error) {
    return [error instanceof Error ? error.message : String(error)];
  }
}

/**
 * ADR 0077 - the generated publishing block. A role whose tools hold `Artifact` carries the current block for its kind (specialist or lead);
 * a role without `Artifact` carries no publishing markers. Never throws.
 */
export function publishingBlockProblems(text: string, role: { kind: NativeKind; name: string; tools: readonly string[] }): string[] {
  try {
    return checkPublishing(text, role.kind === 'coordinator' ? 'coordinator' : 'specialist', role.tools);
  } catch (error) {
    return [error instanceof Error ? error.message : String(error)];
  }
}

/** The tools line the generator writes: the class tools sorted, then the server tools in the canonical agent's order. */
export function nativeToolOrder(classTools: readonly string[], serverTools: readonly string[]): string[] {
  return [...[...classTools].sort(), ...serverTools];
}

const DELEGATE_LIST = /^Agent\(([a-z0-9]+(?:-[a-z0-9]+)*(?:, [a-z0-9]+(?:-[a-z0-9]+)*)*)\)$/;

/**
 * The tools line a role must carry: `expected` (from `nativeToolOrder`), where a role that can delegate puts its one well-formed `Agent(a, b)`
 * allowlist (distinct kebab-case names, ", " between them) in the place of `Agent`. A role that cannot delegate, a malformed list or a second
 * `Agent` entry gets no stand-in, so the comparison refuses it. Which names the list holds is the lead's own roster rule, not checked here.
 */
export function nativeToolsWanted(expected: readonly string[], tools: readonly string[], options: { coordinator: boolean }): string[] {
  const delegates = tools.filter(tool => /^Agent(?:\(|$)/.test(tool));
  const names = delegates.length === 1 ? DELEGATE_LIST.exec(delegates[0]!)?.[1]?.split(', ') : undefined;
  if (!options.coordinator || names === undefined || new Set(names).size !== names.length) return [...expected];
  return expected.map(tool => (tool === 'Agent' ? delegates[0]! : tool));
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

/** Where a piece of evidence sits: the Contract Floor block, the agent's own body (outside every generated block), or elsewhere. */
export type EvidencePlace = 'floor' | 'body';

const GENERATED_BLOCK = /<!-- agents-united:([a-z-]+):start[^>]*-->[\s\S]*?<!-- agents-united:\1:end -->/g;

/** The place of the span [start, end) of an LF-normalized agent text, or undefined for the frontmatter, a non-floor generated block or a span across a block edge. */
export function evidencePlaceAt(agent: string, start: number, end: number): EvidencePlace | undefined {
  const frontmatter = /^---\n[\s\S]*?\n---\n/.exec(agent)?.[0].length ?? 0;
  if (start < frontmatter) return undefined;
  for (const block of agent.matchAll(GENERATED_BLOCK)) {
    const blockStart = block.index!, blockEnd = blockStart + block[0].length;
    if (start >= blockStart && end <= blockEnd) return block[1] === 'floor' ? 'floor' : undefined;
    if (start < blockEnd && end > blockStart) return undefined;
  }
  return 'body';
}

/**
 * True when the span [start, end) has the shape of a complete sentence or list item (or several whole ones): it starts at a line start (after
 * indentation and an optional list marker) or after a sentence end, and it ends at a line end or with a sentence end followed by white space.
 * A shape test, not grammar: an abbreviation such as "e.g. " counts as a sentence end, and a hard-wrapped continuation line counts as a line
 * start (ADR 0072, known limits). Native agents are written one paragraph or list item per line, where the shape test is exact.
 */
export function isCompleteUnit(agent: string, start: number, end: number): boolean {
  const lineStart = agent.lastIndexOf('\n', start - 1) + 1;
  const before = agent.slice(lineStart, start);
  const startsUnit = /^\s*(?:[-*]\s+|\d+\.\s+)?$/.test(before) || /[.!?][*`)"]*\s+$/.test(before);
  const lineEnd = agent.indexOf('\n', end) === -1 ? agent.length : agent.indexOf('\n', end);
  const after = agent.slice(end, lineEnd);
  const span = agent.slice(start, end).trimEnd();
  const endsUnit = /^\s*$/.test(after) || (/[.!?][*`)"]*$/.test(span) && /^\s/.test(after));
  return startsUnit && endsUnit;
}

/**
 * A candidate's coverage file: `{version:1, role, definition, invariants:[{invariant, evidence, in, sharedWith?} | {invariant, delta:{disposition, rationale}}]}`.
 * Every core invariant appears once; a delta has a disposition and a rationale. Evidence is verbatim agent text that declares its place
 * (`in`: `floor` for the Contract Floor block, `body` for the agent's own text outside every generated block), is found there as a complete
 * sentence or list item, and is shared with another entry (one contains the other) only when both entries name each other in `sharedWith`.
 * With `expected`, `role` and `definition` must name that role and definition. Presence and place are checked here; whether the evidence
 * states its invariant is the evaluator's judgment, not proven. Never throws.
 */
export function coverageFileProblems(core: SemanticCore, agentText: string, coverage: unknown, expected?: { role: string; definition: string }): string[] {
  if (!isRecord(coverage)) return ['Invariant coverage: the coverage file is not a JSON object.'];
  const problems: string[] = [];
  if (coverage.version !== 1) problems.push('Invariant coverage: the coverage file version must be 1.');
  if (expected !== undefined && coverage.role !== expected.role) problems.push(`Invariant coverage: the coverage file role must be "${expected.role}".`);
  if (expected !== undefined && coverage.definition !== expected.definition) problems.push(`Invariant coverage: the coverage file definition must be "${expected.definition}".`);
  if (!Array.isArray(coverage.invariants)) return [...problems, 'Invariant coverage: the coverage file has no invariants list.'];
  const agent = lf(agentText);
  const seen = new Map<string, number>();
  const evidenced: Array<{ name: string; evidence: string; sharedWith: string[] }> = [];
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
      const place = entry.in;
      const shared = entry.sharedWith;
      if (typeof entry.evidence !== 'string' || entry.evidence.trim() === '') problems.push(`Invariant coverage: the evidence for "${name}" must be a non-empty string.`);
      else if (place !== 'floor' && place !== 'body') problems.push(`Invariant coverage: the evidence for "${name}" must declare its place, "in": "floor" or "body".`);
      else if (shared !== undefined && (!Array.isArray(shared) || shared.some(other => typeof other !== 'string'))) problems.push(`Invariant coverage: "sharedWith" of "${name}" must be a list of invariants.`);
      else {
        const evidence = lf(entry.evidence).trim();
        const spans: Array<[number, number]> = [];
        for (let at = agent.indexOf(evidence); at !== -1; at = agent.indexOf(evidence, at + 1)) spans.push([at, at + evidence.length]);
        const placed = spans.filter(([start, end]) => evidencePlaceAt(agent, start, end) === place);
        if (spans.length === 0) problems.push(`Invariant coverage: the evidence for "${name}" was not found in the agent.`);
        else if (placed.length === 0) problems.push(`Invariant coverage: the evidence for "${name}" is not in the agent's ${place === 'floor' ? 'Contract Floor' : 'own body (outside every generated block)'}.`);
        else if (!placed.some(([start, end]) => isCompleteUnit(agent, start, end))) problems.push(`Invariant coverage: the evidence for "${name}" is not a complete sentence or list item.`);
        else evidenced.push({ name, evidence, sharedWith: (shared as string[] | undefined) ?? [] });
      }
    } else if (!isRecord(entry.delta)) {
      problems.push(`Invariant coverage: the delta for "${name}" must be an object with a disposition and a rationale.`);
    } else {
      if (typeof entry.delta.disposition !== 'string' || !DISPOSITIONS.has(entry.delta.disposition)) problems.push(`Invariant coverage: the delta for "${name}" needs a disposition of mapped, approximated, degraded or unsupported.`);
      if (typeof entry.delta.rationale !== 'string' || entry.delta.rationale.trim() === '') problems.push(`Invariant coverage: the delta for "${name}" needs a rationale.`);
    }
  });
  // Shared evidence: one entry's evidence contains the other's. Both must name each other; a named share must be a real one.
  const overlaps = (a: string, b: string): boolean => a.includes(b) || b.includes(a);
  for (const [i, first] of evidenced.entries()) {
    for (const second of evidenced.slice(i + 1)) {
      if (!overlaps(first.evidence, second.evidence)) continue;
      if (!first.sharedWith.includes(second.name) || !second.sharedWith.includes(first.name)) {
        problems.push(`Invariant coverage: "${first.name}" and "${second.name}" share evidence; each must name the other in "sharedWith".`);
      }
    }
    for (const other of first.sharedWith) {
      const partner = evidenced.find(item => item.name === other);
      if (other === first.name) problems.push(`Invariant coverage: "${first.name}" names itself in "sharedWith".`);
      else if (partner === undefined || !overlaps(first.evidence, partner.evidence)) problems.push(`Invariant coverage: "${first.name}" names "${other}" in "sharedWith", but they do not share evidence.`);
    }
  }
  for (const invariant of core.invariants) {
    const count = seen.get(invariant) ?? 0;
    if (count === 0) problems.push(`Invariant coverage: the core invariant "${invariant}" is neither evidenced nor declared as a delta.`);
    else if (count > 1) problems.push(`Invariant coverage: the core invariant "${invariant}" appears more than once.`);
  }
  return problems;
}
