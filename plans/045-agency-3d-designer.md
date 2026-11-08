# Plan 045: Agency 3D Designer — reevaluated proposal

**Latest status, 2026-11-08:** Phases A–E have bounded implementation and scoped maintainer pilot evidence; phase F is deferred. The integrated local gate passed with skips and separate matrix proof; see the [final verification receipt](../docs/skill-quality/2026-11-08-final-verification.md). Revised Host adherence remains **unverified live**. Earlier status entries are historical.

**Current status, 2026-11-07:** Phase A placement is accepted and the actual
Phase B package is implemented. Bounded Phase C/D runtime and installation
proofs now exist, including a validated original GLB, viewer, PNG sequence and
current Shot Handoff. The fresh post-eval1 typecheck/full regression gate passed
after the cap correction: **254 suites, 4,971 tests passed and 210 skipped**,
with all 419 watched records unchanged. The explicit runtime/privacy matrix
passed **57/57** without skips; the r4 evaluation kit is ready. Phase E's
eval1 now has actual Claude 2.1.319 Skill/task use and scoped human functional
acceptance, including the separately corrected cap accepted for this prototype.
Eval2b now has accepted actual Arda-to-Motion production/playback and eval3 has
passed behavioral routing controls. The pilot cases are executed; explicit
role-instruction, tracking and reporting limitations remain recorded before a
broader conformance claim. The older r4 full gate remains historical evidence.
The later pilot-driven instruction hardening has 518 affected tests passing;
its first full regression encountered three lifecycle timeouts (4,973 passed,
210 skipped), with unchanged source. All three isolated cases passed under
the original deadlines. A subsequent serial gate passed 254 suites, 4,976
tests and 210 skips on the pre-integration tree; the newer integrated tree
needs a fresh full gate. Live adherence to the amended
instructions remains unverified; accepted prototype feedback is preserved.
The opening proposal below preserves the original planning scope; the dated
implementation entries and ADR 0062 record the later authorization and state.

Goal for this session: **reevaluate the supplied 3D Designer plan and specify a staged, evidence-based native workflow**. Done when: **scope, source findings, ownership, implementation slices, failure cases and maintainer-run briefs are reviewable**. Out of scope: **implementing the role, installing tools, downloading assets, starting host sessions, paid jobs and publishing**.

Historical proposal status: **Proposed; implementation unverified at the original planning checkpoint**. This replaces the attachment's numbering only: repository Plan 040 and ADR 0058 already concern Motion prompts. The original proposal reserved `docs/adr/0062-agency-3d-designer.md`; the later accepted decision and implementation are recorded below. [Source audit](../docs/research/2026-11-03-3d-designer-source-audit.md) records the planning evidence and gaps. The attachment's historical “settled” choices are inputs for reevaluation, not current permission to clone, install, upload, execute Blender or spend money.

## Recommendation

**Go** for Arda as a narrowly scoped Claude-native 3D specialist, proven first with supplied or local procedural GLB, one browser viewer/still route, recorded provenance and one Motion handoff. **No-go** for seven new Skills, seven library adapters, six operational MCP integrations, universal AR delivery and edits to every peer in one release. That scope combines too many unproven runtimes, terms and installation paths to interpret a failed pilot.

The first useful outcome is an installed specialist that consults its production Skill, produces an actually viewed result, rejects invalid/stale inputs and hands usable artifacts to Frontend or Motion. A larger role description is not that proof.

## What changes from the attachment

| Original choice | Revised proposal and reason |
|---|---|
| All five delivery families at once | First: GLB + browser viewer/component handoff + PNG proof; then frame sequence/Motion; later Blender/AR and one provider. Full OpenUSD stage assembly remains excluded. |
| Seven original Skills | Begin with `3d-design-direction`, `threejs-scene-production`, `3d-asset-review`, `workflow-agency-3d-production`; manual sourcing is a review reference. Split `3d-asset-sourcing`, Blender and generation into Skills only when their independently tested routes ship. |
| Seven adapters/search-and-fetch | Manual supplied/allowlisted asset intake first; one separately tested adapter later. SimReady Viewer is disabled; Scenario has per-row provenance; neither receives a guessed `/search` implementation. |
| No default renderer, presented every time | Preserve explicit renderer choice before production. First release supports Three.js/browser only and states this limitation; Blender is a deferred alternative, never a silent fallback. Ask once per project and again on a meaningful change, not at every asset. |
| CC0 → CC-BY → procedural → paid → Sketchfab fixed chain | Supplied assets with rights evidence first; then eligible library/procedural options selected by suitability and cost. CC0 preferred when comparable; no automatic paid escalation. Sketchfab is a separately permissioned source, not a license class or necessarily a more expensive route. |
| Zero-dependency inspector validates everything | Pinned Khronos Validator + supported metrics + target renderer proof. Unsupported compression/extensions/images yield explicit unsupported/unverified results. USDZ ZIP structure alone never means AR-ready. |
| Six MCP grants on Chris and Arda | No speculative grants. Add only a verified, selected integration, at its least needed tool scope; do not widen Chris merely because Arda can use a tool. |
| All peers, all workflows immediately | First change Chris, Arda, Frontend, Creative, Motion, QA and GRC only where their contracts require it. Campaign/Conversion/Content/SEO/Growth/Sound use existing conditional Media Request routing; extend them when a real brief demonstrates a missing contract. |
| Seven Skills in `digital-agency` and `full` | Prefer an optional `agency-3d-production` Bundle carrying Arda and the four production Skills together; base agency gains discovery/recommendation rather than a role whose Skills are absent. Phase A must prove native mapping and lifecycle behavior for the chosen layout. Do not silently widen ADR 0056's exception. |
| img2threejs pinned clone now | Optional link-only candidate later. Current upstream workflow changed; no code, model quality or binary-export claim is accepted from its name. Exact pin/license/notices and opt-in precede adoption. |

