---
name: technical-seo-audit
description: Technical SEO audits covering Core Web Vitals, crawl budget, robots.txt directives, structured JSON-LD data, and indexing hygiene.
metadata:
  author: "Agents United SEO Group"
  version: "1.0.0"
  license: "MIT"
---

# Technical SEO Audit Playbook

## Overview & Purpose
`technical-seo-audit` provides a rigorous testing and auditing methodology for web applications to achieve maximum search engine crawlability and indexability.

## Core Directives & Standards
1. **Robots.txt & Sitemap Validation** — Verify `robots.txt` disallows private routes while allowing Googlebot/Bingbot access to public assets.
2. **Schema JSON-LD Verification** — Validate structured data against Schema.org standards (`SoftwareApplication`, `Product`, `Article`, `FAQPage`).
3. **Core Web Vitals Thresholds** — Enforce LCP < 2.5s, CLS < 0.1, and INP < 200ms across all public entry points.
4. **Header & Status Code Hygiene** — Ensure clean 200 OK responses, proper 301 permanent redirects, and no redirect chains > 1 hop.

## Verification Checklist
- [ ] Valid JSON-LD structured data confirmed with Schema Validator.
- [ ] No indexing directives set to `noindex` on production-ready public pages.
- [ ] Canonical tags point strictly to self or canonical primary URL.
