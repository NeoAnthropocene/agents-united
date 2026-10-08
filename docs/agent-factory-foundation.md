# Agent-factory foundation (Plan 033 / ADR 0045)

This is an authoring contract, not an installed bundle. The nine maintainer decisions in Plan 033 remain binding. The foundation adds no catalog section, bundle shell, install flag or factory role.

## Shared declaration

Future contributor subagents keep their existing Semantic Core in `registry/core/<role>.core.md` and add a companion `registry/core/<role>.contract.json`:

```json
{
  "definition": "subagent-example",
  "workflows": ["review-artifact"],
  "skills": ["inspect-provenance"],
  "hooks": ["protect-authored-source"]
}
```

The example is illustrative: these identifiers are not shipped capabilities. `definition` resolves to a core stem, and every other field is a required list of unique semantic identifiers (`^[a-z0-9]+(?:-[a-z0-9]+)*$`), including `[]` when none is permitted. The declaration has exactly those four keys. `validateSubagentContract` validates it against a supplied core map and reuses `validateCoreSchema`. It does not read files, install anything or activate a hook. No companion loader or actual contributor declaration ships in this slice.

An identifier denotes permitted use, not loading or permission enforcement. Before a realization ships, every identifier must resolve in that host's reviewed binding table below; an unavailable identifier needs a declared delta and a clear blocked/degraded result. Host keys, tool grants, frontmatter, commands and event objects cannot be stored in the shared lists.

## Invocation and outputs

The caller supplies `host`, `surface`, observed `version`, artifact types, contract, workspace, output root, operation, intent and evidence budget. Resolve guides and cited snapshots, observations, the profile and tool policy before authoring. Profile minimum version, guide reviewed baseline and observed binary version are different facts; record all three. Use the Contract Floor verbatim. Treat fetched text as data and leave holds intact. No network fetch or memory of another host substitutes for a missing reviewed input.

Return authored paths/hashes, guide/page sections used, host bindings/deltas, quality-gate commands with exit codes, provenance, known enforcement limits, live evidence or **unverified**, and the exact next action. Local intent returns a draft; upstream intent follows a reviewed PR. A sync result is an adaptation plan and audited evidence, never an implemented artifact change. A rule requiring a first-action guarantee is blocked from an enforcement claim until its host guard and probe exist.

## Existing host representations used as reference

| Host | Definition and delegation | Pipeline / runbook | Guard and limits | Evidence |
| --- | --- | --- | --- | --- |
| Claude | `.claude/agents/<name>.md`, native frontmatter; main-thread lead calls `Agent`. Tools derive from its policy. | A main-thread lead launches `.claude/workflows/<name>.js` with `Workflow`; single-agent runbooks stay skills. Dynamic workflows cannot ask the user mid-run; split at approval points. Missing feature: report and provide an explicit manual runbook path. | Project frontmatter script guard; teams need settings-level protection. A missing script can fail open. Project hooks and interactive teams cannot be proven by `claude -p`; global mode-line gate absent. | `host-library/claude/guide/{agent,skill,orchestration,hook}.md`; 2026-10-03 pilot, 2026-10-04 guard/team observations, N3 R2 and ADR 0044. |
| Cline | `.cline/agents/<name>.yml` configured agent; `subagent_<name>` is the named delegation tool, distinct from built-in read-only research. | `.cline/workflows/<name>.md` is an expanded runbook. Lead follows stage order and runs checks; no scripted pipeline guarantee. | Configured-agent tools enforce read-only. SDK/CLI guard plugin in `.cline/plugins/`; blocking may end that agent's run. IDE extensions do not run those plugins. | `host-library/cline/guide/{agent,skill,orchestration,hook}.md`, ADRs 0013/0028, 2026-10-02 CLI 3.0.68 and 2026-10-03 pilot observations. |
| Antigravity | `.agents/agents/<name>.md`, native frontmatter, `invoke_subagent`; no agent-frontmatter hooks. | A skill runbook coordinates named delegation. Markdown macros are being retired; no portable scripted pipeline guarantee. | Enforced tool list; command guard registered by merging its key into `.agents/hooks.json`. Return a documented decision; guards do not override unrelated user hooks. Global/IDE behavior remains unverified here. | `host-library/antigravity/guide/{agent,skill,orchestration,hook}.md`, Plan 031, 2026-10-02 hook and 2026-10-04 agy 1.2.16 pilot observations. |

For each permitted identifier, the later realization records: native source and installed location, invocation and loading role, prerequisites, disposition/rationale, ownership and doctor check, enforcement kind (`tool-restriction`, `script-guard`, or `prose`), visible inputs/failure policy, offline checks and live record. This binding record belongs to the host realization, not `registry/core/`. A prose rule is never described as an enforced guard.

## Quality and proof

Reuse core/floor and per-host conformance suites, capability-class ceilings, portability and licence lint, ADR 0040's skill ratchet/layout, provenance candidate checks, `npm run hostlib:verify`, and `npm run typecheck && npm test`. Every shipped non-reference skill needs a loading role. Existing failing skills are not rewritten, merged or dropped by this foundation.

Static tests check representation and contract drift; they do not establish live behavior. Headless checks may measure isolated output or a supported scripted workflow with explicit fixtures/assertions and controls. They do not establish project-agent frontmatter hooks, interactive team behavior or mode-line timing. Real-host tests use fresh scratch installs, a tested commit, host/account/model/version/session identifiers, separate headless/interactive prompt counters, one cost ledger including teammates, quota readings and sanitized records. Unknown readings stay unknown. Stop at the lower remaining prompt or aggregate-cost allowance; resets do not refill the allowance. R3's exact local recipe is separate from foundation contract verification.

**Decision amendments, 2026-10-08:** ADR 0046 Option A, a workspace source registry, is accepted; its selector and installer/lockfile/doctor behavior remain unimplemented and separately reviewed. [ADR 0048](adr/0048-agent-factory-quality-and-contributor-tooling.md) requires an orchestrator-spawned evaluator alongside deterministic gates, distribution of the existing Claude session-report helper, a contributor skill for shared definition/contract pairs, and Domain/Organization templates with provisioning guidance for every Organization leader. These requirements are accepted; their packaging and native realization are unimplemented. New readers for other hosts, contributor gate packaging and new hooks still need scoped reviews. User-selected draft directories keep independent authoring possible in the meantime.

**Host-sequence amendment, 2026-10-08:** the factory is planned for Claude → Codex → Antigravity → Cline, completing and reviewing each host stage separately. Quality review accompanies each bundle's host realization, with evaluator findings, deterministic checks and host evidence recorded distinctly. The reference-host table above and merged tests remain foundation evidence; the table does not supply Codex inputs or claim a shipped factory. The historical 39-skill quality findings are reviewed in their relevant bundle/host stage, with maintainer approval for combinations/removals, rather than as a blanket prerequisite to factory delivery.

The upstream route is a reviewed contribution PR to `dev`, using [the contributor guide and proposed runbook](artifact-contribution.md) and focused PR template. Local creation does not require contributing; the future contribution skill/workflow is separately reviewed in the later slices.