## Repository ground and prerequisites

Read `CLAUDE.md`, `registry/rules/` (this checkout has no `.claude/rules/`), session-start, PROJECT/CONTEXT and workflow guide. Source interfaces/contracts and tests win over older narrative counts. Relevant prior art: Plans 032/037/040/041/042/043, ADRs 0048/0056/0058/0060, `registry/core/subagent-motion-designer.contract.json`, Claude host guides and `audiovisual-review/scripts/review.mjs`. Lead prior-art PR checks include open #213 and merged #211/#212; this planning branch explicitly builds on #213's handoff commit. No 3D runtime or host proof exists in this plan.

Before each implementation slice: fresh `origin/dev`, check open and closed PRs, account for #213's final merge, inspect working tree and recheck assigned plan/ADR numbers. Work on a new `codex/` branch; PR target `dev`; commit/push only on maintainer request. Do not run the installer in this repository: its root `AGENTS.md` would collide with the hand-written pointer. Use isolated temporary test projects.

Phase A resolves the remaining installation choice with bounded fixtures rather than an engine refactor. The November 4 read-only audit below confirms that Bundle asset lists and domain rosters support an optional Arda Bundle structurally. The actual shipping invariant is canonical agent frontmatter: every declared Skill must ship in each directly declaring Bundle (`tests/bundle-skill-refs.test.ts`); the four-field contract validator validates schema and identifiers, not installation or Skill existence. Keep Arda and its declared Skills together. If placement still needs a base-agency exception, show its exact footprint in the ADR before implementation; do not infer that exception from the role concept.

## Ownership and contracts

Proposed role identity remains `subagent-3d-designer` / Claude `agency-3d-designer` / alias `arda-3d`. Shared core and four-field contract describe outcomes; native source is authored from `host-library/claude/guide/` using `realize-for-host` at implementation time. Canonical `registry/agents/` compatibility material is maintained only as needed; it is not the native source. No other Host is declared proven.

Chris owns consolidated scope, include/defer/decline, user questions and budget. Creative owns brand/look approval; Arda owns geometry/materials/camera, source scene and 3D technical delivery; Frontend owns product integration, loading/fallback/accessibility/performance; Motion owns coordinated timing and final audiovisual composition; Sound retains audio; QA measures target behavior; GRC checks provenance/rights. Arda cannot spawn peers or approve its own missing rights evidence.

**3D Request** (proposed domain term): destination/placement, required output, reference rights, supplied assets, brand/copy references, interactivity, camera/look, target devices/browser, dimensions, performance budgets, accessibility/fallback, renderer/route and local runtime prerequisite, cost/effort, acceptance, include/defer/decline. Motion requests additionally reference the approved timeline and scene/frame range. Consultation produces a bounded recommendation, not production or setup before scope acceptance.

**Asset Provenance Ledger**: stable ID; source page/provider and asset ID; creator; exact source revision and retrieval date; license identifier plus local evidence path/hash, required attribution and modifications; source file and SHA-256; dependency textures/materials/HDRIs and their own entries; transformation tool/version/options and derived output hash; rights review status/owner. Original procedural geometry records actual authorship and any external inputs, without inventing an upstream. A user-supplied file is not assumed cleared. CC0 copyright permission does not clear trademarks, likeness or other third-party rights. CC-BY derivative credits and modification notices travel with delivered assets. Unknown, non-commercial, no-derivatives or incompatible terms fail this commercial workflow; GRC must resolve them before delivery. No downloading first to discover a known blocked license later.

`media/3d.json` is a separate, strict, versioned nonsecret project record. Proposed fields: request ID/status; selected renderer/route and tool versions; target budgets; output paths; provenance ledger path; optional current Motion handoff path. No string unions written as literal sample values (`"threejs | blender | null"`); use actual values and a discriminated schema. Credentials, signed download URLs and provider authorization never belong here. Init preserves existing files; validator rejects unknown fields, invalid numbers, URL/drive/traversal/stream paths, mismatched IDs and invalid output bounds. Preserve `media/project.json`; extend shared schemas only via a separate reviewed change when required.

**3D Shot Handoff**: current `timelineRevision`, computed `timelineFingerprint`, scene ID and half-open `[startFrame,endFrame)`; fps, resolution, exact frame count; source scene/asset/renderer versions and hashes; color space/range, alpha/background, camera and units/origin conventions; output sequence or movie paths/hashes; proof/contact-sheet path; provenance and format/budget reports; open defects and unverified items. Import the installed sibling `audiovisual-review` `validateTimeline`/`timelineFingerprint`; never reimplement its hash algorithm or make a separate 3D timing authority. Reject changed cue/copy/timing even if the revision label is reused. Motion integrates and repeats applicable craft/proof/mux gates from Plan 043; Arda does not claim final sound sync from a silent sequence. A scene/material/code change also invalidates the 3D visual proof even if the timing fingerprint remains identical.

## Validation and runtime design

