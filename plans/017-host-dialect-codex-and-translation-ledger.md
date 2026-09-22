# Plan 017: Host Dialect Codex, Declarative Overlays, Translation Ledger & Projection-Conformance CI

> **Executor instructions**: Follow this plan step by step. Run every verification
> command and confirm the expected result before moving to the next step. If any
> STOP condition occurs, stop and report — do not improvise. When done, update the
> status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat dcbba4b..HEAD -- registry/ src/ tests/ docs/ .github/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.
>
> **Prerequisite sequencing**: Plan 016 must be **DONE** before this plan's
> Step 4 (the renderer refactor pins pre-refactor output to golden snapshots
> taken from 016-era renderers). Steps 0–3 may proceed while 016 executes.
>
> **Documentation snapshot**: Claude Code facts verified 2026-09-18 (see Plan 016
> § References). **Kimi (Moonshot) formats are UNVERIFIED** — nothing in this
> repository references kimi today (verified: 0 hits in `src/`, `registry/bundles.json`,
> `CONTEXT.md`). Step 0 is a doc-verification spike; never assume Kimi's formats.

## Status

- **State**: PLANNED — approved for execution, not started (architecture Option C approved by product owner, 2026-09-21)
- **Priority**: P1
- **Effort**: M (reduced from L by the Claude-only rollout scope below)
- **Risk**: LOW–MEDIUM (bounded by golden-snapshot pinning in Step 4 and fail-fast validation in Step 3)
- **Rollout scope**: **Claude only (v1)** — see § Rollout scope. Cline is the next target on its own branch, only after Claude passes the verification gate; all other hosts are deferred.
- **Branch (decided 2026-09-21)**: this plan executes on `feat/claude-code-projection`, **after Plan 016 is DONE**, as the second half of the single Claude deliverable; one PR to `dev` carries both plans' work once the verification gate passes. Cline work starts on a fresh branch cut from `dev` afterwards.
- **Depends on**: plans/016 (Claude compound-lane renderer shape; the `CLAUDE_DIALECT` lift point), ADR 0008/0013/0016/0017
- **Category**: core / architecture / CI
- **Planned at**: commit `dcbba4b`, 2026-09-21
- **Decision record**: `docs/adr/0019-host-dialect-codex-and-translation-ledger.md` (authored in Step 1)

## Rollout scope (product decision, 2026-09-21)

**v1 is Claude-only.** This plan executes against the `claude` dialect and lane exclusively:
`HOST_DIALECTS` ships with a single entry, the Translation Ledger carries Claude dispositions only,
the body-rewrite/lint runs in the Claude lane only, golden snapshots cover `.claude/` artifacts only,
and the CI workflow's **blocking** checks target Claude. The existing `cline`, `cursor`, `opencode`,
and `codex` renderers are **not touched** in v1 — their byte-identical contract is satisfied trivially
because they are unchanged.

> **Reading note:** wherever the design decisions below say "every projection-capable host", read
> "the `claude` dialect" for v1. The multi-host wording describes the **target state** to be reached
> by the follow-up plan, and the code is structured (host-keyed maps, host-keyed ledger, host-keyed CI
> jobs) so that reaching it requires adding data, not redesigning the lane.

**Rationale:** prove the whole loop end-to-end on one host — automated suite **plus owner manual
testing in Claude Code** — before generalizing. Only after Claude is verified does Cline become the
next target, on its own branch; every other provider follows later.

### Verification gate (v1 — must pass before any Cline work starts)

1. **Automated**: `npm run typecheck` exit 0 and `npm test` fully green, including the new Claude
   lane suites and the conformance guards.
2. **Owner manual, in a scratch workspace**: `agents add software-engineering -t agents --fanout claude -y --copy`
   → `.claude/agents/*.md` (stripped role names), `.claude/skills/*/SKILL.md`, `.claude/rules/*.md`
   present and marked managed; `lockfile.projections['.claude/…']` records `host: "claude"` with owners.
3. **Owner manual, in Claude Code**: launch the coordinator
   (`agents start software-engineering --host claude`, i.e. `claude --agent orchestrator-engineering`)
   → confirm (a) the coordinator delegates to a specialist through the Agent tool, (b) a specialist
   loads its projected skill, (c) the git-guardrails rule is honoured on a commit attempt.
