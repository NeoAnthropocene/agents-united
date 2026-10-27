# Blueprints 1-3: identity, launch and musical contrast

Read only the selected recipe, plus [shared direction](direction.md) and [evidence limits](sources.md). All examples are fictional and fully specified for planning, not rendered or client-approved assets. Frame spans are half-open at 60 fps.

## 1. Continuous UI morph loop

### Inputs
Supply persistent object ID/shape/color, three approved interface states, the causal action for each change, cursor route, one short label per state, loop duration N/F, viewport/safe area and sound intent. Parameterize object anchors, corner radii and panel bounds; use one object identity across states. Default D=8 s, F=60, N=480; one complete cause-and-return cycle.

### Direction
Let the viewer follow a familiar object while its function changes. The cursor arrives before a visible response; the object carries attention across layouts. Keep object silhouette/color recognizable even when its scale or container changes. The final state returns to the exact starting composition and velocity.

### Scene/beat structure
| Scene ID | Frames | Action |
| --- | --- | --- |
| loop-rest | 0-60 | Persistent card rests; cursor approaches its control. |
| loop-expand | 60-180 | Contact at 72; card becomes a detail panel by 144, then holds. |
| loop-arrange | 180-300 | Drag starts 192; panel contracts into a selected board tile by 264. |
| loop-return | 300-420 | Cursor activates return at 312; tile regains the opening card bounds. |
| loop-seam | 420-480 | Restore initial cursor/pose; settle to matching endpoint velocity. |

### Build instructions
Record one normalized bounding-box path per state and a stable object key. Interpolate bounds/radius with explicit arrival frames; keep label swaps inside a masked area while both labels are still readable. Compute the cursor trajectory separately and log each action/contact frame. Use an authored return path; do not reverse the whole film or crossfade the whole canvas to hide a seam.

### Native application
Retain one SVG group/card ID. `seek(t)` derives i=60t and reconstructs card bounds and cursor from the table. For [72,144), interpolate opening/detail bounds using smoothstep; hold [144,180). Finish all return interpolation before 420 and use identical initial/end parameters at i=0 and 480. Publish loop=true in scene metadata, await ready/assets, probe seek(8) against seek(0), then inspect 478,479,0,1 for motion continuity.

### Remotion application
Keep a single keyed Card component and pass its bounds from absolute frame i; use clamped interpolate segments with exact arrivals 144/264/420. Render cursor from the same absolute timebase, including its causal lead. Do not remount the card between Sequences. Use durationInFrames=480, inspect frames 479/0 and separately compute endpoint pose at 480; a matching position alone does not verify matching velocity.

### Sound handoff
Send click-expand [72,84), drag-arrange [192,264), click-return [312,324) cue IDs and an optional full-length music bed [0,480). Ask Sound for restrained tactile feedback and a loop-safe music boundary, or explicitly select silence. Receive the current revision/fingerprint and measured master/stems; compare the audible seam as well as image poses. No VO means no speech-caption file is needed unless the destination requires other captions.

### Gotchas and review
Anti-patterns: teleporting the cursor, morphing into an unrelated identity, click after response, mirrored text and blank seam frames. Review selected/control hit areas, label legibility, last-to-first acceleration and muted comprehension. Reduce travel/spring energy for a motion-sensitive variant and reapprove its timing.

### Filled worked example
Fictional brief: Luma task app, 1920x1080, safe inset 96 px, 8 s/480 frames, Native confirmed via Chris, no external footage. Jamileh's illustrative tokens are ink #132A32, cream #F6F1E8, teal #167A74; Kaan's copy is "One task", "See the detail", "Place it". Object task-01 has opening bounds (720,360,480,280), detail (480,210,960,660), tile (1160,330,320,210). Cursor contacts (1160,400) at 72, drag starts at panel center 192, return control at 312. Use the five spans above, revision luma-loop-r1, click IDs above, local Sound route, zero provider spend. Deliver storyboard/state table first; loop and audible quality remain unverified.

### Source/date/evidence
Inspired by the supplied persistent-object/causal-cursor/seamless-return idea attributed to twoclipping: <https://x.com/twoclipping/status/2103273003555402193>. Supplied research snapshot 2026-10-22: 12,684 likes; 760 reposts. Not reverified during drafting (2026-10-24); original parameters/example and full [source limits](sources.md) apply. No rights clearance for reference media is implied.

