# Original technique and prompt library

Use one primary technique after selecting a numbered recipe. Combine a second only when it has a distinct narrative job and fits the approved proof/revision budget. The eight cards are original MIT direction, informed by [pinned inspiration sources](../assets/techniques.json); no source prompts, code or media are installed. The source research record is `docs/research/2026-11-03-motion-technique-sources.md` in the contributor repository.

## Find and select

The offline helper reads installed static data relative to itself, regardless of project cwd. It prints JSON only and never installs, renders, calls a model, changes media files or approves spending.

```text
node ${CLAUDE_SKILL_DIR}/scripts/techniques.mjs list
node ${CLAUDE_SKILL_DIR}/scripts/techniques.mjs search "paper depth"
node ${CLAUDE_SKILL_DIR}/scripts/techniques.mjs select paper-depth-stage --renderer native
node ${CLAUDE_SKILL_DIR}/scripts/techniques.mjs select character-reaction --renderer remotion
```

Search matches all case-insensitive words across IDs, names, tags, use cases and composition. Empty results mean no matching card. Select requires an exact ID and explicit `native` or `remotion`; renderer selection must already agree with Chris's approved `media/project.json`. Selection does not change the renderer. Invalid input exits 1 with usage and no partial JSON.

| Card ID | Narrative job | Primary rejection |
|---|---|---|
| `character-reaction` | Attention → decision → grounded action → readable recovery | Detached props, foot slide, unreadable emotion |
| `stepped-line-boil` | Living drawn surface with stable camera/type | Crawling linework, global stepped camera |
| `paper-depth-stage` | Ordered cutout reveal with hinged material and depth | Detached shadow, impossible folds/occlusion |
| `continuous-morph` | Semantic transformation through corresponding contours | Knotted paths, unrecognizable identity |
| `single-line-reveal` | Endpoint guides attention into the next composition | Decorative tracing, thin-line shimmer |
| `kinetic-type-hold` | Approved words resolve into a protected readable hierarchy | Changed copy, clipped glyphs, stolen hold time |
| `evidence-map-build` | Ordered argument from verified data and sources | Misleading scale, unsourced facts |
| `material-light-reveal` | Signature object readability through material/light | Uniform glow hiding weak surfaces |

Each selected card returns `parameters`, `composition`, `motion`, `promptTemplate`, both lane methods, the requested `mapping`, `sound` intentions, `proofChecks` and exact source provenance. Fill every `{placeholder}` using approved inputs, not invented client details. Parameter ranges and frame counts come from the project rather than hard-coded source films. The helper does not interpolate placeholders or declare a completed prompt.

## Feed the existing prompt and craft gates

Record the selected ID, renderer, filled values and reason in the direction/handoff document. Translate these decisions into the existing spec; do not paste the card as a complete spec:

| Card material | Existing `motion-prompt.json` destination |
|---|---|
| Composition and signature choice | `signatureShot`, `visualSystem`, `copyContrast` |
| Layer/occlusion/light decisions | `depthLayers`, four explicit `materialPasses` decisions |
| Motion and chosen lane method | `shots[].primaryMotion`, `secondaryReaction`, `cameraMove`, `stateChange`, `transition` |
| Sound intentions and target action | `beatGrid` actions aligned to canonical timeline cue IDs/frames; separate Sound handoff |
| Rejection criteria | `proofPlan`; then actual viewed evidence/defects in `proofComparison` |

Preserve approved copy, half-open frame ranges, the canonical timeline/revision/fingerprint and exact cue targets. An acting delay or soft audio envelope needs an explicit target decision with Sound; copying a beat grid into a new renderer creates drift. Sound owns sourced/synthesized assets, stems/master, measured onset and provenance. Cards authorize no audio generation route.

Require `check-prompt-spec.mjs --require-craft-gate --timeline` before animation and its `--proof-comparison` gate before full rendering. Both Native and Remotion keep their existing preflight/render helpers and audiovisual final-mux measurement. Keep one primary technique, scoped material passes, a signature proof and transition strips within Chris's approved reproof limit.

## Inspiration is not a viewed reference

The GitHub text and source files were inspected on 2026-11-03. Films, stills and model sheets were **not viewed** in that research. Source links and installed cards cannot become `referenceFrames` with `viewed: true`. Jamileh still supplies actual local viewed references, hashes, rights scope, eight-dimension analysis and shot mapping. Cards cannot prove the candidate looks comparable.

LemoLab's code/docs are MIT while demo films/stills have CC BY 4.0 terms and voice/third-party exclusions. John Heibel and Vincentwei1021 publish MIT repositories; assets need their own checks. athemeroy's CC BY 4.0 covers original writing and excludes linked works. Its useful contribution here is evidence discipline, not a media asset pool or model ranking. Source metrics and advertised style/emotion counts establish no quality guarantee for this library.

The Remotion official add-on redistribution hold (Plan 041 / ADR 0059), runtime entitlement, paid-work authorization and source-rights checks remain in effect. Host invocation, rendered Native/Remotion parity, full playback, human listening and creative acceptance are **unverified** until separately demonstrated. A successful selector or validator is not that demonstration.
