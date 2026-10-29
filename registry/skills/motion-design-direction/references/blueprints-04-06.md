# Blueprints 4-6: usefulness, brand evidence and narration

Read the selected recipe with [shared direction](direction.md) and [quick facts](quick-facts.md). Every blueprint below requires `referenceFrames` (1–2 viewed local reference frames with SHA-256 and 8-dimension craft analysis), explicit `materialPasses` (`grain`, `gradientMesh`, `depthBlur`, `lightWrap`), and a side-by-side `proofComparison` board validated before full render. Fictional examples illustrate complete briefs; they are not executed projects or claims about source-post footage. All spans below are half-open at 60 fps.

## 4. Conversational product demo

### Inputs
Supply a realistic approved query, exact processing/status language, a useful result the product can actually provide, final CTA, approved UI captures/specs, anonymization rules, and duration/ratio. Parameterize query reveal style, status duration, result hierarchy and CTA hold. Default D=15 s, F=60, N=900. Show an edited demo, not measured response latency; label any sped-up processing honestly.

### Direction
Make the query understandable before showing the work and useful outcome. The result is the hero; status motion only communicates an intermediate state. A conversational visual does not imply a live AI call, new product capability or a real user's private conversation.

### Scene/beat structure
| Scene ID | Frames | Action |
| --- | --- | --- |
| chat-query | 0-180 | Reveal question by 60; hold through submit at 156. |
| chat-process | 180-300 | Explicit edited-demo status; modest progress motif. |
| chat-result | 300-660 | Useful result unfolds by 390; keep it readable. |
| chat-cta | 660-900 | Result reduces to supporting card; CTA clear by 720. |

### Build instructions
Get Kaan's full query/result/CTA approved first and verify the useful outcome with the product owner through Chris. Design the result as one primary answer plus at most two secondary details. Use discrete text-reveal indices based on frame count or approved whole-line reveals; no arbitrary typewriter pauses. Keep a visible demo/edit label when timing is compressed. Prefer an anonymized authorized capture or clearly labeled illustrative UI over fabricated screenshots. Validate `referenceFrames`, `materialPasses` and beat-to-cue alignment before authoring, and capture the side-by-side `proofComparison` board before full render.

### Native application
Reconstruct UI state from i=60t in seek(t). Query characters/lines use a clamped count over [0,60); [60,156) is a stable reading hold. Processing uses a periodic vector dot pose on [180,300) driven by frame modulo, with no CSS wall clock. Result cards interpolate y/opacity over [300,390), then hold [390,660). CTA arrives [660,720) and holds to N=900. Set readable text content on every seek, including reverse seeks.

### Remotion application
Pass approved text and reveal boundaries as props to Query/Status/Result/CTA components. Sequence starts are 0/180/300/660; subtract the start frame only for local animation, preserving absolute cue timing. Derive reveal count with floor(clamped progress*text length) or whole-line intervals; avoid stateful typing effects. Clamp result reveal by local frame 90 and CTA by 60; do not animate result copy during its reading hold.

### Sound handoff
Send submit [156,168), processing [180,300), result-ready [300,324), CTA [660,696) and optional music [0,900). Request quiet tactile cues that do not imply recorded real chat activity. If VO reads the question/result, supply exact text and synchronize to the approved performance before freezing; include speech captions/transcript. Sound returns current revision/fingerprint, measured master, aligned stems/cues and provenance. Never manufacture an app-notification recording claim.

### Gotchas and review
Anti-patterns: a blank result, fake latency metrics, private customer data, typing too fast for the placement and an unapproved model/provider logo. Verify the result matches a supported feature and all data/claims are approved. Read the result at final size without audio; check that status motion does not steal attention. Processing length changes require new dependent handoffs.

### Filled worked example
Fictional brief: Grove calendar assistant, Native chosen by Chris, 15 s/900 frames, 1920x1080 with 96 px inset, revision grove-chat-r1. Query: "Find two quiet hours on Friday." Approved illustrative result: "Friday, 10:00-12:00" and "No meetings moved"; CTA: "Plan a calmer week". Status is "Finding a slot - edited demo". Jamileh supplies #143B35/#FAF4E9/#D49B4C and a client-owned anonymized UI spec. Reveal query [0,60), submit at 156, status [180,300), result holds from 390, CTA holds from 720. Local Sound, no VO in this version, no external footage or live product/API call. Product owner must approve the scheduling claim before production.

### Quick facts

Staggered chat bubbles, a typing beat, then a proof panel; camera eases onto the claim. No fabricated testimonials or data, no bubble text outside margins, no claim the UI cannot support. Selector: [quick facts](quick-facts.md).

