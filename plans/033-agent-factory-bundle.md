# Plan 033: `agent-factory` Domain Bundle (maintainer and contributor tooling)

> **Executor instructions**: this is a plan, not yet built. The maintainer's answers of 2026-10-03 are recorded under "Decisions"; what is still open is under "Open questions". Write the ADR and the tests first, one reviewed PR per slice, each from a fresh `origin/dev`.

## Status

- **State**: PROPOSED, scope shaped by the maintainer on 2026-10-03 (chat). Nothing is built. Parked; Plan 035 findings recorded on 2026-10-04 (see "Findings from Plan 035").
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
6. **The domain value is `contributor`**, with the picker label "Developers only: contribute to Agents United" and a one-line hint (accepted 2026-10-03).
7. **`domain` alone keeps `agent-factory` out of `full`, department installs and recommendations; no separate flag.** The purpose includes letting developers create their own agents locally, without pushing them upstream, so the bundle must work in a user's own workspace and must not assume a contribution to this repository (see the open design point below).
8. **The subagent contract in `registry/core/` stays basic**: for each subagent, its definition and the lists of workflows, skills and hooks it may use. Everything host-specific (frontmatter, tool names, hook wiring, native format) is written per host from that host's guide, not in the shared core.
9. **The Claude maintainer skills stay as entry points**: `.claude/skills/realize-for-host` and `host-update-sync` remain the Claude entry points for the maintainer once the bundle ships; the bundle's portable subagents are the versions other hosts (and other contributors) use, not a replacement.

## The `domain` value (decided: `contributor`)

`domain: "contributor"`, with the picker label "Developers only: contribute to Agents United" and a one-line hint. The existing domains are `architecture`, `business`, `design`, `engineering`, `marketing`, `research`, `security`, `universal` and `organization`; `engineering` already means building software for a user's project, so `development` would be confused with it, and `universal` is the shared meta-skill section. The CLI groups the two-stage picker by `domain` (a label map in `src/cli.ts`, twice), so a new value gives the separate section directly; the departments list and the "install the whole department" option need the same exclusion that `organization` and `universal` already have.

Consequences to design for (the maintainer decided that `domain` is enough, so the exclusions key on it): `agent-factory` must not be pulled in by the `full` bundle or a department install; the planner-orchestrator logic that recommends bundles needs a rule for it (listed only in its own section, not suggested for ordinary tasks).

**Design point for the slice 1 ADR (not decided):** developers may want to create agents locally and never push them. Where a locally created bundle, agent or skill lives (a workspace-local registry, the existing `.agents/` store, or a user directory), how the installer and lockfile treat it, and how the bundle's skills tell a local creation from an upstream contribution (for example, whether `skill-attribution` applies to a purely local skill) are not settled in the repository today and need prior-art search before design.

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

The four questions of the first round are answered (decisions 6 to 9). What is left is for the slice 1 ADR:

1. **Local creation.** Where a developer's own, never-pushed agents, skills and bundles live and how the installer, the lockfile and the doctor treat them (see the design point above).
2. **The basic contract's shape.** The exact fields of the shared subagent definition in `registry/core/` (definition, workflows, skills, hooks), and how a native package per host consumes it. Prior art: the existing Contract Floor in `registry/core/*.core.md` and the per-host profiles.
3. **Which workflows are pipelines and which are runbooks**, per host (a Claude workflow script, a Cline markdown workflow, a skill on Antigravity).

## Findings from Plan 035 (2026-10-04; this plan stays parked)

