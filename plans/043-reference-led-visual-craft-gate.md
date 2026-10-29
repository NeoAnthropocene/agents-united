# Plan 043: Reference-led visual craft and final-mux sync review

Status: **PROPOSED FOLLOW-UP PLAN, NOT IMPLEMENTED.** Requested by the maintainer on
2026-10-29 after viewing/listening to both chicken-life-cycle exports. This PR records a plan only;
no new render, model change, provider use or paid Host session is authorized here.

## Goal

Improve motion quality on lower-cost models through reference analysis, concrete material treatment
and review that rejects technically correct but visually basic work. Passing JSON, codec and
loudness checks is not creative acceptance. Keep the Sonnet-class baseline for the first eval;
a model-cost difference as the cause of the X-reference gap is an unverified hypothesis, not the
solution. Measure craft improvement and total iteration cost before proposing a model comparison.

## Baseline and maintainer review

- Plans [040](040-signature-shot-motion-prompts.md), [041](041-remotion-official-skills-addon.md)
  and [042](042-spec-driven-sound-routing-and-pilot-041.md) provide pipeline foundations.
- r3 improved and proved the workflow, not reference-quality motion.
- Pilot 041 passed recorded 21/21 mechanical checks in each lane. The maintainer performed playback
  and listening: **sound FX and background sound are very basic; Native sync is better; Remotion
  is a bit unsynchronised; creative quality is low against the X examples and is not accepted.**
- This is a human-observed sync problem. Measured cue offsets/root cause remain unverified;
  neither AAC padding nor model selection is a proven explanation.
- Correction: Pilot 041 installed `digital-agency` only, not the official add-on. Pilot 040 received
  the 12 skills. Installed, discovered, invoked and used are separate evidence. Pilot 041 does not
  prove official-pack efficacy. Resolve the add-on's publication/licence hold before using it in a
  redistributed evaluation fixture.
- The full-range `yuvj420p` concern remains open: playback review did not separately approve colour
  compatibility. Verify range metadata and target-player appearance on the next actual export.

## Prior art and source boundary

Extend `motion-design-direction/references/prompt-blueprint.md`, `quick-facts.md` and its ten
blueprints. The existing validator checks structure, not pixels/taste. Do not invent another
canonical timeline, Sound manifest or production Skill.

The original X leads/authors are in [Plan 037](037-agency-motion-sound.md). Recover **1–2 actual
reference frames** from the maintainer's collection for the chosen treatment. Record URL, author,
source timestamp/frame, capture date, local path, SHA-256, permission/use scope and the principle
being studied. If access/permission is missing, Chris asks for a supplied frame or approved
alternative and marks reference review blocked/unverified. A link or like count is not view evidence.

Keep captures private unless redistribution is explicitly permitted; never commit protected media
into the public Skill/package. Use original analysis, not copied art/code/prompts/music. Compare
transferable craft rather than duplicating a character or layout.

## Proposed contract

Keep craft direction/review beside `media/specs/motion-prompt.json`. Implementation must choose a
versioned spec extension or linked record with migration and negative tests; do not silently reject
existing projects. Canonical timebase, revision and fingerprint contracts remain unchanged.

For each reference record composition, silhouette/proportions, palette, material, light direction,
edge/contact behaviour, type hierarchy and its memorable feature. Map the principle to a shot and
concrete intent; say what will differ. Keywords are not proof.

Jamileh owns reference analysis and a signature styleframe/paintover or equivalent concrete handoff.
Motion owns implementation/choreography; Sound owns audible performance/cues; Chris rejects weak
work and consolidates user questions. Shell-less Creative receives frames through the existing relay,
not a new tool grant. Specialists never invent human approval.

## Work packages

| Job | Owner / targets | Acceptance |
|---|---|---|
| V0 | Chris + Jamileh; private intake | 1–2 actual frames with provenance/rights/hash/view evidence; inaccessible links cannot count |
| V1 | Direction overlay + ten blueprints | Reference-to-shot mapping and all four material decisions below; not a decorative checklist |
| V2 | Motion/Creative proof review | Side-by-side board at delivery size, detail crops and short motion proofs; defects assigned and reproofed |
| V3 | Chris + Sound + Motion final mux | Cue offsets, playback/listening and human sync acceptance; range/codec review separate from taste |
| V4 | Tests, fixtures, native/canonical roles | Negative tests first; migration, installed-resource/link checks; no unreviewed dependency |
| V5 | Maintainer-started evaluation | Same model/settings/brief/assets/cue plan and equal budgets; blind craft review and total cost report |

