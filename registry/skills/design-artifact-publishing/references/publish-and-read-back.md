# Publish and read back

## The calls for Design and Slides, in order
Design and Slides are files published under the page, in one call. Design System, Docs, Sheets, Whiteboard and Data are not published this way: see the reference for the kind. A Design System has its own sequence (the files in the project, the go-ahead, the empty page, the files with the index last, the read-back).
1. Load the skills that hold the rules (`ad-creative-design`, `design-system-tokens`, `brand-identity` as the work needs). Read the tokens file and the copy file.
2. `Artifact` `quickstart` (`intent: design`, or `slides` for a deck). Pick the type and read what the result says.
3. Write every file under a scratch folder: for a canvas `project/canvas.json` and the boards.
4. Check the files against the table below, and fix them.
5. With the user's go-ahead for the page, `Artifact` `publish` with the type's `type_url` and a title (new) or with the `url` (update), all files in one call.
6. `Artifact` `list` with scope `files`, then `read` each file you wrote.
7. Compare, count, report.

## Keep to the source
Copy word for word; only token colours; figures and claims go to the role that reviews claims (in the agency Defne) as claims to review; what you infer is written as inferred, never as the brand's. A required timestamp is the date given at `T00:00:00Z`, called a placeholder in the report.

## Read back what you published
Every page gets a read-back, or a stated failure to read back. A link check is not a content check: a lead that opens the link has not read what the page holds.

## Read back by type
- **Design, Slides and Design System:** `list` the files, `read` each one you wrote, compare sizes; count files, tokens and empty fields instead of estimating; recompute any contrast figure you state.
- **Docs and Sheets:** read through the connector (`read`, `query`) what you wrote and count sections, rows or cells; for an update of a sheet read the range before and after.
- **Whiteboard and Data:** read the store back with the store tool and count elements or datasets from it.
- A read-back you could not make is reported as not read back, with the reason.

## What to compare in the read-back
| Check | How |
|---|---|
| Files | the listing holds the type's files and every file you wrote, and nothing else of yours |
| Sizes | the byte length of each file the page lists equals the byte length of the file as you wrote it, encoded as the page stores it (never the number of characters) |
| Boards | `canvas.json` lists each board at the size the brief names, and no design system but the supplied one |
| Colours | every hex value in your files is a token's |
| Copy | every line is the copy file's, word for word; figures and claims are on your list for Defne |
| Tokens | no `$value` map; names valid and unique; aliases resolve; the counts equal the source's |
| Contrast | recompute each ratio you state: 4.5 to 1 for body text, 3 to 1 for large text |
| Zones | feed: no text in the bottom 10 percent; story: none in the top and bottom 250 px; checked from your own layout numbers, since you cannot render |

## The report
- The link, the type and the version. New page: "Private; sharing untouched." Update: "sharing as it was". Say who can see it only when a tool result shows it.
- The files published, counted: how many, which.
- The checks that ran, with the numbers; the checks that did not: the render, the platform specs, how the editor shows it. Every count you give is a count, not an estimate.
- The claims for Defne; what you marked as inferred; the placeholder time, if you wrote one.
- Open items for the lead, the render ask first: you cannot look at the page.

## Anti-patterns, each with its reason
- Publishing after every board: the half-built canvas is visible.
- A time written from memory (`12:00:00Z`): it was not the time.
- "I invented nothing" over rules the source does not state: the reader trusts it.
- A count from memory ("11 of 12"): count it; it was 10.
- Saying it looks right when nobody rendered it.
- Changing sharing, or telling the user it is shared.
