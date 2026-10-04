/**
 * What binds a Semantic Core invariant to a native Claude body (ADR 0037, which replaced the created lane's "every invariant carries a
 * bound mechanic" parity gate). An invariant is bound when its evidence matches the text of the native file; when a role does not bind
 * one on purpose, `registry/hosts/claude/deltas.json` declares it with a disposition and a rationale. The coverage suite fails on an
 * invariant that is neither.
 *
 * `EVIDENCE` is the default rule per invariant; `ROLE_EVIDENCE` overrides it for a role whose wording differs. A rule quotes a sentence
 * of the file (the floor, which is generated from the core, or the authored body), never a heading alone.
 */

const COMMS = {
  handBack: 'Hand your result back, not across.',
  boundedExchange: 'Bounded peer exchange only when genuinely required.',
  twoExchanges: 'At most two peer exchanges per specialist pair and one directed question per peer per planning round.',
  inbox: 'Check for delivered peer messages before the final report.',
  report: 'The handoff report lists peer messages received and open items.',
  teamMode: 'Message a peer directly only in team mode, when the brief lists that peer.',
  consult: 'During planning consultation, answer with a bounded scope-of-work statement and write no deliverable.',
} as const;

/** Default evidence per invariant text, shared by every role whose core states it. */
export const EVIDENCE: Record<string, RegExp> = {
  // ── The comms law (Plan 022), as bound by a Tier-2 teammate (and `frontend-architect`, which shares its wording) and by a Tier-1 specialist.
  [COMMS.handBack]: /A hand-off goes back to the agent that spawned you|Your final report is your one hand-?back/,
  [COMMS.boundedExchange]: /only when a peer'?s answer is genuinely required|if a peer'?s answer is genuinely needed, ask for it in your handoff/,
  [COMMS.twoExchanges]: /at most two exchanges per pair \(an exchange is one message and its reply\)/,
  [COMMS.inbox]: /\*\*Check your inbox before you finish, and do not wait for a reply\.\*\*/,
  [COMMS.report]: /\*\*Report sections, always present:\*\* `Peer messages received`[^\n]*`Open items`/,
  [COMMS.teamMode]: /\*\*Team mode\*\* is only for a live Agent Team, and then your brief lists each peer you may message directly by name with `SendMessage`/,
  [COMMS.consult]: /\*\*Planning consultation\.\*\* When the lead consults you before the plan is accepted, answer with a bounded scope-of-work statement/,

  // ── Coordinators (the two leads share most of their wording).
  'Resolve ambiguity with the user before any unverified work.': /\*\*Align first, in proportion to the stakes\.\*\*/,
  'Parallel slices fan out in a single turn; exactly one synthesis point.': /Parallel slices go out in one turn/,
  'Never busy-poll; liveness is event-driven or cron-based.': /Never loop on status commands/,
  'Every delegation brief carries objective, scope, acceptance evidence, peer routing, and report format.': /Every (delegation is a self-contained brief|brief is self-contained)/,
  'The coordinator relays between specialists and wakes a finished peer before expecting its reply.': /You are the (only )?relay/,
  'Shared interfaces are delegated contract-first and handed to parallel slices as fixed inputs.': /\*\*Contract first\.\*\*/,
  'The orchestrator delegates every domain implementation slice.': /You delegate every domain implementation slice to a specialist/,
  'Plan solo; delegate every execution deliverable to a specialist.': /You delegate every domain implementation slice to a specialist/,
  'Verify-then-deliver: no workflow completes until its deterministic verification criteria pass.': /A red run dispatches diagnosis to the right specialist/,
  'Test-first ordering: author the failing test before implementation.': /Work test-first: the failing test comes before the implementation|Author the failing test first/,

  // ── Reviewers and indexers.
  'Exhaustive scanning precedes selective judgment.': /judge nothing until the sweeps are done/,
  'Read-only roles never mutate the filesystem.': /Read-only, always: never call a tool that writes/,
  'Evidence-based findings only: every claim cites file, line, and snippet.': /Evidence-based findings\.\*\* Every issue must cite file path, line number\(s\), and a\s+direct code snippet/,
  'Findings are recommendations only; the reviewer never executes or modifies.': /report the change as a recommendation instead/,
  'Every location claim cites its exact file path and line number.': /Every claim about a symbol location must include the exact file path\s+and line number/,
  'Ambiguity is documented, never guessed.': /document the ambiguity rather than guessing/,

  // ── Backend and frontend architects.
  'Audit before acting: inspect existing structure before generating new code.': /\*\*Audit Before Acting\.\*\* Always inspect existing schemas/,
  'Zero-trust data access: tenant data is policy-controlled at the row level.': /MUST have row-level security enabled at the database layer/,
  'Contracts evolve additively; breaking changes require a deprecation cycle.': /never make breaking contract changes without deprecation cycles/,
  'Every data access is parameterized; string concatenation into queries is forbidden.': /Always parameterize query arguments \(never string-concatenate\)/,
  'Structured completion reports conclude every execution; unrun gates are escalated, never asserted.': /Every execution concludes with a standardized `## Report` section/,
  'Single-responsibility components with typed props at every boundary.': /Keep components single-responsibility/,
  'Accessibility and Core Web Vitals budgets are release gates, not niceties.': /Check keyboard navigation and ARIA attributes against WCAG 2\.1 AA before you report/,

  // ── The digital-agency lead.
  'Consult at least one relevant specialist read-only before the delegation map, unless the user waives it.': /\*\*Consult before you map\.\*\*/,
  'The orchestrator delegates every expert deliverable and plans with the specialist council.': /You delegate every expert deliverable to a specialist/,
  'The consultation budget bounds planning: at most two planning rounds and two directed questions per specialist pair.': /at most two planning rounds and two directed questions per specialist pair/,
  'Verify-then-deliver: no deliverable ships until its deterministic verification criteria pass.': /are gates, not formalities: check the evidence/,
  'A brief lists the peers a specialist may message directly only when a live team session runs; otherwise peers are reached through the coordinator.': /In team mode \(Agent Teams on\) you list each peer a teammate may message directly/,

  // ── The three agency teammates.
  'Funnel and unit-economics audit precedes any channel or experiment recommendation.': /Name the funnel bottleneck[^\n]*before you recommend anything/,
  'Every experiment is a falsifiable hypothesis with a primary metric, a control and a variant.': /ready-to-execute experiment briefs with control\/variant specs and metrics/,
  'Brand identity and design-system review precedes any new visual concept.': /\*\*Review the identity first\.\*\*/,
  'Every text overlay meets the contrast floor and every critical element sits inside the safe zone.': /Keep critical typography and logos inside the 80% inner safe zone/,
  'Design tokens are handed to engineering as a fixed input before the production build starts.': /Design tokens go to the frontend architect as a fixed input before the production build starts/,
  'Funnel ingestion and friction audit precede any copy change.': /\*\*Ingest the funnel\.\*\*/,
  'Every test hypothesis is ICE-scored and states its primary metric and sample size.': /Score each hypothesis for Impact, Confidence and Ease/,
  'Every call to action carries a stable test identifier for automated checks.': /a stable `testId` on every call to action/,

  // ── The rest of the agency roster (ADR 0039): content, campaigns, SEO, QA and compliance.
  'Search intent and a read of the top-ranking competitor pages precede any content brief.': /\*\*Inspect the SERP first\.\*\* Search intent and a read of the top-ranking competitor pages come before any brief/,
  'Every content piece has one search intent and exactly one primary call to action.': /Every content piece has one search intent and exactly one primary call to action/,
  'Every cited statistic carries its publication year and its source.': /Every cited statistic carries its publication year and its source URL/,
  'Every outgoing campaign link carries the standard UTM parameters.': /Every outgoing link carries `utm_source`, `utm_medium`, `utm_campaign` and `utm_content`/,
  'Every email template carries a physical postal address, a one-click unsubscribe and a truthful sender identity.': /Every email template carries a physical postal address, a one-click unsubscribe and a truthful sender identity/,
  'Every campaign asset has exactly one primary call to action.': /Every campaign asset has exactly one primary call to action/,
  'Every sponsored or endorsed asset carries a clear disclosure.': /Every sponsored or endorsed asset carries a clear disclosure/,
  'Crawl and indexation reconnaissance precedes any recommendation.': /\*\*Crawl and indexation reconnaissance first\.\*\* Do it before you recommend anything/,
  'Every audit finding carries a severity and a concrete remediation.': /Every finding carries a severity \(critical, major or minor\) and a concrete remediation/,
  'Every structured-data block is checked against the rich-result requirements of its page type.': /Check every structured-data block against the rich-result requirements of its page type/,
  'Core Web Vitals are judged against the 75th-percentile thresholds.': /Judge the results against the 75th-percentile thresholds/,
  'A flaky test is quarantined and reported, never retried until green.': /A flaky test is quarantined and reported, never retried until it is green/,
  'Tests wait with auto-waiting assertions, never with fixed sleeps.': /Wait with auto-waiting assertions such as `expect\(locator\)\.toBeVisible\(\)`, never with fixed sleeps/,
  'A failing assertion is fixed at its cause or fails the gate, never masked.': /A failing assertion is fixed at its cause or fails the gate/,
  'Every viewport of the matrix is covered before sign-off.': /Run every viewport \(375 by 667, 768 by 1024, 1440 by 900\) before you sign off/,
  'The gate report states the run totals, the flaky count and the gate status.': /State the run totals \(passed, failed, flaky\), the duration and the gate status/,
  'Every control status cites the evidence that supports it.': /Every control status cites the evidence that supports it/,
  'Every gap carries a priority, a regulatory citation and a remediation step.': /Every gap carries a priority, a regulatory citation and a remediation step/,
  'Raw personal data met during an audit is never copied into a report.': /Never copy raw personal or health data you meet into a report or a policy/,
  'Questions for the user go to the calling lead in the final report, never to the user directly.': /Questions for the user go to the lead under `Open items`; you never ask the user directly/,
};

/** Per-role overrides: role name, then invariant text. */
export const ROLE_EVIDENCE: Record<string, Record<string, RegExp>> = {
  // The leads hand their result to the user, not to a spawner; each says where.
  'orchestrator-engineering': {
    [COMMS.handBack]: /You synthesise reports in the output contract above/,
    [COMMS.boundedExchange]: /wake a finished specialist with `SendMessage` when a peer's answer has to reach it/,
  },
  'orchestrator-digital-agency': {
    [COMMS.handBack]: /Deliver the output standard of the Output Contract/,
    [COMMS.boundedExchange]: /at most two exchanges per pair/,
  },
  // `repo-index` states "exhaustive before selective" in its floor.
  'repo-index': {
    'Exhaustive scanning precedes selective judgment.': /Exhaustive before selective\.\*\* Scan the entire repository before drawing conclusions/,
  },
};

/** The evidence rule for one role and invariant, or `undefined` when the role has none (it must then declare a delta). */
export function evidenceFor(role: string, invariant: string): RegExp | undefined {
  return ROLE_EVIDENCE[role]?.[invariant] ?? EVIDENCE[invariant];
}
