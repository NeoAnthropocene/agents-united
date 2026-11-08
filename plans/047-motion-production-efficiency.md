# Plan 047: Motion production efficiency

**Status: implemented locally; final integrated verification passed, 2026-11-05.**
The sections below retain the original proposal and its criteria. The dated log
records implementation evidence; ADR 0063 covers the event sidecar decision.
Unperformed Host, encoded-media and human checks remain unverified.

## Evidence and scope

The local chicken-loop guide at
`scratch/remotion-readiness-postfix-2026-11-05/lessons-learned-chicken-loop.md`
and [saved-record audit](../docs/skill-quality/2026-11-05-postfix-session-audit.md)
identify planning, handoff and iteration costs. The proof's 120-frame timing was
explicitly approved; the full beat map and audio map were not. A false listening
approval in a handoff was corrected; listening remained unverified. The craft
validator failed even though the user chose to proceed without reference frames.
The reported $24.30 is a user-provided figure, not a verified bill: the saved
session had no cost-state record. At the original analysis checkpoint no features
had been built; the subsequent implementation is recorded below.

Prioritize the slices below independently. Preserve existing changes, source
rights and project decisions; do not launch a paid Host or provider session.
Run focused local CPU tests with failing cases first. Stop after two failed tries
at the same operation, preserve outputs and record the exact failure, completed
steps and next recovery action before resuming. No automatic Host test request is
part of this plan. The observed 4.0.541 is not evidence of the latest release;
do not automatically bump the supported pin.

## 1. Complete treatment and honest approvals — highest priority

**Problem.** Media consultation exists, but a route or tone answer can be
mistaken for acceptance of a complete audio map, timing or listening result.

**Proposed change.** Before production Chris consolidates a concise treatment
menu covering voiceover, SFX, music, captions and, for Remotion, Elements.
For each applicable option give a recommendation and include/defer/decline
choice, reason, dependencies and expected effort or external cost when known.
Silence, no narration and no Elements are valid. Ask intended use as personal
private, noncommercial public, or commercial; do not infer legal permission
from that choice. Preserve already accepted choices and ask only unresolved
questions. Request one actual user acceptance of the consolidated plan and
delegation map. Then obtain explicit scoped timing approval for the relevant
timeline/beat map before dependent production. A later material change returns
only the affected choice or timing for renewed approval.

Every cross-role handoff records gate, status, approver, source/reference,
revision and open items. Distinguish actual user acceptance from lead decisions,
worker reports, measurements and unknowns. A route or tone choice never proves
listening, perceived sync, creative acceptance or acceptance of an audio map.
Record what was approved and what was not; keep evidence traceable to its source.

**Likely paths.** `registry/skills/workflow-agency-motion-production/references/production-gates.md`,
its project contract and examples; `registry/agents/orchestrator-digital-agency.md`,
`registry/hosts/claude/agents/orchestrator-digital-agency.md`,
`registry/core/orchestrator-digital-agency.core.md`; Motion and Sound canonical,
Claude and core role files and contracts as their floors change; relevant
`registry/skills/remotion-production/references/handoffs.md` and Sound handoff.

**Done / tests.** `tests/agency-media-roles.test.ts` and focused workflow
fixtures cover all menu options, preservation of accepted choices, declined
branches, explicit plan and timing evidence, revision invalidation, and absent
listening evidence. A route/tone-only answer must not pass an approval gate.
Helpers must continue to report human approval unverified where they cannot
establish it. Host behavior remains unverified without an independently
authorized maintainer-run session.

## 2. Proportionate rights and used-asset ledger

**Problem.** A personal project should not require an exhaustive commercial
audit, but unknown terms do not grant noncommercial permission.

**Proposed change.** Reuse established rights facts, record unknown terms and
notify the user once rather than repeating the same question. Personal-private
drafts get a bounded source/terms check, not an exhaustive commercial audit;
unresolved terms alone do not stall the whole private experiment. Record the
user's experimental scope and unresolved assets without claiming permission.
For noncommercial public work, surface unresolved items before publication and
offer replacement or owner review. For commercial delivery require clearance of
the actual intended use before delivery; flag unresolved items and their owner.
Known restrictions still apply; block affected use where required and continue
unrelated work. Keep runtime/tool/vendor licences and voice consent separate
from asset rights. Reuse a still-applicable eligibility record rather than
repeating it for every worker.