First supported interchange: glTF 2.0 GLB, ordinary triangle meshes and explicitly tested materials/textures/extensions. Pick and pin `gltf-validator` (or official executable) in the media project, retain its notice and structured report, and document supported extension limits. No package-manager runtime dependency is added for optional authoring. A small metrics helper can read already validated supported data; do not build a new standards validator.

Report bytes, primitive modes/triangles, scene instances, decoded bounds, material count, texture dimensions/decoded memory where measurable, extensions used/required and dependency locality. Distinguish stored primitive triangles from rendered instance totals. Handle indexed and non-indexed meshes, transformed/instanced nodes, sparse/interleaved accessors, embedded images and resource URIs correctly or reject the unsupported case explicitly. Draco/Meshopt/KTX2 support requires selected decoders and tests; no header-only estimates marked exact. Empty/corrupt/truncated chunks, oversized lengths, invalid accessors, missing images and unknown required extensions fail clearly. Default web targets of 100k triangles, 2048px textures and 5 MiB are proposed brief budgets, not vendor guarantees or automatic proof of Core Web Vitals.

Browser renderer: project-local locked Three.js and an already approved Playwright/Chromium runtime; fixed viewport/DPR, seeded randomness and explicit frame time (`frame / fps`), await asset/font/texture/shader readiness. Test capture with a real known scene and surface console/WebGL errors. A deadline reports failure; arbitrary sleep is not readiness. Use local assets, prohibit unintended remote resource fetches, confine outputs to project paths, and treat external scene code as code requiring review. Record browser/GPU/software backend so image differences are interpretable. Missing runtime yields a prerequisite/unverified outcome, never fabricated PNG evidence. FFmpeg is optional until video export; verify codec, fps/frame count, duration and pixel format with ffprobe. Frame sequence remains the simplest Motion boundary.

AR is deferred: GLB-to-USDZ is not lossless for arbitrary materials, animations and extensions. A future slice must pick a real converter and version, run OpenUSD packaging/compliance and supported ARKit checks, resolve all dependencies/units/scale, compare appearance, and obtain actual Apple target-device playback. ZIP checks are only packaging checks. Without tool/device evidence mark USDZ/AR **unverified** and deliver the proven GLB/poster instead if the accepted brief permits it.

## Source and setup policy

First intake allowlist: supplied rights-cleared files, original procedural assets, manually selected Poly Haven/ambientCG assets, individually checked Khronos models and Smithsonian CC0-designated items. Allowlist entries include specific asset metadata and permissible download hosts; license allowlist alone is insufficient. Automated retrieval in a later slice needs bounded redirects, HTTPS host validation at every hop, response size/time caps, traversal-safe filenames, atomic write/hash verification, no zip auto-extraction and redacted logs. Private/loopback/internal URLs are rejected. API keys use the documented environment mechanism; never print, persist or request the user's token in chat.

SimReady and Scenario remain documented research candidates, not shipped adapters. Sketchfab remains manual and asset-specific until current access/auth/API/MCP and terms are checked. One selected source adapter earns inclusion through a dated card, pinned fixtures, pagination/auth/rate/error tests and an approved bounded smoke, not through its presence in the attachment.

Blender Lab is a future opt-in route: evaluate the vendor's VM/system-isolation recommendation and establish an adequate isolation policy before execution; native hook permissions do not sandbox Blender's Python subprocess. No blanket `mcp__blender` grant is assumed. Meshy/Tripo/Rodin/3D AI Studio remain **unverified** integration candidates, with no config templates or pricing claims until the chosen vendor's official implementation is reviewed. Future paid jobs require provider/model/version, upload permission, output terms, current quote/units, currency ceiling, per-job approval, retry/cancellation policy and running ledger. A project preference/ceiling is not spend consent; a timeout must not cause a duplicate generation job. img2threejs remains an optional external link, reviewed at an exact SHA before any project-scoped clone/setup. This plan authorizes none of those actions.

## Implementation slices and acceptance

| Phase | Changes | Exit gate |
|---|---|---|
| A — decision and contract | Confirm addon/native roster feasibility; proposed ADR 0062, domain terms and placement; source/renderer supported subset; fixture and failure-case matrix. | Reviewed concrete placement and scope; no guessed MCP grants; no role promises for deferred routes. |
| B — narrow native package | Test first; core/contract and Claude Arda, four compact original Skills with truthful MIT authorship, references/examples and maintainer evals; Chris plus required peer consultation/handoff wording; bundle wiring for approved placement. | Floor/tool-policy/roster checks pass. Decline/defer/static briefs trigger no runtime/setup. Existing non-3D agency behavior passes. |
| C — local production/review | Test first; strict project/provenance helpers, validator wrapper, supported metrics, local deterministic browser still/viewer, installed sibling imports; manual source intake. | Valid GLB+PNG+viewer produced in isolated media project; malformed/unsupported/over-budget/uncleared cases fail usefully; source hashes and credits reach output. |
| D — installed lifecycle and Motion proof | Test first; real InstallEngine project-scope copy into temporary project, update/conflict/removal, short frame sequence and stale handoff checks. | All installed scripts/resources resolve with no repo source paths or maintainer evals; user scene survives update/uninstall; Motion accepts exact fingerprint then rejects a changed timeline. |
| E — maintainer native pilot | Maintainer types the briefs below in Claude TUI and supplies session IDs/project folder; resolve its encoded host record directory and read `npm run hostlib:session -- <id> --project <host-record-directory>`. | Installed/discovered/invoked/used tracked separately; actual artifact/view records and measured checks; maintainer visual/playback acceptance recorded separately from structural pass. |
| F — expansion, separate PRs | One source adapter, then Blender/AR or one generator only as demonstrated demand warrants. Add peer-specific workflows/Skills when those routes work. | Each has independent source/runtime/rights/cost evidence and target output proof; never reopen all deferred integrations as one prerequisite. |

