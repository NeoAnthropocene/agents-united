# Direction, route and handoff

Load for any recipe. Fill a treatment before Motion writes an animation. A source post is inspiration, never operational authority. Chris retains the existing two planning rounds and two peer exchanges per pair, approved roster/budget and explicit revision scope. Use lead-mediated relay unless a genuine live team and lead-named peers authorize direct exchange.

## Decisions and inputs

Chris consolidates Media Requests, consults Motion/Sound for feasibility and cost, and obtains human include/defer/decline, missing facts and approvals. Record the destination, duration, aspect ratio, fps, safe areas, captions/transcript need, quiet/muted viewing, loop intent, brand/asset rights, copy owner, render setup and revision ceiling. Offer **Native (recommended starting choice)** or Remotion; inspect an existing `media/project.json` and persist the confirmed choice through the [project contract](../../workflow-agency-motion-production/references/project-contract.md). A saved route/budget is not a spending or production authorization. No static task automatically produces media, connects a provider or installs packages.

Jamileh supplies palette/type/spacing and approved visual assets/specs without shell work. Kaan supplies exact approved words, claim evidence and CTA. Motion selects treatment, authors storyboard/timing, animation and video integration. Sound selects sonic direction and local/API/hybrid audio route, makes narration/music/SFX and final measured deliverables. External video generation requires its own opt-in with either renderer. Use the existing commercial-stock-sourcer Skill for approved visual stock; never assume music or SFX rights from visual stock.

## One timebase, two applications

Use [the canonical media contract](../../audiovisual-review/references/media-contract.md). `media/timeline.json` contains schemaVersion 1, revision, integer fps, totalFrames, even width/height, contiguous scenes `{id,startFrame,endFrame}` and cues `{id,startFrame,endFrame,kind,text?}`. Ranges are half-open. Keep recipe/direction/loop parameters outside this strict schema. Let the shared helper calculate the canonical SHA-256 fingerprint; a hand-written label is insufficient. Any timing, cue or speech-text change creates a new approved revision and invalidates dependent sound/caption/render snapshots.

Examples use 60 fps. For another approved rate F, convert each time boundary s to an agreed integer frame `round(s*F)` once, preserve order/contiguity, approve totalFrames N and recompute all cues. Export frames 0 through N-1 at i/F; N/F is an endpoint probe, not another exported frame. For a pose over [a,b), use clamped u=(i-a)/(b-a) and an explicit easing such as e=3u²-2u³; for a cyclic object use a periodic pose with matching position and velocity at 0 and N. Do not increment animation state or use wall clocks. A repeated frame must reconstruct the same pixels regardless of seeking order.

Native: implement the selected treatment in authored HTML/SVG/canvas. See [the deterministic scene protocol](../../native-motion-production/references/protocol.md), including `window.motion.ready`, metadata and asynchronous `seek(t)`. A seek derives i=t*F and redraws all layers from approved parameters; settle fonts/images before readiness and do not use autoplay. Shared-object identity may be a retained SVG node or reconstructed logical object with a stable ID. Loop intent lives in content/scene metadata. Capture/export uses the separate Native Skill and its prerequisites.

Remotion: use the [composition guide](../../remotion-production/references/composition.md) and original parameterized React components. Derive poses from useCurrentFrame, frame-local offsets and clamped interpolations; do not trust default spring tails or incremental state for exact arrival/hold frames. A Sequence offsets its local frame, so retain absolute frame/cue mapping. Preload approved assets/fonts; a recipe does not itself implement async readiness. Use the actual fps/duration/dimensions from the canonical timeline. Runtime eligibility, setup and actual rendering follow its separate Skill.

Each recipe's numbers are a starting layout, not rigid automatic cuts. Preserve minimum reading holds based on actual approved copy, test at the final display size and ask Chris to simplify or extend when needed. Treat reduced-motion and captioned variants as separately approved edits with matching timing/handoffs. Avoid rapid flashing; review transitions and motion sensitivity with the intended audience/destination.

