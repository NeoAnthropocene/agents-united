# ADR 0020: Host Dialect Codex, Declarative Overlays & Translation Ledger

- **Status**: Accepted — 2026-09-24 (product owner). Authored at Plan 017 Step 1. Supersedes the
  "ADR 0019" reference inside `plans/017-host-dialect-codex-and-translation-ledger.md` (0019 is
  the Universal Coverage Rule; this record took the next free number).
- **Context**: Agent definitions are host-neutral canonical (`registry/**`), but each host needs
  translated projections. The Claude lane (Plan 016) hand-wires its vocabulary, frontmatter
  handling and section replacements as literals in `src/core/claude-projector.ts` (42 literal
  blocks inventoried at Step 0), while drops of foreign-host keys fail fast against an inline
  `FEATURE_LEDGER`. Three defect classes motivate this record: (1) **foreign-dialect residue** —
  whole canonical sections (e.g. `## 🤝 Nested Subagent Delegation Protocol`, host-routing prose)
  project verbatim into `.claude/agents/*.md`; (2) **silent vocabulary gaps** — canonical tool
  tokens missing from the body vocabulary (e.g. `send_message` before the 2026-09-22 fix) leave
  agents reading untranslatable instructions; (3) **undispositioned tokens** — 21 tool-like
  registry tokens (many MCP-qualified names) have no ledger entry at all. Option C (approved
  2026-09-21) and the 2026-09-24 orchestration re-evaluation shape the decision below.
- **Decision**:
  1. **Canonical single-source retained.** `registry/**` stays the only authored truth; hosts get
     deterministic, offline projections. Renderers remain translators of record — never LLMs.
  2. **Typed `HostDialectSpec` codex** (`src/core/dialects.ts`, `HOST_DIALECTS`): one validated
     spec per host carrying `fields`, `toolVocabulary`, `bodyToolVocabulary`, command-token map,
     `roleModelDefaults`/`roleEffortDefaults`, `bodySectionOverrides`, `runtimeNote`, budgets and
     name rules. It is the **only writer for its host, including the unbundled fallback**
     (guard: `tests/claude-unbundled-fallback.test.ts`). Invalid specs throw at load.
  3. **Declarative projection overlays.** Per-agent (and per-tier × per-host) section/field
     overrides are catalog data, validated at load. Precedence: **overlay > dialect default >
     canonical**. Unknown/invalid overlays fail catalog load.
  4. **Translation Ledger** (`registry/translation-ledger.json`): every dropped or transformed
     feature × host carries `disposition: mapped | approximated | degraded | unsupported` with a
     non-empty rationale (and remedy where degraded/unsupported). A render-time drop **without**
     a disposition **throws** — silent drops are forbidden. MCP-qualified tool names form a
     documented exclusion class rather than 20 boilerplate rows.
  5. **Command tokens are ledger citizens** (with tool tokens): `team_command`,
     `deep_planning_command`, `interview_command` render per host (Cline `/team`, Antigravity
     `/teamwork-preview`/`/plan`, Claude: prose guidance). **Correction recorded:** design
     decision 5's example claim that Claude excludes `AskUserQuestion` from subagents is **false**
     per the live sub-agents "Available tools" list (verified 2026-09-24: `AskUserQuestion` is in
     the default subagent pool). `ask_question → AskUserQuestion` therefore stays **`mapped`**;
     only the example's premise was wrong.
  6. **Deterministic body rewrite + lint.** Whole-word, code-fence-aware token rewriting; a
     lint (unit-tested, CI-blocking) fails on (a) raw canonical tool tokens surviving in
     projected bodies and (b) **section-residue patterns** (`Nested Subagent Delegation`,
     `Host Routing`, `language_server`, `Cline & CLI`) — the residue class is thus prevented,
     while its canonical purge lives in Plan 019.
  7. **Role posture folded into the codex.** `inherit` model/effort resolve to role defaults
     (coordinator: opus/high; specialist: sonnet/medium; explicit always wins), and the
     `SubagentHandback` version floor (v2.1.271+, auto mode) stays documented in the spec.
  8. **Hard LLM boundary.** Renderers, installers and lint are deterministic and keyless. LLM
     Advisor/Judge CI jobs are **deferred from v1** (owner decision 2026-09-24): Stage-1 gates
     only (golden render, ledger audit, body lint, conformance guards).
  9. **Byte-freeze discipline.** Claude golden snapshots captured pre-refactor must diff empty
     after the codex lift (`UPDATE_GOLDEN=1` regeneration is a maintainer action with a
     PR-reviewed diff); non-Claude renderers are untouched in v1 (their byte-identity holds
     trivially).
- **Consequences**:
  - Positive: new hosts (Kimi/Moonshot later) add a spec + ledger rows instead of branching the
    renderer; residue and vocabulary gaps become CI failures instead of review findings; tier ×
    host orchestration semantics (Plan 018) have a first-class mount point (overlays).
  - Negative: ledger maintenance burden per feature × host (mitigated by the fail-fast and the
    MCP exclusion class); goldens churn when canonical content legitimately changes (Plan 019's
    purge requires a reviewed regeneration).
  - Follow-ups: close recon gaps G3 (unbundled skills/rules never reach `.claude/skills|rules`),
    G4 (name-rule literals triplicated), G5 (canonical-spelling duality) where they need byte
    changes; Plan 020 command-token expansion; the ADR 0019 follow-up (covering installs
    materialize derived artifacts) takes the next free number when scoped.