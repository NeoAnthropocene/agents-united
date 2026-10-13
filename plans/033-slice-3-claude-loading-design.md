# Plan 033 slice 3: Claude loading and availability design

- **Status:** Accepted by explicit maintainer approval, 2026-10-12. The approval covers built-in Claude general-purpose loading, on-demand attribution and the Claude-only workspace/native availability prerequisite. The design wording below retains the proposal rationale; implementation and offline verification are recorded in Plan 033. Live invocation/evaluation remain unverified.
- **Ground:** #195 merged at `42f4217c13d7724dd3177113b435ee9023ed7058`; #197 merged at `06f54cfd8ea18115e374a10be3fbb063eee3ad15`. Fresh `origin/dev` and planned-at SHA are **`06f54cfd8ea18115e374a10be3fbb063eee3ad15`**, branch `codex/plan-033-author-skill`. Local ADR 0052 was carried forward as `790da51`; the six working-method edits were preserved through a saved patch and retained stash.
- **Decision approved:** the maintainer accepted the built-in Claude loading role and narrowly scoped availability/binding prerequisite below. The rule, skill and prerequisites are implemented locally; final offline results are recorded in Plan 033. This proposal does not silently authorize a factory orchestrator, new custom subagent, managed local source installation or paid run.

## Evidence and the delivery gap

**Implementation amendment, 2026-10-12:** the following gap description records the pre-implementation checkpoint. The accepted implementation now populates the factory, validates `hostAvailability` and selects the native entry with checked loading edges in `src/core/claude-skill-binding.ts`. Existing native-package source/render helpers are reused without changing that module. Offline results are in Plan 033; actual host invocation and behavioral evals remain unverified.

[ADR 0052](../docs/adr/0052-slice-3-attribution-first-skill-and-delivery-gates.md) requires a real loading role, native source/installed paths, invocation/surface and checked rule/support-file edges. The current `agent-factory` manifest is empty. `src/core/types.ts` has no per-bundle host availability field; `RegistryResolver.resolve()` does not receive a target host. `InstallEngine.install()` resolves assets and permits a populated under-construction bundle under the existing explicit overrides. An empty-shell refusal therefore cannot protect a later populated Claude-only stage.

`ClaudeProjector.planProjectionArtifacts()` currently renders canonical skills and auxiliary files; it replaces a same-named skill with a native workflow, but does not select a native skill entry. It sends declared rules to `.claude/rules/`. Existing `nativeSkillSource()` and `renderNativeSkill()` provide native skill primitives used by the Cline coordinator; reuse their anatomy rather than invent another file format.

Read-only prior art: ADRs 0025, 0040, 0045, 0048, 0050 and 0051; Plan 033's dated host-order, availability and loading findings; the Claude skill/agent guides and cited snapshots; registry/resolver, installer, projectors, native-package helpers, skill-contract/layout/ratchet tests and open/closed PRs. Native edits must cite these reviewed inputs, not newly fetched vendor material.

## Recommended loading role

