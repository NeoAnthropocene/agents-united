# Worked example (an invented product page, for checking your own work)

A product page for a free-and-paid invoicing tool. Visible on the page: the name, a short description, a price of 12.00 USD per month for the paid plan, and no ratings.

## The JSON-LD

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

## The notes

- No `aggregateRating`: the page shows no ratings, and adding one would be markup for invisible content.
- The `WebSite` entity with `@id` `#site` is defined once on the home page and referenced here.
- Validation: the Rich Results Test result is recorded on the staged URL with the date; the syntax is checked with the Schema Markup Validator.
- Eligibility expectation: product information may be shown; no promise of stars.
