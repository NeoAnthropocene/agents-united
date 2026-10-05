# Worked example (invented numbers, for checking your own work)

An invoicing tool wants "alternatives to X" pages for 400 accounting tools. The query check: 120 of the 400 have measurable demand (keyword export, 2026-10-01, source recorded); the rest return no volume.

## The decision

Build 120 pages, not 400. The data per record: pricing tiers, supported currencies, the integrations list, a measured import test result (rows imported per minute), and pros and cons from 5 or more reviews.

Sample check of 10 records: 2 fail the 150-unique-word minimum, so they are held back as `noindex` until data exists. Boilerplate on the passing pages averages 31 percent, under the 40 percent ceiling.

## The rules, written so they can be tested

```text
URL         /alternatives-to/{tool}      canonical: self       sitemap: sitemap-alternatives-1.xml (<= 10,000 URLs)
Publish gate  fields complete AND unique words >= 150 AND boilerplate <= 40% AND demand evidence present
Else          generate with noindex, do not link from hubs, do not list in the sitemap
Hub           /alternatives-to/  lists all published; each page links to its hub and 5 to 8 siblings in the same category
Launch        batch 1 = 60 pages; review indexed/submitted and impressions after 4 weeks; expand if indexed >= 70%
```
