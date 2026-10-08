# Hue families: eleven-step starting scales

Fifteen hue anchors, each built by `scripts/palette.mjs` with the curve of [tonal-scales.md](tonal-scales.md) at 0.9 relative saturation (the two neutrals at 0.1). The number after `h` is the OKLCH hue angle.

They are starting points, not a brand. Take the family nearest your seed by hue, use its steps as a first palette and check every pair that will meet. Where the brand has a seed of its own, build its scale by the method (or ask the lead to run the script) and keep the seed as the brand colour. Regenerate this table with `node ${CLAUDE_SKILL_DIR}/scripts/palette.mjs --families`; a test fails if the table and the script disagree.

| Family | 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| red (h 27) | #FAF3F2 | #F5E3E1 | #EDCBC7 | #EBA79E | #EF7368 | #F12E2F | #C82525 | #9E2220 | #75201C | #4E1B17 | #2D110E |
| orange (h 55) | #FAF4F0 | #F5E4DA | #EDCDB9 | #EAAA7F | #E0843E | #C46C23 | #A3591B | #81471A | #5F3719 | #402715 | #25170E |
| amber (h 80) | #FAF4EB | #F4E6CE | #ECD0A1 | #E0B364 | #C5963F | #AA7D24 | #8D671C | #70521A | #533F19 | #382C15 | #20190E |
| yellow (h 100) | #FAF6DE | #F4EAAC | #E3D687 | #CBBC64 | #B0A03F | #978724 | #7D6F1C | #63591A | #4A4319 | #322E15 | #1D1B0E |
| lime (h 125) | #EFFADF | #D6F6A0 | #C2E388 | #A7C965 | #8AAD40 | #739424 | #5E7A1C | #4B611B | #39491A | #283216 | #171D0E |
| green (h 150) | #EAFAED | #CAF5D1 | #90EDA5 | #6DD587 | #46B968 | #299F51 | #218342 | #1F6836 | #1D4E2A | #18351F | #0F1F13 |
| teal (h 185) | #E7FAF7 | #BEF5ED | #91E7DB | #6DCEC2 | #46B3A6 | #29998E | #217F75 | #1F655D | #1D4B46 | #183330 | #0F1E1C |
| cyan (h 215) | #EDF7FA | #D3EDF4 | #A9DFEC | #6CCAE0 | #46AEC5 | #2995AB | #207B8E | #1E6270 | #1D4953 | #183239 | #0F1D20 |
| blue (h 260) | #F2F5FA | #E1E8F4 | #C7D5EC | #A0BCE9 | #6F9EED | #3C81F3 | #1A66DF | #1852AF | #183F80 | #142D55 | #0D1A30 |
| indigo (h 280) | #F4F5FA | #E5E7F4 | #CFD2EC | #B1B6E9 | #8F94ED | #7472F3 | #5E4CF1 | #4B2CD6 | #38289B | #262066 | #15153A |
| violet (h 300) | #F6F4FA | #EAE5F4 | #D8CFEC | #C3AFE9 | #AD86ED | #9D5BF3 | #8B29EA | #6D26B8 | #512486 | #371D59 | #1F1232 |
| magenta (h 330) | #FAF2F9 | #F5E1F2 | #EDC6E8 | #EB9AE3 | #EF4EE7 | #D32DCC | #AF24AA | #8B2186 | #672063 | #451A42 | #281126 |
| pink (h 355) | #FAF3F5 | #F5E2E8 | #EDC9D6 | #EBA2BD | #EF68A4 | #E62C8D | #BF2374 | #97215C | #701F45 | #4B1A30 | #2B101C |
| warm neutral (h 60) | #F6F5F4 | #E9E7E6 | #D7D3D1 | #C0B9B4 | #A69C95 | #8D847E | #746D67 | #5D5752 | #45413E | #302D2B | #1C1A19 |
| cool neutral (h 250) | #F5F5F6 | #E7E8E9 | #D2D4D7 | #B7BBC0 | #989FA7 | #7E8791 | #687077 | #53595F | #3F4347 | #2C2E31 | #191B1C |