Each implementation PR writes a dated log and runs relevant focused tests after red-before-green. Before any push run `npm run typecheck` then `npm test`, read each actual exit code, check open/closed branch PR state, and inspect `git diff --cached` before an explicitly requested commit. Full tests passing do not authorize a real host session or publication.

### Required test matrix

- Contracts/installation: expand roster sets semantically rather than replacing arbitrary numeric strings. Search `native-roster`, `native-install-lane`, `native-claude-tier2`, `native-claude-inputs-first`, `native-role-names`, `agency-media-roles`, `tests/helpers/native-roles.ts`, bundle validation and translation-ledger tests at implementation time. Assert addon absence as well as inclusion, applicable alias/role mapping, guard/hooks, exact Skill dependencies, optional runtime absence and no foreign host/MCP tokens.
- Project/lifecycle: own Skill resources, installed relative sibling imports and no `evals/`; copy and supported symlink behavior; idempotent init; malformed schema; Windows spaces/Unicode/drive paths; missing runtime; preserve user edits; safe update conflict and uninstall. Do not install into this repository root.
- Asset/provenance: tiny original synthetic fixtures with deterministic hashes; good, truncated and invalid GLB; non-indexed/indexed modes, transformed instances, sparse/interleaved data within supported subset; embedded/missing images; unsupported extension/decoder; over-budget, unknown rights, missing texture license and derivative credit; no network in default tests. Report explicitly unsupported cases rather than omit them from acceptance.
- Motion/runtime: actual proof render, frame count/time/readiness, local resource confinement; stale fingerprint with unchanged revision; same timeline with changed source hash; dimensions/fps/range mismatch; installed path execution. Test skip means runtime **unverified**, not passing proof.

### Maintainer briefs (no session started by an agent)

1. **Web proof:** “Use this supplied rights-cleared GLB for a keyboard-operable product viewer and poster. Keep the supplied copy, under 5 MiB/100k triangles/2K textures; reduced-motion/static fallback, no paid generation or setup. If a prerequisite is missing, report it.” Inspect actual Skill invocation, model viewer load, poster and measured report; Frontend checks interaction/fallback. Repeat with a bad/over-budget GLB: it must report the precise issue before delivery.
2. **Procedural Motion shot:** “Build an original simple unbranded bottle, using approved brand tokens. Supply frames for this approved timeline scene, no sound, no providers. Show a signature frame before final export.” Accept initial handoff, then alter a cue/text in the timeline without changing its revision. Arda/Motion must reject the stale fingerprint; changing material afterward must invalidate the visual proof. Maintainer views the frame/contact sheet and final integrated playback; keep human acceptance unverified until supplied.
3. **Routing/rights negative control:** “We may need AR later. Here is a model marked NC and a Scenario Hunyuan link. Compare options only; do not download, install or spend.” Expected: bounded include/defer/decline proposal, source terms flagged, no production/setup/upload, AR unverified. A normal static campaign with no 3D must not start Arda.

Before an eventual pilot, maintainer states account, quota where visible and cost ceiling; record actual session cost afterward. This plan itself has no model-session or paid-generation budget. No headless paid probe substitutes for the required maintainer-run protocol.

## Decisions remaining for review

These do not block saving/reviewing the plan: addon placement after Phase A feasibility; whether first proof should prioritize viewer or campaign still (recommend viewer plus PNG from one scene); exact project-local validator/Three.js/browser pins; first optional library adapter; whether a real AR device and isolated Blender system are available. Until resolved, they remain proposals. No deferred provider/version/tool name is implied by approval of the role concept.

## Dated log

### 2026-11-03 — planning reevaluation

Read the supplied plan and session handoff; checked current repository media/timeline prior art and bounded official source claims. Corrected occupied numbering, overbroad validation/sourcing assumptions and unsupported blanket MCP grants. Drafted phased acceptance with install/lifecycle and maintainer-native proof. Only this plan and the linked source audit are authored in this lane. Implementation, test execution, actual rendering, provider/auth behavior, asset-specific rights and human visual/playback acceptance remain **unverified**.

### 2026-11-04 — Motion pilot lessons and PR inclusion

The maintainer requested this plan in the Motion PR to `dev`. This authorizes publishing the proposal for review, not implementing the 3D role. The two Motion sittings strengthen the narrow recommendation: installed Skills were not consistently invoked, and the Remotion lead produced inline despite available specialists. Phase B must therefore give Chris one setup owner, require Arda's actual Skill invocation evidence and keep production/revisions with Arda. Reuse accepted ordinary local setup scope; avoid repeated permission questions, while preserving explicit no-install briefs, actual asset rights and separate paid/upload/global setup choices.

