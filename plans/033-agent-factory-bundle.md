# Plan 033: `agent-factory` Domain Bundle (maintainer and contributor tooling)

> **Executor instructions**: this is a proposal. Nothing here is built. Resolve the open questions with the maintainer, grill the scope, then write ADR and tests first (one reviewed PR per slice, from a fresh `origin/dev`).

## Status

- **State**: PROPOSED. Maintainer request, 2026-10-03 (chat): "create a domain bundle for development purposes named `agent-factory`, so we will add the skill-attribution skill and maybe create new necessary skills on top of it."
- **Priority**: P2 · **Effort**: M · **Risk**: Low (a new bundle; no installer change expected).
- **Category**: Catalog / Bundles / Contributor experience.
- **Depends on**: Plan 030 (licence-aware adaptation), `docs/skill-intake.md` (ADR 0023), Plan 032 Phase 8 (Antigravity native lane; ADR 0031 addendum of 2026-10-03).

## Why this exists

1. **A gap the Antigravity lane opened, accepted on purpose.** With the native lane on, the legacy `.agents/rules/GEMINI.md` is omitted (it duplicated the native rules). It was the only thing that delivered its skill-attribution section (author metadata in `SKILL.md`, README credits, adapt rather than import raw); no bundle declares `registry/rules/skill-attribution.md`. That guidance is about adopting external skills into this project, so it does not belong in end-user bundles: a rule no end-user task needs only adds to every session's context. It needs a home among the people who do adopt skills.
2. **Contributor workflows live where only some hosts see them.** The maintainer skills (`realize-for-host`, `host-update-sync`) sit in `.claude/skills/`, and `docs/skill-intake.md`, `docs/workflow-guide.md` and the bundle mechanics are prose a contributor has to find. A contributor using Cline or Antigravity gets none of it from the packages.

## Proposal

A **Tier-1 Domain Bundle** (CONTEXT: single-discipline team package, lean token footprint, planner-orchestrator posture of ADR 0015) named `agent-factory`, for the maintainer and anyone contributing: it creates and updates bundles, agents and skills for this repository. It is a development bundle, not an end-user team.

Candidate contents (to be confirmed against what already exists before anything is written):

| Candidate | Source of truth to adapt (prior art) | Note |
| :--- | :--- | :--- |
| Skill `skill-attribution` | `registry/rules/skill-attribution.md`, README "Credits & Acknowledgments", `docs/skill-intake.md` | The rule becomes a skill (loaded on demand) or an on-demand native rule; the maintainer asked for a skill. Decide whether the rule file stays. |
| Skill for creating and updating a bundle | `registry/bundles.json` schema (tier, domain, status, orchestrator, agents, skills, planningLoop, version), `docs/workflow-guide.md`, plan 013, ADR 0015 | Roster, versioning, lockfile effects, the bundle-composition tests. |
| Skill for adopting a third-party skill | `docs/skill-intake.md`, plans 027, 028, 030, `host-library/_upstream/skills.json` | Provenance, licence tier, security audit, "go back to the upstream source". |
| Skill for authoring an agent | `registry/core/*.core.md` (Contract Floor), the frontmatter checks, the Plan 029 MCP declaration rules | Identity, mission, scope, output contract, safety. |
| Orchestrator and roster | existing Tier-1 patterns (for example `software-engineering`) | Likely one orchestrator plus a few specialists; keep the footprint small. |

The skills must stay host-neutral where possible and pass the existing portability lint, the licence tier checks and the Antigravity skills conformance suite (valid names, no collision with a built-in slash command).

## Open questions (for the maintainer)

1. **Audience and discoverability.** Should the orchestrator-recommendation logic ever suggest `agent-factory` to an end user, or should it be listed only when asked for (a `category` or `status` that hides it from the default catalog)?
2. **Rule or skill.** Keep `registry/rules/skill-attribution.md` as a rule that this bundle declares (on-demand native rule per host), or fold it into the skill and drop the rule?
3. **Overlap with `.claude/skills/`.** Do `realize-for-host` and `host-update-sync` stay maintainer-only Claude skills, or does `agent-factory` carry portable versions? (Both are tied to Claude-specific tooling today.)
4. **Name and domain.** `agent-factory` as the bundle name, and which `domain` value in `bundles.json`.
5. **First slice.** Smallest useful cut: the bundle with the `skill-attribution` skill alone, then add skills one per PR.

## Out of scope

- Any change to the installer or the Antigravity lane: the lane already installs whatever a bundle declares.
- Adding `skill-attribution` to `software-engineering` or any other end-user bundle (decided 2026-10-03: no).

## Verification (when built)

- `npm run typecheck && npm test`, including the bundle-composition, skill-portability, licence-lint and Antigravity skills conformance suites.
- A real `--native` install of the bundle into a scratch project, with the doctor clean, and the skill listed by the host in one real session if the maintainer allows a spend.
