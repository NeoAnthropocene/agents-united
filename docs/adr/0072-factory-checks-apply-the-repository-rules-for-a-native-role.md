# ADR 0072: The factory's checks apply the repository's rules for a native role, with one implementation shared with the repository's tests

- **Status:** Accepted by the maintainer, 2026-11-19 ("Yes, with an ADR"), through a question dialog, on the proposal of the factory-improvement worker of that day's session (an AI session), relayed by the lead of the session. The lead added one gap to the decision afterwards (the server tools, decision 3). Built and gated offline only; nothing of it is observed on the Host.
- **Written by:** the factory-improvement worker (an AI session). The worker wrote the specification test and this record. A Sonnet sub-worker built the module, the callers and the route changes from that test. A second Sonnet sub-worker, which wrote none of it, reviewed the branch read-only. On 2026-11-20 the resumed factory-improvement worker (an AI session) fixed that review's findings and, at the master operator's decision, added the evidence place and sharing rule and the factory coordinator's fixed delegate list; a further read-only review of those fixes follows.
- **Planned at:** `689061d` (`origin/dev`), branch `feat/factory-repository-rules`. ADR numbers through 0070 were seen on `origin/dev`. 0071 is taken by the branch `feat/quote-located-citations`.

## Context

The pilot's candidates for `devops-engineer` (2026-11-18) passed every check of the factory: `contract-check`, `factory-check` on the pair and with `--artifact`, the realizer's hand-back check, and a checked review. Brought into the repository (branch `feat/devops-engineer-claude-lane`), they failed five repository tests, and one later decision added a sixth gap:

| Gap | Repository rule | Where the rule lived |
| --- | --- | --- |
| a. The core states messaging invariants that the body neither evidences nor declares as a delta. | Every invariant is evidenced in the body or declared in `registry/hosts/claude/deltas.json`. | `tests/native-invariant-coverage.test.ts`, with per-role evidence patterns in a test helper. |
| b. The `## Session task tracking` section is missing. | Every end-user role that tracks tasks carries the section. | `tests/claude-session-task-policy.test.ts`. |
| c. `model: inherit` where a specialist is `sonnet`/`medium`. | ADR 0018 decision 7. | `tests/helpers/native-delta.ts`. |
| d. The core's `scope_boundaries` drops the canonical agent's numbered directives. | The floor keeps every directive and guardrail. | `tests/core-safety-floor.test.ts`. |
| e. The `tools` line is in another order than the generator writes. | The generator's form. | `tests/native-claude-agents.test.ts` (`UPDATE_NATIVE`). |
| f. A role that holds the servers of its canonical agent (`mcp__github`, `mcp__context7`) fails `factory-check`, which compared the tools with the class grant only. | The canonical agent's `mcpServers` yield the server tools. | The projector, and per-role data in the test. |

None of them was in the factory's checks. The rules lived in test code that iterates the committed roster, which a candidate is not in. The evaluator could not be relied on for them either: they are deterministic facts, and none was among its pinned inputs.

## Decision

1. **One module, two callers.**
   - `src/core/native-repository-rules.ts` holds the rules: `nativePosture`/`postureProblems`, `sessionTrackingProblems`, `nativeToolOrder`, `canonicalServerTools`, `canonicalGuardrails`/`canonicalDirectives`/`canonicalFloorProblems`, `invariantCoverageProblems` and `coverageFileProblems`.
   - The repository's tests call these functions for the committed roster, each with its assertions unchanged in substance.
   - `factory-check` and `contract-check` call them for a candidate.
   - The server-tool grants are the projector's own code, exported once and used by the projector and by `canonicalServerTools`.
2. **What `factory-check --artifact` now refuses**, each finding naming its rule:
   - **The posture of the role's kind:** a factory role (named in an `agent-factory-*` binding) inherits with medium effort; a role whose core can `delegate` has the coordinator posture; any other role is a specialist (`sonnet`/`medium`).
   - **The Session task tracking section,** when the core's capabilities include `task-tracking`, in the specialist's or the coordinator's wording.
   - **The canonical floor,** when a canonical agent is known: every `## Safety Guardrails` bullet of `registry/agents/<definition>.md` is in the core's `safety`, and every numbered `## Primary Directives` title is in its `scope_boundaries`.
   - **The invariant coverage,** through the candidate's coverage file (decision 4). Without the file, any role but a factory role is refused with a finding that asks for it.
3. **The tools line is compared in the generator's form, exactly.**
   - The form: the class-derived grant, sorted, then the canonical agent's server tools in the order of its `mcpServers`.
   - Those server tools are `mcp__<server>` for a writable role, and the pinned read-only tool names for a read-only one.
   - The factory's own coordinator (the definition its `coordinate-artifact` binding names) must hold exactly `Agent(factory-realizer, factory-evaluator, factory-sync)`, checked by the same function as the repository's delta rows (`normalizeClaudeFactoryCoordinatorTools`).
   - Any other role that can delegate puts its one well-formed `Agent(a, b)` allowlist (distinct kebab-case names) in the place of `Agent`. A role that cannot delegate, a malformed list or a second `Agent` entry is refused. Which names the list holds stays the lead's own roster test.
   - This changes what the check accepts:
     - before, a role holding any `mcp__` tool could never pass, and an order difference always passed;
     - now, exactly the canonical agent's server tools are accepted, in order, and any other server tool or any other order is refused.
   - The canonical agent is the file named with `--canonical`, or else `<registry>/agents/<definition>.md` when it exists.
