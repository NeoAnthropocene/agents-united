# Brand audit fixtures (Plan 036 S16)

Never installed. They exercise `registry/skills/brand-consistency-audit/scripts/audit-assets.mjs` against the PetPal kit of `tests/fixtures/designer/` (the tokens in `design-tokens.json`, the copy in `hero.ts`; PetPal is fictional and every value is invented).

- `flawed-set/` holds three small assets with planted drifts, so that the expected findings are known: `feed.svg` has a fill that is no token (`#C2410C`), a first font that is no token's (`Impact`) and a label that is not the copy's (`Book now!`); `story.html` has two colours that are no token's (`#333`, `#FFD1A9`), a named colour (`red`), and three values that are the tokens' written another way (an `rgb()` of the sand, a translucent cocoa, a link target `#add` that is no colour at all); `brand.css` is on brand (lower-case hex, a quoted first font).
- `clean-set/` is one on-brand stylesheet: a three-digit white, a `hsl()` of the cream, a translucent cocoa, `transparent`.

`worked-example.md` of the skill tells the findings of `flawed-set/` as a report; `tests/brand-consistency-audit-scripts.test.ts` recomputes them.
