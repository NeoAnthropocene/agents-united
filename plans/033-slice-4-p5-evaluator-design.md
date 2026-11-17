# Plan 033 P5: concrete factory-evaluator delivery review

> **2026-11-10 applicability amendment:** On the carried `f2da922` baseline, retain this evaluator's reviewed exact capability classes, grants and read-only scope. ADR 0064's tracking migration for existing roles does not automatically apply the Task family to this later bounded worker: Host availability is not a role grant. It reports ordinary progress and a checked handback without those tools. The future main factory coordinator design owns accepted-task tracking; adding worker tracking would change coordination state and needs separate review. Existing merged roles and tracking remain intact. Live Host behavior and combined-baseline verification remain **unverified**.

Prepared **2026-10-29** for implementation review. Actual checkout HEAD/planned-at and freshly fetched origin/dev are **72e2cf4ddc92a6120313c5039f1bc39bc4b4f021**, branch **codex/plan-033-claude-delivery-oct28**, Node **24.19.0**. A fresh explicit-repository PR check returns no open PR; #199–211 are merged. No new overlap or baseline change was found. [P4 offline acceptance](../docs/plan-033-p4-verification-2026-10-29.md) precedes this separate design: 243 files / 5071 tests / 209 skips, actual full-suite exit 0, complete raw output read, with its 95-file review packet preserved. This document promotes the ignored research draft after review; no P5 role, Skill, binding, helper, test or new ADR reservation is implemented. Whole-plan scope persists; the maintainer has confirmed the new public test seam. No Host/model/provider session, private-record invocation, commit/push, publication or merge is authorized.

## 1. Outcome and independent completion boundary

Deliver one **ordinary foreground, read-only factory-evaluator subagent**, a compact required `evaluate-artifact` runbook, a bounded fixed review-job/result protocol and caller-operated deterministic record checks. The evaluator judges semantic quality against the caller's fixed rubric and the verified final bytes. Its opinion never substitutes for deterministic validation, observed Host behavior, human acceptance or publication approval.

The first evaluator delivery reviews the **currently authored text artifacts**: a shared definition/contract pair, one complete portable/Claude Skill, or a Claude native agent and its declared support. A job declares exactly one of these scope kinds and a bounded complete candidate inventory. Arbitrary binary/media quality, executing generated code, another Host, a whole-registry audit or a full Bundle migration are unavailable here. A larger Bundle review is partitioned into explicitly scoped jobs; a bounded job cannot imply review of omitted artifacts. The later coordinator must account for that total coverage.

This is one independently reviewable evaluator delivery. It does **not** include the main-thread factory orchestrator, automatic dispatch/repair loop, Domain/Organization templates, sync, another realization adapter, managed Option A installation or a new session reader. ADR 0048 still requires the future orchestrator to spawn/check this evaluator; installing a worker alone does not complete that orchestration requirement or the Claude stage. P4's current reader remains the sole reader implementation and package entry.

## 2. Authoritative prior art and Host fit

Inspected current Plan 033 requirements/host sequence, ADRs 0048 and 0060 (factory draft previously 0057), slice-4/P2/P3/P4 designs; `.claude/skills/realize-for-host/SKILL.md` and the sync entry as maintainer prior art; `src/core/{claude-factory-binding,factory-check,readonly-guard,host-profile,claude-projector,installer,types}.ts`; native realizer/reviewer, the realizer core/contract/runbook/binding and installed record-check patterns. Host-fit research also inspected the current agent/skill/hook/tools/orchestration guides, their relevant locked snapshot sections, guard-file and later worker-mechanism observations, profile and complete tool policy. No installed Host probe or private record was opened for this draft.

Claude's profile/library is **reviewedAgainst 2.1.285**, minimum **2.1.271**. These are not the current observed binary version. The relevant 2026-10-04 lock entries are:

| Snapshot | SHA-256 from current library lock |
| --- | --- |
| `pages/agent/sub-agents.md` | `b7458cb749979269a7db37d0adf853fe34541cee2ad477463fb16aa616a6c315` |
| `pages/skill/skills.md` | `acdf96599200090206dd21327022aa58b21e23dfebdaffaa974b2fdb25077e00` |
| `pages/hook/hooks.md` | `810f77b29367909a9b045bdce6a0b4061dfbd28352f3d804a0588b948d6df2d4` |
| `pages/tools/tools-reference.md` | `e0da8a3914ef811c6543ef8f7b31b3f8b2d548b4774f118981a9f13a21163909` |
| `pages/orchestration/workflows.md` | `44bbacf7088c723f2fcf0514329b594a2ec5bbb3c36636defceaaa914f293e8f` |