Phase E must inspect real worker records rather than role labels or self-reports. Include a cold-project setup case and an existing locked-project revision case; source/version/lockfile, invocation and resulting GLB/viewer/PNG proof are separate evidence. User feedback must retain its scope: a test-demo acceptance is not blanket production readiness. Read [Plan 044's next actions](044-motion-technique-library-and-hands-on.md#next-action-plan-ordered-by-evidence) before expansion. Immediate 3D work remains Phase A feasibility and contract review, then the four-Skill local route; no new paid integration or broad adapter rollout is a prerequisite.

### 2026-11-04 — bounded placement audit

Corrected the earlier speculative Contract Floor/install rationale: [validateSubagentContract](../src/core/semantic-core.ts) only validates the four fields and identifiers; [bundle-skill-refs](../tests/bundle-skill-refs.test.ts) enforces actual canonical Skill shipping. A contract-only Skill list installs nothing. [BundleDefinition](../src/core/types.ts), [registry resolution](../src/core/registry.ts) and [domain roster generation](../src/core/native-roster.ts) already support an optional Bundle containing Arda plus its Skills and advertise the supplying Bundle. Use domain `organization`; no core-engine refactor is justified by this read-only evidence.

One concrete caveat remains: parent resolution unions asset lists, but not the parent's `nativeRoles` or persona aliases. [Claude compound projection](../src/core/claude-projector.ts) uses the selected Bundle's mappings, and [native source lookup](../src/core/native-package.ts) matches the native filename exactly. The Remotion addon proves optional Skill delivery, not complete inherited-role parity. Phase A should compare two small fixture configurations: (1) a self-contained optional Bundle without `parentBundle`, installed atop an explicitly required existing agency, declaring/verifying shared helper dependencies; (2) a child Bundle with tested parent-role mappings. Accept one only when install/update/uninstall preserve existing agency names, aliases, ownership and user edits. Missing agency/shared prerequisites must produce a clear supported outcome rather than a falsely ready role.

The implementation checklist must include Arda's core/contract/canonical/native artifacts and native role mapping, generated Chris roster and `Agent(...)` allowlist, the static native guarded-role fixture, and an explicit `full` exclusion test (the current optional-Skill inventory exception only names Remotion). Restrict delivered availability to the proven Claude-native workspace route. These are existing integration surfaces, not completed Arda implementation. No 3D fixture install or runtime was executed in this audit; Phase A's lifecycle choice remains **unverified**.

### 2026-11-04 — Phase A fixture feasibility

[`tests/agency-3d-placement.test.ts`](../tests/agency-3d-placement.test.ts) uses a temporary registry and isolated copy-mode Claude-native project with an existing code-reviewer as a synthetic role, not Arda. The focused Vitest run passed 4/4 (exit 0). Installing a standalone fixture on top of `digital-agency` retained the sampled agency Motion native role byte-for-byte, gave shared `handoff` Skill files both Bundle owners, and removing the fixture retained that role and the shared Skill while removing the fixture role. A modified tracked Skill caused update to report a conflict and preserve the edited bytes. These are sampled fixture outcomes, not proof of all files or of a 3D package.

The standalone fixture also installed without `digital-agency`: the current installer did not enforce that prerequisite. Consequently this configuration does **not** yet meet the missing-prerequisite exit gate. Prefer the standalone shape only provisionally, contingent on an explicitly implemented and tested prerequisite outcome or a self-contained, independently useful design; do not claim that an unavailable prerequisite is detected. A parent-child fixture resolved parent assets but rejected parent `nativeRoles` mappings unless the child directly declared those agents. Without the mappings it planned `motion-designer` rather than `agency-motion-designer`; parent persona aliases were absent from the child definition. Redeclaring the roster brings the per-direct-Bundle Skill-shipping invariant and must be assessed before adopting that alternative.

This test does not establish all aliases, coordinator roster/allowlist discovery, standalone prereq handling, child installation/removal, edited-file uninstall, all shared helper dependencies, 3D artifacts, runtime rendering or live host behavior; those remain **unverified**. No engine change, model session or paid job was performed. A future implementation decision and ADR must resolve the prerequisite gate before claiming Phase A's complete exit criteria.

A concrete alternative to adding a core prerequisite feature is a self-contained optional Bundle: ship the role, all four declared Skills and its required shared helpers together, and make direct specialist use meaningful without Chris. Integrate Chris's discovery and delegation only when `digital-agency` is installed. This is a proposal, not the chosen placement: the synthetic code-reviewer fixture did not demonstrate a real independent 3D workflow. The smallest follow-on is a fixture-only contract and installation test for independent role discovery, all four Skills and helper resolution, plus an agency-present integration test for Chris's roster and allowlist; a missing-agency test must show the direct role is useful or clearly reports the unsupported integration. Then test update and removal with edited files before selecting this design or authoring an ADR. No Arda or runtime implementation is implied by these fixture tests.

### 2026-11-04 — Phase A placement decision

[ADR 0062](../docs/adr/0062-agency-3d-designer.md) accepts the self-contained standalone optional Bundle for the initial Claude-native workspace surface. The synthetic fixture now installs a native-mapped role first, with four synthetic Skills, their helper files and shared `handoff`, then installs the agency using a deliberately updated native Chris. `domainTypes`/`syncRoster` generate the supplying-Bundle roster row; the fixture separately authors Chris's `Agent(...)` entry, and checks the installed files and coexistence. The fixture also checks edited-Skill uninstall protection. It tests placement and metadata, not a host invocation or useful 3D execution. `personaAliases` is Bundle metadata; Claude alias invocation is **unverified**.

The supported design is direct complete-brief use when Chris is absent, and Chris-owned routing when he is present; no agency prerequisite is implied. Phase B must author the real role and Skills, integrate native roster/allowlist and guard/floor surfaces, and test exact dependencies and absence/exclusion. Phase C–E runtime, real installed 3D lifecycle, maintainer host session and human visual acceptance remain **unverified**. The fixture did not produce GLB, a viewer or PNG; the ADR states those as the first implementation contract, not as delivered capabilities.


### 2026-11-05 — setup containment lesson for Phases B and C

The maintainer Remotion cold-project sitting exposed npm walking from an empty project into an ancestor repository despite a selected cwd. Phases B and C setup must reuse the explicit-root pattern: initialize only the selected absent manifest, preserve existing files, pass an absolute npm prefix with local/workspace controls, and test an ancestor package/workspace plus paths containing spaces and metacharacters. A project-local label or cwd alone is not containment proof. [The eval5 audit](../docs/skill-quality/2026-11-05-remotion-readiness-eval5.md) and the corrected audiovisual-review helper provide the source evidence. This adds a test requirement, not a 3D implementation or runtime claim.


### 2026-11-05 — carry the measured Motion lessons into later 3D production

[Plan 047](047-motion-production-efficiency.md) adds proactive treatment choices,
traceable acceptance and a Motion event sidecar without replacing the canonical
media fingerprint. Later 3D clips should reuse those contracts: bind picture
events to relevant scene/animation code and GLB/assets, reissue dependent Sound
handoffs after changes, and offer narration/SFX/music before production. Keep
personal-private asset checks bounded and record actually used assets in the
Markdown ledger; commercial release retains applicable clearance. Do not infer
Arda output, runtime loading, renderer performance or rights from these plans.
Phase A placement evidence remains the delivered boundary; no 3D production
role or runtime was added by the Motion follow-up.


### Host refresh first; recoverable Phase B draft

[Plan 048](048-host-refresh-and-claude-session-tracking.md) records the requested
Host-library refresh and Claude session-tracking pilot before further 3D work.
An isolated draft is saved at scratch/3d-phase-b-draft-2026-11-06/README.md: real
Arda core/contract/canonical/native candidates, four original Skill drafts, a
standalone Bundle fragment, Chris integration proposal and shared contract.
Six JSON files and seven YAML frontmatters parse; actual isolated core and
four-field contract validators passed. These are draft authoring checks only.
No draft is applied, registered, installed or runnable; the GLB validator,
Three.js viewer, PNG capture, provenance/Motion helpers, real lifecycle proof
and maintainer pilot remain required. Preserve the Host gate source snapshot
until its actual result is inspected, then implement B–D with TDD.

### 2026-11-06 — Phase B implementation and focused evidence

The optional standalone `agency-3d-production` Bundle now declares Arda, four original MIT Skills and the shared `audiovisual-review` and `handoff` dependencies. The canonical role, Semantic Core and contract and Claude-native role are authored; Chris's native roster and Agent allowlist include the optional provider, with conditional routing. The resolved `full` Bundle excludes Arda and all four 3D Skills. Arda supports direct complete briefs and limits missing rights claims to the actual scope; a reviewer attestation and hash are not legal clearance.

The focused native floor, tool-grant, guard, teammate, roster and Skill inventory suites passed 495/495 tests in four files (exit 0). The real Bundle integration and standalone install, agency coexistence, shared ownership and removal tests passed 5/5 in two files (exit 0), including installed helper paths. These tests establish the sampled registry and copy-mode lifecycle, not actual Claude invocation, visual acceptance or all Host surfaces. Phase C/D helper and runtime evidence is recorded separately; Phase E maintainer-run Host session, actual Skill invocation and human review remain **unverified**. No provider job or Host session was started.

### 2026-11-06 — actual local production and handoff evidence

The frozen implementation includes strict project/provenance initialization,
Markdown asset ledger, current source/evidence hashing, supported GLB metrics
around pinned Khronos validation, project-contained dependency setup, a
keyboard/pointer viewer, deterministic browser capture and a Shot Handoff that
reruns validation and binds every viewer resource as well as frames, source and
the canonical audiovisual timeline fingerprint. A reused revision label does
not conceal cue/copy/timing changes. Unknown private-prototype terms remain
documented warnings; public delivery needs compatible terms and a named
reviewer's usage-scoped attestation. Hashes do not establish legal clearance.

The explicit current runtime run passed **47/47 cases, zero skipped, exit 0**
(`scratch/3d-final-gate-2026-11-06/real-runtime.log`). This includes the actual
pinned validator, indexed/nonindexed/transformed scenes, embedded PNG/JPEG,
unsupported/corrupt/missing inputs, path and runtime confinement, actual Chrome
captures and stale/fabricated report rejection. The ordinary suite intentionally
skips runtime-dependent cases without explicit local runtime variables; its
default result must not be presented as this runtime matrix.

An actual copy-mode installed optional Bundle produced the original MIT jade
bottle at `scratch/3d-hands-on-2026-11-06/reference-proof`: 20,972 GLB bytes, 960
stored/rendered triangles, one scene instance and two materials. Chrome
156.0.8078.80 on Intel Iris Xe/ANGLE D3D11 captured six 640x480 frames at 30 fps,
range [0,6). The first PNG SHA-256 is
`c60e370334f881a851a697199d5e6261c24b0c2749d5691b6660a867ba9d3a87`.
The installed helper validated its Shot Handoff and the copied evaluation
project's handoff. The three unreviewed private-prototype source records retain
rights-check warnings. The first frame was inspected and shows the bottle;
this is technical visibility, not maintainer visual acceptance.

Actual copy and Windows symlink lifecycle tests cover standalone installation,
agency coexistence, shared helper ownership, absence of all four eval folders,
installed sibling execution from another cwd, edited-Skill update/removal
protection and preservation of user scene files. The full gate is still pending
at this checkpoint, so no full-suite pass is claimed. Its durable status is
`scratch/3d-final-gate-2026-11-06/verified-gate-status.json`, unified session
23200, runner PID 23148, start 2026-11-06T10:08:31.3718884Z.

[The prepared maintainer protocol](../docs/skill-quality/2026-11-06-3d-hands-on.md)
and `scratch/3d-hands-on-2026-11-06/evaluation-kit` contain standalone web,
locked Motion and routing/rights exercises. No Host was launched. Phase E
requires the maintainer's account/quota/spending ceiling, actual TUI sessions
and native records, then separately scoped human review. Blender, AR, providers,
software-GPU parity and other Host delivery remain **unverified**.

Final contract review found one remaining C/D guard before declaring the local
slice complete: viewer-resource hashes are present, but the render receipt
does not yet bind the renderer helper source itself. Add renderer helper
identities to the receipt and recheck them at handoff capture and validation;
changed helper code with unchanged package versions must invalidate proof.
The candidate is being prepared only in scratch while the current full gate
finishes. Then apply it with its regression tests, issue a fresh reference and
evaluation kit, and rerun the affected and full gates. Do not treat the earlier
47-case run as coverage of this later guard.

### 2026-11-06 — renderer identity resolved; final gate checkpoint

The renderer receipt now hashes the physical shared renderer and CLI wrapper,
rechecks them before publishing the receipt, and the Shot Handoff compares
current installed helper identities during capture and validation. Missing,
incomplete or changed bindings fail even when package versions are unchanged.
Copied and linked helper execution is covered. These filesystem snapshots are
freshness checks, not an atomic sandbox against adversarial file replacement.

The latest explicit validator/browser run passed **51/51, zero skipped, exit
0**: `scratch/3d-final-gate-2026-11-06/renderer-identity-runtime.log`. A fresh
installed reference at `scratch/3d-hands-on-2026-11-06/reference-proof-r2`
produced the same six frame hashes and validated its renderer-bound handoff.
The earlier reference and kit are historical proof; use the r2 kit after its
build and the final gate complete. No live Host was started.

The preceding full run (session 23200) was intentionally stopped for this
required change, actual runner exit -1; it is an incomplete run, not a pass.
Its logs/status are retained. The new frozen run is **session 8414, runner PID
8628**, start **2026-11-06T10:21:03.8484243Z**. Its fresh typecheck exited 0;
full-suite exit and source equality are pending in
`scratch/3d-final-gate-r2-2026-11-06/verified-gate-status.json`. Inspect this
actual handle on resume; never start a duplicate from a running status alone.

The r2 kit builder is also live as **session 52516**, targeting
`scratch/3d-hands-on-2026-11-06/evaluation-kit-r2`; inspect its actual exit and
then run eval2's installed `shot-handoff.mjs validate` before handoff. The
maintainer supplied a local-only pilot funding/cap gate. Identity and limits
are kept in ignored local scratch, not the documented repository; no session
spending has occurred. Phase E and human review remain unverified.

The r2 kit builder subsequently completed with actual exit **0** (session
52516 closed). Eval2's installed `shot-handoff.mjs validate` also exited **0**,
`ok:true`, retaining the three scoped rights warnings. Use `evaluation-kit-r2`
for the next pilot. Remaining global verification is the live full gate 8414;
its typecheck is 0, but no full test result is yet claimed. Model work paused
under the maintainer's included-allowance stop instruction; exact account
telemetry is retained privately. All model workers finished;
the existing local CPU test run may complete while paused. No commit or push.

### 2026-11-06 — final local verification and ready handoff

The r4 gate completed at 2026-11-06T18:19:39Z: typecheck exit 0, test exit 0, **254 suites passed; 4,971 tests passed and 210 skipped**, with watched source unchanged. The later resume check independently matched all **418** watched path/hash records; 137 intentionally absent entries are recorded deletions, not new drift. No full rerun is needed for these documentation-only amendments. Skipped checks remain unverified.

The explicit current 3D runtime/privacy matrix passed **56/56 with zero skips**. The installed reference is `scratch/3d-hands-on-2026-11-06/reference-proof-r4`; the three prepared projects are in `evaluation-kit-r4` beside it. Kit preparation exited 0. Eval2's installed Shot Handoff validator exited 0 with `ok:true`, retaining three personal-private rights warnings. These warnings do not become public or commercial clearance.

The local handoff is ready; **Phase E remains unverified** until the maintainer supplies actual Claude session records and separately scoped visual/playback feedback. Actual Skill use and Motion-worker integration are not established by installed files or these local tests. Three Host-library source audit holds and the retained baseline pins remain unchanged. No commit or push was made.

### 2026-11-07 — eval1 observed; supplied cap fixture corrected

[Eval1 audit](../docs/skill-quality/2026-11-07-3d-eval1-web-r4.md) records the
maintainer-run session, all four successful Skill invocations, real task IDs
and updates, cold local setup, unchanged inputs and delivery hashes, repeated
54/54 browser checks and actual invalid-GLB rejection. Human interaction and
fallback feedback is accepted for that prototype, with the reported cap flaw.
The flaw originates in our original fixture; a failing geometric regression
preceded its minimal material assignment fix. The corrected fixture passes
57/57 explicit runtime checks plus the focused installed/kit suites, and has a
separate inspected PNG. Original r4 projects and their reference fingerprints
remain preserved. Eval2/3 and remaining cross-agent/human acceptance are still
unverified. A fresh full gate is required before publication; none was made.

The maintainer subsequently reviewed the corrected cap PNG and accepted its
brass sides/top **for this prototype** on 2026-11-07. That scoped visual issue
is closed; eval2's signature-frame/playback and remaining cross-agent evidence
stay open. The fresh post-eval1 full gate is running in the separately recorded
checkpoint; no final result is inferred before its actual exit.

### 2026-11-07 — fresh post-eval1 full gate passed

The single frozen run completed at 09:55:18Z with native typecheck/test exits
**0/0**: **254 suites passed; 4,971 tests passed, 210 skipped**, duration
1881.50 seconds for tests. All **419** watched path/hash records match before
and after; 137 intentionally absent records remain deletions. Saved evidence:
`scratch/3d-post-eval1-gate-2026-11-07/verified-gate-status.json`, full log and
source snapshots. This gate includes the cap fix and native observation.
No code changed afterward. The cap has scoped maintainer acceptance; eval2/3,
actual cross-agent Motion integration and the three source-review holds remain
open. [Eval2's manual launch](../docs/skill-quality/2026-11-07-3d-eval2-launch.md)
is prepared; no Claude session, commit or push was started by this continuation.

### 2026-11-07 — eval2 record found; provisional gaps retained

[The provisional audit](../docs/skill-quality/2026-11-07-3d-eval2-provisional-audit.md)
records Chris's accepted map, actual ordinary Motion delegation and handbacks,
lead-owned task updates, intact 27-file reference and correct six capture
mappings. No native Skill call is recorded on either actor. The material
control changed unused metadata and some exits were not captured correctly;
do not label those stronger requirements passed. Maintainer session status,
usage and signature-frame/playback feedback were requested and are pending.
No code was changed and no new Host was started; the fresh code gate remains
valid while actual workflow completion and eval3 remain unverified.

### 2026-11-07 — completed eval2 feedback; combined visible-handoff exercise

[The completed r4 audit](../docs/skill-quality/2026-11-07-3d-eval2-motion-r4.md)
records 2.45 USD reported usage, revised-playback and signature-frame
acceptance, and independently confirmed restoration of all 27 reference files.
Zero Skill calls and the metadata-only material control remain readiness gaps.
Chris's own small read-back was acceptable to the maintainer; larger work
should propose proportional cheaper independent review.

The original ready-made six-frame shot did not require fresh Arda production
and was too visually symmetric for useful motion review. The separate
[eval2b kit and launch](../docs/skill-quality/2026-11-07-3d-eval2b-visible-handoff.md)
correct that test design: actual Arda source/GLB/30-frame production, visible
geometric asymmetry, a fresh handoff to Motion, actor-specific Skill evidence,
and real material/timeline controls with native exits and restoration. Runtime
packages and approved Chrome are reused, with no prebuilt shot supplied.
Terra/medium passed mechanical preflight; Sol/medium passed the bounded protocol
review and its ownership/material-input clarifications were incorporated.
Those reviews are preparation evidence, not a native pilot. No Host CLI was
started. Current watched code is unchanged, so the fresh full gate remains
applicable; eval2b/eval3 and source-review holds remain open.

### 2026-11-07 — eval2b actual production and accepted playback

[The completed audit](../docs/skill-quality/2026-11-07-3d-eval2b-session-audit.md)
records actual Chris/Arda/Motion/Emre activity, nine successful Skill calls,
30 distinct rendered frames and a fresh accepted handoff. The current installed
validator exited 0; the recorded timeline/material controls exited 0/2/0 and
all 48 baseline file hashes restore correctly. The maintainer accepted the
signature, visible rotation, integration, controls and playback with no visible
problems. Reported session usage was 3.99 USD.

This clears the bounded visible-production/handoff exercise, not every role
instruction: Motion omitted its mandatory direction-Skill call, task 4 was not
reopened for the favicon revision, and the final rerun of Emre's script was
performed by Motion. Preserve those limits instead of claiming a blanket pass.
Shared helper imports do not require recursive Skill loading. Eval3 and the
three upstream source holds remain open; no code/pin/hold changed in this audit.

### 2026-11-07 — eval3 negative controls completed

[The final negative-case audit](../docs/skill-quality/2026-11-07-3d-eval3-session-audit.md)
confirms the intended Arda consultation for the 3D/AR comparison and Kaan-only
consultation for the separate static-page request. No production, install,
download, file write or provider invocation is recorded. The maintainer
accepted the missing-evidence/NC discussion, AR-target question and preserved
unverified AR status. All three pilot families now have actual records and
scoped feedback; do not request another generation merely to repeat them.

Preserve remaining conformance issues: Motion's direction-Skill omission,
revision-state/independent-rerun attribution, unsupported broad rights wording,
and the inference that missing settings means no native role guards. These
need bounded workflow/reporting hardening, not permission expansion or a
retroactive universal pass. The three upstream holds remain retained.
