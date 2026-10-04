import { describe, expect, it } from 'vitest';
import { loadSemanticCore, validateDeclaredDeltas } from '../src/core/semantic-core.js';
import { EVIDENCE, evidenceFor, ROLE_EVIDENCE } from './helpers/native-invariant-evidence.js';
import { loadNativeDeltas, nativeText, NATIVE_ROLES } from './helpers/native-roles.js';

/**
 * Plan 032 close-out follow-up (3), ADR 0037 — the parity gate of the retired created lane, ported to the native files. The created lane
 * (`createRole`) proved that every Semantic Core invariant of a role carried a bound mechanic in the output it generated. A native file is
 * authored, not generated, so the same promise becomes: every invariant a native role's core states is either EVIDENCED in the committed
 * file (`tests/helpers/native-invariant-evidence.ts`) or DECLARED as a delta with a disposition and a rationale
 * (`registry/hosts/claude/deltas.json`). Silence is a conformance failure (ADR 0021 decision 6, `validateDeclaredDeltas`).
 */

const registry = 'registry';
const cores = await loadSemanticCore(registry);
const deltas = loadNativeDeltas(registry, 'claude');

describe.each(NATIVE_ROLES)('native role $role', ({ role, stem }) => {
  const core = (): NonNullable<ReturnType<typeof cores.get>> => cores.get(stem)!;
  const declared = (): Array<{ feature: string; host: string; disposition: 'mapped' | 'approximated' | 'degraded' | 'unsupported'; rationale: string }> =>
    deltas.filter(delta => delta.roles.includes(role)).map(delta => ({ feature: delta.feature, host: 'claude', disposition: delta.disposition, rationale: delta.rationale }));

  it('states every core invariant in its body or declares the divergence (no undeclared divergence)', () => {
    const text = nativeText(role);
    const bound = core().invariants.filter(invariant => evidenceFor(role, invariant)?.test(text));
    const violations = validateDeclaredDeltas({ realization: { boundInvariants: bound, aboveFloorScope: [] }, core: core(), deltas: declared() });
    expect(violations).toEqual([]);
  });

  it('is reported when an invariant it binds loses its evidence: the gate can fail', () => {
    const text = nativeText(role);
    const evidenced = core().invariants.filter(invariant => evidenceFor(role, invariant)?.test(text));
    for (const invariant of evidenced) {
      // The same file with the evidence of this one invariant taken out of the text it is matched against.
      const rule = evidenceFor(role, invariant)!;
      const stripped = text.split('\n').filter(line => !rule.test(line)).join('\n');
      if (rule.test(stripped)) continue; // evidence that spans lines: a line-wise strip cannot remove it, so this check does not apply
      const bound = core().invariants.filter(candidate => candidate !== invariant && evidenceFor(role, candidate)?.test(text));
      const violations = validateDeclaredDeltas({ realization: { boundInvariants: bound, aboveFloorScope: [] }, core: core(), deltas: declared() });
      if (declared().some(delta => delta.feature === invariant)) continue;
      expect(violations.join('\n'), `${role}: "${invariant}"`).toContain(invariant);
    }
  });
});

describe('the evidence rules', () => {
  const rules = [
    ...Object.entries(EVIDENCE).map(([invariant, rule]) => ({ where: 'default', invariant, rule })),
    ...Object.entries(ROLE_EVIDENCE).flatMap(([role, byInvariant]) => Object.entries(byInvariant).map(([invariant, rule]) => ({ where: role, invariant, rule }))),
  ];

  it('are specific: none matches empty text, unrelated prose or a bare heading, so none can bind an invariant vacuously', () => {
    for (const { where, invariant, rule } of rules) {
      for (const neutral of ['', 'lorem ipsum dolor sit amet', '## How to work', 'The quick brown fox.']) {
        expect(rule.test(neutral), `${where}: "${invariant}" matches ${JSON.stringify(neutral)}`).toBe(false);
      }
    }
  });

  it('only name invariants that some native core states', () => {
    const stated = new Set(NATIVE_ROLES.flatMap(({ stem }) => cores.get(stem)!.invariants));
    for (const { where, invariant } of rules) expect(stated.has(invariant), `${where}: "${invariant}" is stated by no native core`).toBe(true);
  });
});

describe('the declared deltas of the native roles (registry/hosts/claude/deltas.json)', () => {
  it('exists, with a valid disposition and a rationale on every entry', () => {
    expect(deltas.length).toBeGreaterThan(0);
    for (const delta of deltas) {
      expect(['mapped', 'approximated', 'degraded', 'unsupported'], delta.feature).toContain(delta.disposition);
      expect(delta.rationale.trim().length, `${delta.feature}: needs a rationale`).toBeGreaterThan(0);
      expect(delta.roles.length, `${delta.feature}: names no role`).toBeGreaterThan(0);
    }
  });

  it('names only native roles whose core states the invariant, and is never stale: the role really has no evidence for it', () => {
    for (const delta of deltas) {
      for (const role of delta.roles) {
        const entry = NATIVE_ROLES.find(candidate => candidate.role === role);
        expect(entry, `${delta.feature}: "${role}" is not a native role`).toBeDefined();
        const core = cores.get(entry!.stem)!;
        expect(core.invariants, `${role}: core does not state "${delta.feature}"`).toContain(delta.feature);
        expect(evidenceFor(role, delta.feature)?.test(nativeText(role)) ?? false, `${role}: "${delta.feature}" is declared a delta but the body evidences it, so remove the delta`).toBe(false);
      }
    }
  });
});