Use `sub-agents.md` sections on startup, available tools, preloaded Skills, foreground/background and frontmatter hooks; `skills.md` on invocation, preload versus fork and supporting files; `tools-reference.md` on native tool availability and SubagentHandback; `hooks.md` on registration, input, exit-2 behavior and nonblocking failures. Pinned observations include `2026-10-04-claude-2.1.288-guard-file.md`, `2026-10-19-claude-2.1.301-worker-lifecycle-live.md` and `2026-10-19-claude-2.1.299-step0-foreground-rerun.md`. They are dated observations, not evaluator invocation proof. The old illustrative read-only note in the hook guide differs from the current generated registration: current code wins.

## 3. Exact new source, installed and public test paths

| Artifact or edge | Exact path |
| --- | --- |
| Shared definition and unchanged four-field companion | `registry/core/subagent-factory-evaluator.core.md`, `registry/core/subagent-factory-evaluator.contract.json` |
| Native role | `registry/hosts/claude/agents/factory-evaluator.md` → `.claude/agents/factory-evaluator.md` |
| Shared and native runbook entries | `registry/skills/evaluate-artifact/SKILL.md`; `registry/hosts/claude/skills/evaluate-artifact/SKILL.md` → `.claude/skills/evaluate-artifact/SKILL.md` |
| Required runbook references | `registry/skills/evaluate-artifact/references/{job,rubric,evidence,handback}.md` → same relative paths beneath the installed Skill |
| Worked examples | `registry/skills/evaluate-artifact/examples/{claude-agent-review,shared-pair-review,skill-review}.md` → same installed relative paths |
| Executable schemas, fixed rubric and report guide | `registry/skills/evaluate-artifact/assets/{job.schema.json,result.schema.json,rubric.json,report.json}` → same installed relative paths |
| Caller-only record CLI | `registry/skills/evaluate-artifact/scripts/check-review.mjs` → `.claude/skills/evaluate-artifact/scripts/check-review.mjs` |
| New closed native declaration | `registry/hosts/claude/agent-factory-evaluate.binding.json`; its generated installed receipt is `.claude/skills/evaluate-artifact/assets/claude-binding.json` |
| Existing real read-only guard | `registry/hosts/claude/hooks/agents-united-readonly-guard.js` → `.claude/hooks/agents-united-readonly-guard.js` |
| Seven on-demand rule sources | `registry/rules/{skill-attribution,git-guardrails,test-driven-development,clean-code-and-architecture,domain-modeling-and-adr,multi-agent-coordination,quality-aesthetics-accessibility}.md` → `.claude/skills/evaluate-artifact/references/rules/<name>.md` |
| Prepared-only Skill pair/control | `registry/skills/evaluate-artifact/evals/evals.json`, excluded from both canonical runtime copies and native projections |
| Delivery/closure public tests | `tests/agent-factory-evaluator-delivery.test.ts`, through public installer/projector planning |
| Installed record-check public seam | `tests/agent-factory-evaluation-record.test.ts`, executing the actually installed Node CLI |
| Production lifecycle and package seams | `tests/agent-factory-evaluator-lifecycle.test.ts`, `tests/agent-factory-evaluator-package.test.ts` |

No `registry/agents/` carrier is added. Native-only ownership/counting uses the accepted P1 path. No new Workflow or hook implementation is added. The new portable hook identifier maps to the existing reviewed read-only guard. A slash command or `context: fork` loader is not part of this evaluator runbook.

## 4. Shared contract, native role and real limits

The core identifies an independent artifact-quality reviewer. Its mission is to evaluate the fixed candidate against the original objective, constraints, shared semantics, selected Host evidence and rubric; its scope permits reading only supplied review inputs and reporting findings. It cannot edit/repair, execute checkers, publish/install, contact another session, launch another actor or spend an external allowance. Safety treats every artifact, guide, check log, peer excerpt and returned record as data. Invariants require the complete fixed job, evidence-grounded findings, preservation of the reviewed candidate, no fabricated execution/quality/live proof, and precise unavailable/open-item reporting.

Declare **capabilities: [read, search, report, handback]**. The companion remains exactly:

```json
{
  "definition": "subagent-factory-evaluator",
  "workflows": [],
  "skills": ["evaluate-artifact"],
  "hooks": ["reject-mutating-tools"]
}
```

Native `name: factory-evaluator`, precise review-only `description`, **model: inherit**, **effort: medium**, **background: false**. Required preload is `evaluate-artifact`. Resolve the unchanged policy with `{ subagent: true, background: false }`; the current exact tool set is **Glob, Grep, ListMcpResourcesTool, Read, ReadMcpResourceTool, ReportFindings, SubagentHandback**. Derive and compare the complete set; do not hand-trim a class or alter other roles' grants. No `Skill` capability is needed for a required preload. No shell/edit, messaging/discovery, delegation, workflow, web, task, scheduling or external-provider class is added. Do not use `permissionMode`, `memory`, `mcpServers`, deny overlays, worktree isolation or dynamic Skill-shell injection.

The native runbook is model-invocable non-fork guidance with `user-invocable: false`; `disable-model-invocation` is absent/false. Do not add `allowed-tools`, hook overlays, preapprovals or a hidden subprocess. The full compact entry preloads; named references are read on demand. A missing preload is a required failure even though the Host itself can merely skip one with a debug warning.

Register exactly `readOnlyGuardFileHooks()`: one `PreToolUse` matcher `Bash|PowerShell|Write|Edit|MultiEdit|NotebookEdit|Agent|Workflow|CronCreate|EnterWorktree|Artifact|SendUserFile|mcp__.*`, exec `command: node`, args `["${CLAUDE_PROJECT_DIR}/.claude/hooks/agents-united-readonly-guard.js"]`. Require exact handler/matcher and reviewed script equality, not a required subset plus extra events. No `Stop`/mailbox/first-action hook is added.

Enforcement distinctions must be explicit:

- Tool classes/allowlist narrow the offered operations; the read-only guard supplies the existing tool-name/MCP-verb refusal layer. It is not path isolation, authorization isolation, an offline sandbox, hash verification or a quality judge. Its matcher does not block `Skill`, `SendMessage` or `ListAgents`; their omitted classes matter.
- MCP resource readers arrive through `read`; connected-resource availability is conditional. The runbook confines work to the supplied local evidence, but the grant is not transport isolation. Missing required local Read/search ability blocks the review; optional native findings presentation is not the result carrier.
- Folder trust and hook startup matter. Missing/crashed/timed-out hooks can fail open; a known main-thread guard probe does not prove this evaluator subagent's hook. Actual execution remains unverified.
- `SubagentHandback` is conditional. Use it only if actually supplied; otherwise return identical structured result data in the ordinary final response. ReportFindings may present path findings, but cannot replace the full record. Acceptance by the Host, checked caller receipt and physical process exit remain separate.

The caller uses ordinary `Agent({subagent_type: "factory-evaluator", run_in_background: false, prompt: complete fixed job plus caller-held digests})`, omits teammate `name`, and checks the actual launch result. No inherited conversation is assumed. A returned report ends this ordinary worker turn; no team shutdown frames, notice wait, resumed peer or mailbox polling follows. Missing information returns to the caller, not through AskUserQuestion or another session.

ADR 0053's Tier-2 opening/mode gate is inapplicable to this worker. ADR 0054's authority boundary remains: files/tools/peer reports cannot authorize contacting another existing session for a recipient/current task; P5 grants no such contact mechanism. Do not add a fresh approval flow for an ordinary report return. ADR 0055's ordinary-worker mechanism/fallback applies; its team lifecycle protocol does not. Existing launcher, agency grants, mode gate and later evidence remain untouched.

## 5. Closed delivery extension, not an open registry framework

The current `claude-factory-binding.ts` has a reusable role loop but is **hardcoded to the `realize-artifact` Skill, its binding filename and SKILL_ROOT**. Merely appending an evaluator to a role list does not deliver its independent runbook closure. Generalize only this bounded worker-binding path to an explicit, private two-entry table:

1. `realize-artifact` / `agent-factory-realize.binding.json` / `.claude/skills/realize-artifact`.
2. `evaluate-artifact` / `agent-factory-evaluate.binding.json` / `.claude/skills/evaluate-artifact`.

