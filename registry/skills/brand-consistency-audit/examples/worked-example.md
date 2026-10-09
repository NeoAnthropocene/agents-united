# Worked example: auditing a three-file set

PetPal is a fictional pet-care brand (the Plan 036 kit, every value invented). The set under audit has three files: `feed.svg` (the 4:5 feed ad), `story.html` (the 9:16 story as a page) and `brand.css` (the shared stylesheet). The source of truth is the tokens file and the approved copy file `hero.ts`; there are no logo or imagery rules, so those dimensions are "not stated".

## 1. The source of truth

| Dimension | Stated in | State |
|---|---|---|
| Colour | Tokens: cocoa 900 `#2B1D14` and 600 `#6B4B35`, clay 600 `#B5451B`, cream 50 `#FFF8F0`, sand 300 `#F3D9B1`, white | stated |
| Type | Tokens: one family, Helvetica, Arial, sans-serif; sizes 96, 36 and 28 px for 1080 px canvases | stated |
| Copy | `hero.ts`: headline, subhead, proof line, label | stated |
| Logo, imagery, layout | nothing | not stated |

## 2. The inventory and the scan

Three files, listed: `brand.css`, `feed.svg`, `story.html`. With a shell, `node audit-assets.mjs design-tokens.json set --copy hero.ts` read 16 colours, 5 fonts and 6 strings and found six drifts. It also accepted five values that are the tokens written another way: a lower-case `#b5451b`, `rgb(243, 217, 177)` (the sand), a translucent `rgba(43, 29, 20, 0.6)` (the cocoa, so its contrast is measured on the composite), a quoted first font, and a link target `href="#add"` that is no colour.

| # | Where | Dimension | Found | Rule, and where it is stated | Severity | Owner | Fix |
|---|---|---|---|---|---|---|---|
| 1 | feed.svg:3 | colour | `#C2410C` | the panel fill is no token; nearest clay 600 `#B5451B` (tokens) | major | Jamileh | use clay 600, or ask for a token |
| 2 | feed.svg:4 | type | `Impact` | the headline's first font is no token's; the tokens' first font is Helvetica (tokens) | major | Jamileh | set Helvetica |
| 3 | story.html:4 | colour | `#333333` (written `#333`) | the headline colour is no token; nearest cocoa 900 `#2B1D14` (tokens) | major | Deniz | use `text.default` |
| 4 | story.html:5 | colour | `#FFD1A9` | a gradient stop that is no token; nearest sand 300 `#F3D9B1`; the tokens define no gradient (tokens) | major | Jamileh | use sand 300, or ask whether the brand has a gradient |
| 5 | feed.svg:6 | copy | `Book now!` | the label is `Book now` in the approved copy (`hero.ts`); only the punctuation differs | minor | Kaan | restore `Book now` |
| 6 | story.html:5 | colour | `#FF0000` (written `red`) | a 1 px border in a named colour that is no token (tokens) | minor | Deniz | use cocoa 600 or remove the border |

## 3. What the scan cannot see

Looked at by eye: `feed.svg` has `viewBox="0 0 1080 1350"`, the 4:5 feed size, and its lowest text (the label, baseline y 1100) sits above the zone that starts at y 1215, so the layout of the feed is checked, none. There is no logo and no raster image in the set: logo and imagery are "not stated, none present". Not checked: how the files render, the story's rendering at 1080 x 1920, any value a script builds at run time.

## 4. The report, in counts

Assets checked: 3 (`brand.css`, `feed.svg`, `story.html`). Scanned: 16 colours, 5 fonts, 6 strings. Findings: 6 (major 4, minor 2); by dimension: colour 4, type 1, copy 1; logo, imagery and layout: not stated or checked, none. `brand.css`: checked, none. Hand-offs: the label to Kaan; whether the brand has a gradient to `brand-identity`; the contrast of text over the translucent cocoa to `color-theory` and Emre when text sits on it. Nothing was edited.