### Evaluation status
**prepared-not-run (blueprint 4)**. No rendered demo, comprehension study, independent playback or capability approval. Future check: identical query/result briefs in both lanes, reverse/repeated seeks, readable-result review and explicit edited-latency labeling. Existing renderer starter tests do not evaluate this conversational design.

## 5. Branded SaaS launch with real assets

### Inputs
Supply actual approved product screenshots with capture version/date, owned logo variants, brand tokens/fonts/licences, evidence-backed benefit copy, CTA, a licensed track or Sound brief and placement/duration. Parameterize screenshot focal rectangles, three benefit beats, musical phrase markers and end lockup. Default D=15 s, F=60, N=900. A missing screenshot is a question for Chris/Jamileh, not permission to invent product UI.

### Direction
Make a specific brand feel coherent across real product evidence. Use one transition family and one musical accent language; let product screenshots carry proof while typography frames the benefit. Mark crops/zoom honestly and retain enough UI context to identify the feature.

### Scene/beat structure
| Scene ID | Frames | Action |
| --- | --- | --- |
| saas-promise | 0-120 | Brand/promise visible by 36. |
| saas-feature-a | 120-330 | Screenshot A settles by 180; one benefit holds. |
| saas-feature-b | 330-540 | Screenshot B lands by 390; second benefit holds. |
| saas-proof | 540-720 | Screenshot C/detail plus evidenced statement. |
| saas-lockup | 720-900 | Logo and CTA settle by 756; final hold. |

### Build instructions
Inventory source screenshot hashes, capture dates, approved crops and exact copy; strip private information through an approved asset workflow. Build an anchor/crop sheet and one transition system using brand geometry. Sound proposes a phrase map; approve the final cut grid and copy holds together. Keep screenshots as supplied images rather than silently redrawing interface states that could imply unreleased features. New captures or changed metrics require owner review. Validate `referenceFrames`, `materialPasses` and side-by-side `proofComparison` before full render.

### Native application
Use local predecoded screenshot images and font readiness. For frame i, derive screenshot transform from approved crop and [120,180], [330,390] arrival ranges; use a constant readable transform during each hold. Render masks as SVG/HTML clips from fixed brand geometry. Cut C at 540 and resolve lockup [720,756), with all type/logo poses stable [756,900). Drive music markers from the canonical cue table, never from requestAnimationFrame/audio currentTime.

### Remotion application
Create ScreenshotBeat props `{src,crop,benefit,start,end,settle}` and a common BrandTransition. Use useCurrentFrame plus clamped interpolation, with A/B settle frames 180/390 and final 756. Preserve actual image aspect ratio and deterministic focal crops. Preload local screenshots/fonts before capture; at transitions inspect source pixels and crop continuity. Set N=900; feed the final Sound master once, not one duplicate music element per Sequence.

### Sound handoff
Send music [0,900), feature-a [120,180), feature-b [330,390), proof [540,576), brand [720,756), with exact hit frames chosen from Sound's approved track. Ask for an identifiable energy arc and brand-appropriate instrumentation, plus space if Kaan's approved VO is added. Sound owns music licence/generation consent, stems, cues and measured master; Motion checks current fingerprint and muxed timing. A screenshot or logo licence does not license source-post music.

### Gotchas and review
Anti-patterns: fake SaaS screens, invented testimonials, numerically false charts, mismatched logo versions, music so dense it masks speech and rushing copy to fit a favorite track. Check capture provenance/privacy, feature availability and final-size UI legibility. Inspect endcard duration and both ratios separately. Music replacement or copy changes reopen timing approval.

### Filled worked example
Fictional brief: Harbor approvals tool, 15 s/900 frames, Remotion confirmed/persisted by Chris, revision harbor-launch-r1. Supplied asset names are inbox-v12.png, review-v12.png, archive-v12.png and harbor-logo.svg, all pending actual client rights/hash records. Copy: "Reviews, in one place", "See what needs you", "Keep decisions together", CTA "Meet Harbor"; no numerical speed claim. Palette #122D40/#F7F1E8/#187D82; logo safe inset 96 px. Use the five spans above, actual screenshots A/B/C at 120/330/540, local Sound track with approved hits at those frames and 720, no VO or generated footage. Runtime licensing and actual assets remain prerequisites, not example approvals.

### Quick facts

3–5 feature cards, one per beat; each card has its own entrance, icon and micro-metric; parallax UI on a gradient stage. No unreadable tiny UI, no identical motion reused on every card, no fake metrics. Selector: [quick facts](quick-facts.md).

### Evaluation status
**prepared-not-run (blueprint 5)**. No real client-asset render, music sync/listening or creative/claims approval. Future check: matched screenshots/brand/copy/track in both lanes; verify capture hashes, sync, crop legibility and brand recognition from decoded outputs. Earlier synthetic/silent fixtures establish no SaaS-launch quality result.