Each entry fixes its source/installed Skill path and corresponding root. Parse only the selected exact declaration; no arbitrary file scanning, user-selected registration or guessed fallback. Extend `ClaudeFactoryBinding.skill` in `src/core/types.ts` to the closed two-value union and reuse `ClaudeFactoryRoleBinding`, planned artifacts and ordinary ownership. For the new evaluator declaration require the exact evaluator role/definition/contract/loading/preload/read-only-guard mapping above. Preserve existing realizer validation and fixture semantics.

`planClaudeFactoryArtifacts`, `assertClaudeFactoryDelivery` and `assertClaudeFactoryTargets` iterate the active entries independently, then validate the combined plan for exact unique destinations and complete required edges. Rule destinations are rooted in the selected Skill, not the old constant. Existing `claude-projector.ts` combines their native role names so normal guard planning emits/refcounts both kinds. The new declaration requires all twelve support files, seven rule references, its own role, existing read-only guard and its own receipt. It has **no requiredInstalled dependency on realizer/author-contract resources**. The record helper is a standalone Node>=24 module with built-ins and its own executable schemas; P2/P3 algorithms are prior art, not runtime cross-Skill imports or a checkout dependency.

The evaluator closure must succeed in a focused factory fixture with **evaluate-artifact active and realize-artifact absent**, and fail meaningfully when its own binding/resource is missing. Its trigger and receipt must never be borrowed from the realizer. Keep production `agent-factory` under construction and Claude Code CLI/workspace/native only. Add `evaluate-artifact` only to that contributor Bundle; preserve full/department exclusion and recompute current counts/provenance rather than copying historical figures.

Exact consumer edits, only where needed: `src/core/claude-factory-binding.ts` and shared `src/core/types.ts`; `src/core/installer.ts` for owning-Bundle preflight, independent plugin refusal and copy-only/eval exclusion; `src/core/claude-projector.ts` for the independent plugin gate/combined closure if existing aggregate calls are insufficient. Existing update/doctor planning should reuse this same expected plan. `assertClaudeFactoryRemoval` must activate from the evaluator's installed receipt even if realizer/author-contract receipts are absent, and operate from installed ownership/hash records when source bindings are missing. Do not create another installer, lockfile, remover or an implicit legacy fallback.

Public lifecycle tests must cover edited/missing evaluator support, missing evaluator source binding during update, source-independent removal, realizer receipt/trigger absent, shared read-only guard ownership with an ordinary reviewer, implicit-store symlink requests, unmanaged late collisions and entire-state preservation. The existing direct `author-skill` request stays its original sole-Skill route, with no realizer/evaluator/author-contract additions. Generic direct evaluator/partial requests remain refused. Extend the actual binding-based test role map/conformance interpretation in `tests/helpers/{native-roles,native-delta,native-invariant-evidence}.ts` only if public conformance exposes an assumption; never exempt the new role or invent a canonical carrier.

## 6. Fixed review-job schema and caller-operated checker

Proposed new public deterministic seam, to confirm before its first test:

```text
node <installed-evaluate-artifact>/scripts/check-review.mjs --job <absolute-job.json>
node <installed-evaluate-artifact>/scripts/check-review.mjs --job <absolute-job.json> --result <absolute-caller-saved-result.json>
```

Both support `--help`. Unknown flags/properties and unsupported schema keywords fail. The helper reads its own bundled schemas/rubric by module-relative URL; no external schema resolution or runtime package download. It reads/pins files and may run only one fixed read-only `git -C <selected-checkout> rev-parse HEAD` per invocation to verify source identity, under a short timeout and log cap. It does **not** execute any job/result command, validator, generated hook/Workflow, model or Host. The evaluator itself has no shell and cannot run this helper.

Version 1 job fields are closed objects:

