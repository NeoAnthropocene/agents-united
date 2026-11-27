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
  'Read the complete fixed brief before dispatch.': /Read the complete fixed brief before dispatch\./,
  'Verify actual final bytes against caller-held digests and baselines.': /Verify actual final bytes against caller-held digests and baselines\./,
  'Require independent review at the current candidate digest.': /Require independent review at the current candidate digest\./,
  'Repair only within the accepted count, scope and per-job budgets.': /Repair only within the accepted count, scope and per-job budgets\./,
  'Preserve previous revision evidence and invalidate stale acceptance.': /Preserve previous revision evidence and invalidate stale acceptance\./,
  'Report unperformed work as unverified.': /Report unperformed work as unverified\./,

  'Read the complete fixed review job before evaluating.': /Read the complete fixed review job and the caller-held job\/candidate digests before reviewing/,
  'Preserve the candidate and its declared review scope.': /Preserve the candidate and its declared review scope: read only the supplied subject\/support and selected evidence/,
  'Tie findings to supplied source pins and actual quoted lines.': /Tie findings to supplied source pins and actual quoted lines: include source ID, path \(candidate-relative, or the basename of a pinned input's file\), caller-provided hash and quote, severity\/confidence/,
  'Keep record consistency, evaluator judgment and live proof distinct.': /Keep record consistency, evaluator judgment and live proof distinct\. The caller runs validators and persists\/checks your result/,
  'Return missing required evidence without inventing approval.': /Return missing required evidence without inventing approval\. Apply the fixed rubric/,
  'Never mutate the workspace, registry, git state, lockfile or installed host projections, and never execute commands or compute hashes.': /Never mutate the workspace, registry, git state, lockfile or installed host projections, and never execute commands or compute hashes: you have no shell or editor/,
  'Never clear or advance a held source and never propose an edit to a held source; every held source remains "not advanced, no action".': /Never clear or advance a held source and never propose an edit to a held source; every held source remains "not advanced, no action"\./,
  'State honest limits explicitly — target list completeness is caller-supplied and cannot be proved, the old hash of an input not tracked by the lock is a claim, nothing is implemented by a plan, and live Host behaviour is unverified.': /State honest limits explicitly: target list completeness is caller-supplied and cannot be proved, the old hash of an input not tracked by library\.lock\.json is a caller claim/,
  'Read and preserve the complete fixed job before draft work.': /Read and preserve the complete fixed job before draft work\./,
  'Reuse the supplied shared definition without changing its meaning.': /Reuse the supplied shared definition without changing its meaning\./,
  'Author from reviewed target evidence rather than memory.': /Author from reviewed target evidence rather than memory\./,
  'Return actual file inventories and differences against the fixed baseline.': /Return actual file inventories and differences against the fixed baseline\./,
  'Unperformed checks remain unverified.': /Unperformed checks remain unverified\./,
  'Approved brand, copy and timing remain fixed until the lead approves a revision.': /Keep approved brand, copy and timing fixed until the lead approves a revision/,
  'An audio handoff must match the current timeline revision and canonical fingerprint before integration.': /require both the current timeline revision and canonical timeline fingerprint to match before integrating audio/,
  // ── The comms law (Plan 022), as bound by a Tier-2 teammate (and `frontend-architect`, which shares its wording) and by a Tier-1 specialist.
  [COMMS.handBack]: /A hand-off goes back to the agent that spawned you|Your final report is your one hand-?back/,
  [COMMS.boundedExchange]: /only when a peer'?s answer is genuinely required|if a peer'?s answer is genuinely needed, ask for it in your handoff/,
  [COMMS.twoExchanges]: /at most two exchanges per pair \(an exchange is one message and its reply\)/,
  [COMMS.inbox]: /\*\*Check your inbox before you finish, and do not wait for a reply\.\*\*/,
  [COMMS.report]: /\*\*Report sections, always present:\*\* `Peer messages received`[^\n]*`Open items`/,
  [COMMS.teamMode]: /\*\*Team mode\*\* is only for a live Agent Team, and then your brief lists each peer you may message directly by name with `SendMessage`/,
  [COMMS.consult]: /\*\*Planning consultation\.\*\* When the lead consults you before the plan is accepted, answer with a bounded scope-of-work statement/,
  // Two invariants a Tier 1 marketing specialist core may state beside the six shared ones; the Tier 1 peers section carries both as written.
  'Do not message a peer that has already finished; ask the coordinator to relay instead.': /A message to a teammate that has gone idle wakes it, but the lead owns the relay: when a peer has finished, ask the lead\./,
  'If an expected peer input never arrives, proceed on a stated assumption and list the gap under open items.': /\*\*Never hang on a missing peer\.\*\* Proceed on a stated assumption and list the gap under `Open items`\./,

  // ── Coordinators (the two leads share most of their wording).
  'When the final report or handoff leaves open items that only the user can settle, it ends by asking whether to settle them now or stop here; to settle them, grill-me runs with those items as its goal.': /end it by offering two choices: settle them now, or stop here\. [^\n]*run the Skill tool with `skill: "grill-me"` and the open items in `args`/,
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
  'Questions for the user go to the calling lead in the final report, never to the user directly.': /Questions for the user go to the lead as `ask-user` entries under `Requests for the lead`, and the lead returns the answers to you; you never ask the user directly/,
};

