---
name: programmatic-seo
description: "Use when a brief proposes pages at scale from a dataset, such as X vs Y, best X for Y or X integration pages; trigger phrases: generate pages from our data, programmatic SEO, alternatives to X pages, city pages for every location, why are our generated pages not indexed. Produces the page-type definition, a data schema where every record differs, the taxonomy, a boilerplate ceiling and publish gate, hub and sitemap plans and monitoring. Skip it for a handful of hand-written landing pages, and when the dataset cannot make each page different (stop and say so)."
metadata:
  author: agents-united
  version: 3.0.0
  icon: 🤖
disable-slash-command: true
---

# Programmatic SEO

Programmatic SEO generates many pages from structured data. It works when each page answers a real query with data the visitor cannot get from the next page, and fails (sometimes at the cost of the whole site's standing) when it publishes thousands of near-identical pages.

## Overview & Purpose
For Selin: the design rules, thresholds and monitoring that keep a templated page set useful. Deniz builds the generator, Yavuz owns the clusters and editorial pages around it, Kaan writes the template copy.

## Execution Triggers
Load it when a brief proposes pages at scale (dozens or more) from a dataset: "X vs Y", "best X for Y", "X integration" pages. Do not use it for a handful of hand-written landing pages, or when the dataset cannot make each page different (stop and say so).

## Input/Output Requirements
Inputs: the dataset (fields, size, change rate, owner); the query pattern with evidence that people search it (keyword data, source and date); the site's authority and crawl budget in rough terms; template ideas; overlapping pages.

Output: the page-type definition (query pattern, intent, example URL); the data schema with required fields and minimum unique content; the URL taxonomy; the template outline; the quality rules and publish gate; the linking and sitemap plan; the monitoring plan. **Evidence to attach**: the keyword data with source and date, and 10 sampled records checked against the rules.

## Step-by-Step Runbook
1. **Prove the demand and the intent.** One page type per query pattern, with search volume and the intent the result page must satisfy. If the intent is "I want a person's opinion" and your data is a table, the pages will not fit.
2. **Design the data so each page differs**: every record needs its own facts and its own text of real substance (about 150 or more unique words as a working minimum) and something the competing page lacks. Drop sparse entities; never pad.
3. **Set a boilerplate ceiling**: at most about 40 percent of a page's text shared with other pages of the type, measured on a sample (for example the share of sentences found on other pages). Above it, a page does not ship.
4. **Decide what is not published**: a record failing the minimums returns 404 or 410, is not generated, or is generated with `noindex` while data is gathered; it never goes live thin.
5. **Design the URL taxonomy**: shallow, stable, readable, one canonical, one ordering of a symmetric pair.
6. **Plan hubs and links**: a hub per category, five to eight genuine sibling links per page, `BreadcrumbList` breadcrumbs, no orphans.
7. **Partition the sitemaps**: under 50,000 URLs each (10,000 is comfortable), in a sitemap index; `lastmod` changes only when the content does.
8. **Launch in stages and monitor**: a first batch of 50 to 100 pages, watch indexation and impressions for weeks, expand only if the pages are indexed and earn impressions. Track indexed against submitted, impressions per page and duplicate or **cannibalised** queries (editorial overlap is resolved with Yavuz).
9. **Hand off.** The schema and rules to Deniz, the publish gate as a test (a page below the minimums must not render as indexable); template copy to Kaan; clusters to Yavuz; markup to `schema-markup-strategy`; build verification to Emre. Details: [references/page-set-rules.md](references/page-set-rules.md).

## Code & Config Exemplars
Load [examples/worked-example.md](examples/worked-example.md) for 400 candidate pages cut to 120, with the 10-record sample check, the publish gate and the staged launch.

Anti-patterns, each with its reason:
- Pages for queries nobody makes because the data exists: they cost crawl budget, earn nothing.
- The same paragraph with the name swapped: the thin page engines discount.
- Publishing thin records and hoping they fill in: they are judged as published.
- Both orderings of a symmetric comparison: two pages for one query.
- A sitemap that includes `noindex` pages: it contradicts itself.
- Thousands of pages at once, unmonitored: you learn it failed after the cost.

## Edge Cases & Error Recovery
- **Few pages indexed after a month**: stop expanding; check duplication, links and sample quality; improve the data before adding pages.
- **A competitor's page is much richer**: add the field that makes yours better or drop the page type; copy nothing.
- **A dataset licence limit**: attribute and respect it; ask the lead (Defne for legal terms).
- **Pages cannibalise a hand-written article**: choose one owner for the query with Yavuz; redirect or differentiate the other.
- **Data errors after launch**: correct at source and regenerate; never hide errors under `noindex` for good.

## Verification Checklist
- [ ] Demand evidence (source and date) exists for the page type; entities without demand are excluded.
- [ ] The schema gives every page unique facts and text above the minimum; 10 records were checked.
- [ ] The boilerplate ceiling and the publish gate are written and testable.
- [ ] Taxonomy, hubs, sibling links, breadcrumbs and sitemap partitions are specified.
- [ ] A staged launch and monitoring (including cannibalisation) are written down.
- [ ] Hand-offs name Deniz, Kaan, Yavuz and Emre with what each delivers.
