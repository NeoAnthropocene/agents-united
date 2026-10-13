# Agent-factory foundation (Plan 033 / ADR 0045)

This is an authoring contract, not an installed bundle. The nine maintainer decisions in Plan 033 remain binding. The foundation adds no catalog section, bundle shell, install flag or factory role.

## Working method — maintainer clarification, 2026-10-12

The maintainer confirmed this interpretation of ADR 0025 and Plan 033 after reviewing the registry responsibilities, host independence, migration and skill-loading questions. This clarification records the agreed method; it does not deliver native factory content or expand the implementation scope.

### Sources and native implementations

| Location | Responsibility |
| --- | --- |
| `registry/core/` | Shared, host-neutral role identity, mission, boundaries, output contracts and safety invariants. |
| `registry/hosts/<host>/` | Authoritative committed native implementations: agents, rules, skills, hooks and orchestration, with their host profile and tool policy. |
| `registry/agents/` | Older Antigravity-shaped agent sources still required by the migration and legacy fallback. These files are not the new shared Contract Floor. |
| `registry/rules/` | Shared policy sources, with native activation and enforcement bindings where delivered. |
| `registry/skills/` | Shared skill sources, reusable unchanged when their format and behavior are portable. |
| `host-library/<host>/` | Reviewed authoring inputs: guides, cited snapshots and dated observations for the target host. |

The Plan 032 `software-engineering` and `digital-agency` pilots established the shared floor and native implementation method. Their cores are shared contracts, not separate host-native floors. Each host can develop its own tools, orchestration and extensions above that floor. A host-specific change must preserve the floor and explicitly record and review deviations above it; changing the floor is a shared decision.

Independent development does not require synchronized feature sets. Native package revisions must be distinguished from supported/tested host versions. Current `profile.version` values describe host baselines, and the existing npm release and bundle version fields do not establish an independent host-package release policy. Concrete version identifiers, compatibility rules and release automation remain a separate design task; one npm release can still distribute independently evolving host artifacts.

### Factory operation and migration

The authoring method is **shared contract + reviewed target-host inputs → native draft → checks and review → committed delivery**. The host running the factory and the target host being authored for are separate inputs. A Claude session may author a Codex realization, including a realization of the factory itself, using reviewed Codex inputs; Claude mechanics are prior art, not a substitute for those inputs. Installation copies committed artifacts deterministically and does not invoke an LLM to convert them.

The accepted factory sequence remains **Claude → Codex → Antigravity → Cline**, reviewing each stage separately. OpenCode is a future additional stage requiring reviewed inputs, native prerequisites and conformance work. The factory is not the first native bundle: the Plan 032 pilots precede it. Its current catalog shell and accepted decisions do not establish a working native authoring journey.

Completing the factory on every host does not retire `registry/agents/`. Retirement requires migration of the remaining relevant bundles and supported hosts, acceptable parity, and removal of resolver, manifest, ownership and fallback dependencies on the old sources. Retire legacy paths deliberately as their replacements are verified. The shared core, reusable policy sources and portable skill sources remain useful afterward.

### Rules and skills

Keep policy meaning shared while implementing loading, invocation and enforcement for the native surface. A prose rule does not establish a script guard or a first-action guarantee.

| Shared rule | Native treatment to review |
| --- | --- |
| `domain-modeling-and-adr` | Loading, invocation and applicable repository references. |
| `git-guardrails` | Permissions, hook bindings and verified enforcement. |
| `multi-agent-coordination` | Delegation, teams, messaging, workflows and checked hand-back. |
| `quality-aesthetics-accessibility` | Inspection tools, evaluator invocation and available evidence. |
| `skill-attribution` | Contributor-only placement and an actual on-demand loading binding. |
| `test-driven-development` | Invocation and the available test execution mechanisms. |

Use portable skills unchanged where the host permits. Put host-specific examples, references and scripts in supporting files when the job stays the same; author native variants when tool calls, delegation, permissions or execution behavior differ substantially. This preserves ADR 0025's native-per-host policy without requiring independent rewrites of portable content.

Progressive disclosure limits context cost: discovery uses metadata, activation loads `SKILL.md`, and supporting references are read when needed. Adding files does not automatically load every file. The entry must identify the target host and direct the agent to the matching reference. Read references and script outputs still consume context; scripts may also be read for inspection. Native preloading can load full skill bodies at startup, so verify the actual loading role instead of assuming every skill is loaded on demand. See the reviewed [Claude skill guide](../host-library/claude/guide/skill.md) and [Cline skill guide](../host-library/cline/guide/skill.md).

For the selected `author-skill`, [ADR 0052](adr/0052-slice-3-attribution-first-skill-and-delivery-gates.md) governs the compact entry, supporting-file checks, provenance, eval fixtures and actual loading-role gate. A catalog listing alone does not complete delivery.

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
