---
name: programmatic-seo
description: "Plan templated pages that scale without becoming thin or duplicate: a data schema where every record differs, a URL taxonomy, a boilerplate ceiling, hub pages and internal links, partitioned sitemaps, a rule for pages that must not be published, and indexation monitoring."
metadata:
  author: agents-united
  version: 3.0.0
  icon: 🤖
disable-slash-command: true
---

# Programmatic SEO

## Overview & Purpose
Programmatic SEO generates many pages from structured data: comparisons, directories, integrations, locations. It works when each page answers a real query with data the visitor cannot get from the next page, and it fails, sometimes at the cost of the whole site's standing, when it publishes thousands of near-identical pages. This skill gives Selin the design rules, the thresholds and the monitoring that keep a templated page set useful.

Selin designs the taxonomy, the template rules and the checks. Deniz builds the generator; Yavuz owns the topic clusters and editorial pages around it; Kaan writes the template copy.

## Execution Triggers
Load it when a brief proposes pages at scale (dozens or more) from a dataset, such as "X vs Y", "best X for Y" or "X integration" pages. Do not use it for a handful of hand-written landing pages, or when the dataset cannot make each page different (stop and say so).

## Input/Output Requirements
Inputs: the dataset (fields, size, how often it changes, who owns it), the query pattern and evidence that people search it (keyword data with source and date), the site's current authority and crawl budget in rough terms, the template ideas, and existing pages that may overlap.

Outputs: the page-type definition (query pattern, intent, example URL); the data schema with required fields and the minimum unique content per page; the URL taxonomy; the template outline; the quality rules and the publish gate; the internal linking and sitemap plan; the monitoring plan. **Evidence to attach**: the keyword data with its source and date, and a sample of 10 records checked against the quality rules.

## Step-by-Step Runbook
1. **Prove the demand and the intent.** One page type per query pattern, with search volume and the intent that the result page should satisfy. If the intent is "I want a person's opinion" and your data is a table, the pages will not fit.
2. **Design the data so each page differs.** Every record needs the fields that make a page worth reading: its own facts (features, prices, benchmarks, locations), its own text of real substance (about 150 or more unique words is a working minimum), and something the competition's equivalent page does not show. Drop entities with sparse data instead of padding them.
3. **Set a boilerplate ceiling.** No more than about 40 percent of a page's text may be shared with other pages of the type; measure it on a sample (for example, the share of sentences that appear on other pages). A page above the ceiling does not ship.
4. **Decide what is not published.** A record failing the minimums returns 404 or 410 (or is not generated), or is generated with `noindex` while data is gathered; it does not go live as a thin page. Never create pages for queries nobody makes.
5. **Design the URL taxonomy**: shallow, stable, readable (`/compare/{a}-vs-{b}`, `/integrations/{tool}`), one canonical per page, and a rule for symmetric pairs so `a-vs-b` and `b-vs-a` do not both exist.
6. **Plan hubs and internal links.** Hub pages per category link to their pages; each page links to five to eight genuine siblings and to its hub; breadcrumbs carry `BreadcrumbList` markup; no page is orphaned from the main navigation or the sitemap.
7. **Partition the sitemaps**: files under 50,000 URLs (10,000 is a comfortable working size) listed in a sitemap index, with `lastmod` that changes only when the content does.
8. **Launch in stages and monitor.** Publish a first batch of 50 to 100 pages, watch indexation and impressions for several weeks, and expand only if the pages get indexed and earn impressions. Track indexed versus submitted, impressions per page, and duplicate or cannibalised queries; **cannibalisation** against your editorial pages is resolved with Yavuz.
9. **Hand off.** The schema and rules to Deniz for the generator, with the publish gate as a test (a page below the minimums must not render as indexable); template copy to Kaan; clusters and editorial overlap to Yavuz; structured data to `schema-markup-strategy`; the build verification to Emre.

## Code & Config Exemplars
### Worked example
An invoicing tool wants "alternatives to X" pages for 400 accounting tools (invented). Query check: 120 of the 400 have measurable demand (keyword export, 2026-10-01, source recorded); the rest return no volume.

Decision: build 120 pages, not 400. Data per record: pricing tiers, supported currencies, integrations list, a measured import test result (rows imported per minute), pros and cons from 5 or more reviews. Sample check of 10 records: 2 fail the 150-unique-word minimum, so they are held back as `noindex` until data exists; boilerplate on the passing pages averages 31 percent (under the 40 percent ceiling).

```text
URL         /alternatives-to/{tool}      canonical: self       sitemap: sitemap-alternatives-1.xml (<= 10,000 URLs)
Publish gate  fields complete AND unique words >= 150 AND boilerplate <= 40% AND demand evidence present
Else          generate with noindex, do not link from hubs, do not list in the sitemap
Hub           /alternatives-to/  lists all published; each page links to its hub and 5 to 8 siblings in the same category
Launch        batch 1 = 60 pages; review indexed/submitted and impressions after 4 weeks; expand if indexed >= 70%
```

### Anti-patterns
- Pages for queries nobody makes because the data exists.
- The same paragraph with the name swapped.
- Publishing thin records and hoping they fill in later.
- Both orderings of a symmetric comparison.
- A sitemap that includes `noindex` pages.
- Launching thousands of pages at once, with no monitoring.

## Edge Cases & Error Recovery
- **Indexed percentage is low after a month**: stop expanding; check duplication, internal links and the sample quality; improve the data before adding pages.
- **A competitor's page is much richer**: add the field that makes yours better, or drop the page type; do not copy their text.
- **The dataset has a licence limit**: attribute and respect it; ask the lead if unclear (Defne for legal terms).
- **Pages cannibalise a hand-written article**: choose one owner for the query with Yavuz and redirect or differentiate the other.
- **Data errors found after launch**: correct at source, regenerate, and let `lastmod` change; do not hide errors with `noindex` forever.

## Verification Checklist
- [ ] Demand evidence (source and date) exists for the page type, and entities without demand are excluded.
- [ ] The schema gives every page unique facts and text above the minimum; a sample of 10 records was checked.
- [ ] The boilerplate ceiling and the publish gate are written and testable.
- [ ] The URL taxonomy, hubs, sibling links, breadcrumbs and sitemap partitions are specified.
- [ ] A staged launch and the monitoring plan, including cannibalisation, are written down.
- [ ] Hand-offs name Deniz, Kaan, Yavuz and Emre with what each delivers.
