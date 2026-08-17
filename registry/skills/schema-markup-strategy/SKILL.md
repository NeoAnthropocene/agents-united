---
name: schema-markup-strategy
description: Production-grade Schema Markup Strategy playbook for JSON-LD structured data architecture, Schema.org entities, rich snippet qualification, and SERP visibility.
metadata:
  author: "agents-united"
  version: "2.0.0"
---

# Schema Markup Strategy & JSON-LD Structured Data Architecture

## Overview & Purpose
The Schema Markup Strategy skill provides a deterministic framework for architecting and deploying production-grade JSON-LD structured data conforming to Schema.org standards and Google Search Gallery specifications.

Following this skill structures interconnected entity graphs (`@graph`), linking Organization, WebSite, WebPage, SoftwareApplication, Product, FAQPage, BreadcrumbList, HowTo, and Article entities to unlock Google rich snippets, Knowledge Panels, and LLM semantic web parsing.

## Execution Triggers & Prerequisites
### Execution Triggers
- Implementing structured data for SaaS product pages, blog articles, documentation, or FAQs.
- Qualifying web pages for Google Rich Results (FAQ accordions, breadcrumbs, star ratings, software pricing).
- Resolving Google Search Console structured data warnings and validation errors.
- Establishing brand entity Knowledge Graph authority across organizational domains.

### Prerequisites
- Target page URLs, entity data (authors, publish dates, ratings, pricing, FAQ items).
- Web application framework supporting `<script type="application/ld+json">` injection.
- Google Rich Results Test or Schema Validator testing tools.
- Clean git working directory.

## Input & Output Requirements
### Inputs
| Parameter | Type | Required | Description |
|---|---|---|---|
| `entity_types` | Array<String> | Yes | Target entities: `['SoftwareApplication', 'FAQPage', 'Organization', 'BreadcrumbList']` |
| `page_url` | String | Yes | Canonical URL of target page |
| `organization_metadata` | Object | Yes | Name, logo URL, sameAs social links, contact point |
| `item_payload` | Object | Yes | Specific entity properties (pricing, ratings, steps, questions) |
| `strict_mode` | Boolean | Optional | Enforce zero-warning validation against Google specs |

### Outputs
| Artifact | Path / Format | Description |
|---|---|---|
| Schema Architecture Spec | `docs/schema-markup-strategy/schema-spec.md` | Entity graph definitions and property mapping |
| React / Next.js Component | `src/components/seo/JsonLd.tsx` | Reusable JSON-LD script injector component |
| Validation Audit Report | `reports/schema-markup-strategy/validation.json` | Google Rich Results API test output and status |

## Step-by-Step Execution Runbook

### Phase 1: Entity Graph Discovery & Schema Vocabulary Selection
1. Inspect target page content to classify required Schema.org entity types.
2. Review Google Search Gallery guidelines for eligible rich result types (e.g. Software App, FAQ, Breadcrumb).
3. Extract core entity properties: `@id` URI anchors, `@type`, name, url, description, author, dateModified.
4. Establish entity graph relationships using `@graph` notation to link sub-entities to parent Organization and WebPage.
5. Verify schema licensing and compliance against Schema.org vocabulary version 26+.

### Phase 2: Structured JSON-LD Graph (`@graph`) Data Modeling
1. Author canonical Organization root entity with official logo URL and verified `sameAs` social profiles.
2. Build WebSite and WebPage entities referencing root Organization as `publisher`.
3. Construct specific domain entities:
   - `SoftwareApplication`: include `operatingSystem`, `applicationCategory`, `offers` (price, currency), `aggregateRating`.
   - `FAQPage`: build `mainEntity` array containing `Question` and accepted `Answer` blocks.
   - `BreadcrumbList`: define `itemListElement` array with positional integers and item URLs.
4. Link entities using unambiguous `@id` URI fragments (e.g., `https://example.com/#organization`).

### Phase 3: Component Integration & Dynamic Hydration
1. Create a typed, reusable Next.js / React component (`<JsonLd data={graph} />`) that renders sanitized JSON-LD in `<head>` or page root.
2. Implement XSS escaping for user-generated strings injected into JSON-LD script tags.
3. Configure dynamic metadata hooks to populate real-time pricing and rating changes into the schema payload.
4. Integrate schema generation directly into CMS or programmatic template render pipelines.

