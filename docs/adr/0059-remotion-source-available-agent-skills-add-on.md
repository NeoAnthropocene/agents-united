# ADR 0059: Remotion's official Agent Skills are a source-available add-on

## Status

Accepted, 2026-10-29, for the supervised Remotion integration slice. It records licence classification and optional-loading decisions; it is not legal advice and does not establish any user's entitlement.

## Context

The maintainer asked for the official `remotion-dev/skills` repository to be available only when Remotion is selected, with host installation guidance, a maintained package version and an optional Remotion Studio route. The standalone skills repository has no licence file of its own, which previously made it look unlicensed. The maintainer identified the governing [Remotion LICENSE.md](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md) in the parent repository.

That licence is **not MIT**. It is a source-available two-tier licence: individuals, non-profits, for-profit organizations with up to three employees, and noncommercial suitability evaluators may use it free of charge; larger for-profit organizations need a Company License. It permits modification for an eligible custom use but forbids copying or modifying the software to sell, rent, license, relicense or sublicense a Remotion derivative. The repository's MIT licence cannot relicense this content.

The official pack at commit `30d4553ecd46fbc5212fd0ff006ae43af522158b` contains 12 skills at version 4.0.539. The current public npm release for `remotion`, `@remotion/bundler`, `@remotion/renderer` and `@remotion/cli` is also 4.0.539. The official plugins for Claude Code, Codex, Cursor, GitHub Copilot and Kimi Code include Agent Skills but are host-specific alternatives, not additional content to install beside the add-on.

## Decision

1. **Add a `source-available` licence class.** `LicenseRef-Remotion` is recognized as source-available, not permissive, weak-copyleft, share-alike or unknown. Like the retained-licence tiers it requires the exact `LICENSE.md`, a per-skill `NOTICE.md`, a 40-character pinned `metadata.source`, truthful `metadata.license` and README credit. It is never presented as MIT.
2. **Vendor the official pack only as an optional add-on.** `remotion-agent-skills` is a child of `digital-agency`, is not in `full`, and contains the 12 pinned official skills with their upstream content plus licence/notice/metadata. The user must accept the Remotion eligibility terms when installing it. The add-on is not required for Native productions.
3. **Load conditionally.** `remotion-production` and the Motion role load the official pack only when `media/project.json` selects Remotion. The add-on is recommended after route acceptance, not automatically installed by the agency bundle. If an official host plugin already supplies the skills, it replaces the add-on rather than duplicating it.
4. **Guide every planned host.** A host matrix records Claude Code, Codex, Cursor, Antigravity, Cline, GitHub Copilot and Kimi Code paths and selectors, plus the currently implemented repository host targets. Direct upstream installation is an explicit user action; no render or hook may run `npx skills` automatically.
5. **Keep the runtime current.** The pin moves from 4.0.538 to the current 4.0.539. `scripts/check-release.mjs` compares all four runtime packages with the public `latest` versions when explicitly run; it never installs or upgrades automatically. A version change requires re-reading the matching licence and updating the official skill snapshot in the same reviewed change.
6. **Studio is optional, agentic production is the default.** Chris asks once whether the user wants agent-only production or a hands-on Studio preview. If chosen, Motion may start the pinned project-local Studio and treat user edits as source changes requiring proof and final measured helper export. Studio never replaces the proof, audio, licence or encoded-QC gates.
7. **Keep agent skills primary.** The official best-practices/markup/render/docs skills inform authoring. This repository's preflight, canonical timeline/fingerprint, deterministic composition, audio manifest, proof review, helper render and QC remain authoritative.

## Publication review amendment — 2026-10-29

The earlier accepted classification records the implementation intent, not a legal determination.
Pinned package metadata identifies `remotion-dev/remotion/packages/skills` as the source, but the
standalone snapshot has no licence file. Copying the runtime repository's licence does not by
itself prove its scope or our permission to redistribute this content through npm.

**Merge/release hold:** obtain pinned scope/redistribution evidence or explicit upstream
clarification before merging or publishing the vendored add-on. Optional runtime installation does
not exclude it from the npm tarball (`registry` is packaged). This draft PR preserves the review
history and must not be treated as a new sublicence grant. See Plan 041's publication amendment.

## Consequences

The catalogue gains 12 source-available third-party skills, one optional bundle and one new licence class. The add-on is larger than a pointer but preserves exact terms and provenance; it stays out of essentials and `full`, so users who do not choose Remotion carry none of it. Licence eligibility, runtime entitlement and Studio behaviour remain user/host responsibilities. Static tests prove packaging and declarations, not creative output, host-wide invocation or legal entitlement. Other hosts remain unverified until their packages are tested.
