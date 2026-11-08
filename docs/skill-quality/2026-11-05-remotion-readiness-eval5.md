# Remotion readiness eval 5: saved-record audit, 2026-11-05

**Decision: no-go for the complete eval 5 readiness gate.** This one maintainer-run session demonstrated delegated production, real upstream Skill invocation and an export, but did not establish the required current Elements catalog consultation, and an intended project-local FFmpeg install escaped into the repository root. Fix and test the containment defect and make the Elements decision evidence explicit before treating this workflow as ready. This is one observational case, not a controlled with/without benchmark or an eval 6 result.

## Scope and record keys

The live brief was an internal noncommercial 15-second 1920×1080/30 fps chicken lifecycle evaluation, with no external assets, paid service or global setup (lead record line 7, 2026-11-04 23:19:55 UTC). Creative direction was explicitly not visual approval or entitlement. Session `e4a302c3-c370-4cbf-9645-e719213fd464`, Claude Code 2.1.318, project `scratch/remotion-readiness-evals-2026-11-04/eval5`, was run by the maintainer. The hostlib session reader reports 3 prompts, two worker records, 23:19:54–08:49:01 UTC, 2,559 seconds API and 34,308 seconds wall. Its cost-state is **$10.1486 notional, not a bill** (Sonnet 5.5 $10.1261 and Haiku 5.5 $0.0225). No session was started for this audit.

Below, `L` means the lead's `<session>.jsonl`; `M` is `subagents/agent-aa6d9b8eee8923e4b.jsonl`; `S` is `subagents/agent-a9215fef5a11c5b80.jsonl`. Numbers are physical JSONL lines. Results describe saved records at the time, not an independent repeat of the model's calls. Current scratch files can have changed since those calls.

## Delegation and setup

- L87 (23:20:17) launched Motion for a read-only consultation; L104 records its handback. L109–110 gives Motion the readiness/production slices and asks the maintainer to accept the map; L124 (23:21:38) sends Motion the accepted assignment naming it the sole setup owner and producer. Motion, not the lead inline, did the setup and production. This extra map approval is separate from authorization already supplied in the brief and delays autonomous readiness.
- M33–35 (23:21:47) invoked `remotion-production`, `motion-design-direction`, and `audiovisual-review`; M37, 40 and 43 return their roots. M137, 146–149 invoke `remotion-best-practices`, `remotion-markup`, and `remotion-render`; the router and markup have explicit launch/root results at M139–140 and M148–149. The setup record reports a successful root result for render as well. Current project `.claude/skills` and `skills-lock.json` show those three official Skills installed from `remotion-dev/skills` with computed hashes. Installed, discovered, invoked and used are distinct: setup records markup and render guidance used, but says the router's create/captions subreferences were not read. The router explicitly directs loading the create reference for a new video/project (M140): this is a routing gap, not proof that the router was fully followed. The installer revision is unverified: API HEAD `c7cb2fdcacd134fb2ccb9b7a44f9ffa44e467271` was observed, but installer did not print its resolved revision. The setup record says upstream Skill terms were unconfirmed; no redistribution is claimed.
- The setup record reports the four-package registry check at 23:22 UTC, pinned and latest `4.0.540`, and install success. Current `media/remotion/package.json` declares exact `4.0.540` for `remotion`, `@remotion/bundler`, `@remotion/renderer`, `@remotion/cli`; React and React DOM are 19.0.0, ffmpeg-static 5.3.0. Current lock SHA-256 `cb0729d09538790cb70c183edc95329a99e5a1c422b1350edb22220478d2486c` matches the setup record. This does not independently re-query the historical registry or re-run npm.
- The current setup record and `media/remotion-license.json` identify evaluation purpose, internal suitability and no commercial use; the record says preflight allowed evaluation while `entitlementVerified` and `productionAuthorized` were false. The v4.0.540 licence copy is retained. This is not evidence of commercial entitlement or human review.
- The record says all Elements were skipped for custom frame-driven SVG/React and that no Element source or catalog media was inspected. Selecting none is allowed, but the required current catalog consultation and shortlist with individual include/adapt/skip rationale were not established; no catalog source or third-party asset provenance can be claimed. Avoid treating the skip itself as a violation. Record concrete catalog review and decisions in a future run.

## Containment failure and limitations

The setup record describes `ffmpeg.mjs install --mode project-local --project <eval5>` resolving npm to the repository root because eval5 had no package.json. It changed root package files and ignored `node_modules`; M104 (23:25:45) shows the worker running `git checkout -- package.json package-lock.json`. Its report says it removed root `node_modules/ffmpeg-static` but did not inventory other ignored additions. L164 and L169 show the lead checking tracked package status and local ffmpeg presence, not the full ignored directory. The helper's project-root npm cwd is visible in M109. The tracked-file revert does not prove all preexisting changes or ignored dependencies were preserved. Add a regression that proves an absent project manifest cannot cause npm to walk to an ancestor; require a valid confined install root before invoking npm. Separately, prevent a cleanup from restoring unknown user edits.

