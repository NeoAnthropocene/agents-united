import { describe, it, expect } from 'vitest';
import {
  PILOT_STEMS,
  captureCreatedGoldens,
  readCreatedGolden,
  runPipeline,
  syncCreatedGolden,
} from './helpers/created-golden.js';
import { validateContractFloor, validateDeclaredDeltas } from '../src/core/semantic-core.js';

/**
 * Plan 021 (ADR 0021) / Steps 5–6 — the Conformance Suite (objective 4):
 *   - created-output goldens (tests/golden/claude-created/**) + byte-determinism (gate 5),
 *   - Contract Floor identity assertions across the 5 pilot realizations (gate 3),
 *   - declared-delta conformance (gate 4),
 *   - the parity gate (gate 6): created vs legacy-projected outputs agree on all floor
 *     fields and on every invariant's bound mechanics.
 * A floor-field parity failure is the plan's STOP condition — this suite must fail loudly.
 */

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

describe('Created-output goldens (tests/golden/claude-created/** — gate 5)', () => {
  it('renders the created golden set byte-identically to the committed snapshots', async () => {
    const artifacts = await captureCreatedGoldens();
    for (const artifact of artifacts) syncCreatedGolden(artifact);

    const missing = artifacts.filter(a => readCreatedGolden(a) === undefined).map(a => a.relPath);
    expect(missing, `created snapshots missing — capture with UPDATE_GOLDEN=1 (${missing.join(', ')})`).toEqual([]);

    for (const artifact of artifacts) {
      expect(readCreatedGolden(artifact), `created snapshot drift for ${artifact.relPath}`).toBe(artifact.content);
    }
  });

  it('is byte-deterministic: 3 repeated pipelines return identical bytes (gate 5)', async () => {
    for (const stem of PILOT_STEMS) {
      const first = await runPipeline(stem);
      const second = await runPipeline(stem);
      const third = await runPipeline(stem);
      expect(second.created, `${stem}: run 1 → run 2 must be byte-identical`).toBe(first.created);
      expect(third.created, `${stem}: run 2 → run 3 must be byte-identical`).toBe(second.created);
    }
  });
});

describe('Contract Floor identity across the 5 pilot realizations (gate 3)', () => {
  it('created AND legacy-projected outputs honor every floor field verbatim', async () => {
    for (const stem of PILOT_STEMS) {
      const p = await runPipeline(stem);
      expect(validateContractFloor(p.created, p.core), `${stem}: created floor divergence`).toEqual([]);
      expect(validateContractFloor(p.legacy, p.core), `${stem}: legacy floor divergence`).toEqual([]);
    }
  });

  it('one seeded floor mutation fails exactly one assertion', async () => {
    const p = await runPipeline('subagent-code-reviewer');
    const mutated = p.created.split(p.core.safety).join('');
    const violations = validateContractFloor(mutated, p.core);
    expect(violations, 'one seeded floor mutation must fail exactly one assertion').toHaveLength(1);
    expect(violations[0], 'the violation must name the safety field').toMatch(/safety/);
  });
});

describe('Declared-delta conformance for the pilot realizations (gate 4)', () => {
  it('every pilot realization declares its divergences — zero undeclared divergence', async () => {
    for (const stem of PILOT_STEMS) {
      const p = await runPipeline(stem);
      const violations = validateDeclaredDeltas({
        realization: { boundInvariants: p.core.invariants, aboveFloorScope: p.realization.aboveFloorScope },
        core: p.core,
        deltas: p.table.deltas ?? [],
      });
      expect(violations, `${stem}: undeclared divergences`).toEqual([]);
    }
  });

  it('each above-floor item carries a classification and a rationale in the registry', async () => {
    for (const stem of PILOT_STEMS) {
      const p = await runPipeline(stem);
      for (const item of p.realization.aboveFloorScope) {
        const entry = (p.table.deltas ?? []).find(delta => delta.feature === item);
        expect(entry, `${stem}: ${item} must be declared`).toBeTruthy();
        expect(['mapped', 'approximated', 'degraded', 'unsupported']).toContain(entry?.disposition);
        expect(entry?.rationale.trim().length, `${stem}: ${item} needs a rationale`).toBeGreaterThan(0);
      }
    }
  });
});

describe('Parity gate (gate 6): created vs legacy-projected', () => {
  it('agrees on every floor field — both lanes conform to the same core', async () => {
    for (const stem of PILOT_STEMS) {
      const p = await runPipeline(stem);
      expect(validateContractFloor(p.created, p.core), `${stem}: created floor`).toEqual([]);
      expect(validateContractFloor(p.legacy, p.core), `${stem}: legacy floor`).toEqual([]);
    }
  });

  it('agrees on every invariant’s bound mechanics', async () => {
    for (const stem of PILOT_STEMS) {
      const p = await runPipeline(stem);

      // (1) Every core invariant is actually bound — no placeholder mechanics.
      for (const invariant of p.core.invariants) {
        expect(
          p.created,
          `${stem}: invariant "${invariant}" must carry a bound mechanic`,
        ).toMatch(new RegExp(`${escapeRegExp(invariant)}\\n   - Bound mechanic: (?!\\(no host binding)`));
      }
      expect(p.created, `${stem}: no unbound invariants`).not.toContain('(no host binding declared');

      // (2) Both lanes use the same delegation + handback mechanics.
      expect(p.legacy, `${stem}: legacy lane must delegate via Agent`).toContain('Agent');
      expect(p.legacy, `${stem}: legacy lane must deliver handback via SubagentHandback`).toContain('SubagentHandback');

      // (3) Every capability-profile tool cited in bound-mechanic lines also appears in the
      //     legacy lane's own mechanics — unless a live declared delta covers the divergence
      //     (the schedule/manage_task dispositions are approximated on this host).
      const declaredMechanicDivergence = new Set(['CronCreate', 'CronList', 'TaskCreate', 'TaskUpdate']);
      for (const feature of ['schedule', 'manage_task']) {
        const entry = p.ledger.find(delta => delta.feature === feature);
        expect(entry, `${stem}: live delta entry required for ${feature}`).toBeTruthy();
        expect(['approximated', 'degraded', 'unsupported']).toContain(entry?.disposition);
      }
      const boundLines = p.created.split('\n').filter(line => line.includes('Bound mechanic:'));
      for (const line of boundLines) {
        for (const tool of p.profile.tools ?? []) {
          const cited = new RegExp(`\\b${escapeRegExp(tool)}\\b`).test(line);
          if (!cited) continue;
          const legacyMentions = p.legacy.includes(tool);
          const declared = declaredMechanicDivergence.has(tool);
          expect(
            legacyMentions || declared,
            `${stem}: bound mechanic cites ${tool} but the legacy lane never mentions it and no delta declares the divergence`,
          ).toBe(true);
        }
      }
    }
  });
});