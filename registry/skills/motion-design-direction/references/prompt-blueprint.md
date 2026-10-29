# Signature-shot prompt blueprint

Use this overlay with every numbered recipe. The recipe supplies subject grammar; this contract supplies **film grammar**. A list of effects is not a creative direction.

## Source and status

Structural ideas inspected on 2026-10-28 from Prompt Motion's [realtime](https://prompt-motion.com/templates/realtime/customize) and [showreel](https://prompt-motion.com/templates/showreel/customize) customizers: one signature shot, ordered shots with named film-camera moves, causal physical reactions, transformations that inherit an element from the previous shot, beat-timed action, deterministic rendering and proof-frame inspection. This is an original adaptation, not a copy of their prompts, code or assets. Their model/effort recommendation and three.js/Web Audio implementation choices are not requirements here. **Prepared-not-run until the next independent pilot; no quality claim transfers from the source site.**

## Required handoffs

Jamileh writes `media/specs/visual-handoff.md` before Motion authors the prompt. It contains:

- one-line concept and the **signature frame** someone would screenshot;
- composition anchors, subject silhouette and deliberate negative space for copy;
- one typeface direction, a bounded palette and one camera language;
- material and light treatment (paper, glass, metal, flat ink, etc.) with specific surface/edge/shadow behaviour;
- approved asset paths and rights, or an explicit original-shape route.

Tokens and inspiration links alone are not a handoff. Motion owns timing, camera and transitions and must not ask Jamileh to write the animation.

## Write and validate the Motion prompt

Fill [the worked JSON spec](../assets/motion-prompt.example.json) into `media/specs/motion-prompt.json`. Keep this direction data outside the canonical timeline schema.

| Field | Required creative decision |
|---|---|
| `blueprint`, `concept` | Selected recipe and the single idea every shot develops |
| `signatureShot` | Frame, exact composition and why it is memorable; the film builds toward it |
| `visualSystem` | Typeface, 2–6 colours, camera language, material treatment and negative space |
| `copyContrast` | Tonal/compositional strategy; `noPlaceholderPanels` must be true |
| `depthLayers` | At least three layers, each with opacity, blur and parallax |
| `shots` | Contiguous half-open ranges covering `0..totalFrames`; each has framing, one named camera move, start/end camera parameters, easing, from/to states, primary motion, secondary reaction, light/material and text treatment |
| `shots[].transition` | Mechanism plus the visual element inherited by the next shot; the last shot names its final settle |
| `beatGrid` | Approved BPM and frame-tagged actions; preserve reading holds |
| `proofPlan` | Unique proof frames covering every shot and the signature frame, mandatory review before full render, and at least four rejection criteria |

Named camera moves are `dolly`, `push-in`, `pull-back`, `crane-up`, `crane-down`, `orbit`, `pan`, `tilt`, `tracking`, `rack-focus` and `locked-off`. Do not write "camera moves nicely". Use one per shot; the shared `cameraLanguage` keeps them coherent.

Validate before storyboard or animation code:

```text
node ${CLAUDE_SKILL_DIR}/scripts/check-prompt-spec.mjs --spec media/specs/motion-prompt.json
```

The helper performs local JSON checks only. Exit 0 means the contract is complete, not that the film looks good. Exit 2 returns controlled field paths/messages and never echoes rejected creative text.

## Turn the validated spec into the build prompt

Use this order in the storyboard/build handoff. Fill it from the JSON rather than improvising unrelated effects:

```xml
<direction>
Concept: [one line]. Signature shot: [frame, composition, payoff].
Visual system: [type, palette, material/light, negative space, camera language].
Copy contrast: [tonal strategy]. No placeholder rectangles, default materials,
global glow, random zooms, unrelated tween collections or crossfades that hide weak transitions.
</direction>
<structure>
For each shot: [frames, framing, one named camera move + easing, from -> to,
primary action -> secondary reaction, light/material, text, inherited transition element].
Land actions on the approved beat grid and preserve exact copy and reading holds.
</structure>
<build>
Use the selected Native or Remotion protocol. Derive every pose from frame/time;
use seeded randomness only. Implement surface detail and contact/depth shadows,
not default vector primitives. Keep type outside camera occlusion and asset bounds.
</build>
<proof>
Before the full render, capture every proofPlan frame and inspect the contact sheet.
Reject flat/default materials, placeholder rectangles, clipping/aliasing, illegible type,
object/copy collisions, weak silhouette and unclear cause/effect. Revise and reproof
within the approved revision budget; record what changed. A validator pass is not visual approval.
</proof>
```

## Proof and full-render gate

Render one representative frame per shot, every transition boundary needed to expose continuity, and the signature frame. Inspect at delivery size. A proof sheet with a visible mask rectangle, empty scrim, default flat material or unreadable word is a failed proof, not a rendering milestone. Only after the reviewer records the proof-frame review and any correction should the full 300-frame (or other approved length) render begin. Keep proof images, notes and revisions with the export. Full playback, listening and creative acceptance remain separate checks.
