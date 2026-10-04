/**
 * What binds a Semantic Core invariant to a native Claude body (ADR 0037, which replaced the created lane's "every invariant carries a
 * bound mechanic" parity gate). An invariant is bound when its evidence matches the text of the native file; when a role does not bind
 * one on purpose, `registry/hosts/claude/deltas.json` declares it with a disposition and a rationale. The coverage suite fails on an
 * invariant that is neither.
 *
 * `EVIDENCE` is the default rule per invariant; `ROLE_EVIDENCE` overrides it for a role whose wording differs.
 */

/** Default evidence per invariant text, shared by every role whose core states it. */
export const EVIDENCE: Record<string, RegExp> = {};

/** Per-role overrides: role name, then invariant text. */
export const ROLE_EVIDENCE: Record<string, Record<string, RegExp>> = {};

/** The evidence rule for one role and invariant, or `undefined` when the role has none (it must then declare a delta). */
export function evidenceFor(role: string, invariant: string): RegExp | undefined {
  return ROLE_EVIDENCE[role]?.[invariant] ?? EVIDENCE[invariant];
}