### Evaluation status
**prepared-not-run (blueprint 1)**. No rendered loop, paired host evaluation, independent playback/listening or creative approval. Future check: build both lanes from the same approved bounds/cues, seek out of order, compare seam position/velocity and collect blind loop/readability review. Existing starter tests are not evidence for this recipe.

## 2. Photo-to-product launch

### Inputs
Supply a licensed photo set with focal points/crop permission, actual approved interface captures, product representation, final logo/CTA, shared-element ID, destination and duration. Parameterize gallery grid, active-image index, UI target rectangle and brand lockup. Default D=12 s, F=60, N=720; use a still product image if footage is not separately approved.

### Direction
Carry one selected photo from a spacious gallery into its useful product context, then give the product and brand room to resolve. Shared elements explain continuity: the viewer should recognize the same photo, selection and crop while the container changes. This is a launch narrative, not a claim of unimplemented product functionality.

### Scene/beat structure
| Scene ID | Frames | Action |
| --- | --- | --- |
| launch-gallery | 0-120 | Establish three to five images; select one at 90. |
| launch-interface | 120-300 | Selected image travels into a real interface viewport by 216; show approved use. |
| launch-product | 300-510 | Interface nests into product representation by 390; benefit copy holds. |
| launch-brand | 510-720 | Shared accent resolves into brand field; logo/CTA readable from 570. |

### Build instructions
Prepare one high-resolution public copy of each licensed image, exact screenshot crops and a shared anchor map. Draw the active image above both layouts through [120,216), preserving focal point and clipping radius; reveal the target UI behind it. Move the whole UI group into the product frame through [300,390). Use original approved brand shapes for the final transition; no reference asset extraction.

### Native application
Implement gallery/viewport/product as HTML or SVG clips. Derive rect, crop and opacity from i=60t in seek(t); a single active-image layer moves from gallery bounds to UI bounds using smoothstep over 120-216. At i>=216 use the identical target rect and crop in the UI layer before hiding the shared layer, avoiding double opacity. Predecode images and settle fonts before ready; seek 119/120/215/216/389/390 to inspect seams.

### Remotion application
Use an absolute-frame SharedPhoto component over scene groups, with approved source/focal-point props. Interpolate bounds over [120,216] and UI-to-product scale over [300,390], clamping before holds. Do not let Sequence-local zero restart the shared photo. Gate image readiness and use the same asset/crop at transfer frames; set composition N=720 and inspect final CTA at final-size output.

### Sound handoff
Send select [90,102), photo-land [204,228), product-settle [378,402), brand-resolve [546,582) and music [0,720) cue spans. Ask Sound for an arc from discovery to confident arrival, with hits at 216/390/570 and headroom for optional approved VO. If VO is included, get exact speech/captions before freezing. Receive measured master/stems and cue provenance for the matching fingerprint; no music is implied by a photo licence.

### Gotchas and review
Anti-patterns: crop jumps, stretching faces, unreadable screenshot text, unsupported product mockups, a logo hold too short to recognize. Check image rights/focal permission and screenshot privacy; anonymize only through approved asset preparation. Check UI labels and CTA without sound and inspect 9:16 reframing before promising both ratios.

### Filled worked example
Fictional brief: Framebook photo organizer launch, 12 s/720 frames, 1920x1080, Remotion chosen/persisted by Chris subject to its separate runtime review. Five client-owned landscape photos; active photo lake-02 moves from (160,240,480,320) to screenshot viewport (620,290,680,420). Approved product is a flat desktop frame, not a newly invented device. Kaan's copy is "Your photos, together"; CTA "Meet Framebook". Jamileh's palette is #102A43/#F5F0E7/#E6A54B, safe inset 96. Use the four spans above, revision framebook-launch-r1, no narration, local Sound music/cues, no generated footage. Still-image rights and UI capture permission must be evidenced before production.

### Source/date/evidence
Supplied gallery/interface/product/brand shared-element idea attributed to twoclipping: <https://x.com/twoclipping/status/2103835273813496100>. Supplied 2026-10-22 snapshot: 2,183 likes; 161 reposts. Not reverified during drafting (2026-10-24); [source limits](sources.md) apply. The treatment and fictional example are original, with no reference-media licence implied.

### Evaluation status
**prepared-not-run (blueprint 2)**. No rendered shared-element transfer or independent playback/creative approval. Future check: compare both lanes at transfer frames and final ratio, review active-image recognition/crop continuity and CTA reading time with a blinded reviewer. Runtime starter proof does not evaluate these assets or transitions.