| Field | Required meaning |
| --- | --- |
| `version`, `id`, `operation`, `intent` | Version 1, nonempty review ID, operation `review`, local/upstream preparation only. No publication operation. |
| `authoringHost` | Claude Code CLI/workspace/native plus observed version or explicit unverified reason; do not equate profile minimum/reviewed baseline with observed runtime. |
| `subject` | Kind `shared-pair`, `skill` or `claude-agent`; exact semantic stem when applicable; source-relative owned paths; target Host context separately (`null` for host-neutral pair/portable Skill, Claude CLI/native for a native subject). No implicit other-Host adapter. |
| `objective`, `fixedValues`, `constraints`, `acceptance` | Original semantic brief and observable criteria, including preserved unknown values. Evaluation cannot silently replace the task with a generic checklist. |
| `source` | Absolute reviewed validation checkout, actual expected HEAD and explicit source registry. A separate private registry is not represented as committed to the validation checkout. |
| `roots` | Absolute candidate root, explicit read roots, caller-owned review/evidence root, managed/protected roots. Only the caller writes its named result/log files. The review root is disjoint from candidates, read/managed/protected inputs. Read-only evaluation may inspect expressly selected installed files; this does not authorize modifying them. |
| `candidate` | Complete exact relative inventory under its fixed root: kind, byte length and SHA-256 for every file, including unchanged/unrelated baseline files. Identify each file as subject, support or preservation-only so retaining a user's unrelated note is not mislabeled a quality review of that note. Reject missing/extra/duplicate/traversing/linked/case-colliding files. This inventory is fixed after caller validation and remains immutable throughout review. |
| `inputs` | Pins for the shared pair, relevant source/provenance/baseline/diff, selected guide and every cited locked snapshot/observation used, profile/tool policy/library lock where applicable, installed evaluator entry/runbook/rules/guard/receipt, and executable runtime/checker declarations. Each has kind, path, bytes/hash, sections, clear/held/unavailable disposition and required/optional meaning. Required unavailable or held evidence blocks its dependent acceptance. |
| `rubric` | Exact bundled rubric/version/hash and the selected applicability of its fixed criterion IDs; all required criteria must be answered. Optional/N/A is explicit with a reason and cannot hide a required delivery edge. |
| `checks` | Fixed caller-selected deterministic command IDs, pinned executable/argv/cwd declarations, exact candidate digest coverage and supplied raw receipt/log pins. Required versus optional, actual exit and passed/failed/unavailable/not-run remain distinct. Commands are data to this checker and evaluator. |
| `provenance` | Actual authorship/disposition, source/licence/comparison/notice/hold-record pins and unresolved items as applicable. Byte consistency is not legal clearance, originality proof or audit approval. |
| `runtime` | The actual Node executable and installed checker path/byte/hash pins. The Node pin must match the executing binary on Node >=24; the checker pin must match this installed script. Executable bytes are hashed under a separate <=128 MiB per-binary cap and are not supplied as model-review text or counted as ordinary evidence. |
| `budget` | Bounded files/bytes/findings/result/logs, at most six offline caller checks and 600 seconds for one worked review job. No external Host/model/provider execution, publication or automated repair. No allowance is inferred from a ledger remainder. |

Recommended bounded case limits: candidate <=32 files/1 MiB total/256 KiB per file; required evidence <=64 files/8 MiB total/1 MiB per file; result <=256 KiB, <=32 findings and <=16 open items; complete raw check logs <=512 KiB within the declared budget. Larger scopes need explicit partitioning or a separately reviewed budget, not silent truncation. These are per-job limits, not a limit on the implementation's full test gate.

Concrete caller-owned evidence names beneath the fixed absolute review root are `job.json`, `result.json`, `record-check.json`, and `checks/<id>.{raw.txt,receipt.json}`. IDs are safe single path components from the fixed job. The candidate is never written beneath this evidence root. The caller creates/saves these records; the checker writes only stdout/stderr. Its job-only form returns the actual job path/bytes/hash, canonical job and candidate digests, complete input pins, required-check readiness and explicit unavailable reasons. The result form adds the actual result path/bytes/hash and postflight record findings. `--help` exits 0; a consistent supported job/result exits 0, and invalid/unavailable prerequisites exit 1 with a structured reason. Exit 0 does not mean quality passed, a reviewer ran or a draft was accepted. Job/result envelopes are explicit exceptions to the evidence-root/read-root separation; other pinned read inputs stay disjoint from the caller-owned output root.

Canonical JSON recursively sorts object keys, retains declared array order and accepts only the finite values supported by the closed schemas; digests are returned beside the job rather than embedded self-referentially inside it. Pin checks reject links/junctions in ancestors as well as leaves, compare case-folded contained paths, and re-read/re-hash the complete selected closure at postflight. They detect observed drift but do not promise an atomic filesystem snapshot, exclusion of concurrent writers or sender authentication. A finding citation selects `sourceId` (`candidate` or one declared evidence input), its contained relative path and pinned hash, logical line bounds and a quote of at most five lines/1024 UTF-8 bytes. No citation can silently select a different root.
The checker calculates the canonical full-job digest and a canonical digest of the sorted actual candidate inventory; arrays keep their declared order. It compares actual files, source/runtime/loading pins, original baseline/diff/check input identity and mandatory edges. Neither digest authenticates a sender or proves that a model read the files. A checker presence or caller-written execution claim is not execution proof; the checker reports deterministic record validity and `executionProof: unverified`.

