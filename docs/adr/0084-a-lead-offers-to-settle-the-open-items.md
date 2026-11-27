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

   > When the final report or handoff leaves open items that only the user can settle, it ends by asking whether to settle them now or stop here; to settle them, grill-me runs with those items as its goal.

   The nine leads are `orchestrator-business`, `orchestrator-design`, `orchestrator-digital-agency`, `orchestrator-engineering`, `orchestrator-marketing`, `orchestrator-research`, `orchestrator-security`, `orchestrator-system-architecture` and `orchestrator-universal`. "Handoff" covers the universal lead, which routes the user to a department and ends with a handoff rather than running a team. Every bundle that resolves one of these leads installs `grill-me`.

2. **The Claude realization.** Each of the nine Claude native lead files gains the section "Open items the user can settle", word for word the same, as the section just before "Boundaries of this host":
   - **Order.** The report, the required handoff and any shutdown requests go first, as the lead's other rules say. The offer is the closing line after them and starts an optional new round; when the role ends with a handoff, what was settled goes into a refreshed handoff. The rules that questions come before the plan, and that the Completion report is delivered at once, are unchanged.
   - **Which items.** Only the items that need the user are named. Items that belong to someone else, such as a decision for whoever builds the page later, are left out. When no open item needs the user, nothing is offered.
   - **How it asks.** With `AskUserQuestion` when the lead has it; otherwise the two choices are a numbered list. A lead running as a subagent puts the offer and the items in its report, so that its caller can ask the user and pass the answer back.
   - **Settling.** On "settle", the lead calls the Skill tool with `skill: "grill-me"` and the open items in `args`. Claude Code appends the arguments to the skill's text (`host-library/claude/guide/skill.md`), so grill-me starts from those items.
   - **What follows.** A change that follows is new work under the same gates as any other: an accepted plan or delegation map where the lead's rules require one, and the same verification.
     - The lead updates a file it owns itself, such as the research lead's synthesis or the universal lead's handoff.
     - A change to a specialist's file goes to that specialist: continued once when the host can still resume it, or newly briefed with its report and the settled decisions when it has shut down or the continuation is refused. Requests a specialist is still waiting on are answered before shutdown, as the lead's existing rules say.
     - When the lead holds no specialist for the work, as with the universal lead, it records the settlement in its handoff for the session that will do it.
     - The lead notes the change instead when the user says so.

   The coverage check binds the invariant to the section's sentences (`tests/helpers/native-invariant-evidence.ts`).

3. **The agent-factory lead is left out here.** Its files belong to the Plan 052 session, which will add the same invariant with this wording after this change lands.

4. **Antigravity is unchanged, with one known gap.**
   - **Canonical lane.** An Antigravity install of a lead takes the canonical agent file with its Antigravity host sections. The invariant is not in that file, and no renderer copies `invariants` into a role file: the Contract Floor holds identity, mission, scope boundaries, output contract and safety (`src/core/native-floor.ts`).
   - **Native lane.** It writes a native role where one exists under `registry/hosts/antigravity/agents/` (`src/core/antigravity-projector.ts`). Of the nine leads, only `orchestrator-engineering` has one today. It does not state the rule, and Antigravity has no coverage check or delta file that would flag it.
   - **The gap stays open on purpose.** The maintainer has paused Antigravity native work until the Claude pilot projections are proven. When the Antigravity native leads are written or revised, each must state the rule. The existing engineering lead is one of them.

## Consequences

- In the Claude native lane (`agents add --native`), a lead session that ends with open items for the user is meant to end with an offer after the report; a session with none ends as before. A Claude install without the native lane renders the canonical lead file, which this change leaves as it is.
- `tests/lead-offers-to-settle-open-items.test.ts` pins:
  - the rule in exactly the nine cores (the agent-factory lead may follow), with no host named;
  - the rule's absence from the rendered Contract Floor;
  - the section as a real level-2 heading in the nine Claude files, word for word, directly followed by "Boundaries of this host";
  - the two tools the section names, granted in each lead's frontmatter and not denied;
  - `grill-me` in every bundle whose resolved agents hold one of the leads, through the production resolver;
  - this record.

  It does not test Antigravity or any live behaviour.
- `grill-me` itself is unchanged. It is an adopted upstream skill, and its runbook asks "2–4" questions and starts from "the user's initial prompt". Whether it takes the passed items as its goal and keeps a one-item round short is to be seen live.
- **Not verified live.** A headless run with answers given in the prompt could show only the written offer. The structured question, the grill-me round and the follow-up need a person answering, so a short interactive sitting with one lead checks them.
