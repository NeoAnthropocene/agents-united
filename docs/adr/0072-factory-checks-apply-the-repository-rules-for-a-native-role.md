# ADR 0072: The factory's checks apply the repository's rules for a native role, with one implementation shared with the repository's tests

- **Status:** Accepted by the maintainer, 2026-11-19 ("Yes, with an ADR"), through a question dialog, on the proposal of the factory-improvement worker of that day's session (an AI session), relayed by the lead of the session. The lead added one gap to the decision afterwards (the server tools, decision 3). Built and gated offline only; nothing of it is observed on the Host.
- **Written by:** the factory-improvement worker (an AI session). The worker wrote the specification test and this record. A Sonnet sub-worker built the module, the callers and the route changes from that test. A second Sonnet sub-worker, which wrote none of it, reviewed the branch read-only.
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
   - A coordinator's `Agent(...)` allowlist stands for `Agent`.
   - This changes what the check accepts:
     - before, a role holding any `mcp__` tool could never pass, and an order difference always passed;
     - now, exactly the canonical agent's server tools are accepted, in order, and any other server tool or any other order is refused.
   - The canonical agent is the file named with `--canonical`, or else `<registry>/agents/<definition>.md` when it exists.
4. **The realizer writes a coverage file** beside the agent, `<agent path without .md>.coverage.json`: `{ version: 1, role, definition, invariants: [{ invariant, evidence } | { invariant, delta: { disposition, rationale } }] }`.
   - Every core invariant appears exactly once.
   - Evidence is text found verbatim in the agent.
   - A delta has a valid disposition and a rationale.
   - The file is the candidate-side form of what the repository keeps in `tests/helpers/native-invariant-evidence.ts` and `deltas.json`. The generated test wiring of a later change can turn it into those.
   - The realize job (`check-job.mjs`) pins the canonical agent as an input of kind `canonical` when the source registry holds one, declares the coverage file among its allowed changes, and expects `--canonical` and `--coverage` in its native check. `check-handback.mjs` requires a declared coverage file to exist.
5. **The contract route pins the canonical agent.**
   - The contract task carries an optional `canonical` pin. `check-contract-return.mjs` refuses a task that does not pin it when the source registry holds it, or that pins another file.
   - Every `contract-check` of the route runs with `--canonical`. With it, `contract-check` applies the canonical floor; without it, it is unchanged.
6. **The texts:**
   - the realizer's runbook (both `realize-artifact` entries, `references/checks.md` and `job.md`) and the `factory-realizer` body say to write the coverage file;
   - the coordinator's `contract-authoring.md`, `contribution.md` and `job.md` name the canonical pin and the new arguments.

## Consequences

- **Each of the six gaps of the pilot now fails at its journey,** where the realizer or the contract fork can still be repaired, instead of after the candidate is brought into the repository. A test runs `factory-check` and `contract-check` on the pilot's original candidates (fixtures in `tests/fixtures/pilot-devops/original`) and requires a finding for each rule. The same test requires that the member as the repository now holds it (`tests/fixtures/pilot-devops/final`, from `feat/devops-engineer-claude-lane` at `cdc1e0d`, with a coverage file built from that branch's evidence patterns) passes.
- **The repository's tests and the factory cannot disagree on these rules,** because they call the same functions. A rule that exists only in test code is still unseen by the factory. A repository-conformance run outside the factory, decided by the maintainer for a batch, catches those, and a new one found that way becomes a promotion into this module.
- **Each realizer journey has more to write and to get right:** a coverage file, and the exact tools order. The checks name what is wrong.
- **Not decided here:** the generated test wiring (roster entries, evidence patterns, count pins), the batch manifest, and who runs the conformance run. Those are separate decisions of the maintainer.
- **Not shown:**
  - any of this in a live session, so whether a realizer writes a correct coverage file on the first attempt is unknown;
  - a contract journey with the canonical pin;
  - Linux CI;
  - the full suite. The author ran only the focused test files named in the pull request, and the orchestrator runs the full gate.