The caller first executes the type-appropriate trusted checks on final bytes: existing `contract-check` for a shared pair, actual source Skill layout/licence/portability/ratchet/provenance checks for a Skill, or existing `factory-check` with required preloads for a Claude agent. No new universal artifact validator is invented here. If those reviewed tools/builds are unavailable outside the npm package, return the exact missing prerequisite. The selected reviewed checkout supplies them; host-library snapshots are not silently bundled/advanced by P5.

Actual review-model execution spends the authoring Host account. The zero-live budget for offline fixtures does not make such an invocation free or authorize it. Current tests supply synthetic result records; any future maintainer invocation needs separately agreed account, prompt and cost bounds and inspection of the Host's own records. The job/checker supplies neither that authorization nor a paid external judge.

## 7. Rubric and returned quality result

Use a fixed, criterion-addressed rubric rather than a numeric aggregate score or a self-issued approval token:

1. **Task fit:** original objective, literal fixed values, constraints, acceptance and declared review coverage.
2. **Shared semantics:** correct shared identity/mission/scope/output/safety, preserved floor and exactly four permitted-affordance fields; native preferences do not rewrite shared meaning.
3. **Host fit:** applicable native guide/profile/tool policy, correct loading/mechanism/grant/guard/support and truthful deltas; N/A only for genuinely host-neutral scope.
4. **Dependency usefulness:** complete required delivery edges, required versus optional integrations, source availability distinct from loading/invocation, useful artifacts rather than dormant names.
5. **Evidence truthfulness:** actual complete inventory/diff/check/log scope, no unperformed check reported as executed, deterministic/quality/live claims separated.
6. **Provenance and ownership:** inspected source/licence/comparison/notices, truthful original/inspired/adapted disposition, unresolved audit/legal matters explicit; no unauthorized combining/removal or hold advance.
7. **Clarity and maintainability:** concise coherent instructions, progressive disclosure, meaningful examples/repair scope, avoid contradictory or repeated boilerplate. Existing deterministic ratchets remain evidence, not the evaluator's whole judgment.

The evaluator returns **data**, not a result-file path it falsely claims to have written. Result v1 includes `jobId`, `jobDigest`, `candidateDigest`, status `reviewed|partial|blocked`, subject scope, complete `inventory` tied to caller-pinned hashes, per-file `coverage` (`reviewed|preservation-only|unavailable`), criterion outcomes `satisfactory|needs-work|unverified|not-applicable`, findings, deterministic-evidence observations, limitations, `live: unverified`, open items and `acceptedDraft: false`. Every inventory entry has coverage; preservation-only files remain part of hash/preservation checks without pretending their contents were substantively reviewed.

Use overall opinion `no-blocking-findings|changes-requested|inconclusive`, explicitly an evaluator opinion rather than acceptance. Every required applicable criterion has a rationale and source citation; absent/unverified required evidence prevents a complete-quality claim. An overall no-blocking opinion cannot coexist with a CRITICAL/HIGH finding or an omitted required criterion. A truthful static review can retain live unverified without falsely calling all artifact quality inconclusive merely because no live session was authorized.

Every concrete finding has stable ID, rubric criterion ID, **CRITICAL/HIGH/MEDIUM/LOW/INFO** severity, confidence, source-relative path and pinned hash, start/end logical lines, bounded quote, rationale and actionable correction. Quotes are checked against actual logical UTF-8 lines (line-ending normalization for citation display only); hashes pin the original bytes. A missing resource is an open item/dependency failure or is cited at the actual binding line that requires it, not at invented lines in an absent file. Uncertain findings retain the ambiguity; severity is not inflated to appear thorough. Cross-file issues cite each relevant declared input, not an unapproved read path.

The returned inventory labels its hashes as caller-provided pins. The evaluator cannot honestly claim it recomputed SHA-256 through a tool it lacks. It reads the supplied subject/support bytes and returns observations/citations; the caller/helper recompute actual hashes. A matching echo, coverage claim or valid quote is not proof of exhaustive reading or a correct judgment.

