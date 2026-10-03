# Plan 033: `agent-factory` Domain Bundle (maintainer and contributor tooling)

> **Executor instructions**: this is a plan, not yet built. The maintainer's answers of 2026-10-03 are recorded under "Decisions"; what is still open is under "Open questions". Write the ADR and the tests first, one reviewed PR per slice, each from a fresh `origin/dev`.

## Status

- **State**: PROPOSED, scope shaped by the maintainer on 2026-10-03 (chat). Nothing is built.
- **Priority**: P2 · **Effort**: L (a bundle, a catalog section, host-parametric subagents, workflows and hooks) · **Risk**: Medium (a new catalog section touches the CLI picker, the `full` bundle and the recommendation logic).
- **Category**: Catalog / Bundles / Contributor experience / Multi-host.
- **Depends on**: Plan 030 (licence-aware adaptation), `docs/skill-intake.md` (ADR 0023), Plan 032 (native host packages and the host docs library; ADR 0031 and its 2026-10-03 addendum).

## Why this exists

1. **A gap the Antigravity lane opened, accepted on purpose.** With the native lane on, the legacy `.agents/rules/GEMINI.md` is omitted (it duplicated the native rules). It was the only thing that delivered its skill-attribution section (author metadata in `SKILL.md`, README credits, adapt rather than import raw); no bundle declares `registry/rules/skill-attribution.md`. That guidance is about adopting external skills into this project, so it does not belong in end-user bundles, where a rule no end-user task needs only adds to every session's context.
2. **Contributor workflows live where only some hosts see them.** The maintainer skills (`realize-for-host`, `host-update-sync`) sit in `.claude/skills/`, and `docs/skill-intake.md`, `docs/workflow-guide.md` and the bundle mechanics are prose a contributor has to find. A contributor using Cline or Antigravity gets none of it from the packages.

## Decisions (maintainer, 2026-10-03)

1. **A Tier-1 Domain Bundle named `agent-factory`**, for the maintainer and anyone contributing: it creates and updates bundles, agents and skills for this repository. A development bundle, not an end-user team.
2. **Shown to end users, in a separate "Developers only" section** with a short guide saying it is only for developing new agents in this repository. It is not hidden from the catalog, and not mixed into the end-user departments.
3. **`skill-attribution` stays a rule**, wrapped for this bundle: the bundle declares it, as an on-demand rule (frontmatter first, `trigger: model_decision` on Antigravity). It is not added to any end-user bundle.
4. **Portable versions of `realize-for-host` and `host-update-sync`, as host-parametric subagents.** The intent is subagents that work for every host, so that adding a host in future means adding that host's docs library and profile, not new agents. The existing `realize-for-host` already reads the host's guide and observations, so the host is an input, not a copy of the agent per host.
5. **The first slice is the foundation for the bundle's orchestration** (its workflows, skills, hooks and the subagent contract), not the bundle with a single skill.

## Recommendation on the `domain` value (awaiting the maintainer)

`domain: "contributor"`, with the picker label "Developers only: contribute to Agents United" and a one-line hint. The existing domains are `architecture`, `business`, `design`, `engineering`, `marketing`, `research`, `security`, `universal` and `organization`; `engineering` already means building software for a user's project, so `development` would be confused with it, and `universal` is the shared meta-skill section. The CLI groups the two-stage picker by `domain` (a label map in `src/cli.ts`, twice), so a new value gives the separate section directly; the departments list and the "install the whole department" option need the same exclusion that `organization` and `universal` already have.

Consequences to design for, not yet decided: `agent-factory` must not be pulled in by the `full` bundle or a department install; the planner-orchestrator logic that recommends bundles needs a rule for it (listed only in its own section, not suggested for ordinary tasks); a `status` or flag may be needed for "contributor-only" if `domain` alone is not enough.

## Proposal

Candidate contents (to be confirmed against what already exists before anything is written):

