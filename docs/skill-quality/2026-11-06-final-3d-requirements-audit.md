# Plan 045 requirements audit — 2026-11-06

**Current amendment, 2026-11-07:** the fresh post-eval1 gate passed typecheck
and all 254 suites (4,971 tests passed, 210 skipped), with all 419 watched
records unchanged. The explicit runtime/privacy matrix passed 57/57 without skips. Use
`scratch/3d-hands-on-2026-11-06/evaluation-kit-r4`; its builder completed and the
installed eval2 validator returned `ok:true` with three scoped rights warnings.
The maintainer has since completed eval1; [its audit](2026-11-07-3d-eval1-web-r4.md)
establishes actual standalone Skill/task use and scoped human functional
acceptance. The supplied cap defect was corrected separately and its new PNG
accepted for this prototype. The fresh full gate covers that correction;
the older r4 result is historical. Eval2/3 and cross-agent acceptance remain
**unverified**.

**Subsequent eval2b evidence:** [the actual-record audit](2026-11-07-3d-eval2b-session-audit.md)
now establishes Arda production, Motion integration, nine actual Skill calls,
30 distinct frame hashes, valid restored handoff and 48 restored baseline
files, plus scoped maintainer signature/playback acceptance. Preserve the
literal Motion direction-Skill omission and producer-run post-fix QA rerun;
do not relabel this a blanket role-compliance pass. Eval3 remains unverified.

| Original open finding | Current disposition |
| --- | --- |
| Positive web exercise lacks its model/copy | Resolved and observed: eval1 used the supplied original model/source/copy, completed cold local setup and invoked all four Skills. Human functional review is scoped to that prototype; its cap defect is recorded and fixed separately. |
| Shot conventions/camera are missing | Resolved locally: r4 records explicit supported conventions and `parameters.camera`; the helper validates them. Six frame paths/hashes and the proof PNG are present. No separate contact-sheet claim is made. |
| Peer-specific handoffs need the combined gate | Canonical/native peer instructions are included in the passed r4 source snapshot. Actual peer exchange remains unverified. |
| Motion acceptance and integrated playback | Still open: the installed validator pass is technical evidence, not an actual Motion worker's receipt, integration or human playback acceptance. |

The original point-in-time audit below describes r2 and its failed gate.
Historical failures remain evidence of that checkpoint; they are superseded by
the r4 resolution above where explicitly identified.

## Original open findings — r2, historical

1. **Phase E and actual use:** No maintainer-run Claude TUI session records establish installation, discovery, successful `Skill` invocation and production use by the relevant actors; actual visual/playback and creative acceptance are **unverified**. The current cold web exercise contains neither a supplied GLB nor a runtime; the updated builder supplies the original fixture and starts with no runtime, while authorizing the accepted project-local setup without repeating approval. The r2 kit predates that builder change and must be rebuilt. The maintainer authorized a personal-private prototype with unresolved rights recorded as unverified and known prohibitions respected; this does not establish public or commercial clearance. Negative controls are prepared, not observed Host behavior. The locked Motion kit contains reference artifacts, not fresh human approval.
2. **Full Shot Handoff contract:** `reference-proof-r2/media/shot.json` has fingerprint, scene/range, fps/dimensions, renderer and browser versions, source/output hashes, frame paths, proof, provenance, format report and unverified flags. Its camera is described as automatic bounding-box fit. It does **not** record explicit color space/range, alpha/background, or units/origin conventions required by the plan. Those properties need supported recorded values or an explicit unverified disposition; the existing handoff validator pass does not establish them. A proof PNG is present; a contact sheet is not evidenced by this artifact.
3. **Peer-specific 3D handoffs:** Subsequent to the failed frozen gate, conditional Creative, Frontend, Motion, QA and GRC handoff paragraphs were added to their canonical and Claude-native role files. `tests/agency-3d-peer-handoffs.test.ts` checks both copies. Live execution and peer exchange remain unverified.
4. **Motion acceptance:** Installed `shot-handoff.mjs validate` can accept the present evidence and reject stale inputs in tests. It is not evidence that an actual Motion agent received, accepted and integrated the handoff, or that final sound is synchronized. No video export or integrated playback is evidenced in the six-frame reference.

## Phase A — placement, decision and supported scope

