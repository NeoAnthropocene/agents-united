# ADR 0021: Semantic Core & Per-Host Native Realization

- **Status**: Proposed — 2026-09-24 (Socratic grilling, product owner + orchestrator-engineering).
  Supersedes ADR 0008's projection doctrine and ADR 0020 decision 1 ("renderers remain translators
  of record"). Extends ADR 0020's data shapes (decision 9: the codex, ledger and goldens are
  repurposed, not discarded). Authorizes Plans 019/020 reframing and Plan 021 (strangler step 1).
- **Context**: `registry/**` is Antigravity dialect wearing a host-neutral badge: tool tokens
  (`view_file`, `invoke_subagent`), slash commands (`/grill-me`), and host caveats
  (`language_server`) saturate agent semantics. Every host lane pays a translation tax that Plan
  017's Translation Ledger can only *account for*, never eliminate. Antigravity's frequent churn
  makes every canonical change a cross-host blast radius, and the translator-of-record chases a
  moving target. The alternative — fully independent per-host agent sets (59 agents × 6 hosts) —
  recreates the multi-master drift and foreign-dialect residue Plans 015/019 exist to purge, and
  invites semantic divergence that breaks the Universal Coverage Rule and orchestration guarantees.
- **Decision** (Socratic grilling, 10 forks, 2026-09-24):
  1. **Hybrid source of truth**: a host-neutral **Semantic Core** (`registry/core/**`) plus
     per-host native **Realization Layers**. The core is tool-free; nothing is translated across
     hosts — two authored truths are assembled per host.
  2. **Invariants bound, not translated**: the core holds tool-neutral behavioural laws ("parallel
     slices fan out in a single turn; one synthesis point"); each realization **binds** them to
     concrete mechanics (`Agent()` + `SubagentHandback` on Claude, `subagent_*` + `SendMessage` on
     Cline, `/teamwork-preview` on Antigravity).
  3. **Deterministic codegen**: native host files are generated from Core + Binding Table +
     Capability Profile by a per-host **Creation Engine**. Never LLM-rendered, never prose-
     translated. Generation is install/sync-time, offline, and byte-reproducible.
  4. **Strangler migration**: the new engine grows beside the legacy projection lane; agents
     migrate in batches; projection is retired only at proven parity. The legacy lane keeps
     running untouched during the transition.
  5. **Host-native specialization allowed**: an agent may do more or less per host where it makes
     sense. **Coverage stays universal** — every agent exists on every migrated host (ADR 0019's
     Universal Coverage Rule stands); only scope above the floor varies.
  6. **Contract Floor**: identity, scope boundaries, structured output contract, and safety rules
     are locked — every realization honors them verbatim. All divergence above the floor must be
     **declared**; undeclared divergence is a conformance failure.
  7. **Managed artifacts only**: humans edit `registry/**` via PRs; workspace `.agents/` remains a
     lockfile-tracked, deterministic artifact. `doctor`/staleness detection contracts are preserved.
  8. **Versioned Capability Profiles**: each host's Binding Table targets a capability profile
     (`claude@2.1.271`, `antigravity@2026-08`, …). Host churn is absorbed as a one-host data PR
     plus that host's conformance suite — blast radius = one host. Runtime detection/adaptation is
     forbidden (nondeterministic; violates the never-LLMs rule).
  9. **Plan 017 machinery repurposed**: `HostDialectSpec` → Binding Table schema; Translation
     Ledger → Declared-Delta Registry (dispositions survive as delta classifications); golden
     snapshots → per-host Conformance Suites. Only the translation *philosophy* dies.
  10. **Rollout order**: Claude → Cline → Antigravity-as-peer → others on demand.
      **Antigravity is demoted** from de-facto canonical dialect to one realization layer among
      peers; its churn no longer shapes the core.
- **Consequences**:
  - Positive: translation loss becomes structurally impossible (no cross-host prose hop exists);
    Antigravity churn is isolated to one binding profile; host-native quality (Claude
    `SubagentHandback` hand-offs, Cline team orchestration) becomes first-class rather than
    residue; Plan 017's codex/ledger/goldens investment is preserved under new semantics.
  - Negative: the authoring surface grows (binding tables per host; capability profiles to
    maintain); semantic divergence is legalized by decision 5, so the Contract Floor, declared
    deltas, and per-host Conformance Suites are now load-bearing; per-host conformance is the new
    CI cost center.
  - Synergy: Plan 019's residue purge is reinterpreted as **step 1 of core extraction** (stripping
    host nouns from semantics is exactly purifying the core); Plan 020's command tokens become
    per-host command bindings; Plan 018's tier semantics move into core invariants with per-host
    orchestration bindings.
  - Risks: specialization drift (mitigated by floor + declared deltas + conformance gates);
    strangler stall if parity is never proven (mitigated by batch-migration acceptance gates);
    profile fragmentation across host releases (mitigated by profile deprecation policy).
