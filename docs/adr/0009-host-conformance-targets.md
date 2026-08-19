# ADR 0009: Host Conformance Targets

## Status
Accepted

> Accepted 2026-08-19 following a host-conformance spike against the Google Antigravity CLI
> (`agy` 1.1.14, re-verified on 1.1.15). Evidence in `advisor-plans/004-findings.md`.

## Context

Agents United markets **"One Library, Every Assistant"**, and the canonical store (`.agents/`) is
declared to be read **natively** by Google Antigravity (PROJECT.md §1.1). ADR 0008's addendum
(2026-08-14) already corrected the mental model: `.agents/` runs natively *only* on Antigravity, while
every other runtime needs a translated projection.

A headless spike of the `agy` CLI revealed that even the "native" claim needs qualifying today:

- `agy agents` printed **nothing** for a workspace containing a valid `.agents/agents/` store.
- `agy -p "<prompt>" --agent <name>` **accepted the name but did not inject the agent's system prompt**:
  an identity probe answered **"Antigravity"** and a detection-matrix probe returned **NOT_FOUND** across
  six fixtures (bare `name`+`description` → `+tools` → Antigravity keys → `inheritCustomizations`
  true/false → a canonical orchestrator copy).
- The `--agent NAME` flag was **not validated** against any discovered agent set (a nonexistent name ran
  without error), so no persona was ever loaded — and gap-detection requests confabulated bundle names
  (`quality-assurance`, `testing/e2e-playwright`) precisely because the real detection matrix was absent
  from context. This is an **injection/loading gap, not a model-quality issue**.
- Identical behavior observed on `agy` **1.1.14** and **1.1.15**.

Root cause is narrowed to ≤2 candidates: (1) headless `-p` print mode deliberately bypasses
per-workspace markdown-agent loading (agents are only resolved in interactive/repl sessions); or (2) the
CLI discovers agents from a project/session store that a bare `-p` run never populates. The **interactive
TUI path was not tested** and may well load markdown-defined agents.

The asymmetry is stark: **Cline** is deliberately probed (`ClineCapabilityProbe`) and activated
(`agents start` — tested green), while **Antigravity** has no equivalent conformance probe and its
headless behavior is unverified and currently non-conformant.

## Decision

Adopt an explicit **Host Conformance Target** per host: "what we promise about X must be proven by a
read-only probe, pinned to a tested CLI version." Start here:

1. **Cline** — conforms for activation via `ClineCapabilityProbe` + `agents start` (named-team /
   adaptive-session / single-orchestrator). Keep as the reference conformant host.
2. **Antigravity** — the headless `-p` loading claim is **retracted** until proven. Scope the
   "reads `.agents/` natively" claim to **interactive sessions**, pending one interactive spike to
   discriminate the two candidates. If interactive loading works, keep the (interactive-scoped) claim
   and add a conformance probe; if not, add a projection/bridging mechanism or amend PROJECT.md/README.
3. **Probe pinning** — record the exact host CLI version in the conformance record (agy 1.1.14/1.1.15,
   Cline 3.0.55) so behavioral changes are detected, not silently absorbed.

## Consequences

- **`agents doctor` gains per-host conformance checks** and a conformance matrix, so the
  "One Library, Every Assistant" promise becomes machine-verifiable instead of marketing prose.
- The canonical "native" wording in **PROJECT.md §1.1 / README is amended** to describe the
  *verified* scope (interactive-only for Antigravity until proven otherwise).
- **Projections may need per-host frontmatter shims** (or a bridging mechanism) for hosts whose loader
  cannot consume our canonical frontmatter — the Antigravity-only keys (`mainAgent`, `subagent`,
  `permissionMode`, `commandExecutionPolicy`, `hooks`) were ruled out as the headless cause, but remain
  a candidate for interactive-loading differences.
- A follow-up spike (interactive / `--new-project` agy probe) is required to fully settle the two
  candidates in §Context.
- We stop reporting unverified per-host behavior as product fact.
---
## Addendum (2026-08-19) — Spike 006 resolution

The interactive / `--new-project` probe (`advisor-plans/006-agy-interactive-project-spike.md`, executed 2026-08-19
on `agy` **1.1.15**, Windows) discriminated the two root-cause candidates in §Context and resolved **neither**:

- **Candidate B (project/session store) — refuted.** `--new-project` created a project *registration* only
  (`~/.gemini/config/projects/<id>.json`: id, name, `folderUri`; no agent definitions). With the store populated,
  `agy agents` stayed empty and the marker stayed `NOT_FOUND`.
- **Candidate A (mode) — refuted for the scriptable case.** A genuine `stream-json` conversational session
  (`--agent` resolved, real `agent_response` turn, 17,718 input tokens) still did **not** inject the
  `.agents/agents/*.md` prompt — the model self-identified "Antigravity" and quoted `NOT_FOUND`. `--agent` is
  accepted into the session but not validated and not injected.
- **Interactive `-i` TUI** could not be driven headlessly (blocks on a real TTY, no error text), so interactive
  loading was **not demonstrated**; `stream-json`, which shares the session/agent pipeline, showed no loading.

**Resolved scope:** the Antigravity "reads `./.agents/` natively" claim is **unverified and not
automated-CI-verifiable** in both headless and scripted-interactive modes, and is **not** upgraded to
"interactive-scoped (confirmed)". Antigravity should be treated as requiring a **projection shim / install into
its own agent store** until a human confirms an interactive TUI load. Cline remains the reference conformant
host. Pin `agy 1.1.15` in the conformance record.