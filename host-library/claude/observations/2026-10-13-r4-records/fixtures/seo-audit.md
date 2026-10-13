# PetPal Landing Page: Pre-Launch Technical SEO Checklist (scratch exercise)
Status: no site exists, so these are launch requirements, not crawl findings. No score is claimed. Code fixes are recommendations for Deniz.
Contract: hero CTA testId `hero-primary-cta` ("Find a sitter near you").

| # | Requirement | Severity | Pass condition (verify after build) |
|---|---|---|---|
| 1 | Title and meta description | Major | Title 50-60 chars, primary keyword first, brand suffix; description 120-155 chars with a value proposition |
| 2 | Canonical and indexation | Critical | Self-referential canonical on the live page; staging and admin routes carry `noindex`; robots.txt declares the sitemap |
| 3 | OpenGraph and social preview | Minor | og:title, og:description, og:image (1200x630), og:url, twitter:card present and match the visible page |
| 4 | Structured data | Major | FAQPage JSON-LD below parses, matches visible FAQ text on the page, and passes the Rich Results Test |
| 5 | Hero LCP | Critical | LCP at most 2.5s at p75 (mobile); hero image has dimensions, is not lazy-loaded, is preloaded; `hero-primary-cta` is in the initial HTML |

FAQ answers are placeholders: PetPal ops must confirm the wording, and the same text must be visible on the page before the markup ships.

```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "How do I choose a trustworthy pet sitter?",
      "acceptedAnswer": { "@type": "Answer", "text": "Compare profiles and reviews, ask about experience with your type of pet, and arrange a meet-and-greet before the first booking. [PLACEHOLDER: PetPal to confirm wording]" }
    },
    {
      "@type": "Question",
      "name": "What should I ask a sitter before the first booking?",
      "acceptedAnswer": { "@type": "Answer", "text": "Ask about their experience, how they handle emergencies, and how they will keep you updated during the stay. [PLACEHOLDER: PetPal to confirm wording]" }
    },
    {
      "@type": "Question",
      "name": "How are sitters vetted?",
      "acceptedAnswer": { "@type": "Answer", "text": "[PLACEHOLDER: list only the checks PetPal ops confirms it actually runs; do not publish until confirmed and legally reviewed]" }
    }
  ]
}
```
