# The type map and the properties to fill

Map conservatively: the markup describes only what the page visibly shows. The required properties change, so read the search engine's current structured-data documentation for each type, and write down the page you read and the date.

| Page | Schema type | Fill these first | Notes |
|---|---|---|---|
| Home, about | `Organization` | name, url, logo, links to the official profiles | once for the site, referenced by `@id` from everywhere else |
| The site itself | `WebSite` | url | once for the site (defined on the home page) |
| Any page | `WebPage` | url, `isPartOf` (the site), `about` (the main entity) | references the site and the main entity by `@id` |
| Article, blog post | `Article` or `BlogPosting` | headline, image, dates, author | the author and publisher are entities referenced by `@id` |
| Software product | `SoftwareApplication` or `Product` | name; for a product at least one of `offers`, `review` or `aggregateRating`; price and currency from the page | `applicationCategory` and `operatingSystem` for software; never an invented rating |
| Hierarchy | `BreadcrumbList` | the trail as it appears on the page | |
| How-to, Q&A | only if the page truly is one | | when last read, `FAQPage` rich results were restricted to a narrow set of authoritative sites and how-to rich results were withdrawn: promise neither, mark the markup optional and explain the expectation |

## The graph

Use JSON-LD, one `@graph` per page, with stable `@id` values so the entities connect: the site and the organisation once, the page referencing them, the main entity referencing the page and its author or publisher. Several unconnected blocks that each repeat the organisation are a defect.

## Keeping markup and page in sync

Generate the markup from the same data as the page (a template, not a copy). If that is impossible, add a test that compares the two, owned by Emre.

## Validation

- Rich Results Test: eligibility.
- Schema Markup Validator: syntax.
- Run both on the live or staged URL, fix errors before warnings, and record the results with the date. A valid block can still be ineligible; display is at the search engine's discretion, so record the status and check again after the next crawl.
