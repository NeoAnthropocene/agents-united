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
  'agency-3d-designer': {
    'When delegated, route user questions through the calling lead; in direct standalone work, ask the user for missing brief inputs.': /When delegated, questions for the user go to the lead under `Open items`; you never ask the user directly\. In direct standalone use, ask the user for missing brief inputs\./,
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
};

/** The evidence rule for one role and invariant, or `undefined` when the role has none (it must then declare a delta). */
export function evidenceFor(role: string, invariant: string): RegExp | undefined {
  return ROLE_EVIDENCE[role]?.[invariant] ?? EVIDENCE[invariant];
}
