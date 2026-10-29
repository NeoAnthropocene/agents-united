# Quick facts: ten motion prompt blueprints

Pick the entry that fits the brief, then fill its pill into a **prompt spec** (destination,
duration, fps, layers, camera path, easing per beat, subject + secondary motion, text
treatment, palette, audio cues) before Motion writes any code. The detailed blueprint file
still owns the full beat table; this page is the selector and the quality floor.

These are original agents-united treatments (MIT), **prepared-not-run**: not copied prompts,
source code, a popularity ranking or proof of creative quality. The detailed files carry the
worked fictional examples. Source posts were idea leads only and are not reverified here.

**Mandatory overlay:** a recipe choice is not a prompt. First require Jamileh's
`media/specs/visual-handoff.md`, then apply the [signature-shot prompt blueprint](prompt-blueprint.md),
write `media/specs/motion-prompt.json` and pass `check-prompt-spec.mjs`. The overlay owns the
signature shot, causal shot transitions, named camera per shot, material/light, beat grid and
pre-render proof review; the recipe below supplies only the subject-specific treatment.

| # | Blueprint and when to use it | Prompt facts to fill (the pill) | Quality bar / never |
| --- | --- | --- | --- |
| 1 | **Continuous UI morph loop** — an object changes function | 8 s, 480 frames at 60 fps; one object ID across three approved states; cursor arrives before the response; smoothstep bounds; label swap inside a mask; end pose and velocity equal the start | No cursor teleports, no identity change, no whole-canvas crossfade to hide a seam |
| 2 | **Photo-to-product launch** — a licensed image becomes the product story | 12 s, 720 frames; licensed photo set with crop permission and focal points; gallery → interface viewport → product → brand; one shared photo layer above both layouts; CTA holds from 570 | No unlicensed image, no invented product claim, no double opacity at the transfer |
| 3 | **Beat-drop identity reveal** — the brand lands on the hit | About 8 s; music-gated intro → build → drop → resolve; logo enters on the drop, never before; at least three depth layers; a light flash only at the hit | No early logo, no flat background, no ignoring the audio's cue map |
| 4 | **Conversation into proof** — chat turns into evidence | Staggered bubbles, typing beat, then a proof panel; camera eases onto the claim | No fabricated testimonials or data, no bubble text outside margins, no claim the UI does not support |
| 5 | **SaaS feature flow** — a few features in sequence | 3–5 feature cards, one per beat; each has its own entrance, icon and micro-metric; parallax UI on a gradient stage | No unreadable tiny UI, no identical motion reused on every card, no fake metrics |
| 6 | **Mascot/character sting** — a character carries the brand | Squash-and-stretch, anticipation, secondary motion (tail, blink, accessory); logo lockup at the end | No rigid mascot, no static slide, no unlicensed character art |
| 7 | **Campaign manifesto** — a message in large kinetic type | One big line per beat; image or gradient field behind; camera dolly; per-line reveal with mask and tracking | No paragraph on a flat plate, no small centered text only, no unapproved superlatives |
| 8 | **Showreel montage** — several shots, one rhythm | 4–6 shots with distinct framing; cut and zoom variety; one consistent grade across shots | No slideshow of stills, no random zooms, no mixed colour grades |
| 9 | **Kinetic type hero** — typography is the subject | Per-word entrance, scale + tracking + mask reveal, depth shadow or extrusion, camera drift | No plain centered headline, no fade-only text, no glyphs off-canvas |
| 10 | **Logo sting** — the mark assembles | Brand parts assemble, a glow and a particle accent, the sound hit lands with the assembly, a short settle | No logo fade-in on flat colour alone, no unaligned hit, no borrowed mark |

## How to use a pill

1. Read the matching detailed blueprint file for the full beat table and its worked example.
2. Fill the pill into a prompt spec: destination/duration/fps, **three layers minimum**
   (background field, subject, foreground accents), one light effect, one secondary motion,
   one camera move, the text treatment, and the cue table for Sound.
3. If the recipe needs photography, ask Jamileh for the actual licensed asset paths and rights
   notes, not just inspiration links; otherwise author original shapes with graded light.
4. Hand Sound the cue table with frame spans and the sync points, not only "add music".
5. Never ship two flat plates with centered text. Depth, light, secondary motion and camera
   movement are required unless the brief explicitly forbids them, and that exception is
   recorded in the storyboard with the reason.
