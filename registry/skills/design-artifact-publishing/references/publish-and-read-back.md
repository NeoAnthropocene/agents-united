# Publish and read back

## The calls, in order
1. Load the skills that hold the rules (`ad-creative-design`, `design-system-tokens`, `brand-identity` as the work needs). Read the tokens file and the copy file.
2. `Artifact` `quickstart` (`intent: design`; `other` for a design system). Pick the type and read what the result says.
3. Write every file under a scratch folder: for a canvas `project/canvas.json` and the boards, for a design system `project/README.md`, `project/tokens.json`, `project/design-system.json` and the cover.
4. Check the files against the table below, and fix them.
5. `Artifact` `publish` with the type's `type_url` and a title (new) or with the `url` (update), all files in one call.
6. `Artifact` `list` with scope `files`, then `read` each file you wrote.
7. Compare, count, report.

## What to compare in the read-back
| Check | How |
|---|---|
| Files | the listing holds the type's files and every file you wrote, and nothing else of yours |
| Sizes | the byte count of each file equals the number of characters you wrote |
| Boards | `canvas.json` lists each board at the size the brief names, and no design system but the supplied one |
| Colours | every hex value in your files is a token's |
| Copy | every line is the copy file's, word for word; figures and claims are on your list for Defne |
| Tokens | no `$value` map; names valid and unique; aliases resolve; the counts equal the source's |
| Contrast | recompute each ratio you state: 4.5 to 1 for body text, 3 to 1 for large text |
| Zones | feed: no text in the bottom 10 percent; story: none in the top and bottom 250 px; checked from your own layout numbers, since you cannot render |

## The report
- The link, the type and the version. "Private; sharing untouched."
- The files published, counted: how many, which.
- The checks that ran, with the numbers; the checks that did not: the render, the platform specs, how the editor shows it. Every count you give is a count, not an estimate.
- The claims for Defne; what you marked as inferred; the placeholder time, if you wrote one.
- Open items for the lead, the render ask first: you cannot look at the page.
