import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ClaudeProjector } from '../src/core/claude-projector.js';
import { loadTranslationLedger } from '../src/core/registry.js';
import { loadSemanticCore, validateContractFloor } from '../src/core/semantic-core.js';
import { nativeText, NATIVE_ROLES } from './helpers/native-roles.js';

/**
 * Plan 032 close-out follow-up (3), ADR 0037 — what is left of the created lane's Conformance Suite (`semantic-conformance.test.ts`, Plan 021
 * gates 3 and 6) once `createRole` is retired. The created half is gone with the lane. What stays is still true and still worth asserting:
 *   - the Contract Floor of the Semantic Core is honored verbatim by BOTH shipping lanes, the native files and the legacy projections (the
 *     legacy lane still renders 54 of the 59 agents);
 *   - the floor validator fails loudly on one seeded mutation, naming the field;
 *   - the legacy lane delegates through `Agent` and hands back through `SubagentHandback`;
 *   - the two tool dispositions the legacy vocabulary relies on are declared in the Declared-Delta Registry.
 * (Invariant coverage is `tests/native-invariant-coverage.test.ts`.)
 */

const registry = path.resolve('registry');
const cores = await loadSemanticCore(registry);

/** The five Tier-1 pilot roles, each with its canonical agent file (the legacy lane renders these). */
const PILOT = [
  { stem: 'orchestrator-engineering', role: 'orchestrator-engineering' },
  { stem: 'subagent-backend-architect', role: 'backend-architect' },
  { stem: 'subagent-frontend-architect', role: 'frontend-architect' },
  { stem: 'subagent-code-reviewer', role: 'code-reviewer' },
  { stem: 'subagent-repo-index', role: 'repo-index' },
] as const;

const legacyRender = (stem: string, role: string): string =>
  ClaudeProjector.renderRole(fs.readFileSync(path.join(registry, 'agents', `${stem}.md`), 'utf8'), `agents/${role}.md`).content;

describe('Contract Floor identity (Plan 021 gate 3)', () => {
  it.each(NATIVE_ROLES)('native $role honors every floor field of its core verbatim', ({ role, stem }) => {
    expect(validateContractFloor(nativeText(role), cores.get(stem)!), `${role}: native floor divergence`).toEqual([]);
  });

  it.each(PILOT)('legacy-projected $role honors every floor field of its core verbatim', ({ stem, role }) => {
    expect(validateContractFloor(legacyRender(stem, role), cores.get(stem)!), `${role}: legacy floor divergence`).toEqual([]);
  });

  it('one seeded floor mutation fails exactly one assertion, naming the field', () => {
    const core = cores.get('subagent-code-reviewer')!;
    const mutated = nativeText('code-reviewer').split(core.safety).join('');
    expect(mutated).not.toBe(nativeText('code-reviewer'));
    const violations = validateContractFloor(mutated, core);
    expect(violations, 'one seeded floor mutation must fail exactly one assertion').toHaveLength(1);
    expect(violations[0], 'the violation must name the safety field').toMatch(/safety/);
  });
});

describe('The legacy lane keeps its delegation and handback mechanics (Plan 021 gate 6, part 2)', () => {
  it.each(PILOT)('legacy-projected $role delegates via Agent and hands back via SubagentHandback', ({ stem, role }) => {
    const legacy = legacyRender(stem, role);
    expect(legacy, `${role}: legacy lane must delegate via Agent`).toContain('Agent');
    expect(legacy, `${role}: legacy lane must deliver handback via SubagentHandback`).toContain('SubagentHandback');
  });
});

describe('The Declared-Delta Registry (Plan 021 gate 6, part 3)', () => {
  const ledger = loadTranslationLedger(registry);

  it.each(['schedule', 'manage_task'])('carries a live, classified delta for the legacy tool token %s', feature => {
    const entry = ledger.find(delta => delta.feature === feature && delta.host === 'claude');
    expect(entry, `a live delta entry is required for ${feature}`).toBeTruthy();
    expect(['approximated', 'degraded', 'unsupported']).toContain(entry?.disposition);
    expect(entry?.rationale.trim().length).toBeGreaterThan(0);
  });
});
