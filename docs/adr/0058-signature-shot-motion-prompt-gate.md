# ADR 0058: Motion recipes require a validated signature-shot prompt and proof-frame gate

## Status

Accepted, 2026-10-29, for the supervised Motion pilot revision. Structural validation is implemented and tested; creative quality and independent playback/listening remain unverified until the next pilot.

## Context

The first two supervised Northwind Kites revisions technically rendered but did not reach marketing quality. The second native attempt was stronger, yet both lanes still relied on generic vector scenes and visible copy scrims. The existing ten blueprints and quality floor specified depth layers, glow, particles, camera drift and type effects, but did not require a memorable payoff, causal shot progression or visual correction before a full render. Tokens and reference URLs could also reach Motion without a usable visual concept.

The maintainer supplied Prompt Motion's [realtime](https://prompt-motion.com/templates/realtime/customize) and [showreel](https://prompt-motion.com/templates/showreel/customize) customizers. Their useful structural ideas are a signature shot, an ordered shot list with one named camera move per shot, physical cause/reaction, transitions that inherit an element, beat-timed action and pre-render proof inspection. Their three.js/Web Audio implementation and model/effort recommendations are not requirements for this repository. Local prior art inspected: `motion-design-direction`, both renderer protocols, the Motion/Creative/orchestrator native and canonical roles, ADR 0056, the existing media contracts and the r1/r2 pilot evidence.

## Decision

1. **Every numbered recipe gets a mandatory prompt overlay.** `references/prompt-blueprint.md` owns film grammar; the existing recipe owns subject treatment. The overlay is original adaptation with dated source links and no transferred quality claim.
2. **Creative hands over a visual concept.** Jamileh writes `media/specs/visual-handoff.md` with concept, signature frame, composition/negative space, type/palette, material and light, and actual approved asset paths or an original-shape route. Tokens and links alone are insufficient.
3. **Motion writes a machine-checkable prompt.** `media/specs/motion-prompt.json` requires a signature shot, a shared visual system, copy-contrast strategy, at least three parameterized depth layers, contiguous shots, one named camera move per shot, from/to states, primary action plus secondary reaction, inherited transitions, beat grid and proof plan. `scripts/check-prompt-spec.mjs` must exit 0 before storyboard or animation code. It stays outside the canonical timeline schema and never echoes rejected creative text.
4. **Proof precedes full rendering.** Motion and Chris require every proof-plan frame, including the signature frame, to be captured and reviewed before the full render. Flat/default materials, placeholder copy rectangles, clipping/aliasing, collisions, illegible type and unclear cause/effect trigger correction and reproof within the approved budget. A validator pass is structural, never visual approval.
5. **Both lanes and role dialects share the gate.** Native and Remotion protocols point to the same contract. Native Claude and canonical Motion/Creative/lead roles carry equivalent ownership; renderer choice, approved copy/timing, revision fingerprints, spend limits and Sound ownership do not change.
6. **Measure the next pilot against the current model.** Keep Sonnet/medium for the immediate A/B rerun so the prompt/handoff change is not confounded with a model change. Record actual MP4s, proof artifacts, costs and unverified playback/listening separately.

## Consequences

A complete handoff now fails closed on vague camera direction, broken shot coverage, missing causal transitions, shallow depth declarations, permission for placeholder panels or incomplete proof coverage. This adds a small local JSON validation step and new artifacts, but no provider, dependency, runtime installation or timeline-schema change. It cannot guarantee taste, motion quality or asset rights. The reusable example is a fictional starting point, not an approved client storyboard. Future evals and pilot reports must distinguish structural pass, proof review, encoded technical checks, full playback, listening and creative acceptance.
