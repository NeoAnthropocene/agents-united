# Page-set rules: quality, taxonomy, links, sitemaps, launch

The numbers are working thresholds, not search-engine rules: say so in the plan, and adjust them with the data you measure.

## Quality (the publish gate)

| Rule | Threshold |
|---|---|
| Demand | evidence of searches for the query pattern, with source and date; no demand, no page |
| Unique content per page | its own facts, plus about 150 or more unique words of real substance |
| Boilerplate | at most about 40 percent of the page's text shared with other pages of the type, measured on a sample (the share of sentences that appear on other pages) |
| A page that fails | returns 404 or 410, or is not generated, or is generated with `noindex`, kept out of hubs and sitemaps while data is gathered |

Sample 10 records against these rules before building and record the result.

## URL taxonomy

Shallow, stable and readable (`/compare/{a}-vs-{b}`, `/integrations/{tool}`), one canonical per page, and a rule for symmetric pairs so that `a-vs-b` and `b-vs-a` do not both exist.

## Hubs and internal links

A hub page per category links to its pages. Each page links to five to eight genuine siblings and to its hub. Breadcrumbs carry `BreadcrumbList` markup. No page is orphaned from the main navigation or the sitemap.

## Sitemaps

Files under 50,000 URLs each (10,000 is a comfortable working size), listed in a sitemap index. `lastmod` changes only when the content does. A sitemap never lists a `noindex` page.

## Launch and monitoring

Publish a first batch of 50 to 100 pages and watch for several weeks. Expand only if the pages get indexed and earn impressions (the worked example uses an indexed share of 70 percent as its bar). Track:

- indexed against submitted;
- impressions per page;
- duplicate or cannibalised queries, resolved with Yavuz when they overlap editorial pages.

If the indexed share is low after a month, stop expanding and check duplication, internal links and the quality of the sample.
