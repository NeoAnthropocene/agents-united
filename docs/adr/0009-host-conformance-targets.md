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
## Addendum (2026-08-19) — Spike 008 resolution (supersedes spike-006 addendum)

**Status:** Resolved. Spike 008 (executed 2026-08-19 on `agy` **1.1.15**, Windows) settled all three
unknowns (mode, store, layout) from the spike-006 addendum, plus user-provided interactive-panel evidence.

**Evidence summary:**
- **Interactive `/agents` TUI panel** reads the **workspace** `.agents/agents/` path (flat `.md`
  format confirmed; human-observed listing `orchestrator-engineering.md` in a live project).
- **Headless `-p` / stream-json / `agy agents` subcommand** on 1.1.15 reads agents **only from
  the user-global store** `~/.gemini/config/agents/` (both flat `<name>.md` and folder
  `<name>/agent.md` proven); per-project `.agents/agents/` and `.gemini/config/agents/` are
  invisible to the headless path.
- **Wire format** — `stream-json` input uses `{"event":"user","message":{"role":"user","content":"…"}}`
  NDJSON (discovered iteratively; the `--output-format stream-json` emits `init`/`step_update`/
  `result` events). `-p` text/JSON output work as documented.
- `--agent` is accepted but **not validated** for unknown names (silent fall-through to
  default); it injects when the name matches a discovered agent in the applicable store.

**Resolved stance:**
1. **Antigravity conformance = interactive-scoped (confirmed).** The canonical `.agents/agents/`
   is read natively by the interactive CLI TUI panel and by the Antigravity 2.0 desktop
   (shared agent harness). No projection shim or store install is required — the canonical
   layout works out of the box for the surfaces Antigravity users actually use.
2. **Headless `-p` / `agy agents` is NOT a conformance target for Antigravity.** Per-project
   agents are invisible to the headless path on 1.1.15; making them visible would require an
   install into the user-global store `~/.gemini/config/agents/`, which breaks the zero-config
   per-project model and is not warranted for a CI scripting surface. CI-verifiable headless
   conformance remains with **Cline** (`ClineCapabilityProbe` + `agents start`, tested green),
   which is already the reference probes-based host.
3. **The spike-006 addendum is retracted.** Its "not loadable headless or scripted-interactive"
   conclusion was a wrong-store artifact (fixtures were placed in the workspace `.agents/agents/`
   path, which headless 1.1.15 does not read; the global store, where headless does read, was
   never tested in that spike). Its "projection shim / install into agy's own agent store"
   recommendation is withdrawn — no shim is needed for interactive, and a global-store install
   is the wrong tradeoff for headless.
4. **Pin `agy 1.1.15`** in the conformance record. Interactive loading was human-observed, not
   automated-CI-verifiable; the conformance probe for Antigravity interactive remains a
   human-run check until agy exposes a machine-readable agent-discovery surface.

**Action tracking:** (a) update PROJECT.md §1.1 / README to describe Antigravity conformance as
interactive-scoped (confirmed); (b) keep `agents doctor` per-host probes with Cline as the
automated-CI host and Antigravity as a human-verified interactive host; (c) no projection shim
or global-store install is required for Antigravity — the canonical layout works natively.