Maintain one Markdown used-asset ledger, one row or record per actually used
asset: source, ID, type, project path, hash, version, licence and terms evidence,
status, use context, adaptations, attribution, owner and next action. Use clear
states: `original`, `licensed`, `user-reported-permission`, `terms-unverified`,
`no-license-stated`, or `restricted`. User-reported permission is attributed,
not independently verified; neither unknown state implies permission. Record
source and dependency terms separately where they differ. Avoid the ambiguous
label `non-license`.

**Likely paths.** `registry/skills/remotion-production/references/setup-and-elements.md`,
`references/handoffs.md`, an asset ledger template alongside
`registry/skills/audio-generation/assets/source-ledger.md`, and workflow/role
handoffs. Preserve `registry/skills/remotion-production/scripts/project.mjs`
versioned runtime eligibility checks and the explicit distinction between
evaluation, production and verified entitlement; review any proposed change
to that gate separately.

**Done / tests.** Focused fixtures exercise personal-private,
noncommercial-public and commercial intents, reused facts, restricted and
unknown terms, third-party dependencies and user-reported permission. The
ledger identifies every fixture asset actually used; unknown rights cannot
become verified clearance, and a commercial delivery remains blocked until
applicable clearance is evidenced. Unrelated work stays available.

## 3. Bounded readiness and recoverable evidence

**Problem.** A 585-line setup handback was only partly read; successful Skill
discovery, invocation, actual use and reference reads are different facts.

**Proposed change.** Keep `media/specs/remotion-setup.md` as a bounded current
summary with owner, route, authorization reference, exact versions, gate
status, blockers and links/hashes to append-only detailed evidence. Preserve
commands, exits, Skill actor/source and installed/discovered/invoked/used states
in the underlying evidence. Chris reads the actual current summary and checks
the relevant source evidence before acceptance; it is not automatic approval.
Record reference use separately from a successful Host Skill invocation.

**Likely paths.** `registry/skills/remotion-production/references/setup-and-elements.md`,
`references/official-agent-skills.md`, Chris and Motion role copies, and a
small summary/evidence template. Reuse existing helpers and avoid inventing
a second source of truth.

**Done / tests.** Fixtures cover missing evidence, failed then successful Skill
calls, stale summary references and an unresolved blocker. A compact summary
cannot make failed or absent evidence pass. Maintain explicit unverified states.

## 4. Environment diagnosis and contained ESM imports

**Problem.** Browser, FFmpeg and local capability issues caused avoidable
iterations; ESM-only package exports produced a generic runtime failure.

**Proposed change.** Add a read-only project-scoped environment diagnostic
that composes existing FFmpeg resolve/verify, audio `probe-system.mjs` and
Remotion release checks where applicable. Report each actual result, missing
capabilities and unverified network/GPU facts without installing anything,
changing PATH, exposing credentials or claiming a component works from presence
alone. Record browser availability and disk/Python facts when safely measurable.
Separately fix runtime package containment for ESM-only package layouts, using
the package metadata as a containment entry only after safe resolution and
realpath boundary checks. Preserve exact project-local package version checks.

**Likely paths.** `registry/skills/remotion-production/scripts/project.mjs`,
`scripts/check-release.mjs`, `registry/skills/audiovisual-review/scripts/ffmpeg.mjs`,
`registry/skills/audio-generation/scripts/probe-system.mjs`, and preflight docs.

**Done / tests.** Synthetic local ESM-only fixtures reproduce the failure then
pass; missing package, invalid exports, symlink escape, mismatched versions and
unavailable tools fail clearly without install or external access. Exercise
`tests/media-remotion.test.ts` and its runtime suites and focused diagnostic
fixtures. No dependency upgrade is implied.

## 5. Fast picture QA and measured event handoff

**Problem.** Full renders checked small changes, and inferred SFX frames diverged
from the actual motion by up to 13 frames in the reported run.

**Proposed change.** Add bounded frame-range and selected-still iteration to the
existing Remotion helper, retaining full-export checks as the delivery gate.
Investigate a small contact sheet, seam comparison and motion review pack from
actual outputs; do not claim stills establish full-motion quality or listening.
After picture action exists, Motion exports machine-readable event frames for
foot plants, impacts and other cues with event ID, frame, fps, picture source,
timeline revision and current canonical fingerprint. Sound consumes those
events before dependent final SFX; independent sound design may proceed in
parallel. Motion changes invalidate affected events and Sound handoffs.

