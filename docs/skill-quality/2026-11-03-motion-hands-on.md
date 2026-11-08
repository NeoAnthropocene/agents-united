# Local hands-on motion exercise

**2026-11-08 handoff:** The preserved previews were resumed and passed nine HTTP and seven automated browser checks. Current session-local links and the limits of that evidence are in the [local handoff](2026-11-07-final-local-handoff.md); there is no new human acceptance.

The two projects in `scratch/motion-hands-on-2026-11-04/` are isolated copies of the 041 native and Remotion pilot media and audio. Their `digital-agency` Claude Native Lane installations come from this checkout; only Remotion receives the optional `remotion-agent-skills` Bundle. The copied Remotion 4.0.539 dependencies are project-local. No Claude session, paid service or generation is started by preparation. The pilot's licence record and proof records are historical evidence, not a fresh eligibility determination or human approval. The Plan 041 redistribution/publication hold remains in force.

## Historical preparation and reproduction

1. Start the native preview from the repository root: `node scripts/serve-motion-hands-on.mjs scratch/motion-hands-on-2026-11-04`. Open the exact loopback URL printed, then play, pause or drag the frame slider. The two historical encoded exports can be played below it. This is a silent source preview; it is not a final encoded playback or listening review. Stop the server with Ctrl+C.
2. The maintainer explicitly allowed Remotion Studio on the local network. The pinned CLI binds beyond loopback, exposing project data on that network. Check your own eligibility and the copied `remotion/media/remotion-license.json` and complete the current Remotion production preflight with `--purpose evaluation --audio-manifest audio/manifest.json`. From `scratch/motion-hands-on-2026-11-04/remotion/media/remotion`, run `node node_modules/@remotion/cli/remotion-cli.js studio index.jsx --no-open` and open its printed local URL only after accepting that network exposure. Studio edits are source changes requiring renewed proof and helper export. Stop it with Ctrl+C. The copied dependencies are not an entitlement.
3. In a separate terminal, go to the chosen lane and start the Claude interactive TUI yourself, for example `claude --model sonnet --effort medium --agent orchestrator-digital-agency`. This spends your Claude account; account quota and cost are unverified. Review the scope and budget before starting. Ask Chris to read `BRIEF.md` and collaborate on a technique from the new motion library. Do not use an automated or headless session as a substitute for this interactive test.
4. Check the creative result in the preview, request a bounded revision, then review the finished export visually and audibly. Check cue timing and captions where applicable. Historical proof records cannot establish acceptance of changed work. These preparation checks did not establish human playback, listening or perceived sync. Later observations and their limits are recorded below.
5. Record the session ID and working folder. Resolve the corresponding encoded directory under `~/.claude/projects/`, then inspect `npm run hostlib:session -- <session-id> --project <host-record-directory>`. The `--project` argument is the record directory, not the working folder. Exact commands for these sittings appear below. Distinguish a Skill being installed, discovered, invoked and used; do not rely on the model's account.

## Reproduction

For a bounded first exercise, choose `character-reaction` in one lane and ask for one signature frame plus a short anticipation/action/recovery proof before a full render. The two copied exports are historical baselines with differing authored copy/timing, not a controlled A/B of the new library. For a controlled comparison, approve one common brief, copy and canonical timeline for both lanes; record that revision explicitly rather than silently replacing either historical baseline. Rendered quality was unverified at preparation time; the dated sitting below supplies bounded evidence, not a controlled A/B.

Build the checkout (`npm run build`), then run `node scripts/prepare-motion-hands-on.mjs --source C:/github/agents-united/scratch/pilot-041`. Add `--destination scratch/motion-hands-on-2026-11-04` for a fresh kit at the active path; the helper refuses an existing destination and preserves it on failure; choose a fresh path using `--destination <path>`. The required `--source <path>` identifies the existing pilot. No data is written to that source. If its local Remotion dependencies are absent, install the pinned project-local dependencies only after confirming eligibility; Studio is then unverified until successfully started.

After the November 4 review, fresh preparation installs `digital-agency` only in both lanes. It no longer installs the held vendored official add-on automatically; the generated brief directs Remotion setup through compatible existing Skills or the authorized direct-upstream route. The active historical kit described above retains its previously installed Skills and the maintainer's later edits.


