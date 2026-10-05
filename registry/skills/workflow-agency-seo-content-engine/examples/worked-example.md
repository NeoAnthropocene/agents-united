# Worked example (an invented engagement, for checking your own work)

A developer-tools site with 25 hours a week of content capacity and a migration two months ago.

## The delegation map

```text
S1 Selin   audit            out: seo/audit.md      evidence: headers for the 12 key URLs; finding 1 = noindex inherited from staging on /docs
S2 Yavuz   map + calendar   out: content/plan.md   evidence: 3 pillars, 14 clusters, 90 days at 70% of capacity; keywords with source and date
S3 Kaan    rewrite titles   out: copy/meta.md      evidence: lengths 50-60 and 120-155 listed
S3 Selin   JSON-LD          out: seo/schema.md     evidence: Rich Results Test output on staged pages
S3 Deniz   fixes            out: changes made or listed; redirect map; evidence: one-hop redirects verified
S4 Emre    gate             out: qa/seo-gate.md    evidence: status, canonical and rendering checks on the 12 URLs
S4 Defne   review           out: compliance/claims.md
```

## How to read it

Every slice has an owner, a named output file and the evidence the owner reports. S1 comes first because content on a blocked page is wasted; the calendar of S2 sits at 70 percent of capacity, under the 80 percent ceiling; S3 starts only when the keyword map and the metadata snippets exist as files; S4 verifies the whole before the client publishes.