Keep the existing full canonical timeline fingerprint guard, including cue
changes. A separate picture fingerprint is deferred pending design and evidence.
For procedural work, use the existing deliberate internal style-study SVG/PNG
route in `motion-design-direction/references/prompt-blueprint.md`, actually
rendered and viewed with provenance. Do not add a blanket craft waiver or
pretend a missing reference passed. Preserve proof comparison and defect gates.

**Likely paths.** `registry/skills/remotion-production/scripts/project.mjs`,
`references/review.md`, `references/handoffs.md`, workflow production gates,
Sound direction handoff, `registry/skills/audiovisual-review/references/media-contract.md`,
and Motion/Sound roles. Review whether event data belongs in a separate
versioned artifact before changing the canonical media schema.

**Done / tests.** Local fake-runtime tests cover requested frames/ranges and
reject negative, reversed, out-of-range or stale inputs; partial output cannot
be reported as a final export. Event fixtures reject wrong fps, stale revision
or fingerprint and missing event IDs, and demonstrate that an edited picture
forces a new Sound handoff. `tests/skill-scripts/media-motion.cases.mjs` and
`tests/motion-technique-library.test.ts` retain reference and proof requirements.
Human playback and listening remain unverified until actually performed.

## Implementation order and limits

Ship each bounded change separately: treatment/approval handoff; intent and asset
ledger; ESM resolution fix; readiness summary; diagnostic wrapper; selected
stills/ranges; picture-event handoff. The last two are separate implementations,
even though their end-to-end QA criteria are described together above. Use the
current native Host guides and observations for role changes, update semantic
floors/contracts only where behavior changes, and preserve all existing guards.
Run the required typecheck/full suite before any requested push. Do not refresh
the completed chicken project or adopt its local helper patches wholesale.

The event handoff must distinguish a visual event, timeline window start,
designed audio lead-in and detected onset. Record the detector/method, threshold,
target convention, sample rate and measured asset; compare like with like.
Reproduce both reported methods before blaming their approximately one-frame
difference on the mux. Stem onsets, decoded-mix measurements, motion-math checks
and perceived sync have different scopes; one cannot silently stand in for all.

Reuse inspected Elements evidence by exact source/version/hash, selected
adaptations and intended use; discover real page links rather than guessing
URLs. Recheck changed source or scope. Cache neither a blanket rights conclusion
nor an assumption that a catalog effect is worth its GPU/render cost. Assess a
short in-context proof before full production. Software rendering availability
and performance must be measured, not inferred from a GPU inventory.

Defer separate picture/audio fingerprints until a versioned migration preserves
stale-handoff protection. A bundled-browser option must reuse a verified local
browser or expose an explicitly authorized download; render must not download
silently. A BT.709 option needs a defined color-conversion/output workflow and
decoded evidence, not just retagging unknown pixels. Keep custom mux and loop
music synthesis as separate scoped improvements after the higher-value slices.

