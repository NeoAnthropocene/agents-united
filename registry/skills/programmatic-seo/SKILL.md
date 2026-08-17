---
name: programmatic-seo
description: Production-grade Programmatic SEO playbook for data-driven landing page templates, dynamic URL routing, database seeding, schema JSON-LD, and anti-thin-content guardrails.
metadata:
  author: "agents-united"
  version: "2.0.0"
---

# Programmatic SEO & Data-Driven Landing Page Generation Architecture

## Overview & Purpose
The Programmatic SEO skill provides a robust architectural framework for generating hundreds or thousands of high-intent, indexable landing pages from structured databases while rigorously avoiding Google search engine penalties for thin, low-value, or duplicate content.

Following this skill establishes dynamic URL path hierarchies, high-value data-enriched page templates, automated internal linking meshes, XML sitemap indexing partitions, dynamic JSON-LD schema injection, and programmatic quality auditing.

## Execution Triggers & Prerequisites
### Execution Triggers
- Designing and deploying programmatic directory, comparison, or integration landing pages.
- Scaling organic search traffic for long-tail keyword permutations (e.g. `{tool} vs {alternative}`, `best {category} for {platform}`).
- Automating XML sitemap generation and indexation workflows for large-scale dynamic routes.
- Auditing existing programmatic pages to eliminate thin content and cannibalization risks.

### Prerequisites
- Structured dataset or database table containing entity records, features, pricing, and pros/cons.
- Framework supporting dynamic static site generation (Next.js App Router, Astro, SvelteKit).
- Search Console / SEO crawling tools (Screaming Frog, Sitebulb) for pre-deployment validation.
- Clean git working directory.

## Input & Output Requirements
### Inputs
| Parameter | Type | Required | Description |
|---|---|---|---|
| `dataset_path` | String | Yes | Path to JSON, CSV, or database connection for page entities |
| `url_pattern` | String | Yes | Dynamic route pattern (e.g. `/compare/[competitor]-alternatives`) |
| `target_keyword_template` | String | Yes | Pattern for title and H1 tags (e.g. `Top 10 {competitor} Alternatives in 2026`) |
| `min_unique_content_ratio` | Number | Optional | Minimum unique text ratio per page (default: 0.60) |
| `max_urls_per_sitemap` | Number | Optional | Sitemap chunking limit (default: 10000) |

### Outputs
| Artifact | Path / Format | Description |
|---|---|---|
| Programmatic Spec Spec | `docs/programmatic-seo/programmatic-spec.md` | Architecture, data schema, and template rules |
| Dynamic Route Component | `src/app/compare/[slug]/page.tsx` | Next.js dynamic static generation template |
| Dataset Seeder Module | `src/services/seo/dataset-seeder.ts` | Data validation, enrichment, and normalization |
| Sitemap Generator | `src/services/seo/sitemap-generator.ts` | Chunked XML sitemap index and file builder |

## Step-by-Step Execution Runbook

### Phase 1: Keyword Opportunity Modeling & Database Schema Design
1. Conduct keyword permutation research identifying head terms and modifier facets (`[entity] + [modifier] + [location/use-case]`).
2. Construct the underlying database or JSON schema. Every entity record must include:
   - Primary identifier, display name, category, and slug.
   - Unique value proposition paragraph (minimum 150 unique words per record).
   - Structured comparison metrics (feature flags, pricing tiers, benchmarks).
   - Curated user review snippets, pros/cons bullet points, and verified screenshots.
3. Validate dataset integrity: assert that no two records share identical descriptions or duplicate slugs.

### Phase 2: Dynamic URL Hierarchy & Template Modularization
1. Author canonical URL routing schemas ensuring shallow directory depth (e.g. `/tools/{slug}` or `/alternatives-to/{slug}`).
2. Build modular page template combining static anchor sections with dynamic, data-driven components:
   - Dynamic Hero with keyword-optimized H1 and metadata summary.
   - Interactive Comparison Matrix component rendering tabular feature differences.
   - Dynamic FAQ Accordion populated from entity-specific Q&A data.
   - User Review & Sentiment Breakdown visualization.
3. Ensure every page includes unique, dynamically computed insights (e.g. price per seat calculations or latency benchmarks).

### Phase 3: Automated Internal Linking Mesh & Breadcrumbs
1. Implement contextual breadcrumb navigation on every programmatic page with Schema.org `BreadcrumbList` markup.
2. Build related-entity recommendation algorithms linking each programmatic page to 5-8 contextually relevant sibling pages within the same category.
3. Construct hub pages (category index hubs) that aggregate and distribute PageRank across programmatic leaf nodes.
4. Verify that no page becomes an orphan node unreachable from the root site navigation graph.

### Phase 4: Anti-Thin-Content Auditing & Duplicate Content Guardrails
1. Execute algorithmic lexical similarity check (Jaccard similarity / TF-IDF cosine distance) across generated page outputs.
2. Enforce minimum uniqueness threshold: reject any generated page where boilerplate exceeds 40% of total page content.
3. If data is sparse for a specific entity record, automatically redirect or return `404/410` status rather than publishing a thin page.
4. Dynamically inject unique user-generated or API-fetched data points (real-time uptime, changelog dates) to continuously differentiate pages.

