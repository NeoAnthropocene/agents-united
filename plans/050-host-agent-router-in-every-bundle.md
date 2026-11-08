# Plan 050: `host-agent-router` in every bundle, opt-in

**Latest status, 2026-11-08:** Locally implemented and integrated gate passed, with skips and separate matrix proof documented in the [final verification receipt](../docs/skill-quality/2026-11-08-final-verification.md). Actual model non-invocation remains **unverified**. Earlier gate statuses below are historical.

Status: locally implemented on 2026-11-07; sampled installation proof passed and a fresh integrated full gate remains required. [Plan 049](049-host-agent-router.md) merged through PR #215 into `dev` (`e0dd6a7`). Decisions are recorded in [ADR 0066](../docs/adr/0066-dormant-router-contract-in-every-bundle.md). Historical planning estimates below are superseded by the dated implementation log.

Goal: every bundle ships `host-agent-router` and the two skills its workers follow (`handoff`, `git-guardrails`), as a standing part of the bundle, and no orchestrator is pushed to use it. It stays dormant until the user explicitly asks to run work on another host CLI. Done when: a test fails if any bundle lacks the three skills, every lead orchestrator carries the same short opt-in clause, no orchestrator preloads the skill except `orchestrator-universal`, the gates and the full lifecycle matrix pass, and an install of one root bundle, one addon and one organization bundle shows the skills present and unused. Out of scope: changing the skill itself, new CLI flags, a resolver change in `src/` (see decision 3), any live host run.

## Ground — read on 2026-11-07

- 37 bundles: 13 roots (11 `domain` including `universal-skills`, `universal-orchestration` and `full`, plus 2 `organization`) and 24 addons that name a `parentBundle`. The router is in 3 today (`full`, `universal-orchestration`, the mock bundle); `handoff` in 8; `git-guardrails` in 15 (counts from `registry/bundles.json`).
- Nine lead orchestrators serve them; addons share their parent's orchestrator. Three bundles have none: `agent-factory` (under construction), `remotion-agent-skills`, `universal-skills`.
- Orchestrators list `skills:` in their frontmatter. `tests/bundle-skill-refs.test.ts` requires every skill an agent declares to ship in every bundle that includes that agent. So **declaring the router in a department orchestrator's frontmatter would itself force it into every bundle that orchestrator serves, addons included**, and would also preload it: the skill's text in context in every session of that orchestrator. That is the opposite of opt-in.
- Addons can be installed alone and survive removal of their root (lifecycle cases B1 to B4, C2), and shared skills are co-owned (A2 to A6). Adding three skills to 34 more bundles adds shared records to those cases.
- Two orchestrators are authored from `registry/core/*.core.md` (engineering, digital-agency) and projected per host (`registry/hosts/claude`, `cline`, `antigravity`); the others are single files. Every file that renders an orchestrator needs the same clause.
- No new skill enters the registry, so the registry total stays 218; the places that state which skills a bundle ships (README, PROJECT, CONTEXT, the Domain Atlas table) need a pass.
- The skill was tested only on Windows with WSL. On macOS and Linux there is one `local` side and the bridge is not used; that path is untested (see risks).

## Decisions to settle before building (recommendation first)

