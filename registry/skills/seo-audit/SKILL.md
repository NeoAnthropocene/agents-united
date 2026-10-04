---
name: seo-audit
description: "Audit a site or page for search visibility in the right order: technical blockers first, one search intent per URL, findings that name a page and an owner, a severity and a health score by a stated rule, and a prioritised plan by impact against effort."
metadata:
  author: agents-united
  version: 3.0.0
  icon: 🔍
disable-slash-command: true
---

# SEO Audit

## Overview & Purpose
An SEO audit answers one question: what, specifically, keeps these pages from being found by the people who want them, and what is the cheapest order to fix it? The usual failure is a long list of generic advice. A useful audit is page-specific, ordered by consequence, and implementable by whoever owns each fix.

This is the broad audit. The crawl and indexation depth is `technical-seo-audit`; templated pages at scale are `programmatic-seo`; structured data is `schema-markup-strategy`. Selin runs the audit; Yavuz uses its findings for content and keyword ownership.

## Execution Triggers
Load it when the brief is "audit our SEO", a launch or migration needs a check, traffic dropped, or a content plan needs a baseline. Do not use it to promise rankings (no audit can), or for paid search.

## Input/Output Requirements
Inputs: the domain and the pages that matter (revenue, signups), access to what can be read (the live site, the sitemap, Search Console exports if the client supplies them), the target audience and topics, competitors named by the client, and what changed recently (a redesign, a migration, a CMS change).

Outputs: the audit report in the role's format (summary with the health score and indexation status, the 15-point checklist, priority actions with owners, authored snippets), plus a per-URL table for the key pages: primary intent, current title and description, issue, fix, owner. **Evidence to attach**: for every finding, the URL, the exact observation (a header, a tag, a number), the tool or command that produced it and the date.

## Step-by-Step Runbook
1. **Scope to the pages that earn.** Pick the 10 to 30 URLs that matter and say why; auditing everything produces noise. Note the date: pages change.
2. **Technical blockers come first.** Before judging content, check that the page can be crawled, rendered and indexed: not blocked in `robots.txt`, no stray `noindex`, returns 200, one canonical, reachable by internal links, a staging copy not indexable. A content improvement on a blocked page is wasted. Use `technical-seo-audit` for the checks.
3. **One primary search intent per URL.** For each key page write the intent (informational, commercial, transactional, navigational) in a sentence and compare it with what the page is. A product page answering an informational query, or two pages chasing the same query, is a finding; cannibalisation is resolved by merging, redirecting or re-targeting, decided with Yavuz.
4. **Check the on-page basics** where they matter to that intent: a title that states the topic first and fits about 50 to 60 characters, a description of about 120 to 155 characters that earns the click, a single H1, headings that reflect the content, descriptive anchor text, image alt text, internal links to and from the page.
5. **Check performance and experience** with field data where it exists (real-user data) and lab data to find the cause; see `debug-optimize-lcp` for a root cause.
6. **Grade each finding**: critical (blocks crawling, indexing or rendering of an important page), major (clearly loses visibility or clicks), minor (hygiene). Compute the **health score** by the agency convention and state it: start at 100, subtract 15 per critical, 7 per major, 2 per minor, floor 0. It is a summary of this audit, not an industry metric, and not comparable across sites with a different scope.
7. **Prioritise by impact against effort.** Impact: how many important pages and how much expected traffic or revenue; effort: who must change what. Do the critical and cheap first; mark every estimate of impact as an estimate.
8. **Hand off.** Code and server changes (redirects, canonical, rendering, robots) to Deniz; content, intent mapping and cluster ownership to Yavuz; titles and descriptions as rewritten copy to Kaan if conversion matters; Core Web Vitals root causes through `debug-optimize-lcp`. Anything that needs the client's access (Search Console, analytics) goes to the lead as a request.

## Code & Config Exemplars
### Worked example
A developer-tools site, audit of 12 key URLs on 2026-10-01 (invented findings).

| # | Sev | URL | Observation (evidence) | Fix | Owner |
|---|---|---|---|---|---|
| 1 | critical | `/docs/webhooks` | `<meta name="robots" content="noindex">` present (page source) | remove the tag; it was copied from staging | Deniz |
| 2 | major | `/blog/webhook-retries` and `/blog/retry-strategies` | both target "webhook retry strategy"; both rank on page 2 (Search Console export from the client) | merge into the stronger URL, 301 the other, keep the better sections | Yavuz decides, Deniz redirects |
| 3 | major | `/pricing` | title is "Pricing" (7 characters) | "Pricing: free plan and paid plans for webhook delivery" (54) | Kaan |
| 4 | minor | 9 images | no alt text | write descriptive alt text | Yavuz and Jamileh |

Score: 100 - 15 - 7 - 7 - 2 = **69** for this scope. Indexation status: one important page blocked (finding 1).

### Anti-patterns
- Generic advice ("improve content quality") with no URL.
- Content work on pages that cannot be indexed.
- Two pages chasing one query left as they are.
- Keyword stuffing and other gimmicks presented as optimisation.
- A promised ranking or traffic number.
- A health score without its rule and scope.

## Edge Cases & Error Recovery
- **No access to Search Console or analytics**: audit what is visible from outside, say what could not be checked (queries, clicks, index coverage) and list the access needed.
- **JavaScript-rendered content**: compare the raw HTML with the rendered DOM (use `chrome-devtools-mcp` if connected); content that exists only after rendering may not be indexed reliably.
- **A migration in progress**: freeze recommendations that touch URLs until the redirect map exists.
- **Two findings conflict** (a canonical to a noindexed page): fix the blocker first, then recheck the second.
- **Traffic fell and nothing technical changed**: check demand, competitors and a search-engine update before blaming the site; say what you could not establish.

## Verification Checklist
- [ ] The scope lists the pages audited and the date, with the reason for each.
- [ ] Technical blockers were checked before content, and each finding carries a URL, an observation and its evidence.
- [ ] Every key URL has one stated primary intent; overlaps are listed with a proposed resolution.
- [ ] Severity, the health score rule and the scope of the score are written down.
- [ ] Priorities show impact and effort; impact figures are labelled estimates.
- [ ] Hand-offs name Deniz, Yavuz, Kaan and the lead for access requests.
