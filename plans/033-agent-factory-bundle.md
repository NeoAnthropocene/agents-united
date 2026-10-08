# Plan 033: `agent-factory` Domain Bundle (maintainer and contributor tooling)

> **Executor instructions**: only the foundation slice is authorized; later slices are not built. The maintainer's answers of 2026-10-03 are recorded under "Decisions"; what is still open is under "Open questions". Write the ADR and the tests first, one reviewed PR per slice, each from a fresh `origin/dev`.

## Status

- **State**: FOUNDATION CANDIDATE — slice 1 authorized 2026-10-07; basic contract verified offline; awaiting foundation review and R3. Slices 2–5 remain parked pending separate reviewed PRs. Plan 035 findings remain historical below.
- **Priority**: P2 · **Effort**: L (a bundle, a catalog section, host-parametric subagents, workflows and hooks) · **Risk**: Medium (a new catalog section touches the CLI picker, the `full` bundle and the recommendation logic).
- **Category**: Catalog / Bundles / Contributor experience / Multi-host.
- **Depends on**: Plan 030 (licence-aware adaptation), `docs/skill-intake.md` (ADR 0023), Plan 032 (native host packages and the host docs library; ADR 0031 and its 2026-10-03 addendum).

## Why this exists

**Authorization amendment, 2026-10-07:** the maintainer has started slice 1 only. The plan was previously parked; foundation design is in ADR 0045 and the local-installation options are proposed in ADR 0046. Slices 2–5 remain separate reviewed PRs, in order (slice 4: realize, then sync). Plan 034's security hold and reviewed baseline remain intact.

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

**Foundation answers (2026-10-07):** ADR 0045 reuses the Semantic Core via a definition stem and adds only three permitted-identifier lists. The host input, binding/evidence record and pipeline/runbook responsibilities are specified in `docs/agent-factory-foundation.md`. Local drafts are reversible; installer, lockfile and doctor behavior is still **proposed**, with concrete options in ADR 0046. Repository CI remains authoritative; tool packaging and reader distribution are deferred. Merge/drop of the 39 other skills remains the maintainer's decision. These answers do not start later slices.

**Upstream contribution decision (2026-10-07):** guide contributors to open a scoped PR to `dev`. Existing PR/proposal templates were checked; the focused artifact PR template and `docs/artifact-contribution.md` specify the proposed contribution runbook. Its workflow/skill implementation waits for later reviewed slices. Local creation remains independent and does not require a PR.

## Foundation execution milestones (authorized 2026-10-07)

