# ADR 0084: A lead offers to settle the open items

- **Status**: Accepted, 2026-11-27, the maintainer's decision after the live Sitting 1 of the Claude pilot projection.
- **Builds on**:
  - [ADR 0037](0037-created-lane-retired.md): a native role evidences every invariant of its core or declares it.
  - [ADR 0079](0079-media-servers-in-the-base-roles-and-the-image-tool-shared-with-marketing.md) decision 12: the same pattern for a host-neutral invariant that no renderer copies.

## Context

On 2026-11-27 the maintainer sat a live-team session with the digital-agency lead on Claude Code (session `730afc3e`). The lead planned, ran two teammates and delivered a final report with a "Still open" list: the palette needed the user's approval, the mobile crop belonged to whoever builds the page, a placeholder link stayed until the shop page exists, and nothing had been rendered.

The report ended there. The lead did not offer to settle the items that needed the user. When the maintainer then typed `/grill-me`, the skill opened with "/grill-me was called with no goal" and asked about the audience again, although the open items were in the conversation.

The maintainer expects a lead to ask at the end whether to clarify the open items now or stop, and, on "clarify", to run grill-me on those items. The maintainer chose "every lead".

## Decision

1. **The rule, host-neutral.** Each of these nine lead cores gains one invariant, with one wording:

   > When the final report leaves open items that only the user can settle, it ends by asking whether to settle them now or stop here; to settle them, grill-me runs with those items as its goal.

   The nine leads are `orchestrator-business`, `orchestrator-design`, `orchestrator-digital-agency`, `orchestrator-engineering`, `orchestrator-marketing`, `orchestrator-research`, `orchestrator-security`, `orchestrator-system-architecture` and `orchestrator-universal`. Every bundle these leads lead installs `grill-me`.

2. **The Claude realization.** Each of the nine Claude native lead files gains the section "Open items the user can settle", word for word the same, just before "Boundaries of this host":
   - One `AskUserQuestion` at the end of the report: settle them now, or stop here.
   - Only the items that need the user are named. Items that belong to someone else, such as a decision for whoever builds the page later, are left out. When no open item needs the user, nothing is asked.
   - On "settle", the lead runs the Skill `grill-me` with those items as its goal, so that it starts from them and does not ask again what the session already settled.
   - The lead then reports what was settled, and sends a change to a delivered file to the specialist that owns it, or notes the change when the user says so.

   The coverage check binds the invariant to the section's sentence (`tests/helpers/native-invariant-evidence.ts`).

3. **The agent-factory lead is left out here.** Its files belong to the Plan 052 session, which will add the same invariant with this wording after this change lands.

4. **Other hosts.** No renderer copies `invariants` into a role file, so today's Antigravity output is unchanged: an Antigravity install still takes the leads' instructions from the bundles' host sections. When the Antigravity native leads are written, each must state the rule or declare it as a delta, as every native role does for every invariant of its core.

## Consequences

- A session that ends with open items for the user now ends with one question instead of a list. A session with none ends as before.
- The lead's rule "questions come before the plan" still holds for planning. This question comes after delivery and starts a new, optional round.
- `tests/lead-offers-to-settle-open-items.test.ts` pins:
  - the rule in exactly the nine cores, with no host named;
  - its absence from the rendered Contract Floor;
  - the section word for word in the nine Claude files;
  - the two tools the section names, held by each lead;
  - `grill-me` in every bundle those leads lead;
  - this record.
- **Not verified live.** The offer and the grill-me round need a person to answer, so a headless run cannot show them. A short live sitting with one lead checks it. Not yet known: whether `grill-me` takes the items passed as its goal rather than opening with "called with no goal".
