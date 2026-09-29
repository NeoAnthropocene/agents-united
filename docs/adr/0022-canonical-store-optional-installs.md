# ADR 0022: Canonical-Store-Optional Installs

- **Status**: Accepted — 2026-09-26 (owner approved Plan 023 decisions D3/D4; implemented in Plan 023
  Workstream B). Proposed 2026-09-25 (Gate 7 field finding, product owner + orchestrator-engineering).
  Amends ADR 0008 decision 1 ("canonical store remains `.agents/`") for the post-ADR-0021 era;
  does not supersede ADR 0021 decision 7 (the canonical store remains the managed artifact when
  it exists).
- **Context**: `agents add` materializes `.agents/` (the canonical store) even when the operator
  selects only other hosts (e.g. Claude alone) — the TUI choice "Which AI tools should we
  configure…" still writes both `.agents/` and `.claude/`. Gate 7 field testing (2026-09-25)
  confirmed this reads as noise to single-host users: an unselected "assistant" appears in their
  workspace. The historical necessity was real — projections are derived copies of the store,
  the lockfile lives in it, and Antigravity reads it directly (ADR 0009). But ADR 0021's
  Creation Engine produces **self-contained** host artifacts (floor verbatim, bindings bound,
  deltas declared), so a created `.claude/` no longer needs a sibling store to be authoritative.
- **Decision**:
  1. **The canonical store materializes only for store consumers.** `.agents/` is written when
     the `agents`/Antigravity host is selected (or `--target agents`), or when an explicit
     `--canonical-store` flag requests it. A Claude-only (or Cline/Cursor/OpenCode/Codex-only)
     install writes only the selected hosts' directories.
  2. **Created artifacts are self-contained.** Per-host created files carry their full Contract
     Floor + bound invariants + declared deltas; the store is not required to interpret them.
  3. **Machine state must survive without the store.** Sub-decisions resolved at implementation:
     the lockfile home for store-less installs (candidate: the primary host's directory, e.g.
     `.claude/agents-united.json`, or a root-level `agents-united.json`), `doctor`/`update`/
     uninstall discovery of that home, and projection-vs-creation lane bookkeeping. The
     lockfile format itself is unchanged (ADR 0017 shapes survive).
  4. **Strangler-safe.** The legacy projection lane still requires the store; until a host is
     migrated to the creation lane, installing it keeps materializing `.agents/` (documented in
     the TUI as "main library (source of the translated copies)").
- **Consequences**:
  - Positive: single-host workspaces contain only what the operator chose; the store becomes a
    deliberate multi-host/Antigravity artifact instead of a mandatory side effect.
  - Negative: two install shapes (store-backed and store-less) must both be covered by doctor/
    update/uninstall; the lockfile-home sub-decision is load-bearing and needs its own tests.
  - Risks: tooling that assumes `.agents/` exists in every workspace (advisor scripts, docs)
    needs the store-less shape documented; mitigated by the explicit `--canonical-store` flag.
- **Implementation**: tracked in `plans/022-subagent-comms-and-hardening.md` as a scoped
  workstream (or its own plan if it outgrows it); acceptance = a Claude-only install leaves no
  `.agents/`, doctor/update/uninstall stay warning-free on that shape, and a later `--target
  agents` add materializes the store and reconciles the lockfile.
## Resolution of sub-decision 3 (proposed 2026-09-26, ACCEPTED 2026-09-26)

Recommended in `plans/023-storeless-installs-and-session-guard.md` (Workstream B, decisions D3/D4):
a store-less install keeps its machine state in a hidden, machine-owned **sidecar**
`.claude/.agents-united/` — the lockfile `agents-united.json` plus an immutable snapshot of the
canonical assets it projected. Because lockfile `files` keys are relative to the state dir and
`projections` keys to the workspace root, relocating the state dir reuses the existing
install/doctor/update/uninstall paths; only state-dir discovery and workspace-root derivation
change. Store-less applies only when Claude is the sole selected host (no Cline, no `--plugin`,
no `--canonical-store`); a later store-requiring add moves the sidecar into `.agents/`.
Rejected: a lockfile-only home (forks the state machine — risk R4) and a root-level lockfile
(visible workspace noise). The owner accepted D3/D4 on 2026-09-26; the implementation (`src/core/state-dir.ts`,
`tests/store-less-install.test.ts`) and its scratch-workspace evidence are recorded in Plan 023's execution log.