| Requirement | Current evidence and limit |
| --- | --- |
| Decide placement, role mapping and prerequisites | [ADR 0062](../adr/0062-agency-3d-designer.md) accepts the standalone `agency-3d-production` Bundle with no agency prerequisite. [Placement tests](../../tests/agency-3d-placement.test.ts) exercise synthetic standalone/coownership, edited-file protection and parent mapping limitations. They do not demonstrate actual Claude role invocation. |
| Define bounded route and avoid guessed grants | ADR 0062 and [Plan 045](../../plans/045-agency-3d-designer.md) restrict the initial route to supplied/procedural GLB, local Three.js viewer and PNG; Blender, AR and providers are deferred. Native role tooling is class-derived in [the Core](../../registry/core/subagent-3d-designer.core.md) and [Claude role](../../registry/hosts/claude/agents/agency-3d-designer.md); no provider MCP grant is asserted. |
| Domain terms, provenance, failure matrix | [CONTEXT](../../CONTEXT.md) now names request, ledger and handoff. Project, asset, browser and shot tests below cover selected cases. Their evidence is bounded by the actual supported subset and opt-in runtime configuration. |

## Phase B — authored package and routing

| Requirement | Current evidence and limit |
| --- | --- |
| Core, contract, canonical and native role | [Core](../../registry/core/subagent-3d-designer.core.md), [four-field contract](../../registry/core/subagent-3d-designer.contract.json), [canonical role](../../registry/agents/subagent-3d-designer.md), and [native role](../../registry/hosts/claude/agents/agency-3d-designer.md) exist. `tests/native-claude-agents.test.ts`, `tests/native-claude-tier2.test.ts`, `tests/native-ceiling.test.ts`, `tests/core-safety-floor.test.ts` and `tests/semantic-core.test.ts` check the floor, tools, guard and role contracts. Native execution remains **unverified**. |
| Four original Skills, MIT and maintainer evals | `registry/skills/3d-design-direction`, `threejs-scene-production`, `3d-asset-review`, and `workflow-agency-3d-production` carry manifests, MIT licences, references and three prepared-not-run cases each. `threejs-scene-production/examples/create-bottle.mjs` is the original example. The eval definitions are not evidence of executed model comparisons or quality scores. |
| Optional Bundle and exact dependencies | [Bundle manifest](../../registry/bundles.json) includes all four, `audiovisual-review` and `handoff`, plus native mapping and persona metadata. [Integration tests](../../tests/agency-3d-integration.test.ts) check the contract Skills, helper paths, roster/allowlist and resolved `full` exclusion. Alias invocation is **unverified**. |
| Chris and non-3D controls | Canonical and native Chris contain conditional optional routing; [native tier-two tests](../../tests/native-claude-tier2.test.ts) and roster tests inspect authored allowlist/roster. Static/decline/no-setup behavior is described in role and prepared evals; no actual Host negative-control session establishes it. The named peer-specific handoff instructions were added after the frozen gate; actual peer execution remains unverified. |

## Phase C — project, provenance, inspection and browser proof

| Requirement | Current evidence and limit |
| --- | --- |
| Strict versioned local project, preserved files and scoped rights | [project helper](../../registry/skills/3d-design-direction/scripts/project-3d.mjs) and `tests/media-3d-project.runtime.mjs` cover malformed fields, bounds, source/evidence hashes, overwrite refusal, separate `media/project.json`, junction escapes, private unresolved warnings and usage-scoped reviewer attestation. A hash and reviewer statement do not independently prove legal clearance. The reference ledger is marked unverified and records private-prototype warnings. |
| Asset format and bounded metrics | [inspector](../../registry/skills/3d-asset-review/scripts/inspect-glb.mjs) invokes the pinned local Khronos validator and measures supported indexed/non-indexed triangles, transformed instances, active-scene bounds and embedded PNG/JPEG dimensions. `tests/media-3d-asset.runtime.mjs` covers invalid/truncated GLB, budgets, missing images, escaped paths, tampered validator, sparse/interleaved and extension rejection. Base-level decoded RGBA is an estimate, not GPU memory. Extensions, deformation and other unsupported subsets are rejected, not universally validated. |
| Manual intake, credit and provenance | The source/rights policy and [project tests](../../tests/media-3d-project.runtime.mjs) require source records and retain scoped unknowns. `reference-proof-r2/media/provenance.json`, `rights.md` and `used-assets.md` record the original procedural fixture and transformations. This does not establish rights for a separately supplied or third-party model. |
| Actual local GLB, viewer and still | `scratch/3d-hands-on-2026-11-06/reference-proof-r2/media/format.json` reports 20,972 bytes, 960 stored/rendered triangles and zero Khronos errors/warnings for the original bottle. `media/render.json` records six 640×480 frames at 30 fps, browser/backend and file hashes; `output/proof/viewer.html` and six PNGs exist. Plan log records technical inspection of the first frame; maintainer visual approval is **unverified**. This single fixture does not prove arbitrary scenes, devices or browser configurations. |
| Browser and setup containment | [browser runtime tests](../../tests/media-3d-browser.runtime.mjs) cover pinned setup, existing manifest protection, sibling resolution, junctions, bounds and concurrent output. The explicit runtime run recorded in Plan 045 passed 51/51 with opt-in validator/browser cases enabled; default opt-in skips alone do not establish a render. Viewer source exposes keyboard rotation and a static-proof instruction, but full product integration, accessible behavior on target devices and reduced-motion acceptance remain Phase E/Frontend checks. |