## Material-pass decisions in every blueprint

Each pass records parameters, affected layers, shot/frame ranges, expected visible contribution
and a proof crop. Every blueprint makes all four decisions; N/A needs a reviewed reason. Applying
all effects everywhere is not craft.

| Pass | Acceptance evidence | Reject |
|---|---|---|
| Grain / surface | Seed, scale, opacity, surface placement; tactile detail without crawling or lost contrast | Global noise masking crude drawing; unstable randomness |
| Gradient mesh / tonal field | Authored colour anchors/falloff support volume and attention; palette and output crop | Generic wash or global glow claimed as material craft |
| Depth blur | Fore/mid/background focus, radius/range, occlusion; legible subject/type | Blur hiding weak edges or creating placeholder copy panels |
| Light wrap / edge integration | Named source, rim width/colour/intensity, contact shadows and spill consistent with geometry | Uniform glow, detached shadows, inconsistent lighting |

Flat illustration needs deliberate approved direction, authored silhouette/proportions and motion.
Primitives plus grain are not finished characters. Approve asset/styleframe quality first.

## A proof review that can fail

1. Show the 1–2 references and candidate signature frame side by side at delivery size, with
   silhouette/edge/material/light/type crops. Record frame IDs/hashes and actual view evidence.
2. Describe specific gaps, not "looks good": crude bird proportions, ambiguous shell overlap,
   inconsistent edges, grass intruding on the subject, weak hierarchy or stock-looking characters.
   Record severity, owner, target frame, correction and outcome.
3. Review short transition and secondary-motion clips: anticipation, reaction, depth, continuity
   and reading holds. A still cannot approve choreography or sync.
4. Reproof corrections before full render. Bound rounds and cost. If craft still fails, stop or
   escalate/simplify with an explicit decision; do not relabel technical success as visual approval.
5. Keep structural, encoded technical, reference-relative craft and human creative results separate.

## Sound and sync on the final encoded file

Address basic audio separately from surface effects. Set sonic intent per cue; audition model-free
synthesis, approved supplied/recorded or licensed sources. Only propose a model/provider if justified
and separately authorized. Hardware feasibility is not audible performance quality.

Compare the actual final MP4 to the chosen Sound master. Define cue IDs, visual target frames and
sample/time onsets; measure signed offsets with a named method. Proposed tolerance: within one
frame for a discrete intended hit (33.3 ms at 30 fps), separate tolerances for ambient/music events.
Chris approves tolerances before production. Inspect decoded streams and timestamps; investigate
onset, trim, routing and encoder delay rather than assuming AAC caused the drift. Retain commands,
exits and before/after offsets. Maintainer playback/listening closes perceived sync separately.

## Test-first implementation and evaluation

- Red cases: missing/unviewed references, missing rights/hash, vague/omitted material passes, no
  signature comparison or transition proof, unresolved severe defect, stale proof after revisions,
  sync claims from timeline arithmetic only.
- Green cases: grounded material crops with justified N/A, deterministic grain/time, backward
  migration. Shipped examples and installed Skill trees must never count as production evidence.
- Share gate semantics across both renderers and native/canonical roles. Follow existing resource
  packing; no private reference assets or model binaries in shipped Skills.
- Evaluate gate-off vs gate-on with the same lower-cost model/settings, brief, assets, runtime,
  duration and audio permissions. Equal budgets, capped corrections, no automatic Opus or provider
  switch. Distinguish installed/discovered/invoked/used Skills using Host-owned evidence.
- Maintainer scores anonymised exports: distinctiveness, silhouette/asset craft, material/light,
  choreography, type and sonic/sync fit. Report actual cost/tokens/time/rounds including blocked
  attempts; no invented totals. Technical checks remain separate.
- Success target: meaningful human-rated improvement over Pilot 041 without model escalation,
  no severe craft defects, both lanes passing final-mux sync/range review. Not a promise of parity
  with popular posts.

## Delivery and non-goals

Expected targets: shared prompt overlay/validator/fixtures; `quick-facts.md` and all five detailed
blueprint files; both production references; audiovisual proof/acceptance; relevant Creative,
Motion, Sound and Chris role wording; eval fixtures and a dated human-review report. Write an ADR
at implementation for schema/gate changes. Run typecheck, full tests and hostlib verification.

Out of scope now: implementing the gate, new global tools, renderer switches, redistributing X
media or new paid Host runs. Preserve all permission, licence and spend boundaries. Start the
implementation on a fresh branch from merged `origin/dev` after this publication PR.
