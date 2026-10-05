# The viewport matrix and the thresholds

## The matrix

| Name | Width x height (CSS px) | Why |
|---|---|---|
| mobile | 375 x 667 | the narrow phone width people use |
| tablet | 768 x 1024 | the middle width |
| desktop | 1440 x 900 | the role's standard desktop |
| reflow | 320 x 640 | WCAG reflow: 400 percent zoom on a 1280 px screen |

Add the product's own breakpoints, one width just below and one just above each.

## The checks and what counts as a failure

| Check | Pass | Failure |
|---|---|---|
| Horizontal scroll | `document.documentElement.scrollWidth - window.innerWidth` is 0 or less | any overflow; report it in pixels, with the selector that causes it |
| Reflow at 320 | one column, no two-dimensional scrolling (maps and data tables excepted) | content that needs sideways scrolling |
| Touch targets | at least 44 by 44 CSS pixels on the narrow viewports | under 24 by 24 fails the WCAG AA target-size criterion unless spacing compensates; report the measured size |
| Text zoom to 200 percent | nothing clipped, nothing overlapping | fixed-height text containers that clip |
| Layout stability | space reserved for images and embeds (width and height or an aspect ratio) | content that jumps as it loads |
| Key journeys at mobile width | the menu opens, the form fills and submits, the confirmation is reached | a layout that cannot be operated |

## Evidence per viewport

A screenshot saved under `artifacts/`, the measured overflow in pixels, the failing selectors and sizes, and the Playwright run output. Waiting for the page's load state and fonts replaces fixed sleeps.

## Limits to state in the report

A headless browser cannot represent a real phone (the virtual keyboard, safe areas). Authenticated states, real devices and real browsers that were not tested are listed as not tested.
