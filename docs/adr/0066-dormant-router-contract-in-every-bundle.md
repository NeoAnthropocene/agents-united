# ADR 0066 — Every Bundle carries the dormant cross-host worker contract

Status: Accepted for local implementation, 2026-11-07. Extends [ADR 0065](0065-host-agent-router-cross-host-dispatch.md). The maintainer delegated the Plan 050 implementation choices; publication and live host runs are outside this slice.

## Context

Standalone addons survive removal of their parent and own their declared Skills. A root-only router dependency would therefore disappear or be missing on independent addon installs. The integrated registry has 37 Bundles: 14 roots, 23 addons and three organization Bundles. The retired Remotion wrapper is absent; optional `agency-3d-production` is present. Factory and optional 3D have no lead, as does `universal-skills`.

## Decision

1. Declare `host-agent-router`, `handoff` and `git-guardrails` exactly once in every Bundle, including the mock, contributor factory and optional 3D Bundle. Keep this data explicit in `registry/bundles.json`; no resolver, schema or runtime change. Future Bundles are held to the same cross-catalog test.
2. Installation provides availability, not permission or preload. Every canonical lead and existing native coordinator surface carries the same short opt-in clause. Engineering and agency safety floors originate in their Semantic Cores. Department `skills:` declarations do not preload the router; universal retains its existing declaration and explicit-request phase.
3. The user must explicitly request cross-host execution; the router must be installed. Name the actual proposed hosts and explain account spending before the first run. Existing consent for those hosts and that scope remains valid. Normal local delegation continues otherwise. The unchanged router worker contract governs read-only defaults, isolated edit checkouts, handoffs and independent verification. This prose is not a hard execution gate.
4. The shared clause names no particular vendor: Cline's native dialect guard remains intact. The router Skill already describes the supported hosts. Neither Skills nor extra tool grants are added to department frontmatter.
5. Preserve factory's Claude-native workspace delivery restriction, under-construction status and contributor ownership. Preserve optional 3D's standalone placement, Arda mapping and existing delivery metadata; add no parent or new host-support claim. Router source and host capability baselines remain unchanged.
6. Local tests establish declarations, generated-floor identity, installation content and lifecycle ownership. They cannot establish that a model stays dormant or follows consent in a real session. Live behavior, macOS/Linux routing and non-invocation without a request remain **unverified**. No host session is started for this change.

## Consequences

The physical Skill inventory remains 210; `full` remains 205 end-user Skills because it already includes the three. Smaller Bundles grow by shared files and lock records; installation proof measures the incremental footprint. Explicit declarations avoid hidden inherited ownership and are checked against every Bundle rather than a fixed count. The two added Core safety clauses are regenerated into Claude, Cline and Antigravity native floors; authored coordinator bodies are updated separately. Existing tools, hooks and rosters must not change as a consequence.

Full typecheck, ordinary tests and the full lifecycle matrix remain required before acceptance. Structural dormancy is verified separately from future maintainer-run host behavior. No audit hold or unrelated policy is cleared by distributing this Skill.

## Integration amendment — 2026-11-07

The data-only implementation exposed an established installer entry assumption: direct `author-skill` was promoted to factory ownership only while it equaled the whole declared Skill set. Adding shared worker support broke that path. A narrow installer repair now resolves the unique factory-owned exact direct entry to the complete factory Bundle, preserving its companions and attribution rule. Existing host/scope/native-binding validation still runs before writes; arbitrary partial restricted Bundles remain rejected. This necessary compatibility repair supersedes the initial no-runtime-change expectation only for that direct entry, with failing-then-passing ownership/removal and no-write restriction regressions recorded in Plan 050. Registry resolution rules and Skill invocation semantics are unchanged.
