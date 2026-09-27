# Localization & Accessibility Constraints

In-house adaptation, credited to
[ui-skills.com/skills/mrstev3n/balise-ux-writing](https://www.ui-skills.com/skills/mrstev3n/balise-ux-writing)
(Apache-2.0 source: `github.com/mrstev3n/balise-skills`).

## Localization
- Preserve interpolation tokens (`{name}`, `%s`, `{{count}}`), ICU plural/select syntax, and
  rich-text tags exactly — never rewrite around them or renumber positional tokens.
- Account for text expansion: German/Finnish commonly run 30–40% longer than English; short English
  UI labels are the tightest constraint, not the norm.
- Grammatical gender, plural rules, and word order vary by locale — a template built around English
  sentence structure may not localize; flag this rather than forcing a translation to fit it.
- Keep each locale and its own conventions (date formats, honorifics, currency) distinct; never
  collapse multiple locales into one "average" unless translation was explicitly requested.

## Accessibility
- Every interactive element needs a meaningful accessible name — an icon-only button needs a label
  even if no visible text is shown.
- Instructions and error messages must not rely on color, shape, or position alone ("the red one",
  "the button on the right") — screen-reader and colorblind users lose that cue.
- Write for screen-reader announcement order, not just visual order, when the two can differ (e.g. a
  card with an icon before a heading — the label should still make sense read first).
- Truncated/ellipsized text needs a full-text accessible name (`aria-label`/`title`) so meaning isn't
  lost for assistive tech even when it's lost visually.

## Boundary vs. `accessibility-audit`
`accessibility-audit` audits the *implementation* (ARIA, focus order, contrast ratios, semantic
HTML). `ux-writing` audits the *words* that implementation carries. Use both together on an
accessibility pass: `accessibility-audit` finds missing/wrong labels; `ux-writing` writes the correct
label text once the gap is found.
