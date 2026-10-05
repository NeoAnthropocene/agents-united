---
name: seo-audit
description: "Use when the brief is audit our SEO, a launch or migration needs a check, traffic dropped, or a content plan needs a baseline; trigger phrases: audit our SEO, why did our traffic drop, what is wrong with our search visibility, give me an SEO health score. Produces the audit report: a health score by a stated rule, indexation status, graded findings that name a page with evidence and an owner, a per-URL intent table and a plan by impact against effort. Skip it to promise rankings (no audit can) and for paid search; crawl depth is technical-seo-audit."
metadata:
  author: agents-united
  version: 3.0.0
  icon: 🔍
disable-slash-command: true
---

# SEO Audit

An SEO audit answers one question: what, specifically, keeps these pages from being found by the people who want them, and what is the cheapest order to fix it? A useful audit is page-specific, ordered by consequence and implementable by whoever owns each fix.

## Overview & Purpose
The broad audit: Selin runs it and Yavuz uses its findings for content and keyword ownership. Crawl and indexation depth is `technical-seo-audit`, templated pages at scale `programmatic-seo`, structured data `schema-markup-strategy`.

## Execution Triggers
Load it when the brief is "audit our SEO", a launch or migration needs a check, traffic dropped, or a content plan needs a baseline. Do not use it to promise rankings (no audit can) or for paid search.

## Input/Output Requirements
Inputs: the domain and the pages that matter (revenue, signups); what can be read (the live site, the sitemap, Search Console exports if supplied); audience and topics; named competitors; what changed recently (a redesign, a migration, a CMS change).

Output: the audit report in the role's format (summary with the health score and indexation status, the 15-point checklist, priority actions with owners, authored snippets) and a per-URL table: intent, title and description, issue, fix, owner. Shape: [examples/report-template.md](examples/report-template.md). **Evidence to attach**: per finding, the URL, the exact observation (a header, a tag, a number), the tool or command and the date.

## Step-by-Step Runbook
1. **Scope to the pages that earn**: the 10 to 30 URLs that matter, and why; auditing everything produces noise. Note the date: pages change.
2. **Technical blockers come first**, before judging content: can the page be crawled, rendered and indexed (checks 1 to 6 of `technical-seo-audit`)? Content work on a blocked page is wasted.
3. **One primary search intent per URL**, in a sentence (informational, commercial, transactional, navigational), compared with the page. A product page answering an informational query, or two pages chasing one query, is a finding; resolve cannibalisation by merging, redirecting or re-targeting, with Yavuz.
4. **On-page basics where they matter to that intent** (title about 50 to 60 characters, description about 120 to 155, one H1, anchors, alt text, internal links): [references/on-page-basics.md](references/on-page-basics.md).
5. **Performance and experience**: field data where it exists, lab data to find the cause; the root cause via `debug-optimize-lcp`.
6. **Grade each finding**: critical (blocks crawling, indexing or rendering of an important page), major (clearly loses visibility or clicks), minor (hygiene). Health score: 100 minus 15 per critical, 7 per major, 2 per minor, floor 0 (`node ${CLAUDE_SKILL_DIR}/scripts/health-score.mjs findings.md`, or the table in [references/health-score.md](references/health-score.md)). State the rule and the scope.
7. **Prioritise by impact against effort**: impact is how many important pages and how much traffic or revenue; effort is who must change what. Critical and cheap first; label every impact figure an estimate.
8. **Hand off.** Code and server changes (redirects, canonical, rendering, robots) to Deniz; content, intent and cluster ownership to Yavuz; rewritten titles and descriptions to Kaan if conversion matters; access needs (Search Console, analytics) to the lead as a request.

## Code & Config Exemplars
Load [examples/worked-example.md](examples/worked-example.md) for a 12-URL audit with its findings table and the score.

Anti-patterns, each with its reason:
- Generic advice ("improve content quality") with no URL: nobody can act on it.
- Content work on pages that cannot be indexed: it cannot pay back.
- Two pages chasing one query left alone: they compete with each other.
- Keyword stuffing presented as optimisation: a risk, not a fix.
- A promised ranking or traffic number: no audit can know it.
- A health score without its rule and scope: it cannot be checked.

## Edge Cases & Error Recovery
- **No Search Console or analytics access**: audit what is visible from outside, say what could not be checked (queries, clicks, index coverage), list the access needed.
- **JavaScript-rendered content**: compare the raw HTML with the rendered DOM (`chrome-devtools-mcp` if connected); content that appears only after rendering may not be indexed.
- **A migration in progress**: freeze recommendations that touch URLs until the redirect map exists.
- **Two findings conflict** (a canonical to a noindexed page): fix the blocker, then recheck the other.
- **Traffic fell, nothing technical changed**: check demand, competitors and a search-engine update before blaming the site; say what you could not establish.

## Verification Checklist
- [ ] The scope lists the pages audited and the date, with the reason for each.
- [ ] Technical blockers were checked before content; each finding has a URL, an observation and its evidence.
- [ ] Every key URL has one stated primary intent; overlaps are listed with a proposed resolution.
- [ ] Severity, the score rule and its scope are written; priorities show impact and effort, estimates labelled.
- [ ] Hand-offs name Deniz, Yavuz, Kaan and the lead for access requests.
