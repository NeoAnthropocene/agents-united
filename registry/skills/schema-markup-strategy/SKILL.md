---
name: schema-markup-strategy
description: "Use when writing or reviewing JSON-LD for a site, a template or a launch, when rich results are expected and missing, or when a validator reports errors; trigger phrases: add schema markup, write JSON-LD for this page, why no rich results, structured data errors, should we use FAQ schema. Produces a type map, JSON-LD as an @graph of connected entities, the required and recommended properties per type with the source consulted, validation results and a monitoring plan. Skip it for markup of content that is not on the page and for chasing an eligibility the search engine has restricted."
metadata:
  author: agents-united
  version: 3.0.0
  icon: 🧬
disable-slash-command: true
---

# Schema Markup Strategy

Structured data tells a search engine, in machine-readable form, what a page is about. It helps eligibility for rich results; it does not by itself raise rankings, and markup that disagrees with the visible page can be ignored or draw a manual action.

## Overview & Purpose
For Selin, who authors snippets as deliverables: the rules for choosing types, connecting entities, checking required properties and validating. Deniz places the snippets in the templates; Yavuz and Kaan own the content the markup describes.

## Execution Triggers
Load it when you write or review JSON-LD for a site, template or launch, when rich results are expected and missing, or when a validator reports errors. Do not use it to add markup for content that is not on the page, or to chase an eligibility the search engine has restricted.

## Input/Output Requirements
Inputs: the page types and a representative URL each; what each page shows (visible text, prices, ratings, authors, dates); the organisation facts (name, logo, official profiles); the current markup if any.

Output: a type map (page type, schema type, why); the JSON-LD for each type (an `@graph` with connected entities); required and recommended properties per type with the source consulted; the validation results; a monitoring plan. **Evidence to attach**: the date and the documentation page you read for each type's requirements (they change), and the validator output.

## Step-by-Step Runbook
1. **Start from the visible page**: list what a visitor can see (headline, author, date, price, rating, steps, questions). Markup may describe only that: no stars that are not on the page, no price that differs from the price shown.
2. **Map page types to schema types** conservatively (`Organization`, `Article`, `SoftwareApplication` or `Product` with `offers`, `BreadcrumbList`; a how-to or Q&A only if the page truly is one). The map and properties: [references/type-map.md](references/type-map.md).
3. **Check eligibility before writing.** It changes: when last read, `FAQPage` rich results were restricted to a narrow set of authoritative sites and how-to rich results were withdrawn, so promise neither; mark such markup optional and say why. Read the current structured-data documentation for each type and note the date.
4. **Use JSON-LD in an `@graph`** with stable `@id` values so entities connect: `WebSite` and `Organization` once for the site, the `WebPage` referencing them, the main entity referencing the page and its author or publisher.
5. **Fill the required properties first, then the recommended ones**. A `Product` needs a name and at least one of `offers`, `review` or `aggregateRating`, with price and currency from the page. Never invent ratings or reviews.
6. **Keep it in sync**: generate markup from the same data as the page, not a copy; otherwise add a test that compares the two.
7. **Validate** with the Rich Results Test for eligibility and the Schema Markup Validator for syntax, on the live or staged URL; fix errors before warnings. A valid block can still be ineligible.
8. **Hand off.** The snippets and the template rule to Deniz (the markup-against-page test to Emre); the facts the markup states to Yavuz and Kaan; anything about reviews, ratings or claims about people to Defne.

## Code & Config Exemplars
Load [examples/worked-example.md](examples/worked-example.md) for a product page as an `@graph` (organisation, page, software application with an offer), with the notes on what was left out and why.

Anti-patterns, each with its reason:
- Markup for content the page does not show: it can be ignored or penalised.
- Fake or copied review ratings: a manual action risk.
- Promising FAQ or how-to rich results: eligibility is restricted.
- Unconnected blocks, each repeating the organisation: parsers cannot join them.
- A price in markup different from the page's: the mismatch is the violation.
- A valid validator result taken as a promise: valid is not eligible.

## Edge Cases & Error Recovery
- **A missing required property**: add it from the visible page; if the page does not show it, drop the markup type or change the page, never the truth of the markup.
- **Markup and page disagree after a price change**: generate both from one data source and add the comparison test.
- **A plugin or tag manager injects duplicate markup**: keep one source; conflicting blocks confuse parsers.
- **Valid markup, no rich results**: display is at the engine's discretion; record the status and check after the next crawl.
- **Documentation changed**: re-read it, update the type map and note the date.

## Verification Checklist
- [ ] Every property in the markup corresponds to something visible on the page.
- [ ] The `@graph` connects entities with stable `@id` values; the organisation appears once.
- [ ] Required properties are present for each type, with the documentation read and its date recorded.
- [ ] FAQ and how-to markup are not promised as rich results.
- [ ] Rich Results Test and Schema Markup Validator results are recorded for a live or staged URL.
- [ ] Hand-offs name Deniz, Emre, Yavuz, Kaan and, for ratings or claims about people, Defne.