## 3. Beat-drop interface journey

### Inputs
Supply approved question, product response, authorized media card, evidence-backed chart/data labels, logo, desired musical contrast, licensed or newly authorized audio route and duration. Parameterize pre-drop restraint, drop frame d, chart bounds and one semantic action per beat. Default D=15 s, F=60, N=900; example d=180. Sound must confirm the real musical grid before timing approval.

### Direction
Begin with a clear question, answer at the musical change, then show media and evidence before the brand resolves. Contrast should clarify the answer, not excuse illegible rapid cuts. The beat-drop frame marks the useful response, while later cuts follow approved phrase boundaries instead of every transient.

### Scene/beat structure
| Scene ID | Frames | Action |
| --- | --- | --- |
| beat-question | 0-180 | Question enters by 36 and holds; anticipation at 156. |
| beat-response | 180-330 | Useful response arrives on drop; settles by 216. |
| beat-media | 330-510 | Authorized media card opens by 366 and holds. |
| beat-chart | 510-720 | Evidence-backed chart reveals by 570; labels remain. |
| beat-logo | 720-900 | Resolve to logo by 756; readable end hold. |

### Build instructions
Create a beat/cue grid from Sound's actual proposed track or timing sketch. Map approved semantic events to exact frames; when the musical grid and reading time conflict, ask Chris to extend or simplify. Author media crop/credit and honest chart scale before animating. Use one repeatable accent or line motif to connect the five scenes; retain chart source/date in the handoff.

### Native application
Use seek(t), i=60t, and fixed scene bounds. At [180,216) reveal response opacity/position with clamped easing; make the answer readable by 216. For chart [510,570), multiply approved normalized bar values by smoothstep, with scale/labels visible from 510. Preseek/settle any approved video to its absolute local time; if that path is unsupported, use a supplied still and flag moving-media playback unverified. Never use audio playback time as the capture clock.

### Remotion application
Use Sequences beginning 0/180/330/510/720; keep absolute event d=180 for audio/cue mapping. Response receives localFrame 0-36; chart bars localFrame 0-60, with labels constant. Use frame-driven media through the production lane's supported readiness path and explicit trim props; do not assume any arbitrary external URL is capture-ready. Set N=900 and retain reading holds after reveal completion.

### Sound handoff
Propose music [0,900), anticipation [156,180), drop [180,192), media-open [330,348), chart-land [558,582), logo-resolve [720,756). Sound confirms drop/phrase positions, rights and measured master/stems, with deliberate visual hits within one approved frame. Freeze the shared revision only after confirmation; a replacement song or changed drop needs a new timeline/fingerprint. No unapproved voice track or music from the source post.

### Gotchas and review
Anti-patterns: drop before the viewer reads the question, false chart magnitude, all cuts flashing on beats, or claimed audio sync based only on a still. Check low-volume/muted understanding, waveform-to-frame sync, music rights, safe flashes, factual chart labels and final hold. Actual muxed audio alignment and listening are separate from a cue table.

### Filled worked example
Fictional brief: Cedar analytics 15 s ad, Native confirmed, 1920x1080, F=60, revision cedar-beat-r1. Approved question "Where did time go?", response "See the work clearly", licensed team-work still, illustrative chart "Planned 40 / logged 32 hours" explicitly labeled demo data, CTA "Explore Cedar". Ink/cream/orange tokens #17324D/#F6F0E6/#C75D28; chart baseline zero. Sound proposes 100 BPM with one beat every 36 frames and drop at 180; later semantic cuts may land between beats when reading needs it. Use the five spans above, no VO, local audio, zero external-generation budget. This proposed grid waits for the approved track and timing sign-off.

### Source/date/evidence
Supplied question/response/media/chart/logo idea attributed to twoclipping: <https://x.com/twoclipping/status/2104674464868762046>. Supplied 2026-10-22 snapshot: 722 likes; 58 reposts. Not reverified during drafting (2026-10-24); [limits](sources.md) apply. The grid, copy and example are original; no source music rights or model-support claim is inferred.

### Evaluation status
**prepared-not-run (blueprint 3)**. No music-synced render, independent listening or chart/creative approval. Future check: matched Native/Remotion briefs with the same licensed track; inspect decoded frames/drop timing, cue offsets, mute comprehension and chart honesty. The earlier silent/synthetic starter proofs do not establish this treatment's sync or quality.
