# On-page basics, with the thresholds

Check these where they matter to the page's intent. Each is judged against what that URL is for, not in the abstract.

- [ ] **Title**: states the topic first, about 50 to 60 characters.
- [ ] **Meta description**: about 120 to 155 characters, and earns the click.
- [ ] **H1**: a single H1.
- [ ] **Headings**: they reflect the content.
- [ ] **Anchor text**: descriptive.
- [ ] **Images**: alt text.
- [ ] **Internal links**: to and from the page.

## Performance and experience

Use field data (real users) where it exists, and lab data to find the cause. A lab number alone is not a verdict. The root cause of a slow page goes through `debug-optimize-lcp`.

## Technical blockers (checked before any of the above)

Can the page be crawled, rendered and indexed: not blocked in `robots.txt`, no stray `noindex`, returns 200, one canonical, reachable by internal links, and a staging copy that is not indexable. These are checks 1 to 6 of `technical-seo-audit`. A content improvement on a blocked page is wasted.