The active copy records SHA-256 hashes of historical media and audio in each lane’s `historical-sha256.json`; these establish copy identity, not new creative approval. Native browser seek, play and pause were checked, and the screenshot is `scratch/motion-hands-on-2026-11-04/preview-check.png`. Both local FFmpeg executables report version 6.1.1, and native Playwright loads; a new production render was unverified during preparation; later evaluation exports are recorded below.

For the active Native project, in PowerShell:

```powershell
Set-Location 'C:\Users\altay\.codex\worktrees\11f3\agents-united\scratch\motion-hands-on-2026-11-04\native'
claude --model sonnet --effort medium --agent orchestrator-digital-agency
```

For the active Remotion project, use the same command after changing to `C:\Users\altay\.codex\worktrees\11f3\agents-united\scratch\motion-hands-on-2026-11-04\remotion`. Type `Please read BRIEF.md and help me try one motion technique interactively.` in the TUI. Starting a session spends the maintainer's Claude account; quota and actual billing remain unverified. No session was started during preparation; the maintainer subsequently ran the sessions below.

The evaluation preflight used for the active Remotion copy (run from the repository root) is:

```powershell
node registry/skills/remotion-production/scripts/project.mjs preflight --project 'C:\Users\altay\.codex\worktrees\11f3\agents-united\scratch\motion-hands-on-2026-11-04\remotion' --purpose evaluation --audio-manifest audio/manifest.json
```

It returned `allowed: true` for the historical evaluation record, but `entitlementVerified: false` and `productionAuthorized: false`.

## Preview observations during preparation (2026-11-04)

Both active Motion roles include the corrected inputs-first ordering. For this refresh, `update digital-agency -t claude --dry-run` did not discover the native sidecar installs; after confirming that all managed projections were unedited, the supported `add digital-agency -t claude --native --copy -y` command refreshed them without `--force`. Their content and lockfile hashes were checked afterward. Preserve any later user edits; do not force a refresh to reproduce this sitting.

- Native: http://127.0.0.1:59588/ — browser seek, play and pause verified. To restart from the repository root: `node scripts/serve-motion-hands-on.mjs scratch/motion-hands-on-2026-11-04`; use the new printed URL.
- Studio: http://localhost:3001/ — `AgencyMotion` loaded; timeline scrubbing reached frame 241. It also listens on the local network at `http://172.17.15.122:3001`. To restart, change to the active `remotion/media/remotion` folder and run `node node_modules/@remotion/cli/remotion-cli.js studio index.jsx --no-open --port=3001`.

Stop each preview with Ctrl+C in its terminal. Do not reuse historical process IDs. If the original terminal is unavailable, identify the current listener and command before stopping its process. In Studio, the copied JSX Root displays a warning that default props cannot be saved because the root is not TypeScript; source editing and review still require the usual proof and export gates. Screenshots: `preview-check.png`, `studio-check.png`, `studio-scrub.png` in the active kit. These checks do not establish human creative approval or listening quality.


## Maintainer-run evaluation, 2026-11-04

The maintainer ran both interactive sessions. The audits launched no Claude session. Host records and current artifact hashes are the evidence; model completion summaries alone are not. Sanitized local evidence is in `scratch/verification/native-session-audit.md` and `scratch/verification/remotion-session-audit.md`. Raw private transcripts are not published in this repository.

| Lane | Session ID | Host / model / configured lead | Human prompts / workers | Own notional cost record |
|---|---|---|---|---|
| Native, 13:08–16:06 UTC | `eb812ab3-b481-4ad4-86d1-da88063b97c5` | Claude Code 2.1.318 / claude-sonnet-5-5 / orchestrator-digital-agency | 9 / 2 | 12.1578 USD |
| Remotion, 13:15:01–16:03:41 UTC | `6f49fb90-e3ee-45aa-af9d-4c93fd059f07` | Claude Code 2.1.318 / claude-sonnet-5-5 / orchestrator-digital-agency | 14 / 0 | 6.4009 USD |

Both records show `auto` permission mode. Total recorded notional model usage is **18.5587 USD**, not a provider bill; quota headroom and actual billing are unverified. Both final human messages accept the results **for this test demo**. This is scoped demo feedback, not production entitlement or formal professional-quality sign-off. The historical licence/publication hold is not lifted by this report.

