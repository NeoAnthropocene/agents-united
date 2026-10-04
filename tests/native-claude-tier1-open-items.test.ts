import { describe, expect, it } from 'vitest';
import { loadNativeDeltas, nativeText } from './helpers/native-roles.js';

/**
 * ADR 0038, decision 5 (maintainer, 2026-10-04): the Tier-1 specialists state in their OWN body that their report always ends with `Open items`,
 * so the section does not depend on the lead's brief template (a reviewer run alone with `claude --agent code-reviewer`, or spawned by another
 * lead, still carries it). `Peer messages received` stays a declared delta: a hub-and-spoke specialist never receives a peer message, so the
 * section would always read "none".
 */

const TIER1_SPECIALISTS = ['backend-architect', 'code-reviewer', 'repo-index'];
const afterFloor = (role: string): string => nativeText(role).split('<!-- agents-united:floor:end -->')[1] ?? '';

describe.each(TIER1_SPECIALISTS)('Tier-1 specialist %s', role => {
  it('states in its own body that the report always ends with `Open items`', () => {
    expect(afterFloor(role)).toMatch(/Always end the report with an `Open items` section/);
  });

  it('says what goes there: what it could not do or verify, a question for the lead, or "none"', () => {
    expect(afterFloor(role)).toMatch(/Always end the report with an `Open items` section[^.]*could not do or verify[^.]*"none"/);
  });

  it('does not bind `Peer messages received`: it never receives one', () => {
    expect(afterFloor(role)).not.toMatch(/`Peer messages received`/);
  });
});

describe('the delta for the handoff report sections', () => {
  const delta = loadNativeDeltas('registry', 'claude').find(entry => entry.feature === 'The handoff report lists peer messages received and open items.');

  it('stays declared for the three Tier-1 specialists', () => {
    expect(delta?.roles.slice().sort()).toEqual([...TIER1_SPECIALISTS].sort());
  });

  it('records that `Open items` is bound and why `Peer messages received` is not', () => {
    expect(delta?.rationale).toMatch(/`Open items` is bound in the specialist's own body/);
    expect(delta?.rationale).toMatch(/never receives a peer message/);
  });
});