### Phase 4: Schema Validation, Google Rich Results Testing & Syntax Linting
1. Run local JSON-LD parser validation to confirm zero trailing commas or syntax errors.
2. Test rendered output against Google Rich Results Test API / schema validator CLI.
   ```bash
   npx schema-dts-gen --input docs/schema-markup-strategy/sample.json --validate
   ```
3. Assert that zero required fields are missing and all recommended fields are populated where applicable.
4. Verify that schema content exactly mirrors visible on-page user content to prevent manual spam actions.

### Phase 5: Deployment Verification & SERP Feature Monitoring
1. Deploy structured data component to staging / preview environment.
2. Execute live URL inspection check confirming correct MIME type `<script type="application/ld+json">`.
3. Log schema deployment metadata to `reports/schema-markup-strategy/validation.json`.
4. Commit validated schema components to repository.
   ```bash
   git add docs/schema-markup-strategy/ src/components/seo/
   git commit -m "feat(schema-markup-strategy): implement nested JSON-LD structured data engine"
   ```
5. Set up Google Search Console Rich Results tracking.

## Code & Configuration Exemplars

### Exemplar 1: Multi-Entity Nested JSON-LD `@graph` Specification
```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://agents-united.dev/#organization",
      "name": "Agents United",
      "url": "https://agents-united.dev",
      "logo": "https://agents-united.dev/logo.png",
      "sameAs": [
        "https://github.com/agents-united",
        "https://twitter.com/agentsunited"
      ]
    },
    {
      "@type": "SoftwareApplication",
      "@id": "https://agents-united.dev/#software",
      "name": "Agents United CLI",
      "operatingSystem": "All",
      "applicationCategory": "DeveloperApplication",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD"
      },
      "aggregateRating": {
        "@type": "AggregateRating",
        "ratingValue": "4.9",
        "ratingCount": "128"
      }
    },
    {
      "@type": "FAQPage",
      "@id": "https://agents-united.dev/#faq",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "How do I install Agents United?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Run npm install -g @neoanthropocene/agents-united to install globally."
          }
        }
      ]
    }
  ]
}
```

### Exemplar 2: TypeScript React Reusable JSON-LD Injection Component
```typescript
import React from 'react';

export interface JsonLdProps {
  data: Record<string, any>;
}

export function JsonLd({ data }: JsonLdProps): React.JSX.Element {
  const jsonString = JSON.stringify(data, null, 2)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: jsonString }}
    />
  );
}
```

## Edge Cases & Error Recovery Procedures

### Scenario A: Google Rich Results Error on Missing Required Schema Properties
1. **Diagnosis**: Validator flags missing required fields (e.g., `offers.priceCurrency` or `publisher.logo`).
2. **Recovery Protocol**:
   - Step 1: Consult Google Search Gallery documentation for the failing entity type.
   - Step 2: Inject fallback default values for missing required properties into data mapper.
   - Step 3: Re-run schema validator script and assert zero errors.

### Scenario B: Schema Content Mismatch with On-Page Rendered HTML
1. **Diagnosis**: Search engine flags cloaking or deceptive markup because schema price/rating differs from page text.
2. **Recovery Protocol**:
   - Step 1: Ensure JSON-LD generator consumes the exact same data source object as React UI components.
   - Step 2: Implement build-time assertion checking parity between DOM text nodes and JSON-LD properties.
   - Step 3: Re-deploy corrected unified data source.

## Verification & Validation Checklist
- [ ] Frontmatter conforms strictly to `author: "agents-united"` and `version: "2.0.0"`.
- [ ] All 7 mandatory sections present with explicit headers.
- [ ] Step-by-Step Execution Runbook body contains >= 50 lines.
- [ ] Nested `@graph` syntax used for cross-entity referencing.
- [ ] XSS escaping sanitization implemented for JSON-LD strings.
- [ ] Code exemplars provided with valid syntax fencing.
- [ ] Zero dummy placeholder strings or unpopulated template markers present.
- [ ] Project build, test suite, and doctor check pass 100% cleanly.