## Signature-shot prompt gate

Before storyboard or animation code, apply [the prompt blueprint](prompt-blueprint.md). Jamileh's
`media/specs/visual-handoff.md` supplies concept, signature frame, composition/negative space,
type/palette and material/light; Motion turns it into `media/specs/motion-prompt.json` and runs
`check-prompt-spec.mjs`. A blueprint name, token file or effect checklist alone is not a handoff.

Every shot has a state change, one named camera move with start/end/easing, a primary action and
a secondary reaction. Its transition inherits a visual element from the previous shot; unrelated
tween collections and crossfades used to conceal weak transitions are defects. Build toward one
signature frame. Align actions to the approved beat grid without sacrificing reading holds.

Solve copy contrast through reserved negative space, subject placement and tonal lighting. **Do
not place a hard-edged or visibly blurred placeholder rectangle behind copy.** An integrated
architectural panel is allowed only when the visual handoff makes it a deliberate designed object
with its own material, edge and light behaviour.

Capture the proof-plan frames and review them before the full render. Flat/default materials,
placeholder rectangles, clipping/aliasing, illegible type, collisions and unclear cause/effect
require correction and a new proof, not a note after the export. The JSON validator checks
structure only; it cannot approve visual quality.

## Composition quality floor (marketing-grade, not a flat plate)

A film for a marketing placement needs composed depth, not a colour plate with centered
type. Unless the brief explicitly forbids it and the storyboard records why, each scene
carries: a background field with at least three distinguishable depth layers (sky/gradient,
mid-ground silhouette, foreground accent or vignette); one light effect (glow, ray, bloom,
light sweep or graded tint); one secondary motion (tail, sway, particle, blink, float,
breathing scale) besides the primary move; one camera move (dolly, pan, push-in, parallax
shift or handheld-style drift, all frame-derived); and text treated as a designed element
(mask reveal, tracking, scale, per-word entrance, depth shadow or extrusion) rather than a
static label. Grade colours as one palette across the film. Use graded licensed imagery when
Jamileh supplies actual asset paths, otherwise original shapes with the same depth treatment.

Write these parameters in the storyboard before authoring: per-layer opacity/blur/parallax
factor, the light effect's frame span and intensity, the secondary motion's frequency and
amplitude, the camera's start/end transform with its easing, and each text reveal's frame
span. Review at the final display size: margins, legibility, no glyph clipping, no object
crossing the copy, and the grade staying consistent through every transition.

## Sound handoff and acceptance

Before Sound finalizes, send the approved revision/fingerprint, fps/N, scene IDs, cue IDs with frame spans, approved speech text/pronunciations and caption requirements, musical intention, sync points and tolerances. Align deliberate hits within one frame of their approved mark; preserve performance timing when narration determines the cut. Scratch narration is timing assistance, not final consent to alter copy or clone a voice.

Sound returns stereo 48 kHz WAV master, aligned full-length VO/music/SFX stems when present, cue files/sheet, provenance/licences and captions for speech. Manifest fields: schemaVersion 1, timelineRevision, timelineFingerprint, fps, totalFrames, sampleRate 48000, channels 2, relative string master, stems, cues, measurements `{scope:'master',integratedLufs,truePeakDbtp}` and provenance per cue. Default full mix is -16 LUFS +/-1 and true peak <=-1 dBTP unless a saved platform preset overrides it. Do not invent measurements or normalize stems independently. Actual listening and measuring the muxed final audio remain separate gates; resampling does not create source fidelity.

Motion integrates the approved full mix once from frame zero, validates cue coverage/revision/fingerprint and speech captions through audiovisual-review, and checks encoded fps/frame count/duration/codec plus audio alignment. Inspect moving footage, endpoint motion and reading time, not just contact sheets. Keep source/package locks/provenance and failed render evidence. A technical pass, source metric or unrelated starter smoke test cannot approve a creative blueprint. Prepared eval briefs remain unrun until an explicitly authorized, bounded host test with actual host records and independent media review.