Use Claude's existing **`general-purpose` built-in subagent**, selected by a task skill's `context: fork`, `agent: general-purpose`, `background: false`. The reviewed [skill guide](../host-library/claude/guide/skill.md) and [snapshot](../host-library/claude/pages/skill/skills.md#run-skills-in-a-subagent) document this path. The task must carry its complete input record, since the fork does not inherit conversation history. The model inherits the caller's choice; no model or paid session is selected by the installer.

The native skill entry is the authoring prompt for that role. This is an explicit loading-role binding, not a claim that a new custom factory subagent exists. A missing or mismatched declared role binding blocks planning. Offline checks establish the installed binding and required files; actual host invocation and behavior stay **unverified** until separately authorized evidence exists.

| Binding | Source / installed form |
| --- | --- |
| Shared skill source | `registry/skills/author-skill/SKILL.md` and its support folder. |
| Claude native entry | `registry/hosts/claude/skills/author-skill/SKILL.md` → `.claude/skills/author-skill/SKILL.md`. |
| Loading role | Built-in `general-purpose`, selected by native entry frontmatter; no custom role file or new core/contract pair. |
| Invocation | `/author-skill` with a complete task/job record; normal discovery may also select the skill for an explicit create/repair request. |
| First claimed surface | Claude Code CLI, workspace install, native lane. Other surfaces remain unverified. |
| Attribution rule | Canonical `registry/rules/skill-attribution.md` → `.claude/skills/author-skill/references/skill-attribution.md`, as a tracked rule artifact. |
| Consultation trigger | Before inspecting/adapting an external source or writing a skill draft, the runbook reads the installed attribution rule. |
| Supporting files | Shared `references/`, `examples/`, `assets/` and any justified `scripts/` copy through the existing skill resource lane. Maintainer `evals/` never installs. |
| Validation prerequisite | An explicitly selected reviewed source checkout and Node >=24. Checkout-only quality/provenance tools are not advertised as installed commands. |

The attribution rule is still declared by the contributor bundle. Its native binding places it outside Claude's automatically loaded rules directory and requires an explicit read from the skill; it does not become an always-on rule for ordinary sessions. The canonical rule remains the policy source of truth. Its hash and ownership are tracked through the ordinary rule projection record. Prose consultation is not represented as an enforced script guard.

## Availability prerequisite

Propose an optional `hostAvailability` declaration on `BundleDefinition`, absent on existing bundles. The first factory declaration is:

```json
{
  "hostAvailability": {
    "claude": { "lane": "native", "scopes": ["workspace"] }
  }
}
```

**Implementation amendment, 2026-10-12:** this accepted schema is now a public field, validated by the registry and checked before installer/update writes. Keys use native host identities, with one resolver normalizing install aliases such as `agents` to `antigravity`. A present declaration is an explicit allowlist; an omitted host is unavailable. A missing declaration preserves existing bundle behavior and legacy fallback. Availability means that the declared realization can be delivered; it is distinct from live behavioral evidence and supported/tested host versions.

Validate the declaration when reading the registry, and validate all required bundles against all requested user-facing targets before any filesystem/state write. The factory is permitted only on Claude, in workspace scope with the native lane on. `--force` and `--allow-under-construction` do not bypass host/lane/scope restrictions. A mixed request containing an unavailable required host fails as a whole. An implicit `.agents/` state store is not another user-facing host request.

Check add and update/reinstall paths; never silently install a subset or turn off the required native lane. A formerly recorded native choice may satisfy the gate only after the installer has resolved that effective choice from the existing lockfile without mutating it. Keep recommendations, departments and `full` excluded by contributor domain; shared end-user assets retain their current owners.

## Concrete implementation and public test seams

| Path | Intended change / public seam |
| --- | --- |
| `src/core/types.ts` | Optional typed availability declaration; no change to the four-field Subagent Contract. |
| `src/core/registry.ts` | Validate manifest availability data; retain absent-field compatibility and canonical contributor exclusions. |
| `src/core/bundle-host-availability.ts` (new) | Pure validation/assertion helpers for normalized targets, effective lane and scope; errors identify the bundle, requested target and available realization. |
| `src/core/installer.ts` | Call the availability/binding assertions in `InstallEngine.install()` after resolution and effective option/state reads, before writes. Update's reinstall must use this same gate. |
| `src/core/claude-projector.ts` | In the native lane, select the committed native skill entry, retain shared support copies and plan the on-demand rule at its bound destination; keep other bundles' behavior. |
| `src/core/native-package.ts` | Reuse native skill source/rendering; add only the minimal binding validation needed by the planner. |
| `registry/hosts/claude/agent-factory.binding.json` (new) | Host-owned record naming bundle/skill, built-in loading role, entry, required support files, rule source/destination and surface. It carries no grants or new core semantics. |
| `registry/bundles.json` | Contributor-only skill/rule declarations and explicit availability after the prerequisites pass. Keep under construction until the applicable useful-entry-point gates pass. |
| `registry/rules/skill-attribution.md` | Authorized provenance/licence/original-vs-adapted policy correction; no ordinary bundle addition. |
| `registry/skills/author-skill/` | Authorized compact source skill, worked example, provenance/quality references, bounded draft checks where useful and maintainer-only eval pair/control. |
| `registry/hosts/claude/skills/author-skill/SKILL.md` | Reviewed native fork binding and explicit attribution consultation, preserving the shared authoring job. |
| `tests/agent-factory-delivery.test.ts` (new) | Exercise registry/resolver, `InstallEngine.install()` and `ClaudeProjector.planProjectionArtifacts()` with real temporary installs, missing-edge mutations and no-write assertions. |
| `tests/author-skill.test.ts` (new) | Candidate contract/layout/licence/portability/ratchet checks plus actual bounded draft-script behavior, where scripts are included. |

The binding asserts the actual planned/installed set, not a catalog label. Required resources must survive packaging; no checkout-relative imports may be disguised as installed helpers. The built-in role is verified against the reviewed host input and explicit native entry; a new custom role is outside this proposal.

## Red cases and completion evidence

Before implementation, record the exact test cases and expected failures. The first red cases are a populated factory offered to an unavailable target, a mixed target request that writes a partial install, and a fresh Claude native install missing its loader/rule/support files. Missing native entry must fail, not fall back to the generic skill.

Required positive/backward cases: a fresh Claude workspace native install has the fork binding and exact rule/support files; the rule is absent from `.claude/rules/`; global/non-native/unfinished-host requests fail without writes; old bundles without availability metadata retain their behavior; update/removal/doctor preserve correct ownership and source hashes; contributor exclusion retains all shared image/brand skills from #194/#197. Run the full addon lifecycle matrix because this design changes shared installation/ownership seams.

The authoring cases remain ADR 0052's: complete local draft with no install/publication, scoped repair preserving unrelated edits, adapted source without licence/pin, original work with false adaptation metadata, unavailable tools, missing loader/rule/support, source/output overlap, contributor exclusion and upstream evidence/template preparation without a sent PR. Do not substitute wording assertions for behavioral checks. Eval prompts/controls can be prepared; model runs and behavioral improvement claims are not authorized.

Before any push: inspect staged diff, check all PR states against the explicit repository, run/read complete hostlib, typecheck/test and applicable lifecycle outputs, and review the final artifacts. Open one scoped PR to `dev` and stop at review. No merge, force-push, live host run, root AGENTS.md change, Plan 034 baseline/hold change or Plan 036 repair.

## Alternative considered

Wait for the later custom factory orchestrator/authoring role before delivering the first skill. This avoids the built-in-role binding but delays slice 3 behind later roles, contracts and native evidence. Reusing an end-user engineering role would couple contributor-only skills to ordinary bundles and does not solve the missing host-availability gate. The built-in task role is the recommended minimum, with its offline/live evidence boundary stated plainly.