| Candidate | Source of truth to adapt (prior art) | Note |
| :--- | :--- | :--- |
| Rule `skill-attribution` | `registry/rules/skill-attribution.md`, README "Credits & Acknowledgments", `docs/skill-intake.md` | Declared by this bundle only; an on-demand native rule per host. |
| Host-parametric subagent: realize an artifact for a host | `.claude/skills/realize-for-host/SKILL.md`, `host-library/<host>/guide/`, `observations/`, `registry/hosts/<host>/profile.json` | The host is an argument. It authors from that host's guide and observations, never from memory. |
| Host-parametric subagent: sync a host's docs and plan the adaptation | `.claude/skills/host-update-sync/SKILL.md`, `scripts/hostlib/`, the changelog sources (markdown, GitHub releases, `agy changelog`) | Reads each host's `sources.json`; never implements artifact changes itself. |
| Skill: create or update a bundle | `registry/bundles.json` schema (tier, domain, status, orchestrator, agents, skills, planningLoop, version), `docs/workflow-guide.md`, plan 013, ADR 0015 | Roster, versioning, lockfile effects, the bundle-composition tests. |
| Skill: adopt a third-party skill | `docs/skill-intake.md`, plans 027, 028, 030, `host-library/_upstream/skills.json` | Provenance, licence tier, security audit, "go back to the upstream source". |
| Skill: author an agent | `registry/core/*.core.md` (Contract Floor), the frontmatter checks, the Plan 029 MCP declaration rules | Identity, mission, scope, output contract, safety. |
| Orchestrator | existing Tier-1 patterns (ADR 0015) | Plans with the maintainer, then delegates to the host-parametric subagents. |
| Workflows | the `workflow-*` skills and the native workflows per host (Claude `.claude/workflows/`, Cline markdown workflows) | A "realize a bundle for a host" pipeline and a "sync a host" pipeline. Which are skills (runbooks) and which pipelines is for the ADR. |
| Hooks | the Claude, Cline and Antigravity guard hooks of Plan 032 | Candidates only: refusing edits to generated or pinned files (`host-library/**/pages`, `_upstream`), and refusing pushes to protected branches. Whether each host can enforce them is for the host guides to settle. |

The skills must stay host-neutral where possible and pass the existing portability lint, the licence tier checks and the Antigravity skills conformance suite (valid names, no collision with a built-in slash command).

## Slices (reshaped; one reviewed PR each, tests first)

1. **Foundation (design, no catalog change):** an ADR for the host-parametric subagent contract (what the host argument is, where its inputs come from, what each host's native package must contain), for the contributor domain and the "Developers only" section, and for which pieces are skills, subagents, workflows and hooks. Tests that pin the contract on the existing hosts (Claude, Cline, Antigravity) using the current `realize-for-host` as the reference. Resolves the open questions below.
2. **Catalog section:** the `contributor` domain in the picker with its label and guidance, the exclusions (`full`, department install, recommendation), and an empty-but-valid `agent-factory` bundle shell, so the section and its guard rails are tested before any content.
3. **The rule and the first skill:** `skill-attribution` declared by the bundle, plus one skill, behind the conformance suites.
4. **The host-parametric subagents and their workflows**, one per PR: realize an artifact for a host, then sync a host. Each proven against all three current hosts, which is the test that a fourth host will be a data change.
5. **Hooks**, once the guides say what each host can enforce.

## Open questions

1. The `domain` value: `contributor` as recommended above, or another name?
2. Is a flag needed beyond `domain` to keep `agent-factory` out of `full`, department installs and recommendations?
3. Subagent form per host: Claude native agents, Cline configured agents, Antigravity agents each carry the same contract; how much of the contract is shared in `registry/core/` and how much is written per host?
4. Do the existing `.claude/skills/realize-for-host` and `host-update-sync` stay as the Claude maintainer entry points once the bundle ships, or are they replaced by the bundle's installed versions?

## Out of scope

- Any change to the installer or the lane for this plan's first slice: the lane installs whatever a bundle declares.
- Adding `skill-attribution` to `software-engineering` or any other end-user bundle (decided 2026-10-03: no).

## Verification (when built)

- `npm run typecheck && npm test`, including the bundle-composition, skill-portability, licence-lint and Antigravity skills conformance suites.
- A real `--native` install of the bundle on each host into a scratch project, with the doctor clean, and the host listing the skill and subagent in one real session if the maintainer allows a spend.
