# Roles and harmony

## The roles

| Role | Job | How many | Rule |
|---|---|---|---|
| Ground | The surface everything sits on | 1 or 2 (base, raised) | Light or dark, tinted toward the brand hue; not pure white or pure black |
| Text | Body and headings | 1 | The darkest neutral (the lightest on a dark ground); 7 to 1 or more where it can |
| Muted text | Captions, hints, metadata | 1 | Still 4.5 to 1 on every ground it meets; never on the brand colour |
| Brand | What makes it recognisable: marks, headings, large fills | 1, plus its scale | Never altered to pass a test; text uses a darker step |
| Accent | The call to action, the one thing to look at | 1 | Used for nothing else; 3 to 1 or more against the ground around it |
| Semantic | Success, warning, error, information | 3 or 4 | Each with an icon or a word; none close in hue and lightness to the brand or the accent |
| Overlay | Scrims over photos, modal backdrops | 1 | A dark or ground-tinted colour at a stated opacity |

An ad needs about six colours (ground, text, muted text, brand, accent, one raised ground). An interface adds the semantic set and the overlay and reaches about ten. A colour with no row in this table is decoration: name its job or cut it. Tints and shades of one hue count once.

## Harmony: choose by intent

Offsets are OKLCH degrees from the brand hue. With a shell, `scripts/palette.mjs <seed> --harmony <scheme>` prints the hexes.

| Scheme | Offsets | Effect | Use when |
|---|---|---|---|
| Monochrome | 0 (the scale) | Calm, unified, safe | The brand is the message: health, finance, premium |
| Analogous | -30, +30 | Harmonious, low tension | A mood or a story; the accent comes from lightness, not hue |
| Complementary | +180 | Maximum energy | One loud accent on a quiet brand; keep the accent small |
| Split-complementary | +150, +210 | Strong accent without the vibration | The accent must stand out and still sit well beside the brand |
| Triadic | +120, +240 | Playful, busy | Children, games, events; mute two of the three |
| Tetradic | +90, +180, +270 | Rich, hard to balance | Illustration and data, not an ad's colour plan |

Rules that hold in every scheme:

- **60 ground, 30 brand, 10 accent.** Share by area, not by number of swatches. The accent is the smallest and the loudest.
- **Differ by lightness first, hue second.** Look at the design in grey: if the headline, the mark and the call to action do not separate, hue is doing a job that lightness should do, and about one man in twelve cannot rely on hue for red against green.
- **High chroma against high chroma vibrates**, most of all complements at the same lightness: put a neutral between them or lower the chroma of one.
- **One saturated accent per view.** A second one competes with the call to action.

## Temperature and meaning, with the caveat

| Direction | Common reading | Watch for |
|---|---|---|
| Warm (red, orange, amber) | Energy, appetite, urgency, friendliness | Red also means error and danger in an interface |
| Cool (blue, teal, green) | Calm, trust, health, growth | Blue is the default of finance and software, so it distinguishes little; green means success |
| Yellow | Optimism, caution | White text on yellow fails; yellow carries dark text |
| Purple, magenta | Creativity, luxury | A purple glow on dark is the cliché the agency's design rule bans unless the brief asks for it |
| Neutral (black, white, grey) | Premium, restraint, clarity | Cold grey beside a warm brand looks dirty: tint the neutrals to the brand |

These readings vary by culture, category and audience (white marks mourning in some places, red means luck in others). Treat them as hypotheses to check with the audience; do not state a psychological effect as a fact in a brief.

## What an ad needs

- The call to action is the one place the accent appears. It meets 3 to 1 against the ground around it, and its label meets 4.5 to 1 against it.
- The brand colour owns the first third of the frame: the eye reads colour before words.
- Squint test: blur the design or view it at thumbnail size. The headline, the mark and the button must still separate.
- The feed adds its own interface colours around an ad. A brand ground close to the feed's ground vanishes: give the ad an edge (a tinted ground or a border).
- A hero photograph sets the palette's temperature. Sample two or three colours from it, snap them to the tokens, and add no hue the photograph does not hold.
