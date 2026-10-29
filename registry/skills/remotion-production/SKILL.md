---
name: remotion-production
description: "Use when producing or repairing approved Remotion projects with editable React compositions and measured exports; trigger phrases: Remotion video, frame-driven React animation, revise a Remotion handoff. Skip footage/audio generation and automatic entitlement claims."
metadata:
  author: agents-united
  version: "1.0.0"
  license: MIT
---

# Remotion Production

## Overview & Purpose
Turn approved copy, brand and timing into editable React motion and a measured MP4. This original source uses the [MIT licence](LICENSE); Remotion runtime eligibility is separate.

## Execution Triggers
Use after Remotion is selected, or to repair its composition/handoff/export. Chris owns route, budget, include/defer/decline and human questions. Relay missing inputs to the Lead; reuse the recorded choice.

## Input/Output Requirements
Require approved destination, duration/loop intent, copy, brand/assets/rights, accessibility and setup budget. `media/project.json` must select Remotion and match `media/timeline.json` fps/dimensions; default to 1920x1080 at 60 fps unless approved otherwise.
Return React source/assets, timeline/preferences, package/lockfile, MP4, stills, required captions, provenance and review evidence. Separate technical acceptance, decoded inspection, full playback and listening.

## Step-by-Step Runbook
1. Confirm scope with Motion, Brand/Copy and Sound using [handoffs](references/handoffs.md). Chris records **agent-only** or optional **hands-on Studio**. External footage is a separate opt-in. Resolve missing copy, rights and timing before rendering.
2. Load [preflight](references/preflight.md) for contracts and separate `media/remotion-license.json`. The [unreviewed starter](assets/license-review.example.json) fails. Production needs actual owner facts; automated review covers only truthful internal noncommercial evaluation. `allowed` never verifies entitlement.
3. Inspect files; preflight, then scaffold only an absent `media/remotion/`. Load [runtime setup](references/runtime.md) for pins, browser and sibling prerequisite. Only when Remotion is selected, load [official add-on guidance](references/official-agent-skills.md) and, if chosen, [optional Studio](references/studio.md). Retain lockfiles/source.
4. Author approved props/JSX/modules. Use [composition guidance](references/composition.md) for frame math, readiness and preview. Preserve helper-owned timeline/fingerprint/audio routing; replace starter copy and inspect layouts.
5. Freeze timing and obtain Sound's matching revision/fingerprint, cues, captions and actual measured master. Validate against the saved loudness preset. Rendering consumes the full approved mix once from frame zero; it does not synthesize, mix or measure audio.
6. For an approved change, use [revisions](references/revisions.md): `refresh --approved-revision` preserves custom source, dependencies and outputs and archives old handoff JSON. Caller acknowledgment does not prove human approval. Review new scene copy and changed JSX meaning.
7. Render to a new directory; follow [export review](references/review.md). Inspect actual codec/range, dimensions/fps, count/duration and AAC alignment; retain commands/exits/artifacts. Settings and three stills do not establish creative acceptance. [Rendering modes](references/rendering-modes.md) explains why this pipeline renders through the CLI: client-side rendering has no render quota either, but it emulates CSS onto a canvas and drops `z-index`, `backdrop-filter` and non-linear gradients.
8. Hand the Lead source, export, evidence and named open items. Verify the actual installed companion resources and host loading before claiming a runnable workflow; name missing bindings.

## Code & Config Exemplars
Use resolved absolute roots. Claude Code supplies `${CLAUDE_SKILL_DIR}`; other hosts replace it with the installed Skill root. The helper is [scripts/project.mjs](scripts/project.mjs).
```text
node "${CLAUDE_SKILL_DIR}/scripts/project.mjs" preflight --project "<project>" --purpose evaluation
node "<skill-root>/scripts/project.mjs" scaffold --project "<project>" --purpose evaluation
node "<skill-root>/scripts/project.mjs" render --project "<project>" --purpose evaluation --browser "<browser>"
node "${CLAUDE_SKILL_DIR}/scripts/check-release.mjs"
```
Add `--audio-manifest "audio/manifest.json"` when cues/audio exist. [The worked example](examples/two-scenes.md) covers 120 frames, a revision and speech. Scaffold copies `templates/index.jsx`, `templates/Root.jsx`, `templates/Composition.jsx` and `templates/frame-state.mjs`; inspect these when replacing composition structure.

## Edge Cases & Error Recovery
Stale snapshots, missing audio, changed pins or actual composition metadata mismatches stop export. Obtain a new handoff and refresh explicitly; keep failed outputs and choose a fresh output directory. Preserve source when setup or licensing facts are missing.
Anti-patterns: wall clocks, random/incremental animation, ungated fonts/images, changing copy to fit without approval, relabeling stale manifests, weakening metadata checks, installing both renderers automatically, or treating evaluation acceptance as production permission.
Without a shell use the frame formulas and relay execution to production. Export, added async media/fonts and unperformed review levels remain unverified.

## Verification Checklist
- Approved renderer, scope, copy/brand, local assets/rights and purpose-specific licence declaration are recorded.
- Current canonical timeline, preferences, snapshot, composition metadata and Sound/caption handoff agree; repeat frames and requested loop seam were checked.
- Runtime pins/lockfile, source, history, prior outputs and evidence survive an acknowledged revision.
- Actual encoded properties and muxed audio were inspected; full playback, listening and creative approval have separate reviewer records or say unverified.
- Deliverable includes editable source and runtime/asset licences; sibling review and host loading are verified before runnable claims.
- Maintainer `evals/` stays outside installed resources and resource packing.