### Reading the records

`--project` means the encoded Claude host-record directory, not the working project folder. The initial audit attempts using workspace paths returned no record (exit 1); the corrected paths returned exit 0:

```powershell
npm run hostlib:session -- eb812ab3-b481-4ad4-86d1-da88063b97c5 --project 'C:/Users/altay/.claude/projects/C--Users-altay--codex-worktrees-11f3-agents-united-scratch-motion-hands-on-2026-11-04-native'
npm run hostlib:session -- 6f49fb90-e3ee-45aa-af9d-4c93fd059f07 --project 'C:/Users/altay/.claude/projects/C--Users-altay--codex-worktrees-11f3-agents-united-scratch-motion-hands-on-2026-11-04-remotion'
```

### Native: delegation, feedback and checks

The lead first consulted Motion Designer read-only, then assigned character-reaction proofs and production; Sound Designer was separately consulted and assigned onset correction and a looping bed. Two ordinary subagents in relay mode executed the media work, with accepted `SubagentHandback` receipts. This was not an in-process team: no direct peer exchange or structured team shutdown was observed. Handback is not evidence of worker process exit.

The user rejected the unexplained egg appearance, later called the loop terrible, and challenged the limited timeframe. The revisions added laying into the nest, a staged hen walk-out and night-to-dawn return, and extended the video from 450 to **570 frames / 19 seconds**. Final demo acceptance followed these revisions; this was not first-pass creative success.

Initial sync failed: peeps +1.82, flutter +1.06 and cluck +1.52 frames. Sound corrected quiet lead-ins and rebuilt using the standard mixer against approved canonical r3a, after an earlier derived in-memory timeline deviated from that contract. Final persisted `render-r3/diag/mux-sync-result.json` has `ok: true`, no errors, valid contract and measured-within-tolerance; the actual worker tool result exited 0. Numerical alignment does not establish perceived sync. Full 912000-sample loop-wrap measurement reported 0.87 dB level step and sample step 0.01695 versus ordinary first-50ms maximum 0.01729; the earlier seam script used a stale 15-second window and was corrected. Actual FFmpeg output reported -15.9 LUFS and peak -2.1 dBFS (retain that unit).

Current final video hash was independently checked. The worker's historical inventory check reported 551 entries, only source HTML/content and timeline changed, no missing files, and 51 prior audio files unchanged. The audit did not independently rerender or hash every exported frame. Source title reveal remains seek-order dependent; a two-pixel discrepancy at frame 337 is unexplained. Title contrast was 3.46 at frame 404: the normal-text 4.5 criterion is not met; large-text applicability must be explicit. Independent listening, explicit perceived-sync judgment, portability and repeated-session reliability remain **unverified**.

### Remotion: inline execution, feedback and checks

The user chose character-reaction and requested sun/egg layering correction, egg-laying causality, richer character sound and a continuous push-in while the hen walks away. The user then corrected the disappearing sun and shell-crack overlap. Early “preview looks good” and later “OKish” feedback preceded more revisions. The maintainer subsequently reported sound sync and background sound as OK, requested r4 comparison/spec updates, and accepted the final demo after d4 was fixed and r8 rendered.

There were **zero Agent calls, zero teammate records and no specialist consultation**. The orchestrator performed source, sound, proof and spec work inline. A defect-owner label of “Motion Designer” is not evidence that the specialist executed. This sitting cannot validate specialist execution or orchestration quality.

The formal r8 log records `ok: true`, `pilot-041-r4`, **450 frames**, H.264 limited-range yuv420p at 1920×1080/30fps with AAC stereo 48kHz, approximately 15.02 seconds. Tool inspection reported -16.0 LUFS and 3.6 LU LRA. Final spec validation passed; 19 sound-effect stem-to-mux correlations had maximum absolute lag **0.003 frames**. Mux validation returned `ok: true` and measured-within-tolerance. First/last-frame PSNR was **41.314130 dB**; this is not perceptual loop approval.

