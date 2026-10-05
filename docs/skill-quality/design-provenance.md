# Provenance of the design skills with a `not-found` record

Plan 035, slice S4. Written 2026-10-04. Procedure: `docs/skill-intake.md` ("Looking for an upstream you do not know about") and decision D5 of Plan 035: scan the named upstream repositories read-only, record what the scan shows, and **keep** the skill with its declared licence unless the scan shows it is a copy of something under a different licence. No skill was rewritten, renamed or relicensed here, and no `metadata.source` was changed.

## What was run

```text
npm run hostlib:candidates -- --repo nextlevelbuilder/ui-ux-pro-max-skill   # pinned 477bcb28c981
npm run hostlib:candidates -- --repo mrstev3n/balise-skills                 # pinned f596a61fa8f4
```

Both scans are read-only (blobless clone at depth 1, every skill folder audited in quarantine with the ingest gate). The reports are committed beside the other candidate scans: `host-library/_upstream/candidates/nextlevelbuilder__ui-ux-pro-max-skill.json` and `mrstev3n__balise-skills.json`. For the two skills whose names differ from their upstream folder (`brand-identity` from `brand`, `ux-writing` from `balise-ux-writing`, renamed in Plan 028) the scan cannot match by name, so the overlap was computed separately: lines of four or more words, lower-cased and stripped of punctuation, upstream `SKILL.md` at the pinned commit against ours.

## Results

| Skill | Upstream found | Licence of the upstream repository | Text overlap with ours | Verdict |
|---|---|---|---|---|
| `banner-design` | `nextlevelbuilder/ui-ux-pro-max-skill` at `.claude/skills/banner-design`, pinned `477bcb28c981` | MIT (`LICENSE`, "Copyright (c) 2024 Next Level Builder") | 11% of the upstream lines appear in ours (132 local lines, 101 upstream) | **Independent writing on the same topic.** Keep. The declared `metadata.source` (a registry page) does not hold the text; the repository does. |
| `brand-identity` | same repository, `.claude/skills/brand`, same pin | MIT | 2% of the upstream lines (46) appear in ours (135) | **Independent writing.** Keep. The upstream ships five scripts (the scan flags `dynamic-eval` and `credential-access` as needs-review in `extract-colors.cjs` and `sync-brand-to-tokens.cjs`); ours already gates the one that writes files behind a confirmation (Plan 028). |
| `ux-writing` | `mrstev3n/balise-skills` at `skills/balise-ux-writing`, pinned `f596a61fa8f4` | Apache-2.0 (`LICENSE`) | 3% of the upstream lines (142) appear in ours (128) | **Independent writing.** Keep. The scan passes the upstream (0 non-pass of 22 skills). |
| `stitch-design-taste` | none: the declared source is `labs.google/stitch`, a product page, not a repository | not verifiable | not computable | **Unresolved, keep.** Declared licence MIT recorded; no upstream text could be compared. |
| `generative-ui` | none: the declared source is `antigravity.google`, a product site | not verifiable | not computable | **Unresolved, keep.** Declared licence Apache-2.0 recorded. |
| `modern-web-guidance` | `ChromeDevTools/chrome-devtools-mcp` at the recorded pin has no folder of that name (the earlier recovery found 7 skill folders, none matching) | Apache-2.0 for the repository | not computable | **Unresolved, keep.** It may have been renamed or removed upstream; look at upstream history before any change. |

## What this means

1. **Three of the six are not copies.** Overlap of 2 to 11 percent means the catalog text is its own writing (or a heavy rewrite of an older upstream revision that the scan cannot see). The intake document says a name collision with a low overlap is "an adoption decision (replace, rename or keep both), not a provenance fix"; the decision taken (D5) is to keep.
2. **Their metadata overstates.** `metadata.source` names a registry listing and `metadata.license` names the upstream's licence, for text that is mostly not the upstream's. Two consistent ways to correct it exist, and both need the maintainer because the second changes a licence declaration (ADR 0024: a new tier or licence needs the owner's approval): (a) leave as is, and treat the credit in README as acknowledgement of the idea; (b) drop `metadata.source` from the three skills, make them original MIT work like the rest, and keep the README credit as inspiration. **Recommended: (b), in one small PR after the maintainer agrees.**
3. **Three stay unresolved** (`stitch-design-taste`, `generative-ui`, `modern-web-guidance`). Nothing can be verified from a product page. If the maintainer has the original export or download, a licence file beside it would settle them; otherwise they are candidates for (b) too, or for replacement by the upstream skills of Google's design tooling if one is published under a licence this repository accepts.
4. **What was not done:** no file of the upstream repositories was copied into the repository, the two upstream `SKILL.md` files fetched to compute overlap stayed in the session scratchpad outside the repository, and the scripts of the upstream `brand` skill were not run.
