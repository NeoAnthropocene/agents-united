# Remotion readiness evaluations — prepared, not run

The disposable kits under `scratch/remotion-readiness-evals-2026-11-04/{eval5,eval6}` are for Plan 044 Remotion production evals 5 and 6. Preparation runs only the built local Agents United CLI to install `digital-agency` into each new project. It launches no Host, provider, browser or renderer and performs no dependency installation or network lookup. The source accepted project is read only. Neither kit supplies new human approval, entitlement, source rights or paid-provider authorization.

- **Eval 5:** cold project with a 15-second 1080p30 internal noncommercial suitability-evaluation brief and original procedural artwork, no renderer runtime/package or official Skills added by preparation. The brief requests scoped project-local setup and supplies creative direction, not human visual approval or entitlement. Follow licence checks and resolve any conflicting actual facts.
- **Eval 6:** private snapshot of the accepted Remotion source, project preferences, timeline, matching audio and locked dependencies, with local runtimes copied while skipping symlinks and common credential filenames. Filename filtering cannot identify arbitrary secrets; inspect source before sharing a kit. `source-sha256.json` inventories copied non-runtime source, not creative approval. Historical rendered output directories are excluded. Copying a runtime is not evidence that every command or codec works; see verification below. The explicit no-install constraint controls this exercise.

The evaluator should inspect actual Host records for owner delegation, discovered and successfully invoked Skills, scoped setup, locked package preservation, source changes and proof; do not treat a file read or a model's assertion as invocation. Threshold onset is not audible onset or perceived-sync approval. No execution or new creative review has occurred here.

Reproduce with Node 24 and a built CLI, choosing a fresh destination:

```powershell
node scripts/prepare-remotion-readiness-evals.mjs --source scratch/motion-hands-on-2026-11-04/remotion --destination scratch/remotion-readiness-evals-2026-11-04 --cli dist/cli.js
```

The destination is exclusive and overlap is refused. If preparation fails after creating it, inspect and retain or deliberately remove that disposable directory before choosing a fresh path. The maintainer may start an interactive session themselves from either kit, for example:

```powershell
Set-Location 'C:\Users\altay\.codex\worktrees\11f3\agents-united\scratch\remotion-readiness-evals-2026-11-04\eval5'
claude --model sonnet --effort medium --agent orchestrator-digital-agency
```

This command spends the maintainer's Claude account; account, cost, quota headroom and spending ceiling must be established before launch. Give the Host `BRIEF.md`, and capture the session ID and actual record directory for the repository live-test protocol. For eval 6 select its directory instead; no install is authorized there. Preparation and the command example do not start a session.

## Local verification

The fake-CLI fixture regression failed before implementation and passed after it (1 test, exit 0). The real preparation command exited 0 and reported both evaluation IDs and a copied Remotion runtime package. Both installed agent directories contain `orchestrator-digital-agency.md`; eval 5 has no `media/remotion` directory. A subsequent SHA-256 comparison checked all 98 inventoried files against both source and copy, with zero mismatches (exit 0). This does not inventory runtime files or prove no changes occurred before the baseline.

The initial repository-root CLI probe exited 1 with a `zod` resolution warning. Running the same `node node_modules/@remotion/cli/remotion-cli.js versions` command from each project's own `media/remotion` directory exited 0 for both original and copy: Remotion packages 4.0.539 and zod 4.5.4 matched. The repository helper `registry/skills/remotion-production/scripts/project.mjs preflight`, with the absolute eval 6 project path, `--purpose evaluation --audio-manifest audio/manifest.json`, exited 0: evaluation allowed, r4 fingerprint matched, `entitlementVerified: false`, `productionAuthorized: false`, `mediaDecoded: false`, `renderVerified: false`. These checks establish local version reading and preflight only, not a successful render or entitlement.