Recovered failures included extensible-WAV rejection, a pipeline printing exit 0 after that rejection, blocked sleep and shell/working-directory/quoting errors. PCM16 diagnostic copies enabled onset analysis: peeps threshold +3.0125 frames failed one-frame tolerance (exit 2), shell crack +0.0231 frames passed. The onset helper explicitly says its threshold is not evidence of audible onset, visual alignment or final-mux sync; the session's “first audible sample” wording overstates that diagnostic. The spec validator initially rejected combined camera-move naming and an incomplete defect record, then passed after correction.

Proof viewing was by the lead using stills/extracted frames. Separate lead audition of new synthetic effects and the audio loop seam remains **unverified**; the handoff notes roughly 16 dB difference between first/last 100 ms of the bed. Preserve the user's sound acceptance separately from these unperformed checks. The handoff's opening blanket statement that all human feedback remains unverified is stale against the later scoped feedback.

### Skills: installation, discovery, invocation and resource use

“Invoked” below means an actual Skill call with a successful tool result. Reading a SKILL.md or executing a helper is resource use, recorded separately.

| Skill / capability | Native evidence | Remotion evidence |
|---|---|---|
| `motion-design-direction` | Installed/discovered; no Motion Skill call; actual `techniques.mjs` character-reaction and continuous-morph selections | Installed; no Skill call; technique-library read, character-reaction select, check-prompt-spec helper |
| `native-motion-production` | No Skill call; SKILL.md read; renderer helper imports and full production use | No production use observed |
| `audiovisual-review` | Sound invokes Skill; both specialists use FFmpeg/onset/mux helpers | No Skill call; diagnostic reference, onset and mux-sync helpers |
| `audio-post-production` | Sound invokes Skill; standard mixer rebuild and manifest validation | No Skill call; mix.mjs executed; numerical checks passed |
| `audio-generation` | No Skill call; compose-bed helper copied/adapted and executed for 19-second bed | No Skill call; synthesize.mjs via build-r3/r4 and added hen/zoom cues |
| `remotion-production` | Lead inspected reference; no Remotion production pipeline | No Skill call; project.mjs refresh and formal renders r5–r8 |
| `remotion-best-practices` | Newly installed, resolved and invoked once by lead; no reload observed | Already present; Skill result `Launching skill`, 15:07:31 UTC |
| `remotion-markup` | Newly installed; nested reference inspected, no individual Skill call | Already present; Skill result `Launching skill`, 15:07:34 UTC; SVG/JSX composition |
| `remotion-docs`, `remotion-license`, `remotion-render`, `remotion-studio` | Newly installed; some licence/reference inspection; no individual invocation or renderer use | Docs/render/studio present, no invocation observed; separate licence Skill absent from the pinned 12-Skill add-on |
| Other optional Remotion skills | No evaluated production use | Captions/create/interactivity/maps/multimedia/saas/upgrade present at audit; no Skill invocation |
| Remotion Elements | Official catalogue researched; no download or runtime integration observed | No calls/imports observed |

The **Native** user's explicit instruction requested checking/installing necessary Remotion skills, looking at free Elements, and using `/reload-skills` or a new subagent. Following discovery, the lead installed six skills using `npx --yes skills@1.7.6 add remotion-dev/skills -a claude-code -s remotion-best-practices remotion-markup remotion-render remotion-docs remotion-license remotion-studio --copy -y`. Actual installer results and lockfile/directory checks support installation. One successful in-session Skill resolution supports discovery without an observed reload. Firecrawl search/scrape inspected official skills documentation and Elements. Catalogue research does not establish inserting an Element. The final film stayed Native.

The installer version was checked using npm, but the upstream fetch command was not pinned to a reviewed full upstream commit. Computed skill-lock hashes are not that provenance review, and scratch installation is not approval for vendored redistribution. No corresponding installation request, latest-version lookup or Elements use appears in the **Remotion** session. Current Remotion/CLI/bundler/renderer are 4.0.539 and React/ReactDOM 19.0.0; this establishes versions present, not current latest-version status.

### Final artifact identities

Paths are relative to `scratch/motion-hands-on-2026-11-04/`. SHA-256 values below were checked against current files; file hashes differ from normalized timeline fingerprints.

