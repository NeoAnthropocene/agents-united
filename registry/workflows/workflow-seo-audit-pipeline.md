---
name: "Technical SEO Audit & Programmatic Deployment Workflow"
description: "Comprehensive SEO audit, schema validation, sitemap generation, and programmatic page deployment."
bundle: "seo-content-marketing"
estimatedDuration: "30-60m"
---

# Workflow: Technical SEO Audit & Programmatic Deployment

## Overview & Scope
This workflow coordinates full-site technical SEO audits, Core Web Vitals checks, schema JSON-LD generation, and programmatic landing page deployments.

## Execution Flowchart
```mermaid
graph TD
    Start([Start SEO Pipeline]) --> P1[Phase 1: Crawl & Indexing Audit]
    P1 --> InputCheck{"Robots.txt & Canonical Directives Valid?"}
    InputCheck -->|No| Abort1[Abort & Fix Directive Errors]
    InputCheck -->|Yes| P2[Phase 2: Schema & Content Optimization]
    P2 --> Gate1{"Verification Gate: Schema.org Validation Pass?"}
    Gate1 -->|Fail| P2Fix[Remediate Missing Schema Fields]
    P2Fix --> P2
    Gate1 -->|Pass| P3[Phase 3: Sitemap Generation & Verification]
    P3 --> Gate2{"Indexability Gate: Zero Crawl Errors Reported?"}
    Gate2 -->|Fail| P3Retry[Inspect Broken Links and 404s]
    P3Retry --> P3
    Gate2 -->|Pass| Done([SEO Pipeline Verified & Live])
```

## Phase 1: Crawl & Indexing Audit
- Inspect `robots.txt`, meta robots tags, and canonical headers.
- Audit page load performance and Core Web Vitals scores.

## Phase 2: Schema & Content Optimization
- Inject structured JSON-LD schemas (`SoftwareApplication`, `FAQPage`, `BreadcrumbList`).
- Verify keyword placement in titles, H1/H2 tags, and meta descriptions.

## Phase 3: Sitemap Generation & Verification
- Compile and validate XML sitemaps.
- Submit sitemap ping to search engine consoles.

## Phase Transition Criteria & Deterministic Verification Gates
| Transition | Prerequisites | Verification Command / Gate | Success Criteria |
|---|---|---|---|
| Phase 1 -> Phase 2 | Crawl checks pass | `node dist/cli.js doctor` | 0 robots.txt or canonical errors |
| Phase 2 -> Phase 3 | Schema injected | `npm test` | JSON-LD schema syntax validates cleanly |
| Phase 3 -> Completion | Sitemap verified | `node dist/cli.js doctor` | Sitemaps compiled with valid XML |