/** Per-role overrides: role name, then invariant text. */
export const ROLE_EVIDENCE: Record<string, Record<string, RegExp>> = {
  'agency-3d-designer': {
    'When delegated, route user questions through the calling lead; in direct standalone work, ask the user for missing brief inputs.': /When delegated, questions for the user go to the lead as `ask-user` entries under `Requests for the lead`, and the lead returns the answers to you; you never ask the user directly\. In direct standalone use, ask the user for missing brief inputs\./,
  },
  'ai-model-architect': {
    'Context passages below the similarity threshold trigger fallback responses rather than fabricated completions.': /- \*\*Hallucination Zero-Tolerance\*\*: Context passages with similarity score below threshold must trigger fallback responses rather than fabricated completions\./,
    'No raw customer PII is embedded or stored in vector payloads.': /- \*\*Privacy & PII Scrubbing\*\*: Never embed or store raw customer PII \(credit cards, social security numbers\) in vector payloads\./,
    'GPU-intensive jobs are checked against the declared cost ceiling before they are recommended or triggered; execution is blocked and escalated to the user when the ceiling would be exceeded.': /- \*\*GPU \/ Compute Cost Ceiling\*\*: Before recommending or triggering any GPU-intensive job \(fine-tuning, large-scale embedding, batch inference\), verify estimated spend against the team's declared cost ceiling\. Block execution and escalate to the user if the ceiling would be exceeded\./,
    'No API token, model access key or cloud credential value is logged, echoed or committed; only environment variable names are referenced.': /- \*\*Secrets & API Keys\*\*: Never log, echo, or commit API tokens, model access keys, or cloud credentials\. Reference environment variable names \(e\.g\., `\$OPENAI_API_KEY`\) only; never their values\./,
    'Citation extraction ensures every generated claim references exact chunk line numbers with verifiable source grounding links, and retrieved chunks are sanitized against prompt injection.': /verify citation extraction ensures every generated claim references exact chunk line numbers[\s\S]*- \*\*Strict Citation Standards\*\*: Output answers must maintain verifiable source grounding links\.[\s\S]*- \*\*Prompt Injection Defense\*\*: Sanitize all retrieved contextual chunks against malicious prompt injection directives\./,
    'Consult the named Skill before writing platform-specific code; report a missing skill instead of reasoning from memory.': /Load the matching skill with the `Skill` tool before you write platform-specific code\. A skill that is not installed is a gap to report in your handoff, not something to improvise from memory\./,
    'Hand your result back to the coordinator, not across to a peer.': /- \*\*Your final report is your one hand-back\.\*\* Do not use `SendMessage` to push results to the lead mid-run\./,
    'Message a peer directly only in team mode, when the brief lists that peer; otherwise put peer questions under open items.': /- \*\*Team mode\*\* is only for a live Agent Team, and then your brief lists each peer you may message directly by name with `SendMessage`\. Message a peer only when a peer's answer is genuinely required, at most two exchanges per pair \(an exchange is one message and its reply\) and one directed question per peer per planning round\. A message to a teammate that has gone idle wakes it, but the lead owns the relay: when a peer has finished, ask the lead\./,
  },
  'ml-platform-engineer': {
    'No hardcoded API key or GPU token appears in scripts, containers or logs.': /- \*\*Zero Secret Commits\*\*: Hardcoded API keys in Python\/Docker scripts are strictly forbidden\. Always use environment variables or secret managers \(`modal\.Secret`\)\./,
    'All user inference payloads are sanitized and no unencrypted PII is stored.': /- Never commit or log API keys \(`MODAL_TOKEN_ID`, `REPLICATE_API_TOKEN`, `RUNPOD_API_KEY`\)\. Ensure all user inference payloads are sanitized and no unencrypted PII is stored\./,
    'Every deployed serverless endpoint declares an explicit timeout (max 300s) and concurrency_limit.': /- \*\*Cost Ceilings\*\*: Every deployed serverless endpoint must declare an explicit `timeout` \(max 300s\) and `concurrency_limit` to prevent bill spikes\./,
    'Idle endpoints scale to zero (scaledown_window=60).': /auto-scaling down to 0 replicas on idle \(`scaledown_window=60`\)/,
    'Background polling loops enforce maximum retry counts and exponential backoffs; never poll tasks in a busy loop.': /- \*\*No Indefinite Loops\*\*: Background polling loops must enforce maximum retry counts and exponential backoffs\./,
    'Untrusted tenant workloads are never co-located on shared GPU physical memory.': /- \*\*Hardware Isolation\*\*: Prevent co-locating untrusted tenant workloads on shared GPU physical memory\./,
    'Consult the named Skill before writing platform-specific code; report a missing skill instead of reasoning from memory.': /Load the matching skill with the `Skill` tool before you write platform-specific code\. A skill that is not installed is a gap to report in your handoff, not something to improvise from memory\./,
    'Hand your result back to the coordinator, not across to a peer.': /- \*\*Your final report is your one hand-back\.\*\* Do not use `SendMessage` to push results to the lead mid-run\./,
    'Message a peer directly only in team mode, when the brief lists that peer; otherwise put peer questions under open items.': /- \*\*Team mode\*\* is only for a live Agent Team, and then your brief lists each peer you may message directly by name with `SendMessage`\. Message a peer only when a peer's answer is genuinely required, at most two exchanges per pair \(an exchange is one message and its reply\) and one directed question per peer per planning round\. A message to a teammate that has gone idle wakes it, but the lead owns the relay: when a peer has finished, ask the lead\./,
  },
  // The leads hand their result to the user, not to a spawner; each says where.
  'orchestrator-engineering': {
    [COMMS.handBack]: /You synthesise reports in the output contract above/,
    [COMMS.boundedExchange]: /wake a finished specialist with `SendMessage` when a peer's answer has to reach it/,
  },
  // The security lead: the engineering lead's wording for the shared invariants, plus the two security ones it states in its own body.
  'orchestrator-security': {
    [COMMS.handBack]: /You synthesise reports in the output contract above/,
    [COMMS.boundedExchange]: /wake a finished specialist with `SendMessage` when a peer's answer has to reach it/,
    'Assess only systems the user has asked you to assess, defensively; nothing is run against an external or production target.': /\*\*Defensive and authorised work only\.\*\*/,
    'The bound guard is a seat belt that stops only the common forms of a few commands; holding back everything else, and briefing specialists to do so, is the lead\'s own obligation.': /Holding these back, and briefing every specialist to hold them back, is your own obligation/,
  },
  // The design lead (a domain lead): the engineering lead's wording for the shared invariants, its own for the design ones.
  'orchestrator-design': {
    [COMMS.handBack]: /You synthesise reports in the output contract above/,
    [COMMS.boundedExchange]: /wake a finished specialist with `SendMessage` when a peer's answer has to reach it/,
    'Verify-then-deliver: no deliverable ships until its accessibility and responsive audit passes.': /A failed audit goes back to the owning specialist and does not go into a report as done/,
    'A specialist type that is not installed is handed back to the user with the `agents add` command, never improvised.': /you never pretend to have done it or improvise a specialist/,
    'Every deliverable honours the four boundary constraints: no cliché tropes, accessibility, compositor-only motion, fluid sizing.': /\*\*Boundary constraints\.\*\* Check every deliverable against all four/,
  },
  // The architecture lead: the shared coordinator wording (EVIDENCE) for most, its own for what the engineering lead does not state (no saved workflows, ADRs, bounded contexts, resilience, security routed to the user).
  'orchestrator-system-architecture': {
    [COMMS.handBack]: /You synthesise reports in the output contract above/,
    [COMMS.boundedExchange]: /wake a finished specialist with `SendMessage` when a peer's answer has to reach it/,
    'Consult at least one relevant specialist, read-only, before the delegation map, unless the user waives it.': /\*\*Consult before you map\.\*\* Before the delegation map, consult at least one relevant specialist with a short, read-only brief, unless the user waived it/,
    "A delegated code slice comes back with the failing-then-passing test output of the specialist's own test-first run.": /for code, the failing-then-passing test output from its own test-first run: you check the evidence, you do not redo the work/,
    'Verify-then-deliver: no deliverable completes until its deterministic verification criteria pass.': /A red run dispatches diagnosis to the right specialist/,
    'Every major architectural decision is recorded as an ADR under docs/adr/.': /Record decisions in `CONTEXT\.md` and as ADRs under `docs\/adr\/`/,
    'Bounded contexts are explicit and modules have no circular dependencies.': /Check every design for explicit bounded contexts with no circular dependencies between modules/,
    'Every network call in a design has a circuit breaker, a retry backoff and a fallback.': /and for a circuit breaker, a retry backoff and a fallback on every network call/,
    'Security architecture is recommended to the user as the security-operations bundle, never delegated by this lead.': /\*\*Security architecture is not delegated\.\*\* No type of this domain holds security work/,
  },
  // The growth-marketing lead (growth-marketing) shares the engineering lead's wording for what the defaults cover (align first, parallel slices, never loop on status, brief, relay, contract first, consult before you map).
  // The rest is worded for marketing: the delegation duty, the verify step and the four guardrails of the canonical agent. The five marketing roles need an entry only where their wording differs: their invariants are the agency copies' and
  // are bound by the default rules above, as long as the authored body keeps those sentences (the Tier 1 peers section of `devops-engineer` carries the comms ones). The one entry is the creative designer's, below.
  'orchestrator-marketing': {
    [COMMS.handBack]: /You synthesise reports in the output contract above/,
    [COMMS.boundedExchange]: /wake a finished specialist with `SendMessage` when a peer's answer has to reach it/,
    'Plan solo; delegate every execution deliverable to a specialist.': /You delegate every marketing deliverable to a specialist/,
    'Verify-then-deliver: no marketing deliverable ships until its checks pass.': /A failed check goes back to the right specialist/,
    'No marketing claim is misleading, no statistic is invented and no testimonial is fabricated.': /\*\*Authentic messaging\.\*\* Reject any deliverable with a misleading claim, an invented statistic or a fabricated testimonial/,
    'Every piece of marketing copy carries exactly one clear call to action.': /\*\*One call to action\.\*\* Every piece of copy carries exactly one clear call to action/,
    'Search metadata is unique per page: titles under 60 characters, descriptions under 155 characters, valid OpenGraph tags.': /\*\*Search metadata\.\*\* Titles are unique and under 60 characters, descriptions under 155 characters/,
    'Email work respects consent, GDPR and CAN-SPAM, and user data is never harvested without consent.': /\*\*Consent and compliance\.\*\* Email work respects consent, GDPR and CAN-SPAM/,
  },
  // The Tier-1 copy hands the tokens back to orchestrator-marketing because the marketing lead cannot spawn an engineering role: decided during the roll-out and open to the maintainer's review.
  'marketing-creative-designer': {
    'Design tokens are handed to engineering as a fixed input before the production build starts.': /Design tokens go back to `orchestrator-marketing` as a fixed input before the production build starts, for whoever builds the page/,
  },
  // The research lead: the shared coordinator wording (EVIDENCE) for most, its own for what the engineering lead does not state (evidence gathering is delegated, citations, the two-source spot-check, documentation only, recommended bundles).
  'orchestrator-research': {
    [COMMS.handBack]: /You synthesise reports in the output contract above/,
    [COMMS.boundedExchange]: /wake a finished specialist with `SendMessage` when a peer's answer has to reach it/,
    'Plan solo; delegate evidence gathering, logic audit, code mapping, quantitative work and prior-art search to specialists.': /You delegate evidence gathering, logic audit, code mapping, quantitative work and prior-art search to specialists/,
    'Consult at least one relevant specialist, read-only, before the delegation map, unless the user waives it.': /\*\*Consult before you map\.\*\* Before the delegation map, consult at least one relevant specialist with a short, read-only brief, unless the user waived it/,
    'The lead searches only to scope a request and to spot-check key claims; evidence gathering is delegated.': /You search only to scope a request and to spot-check key claims/,
    'Verify-then-deliver: no report completes until every claim is cited and every key claim passed the two-source spot-check.': /A claim that fails the spot-check goes back to the specialist that supplied it/,
    'Every empirical claim cites an explicit source, and no source is invented.': /Every empirical claim carries an explicit source URL or document reference; never invent a source/,
    'Key claims are checked against two independent primary sources before delivery.': /Check each key claim yourself against at least two independent primary sources/,
    'Project runtime source code is not changed; the output is research documentation only.': /Do not change project runtime source code \(`src\/`\); output research documentation only/,
    'Work beyond research synthesis is recommended to the user as a bundle, never delegated by this lead.': /\*\*Work beyond research synthesis is recommended, not delegated\.\*\*/,
  },
  // The business lead: the shared coordinator wording (EVIDENCE) for most; its own for what no other lead states (one document written by the lead, every figure read, one formula per metric, a cited source, the legal boundary, application source left alone, provisional estimates, types not installed).
  'orchestrator-business': {
    [COMMS.handBack]: /You synthesise reports in the output contract above/,
    [COMMS.boundedExchange]: /wake a finished specialist with `SendMessage` when a peer's answer has to reach it/,
    'Plan solo; delegate every execution deliverable to a specialist.': /You delegate every deliverable to a specialist/,
    'Shared definitions and assumptions are fixed once and handed to parallel specialists as fixed inputs.': /\*\*Definitions first\.\*\* When two or more pieces of work share a definition[^\n]*fix it once and hand it to the others as a fixed input before they start/,
    'The lead writes only the synthesis brief; the specialists write every other deliverable.': /You write only one document yourself: the synthesis brief, built from their reports/,
    "Every number in the synthesis is checked against the analyst's report and the stated formulas, and a figure the lead has not read is never passed on.": /\*\*Check every number\.\*\* Read each analyst's report and check every figure you synthesise against it and against the stated formulas\. You never pass on a figure you have not read/,
    'CAC, LTV, ARR and gross margin use one standard formula across all reports, and churn, discount rates and acquisition friction are accounted for.': /\*\*One formula per metric\.\*\* CAC, LTV, ARR and gross margin are standardized across every report\. A projection accounts for churn, discount rates and customer acquisition friction/,
    'Every strategic claim cites a primary source or a financial model.': /\*\*Cite a primary source or a model\.\*\* Every strategic claim in the brief names the primary source or the financial model behind it/,
    'Analysis by the legal contract analyst is carried with its boundary: structured technical and operational contract analysis, not formal legal representation or binding legal counsel.': /\*\*Carry the legal boundary\.\*\* Where the brief uses the legal contract analyst's analysis, it states, as a quotation, that this is "structured technical and operational contract analysis to support business decision-making, not formal legal representation or binding legal counsel"/,
    'The lead modifies no application source code and writes only strategy, documentation and roadmap files.': /\*\*Keep application source untouched\.\*\* No guard stops a write under `src\/`[^\n]*That is your own obligation/,
    'Provisional estimates during planning are labelled provisional, and a concrete deliverable waits for the accepted delegation map.': /\*\*Give provisional answers as provisional\.\*\* While you plan you may give the user estimates; label each as provisional and name its assumption\. A concrete deliverable waits for the accepted map/,
    'A specialist type that is not installed is recommended to the user, never improvised.': /\*\*Only delegate to a type in your allowlist and in the install record\.\*\* Never improvise a specialist/,
  },
  // The Prime Orchestrator (universal-orchestration): a front door that routes and holds no Agent tool. The route and consent invariants are bound in its own body; the four delegation invariants
  // (consult before a delegation map, delegate an in-session piece of work, the delegation brief, the relay) are not bound on this host and are declared in `registry/hosts/claude/deltas.json`.
  'orchestrator-universal': {
    'Resolve ambiguity with the user, in structured options, before routing: the domain, the deliverable and the scope are pinned first.': /to pin down the domain, the deliverable and the scope before you route/,
    'A request is classified into exactly one Department Domain through the Domain Atlas, never through the scope details of a department.': /Classify the request into exactly one Department Domain through the Atlas, never through the scope details of a department/,
    'When the Atlas has no match or looks stale, the installed registry is queried, and any drift is reported with the update command.': /query the installed registry with `agents find "<task>" --json`[^\n]*run `agents update universal-orchestration`/,
    "Nothing is installed without the user's explicit consent in the session.": /\*\*Ask for consent before every `agents add`\.\*\* Name the Bundle[^\n]*ask for an explicit yes in this session/,
    'When the user declines, the Atlas recommendation and the exact command for later are given, and no domain work is half-attempted.': /\*\*If the user declines,\*\* give the Atlas recommendation[^\n]*Do not install, and do not half-attempt the department's work/,
    'A department lead runs as the main agent of a fresh session: this orchestrator never takes its place and never loads its prompt into its own context.': /Never take its place in this session and never load its prompt into your own context/,
    'Every route ends with a structured hand-off: the route decision, the fit rationale, the consent and install status, the exact start command, a drift note if any, and the handoff reference.': /\*\*End every route with the structured hand-off\.\*\* Close with the route decision/,
    "An organizational bundle is routed to only when the user explicitly asks for it, and is never recommended on the orchestrator's own initiative.": /Never recommend it or install it on your own initiative/,
    "Work on another host CLI runs only on the user's explicit request, through host-agent-router, after consent for the hosts named.": /\*\*Work on another host CLI only when the user asks for it\.\*\* Load `\/host-agent-router`[^\n]*get a yes before its first run/,
  },
  'orchestrator-digital-agency': {
    [COMMS.handBack]: /Deliver the output standard of the Output Contract/,
    [COMMS.boundedExchange]: /at most two exchanges per pair/,
  },
  // `accessibility-lead`: its floor Safety lines and its own "How to work" steps state these. The comms invariants take the default evidence (the engineering family's peers section).
  'accessibility-lead': {
    'Never suppress, skip or lower the severity of an automated accessibility rule to make an audit pass; fix the underlying markup.': /- Never suppress, skip, or lower the severity of an automated accessibility rule to make an audit pass — fix the underlying markup\.(?=\n|$)/,
    'Semantic HTML is the first remedy and ARIA the fallback.': /- Never rely on `aria-\*` attributes to fix what a native semantic element would fix correctly on its own; semantic HTML is the first remedy, ARIA is the fallback\.(?=\n|$)/,
    'A fix that needs a design change is reported to the orchestrator, never shipped as a visually inconsistent workaround.': /- Report a fix that requires a design change \(e\.g\. insufficient color contrast in the design system\) to the orchestrator rather than shipping a visually inconsistent workaround\.(?=\n|$)/,
    'Consult the named Skill before applying its standard; report a missing Skill instead of improvising.': /Load the matching skill with the `Skill` tool before you apply its standard, rather than reasoning about WCAG success criteria from memory\. A skill that is not installed is a gap to report in your handoff, not something to improvise from memory\./,
  },
  // `deep-research`: the five research invariants are stated by its floor (scope boundaries and safety); the peer-messaging ones by its peers section, the engineering family's form.
  'deep-research': {
    'Prioritize official specs, official framework documentation and primary repositories over secondary sources.': /Always prioritize official specs \(W3C, IETF RFCs, ISO\), official framework documentation, and primary GitHub repositories/,
    'Cross-reference findings across at least 3 distinct sources before marking a claim as established fact.': /Cross-reference findings across at least 3 distinct sources before marking a claim as established fact/,
    'Clearly differentiate established specs, experimental features, community workarounds and vendor claims.': /Clearly differentiate between established specs, experimental features, community workarounds, and vendor claims/,
    'Never report unverified blog posts as technical specification facts.': /- Never report unverified blog posts as technical specification facts\.(?=\n|$)/,
    'Include publication/retrieval dates for all web citations.': /- Include publication\/retrieval dates for all web citations\.(?=\n|$)/,
    'Hand your result back to the coordinator, not across to a peer.': /- \*\*Your final report is your one hand-back\.\*\* Do not use `SendMessage` to push results to the lead mid-run\./,
    'Message a peer directly only in team mode, when the brief lists that peer; otherwise put peer questions under open items.': /- \*\*Team mode\*\* is only for a live Agent Team, and then your brief lists each peer you may message directly by name with `SendMessage`\. Message a peer only when a peer's answer is genuinely required, at most two exchanges per pair \(an exchange is one message and its reply\) and one directed question per peer per planning round\. A message to a teammate that has gone idle wakes it, but the lead owns the relay: when a peer has finished, ask the lead\./,
  },
  // `business-panel-experts`: its floor (scope boundaries) states the three business invariants, and the engineering family's peers section binds the peer ones under this core's longer texts.
  'business-panel-experts': {
    'Every revenue model or cost projection is grounded in industry benchmarks, published case studies, or explicit financial assumptions.': /Every revenue model or cost projection must be grounded in industry benchmarks, published case studies, or explicit financial assumptions\./,
    'Gross margin per user or transaction is calculated before projecting aggregate revenue.': /Always calculate gross margin per user\/transaction before projecting aggregate revenue\./,
    'Payback period metrics are provided for all proposed investments.': /Provide clear payback period metrics \(e\.g\. months to recover acquisition\/engineering costs\) for all proposed investments\./,
    'Hand your result back to the coordinator, not across to a peer.': /- \*\*Your final report is your one hand-back\.\*\* Do not use `SendMessage` to push results to the lead mid-run\./,
    'Message a peer directly only in team mode, when the brief lists that peer; otherwise put peer questions under open items.': /- \*\*Team mode\*\* is only for a live Agent Team, and then your brief lists each peer you may message directly by name with `SendMessage`\./,
    "Do not message the coordinator's main conversation mid-run; everything it needs goes into the final report.": /- \*\*Your final report is your one hand-back\.\*\* Do not use `SendMessage` to push results to the lead mid-run\./,
    'Never hang on a missing peer; proceed on a stated assumption and list the gap under open items.': /- \*\*Never hang on a missing peer\.\*\* Proceed on a stated assumption and list the gap under `Open items`\./,
  },
  // `financial-analyst`: its floor (scope boundaries) states the three finance invariants, and the engineering family's peers section binds the peer ones under this core's longer texts.
  'financial-analyst': {
    'Every monetization proposal is backed by transparent mathematical formulas and unit economics assumptions.': /Every monetization proposal must be backed by transparent mathematical formulas and unit economics assumptions/,
    'Financial models present three scenarios: Base Case, Conservative / Downside Case, and Optimistic / Growth Case.': /Always present three-scenario models: \*Base Case\*, \*Conservative \/ Downside Case\*, and \*Optimistic \/ Growth Case\*\./,
    'Underlying cloud infrastructure COGS are accounted for in Gross Margin calculations.': /Account for underlying infrastructure costs \(LLM token inference, vector storage, egress, database instances\) to calculate true Gross Margin/,
    'Hand your result back to the coordinator, not across to a peer.': /- \*\*Your final report is your one hand-back\.\*\* Do not use `SendMessage` to push results to the lead mid-run\./,
    'Message a peer directly only in team mode, when the brief lists that peer; otherwise put peer questions under open items.': /- \*\*Team mode\*\* is only for a live Agent Team, and then your brief lists each peer you may message directly by name with `SendMessage`\./,
    "Do not message the coordinator's main conversation mid-run; everything it needs goes into the final report.": /- \*\*Your final report is your one hand-back\.\*\* Do not use `SendMessage` to push results to the lead mid-run\./,
    'Never hang on a missing peer; proceed on a stated assumption and list the gap under open items.': /- \*\*Never hang on a missing peer\.\*\* Proceed on a stated assumption and list the gap under `Open items`\./,
  },
  // `market-intelligence-analyst`: its floor (scope boundaries) states the three market invariants, and the engineering family's peers section binds the peer ones under this core's longer texts.
  'market-intelligence-analyst': {
    'Top-down market reports are always complemented with a bottom-up TAM = Total Potential Accounts x ACV formula.': /Always complement top-down analyst reports with a bottom-up formula: `TAM = Total Potential Accounts x Annual Contract Value \(ACV\)`/,
    'Competitor assessments remain objective and evaluate strengths, proprietary datasets, network effects and switching costs realistically.': /Avoid ungrounded flattery or disparagement; assess competitor strengths, proprietary datasets, network effects, and switching costs realistically\./,
    'Proposed product features are explicitly evaluated against the 7 Powers framework.': /Explicitly evaluate proposed product features against Hamilton Helmer's 7 Powers/,
    'Hand your result back to the coordinator, not across to a peer.': /- \*\*Your final report is your one hand-back\.\*\* Do not use `SendMessage` to push results to the lead mid-run\./,
    'Message a peer directly only in team mode, when the brief lists that peer; otherwise put peer questions under open items.': /- \*\*Team mode\*\* is only for a live Agent Team, and then your brief lists each peer you may message directly by name with `SendMessage`\./,
    "Do not message the coordinator's main conversation mid-run; everything it needs goes into the final report.": /- \*\*Your final report is your one hand-back\.\*\* Do not use `SendMessage` to push results to the lead mid-run\./,
    'Never hang on a missing peer; proceed on a stated assumption and list the gap under open items.': /- \*\*Never hang on a missing peer\.\*\* Proceed on a stated assumption and list the gap under `Open items`\./,
  },
  // `legal-contract-analyst`: its floor (scope boundaries and safety) states the three legal invariants, and the engineering family's peers section binds the peer ones under this core's longer texts.
  'legal-contract-analyst': {
    'Any GPL or AGPL licensed code or libraries integrated into commercial proprietary codebases are strictly flagged.': /Strictly flag any GPL or AGPL licensed code or libraries integrated into commercial proprietary codebases/,
    'Contract analysis is framed as operational and technical support, never formal legal counsel.': /Provide structured technical and operational contract analysis to support business decision-making, not formal legal representation or binding legal counsel\./,
    'Every flagged contract clause includes a risk tier (Low, Medium, High, or Dealbreaker) and a concrete redline suggestion.': /Categorize contract clauses into Low, Medium, High, or Dealbreaker risk tiers with concrete redline suggestions/,
    'Hand your result back to the coordinator, not across to a peer.': /- \*\*Your final report is your one hand-back\.\*\* Do not use `SendMessage` to push results to the lead mid-run\./,
    'Message a peer directly only in team mode, when the brief lists that peer; otherwise put peer questions under open items.': /- \*\*Team mode\*\* is only for a live Agent Team, and then your brief lists each peer you may message directly by name with `SendMessage`\./,
    "Do not message the coordinator's main conversation mid-run; everything it needs goes into the final report.": /- \*\*Your final report is your one hand-back\.\*\* Do not use `SendMessage` to push results to the lead mid-run\./,
    'Never hang on a missing peer; proceed on a stated assumption and list the gap under open items.': /- \*\*Never hang on a missing peer\.\*\* Proceed on a stated assumption and list the gap under `Open items`\./,
  },
  // `operations-strategist`: its floor (scope boundaries) states the three operations invariants, and the engineering family's peers section binds the peer ones under this core's longer texts.
  'operations-strategist': {
    'Every Key Result is strictly quantifiable.': /Every Key Result must be strictly quantifiable/,
    'Vendor and tooling evaluations use transparent weighted scorecards across Security, Cost, Ease of Integration, and Vendor Longevity.': /apply transparent weighted scorecards across Security, Cost, Ease of Integration, and Vendor Longevity/,
    'Critical path dependencies and single points of failure (SPOF) are explicitly documented.': /Explicitly document critical path dependencies and single points of failure \(SPOF\) in personnel or vendor systems/,
    'Hand your result back to the coordinator, not across to a peer.': /- \*\*Your final report is your one hand-back\.\*\* Do not use `SendMessage` to push results to the lead mid-run\./,
    'Message a peer directly only in team mode, when the brief lists that peer; otherwise put peer questions under open items.': /- \*\*Team mode\*\* is only for a live Agent Team, and then your brief lists each peer you may message directly by name with `SendMessage`\./,
    "Do not message the coordinator's main conversation mid-run; everything it needs goes into the final report.": /- \*\*Your final report is your one hand-back\.\*\* Do not use `SendMessage` to push results to the lead mid-run\./,
    'Never hang on a missing peer; proceed on a stated assumption and list the gap under open items.': /- \*\*Never hang on a missing peer\.\*\* Proceed on a stated assumption and list the gap under `Open items`\./,
  },
  // `devops-engineer` (the factory pilot's first member): its floor Safety lines and its own "How to work" steps state these.
  'devops-engineer': {
    'No plaintext secret, token or connection string appears in a workflow file or IaC template.': /- Never commit a secret, token or connection string into a workflow file or IaC template; use repository or environment secrets and the platform secret manager, and prefer managed identities\.(?=\n|$)/,
    'Every container runs as a non-root user.': /- Never run a container as root; enforce an unprivileged user in every Dockerfile\.(?=\n|$)/,
    'No production container image uses the latest tag.': /- Never tag a production container image latest; pin an explicit semantic tag or digest\.(?=\n|$)/,
    'Production changes follow GitOps only: IaC plus CI/CD, never out-of-band.': /- Never modify a production cloud resource out-of-band; every change goes through IaC and CI\/CD \(GitOps\)\.(?=\n|$)/,
    'A preview deployment is never promoted to production by this role; the production command goes to the orchestrator for explicit user approval.': /- Never promote a preview deployment to production yourself; hand the production command to the orchestrator for explicit user approval\.(?=\n|$)/,
    'Consult the named Skill before writing platform-specific code; report a missing platform skill instead of improvising.': /Load the matching skill with `Skill` before writing platform-specific code\. A skill that is not installed is a gap to report in your handoff, not something to improvise from memory\./,
    // Messaging (maintainer decision on the pilot's point a): the engineering family's peers section (frontend-architect), bound under this core's longer invariant texts.
    'Hand your result back to the coordinator, not across to a peer.': /- \*\*Your final report is your one hand-back\.\*\* Do not use `SendMessage` to push results to the lead mid-run\./,
    'Message a peer directly only in team mode, when the brief lists that peer; otherwise put peer questions under open items.': /- \*\*Team mode\*\* is only for a live Agent Team, and then your brief lists each peer you may message directly by name with `SendMessage`\. Message a peer only when a peer's answer is genuinely required, at most two exchanges per pair \(an exchange is one message and its reply\) and one directed question per peer per planning round\. A message to a teammate that has gone idle wakes it, but the lead owns the relay: when a peer has finished, ask the lead\./,
  },
  // `security-engineer`: its floor Safety lines (the canonical agent's three guardrails word for word, plus the two boundary lines) and its own "How to work" steps state these.
  'security-engineer': {
    'Never execute destructive exploit payloads against external or production targets.': /- Never execute destructive exploit payloads against external or production targets\.(?=\n|$)/,
    'Do not output live API keys or production secrets in log files or reports; obscure with `****`.': /- Do not output live API keys or production secrets in log files or reports; obscure with `\*\*\*\*`\.(?=\n|$)/,
    'Refuse to disable TLS verification (`rejectUnauthorized: false`) in generated code.': /- Refuse to disable TLS verification \(`rejectUnauthorized: false`\) in generated code\.(?=\n|$)/,
    'Assess only code and systems the user has asked you to review; run a proof of concept only against local or test targets.': /- Assess only code and systems the user has asked you to review; run a proof of concept only against local or test targets\.(?=\n|$)/,
    'Do not run destructive shell commands such as recursive deletes, privilege escalation, shutdown or SQL DROP statements.': /- Do not run destructive shell commands such as recursive deletes, privilege escalation, shutdown or SQL DROP statements\.(?=\n|$)/,
    'Consult the named Skill before applying its method; report a missing skill instead of improvising from memory.': /Load the matching skill with `Skill` before applying its method\. A skill that is not installed is a gap to report in your handoff, not something to improvise from memory\./,
    'Hand your result back to the coordinator, not across to a peer.': /- \*\*Your final report is your one hand-back\.\*\* Do not use `SendMessage` to push results to the lead mid-run\./,
    'Message a peer directly only in team mode, when the brief lists that peer; otherwise put peer questions under open items.': /- \*\*Team mode\*\* is only for a live Agent Team, and then your brief lists each peer you may message directly by name with `SendMessage`\. Message a peer only when a peer's answer is genuinely required, at most two exchanges per pair \(an exchange is one message and its reply\) and one directed question per peer per planning round\. A message to a teammate that has gone idle wakes it, but the lead owns the relay: when a peer has finished, ask the lead\./,
  },
  // The design-systems-ops specialists: their floor Scope Boundaries and their own "How to work" steps state these. The peers invariants take the defaults above.
  'design-ops-lead': {
    'The existing component libraries and token files are scanned, and hard-coded styling values searched for, before token files are structured.': /\*\*Audit first\.\*\* List the UI component libraries and design token files[^\n]*search for hard-coded styling values/,
    'Design tokens sync deterministically between design assets and code tokens.': /Design tokens \(colors, typography, spacing, elevation\) must sync deterministically between design assets and code tokens/,
    'Every component handoff package specifies variants, interactive states, responsive breakpoints and ARIA patterns.': /Every component handoff package must specify component variants, interactive states \(hover, focus, active, disabled\), responsiveness breakpoints, and ARIA patterns\./,
    'Clear phase gates separate design exploration, spec freeze, engineering handoff and QA signoff.': /Establish clear phase gates between design exploration, spec freeze, engineering handoff, and QA signoff\./,
  },
  'design-systems-architect': {
    'Existing stylesheets, token manifests and components are read, and token drift identified, before any token is drafted.': /\*\*Inventory first\.\*\* Find the existing stylesheets, token JSON manifests and UI components[^\n]*before you draft anything\./,
    'Tokens follow a three-tier architecture: primitive, semantic and component tokens.': /Enforce a three-tier token architecture:/,
    'Every design system specification enforces WCAG 2.1 AAA contrast targets and explicit :focus-visible ring parameters.': /Every design system specification must enforce WCAG 2\.1 AAA contrast targets \(7:1 normal text, 4\.5:1 large text\/UI components\) and explicit \x60:focus-visible\x60 ring parameters\./,
    'No magic value remains: every property maps to a systematic scale token.': /Eliminate arbitrary pixel paddings, hardcoded hex values, or inline z-index numbers\. All properties must map to systematic scale tokens\./,
  },
  // The design-research-testing specialists: their floor Scope Boundaries and their own "How to work" steps state these. The peers invariants take the defaults above.
  'design-researcher': {
    'Existing user feedback, product requirements and session notes are read, and the key research questions documented, before synthesis.': /\*\*Ingest the research context first\.\*\* Find the user feedback[^\n]*before you synthesise anything\./,
    'Every design recommendation cites user data, interview quotes or an established HCI heuristic.': /Every design recommendation must cite user data, interview quotes, or established HCI heuristics/,
    'Every identified usability problem is paired with a specific, prioritized recommendation.': /Every identified usability problem must pair with a specific, prioritized recommendation\./,
    'Every usability issue is classified by severity as Critical, Major or Minor.': /Classify every issue as Critical \(blocks task\), Major \(causes significant delay or frustration\) or Minor \(cosmetic or inconvenience\)/,
  },
  'designer-toolkit-expert': {
    'AI-generated prototypes, specs and transcripts are inspected, and arbitrary CSS values searched for, before any token is extracted.': /\*\*Audit the prototype first\.\*\* Find the AI-generated prototype files[^\n]*before you extract anything\./,
    'Every design choice cites WCAG 2.1 AA accessibility standards, cognitive load principles or usability data.': /Every design choice must cite WCAG 2\.1 AA accessibility standards, cognitive load principles, or usability data\./,
    'Hardcoded colors, arbitrary spacing and bespoke border-radii of an AI prototype are extracted into centralized design tokens.': /Audit AI-generated prototypes \(v0, Lovable\) to extract hardcoded hex colors, arbitrary spacing \(\x60p-\[13px\]\x60\), and bespoke border-radii into centralized design tokens\./,
    'Interactive component primitives carry keyboard focus states and ARIA roles.': /Ensure all interactive primitives include keyboard focus states \(\x60focus-visible:ring-2\x60\) and ARIA roles\./,
    'Every major interface architecture decision is documented as a Design Decision Record with its context, options considered, final decision and expected impact.': /Document every major interface architecture decision: Context, Options Considered \(with Pros\/Cons and accessibility trade-offs\), Final Decision & Rationale, and Expected Impact Metrics\./,
  },
  'prototype-tester': {
    'Prototype specifications, user journey maps and wireframes are read, and the primary and secondary task flows mapped, before any evaluation.': /\*\*Scope the prototype first\.\*\* Find the prototype specifications[^\n]*before you evaluate\./,
    "Nielsen's 10 usability heuristics are applied to every evaluated screen or interactive flow.": /Apply Nielsen 10 Usability Heuristics to every evaluated screen or interactive flow\./,
    'Every heuristic violation is assigned a severity from 1 (cosmetic) to 4 (usability catastrophe).': /Assign severity ratings to every violation \(1 = Cosmetic, 2 = Minor, 3 = Major, 4 = Usability Catastrophe\)/,
    'Friction is quantified with Task Completion Rate, Estimated Time-on-Task, Click-Depth and Error Recovery Speed.': /Quantify friction using Task Completion Rate, Estimated Time-on-Task, Click-Depth, and Error Recovery Speed\./,
    'Empty states, extreme input lengths, network delay fallbacks and multi-device viewport breakdowns are stress-tested.': /Test empty states, extreme input lengths, network delay fallbacks, and multi-device viewport breakdowns\./,
    'Every identified UX friction point is paired with a concrete UI redesign recommendation.': /Pair every identified UX friction point with a concrete UI redesign recommendation\./,
  },
  // `cloud-security-architect`: its floor Safety lines (the canonical agent's directive and edge-case rules word for word, plus the boundary lines) and its own "How to work" steps state these.
  'cloud-security-architect': {
    'Assess only the cloud accounts, code and systems the user has asked you to assess.': /- Assess only the cloud accounts, code and systems the user has asked you to assess\.(?=\n|$)/,
    'Never hard-code or permit static cloud credentials.': /- Never hard-code or permit static cloud credentials\.(?=\n|$)/,
    'Wildcard permissions (`*` on `*`) are strictly prohibited.': /- Wildcard permissions \(`\*` on `\*`\) are strictly prohibited\.(?=\n|$)/,
    'Never create a KMS key policy without delegating key administration permissions to the root account or dedicated Break-Glass IAM role (`kms:*` with `Principal: "arn:aws:iam::ACCOUNT_ID:root"`).': /- Never create a KMS key policy without delegating key administration permissions to the root account or dedicated Break-Glass IAM role \(`kms:\*` with `Principal: "arn:aws:iam::ACCOUNT_ID:root"`\)\.(?=\n|$)/,
    'Never apply, destroy or change a live cloud resource or account yourself; hand the exact command to the orchestrator for explicit user approval.': /- Never apply, destroy or change a live cloud resource or account yourself; hand the exact command to the orchestrator for explicit user approval\.(?=\n|$)/,
    'Scan every Terraform module or Bicep template with Checkov\/Trivy before deployment, failing on high or critical severity findings.': /Scan every Terraform module or Bicep template with Checkov\/Trivy before deployment, failing on high or critical severity findings\./,
    'Do not run destructive shell commands such as recursive deletes, privilege escalation, shutdown, SQL DROP statements or resource group deletion.': /- Do not run destructive shell commands such as recursive deletes, privilege escalation, shutdown, SQL DROP statements or resource group deletion\.(?=\n|$)/,
    'Consult the named Skill before applying its method; report a missing skill instead of improvising from memory.': /Load the matching skill with `Skill` before applying its method\. A skill that is not installed is a gap to report in your handoff, not something to improvise from memory\./,
    'Hand your result back to the coordinator, not across to a peer.': /- \*\*Your final report is your one hand-back\.\*\* Do not use `SendMessage` to push results to the lead mid-run\./,
    'Message a peer directly only in team mode, when the brief lists that peer; otherwise put peer questions under open items.': /- \*\*Team mode\*\* is only for a live Agent Team, and then your brief lists each peer you may message directly by name with `SendMessage`\. Message a peer only when a peer's answer is genuinely required, at most two exchanges per pair \(an exchange is one message and its reply\) and one directed question per peer per planning round\. A message to a teammate that has gone idle wakes it, but the lead owns the relay: when a peer has finished, ask the lead\./,
  },
  // `appsec-penetration-tester`: its floor Safety lines (the canonical agent's directives, word for word) and its own "How to work" steps state these.
  'appsec-penetration-tester': {
    'Never execute payloads that mutate production data, perform denial-of-service, or corrupt state. All penetration testing assertions must execute against local mock fixtures or unit test boundaries.': /- Never execute payloads that mutate production data, perform denial-of-service, or corrupt state\. All penetration testing assertions must execute against local mock fixtures or unit test boundaries\.(?=\n|$)/,
    'Every vulnerability identified MUST be accompanied by a failing unit/integration test (reproducing the flaw) followed by a code patch that passes the test (strict TDD).': /- Every vulnerability identified MUST be accompanied by a failing unit\/integration test \(reproducing the flaw\) followed by a code patch that passes the test \(strict TDD\)\.(?=\n|$)/,
    'Never ask the user clarifying questions directly — escalate critical risks or unresolvable architectural flaws to the calling orchestrator in your structured report.': /- Never ask the user clarifying questions directly — escalate critical risks or unresolvable architectural flaws to the calling orchestrator in your structured report\.(?=\n|$)/,
    'Assess only code and systems the user has asked you to review; run proofs of concept only within local mock fixtures or unit test boundaries.': /- Assess only code and systems the user has asked you to review; run proofs of concept only within local mock fixtures or unit test boundaries\.(?=\n|$)/,
    'Do not run destructive shell commands such as recursive deletes, privilege escalation, shutdown or SQL DROP statements.': /- Do not run destructive shell commands such as recursive deletes, privilege escalation, shutdown or SQL DROP statements\.(?=\n|$)/,
    'Consult the named Skill before applying its method; report a missing skill instead of improvising from memory.': /Load the matching skill with `Skill` before applying its method\. A skill that is not installed is a gap to report in your handoff, not something to improvise from memory\./,
    'Hand your result back to the coordinator, not across to a peer.': /- \*\*Your final report is your one hand-back\.\*\* Do not use `SendMessage` to push results to the lead mid-run\./,
    'Message a peer directly only in team mode, when the brief lists that peer; otherwise put peer questions under open items.': /- \*\*Team mode\*\* is only for a live Agent Team, and then your brief lists each peer you may message directly by name with `SendMessage`\. Message a peer only when a peer's answer is genuinely required, at most two exchanges per pair \(an exchange is one message and its reply\) and one directed question per peer per planning round\. A message to a teammate that has gone idle wakes it, but the lead owns the relay: when a peer has finished, ask the lead\./,
  },
  // `compliance-grc-specialist`: the shared core's invariants are stated by its "How to work" steps and the security family's peers section; the
  // peers section of that family has no planning-consultation bullet, so the role states the consultation rule in its own step 8.
  'compliance-grc-specialist': {
    [COMMS.consult]: /When the lead consults you before the plan is accepted, answer with a bounded scope-of-work statement[^\n]*write no deliverable file/,
  },
  // The product-design specialists: their floor Safety lines and Scope Boundaries, and their own "How to work" steps, state these. The peers invariants take the defaults above.
  'interaction-designer': {
    'Existing animation code is read, and its name conflicts identified, before new motion is added.': /\*\*Audit the motion first\.\*\* Find the existing components, stylesheets and animation code[^\n]*`@keyframes` names your new ones would collide with\./,
    'Only transform and opacity are animated; no layout-triggering property is.': /Animate only compositor-promoted properties: `transform` and `opacity`\./,
    'A prefers-reduced-motion block is written together with every animation.': /Write the `prefers-reduced-motion: reduce` block simultaneously with every animation\./,
    'No blinking or flashing animation is implemented, and no infinite animation lacks an accessible pause control.': /- Refuse to implement blinking or flashing animations \(WCAG 2\.3\.1 — seizure risk\)\.\n- Never use `animation-iteration-count: infinite` without an accessible pause control\./,
    'Every View Transitions implementation has a feature-detection guard and a CSS-only fallback.': /\*\*View Transitions API\*\* — [^\n]*Always provide a CSS-only fallback\.[\s\S]*\n- All View Transitions implementations must include a feature-detection guard\./,
  },
  // `system-architect`: its floor Safety lines and Scope Boundaries state the domain invariants, its own "How to work" the discovery step; the peers
  // section is the engineering family's (as `devops-engineer` binds it, under this core's longer invariant texts).
  'system-architect': {
    'No architecture with a single point of failure is approved for production.': /- Never approve architectures with single points of failure \(SPOF\) for production environments\.(?=\n|$)/,
    'Every external data boundary enforces strict input validation and encryption in transit (TLS 1.3).': /- Ensure all external data boundaries enforce strict input validation and encryption in transit \(TLS 1\.3\)\.(?=\n|$)/,
    'Services do not share a database: each bounded context owns its data.': /Refuse a distributed monolith: services do not share a database; give each bounded context its own data \(database-per-service\)\./,
    'Every major architectural decision is recorded as an ADR with Context, Decision, Consequences and Status.': /\*\*Architecture Decision Records \(ADRs\)\*\* — Document major architectural decisions following Nygard \/ MADR templates \(Context, Decision, Consequences, Status\)\./,
    'Map the existing system before designing: read the module layout, APIs and data models first.': /\*\*Map first\.\*\* Read the existing module layout, APIs and data models with `Glob`, `Grep` and `Read` before you design anything\./,
    'Non-functional requirements carry measurable targets: SLA, SLO, throughput, p99 latency, availability and disaster recovery.': /\*\*Non-Functional Requirements \(NFRs\)\*\* — Enforce SLA, SLO, throughput \(RPS\), latency \(p99\), availability \(99\.99%\), and disaster recovery targets\./,
    'Hand your result back to the coordinator, not across to a peer.': /- \*\*Your final report is your one hand-back\.\*\* Do not use `SendMessage` to push results to the lead mid-run\./,
    'Message a peer directly only in team mode, when the brief lists that peer; otherwise put peer questions under open items.': /- \*\*Team mode\*\* is only for a live Agent Team, and then your brief lists each peer you may message directly by name with `SendMessage`\. Message a peer only when a peer's answer is genuinely required, at most two exchanges per pair \(an exchange is one message and its reply\) and one directed question per peer per planning round\. A message to a teammate that has gone idle wakes it, but the lead owns the relay: when a peer has finished, ask the lead\./,
  },
  // `sysops-sre-lead`: its floor Scope Boundaries state the domain invariants (directive 1 and the four forbidden anti-patterns), its own "How to work" the
  // inspection step; the peers section is the engineering family's, as `system-architect` binds it.
  'sysops-sre-lead': {
    'Reliability is governed by Service Level Objectives, Service Level Indicators and error budgets.': /\*\*Uptime & SLA\/SLO Management\*\* — Define Service Level Objectives \(SLOs\), Service Level Indicators \(SLIs\), and error budgets/,
    'Alerts fire on symptoms that affect SLOs, not on transient blips.': /- Refuse alert fatigue \(noisy non-actionable alerts\)[^\n]*alert on symptoms affecting SLOs, not transient blips\./,
    'No single point of failure: infrastructure is redundant across zones or regions.': /- Refuse single point of failure \(SPOF\) infrastructure[^\n]*use multi-AZ and multi-region redundancy\./,
    'No manual, undocumented server change: changes go through managed automation and runbooks.': /- Refuse manual un-documented server changes[^\n]*use managed infrastructure automation and runbooks\./,
    'A disaster recovery backup counts only after an automated restoration drill has proven it.': /- Refuse untested disaster recovery backups[^\n]*prove them with automated backup restoration drills\./,
    'Inspect the existing telemetry configuration and SLI metrics before triaging or designing.': /\*\*Inspect first\.\*\* Read the existing telemetry configuration and SLI metrics with `Glob`, `Grep` and `Read` before you triage or design anything: /,
    'Hand your result back to the coordinator, not across to a peer.': /- \*\*Your final report is your one hand-back\.\*\* Do not use `SendMessage` to push results to the lead mid-run\./,
    'Message a peer directly only in team mode, when the brief lists that peer; otherwise put peer questions under open items.': /- \*\*Team mode\*\* is only for a live Agent Team, and then your brief lists each peer you may message directly by name with `SendMessage`\. Message a peer only when a peer's answer is genuinely required, at most two exchanges per pair \(an exchange is one message and its reply\) and one directed question per peer per planning round\. A message to a teammate that has gone idle wakes it, but the lead owns the relay: when a peer has finished, ask the lead\./,
  },
  // `cloud-infrastructure-architect`: its floor Scope Boundaries state the four Primary Directives (the domain invariants) and its Safety the provisioning handback; its own "How to work" the inspection and skill steps; the peers section is the engineering family's.
  'cloud-infrastructure-architect': {
    'Single points of failure are eliminated across availability zones and regions, and stateful tiers fail over automatically across zones.': /\*\*High Availability by Design\.\*\* Eliminate single points of failure across availability zones \(AZs\) and regions\. Architect all stateful tiers with automated multi-AZ failover\./,
    'Internal databases and services are not exposed to the public internet: inter-service traffic uses private service endpoints.': /\*\*Network Isolation & Zero-Trust Interconnects\.\*\* Mandate PrivateLink and private service endpoints[^\n]*avoid exposing internal databases or microservices to the public internet\./,
    'Infrastructure-as-code modules declare clear inputs and outputs, state locking and strict semantic versioning.': /\*\*Deterministic IaC Structure\.\*\* Structure all Terraform\/Bicep modules with clear inputs, outputs, state locking \(S3\/DynamoDB or GCS\), and strict semantic versioning\./,
    'Topologies carry automated health checks, circuit breakers and graceful degradation for regional outages.': /\*\*Resilience & Chaos Engineering\.\*\* Design topologies with automated health checks, circuit breakers, and graceful degradation during regional cloud outages\./,
    'Inspect the existing network, cluster and infrastructure-as-code layout before designing.': /\*\*Inspect first\.\*\* Read the existing network, cluster and infrastructure-as-code layout with `Glob`, `Grep` and `Read` before you design anything: /,
    'Consult the matching Skill before designing in a domain it covers; report a missing skill instead of improvising.': /Load the matching skill with `Skill` before you design in a domain it covers\. A skill that is not installed is a gap to report in your handoff, not something to improvise from memory\./,
    'No resource in a real cloud account is provisioned or changed by this role; the exact command goes to the orchestrator for explicit user approval unless the brief authorises it.': /- Never apply, provision or change a resource in a real cloud account yourself; hand the exact command to the orchestrator for explicit user approval unless your brief authorises it\.(?=\n|$)/,
    'Hand your result back to the coordinator, not across to a peer.': /- \*\*Your final report is your one hand-back\.\*\* Do not use `SendMessage` to push results to the lead mid-run\./,
    'Message a peer directly only in team mode, when the brief lists that peer; otherwise put peer questions under open items.': /- \*\*Team mode\*\* is only for a live Agent Team, and then your brief lists each peer you may message directly by name with `SendMessage`\. Message a peer only when a peer's answer is genuinely required, at most two exchanges per pair \(an exchange is one message and its reply\) and one directed question per peer per planning round\. A message to a teammate that has gone idle wakes it, but the lead owns the relay: when a peer has finished, ask the lead\./,
  },
  // `database-administrator`: its floor Scope Boundaries state the four Primary Directives (the domain invariants) and its Safety the live-database handback; its own "How to work" the inspection and skill steps; the peers section is the engineering family's.
  'database-administrator': {
    'Schema changes never take a blocking lock: no table-rewriting column change and no non-concurrent index creation.': /\*\*Zero-Locking DDL Policy\.\*\* Never execute blocking schema changes \(`ALTER TABLE \.\.\. ADD COLUMN \.\.\. DEFAULT \.\.\.` on large tables without PostgreSQL 11\+ fast-default semantics, or non-concurrent index creation\)\. Always use `CREATE INDEX CONCURRENTLY`\./,
    'A schema change that spans several deployments follows the three Expand and Contract phases: expand, backfill and switch reads, contract.': /\*\*Expand and Contract Migration Discipline\.\*\* Schema modifications spanning multiple deployments must follow 3 phases: \(1\) Expand \(add nullable column & dual-write\), \(2\) Backfill & Switch reads, \(3\) Contract \(drop deprecated columns safely\)\./,
    'Queries are optimised by inspecting buffer hit and read ratios, and disk spill sorts are eliminated.': /\*\*Query Optimization via Buffer Inspection\.\*\* Optimize for minimal shared buffer hit\/read ratios and eliminate disk spill sorts\./,
    'Migration rollbacks and idempotency are verified in isolated test databases.': /\*\*Automated Migration Testing\.\*\* Verify migration rollbacks and idempotency in isolated test databases\./,
    'Inspect the existing database configuration, migrations and query plans before changing anything.': /\*\*Inspect first\.\*\* Read the existing database configuration, migrations and query plans with `Glob`, `Grep` and `Read` before you change anything: /,
    'Consult the matching Skill before designing in a domain it covers; report a missing skill instead of improvising.': /Load the matching skill with `Skill` before you design in a domain it covers\. A skill that is not installed is a gap to report in your handoff, not something to improvise from memory\./,
    'No migration, schema change or data change runs against a database that is not disposable by this role; the exact command goes to the orchestrator for explicit user approval unless the brief authorises it.': /- Never run a migration, a schema change or a data change against a database that is not disposable \(staging, production, a shared development database\) yourself; hand the exact command to the orchestrator for explicit user approval unless your brief authorises it\.(?=\n|$)/,
    'Hand your result back to the coordinator, not across to a peer.': /- \*\*Your final report is your one hand-back\.\*\* Do not use `SendMessage` to push results to the lead mid-run\./,
    'Message a peer directly only in team mode, when the brief lists that peer; otherwise put peer questions under open items.': /- \*\*Team mode\*\* is only for a live Agent Team, and then your brief lists each peer you may message directly by name with `SendMessage`\. Message a peer only when a peer's answer is genuinely required, at most two exchanges per pair \(an exchange is one message and its reply\) and one directed question per peer per planning round\. A message to a teammate that has gone idle wakes it, but the lead owns the relay: when a peer has finished, ask the lead\./,
  },
  // `finops-cost-engineer`: its floor Scope Boundaries state the four Primary Directives (the domain invariants) and its Safety the spend-changing handback; its own "How to work" the inspection and skill steps; the peers section is the engineering family's.
  'finops-cost-engineer': {
    'Rightsizing and spot transitions are never recommended for single-node stateful workloads where they would violate availability SLAs.': /\*\*Safety-First Cost Optimization\.\*\* Never recommend rightsizing or spot transitions for single-node stateful workloads \(like primary relational databases\) that would violate availability SLAs\./,
    'Every cost metric is formulated in unit economics terms, such as cost per active user, per API query or per thousand tokens generated.': /\*\*Cost-Per-Unit Transparency\.\*\* Formulate cost metrics in unit economics terms \(e\.g\. Cost per active user, cost per API query, cost per 1k token generation\)\./,
    'Automated threshold alerts on daily cloud billing deltas above 20 percent are architected proactively.': /\*\*Automated Budget Alerts & Anomalies\.\*\* Proactively architect automated Slack\/PagerDuty threshold alerts on daily cloud billing deltas \(>20% anomalies\)\./,
    'Every recommendation carries clear monthly and annual dollar savings and an implementation effort estimate.': /\*\*Quantified ROI Deliverables\.\*\* Present all recommendations with clear monthly\/annual \\\$ savings and implementation effort estimations\./,
    'Inspect the existing cost and infrastructure evidence before recommending anything.': /\*\*Inspect first\.\*\* Read the existing cost and infrastructure evidence with `Glob`, `Grep` and `Read` before you recommend anything: /,
    'Consult the matching Skill before designing in a domain it covers; report a missing skill instead of improvising.': /Load the matching skill with `Skill` before you design in a domain it covers\. A skill that is not installed is a gap to report in your handoff, not something to improvise from memory\./,
    'No command that changes spend or capacity runs by this role; the exact command goes to the orchestrator for explicit user approval.': /- Never run a command that changes spend or capacity \(buying Reserved Instances or Savings Plans, resizing, moving workloads to spot capacity, deleting resources\) yourself; hand the exact command to the orchestrator for explicit user approval\.(?=\n|$)/,
    'Hand your result back to the coordinator, not across to a peer.': /- \*\*Your final report is your one hand-back\.\*\* Do not use `SendMessage` to push results to the lead mid-run\./,
    'Message a peer directly only in team mode, when the brief lists that peer; otherwise put peer questions under open items.': /- \*\*Team mode\*\* is only for a live Agent Team, and then your brief lists each peer you may message directly by name with `SendMessage`\. Message a peer only when a peer's answer is genuinely required, at most two exchanges per pair \(an exchange is one message and its reply\) and one directed question per peer per planning round\. A message to a teammate that has gone idle wakes it, but the lead owns the relay: when a peer has finished, ask the lead\./,
  },
  // `literature-patent-analyst`: the five role invariants are bound by sentences of its own "How to review" steps; the peer-messaging ones by the engineering family's peers section.
  'literature-patent-analyst': {
    'Cite all reviewed papers using standard BibTeX / APA formats with title, authors, year, conference/journal venue, and DOI or arXiv identifier.': /Cite every paper in BibTeX or APA with title, authors, year, venue and a DOI or arXiv identifier/,
    'Dissect reported peak metrics alongside hardware configurations, dataset composition, and failure modes.': /Record, beside the reported peak metrics, the hardware \(GPU count, training hours\), the dataset composition and the failure modes/,
    'Distinguish between independent broad patent claims and narrow dependent limitations.': /separate independent broad claims from narrow dependent limitations/,
    'Present findings in comparative tables highlighting architecture, dataset, baseline metric delta, and computational cost.': /Present findings in a comparative table \(architecture, dataset, baseline metric delta, computational cost\)/,
    'Never ask the user clarifying questions directly; escalate domain research scope or query ambiguities to the calling orchestrator in the final report.': /An ambiguity in the scope goes to the lead as an `ask-user` entry under `Requests for the lead`; you never ask the user directly\./,
    'Hand your result back to the coordinator, not across to a peer.': /- \*\*Your final report is your one hand-back\.\*\* Do not use `SendMessage` to push results to the lead mid-run\./,
    'Message a peer directly only in team mode, when the brief lists that peer; otherwise put peer questions under open items.': /- \*\*Team mode\*\* is only for a live Agent Team, and then your brief lists each peer you may message directly by name with `SendMessage`\. Message a peer only when a peer's answer is genuinely required, at most two exchanges per pair \(an exchange is one message and its reply\) and one directed question per peer per planning round\. A message to a teammate that has gone idle wakes it, but the lead owns the relay: when a peer has finished, ask the lead\./,
  },
  // `distributed-systems-architect` (Bundle `backend-distributed-systems`): its floor Safety lines and its own "How to work" steps state these.
  'distributed-systems-architect': {
    'Every distributed write path has an idempotency key or deduplication strategy; at-least-once delivery is the default assumption.': /- Never design a distributed write path without an idempotency key or dedup strategy — at-least-once delivery is the default assumption\.(?=\n|$)/,
    'Every distributed lock has an explicit, safe lease expiration; no indefinite locks are introduced.': /- Never introduce a distributed lock without an explicit, safe lease expiration \(no indefinite locks\)\.(?=\n|$)/,
    "Service boundary changes never break an existing consumer's contract without a versioned, additive migration path.": /- Never make a service boundary change that breaks an existing consumer's contract without a versioned, additive migration path\.(?=\n|$)/,
    'A validation or test gate that cannot run in this environment is reported as not run, never as passing.': /report it as not run instead of asserting success\./,
    'Consult the named Skill before writing platform-specific code; report a missing platform skill instead of improvising.': /Load the matching skill with the `Skill` tool before you design platform-specific service or schema code\. A skill that is not installed is a gap to report in your handoff, not something to improvise from memory\./,
    'Hand your result back to the coordinator, not across to a peer.': /- \*\*Your final report is your one hand-back\.\*\* Do not use `SendMessage` to push results to the lead mid-run\./,
    'Message a peer directly only in team mode, when the brief lists that peer; otherwise put peer questions under open items.': /- \*\*Team mode\*\* is only for a live Agent Team, and then your brief lists each peer you may message directly by name with `SendMessage`\. Message a peer only when a peer's answer is genuinely required, at most two exchanges per pair \(an exchange is one message and its reply\) and one directed question per peer per planning round\. A message to a teammate that has gone idle wakes it, but the lead owns the relay: when a peer has finished, ask the lead\./,
  },
  // `data-engineer` (Bundle `backend-distributed-systems`): its floor Safety lines and its own "How to work" steps state these.
  'data-engineer': {
    'No destructive DDL statement (DROP TABLE, DROP COLUMN, TRUNCATE) is run without a backward-compatible expand-and-contract migration path.': /- Never run a destructive DDL statement \(`DROP TABLE`\/`DROP COLUMN`\/`TRUNCATE`\) without a backward-compatible expand-and-contract migration path\.(?=\n|$)/,
    'All database queries are parameterized; string-concatenated SQL is never used regardless of source.': /- Never bypass parameterized queries; string-concatenated SQL is forbidden regardless of the source \(user input or internal config\)\.(?=\n|$)/,
    'Isolation levels are never weakened and foreign-key constraints are never dropped to work around a failing test.': /- Never weaken an isolation level or drop a foreign-key constraint to work around a failing test — fix the underlying data model\.(?=\n|$)/,
    'A query plan or migration gate that cannot run in this environment is reported as not run, never as passing.': /report it as not run instead of asserting success\./,
    'Consult the named Skill before writing platform-specific code; report a missing platform skill instead of improvising.': /Load the matching skill with the `Skill` tool before you design platform-specific schema or pipeline code\. A skill that is not installed is a gap to report in your handoff, not something to improvise from memory\./,
    'Hand your result back to the coordinator, not across to a peer.': /- \*\*Your final report is your one hand-back\.\*\* Do not use `SendMessage` to push results to the lead mid-run\./,
    'Message a peer directly only in team mode, when the brief lists that peer; otherwise put peer questions under open items.': /- \*\*Team mode\*\* is only for a live Agent Team, and then your brief lists each peer you may message directly by name with `SendMessage`\. Message a peer only when a peer's answer is genuinely required, at most two exchanges per pair \(an exchange is one message and its reply\) and one directed question per peer per planning round\. A message to a teammate that has gone idle wakes it, but the lead owns the relay: when a peer has finished, ask the lead\./,
  },
  // `e2e-tester` (Bundle `qa-automation`): its floor Safety lines and its own "How to work" steps state these.
  'e2e-tester': {
    'Elements are located by role, label or test identifier, never by brittle CSS or XPath selectors.': /Locate elements by role, label or test identifier \(`getByRole`, `getByLabel`, `getByTestId`\), never by brittle CSS or XPath selectors\./,
    'Page interactions live in Page Object classes, not repeated across specs.': /Put page interactions in Page Object classes, not repeated across specs\./,
    'A flaky test is never skipped silently: it is quarantined and reported to the lead.': /A flaky test is never skipped silently: quarantine it and report it to the lead/,
    'A captured storage state or any other credential or session artifact is never committed to source control.': /- Never commit a captured `storageState\.json` or other credential\/session artifact to source control\.(?=\n|$)/,
    'A suite that cannot run is reported as not run, never as passing.': /report it as not run instead of asserting success\./,
    'Consult the named Skill before authoring or debugging a spec; report a missing skill instead of improvising.': /Load the matching skill with the `Skill` tool before you author or debug a spec\. A skill that is not installed is a gap to report in your handoff, not something to improvise from memory\./,
  },
  // The mobile-development roles (Bundle mobile-development): their floor Safety lines and their own "How to work" steps state these.
  'ios-architect': {
    'No signing certificate, provisioning profile or API key is hardcoded or committed into source.': /- Never commit a signing certificate, provisioning profile, or API key into source;/,
    'Every privacy-sensitive permission has a matching Info.plist usage-description string and requests no more than the feature needs.': /- Never request a privacy-sensitive permission without the matching `Info\.plist` usage-description string, and never request more than the feature needs\./,
    'Before shipping a SwiftUI view, check closures capturing `self` for retain cycles.': /Before shipping a SwiftUI view, check closures capturing `self` for retain cycles\./,
    'Build and test verification gates are run before reporting complete, or the inability to run them is stated explicitly.': /say so explicitly and report that gate as not run instead of asserting success\./,
    'Consult the named Skill before writing platform-specific code; report a missing skill instead of improvising from memory.': /Load the matching skill with the `Skill` tool before you write platform-specific code\. A skill that is not installed is a gap to report in your handoff, not something to improvise from memory\./,
    'Hand your result back to the coordinator, not across to a peer.': /- \*\*Your final report is your one hand-back\.\*\* Do not use `SendMessage` to push results to the lead mid-run\./,
    'Message a peer directly only in team mode, when the brief lists that peer; otherwise put peer questions under open items.': /- \*\*Team mode\*\* is only for a live Agent Team, and then your brief lists each peer you may message directly by name with `SendMessage`\. Message a peer only when a peer's answer is genuinely required, at most two exchanges per pair \(an exchange is one message and its reply\) and one directed question per peer per planning round\. A message to a teammate that has gone idle wakes it, but the lead owns the relay: when a peer has finished, ask the lead\./,
  },
  'android-architect': {
    'No signing key, keystore password or API key is hardcoded or committed into source.': /- Never commit a signing key, keystore password, or API key into source;/,
    'Runtime permissions and scoped storage declarations follow least privilege for the feature.': /- Never request a runtime permission the feature does not use; follow least-privilege scoped storage and permission declarations\./,
    'Every Compose recomposition fix is measured and reported with its measurement, not just the change.': /- Never ship a Compose recomposition fix without measuring it \(Layout Inspector \/ recomposition counts\)/,
    'Build and test verification gates are run before reporting complete, or the inability to run them is stated explicitly.': /say so explicitly and report that gate as not run instead of asserting success\./,
    'Consult the named Skill before writing platform-specific code; report a missing skill instead of improvising from memory.': /Load the matching skill with the `Skill` tool before you write platform-specific code\. A skill that is not installed is a gap to report in your handoff, not something to improvise from memory\./,
    'Hand your result back to the coordinator, not across to a peer.': /- \*\*Your final report is your one hand-back\.\*\* Do not use `SendMessage` to push results to the lead mid-run\./,
    'Message a peer directly only in team mode, when the brief lists that peer; otherwise put peer questions under open items.': /- \*\*Team mode\*\* is only for a live Agent Team, and then your brief lists each peer you may message directly by name with `SendMessage`\. Message a peer only when a peer's answer is genuinely required, at most two exchanges per pair \(an exchange is one message and its reply\) and one directed question per peer per planning round\. A message to a teammate that has gone idle wakes it, but the lead owns the relay: when a peer has finished, ask the lead\./,
  },
  'cross-platform-specialist': {
    'A fix verified on one platform (iOS or Android) is never assumed to hold on the other; both are verified or the unverified platform and reason are reported.': /- Never assume a fix verified on one platform \(iOS or Android\) also holds on the other/,
    'No signing key, keystore or API key is committed into source; secrets use the platform\'s secrets mechanism.': /- Never commit a signing key, keystore, or API key into source;/,
    'Input crossing the JS/native bridge to native modules is validated.': /- Never bridge to native modules with unvalidated input crossing the JS\/native boundary\./,
    'Build and test verification gates are run per platform before reporting complete, or the untested platform and reason are stated explicitly.': /say so explicitly and report that platform as not run instead of asserting success\./,
    'Consult the named Skill before writing platform-specific code; report a missing skill instead of improvising from memory.': /Load the matching skill with the `Skill` tool before you write platform-specific code\. A skill that is not installed is a gap to report in your handoff, not something to improvise from memory\./,
    'Hand your result back to the coordinator, not across to a peer.': /- \*\*Your final report is your one hand-back\.\*\* Do not use `SendMessage` to push results to the lead mid-run\./,
    'Message a peer directly only in team mode, when the brief lists that peer; otherwise put peer questions under open items.': /- \*\*Team mode\*\* is only for a live Agent Team, and then your brief lists each peer you may message directly by name with `SendMessage`\. Message a peer only when a peer's answer is genuinely required, at most two exchanges per pair \(an exchange is one message and its reply\) and one directed question per peer per planning round\. A message to a teammate that has gone idle wakes it, but the lead owns the relay: when a peer has finished, ask the lead\./,
  },
  // `repo-index` states "exhaustive before selective" in its floor.
  'repo-index': {
    'Exhaustive scanning precedes selective judgment.': /Exhaustive before selective\.\*\* Scan the entire repository before drawing conclusions/,
  },
  'ui-designer': {
    'Existing styles and markup are read, and the audit findings documented, before anything is written.': /\*\*Audit first\.\*\* Find the existing stylesheets, token files and markup[^\n]*as inline comments before you change anything\./,
    'A colour combination that fails WCAG AA contrast is refused and a corrected alternative is proposed.': /- If a colour combination fails WCAG AA contrast \(4\.5:1 for text\), refuse to implement and propose a corrected alternative\./,
    'Every design decision lives in a CSS custom property of the primitive, semantic or component tier; no hex value is hard-coded in component CSS.': /All design decisions must live in CSS custom properties\. Follow three-tier taxonomy: `--primitive-\*`, `--semantic-\*`, `--component-\*`\. Never hard-code hex values in component CSS\./,
    'All motion respects prefers-reduced-motion.': /All motion must respect `prefers-reduced-motion`\./,
  },
  'ux-strategist': {
    'Existing product specifications, research and analytics are read before any strategy is written.': /\*\*Ingest the context first\.\*\* Find the product specifications, user research documents, personas, journey maps and analytics[^\n]*before you write\./,
    'No dark pattern is recommended: no forced continuity, no roach motel flow, no misdirection.': /- Never recommend dark patterns \(forced continuity, roach motel flows, misdirection\)\./,
    'Validated user research and strategic hypotheses are labelled as different things in every deliverable.': /- Always distinguish between validated user research and strategic hypotheses\./,
    'Every critical action path targets fewer than three steps.': /Deconstruct every primary task into atomic steps\. Target <3 steps for any critical action path\./,
  },
  // `socratic-mentor`: its four role invariants are bound by sentences of its own "How to mentor" steps; the peer-messaging ones by the engineering family's peers section.
  'socratic-mentor': {
    'Read-only operation: never write or mutate files.': /Never write or mutate a file: this role holds no tool that writes a file or runs a command, and as a subagent the guard bound to it blocks any write tool, shell or mutating connected-server tool; as a teammate that guard does not apply, so the read-only rule is yours alone\./,
    'Guide through targeted questions (1-3 per turn) rather than code dumps.': /Ask one to three targeted questions per turn, never more, and no code dump\./,
    'Never supply copy-paste code solutions unless explicitly instructed after 3 Socratic turns.': /Never supply a copy-paste code solution unless explicitly instructed after three Socratic turns/,
    'Keep tone supportive, intellectually curious, and non-judgmental.': /Keep your tone supportive, intellectually curious and non-judgmental/,
    'Hand your result back to the coordinator, not across to a peer.': /- \*\*Your final report is your one hand-back\.\*\* Do not use `SendMessage` to push results to the lead mid-run\./,
    'Message a peer directly only in team mode, when the brief lists that peer; otherwise put peer questions under open items.': /- \*\*Team mode\*\* is only for a live Agent Team, and then your brief lists each peer you may message directly by name with `SendMessage`\. Message a peer only when a peer's answer is genuinely required, at most two exchanges per pair \(an exchange is one message and its reply\) and one directed question per peer per planning round\. A message to a teammate that has gone idle wakes it, but the lead owns the relay: when a peer has finished, ask the lead\./,
  },
  // `statistical-analyst`: the five role invariants are bound by sentences of its own "How to analyze" steps; the peer-messaging ones by the engineering family's peers section.
  'statistical-analyst': {
    'Present all statistical formulations using exact KaTeX notation and transparent assumptions.': /write every formula in KaTeX with its assumptions beside it/,
    'Validate normality, homoscedasticity, and sample independence before choosing parametric vs non-parametric tests.': /Test normality, homoscedasticity and independence of the samples before you choose a parametric or a non-parametric test/,
    'Never approve an A/B test experiment without computing the required sample size and duration.': /Never approve an A\/B test before you have computed the required sample size per variant and the duration/,
    'Apply False Discovery Rate (FDR) or Bonferroni adjustments when testing multiple metrics simultaneously.': /Apply a false discovery rate or Bonferroni correction when you test several metrics at once/,
    'Never ask the user clarifying questions directly; escalate parameter assumptions to the calling orchestrator in the report.': /put each one as a non-blocking `ask-user` entry under `Requests for the lead`; you never ask the user directly\./,
    'Hand your result back to the coordinator, not across to a peer.': /- \*\*Your final report is your one hand-back\.\*\* Do not use `SendMessage` to push results to the lead mid-run\./,
    'Message a peer directly only in team mode, when the brief lists that peer; otherwise put peer questions under open items.': /- \*\*Team mode\*\* is only for a live Agent Team, and then your brief lists each peer you may message directly by name with `SendMessage`\. Message a peer only when a peer's answer is genuinely required, at most two exchanges per pair \(an exchange is one message and its reply\) and one directed question per peer per planning round\. A message to a teammate that has gone idle wakes it, but the lead owns the relay: when a peer has finished, ask the lead\./,
  },
};

/** The evidence rule for one role and invariant, or `undefined` when the role has none (it must then declare a delta). */
export function evidenceFor(role: string, invariant: string): RegExp | undefined {
  return ROLE_EVIDENCE[role]?.[invariant] ?? EVIDENCE[invariant];
}
