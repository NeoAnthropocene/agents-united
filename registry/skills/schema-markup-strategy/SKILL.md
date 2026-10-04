---
name: schema-markup-strategy
description: "Choose and write schema.org JSON-LD that matches what the page really shows: types per page, an @graph with connected entities, required properties checked at the source, the limits on FAQ and how-to rich results, validation, and what to monitor."
metadata:
  author: agents-united
  version: 3.0.0
  icon: 🧬
disable-slash-command: true
---

# Schema Markup Strategy

## Overview & Purpose
Structured data tells a search engine, in a machine-readable form, what a page is about. It helps eligibility for rich results; it does not by itself raise rankings, and markup that disagrees with the visible page can lead to the markup being ignored or to a manual action. This skill gives Selin the rules for choosing types, connecting entities, checking required properties and validating.

Selin authors snippets as deliverables. Deniz places them in the templates; Yavuz and Kaan own the content that the markup describes.

## Execution Triggers
Load it when you write or review JSON-LD for a site, a template or a launch, when rich results are expected and missing, or when a validator reports errors. Do not use it to add markup for content that is not on the page, or to chase an eligibility that Google has restricted.

## Input/Output Requirements
Inputs: the page types and a representative URL for each, what each page shows (visible text, prices, ratings, authors, dates), the organisation facts (name, logo, official profiles), and the current markup if any.

Outputs: a type map (page type, schema type, why), the JSON-LD for each type (an `@graph` with connected entities), a list of required and recommended properties per type with the source consulted, the validation results, and a monitoring plan. **Evidence to attach**: the date and the documentation page you read for each type's requirements (they change), and the validator output.

## Step-by-Step Runbook
1. **Start from the visible page.** List what a visitor can see: headline, author, date, price, rating, steps, questions. Markup may describe only that. No review stars that are not on the page, no price that differs from the price shown.
2. **Map page types to schema types** conservatively: home or about to `Organization` (name, url, logo, official profile links); articles to `Article` or `BlogPosting` (headline, image, dates, author); a software product to `SoftwareApplication` or `Product` with `offers`; hierarchy to `BreadcrumbList`; a how-to or Q&A only if the page truly is one.
3. **Check eligibility before writing.** Rich-result eligibility changes. Today, FAQ (`FAQPage`) rich results are restricted to a narrow set of authoritative sites and how-to rich results have been withdrawn, so do not promise either; mark such markup optional and explain the expectation. Read the current requirements on the search engine's structured-data documentation for each type, and note the date.
4. **Use JSON-LD in an `@graph`** with stable `@id` values so entities connect: the `WebSite` and `Organization` once for the site, the `WebPage` referencing them, and the page's main entity (`Article`, `Product`) referencing the page and its author or publisher.
5. **Fill the required properties first, then the recommended ones.** For a `Product` the search engine asks for a name and at least one of `offers`, `review` or `aggregateRating`; include the price and currency from the page. Do not invent ratings or reviews; use real, visible ones.
6. **Keep it in sync.** If markup is generated from the same data as the page (a template, not a copy), mismatch cannot drift; otherwise add a test that compares the two.
7. **Validate** with the Rich Results Test for eligibility and the Schema Markup Validator for syntax, on the live or staged URL, and fix errors before warnings. A valid block can still be ineligible.
8. **Hand off.** The snippets and the template rule to Deniz (and the test that compares markup with the page to Emre); the facts the markup states to Yavuz and Kaan for confirmation; anything about reviews, ratings or claims about people to Defne.

## Code & Config Exemplars
### Worked example
A product page for a free-and-paid invoicing tool (invented). Visible: name, short description, a price of 12.00 USD per month for the paid plan, no ratings.

```json
{
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "Organization", "@id": "https://example.com/#org", "name": "Example Inc", "url": "https://example.com/", "logo": "https://example.com/logo.png" },
    { "@type": "WebPage", "@id": "https://example.com/product#page", "url": "https://example.com/product", "isPartOf": { "@id": "https://example.com/#site" }, "about": { "@id": "https://example.com/product#app" } },
    {
      "@type": "SoftwareApplication",
      "@id": "https://example.com/product#app",
      "name": "Example Invoicing",
      "applicationCategory": "BusinessApplication",
      "operatingSystem": "Web",
      "offers": { "@type": "Offer", "price": "12.00", "priceCurrency": "USD" },
      "publisher": { "@id": "https://example.com/#org" }
    }
  ]
}
```

Notes: no `aggregateRating` because the page shows no ratings (adding one would be markup for invisible content). The `WebSite` entity with `@id` `#site` is defined once on the home page and referenced here. Validation: Rich Results Test result recorded on the staged URL with the date; syntax checked with the Schema Markup Validator. Eligibility expectation: product information may be shown; no promise of stars.

### Anti-patterns
- Markup for content the page does not show.
- Fake or copied review ratings.
- Promising FAQ or how-to rich results.
- Several unconnected blocks, each repeating the organisation.
- A price in markup different from the price on the page.
- Treating a valid validator result as a guarantee of a rich result.

## Edge Cases & Error Recovery
- **The validator reports a missing required property**: add it from the visible page; if the page does not show it, drop the markup type or change the page, not the truth of the markup.
- **Markup and page disagree after a price change**: generate both from one data source and add the comparison test.
- **A plugin or tag manager injects duplicate markup**: find the duplicate and keep one source; conflicting blocks confuse parsers.
- **Rich results do not appear though the markup is valid**: eligibility and display are at the engine's discretion; record the status and check again after the next crawl.
- **Search engine documentation changed**: re-read it, update the type map and note the date.

## Verification Checklist
- [ ] Every property in the markup corresponds to something visible on the page.
- [ ] The `@graph` connects entities with stable `@id` values; the organisation appears once.
- [ ] Required properties are present for each type, with the documentation read and its date recorded.
- [ ] FAQ and how-to markup are not promised as rich results.
- [ ] Rich Results Test and Schema Markup Validator results are recorded for a live or staged URL.
- [ ] Hand-offs name Deniz, Emre, Yavuz, Kaan and, for ratings or claims about people, Defne.
