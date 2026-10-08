I wrote the three PetPal banners and re-read each file after writing. I haven't rendered them, so the layouts come from my own arithmetic on character widths and positions, and I haven't checked them in a browser.

Each banner uses the hero.ts copy word for word: "Sitters you can trust", the subhead and "Book now". There's no photography, so the visual is a paw mark from SVG shapes on a sand panel, plus a small "PetPal" text wordmark. No logo file was supplied, so the wordmark is a placeholder.

The CTA fill is `color.cta.primary` (#B5451B) with white text. Headlines are `color.text.default`, subheads `color.text.muted`, and the background is `color.surface.base`. I left the proof line ("4.9 average rating, 12,000 stays") out to keep one message per banner.

| File | Size | Safe zone (80%) |
|---|---|---|
| `petpal_trust_static_300x250_v1.svg` | 300×250 | x30–270, y25–225 |
| `petpal_trust_static_728x90_v1.svg` | 728×90 | x73–655, y9–81 |
| `petpal_trust_static_160x600_v1.svg` | 160×600 | x16–144, y60–540 |

All three are in `docs/pilot/creative/`. The file names follow the skill's `<campaign>_<angle>_<format>_<size>_v<n>` convention.

The SVGs are the files listed above; I haven't pasted their code into this message, because it would only repeat what's on disk. Each file is a single `viewBox` block at its own size, with the safe-zone note and the token for each colour in its comments.

**Contrast** (my own arithmetic, not a tool run):

| Pair | Ratio | Needed |
|---|---|---|
| Headline on cream | about 15.5:1 | 3:1 |
| Subhead on cream | about 7.4:1 | 4.5:1 |
| "PetPal" wordmark (clay) on cream | about 5.2:1 | 4.5:1 |
| White CTA label on clay | about 5.5:1 | 4.5:1 |
| Paw mark on sand (160×600 only) | about 4.0:1 | 3:1 |

**Deviations and risks**
- **Type sizes:** The 96/36/28 px type scale is defined for 1080-px canvases, so I scaled it down for these small sizes. Headlines are 24–30 px and subheads 12–13 px, which is below the skill's 24 px guideline for 1080-wide designs. The 12 px subhead in 728×90 and 160×600 is the weakest point for legibility. If it fails in review, shorten the line rather than shrink the type.
- **Fonts:** Text widths assume Helvetica or Arial. A fallback font could push the 728×90 subhead toward the CTA, which has about 45 px of slack.
- **Platform sizes:** I took the three sizes from the brief and haven't checked them against any platform's current specification. Verify them before export.
- **Claims:** "Insured up to $1M" and "background-checked" are fictional, unsubstantiated claims from hero.ts. In a real run they would go to Defne for review before launch.

**Open items**
- None are blocking. If you want a variant round, hero.ts has two more hooks ("Your dog, happy at home" and "12,000 stays, 4.9 stars"). They'd change only the headline, so a result would have one explanation.
- I didn't mark any task completed: I had no task list in this brief.
- Peer messages received: none.