| Lane / artifact | SHA-256 |
|---|---|
| Native `native/media/proofs/character-reaction/render-r3/video.mp4` | `5ad6193b59fbb7b7bf1654c271126c362a4ac9c3558d8127e917009841f9eaae` |
| Native `native/media/native/index.html` | `34c53174266efcd58aa9dbaa5d652cfb4cc9f7662c9c70608a5afb52f2645381` |
| Native `native/media/native/content.json` | `ae6a899e34cf8bca631e20c3d740d3ce331b1669a94a731d0a5d3afce0462ea9` |
| Native `native/media/timeline.json` | `e6c923bdde85faa1de14c03f1a70a6e8494d458f61232f8c15241f0ca190603a` |
| Native `native/media/audio/audio-manifest.r4a.json` | `0c7b924450c4d702d1a2ddf7b89ce1e80369e84f088102deb76ec0a92c54426c` |
| Native `native/media/audio/final-r4a/master.wav` | `97d0ac7d477dd1cf1ba4cc5a9aed3255dd9ec8cc99577935bd14caa2e89c47dc` |
| Remotion `remotion/media/out/chicken-lifecycle-r8-loop.mp4` | `98caf3ed71ba54e43f67308df2efa5a30d625a42d737e7638829a21469809966` |
| Remotion `remotion/media/remotion/Composition.jsx` | `bd71f1adf64b7572f6c50a3be8419e84915af124ae386ae97108305d88c7cf02` |
| Remotion `remotion/media/remotion/motion.mjs` | `c0c6dc6c3528c06a53f7c846213ddaa004710586727c8092b69790aee8e2c11d` |
| Remotion `remotion/media/timeline.json` | `12e4be9c5355c4a865633df05cd0f6ea31ced97923e2c3ec09c3cdc16ed6a617` |
| Remotion `remotion/audio/manifest.json` | `2e88b8c70c269a1696adf8acdc8d3ec5cbf88d3f576c61e2b35ea46e2a0761ac` |
| Remotion `remotion/audio/mix-r4/master.wav` | `8da9a2c404109f84b586f7385e408d96071bacd9b133ea333eea68c1c91c1b0d` |

Native evidence also includes the driver, log, render-evidence.json, mux-sync.json and `diag/` beside the final video. Its canonical revision is `pilot-041-r3a`, fingerprint `sha256:77b76af154d0e7effc40e91c82c2851fa4cc8efb7a98f3504621ee60c6b8289b`. `loop-probe-frame-450.png` is a stale filename; the final driver probes frame 570.

Remotion evidence includes `media/remotion-render-r8.log`, `media/remotion/out-r8/`, `media/specs/mux-sync.r4-r8.json`, the prompt/comparison/visual-handoff specs, `media/proofs/r4/`, `HANDOFF-r4.md` and `audio/QC.r4.md`. The final video hash matches the render/mux records. The licence record remains evaluation-only, `productionAuthorized: false`.

### Follow-up fixes from this evaluation

Keep specialist delegation distinct from inline orchestrator production, distinguish actual Skill invocations from helper use, preserve scoped human feedback, avoid pipeline exit masking, and retain seek determinism/contrast and audio-seam concerns as open evidence. Latest package verification and Elements integration were not established by these sittings. Any new maintainer-run session needs its own scope and authorization; this report does not start one.

### Implemented after the sittings