1. **Scope.** (a) Every bundle that has an orchestrator, plus `universal-skills`, and add `agent-factory` and `remotion-agent-skills` for uniformity: all 37. (b) Roots only (13), addons inherit by installing with their root. *Recommend (a):* addons are installable alone, the existing router test already enforces "all bundles that ship it ship its companions", and a rule with no exceptions is the easiest to keep true. The one thing to confirm: `agent-factory` is under construction with one skill and no agents; include it or list it as an exception with a reason.
2. **What "opt-in" means in the files.** *Recommend:* (i) keep the explicit-request description of the skill; (ii) give every lead orchestrator the same clause, written once and copied verbatim (it is a few lines: only when the user asks; name the hosts; get a yes; it spends the user's other accounts; use the skill only if installed); (iii) **do not** add the skill to the frontmatter `skills:` of the department orchestrators, so it is neither preloaded nor forced by `bundle-skill-refs`; `orchestrator-universal` keeps its declaration because it already has Phase 5; (iv) never set `disable-model-invocation` (ADR 0065 decision 8). Alternative: declare it everywhere and accept the preload; rejected because it adds context to every session for a feature most sessions never use.
3. **Mechanism.** (a) Data only: add the three names to each bundle's `skills` list, with a drift test. (b) A registry-level base list that the resolver appends to every bundle (a `src/` change, schema, and tests that read `bundles.json` directly). *Recommend (a):* no `src/` change, the test makes forgetting a new bundle impossible, and (b) can follow if bundles keep multiplying.

## Steps (test first, per `docs/session-start.md`)

0. After Plan 049 merges, a clean worktree and a new branch from fresh `origin/dev`. Goal statement first.
1. **Red.** Extend `tests/host-agent-router-skill.test.ts` (or a sibling file): every bundle ships the three skills (the exceptions list, if any, with a reason each); every lead orchestrator file, in the registry and in each host projection, contains the opt-in clause with its three gates and says "if installed"; no department orchestrator lists the router in `skills:`; `orchestrator-universal` still does. Watch each fail for the intended reason.
2. **Data.** Add the three names to the 34 bundles with a script that preserves the file's format and order, not by hand. Re-run `bundle-skill-refs` and `domain-atlas-contract`.
3. **Clause.** Write it once (draft in the plan's PR), then place it in the nine orchestrators: edit the two `.core.md` files and regenerate their projections; edit the other seven directly; check the native Cline, Claude and Antigravity packages that mirror orchestrators.
4. **Docs.** ADR, README, PROJECT, CONTEXT (bundle contents, the Domain Atlas table), this plan's log, `plans/README.md`.
5. **Gates.** `npm run typecheck`; `npm test`; once, `AGENTS_CI_FULL=1 npx vitest run tests/e2e-domain-conformance.test.ts` on an idle machine (about 27 minutes; it failed 179 of 317 once under memory pressure and passed 317 of 317 on rerun, cause of the first failure not captured).
6. **Install proof** in a scratch workspace, never the home directory: `agents add` for a root (`software-engineering`), an addon (`frontend-engineering`) and an organization bundle (`digital-agency`) for the Claude, Cline and Antigravity lanes; confirm the three skills land (without `evals/`), `router.mjs` is byte-identical to the registry, size delta noted, and an orchestrator session does not mention the skill unprompted.
7. **Hand over** uncommitted until asked.

## Risks, said plainly

- **A larger blast radius.** The skill starts other accounts' CLIs. Opt-in here is prose: the description, the clause, and the consent step. There is no hard gate, and an instruction hidden in a repository could still ask an orchestrator to "run this on another host". The mitigations are the explicit-request wording, the yes before the first run, read-only by default, the worker guard and the router's own record of changes; none of them stops a user from saying yes to something unwise.
- **Untested outside Windows and WSL.** Shipping to every bundle exposes macOS and Linux users to the single-`local`-side path, which has unit tests but no live run. Either run it live on one such machine before this lands, or say so in the skill's own text.
- **Dormant but present.** On a machine with none of the four host CLIs the skill does nothing; on one without Node 20 its script fails with a clear error. Neither affects the bundle's other skills.
- **Weight.** Three skills in 34 more installs, `router.mjs` included. Measure it in step 6 and report the number.
- **Test time.** The lifecycle matrix grows by shared records; its 27 minutes will not shrink.

## Not known yet

Whether any host projection copies an orchestrator's text rather than generating it (step 3 finds out); what CI's own matrix run reports; whether the `agent-factory` exception is wanted.

## 2026-11-07 — Delegated decisions and local implementation

The maintainer authorized proceeding and delegated routine implementation choices. Chose all current Bundles, no exceptions; explicit data declarations rather than a resolver feature; shared opt-in wording with existing consent for the same hosts/scope remaining valid. Router source is untouched. Factory's contributor/Claude-native workspace restriction and under-construction status remain; optional 3D retains its independent Arda placement and existing metadata, with no invented host restriction. No host sessions or account charges were started.

Fresh integrated inventory: **37 Bundles, 14 roots, 23 addons, three organization Bundles**. Without leads: `agent-factory`, `universal-skills`, `agency-3d-production`; the retired `remotion-agent-skills` Bundle is absent. Before this change router appeared in 3 Bundles, handoff in 9 and guardrails in 15. Now every Bundle explicitly declares all three exactly once. The physical registry remains **210 Skills** and `full` **205 end-user Skills**. The historical 218/34-more/13-root estimates above are not current inventory.

The shared clause is:

> Only when the user explicitly asks to run work on another host CLI, use host-agent-router if installed. Name the proposed hosts and explain that this spends the user's other accounts; get consent before the first run, treating existing consent for those hosts and this scope as valid. Otherwise continue this host's normal delegation. Follow the router's worker contract: read-only by default, one isolated checkout per editing worker, and verify the handoff against changed files before accepting work.

The nine canonical leads carry the clause; engineering and agency safety cores generate it into two Claude lead floors, the Antigravity engineering floor and Cline engineering rule. Cline's authored coordinator Skill carries it separately. Department frontmatter does not preload the router; universal keeps its declaration and Phase 5. Host-neutral wording preserves Cline's existing prohibition on Claude-specific dialect leakage. The engineering canonical safety section contains the clause verbatim so legacy projection continues matching its Core.

### Verification receipts and limits

- RED confirmed by the parent before implementation: `tests/host-agent-router-bundles.test.ts`, **50 intended failures, 21 passes, exit 1**; ignored `scratch/plan050-verification/red.log`.
- Generator checks: `UPDATE_NATIVE=1 npm exec vitest -- run tests/native-claude-agents.test.ts tests/native-cline-orchestrator.test.ts tests/native-antigravity-agents.test.ts --maxWorkers=1`, **169 passed / 3 files, exit 0**; `regenerate.log`. An initial Cline dialect failure was fixed by vendor-neutral shared wording, retaining the existing test. Generator-only line-ending changes were restored from the parent's pre-050 snapshot. Comparing all host source files against that snapshot leaves precisely the four expected floor changes and the authored Cline Skill; tools, hooks, specialists and rosters have no incidental changes. Router script bytes match the pre-050 snapshot.
- Focused contracts: `npm exec vitest -- run tests/host-agent-router-bundles.test.ts tests/bundle-skill-refs.test.ts tests/domain-atlas-contract.test.ts tests/core-safety-floor.test.ts tests/semantic-core.test.ts tests/native-conformance.test.ts tests/native-invariant-coverage.test.ts --maxWorkers=1`, **204 passed / 7 files, exit 0**; `focused-contracts.log`.
- Earlier wider focused run: **214 passed, 85 failed, exit 1**; `focused.log`. One engineering legacy safety mismatch was corrected and verified by the green contract run. The other 84 failures are in the unchanged upstream router suite: Vitest dynamic import raises `Invalid or unexpected token`; direct Node 24 import and `node --check` of the unchanged script both succeed. The parent is investigating the runner/upstream boundary; no test-harness bypass was introduced. Do not claim the router suite green.
- Commands used Node 24 through the cached runtime and existing npm wrapper. Initial sandboxed esbuild startup could not read an ancestor directory; local checks then ran with reviewed directory access. No host/model CLI was started.
- Installation proof belongs to the independent installation task; typecheck, full tests and the serial full lifecycle matrix belong to the parent integration gate. They remain pending for the changed tree. The previous tree's terminal green gate does not validate this change.

Acceptance clarification: offline tests establish installed availability, exact declarations, no department preload and coherent consent prose. The plan's original request to observe an unprompted session cannot be checked without a real host run, which is explicitly out of scope. **Actual model non-invocation, consent behavior and macOS/Linux router execution remain unverified.** No live-run requirement is silently claimed satisfied. Three retained source holds and the separate NOT READY audit-policy prototype remain unchanged. Work stays uncommitted pending an explicit publication request.

### 2026-11-07 — Isolated router loader compatibility diagnosis

The prior 84 router checks failed at import under the test runner; they were not passed tests or evidence of invalid product JavaScript. A minimal retained two-case probe (`scratch/router-loader-probe/`) changed only whether an otherwise identical ESM file had a Node hashbang: **exit 1, one passed and one failed** (`red.log`). Dumped SSR code shows Vite prepending an export helper before `#!`; installed vite-node removes a hashbang only when it is the transformed code's first character. Direct Node import and syntax checking of the unchanged router succeed.

The [official Vitest 3 configuration reference](https://v3.vitest.dev/config/#server-deps-external) documents exact-file RegExp externalization to native Node. Installed types agree. An exact-file externalization experiment nevertheless failed here (**85 failed, 12 passed / 97, exit 1**; `native.log`): the installed Vitest adds a project-`.mjs` inline pattern and installed vite-node tests inline before external. That precedence is an observed installed implementation detail, not a claim that the documentation promises otherwise. No broad externalization or dependency modification was adopted.

A temporary exact-file pre-transform blanked only the initial hashbang while preserving character/newline positions. The unchanged 95 router tests and two diagnostic cases then passed: **97 passed, exit 0**, `hashbang.log`. The approved production compatibility fix in `vitest.config.ts` targets only the exact router source path (normalizing Windows separators); diagnostic probe files are not included. Router source, test harness and assertions are unchanged; no discovery exclusions, deadlines or other flags changed. The actual configured regression result follows below; full combined acceptance remains the parent's responsibility.

Production matching resolves the router from the current config's `import.meta.url` using `fileURLToPath`, normalizes separators and compares equality with the transform ID after removing its query. Other copied router paths are excluded. Actual configured verification, after the independent installation workload finished:

```powershell
npm exec vitest -- run tests/host-agent-router-skill.test.ts tests/host-agent-router-bundles.test.ts tests/bundle-skill-refs.test.ts tests/domain-atlas-contract.test.ts tests/core-safety-floor.test.ts tests/semantic-core.test.ts tests/native-conformance.test.ts tests/native-invariant-coverage.test.ts --maxWorkers=1 --testTimeout=30000 --hookTimeout=30000
```

**Exit 0, 299 tests passed / 8 files**, including all **95 unchanged router tests** and **204 contract checks**. Log: `scratch/plan050-verification/router-config-green.log`. This resolves the prior loader failure for these tests; the earlier failed checks remain failed historical receipts, not retroactively passed runs. Router SHA-256 remains `7742ccda8cc8300c1f5107707d1ddb4d448c69f631193a6ed0ad0c1cbb379ba8`, byte-identical to the pre-050 snapshot. The diagnostic probe remains ignored scratch evidence, with no new implementation-mirroring test. Typecheck and the final combined full/matrix gate remain the parent's next verification boundary.

### Current integration receipts — 2026-11-07

The digital-agency Skill audit now records the two newly added shared support
Skills with their measured quality metrics, provenance and opt-in/runtime
limits. The existing audit-coverage ratchet found their missing rows during
gate 4; no threshold or assertion was changed. That run cannot be called green
on the strength of this subsequent documentation correction.

The isolated installation proof passed **14/14**, including an optional
before/after footprint measurement, root/addon/organization installs across
Claude, Cline and Antigravity, factory and optional 3D Claude installs, and
both shared-router removal orders. Router resources, hashes, ownership and
excluded evaluation folders were checked; the optional 22-install benchmark
took 116.711 seconds. The normal 13 cases retain 30-second deadlines and later
passed in the focused integration run. Measurements and logs are under
`scratch/plan050-verification/installation-proof-corrected.log`. Installation
and static declarations do not prove model non-invocation.

The factory's direct `author-skill` route now resolves the complete owned
factory package, including shared companions, while preserving Host, lane and
scope checks before writes. The focused factory/lifecycle and related checks
passed 112 tests; ten selected direct-entry, normalization and restriction
checks passed. The three stale factory expectations found in integrated gate 2
were updated for the shared assets and the affected five suites passed 201/201.
The router script remains unchanged. The earlier integrated gate 77135 ended
with one focused failure; gates 2 and 3 were interrupted after identifying
the stale factory and Host-library command-source expectations respectively.
Neither is a full pass. A fresh combined full gate including the complete
domain matrix is still required on the current tree.

### 2026-11-07 — Necessary factory entry integration repair

The parent's later acceptance preflight completed typecheck (exit 0), then stopped on **1 failed / 119 passed** in six factory/installation suites; no full suite began. The failing shipped lifecycle case installs `author-skill` directly. Adding three shared companions makes factory's declared Skill count four, so the old single-item-equals-complete-bundle guard now rejects its established bound entry. This is a product integration defect, not a fixture defect. Log: `scratch/final-integrated-gate-2026-11-07/factory-and-installation-focused.log`.

**Scope amendment:** the initial data-only/no-`src/` boundary was widened only to preserve this existing public entry under the maintainer's autonomous integration authorization. `InstallEngine.assertDeliveryAvailable` now recognizes the unique factory-owned exact `author-skill` direct request and resolves the complete `agent-factory` package through the existing RegistryResolver. The unchanged availability and actual Claude binding validation still run before any state write. This installs all companion Skills and attribution resources under factory ownership rather than granting an arbitrary partial restricted request. The ordinary partial-Bundle rejection, factory Claude-native workspace restriction, all 37 explicit declarations and router source remain unchanged. No resolver or schema behavior was added.

TDD: a new complete-companion ownership/removal regression failed with the same partial-direct error before implementation; four negative cases passed (unsupported host/lane/scope, arbitrary other restricted partial Bundle). RED **exit 1, 1 failed / 4 passed / 37 not selected**; `scratch/plan050-verification/factory-bound-entry-red.log`. After the narrow branch, both complete lifecycle and delivery suites passed: **exit 0, 42 tests / 2 files**, `factory-bound-entry-green.log`. This includes the previously failing public direct Claude API path, companion ownership/removal and all existing delivery guards. Existing unrelated longer lifecycle budgets were retained; no deadline was increased for this repair. Full combined acceptance must run on the repaired tree; the prior typecheck does not cover its subsequent source change.

Unchanged native loading/binding, author Skill and contributor CLI suites then passed **exit 0, 70 tests / 3 files**; `factory-bound-entry-binding.log`. Combined focused evidence is **112 passing tests**, with no host/model sessions, network calls or account spending. A subsequent integrated typecheck/full gate remains pending.

Independent review caught a further compatibility boundary before the full gate: RegistryResolver already normalizes `author-skill.md` and `author--skill` to the same direct Skill. The initial raw-identifier comparison rejected those existing forms. Two new successful-entry requirements failed before the correction, while two unsupported-target no-write cases passed: **RED exit 1, 2 failed / 2 passed / 11 not selected**, `factory-normalized-entry-red.log`. Promotion now checks the uniquely owned resolved single `author-skill` identity (with no agents/workflows), preserving the resolver's supported normalization rather than inventing aliases. The raw comparison alone was removed. Focused direct-entry, normalized-entry, ownership/removal and arbitrary-partial guard checks then passed: **exit 0, 10 passed / 36 not selected**, `factory-normalized-entry-green.log`. These selected checks are not a claim that all 46 tests were rerun. The parent can proceed to the complete repaired-tree acceptance gate.

### 2026-11-07 — Factory catalog expectation correction

The subsequent parent gate was deliberately stopped after observing three stale catalog assertions: CLI JSON discovery and two RegistryResolver cases still expected factory to contain only `author-skill`. The interrupted run has no terminal test aggregate and is not reported as a completed gate. Its log remains untouched.

Updated only these expectations to the exact four factory Skills, comparing without an ordering requirement: `author-skill`, `git-guardrails`, `handoff`, `host-agent-router`. Retained under-construction status, Claude-native workspace availability, no lead/parent and empty agents/workflows; the resolved factory attribution rule is checked exactly. End-user `full`, engineering and agency resolutions still exclude exclusive `author-skill` and its attribution rule while explicitly retaining the three shared worker Skills. No product behavior or restriction was changed for this correction. Full CLI/registry/delivery/lifecycle/router-Bundle focused results follow below; final acceptance remains a fresh parent gate.

The first focused run exited **1**, with **200 passed / 1 failed**: an added exact resolved-rule assertion omitted the resolver's existing baseline `GEMINI.md`. Corrected it to the exact existing baseline-plus-attribution set, without changing production behavior or weakening contributor isolation. The complete requested rerun passed **exit 0, 201 tests / 5 files**, normal 30-second defaults, **84.94 seconds**: `tests/cli-e2e.test.ts`, `tests/registry.test.ts`, `tests/agent-factory-delivery.test.ts`, `tests/agent-factory-lifecycle.test.ts`, `tests/host-agent-router-bundles.test.ts`. Logs are `scratch/plan050-verification/factory-inventory-green.log` (initial failure) and `factory-inventory-corrected-green.log` (terminal pass). Ready for a fresh final parent gate; no aggregate is inferred for the interrupted run.

### 2026-11-07 — Explicit golden review after terminal gate 4

Gate 4 completed with typecheck/package proof exit 0 and test exit 1: 5,372 passed, three failed, two skipped; all 317 complete domain-matrix cases passed. Two failures were the golden equality/idempotence checks; one audit-row completeness failure was corrected separately. These are not reported as a full green gate.

Reviewed all eight actual `captureClaudeGoldens()` artifacts through the real projector helper before regeneration. Under its existing EOL normalization, the only difference is the already approved Plan 050 opt-in safety clause in engineering. Raw EOL noise in other agent captures was not accepted. Explicit controlled `UPDATE_GOLDEN=1` regeneration passed four tests; restored the other seven snapshots byte-for-byte and retained engineering's original byte/EOL style with just the one clause inserted. No renderer/helper/assertion/deadline changed. The earlier frontend golden 3D change predates this review and was preserved unchanged.

Evidence: `scratch/plan050-golden-review/{capture.test.ts,review.json,review.log,regenerate.log,focused.log}`. Final focused golden/core-safety/router-Bundle/audit-ratchet verification passed **129 tests / 4 files, exit 0**. Gate 4 before/after watched records match; prelaunch comparison finds only `tests/golden/claude/agents/orchestrator-engineering.md` changed, with source/registry and domain-matrix inputs unchanged. Seven other golden hashes match the captured pre-regeneration bytes. Gate 5 therefore runs fresh standard CI (typecheck, package proof, serial full tests with existing deadlines), with `AGENTS_CI_FULL=0`: the separately recorded 317-case matrix is already validated against unchanged inputs. This does not claim gate 5 has finished.
