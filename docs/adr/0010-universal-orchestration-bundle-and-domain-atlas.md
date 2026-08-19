# ADR 0010: Universal Orchestration Bundle, Domain Atlas & the Route-and-Instruct Contract

## Status

Accepted

## Context

The `universal-skills` bundle ships skills only — it has no orchestrator. Users and contributors wanted an optional "guided front door" for Agents United: a single, low-footprint agent that could greet a user, figure out which Department Domain their task belongs to, and route them to the correct Essentials bundle so the department's Lead Orchestrator can take over. This is the in-session counterpart to the roadmap's `agents chat` (a CLI-side intent router).

Design pressure points discovered while spec'ing:

1. **Session model.** Markdown agents are injected at session *load* time on every host (Antigravity `--agent`/interactive panel, Cline `Adaptive`/`named-team`). No host provably supports swapping the *primary* agent mid-session; `invoke_subagent` delegation only works natively on Antigravity and degrades to "two competing system prompts" elsewhere. Meanwhile, the Multi-Agent Coordination Rule reserves orchestration for Lead Orchestrators and confines sub-agents to focused, report-back work — so running a Lead *as a sub-agent* violates its own delegation contract.
2. **Knowledge freshness.** Each Lead Orchestrator embeds a Detection Matrix that is contract-tested against `registry/bundles.json`. A domain-level router needs the same guarantee at one higher scope. Options ranged from a generated, embedded map to a runtime fetch of a remote registry.
3. **Trust and footprint.** Remote-registry fetching would be this product's first runtime network call and a prompt-injection surface; the published npm artifact already ships the registry (`package.json` `files: ["dist", "registry"]`), and `agents list --json` / `agents find <task> --json` already expose it locally.

## Decision

Add a **`universal-orchestration`** bundle to the Universal Autonomous Department:

- **Prime Orchestrator** (`orchestrator-universal.md`) — a new tier above Lead Orchestrators that routes across Department Domains.
- **Skills**: `handoff` (structurally required by the contract) and `grill-me` (Socratic triage of ambiguous requests).
- **Domain Atlas** — a generated, compact Department Domain → Essentials Bundle map embedded in the orchestrator, contract-tested against `bundles.json` (`tests/domain-atlas-contract.test.ts`). Never fetched remotely; on mismatch or suspected staleness it consults the *installed* registry via `agents find/list --json` and reports drift (`agents update universal-orchestration`).
- **Route & Instruct Contract** — the guaranteed cross-host activation behavior: triage → consented Essentials install → `/handoff` note → present the exact `agents start <bundle> "<task>"` command. In-session persona-swap and sub-agent masking are prohibited. Automatic session launch is an enhancement deferred until host spawn capability is proven (the launcher currently blocks on the child process).
- **Consent**: the Addon Consent Policy's default ("explain + explicit confirmation") applies at domain scope; `--allow-routing` pre-authorization is deferred.
- **Boundary**: Organization Bundles are excluded from autonomous routing (existing Prerequisite Gate constraint); they appear in the Atlas only as opt-in.

### Rejected

- **Stay-and-delegate** as the base contract: degraded theater on projected hosts, violates the sub-agent role in the Multi-Agent Coordination Rule, unverified on Antigravity. (Possible layering later as an enhancement only.)
- **Remote fetch of the registry**: prompt-injection surface, redundant with npm/`agents update`, and this product has zero runtime network calls.
- **"Codex" as the term**: collides with the `codex` projection profile/host.
- **Autonomous / pre-authorized installs on day one**: over-promises; YAGNI.

## Consequences

- The Domain Atlas must be regenerated when a department domain or its Essentials bundle changes; the contract test fails CI on drift.
- `src/cli.ts` "essentials derivation" and `tests/helpers/bundle-lifecycle.ts` `NON_ESSENTIALS` now exclude `universal-orchestration` so the conformance suite does not misclassify it as a department Essentials base.
- Network-independent behavior: offline and with no CLI, the embedded Atlas still routes (best-effort, honest about staleness).
- **Follow-up (deferred)**: repoint `full.orchestrator` to the Prime Orchestrator once the bundle is battle-tested, giving the suite its first real meta-coordinator. Today `full` still lists `orchestrator-engineering.md`.
- **Deferred**: `--allow-routing` (ephemeral pre-authorization analog of `--allow-addons`); auto-launch feasibility spike (host `run_command` → interactive child TUI + blocking semantics).