### Phase 5: XML Sitemap Partitioning, Static Generation & Indexation Monitoring
1. Generate chunked XML sitemaps partitioned into subsets of <= 10,000 URLs with `<lastmod>` timestamps reflecting data updates.
2. Create a master `sitemap_index.xml` referencing all partition files.
3. Execute static build (`next build` / `astro build`) to pre-render static HTML pages for sub-millisecond TTFB.
4. Run crawler audit asserting 100% of generated URLs return HTTP 200 with valid canonical tags matching target URLs.
5. Commit programmatic SEO architecture to repository.
   ```bash
   git add src/app/ src/services/seo/ docs/programmatic-seo/
   git commit -m "feat(programmatic-seo): implement scalable programmatic page generation engine"
   ```

## Code & Configuration Exemplars

### Exemplar 1: Dynamic Static Page Generation Template (Next.js App Router)
```typescript
import { notFound } from 'next/navigation';
import { getEntityBySlug, getAllEntitySlugs } from '@/services/seo/dataset-seeder';
import { JsonLd } from '@/components/seo/JsonLd';

export async function generateStaticParams() {
  const slugs = await getAllEntitySlugs();
  return slugs.map(slug => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entity = await getEntityBySlug(slug);
  if (!entity) return {};

  return {
    title: `Top 10 ${entity.name} Alternatives & Competitors (2026)`,
    description: `Compare ${entity.name} with leading competitors. In-depth pricing, feature analysis, and benchmarks.`,
    alternates: {
      canonical: `https://agents-united.dev/compare/${entity.slug}-alternatives`,
    },
  };
}

export default async function ComparePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entity = await getEntityBySlug(slug);
  if (!entity) notFound();

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-4xl font-extrabold mb-4">Top {entity.name} Alternatives & Competitors</h1>
      <p className="text-lg text-slate-700 mb-8">{entity.customSummary}</p>
      {/* Dynamic Data-Driven Comparison Matrix */}
      <section className="border rounded-xl p-6 bg-slate-50 mb-8">
        <h2 className="text-2xl font-bold mb-4">Feature Comparison Matrix</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2">Feature</th>
                <th className="py-2">{entity.name}</th>
                <th className="py-2">Agents United</th>
              </tr>
            </thead>
            <tbody>
              {entity.features.map((feat: any) => (
                <tr key={feat.name} className="border-b">
                  <td className="py-2 font-medium">{feat.name}</td>
                  <td className="py-2">{feat.value}</td>
                  <td className="py-2 text-emerald-600 font-semibold">{feat.ourValue}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <JsonLd data={{
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: `Top ${entity.name} Alternatives`,
        description: entity.customSummary,
      }} />
    </main>
  );
}
```

### Exemplar 2: Chunked XML Sitemap Generator
```typescript
export interface SitemapUrlEntry {
  loc: string;
  lastmod: string;
  changefreq: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority: number;
}

export function generateSitemapXml(urls: SitemapUrlEntry[]): string {
  const entries = urls.map(u => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority.toFixed(1)}</priority>
  </url>`).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>`;
}
```

## Edge Cases & Error Recovery Procedures

### Scenario A: Google Flags Programmatic URLs as Thin / Soft 404
1. **Diagnosis**: Google Search Console reports pages as "Crawled - currently not indexed" or "Soft 404" due to low unique content density.
2. **Recovery Protocol**:
   - Step 1: Run lexical similarity scanner identifying duplicate paragraph fragments across pages.
   - Step 2: Enrich dataset with additional bespoke fields (user feedback quotes, automated API performance benchmarks).
   - Step 3: Add `noindex, follow` tags to pages below the minimum content threshold until enrichment is completed.

### Scenario B: Dynamic Parameter Slugs Conflict with Static Routes
1. **Diagnosis**: Dynamic slug `/compare/[slug]` clashes with static system routes like `/compare/pricing` or `/compare/settings`.
2. **Recovery Protocol**:
   - Step 1: Implement reserved route blacklist in `dataset-seeder.ts` preventing slug generation for system keywords.
   - Step 2: Use distinct subdirectory pathing for programmatic templates (e.g. `/compare/tools/[slug]`).
   - Step 3: Add automated unit test asserting zero collision between dynamic dataset slugs and static app routes.

## Verification & Validation Checklist
- [ ] Frontmatter conforms strictly to `author: "agents-united"` and `version: "2.0.0"`.
- [ ] All 7 mandatory sections present with explicit headers.
- [ ] Step-by-Step Execution Runbook body contains >= 50 lines.
- [ ] Next.js / framework static generation code exemplar provided with valid syntax fencing.
- [ ] Lexical similarity threshold and anti-thin-content guardrails documented.
- [ ] Chunked XML sitemap generation architecture detailed.
- [ ] Zero dummy placeholder strings or unpopulated template markers present.
- [ ] Project build, test suite, and doctor check pass 100% cleanly.
