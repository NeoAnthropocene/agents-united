# Shot production, inspection and editable integration

## Keep the footage decision independent

`renderer: native|remotion` selects how Motion authors the film. `generatedFootage: true|false` separately records whether external generation is included. `audioRoute` remains independent. Strict full preferences select one provider/model/modality/route per external modality; do not use a bare provider-name array. Chris consolidates questions and owns include/defer/decline, route and spending decisions. Supplied footage and commercial licensed visual stock remain options; use the sibling `commercial-stock-sourcer` Skill when stock research is needed. Do not call stock search a licence grant.

Before a shot, record scene purpose, selected provider and exact model, approved prompt/settings, intended duration/handles, reference/upload permission, likeness/voice releases and permitted territories/placements. Model and API terms can differ from the service's web subscription. Keep private releases in controlled storage; the shot sheet contains safe references and review state. Copy/logo/UI remain approved editable assets, not a model's interpretation. Use a background plate if text fidelity is critical.

Use [provider cards](../../mcp-setup/references/media-providers.md) and [setup](../../mcp-setup/references/media-setup.md). The official HTTP template lists alternatives; do not connect all providers or invent a community server as official. Auth is private human work. An agent with no granted tool asks the Lead to relay through its actual connection. One acknowledged shot does not authorize variants, reference uploads or a different provider. Do not run a paid trial to verify connectivity.

## Capture a useful shot record

Start from [the shot sheet](../assets/shot-sheet.md). A prompt has camera and subject intent but cannot establish output quality or reproducibility. Save the actual accepted model/version, task ID, parameter record and original local bytes/hash. No API tokens, transient signed URLs, full provider responses or private consent documents enter the sheet. Pending/failed/ambiguous tasks retain identity and reserved ceilings; status/resume never means resubmit. The local USD reservation is a conservative planning record, not the vendor's billing cap.

Download only the selected completed media through the safe helper or the approved provider's private export flow. A provider-hosted link may expire. MIME and signature prove only a bounded file type check. The delivered clip must be local and independently inspected; a task ID/URL is not a final deliverable. Preserve the original, and write conformed/trimmed versions to new paths with transformation records.

## Inspect actual media

With an already approved local FFprobe/FFmpeg toolchain, inspect a local clip (absolute executable and input paths, no network):

```text
"<absolute-ffprobe>" -v error -select_streams v:0 -count_frames -show_entries stream=codec_name,width,height,r_frame_rate,avg_frame_rate,nb_read_frames,duration:format=duration -of json "<absolute-project>/media/assets/studio-shot-r1.mp4"
"<absolute-ffmpeg>" -i "<absolute-project>/media/assets/studio-shot-r1.mp4" -vf "fps=1,scale=480:-2" "<new-review-folder>/frame-%03d.png"
```

These are argument examples, not a cross-shell launch syntax guarantee; PowerShell invokes a quoted executable with `&`. Make the review folder explicitly. Do not overwrite an existing review. Save real command exits/tool versions alongside measured codec, dimensions, frame rate, decoded count and duration. Inspect representative first/middle/last frames plus transitions and visible defects; one-second thumbnails may miss fast artifacts, so inspect additional relevant frames. Perform actual local playback for motion/temporal judgment. Mark playback **unverified** when no viewer/human review occurred.

Check subject/identity consistency, distorted anatomy/product geometry, unwanted text/logos/marks, framing/crop/safe area, start/end discontinuities, flicker, palette, camera intent and whether handles support the planned cut. Record evidence and keep rejected takes. Review permissions and model/service terms for the actual asset; a generation prompt is no rights clearance. Do not claim that a downloaded clip has a specific codec merely from `.mp4`.

## Hand off to the selected editable route

Motion receives original/selected paths and hashes, source fps and duration, trim in/out with units, scene IDs, target frame bounds, crop/fit, playback speed and review status. Target timeline fps is not necessarily source fps. Handle variable frame rate, incompatible codecs and audio explicitly with an approved local conform to a fresh file; inspect the transformed file and retain the original/hash/process chain. Do not stretch narration or silently move approved scenes to fit footage.

For native production, Motion authors the local clip into the HTML/SVG/canvas scene using its `/assets/...` mapping and deterministic `seek(t)` contract. Decoded video frames must be ready for capture; a playing `<video>` and wall clock are insufficient. For Remotion, Motion uses the installed version's supported local video component and frame-driven trim/crop/timing, preserving source/editable composition. This Skill supplies source assets and review records, not a new renderer integration helper. Verify the actual chosen composition's frames/export; installed integration remains **unverified** until tested. See the sibling [native runbook](../../native-motion-production/SKILL.md) or [Remotion runbook](../../remotion-production/SKILL.md).

Generated embedded audio is not the approved Sound master. Retain it as source if permitted, then send it through Sound's selection, consent, listening and finishing path or deliberately exclude it. Motion sends exact revision/fingerprint/timebase/scene/cue bounds before final Sound work. Any trim/timing/copy change returns through Chris and invalidates dependent approvals until reconciled. The [audiovisual contract](../../audiovisual-review/references/media-contract.md) still governs the final mux, captions, master measurements and visible/audible quality.
