# Choices, approved inputs and cross-role handoffs

The Lead owns planning and consolidates user decisions; Chris is the agency pilot Lead. Motion/Sound and other production specialists send missing inputs, route choices, cost questions and conflicts to that Lead. Do not open competing user consultations or silently reinterpret approved copy/timing.

## Choose and record the renderer

Native is a direct HTML/SVG/canvas composition whose pose is controlled by seek(t). Remotion is the React/timeline route for a project that deliberately chooses that toolchain. Neither choice implies external footage generation. Give the Lead the concrete tradeoff for this brief, then use the recorded decision. Do not install both toolchains just to postpone the choice.

The workflow project helper records the full nonsecret `media/project.json` schema: renderer, audioRoute, generatedFootage, selected provider identifiers, output and spend preferences. It does not authorize spending. Preserve existing records and defaults; output fps/dimensions must match the approved timeline. If renderer is Remotion, route the task through the Lead instead of invoking the native renderer. Absence supports standalone helper use only; a coordinated job still needs a recorded decision.

## Brand, Copy and public assets

Request approved palette/type treatment, logo variants, reference hierarchy, exact copy, audience/placement, content safe areas and rights/provenance. Record supplied asset paths and intended use; do not treat a search result, generated image or vague brand resemblance as clearance. Replace starter placeholders before review. Text fitting is a layout task: send copy changes back through the Lead rather than shortening approved claims without agreement.

Keep editable scene data in `media/native/content.json` and source in `media/native/index.html` or local modules under public `media/assets/`. Asset paths in source use `/assets/...`. Retain original/licensed source records outside the public tree. Local fonts must be ready before capture; a fallback-font screenshot is not a passing final render.

## Timeline, Sound and captions

Use the sibling audiovisual-review resources for the canonical schema and validators, including `references/media-contract.md` and its example timeline/audio manifest. Maintain their source-relative installation relationship. Do not fork a weaker schema in the native Skill.

Motion sends Sound the approved timeline revision, computed fingerprint, fps/N-frame bounds, scene/cue IDs, speech text and start/end frames. Sound returns a relative-path WAV master, aligned stems/cues, provenance and master-scope measurements. The manifest has top-level sampleRate=48000 and channels=2; `master` is a path string, not an object. Validate the exact selected project loudness preset. A timing or speech edit can stale the fingerprint even when someone forgot to change the revision; return it for reconciliation rather than patching metadata to force acceptance.

Rendering consumes the approved mix via `--audio-manifest`. It does not synthesize, mix, normalize or measure source audio. Reported LUFS/true peak establish only that the report meets the contract; actual measurements and listening are separate evidence. Resampling does not improve source fidelity. A silent job may omit the audio option; do not invent speech, cues or measurements to fill a template.

For speech, supply a validated SRT sidecar whose text/timing match the VO cues and end within the film. Native CLI does not embed or burn captions automatically. If the destination requires burned captions, author them as seek-controlled scene elements and separately verify legibility/timing; otherwise confirm the destination can consume the delivered sidecar. Keep transcript/reduced-motion needs in the brief, and agree any alternative through the Lead.

## Optional Skill handoffs

- [Remotion production](../../remotion-production/SKILL.md) is the independent React renderer. Check its actual installed resources before handing it the recorded brief/choice.
- [Video generation](../../video-generation/SKILL.md) is the optional external-footage route, separate from native rendering. Check installed resources, explicit opt-in and actual selected tools before use.

External generation requires separate explicit opt-in, selected route/provider, rights review and a per-job spending decision through the Lead. Existing generatedFootage=true is a recorded preference, not permission to call an account. Until the requested capability is installed, verified and authorized, preserve the plan and keep authoring from approved local assets. Never insert a provider call into seek(t), readiness or the render helper.