Plan 035 (Claude digital-agency hardening, pull requests #128 to #137) rewrote the agency skills and built two pieces of tooling. Nothing here changes the decisions above or starts the bundle; it records what the work showed, so the foundation slice does not rediscover it.

**1. A skill quality gate exists (ADR 0040, #129).** `scripts/skill-quality/measure.ts` measures the share of a skill's content lines found in a frozen corpus of lines that three or more skills carried; a skill at 0.30 or more is *templated*, a short hand-written skill with no extra files is a *stub*. A ratchet test fails any new templated or stub skill, with a shrinking allowlist of one marker file per skill (so parallel rewrites never conflict), and `tests/skill-rewrite-contract.test.ts` pins the contract of a rewritten skill (version 3.0.0: the seven sections, size limits, none of the template's phrases, a worked example, anti-patterns, evidence, a hand-off, a native role that loads it). **62 of 188 catalog skills failed the audit; 39 of them are outside the digital-agency bundle and were not touched.**
- *Changes slice 2:* the empty-but-valid bundle shell's guard rails should include "every skill of a bundle is loaded by some role or declared reference-only" (the audit found eleven agency skills that no native role loaded: the six agency playbooks and five others).
- *Changes slice 3:* the first skill is a strong candidate to be "write a skill that is fit for purpose", carrying the ADR 0040 contract, instead of a skill that only restates the intake procedure. The 39 other failing skills are a ready first job for the bundle (rewrite, merge or drop, per skill, by the owner of each bundle).

**2. What the audit showed about attribution and provenance.** The provenance record said `not-found` for six agency skills, and the read-only `hostlib:candidates` scan of the two upstream repositories named in plan 028 found the folders but only 2 to 11 percent text overlap with ours: the skills are independent writings whose `metadata.source` and `metadata.license` *overstate* a lineage the text does not show. Also: a rewrite that follows an idea of a public collection is not an adaptation (no `metadata.source`; a README credit as inspiration, naming the repository and the commit read), and three MIT collections (obra/superpowers, garrytan/gstack, affaan-m/ECC) were read as data in a quarantine with nothing copied.
- *Changes the `skill-attribution` rule (decision 3):* add three lines when the bundle is built: (a) compute the overlap against the named upstream with the candidate scan before claiming an adaptation; (b) a skill rewritten from ideas is original, with credit as inspiration and no source field; (c) a provenance record of `not-found` is a task with an owner, not a permanent state. The worked example is `docs/skill-quality/design-provenance.md` (#132).

**3. A session-report helper reads a host's own records (#135).** `npm run hostlib:session` reads a Claude session (the lead and every teammate record), pairs tool calls with results, and gives a verdict with evidence per open item; `session trim` writes a sanitised fixture. It reproduced three defects of a live run from the records alone.
- *Changes slice 4:* the host-parametric "realize an artifact" and "sync a host" subagents each need to read evidence from their host, not from the model's answer. Claude's reader exists; the Cline (`~/.cline/data/sessions/<id>/*.messages.json`) and Antigravity (`brain/<conversation>/.system_generated/logs/transcript.jsonl`) readers are the same kind of work and can reuse the trim and sanitise design (no system prompt, no account data, strings cut).

**4. A live-test kit pattern exists (`docs/live-test-protocol.md`, #136).** Each scenario has the exact prompt, a fresh scratch install, the evidence to read, what a pass and a fail look like, a cost estimate with a ceiling, and an order cheapest first, grouped into sittings the maintainer approves one at a time. It is the template for the factory's validation step per host; the Cline and Antigravity variants are the next documents.
- *Changes slice 4's proof:* "proven against all three hosts" can be stated as one scenario per host in this format, with the helper of finding 3 per host.

**New open questions.**
1. Where do contributor-facing quality gates live: in the bundle (a skill or a hook the contributor runs) or only in the repository's CI? The ratchet is a repository test today and no install carries it.
2. Who owns the 39 failing skills outside the agency bundle, and are *merge* and *drop* verdicts decided per bundle by the maintainer or by the bundle's owner role?
3. Does the bundle ship the session-report helper, or stay a maintainer tool in `scripts/hostlib/` (it needs a transcript only the maintainer's machine has)?

## Out of scope

- Any change to the installer or the lane for this plan's first slice: the lane installs whatever a bundle declares.
- Adding `skill-attribution` to `software-engineering` or any other end-user bundle (decided 2026-10-03: no).

## Verification (when built)

- `npm run typecheck && npm test`, including the bundle-composition, skill-portability, licence-lint and Antigravity skills conformance suites.
- A real `--native` install of the bundle on each host into a scratch project, with the doctor clean, and the host listing the skill and subagent in one real session if the maintainer allows a spend.