Primary-source check on 2026-11-05: the [U.S. Copyright Office](https://www.copyright.gov/fair-use/)
explicitly treats noncommercial purpose as one factor, not automatic permission;
this is a U.S. example, not a determination of the user's jurisdiction or assets.
[Remotion's license documentation](https://www.remotion.dev/docs/license) directs
runtime eligibility and terms review; it does not establish rights for every
Element, font, recording, voice or dependency. This plan proposes a lighter
workflow, not legal clearance for this film.


## Implementation log — 2026-11-05

Three Terra/medium workers implemented bounded slices while the lead integrated
and reviewed them. No Host or paid media-provider job was started, no completed
project was refreshed, and no commit/push was made.

- Treatment and acceptance: workflow 1.2.0 proactively offers VO/SFX/music/captions
  and applicable Elements, records one consolidated user acceptance and scoped
  timing decisions, and preserves explicit delegations/waivers without inventing
  listening. Canonical and native Claude Chris/Motion/Sound carry the authored
  detail above their compatible existing semantic floors. The initial policy
  guards failed, then the affected policy run passed 39 tests.
- Rights: purpose-specific guidance and Markdown used-asset ledger implement
  bounded private checks, public/commercial release handling, explicit unknown
  terms and separate runtime/voice evidence. Three policy guards failed for
  missing resources, then passed. These are instructions, not legal clearance.
- Readiness: Remotion production 1.4.0 routes to a current summary within 60 lines
  and append-only detailed receipts. Original 16 readiness guards remain; the
  added summary guard first failed, then all 17 passed. Example rows are
  explicitly unverified placeholders, not execution evidence.
- Diagnostics: offline default, explicit registry opt-in, per-check findings and
  no installs or writes. Six runtime tests pass, including a partial installed
  layout without the optional Sound probe. An actual offline invocation exited
  0 with verified FFmpeg capabilities and system-probe completion; release,
  browser launch and Host invocation were correctly unverified. It deliberately
  reports productionReady false.
- ESM: optional import/subpath-only packages use contained, exact metadata when
  no root require export exists; required runtime APIs still resolve and load.
  Metadata-only evidence is labelled and does not establish optional importability.
  Negative fixtures retain missing, mismatched and escaping package boundaries.
- Iteration: inclusive frame ranges and selected/stills-only proofs retain
  exclusive outputs, snapshot checks, truthful preview scope and expected rather
  than measured durations. Full exports and audio QC retain their separate gates.
- Picture events: the ADR 0063 version-1 sidecar binds Motion-authored events to
  the unchanged full timeline fingerprint and actual source hashes. Capture and
  validation remain explicitly unverified for semantic frame accuracy. Ten
  runtime cases pass with zero skips, including stale data, unsafe aliases and
  copied/linked installed Skill execution. Read-only review also clarified that
  editable bindings are not authenticated receipts.
- Installed paths: actual regressions reproduced silent exit-0/empty output
  through directory junctions; Remotion and event helper entry guards now resolve
  argv real paths and execute from another working directory.
- Version maintenance: all four official npm latest endpoints returned 4.0.541.
  Tagged 540/541 licence texts matched; neither is classified MIT. Default 541
  retains exact locked 539 and 540 support, with compatibility/scaffold fixtures.
  The actual check-release command exited 0 with four aligned 541 packages.

Fresh typecheck and the initial combined affected run exited 0 (12 files, 554
tests). The subsequent 541 maintenance separately passed 36 Node cases and
three Remotion Vitest wrappers. Final integration runs on the frozen tree with
watched source hashes: scratch/verification/run-plan047-gate.ps1, status
plan047-gate-status.json, logs plan047-gate-typecheck.log and
plan047-gate-full-test.log. Do not infer a full-suite pass until actual terminal
exits and watchedSourceUnchanged have been inspected.

Still unverified: live compliance with the newly revised instructions, a real
current-helper preview/render, human listening/perceived sync/creative acceptance,
unknown asset terms and platform behavior. The new workflow eval is prepared,
not run. Separate picture fingerprints, a procedural craft waiver, BT.709/mux
engineering and richer loop-music synthesis remain deferred as specified above.


Installed-resource and distribution check: disposable native/copy agency install,
doctor, installed helper help, event capture and event validation all exited 0.
Nine installed resources match current source byte-for-byte; a synthetic source
edit then caused stale-event validation exit 2 as expected. Doctor retains
missing-MCP warnings; no actual Host tool loading is inferred. Evidence:
scratch/verification/plan047-installed-{resource-proof,exits}.json and logs.

Offline npm pack exited 0. The actual archive contains 1,036 entries, zero
retired official-Skill files and all nine checked resources matching source.
SHA256: 0c0b557c03b9fae4f3a2ca4d354b6b75c6c2ccd38b77cf06b8aa8d1944fec668.
Evidence: scratch/verification/plan047-pack-proof.json. Nothing was published.


### Projection correction — 2026-11-05

The first integrated run found three existing Cline workflow projection guards
failing on new cross-Skill Markdown links in the workflow entrypoint. This is
a source regression, not a reason to weaken the projection assertions. The
lead stopped only the verified failed Vitest root and its descendant processes;
the command exited 1 and has no completed full-suite aggregate. Its durable
state is plan047-gate-status.json and log is plan047-gate-full-test.log.
The correction preserves the guidance via installed Skill names and detailed
supporting references, keeping entrypoint links within owned resources. A fresh
source-frozen gate will use run-plan047-gate-2.ps1 and plan047-final-* evidence.
The earlier package/installation checks remain scoped to their recorded tree;
final packaging will be checked after this correction.


The projection correction passed all 18 existing Cline supporting-file tests and
all 11 treatment policy tests (exit 0). No projection assertion was changed.
The interrupted first runner recorded underlying testExit -1 and its outer
unified command returned 1; it has no completed aggregate. Gate 2 now runs on
the corrected frozen source and keeps the failed evidence separately.


### Actual SDK preview — 2026-11-05

An exclusive isolated internal-suitability fixture physically copied the existing
4.0.541 dependencies and reused the already installed browser. No runtimeLoader
override, download, Host or provider was used. Current helper scaffold and both
actual CLI preview modes exited 0: inclusive frames 20–29 with stills 20/29, and
stills-only frames 0/59. FFprobe exited 0 and measured H.264 640x360, 30 fps, ten
read frames and 0.333333-second video duration. Video SHA256:
dd011c4a947eaa9caf3f80f0041276f83daac45633318ab9bf2b59c2188f0ec9.
The checked completed-project final MP4 hash was unchanged before/after; this
is a one-file preservation check, not a whole-project immutable history claim.

Evidence: scratch/verification/plan047-real-preview.md and
plan047-real-preview-{range,stills,ffprobe}.json. Both renders reported a webpack
cache snapshot warning, retained in stderr; their actual exits were 0. This
resolves the current-helper basic preview boundary above, not visual/listening
acceptance, full audio QC, added effects/font loading, or production entitlement.


Final corrected archive: offline pack exit 0; 1,036 entries, zero retired official
Skill files and twelve checked resources matching the corrected source, including
the workflow entrypoint and all new helper/template resources. SHA256:
fc1f66402a994d94a2996908084e6336104858100e6f82463a465440722dcdfe.
Evidence: scratch/verification/plan047-final-pack-proof.json. The earlier archive
is historical pre-correction evidence; neither archive was published.


### Completed second gate and pin-guard correction — 2026-11-05

Gate 2 completed with actual typecheck exit 0 and test exit 1, watched source
unchanged: 242 files passed, one failed; 4,904 tests passed, one failed, 209
skipped (5,114 total), 1321.25 seconds. Its only failure was an existing catalog
guard still asserting default 4.0.540 after the intentional reviewed 541 change.
The assertion now requires exact default 541 and additionally retains explicit
539/540 support checks; no guard was dropped. Product code is unchanged from
that complete run. A focused guidance run and fresh final gate follow; do not
combine the partial/focused results into a claimed full pass. Failed logs remain
plan047-final-*; gate 3 uses run-plan047-gate-3.ps1 and plan047-verified-* evidence.


The pin guidance correction passed all four focused tests (actual exit 0;
plan047-pin-guidance-green.log). Gate 3 started 2026-11-05T19:08:12.4379600Z,
unified session 23409, runner PID 25724. Its fresh typecheck exit is 0; full test
exit and watched source comparison are pending. Inspect this exact handle and
plan047-verified-gate-status.json before restarting anything. Product source and
archive resources have not changed since the corrected package check; the last
change is the exact pin/legacy-version assertion. All workers are finished.


### Final integrated gate — 2026-11-05

Gate 3 completed with actual typecheckExit 0 and testExit 0, and
watchedSourceUnchanged true. Aggregate: 243 files passed; 4,905 tests passed,
209 skipped (5,114 total); 1267.14 seconds. It ended
2026-11-05T19:30:03.4646706Z. Authoritative evidence:
scratch/verification/plan047-verified-gate-status.json,
plan047-verified-gate-typecheck.log, plan047-verified-gate-full-test.log and
plan047-verified-source-before/after.json. The earlier failed/interrupted runs
are retained and are not represented as passing. Skipped checks are unverified.

The fresh full gate covers the implemented local slices. Actual installed-path
checks and a real 541 SDK range/stills preview also passed in their recorded
scopes. Live Host compliance with the new instructions, full-film creative
acceptance, listening/perceived sync and unresolved asset terms remain separate
review boundaries. The optional listening question seeks accurate user feedback
and does not retroactively supply an approval. No Host/provider job, commit,
push or publication was started by this implementation run. Changes remain
local on codex/motion-follow-up-slices.

### Subsequent prototype listening acceptance — 2026-11-05

The maintainer answered the pending listening question: **“Reviewed; acceptable
for this prototype.”** Record human acceptance of the completed post-fix film's
voice-over, music/SFX balance and perceived sync for prototype use. The [audit
amendment](../docs/skill-quality/2026-11-05-postfix-session-audit.md#subsequent-human-listening-feedback--2026-11-05)
records the source and scope. This updates that listening boundary; it supplies
no retroactive production approvals, other-film review, commercial rights
clearance or verification of future Host behavior. This documentation-only
amendment changes no tested source or completed media.
