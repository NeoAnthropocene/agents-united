# Worked example: a canvas for a fictional pet-sitting product

The request: "Scratch exercise, no real client. Make the PetPal paid-social set as a Claude Design canvas that I can review and edit in the browser: one artboard each for the 4:5 feed ad (1080x1350), the 9:16 story (1080x1920) and the 1.91:1 link ad (1200x628). Use `docs/pilot/design-tokens.json` and the copy in `docs/pilot/hero.ts`. Keep it private. Give me the link, and say what you did not check."

## What she does, in order
1. The user asked for a Claude Design canvas: go on. She loads `ad-creative-design` (the sizes and safe zones), reads the tokens and the copy.
2. `Artifact` quickstart with `intent: design` and `design_systems: false` (the user said to use no other design system), then the type's own instructions.
3. She writes `canvas.json` and three boards under a scratch folder, and checks them against the rules before publishing: the feed's label is above the bottom 10 percent (y 1215), the story's text clear of its top and bottom 250 px, only the six token colours, the copy word for word.
4. One publish call with the four files.
5. `list` the files, `read` each of the four, compare.

## The read-back
The sizes are illustrative; the columns are the point: what the listing says, what she wrote, what she checked.

| File | Bytes | Wrote | Checked |
|---|---|---|---|
| `project/canvas.json` | 909 | 909 | three boards at 1080x1350, 1080x1920, 1200x628; `designSystems` empty |
| `project/Main.dc.html` | 2203 | 2203 | six token colours; copy equal to `hero.ts`; the label ends at y 1186, above the caption zone |
| `project/Story.dc.html` | 2211 | 2211 | text between y 257 and y 1552 |
| `project/LinkAd.dc.html` | 2058 | 2058 | nothing outside 1200x628 |

The listing holds the type's 16 files and these four: 20 files.

## The report
- Published: https://claude.ai/artifact/<id>, a Design artifact, version 2. Private; sharing untouched. Share it from the page's Share menu if others should see it.
- Checked: the sizes, the colours (6 of 6 are tokens), the copy, the zones by arithmetic from the layout numbers, the contrast by formula (15.47, 5.48 and 7.43 to 1).
- **Not checked**: it is not rendered, so the wrapping of the headline at 96 px on the link ad is an estimate; the platforms' current specifications; how the editor shows it.
- Claims for Defne: "4.9 average rating", "12,000 stays", "insured up to $1M" (fictional, and a note on the canvas says not to run them).
- Open items for the lead: the render ask (open the link and look at the three boards).

## What the first sessions did instead
No skill loaded, so the feed's label sat at y 1217 to 1258, inside the caption zone; nothing read back; and a canvas published four times. The read-back above is what would have caught the first two.