The existing eval 6 kit was created before the updated filename filter. A recursive local scan found no links, credential filenames, or exact secret/token/password filenames covered by that filter. Two Babel `token-map.js` files are ordinary package code and were retained; a regression now prevents filtering those names from future runtime copies. A filename scan cannot establish that arbitrary file contents contain no secrets. Actual Host discovery, invocation, creative proof, listening and production eligibility remain **unverified**.


## Frozen-source refresh

After final source freeze, the local CLI refreshed only the managed agency resources in each disposable kit (exit 0 each). Both installed official-Skills guides exactly match the current upstream-only guide, and the installed audio/Remotion production versions are 1.1.0/1.2.0. All 98 eval 6 source/audio/package/lock baseline hashes remained unchanged after this refresh. The accepted source project was not refreshed or edited.

For the second sitting, use:

```powershell
Set-Location 'C:\Users\altay\.codex\worktrees\11f3\agents-united\scratch\remotion-readiness-evals-2026-11-04\eval6'
claude --model sonnet --effort medium --agent orchestrator-digital-agency
```

Supply BRIEF.md in each sitting. Return both session IDs and the actual project paths if changed; inspect the encoded Host record directory before running hostlib:session. The evaluator must read actual tool results and resulting files, not the model summary alone.


## Maintainer readiness sittings — 2026-11-05 audit

The maintainer supplied eval 5 e4a302c3-c370-4cbf-9645-e719213fd464 and eval 6 02324d88-599a-4039-b1d1-39f2d422c772. Saved Claude 2.1.318 records show genuine Motion delegation in both. Eval5 checked and installed the then-current four 4.0.540 runtime packages and successfully invoked three official upstream Skills. Eval6 preserved locked 4.0.539 and all 98 inventoried files except its intended final-pose Composition.jsx edit. See the [eval 5 evidence](2026-11-05-remotion-readiness-eval5.md) and [eval 6 evidence](2026-11-05-remotion-readiness-eval6.md).

Complete readiness is not proven: eval 5 did not establish current Elements catalog consultation and its old FFmpeg helper allowed npm to walk to the repository ancestor. The worker restored tracked root package files, but ignored dependency residue and preservation of unknown concurrent edits remain unverified; this audit does not delete or reset them. Eval6 honestly reported a failed mux check. Original and revised exports decode to identical mono PCM under the same FFmpeg command, and the same custom measurement repeats the same five failures on both. Review target definitions and listening before proposing any audio change; do not label this a pose-induced audio regression.

The two session cost-state totals are 10.1486 and 1.7833 USD, combined 11.9319 USD notional (not a bill). The maintainer's rounded figures total 11.93 USD. Wall durations include elapsed gaps and are not API runtime. No new Host session or paid media job was started for this audit.

Source corrections now constrain project-local npm to an explicit prefix, disable global/workspace selection, initialize only an absent private manifest with exclusive creation, avoid the shell and check confined binary output. A permanent offline npm regression preserves an ancestor workspace and child file; actual FFmpeg download/capabilities remain unverified. Readiness wording now requires Chris to read the actual setup handback, traceable catalog consultation even when selecting no Elements, and the router's applicable reference. These authored corrections need a new maintainer observation before claiming live compliance. The current source versions are audiovisual-review 1.1.0 and remotion-production 1.3.0; the supplied projects remain the historical tested installations and were not refreshed.


The subsequent stereo comparison also produced byte-identical samples in both channels under the same decode (see eval 6 report). Do not infer encoded AAC packet identity or human perceived sync from this result. Future behavioral rechecks can be readiness-only: inspect the catalog, complete confined setup and return the actual setup receipt; no render or new audio generation is necessary to exercise those fixes. A new maintainer sitting still needs its own approved account/quota/spending scope.


The final source corrections passed fresh typecheck and full tests (exits 0/0, 239 files, 4,888 passed, 209 skipped; watched source unchanged). This validates the source fixes, not a new maintainer observation. Existing completed projects retain their tested helper versions. Any future recheck should use a fresh installation of the corrected source, preserving these evidence projects.