4. **Owner manual, lifecycle**: `agents doctor` reports zero new warnings on a clean workspace; a
   hand-edited `.claude/` file is reported as *Content drift*; `agents remove software-engineering`
   leaves zero orphans and never touches a foreign `.claude/agents/*.md`.
5. Both parties record the outcome in the plan's status row before Cline work begins.

**Deferred to the follow-up plan (`plans/018-…`, authored only after the gate passes):**
- Lifting `cline`/`cursor`/`opencode`/`codex` mappings into `HOST_DIALECTS` and refactoring their
  renderers under the byte-identical golden-snapshot contract.
- Cross-host overlays and the full feature × host ledger matrix.
- The kimi doc-verification spike and any kimi dialect spec.
- Provider-by-provider rollout: Claude → **Cline** → remaining hosts, one branch each.

ADR 0019 must record this phased rollout and the verification gate as part of the decision's
consequences.

## Handover from the Plan 016 branch (2026-09-22)

Plan 016's branch now also carries the Tier 1 / Tier 2 parallel-work posture, and four of its findings bind this plan:

1. **`bodyToolVocabulary` completeness is load-bearing.** `send_message` was missing from the Claude lane's prose vocabulary (`CLAUDE_DIALECT`), so a specialist reading its own projected instructions saw the canonical spelling while the frontmatter mapped to `SendMessage`. Step 3's validation must make that class of gap unreachable: every token in `toolVocabulary`, and every token the catalog actually uses, needs either a `bodyToolVocabulary` entry or an explicit documented exclusion (`schedule` is the existing precedent, excluded because it is an ordinary English word). Add a lint that fails on any **unmapped canonical token surviving in a projected body**, rather than relying on the translation ledger alone. **Also carried into this plan by the 2026-09-22 amendment:** `manage_task` was corrected from `mapped` to `approximated` (the task tools are model-dependent), `SubagentHandback` joined the vocabulary and is granted to specialists (v2.1.271+, auto mode), and `model`/`effort` became a role posture (`roleModelDefaults` / `roleEffortDefaults`: coordinators opus/high, specialists sonnet/medium) instead of session inheritance — when these tables lift into the codex, keep the role-default resolution and the version floor for the hand-back tool, and keep validating the ledger against the live `tools` reference rather than the plan snapshot.
2. **`tier` is now explicit on every bundle.** All 33 Tier-1 bundles declare `"tier": "domain"`; only `digital-agency` and `mock-organization-under-construction` are `"organization"`. `tests/claude-agent-teams-posture.test.ts` guards that (a) no bundle loses its tier, and (b) every specialist declared by an organization-tier bundle carries the peer-messaging grant — both derived from `bundles.json` rather than hard-coded. Reuse that derive-don't-hard-code pattern for host-dialect conformance.
3. **Cross-host posture must stay report-only where the runtime lacks the feature.** Agent Teams is Claude-only (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`), so the Cline and Antigravity lanes print `Tier: …` / `Agent teams: not available on this host` and keep their own strategy, and `tests/claude-agent-teams-nonleak.test.ts` pins that nothing leaks into the Cline argv. When the Host Dialect Codex generalizes this lane, lift `resolveClaudeTeamsPosture()` (exported from `src/cli.ts`) into the dialect spec rather than re-implementing the Tier-1/Tier-2 decision per host.
4. **The Cline roster precedent.** The coordinator rule's `### Installed Specialist Roles` list now names the projected `.cline/agents/<role>.yml` **and** the canonical definition, mirroring the "Installed Workflows…" section. Generalizing the Cline lane under a dialect spec must preserve that dual-path shape (`<projection> | <canonical>`), and the `.cline/**` golden snapshots must be captured **after** this change, not before it.
5. **One renderer entry point per host — including the fallback.** Plan 016 had to route the *unbundled* Claude fallback through the dialect renderer as well: a fanout whose identifier has no bundle definition (`domain:*` pseudo-entries, addons, unknown bundles) previously fell through to the legacy generic projector, which dropped `invoke_subagent` and left coordinators with **no `Agent` tool at all**, and the resulting degradation was then frozen by the ADR-0017 guard. When the codex lands, make the dialect the only writer for its host so a new call path cannot silently regress the tool vocabulary, and keep `tests/claude-unbundled-fallback.test.ts` as the guard. Ownership for that guard is read from the recorded `canonical` (the compound planner stores `agents/<file>`, the fallback stores the `.agents/`-prefixed form) — if the codex changes that convention, the discriminator must change with it.

## Why this matters

The canonical-store + deterministic-projection model (ADR 0008) is **retained** —
but measurement shows translation loss today is real, large, and **silent**:

- **Frontmatter loss**: `hooks`, `permissionMode`, and `rules` (declared by all
  59 agents) plus `effort` (all 59) are dropped by non-Antigravity renderers,
  with warnings that nothing enforces.
- **Body-prose loss** (measured at `b9f9a78`; whole-word census, files/occurrences): `view_file` 38/73, `write_to_file` 33/48, `run_command` 31/64, `grep_search` 29/56, `schedule` 26/53, `replace_file_content` 26/35, `manage_task` 25/27, `list_dir` 21/33, `search_web` 11/21, `read_url_content` 10/19, `ask_question` 9/9, `invoke_subagent` 8/14, `multi_replace_file_content` 5/5, `send_message` 3/3, `generate_image` 2/3. `find_by_name`, `define_subagent`, and `manage_subagents` occur in frontmatter only. **18 distinct canonical tool tokens** exist across the catalog (full census in Plan 016 § Step 0 findings).
  The prompt prose itself is written in Antigravity dialect; today's only
  mitigation is a generic runtime note injected at the top of a projection.
- **Unexpressible provider strengths**: Claude `Agent(...)` delegation
  allowlists, `paths:`-scoped rules, skills `context: fork`, per-subagent
  `mcpServers`, Cline `maxIterations` — none of these can be authored in the
  canonical store today, so projected agents can never use them.
- **No CI enforcement**: `.github/workflows/` contains only `ci.yml`,
  `release.yml`, and `sync-main-to-dev.yml`. Nothing fails a PR that regresses
  a projection, drops a feature, or blows a description budget.
- **New-host cost**: onboarding a host (e.g. kimi) currently means a
  hand-rolled translator with hand-wired mapping tables.

**Product-owner decision (2026-09-21, "Option C")**: keep one canonical semantic
source; codify each provider as a typed **Host Dialect Specification**; unlock
provider-native features via **declarative overlays**; require every feature
drop to carry an auditable **Translation Ledger** disposition; deterministically
**rewrite canonical tool names in projected bodies**; and place LLMs in CI as
**advisor and judge only — never as the runtime translator of record**.

**Rejected alternatives (record these in ADR 0019):**

- *Provider-native multi-store* (authoring agents natively per provider):
  rejected because (a) drift detection itself requires a codex + comparator —
  i.e. this plan's machinery — so it pays Option C's costs plus N× authoring;
  (b) the lifecycle engine (lockfile refcounts, ADR 0017 hash-based staleness,
  clean uninstall, `--dry-run` fidelity) depends on projections being derived,
  regenerable artifacts; (c) the ubiquitous-language doctrine (`CONTEXT.md`
  Canonical Store — "the one folder you edit") would fragment into per-host
  dialects of truth.
- *LLM as translator of record*: rejected because `npx agents-united add`
  renders projections **on user machines at install time** — it must stay
  offline, keyless, deterministic, and byte-stable. An LLM in that path breaks
  ADR 0017 reproducibility and adds network/key/cost/nondeterminism inside a
  package manager.

## Current state (verified at commit `dcbba4b`)

| Area | Reality | Evidence |
|---|---|---|
| Host registry | `HOST_REGISTRY` is a **proto-codex**: dirs, markers, `ProjectionProfile` only — no field vocabularies, no feature flags, no budgets, no name rules | `src/core/hosts.ts:23-94` |
| Generic translator | `TOOL_NAME_MAP` and `ANTIGRAVITY_ONLY_KEYS` are hardcoded module constants shared by the claude/cursor/opencode profiles | `src/core/projector.ts:43-68` |
| Cline renderer | Mapping tables (prefix strip, `maxIterations`, slugify, entrypoint-rule skip set) hardcoded inside `ClineProjector` | `src/core/cline-projector.ts` |
| Claude renderer | Plan 016 (this branch) adds `claude-projector.ts` whose mappings are exported as the **`CLAUDE_DIALECT` pure-data constant** — the designated lift point for this plan | `plans/016` decision 16 |
| Declarative per-host precedents | `McpLocationRegistry` (cross-platform config catalog), `PrerequisiteChecker.generateClientConfig(client: 'cursor'|'cline'|'claude'|'antigravity')`, and the forward-compatible `BundleDefinition.rules` field | `src/core/mcp-locations.ts`, `src/core/prerequisites.ts:484-487`, `src/core/types.ts:92-98` |
| Fail-fast registry validation precedent | `RegistryResolver.validateBundles` rejects invalid `planningLoop` mode/budget combinations at catalog load | `src/core/registry.ts` |
| Warnings exist but are unenforced | `ProjectionInfo.warnings` surface to the CLI and vanish; no audit, no ledger, no CI gate | `src/core/installer.ts`, `src/cli.ts` |
| Body prose | Never rewritten; canonical tool names survive verbatim inside projected bodies (measured counts in § Why this matters) | `registry/agents/*.md` |
| CI | No projection-conformance job of any kind | `.github/workflows/` |
| Eval doctrine precedent | Two-Stage Hybrid Evaluator (0ms deterministic gatekeeper + schema-constrained zod LLM judge) already exists in `tests/e2e-evals/` — the CI LLM roles extend this doctrine | `tests/e2e-evals/judge.ts` |
| kimi | Absent — 0 references anywhere in the repo; formats unverified | grep over `src/`, `registry/bundles.json`, `CONTEXT.md` |

## Design decisions (product-owner-approved Option C, 2026-09-21)

1. **Canonical single-source retained** (ADR 0008 reaffirmed). ADR 0019 records the rejected alternatives verbatim (above) so the decision is never re-litigated blind.
2. **`HostDialectSpec` typed codex.** Interfaces live in `src/core/types.ts` (centralized-types rule); the specs are pure data in a new `src/core/dialects.ts` (`HOST_DIALECTS: Record<string, HostDialectSpec>`), one per projection-capable host (`claude`, `cline`, `cursor`, `opencode`, `codex`). Each spec carries: `id`, `fields` (per-field allowlist/vocab/map), `toolVocabulary` (frontmatter tool map), `bodyToolVocabulary` (prose rewrite map), `features` (capability flags: `hooks`, `delegationAllowlists`, `pathScopedRules`, `skillsFolders`, …), `budgets` (e.g. agent-description tokens, per-skill description chars), `nameRules` (regex), `launcher` (flag surface), `markerProfile`.
3. **Declarative overlays.** `projections?: Record<string, ProjectionOverlay>` on `AgentFrontmatter` (v1: agents only; bundle/skill overlays are forward-compatible later, mirroring how `BundleDefinition.rules` was introduced). Overlay keys are validated against the host's dialect spec at registry load — an unknown field or invalid vocab value is a **catalog-load validation error** (fail-fast, same doctrine as `planningLoop` validation). Precedence: overlay > dialect-derived default > canonical-derived value. Overlays may never introduce fields the spec marks unsupported.
4. **Translation Ledger.** New `registry/translation-ledger.json`: entries `{ feature, host, disposition: "mapped" | "approximated" | "degraded" | "unsupported", rationale, remedy? }`. Renderers must disposition **every** drop: dropping a frontmatter key (or leaving a body tool token) with no ledger entry is a **render-time error**, not a silent warning. `agents doctor` gains a warning class for undispositioned drops and a per-host ledger coverage report.
5. **Deterministic body-tool rewrite + lint.** During projection, canonical tool names in body prose are rewritten whole-word per `bodyToolVocabulary` (e.g. `view_file`→`Read`, `run_command`→`Bash`, `invoke_subagent`→the `Agent` tool, `schedule`→Cron tools, `manage_task`→`TaskCreate`/`TaskUpdate`; `ask_question` rewrites to prose guidance + ledger `approximated` because Claude excludes `AskUserQuestion` from subagents by default). Fenced code blocks are skipped. The **lint** scans the projected body post-rewrite and fails on any remaining whole-word canonical tool token outside code fences that lacks an `unsupported` disposition.
6. **LLM boundary (hard constraint).** Translators of record remain deterministic code — install-time rendering stays offline, keyless, and byte-stable. LLM roles are CI-side and human-gated only: **Advisor** (reads canonical + dialect specs, proposes overlays and ledger entries, flags gaps — PR comments only, never commits) and **Judge** (Stage-2 of the existing Two-Stage Hybrid Evaluator doctrine: Stage-1 deterministic gatekeepers stay blocking and required; the LLM judge is approval-gated, model-pinned, cached, and **non-blocking** so releases stay reproducible without network). LLM-drafted body-prose adaptation is explicitly **deferred** — revisit only after the ledger proves the drop residue is stable.

7. **Projection-conformance CI.** New `.github/workflows/projection-conformance.yml`, triggered on PRs touching `registry/**`, `src/core/dialects.ts`, `src/core/*projector*.ts`, or `tests/golden/**`: (1) **golden render** — deterministic render → byte-stable snapshot diff; (2) **ledger audit** — every Antigravity-only key × host carries a disposition, every body-lint survivor is dispositioned; (3) **body-tool lint**; (4) **conformance guards** — per-dialect name regex, per-skill description ≤ 1,536 chars, projected subagent descriptions < 15,000 tokens; (5) **Stage-1 deterministic gatekeepers** (blocking, required); (6) **optional Stage-2 LLM jobs** (advisor + judge; approval-gated, skipped cleanly when the LLM credential secret is absent so the workflow never blocks on missing secrets).
8. **Golden snapshots.** `tests/golden/projections/<host>/<bundle>/<artifact>` — committed, byte-stable renders covering every bundle × every projection-capable host. CI regenerates and diffs. Regeneration is an **explicit, reviewed act** (`UPDATE_GOLDEN=1` in a maintainer run, PR-visible diff) — never silent, so a renderer change that alters output is always a reviewed decision.
9. **Renderer-generalization contract.** Refactoring `cline-projector.ts`, `claude-projector.ts`, and `projector.ts` to consume `HOST_DIALECTS` must produce **byte-identical** output to the pre-refactor renderers for all existing bundles. Step 4 captures the golden snapshots *before* the refactor; any post-refactor diff is a STOP condition. (Plan 016's amendment already shaped `CLAUDE_DIALECT` as pure data so this lift is mechanical, not a rewrite.)
10. **kimi is spike-gated.** No `kimi` entry in `HOST_REGISTRY` or `HOST_DIALECTS` until Step 0 verifies Kimi's agent formats against official Kimi documentation. Deliverable: spike report + draft `HostDialectSpec` stored under `docs/spikes/` for a follow-up decision. Never assume; never stub.

**Non-goals**: LLM at render/install time; provider-native multi-store authoring; LLM-drafted body prose (deferred, decision 6); changes to canonical authoring semantics (overlays are additive frontmatter, never a second source of truth); altering the shipped Cline lane's behavior (only lifting its mapping tables); onboarding kimi beyond the spike.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Build | `npm run build` | exit 0, outputs `dist/` |
| Typecheck | `npm run typecheck` | exit 0, 0 errors |
| Test suite | `npm test` | exit 0, all tests pass |
| Targeted tests | `npx vitest run tests/<file>.test.ts` | exit 0, all pass |
| Golden snapshot refresh (maintainer, explicit) | `UPDATE_GOLDEN=1 npx vitest run tests/golden` | snapshots rewritten; diff reviewed in PR |
| Workflow lint | `npx yaml-lint .github/workflows/projection-conformance.yml` or equivalent parse check | valid YAML |

## Scope

**In scope**:
- `docs/adr/0019-host-dialect-codex-and-translation-ledger.md` (new ADR)
- `src/core/types.ts` (`HostDialectSpec`, `ProjectionOverlay`, `TranslationLedgerEntry`, budget types)
- `src/core/dialects.ts` (new — `HOST_DIALECTS` pure data, lifted from `TOOL_NAME_MAP`, `ANTIGRAVITY_ONLY_KEYS`, `CLAUDE_DIALECT`, and the Cline mapping tables)
- `src/core/registry.ts` (overlay + ledger validation at catalog load)
- `src/core/projector.ts`, `src/core/cline-projector.ts`, `src/core/claude-projector.ts` (consume dialects; body-rewrite pass; ledger-emission hooks; byte-identical refactor)
- `src/core/doctor.ts` (ledger coverage report; "Undispositioned feature drop" warning class)
- `registry/translation-ledger.json` (new — seeded with every current drop × host)
- `.github/workflows/projection-conformance.yml` (new — the 6 jobs incl. optional LLM roles)
- `tests/dialects.test.ts`, `tests/translation-ledger.test.ts`, `tests/body-rewrite.test.ts`, `tests/golden/` (new); existing projector/cline/claude suites updated where they pin hardcoded maps
- `docs/spikes/kimi-host-formats.md` (Step 0 deliverable)
- `plans/README.md`, `CONTEXT.md`, `README.md`, `PROJECT.md` (terms, rows, CI description)

**Out of scope**: kimi host registration (spike only); bundle-level or skill-level overlays (agent-level only in v1); LLM body-prose adaptation; any change to install-time rendering inputs (the npm package must keep rendering offline and deterministically).

## Implementation steps (TDD — Red before Green; execute in order)

### Step 0 — Claude-lane inventory + token scan (delegate: `subagent-repo-index`)
(a) **Claude-lane mapping inventory**: enumerate every mapping in `claude-projector.ts` (`CLAUDE_DIALECT`) with its destination `HostDialectSpec` field, and confirm that `projector.ts` and `cline-projector.ts` require **no** changes in v1 (they are out of scope — see § Rollout scope). (b) Body-lint token list: **already satisfied** by Plan 016 § Step 0 findings — the 18-token census, the files/occurrences counts, and the no-clean-equivalent set (`generate_image`, `schedule`, `ask_question`). Re-run only if `registry/` changed. Expected tokens with no clean Claude equivalent: `generate_image` (unsupported), `schedule` and `ask_question` (approximated). (c) **Deferred to the follow-up plan**: the kimi doc-verification spike and the cross-host map-lift inventory.

### Step 1 — Decision record & domain language (Coordinator)
Author `docs/adr/0019-host-dialect-codex-and-translation-ledger.md`: Context (the measured loss), Decision (Option C — the 10 decisions above), Alternatives considered (provider-native multi-store; LLM-as-translator — with the rejection rationale), Consequences (non-goals, deferred items, kimi spike). Add `CONTEXT.md` terms: **Host Dialect Specification (Dialect Codex)**, **Projection Overlay**, **Translation Ledger**, **Disposition (mapped | approximated | degraded | unsupported)**, **Body-Tool Rewrite**, **Body-Tool Lint**, **Golden Projection Snapshot**, **Projection-Conformance CI**, **LLM Advisor**, **LLM Judge**.
**Verify**: `npm run typecheck` exit 0.

### Step 2 — RED: codex, ledger, overlay, body-rewrite tests (delegate: `subagent-qa-automation-lead`)
Author failing tests; confirm each fails for the intended reason:
1. `tests/dialects.test.ts` — every projection-capable host has a spec; every canonical tool token appearing in registry agent frontmatter or bodies is covered by `toolVocabulary`/`bodyToolVocabulary` **or** carries a ledger disposition; budgets and name rules present per spec; spec data is pure (no functions).
2. `tests/translation-ledger.test.ts` — dropping a frontmatter key for a host with **no** ledger entry ⇒ render throws; with an entry ⇒ warning carries the disposition; ledger JSON validates against its schema; every current drop × host is seeded.
3. `tests/body-rewrite.test.ts` — a fixture agent body containing all 12 measured tokens renders per-dialect with every token rewritten (or dispositioned); fenced code blocks untouched; whole-word matching only (prose like "run a command" is never touched); lint fails on an unmapped survivor.
4. Overlay tests — a valid overlay reaches the projected artifact; an unknown field for that host fails catalog load; an invalid vocab value fails catalog load; precedence `overlay > dialect default > canonical-derived` pinned.
5. Golden determinism — repeated renders byte-identical; `UPDATE_GOLDEN=1` rewrite is idempotent.
**STOP if** the ledger seed cannot enumerate a current drop (unknown feature ⇒ STOP and report, do not disposition by guesswork).

### Step 3 — GREEN: types, dialects, ledger, validation (delegate: `subagent-backend-architect`)
Implement `HostDialectSpec`/`ProjectionOverlay`/`TranslationLedgerEntry` in `src/core/types.ts`; `src/core/dialects.ts` with `HOST_DIALECTS` containing the **`claude` entry only** for v1 (host-keyed so later plans add `cline`/`cursor`/`opencode`/`codex` entries without touching the renderer contract); `registry/translation-ledger.json` seeded with **Claude dispositions only** from the Step 2 enumeration; loader + fail-fast validation wired into `src/core/registry.ts`.
**Verify**: `npx vitest run tests/dialects.test.ts tests/translation-ledger.test.ts` green; `npm run typecheck` exit 0.

### Step 4 — Claude-lane generalization, byte-identical (delegate: `subagent-backend-architect`; **requires Plan 016 DONE**)
**First** capture golden snapshots of the Claude lane's renderer output for every installed bundle into `tests/golden/projections/claude/`. **Then** refactor `claude-projector.ts` to consume `HOST_DIALECTS.claude` (zero hand-wired vocab literals remain) and integrate the body-tool rewrite pass + lint into the Claude lane. **`projector.ts`, `cline-projector.ts`, and every non-Claude renderer are NOT touched in v1** — multi-host generalization is deferred (§ Rollout scope).
**Verify**: golden snapshot diff is **empty** post-refactor for `.claude/` artifacts; `git diff --stat` shows no non-Claude renderer modified; `npm test` green.
**STOP if**: any Claude golden snapshot changes after the refactor, any non-Claude renderer is modified, or any hand-wired tool/field mapping remains in the Claude lane.

### Step 5 — Overlays end-to-end (delegate: `subagent-backend-architect`)
Parse `projections:` overlays from agent frontmatter; validate against the host spec at catalog load; merge into renders with pinned precedence. Tier-3 test: install a fixture bundle whose agent carries overlays for two hosts and assert each artifact reflects its own overlay only.
**Verify**: `npx vitest run` overlay suite green; full `npm test` green.

### Step 6 — Doctor: ledger coverage + body lint on disk (delegate: `subagent-backend-architect` + QA)
Extend `src/core/doctor.ts`: per-host ledger coverage report; new warning class **"Undispositioned feature drop"**; body-lint surfaced for on-disk projections via the ADR 0017 re-render-and-diff doctrine (no speculative warnings on clean workspaces).
**Verify**: `npx vitest run tests/doctor.test.ts` green with new cases — undispositioned drop ⇒ exactly one warning with remedy; clean workspace ⇒ zero new warnings.

### Step 7 — Projection-conformance CI (delegate: `subagent-backend-architect`)
Author `.github/workflows/projection-conformance.yml` with the 6 jobs (decision 7), with the **blocking** checks scoped to the Claude lane in v1 (Claude golden snapshots, Claude ledger audit, Claude body lint, Claude conformance guards) and the job structure keyed by host so the follow-up plan adds hosts without redesigning the workflow. LLM jobs read a repo secret and **skip cleanly when absent** (never fail on missing credentials). Advisor comments on PRs only; judge reports only. Add docs rows (`README.md` CI section, `PROJECT.md` §10, `CONTEXT.md` cross-refs).
**Verify**: workflow YAML parses; a **synthetic regression PR** (temporarily revert one mapping / drop one ledger entry) makes the workflow fail in the expected job — test the tester, then revert; a clean PR passes all blocking jobs with LLM jobs skipped (no secret in CI).

### Step 8 — Adversarial review, full suite, docs & release (delegate: `subagent-code-reviewer` + Coordinator)
`subagent-code-reviewer` audits: ledger completeness, overlay validation gaps, rewrite false-positives (whole-word/code-fence rules), snapshot regen discipline, no LLM in the render path, no non-goal writes. Then full `npm run typecheck && npm test && npm run build`; update `plans/README.md` status; PR #1 → `dev` (`feat: …`), PR #2 `dev` → `main` per the two-step release flow.
**Verify**: 100% suite green; reviewer report has zero open High-severity findings.

## Acceptance gates

1. `npm run typecheck` exit 0 · `npm test` fully green.
2. The `claude` dialect has a validated `HostDialectSpec`; **zero hand-wired mapping literals remain** in the Claude lane, and every non-Claude renderer is byte-unchanged (`git diff --stat` proves it).
3. **Byte-identical refactor proof**: Claude golden snapshots captured pre-refactor are unchanged post-refactor.
4. **Body lint**: zero whole-word canonical tool tokens survive in any projected `.claude/` body outside code fences without a ledger disposition; the 12 measured tokens are all rewritten or dispositioned.
5. **Ledger audit in CI**: every Antigravity-only frontmatter key × `claude` carries a disposition; a render-time drop without a disposition throws instead of warning silently.
6. **Overlays**: a valid overlay reaches its host's artifact; unknown/invalid overlays fail catalog load; precedence pinned.
7. **CI**: the synthetic-regression PR fails the workflow in the expected job; a clean PR passes with LLM jobs skipped when the secret is absent.
8. **Determinism**: repeated renders byte-identical; `UPDATE_GOLDEN=1` regeneration is idempotent and PR-reviewed.
9. **Verification gate (§ Rollout scope)**: the automated suite passes **and** the owner's manual Claude Code checklist is recorded as passed — this is the entry condition for any Cline work. No provider beyond Claude is started on this branch.

## Risk register

| # | Risk | Sev | Mitigation |
|---|---|---|---|
| R1 | Claude-lane refactor changes byte output | High | Golden snapshots captured **before** refactor; any diff = STOP; non-Claude renderers provably untouched (decision 9) |
| R2 | Ledger maintenance burden grows with features × hosts | Med | CI enforces completeness (a drop without disposition fails); LLM Advisor drafts entries as PR comments |
| R3 | kimi / other-host formats unverified | — | **Out of v1 scope** — spike and non-Claude dialects deferred to the follow-up plan (§ Rollout scope); never assumed, never stubbed |
| R4 | LLM CI jobs add nondeterminism/cost | Med | Non-blocking + approval-gated + model-pinned + cached; skipped cleanly without credentials; never in the render path |
| R5 | Overlay misuse (wrong vocab, unsupported fields) | Med | Fail-fast catalog-load validation against the dialect spec |
| R6 | Snapshot churn masks real regressions | Med | Regeneration only via explicit `UPDATE_GOLDEN=1` maintainer run with PR-visible diff |
| R7 | Body-rewrite false positives (prose like "run a command", tokens in code fences) | Med | Whole-word matching, code-fence skipping, fixture tests for both cases |

## Delegation map (ADR 0015 planner-orchestrator posture)

| Phase | Specialist | Scope |
|---|---|---|
| Step 0 | `subagent-repo-index` | Kimi spike; map-lift inventory; token-list confirmation |
| Steps 2–7 | `subagent-backend-architect` | Types, dialects, ledger, renderer refactor, overlays, doctor, CI workflow |
| Step 2 & 6 | `subagent-qa-automation-lead` | Red-phase test architecture; doctor/lint test cases |
| Step 8 | `subagent-code-reviewer` | Severity-rated adversarial audit before release |

## References

- Internal: ADR 0008 (host projection), ADR 0013 (Cline compound lane), ADR 0016 (workflows→skills), ADR 0017 (staleness detection); Plans 007/008/015/016; `tests/e2e-evals/judge.ts` (Two-Stage Hybrid Evaluator doctrine); `src/core/hosts.ts`, `src/core/mcp-locations.ts` (declarative per-host data precedents).
- External (verified 2026-09-18, see Plan 016 § References): Claude Code docs — sub-agents, skills, memory, plugins, settings, agent-teams, agent-view, cross-session-messaging, worktrees, workflows.
- External (UNVERIFIED, Step 0 scope): Kimi / Moonshot coding-agent documentation.