- Both Motion and lead role lanes now carry accepted project-local setup scope into one named setup owner, verify actual official Skill invocation, distinguish reference-only Native installs, and return nontrivial revisions to Motion/Sound. These are policy instructions with static regression checks; live compliance with the revised instructions is **unverified**.
- New Remotion setup checks the four current npm versions and supports exact 4.0.540; matching existing 4.0.539 projects keep their source, licence record and lockfile. Preflight/scaffold/refresh/render use the project's reviewed version, reject unsupported/mixed versions and detect declaration changes during setup. The helper never upgrades or installs during rendering.
- The new `remotion-production/references/setup-and-elements.md` gives Chris a director's shortlist and include/adapt/skip decisions. Motion reviews selected source, dependencies, terms and timeline fit. No catalog-wide installation, Element copying into this repository, or blanket free/MIT claim is made. The original eight-card technique library remains independent of the Elements catalog.
- Two additional prepared-not-run evaluation prompts cover authorized fresh setup and a locked no-install revision. The [next-action plan](../../plans/044-motion-technique-library-and-hands-on.md#next-action-plan-ordered-by-evidence) orders live workflow proof, Native determinism/contrast, audio seam review, distribution-rights resolution and the narrow [3D proposal](../../plans/045-agency-3d-designer.md).

Current primary-source check (2026-11-04): public npm metadata returned 4.0.540 for `remotion`, `@remotion/cli`, `@remotion/bundler` and `@remotion/renderer`; the updated checker exits 0. [Official upgrading guidance](https://www.remotion.dev/docs/upgrading) requires aligned exact versions. Tagged [539](https://github.com/remotion-dev/remotion/blob/v4.0.539/LICENSE.md) and [540](https://github.com/remotion-dev/remotion/blob/v4.0.540/LICENSE.md) licence files were identical (2822 characters); the [540 release](https://github.com/remotion-dev/remotion/releases/tag/v4.0.540) changes runtime internals, so old rendering evidence alone is insufficient.

The [current official Skills](https://www.remotion.dev/docs/ai/skills) list includes a thirteenth `remotion-license` Skill, while the repository's historical vendored snapshot remains at 12 with its redistribution hold unchanged. [Elements](https://www.remotion.dev/docs/elements) are copied editable components with selected dependencies; [library payloads](https://www.remotion.dev/docs/elements/libraries) and [Studio security](https://www.remotion.dev/docs/studio-protocol/security) distinguish delivery from confirmed installation. These sources support the workflow, not a claim that either evaluated film used an Element.

### Fresh 4.0.540 runtime proof

An isolated automated internal-suitability project at `scratch/remotion-540-smoke-2026-11-04` installed the four exact 4.0.540 packages with React/ReactDOM 19.0.0 and a retained lockfile. Node 24.22.1, npm 10.9.9 and explicit Chrome 156.0.8078.74 ran the actual production helper. Scaffold and render exited 0 after correcting an initial preferences/timebase mismatch; bounded network installation succeeded after sandbox EACCES was resolved by scoped approval. No Claude session, user-project edit, provider job or network-exposed Studio was involved.

Project-local ffprobe exited 0 and decoded **60 frames**, H.264/yuv420p **320×180 at 30fps**, video **2.000 s** with AAC/container **2.005 s**. Output `media/remotion/out/video.mp4` SHA-256 is `b7799737b535fc6534d5a2c92a466c4b6679021b36426717761de52b9f2cf684`; the helper retained three stills and `render-evidence.json`. A Webpack cache snapshot warning did not fail the render. Exact commands and failed-attempt details are in the local `scratch/verification/remotion-540-smoke.md`. This proves the selected runtime renders through the helper; full playback, human creative approval, entitlement and the revised end-to-end Host workflow remain **unverified**.

### Publication verification — 2026-11-04

The final corrected tree passed `npm run typecheck` (exit **0**) followed by `npm test -- --maxWorkers=2` (exit **0**): **235 files passed; 4,888 tests passed, 209 skipped, 5,097 total**, in 1360.37 seconds. Skipped cases are not verified. The affected 12-file run separately passed 338 tests. Logs remain local at `scratch/verification/publish-typecheck.log`, `publish-full-test.log` and `publish-focused.log`. The earlier interrupted run exposed the cross-Skill workflow link defect; the corrected Cline projection tests pass in this full run. No test was weakened to obtain the result.

A read-only preflight against the maintainer's actual Remotion project also exited 0 using the updated helper: it retained **4.0.539**, revision `pilot-041-r4` and fingerprint `sha256:bd475ecd0dc311caa9b1f43ea132ae57be4726aeabcb67f2a3f2337b6b78ee1b`. It did not rewrite source, dependencies, licence or audio. The staged diff and secret-pattern scan were reviewed; scratch media, dependencies and raw transcripts are excluded from the PR. The proposed 3D role is not implemented by this change.


### Follow-up readiness sittings — 2026-11-05

The maintainer ran the prepared cold-setup and locked-revision cases. [Eval 5](2026-11-05-remotion-readiness-eval5.md) confirms delegated current 4.0.540 setup and three official Skill invocations, with a concrete npm ancestor-install defect and missing catalog consultation. [Eval 6](2026-11-05-remotion-readiness-eval6.md) confirms constrained pose-only source, preserved 4.0.539 packages/lock/audio, and an honestly failed mux diagnostic. Its decoded audio and measurement outputs are identical to the original export under the compared method; target/listening review remains necessary. The [readiness handoff amendment](2026-11-04-remotion-readiness-handoff.md#maintainer-readiness-sittings--2026-11-05-audit) and [Plan 046](../../plans/046-post-pilot-motion-slices.md) record fixes, actual verification and remaining live boundaries. No new session was started by the executor.


The final post-audit source passed fresh typecheck and the full suite (actual exits 0/0): 239 files, 4,888 passed tests, 209 skipped, 5,097 total. Watched source remained unchanged across the run; skipped checks and patched live behavior remain unverified. See Plan 046 for the bounded wrapper correction and complete logs.


### Post-fix maintainer session and efficiency review — 2026-11-05

Session `1134a73c-72ee-45e1-9ba7-d373c55b3b7e` extended the readiness exercise into a film at the maintainer's direction. The [saved-record audit](2026-11-05-postfix-session-audit.md) verifies actual Skill loading, project-local FFmpeg setup, render and mux receipts, and matching ancestor package sentinels. The proof timing was explicitly approved; full beat-map/audio-map acceptance was not established by route/tone choices. Final mux-sync exited 0 on its supplied measurements; the craft gate remained at exit 2 and listening remained unverified in the saved record. The user subsequently reported good animation with remaining flaws; this is scoped visual feedback, not blanket approval of every gate.

The reported $24.30 is user-provided, not reconciled to a saved cost-state or invoice. [Plan 047](../../plans/047-motion-production-efficiency.md) proposes proactive VO/SFX/music/captions/Elements planning, honest approval evidence, proportionate rights review and a Markdown used-asset ledger, plus bounded helper and picture-event improvements. These proposals are not implemented by this documentation update. No completed project, Host session or provider job was modified or started.


### Plan 047 implementation checkpoint — 2026-11-05

The lessons-driven improvements are implemented locally in [Plan 047](../../plans/047-motion-production-efficiency.md): proactive complete-treatment recommendations, traceable approvals, bounded private rights checks and Markdown used-asset evidence, compact readiness receipts, offline diagnosis, ESM-only extra dependencies, short/stills-only previews, and a versioned Motion event sidecar for picture-dependent SFX. [ADR 0063](../adr/0063-motion-event-handoff.md) preserves the existing full fingerprint and separates declared event frames from semantic and human review.

The actual isolated installation exited 0; doctor, installed helper help, event capture and validation each exited 0, with nine new/changed installed resources matching source hashes. Changing a synthetic picture source then made event validation exit 2 as expected. This starts no Host and produces no animation/audio. The completed maintainer project remains intact. All four registry latest endpoints and the actual release checker returned aligned 4.0.541; locked 539/540 remain supported. Final full-suite completion is pending, while focused tests and fresh typecheck passed in their recorded scopes.


### Final Plan 047 validation — 2026-11-05

Fresh typecheck and full test exits are both 0, with watched source unchanged:
243 files passed, 4,905 tests passed and 209 skipped (5,114 total). The final
plan047-verified gate ended 2026-11-05T19:30:03.4646706Z. The separate installed
helper and actual 541 SDK preview checks passed; numerical/source results do
not establish human listening, perceived sync, creative acceptance, current
unknown asset rights or live compliance with the revised prompts. Full details
and earlier failed runs are retained in [Plan 047](../../plans/047-motion-production-efficiency.md).

### Subsequent prototype listening acceptance — 2026-11-05

The maintainer explicitly confirmed reviewing the completed post-fix prototype's
voice-over, music/SFX balance and perceived sync: **“Reviewed; acceptable for
this prototype.”** This supersedes the listening-unverified status for that
prototype and scope, with the chat reply as evidence. See the [audit
amendment](2026-11-05-postfix-session-audit.md#subsequent-human-listening-feedback--2026-11-05).
Earlier saved-session findings retain their historical meaning. Commercial
rights, other films' listening reviews, broader visual acceptance and live
compliance with the newly revised prompts are separate.