## Phase D — actual installation and Motion-bound evidence

| Requirement | Current evidence and limit |
| --- | --- |
| Copy and Windows symlink installation, shared resources and no evals | [copy lifecycle](../../tests/agency-3d-lifecycle.test.ts) installs the real Bundle, checks Skills and helper paths, agency coexistence and shared ownership/removal. [symlink lifecycle](../../tests/agency-3d-symlink.test.ts) invokes the installed project helper from another cwd, checks all four eval directories absent and preserves a user scene. Both passed in focused runs documented in Plan 045; no broader Host/platform claim follows. |
| Updates, conflicts, source preservation and installed sibling imports | [installed runtime lifecycle](../../tests/agency-3d-installed-runtime.test.ts) executes installed helper entry points, rejects an unsafe inspector path, tests an edited Skill update conflict and refused removal, then preserves the user scene after removal. It is a sampled copy-mode lifecycle, not proof that every failure is atomic. |
| Sequence and stale checks | `reference-proof-r2/media/shot.json` binds six frames and fingerprint to sources, receipt, validator report, renderer file hashes and runtime. [shot tests](../../tests/media-3d-shot.runtime.mjs) reject changed same-revision timeline content, changed scene source, mismatched range/fps/dimensions/hash, edited proof, viewer/renderer drift and fabricated reports when validator fixtures are enabled. The installed r2 evaluation copy validated according to the dated Plan log; actual cross-agent Motion acceptance remains unverified. |
| Renderer integrity | The receipt and Shot Handoff include the shared renderer and wrapper identities, and recheck them; this is freshness evidence, not an atomic defense against adversarial replacement. Viewer resources and source files are also fingerprinted. |

## Phase E — required maintainer pilot

The [hands-on protocol](2026-11-06-3d-hands-on.md) and [kit preparation tests](../../tests/3d-hands-on-kit.test.ts) prepare cold web, locked Motion and routing/rights exercises. Record the maintainer-provided session ID and project folder, inspect the Host's own records with the documented session tool, and distinguish installed, discovered, invoked and used. Inspect actual artifacts and independently record the maintainer's scoped visual/playback acceptance. The current web exercise needs the supplied original model and copy added for the positive test; the personal-private scope and unverified rights policy above apply. Do not interpret reference files, model assertions, test-demo acceptance or structural checks as blanket production readiness. No provider, paid generation, AR or other Host execution is established by these artifacts.

### 2026-11-06 — final local verification and ready handoff

The r4 gate completed at 2026-11-06T18:19:39Z: typecheck exit 0, test exit 0, **254 suites passed; 4,971 tests passed and 210 skipped**, with watched source unchanged. The later resume check independently matched all **418** watched path/hash records; 137 intentionally absent entries are recorded deletions, not new drift. No full rerun is needed for these documentation-only amendments. Skipped checks remain unverified.

The explicit current 3D runtime/privacy matrix passed **56/56 with zero skips**. The installed reference is `scratch/3d-hands-on-2026-11-06/reference-proof-r4`; the three prepared projects are in `evaluation-kit-r4` beside it. Kit preparation exited 0. Eval2's installed Shot Handoff validator exited 0 with `ok:true`, retaining three personal-private rights warnings. These warnings do not become public or commercial clearance.

The local handoff is ready; **Phase E remains unverified** until the maintainer supplies actual Claude session records and separately scoped visual/playback feedback. Actual Skill use and Motion-worker integration are not established by installed files or these local tests. Three Host-library source audit holds and the retained baseline pins remain unchanged. No commit or push was made.