## 6. Narrated mascot explainer

### Inputs
Supply an approved character sheet/rig and rights, exact script/pronunciations, actual target narration or approved scratch track, character performance limits, claim evidence, destination/captions and duration. Parameterize poses, expression states, on-screen keywords and scene marks around speech. Default D=30 s, F=60, N=1800; change duration through Chris when the approved performance will not fit. Voice cloning/imitation needs its own rights/consent and provider opt-in.

### Direction
Use the mascot as a clear guide, with restrained reactions that support the explanation. Show one problem, a small sequence of actions, then a useful outcome and invitation. Narration sets semantic pacing; mouth motion, if requested, follows an approved alignment track rather than arbitrary bobbing presented as lip sync.

### Scene/beat structure
| Scene ID | Frames | Action |
| --- | --- | --- |
| mascot-problem | 0-300 | Guide notices one problem; script clause and caption establish it. |
| mascot-step-a | 300-720 | First action illustrated; keyword holds. |
| mascot-step-b | 720-1140 | Second action, with a distinct supported visual. |
| mascot-result | 1140-1500 | Show outcome and let the phrase finish. |
| mascot-cta | 1500-1800 | Guide settles; CTA readable by 1560. |

### Build instructions
Get Kaan's exact script and Jamileh's approved mascot proportions/poses. Sound supplies scratch VO and later final performance/word marks; Motion blocks storyboard against it before committing a final cut. Assign stable pose/expression IDs and one gesture per clause. For a simple vector rig, preapprove mouth states or keep the character in non-speaking poses with VO off-screen. Changes in narration speed, words or scene length require new timing/fingerprint and captions.

### Native application
Use SVG groups with fixed pivot points and character model-sheet proportions; derive each transform from i=60t. Gesture A eases in [330,366), holds [366,600), and eases to rest [600,660); gesture B uses [750,786)/[786,1020)/[1020,1080). Explicitly clamp joint rotations and avoid cumulative transforms. For approved mouth alignment, select viseme by absolute frame-mark lookup on every seek. Await assets/fonts; do not autoplay narration during capture.

### Remotion application
Create Mascot props for approved pose/viseme tables and model-sheet assets. Use frame-local interpolation with exact arrivals/returns above; scene Sequences cannot reset the current viseme or caption clock. Use N=1800 and a single Sound master at frame zero. If the character is rendered footage rather than a vector, require the separately authorized footage/readiness path; this recipe does not supply a rig or automatic character generation.

### Sound handoff
Illustrative VO cue spans: problem [30,270), step-a [330,690), step-b [750,1110), result [1170,1470), CTA [1530,1740). These reserve space; Sound must return actual performance/alignment before timeline freeze. Send approved text/pronunciations and no-imitation limits. Receive measured stereo48k master, aligned VO/music/SFX stems, cue files/provenance, captions and transcript matching the current revision/fingerprint. Review breaths, intelligibility and captions; narration is never silently time-stretched to fit.

### Gotchas and review
Anti-patterns: an unapproved character likeness, rubber joints, lip sync invented from amplitude, constant gesturing, clipped consonants and captions covering the mascot's important action. Check model-sheet identity, claims, accessible text and speech pace with actual playback/listening. A vector still and word count cannot prove a polished explainer.

### Filled worked example
Fictional brief: Nest support portal, 30 s/1800 frames, Native chosen, revision nest-explainer-r1. Approved hypothetical mascot is an original round paper bird with blue wing, supplied as a model sheet; no third-party character resemblance intended. Kaan's exact illustrative script: "Requests arrive from everywhere. Put them in one shared inbox. Give each request an owner. Keep the next step visible. Meet Nest, and make room for clearer work." Five VO cues follow the reserved spans above, with the first sentence in problem, next two in steps, fourth in result and last in CTA. On-screen words: "One inbox", "Clear owner", "Next step", "Meet Nest". Safe inset 96, palette #16354A/#FAF3E8/#D39A3A, local Sound voice route pending actual consent/performance; no generated video. Narration length must be tested before final timing approval.

### Quick facts

Squash-and-stretch, anticipation, secondary motion (tail, blink, accessory); logo lockup at the end. No rigid mascot, static slide or unlicensed character art. Selector: [quick facts](quick-facts.md).

### Evaluation status
**prepared-not-run (blueprint 6)**. No narration performance, rig render, caption/listening check or independent explainer approval. Future check: use one consented performance/approved model sheet for both lanes, verify word/caption timing and character constraints, then obtain independent comprehension and listening review. Starter renderer evidence cannot prove narration or mascot quality.
