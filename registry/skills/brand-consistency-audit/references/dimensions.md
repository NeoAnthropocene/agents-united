# The dimensions of an audit

For each dimension: where the rule is stated, how to check it with no shell, what the script adds, and what only a person can judge. A dimension the brand does not state is written "not stated" and audited against nothing.

| Dimension | The rule lives in | Check with `Grep` and `Read` | The script adds | Judged by eye |
|---|---|---|---|---|
| Colour | The tokens' colour set; the guidelines' palette and usage notes (for example "muted text never on the brand fill") | Every hex, `rgb()`, `hsl()` and named colour in SVG, HTML and CSS ([scanning-without-a-shell.md](scanning-without-a-shell.md)); a pair that a usage note forbids | Every colour against the token set, the nearest token, translucent uses | Colour inside raster images; whether a gradient is one the brand allows |
| Type | The tokens' families and sizes; the guidelines' scale, weights and case | `font-family`, `font-size`, `font-weight` values | The first font of every `font-family` against the tokens | Hierarchy, line length, a font that falls back to the system one on a machine without it |
| Logo | The guidelines' logo rules: lockups, clear space, minimum size, variant by background, never stretched, recoloured or given effects | In SVG: `viewBox`, `transform="...scale("`, `preserveAspectRatio="none"`, a `filter`; in HTML: width and height set together on an `<img>`; the file name of the variant | Nothing | Clear space, size, the variant on its background, whether the mark was redrawn by hand |
| Layout and spacing | The grid, the margins, the safe zones of the placement (`ad-creative-design`), the spacing tokens | The pixel values of margins and gaps; the y of the lowest text in a feed ad | Nothing | Alignment, rhythm, what sits in a no-text zone (measure it by rendering: put the render ask to the lead) |
| Imagery | The guidelines' style, subjects, treatment; the licence list | Alt text present; `<image>` and `<img>` sources; the licence list entry | Nothing | Style, subject and treatment; a generated image carries its label in the report |
| Copy and voice | The copy file (verbatim); the guidelines' voice, banned terms and claims rules | Each visible string searched in the copy file; banned terms searched in the assets | Visible strings against the copy file | Tone; whether a claim is true (Defne), whether the copy reads well (Kaan) |
| Accessibility basics | `color-theory` and `accessibility-audit` | Alt text, text sizes | Nothing | Contrast pairs: hand to `color-theory` for the decision and to Emre for the built page |
| File hygiene | The naming convention and export budgets (`marketing-creative-design`) | File names, formats, sizes in the listing | Nothing | Whether the file is the latest version |

Order of work: colour, type and copy by scan first (they are cheap and exact), then the dimensions that need eyes. Say in the report which dimensions were scanned and which were looked at.
