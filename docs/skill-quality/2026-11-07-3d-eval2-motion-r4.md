# Eval2 Motion — completed sitting and scoped results

The maintainer completed session `d4b901d8-ec77-4c52-908e-8a169e0dc813` and
reported **2.45 USD**, 6m 14s API time and 44m 56s wall time. The offline Host
record reports 2.4478994 USD, which rounds to the same cost; metadata capture
boundaries differ for wall duration. These are reported usage figures, not an
independently verified invoice or subscription-quota measurement. Account
identity and funding ceilings remain in the ignored local ledger.

## Verdict

**Scoped technical and revised-playback acceptance, with readiness gaps.**
This sitting is not a complete pass for actual Skill loading, a real material
change, or an Arda-to-Motion production exchange. The earlier
[provisional audit](2026-11-07-3d-eval2-provisional-audit.md) retains what was
known before the maintainer's feedback.

| Item | Result and scope |
| --- | --- |
| Main and worker | Actual Claude Code 2.1.319 records show Chris/Opus 5.5 and one native ordinary Motion/Sonnet 5.5 subagent, consultation, accepted map, production continuation and successful handbacks. No Arda or independent QA worker was invoked. Haiku usage is not evidence of an independent reviewer. |
| Tracking | Chris used a real returned task ID and owned the status updates. Motion reported lacking Task tools and handed status back. The actual complete worker tool catalog remains unverified. |
| Skill loading | Zero actual `Skill` calls on both actors. Both installed role grants declare `Skill`; a missing-grant cause is not established. Direct helpers and reports do not count as native Skill invocation. This readiness requirement remains unmet in the observed trace. |
| Timeline freshness | Host/tool evidence records the same-revision audit-cue edit, `shot.stale`, and exit 2. The maintainer's answer to this question described the separate playback repair, so no additional human claim about the timeline test is inferred. |
| Real material change | Not established. The worker changed unused metadata, not an actual PBR/shader input, and admitted some exit codes were captured incorrectly. The broader hashed-source edit was detected, but that is weaker evidence. |
| Restoration | Independently rechecked **all 27 reference hashes: zero mismatches**. This means the agent put temporary test edits back exactly; it is not a check the maintainer needed to understand or perform manually. |
| Captures | All six sampled capture PNGs independently match their intended sources: timeline 0/3/5 maps to source 0/3/5; 6/15/29 maps to source 5. This establishes the sampled sequence/hold mapping, not broad craft quality. |
| Human review | The maintainer accepted the signature frame, loaded preview and six-frame/hold behavior. They reported missing playback initially; after requesting a revision, playback worked as expected. Acceptance applies to that revised preview. |
| Visibility | The maintainer could barely distinguish the images. The nearly rotationally symmetric source turns only about ten degrees over six frames, then holds. Later session evidence investigates the tiny source-frame difference. A visible counter cannot substitute for clearly visible object motion. |
| Browser | The maintainer approved existing system Chrome. Reusing that executable through the locked Playwright package is distinct from installing a browser; no browser download is established. |
| Review staffing | Chris read the frames himself. The maintainer considered that acceptable for this small check and suggested offering a cheaper independent reviewer for larger work. This is a proportional-review preference, not a failure requiring an extra paid worker here. |

## Test-design correction

The prepared brief supplied a valid finished shot and asked only for its
integration. That did not require fresh Arda production; the one-Motion map
therefore could not demonstrate the intended Arda-to-Motion exchange. The
six-frame symmetric fixture also made hands-on motion review weak. Those are
limits of the prepared exercise, not evidence that every 3D request must spawn
Arda or that the director should rerender already accepted inputs needlessly.

The combined follow-up will use a fresh isolated project: Arda must author a
new visibly asymmetric original scene, produce a clearly changing sequence
and fresh Shot Handoff, then Motion must integrate it. Applicable Skill calls,
real material/timeline controls with captured native exits and exact
restoration are explicit evidence requirements. The director chooses the
applicable Skills and proposes proportional independent review. No Host
session is started automatically, and no original r4 evidence is overwritten.

Eval3, worker Skill-use proof and final cross-agent handoff/playback acceptance
remain **unverified**. The passed full code gate is unchanged by this audit.