The caller persists the returned record beneath the fixed review root, retains its original job/digests, runs `check-review --job ... --result ...`, and independently rechecks candidate/input pins and all relevant command execution evidence. Postflight rejects tampered/missing/extra reviewed paths, altered candidate/job/rubric digest, invalid citations/line ranges, contradictory complete status, substituted receipts and over-budget output. It never executes result text. Its output includes `recordValid`, actual result path/length/hash, candidate-match status and the recorded opinion while retaining `kind: deterministic`, `quality: pending`, `executionProof: unverified`, `live: unverified`, `acceptedDraft: false`.

The caller distinguishes (a) a structurally/hash-consistent record, (b) a reviewer actually invoked through the intended Host, (c) a useful independent quality opinion, (d) its own checked receipt and (e) human acceptance. A synthetic fixture proves only (a). Optional P4 report evidence can summarize separately authorized Host records; P5 neither invents a reader nor automatically opens private transcripts. Host acceptance of SubagentHandback alone proves neither caller receipt nor artifact quality.

Local intent ends with candidate + review evidence. Upstream intent may attach the same review data to the already-existing pinned contribution template for `dev`, with `sent: false`; no helper sends/commits/pushes. The evaluator proposes bounded repair scope only. The future coordinator/human issues a new or explicitly revised repair job, revalidates changed bytes, then requests review on the new digest. No automatic retry loop or delegated repair belongs in this role.

## 8. Meaningful expected reds and evidence

Announce exact seams before implementation and confirm the new `check-review` CLI boundary under the TDD skill. Use vertical public cases; do not test private helper functions or repeat the runbook's prose as assertions.

| Public seam | First/red behavior and positive proof |
| --- | --- |
| Evaluator delivery test | A focused owning factory fixture activates evaluate-artifact with realize-artifact absent. Current code silently ignores its new binding/role closure; expect a named missing-required-evaluator-edge refusal and zero complete-workspace/state mutation, then complete installed closure after the bounded binder extension. |
| Same, missing/mutated sources | Remove own binding/core/contract/native role/runbook/preload/support/schema/rule/guard; alter loading, model, grant, guard registration, receipt destination or native Workflow shadow. Fail before writes without relying on the realizer trigger/receipt. Unavailable plugin/global/other-host/direct partial routes fail independently. |
| Installed record CLI | First absent helper, then original known candidate and supplied synthetic complete/partial/blocked quality records. Exercise actual schema consumption via copied-schema counter-mutation, wrong fixed job/candidate/rubric hash, changed/unreported candidate files, invalid citation, missing required check, pass/nonzero inconsistency, lost notices, held source, linked/traversing/case-colliding paths, source/review-root overlap, finite/bounded counts and explicit unavailable optional deltas. No job/result-supplied command executes. |
| Lifecycle test | Actual production registration, native-only owners/hashes/doctor counts, idempotence and sticky update; edited/missing support; update source binding missing before migrations; unmanaged late collision preserves all state; removal uses installed records with source binding/realizer receipt absent and keeps edits/shared guard owners; copied source/runtime eval exclusion even when implicit store requested symlink. Old direct author-skill route remains unchanged. |
| Package test | Real offline npm pack/install with no source-registry overlay. Install actual evaluator/closed declaration/runbook/support/guard; run actual installed caller-only record helper against selected reviewed-source inputs and synthetic returned opinions. Independently read final paths/hashes/citations/check exits and preserve candidate bytes. No model or Host is invoked. |
| Existing conformance | Actual evaluator core/floor/class grant/model/preload/readonly guard; mutate the model/grant to show real binding-based interpretation. Reuse source layout/licence/portability/corpus gates and P4 reader regressions. No exemption, assertion weakening or legacy carrier. |

The prepared-only Skill eval fixture supplies the same complete data-rich review prompt with/without the runbook, plus an unrelated control with all necessary information and no authoring intake. Seeded quality issues and expected judgments are a future separately authorized behavior experiment, not deterministic validation or evidence that the evaluator ran. No live/paid eval is executed in this slice.

Completion evidence: full raw build/typecheck, hostlib verification, full serial suite and **full addon lifecycle matrix** because the closed binding/installation/ownership path changes; production installed-package proof; source/provenance/layout checks; meaningful red/green receipts; source hashes unchanged across final gates; separate review packet/delta from the parent's final P4 packet. Read complete outputs and actual exits. Run the full suite/matrix sequentially because their fixed scratch root is shared. No historical count substitutes for this candidate.

## 9. Dependencies, review decisions and still-unverified work