| Milestone | Acceptance criteria | State |
| --- | --- | --- |
| M0 Ground | Locate cloud checkout; read rules/plans/ADRs/guides; verify #172–#174 merged and #137 closed; fresh `origin/dev`, clean `codex/` branch; continuation and local-executor capability checked. | Complete; `gh` network access denied, connector verifies PR states. |
| M1 Design | ADR 0045 and foundation specification preserve all nine decisions; proposed ADR 0046 defers local install; record conservative defaults and host evidence. | Recorded. |
| M2 Red / green | Meaningful failing contract tests and red commit; minimal basic validator/type, host-reference checks and green commit. No catalog, bundle, native artifact or install-lane change. | Red `4c47bc3`; green `232f518`; review fix `89a8597` verified with 51 focused tests. |
| M3 Verification | Narrow checks then full `npm run typecheck && npm test`; save raw output and actual exit codes. Prepare exact local recipe; never substitute static/headless evidence for interactive behavior. | Final code: typecheck/test exit 0; 165 suites, 3625 passed, 210 skipped; raw records in `docs/plan-033-foundation-records/`. Cloud scratch static install/doctor exit 0; Windows/live unverified. |
| M4 Review | Inspect complete diff and every staged diff; check all PRs before each push; one PR to `dev`, no merge; inspect CI and repair relevant failures. | PR [#175](https://github.com/NeoAnthropocene/agents-united/pull/175), open to `dev`; CI run `37646280108` passed on `6809c0b`, logs read. Nothing merged. |
| M5 R3 handoff | Candidate includes merged #174; exact commit/install/launch/prompt and record-reading commands, all eight expectations under ADR 0044. Stop for maintainer's interactive evidence. | Maintainer reports R3 completed 2026-10-08; collection failed at session lookup. Corrected collector in `docs/plan-033-r3-handoff.md`; all eight assertions await host records. Do not rerun the session. |

### Fresh Claude allowance and ledger

Maintainer authorization: **50 USD TOTAL**, **16 headless prompts**, **16 interactive prompts**, retries count; original instruction: extra usage off. Quota resets replenish neither counter nor cost allowance. Codex five-hour allowance reported **100% available** at start; no tool exposes a current Codex reading. At approximately 15:17 UTC on 2026-10-07 the maintainer reported Claude **five-hour 0% used**, **weekly 58% used**, weekly reset **in 20 hr 47 min**; the five-hour reset time and current extra-usage switch were not supplied. The maintainer also authorized doubling the test amount if needed after checking quota; no increase has been used, and the original ceilings remain the working allowance. Obtain current readings before R3; never begin above approximately 85% five-hour usage.

| Method / account | Model / session / tested commit | Commands | Prompts | Cost | Claude quota |
| --- | --- | --- | --- | --- | --- |
| Cloud preparation; no Claude account invoked | No model/session; code candidate `89a8597` | Files, Node checks and repository verification only | Headless 0/16; interactive 0/16 | No Claude runs incurred; 50 USD unspent | Maintainer reading: five-hour 0%, weekly 58%; reset in 20 hr 47 min at receipt; recheck before run |
| R3, maintainer-reported local Claude session, 2026-10-08; actual account pending | `claude-sonnet-5-5`, `claude-haiku-4-5`; session id pending; intended `89a8597`, actual tested commit/CLI version pending confirmation | Intended launch/H1 from `docs/plan-033-r3-handoff.md`; `/hooks`, `/cost`, `/usage` reported; lookup failed, no executor-started run | Headless 0/16; interactive at least 1/16, typed replies/retries and full total pending | Reported session total **3.72 USD**; provisional aggregate 3.72, remaining **46.28 USD**. Sonnet 3.72, Haiku 0.0026 are rounded per-model readings, not extra charges to add to the aggregate. Teammate/cost-state reconciliation pending, not zero | Before: five-hour 0%, reset Oct 8 11:00 Europe/Berlin; weekly 60%, reset Oct 8 14:00. After: five-hour 13%, reset Oct 8 10:59; weekly 62%, reset Oct 8 13:59. Extra-usage switch not read in supplied output |

Additional reported session evidence: API duration 8m 22s; wall duration 12m 25s; 317 lines added and 44 removed. Sonnet: 35.7k input, 59.2k output, 7.6m cache read, 539.6k cache write. Haiku: 2.5k input, 31 output, no cache read/write. Main prompt cache: 35 requests, 96% cached input, no misses, warm (1h TTL, last activity 3m 4s ago). API request count is not the user prompt count. These are maintainer readings, not host-record verdicts; no further Claude spending while reconciliation is pending.

For each actual run add account, model(s), session id, tested commit, exact command/prompt, prompt-counter delta (including retries), per-model and teammate costs, aggregate cost and before/after quota readings. Unknown costs are pending, not zero, and block further spending until reconciled. No Claude CLI is installed in this cloud session and no Windows executor is exposed; live local checks are **unverified**.

### Continuation and checkpoint

Tool discovery found hosted reminder/automation tools, but no persistent-goal API, quota-reset trigger or target capable of resuming this same cloud task. No automatic resumption is configured. Preserve this checkpoint before any interruption; resume it instead of restarting completed work.

- Branch: `codex/plan-033-foundation`, from fresh `origin/dev` (`aa7dbe3`, contains merged #174).
- Commit: code candidate `89a859767e4dc7cb68d1b78c3be2023ed52d4d93`; red `4c47bc3`, green `232f518`; baseline `aa7dbe38126471151ee6aad3558bbc354ce8b024`. Published handoff/evidence commit `6809c0bfb4dd34fa0af42ebc2acec7d963ecb697`; current checkpoint/recovery commit is the branch tip (`git rev-parse codex/plan-033-foundation`). PR [#175](https://github.com/NeoAnthropocene/agents-united/pull/175), target `dev`, open/unmerged when checked.
- Milestone: M0–M4 complete; M5 reached: maintainer reports interactive R3 completed, records not yet collected; all eight host-record results unverified.
- Completed: ground/prior art, design/ADRs, red/green contract, review regression/fix, contributor guide/template and proposed runbook, exact R3 recipe.
- Verification: 121 narrow tests and hostlib integrity passed; final full gate: typecheck/test exit 0, 165 suites, 3625 passed, 210 skipped; full output read. CI run `37646280108`/job `112877770700` passed on `6809c0b` (same 165/3625/210); logs saved in `/workspace/plan-033-evidence/ci-494.txt`. Review regression: four intended failures (exit 1), then 51 focused passes (exit 0). Static cloud scratch install/doctor exit 0; no host session. Node v24.19.0; clean baseline; git fetch succeeded; connector confirms #172/#173/#174 merged and #137 closed. Required `gh` attempt failed with proxy `Forbidden`; no files changed before initial ground report.
- Remaining budget: headless 16; interactive at least one used, full reply/retry counter pending; reported cost 3.72 USD and provisional remaining 46.28 USD pending cost-state/teammate reconciliation. Current Codex quota unavailable (start reported 100% available); last Claude readings above.
- Blockers: `gh` API blocked by proxy; Claude CLI and local executor absent; PowerShell lookup failed before records could be supplied. Full session id, actual commit/account/CLI and prompt/cost reconciliation remain pending.
- Exact next action: **do not rerun R3**. The maintainer uses the corrected session-lookup/collection block in `docs/plan-033-r3-handoff.md` on the completed session and supplies the full id plus reviewed sanitized records. Verify the actual Claude project folder/cwd; run `npm run hostlib:session -- <id> --project <actual folder>` and committed `read-session.mjs` with `600`; preserve reports/traces, reconcile counters/costs and judge every expectation as seen/violated/unverified. Wait for that evidence; no interactive session or later slice is started by the executor. Before any future push check all PR states; if #175 has merged, use a fresh `codex/` branch from `origin/dev`. Resume this checkpoint, not completed work.

## Foundation progress log

- 2026-10-07 (M0–M1, OpenAI Codex): checkout `/workspace/agents-united` was clean on `work` at old main snapshot `4342cad`, so missing current documents were not treated as absent prior art. Fetched `origin/dev` and created `codex/plan-033-foundation` at `aa7dbe3`. PR states verified through the connector after `gh` was proxy-denied. Read cloud runtime/network policy (restricted, no VPN, no ready credential bindings reported), tracked `registry/rules/` because generated `.claude/rules/` is absent, the required documents, closing logs and host guides/observations. Recorded ADR 0045, proposed ADR 0046 and the foundation specification. No Claude prompts spent; no automatic waking or Windows executor established. The nine decisions are unchanged.
- 2026-10-07 (M2 red, OpenAI Codex): `npx vitest run tests/subagent-contract.test.ts tests/plan-033-findings.test.ts` exited **1**: 29 failed, 8 passed. All 28 new contract/reference tests fail because `validateSubagentContract` is absent; the plan-state test also requires foundation activation. This is the intended red state, before implementation. Maintainer selected a guided contribution PR to `dev`; the current PR template and artifact proposal issue forms were read before designing the focused template and future contribution runbook. No workflow/skill is installed in this slice.
- 2026-10-07 (M2 green, OpenAI Codex): added `SubagentContract` to shared types and the pure validator alongside the existing Semantic Core gate. The narrow command above passed **37/37**, exit **0**; adding the existing semantic-core suite gave **50/50**, exit **0**, saved as `green.{txt,exit}`. Reference checks pin two native roles on each of Claude, Cline and Antigravity and detect a seeded safety-floor mutation; this is static evidence only. Added foundation terms and the contributor guide/focused template; no registry, installer, native role, security hold or host baseline changed.

- 2026-10-07 (M3/review, OpenAI Codex): 121 narrow tests and hostlib integrity passed. Initial full gate in the restricted sandbox produced child-process `EPERM`/empty output; a controlled Node child probe worked with the tool network capability, which also permits local test servers. That run was stopped with actual test/gate exit **143** (typecheck **0**), preserved as `restricted-*`. With that capability, the full gate passed: **165 suites, 3624 passed, 210 skipped**, both command exits **0**. Diff review found sparse-array holes and inherited list fields accepted as explicit declarations: four meaningful red assertions (exit **1**), then the minimal fix (`89a8597`) and **51 focused passes** (exit **0**). Final full gate on that code passed: **165 suites, 3625 passed, 210 skipped**, typecheck/test/gate exits **0/0/0**; full raw output read and saved with exit files in `docs/plan-033-foundation-records/`. The cloud scratch install and doctor exited **0**: ten agency agents, two scripts and local session-guard wiring; Claude executable absent, so runtime warnings and live behavior remain unverified. R3 recipe pins `89a8597`, preserves the local clone, verifies the host project cwd and uses both readers including `600`. No Claude usage incurred.

- 2026-10-07 (M4–M5, OpenAI Codex): published four Conventional Commits through `6809c0b` after reviewing the staged/full diff and reading the full pre-push gate. Required `gh pr list --state all --repo github.com/NeoAnthropocene/agents-united` and `gh pr checks 175 --repo github.com/NeoAnthropocene/agents-united` both remained proxy-denied; connector checks verified the new branch had no prior PR and then #175 open to `dev`, unmerged. CI run **37646280108** / job **112877770700** completed **success**: typecheck, build, conformance and full suite; logs show **165 suites, 3625 passed, 210 skipped**. Final follow-up is checkpoint/index/ADR metadata only, with its CI checked after push. At M5 stop for the maintainer's interactive R3. No Claude prompts spent, no automatic wakeup configured, no Windows/live evidence claimed.

- 2026-10-08 (M5 collection recovery, OpenAI Codex): maintainer reported the expected Bash and Write|Edit|NotebookEdit hook matchers and R3 quota/cost readings recorded above. These establish reported matcher presence and spending, not live gate behavior or the eight expectations. The collector's `Get-ChildItem` reported illegal path characters; an unreplaced angle-bracket id placeholder is a candidate cause, not a Windows reproduction. Replaced the placeholder with `Read-Host`, validate the full UUID before constructing `-Filter`, use literal paths and honor the configured Claude directory; added a recent-session lookup and preserved cwd checks/readers with `600`. Windows execution remains unverified. PR #175 was checked open/unmerged before this documentation-only follow-up; no host run, rerun or later slice started. Documentation follow-up full gate passed: typecheck/test/gate exits **0/0/0**, **165 suites, 3625 passed, 210 skipped**; raw output and actual exit files saved/read in `/workspace/plan-033-evidence/r3-collector-recovery/`. This verifies repository checks, not PowerShell execution.

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

### Addendum, 2026-10-07 (the live hardening and the close-out: M3 and sessions N1 to N3; ADR 0042 and ADR 0043)

Plan 035 closed on 2026-10-07 (ADR 0043). Its live sittings added four findings that the foundation slice should carry. The plan stays parked and none of this starts the bundle.

**5. A rule that must hold on the first action needs a hook, and a hook needs a probe first (ADR 0042).** A prose rule for the digital-agency lead's first message held in 3 of 11 checks and in 0 of 6 live runs, four of them with a prompt that asked for it; a `PreToolUse` gate that holds the first call once did hold. What the probe showed is what a generated hook may rely on: at `PreToolUse` the transcript never holds the call being made (0 of 12) and lags by seconds; `UserPromptSubmit` fires from an agent's frontmatter; the lead's frontmatter hooks also fire for its teammates' calls (those carry an `agent_id`); `claude -p` skips the frontmatter hooks of a project agent, so a hook cannot be measured headless; a hook's message must offer no way out (the first version did, and the Opus lead used it falsely); a `.js` hook script must not call `require` at its top, because in a user's ES-module project it crashes and the host lets the call through; a global install has no project script to name, so it carries the agent without the hook.
- *Changes slice 1:* the contract's "hooks it may use" must say, per rule, whether the rule is enforced by a hook (a guard kind: a script file that is registered, refcounted and checked by the doctor) or only written down, and a rule that matters on the first action is the first kind.
- *Changes slice 5:* the host guides must say what each host's hook can see before a hook is designed; for Claude the facts above are the starting list.

**6. Provisioning is a procedure, not an install command (`mcp-setup`, ADR 0041; #161, #167, #170, #171; D44 to D58 and D63).** A lead that needs an integration checks it in its own session with `ToolSearch`, classes what is missing, asks once, installs only after the yes and checks the result. A running session never loads a server added after it started, so the lead then stops and hands over a restart command and a starting prompt. Claude Code has three routes: manual `claude mcp add --scope project`, a plugin that `/reload-plugins --force` loads without a restart, and a connector that only the user can sign in to. The tool names differ by route (`mcp__<server>`, `mcp__plugin_<plugin>_<server>`, `mcp__claude_ai_<Name>`), and `scripts/find-plugin.mjs` searches both catalogs because `claude plugin` has no search. Every package in the reference is pinned and dated, and one of the first choices was deprecated on npm.
- *Changes slice 3:* the bundle's first skill can be this one (`mcp-setup` is the worked example), and its references are the part that must carry a "checked on" date.
- *Changes slice 4:* Cline and Antigravity each have their own answer to "does a running session see a new server"; the host-parametric subagent needs it per host from the guide, never from Claude's.

**7. Proof against a real host has a price, and the price is part of the design (the M3 ledger of Plan 035).** A nine-role Sonnet team prompt costs about 3 USD and 13 points of a 5-hour Pro window; an Opus lead costs 0.5 to 0.6 USD for one kickoff (112k to 193k tokens of cache reads); the executor's own turns drew as much quota as the sittings (47 points of a window in session N2, for 11 typed prompts); a context past 400k tokens makes every turn dearer. Headless `claude -p` checks measure a single agent's first answer cheaply and nothing that depends on a frontmatter hook.
- *Changes slice 4's proof:* "proven against all three hosts" means one scenario per host with a ceiling, a fresh scratch install and a ledger row, plus a decision on which scenarios may run headless.

**8. A prompt rule is measured against a control (D38, #153).** The "inputs first" rule cut output tokens by 61 to 68 percent on data-poor prompts; its first version failed the data-rich control and was tightened. A rule is only as good as its control, and one run per cell is a thin sample.
- *Changes slice 3:* the first skill ships with an eval pair (with the skill and without it) and a control prompt on which the rule must not fire.

**Further open questions.**
4. Is a guard kind (a hook as a script file with a doctor check) part of the basic subagent contract in `registry/core/`, or a per-host addition? ADR 0042 built one for Claude only.
5. Does provisioning belong to this bundle, or to every bundle whose lead needs integrations? Today it sits in `mcp-setup`, which the digital-agency lead loads.
6. Who owns the lead's open gaps (it asks six questions at once and does not say who supplies each item): the factory's "author an agent" skill, or the owner of each bundle?

## Out of scope

- Any change to the installer or the lane for this plan's first slice: the lane installs whatever a bundle declares.
- Adding `skill-attribution` to `software-engineering` or any other end-user bundle (decided 2026-10-03: no).

## Verification (when built)

- `npm run typecheck && npm test`, including the bundle-composition, skill-portability, licence-lint and Antigravity skills conformance suites.
- A real `--native` install of the bundle on each host into a scratch project, with the doctor clean, and the host listing the skill and subagent in one real session if the maintainer allows a spend.