4. **The realizer writes a coverage file** beside the agent, `<agent path without .md>.coverage.json`: `{ version: 1, role, definition, invariants: [{ invariant, evidence, in, sharedWith? } | { invariant, delta: { disposition, rationale } }] }`.
   - `role` and `definition` name the checked agent (its file name) and the pair.
   - Every core invariant appears exactly once.
   - Evidence is verbatim agent text that declares its place: `in: "floor"` (the generated Contract Floor block) or `in: "body"` (the agent's own text outside every generated block). The rule checks that it is found in that place with the shape of a complete sentence or list item (or several whole ones): it starts at a line start (after an optional list marker) or after a sentence end, and ends at a line end or at a sentence end. This is a shape test, not grammar (see Known limits).
   - Evidence is shared (one entry's evidence contains the other's) only when both entries name each other in `sharedWith`; the rule checks both directions, and that a named share is real.
   - **Presence and place are checked by rule; meaning is judged by the evaluator, not proven.** The evaluator's `claude-agent` review carries the criterion "each coverage entry's evidence states its invariant" for every entry, floor and shared ones included, with a quote-located citation per entry once ADR 0071 is on `dev`.
   - Why floor evidence and shared evidence are allowed, not refused: a read-only audit of the committed roles at `908c521` found 20 bound invariants in 8 roles whose repository evidence pattern matches only inside the Contract Floor (backend-architect 5, devops-engineer 5, repo-index 4, code-reviewer 2, frontend-architect, agency-frontend-architect, agency-growth-strategist and agency-creative-designer 1 each), because the core's safety or scope restates the invariant and the floor carries it to the Host; and 15 roles where one sentence evidences two invariants (mostly "Bounded peer exchange only when genuinely required." with "At most two peer exchanges per specialist pair..."). Refusing either would refuse what the repository accepts. Declaring them makes them visible to the evaluator instead. The script that measured these numbers is replaced by a test of the property, not of the counts (`tests/factory-repository-rules.test.ts`): every committed role's bindings, derived from its evidence patterns and declared deltas and written as a coverage file, pass the rule. The test shares the rule's own idea of a sentence, so it shows that the rule accepts what the repository accepts, not that the rule is sound.
   - A delta has a valid disposition and a rationale.
   - The file is the candidate-side form of what the repository keeps in `tests/helpers/native-invariant-evidence.ts` and `deltas.json`. The generated test wiring of a later change can turn it into those.
   - The caller's realize job pins the canonical agent as an input of kind `canonical` when the source registry holds one, and declares the coverage file among its allowed changes. `check-job.mjs` refuses a job without the canonical pin when the registry holds the agent; when the job declares the coverage file, it expects `--coverage` in the native check, `.json` among the formats and no deletion of it. A job that does not declare the file passes `check-job.mjs` and is refused by `factory-check`, which asks for the file (fail-closed). `check-handback.mjs` requires a declared coverage file to exist.
5. **The contract route pins the canonical agent.**
   - The contract task carries an optional `canonical` pin. `check-contract-return.mjs` refuses a task that does not pin it when the source registry holds it, or that pins another file.
   - The route's texts tell every `contract-check` to run with `--canonical`. That is prose: the checker verifies the pin, not the commands the coordinator ran. With it, `contract-check` applies the canonical floor; without it, it is unchanged.
6. **The texts:**
   - the realizer's runbook (both `realize-artifact` entries, `references/checks.md` and `job.md`) and the `factory-realizer` body say to write the coverage file;
   - the coordinator's `contract-authoring.md`, `contribution.md` and `job.md` name the canonical pin and the new arguments.

## Consequences

- **Each of the six gaps of the pilot now fails at its journey,** where the realizer or the contract fork can still be repaired, instead of after the candidate is brought into the repository. A test runs `factory-check` and `contract-check` on the pilot's original candidates (fixtures in `tests/fixtures/pilot-devops/original`) and requires a finding for each rule. The same test requires that the member as the repository now holds it (`tests/fixtures/pilot-devops/final`, from `feat/devops-engineer-claude-lane` at `cdc1e0d`, with a coverage file built from that branch's evidence patterns) passes.
- **The repository's tests and the factory cannot disagree on these rules,** because they call the same functions. A rule that exists only in test code is still unseen by the factory. A repository-conformance run outside the factory, decided by the maintainer for a batch, catches those, and a new one found that way becomes a promotion into this module.
- **Each realizer journey has more to write and to get right:** a coverage file, and the exact tools order. The checks name what is wrong.
- **Known limits** (named by the two independent reviews; the first two accepted by the master operator as limits rather than fixes, the last two brought to him with this record):
  - `check-job.mjs` does not require a job to declare the coverage file; a job that leaves it out passes the preflight and is refused by `factory-check`, which asks for the file (fail-closed, but later in the journey).
  - When a named canonical agent is missing, `factory-check` reports that and still compares the tools without server tools; the missing file is itself a finding, so the candidate is refused either way.
  - The sentence test is a shape test (named by the second review): an abbreviation such as "e.g. " counts as a sentence end, a hard-wrapped continuation line counts as a line start, and a span that ends at a line end needs no closing punctuation, so a fragment of those shapes passes. A sentence after a blockquote marker, a `+` or `1)` marker or in a table cell is refused unless the whole line is quoted. Native agents are written one paragraph or list item per line, where the test is exact; the evaluator's criterion judges the rest.
  - Sharing is detected when one entry's evidence contains the other's; two entries that overlap partly (one ends with the sentence the other begins with) are not detected as sharing.
- **Not decided here:** the generated test wiring (roster entries, evidence patterns, count pins), the batch manifest, and who runs the conformance run. Those are separate decisions of the maintainer.
- **Not shown:**
  - any of this in a live session, so whether a realizer writes a correct coverage file on the first attempt is unknown;
  - a contract journey with the canonical pin;
  - Linux CI;
  - the full suite. The author ran only the focused test files named in the pull request, and the orchestrator runs the full gate.