Required implementation dependencies are the accepted P1 native-only delivery path, current P2 candidate checker/record patterns, P3 contract-authoring semantics and current P4 reader when its optional evidence is used. The evaluator's installed closure is independent of realizer activation/resources. The main-thread coordinator remains a **separate pending consumer**, not a prerequisite to offline evaluator delivery or something this worker silently implements.

The genuine new review item is this evaluator's fixed rubric/result/caller-check protocol and closed two-entry registration extension. The new helper CLI needs explicit pre-agreed seam confirmation before tests. These are not new questions about the first Skill, existing author-skill loading, host/lane/scope policy, model posture or the approved host sequence. The implementer can make routine factoring choices inside this concrete scope; if the proposed record fields/scope/rubric change materially, amend the design before implementation. No numeric quality score, automated publication threshold, broader tool grant or additional model service needs a decision in this bounded design.

Actual evaluator invocation, useful/independent quality judgments, prepared with/without/control outcomes, native hook/preload/return behavior and authoring-account cost remain **unverified** until separately agreed maintainer-run evidence exists. A future main-thread orchestrator must genuinely dispatch and check this role before its pipeline is complete. Templates, sync, managed local installation, release/version policy, legacy retirement and later Hosts retain their own review boundaries.

Preserve R3 exactly as historical (seven expectations seen, Defne unverified, five fixed-brief violations; Pro/extra usage off; $3.7228101 then and $46.2771899 remaining then; headless 0/16, interactive 2/16 conservatively). Later R4, diagnostic, H12 and media/Plan 036/037 ledgers are separate and authorize no spending here. Keep root AGENTS.md, Plan 034 hold/baseline and unrelated Plan 035/036/037 implementation outside P5. Complete/review the Claude stage before Codex → Antigravity → Cline; OpenCode remains later.

## Maintainer seam confirmation — 2026-10-29

The maintainer answered **“Use this evaluator checker seam (Recommended)”** for the installed `check-review.mjs --job <absolute> [--result <absolute>]` CLI and the named delivery/record/lifecycle/package public tests. Implement these vertical slices under the existing whole-plan authorization. No live/private/paid invocation or repository publication authority changed.

**Runtime-budget clarification — 2026-10-29:** runtime/checker declarations are explicit top-level `runtime` pins; executable hashing uses a separate fixed 128 MiB cap. This avoids treating a Node executable as a <=1 MiB review-text input. The checker still invokes only its fixed read-only Git identity query, never the job's validator command. The pre-agreed public seam is unchanged.

**Scope/prerequisite clarification — 2026-10-29:** `subject.definition` is null for a Skill and the exact shared core/contract stem for a shared-pair or Claude-agent review; a native agent name does not have to equal that stem. Required profile/policy/library and type-appropriate guide/snapshot pins resolve against the explicitly selected registry/checkout, rather than any file merely labeled with that kind. The existing checker remains a record validator; caller-selected deterministic commands stay data and require independent execution evidence. Executable pins select physical paths, preserving ancestor-link refusal even with an NVM launcher junction. Candidate citations use inventory-relative paths; an individual evidence input uses its ID and basename. [Current implementation evidence](../docs/plan-033-p5-verification-2026-10-29.md) supersedes the initial no-implementation status above.

**Returned-pin origin — 2026-10-29:** result v1 requires `inventorySource: caller-provided`, so the structured worker record labels the hash origin explicitly. The caller-operated checker independently recomputes/compares actual pins; its deterministic output does not turn that echo into reviewer execution proof. This makes the original design's stated distinction concrete without changing the confirmed CLI seam.

**Executable-declaration clarification — 2026-10-29:** check executables are inside the explicit read scope, except the already pinned physical Node runtime. Passed/failed check records require an actual executable path/length/hash pin; not-run/unavailable records retain command data with null length/hash when unknown and do not open the missing executable. An optional unavailable check remains an explicit delta without blocking unrelated required checks. Required unavailability still blocks its dependent action and complete-quality claims. This is record consistency, not authentication of execution.

**Pre-freeze PR refresh — 2026-10-29:** [The latest PR assessment](../docs/plan-033-pr-refresh-2026-10-29.md) records new draft #212 and its ADR 0057–0059 reservations. The unpublished factory decision is now ADR 0060. Its shared-file overlap requires eventual integration care, with no factory runtime dependency; current source remains based on merged dev `72e2cf4ddc92a6120313c5039f1bc39bc4b4f021`. No pending licence policy, media capability, release permission or spending permission is adopted.