Initial ffmpeg resolve/verify failed (exit 2/1); project-local `ffmpeg-static` was then installed under `media/remotion` and verified according to the setup record. Hostlib also reports a shell quote error and a blocked sleep in Motion; these did not prevent the later handback. The lead's initial shell inventory exited 2 because optional settings files were absent. No MCP tool call was observed. These observations are not general host failures.

## Output and subsequent revisions

The original silent file currently has SHA-256 `4f46249bedc091cf27214642334db37653c4f750c7dbd2146d85cfdc6c649e47`. Current `out/probe.json` records H.264, 1920×1080, yuv420p limited range, 30 fps, 450 decoded frames and 15.000 seconds, no audio. Current proof-check JSON says `ok: true`; proof contains stills, contact sheets, short clips and decoded frames. L169 explicitly says the lead did not independently rerun ffprobe or view frames. The worker's setup record reports image inspection, gate exits and render exit 0; this audit did not replay the video or reproduce those calls. Human visual approval, continuous playback and entitlement remain **unverified**.

After the initial completion the maintainer requested voice and later music/SFX; Sound was consulted and assigned through relay, with separate model approval (L177, 187, 205, 213, 242). S29–30 and S65–66 show successful calls to `audio-generation`, `sound-design-direction`, `audio-post-production`, and `audiovisual-review`. Motion remuxed subsequent revisions. The r2 decoded-frame check found two effects out of step and Sound retimed them before r3 (lead flow L394–415). Current hashes: voice `ba00bc7b591eaffe6d0f40df405aa828c49e693cee2249d908781a1cf6bf24e8`; superseded SFX/music `efc8b22497c6981e135876a87f68d67ed7fb200b8b8b1651a1f3f597c8062967`; final `eff3c7b93054a1fac74a3509cb2fb97dd150ec3f8b4e57462b84f89ed7033c4c`. M574–575 (07:59:24–33) records final mux/probe exit 0, 450 video frames, 15 seconds, H.264 and AAC, and matching video-stream MD5s; M577–578 records -15.9 LUFS and -1.5 dBFS peak and seam measurements. L449 states nobody had listened. Full playback, listening, perceived sync and creative acceptance remain **unverified**; numeric checks and stills cannot substitute for them.

## Follow-up

1. Fix FFmpeg installer containment with a failing regression first; inspect actual cwd and ancestor npm resolution, including preservation of preexisting files.
2. Require traceable catalog consultation and a concrete shortlist/skip rationale; test a valid none-selected decision without inventing source usage.
3. Resolve official router-to-create reference routing and record successful Skill tool results separately from file presence and actual use.
4. Review whether an additional map-approval prompt is necessary when the user has already authorized the work. Re-run only under separately authorized maintainer-run conditions; eval 6 remains unverified.



## Direct setup receipts and deliverable paths

The Motion record directly shows the release checker at M55 (2026-11-04T23:22:08.508Z) and its result at M56 (23:22:12.115Z): timestamp 23:22:10Z, pinned 4.0.540, all four registry latest values 4.0.540, upToDate true, mismatches empty, EXIT=0. M83 (23:23:00.043Z) runs npm install in media/remotion; M85 (23:25:00.206Z) returns EXIT=0 and 244 packages, with npm ls confirming all four 4.0.540 packages. These establish the historical setup check and result, not current registry freshness.

M132 (23:26:56.298Z) invokes npx skills add remotion-dev/skills with the Claude Code selector, exactly best-practices/markup/render, project copy and yes flags. M133 (23:27:14.890Z) reports the three copied .claude/skills and EXIT=0. M120–121 separately queries GitHub HEAD c7cb2fdcacd134fb2ccb9b7a44f9ffa44e467271. That HEAD observation is not proof the installer resolved that commit; the installed revision remains unverified.

The initial silent file is scratch/remotion-readiness-evals-2026-11-04/eval5/out/chicken-lifecycle-loop.mp4; the final audiovisual revision is out/chicken-lifecycle-loop-final.mp4 under the same project. The hostlib wall metric 34,308 seconds (9h31m48s) differs slightly from the maintainer's reported 9h30m36s; retain both scopes rather than infer active execution time from either. API time 2559 seconds matches 42m39s. The transcript spans the November 4/5 UTC boundary.


## Current deliverable identities

These byte hashes were read from the current project files during this audit; they identify the artifacts, not playback or creative acceptance.

| Project-relative file | Bytes | SHA-256 |
|---|---:|---|
| `out/chicken-lifecycle-loop-final.mp4` | 16554055 | `eff3c7b93054a1fac74a3509cb2fb97dd150ec3f8b4e57462b84f89ed7033c4c` |
| `media/remotion/Composition.jsx` | 5712 | `3df7a46a26f8eea1c69f68cb3b3d4e8e9a0c352812a5a035f85f1b8ce4e41a25` |


## Subsequent source validation

The implementation follow-up passed fresh typecheck/build and the full suite (actual exits 0/0): 239 files, 4,888 passed tests, 209 skipped, 5,097 total. Watched source remained unchanged. The FFmpeg child suite separately passed all 35 tests, including actual offline npm confinement. This validates the source corrections, not a post-fix Host sitting or real FFmpeg download. The historical completed project was not refreshed or modified by these corrections.
